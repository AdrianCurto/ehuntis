const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  EVENTS_VIEW_PREFS_KEY,
  DEFAULT_SORT_BY,
  DEFAULT_HIDE_PAST,
  loadStoredEventsViewPrefs,
  saveStoredEventsViewPrefs,
} = require('../../app/utils/eventsViewPrefs');

function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    _getRaw: (key) => store.get(key),
  };
}

describe('eventsViewPrefs test suite', () => {
  describe('loadStoredEventsViewPrefs', () => {
    it('returns default preferences when storage is null or undefined', () => {
      const prefs = loadStoredEventsViewPrefs(null);
      assert.deepEqual(prefs, {
        sortBy: DEFAULT_SORT_BY,
        hidePast: DEFAULT_HIDE_PAST,
      });
    });

    it('returns default preferences when key does not exist in storage', () => {
      const storage = createMockStorage();
      const prefs = loadStoredEventsViewPrefs(storage);
      assert.deepEqual(prefs, {
        sortBy: 'date-asc',
        hidePast: false,
      });
    });

    it('returns default preferences when JSON in storage is malformed', () => {
      const storage = createMockStorage({
        [EVENTS_VIEW_PREFS_KEY]: '{ invalid json ...',
      });
      const prefs = loadStoredEventsViewPrefs(storage);
      assert.deepEqual(prefs, {
        sortBy: 'date-asc',
        hidePast: false,
      });
    });

    it('sanitizes invalid sortBy and non-boolean hidePast', () => {
      const storage = createMockStorage({
        [EVENTS_VIEW_PREFS_KEY]: JSON.stringify({
          sortBy: 'hacker-order',
          hidePast: 'true', // string, not boolean
        }),
      });
      const prefs = loadStoredEventsViewPrefs(storage);
      assert.strictEqual(prefs.sortBy, 'date-asc');
      assert.strictEqual(prefs.hidePast, false);
    });

    it('loads valid preferences accurately', () => {
      const storage = createMockStorage({
        [EVENTS_VIEW_PREFS_KEY]: JSON.stringify({
          sortBy: 'title-asc',
          hidePast: true,
        }),
      });
      const prefs = loadStoredEventsViewPrefs(storage);
      assert.deepEqual(prefs, {
        sortBy: 'title-asc',
        hidePast: true,
      });
    });
  });

  describe('saveStoredEventsViewPrefs', () => {
    it('saves valid preferences into storage', () => {
      const storage = createMockStorage();
      const ok = saveStoredEventsViewPrefs(
        { sortBy: 'date-desc', hidePast: true },
        storage
      );
      assert.strictEqual(ok, true);

      const savedRaw = storage._getRaw(EVENTS_VIEW_PREFS_KEY);
      assert.ok(savedRaw);
      const parsed = JSON.parse(savedRaw);
      assert.deepEqual(parsed, {
        sortBy: 'date-desc',
        hidePast: true,
      });
    });

    it('preserves existing settings when updating only one property', () => {
      const storage = createMockStorage({
        [EVENTS_VIEW_PREFS_KEY]: JSON.stringify({
          sortBy: 'type',
          hidePast: true,
        }),
      });

      saveStoredEventsViewPrefs({ sortBy: 'title-asc' }, storage);

      const prefs = loadStoredEventsViewPrefs(storage);
      assert.deepEqual(prefs, {
        sortBy: 'title-asc',
        hidePast: true,
      });
    });

    it('returns false gracefully when storage throws (e.g., quota exceeded)', () => {
      const throwingStorage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };
      const ok = saveStoredEventsViewPrefs({ sortBy: 'date-desc' }, throwingStorage);
      assert.strictEqual(ok, false);
    });
  });
});
