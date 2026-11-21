const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  captureLessonOverrideRemoval,
  captureLessonUnswap,
  restoreLessonOverrideEntries,
  captureCustomEventRemoval,
  restoreCustomEventSnapshot,
  captureGroupRemoval,
  restoreGroupSnapshot,
  captureConfigRemoval,
  restoreConfigSnapshot,
  captureCustomColorsReset,
  restoreCustomColorsSnapshot,
} = require('../../app/utils/undoHelpers');

describe('undoHelpers snapshot & restore suite', () => {
  describe('lesson overrides capture & restore', () => {
    test('captures single override and restores it with refreshed updatedAt', () => {
      const overrides = {
        '20261118_101': {
          lessonKey: '20261118_101',
          lessonId: 101,
          customRooms: ['Lab 4'],
          updatedAt: 1000,
        },
        '20261118_202': {
          lessonKey: '20261118_202',
          lessonId: 202,
          customNotes: 'Examen',
          updatedAt: 1000,
        },
      };

      const { removedEntries, nextOverrides } = captureLessonOverrideRemoval(overrides, '20261118_101');
      assert.ok(removedEntries['20261118_101']);
      assert.equal(Object.keys(removedEntries).length, 1);
      assert.equal(nextOverrides['20261118_101'], undefined);
      assert.ok(nextOverrides['20261118_202']);

      const restored = restoreLessonOverrideEntries(nextOverrides, removedEntries, 9999);
      assert.deepEqual(restored['20261118_101'].customRooms, ['Lab 4']);
      assert.equal(restored['20261118_101'].updatedAt, 9999);
      assert.ok(restored['20261118_202']);
    });

    test('captures both swapped lesson entries and restores both', () => {
      const overrides = {
        '20261118_1': {
          lessonKey: '20261118_1',
          customStartTime: 1100,
          swappedWith: { lessonKey: '20261118_2', subjectName: 'Fisica' },
        },
        '20261118_2': {
          lessonKey: '20261118_2',
          customStartTime: 900,
          swappedWith: { lessonKey: '20261118_1', subjectName: 'Mates' },
        },
      };

      const { removedEntries, nextOverrides } = captureLessonOverrideRemoval(overrides, {
        lessonKey: '20261118_1',
        swappedWith: { lessonKey: '20261118_2' },
      });

      assert.equal(Object.keys(removedEntries).length, 2);
      assert.equal(Object.keys(nextOverrides).length, 0);

      const restored = restoreLessonOverrideEntries(nextOverrides, removedEntries, 5555);
      assert.equal(Object.keys(restored).length, 2);
      assert.equal(restored['20261118_1'].customStartTime, 1100);
      assert.equal(restored['20261118_2'].customStartTime, 900);
    });

    test('captureLessonUnswap unswaps both lessons preserving notes and restores both on Undo', () => {
      const overrides = {
        '20261118_1': {
          lessonKey: '20261118_1',
          lessonId: 1,
          date: 20261118,
          customStartTime: 1100,
          customEndTime: 1300,
          customNotes: 'Nota importante',
          swappedWith: {
            lessonKey: '20261118_2',
            subjectName: 'Fisica',
            swapRooms: false,
            applied: { date: 20261118, startTime: 1100, endTime: 1300 },
          },
          originalSnapshot: { id: 1, date: 20261118, startTime: 900, endTime: 1100, rooms: ['A1'] },
        },
        '20261118_2': {
          lessonKey: '20261118_2',
          lessonId: 2,
          date: 20261118,
          customStartTime: 900,
          customEndTime: 1100,
          swappedWith: {
            lessonKey: '20261118_1',
            subjectName: 'Mates',
            swapRooms: false,
            applied: { date: 20261118, startTime: 900, endTime: 1100 },
          },
          originalSnapshot: { id: 2, date: 20261118, startTime: 1100, endTime: 1300, rooms: ['B2'] },
        },
      };

      const { previousEntries, nextOverrides } = captureLessonUnswap(overrides, '20261118_1');
      assert.equal(Object.keys(previousEntries).length, 2);
      assert.equal(nextOverrides['20261118_2'], undefined);
      assert.equal(nextOverrides['20261118_1'].customNotes, 'Nota importante');
      assert.equal(nextOverrides['20261118_1'].swappedWith, undefined);
      assert.equal(nextOverrides['20261118_1'].customStartTime, undefined);

      const restored = restoreLessonOverrideEntries(nextOverrides, previousEntries, 7777);
      assert.equal(Object.keys(restored).length, 2);
      assert.equal(restored['20261118_1'].customStartTime, 1100);
      assert.equal(restored['20261118_1'].swappedWith.lessonKey, '20261118_2');
      assert.equal(restored['20261118_2'].customStartTime, 900);
      assert.equal(restored['20261118_2'].swappedWith.lessonKey, '20261118_1');
    });
  });

  describe('custom events capture & restore', () => {
    const singleEvent = {
      id: 'evt_1',
      title: 'Tutoria',
      startTime: 1000,
      endTime: 1100,
      recurrence: { type: 'single', date: 20261118 },
      updatedAt: 1000,
    };

    const weeklyEvent = {
      id: 'evt_2',
      title: 'Gimnasio',
      startTime: 1800,
      endTime: 1930,
      recurrence: { type: 'weekly', daysOfWeek: [1, 3], startDate: 20261101, exceptions: [] },
      updatedAt: 1000,
    };

    test('restores deleted single event at its original index without losing other events', () => {
      const events = [singleEvent, weeklyEvent];
      const { snapshot, nextEvents } = captureCustomEventRemoval(events, 'evt_1', 20261118, 'series');

      assert.equal(nextEvents.length, 1);
      assert.equal(nextEvents[0].id, 'evt_2');
      assert.equal(snapshot.isWeekly, false);

      // Simulate another event being added before undo
      const withExtra = [...nextEvents, { id: 'evt_3', title: 'Nuevo' }];
      const restored = restoreCustomEventSnapshot(withExtra, snapshot, 7777);

      assert.equal(restored.length, 3);
      assert.equal(restored[0].id, 'evt_1');
      assert.equal(restored[0].title, 'Tutoria');
      assert.equal(restored[0].updatedAt, 7777);
      assert.equal(restored[2].id, 'evt_3');
    });

    test('restores deleted single instance of weekly event by reverting exceptions array', () => {
      const events = [weeklyEvent];
      const { snapshot, nextEvents } = captureCustomEventRemoval(events, 'evt_2', 20261118, 'single');

      assert.equal(nextEvents.length, 1);
      assert.deepEqual(nextEvents[0].recurrence.exceptions, [20261118]);

      const restored = restoreCustomEventSnapshot(nextEvents, snapshot, 8888);
      assert.equal(restored.length, 1);
      assert.deepEqual(restored[0].recurrence.exceptions, []);
      assert.equal(restored[0].updatedAt, 8888);
    });
  });

  describe('group capture & restore', () => {
    test('captures group with disabled state and subject/subgroup filters, then restores intact', () => {
      const groupA = { id: 10, name: 'G1A', longName: 'Grado A' };
      const groupB = { id: 20, name: 'G2B', longName: 'Grado B' };
      const config = {
        id: 'cfg_1',
        selectedGroups: [groupA, groupB],
        disabledGroupIds: ['key_10'],
        disabledSubjectsByGroup: { key_10: [501, 502], key_20: [601] },
        disabledSubgroupsBySubject: { key_10: { 501: ['GA2'] } },
      };

      const { snapshot, nextConfig } = captureGroupRemoval(config, groupA, 'key_10');
      assert.equal(nextConfig.selectedGroups.length, 1);
      assert.equal(nextConfig.selectedGroups[0].id, 20);
      assert.deepEqual(nextConfig.disabledGroupIds, []);
      assert.equal(nextConfig.disabledSubjectsByGroup.key_10, undefined);
      assert.equal(nextConfig.disabledSubgroupsBySubject.key_10, undefined);

      const restored = restoreGroupSnapshot(nextConfig, snapshot);
      assert.equal(restored.selectedGroups.length, 2);
      assert.equal(restored.selectedGroups[0].id, 10);
      assert.deepEqual(restored.disabledGroupIds, ['key_10']);
      assert.deepEqual(restored.disabledSubjectsByGroup.key_10, [501, 502]);
      assert.deepEqual(restored.disabledSubgroupsBySubject.key_10, { 501: ['GA2'] });
    });
  });

  describe('config capture & restore', () => {
    test('restores deleted last config and cleans up temporary empty fallback', () => {
      const cfg = { id: 'cfg_main', name: '1º Cuatrimestre', selectedGroups: [{ id: 1, name: 'G1' }] };
      const { snapshot, nextConfigs, nextActiveConfigId } = captureConfigRemoval(
        [cfg],
        'cfg_main',
        'cfg_main',
        () => ({ id: 'cfg_fallback', name: 'Mi horario', selectedGroups: [] })
      );

      assert.equal(nextConfigs.length, 1);
      assert.equal(nextConfigs[0].id, 'cfg_fallback');
      assert.equal(nextActiveConfigId, 'cfg_fallback');

      const restored = restoreConfigSnapshot(nextConfigs, snapshot);
      assert.equal(restored.nextConfigs.length, 1);
      assert.equal(restored.nextConfigs[0].id, 'cfg_main');
      assert.equal(restored.nextActiveConfigId, 'cfg_main');
    });

    test('restores one of multiple configs at original position and restores activeConfigId', () => {
      const cfg1 = { id: 'c1', name: 'A', selectedGroups: [] };
      const cfg2 = { id: 'c2', name: 'B', selectedGroups: [] };
      const { snapshot, nextConfigs, nextActiveConfigId } = captureConfigRemoval([cfg1, cfg2], 'c2', 'c2');

      assert.equal(nextConfigs.length, 1);
      assert.equal(nextActiveConfigId, 'c1');

      const restored = restoreConfigSnapshot(nextConfigs, snapshot);
      assert.equal(restored.nextConfigs.length, 2);
      assert.equal(restored.nextConfigs[1].id, 'c2');
      assert.equal(restored.nextActiveConfigId, 'c2');
    });
  });

  describe('custom colors reset capture & restore', () => {
    test('returns null previousColors when no custom colors exist', () => {
      const { previousColors } = captureCustomColorsReset({ id: 'c1', customColors: {} });
      assert.equal(previousColors, null);
    });

    test('captures and restores subject color overrides', () => {
      const cfg = { id: 'c1', customColors: { 101: 3, 202: 7 } };
      const { previousColors, nextConfig } = captureCustomColorsReset(cfg);
      assert.deepEqual(nextConfig.customColors, {});
      assert.deepEqual(previousColors, { 101: 3, 202: 7 });

      const restored = restoreCustomColorsSnapshot(nextConfig, previousColors);
      assert.deepEqual(restored.customColors, { 101: 3, 202: 7 });
    });
  });
});
