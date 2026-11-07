const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { PALETTE, PALETTE_DARK } = require('../../app/utils/colorLogic');

describe('User API Validation and Payload Rules suite', () => {
  const USERNAME_REGEX = /^[a-zA-Z0-9_\-\.]{6,30}$/;
  const MAX_BODY_SIZE_BYTES = 500 * 1024; // 500 KB

  // Palette serialization identical to app/api/user/[username]/route.js
  const PALETTE_LIGHT_SIMPLE = PALETTE.map(p => ({ bg: p.bg, text: p.text, border: p.border }));
  const PALETTE_DARK_SIMPLE  = PALETTE_DARK.map(p => ({ bg: p.bg, text: p.text, border: p.border }));

  function validatePutPayload(username, rawText) {
    if (!username || !USERNAME_REGEX.test(username)) {
      return { status: 400, error: 'Formato de usuario inválido. Debe tener entre 6 y 30 caracteres alfanuméricos, puntos, guiones o barras bajas.' };
    }

    if (rawText.length > MAX_BODY_SIZE_BYTES) {
      return { status: 413, error: 'El tamaño de la petición supera el límite permitido de 500 KB' };
    }

    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return { status: 400, error: 'Cuerpo de petición JSON inválido' };
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, error: 'El cuerpo de la petición debe ser un objeto JSON' };
    }

    if (!Array.isArray(body.configs)) {
      return { status: 400, error: 'El campo "configs" debe ser un array' };
    }

    if (body.configs.length === 0) {
      return { status: 400, error: 'El campo "configs" no puede estar vacío' };
    }

    for (let i = 0; i < body.configs.length; i++) {
      const cfg = body.configs[i];
      if (!cfg || typeof cfg !== 'object') {
        return { status: 400, error: `La configuración en el índice ${i} no es válida` };
      }
      if (typeof cfg.id !== 'string' || !cfg.id.trim()) {
        return { status: 400, error: `La configuración en el índice ${i} debe tener un "id" válido` };
      }
      if (typeof cfg.name !== 'string') {
        return { status: 400, error: `La configuración en el índice ${i} debe tener un "name" válido` };
      }
      if (!Array.isArray(cfg.selectedGroups)) {
        return { status: 400, error: `La configuración en el índice ${i} debe contener "selectedGroups" como array` };
      }
    }

    if (body.active_config_id !== undefined && body.active_config_id !== null && typeof body.active_config_id !== 'string') {
      return { status: 400, error: 'El campo "active_config_id" debe ser un string o null' };
    }

    if (body.custom_events !== undefined && !Array.isArray(body.custom_events)) {
      return { status: 400, error: 'El campo "custom_events" debe ser un array' };
    }

    if (body.custom_categories !== undefined && !Array.isArray(body.custom_categories)) {
      return { status: 400, error: 'El campo "custom_categories" debe ser un array' };
    }

    if (body.lesson_overrides !== undefined && (typeof body.lesson_overrides !== 'object' || Array.isArray(body.lesson_overrides) || body.lesson_overrides === null)) {
      return { status: 400, error: 'El campo "lesson_overrides" debe ser un objeto' };
    }

    return { status: 200, valid: true, body };
  }

  describe('Username validation regex', () => {
    test('accepts valid usernames between 6 and 30 characters', () => {
      assert.ok(USERNAME_REGEX.test('adrian'));
      assert.ok(USERNAME_REGEX.test('user_123'));
      assert.ok(USERNAME_REGEX.test('student-2026.ehu'));
      assert.ok(USERNAME_REGEX.test('abcdefghijklmnopqrstuvwxyz1234'));
    });

    test('rejects too short, too long or invalid characters', () => {
      assert.equal(USERNAME_REGEX.test('usr'), false); // Too short (< 6)
      assert.equal(USERNAME_REGEX.test('a'.repeat(31)), false); // Too long (> 30)
      assert.equal(USERNAME_REGEX.test('user@ehu'), false); // '@' not allowed
      assert.equal(USERNAME_REGEX.test('user space'), false); // space not allowed
      assert.equal(USERNAME_REGEX.test('user$name'), false); // '$' not allowed
    });
  });

  describe('PUT payload validations', () => {
    test('rejects body exceeding 500 KB with status 413', () => {
      const hugeText = JSON.stringify({ configs: [{ id: '1', name: 'A', selectedGroups: [] }], padding: 'x'.repeat(550 * 1024) });
      const res = validatePutPayload('valid_user', hugeText);
      assert.equal(res.status, 413);
      assert.ok(res.error.includes('500 KB'));
    });

    test('rejects malformed JSON with status 400', () => {
      const res = validatePutPayload('valid_user', '{ invalid_json ');
      assert.equal(res.status, 400);
      assert.ok(res.error.includes('JSON inválido'));
    });

    test('rejects empty configs array with status 400', () => {
      const res = validatePutPayload('valid_user', JSON.stringify({ configs: [] }));
      assert.equal(res.status, 400);
      assert.ok(res.error.includes('no puede estar vacío'));
    });

    test('rejects configs with invalid item structure', () => {
      const badId = JSON.stringify({ configs: [{ id: '', name: 'Config 1', selectedGroups: [] }] });
      assert.equal(validatePutPayload('valid_user', badId).status, 400);

      const badName = JSON.stringify({ configs: [{ id: '1', name: 123, selectedGroups: [] }] });
      assert.equal(validatePutPayload('valid_user', badName).status, 400);

      const badGroups = JSON.stringify({ configs: [{ id: '1', name: 'Ok', selectedGroups: 'not-array' }] });
      assert.equal(validatePutPayload('valid_user', badGroups).status, 400);
    });

    test('rejects non-array custom_events', () => {
      const bad = JSON.stringify({
        configs: [{ id: '1', name: 'Ok', selectedGroups: [] }],
        custom_events: 'not-an-array',
      });
      const res = validatePutPayload('valid_user', bad);
      assert.equal(res.status, 400);
      assert.ok(res.error.includes('custom_events'));
    });

    test('rejects non-array custom_categories', () => {
      const bad = JSON.stringify({
        configs: [{ id: '1', name: 'Ok', selectedGroups: [] }],
        custom_categories: { cat: 1 },
      });
      const res = validatePutPayload('valid_user', bad);
      assert.equal(res.status, 400);
      assert.ok(res.error.includes('custom_categories'));
    });

    test('rejects non-object lesson_overrides', () => {
      const badArray = JSON.stringify({
        configs: [{ id: '1', name: 'Ok', selectedGroups: [] }],
        lesson_overrides: ['array_not_allowed'],
      });
      assert.equal(validatePutPayload('valid_user', badArray).status, 400);

      const badNull = JSON.stringify({
        configs: [{ id: '1', name: 'Ok', selectedGroups: [] }],
        lesson_overrides: null,
      });
      assert.equal(validatePutPayload('valid_user', badNull).status, 400);
    });

    test('accepts valid full payload with custom_events and lesson_overrides', () => {
      const valid = JSON.stringify({
        configs: [{ id: 'cfg_1', name: 'Ingeniería', selectedGroups: [{ id: 10 }] }],
        active_config_id: 'cfg_1',
        custom_events: [
          { id: 'ev1', title: 'Tutoría', startTime: 900, endTime: 1000, recurrence: { type: 'none', date: 20261109 } },
        ],
        custom_categories: ['Estudio', 'Deporte'],
        lesson_overrides: {
          '20261109_123': { lessonKey: '20261109_123', userCancelled: true },
        },
      });
      const res = validatePutPayload('valid_user', valid);
      assert.equal(res.status, 200);
      assert.equal(res.valid, true);
    });
  });

  describe('Palette response generation', () => {
    test('contains 14 light colors and 14 dark colors with expected structure', () => {
      assert.equal(PALETTE_LIGHT_SIMPLE.length, 14);
      assert.equal(PALETTE_DARK_SIMPLE.length, 14);

      for (const col of PALETTE_LIGHT_SIMPLE) {
        assert.ok(col.bg.startsWith('#'));
        assert.ok(col.text.startsWith('#'));
        assert.ok(col.border);
      }
      for (const col of PALETTE_DARK_SIMPLE) {
        assert.ok(col.bg.startsWith('#'));
        assert.ok(col.text.startsWith('#'));
        assert.ok(col.border);
      }
    });
  });
});
