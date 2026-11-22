const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import pure helpers via ESM dynamic import or require
describe('Feedback Utilities Suite', async () => {
  const {
    MAX_FEEDBACK_BODY_BYTES,
    MAX_MESSAGE_LENGTH,
    MIN_MESSAGE_LENGTH,
    MAX_CONTACT_LENGTH,
    VALID_FEEDBACK_TYPES,
    extractClientIp,
    hashIpAddress,
    isSpamSubmission,
    validateFeedbackFields,
    sanitizeMetadata,
    buildDiscordWebhookPayload,
  } = await import('../../app/utils/feedbackUtils.js');

  describe('Validation: validateFeedbackFields', () => {
    test('accepts valid bug payload with contact', () => {
      const result = validateFeedbackFields({
        type: 'bug',
        message: 'No se carga la clase de las 15:00 del viernes',
        contact: 'alumno@ehu.eus',
      });
      assert.equal(result.isValid, true);
      assert.equal(result.data.type, 'bug');
      assert.equal(result.data.message, 'No se carga la clase de las 15:00 del viernes');
      assert.equal(result.data.contact, 'alumno@ehu.eus');
    });

    test('accepts valid suggestion payload without contact and normalizes empty contact to null', () => {
      const result = validateFeedbackFields({
        type: 'suggestion',
        message: 'Estaría genial añadir modo de colores de alto contraste',
        contact: '   ',
      });
      assert.equal(result.isValid, true);
      assert.equal(result.data.type, 'suggestion');
      assert.equal(result.data.contact, null);
    });

    test('accepts valid question payload with undefined contact', () => {
      const result = validateFeedbackFields({
        type: 'question',
        message: '¿Cómo puedo vincular mi cuenta en otro móvil?',
      });
      assert.equal(result.isValid, true);
      assert.equal(result.data.contact, null);
    });

    test('rejects missing or invalid type', () => {
      const res1 = validateFeedbackFields({ message: 'Texto de prueba suficiente' });
      assert.equal(res1.isValid, false);
      assert.equal(res1.status, 400);

      const res2 = validateFeedbackFields({ type: 'complaint', message: 'Texto de prueba suficiente' });
      assert.equal(res2.isValid, false);
      assert.equal(res2.status, 400);
    });

    test('rejects message shorter than 10 chars or whitespace-only', () => {
      const res1 = validateFeedbackFields({ type: 'bug', message: 'Corto' });
      assert.equal(res1.isValid, false);
      assert.match(res1.error, /entre 10 y 2000/);

      const res2 = validateFeedbackFields({ type: 'bug', message: '            ' });
      assert.equal(res2.isValid, false);
    });

    test('rejects message longer than 2000 chars', () => {
      const longMessage = 'a'.repeat(2001);
      const res = validateFeedbackFields({ type: 'suggestion', message: longMessage });
      assert.equal(res.isValid, false);
      assert.match(res.error, /entre 10 y 2000/);
    });

    test('rejects contact longer than 200 chars or non-string', () => {
      const longContact = 'a'.repeat(201);
      const res1 = validateFeedbackFields({
        type: 'question',
        message: 'Consulta válida sobre el widget',
        contact: longContact,
      });
      assert.equal(res1.isValid, false);
      assert.match(res1.error, /200 caracteres/);

      const res2 = validateFeedbackFields({
        type: 'question',
        message: 'Consulta válida sobre el widget',
        contact: 12345,
      });
      assert.equal(res2.isValid, false);
    });
  });

  describe('Anti-spam & Honeypot: isSpamSubmission', () => {
    test('flags non-empty honeypot website as spam', () => {
      const isSpam = isSpamSubmission({
        website: 'https://spam-bot.xyz',
        elapsedMs: 5000,
      });
      assert.equal(isSpam, true);
    });

    test('flags submission faster than 2000 ms as spam', () => {
      const isSpam = isSpamSubmission({
        website: '',
        elapsedMs: 1400,
      });
      assert.equal(isSpam, true);
    });

    test('allows legitimate submission with empty website and elapsedMs >= 2000', () => {
      const isSpam = isSpamSubmission({
        website: '',
        elapsedMs: 3500,
      });
      assert.equal(isSpam, false);
    });
  });

  describe('Metadata Sanitization: sanitizeMetadata', () => {
    test('enforces allowlist and discards unexpected keys', () => {
      const raw = {
        source: 'widgets_faq',
        os: 'android',
        app_version: '1.2.0',
        username: 'alumno_123',
        active_groups: ['GI-31', 'GII-12'],
        view_mode: 'week',
        theme: 'dark',
        viewport: '390x844',
        is_pwa: true,
        secret_token: 'should_not_exist',
        personal_events: [{ title: 'privado' }],
      };

      const sanitized = sanitizeMetadata(raw, 'Mozilla/5.0');
      assert.equal(sanitized.source, 'widgets_faq');
      assert.equal(sanitized.os, 'android');
      assert.equal(sanitized.app_version, '1.2.0');
      assert.equal(sanitized.username, 'alumno_123');
      assert.deepEqual(sanitized.active_groups, ['GI-31', 'GII-12']);
      assert.equal(sanitized.view_mode, 'week');
      assert.equal(sanitized.theme, 'dark');
      assert.equal(sanitized.viewport, '390x844');
      assert.equal(sanitized.is_pwa, true);
      assert.equal(sanitized.user_agent, 'Mozilla/5.0');
      assert.equal(sanitized.secret_token, undefined);
      assert.equal(sanitized.personal_events, undefined);
    });

    test('limits active_groups to max 10 elements and strings to 80 chars', () => {
      const manyGroups = Array.from({ length: 15 }, (_, i) => `Grupo_${i}_${'x'.repeat(100)}`);
      const sanitized = sanitizeMetadata({ active_groups: manyGroups });
      assert.equal(sanitized.active_groups.length, 10);
      assert.ok(sanitized.active_groups[0].length <= 80);
    });

    test('defaults invalid source and OS', () => {
      const sanitized = sanitizeMetadata({ source: 'malicious_source', os: 'windows_phone' });
      assert.equal(sanitized.source, 'info_tab');
      assert.equal(sanitized.os, null);
    });
  });

  describe('IP Extraction and Hashing', () => {
    test('extracts first IP from x-forwarded-for header', () => {
      const ip = extractClientIp('203.0.113.195, 70.41.3.18, 150.172.238.178', '198.51.100.1');
      assert.equal(ip, '203.0.113.195');
    });

    test('falls back to x-real-ip when forwarded-for is missing', () => {
      const ip = extractClientIp(null, '198.51.100.1');
      assert.equal(ip, '198.51.100.1');
    });

    test('falls back to unknown when no header is present', () => {
      const ip = extractClientIp(null, null);
      assert.equal(ip, 'unknown');
    });

    test('generates deterministic SHA-256 hex hash without leaking raw IP', () => {
      const hash1 = hashIpAddress('203.0.113.195', 'test-salt-1');
      const hash2 = hashIpAddress('203.0.113.195', 'test-salt-1');
      const hashDiffIp = hashIpAddress('198.51.100.1', 'test-salt-1');
      const hashDiffSalt = hashIpAddress('203.0.113.195', 'test-salt-2');

      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
      assert.notEqual(hash1, hashDiffIp);
      assert.notEqual(hash1, hashDiffSalt);
      assert.ok(!hash1.includes('203.0.113.195'));
    });
  });

  describe('Discord Webhook Payload Builder', () => {
    test('creates properly structured embed for bug report with correct color', () => {
      const payload = buildDiscordWebhookPayload({
        id: 'test-uuid-1234',
        type: 'bug',
        message: 'No se sincroniza en Firefox',
        contact: 'test@ehu.eus',
        metadata: {
          source: 'info_tab',
          username: 'usuario_demo',
          active_groups: ['GI-11'],
          view_mode: 'day',
          theme: 'dark',
          viewport: '412x915',
          is_pwa: true,
          user_agent: 'Firefox 130',
        },
        created_at: '2026-11-22T20:00:00.000Z',
      });

      assert.ok(payload.embeds && payload.embeds.length === 1);
      const embed = payload.embeds[0];
      assert.equal(embed.color, 0xEF4444);
      assert.ok(embed.title.includes('[Fallo]'));
      assert.equal(embed.description, 'No se sincroniza en Firefox');
      assert.equal(embed.timestamp, '2026-11-22T20:00:00.000Z');

      const contactField = embed.fields.find(f => f.name === 'Contacto');
      assert.ok(contactField && contactField.value.includes('test@ehu.eus'));

      const groupsField = embed.fields.find(f => f.name === 'Grupos activos');
      assert.ok(groupsField && groupsField.value.includes('GI-11'));
    });

    test('sets distinct colors and titles for suggestion and question', () => {
      const suggPayload = buildDiscordWebhookPayload({
        type: 'suggestion',
        message: 'Sugerencia de mejora',
        metadata: {},
      });
      assert.equal(suggPayload.embeds[0].color, 0x6366F1);
      assert.ok(suggPayload.embeds[0].title.includes('[Sugerencia]'));

      const questPayload = buildDiscordWebhookPayload({
        type: 'question',
        message: 'Duda sobre el widget',
        metadata: {},
      });
      assert.equal(questPayload.embeds[0].color, 0xF59E0B);
      assert.ok(questPayload.embeds[0].title.includes('[Pregunta]'));
    });
  });
});
