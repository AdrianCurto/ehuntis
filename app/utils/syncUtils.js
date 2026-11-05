/**
 * Utilities for cloud configuration synchronization, conflict detection,
 * and smart merging between local and cloud configurations and custom events.
 */

/**
 * Checks whether the given configuration array or custom events contain non-trivial custom data.
 * A pristine/default installation (e.g. 1 configuration with 0 selected groups,
 * default name 'Configuración 1', no disabled subjects, no custom events) returns false.
 */
function hasLocalCustomData(configs, customEvents = []) {
  if (Array.isArray(customEvents) && customEvents.length > 0) return true;
  if (!Array.isArray(configs) || configs.length === 0) return false;

  // More than 1 configuration means the user has organized multiple profiles
  if (configs.length > 1) return true;

  const cfg = configs[0];
  if (!cfg || typeof cfg !== 'object') return false;

  // Has selected any groups
  if (Array.isArray(cfg.selectedGroups) && cfg.selectedGroups.length > 0) return true;

  // Has renamed the default configuration
  if (cfg.name && cfg.name.trim() !== 'Configuración 1') return true;

  // Has disabled any groups or subjects
  if (Array.isArray(cfg.disabledGroupIds) && cfg.disabledGroupIds.length > 0) return true;
  if (cfg.disabledSubjectsByGroup && Object.keys(cfg.disabledSubjectsByGroup).length > 0) return true;
  if (cfg.disabledSubgroupsBySubject && Object.keys(cfg.disabledSubgroupsBySubject).length > 0) return true;
  if (cfg.customColors && Object.keys(cfg.customColors).length > 0) return true;

  return false;
}

/**
 * Checks if two configuration arrays are structurally equivalent.
 * Compares names, selected groups, disabled preferences, and custom colors without
 * being affected by random ID differences.
 */
function normalizeConfigItem(c) {
  if (!c || typeof c !== 'object') return {};

  const normCustomColors = {};
  if (c.customColors && typeof c.customColors === 'object') {
    Object.keys(c.customColors).sort().forEach(k => {
      const idx = Number(c.customColors[k]);
      if (!isNaN(idx)) normCustomColors[String(k)] = idx;
    });
  }

  const normDisabledSubjs = {};
  if (c.disabledSubjectsByGroup && typeof c.disabledSubjectsByGroup === 'object') {
    Object.keys(c.disabledSubjectsByGroup).sort().forEach(k => {
      const arr = Array.isArray(c.disabledSubjectsByGroup[k]) ? c.disabledSubjectsByGroup[k] : [];
      normDisabledSubjs[String(k)] = arr.map(Number).sort((a, b) => a - b);
    });
  }

  const normDisabledSubgroups = {};
  if (c.disabledSubgroupsBySubject && typeof c.disabledSubgroupsBySubject === 'object') {
    Object.keys(c.disabledSubgroupsBySubject).sort().forEach(gKey => {
      const bySubj = c.disabledSubgroupsBySubject[gKey] || {};
      const sortedBySubj = {};
      Object.keys(bySubj).sort().forEach(sKey => {
        const arr = Array.isArray(bySubj[sKey]) ? bySubj[sKey] : [];
        sortedBySubj[String(sKey)] = arr.map(String).sort();
      });
      normDisabledSubgroups[String(gKey)] = sortedBySubj;
    });
  }

  return {
    name: (c.name || '').trim().toLowerCase(),
    selectedGroups: (c.selectedGroups || [])
      .map(g => String(g.uniqueId || g.id || g.name || ''))
      .sort(),
    disabledGroupIds: (c.disabledGroupIds || []).map(String).sort(),
    disabledSubjectsByGroup: normDisabledSubjs,
    disabledSubgroupsBySubject: normDisabledSubgroups,
    showDimmedSubgroups: Boolean(c.showDimmedSubgroups),
    customColors: normCustomColors,
  };
}

/**
 * Checks if two configuration arrays are structurally equivalent.
 */
