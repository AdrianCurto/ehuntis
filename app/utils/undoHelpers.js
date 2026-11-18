/**
 * Utilidades puras para capturar y restaurar snapshots de acciones destructivas (Undo).
 * Todas las funciones operan sobre copias inmutables para evitar cierres obsoletos o
 * mutaciones accidentales en React 19.
 */

const {
  findOverrideEntry,
  getLessonKey,
  removeLessonOverride,
} = require('./lessonOverrides');
const { deleteCustomEventInstance } = require('./customEvents');

function cloneDeep(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Captura el override de una clase (y de su pareja de swap si existe) y devuelve el mapa limpio.
 */
function captureLessonOverrideRemoval(currentOverrides = {}, lessonOrKey) {
  if (!currentOverrides || typeof currentOverrides !== 'object' || !lessonOrKey) {
    return { removedEntries: null, nextOverrides: currentOverrides || {} };
  }

  const found =
    typeof lessonOrKey === 'object' && lessonOrKey
      ? findOverrideEntry(currentOverrides, lessonOrKey)
      : null;

  const key =
    typeof lessonOrKey === 'string'
      ? lessonOrKey
      : found?.key || lessonOrKey.lessonKey || getLessonKey(lessonOrKey);

  const partnerKey =
    (typeof lessonOrKey === 'object' && lessonOrKey?.swappedWith?.lessonKey) ||
    currentOverrides[key]?.swappedWith?.lessonKey;

  const removedEntries = {};
  if (key && currentOverrides[key]) {
    removedEntries[key] = cloneDeep(currentOverrides[key]);
  }
  if (partnerKey && currentOverrides[partnerKey]) {
    removedEntries[partnerKey] = cloneDeep(currentOverrides[partnerKey]);
  }

  if (Object.keys(removedEntries).length === 0) {
    return { removedEntries: null, nextOverrides: currentOverrides };
  }

  let nextOverrides = removeLessonOverride(currentOverrides, key);
  if (partnerKey && nextOverrides[partnerKey]) {
    nextOverrides = removeLessonOverride(nextOverrides, partnerKey);
  }

  return { removedEntries, nextOverrides };
}

/**
 * Restaura uno o varios overrides de clase previamente eliminados.
 */
function restoreLessonOverrideEntries(currentOverrides = {}, removedEntries, now = Date.now()) {
  if (!removedEntries || typeof removedEntries !== 'object' || Object.keys(removedEntries).length === 0) {
    return null;
  }

  const restored = { ...(currentOverrides || {}) };
  for (const [key, entry] of Object.entries(removedEntries)) {
    if (entry && typeof entry === 'object') {
      restored[key] = { ...cloneDeep(entry), updatedAt: now };
    }
  }
  return restored;
}

/**
 * Captura el snapshot exacto de un evento personalizado antes de eliminar una instancia o toda la serie.
 */
function captureCustomEventRemoval(currentEvents = [], eventId, dateNum, mode) {
  const list = Array.isArray(currentEvents) ? currentEvents : [];
  const index = list.findIndex((e) => e && e.id === eventId);
  if (index === -1) {
    return { snapshot: null, nextEvents: list };
  }

  const target = list[index];
  const isWeekly = target.recurrence?.type === 'weekly';
  const nextEvents = deleteCustomEventInstance(list, eventId, dateNum, mode);

  return {
    snapshot: {
      event: cloneDeep(target),
      index,
      mode,
      isWeekly,
    },
    nextEvents,
  };
}

/**
 * Restaura un evento personalizado eliminado (ya sea reinsertando la serie o revirtiendo la excepción puntual).
 */
function restoreCustomEventSnapshot(currentEvents = [], snapshot, now = Date.now()) {
  if (!snapshot || !snapshot.event || !snapshot.event.id) {
    return null;
  }

  const list = Array.isArray(currentEvents) ? [...currentEvents] : [];
  const restoredEvent = {
    ...cloneDeep(snapshot.event),
    updatedAt: now,
  };

  const existingIndex = list.findIndex((e) => e && e.id === restoredEvent.id);
  if (existingIndex !== -1) {
    list[existingIndex] = restoredEvent;
    return list;
  }

  const insertIndex = Math.max(0, Math.min(snapshot.index ?? list.length, list.length));
  list.splice(insertIndex, 0, restoredEvent);
  return list;
}

/**
 * Captura un grupo y todos sus filtros de asignaturas/subgrupos antes de eliminarlo de la configuración activa.
 */
function captureGroupRemoval(config, group, key) {
  if (!config || !group) {
    return { snapshot: null, nextConfig: config };
  }

  const selectedGroups = Array.isArray(config.selectedGroups) ? config.selectedGroups : [];
  const index = selectedGroups.findIndex((x) => x.id === group.id);
  if (index === -1) {
    return { snapshot: null, nextConfig: config };
  }

  const disabledGroupIds = Array.isArray(config.disabledGroupIds) ? config.disabledGroupIds : [];
  const disabledSubjectsByGroup = config.disabledSubjectsByGroup || {};
  const disabledSubgroupsBySubject = config.disabledSubgroupsBySubject || {};

  const snapshot = {
    group: cloneDeep(selectedGroups[index]),
    index,
    key,
    wasDisabled: disabledGroupIds.includes(key),
    disabledSubjects: key in disabledSubjectsByGroup ? cloneDeep(disabledSubjectsByGroup[key]) : undefined,
    disabledSubgroups: key in disabledSubgroupsBySubject ? cloneDeep(disabledSubgroupsBySubject[key]) : undefined,
  };

  const nextDisabledSubjs = { ...disabledSubjectsByGroup };
  delete nextDisabledSubjs[key];
  const nextDisabledSubgroups = { ...disabledSubgroupsBySubject };
  delete nextDisabledSubgroups[key];

  const nextConfig = {
    ...config,
    selectedGroups: selectedGroups.filter((x) => x.id !== group.id),
    disabledGroupIds: disabledGroupIds.filter((id) => id !== key),
    disabledSubjectsByGroup: nextDisabledSubjs,
    disabledSubgroupsBySubject: nextDisabledSubgroups,
  };

  return { snapshot, nextConfig };
}

/**
 * Restaura un grupo eliminado junto con su estado de visibilidad y filtros de asignaturas/subgrupos.
 */
function restoreGroupSnapshot(currentConfig, snapshot) {
  if (!currentConfig || !snapshot || !snapshot.group) {
    return currentConfig;
  }

  const selectedGroups = Array.isArray(currentConfig.selectedGroups)
    ? [...currentConfig.selectedGroups]
    : [];
  const alreadyPresent = selectedGroups.some((x) => x.id === snapshot.group.id);
  if (!alreadyPresent) {
    const insertIndex = Math.max(0, Math.min(snapshot.index ?? selectedGroups.length, selectedGroups.length));
    selectedGroups.splice(insertIndex, 0, cloneDeep(snapshot.group));
  }

  const disabledGroupIds = Array.isArray(currentConfig.disabledGroupIds)
    ? [...currentConfig.disabledGroupIds]
    : [];
  if (snapshot.wasDisabled && !disabledGroupIds.includes(snapshot.key)) {
    disabledGroupIds.push(snapshot.key);
  }

  const disabledSubjectsByGroup = { ...(currentConfig.disabledSubjectsByGroup || {}) };
  if (snapshot.disabledSubjects !== undefined) {
    disabledSubjectsByGroup[snapshot.key] = cloneDeep(snapshot.disabledSubjects);
  }

  const disabledSubgroupsBySubject = { ...(currentConfig.disabledSubgroupsBySubject || {}) };
  if (snapshot.disabledSubgroups !== undefined) {
    disabledSubgroupsBySubject[snapshot.key] = cloneDeep(snapshot.disabledSubgroups);
  }

  return {
    ...currentConfig,
    selectedGroups,
    disabledGroupIds,
    disabledSubjectsByGroup,
    disabledSubgroupsBySubject,
  };
}

/**
 * Captura una configuración (horario completo) antes de eliminarla, incluyendo si se creó un fallback vacío.
 */
function captureConfigRemoval(configs = [], activeConfigId, targetId, createDefaultConfigFn) {
  const list = Array.isArray(configs) ? configs : [];
  const index = list.findIndex((c) => c && c.id === targetId);
  if (index === -1) {
    return { snapshot: null, nextConfigs: list, nextActiveConfigId: activeConfigId };
  }

  const deletedConfig = cloneDeep(list[index]);
  const remaining = list.filter((c) => c.id !== targetId);

  if (remaining.length === 0) {
    const fallback = typeof createDefaultConfigFn === 'function'
      ? createDefaultConfigFn()
      : { id: 'default_fallback', name: 'Mi horario', selectedGroups: [] };
    return {
      snapshot: {
        deletedConfig,
        index,
        previousActiveConfigId: activeConfigId,
        createdFallbackId: fallback.id,
      },
      nextConfigs: [fallback],
      nextActiveConfigId: fallback.id,
    };
  }

  const nextActiveConfigId = activeConfigId === targetId ? remaining[0].id : activeConfigId;

  return {
    snapshot: {
      deletedConfig,
      index,
      previousActiveConfigId: activeConfigId,
      createdFallbackId: null,
    },
    nextConfigs: remaining,
    nextActiveConfigId,
  };
}

/**
 * Restaura una configuración eliminada, retirando el fallback vacío temporal si se creó uno.
 */
function restoreConfigSnapshot(currentConfigs = [], snapshot) {
  if (!snapshot || !snapshot.deletedConfig) {
    return null;
  }

  let list = Array.isArray(currentConfigs) ? [...currentConfigs] : [];

  if (snapshot.createdFallbackId) {
    list = list.filter((c) => {
      if (!c || c.id !== snapshot.createdFallbackId) return true;
      const isUntouchedEmpty =
        (!c.selectedGroups || c.selectedGroups.length === 0) &&
        (!c.customColors || Object.keys(c.customColors).length === 0);
      return !isUntouchedEmpty;
    });
  }

  if (!list.some((c) => c && c.id === snapshot.deletedConfig.id)) {
    const insertIndex = Math.max(0, Math.min(snapshot.index ?? list.length, list.length));
    list.splice(insertIndex, 0, cloneDeep(snapshot.deletedConfig));
  }

  return {
    nextConfigs: list,
    nextActiveConfigId: snapshot.previousActiveConfigId || snapshot.deletedConfig.id,
  };
}

/**
 * Captura el mapa de colores personalizados de asignaturas antes de restablecerlo.
 */
function captureCustomColorsReset(config) {
  const current = config?.customColors && typeof config.customColors === 'object'
    ? config.customColors
    : {};
  if (Object.keys(current).length === 0) {
    return { previousColors: null, nextConfig: config };
  }
  return {
    previousColors: cloneDeep(current),
    nextConfig: {
      ...config,
      customColors: {},
    },
  };
}

/**
 * Restaura el mapa de colores personalizados de asignaturas.
 */
function restoreCustomColorsSnapshot(currentConfig, previousColors) {
  if (!currentConfig || !previousColors || typeof previousColors !== 'object') {
    return currentConfig;
  }
  return {
    ...currentConfig,
    customColors: {
      ...(currentConfig.customColors || {}),
      ...cloneDeep(previousColors),
    },
  };
}

module.exports = {
  captureLessonOverrideRemoval,
  restoreLessonOverrideEntries,
  captureCustomEventRemoval,
  restoreCustomEventSnapshot,
  captureGroupRemoval,
  restoreGroupSnapshot,
  captureConfigRemoval,
  restoreConfigSnapshot,
  captureCustomColorsReset,
  restoreCustomColorsSnapshot,
};
