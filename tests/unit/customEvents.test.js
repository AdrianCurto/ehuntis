const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  CUSTOM_EVENTS_STORAGE_KEY,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  DEFAULT_CATEGORIES,
  getStoredCustomCategories,
  saveStoredCustomCategories,
  getDefaultEventTimes,
  getStoredCustomEvents,
  saveStoredCustomEvents,
  suggestEventColor,
  timeStringToNumber,
  timeNumberToString,
  expandCustomEventsForDates,
  deleteCustomEventInstance,
  saveCustomEventInstance,
} = require('../../app/utils/customEvents');

describe('customEvents utility suite', () => {
  // Mock localStorage and window for storage functions
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

  describe('Time conversion utilities', () => {
    test('timeStringToNumber converts HH:MM format properly', () => {
      assert.equal(timeStringToNumber('08:00'), 800);
      assert.equal(timeStringToNumber('08:30'), 830);
      assert.equal(timeStringToNumber('14:45'), 1445);
      assert.equal(timeStringToNumber('23:59'), 2359);
      assert.equal(timeStringToNumber('00:00'), 0);
      assert.equal(timeStringToNumber('09:07'), 907);
    });

    test('timeStringToNumber handles invalid or missing strings gracefully', () => {
      assert.equal(timeStringToNumber(null), 800);
      assert.equal(timeStringToNumber(undefined), 800);
      assert.equal(timeStringToNumber(''), 800);
      assert.equal(timeStringToNumber(123), 800);
    });

    test('timeNumberToString converts integer HHMM properly', () => {
      assert.equal(timeNumberToString(800), '08:00');
      assert.equal(timeNumberToString(830), '08:30');
      assert.equal(timeNumberToString(1445), '14:45');
      assert.equal(timeNumberToString(2359), '23:59');
      assert.equal(timeNumberToString(0), '00:00');
      assert.equal(timeNumberToString(907), '09:07');
    });

    test('timeNumberToString handles non-numbers gracefully', () => {
      assert.equal(timeNumberToString(null), '08:00');
      assert.equal(timeNumberToString(undefined), '08:00');
    });

    test('getDefaultEventTimes generates valid range', () => {
      const times = getDefaultEventTimes();
      assert.ok(times.startStr.match(/^\d{2}:00$/));
      assert.ok(times.endStr.match(/^\d{2}:00$/));
      const startNum = timeStringToNumber(times.startStr);
      const endNum = timeStringToNumber(times.endStr);
      assert.ok(endNum > startNum);
    });
  });

  describe('Color suggestion logic', () => {
    test('suggestEventColor picks first unused color', () => {
      const lessons = [
        { subjectIds: [10], colorIndex: 0 },
        { subjectIds: [20], colorIndex: 1 },
      ];
      const customEvents = [
        { colorIndex: 2 },
      ];
      const suggested = suggestEventColor(lessons, customEvents, {});
      assert.equal(suggested, 3);
    });

    test('suggestEventColor respects customColors mapping', () => {
      const lessons = [
        { subjectIds: [10], colorIndex: 0 },
      ];
      const customColors = { 10: 5 }; // Subject 10 is mapped to 5 instead of 0
      const suggested = suggestEventColor(lessons, [], customColors);
      // Index 0 should be free because subject 10 used index 5!
      assert.equal(suggested, 0);
    });

    test('suggestEventColor falls back to 4 if all 14 palette colors are taken', () => {
      const customEvents = [];
      for (let i = 0; i < 14; i++) {
        customEvents.push({ colorIndex: i });
      }
      const suggested = suggestEventColor([], customEvents, {});
      assert.equal(suggested, 4);
    });
  });

  describe('expandCustomEventsForDates', () => {
    test('returns empty array when inputs are empty or invalid', () => {
      assert.deepEqual(expandCustomEventsForDates([], []), []);
      assert.deepEqual(expandCustomEventsForDates(null, []), []);
      assert.deepEqual(expandCustomEventsForDates([], null), []);
    });

    test('expands single event on exact date only', () => {
      const event = {
        id: 'evt_1',
        title: 'Tutoría Cálculo',
        location: 'Despacho 2.14',
        category: 'Estudio',
        colorIndex: 4,
        startTime: 1100,
        endTime: 1230,
        recurrence: {
          type: 'none',
          date: 20261109,
        },
      };

      const dates = [
        new Date(2026, 10, 8),  // 2026-11-08 (Sun)
        new Date(2026, 10, 9),  // 2026-11-09 (Mon)
        new Date(2026, 10, 10), // 2026-11-10 (Tue)
      ];

      const instances = expandCustomEventsForDates([event], dates);
      assert.equal(instances.length, 1);
      const inst = instances[0];
      assert.equal(inst.id, 'evt_1_20261109');
      assert.equal(inst.eventId, 'evt_1');
      assert.equal(inst.isCustomEvent, true);
      assert.equal(inst.date, 20261109);
      assert.equal(inst.startTime, 1100);
      assert.equal(inst.endTime, 1230);
      assert.deepEqual(inst.subjects, ['Tutoría Cálculo']);
      assert.deepEqual(inst.rooms, ['Despacho 2.14']);
      assert.equal(inst.category, 'Estudio');
      assert.equal(inst.type, 'ESTUDIO');
    });

    test('expands weekly event across multiple matching days and respects exceptions', () => {
      const event = {
        id: 'evt_sports',
        title: 'Entrenamiento',
        location: 'Gimnasio UPV',
        category: 'Deporte',
        colorIndex: 2,
        startTime: 1915,
        endTime: 2045,
        recurrence: {
          type: 'weekly',
          daysOfWeek: [1, 3], // Monday (1), Wednesday (3)
          startDate: 20261101,
          endDate: 20261130,
          exceptions: [20261111], // Wednesday 11th is cancelled
        },
      };

      const dates = [
        new Date(2026, 10, 9),  // 2026-11-09 Mon -> matches
        new Date(2026, 10, 10), // 2026-11-10 Tue -> no match
        new Date(2026, 10, 11), // 2026-11-11 Wed -> EXCEPTION, should be skipped
        new Date(2026, 10, 12), // 2026-11-12 Thu -> no match
        new Date(2026, 10, 16), // 2026-11-16 Mon -> matches
        new Date(2026, 10, 18), // 2026-11-18 Wed -> matches
      ];

      const instances = expandCustomEventsForDates([event], dates);
      assert.equal(instances.length, 3);
      assert.deepEqual(instances.map(i => i.date), [20261109, 20261116, 20261118]);
      assert.equal(instances[0].startTime, 1915);
      assert.equal(instances[0].endTime, 2045);
    });

    test('supports weekend days in weekly recurrence (Saturday=6, Sunday=0)', () => {
      const weekendEvent = {
        id: 'evt_weekend',
        title: 'Partido de Liga',
        location: 'Campo de fútbol',
        category: 'Deporte',
        colorIndex: 1,
        startTime: 1000,
        endTime: 1200,
        recurrence: {
          type: 'weekly',
          daysOfWeek: [0, 6], // Saturday and Sunday
          startDate: 20261101,
          endDate: 20261130,
        },
      };

      const dates = [
        new Date(2026, 10, 13), // Friday Nov 13 -> no match
        new Date(2026, 10, 14), // Saturday Nov 14 (6) -> matches
        new Date(2026, 10, 15), // Sunday Nov 15 (0) -> matches
      ];

      const instances = expandCustomEventsForDates([weekendEvent], dates);
      assert.equal(instances.length, 2);
      assert.equal(instances[0].date, 20261114);
      assert.equal(instances[1].date, 20261115);
    });

    test('respects startDate and endDate boundaries', () => {
      const event = {
        id: 'evt_bounds',
        title: 'Curso Intensivo',
        startTime: 900,
        endTime: 1000,
        recurrence: {
          type: 'weekly',
          daysOfWeek: [2], // Tuesday
          startDate: 20261110,
          endDate: 20261120,
        },
      };

      const dates = [
        new Date(2026, 10, 3),  // Nov 3 -> before startDate
        new Date(2026, 10, 10), // Nov 10 -> matches (startDate inclusive)
        new Date(2026, 10, 17), // Nov 17 -> matches
        new Date(2026, 10, 24), // Nov 24 -> after endDate
      ];

      const instances = expandCustomEventsForDates([event], dates);
      assert.equal(instances.length, 2);
      assert.deepEqual(instances.map(i => i.date), [20261110, 20261117]);
    });
  });

  describe('deleteCustomEventInstance', () => {
    test('mode: "series" completely removes the event', () => {
      const events = [
        { id: 'ev1', title: 'A' },
        { id: 'ev2', title: 'B' },
      ];
      const result = deleteCustomEventInstance(events, 'ev1', 20261109, 'series');
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'ev2');
    });

    test('mode: "single" on a non-recurring event removes it completely', () => {
      const events = [
        { id: 'ev1', title: 'A', recurrence: { type: 'none', date: 20261109 } },
      ];
      const result = deleteCustomEventInstance(events, 'ev1', 20261109, 'single');
      assert.equal(result.length, 0);
    });

    test('mode: "single" on weekly series adds date to exceptions and sets updatedAt', () => {
      const events = [
        {
          id: 'ev1',
          title: 'A',
          recurrence: {
            type: 'weekly',
            daysOfWeek: [1],
            exceptions: [20261102],
          },
        },
      ];
      const result = deleteCustomEventInstance(events, 'ev1', 20261109, 'single');
      assert.equal(result.length, 1);
      assert.deepEqual(result[0].recurrence.exceptions, [20261102, 20261109]);
      assert.ok(result[0].updatedAt > 0);
    });

    test('does not duplicate exception date if already present', () => {
      const events = [
        {
          id: 'ev1',
          recurrence: { type: 'weekly', exceptions: [20261109] },
        },
      ];
      const result = deleteCustomEventInstance(events, 'ev1', 20261109, 'single');
      assert.deepEqual(result[0].recurrence.exceptions, [20261109]);
    });
  });

  describe('saveCustomEventInstance', () => {
    test('creates new event when id does not exist', () => {
      const events = [];
      const newFields = {
        title: 'Estudiar Física',
        location: 'Biblioteca',
        startTime: 1600,
        endTime: 1800,
        recurrence: { type: 'none', date: 20261109 },
      };
      const result = saveCustomEventInstance(events, newFields, 20261109, 'series');
      assert.equal(result.length, 1);
      assert.equal(result[0].title, 'Estudiar Física');
      assert.ok(result[0].id.startsWith('evt_'));
      assert.ok(result[0].createdAt > 0);
      assert.ok(result[0].updatedAt > 0);
    });

    test('updates entire series when mode is series', () => {
      const events = [
        {
          id: 'ev_weekly',
          title: 'Gimnasio',
          startTime: 1800,
          endTime: 1900,
          recurrence: { type: 'weekly', daysOfWeek: [1] },
        },
      ];
      const update = {
        id: 'ev_weekly',
        title: 'Crossfit',
        startTime: 1830,
        endTime: 1930,
      };
      const result = saveCustomEventInstance(events, update, 20261109, 'series');
      assert.equal(result.length, 1);
      assert.equal(result[0].title, 'Crossfit');
      assert.equal(result[0].startTime, 1830);
      assert.equal(result[0].endTime, 1930);
      assert.ok(result[0].updatedAt > 0);
    });

    test('edits "single" instance of weekly series: adds exception to original and creates detached single event', () => {
      const events = [
        {
          id: 'ev_weekly',
          title: 'Gimnasio',
          startTime: 1800,
          endTime: 1900,
          recurrence: {
            type: 'weekly',
            daysOfWeek: [1],
            exceptions: [],
          },
        },
      ];
      const modifiedFields = {
        id: 'ev_weekly',
        title: 'Gimnasio (Horario Especial)',
        startTime: 2000,
        endTime: 2100,
      };

      const result = saveCustomEventInstance(events, modifiedFields, 20261109, 'single');
      assert.equal(result.length, 2);

      const original = result.find(e => e.id === 'ev_weekly');
      assert.ok(original);
      assert.deepEqual(original.recurrence.exceptions, [20261109]);

      const detached = result.find(e => e.id !== 'ev_weekly');
      assert.ok(detached);
      assert.equal(detached.title, 'Gimnasio (Horario Especial)');
      assert.equal(detached.startTime, 2000);
      assert.equal(detached.endTime, 2100);
      assert.equal(detached.recurrence.type, 'none');
      assert.equal(detached.recurrence.date, 20261109);
    });
  });

  describe('Storage persistence helpers', () => {
    test('getStoredCustomEvents and saveStoredCustomEvents roundtrip', () => {
      const events = [{ id: '1', title: 'Test' }];
      saveStoredCustomEvents(events);
      const loaded = getStoredCustomEvents();
      assert.deepEqual(loaded, events);
    });

    test('getStoredCustomCategories and saveStoredCustomCategories roundtrip', () => {
      const cats = ['Gimnasio', 'Trabajo'];
      saveStoredCustomCategories(cats);
      const loaded = getStoredCustomCategories();
      assert.deepEqual(loaded, cats);
    });
  });
});
