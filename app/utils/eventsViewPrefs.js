/**
 * Utilidades para la persistencia y saneamiento de preferencias de visualización
 * en la pestaña de Eventos y Cambios de Ajustes.
 */

const EVENTS_VIEW_PREFS_KEY = 'ehuntis_events_view_prefs';

const VALID_SORT_IDS = ['date-asc', 'date-desc', 'title-asc', 'type'];
const DEFAULT_SORT_BY = 'date-asc';
const DEFAULT_HIDE_PAST = false;

const DEFAULT_EVENTS_VIEW_PREFS = Object.freeze({
  sortBy: DEFAULT_SORT_BY,
  hidePast: DEFAULT_HIDE_PAST,
});

/**
 * Carga y sanea las preferencias guardadas en localStorage.
 * @param {Storage|null} [storage] - Objeto Storage opcional (por defecto window.localStorage si existe)
 * @returns {{ sortBy: string, hidePast: boolean }}
 */
function loadStoredEventsViewPrefs(storage) {
  const targetStorage = storage !== undefined
    ? storage
    : (typeof window !== 'undefined' ? window.localStorage : null);

  if (!targetStorage) {
    return { ...DEFAULT_EVENTS_VIEW_PREFS };
  }

  try {
    const raw = targetStorage.getItem(EVENTS_VIEW_PREFS_KEY);
    if (!raw) {
      return { ...DEFAULT_EVENTS_VIEW_PREFS };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_EVENTS_VIEW_PREFS };
    }

    const sortBy = VALID_SORT_IDS.includes(parsed.sortBy)
      ? parsed.sortBy
      : DEFAULT_SORT_BY;

    const hidePast = typeof parsed.hidePast === 'boolean'
      ? parsed.hidePast
      : DEFAULT_HIDE_PAST;

    return { sortBy, hidePast };
  } catch (_) {
    return { ...DEFAULT_EVENTS_VIEW_PREFS };
  }
}

/**
 * Guarda las preferencias de visualización en localStorage.
 * @param {{ sortBy?: string, hidePast?: boolean }} prefs
 * @param {Storage|null} [storage] - Objeto Storage opcional
 * @returns {boolean} True si se guardó con éxito, false en caso contrario
 */
function saveStoredEventsViewPrefs(prefs, storage) {
  const targetStorage = storage !== undefined
    ? storage
    : (typeof window !== 'undefined' ? window.localStorage : null);

  if (!targetStorage) return false;

  try {
    const current = loadStoredEventsViewPrefs(targetStorage);
    const updated = {
      sortBy: VALID_SORT_IDS.includes(prefs?.sortBy) ? prefs.sortBy : current.sortBy,
      hidePast: typeof prefs?.hidePast === 'boolean' ? prefs.hidePast : current.hidePast,
    };
    targetStorage.setItem(EVENTS_VIEW_PREFS_KEY, JSON.stringify(updated));
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  EVENTS_VIEW_PREFS_KEY,
  VALID_SORT_IDS,
  DEFAULT_SORT_BY,
  DEFAULT_HIDE_PAST,
  DEFAULT_EVENTS_VIEW_PREFS,
  loadStoredEventsViewPrefs,
  saveStoredEventsViewPrefs,
};
