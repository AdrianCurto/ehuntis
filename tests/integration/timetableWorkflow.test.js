const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  saveCustomEventInstance,
  deleteCustomEventInstance,
  expandCustomEventsForDates,
  suggestEventColor,
  timeStringToNumber,
} = require('../../app/utils/customEvents');

const {
  getLessonKey,
  setLessonOverride,
  removeLessonOverride,
  applyLessonOverrides,
  checkRemoteDrift,
  resolveDrift,
  swapLessons,
} = require('../../app/utils/lessonOverrides');

const {
  hasLocalCustomData,
  mergeConfigs,
  mergeCustomEvents,
  mergeLessonOverrides,
  mergeCustomCategories,
} = require('../../app/utils/syncUtils');

describe('Full Timetable Workflow & Multi-device Sync Integration', () => {
  test('Complete lifecycle: Creation, Weekly Recurrence, Exceptions, Overrides, Swaps and Cloud Sync', () => {
    // ── 1. Pristine Initial State ───────────────────────────────────────────
    let localConfigs = [
      {
        id: 'cfg_1',
        name: 'Configuración 1',
        selectedGroups: [],
        disabledGroupIds: [],
        disabledSubjectsByGroup: {},
        disabledSubgroupsBySubject: {},
        customColors: {},
      },
    ];
    let customEvents = [];
    let lessonOverrides = {};
    let customCategories = ['Estudio', 'Deporte'];

    assert.equal(hasLocalCustomData(localConfigs, customEvents, lessonOverrides), false);

    // ── 2. User creates a single custom event (Tutoría Álgebra) ─────────────
    const singleEventData = {
      title: 'Tutoría Álgebra',
      location: 'Despacho 3.12',
      category: 'Estudio',
      colorIndex: suggestEventColor([], customEvents),
      startTime: 1100,
      endTime: 1200,
      notes: 'Preguntar dudas tema 2',
      recurrence: {
        type: 'none',
        date: 20261109,
      },
    };
    customEvents = saveCustomEventInstance(customEvents, singleEventData, 20261109, 'series');
    assert.equal(customEvents.length, 1);
    const createdSingle = customEvents[0];
    assert.ok(createdSingle.id);
    assert.equal(createdSingle.colorIndex, 0); // First available color

    // ── 3. User creates a weekly recurring event (Gimnasio Lunes y Jueves) ───
    const weeklyEventData = {
      title: 'Gimnasio',
      location: 'Polideportivo',
      category: 'Deporte',
      colorIndex: suggestEventColor([], customEvents),
      startTime: 1900,
      endTime: 2030,
      recurrence: {
        type: 'weekly',
        daysOfWeek: [1, 4], // Monday (1), Thursday (4)
        startDate: 20261101,
        endDate: 20261130,
        exceptions: [],
      },
    };
    customEvents = saveCustomEventInstance(customEvents, weeklyEventData, 20261109, 'series');
    assert.equal(customEvents.length, 2);
    const createdWeekly = customEvents[1];
    assert.equal(createdWeekly.colorIndex, 1); // Second color

    // User now has local custom data even with 0 university groups!
    assert.equal(hasLocalCustomData(localConfigs, customEvents, lessonOverrides), true);

    // ── 4. Expand events for visible week (Nov 9 to Nov 15) ─────────────────
    const visibleWeekDates = [
      new Date(2026, 10, 9),  // Mon Nov 9  -> Single + Weekly match (2 instances)
      new Date(2026, 10, 10), // Tue Nov 10 -> 0
      new Date(2026, 10, 11), // Wed Nov 11 -> 0
      new Date(2026, 10, 12), // Thu Nov 12 -> Weekly matches (1 instance)
      new Date(2026, 10, 13), // Fri Nov 13 -> 0
    ];
    let expanded = expandCustomEventsForDates(customEvents, visibleWeekDates);
    assert.equal(expanded.length, 3);
    assert.deepEqual(expanded.map(e => e.date), [20261109, 20261109, 20261112]);

    // ── 5. User cancels ONLY the Thursday instance of the weekly event ──────
    customEvents = deleteCustomEventInstance(customEvents, createdWeekly.id, 20261112, 'single');
    assert.equal(customEvents.length, 2); // Still 2 definitions
    assert.deepEqual(customEvents[1].recurrence.exceptions, [20261112]); // Nov 12 added to exceptions!

    // Re-expanding visible week: Thursday occurrence is now skipped!
    expanded = expandCustomEventsForDates(customEvents, visibleWeekDates);
    assert.equal(expanded.length, 2);
    assert.deepEqual(expanded.map(e => e.date), [20261109, 20261109]);

    // ── 6. University Lessons & Overrides ────────────────────────────────────
    const officialLessons = [
      {
        id: 501,
        date: 20261109,
        startTime: 830,
        endTime: 1030,
        subjects: ['Cálculo I'],
        subjectIds: [10],
        rooms: ['Aula 1.1'],
        code: null,
      },
      {
        id: 502,
        date: 20261109,
        startTime: 1230,
        endTime: 1430,
        subjects: ['Física General'],
        subjectIds: [20],
        rooms: ['Lab Física'],
        code: null,
      },
      {
        id: 503,
        date: 20261110,
        startTime: 900,
        endTime: 1100,
        subjects: ['Química'],
        subjectIds: [30],
        rooms: ['Aula 0.2'],
        code: null,
      },
    ];

    // User cancels Cálculo I for Nov 9
    lessonOverrides = setLessonOverride(lessonOverrides, officialLessons[0], { userCancelled: true });
    assert.equal(lessonOverrides['20261109_501'].userCancelled, true);

    // User edits Física General: changes time to 13:00-15:00 and room to 'Lab 2'
    lessonOverrides = setLessonOverride(lessonOverrides, officialLessons[1], {
      customStartTime: 1300,
      customEndTime: 1500,
      customRooms: ['Lab 2'],
      customNotes: 'Llevar bata de laboratorio',
    });

    // Apply overrides to official lessons
    const overridden = applyLessonOverrides(officialLessons, lessonOverrides);
    assert.equal(overridden.length, 3);

    const over0 = overridden.find(l => l.id === 501);
    assert.equal(over0.isUserCancelled, true);
    assert.equal(over0.code, 'cancelled');
    assert.equal(over0.startTime, 830); // original time kept for strikethrough display

    const over1 = overridden.find(l => l.id === 502);
    assert.equal(over1.isOverridden, true);
    assert.equal(over1.startTime, 1300);
    assert.equal(over1.endTime, 1500);
    assert.deepEqual(over1.rooms, ['Lab 2']);
    assert.equal(over1.notes, 'Llevar bata de laboratorio');

    const over2 = overridden.find(l => l.id === 503);
    assert.equal(over2.isOverridden, false);

    // ── 7. Combined Timetable: Official + Custom Events ─────────────────────
    const combined = [...overridden, ...expanded];
    assert.equal(combined.length, 5); // 3 university lessons + 2 custom events on Nov 9
    const mondayItems = combined.filter(c => c.date === 20261109);
    assert.equal(mondayItems.length, 4); // 2 university + 2 custom events

    // ── 8. Multi-Device Sync Simulation ─────────────────────────────────────
    // Simulate Device 2 having added an exception on Nov 19 and modified notes
    const remoteWeeklyEvent = {
      ...createdWeekly,
      title: 'Gimnasio y Sauna',
      notes: 'Llevar toalla grande',
      updatedAt: Date.now() + 10000, // newer timestamp!
      recurrence: {
        ...createdWeekly.recurrence,
        exceptions: [20261119], // Nov 19 exception created on Device 2
      },
    };

    const mergedCustomEvents = mergeCustomEvents(customEvents, [remoteWeeklyEvent]);
    const mergedWeekly = mergedCustomEvents.find(e => e.id === createdWeekly.id);
    assert.ok(mergedWeekly);
    assert.equal(mergedWeekly.title, 'Gimnasio y Sauna'); // Winner from remote
    assert.equal(mergedWeekly.notes, 'Llevar toalla grande');
    // Both exceptions preserved (Nov 12 from local, Nov 19 from remote)!
    assert.deepEqual(mergedWeekly.recurrence.exceptions.sort(), [20261112, 20261119]);

    // ── 9. Remote Drift Simulation ──────────────────────────────────────────
    // Suppose WebUntis changes the official time of Física General to 14:00-16:00
    const freshWebUntisLesson = {
      ...officialLessons[1],
      startTime: 1400,
      endTime: 1600,
    };
    const drift = checkRemoteDrift(freshWebUntisLesson, lessonOverrides['20261109_502']);
    assert.ok(drift);
    assert.equal(drift[0].field, 'time');
    assert.equal(drift[0].before, '12:30–14:30');
    assert.equal(drift[0].after, '14:00–16:00');

    // Resolve drift by keep_local (updating snapshot to silence warning)
    const resolvedOverrides = resolveDrift(lessonOverrides, freshWebUntisLesson, 'keep_local');
    const driftAfterKeep = checkRemoteDrift(freshWebUntisLesson, resolvedOverrides['20261109_502']);
    assert.equal(driftAfterKeep, null); // Drift cleared!
  });
});
