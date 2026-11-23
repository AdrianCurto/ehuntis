const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  WIDGETS_BANNER_STORAGE_KEY,
  WIDGETS_BANNER_DISMISSED_VALUE,
  isWidgetsBannerDismissed,
  dismissWidgetsBanner,
  shouldShowWidgetsBanner,
} = require('../../app/utils/widgetsBanner');

function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    _getRaw: (key) => store.get(key),
  };
}

describe('widgetsBanner test suite', () => {
  it('usa la clave versionada esperada', () => {
    assert.equal(WIDGETS_BANNER_STORAGE_KEY, 'ehuntis_widgets_banner_v1');
    assert.equal(WIDGETS_BANNER_DISMISSED_VALUE, 'dismissed');
  });

  describe('isWidgetsBannerDismissed', () => {
    it('devuelve true si storage es null (SSR o sin storage)', () => {
      assert.equal(isWidgetsBannerDismissed(null), true);
    });

    it('devuelve false cuando no hay valor guardado', () => {
      const storage = createMockStorage();
      assert.equal(isWidgetsBannerDismissed(storage), false);
    });

    it('devuelve false cuando el valor guardado no es dismissed', () => {
      const storage = createMockStorage({
        [WIDGETS_BANNER_STORAGE_KEY]: 'visible',
      });
      assert.equal(isWidgetsBannerDismissed(storage), false);
    });

    it('devuelve true cuando el valor guardado es dismissed', () => {
      const storage = createMockStorage({
        [WIDGETS_BANNER_STORAGE_KEY]: 'dismissed',
      });
      assert.equal(isWidgetsBannerDismissed(storage), true);
    });

    it('devuelve false sin lanzar si storage.getItem falla', () => {
      const brokenStorage = {
        getItem: () => {
          throw new Error('Quota or security error');
        },
      };
      assert.equal(isWidgetsBannerDismissed(brokenStorage), false);
    });
  });

  describe('dismissWidgetsBanner', () => {
    it('guarda dismissed en la clave correcta y devuelve true', () => {
      const storage = createMockStorage();
      const result = dismissWidgetsBanner(storage);
      assert.equal(result, true);
      assert.equal(storage._getRaw(WIDGETS_BANNER_STORAGE_KEY), 'dismissed');
      assert.equal(isWidgetsBannerDismissed(storage), true);
    });

    it('devuelve false si storage es null o lanza al escribir', () => {
      assert.equal(dismissWidgetsBanner(null), false);
      const brokenStorage = {
        setItem: () => {
          throw new Error('Write blocked');
        },
      };
      assert.equal(dismissWidgetsBanner(brokenStorage), false);
    });
  });

  describe('shouldShowWidgetsBanner', () => {
    it('solo devuelve true cuando hay horario, no hay swap activo y no fue descartado', () => {
      assert.equal(
        shouldShowWidgetsBanner({
          hasSchedule: true,
          isSwapModeActive: false,
          isDismissed: false,
        }),
        true
      );
    });

    it('devuelve false si no hay horario configurado', () => {
      assert.equal(
        shouldShowWidgetsBanner({
          hasSchedule: false,
          isSwapModeActive: false,
          isDismissed: false,
        }),
        false
      );
    });

    it('devuelve false mientras el modo intercambio está activo', () => {
      assert.equal(
        shouldShowWidgetsBanner({
          hasSchedule: true,
          isSwapModeActive: true,
          isDismissed: false,
        }),
        false
      );
    });

    it('devuelve false si ya fue descartado', () => {
      assert.equal(
        shouldShowWidgetsBanner({
          hasSchedule: true,
          isSwapModeActive: false,
          isDismissed: true,
        }),
        false
      );
    });
  });
});
