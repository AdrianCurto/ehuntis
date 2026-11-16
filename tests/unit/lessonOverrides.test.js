const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  LESSON_OVERRIDES_STORAGE_KEY,
  formatTime,
  getLessonKey,
  getStoredLessonOverrides,
  saveStoredLessonOverrides,
  checkRemoteDrift,
  applyLessonOverrides,
  setLessonOverride,
  removeLessonOverride,
  resolveDrift,
  swapLessons,
  hasLessonOverrideChanges,
  areRoomsEqual,
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
      assert.equal(formatTime(800), '8:00');
      assert.equal(formatTime(830), '8:30');
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

  describe('Drift detection and resolution', () => {
    test('checkRemoteDrift detects time change in fresh WebUntis lesson', () => {
      const freshLesson = {
        id: 400,
        date: 20261109,
        startTime: 1000, // changed from 900
        endTime: 1200,   // changed from 1100
        rooms: ['Aula 1'],
        code: null,
      };
      const override = {
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
      assert.equal(drift[0].before, '9:00–11:00');
      assert.equal(drift[0].after, '10:00–12:00');
    });

    test('checkRemoteDrift detects room change and official cancellation', () => {
      const freshLesson = {
        id: 500,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 2.1'], // changed from Aula 1.1
        code: 'cancelled',   // university cancelled officially
      };
      const override = {
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
      assert.equal(step2['20261109_860'].userCancelled, false);
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

      // Lesson A gets Lesson B's times, pero mantiene Aula A
      assert.equal(ovA.customStartTime, 1100);
      assert.equal(ovA.customEndTime, 1300);
      assert.deepEqual(ovA.customRooms, ['Aula A']);
      assert.equal(ovA.swappedWith.lessonKey, '20261109_1002');
      assert.equal(ovA.swappedWith.subjectName, 'Química');

      // Lesson B gets Lesson A's times, pero mantiene Aula B
      assert.equal(ovB.customStartTime, 830);
      assert.equal(ovB.customEndTime, 1030);
      assert.deepEqual(ovB.customRooms, ['Aula B']);
      assert.equal(ovB.swappedWith.lessonKey, '20261109_1001');
      assert.equal(ovB.swappedWith.subjectName, 'Física');

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
      assert.deepEqual(ov2h.customRooms, ['Aula 2H']); // maintains its room by default

      assert.equal(ov1h.customStartTime, 830);
      assert.equal(ov1h.customEndTime, 930); // 08:30 + 60m = 09:30 (keeps 1h!)
      assert.deepEqual(ov1h.customRooms, ['Aula 1H']); // maintains its room by default

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
