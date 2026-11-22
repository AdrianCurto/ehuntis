import crypto from 'node:crypto';

export const MAX_FEEDBACK_BODY_BYTES = 10 * 1024; // 10 KB
export const MAX_MESSAGE_LENGTH = 2000;
export const MIN_MESSAGE_LENGTH = 10;
export const MAX_CONTACT_LENGTH = 200;
export const FEEDBACK_RATE_LIMIT_WINDOW_MINUTES = 60;
export const FEEDBACK_RATE_LIMIT_MAX_REQUESTS = 3;

export const VALID_FEEDBACK_TYPES = Object.freeze(['bug', 'suggestion', 'question']);
export const VALID_SOURCES = Object.freeze(['info_tab', 'widgets_faq', 'other']);
export const VALID_OS = Object.freeze(['android', 'ios']);

/**
 * Normaliza y extrae la IP cliente de las cabeceras de proxy.
 */
export function extractClientIp(forwardedForHeader, realIpHeader) {
  if (forwardedForHeader && typeof forwardedForHeader === 'string') {
    const firstPart = forwardedForHeader.split(',')[0].trim();
    if (firstPart) return firstPart;
  }
  if (realIpHeader && typeof realIpHeader === 'string' && realIpHeader.trim()) {
    return realIpHeader.trim();
  }
  return 'unknown';
}

/**
 * Calcula un hash SHA-256 seguro de la IP para rate limiting sin almacenar IPs en claro.
 */
export function hashIpAddress(ip, salt = process.env.FEEDBACK_IP_SALT || 'ehuntis-default-salt') {
  const safeIp = typeof ip === 'string' && ip.trim() ? ip.trim() : 'unknown';
  return crypto
    .createHash('sha256')
    .update(`${safeIp}:${salt}`)
    .digest('hex');
}

/**
 * Comprueba si la petición proviene de un bot mediante honeypot o tiempo mínimo de respuesta.
 */
export function isSpamSubmission(body) {
  if (!body || typeof body !== 'object') return false;

  // 1. Campo honeypot 'website' relleno por bots
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return true;
  }

  // 2. Tiempo transcurrido inferior a 2 segundos desde que se abrió el formulario
  if (typeof body.elapsedMs === 'number' && body.elapsedMs < 2000) {
    return true;
  }

  return false;
}

/**
 * Valida de forma estricta los campos obligatorios del cuerpo de feedback.
 */
