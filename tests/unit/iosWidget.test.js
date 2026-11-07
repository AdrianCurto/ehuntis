const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

describe('iOS Scriptable Widget suite (public/scripts/ehuntis-widget.js)', () => {
  let widgetEnv;

  before(() => {
    let code = fs.readFileSync('public/scripts/ehuntis-widget.js', 'utf8');
    // Prevent auto-execution of main()
    code = code.replace(/await main\(\);/, '// await main();');

    const mockFM = {
      documentsDirectory: () => '/docs',
      fileExists: () => false,
      readString: () => '',
      writeString: () => {},
      joinPath: (...parts) => parts.join('/'),
    };

    const context = {
      console,
      setTimeout,
      clearTimeout,
      Script: { complete: () => {}, setWidget: () => {}, name: () => 'EHUntis' },
      config: { runsInWidget: false, runsInAccessoryWidget: false },
      args: { queryParameters: { close: 'true' } },
      ListWidget: class {},
      Color: class { constructor(hex) { this.hex = hex; } },
      Font: { boldSystemFont: () => {}, systemFont: () => {} },
      Device: { isUsingDarkAppearance: () => false, screenSize: () => ({ width: 390, height: 844 }), screenScale: () => 3 },
      FileManager: { local: () => mockFM, iCloud: () => mockFM },
      DrawContext: class {
        size = { width: 100, height: 100 };
        respectScreenScale = true;
        setFillColor() {}
        setStrokeColor() {}
        setLineWidth() {}
        fill() {}
        stroke() {}
        fillPath() {}
        drawText() {}
        getImage() { return {}; }
      },
      Point: class { constructor(x, y) { this.x = x; this.y = y; } },
      Rect: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
      Size: class { constructor(w, h) { this.w = w; this.h = h; } },
      Path: class {
        addRoundedRect() {}
        addRect() {}
      },
    };

    vm.createContext(context);
    vm.runInContext(code, context);
    widgetEnv = context;
  });

  describe('getLessonOverrideKey in iOS script', () => {
    test('prefers date and id when id is present', () => {
      const lesson = { id: 778899, date: 20261109, startTime: 900 };
      const key = widgetEnv.getLessonOverrideKey(lesson);
      assert.equal(key, '20261109_778899');
    });

    test('falls back to composite key when id is missing', () => {
      const lesson = {
        date: 20261109,
        subjectIds: [205],
        startTime: 830,
        type: 'PL1',
      };
      const key = widgetEnv.getLessonOverrideKey(lesson);
      assert.equal(key, '20261109_205_830_pl1');
    });
  });

  describe('applyLessonOverrides in iOS script', () => {
    test('applies user cancellation', () => {
      const lesson = {
        id: 111,
        date: 20261109,
        startTime: 900,
        endTime: 1100,
        rooms: ['Aula 1.1'],
        code: null,
      };
      const overrides = {
        '20261109_111': {
          lessonKey: '20261109_111',
          lessonId: 111,
          userCancelled: true,
        },
      };

      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(res.isOverridden, true);
      assert.equal(res.isUserCancelled, true);
      assert.equal(res.code, 'cancelled');
      assert.equal(res.startTime, 900);
      assert.equal(res.endTime, 1100);
    });

    test('applies custom time, rooms, notes and swappedWith', () => {
      const lesson = {
        id: 222,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        rooms: ['Aula 0.5'],
        notes: '',
      };
      const overrides = {
        '20261109_222': {
          lessonKey: '20261109_222',
          lessonId: 222,
          customStartTime: 900,
          customEndTime: 1100,
          customRooms: ['Aula 2.3'],
          customNotes: 'Repaso con el profesor',
          swappedWith: { lessonKey: '20261109_333', subjectName: 'Física' },
        },
      };

      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(res.isOverridden, true);
      assert.equal(res.startTime, 900);
      assert.equal(res.endTime, 1100);
      assert.deepEqual(res.rooms, ['Aula 2.3']);
      assert.equal(res.notes, 'Repaso con el profesor');
      assert.equal(res.swappedWith?.subjectName, 'Física');
    });
  });

  describe('expandCustomEventsForDates in iOS script', () => {
    test('expands single and weekly events with exceptions', () => {
      const singleEvent = {
        id: 'ev_single',
        title: 'Reunión Proyecto',
        location: 'Sala 3',
        category: 'Trabajo',
        colorIndex: 6,
        startTime: 1200,
        endTime: 1300,
        recurrence: { type: 'none', date: 20261109 },
      };

      const weeklyEvent = {
        id: 'ev_gym',
        title: 'Gym',
        startTime: 1900,
        endTime: 2000,
        recurrence: {
          type: 'weekly',
          daysOfWeek: [1, 3], // Mon (1), Wed (3)
          startDate: 20261101,
          endDate: 20261130,
          exceptions: [20261111], // Wed 11th skipped
        },
      };

      const dates = [
        new Date(2026, 10, 9),  // Mon Nov 9 -> single + weekly match!
        new Date(2026, 10, 10), // Tue Nov 10 -> neither matches
        new Date(2026, 10, 11), // Wed Nov 11 -> exception, skipped!
      ];

      const expanded = widgetEnv.expandCustomEventsForDates([singleEvent, weeklyEvent], dates);
      assert.equal(expanded.length, 2);

      const expSingle = expanded.find(e => e.eventId === 'ev_single');
      assert.ok(expSingle);
      assert.equal(expSingle.isCustomEvent, true);
      assert.equal(expSingle.date, 20261109);
      assert.deepEqual([...expSingle.subjects], ['Reunión Proyecto']);
      assert.deepEqual([...expSingle.rooms], ['Sala 3']);
      assert.equal(expSingle.colorIndex, 6);
      assert.equal(expSingle.type, 'TRABAJO');

      const expWeekly = expanded.find(e => e.eventId === 'ev_gym');
      assert.ok(expWeekly);
      assert.equal(expWeekly.isCustomEvent, true);
      assert.equal(expWeekly.date, 20261109);
    });
  });

  describe('mergeConsecutiveBlocks in iOS script', () => {
    test('merges consecutive identical active official classes', () => {
      const b1 = {
        id: 1,
        date: 20261109,
        startTime: 900,
        endTime: 1000,
        subjectIds: [10],
        subjects: ['Matemáticas'],
        rooms: ['Aula 1'],
        type: 'Magistral',
        code: null,
      };
      const b2 = {
        id: 2,
        date: 20261109,
        startTime: 1000,
        endTime: 1100,
        subjectIds: [10],
        subjects: ['Matemáticas'],
        rooms: ['Aula 1'],
        type: 'GA',
        code: null,
      };

      const merged = widgetEnv.mergeConsecutiveBlocks([b1, b2]);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].startTime, 900);
      assert.equal(merged[0].endTime, 1100);
    });

    test('STRICT: does NOT merge when one class is cancelled (cancelKey partitioning)', () => {
      const activeClass = {
        id: 1,
        date: 20261109,
        startTime: 900,
        endTime: 1000,
        subjectIds: [10],
        subjects: ['Matemáticas'],
        rooms: ['Aula 1'],
        type: 'Magistral',
        code: null,
      };
      const cancelledClass = {
        id: 2,
        date: 20261109,
        startTime: 1000,
        endTime: 1100,
        subjectIds: [10],
        subjects: ['Matemáticas'],
        rooms: ['Aula 1'],
        type: 'GA',
        code: 'cancelled',
        isUserCancelled: true,
      };

      const merged = widgetEnv.mergeConsecutiveBlocks([activeClass, cancelledClass]);
      // Must remain 2 separate blocks so the user sees one active and one cancelled!
      assert.equal(merged.length, 2);
      assert.equal(merged[0].code, null);
      assert.equal(merged[1].code, 'cancelled');
    });

    test('custom events pass through unmerged', () => {
      const c1 = { isCustomEvent: true, id: 'c1', startTime: 900, endTime: 1000 };
      const c2 = { isCustomEvent: true, id: 'c2', startTime: 1000, endTime: 1100 };
      const res = widgetEnv.mergeConsecutiveBlocks([c1, c2]);
      assert.equal(res.length, 2);
    });
  });

  describe('computeVisibleTimeRange out-of-normal hours in iOS script', () => {
    test('adapts firstHour downward when early classes exist before 8:00', () => {
      const earlyLesson = { startTime: 645, endTime: 830 };
      const range = widgetEnv.computeVisibleTimeRange([earlyLesson]);
      assert.equal(range.firstHour, 6);
      assert.ok(range.startMinutes <= 6 * 60);
    });

    test('adapts lastHour upward when late classes exist after 21:00', () => {
      const lateLesson = { startTime: 2000, endTime: 2230 };
      const range = widgetEnv.computeVisibleTimeRange([lateLesson]);
      assert.equal(range.lastHour, 23);
      assert.ok(range.endMinutes >= 22 * 60 + 30);
    });
  });
});
