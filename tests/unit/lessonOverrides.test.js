const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  LESSON_OVERRIDES_STORAGE_KEY,
  formatTime,
  getLessonKey,
  getStoredLessonOverrides,
  saveStoredLessonOverrides,
  reconcileOverrideWithLesson,
  reconcileLessonOverrides,
  checkRemoteDrift,
  applyLessonOverrides,
  setLessonOverride,
  removeLessonOverride,
  resolveDrift,
  swapLessons,
  hasLessonOverrideChanges,
  hasNonCancellationOverrideChanges,
  areRoomsEqual,
  cleanObsoleteLessonOverrides,
} = require('../../app/utils/lessonOverrides');

describe('lessonOverrides utility suite', () => {
  let mockStorage = {};
  const originalWindow = global.window;

  beforeEach(() => {
    mockStorage = {};
    const storageImpl = {
      getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
      setItem: (key, val) => { mockStorage[key] = String(val); },
      removeItem: (key) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
    };
    global.localStorage = storageImpl;
    global.window = { localStorage: storageImpl };
  });

  afterEach(() => {
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    } else {
      delete global.window;
    }
  });

  describe('formatTime and getLessonKey', () => {
    test('formatTime formats numbers to HH:MM strings', () => {
      assert.equal(formatTime(800), '08:00');
      assert.equal(formatTime(830), '08:30');
      assert.equal(formatTime(900), '09:00');
      assert.equal(formatTime(1405), '14:05');
      assert.equal(formatTime(null), '');
      assert.equal(formatTime('abc'), '');
    });

    test('getLessonKey uses date and lesson.id when id is present', () => {
      const lesson = { id: 8877, date: 20261109, startTime: 900 };
      assert.equal(getLessonKey(lesson), '20261109_8877');
    });

    test('getLessonKey prefers lessonKey property if already present', () => {
      const lesson = { lessonKey: 'custom_key_123', id: 8877 };
      assert.equal(getLessonKey(lesson), 'custom_key_123');
    });

    test('getLessonKey creates fallback composite key when id is absent', () => {
      const lesson = {
        date: 20261109,
        subjectIds: [104],
        startTime: 830,
        type: 'PL1',
      };
      assert.equal(getLessonKey(lesson), '20261109_104_830_pl1');
    });

    test('getLessonKey handles empty/null lesson', () => {
      assert.equal(getLessonKey(null), '');
      assert.equal(getLessonKey(undefined), '');
    });
  });

  describe('applyLessonOverrides', () => {
    test('returns empty array on empty or invalid inputs', () => {
      assert.deepEqual(applyLessonOverrides([], {}), []);
      assert.deepEqual(applyLessonOverrides(null, {}), []);
    });

    test('marks un-overridden lessons with default flags and raw properties', () => {
      const lesson = {
        id: 100,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 1.1'],
        code: null,
      };
      const [result] = applyLessonOverrides([lesson], {});
      assert.equal(result.isOverridden, false);
      assert.equal(result.isUserCancelled, false);
      assert.equal(result.hasRemoteDrift, false);
      assert.equal(result.rawStartTime, 830);
      assert.equal(result.rawEndTime, 1030);
      assert.deepEqual(result.rawRooms, ['Aula 1.1']);
      assert.equal(result.lessonKey, '20261109_100');
    });

    test('applies user cancellation override without altering original timing', () => {
      const lesson = {
        id: 200,
        date: 20261109,
        startTime: 1100,
        endTime: 1300,
        rooms: ['Lab 3'],
        code: null,
      };
      const overrides = {
        '20261109_200': {
          lessonKey: '20261109_200',
          lessonId: 200,
          userCancelled: true,
        },
      };

      const [result] = applyLessonOverrides([lesson], overrides);
      assert.equal(result.isOverridden, true);
      assert.equal(result.isUserCancelled, true);
      assert.equal(result.code, 'cancelled');
      assert.equal(result.startTime, 1100);
      assert.equal(result.endTime, 1300);
      assert.deepEqual(result.rooms, ['Lab 3']);
    });

    test('applies custom time, room, and notes overrides', () => {
      const lesson = {
        id: 300,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 0.1'],
        notes: '',
      };
      const overrides = {
        '20261109_300': {
          lessonKey: '20261109_300',
          lessonId: 300,
          customStartTime: 930,
          customEndTime: 1130,
          customRooms: ['Aula 2.5'],
          customNotes: 'Llevar calculadora programable',
        },
      };

      const [result] = applyLessonOverrides([lesson], overrides);
      assert.equal(result.isOverridden, true);
      assert.equal(result.startTime, 930);
      assert.equal(result.endTime, 1130);
      assert.deepEqual(result.rooms, ['Aula 2.5']);
      assert.equal(result.notes, 'Llevar calculadora programable');
      assert.equal(result.rawStartTime, 900);
      assert.equal(result.rawEndTime, 1100);
      assert.deepEqual(result.rawRooms, ['Aula 0.1']);
    });

    test('ignores custom events in lessons array', () => {
      const customEvent = { isCustomEvent: true, id: 'cust_1' };
      const [result] = applyLessonOverrides([customEvent], { 'something': {} });
      assert.equal(result.id, 'cust_1');
      assert.equal(result.isCustomEvent, true);
    });
  });

  describe('Drift detection and resolution (3-way conflicts)', () => {
    test('checkRemoteDrift detects conflict when both user and WebUntis change time to different values', () => {
      const freshLesson = {
        id: 400,
        date: 20261109,
        startTime: 1000, // changed from 900
        endTime: 1200,   // changed from 1100
        rooms: ['Aula 1'],
        code: null,
      };
      const override = {
        customStartTime: 930,
        customEndTime: 1130,
        originalSnapshot: {
          id: 400,
          date: 20261109,
          startTime: 900,
          endTime: 1100,
          rooms: ['Aula 1'],
          code: null,
        },
      };

      const drift = checkRemoteDrift(freshLesson, override);
      assert.ok(drift);
      assert.equal(drift.length, 1);
      assert.equal(drift[0].field, 'time');
      assert.equal(drift[0].before, '09:00–11:00');
      assert.equal(drift[0].after, '10:00–12:00');
      assert.equal(drift[0].userValue, '09:30–11:30');
    });

    test('checkRemoteDrift detects room conflict and official cancellation conflict on edited class', () => {
      const freshLesson = {
        id: 500,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 2.1'], // changed from Aula 1.1
        code: 'cancelled',   // university cancelled officially
      };
      const override = {
        customRooms: ['P3G2A'], // user also edited room to a different room
        originalSnapshot: {
          id: 500,
          date: 20261109,
          startTime: 900,
          endTime: 1100,
          rooms: ['Aula 1.1'],
          code: null,
        },
      };

      const drift = checkRemoteDrift(freshLesson, override);
      assert.ok(drift);
      assert.equal(drift.length, 2);
      assert.equal(drift[0].field, 'room');
      assert.equal(drift[1].field, 'code');
      assert.equal(drift[1].after, 'Cancelada por la universidad');
    });

    test('checkRemoteDrift returns null when WebUntis updates fields the user did not modify', () => {
      const freshLesson = {
        id: 501,
        date: 20261109,
        startTime: 1000,
        endTime: 1200,
        rooms: ['P3 G2A'],
        code: null,
      };
      const override = {
        customNotes: 'Llevar calculadora',
        originalSnapshot: {
          id: 501,
          date: 20261109,
          startTime: 900,
          endTime: 1100,
          rooms: ['Aula 1.1'],
          code: null,
        },
      };

      assert.equal(checkRemoteDrift(freshLesson, override), null);
    });

    test('checkRemoteDrift returns null when WebUntis data matches original snapshot', () => {
      const freshLesson = {
        id: 600,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 1.1'],
        code: null,
      };
      const override = {
        originalSnapshot: {
          id: 600,
          date: 20261109,
          startTime: 830,
          endTime: 1030,
          rooms: ['Aula 1.1'],
          code: null,
        },
      };
      assert.equal(checkRemoteDrift(freshLesson, override), null);
    });

    test('resolveDrift with adopt_remote deletes the override', () => {
      const lesson = { id: 700, date: 20261109, lessonKey: '20261109_700' };
      const currentOverrides = {
        '20261109_700': { customStartTime: 900 },
      };
      const resolved = resolveDrift(currentOverrides, lesson, 'adopt_remote');
      assert.equal(resolved['20261109_700'], undefined);
    });

    test('resolveDrift with keep_local updates snapshot with new WebUntis data', () => {
      const lesson = {
        id: 700,
        date: 20261109,
        lessonKey: '20261109_700',
        startTime: 1000,
        endTime: 1200,
        rooms: ['Aula Nueva'],
        code: null,
      };
      const currentOverrides = {
        '20261109_700': {
          customStartTime: 930,
          customEndTime: 1130,
          originalSnapshot: { startTime: 900, endTime: 1100, rooms: ['Aula Vieja'] },
        },
      };

      const resolved = resolveDrift(currentOverrides, lesson, 'keep_local');
      const updated = resolved['20261109_700'];
      assert.ok(updated);
      assert.equal(updated.customStartTime, 930); // User custom start time kept!
      assert.equal(updated.originalSnapshot.startTime, 1000); // Snapshot updated to new remote!
      assert.deepEqual(updated.originalSnapshot.rooms, ['Aula Nueva']);
    });
  });

  describe('setLessonOverride and removeLessonOverride', () => {
    test('setLessonOverride sets patch and preserves original snapshot', () => {
      const lesson = {
        id: 800,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 0.1'],
      };
      const current = {};
      const updated = setLessonOverride(current, lesson, { customNotes: 'Examen tema 1' });

      const ov = updated['20261109_800'];
      assert.ok(ov);
      assert.equal(ov.customNotes, 'Examen tema 1');
      assert.equal(ov.originalSnapshot.startTime, 830);
      assert.deepEqual(ov.originalSnapshot.rooms, ['Aula 0.1']);
      assert.ok(ov.updatedAt > 0);
    });

    test('removeLessonOverride deletes existing override cleanly', () => {
      const current = { '20261109_900': { userCancelled: true } };
      const next = removeLessonOverride(current, '20261109_900');
      assert.equal(next['20261109_900'], undefined);
    });

    test('automatically removes override when reactivating a cancelled class if that was the only change', () => {
      const lesson = {
        id: 850,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 1.2'],
        code: null,
      };

      // 1. Marcar clase como cancelada
      const withCancelled = setLessonOverride({}, lesson, { userCancelled: true });
      assert.ok(withCancelled['20261109_850']);
      assert.equal(withCancelled['20261109_850'].userCancelled, true);

      // 2. Reactivar clase (deshacer la cancelación)
      const restored = setLessonOverride(withCancelled, lesson, { userCancelled: false });
      assert.equal(restored['20261109_850'], undefined, 'El override debe eliminarse por completo al volver a ser oficial');
    });

    test('keeps override when reactivating cancelled class if other custom edits remain', () => {
      const lesson = {
        id: 860,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 1.2'],
        code: null,
      };

      // 1. Cancelar y añadir nota
      const step1 = setLessonOverride({}, lesson, { userCancelled: true, customNotes: 'Examen pospuesto' });
      assert.ok(step1['20261109_860']);

      // 2. Reactivar clase pero conservando la nota
      const step2 = setLessonOverride(step1, lesson, { userCancelled: false });
      assert.ok(step2['20261109_860'], 'El override debe mantenerse porque aún tiene notas personalizadas');
      assert.equal(Boolean(step2['20261109_860'].userCancelled), false);
      assert.equal(step2['20261109_860'].customNotes, 'Examen pospuesto');

      // 3. Quitar la nota (dejándola vacía)
      const step3 = setLessonOverride(step2, lesson, { customNotes: '   ' });
      assert.equal(step3['20261109_860'], undefined, 'Al vaciar la nota y estar reactivada, el override debe eliminarse');
    });

    test('automatically removes override when custom timing and room are restored to original snapshot values', () => {
      const lesson = {
        id: 870,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 1.1'],
        code: null,
      };

      // 1. Modificar horario y aula
      const step1 = setLessonOverride({}, lesson, {
        customStartTime: 900,
        customEndTime: 1100,
        customRooms: ['Aula 2.5'],
        customNotes: '',
      });
      assert.ok(step1['20261109_870']);

      // 2. Restaurar horario y aula a los valores originales oficiales
      const step2 = setLessonOverride(step1, lesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['Aula 1.1'],
        customNotes: '',
      });
      assert.equal(step2['20261109_870'], undefined, 'Al volver a horario y aula originales, se elimina el override');
    });

    test('automatically removes override when editing room back to official room with formatted code (P2 G3A vs P2G3A)', () => {
      const lesson = {
        id: 880,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['P2 G3A'], // WebUntis official format with space
        code: null,
      };

      // 1. Cambiar aula a otra distinta
      const step1 = setLessonOverride({}, lesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3B'],
        customNotes: '',
      });
      assert.ok(step1['20261109_880'], 'El override debe guardarse al cambiar el aula');

      // 2. Volver a cambiar el aula para dejarla como es la real (en formato limpio del modal P2G3A o con espacio P2 G3A)
      const step2 = setLessonOverride(step1, lesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3A'],
        customNotes: '',
      });
      assert.equal(step2['20261109_880'], undefined, 'Al volver a poner el aula real (P2G3A vs P2 G3A), el override se elimina');
    });

    test('automatically removes override when adding a note and then clearing it on a class with code room', () => {
      const lesson = {
        id: 890,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['P2 G3A'],
        code: null,
      };

      // 1. Añadir nota (el modal envía customRooms con el formato formateado P2G3A)
      const step1 = setLessonOverride({}, lesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3A'],
        customNotes: 'Repasar tema 4',
      });
      assert.ok(step1['20261109_890']);

      // 2. Quitar la nota (dejándola vacía)
      const step2 = setLessonOverride(step1, lesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3A'],
        customNotes: '',
      });
      assert.equal(step2['20261109_890'], undefined, 'Al quitar la nota personal, el override debe eliminarse');
    });

    test('updates customDate and maintains key stability across repeated edits', () => {
      const lesson = {
        id: 999,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 101'],
        code: null,
      };

      // 1. Mover la clase de lunes a miércoles
      const step1 = setLessonOverride({}, lesson, {
        customDate: 20261111,
      });
      assert.ok(step1['20261109_999'], 'La clave se basa en la fecha original WebUntis');
      assert.equal(step1['20261109_999'].customDate, 20261111);

      // 2. Aplicar overrides
      const applied = applyLessonOverrides([lesson], step1);
      assert.equal(applied[0].date, 20261111);
      assert.equal(applied[0].rawDate, 20261109);
      assert.equal(applied[0].isOverridden, true);

      // 3. Volver a editar desde la clase enriquecida (que tiene date: 20261111 pero rawDate: 20261109)
      const step2 = setLessonOverride(step1, applied[0], {
        customDate: 20261112,
      });
      assert.ok(step2['20261109_999'], 'La clave no se desincroniza al editar una clase ya desplazada');
      assert.equal(step2['20261109_999'].customDate, 20261112);
      assert.equal(Object.keys(step2).length, 1);

      // 4. Restaurar a la fecha original
      const step3 = setLessonOverride(step2, applied[0], {
        customDate: 20261109,
      });
      assert.equal(step3['20261109_999'], undefined, 'El override se elimina si la fecha vuelve a coincidir con la oficial');
    });
  });

  describe('swapLessons atomic operation', () => {
    test('swaps timings preserving each room by default when rooms differ, and swaps rooms if option is enabled', () => {
      const lessonA = {
        id: 1001,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula A'],
        subjects: ['Física'],
      };
      const lessonB = {
        id: 1002,
        date: 20261109,
        startTime: 1100,
        endTime: 1300,
        rooms: ['Aula B'],
        subjects: ['Química'],
      };

      // Por defecto: cada clase mantiene su aula original
      const overrides = swapLessons({}, lessonA, lessonB);
      assert.equal(Object.keys(overrides).length, 2);

      const ovA = overrides['20261109_1001'];
      const ovB = overrides['20261109_1002'];

      assert.ok(ovA);
      assert.ok(ovB);

      // Lesson A gets Lesson B's times, y NO congela customRooms ni customDate (mantiene aula oficial)
      assert.equal(ovA.customStartTime, 1100);
      assert.equal(ovA.customEndTime, 1300);
      assert.equal(ovA.customRooms, undefined);
      assert.equal(ovA.customDate, undefined);
      assert.equal(ovA.swappedWith.lessonKey, '20261109_1002');
      assert.equal(ovA.swappedWith.subjectName, 'Química');

      // Lesson B gets Lesson A's times, y NO congela customRooms ni customDate (mantiene aula oficial)
      assert.equal(ovB.customStartTime, 830);
      assert.equal(ovB.customEndTime, 1030);
      assert.equal(ovB.customRooms, undefined);
      assert.equal(ovB.customDate, undefined);
      assert.equal(ovB.swappedWith.lessonKey, '20261109_1001');
      assert.equal(ovB.swappedWith.subjectName, 'Física');

      const [appliedA, appliedB] = applyLessonOverrides([lessonA, lessonB], overrides);
      assert.deepEqual(appliedA.rooms, ['Aula A']);
      assert.deepEqual(appliedB.rooms, ['Aula B']);

      // Con swapRooms: true -> intercambian también las aulas
      const overridesSwappedRooms = swapLessons({}, lessonA, lessonB, { swapRooms: true });
      assert.deepEqual(overridesSwappedRooms['20261109_1001'].customRooms, ['Aula B']);
      assert.deepEqual(overridesSwappedRooms['20261109_1002'].customRooms, ['Aula A']);
    });

    test('swaps timings preserving respective durations by default', () => {
      const lesson2h = {
        id: 2001,
        date: 20261109,
        startTime: 830,
        endTime: 1030, // 2h = 120m
        rooms: ['Aula 2H'],
        subjects: ['Matemáticas'],
      };
      const lesson1h = {
        id: 2002,
        date: 20261109,
        startTime: 1100,
        endTime: 1200, // 1h = 60m
        rooms: ['Aula 1H'],
        subjects: ['Inglés'],
      };

      // By default: keepDuration is true
      const swappedDefault = swapLessons({}, lesson2h, lesson1h);
      const ov2h = swappedDefault['20261109_2001'];
      const ov1h = swappedDefault['20261109_2002'];

      assert.equal(ov2h.customStartTime, 1100);
      assert.equal(ov2h.customEndTime, 1300); // 11:00 + 120m = 13:00 (keeps 2h!)
      assert.equal(ov2h.customRooms, undefined); // no congela aula oficial

      assert.equal(ov1h.customStartTime, 830);
      assert.equal(ov1h.customEndTime, 930); // 08:30 + 60m = 09:30 (keeps 1h!)
      assert.equal(ov1h.customRooms, undefined); // no congela aula oficial

      // Explicit keepDuration: false -> snaps to existing slot bounds
      const swappedSnap = swapLessons({}, lesson2h, lesson1h, { keepDuration: false });
      assert.equal(swappedSnap['20261109_2001'].customEndTime, 1200);
      assert.equal(swappedSnap['20261109_2002'].customEndTime, 1030);
    });

    test('swaps across different days and sets customDate bidirectionally', () => {
      const lessonMonday = {
        id: 3001,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula Mon'],
        subjects: ['Sistemas'],
      };
      const lessonFriday = {
        id: 3002,
        date: 20261113,
        startTime: 1200,
        endTime: 1400,
        rooms: ['Aula Fri'],
        subjects: ['Redes'],
      };

      const overrides = swapLessons({}, lessonMonday, lessonFriday, { swapRooms: true });
      const ovMon = overrides['20261109_3001'];
      const ovFri = overrides['20261113_3002'];

      assert.equal(ovMon.customDate, 20261113);
      assert.equal(ovMon.customStartTime, 1200);
      assert.equal(ovMon.customEndTime, 1400);
      assert.deepEqual(ovMon.customRooms, ['Aula Fri']);

      assert.equal(ovFri.customDate, 20261109);
      assert.equal(ovFri.customStartTime, 900);
      assert.equal(ovFri.customEndTime, 1100);
      assert.deepEqual(ovFri.customRooms, ['Aula Mon']);

      const applied = applyLessonOverrides([lessonMonday, lessonFriday], overrides);
      const resMon = applied.find(l => l.id === 3001);
      const resFri = applied.find(l => l.id === 3002);

      assert.equal(resMon.date, 20261113);
      assert.equal(resMon.rawDate, 20261109);
      assert.equal(resFri.date, 20261109);
      assert.equal(resFri.rawDate, 20261113);
    });

    test('automatically removes overrides when swapping lessons back to their original slots', () => {
      const lessonA = {
        id: 4001,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 1'],
        subjects: ['Química'],
      };
      const lessonB = {
        id: 4002,
        date: 20261109,
        startTime: 1100,
        endTime: 1300,
        rooms: ['Aula 2'],
        subjects: ['Física'],
      };

      // 1. Swap inicial
      const swapped = swapLessons({}, lessonA, lessonB);
      assert.ok(swapped['20261109_4001']);
      assert.ok(swapped['20261109_4002']);

      const [appliedA, appliedB] = applyLessonOverrides([lessonA, lessonB], swapped);

      // 2. Volver a intercambiar ambas clases para regresarlas a sus posiciones iniciales
      const unswapped = swapLessons(swapped, appliedA, appliedB);
      assert.equal(unswapped['20261109_4001'], undefined, 'El override de la clase A debe eliminarse al volver a ser oficial');
      assert.equal(unswapped['20261109_4002'], undefined, 'El override de la clase B debe eliminarse al volver a ser oficial');
    });

    test('swapLessons aborts if lessons are invalid or identical', () => {
      const lesson = { id: 1001, date: 20261109 };
      assert.deepEqual(swapLessons({}, lesson, lesson), {});
      assert.deepEqual(swapLessons({}, null, lesson), {});
      assert.deepEqual(swapLessons({}, lesson, null), {});
    });
  });

  describe('hasLessonOverrideChanges and areRoomsEqual', () => {
    test('areRoomsEqual compares room arrays robustly with whitespace and case tolerance', () => {
      assert.equal(areRoomsEqual(['Aula 1.1'], ['aula 1.1']), true);
      assert.equal(areRoomsEqual(['1.1', '1.2'], ['1.2', '1.1']), true);
      assert.equal(areRoomsEqual([], []), true);
      assert.equal(areRoomsEqual(null, []), true);
      assert.equal(areRoomsEqual(['Aula 1.1'], ['Aula 2.0']), false);
      assert.equal(areRoomsEqual(['Aula 1.1'], []), false);
    });

    test('areRoomsEqual recognizes UPV/EHU alphanumeric room codes with or without internal spaces or suffixes', () => {
      assert.equal(areRoomsEqual(['P2 G3A'], ['P2G3A']), true);
      assert.equal(areRoomsEqual(['P2G3A_14838'], ['P2G3A']), true);
      assert.equal(areRoomsEqual(['P1 I2S'], ['P1I2S']), true);
      assert.equal(areRoomsEqual(['P 2 G 3 A'], ['P2G3A']), true);
      assert.equal(areRoomsEqual(['Aula 1.4', 'P2 G3A'], ['P2G3A', 'Aula 1.4']), true);
      assert.equal(areRoomsEqual(['P2G3A'], ['P2G3B']), false);
    });

    test('hasLessonOverrideChanges accurately detects differences vs official state', () => {
      const snap = {
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 1.1'],
        code: null,
      };

      // Sin cambios
      assert.equal(hasLessonOverrideChanges({ userCancelled: false }, snap), false);
      assert.equal(hasLessonOverrideChanges({ customStartTime: 900, customEndTime: 1100, customRooms: ['Aula 1.1'] }, snap), false);
      assert.equal(hasLessonOverrideChanges({ customNotes: '   ' }, snap), false);

      // Con códigos de aula equivalentes (ej. oficial P2 G3A y override P2G3A)
      const snapCode = {
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['P2 G3A'],
        code: null,
      };
      assert.equal(hasLessonOverrideChanges({ customStartTime: 900, customEndTime: 1100, customRooms: ['P2G3A'], customNotes: '' }, snapCode), false);

      // Con cambios
      assert.equal(hasLessonOverrideChanges({ userCancelled: true }, snap), true);
      assert.equal(hasLessonOverrideChanges({ swappedWith: { lessonKey: 'abc' } }, snap), true);
      assert.equal(hasLessonOverrideChanges({ customNotes: 'Apuntes' }, snap), true);
      assert.equal(hasLessonOverrideChanges({ customStartTime: 930 }, snap), true);
      assert.equal(hasLessonOverrideChanges({ customEndTime: 1130 }, snap), true);
      assert.equal(hasLessonOverrideChanges({ customRooms: ['Lab 2'] }, snap), true);
      assert.equal(hasLessonOverrideChanges({ customDate: 20261110 }, snap), true);
    });
  });

  describe('cleanObsoleteLessonOverrides lifecycle', () => {
    test('removes override when official WebUntis schedule updates to match the user custom room', () => {
      const initialOfficialLesson = {
        id: 990,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 1.1'],
        code: null,
      };

      // Usuario personalizó el aula a P2G3A
      const overrides = setLessonOverride({}, initialOfficialLesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3A'],
        customNotes: '',
      });
      assert.ok(overrides['20261109_990']);

      // Posteriormente, WebUntis actualiza oficialmente el aula de esta clase a P2 G3A
      const updatedOfficialLesson = {
        ...initialOfficialLesson,
        rooms: ['P2 G3A'], // WebUntis format with space
      };

      const cleaned = cleanObsoleteLessonOverrides(overrides, [updatedOfficialLesson]);
      assert.equal(cleaned['20261109_990'], undefined, 'El override debe eliminarse ya que el aula oficial ahora coincide con la puesta por el usuario');
    });

    test('preserves override when other fields still differ from updated official schedule', () => {
      const initialOfficialLesson = {
        id: 991,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 1.1'],
        code: null,
      };

      // Usuario personalizó aula y además puso una nota
      const overrides = setLessonOverride({}, initialOfficialLesson, {
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P2G3A'],
        customNotes: 'Llevar apuntes',
      });

      // WebUntis actualiza el aula a P2 G3A, pero la nota del usuario sigue existiendo
      const updatedOfficialLesson = {
        ...initialOfficialLesson,
        rooms: ['P2 G3A'],
      };

      const cleaned = cleanObsoleteLessonOverrides(overrides, [updatedOfficialLesson]);
      assert.ok(cleaned['20261109_991'], 'El override se conserva porque contiene notas personales');
    });
  });

  describe('3-way Reconciliation Engine (reconcileLessonOverrides & applyLessonOverrides)', () => {
    const baseOfficial = {
      id: 7001,
      date: 20261109,
      startTime: 830,
      endTime: 1030,
      rooms: ['P3 G2A'],
      teachers: ['Prof A'],
      code: null,
      subjects: ['Algoritmos'],
    };

    test('sparse overrides: adding only a note omits untouched date/time/room fields', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customDate: 20261109,
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P3G2A'],
        customNotes: 'Llevar portátil',
      });
      const ov = overrides['20261109_7001'];
      assert.ok(ov);
      assert.equal(ov.customNotes, 'Llevar portátil');
      assert.equal(ov.customDate, undefined);
      assert.equal(ov.customStartTime, undefined);
      assert.equal(ov.customEndTime, undefined);
      assert.equal(ov.customRooms, undefined);
    });

    test('orthogonal change: user adds note and WebUntis changes room -> applies room silently without conflict', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customDate: 20261109,
        customStartTime: 830,
        customEndTime: 1030,
        customRooms: ['P3G2A'],
        customNotes: 'Entregar práctica',
      });

      const updatedOfficial = { ...baseOfficial, rooms: ['P1 I2S'] };

      // In-memory application on frame 0
      const [applied] = applyLessonOverrides([updatedOfficial], overrides);
      assert.equal(applied.isOverridden, true);
      assert.equal(applied.hasRemoteDrift, false);
      assert.equal(applied.driftChanges, null);
      assert.deepEqual(applied.rooms, ['P1 I2S']);
      assert.equal(applied.notes, 'Entregar práctica');

      // Persisted reconciliation advances snapshot and is idempotent
      const reconciled = reconcileLessonOverrides(overrides, [updatedOfficial]);
      assert.notEqual(reconciled, overrides);
      assert.deepEqual(reconciled['20261109_7001'].originalSnapshot.rooms, ['P1 I2S']);
      assert.equal(reconciled['20261109_7001'].customRooms, undefined);
      assert.equal(reconciled['20261109_7001'].customNotes, 'Entregar práctica');
      assert.equal(reconcileLessonOverrides(reconciled, [updatedOfficial]), reconciled);
    });

    test('orthogonal change: user changes time/date and WebUntis changes room -> merges both without conflict', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customDate: 20261110,
        customStartTime: 1100,
        customEndTime: 1300,
        customRooms: ['P3G2A'],
        customNotes: '',
      });

      const updatedOfficial = { ...baseOfficial, rooms: ['Lab 4'] };
      const [applied] = applyLessonOverrides([updatedOfficial], overrides);

      assert.equal(applied.isOverridden, true);
      assert.equal(applied.hasRemoteDrift, false);
      assert.equal(applied.date, 20261110);
      assert.equal(applied.startTime, 1100);
      assert.equal(applied.endTime, 1300);
      assert.deepEqual(applied.rooms, ['Lab 4']);
    });

    test('orthogonal change: legacy dense override (with frozen untouched fields) still lets official changes apply', () => {
      const legacyOverrides = {
        '20261109_7001': {
          lessonKey: '20261109_7001',
          lessonId: 7001,
          date: 20261109,
          customDate: 20261109,
          customStartTime: 830,
          customEndTime: 1030,
          customRooms: ['P3G2A'], // frozen old room with different spacing
          customNotes: 'Nota heredada',
          originalSnapshot: {
            id: 7001,
            date: 20261109,
            startTime: 830,
            endTime: 1030,
            rooms: ['P3 G2A'],
            teachers: ['Prof A'],
            code: null,
          },
        },
      };

      const updatedOfficial = { ...baseOfficial, startTime: 900, endTime: 1100, rooms: ['Aula 2.2'] };
      const [applied] = applyLessonOverrides([updatedOfficial], legacyOverrides);
      assert.equal(applied.hasRemoteDrift, false);
      assert.equal(applied.startTime, 900);
      assert.equal(applied.endTime, 1100);
      assert.deepEqual(applied.rooms, ['Aula 2.2']);
      assert.equal(applied.notes, 'Nota heredada');

      const reconciled = reconcileLessonOverrides(legacyOverrides, [updatedOfficial]);
      assert.equal(reconciled['20261109_7001'].customRooms, undefined);
      assert.equal(reconciled['20261109_7001'].customStartTime, undefined);
      assert.equal(reconciled['20261109_7001'].customDate, undefined);
      assert.equal(reconciled['20261109_7001'].customNotes, 'Nota heredada');
      assert.equal(reconcileLessonOverrides(reconciled, [updatedOfficial]), reconciled);
    });

    test('partial convergence: user edits room + note, WebUntis updates room to equivalent with spaces -> clears customRooms, keeps note, NO conflict', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customRooms: ['P2G3B'],
        customNotes: 'Examen tema 2',
      });

      const updatedOfficial = { ...baseOfficial, rooms: ['P2 G3B'] };
      const [applied] = applyLessonOverrides([updatedOfficial], overrides);
      assert.equal(applied.isOverridden, true);
      assert.equal(applied.hasRemoteDrift, false);
      assert.equal(applied.driftChanges, null);
      assert.equal(applied.notes, 'Examen tema 2');

      const reconciled = reconcileLessonOverrides(overrides, [updatedOfficial]);
      assert.ok(reconciled['20261109_7001']);
      assert.equal(reconciled['20261109_7001'].customRooms, undefined);
      assert.deepEqual(reconciled['20261109_7001'].originalSnapshot.rooms, ['P2 G3B']);
      assert.equal(reconciled['20261109_7001'].customNotes, 'Examen tema 2');
      assert.equal(reconcileLessonOverrides(reconciled, [updatedOfficial]), reconciled);
    });

    test('room equivalence handles spaces, dots, accents, suffixes and comma-separated lists', () => {
      assert.equal(areRoomsEqual(['P3 G2A'], ['P3G2A']), true);
      assert.equal(areRoomsEqual(['A 1.2'], ['A1.2']), true);
      assert.equal(areRoomsEqual(['Aula 1.4'], ['Aula1.4']), true);
      assert.equal(areRoomsEqual(['Lab Física'], ['Lab Fisica']), true);
      assert.equal(areRoomsEqual(['P3 G2A_14838'], ['P3G2A']), true);
      assert.equal(areRoomsEqual(['P3 G2A, P2 G3B'], ['P2G3B', 'P3G2A']), true);
      assert.equal(areRoomsEqual(['Aula 1.4'], ['Aula 14']), false);
    });

    test('convergence on user cancellation: WebUntis cancels officially -> unmarks edited when no notes, keeps notes otherwise', () => {
      const onlyCancel = setLessonOverride({}, baseOfficial, { userCancelled: true });
      const cancelWithNote = setLessonOverride({}, baseOfficial, { userCancelled: true, customNotes: 'Repasar en casa' });
      const cancelledOfficial = { ...baseOfficial, code: 'cancelled' };

      const [applied1] = applyLessonOverrides([cancelledOfficial], onlyCancel);
      assert.equal(applied1.isOverridden, false);
      assert.equal(applied1.hasRemoteDrift, false);
      assert.equal(applied1.code, 'cancelled');
      assert.equal(reconcileLessonOverrides(onlyCancel, [cancelledOfficial])['20261109_7001'], undefined);

      const [applied2] = applyLessonOverrides([cancelledOfficial], cancelWithNote);
      assert.equal(applied2.isOverridden, true);
      assert.equal(applied2.isUserCancelled, false);
      assert.equal(applied2.hasRemoteDrift, false);
      assert.equal(applied2.notes, 'Repasar en casa');

      const rec2 = reconcileLessonOverrides(cancelWithNote, [cancelledOfficial]);
      assert.equal(rec2['20261109_7001'].userCancelled, undefined);
      assert.equal(rec2['20261109_7001'].customNotes, 'Repasar en casa');
      assert.equal(reconcileLessonOverrides(rec2, [cancelledOfficial]), rec2);
    });

    test('convergence on swapped classes: WebUntis applies the official swap -> clears swappedWith and unmarks edited', () => {
      const lessonA = { id: 8001, date: 20261109, startTime: 830, endTime: 1030, rooms: ['Aula 1'], subjects: ['Física'], code: null };
      const lessonB = { id: 8002, date: 20261109, startTime: 1100, endTime: 1300, rooms: ['Aula 2'], subjects: ['Química'], code: null };

      const swapped = swapLessons({}, lessonA, lessonB);
      const updatedA = { ...lessonA, startTime: 1100, endTime: 1300 };
      const updatedB = { ...lessonB, startTime: 830, endTime: 1030 };

      const applied = applyLessonOverrides([updatedA, updatedB], swapped);
      assert.equal(applied[0].isOverridden, false);
      assert.equal(applied[0].hasRemoteDrift, false);
      assert.equal(applied[1].isOverridden, false);
      assert.equal(applied[1].hasRemoteDrift, false);

      const reconciled = reconcileLessonOverrides(swapped, [updatedA, updatedB]);
      assert.equal(Object.keys(reconciled).length, 0);
    });

    test('real conflict ONLY on conflicting field while non-conflicting official change applies silently', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customRooms: ['Lab 2'],
        customNotes: 'Traer bata',
      });

      // WebUntis changes BOTH time (user didn't touch) and room (user changed to Lab 2, WebUntis changed to Aula 5)
      const updatedOfficial = { ...baseOfficial, startTime: 1000, endTime: 1200, rooms: ['Aula 5'] };
      const [applied] = applyLessonOverrides([updatedOfficial], overrides);

      assert.equal(applied.isOverridden, true);
      assert.equal(applied.hasRemoteDrift, true);
      assert.equal(applied.driftChanges.length, 1);
      assert.equal(applied.driftChanges[0].field, 'room');
      assert.equal(applied.driftChanges[0].userValue, 'Lab 2');
      // Time updated silently, room stayed user's until resolved, note preserved
      assert.equal(applied.startTime, 1000);
      assert.equal(applied.endTime, 1200);
      assert.deepEqual(applied.rooms, ['Lab 2']);
      assert.equal(applied.notes, 'Traer bata');

      // adopt_remote adopts ONLY the conflicting room, preserving the personal note!
      const adopted = resolveDrift(overrides, applied, 'adopt_remote');
      assert.ok(adopted['20261109_7001'], 'Debe conservar el override por la nota personal');
      assert.equal(adopted['20261109_7001'].customRooms, undefined);
      assert.equal(adopted['20261109_7001'].customNotes, 'Traer bata');
      assert.deepEqual(adopted['20261109_7001'].originalSnapshot.rooms, ['Aula 5']);

      const [afterAdopt] = applyLessonOverrides([updatedOfficial], adopted);
      assert.equal(afterAdopt.hasRemoteDrift, false);
      assert.deepEqual(afterAdopt.rooms, ['Aula 5']);
      assert.equal(afterAdopt.notes, 'Traer bata');
    });

    test('atomic time conflict prevents invalid startTime >= endTime when user only edited endTime', () => {
      const overrides = {
        '20261109_7001': {
          lessonKey: '20261109_7001',
          lessonId: 7001,
          customEndTime: 1000, // user shortened 08:30-10:30 to 08:30-10:00
          originalSnapshot: {
            id: 7001,
            date: 20261109,
            startTime: 830,
            endTime: 1030,
            rooms: ['P3 G2A'],
            code: null,
          },
        },
      };

      // WebUntis moves class to 11:00-13:00
      const updatedOfficial = { ...baseOfficial, startTime: 1100, endTime: 1300 };
      const [applied] = applyLessonOverrides([updatedOfficial], overrides);

      assert.equal(applied.hasRemoteDrift, true);
      assert.equal(applied.driftChanges[0].field, 'time');
      assert.equal(applied.startTime, 830);
      assert.equal(applied.endTime, 1000);
      assert.ok(applied.endTime > applied.startTime);
    });

    test('official cancellation of moved/edited class triggers conflict, keep_local keeps it active, adopt_remote preserves notes', () => {
      const overrides = setLessonOverride({}, baseOfficial, {
        customDate: 20261112,
        customStartTime: 1100,
        customEndTime: 1300,
        customNotes: 'Profe la movió al jueves',
      });

      const cancelledOfficial = { ...baseOfficial, code: 'cancelled' };
      const [pending] = applyLessonOverrides([cancelledOfficial], overrides);

      assert.equal(pending.hasRemoteDrift, true);
      assert.equal(pending.driftChanges.length, 1);
      assert.equal(pending.driftChanges[0].field, 'code');
      assert.equal(pending.code, null, 'Mientras el conflicto está pendiente, se mantiene activa la versión movida');
      assert.equal(pending.date, 20261112);

      // Option 1: keep_local -> ignoreOfficialCancellation: true, stays active, drift cleared
      const kept = resolveDrift(overrides, pending, 'keep_local');
      assert.equal(kept['20261109_7001'].ignoreOfficialCancellation, true);
      const [afterKeep] = applyLessonOverrides([cancelledOfficial], kept);
      assert.equal(afterKeep.hasRemoteDrift, false);
      assert.equal(afterKeep.code, null);
      assert.equal(afterKeep.date, 20261112);
      assert.equal(afterKeep.ignoresOfficialCancellation, true);

      // If WebUntis later uncancels it, ignoreOfficialCancellation auto-clears
      const uncancelledOfficial = { ...baseOfficial, code: null };
      const afterUncancel = reconcileLessonOverrides(kept, [uncancelledOfficial]);
      assert.equal(afterUncancel['20261109_7001'].ignoreOfficialCancellation, undefined);
      assert.equal(afterUncancel['20261109_7001'].customDate, 20261112);

      // Option 2: adopt_remote -> adopts cancellation, discards move, preserves note
      const adopted = resolveDrift(overrides, pending, 'adopt_remote');
      const ovAdopted = adopted['20261109_7001'];
      assert.ok(ovAdopted);
      assert.equal(ovAdopted.customDate, undefined);
      assert.equal(ovAdopted.customStartTime, undefined);
      assert.equal(ovAdopted.customNotes, 'Profe la movió al jueves');

      const [afterAdopt] = applyLessonOverrides([cancelledOfficial], adopted);
      assert.equal(afterAdopt.hasRemoteDrift, false);
      assert.equal(afterAdopt.code, 'cancelled');
      assert.equal(afterAdopt.date, 20261109);
      assert.equal(afterAdopt.notes, 'Profe la movió al jueves');
    });

    test('official cancellation when user ONLY added a note applies silently without conflict', () => {
      const overrides = setLessonOverride({}, baseOfficial, { customNotes: 'Solo una nota' });
      const cancelledOfficial = { ...baseOfficial, code: 'cancelled' };

      const [applied] = applyLessonOverrides([cancelledOfficial], overrides);
      assert.equal(applied.hasRemoteDrift, false);
      assert.equal(applied.code, 'cancelled');
      assert.equal(applied.notes, 'Solo una nota');
    });

    test('official date change migrates key cleanly when orthogonal and resolves conflict via lessonId when conflicting', () => {
      // Orthogonal: user only edited room, WebUntis moved date from 20261109 -> 20261110
      const roomOv = setLessonOverride({}, baseOfficial, { customRooms: ['Lab 9'] });
      const movedOfficial = { ...baseOfficial, date: 20261110 };

      const [appliedOrth] = applyLessonOverrides([movedOfficial], roomOv);
      assert.equal(appliedOrth.hasRemoteDrift, false);
      assert.equal(appliedOrth.date, 20261110);
      assert.deepEqual(appliedOrth.rooms, ['Lab 9']);

      const migrated = reconcileLessonOverrides(roomOv, [movedOfficial]);
      assert.equal(migrated['20261109_7001'], undefined);
      assert.ok(migrated['20261110_7001']);
      assert.deepEqual(migrated['20261110_7001'].customRooms, ['Lab 9']);
      assert.equal(reconcileLessonOverrides(migrated, [movedOfficial]), migrated);

      // Conflicting: user moved date to 20261112, WebUntis moved date to 20261110
      const dateOv = setLessonOverride({}, baseOfficial, { customDate: 20261112 });
      const [appliedConflict] = applyLessonOverrides([movedOfficial], dateOv);
      assert.equal(appliedConflict.hasRemoteDrift, true);
      assert.equal(appliedConflict.driftChanges[0].field, 'date');
      assert.equal(appliedConflict.driftChanges[0].before, '09/11/2026');
      assert.equal(appliedConflict.driftChanges[0].after, '10/11/2026');

      // resolveDrift finds old key via lessonId and migrates on keep_local / deletes on adopt_remote
      const keptDate = resolveDrift(dateOv, appliedConflict, 'keep_local');
      assert.equal(keptDate['20261109_7001'], undefined);
      assert.ok(keptDate['20261110_7001']);
      assert.equal(keptDate['20261110_7001'].customDate, 20261112);

      const adoptedDate = resolveDrift(dateOv, appliedConflict, 'adopt_remote');
      assert.equal(Object.keys(adoptedDate).length, 0);
    });

    test('reconcileLessonOverrides is strictly idempotent across conflicting and non-conflicting overrides', () => {
      const ovConflict = setLessonOverride({}, baseOfficial, { customRooms: ['Lab X'] });
      const updated = { ...baseOfficial, rooms: ['Lab Y'] };
      const pass1 = reconcileLessonOverrides(ovConflict, [updated]);
      const pass2 = reconcileLessonOverrides(pass1, [updated]);
      assert.equal(pass2, pass1);
    });
  });

  describe('hasNonCancellationOverrideChanges', () => {
    const baseOfficial = {
      id: 8001,
      date: 20261118,
      startTime: 900,
      endTime: 1100,
      rooms: ['P2 G3A'],
      teachers: ['Prof A'],
      code: null,
    };

    test('returns false for non-overridden lessons or lessons that are only user-cancelled', () => {
      const [plain] = applyLessonOverrides([baseOfficial], {});
      assert.equal(hasNonCancellationOverrideChanges(plain), false);

      const cancelOnlyOv = setLessonOverride({}, baseOfficial, { userCancelled: true });
      const [cancelledOnly] = applyLessonOverrides([baseOfficial], cancelOnlyOv);
      assert.equal(cancelledOnly.isOverridden, true);
      assert.equal(cancelledOnly.isUserCancelled, true);
      assert.equal(hasNonCancellationOverrideChanges(cancelledOnly), false);
    });

    test('returns true when a user-cancelled lesson also has room, time, date, notes, or swap overrides', () => {
      const ovRoom = setLessonOverride({}, baseOfficial, {
        userCancelled: true,
        customRooms: ['Lab 4'],
      });
      const [cancelledWithRoom] = applyLessonOverrides([baseOfficial], ovRoom);
      assert.equal(cancelledWithRoom.isUserCancelled, true);
      assert.equal(hasNonCancellationOverrideChanges(cancelledWithRoom), true);

      const ovNotes = setLessonOverride({}, baseOfficial, {
        userCancelled: true,
        customNotes: 'Recordatorio',
      });
      const [cancelledWithNotes] = applyLessonOverrides([baseOfficial], ovNotes);
      assert.equal(hasNonCancellationOverrideChanges(cancelledWithNotes), true);

      const ovTime = setLessonOverride({}, baseOfficial, {
        userCancelled: true,
        customStartTime: 1000,
        customEndTime: 1200,
      });
      const [cancelledWithTime] = applyLessonOverrides([baseOfficial], ovTime);
      assert.equal(hasNonCancellationOverrideChanges(cancelledWithTime), true);

      const ovDate = setLessonOverride({}, baseOfficial, {
        userCancelled: true,
        customDate: 20261119,
      });
      const [cancelledWithDate] = applyLessonOverrides([baseOfficial], ovDate);
      assert.equal(hasNonCancellationOverrideChanges(cancelledWithDate), true);
    });

    test('returns true for non-cancelled overridden lessons and supports fallback without overrideData', () => {
      const ovRoomOnly = setLessonOverride({}, baseOfficial, { customRooms: ['Lab 9'] });
      const [roomOnly] = applyLessonOverrides([baseOfficial], ovRoomOnly);
      assert.equal(hasNonCancellationOverrideChanges(roomOnly), true);

      // Fallback without overrideData
      assert.equal(
        hasNonCancellationOverrideChanges({
          isOverridden: true,
          isUserCancelled: true,
          date: 20261118,
          rawDate: 20261118,
          startTime: 900,
          rawStartTime: 900,
          endTime: 1100,
          rawEndTime: 1100,
          rooms: ['P2 G3A'],
          rawRooms: ['P2 G3A'],
          notes: '',
        }),
        false
      );

      assert.equal(
        hasNonCancellationOverrideChanges({
          isOverridden: true,
          isUserCancelled: true,
          notes: 'Traer portatil',
        }),
        true
      );
    });
  });

  describe('Storage persistence helpers', () => {
    test('getStoredLessonOverrides and saveStoredLessonOverrides roundtrip', () => {
      const overrides = {
        '20261109_555': { lessonKey: '20261109_555', userCancelled: true },
      };
      saveStoredLessonOverrides(overrides);
      const loaded = getStoredLessonOverrides();
      assert.deepEqual(loaded, overrides);
    });
  });
});
