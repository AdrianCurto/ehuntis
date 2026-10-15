/**
 * Utilities for cloud configuration synchronization, conflict detection,
 * and smart merging between local and cloud configurations.
 */

/**
 * Checks whether the given configuration array contains non-trivial custom data.
 * A pristine/default installation (e.g. 1 configuration with 0 selected groups,
 * default name 'Configuración 1', no disabled subjects) returns false.
 */
function hasLocalCustomData(configs) {
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
 * Compares names, selected groups, disabled preferences, and custom colors without
 * being affected by random ID differences.
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
 * Merges local and cloud configurations without losing any user data.
 * - Preserves all cloud configurations (their IDs and names).
 * - Appends local configurations that are not 100% identical.
 * - If a local configuration has the same name as an existing one,
 *   appends (1), (2), etc. like Windows duplicate file naming.
 * - Guarantees unique configuration IDs.
 *
 * @param {Array} localConfigs
 * @param {Array} cloudConfigs
 * @param {string} cloudActiveId
 * @returns {{ configs: Array, activeConfigId: string }}
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

    // Skip if it's an exact duplicate of an existing cloud configuration
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

  // If merged turned out empty (should not happen), create fallback
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

  // Active config ID: prefer cloud active ID if still in merged, else first config ID
  let activeConfigId = cloudActiveId;
  if (!activeConfigId || !merged.some(c => c.id === activeConfigId)) {
    activeConfigId = merged[0].id;
  }

  return { configs: merged, activeConfigId };
}

module.exports = {
  hasLocalCustomData,
  areConfigsEquivalent,
  mergeConfigs,
};
