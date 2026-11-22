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
      Timer: {
        schedule: (millis, repeats, callback) => {
          const id = setTimeout(callback, millis);
          return { invalidate: () => clearTimeout(id) };
        },
      },
      Script: { complete: () => {}, setWidget: () => {}, name: () => 'EHUntis' },
      config: { runsInWidget: false, runsInAccessoryWidget: false },
      args: { queryParameters: { close: 'true' } },
      ListWidget: class {},
      Color: class {
        constructor(hex, alpha) { this.hex = hex; this.alpha = alpha; }
        static dynamic(l, d) { return l; }
        static white() { return new this('#ffffff'); }
        static black() { return new this('#000000'); }
      },
      Font: {
        boldSystemFont: (s) => ({ size: s, weight: 'bold' }),
        systemFont: (s) => ({ size: s, weight: 'normal' })
      },
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
        strokePath() {}
        fillRect() {}
        drawText() {}
        drawTextInRect() {}
        drawImageInRect() {}
        setFont() {}
        setTextColor() {}
        setTextAlignedCenter() {}
        setTextAlignedLeft() {}
        setTextAlignedRight() {}
        addPath() {}
        getImage() { return {}; }
      },
      Point: class { constructor(x, y) { this.x = x; this.y = y; } },
      Rect: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
      Size: class { constructor(w, h) { this.w = w; this.h = h; } },
      Path: class {
        addRoundedRect() {}
        addRect() {}
        move() {}
        addLine() {}
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

    test('sanitizes customDate strings to integer numbers', () => {
      const lesson = { id: 333, date: 20261109, startTime: 900 };
      const overrides = {
        '20261109_333': { lessonId: 333, customDate: '20261117' },
      };
      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(typeof res.date, 'number');
      assert.equal(res.date, 20261117);
    });

    test('3-way reconciliation: room convergence with spaces (P3 G2A == P3G2A) unmarks override', () => {
      const lesson = { id: 444, date: 20261109, startTime: 830, endTime: 1030, rooms: ['P3 G2A'], code: null };
      const overrides = {
        '20261109_444': {
          lessonKey: '20261109_444',
          lessonId: 444,
          customRooms: ['P3G2A'],
          originalSnapshot: { date: 20261109, startTime: 830, endTime: 1030, rooms: ['Aula 1.1'], code: null },
        },
      };
      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(Boolean(res.isOverridden), false);
      assert.deepEqual([...res.rooms], ['P3 G2A']);
    });

    test('3-way reconciliation: legacy dense override lets untouched official room/time apply while keeping user note', () => {
      const lesson = { id: 445, date: 20261109, startTime: 930, endTime: 1130, rooms: ['P1 I2S'], code: null };
      const overrides = {
        '20261109_445': {
          lessonKey: '20261109_445',
          lessonId: 445,
          customDate: 20261109,
          customStartTime: 830,
          customEndTime: 1030,
          customRooms: ['P3G2A'],
          customNotes: 'Traer calculadora',
          originalSnapshot: { date: 20261109, startTime: 830, endTime: 1030, rooms: ['P3 G2A'], code: null },
        },
      };
      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(res.isOverridden, true);
      assert.equal(res.startTime, 930);
      assert.equal(res.endTime, 1130);
      assert.deepEqual([...res.rooms], ['P1 I2S']);
      assert.equal(res.notes, 'Traer calculadora');
    });

    test('3-way reconciliation: official cancellation of moved class keeps moved class active (ignoreOfficialCancellation / conflict)', () => {
      const cancelledOfficial = { id: 446, date: 20261109, startTime: 830, endTime: 1030, rooms: ['Aula 1'], code: 'cancelled' };
      const overrides = {
        '20261109_446': {
          lessonKey: '20261109_446',
          lessonId: 446,
          customDate: 20261112,
          originalSnapshot: { date: 20261109, startTime: 830, endTime: 1030, rooms: ['Aula 1'], code: null },
        },
      };
      const [res] = widgetEnv.applyLessonOverrides([cancelledOfficial], overrides);
      assert.equal(res.isOverridden, true);
      assert.equal(res.date, 20261112);
      assert.equal(res.code, null);
    });

    test('3-way reconciliation: resilient against null fields in originalSnapshot and non-array customRooms', () => {
      const lesson = { id: 447, date: 20261109, startTime: 830, endTime: 1030, rooms: ['P3 G2A'], code: null };
      const overrides = {
        '20261109_447': {
          lessonKey: '20261109_447',
          lessonId: 447,
          customDate: 20261109,
          customRooms: 'P3G2A',
          originalSnapshot: { date: null, startTime: null, endTime: null, rooms: null, code: null },
        },
      };
      const [res] = widgetEnv.applyLessonOverrides([lesson], overrides);
      assert.equal(Boolean(res.isOverridden), false);
      assert.equal(res.date, 20261109);
      assert.deepEqual([...res.rooms], ['P3 G2A']);
    });
  });

  describe('getDeviceWidgetSize in iOS script', () => {
    test('handles standard families and accessory widgets correctly', () => {
      const med = widgetEnv.getDeviceWidgetSize('medium');
      assert.ok(med.w > 300);
      assert.ok(med.h > 100);

      const accRect = widgetEnv.getDeviceWidgetSize('accessoryRectangular');
      assert.equal(accRect.w, 150);
      assert.equal(accRect.h, 44);

      const accCirc = widgetEnv.getDeviceWidgetSize('accessoryCircular');
      assert.equal(accCirc.w, 44);
      assert.equal(accCirc.h, 44);
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

    test('resilient against string dates and string recurrence exceptions', () => {
      const ev = {
        id: 'ev_str',
        title: 'String Event',
        startTime: 1000,
        endTime: 1100,
        recurrence: {
          type: 'weekly',
          daysOfWeek: [1],
          startDate: '20261101',
          endDate: '20261130',
          exceptions: ['20261116'], // string exception!
        },
      };

      const dates = [
        new Date(2026, 10, 9),  // 20261109 -> matches!
        new Date(2026, 10, 16), // 20261116 -> string exception, must be skipped!
      ];

      const res = widgetEnv.expandCustomEventsForDates([ev], dates);
      assert.equal(res.length, 1);
      assert.equal(res[0].date, 20261109);
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

  describe('toDateNumber robust input handling in iOS script', () => {
    test('handles Date objects, numbers, and strings safely without throwing', () => {
      const d = new Date(2026, 10, 16);
      assert.equal(widgetEnv.toDateNumber(d), 20261116);
      assert.equal(widgetEnv.toDateNumber(20261116), 20261116);
      assert.equal(widgetEnv.toDateNumber('20261116'), 20261116);
      assert.equal(widgetEnv.toDateNumber(null), 0);
      assert.equal(widgetEnv.toDateNumber(undefined), 0);
    });
  });

  describe('updateSubjectColors and custom events exclusion', () => {
    test('does not pollute subject color map with custom events', () => {
      const officialLesson = {
        date: 20261116,
        subjectIds: [100],
        subjects: ['Química'],
        isCustomEvent: false,
      };
      const customEventLesson = {
        date: 20261116,
        subjectIds: ['custom_ev_1'],
        subjects: ['Gimnasio'],
        isCustomEvent: true,
        colorIndex: 3,
      };

      widgetEnv.updateSubjectColors([officialLesson, customEventLesson]);
      const colorOfficial = widgetEnv.getColorForSubject(100, false);
      assert.ok(colorOfficial.bg);

      // Official lesson must get palette index 0 since it is the only academic subject
      const resolvedPalette = widgetEnv.getResolvedPalette(false);
      assert.equal(colorOfficial.bg, resolvedPalette[0].bg);
    });
  });

  describe('rendering execution for daily and weekly views in iOS script', () => {
    test('renderTimetable and renderWeekTimetable execute cleanly without runtime crashes', () => {
      const dc = new widgetEnv.DrawContext();
      const lessons = [
        {
          id: 1,
          date: 20261116,
          startTime: 900,
          endTime: 1100,
          subjectIds: [10],
          subjects: ['Cálculo I'],
          rooms: ['0.1'],
          type: 'Magistral',
        },
        {
          id: 'custom_ev_1_20261116',
          eventId: 'ev_1',
          date: 20261116,
          startTime: 1200,
          endTime: 1300,
          subjects: ['Estudio'],
          rooms: ['Biblio'],
          isCustomEvent: true,
          colorIndex: 4,
          type: 'PERSONAL',
        },
        {
          id: 2,
          date: 20261117,
          startTime: 1000,
          endTime: 1200,
          subjectIds: [20],
          subjects: ['Física'],
          rooms: ['1.2'],
          type: 'GA',
          code: 'cancelled',
          isUserCancelled: true,
        },
      ];

      const monday = new Date(2026, 10, 16);
      assert.doesNotThrow(() => {
        widgetEnv.renderTimetable(dc, 338, 114, monday, lessons, false, new Date(2026, 10, 16, 10, 0), 1.0, {});
      });

      assert.doesNotThrow(() => {
        widgetEnv.renderWeekTimetable(dc, 338, 114, monday, lessons, false, new Date(2026, 10, 16, 10, 0), 1.0, {});
      });
    });
  });

  describe('isDarkModeActive logic and sticky dark prevention', () => {
    test('explicit dark theme always returns true', () => {
      assert.equal(widgetEnv.isDarkModeActive({ theme: 'dark' }), true);
    });

    test('explicit light theme always returns false', () => {
      assert.equal(widgetEnv.isDarkModeActive({ theme: 'light' }), false);
    });

    test('native Device.isUsingDarkAppearance() is respected directly', () => {
      widgetEnv.Device.isUsingDarkAppearance = () => true;
      assert.equal(widgetEnv.isDarkModeActive({ theme: 'system' }), true);

      widgetEnv.Device.isUsingDarkAppearance = () => false;
      assert.equal(widgetEnv.isDarkModeActive({ theme: 'system' }), false);
    });
  });

  describe('fetchUserData validation in iOS script', () => {
    test('validates statusCode and array of configs', async () => {
      let mockStatusCode = 200;
      let mockBody = { configs: [{ id: 1, name: 'Principal' }] };

      widgetEnv.Request = class {
        constructor() {
          this.headers = {};
        }
        async loadJSON() {
          return mockBody;
        }
        get response() {
          return { statusCode: mockStatusCode };
        }
      };

      // Success
      const data = await widgetEnv.fetchUserData('testuser');
      assert.equal(Array.isArray(data.configs), true);

      // Status 404 (e.g. user not found)
      mockStatusCode = 404;
      mockBody = { error: 'Usuario no encontrado' };
      await assert.rejects(
        async () => await widgetEnv.fetchUserData('testuser'),
        /Usuario no encontrado/
      );

      // Status 200 but corrupted JSON missing configs
      mockStatusCode = 200;
      mockBody = { somethingElse: true };
      await assert.rejects(
        async () => await widgetEnv.fetchUserData('testuser'),
        /Error HTTP 200/
      );
    });
  });

  describe('iosWidgetLoader helper functions', () => {
    test('extracts ETag case-insensitively', () => {
      const { IOS_WIDGET_LOADER_CODE } = require('../../app/utils/iosWidgetLoader.js');
      // Verify helper definition exists in loader code
      assert.equal(IOS_WIDGET_LOADER_CODE.includes('function getHeaderCaseInsensitive'), true);
      assert.equal(IOS_WIDGET_LOADER_CODE.includes('body.trimStart().startsWith(CORE_MARKER)'), true);
      assert.equal(IOS_WIDGET_LOADER_CODE.includes('CORE_URL = "https://ehuntis.vercel.app/widgets/ehuntis-widget-core.js";'), true);
    });
  });
});
