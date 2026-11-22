import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/app/utils/supabaseAdmin';
import {
  MAX_FEEDBACK_BODY_BYTES,
  FEEDBACK_RATE_LIMIT_WINDOW_MINUTES,
  FEEDBACK_RATE_LIMIT_MAX_REQUESTS,
  extractClientIp,
  hashIpAddress,
  isSpamSubmission,
  validateFeedbackFields,
  sanitizeMetadata,
  buildDiscordWebhookPayload,
} from '@/app/utils/feedbackUtils';

export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function POST(request) {
  try {
    // 1. Validar tamaño por cabecera si está presente
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FEEDBACK_BODY_BYTES) {
      return NextResponse.json(
        { error: 'El tamaño de la petición supera el límite permitido de 10 KB.' },
        { status: 413, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Leer texto crudo y validar tamaño exacto
    const rawText = await request.text();
    if (rawText.length > MAX_FEEDBACK_BODY_BYTES) {
      return NextResponse.json(
        { error: 'El tamaño de la petición supera el límite permitido de 10 KB.' },
        { status: 413, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Parsear JSON de forma segura
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de petición JSON inválido.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 4. Anti-spam silencioso (honeypot o envío ultrarrápido <2s)
    if (isSpamSubmission(body)) {
      return NextResponse.json(
        { ok: true, id: null },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    // 5. Validar campos requeridos
    const validation = validateFeedbackFields(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status || 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { type, message, contact } = validation.data;

    // 6. Sanitizar metadata técnica
    const userAgentHeader = request.headers.get('user-agent') || '';
    const metadata = sanitizeMetadata(body.metadata, userAgentHeader);

    // 7. Rate limiting con hash SHA-256 de IP
    const clientIp = extractClientIp(
      request.headers.get('x-forwarded-for'),
      request.headers.get('x-real-ip')
    );
    const ipHash = hashIpAddress(clientIp);

    if (!supabaseAdmin) {
      console.error('Supabase admin client is not configured');
      return NextResponse.json(
        { error: 'El servicio de comentarios no está configurado en el servidor.' },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }

    const windowStart = new Date(
      Date.now() - FEEDBACK_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', windowStart);

    if (countError) {
      console.error('Error al comprobar rate limit en feedback:', countError);
    } else if (typeof count === 'number' && count >= FEEDBACK_RATE_LIMIT_MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Has enviado demasiados mensajes recientemente. Espera un rato antes de volver a intentarlo.' },
        { status: 429, headers: NO_CACHE_HEADERS }
      );
    }

    // 8. Persistir en la tabla public.feedback
    const { data, error: insertError } = await supabaseAdmin
      .from('feedback')
      .insert({
        type,
        message,
        contact,
        metadata,
        ip_hash: ipHash,
        status: 'new',
      })
      .select('id, created_at')
      .single();

    if (insertError || !data) {
      console.error('Error al insertar feedback en Supabase:', insertError);
      return NextResponse.json(
        { error: 'No se pudo guardar tu mensaje. Inténtalo de nuevo más tarde.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 9. Notificación asíncrona a Discord Webhook mediante after()
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      after(async () => {
        try {
          const payload = buildDiscordWebhookPayload({
            id: data.id,
            type,
            message,
            contact,
            metadata,
            created_at: data.created_at,
          });

          const res = await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            console.error(`Discord webhook responded with HTTP ${res.status}: ${errorText}`);
          }
        } catch (discordErr) {
          console.error('Error al enviar notificación a Discord Webhook:', discordErr);
        }
      });
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn('DISCORD_WEBHOOK_URL no configurada; notificación a Discord omitida.');
    }

    return NextResponse.json(
      { ok: true, id: data.id },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error('Error inesperado en POST /api/feedback:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar el mensaje.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
