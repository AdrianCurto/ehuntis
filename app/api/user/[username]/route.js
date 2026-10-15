import { NextResponse } from 'next/server';
import { supabase } from '@/app/utils/supabaseClient';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const { PALETTE, PALETTE_DARK } = _require('../../../utils/colorLogic');

const USERNAME_REGEX = /^[a-zA-Z0-9_\-\.]{6,30}$/;
const MAX_BODY_SIZE_BYTES = 500 * 1024; // 500 KB

// Serialize palette to simple { bg, text, border } arrays for widgets
const PALETTE_LIGHT_SIMPLE = PALETTE.map(p => ({ bg: p.bg, text: p.text, border: p.border }));
const PALETTE_DARK_SIMPLE  = PALETTE_DARK.map(p => ({ bg: p.bg, text: p.text, border: p.border }));

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request, { params }) {
  const { username } = await params;

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: 'Formato de usuario inválido. Debe tener entre 6 y 30 caracteres alfanuméricos, puntos, guiones o barras bajas.' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  if (!supabase) {
    console.error('Supabase client is not configured');
    return NextResponse.json(
      { error: 'Supabase no está configurado en el servidor.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, configs, active_config_id, updated_at')
      .eq('username', username)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }
      console.error('Error fetching user from Supabase:', error);
      return NextResponse.json(
        { error: error?.message || 'Error al consultar el usuario' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        username: data.username,
        configs: data.configs || [],
        active_config_id: data.active_config_id || null,
        updated_at: data.updated_at,
        // Palette included so widgets never need hardcoded colors.
        // colorIndex in customColors maps directly to palette[colorIndex].
        palette: {
          light: PALETTE_LIGHT_SIMPLE,
          dark:  PALETTE_DARK_SIMPLE,
        },
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (err) {
    console.error('Unexpected error in GET /api/user/[username]:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request, { params }) {
  const { username } = await params;

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: 'Formato de usuario inválido. Debe tener entre 6 y 30 caracteres alfanuméricos, puntos, guiones o barras bajas.' },
      { status: 400 }
    );
  }

  if (!supabase) {
    console.error('Supabase client is not configured');
    return NextResponse.json(
      { error: 'Supabase no está configurado en el servidor.' },
      { status: 500 }
    );
  }

  // Comprobar tamaño de cabecera Content-Length si viene presente
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'El tamaño de la petición supera el límite permitido de 500 KB' },
      { status: 413 }
    );
  }

  let body;
  try {
    const rawText = await request.text();
    if (rawText.length > MAX_BODY_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'El tamaño de la petición supera el límite permitido de 500 KB' },
        { status: 413 }
      );
    }
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de petición JSON inválido' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'El cuerpo de la petición debe ser un objeto JSON' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.configs)) {
    return NextResponse.json(
      { error: 'El campo "configs" debe ser un array' },
      { status: 400 }
    );
  }

  if (body.configs.length === 0) {
    return NextResponse.json(
      { error: 'El campo "configs" no puede estar vacío' },
      { status: 400 }
    );
  }

  // Validación de la estructura de cada configuración
  for (let i = 0; i < body.configs.length; i++) {
    const cfg = body.configs[i];
    if (!cfg || typeof cfg !== 'object') {
      return NextResponse.json(
        { error: `La configuración en el índice ${i} no es válida` },
        { status: 400 }
      );
    }
    if (typeof cfg.id !== 'string' || !cfg.id.trim()) {
      return NextResponse.json(
        { error: `La configuración en el índice ${i} debe tener un "id" válido` },
        { status: 400 }
      );
    }
    if (typeof cfg.name !== 'string') {
      return NextResponse.json(
        { error: `La configuración en el índice ${i} debe tener un "name" válido` },
        { status: 400 }
      );
    }
    if (!Array.isArray(cfg.selectedGroups)) {
      return NextResponse.json(
        { error: `La configuración en el índice ${i} debe contener "selectedGroups" como array` },
        { status: 400 }
      );
    }
  }

  if (body.active_config_id !== undefined && body.active_config_id !== null && typeof body.active_config_id !== 'string') {
    return NextResponse.json(
      { error: 'El campo "active_config_id" debe ser un string o null' },
      { status: 400 }
    );
  }

  try {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('users').upsert({
      username,
      configs: body.configs,
      active_config_id: body.active_config_id || null,
      updated_at: updatedAt,
    });

    if (error) {
      console.error('Error upserting user in Supabase:', error);
      return NextResponse.json(
        { error: error.message || 'Error al guardar la configuración del usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, updated_at: updatedAt },
      { status: 200 }
    );
  } catch (err) {
    console.error('Unexpected error in PUT /api/user/[username]:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