export function validateFeedbackFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      status: 400,
      error: 'El cuerpo de la petición debe ser un objeto JSON válido.',
    };
  }

  const { type, message, contact } = body;

  if (!type || !VALID_FEEDBACK_TYPES.includes(type)) {
    return {
      isValid: false,
      status: 400,
      error: 'El tipo de comentario debe ser "bug", "suggestion" o "question".',
    };
  }

  if (typeof message !== 'string') {
    return {
      isValid: false,
      status: 400,
      error: 'El mensaje debe ser una cadena de texto.',
    };
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length < MIN_MESSAGE_LENGTH || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      status: 400,
      error: `El mensaje debe tener entre ${MIN_MESSAGE_LENGTH} y ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }

  let sanitizedContact = null;
  if (contact !== undefined && contact !== null) {
    if (typeof contact !== 'string') {
      return {
        isValid: false,
        status: 400,
        error: 'El campo de contacto debe ser una cadena de texto.',
      };
    }
    const trimmedContact = contact.trim();
    if (trimmedContact.length > MAX_CONTACT_LENGTH) {
      return {
        isValid: false,
        status: 400,
        error: `El campo de contacto no puede superar los ${MAX_CONTACT_LENGTH} caracteres.`,
      };
    }
    if (trimmedContact.length > 0) {
      sanitizedContact = trimmedContact;
    }
  }

  return {
    isValid: true,
    data: {
      type,
      message: trimmedMessage,
      contact: sanitizedContact,
    },
  };
}

/**
 * Sanitiza los metadatos técnicos permitidos mediante allowlist estricta.
 */
export function sanitizeMetadata(rawMetadata = {}, userAgentHeader = '') {
  const meta = (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata))
    ? rawMetadata
    : {};

  // Source
  const source = VALID_SOURCES.includes(meta.source) ? meta.source : 'info_tab';

  // OS
  const os = VALID_OS.includes(meta.os) ? meta.os : null;

  // App version
  const appVersion = typeof meta.app_version === 'string' && meta.app_version.trim()
    ? meta.app_version.trim().slice(0, 40)
    : null;

  // Username
  const username = typeof meta.username === 'string' && meta.username.trim()
    ? meta.username.trim().slice(0, 30)
    : null;

  // Active groups: array de strings recortados a max 10 elementos de 80 chars
  let activeGroups = [];
  if (Array.isArray(meta.active_groups)) {
    activeGroups = meta.active_groups
      .filter(g => typeof g === 'string' && g.trim())
      .map(g => g.trim().slice(0, 80))
      .slice(0, 10);
  }

  // View mode
  const viewMode = typeof meta.view_mode === 'string' && meta.view_mode.trim()
    ? meta.view_mode.trim().slice(0, 20)
    : null;

  // Theme
  const theme = typeof meta.theme === 'string' && meta.theme.trim()
    ? meta.theme.trim().slice(0, 20)
    : null;

  // Viewport
  const viewport = typeof meta.viewport === 'string' && meta.viewport.trim()
    ? meta.viewport.trim().slice(0, 30)
    : null;

  // is_pwa
  const isPwa = Boolean(meta.is_pwa);

  // User Agent: preferencia de la cabecera del servidor, fallback a metadata del cliente
  const uaRaw = (userAgentHeader && typeof userAgentHeader === 'string' && userAgentHeader.trim())
    ? userAgentHeader.trim()
    : (typeof meta.user_agent === 'string' ? meta.user_agent.trim() : '');
  const userAgent = uaRaw ? uaRaw.slice(0, 300) : null;

  return {
    source,
    os,
    app_version: appVersion,
    username,
    active_groups: activeGroups,
    view_mode: viewMode,
    theme,
    viewport,
    is_pwa: isPwa,
    user_agent: userAgent,
  };
}

/**
 * Construye el payload del Embed de Discord con colores y contexto estructurado.
 */
export function buildDiscordWebhookPayload({ id, type, message, contact, metadata, created_at }) {
  const colorMap = {
    bug: 0xEF4444,        // Rojo
    suggestion: 0x6366F1, // Índigo
    question: 0xF59E0B,   // Ámbar
  };

  const titlePrefixMap = {
    bug: '[Fallo] Nuevo feedback en EHUntis',
    suggestion: '[Sugerencia] Nuevo feedback en EHUntis',
    question: '[Pregunta] Nuevo feedback en EHUntis',
  };

  const color = colorMap[type] || 0x6366F1;
  const title = titlePrefixMap[type] || 'Nuevo feedback en EHUntis';

  const meta = metadata || {};
  const activeGroupsText = Array.isArray(meta.active_groups) && meta.active_groups.length > 0
    ? meta.active_groups.join(', ')
    : 'Ninguno';

  const contextParts = [
    `Origen: ${meta.source || 'info_tab'}`,
    `Vista: ${meta.view_mode || 'n/a'}`,
    `Tema: ${meta.theme || 'n/a'}`,
    `Pantalla: ${meta.viewport || 'n/a'}`,
    meta.is_pwa ? 'PWA' : 'Web',
  ];
  if (meta.os) {
    contextParts.push(`OS: ${meta.os}`);
  }
  if (meta.app_version) {
    contextParts.push(`v${meta.app_version}`);
  }

  const fields = [
    {
      name: 'Contacto',
      value: contact ? `\`${contact}\`` : 'Sin contacto',
      inline: true,
    },
    {
      name: 'Usuario',
      value: meta.username ? `\`${meta.username}\`` : 'Sin sesión',
      inline: true,
    },
    {
      name: 'Grupos activos',
      value: activeGroupsText.slice(0, 500),
      inline: false,
    },
    {
      name: 'Contexto',
      value: contextParts.join(' · ').slice(0, 500),
      inline: false,
    },
    {
      name: 'ID',
      value: id ? `\`${id}\`` : 'n/a',
      inline: true,
    },
  ];

  if (meta.user_agent) {
    fields.push({
      name: 'Navegador / User Agent',
      value: `\`${meta.user_agent.slice(0, 250)}\``,
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title,
        description: message.slice(0, 2000),
        color,
        fields,
        timestamp: created_at || new Date().toISOString(),
        footer: {
          text: 'EHUntis Feedback System',
        },
      },
    ],
  };
}