function areConfigsEquivalent(cfgsA, cfgsB) {
  if (!Array.isArray(cfgsA) || !Array.isArray(cfgsB)) return false;
  if (cfgsA.length !== cfgsB.length) return false;

  const normalizeList = (list) => {
    return list
      .map(normalizeConfigItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return JSON.stringify(normalizeList(cfgsA)) === JSON.stringify(normalizeList(cfgsB));
}

/**
 * Checks if two custom events arrays are structurally equivalent.
 */
function areCustomEventsEquivalent(eventsA, eventsB) {
  if (!Array.isArray(eventsA) || !Array.isArray(eventsB)) return false;
  if (eventsA.length !== eventsB.length) return false;

  const normalizeEvent = (e) => {
    if (!e || typeof e !== 'object') return {};
    return {
      id: String(e.id || ''),
      title: (e.title || '').trim(),
      category: (e.category || '').trim(),
      startTime: Number(e.startTime),
      endTime: Number(e.endTime),
      location: (e.location || '').trim(),
      notes: (e.notes || '').trim(),
      colorIndex: Number(e.colorIndex),
      recurrence: e.recurrence ? {
        type: e.recurrence.type,
        date: e.recurrence.date,
        daysOfWeek: Array.isArray(e.recurrence.daysOfWeek) ? [...e.recurrence.daysOfWeek].sort() : [],
        startDate: e.recurrence.startDate,
        endDate: e.recurrence.endDate,
        exceptions: Array.isArray(e.recurrence.exceptions) ? [...e.recurrence.exceptions].sort() : [],
      } : null,
    };
  };

  const normA = eventsA.map(normalizeEvent).sort((a, b) => a.id.localeCompare(b.id));
  const normB = eventsB.map(normalizeEvent).sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify(normA) === JSON.stringify(normB);
}

/**
 * Checks if two category lists are equivalent.
 */
function areCustomCategoriesEquivalent(catsA, catsB) {
  const normA = (Array.isArray(catsA) ? catsA : []).map(c => String(c).trim().toLowerCase()).sort();
  const normB = (Array.isArray(catsB) ? catsB : []).map(c => String(c).trim().toLowerCase()).sort();
  return JSON.stringify(normA) === JSON.stringify(normB);
}

/**
 * Merges local and cloud configurations without losing any user data.
 */
function mergeConfigs(localConfigs, cloudConfigs, cloudActiveId) {
  const merged = [];
  const existingIds = new Set();
  const existingNames = new Set();

  const safeCloud = Array.isArray(cloudConfigs) ? cloudConfigs : [];
  const safeLocal = Array.isArray(localConfigs) ? localConfigs : [];

  // 1. Insert all cloud configurations first
  for (const c of safeCloud) {
    if (!c || typeof c !== 'object') continue;
    const cloned = JSON.parse(JSON.stringify(c));
    merged.push(cloned);
    if (cloned.id) existingIds.add(cloned.id);
    if (cloned.name) existingNames.add(cloned.name.trim().toLowerCase());
  }

  // 2. Helper: check if a local config is already identical to one in merged
  const isDuplicateOfExisting = (localCfg) => {
    const normLocal = JSON.stringify(normalizeConfigItem(localCfg));
    return merged.some(m => JSON.stringify(normalizeConfigItem(m)) === normLocal);
  };

  // 3. Helper: generate unique name like Windows duplicate files: "Nombre (1)"
  const getUniqueName = (baseName) => {
    const raw = (baseName || 'Configuración').trim();
    if (!existingNames.has(raw.toLowerCase())) {
      return raw;
    }

    const match = raw.match(/^(.*?)\s*\((\d+)\)$/);
    let root = raw;
    let counter = 1;
    if (match) {
      root = match[1].trim();
      counter = parseInt(match[2], 10) + 1;
    }

    while (existingNames.has(`${root} (${counter})`.toLowerCase())) {
      counter++;
    }
    return `${root} (${counter})`;
  };

  // 4. Helper: generate unique config ID
  const getUniqueId = (baseId) => {
    let id = baseId;
    while (!id || existingIds.has(id)) {
      id = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }
    return id;
  };

  // 5. Add local configs that add new/different information
  for (const localCfg of safeLocal) {
    if (!localCfg || typeof localCfg !== 'object') continue;

    if (isDuplicateOfExisting(localCfg)) {
      continue;
    }

    const cloned = JSON.parse(JSON.stringify(localCfg));
    const newName = getUniqueName(cloned.name);
    const newId = getUniqueId(cloned.id);

    cloned.id = newId;
    cloned.name = newName;

    merged.push(cloned);
    existingIds.add(newId);
    existingNames.add(newName.trim().toLowerCase());
  }

  if (merged.length === 0) {
    merged.push({
      id: `cfg_${Date.now()}`,
      name: 'Configuración 1',
      selectedGroups: [],
      disabledGroupIds: [],
      disabledSubjectsByGroup: {},
      disabledSubgroupsBySubject: {},
      showDimmedSubgroups: false,
      customColors: {},
    });
  }

  let activeConfigId = cloudActiveId;
  if (!activeConfigId || !merged.some(c => c.id === activeConfigId)) {
    activeConfigId = merged[0].id;
  }

  return { configs: merged, activeConfigId };
}

/**
 * Merges local and cloud custom events without losing any events or exception dates.
 */
function mergeCustomEvents(localEvents = [], cloudEvents = []) {
  const safeLocal = Array.isArray(localEvents) ? localEvents : [];
  const safeCloud = Array.isArray(cloudEvents) ? cloudEvents : [];

  const map = new Map();

  for (const ce of safeCloud) {
    if (ce && ce.id) {
      map.set(ce.id, { ...ce });
    }
  }

  for (const le of safeLocal) {
    if (!le || !le.id) continue;
    if (!map.has(le.id)) {
      map.set(le.id, { ...le });
    } else {
      const existing = map.get(le.id);
      const localUpdated = Number(le.updatedAt || le.createdAt || 0);
      const cloudUpdated = Number(existing.updatedAt || existing.createdAt || 0);

      const cloudExceptions = existing.recurrence?.exceptions || [];
      const localExceptions = le.recurrence?.exceptions || [];
      const combinedExceptions = Array.from(new Set([...cloudExceptions, ...localExceptions]));

      const winner = localUpdated > cloudUpdated ? { ...le } : { ...existing };
      if (winner.recurrence) {
        winner.recurrence = {
          ...winner.recurrence,
          exceptions: combinedExceptions,
        };
      }
      map.set(le.id, winner);
    }
  }

  return Array.from(map.values());
}

/**
 * Merges local and cloud custom categories.
 */
function mergeCustomCategories(localCats = [], cloudCats = []) {
  const safeLocal = Array.isArray(localCats) ? localCats : [];
  const safeCloud = Array.isArray(cloudCats) ? cloudCats : [];
  const set = new Set();
  const result = [];

  for (const c of [...safeCloud, ...safeLocal]) {
    const trimmed = String(c || '').trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!set.has(lower)) {
      set.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

module.exports = {
  hasLocalCustomData,
  areConfigsEquivalent,
  areCustomEventsEquivalent,
  areCustomCategoriesEquivalent,
  mergeConfigs,
  mergeCustomEvents,
  mergeCustomCategories,
};
