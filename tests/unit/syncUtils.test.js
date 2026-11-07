const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  hasLocalCustomData,
  areConfigsEquivalent,
  areCustomEventsEquivalent,
  areCustomCategoriesEquivalent,
  areLessonOverridesEquivalent,
  mergeConfigs,
  mergeCustomEvents,
  mergeCustomCategories,
  mergeLessonOverrides,
} = require('../../app/utils/syncUtils');

describe('syncUtils suite: cloud synchronization and 3-way merge', () => {
  describe('hasLocalCustomData', () => {
    test('returns false for fresh default pristine configuration', () => {
      const pristineConfigs = [
        {
          id: 'cfg_default',
          name: 'Configuración 1',
          selectedGroups: [],
          disabledGroupIds: [],
          disabledSubjectsByGroup: {},
          disabledSubgroupsBySubject: {},
          customColors: {},
        },
      ];
      assert.equal(hasLocalCustomData(pristineConfigs, [], {}), false);
    });

    test('returns true when custom events exist, even with 0 university groups', () => {
      const emptyConfigs = [
        { id: '1', name: 'Configuración 1', selectedGroups: [] },
      ];
      const customEvents = [
        { id: 'ev1', title: 'Tutoría' },
      ];
      assert.equal(hasLocalCustomData(emptyConfigs, customEvents, {}), true);
    });

    test('returns true when lesson overrides exist, even with 0 university groups', () => {
      const emptyConfigs = [
        { id: '1', name: 'Configuración 1', selectedGroups: [] },
      ];
      const overrides = {
        '20261109_123': { userCancelled: true },
      };
      assert.equal(hasLocalCustomData(emptyConfigs, [], overrides), true);
    });

    test('returns true if user configured university groups or custom preferences', () => {
      assert.equal(hasLocalCustomData([{ name: 'Configuración 1', selectedGroups: [{ id: 10 }] }]), true);
      assert.equal(hasLocalCustomData([{ name: 'Mi Horario', selectedGroups: [] }]), true);
      assert.equal(hasLocalCustomData([{ name: 'Configuración 1', disabledGroupIds: ['grp1'] }]), true);
      assert.equal(hasLocalCustomData([{ name: 'Configuración 1', customColors: { 10: 2 } }]), true);
      assert.equal(hasLocalCustomData([{ name: 'Config 1' }, { name: 'Config 2' }]), true);
    });
  });

  describe('areCustomEventsEquivalent', () => {
    test('recognizes structurally identical events regardless of array order or exception order', () => {
      const listA = [
        {
          id: 'ev1',
          title: 'Gym',
          category: 'Deporte',
          startTime: 1800,
          endTime: 1900,
          recurrence: { type: 'weekly', exceptions: [20261109, 20261102] },
        },
        {
          id: 'ev2',
          title: 'Estudio',
          category: 'Biblioteca',
          startTime: 900,
          endTime: 1100,
          recurrence: { type: 'none', date: 20261110 },
        },
      ];

      const listB = [
        {
          id: 'ev2',
          title: 'Estudio',
          category: 'Biblioteca',
          startTime: 900,
          endTime: 1100,
          recurrence: { type: 'none', date: 20261110 },
        },
        {
          id: 'ev1',
          title: 'Gym',
          category: 'Deporte',
          startTime: 1800,
          endTime: 1900,
          recurrence: { type: 'weekly', exceptions: [20261102, 20261109] }, // different exception order!
        },
      ];

      assert.equal(areCustomEventsEquivalent(listA, listB), true);
    });

    test('detects differences in titles, times or exceptions', () => {
      const listA = [{ id: 'ev1', title: 'Gym', startTime: 1800, endTime: 1900 }];
      const listB = [{ id: 'ev1', title: 'Gym', startTime: 1830, endTime: 1930 }];
      assert.equal(areCustomEventsEquivalent(listA, listB), false);
    });
  });

  describe('areLessonOverridesEquivalent', () => {
    test('recognizes identical overrides maps', () => {
      const ovA = {
        '20261109_100': {
          lessonKey: '20261109_100',
          userCancelled: true,
          customRooms: ['Aula 1', 'Aula 2'],
        },
      };
      const ovB = {
        '20261109_100': {
          lessonKey: '20261109_100',
          userCancelled: true,
          customRooms: ['Aula 2', 'Aula 1'], // different order, normalized
        },
      };
      assert.equal(areLessonOverridesEquivalent(ovA, ovB), true);
    });

    test('detects differences in cancellation or custom values', () => {
      const ovA = { '20261109_100': { userCancelled: true } };
      const ovB = { '20261109_100': { userCancelled: false } };
      assert.equal(areLessonOverridesEquivalent(ovA, ovB), false);
    });
  });

  describe('mergeCustomEvents', () => {
    test('merges disjoint events from local and cloud without losing any', () => {
      const local = [{ id: 'local_1', title: 'Evento Local' }];
      const cloud = [{ id: 'cloud_1', title: 'Evento Cloud' }];

      const merged = mergeCustomEvents(local, cloud);
      assert.equal(merged.length, 2);
      assert.ok(merged.find(e => e.id === 'local_1'));
      assert.ok(merged.find(e => e.id === 'cloud_1'));
    });

    test('resolves conflicts by updatedAt and combines recurrence exceptions', () => {
      const local = [
        {
          id: 'shared_event',
          title: 'Título Editado Localmente',
          startTime: 1000,
          endTime: 1100,
          updatedAt: 2000, // Winner!
          recurrence: {
            type: 'weekly',
            daysOfWeek: [1],
            exceptions: [20261109],
          },
        },
      ];
      const cloud = [
        {
          id: 'shared_event',
          title: 'Título Antiguo en Cloud',
          startTime: 1000,
          endTime: 1100,
          updatedAt: 1000,
          recurrence: {
            type: 'weekly',
            daysOfWeek: [1],
            exceptions: [20261116], // Exception added on other device!
          },
        },
      ];

      const merged = mergeCustomEvents(local, cloud);
      assert.equal(merged.length, 1);
      const winner = merged[0];
      assert.equal(winner.title, 'Título Editado Localmente');
      // Crucial: both exceptions must be present in the merged result!
      assert.deepEqual(winner.recurrence.exceptions.sort(), [20261109, 20261116]);
    });
  });

  describe('mergeCustomCategories', () => {
    test('merges categories without case-insensitive duplicates and preserves formatting', () => {
      const local = ['Estudio', 'Gimnasio', 'PROYECTO'];
      const cloud = ['Estudio', 'Trabajo', 'proyecto'];

      const merged = mergeCustomCategories(local, cloud);
      assert.deepEqual(merged, ['Estudio', 'Trabajo', 'proyecto', 'Gimnasio']);
    });
  });

  describe('mergeLessonOverrides', () => {
    test('merges disjoint overrides without losing any', () => {
      const local = { '20261109_1': { lessonKey: '20261109_1', userCancelled: true } };
      const cloud = { '20261109_2': { lessonKey: '20261109_2', customStartTime: 900 } };

      const merged = mergeLessonOverrides(local, cloud);
      assert.equal(Object.keys(merged).length, 2);
      assert.equal(merged['20261109_1'].userCancelled, true);
      assert.equal(merged['20261109_2'].customStartTime, 900);
    });

    test('resolves conflict on same lesson by highest updatedAt timestamp', () => {
      const local = {
        '20261109_1': {
          lessonKey: '20261109_1',
          customRooms: ['Aula Nueva Local'],
          updatedAt: 5000, // Winner
        },
      };
      const cloud = {
        '20261109_1': {
          lessonKey: '20261109_1',
          customRooms: ['Aula Vieja Cloud'],
          updatedAt: 3000,
        },
      };

      const merged = mergeLessonOverrides(local, cloud);
      assert.equal(merged['20261109_1'].customRooms[0], 'Aula Nueva Local');
    });
  });

  describe('mergeConfigs resilience', () => {
    test('deduplicates identical configs and generates unique names for new ones', () => {
      const cloud = [
        { id: 'cfg_1', name: 'Grado Informática', selectedGroups: [{ id: 10 }] },
      ];
      const local = [
        { id: 'cfg_1_dup', name: 'Grado Informática', selectedGroups: [{ id: 10 }] }, // duplicate content -> skip
        { id: 'cfg_2', name: 'Grado Informática', selectedGroups: [{ id: 20 }] },     // same name, different groups -> rename!
      ];

      const { configs } = mergeConfigs(local, cloud, 'cfg_1');
      assert.equal(configs.length, 2);
      assert.equal(configs[0].name, 'Grado Informática');
      assert.equal(configs[1].name, 'Grado Informática (1)');
      assert.notEqual(configs[0].id, configs[1].id);
    });
  });
});
