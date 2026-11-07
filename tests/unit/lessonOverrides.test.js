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
  });

  describe('swapLessons atomic operation', () => {
    test('swaps timings and rooms bidirectionally and attaches swappedWith metadata', () => {
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

      const overrides = swapLessons({}, lessonA, lessonB);
      assert.equal(Object.keys(overrides).length, 2);

      const ovA = overrides['20261109_1001'];
      const ovB = overrides['20261109_1002'];

      assert.ok(ovA);
      assert.ok(ovB);

      // Lesson A gets Lesson B's times and room
      assert.equal(ovA.customStartTime, 1100);
      assert.equal(ovA.customEndTime, 1300);
      assert.deepEqual(ovA.customRooms, ['Aula B']);
      assert.equal(ovA.swappedWith.lessonKey, '20261109_1002');
      assert.equal(ovA.swappedWith.subjectName, 'Química');

      // Lesson B gets Lesson A's times and room
      assert.equal(ovB.customStartTime, 830);
      assert.equal(ovB.customEndTime, 1030);
      assert.deepEqual(ovB.customRooms, ['Aula A']);
      assert.equal(ovB.swappedWith.lessonKey, '20261109_1001');
      assert.equal(ovB.swappedWith.subjectName, 'Física');
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
      assert.deepEqual(ov2h.customRooms, ['Aula 1H']);

      assert.equal(ov1h.customStartTime, 830);
      assert.equal(ov1h.customEndTime, 930); // 08:30 + 60m = 09:30 (keeps 1h!)
      assert.deepEqual(ov1h.customRooms, ['Aula 2H']);

      // Explicit keepDuration: false -> snaps to existing slot bounds
      const swappedSnap = swapLessons({}, lesson2h, lesson1h, { keepDuration: false });
      assert.equal(swappedSnap['20261109_2001'].customEndTime, 1200);
      assert.equal(swappedSnap['20261109_2002'].customEndTime, 1030);
    });

    test('swapLessons aborts if lessons are invalid or identical', () => {
      const lesson = { id: 1001, date: 20261109 };
      assert.deepEqual(swapLessons({}, lesson, lesson), {});
      assert.deepEqual(swapLessons({}, null, lesson), {});
      assert.deepEqual(swapLessons({}, lesson, null), {});
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
