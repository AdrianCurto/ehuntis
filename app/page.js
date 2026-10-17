'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { extractSubgroupNumber, extractSubgroupKey } from './utils/subgroups';
import { useTheme } from './utils/useTheme';
import { hasLocalCustomData, areConfigsEquivalent, mergeConfigs } from './utils/syncUtils';
import {
  getResolvedTargetDate,
  getAcademicYearBounds,
  toDateNumber,
  getDynamicWeekDates,
  getWeekMonday,
  getNextDayContextual,
  getPrevDayContextual,
} from './utils/dayLogic';
import { resolveSubjectColors, swapSubjectColor } from './utils/colorLogic';
import { Settings as SettingsIcon, Calendar as CalendarIcon, User as UserIcon, CalendarSearch, Plus } from 'lucide-react';
import posthog from 'posthog-js';
import {
  getStoredCustomEvents,
  saveStoredCustomEvents,
  expandCustomEventsForDates,
  deleteCustomEventInstance,
  saveCustomEventInstance,
  suggestEventColor,
} from './utils/customEvents';

const WeekCalendar = dynamic(() => import('./components/WeekCalendar'), { ssr: false });
const WeekHeader = dynamic(() => import('./components/WeekHeader'), { ssr: false });
const LessonModal = dynamic(() => import('./components/LessonModal'), { ssr: false });
const CustomEventModal = dynamic(() => import('./components/CustomEventModal'), { ssr: false });
const CustomEventDetailModal = dynamic(() => import('./components/CustomEventDetailModal'), { ssr: false });
const GroupSearch = dynamic(() => import('./components/GroupSearch'), { ssr: false });
const SettingsView = dynamic(() => import('./components/SettingsView'), { ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView'), { ssr: false });
const LAST_TIMETABLE_CACHE_KEY = 'ehuntis_timetable_last_v3';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}


function readStoredJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function getInitialSemesterTimetable(cfgs, activeId) {
  if (typeof window === 'undefined') return [];
  try {
    const list = Array.isArray(cfgs) && cfgs.length > 0 ? cfgs : getInitialConfigs();
    const id = activeId || getInitialActiveConfigId(list);
    const activeCfg = list.find(c => c.id === id) || list[0];
    if (activeCfg) {
      const activeGroups = (activeCfg.selectedGroups || []).filter(
        g => !(activeCfg.disabledGroupIds || []).includes(String(g.uniqueId || g.id))
      );
      if (activeGroups.length > 0) {
        const today = new Date();
        const month = today.getMonth();
        const year = today.getFullYear();
        const startYear = month >= 7 ? year : year - 1;
        const startDate = new Date(startYear, 8, 1);
        const ids = activeGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).sort().join(',');
        const cacheKey = `ehuntis_timetable_cache_v3_${ids}_${startDate.getFullYear()}_${startDate.getMonth()}`;
        const cached = readStoredJson(cacheKey, null);
        if (Array.isArray(cached?.data)) {
          return cached.data;
        }
      }
    }
  } catch (_) {}
  const parsedLast = readStoredJson(LAST_TIMETABLE_CACHE_KEY, null);
  return Array.isArray(parsedLast?.data) ? parsedLast.data : [];
}

function parseDegreeAndLanguage(rawLongName, rawName) {
  let text = (rawLongName || rawName || '').trim();
  text = text.replace(/^[0-9A-Z]+-[0-9A-Z]+\s+/i, '').trim();

  const langRegex = /\s*\(?(Castellano|Euskera|Ingl[ée]s|Alem[aá]n|Franc[eé]s|Italiano|Ruso|[AÁ]rabe|Catal[aá]n|Gallego|Castellan|Castella|Ing)\)?\.?$/i;
  const match = text.match(langRegex);
  let language = 'Castellano';
  let degree = text;
  if (match) {
    const rawLang = match[1].toLowerCase().replace(/[()]/g, '');
    if (rawLang.startsWith('eusk')) language = 'Euskera';
    else if (rawLang.startsWith('ing')) language = 'Inglés';
    else if (rawLang.startsWith('cast')) language = 'Castellano';
    else if (rawLang.startsWith('alem')) language = 'Alemán';
    else if (rawLang.startsWith('franc')) language = 'Francés';
    else if (rawLang.startsWith('ital')) language = 'Italiano';
    else if (rawLang.startsWith('rus')) language = 'Ruso';
    else if (rawLang.startsWith('arab') || rawLang.startsWith('árab')) language = 'Árabe';
    else if (rawLang.startsWith('catal')) language = 'Catalán';
    else if (rawLang.startsWith('galleg')) language = 'Gallego';
    else language = match[1];

    degree = text.substring(0, match.index).trim();
  }
  return { degree, language };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const CONFIGS_STORAGE_KEY = 'ehuntis_configs_v3';
const ACTIVE_CONFIG_ID_STORAGE_KEY = 'ehuntis_active_config_id_v3';
const USERNAME_STORAGE_KEY = 'ehuntis_username_v1';

function createDefaultConfig(id = `cfg_${Date.now()}`, name = 'Configuración 1') {
  return {
    id,
    name,
    selectedGroups: [],
    disabledGroupIds: [],
    disabledSubjectsByGroup: {},
    disabledSubgroupsBySubject: {},
    showDimmedSubgroups: false,
    customColors: {},
  };
}

function getInitialConfigs() {
  const saved = readStoredJson(CONFIGS_STORAGE_KEY, null);
  if (Array.isArray(saved) && saved.length > 0) {
    return saved;
  }

  // Legacy migration from v2
  const legacyGroups = readStoredJson('ehuntis_groups_v2', null);
  const legacyDisabledSubjects = readStoredJson('ehuntis_disabled_v2', {});
  const legacyDisabledGroups = readStoredJson('ehuntis_disabled_groups_v2', []);

  if (Array.isArray(legacyGroups) && legacyGroups.length > 0) {
    const migrated = {
      id: `cfg_${Date.now()}`,
      name: 'Configuración 1',
      selectedGroups: legacyGroups,
      disabledGroupIds: legacyDisabledGroups || [],
      disabledSubjectsByGroup: legacyDisabledSubjects || {},
      disabledSubgroupsBySubject: {},
      showDimmedSubgroups: false,
    };
    return [migrated];
  }

  return [createDefaultConfig()];
}

function getInitialActiveConfigId(configs) {
  if (typeof window === 'undefined') return configs[0]?.id || '';
  try {
    const savedId = localStorage.getItem(ACTIVE_CONFIG_ID_STORAGE_KEY);
    if (savedId && configs.some(c => c.id === savedId)) {
      return savedId;
    }
  } catch (_) {}
  return configs[0]?.id || '';
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeTab, setActiveTab] = useState('horarios');
  const [allClasses, setAllClasses] = useState([]);

  // Configurations (profiles) state
  const [configs, setConfigs] = useState(() => getInitialConfigs());
  const [activeConfigId, setActiveConfigId] = useState(() => getInitialActiveConfigId(configs));

  const activeConfig = useMemo(() => {
    return configs.find(c => c.id === activeConfigId) || configs[0] || createDefaultConfig();
  }, [configs, activeConfigId]);

  const selectedGroups = activeConfig.selectedGroups || [];
  const disabledGroupIds = activeConfig.disabledGroupIds || [];
  const disabledSubjectsByGroup = activeConfig.disabledSubjectsByGroup || {};
  const disabledSubgroupsBySubject = activeConfig.disabledSubgroupsBySubject || {};

  const [semesterTimetable, setSemesterTimetable] = useState(() => getInitialSemesterTimetable(configs, activeConfigId));
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [initDone] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Cloud sync state ────────────────────────────────────────────────────────
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(USERNAME_STORAGE_KEY) || ''; } catch (_) { return ''; }
  });
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'syncing'|'synced'|'error'
  const [syncError, setSyncError] = useState(null);
  const syncDebounceRef = useRef(null);
  const isUserDirtyRef = useRef(false);

  const [currentMonday, setCurrentMonday] = useState(() => {
    const cachedTimetable = getInitialSemesterTimetable();
    const target = getResolvedTargetDate(new Date(), cachedTimetable);
    return getWeekMonday(target);
  });
  const forceNextFetchRef = useRef(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDayView, setIsDayView] = useState(false);

  const [activeLesson, setActiveLesson] = useState(null);
  const [showGroupSearch, setShowGroupSearch] = useState(false);
  const [customEvents, setCustomEvents] = useState(() => {
    if (typeof window === 'undefined') return [];
    return getStoredCustomEvents();
  });
  const [selectedCustomEvent, setSelectedCustomEvent] = useState(null);
  const [editingCustomEvent, setEditingCustomEvent] = useState(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  const [newEventData, setNewEventData] = useState(null);
  const canSwipePrev = true;
  const canSwipeNext = true;


  const groupKey = (g) => String(g.uniqueId || g.id);
  const activeGroups = useMemo(
    () => selectedGroups.filter(g => !disabledGroupIds.includes(groupKey(g))),
    [selectedGroups, disabledGroupIds]
  );

  // ── Telemetry: Report active groups to PostHog ───────────────────────────
  const reportedGroupsRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined' || !activeGroups || activeGroups.length === 0) return;
    const currentSignature = activeGroups.map(g => g.name).sort().join(',');
    if (reportedGroupsRef.current === currentSignature) return;
    reportedGroupsRef.current = currentSignature;

    try {
      const isPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const plataforma = isPwa ? '📱 App Móvil (PWA)' : '🌐 Navegador Web';
      const degreeNames = [];
      const groupCodes = [];

      activeGroups.forEach(g => {
        const { degree, language } = parseDegreeAndLanguage(g.longName, g.name);
        const groupCode = g.name;
        degreeNames.push(degree);
        groupCodes.push(groupCode);

        posthog.capture('student_group_active', {
          degree,
          language,
          group: groupCode,
          degree_and_group: `${degree} - ${groupCode}`,
          degree_language_group: `${degree} [${language}] (${groupCode})`,
          raw_degree: g.longName || g.name,
          is_pwa: isPwa,
          plataforma: plataforma,
          action: 'viewed',
        });
      });

      if (posthog && typeof posthog.setPersonProperties === 'function') {
        posthog.setPersonProperties({
          carrera_principal: degreeNames[0] || 'Desconocida',
          carreras: degreeNames,
          grupos: groupCodes,
          plataforma: plataforma,
        });
      }
    } catch (_) {}
  }, [activeGroups]);

  // ── Visibility sync for background/foreground switching ────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.removeItem('ehuntis_ph_reported_groups');
      sessionStorage.removeItem('ehuntis_reloaded_version');
    } catch (_) {}

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reportedGroupsRef.current = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(d => { if (!d.error) setAllClasses(d); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (initDone && typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(configs));
        localStorage.setItem(ACTIVE_CONFIG_ID_STORAGE_KEY, activeConfig.id);
      } catch (_) {}
    }
  }, [configs, activeConfig.id, initDone]);

  useEffect(() => {
    if (initDone && typeof window !== 'undefined') {
      saveStoredCustomEvents(customEvents);
    }
  }, [customEvents, initDone]);

  const updateActiveConfig = useCallback((updater) => {
    isUserDirtyRef.current = true;
    setConfigs(prev => prev.map(c => {
      if (c.id === activeConfig.id) {
        return typeof updater === 'function' ? updater(c) : { ...c, ...updater };
      }
      return c;
    }));
  }, [activeConfig.id]);

  // ── Cloud sync helpers ──────────────────────────────────────────────────────
  // Push local configs to Supabase via the REST API
  const pushToCloud = useCallback(async (uname, cfgsSnapshot, activeIdSnapshot) => {
    if (!uname) return;
    try {
      setSyncStatus('syncing');
      setSyncError(null);
      const res = await fetch(`/api/user/${encodeURIComponent(uname)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: cfgsSnapshot, active_config_id: activeIdSnapshot }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSyncStatus('synced');
    } catch (err) {
      setSyncError(err.message);
      setSyncStatus('error');
    }
  }, []);

  // Refs to always access fresh state in background/network event listeners
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const configsRef = useRef(configs);
  configsRef.current = configs;
  const activeConfigIdRef = useRef(activeConfig.id);
  activeConfigIdRef.current = activeConfig.id;
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;

  // Flag to know when an update comes from the cloud (to avoid re-pushing it back in debounce)
  const isRemoteUpdateRef = useRef(false);
  const lastSyncCheckTimeRef = useRef(0);

  // Pull latest cloud configs if user is logged in
  const pullFromCloud = useCallback(async ({ force = false } = {}) => {
    const uname = usernameRef.current;
    if (!uname) return;

    // Throttle checks unless forced (e.g. tab switch to Ajustes)
    const now = Date.now();
    if (!force && now - lastSyncCheckTimeRef.current < 2500) {
      return;
    }
    lastSyncCheckTimeRef.current = now;

    // Do NOT pull if currently pushing or if there is a pending local debounce
    // to avoid overwriting recent local configuration changes with stale cloud data
    if (!force && (syncStatusRef.current === 'syncing' || syncDebounceRef.current)) {
      return;
    }

    try {
      const res = await fetch(`/api/user/${encodeURIComponent(uname)}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (res.status === 404) {
        // User in localStorage but not in cloud — treat as logged out (edge case)
        try { localStorage.removeItem(USERNAME_STORAGE_KEY); } catch (_) {}
        setUsername('');
        try {
          if (typeof window !== 'undefined' && posthog && typeof posthog.reset === 'function') {
            posthog.reset();
          }
        } catch (_) {}
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      const cloudConfigs = data.configs;
      const cloudActiveId = data.active_config_id;

      if (!Array.isArray(cloudConfigs) || cloudConfigs.length === 0) return;

      const currentConfigs = configsRef.current;
      const currentActiveId = activeConfigIdRef.current;

      const isEquivalent = areConfigsEquivalent(currentConfigs, cloudConfigs);
      const isSameActiveId = currentActiveId === cloudActiveId;

      if (!isEquivalent || !isSameActiveId) {
        // Cloud has different configs from another device! Adopt them cleanly
        isRemoteUpdateRef.current = true;
        setConfigs(cloudConfigs);
        if (cloudActiveId && cloudConfigs.some(c => c.id === cloudActiveId)) {
          setActiveConfigId(cloudActiveId);
        } else {
          setActiveConfigId(cloudConfigs[0].id);
        }
        setSyncStatus('synced');
        setSyncError(null);
      }
    } catch (_) {
      // Network error — silently use local data
    }
  }, []);

  // Multi-device and multi-tab synchronization listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStaleTimetableAndRevalidate = () => {
      try {
        const lastCacheRaw = localStorage.getItem(LAST_TIMETABLE_CACHE_KEY);
        if (lastCacheRaw) {
          const lastCache = JSON.parse(lastCacheRaw);
          if (lastCache?.timestamp && Date.now() - lastCache.timestamp > 2 * 60 * 60 * 1000) {
            setRefreshTrigger(prev => prev + 1);
          }
        }
      } catch (_) {}
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reportedGroupsRef.current = '';
        pullFromCloud({ force: false });
        checkStaleTimetableAndRevalidate();
      }
    };

    const handleFocus = () => {
      pullFromCloud({ force: false });
      checkStaleTimetableAndRevalidate();
    };

    const handleOnline = () => {
      if (usernameRef.current && (syncStatusRef.current === 'error' || syncStatusRef.current === 'syncing')) {
        pushToCloud(usernameRef.current, configsRef.current, activeConfigIdRef.current);
      } else {
        pullFromCloud({ force: true });
      }
    };

    // Instant sync across multiple tabs in the same browser
    const handleStorageChange = (e) => {
      if (e.key === CONFIGS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (!areConfigsEquivalent(configsRef.current, parsed)) {
              isRemoteUpdateRef.current = true;
              setConfigs(parsed);
            }
          }
        } catch (_) {}
      }
      if (e.key === ACTIVE_CONFIG_ID_STORAGE_KEY && e.newValue) {
        if (activeConfigIdRef.current !== e.newValue) {
          isRemoteUpdateRef.current = true;
          setActiveConfigId(e.newValue);
        }
      }
      if (e.key === USERNAME_STORAGE_KEY) {
        const newUname = e.newValue || '';
        if (usernameRef.current !== newUname) {
          setUsername(newUname);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pullFromCloud, pushToCloud]);

  // Debounced auto-sync: fires 800ms after an explicit local user edit to configs/activeConfigId.
  // Never fires on initial boot/mount, preventing stale local state from overwriting fresh cloud configs.
  useEffect(() => {
    if (!username || !initDone) return;

    // If this update was triggered by pulling from cloud, do NOT push it back!
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      isUserDirtyRef.current = false;
      return;
    }

    // Only push if there has been an explicit local user edit in this session!
    // Prevents overwriting newer cloud configs with older local configs on mount/reboot.
    if (!isUserDirtyRef.current) {
      return;
    }

    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      syncDebounceRef.current = null;
      isUserDirtyRef.current = false;
      pushToCloud(username, configs, activeConfig.id);
    }, 800);
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, activeConfig.id, username, initDone]);

  // Flush-on-hide: when the user switches away from the app (iOS kills tabs aggressively),
  // cancel the debounce and immediately push via fetch with keepalive:true, which survives
  // page unload/suspension on iOS Safari. This is the only reliable way to guarantee
  // the save reaches Supabase before the process is frozen.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flushPendingSync = () => {
      const uname = usernameRef.current;
      const cfgs = configsRef.current;
      const activeId = activeConfigIdRef.current;
      if (!uname || !syncDebounceRef.current) return;

      // Cancel the debounce — we're flushing it now
      clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = null;
      isUserDirtyRef.current = false;

      // Use fetch with keepalive — survives iOS backgrounding / pagehide
      try {
        fetch(`/api/user/${encodeURIComponent(uname)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configs: cfgs, active_config_id: activeId }),
          keepalive: true,
        }).catch(() => {});
      } catch (_) {}
    };

    // pagehide is more reliable than beforeunload on iOS
    const handleVisibilityHide = () => {
      if (document.visibilityState === 'hidden') flushPendingSync();
    };
    window.addEventListener('pagehide', flushPendingSync);
    document.addEventListener('visibilitychange', handleVisibilityHide);

    return () => {
      window.removeEventListener('pagehide', flushPendingSync);
      document.removeEventListener('visibilitychange', handleVisibilityHide);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stale-while-revalidate on mount: load cloud configs if user is logged in
  useEffect(() => {
    if (!username) return;

    // POSTHOG: Identify session if username is saved in localStorage
    try {
      if (typeof window !== 'undefined' && posthog && typeof posthog.identify === 'function') {
        posthog.identify(username, {
          is_registered: true,
          account_username: username,
        });
      }
    } catch (_) {}

    // Initial pull from cloud
    pullFromCloud({ force: true });
  // Only run once on mount (username stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth handlers ────────────────────────────────────────────────────────────
  const handleRegister = useCallback(async (newUsername) => {
    // Check that the username does NOT already exist
    const checkRes = await fetch(`/api/user/${encodeURIComponent(newUsername)}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (checkRes.ok) {
      throw new Error('Ese identificador ya está en uso. Si ya tienes una cuenta, usa "Iniciar sesión".');
    }
    if (checkRes.status !== 404) {
      const errData = await checkRes.json().catch(() => ({}));
      throw new Error(errData.error || `Error inesperado al comprobar el identificador (HTTP ${checkRes.status}).`);
    }
    // Create the account by pushing current configs
    const putRes = await fetch(`/api/user/${encodeURIComponent(newUsername)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs, active_config_id: activeConfig.id }),
    });
    if (!putRes.ok) {
      const data = await putRes.json().catch(() => ({}));
      throw new Error(data.error || `No se pudo crear la cuenta (HTTP ${putRes.status}).`);
    }
    try { localStorage.setItem(USERNAME_STORAGE_KEY, newUsername); } catch (_) {}
    setUsername(newUsername);
    setSyncStatus('synced');
    setSyncError(null);

    // POSTHOG: Identify user and capture account registration
    try {
      if (typeof window !== 'undefined' && posthog) {
        posthog.identify(newUsername, {
          is_registered: true,
          account_username: newUsername,
          configs_count: configs.length,
          account_created_at: new Date().toISOString(),
        });
        posthog.capture('account_registered', {
          username: newUsername,
          configs_count: configs.length,
          groups_count: (activeConfig?.selectedGroups || []).length,
        });
      }
    } catch (_) {}
  }, [configs, activeConfig]);

  const handleLogin = useCallback(async (newUsername, resolutionChoice = null, conflictCloudData = null) => {
    // Helper to identify in posthog and capture login event
    const trackPosthogLogin = (finalConfigsCount, hadConflict, resolution) => {
      try {
        if (typeof window !== 'undefined' && posthog) {
          posthog.identify(newUsername, {
            is_registered: true,
            account_username: newUsername,
            configs_count: finalConfigsCount,
          });
          posthog.capture('account_logged_in', {
            username: newUsername,
            had_conflict: hadConflict,
            conflict_resolution: resolution,
            configs_count: finalConfigsCount,
          });
        }
      } catch (_) {}
    };

    // 1. If resolutionChoice is passed, user resolved conflict via modal
    if (resolutionChoice && conflictCloudData) {
      if (resolutionChoice === 'cloud') {
        // Option 1: Adopt cloud configs (overwrite local)
        const { configs: cConfigs, active_config_id: cActiveId } = conflictCloudData;
        setConfigs(cConfigs);
        setActiveConfigId(cActiveId && cConfigs.some(c => c.id === cActiveId) ? cActiveId : cConfigs[0].id);
        try { localStorage.setItem(USERNAME_STORAGE_KEY, newUsername); } catch (_) {}
        setUsername(newUsername);
        setSyncStatus('synced');
        setSyncError(null);
        trackPosthogLogin(cConfigs.length, true, 'cloud');
        return { success: true };
      }

      if (resolutionChoice === 'local') {
        // Option 2: Keep local configs (overwrite cloud)
        try { localStorage.setItem(USERNAME_STORAGE_KEY, newUsername); } catch (_) {}
        setUsername(newUsername);
        setSyncStatus('synced');
        setSyncError(null);
        await pushToCloud(newUsername, configs, activeConfig.id);
        trackPosthogLogin(configs.length, true, 'local');
        return { success: true };
      }

      if (resolutionChoice === 'merge') {
        // Option 3: Merge both (combine local + cloud)
        const merged = mergeConfigs(configs, conflictCloudData.configs, conflictCloudData.active_config_id);
        setConfigs(merged.configs);
        setActiveConfigId(merged.activeConfigId);
        try { localStorage.setItem(USERNAME_STORAGE_KEY, newUsername); } catch (_) {}
        setUsername(newUsername);
        setSyncStatus('synced');
        setSyncError(null);
        await pushToCloud(newUsername, merged.configs, merged.activeConfigId);
        trackPosthogLogin(merged.configs.length, true, 'merge');
        return { success: true };
      }
    }

    // 2. Initial login check
    const checkRes = await fetch(`/api/user/${encodeURIComponent(newUsername)}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (checkRes.status === 404) {
      throw new Error('No existe ninguna cuenta con ese identificador. Si eres nuevo, usa "Crear cuenta".');
    }
    if (!checkRes.ok) {
      const errData = await checkRes.json().catch(() => ({}));
      throw new Error(errData.error || `Error al buscar la cuenta (HTTP ${checkRes.status}).`);
    }
    const data = await checkRes.json();
    const cloudConfigs = data.configs || [];
    const cloudActiveId = data.active_config_id;

    // Check if there is a conflict:
    // Only conflict if local has actual custom data AND differs from cloud
    const hasLocal = hasLocalCustomData(configs);
    const isEquivalent = areConfigsEquivalent(configs, cloudConfigs);

    if (hasLocal && !isEquivalent) {
      return {
        conflict: true,
        username: newUsername,
        cloudConfigs,
        cloudActiveId,
        localConfigs: configs,
      };
    }

    // No conflict: adopt cloud configs directly
    if (Array.isArray(cloudConfigs) && cloudConfigs.length > 0) {
      setConfigs(cloudConfigs);
      if (cloudActiveId && cloudConfigs.some(c => c.id === cloudActiveId)) {
        setActiveConfigId(cloudActiveId);
      } else {
        setActiveConfigId(cloudConfigs[0].id);
      }
    }
    try { localStorage.setItem(USERNAME_STORAGE_KEY, newUsername); } catch (_) {}
    setUsername(newUsername);
    setSyncStatus('synced');
    setSyncError(null);
    trackPosthogLogin(cloudConfigs.length || configs.length, false, 'direct');
    return { success: true };
  }, [configs, activeConfig.id, pushToCloud]);

  const handleLogout = useCallback(() => {
    const previousUsername = username;
    try { localStorage.removeItem(USERNAME_STORAGE_KEY); } catch (_) {}
    setUsername('');
    setSyncStatus('idle');
    setSyncError(null);

    // POSTHOG: Capture logout and reset distinct ID
    try {
      if (typeof window !== 'undefined' && posthog) {
        posthog.capture('account_logged_out', {
          previous_username: previousUsername,
        });
        if (typeof posthog.reset === 'function') {
          posthog.reset();
        }
      }
    } catch (_) {}
  }, [username]);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    try {
      if (typeof window !== 'undefined' && posthog) {
        posthog.capture('tab_viewed', { tab: newTab });
      }
    } catch (_) {}

    // Flush any pending debounced save to cloud immediately
    if (syncDebounceRef.current && usernameRef.current) {
      clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = null;
      isUserDirtyRef.current = false;
      pushToCloud(usernameRef.current, configsRef.current, activeConfigIdRef.current);
    } else if (newTab === 'ajustes' || newTab === 'horarios') {
      pullFromCloud({ force: false });
    }
  }, [pullFromCloud, pushToCloud]);

  const handleSelectConfig = useCallback((id) => {
    isUserDirtyRef.current = true;
    setActiveConfigId(id);

    // Instant switch to cached timetable if available for this config, or clear to []
    // to guarantee the UI never shows the previous configuration's schedule
    const targetConfig = configs.find(c => c.id === id);
    if (targetConfig) {
      const targetActiveGroups = (targetConfig.selectedGroups || []).filter(
        g => !(targetConfig.disabledGroupIds || []).includes(String(g.uniqueId || g.id))
      );
      if (targetActiveGroups.length === 0) {
        setSemesterTimetable([]);
      } else {
        const today = new Date();
        const month = today.getMonth();
        const year = today.getFullYear();
        const startYear = month >= 7 ? year : year - 1;
        const startDate = new Date(startYear, 8, 1);
        const tIds = targetActiveGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).sort().join(',');
        const cacheKey = `ehuntis_timetable_cache_v3_${tIds}_${startDate.getFullYear()}_${startDate.getMonth()}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed?.data)) {
              setSemesterTimetable(parsed.data);
            } else {
              setSemesterTimetable([]);
            }
          } else {
            setSemesterTimetable([]);
          }
        } catch (_) {
          setSemesterTimetable([]);
        }
      }
    }

    // Flush active config change immediately to Supabase
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = null;
    }
    if (usernameRef.current) {
      isUserDirtyRef.current = false;
      pushToCloud(usernameRef.current, configs, id);
    }
  }, [configs, pushToCloud]);

  const handleCreateConfig = useCallback((customName) => {
    isUserDirtyRef.current = true;
    const newId = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newName = customName || `Configuración ${configs.length + 1}`;
    const newCfg = createDefaultConfig(newId, newName);
    setConfigs(prev => [...prev, newCfg]);
    setActiveConfigId(newId);
  }, [configs.length]);

  const handleRenameConfig = useCallback((id, newName) => {
    if (!newName?.trim()) return;
    isUserDirtyRef.current = true;
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim() } : c));
  }, []);

  const handleDuplicateConfig = useCallback((id) => {
    const target = configs.find(c => c.id === id);
    if (!target) return;
    isUserDirtyRef.current = true;
    const newId = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cloned = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      name: `${target.name} - copia`,
    };
    setConfigs(prev => [...prev, cloned]);
    setActiveConfigId(newId);
  }, [configs]);

  const handleDeleteConfig = useCallback((id) => {
    isUserDirtyRef.current = true;
    setConfigs(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (remaining.length === 0) {
        const fallback = createDefaultConfig();
        setActiveConfigId(fallback.id);
        return [fallback];
      }
      if (activeConfigId === id) {
        setActiveConfigId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeConfigId]);

  // ── Subject Custom Colors resolution & swap handler ────────────────────────
  const resolvedSubjectColors = useMemo(() => {
    return resolveSubjectColors(semesterTimetable, activeConfig.customColors || {});
  }, [semesterTimetable, activeConfig.customColors]);

  const handleSetSubjectColor = useCallback((subjectId, newColorIndex) => {
    updateActiveConfig(prev => {
      const currentCustom = prev.customColors || {};
      const updatedCustom = swapSubjectColor({
        targetSubjectId: subjectId,
        newColorIndex,
        lessons: semesterTimetable,
        customColors: currentCustom,
      });
      return {
        ...prev,
        customColors: updatedCustom,
      };
    });
  }, [semesterTimetable, updateActiveConfig]);

  const handleResetSubjectColors = useCallback(() => {
    updateActiveConfig(prev => ({
      ...prev,
      customColors: {},
    }));
  }, [updateActiveConfig]);

  const handleResetSingleSubjectColor = useCallback((subjectId) => {
    updateActiveConfig(prev => {
      const current = { ...(prev.customColors || {}) };
      delete current[subjectId];
      delete current[String(subjectId)];
      return {
        ...prev,
        customColors: current,
      };
    });
  }, [updateActiveConfig]);

  const toggleShowDimmedSubgroups = useCallback(() => {
    updateActiveConfig(cfg => ({
      ...cfg,
      showDimmedSubgroups: !cfg.showDimmedSubgroups
    }));
  }, [updateActiveConfig]);

  // ── Timetable fetching ────────────────────────────────────────────────────
  useEffect(() => {
    if (!initDone) return;
    if (activeGroups.length === 0) {
      setSemesterTimetable([]);
      setLoadingTimetable(false);
      return;
    }

    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const startYear = month >= 7 ? year : year - 1;

    const startDate = new Date(startYear, 8, 1); // Sept 1
    const endDate = new Date(startYear + 1, 5, 30); // June 30

    const ids = activeGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).sort().join(',');
    const cacheKey = `ehuntis_timetable_cache_v3_${ids}_${startDate.getFullYear()}_${startDate.getMonth()}`;

    const isForce = forceNextFetchRef.current;
    forceNextFetchRef.current = false;

    let hasFreshCache = false;

    if (!isForce) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.data)) {
            setSemesterTimetable(parsed.data);
            // Stale-While-Revalidate: si la caché local tiene menos de 2 horas, se considera fresca.
            // Si tiene más de 2 horas, mostramos parsed.data inmediatamente (0ms)
            // y a continuación revalidamos en segundo plano con la API de Vercel.
            if (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000) {
              hasFreshCache = true;
            }
          }
        }
      } catch (e) {}
    }

    if (hasFreshCache) {
      setLoadingTimetable(false);
      return;
    }

    setLoadingTimetable(true);
    const abortController = new AbortController();

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();
    const forceQuery = isForce ? `&force=1&t=${Date.now()}` : '';

    // Usar 'no-store' en el fetch del cliente para que Vercel CDN no sirva su propia caché
    // y vaya directamente a buscar datos frescos de WebUntis.
    // Sin esto, Vercel puede devolver datos con hasta 6h de antigüedad aunque el
    // localStorage local tenga más de 2h y haya lanzado este fetch de revalidación.
    fetch(`/api/timetable?classIds=${ids}&startDate=${startStr}&endDate=${endStr}${forceQuery}`, {
      signal: abortController.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { 
        if (abortController.signal.aborted) return;
        if (!d.error && Array.isArray(d)) {
          // Guard: do NOT overwrite a valid cache with an empty/suspicious response.
          // If the API returns fewer than 10 lessons for the whole year, something is wrong
          // (e.g. new academic year IDs not yet published in WebUntis, or a transient error).
          // In that case, keep the previous cached data and do NOT update the cache timestamp.
          if (d.length < 10) {
            console.warn('[EHUntis] Timetable fetch returned suspiciously few lessons (' + d.length + '). Not overwriting cache.');
            setSemesterTimetable(prev => prev.length === 0 ? d : prev);
            return;
          }
          setSemesterTimetable(d); 
          try {
            const cachePayload = {
              timestamp: Date.now(),
              data: d
            };
            localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
            localStorage.setItem(LAST_TIMETABLE_CACHE_KEY, JSON.stringify(cachePayload));
          } catch(e) {}
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('Timetable fetch error:', err);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingTimetable(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [activeGroups, initDone, refreshTrigger]);

  // Revalidación periódica automática: comprueba si el horario sigue fresco cada 2 horas.
  // Sin esto, si la pestaña lleva mucho tiempo abierta sin navegar, el useEffect de fetching
  // no se vuelve a ejecutar y el horario puede quedarse desactualizado indefinidamente.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const REVALIDATION_INTERVAL = 2 * 60 * 60 * 1000; // 2 horas
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && activeGroups.length > 0) {
        setRefreshTrigger(prev => prev + 1);
      }
    }, REVALIDATION_INTERVAL);
    return () => clearInterval(timer);
  }, [activeGroups]);

  const timetable = useMemo(() => {
    return semesterTimetable;
  }, [semesterTimetable]);

  const forceRefreshTimetable = useCallback(() => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ehuntis_timetable_cache_') || key === LAST_TIMETABLE_CACHE_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
    forceNextFetchRef.current = true;
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ── Subjects & Subgroups Index across entire year/semester ──────────────────
  const { timetableByGroup, availableSubgroupsBySubject } = useMemo(() => {
    const subjectsMap = {};
    const subgroupsMap = {};

    activeGroups.forEach(g => {
      const key = groupKey(g);
      subjectsMap[key] = new Map();
      subgroupsMap[key] = {};
    });

    semesterTimetable.forEach(lesson => {
      const matchingGroups = activeGroups.filter(g => {
        const gIds = Array.isArray(g.id) ? g.id : [g.id];
        return lesson.classIds?.some(id => gIds.includes(id)) || (lesson.classId && gIds.includes(lesson.classId));
      });

      matchingGroups.forEach(g => {
        const key = groupKey(g);
        const subKey = extractSubgroupKey(lesson.type);

        lesson.subjectIds?.forEach((subjId, idx) => {
          if (!subjectsMap[key].has(subjId)) {
            subjectsMap[key].set(subjId, {
              id: subjId,
              name: lesson.subjects?.[idx] || lesson.subjectShortNames?.[idx] || String(subjId),
              shortName: lesson.subjectShortNames?.[idx] || '',
            });
          }

          if (subKey) {
            if (!subgroupsMap[key][subjId]) {
              subgroupsMap[key][subjId] = new Set();
            }
            subgroupsMap[key][subjId].add(subKey);
          }
        });
      });
    });

    const finalSubjects = {};
    const finalSubgroups = {};

    activeGroups.forEach(g => {
      const key = groupKey(g);
      finalSubjects[key] = Array.from(subjectsMap[key].values()).sort((a, b) => a.name.localeCompare(b.name));
      
      finalSubgroups[key] = {};
      Object.keys(subgroupsMap[key] || {}).forEach(subjId => {
        finalSubgroups[key][subjId] = Array.from(subgroupsMap[key][subjId]).sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
      });
    });

    return { timetableByGroup: finalSubjects, availableSubgroupsBySubject: finalSubgroups };
  }, [activeGroups, semesterTimetable]);

  // ── Filtered timetable ────────────────────────────────────────────────────
  const filteredTimetable = useMemo(() => {
    const showDimmed = Boolean(activeConfig.showDimmedSubgroups);

    return timetable.map(lesson => {
      const ownerGroups = activeGroups.filter(g => {
        const gIds = Array.isArray(g.id) ? g.id : [g.id];
        return lesson.classIds?.some(id => gIds.includes(id)) || (lesson.classId && gIds.includes(lesson.classId));
      });

      if (ownerGroups.length === 0) return null;

      let isVisible = false;
      let isDimmed = false;

      for (const g of ownerGroups) {
        const key = groupKey(g);
        const disabledSubjs = disabledSubjectsByGroup[key] || [];
        const disabledSubgroupsBySubj = disabledSubgroupsBySubject[key] || {};

        // If subject is disabled, completely hide
        if (lesson.subjectIds?.some(id => disabledSubjs.includes(id))) {
          continue;
        }

        // Check if subgroup is disabled for this subject
        const subKey = extractSubgroupKey(lesson.type);
        const isSubgroupDisabled = Boolean(subKey && lesson.subjectIds?.length > 0 && lesson.subjectIds.every(subjId => {
          const disabledForThisSub = disabledSubgroupsBySubj[subjId] || [];
          return disabledForThisSub.includes(subKey);
        }));

        if (!isSubgroupDisabled) {
          isVisible = true;
          isDimmed = false;
          break;
        } else {
          if (showDimmed) {
            isVisible = true;
            isDimmed = true;
          }
        }
      }

      if (!isVisible) return null;
      return { ...lesson, isDimmed };
    }).filter(Boolean);
  }, [timetable, activeGroups, disabledSubjectsByGroup, disabledSubgroupsBySubject, activeConfig.showDimmedSubgroups]);

  // ── Custom Events expansion and combined timetable ───────────────────────
  const customEventsPreviewDates = useMemo(() => {
    // Expandir fechas en un rango de ±4 semanas alrededor del lunes activo
    // para que el carrusel de swipe tanto en vista semanal como diaria
    // muestre de forma instantánea la vista previa de eventos personalizados sin parpadeos.
    const dates = [];
    const baseMonday = getWeekMonday(currentMonday);
    for (let offset = -28; offset <= 28; offset++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + offset);
      dates.push(d);
    }
    return dates;
  }, [currentMonday]);

  const expandedCustomEvents = useMemo(() => {
    return expandCustomEventsForDates(customEvents, customEventsPreviewDates);
  }, [customEvents, customEventsPreviewDates]);

  const combinedTimetable = useMemo(() => {
    return [...filteredTimetable, ...expandedCustomEvents];
  }, [filteredTimetable, expandedCustomEvents]);

  const weekDates = useMemo(() => {
    return getDynamicWeekDates(currentMonday, combinedTimetable);
  }, [currentMonday, combinedTimetable]);

  const prevWeekDates = useMemo(() => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    return getDynamicWeekDates(prevMonday, combinedTimetable);
  }, [currentMonday, combinedTimetable]);

  const nextWeekDates = useMemo(() => {
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    return getDynamicWeekDates(nextMonday, combinedTimetable);
  }, [currentMonday, combinedTimetable]);

  const handleOpenNewEventModal = useCallback((customDate = null) => {
    let date = customDate;
    if (!date) {
      if (isDayView) {
        date = selectedDay || currentMonday;
      } else {
        const today = new Date();
        const currentWeekMonday = getWeekMonday(today);
        date = isSameDay(currentMonday, currentWeekMonday) ? today : currentMonday;
      }
    }
    setNewEventData({ date });
    setShowNewEventModal(true);
  }, [isDayView, selectedDay, currentMonday]);

  const handleCellDoubleClick = useCallback((date, clampedMinutes) => {
    const startH = Math.floor(clampedMinutes / 60);
    const startM = clampedMinutes % 60;
    const endMinutes = clampedMinutes + 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${pad(startH)}:${pad(startM)}`;
    const endStr = `${pad(endH)}:${pad(endM)}`;
    setNewEventData({
      date,
      startTimeStr: startStr,
      endTimeStr: endStr,
    });
    setShowNewEventModal(true);
  }, []);

  const suggestedEventColor = useMemo(() => {
    return suggestEventColor(semesterTimetable, customEvents, activeConfig.customColors || {});
  }, [semesterTimetable, customEvents, activeConfig.customColors]);

  const handleSaveCustomEvent = useCallback((eventData, mode) => {
    const targetDateNum = editingCustomEvent?.date || toDateNumber(selectedDay || currentMonday);
    setCustomEvents(prev => saveCustomEventInstance(prev, eventData, targetDateNum, mode));
    setEditingCustomEvent(null);
    setSelectedCustomEvent(null);
    setShowNewEventModal(false);
    setNewEventData(null);
  }, [editingCustomEvent, selectedDay, currentMonday]);

  const handleDeleteCustomEvent = useCallback((eventId, dateNum, mode) => {
    setCustomEvents(prev => deleteCustomEventInstance(prev, eventId, dateNum, mode));
    setEditingCustomEvent(null);
    setSelectedCustomEvent(null);
  }, []);

  const handleLessonClick = useCallback((lesson) => {
    if (lesson?.isCustomEvent) {
      setSelectedCustomEvent(lesson);
    } else {
      setActiveLesson(lesson);
    }
  }, []);

  // ── Group and Subgroup management ──────────────────────────────────────────
  const addGroup = useCallback((c) => {
    updateActiveConfig(cfg => {
      const exists = cfg.selectedGroups.some(g => (g.uniqueId && g.uniqueId === c.uniqueId) || g.id === c.id);
      if (exists) return cfg;
      return {
        ...cfg,
        selectedGroups: [...cfg.selectedGroups, c]
      };
    });

    try {
      const isPwa = typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
      const plataforma = isPwa ? '📱 App Móvil (PWA)' : '🌐 Navegador Web';
      const { degree, language } = parseDegreeAndLanguage(c.longName, c.name);
      const groupCode = c.name;
      posthog.capture('student_group_active', {
        degree,
        language,
        group: groupCode,
        degree_and_group: `${degree} - ${groupCode}`,
        degree_language_group: `${degree} [${language}] (${groupCode})`,
        raw_degree: c.longName || c.name,
        is_pwa: isPwa,
        plataforma: plataforma,
        action: 'added',
      });
    } catch (_) {}
  }, [updateActiveConfig]);

  const removeGroup = useCallback((g) => {
    const key = groupKey(g);
    updateActiveConfig(cfg => {
      const nextDisabledSubjs = { ...cfg.disabledSubjectsByGroup };
      delete nextDisabledSubjs[key];
      const nextDisabledSubgroups = { ...cfg.disabledSubgroupsBySubject };
      delete nextDisabledSubgroups[key];
      return {
        ...cfg,
        selectedGroups: cfg.selectedGroups.filter(x => x.id !== g.id),
        disabledGroupIds: cfg.disabledGroupIds.filter(id => id !== key),
        disabledSubjectsByGroup: nextDisabledSubjs,
        disabledSubgroupsBySubject: nextDisabledSubgroups,
      };
    });
  }, [updateActiveConfig]);

  const toggleGroupDisabled = useCallback((gKey) => {
    updateActiveConfig(cfg => {
      const disabled = cfg.disabledGroupIds.includes(gKey);
      return {
        ...cfg,
        disabledGroupIds: disabled ? cfg.disabledGroupIds.filter(id => id !== gKey) : [...cfg.disabledGroupIds, gKey]
      };
    });
  }, [updateActiveConfig]);

  const toggleSubjectForGroup = useCallback((gKey, subjectId) => {
    updateActiveConfig(cfg => {
      const current = cfg.disabledSubjectsByGroup[gKey] || [];
      const next = current.includes(subjectId)
        ? current.filter(id => id !== subjectId)
        : [...current, subjectId];
      return {
        ...cfg,
        disabledSubjectsByGroup: {
          ...cfg.disabledSubjectsByGroup,
          [gKey]: next
        }
      };
    });
  }, [updateActiveConfig]);

  const toggleSubgroupForSubject = useCallback((gKey, subjectId, subKey) => {
    updateActiveConfig(cfg => {
      const groupSubgroups = cfg.disabledSubgroupsBySubject[gKey] || {};
      const currentSubDisabled = groupSubgroups[subjectId] || [];
      const nextSubDisabled = currentSubDisabled.includes(subKey)
        ? currentSubDisabled.filter(k => k !== subKey)
        : [...currentSubDisabled, subKey];

      return {
        ...cfg,
        disabledSubgroupsBySubject: {
          ...cfg.disabledSubgroupsBySubject,
          [gKey]: {
            ...groupSubgroups,
            [subjectId]: nextSubDisabled
          }
        }
      };
    });
  }, [updateActiveConfig]);

  const toggleAllSubgroupsForGroup = useCallback((gKey, enableAll) => {
    updateActiveConfig(cfg => {
      const groupSubgroups = cfg.disabledSubgroupsBySubject[gKey] || {};
      const nextGroupSubgroups = { ...groupSubgroups };
      const availableForGroup = availableSubgroupsBySubject[gKey] || {};

      Object.keys(availableForGroup).forEach(subjId => {
        if (enableAll) {
          nextGroupSubgroups[subjId] = [];
        } else {
          nextGroupSubgroups[subjId] = [...(availableForGroup[subjId] || [])];
        }
      });

      return {
        ...cfg,
        disabledSubgroupsBySubject: {
          ...cfg.disabledSubgroupsBySubject,
          [gKey]: nextGroupSubgroups
        }
      };
    });
  }, [updateActiveConfig, availableSubgroupsBySubject]);

  // ── Week navigation ────────────────────────────────────────────────────────

  const goToPrevWeek = useCallback(() => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const handlePrevDay = useCallback(() => {
    const base = selectedDay || currentMonday;
    const targetDate = getPrevDayContextual(base, combinedTimetable);
    setSelectedDay(targetDate);
    const newMonday = getWeekMonday(targetDate);
    if (newMonday.getTime() !== currentMonday.getTime()) {
      setCurrentMonday(newMonday);
    }
  }, [selectedDay, currentMonday, combinedTimetable]);

  const handleNextDay = useCallback(() => {
    const base = selectedDay || currentMonday;
    const targetDate = getNextDayContextual(base, combinedTimetable);
    setSelectedDay(targetDate);
    const newMonday = getWeekMonday(targetDate);
    if (newMonday.getTime() !== currentMonday.getTime()) {
      setCurrentMonday(newMonday);
    }
  }, [selectedDay, currentMonday, combinedTimetable]);

  const calendarRef = useRef(null);
  const targetMondayRef = useRef(currentMonday);
  const targetDayRef = useRef(selectedDay || currentMonday);
  const pendingNavQueueRef = useRef([]);

  const handleSwipeCommit = useCallback((direction) => {
    pendingNavQueueRef.current = [];
    if (isDayView) {
      if (direction === 'next') handleNextDay();
      else handlePrevDay();
    } else {
      if (direction === 'next') goToNextWeek();
      else goToPrevWeek();
    }
  }, [isDayView, handleNextDay, handlePrevDay, goToNextWeek, goToPrevWeek]);

  const handleSlide = useCallback((direction) => {
    if (isDayView) {
      const base = targetDayRef.current || selectedDay || currentMonday;
      const targetDate = direction === 'next'
        ? getNextDayContextual(base, combinedTimetable)
        : getPrevDayContextual(base, combinedTimetable);

      targetDayRef.current = targetDate;

      // If a slide is already running, queue this transition cleanly
      if (calendarRef.current?.isSliding?.()) {
        if (pendingNavQueueRef.current.length < 3) {
          pendingNavQueueRef.current.push({ type: 'day', target: targetDate });
        }
        return;
      }

      if (calendarRef.current?.triggerSlideTo) {
        calendarRef.current.triggerSlideTo([targetDate], () => {
          setSelectedDay(targetDate);
          setCurrentMonday(getWeekMonday(targetDate));
        });
      } else {
        setSelectedDay(targetDate);
        setCurrentMonday(getWeekMonday(targetDate));
      }
    } else {
      const base = targetMondayRef.current || currentMonday;
      const targetMonday = new Date(base);
      if (direction === 'next') {
        targetMonday.setDate(targetMonday.getDate() + 7);
      } else {
        targetMonday.setDate(targetMonday.getDate() - 7);
      }

      targetMondayRef.current = targetMonday;

      // If a slide is already running, queue this transition cleanly
      if (calendarRef.current?.isSliding?.()) {
        if (pendingNavQueueRef.current.length < 3) {
          pendingNavQueueRef.current.push({ type: 'week', target: targetMonday });
        }
        return;
      }

      const targetWeekDates = getDynamicWeekDates(targetMonday, combinedTimetable);
      if (calendarRef.current?.triggerSlideTo) {
        calendarRef.current.triggerSlideTo(targetWeekDates, () => {
          setCurrentMonday(targetMonday);
        });
      } else {
        setCurrentMonday(targetMonday);
      }
    }
  }, [isDayView, selectedDay, currentMonday, combinedTimetable]);

  // Drain pending queued slides sequentially as each completes and state commits
  useEffect(() => {
    if (pendingNavQueueRef.current.length > 0) {
      const nextNav = pendingNavQueueRef.current.shift();
      if (nextNav.type === 'week') {
        const targetWeekDates = getDynamicWeekDates(nextNav.target, combinedTimetable);
        if (calendarRef.current?.triggerSlideTo) {
          calendarRef.current.triggerSlideTo(targetWeekDates, () => {
            setCurrentMonday(nextNav.target);
          });
        } else {
          setCurrentMonday(nextNav.target);
        }
      } else if (nextNav.type === 'day') {
        if (calendarRef.current?.triggerSlideTo) {
          calendarRef.current.triggerSlideTo([nextNav.target], () => {
            setSelectedDay(nextNav.target);
            setCurrentMonday(getWeekMonday(nextNav.target));
          });
        } else {
          setSelectedDay(nextNav.target);
          setCurrentMonday(getWeekMonday(nextNav.target));
        }
      }
    } else {
      targetMondayRef.current = currentMonday;
      targetDayRef.current = selectedDay || currentMonday;
    }
  }, [currentMonday, selectedDay, combinedTimetable]);

  const handleNavClick = useCallback((direction) => {
    handleSlide(direction);
  }, [handleSlide]);

  // Keyboard navigation on PC (ArrowLeft / ArrowRight / Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (activeLesson) {
          setActiveLesson(null);
          return;
        }
        if (showGroupSearch) {
          setShowGroupSearch(false);
          return;
        }
      }

      if (activeTab !== 'horarios' || activeLesson || showGroupSearch) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavClick('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavClick('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeLesson, showGroupSearch, handleNavClick]);

  const handleSelectDay = (date) => {
    pendingNavQueueRef.current = [];
    targetDayRef.current = date;
    targetMondayRef.current = getWeekMonday(date);

    if (isDayView && selectedDay && isSameDay(selectedDay, date)) {
      setIsDayView(false);
      setSelectedDay(null);
    } else if (isDayView && selectedDay && !isSameDay(selectedDay, date)) {
      if (calendarRef.current?.triggerSlideTo) {
        calendarRef.current.triggerSlideTo([date], () => setSelectedDay(date));
      } else {
        setSelectedDay(date);
      }
    } else {
      setSelectedDay(date);
      setIsDayView(true);
    }
  };

  const handlePickDate = (pickedDate) => {
    pendingNavQueueRef.current = [];
    const date = new Date(pickedDate);
    date.setHours(0, 0, 0, 0);

    targetMondayRef.current = getWeekMonday(date);
    targetDayRef.current = date;

    const targetDates = isDayView ? [date] : getDynamicWeekDates(getWeekMonday(date), combinedTimetable);

    if (calendarRef.current?.triggerSlideTo) {
      calendarRef.current.triggerSlideTo(targetDates, () => {
        if (isDayView) {
          setSelectedDay(date);
          setCurrentMonday(getWeekMonday(date));
        } else {
          setCurrentMonday(getWeekMonday(date));
        }
      });
    } else {
      if (isDayView) {
        setSelectedDay(date);
        setCurrentMonday(getWeekMonday(date));
      } else {
        setCurrentMonday(getWeekMonday(date));
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!initDone) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Content */}
      {activeTab === 'horarios' && (
        <>
          <WeekHeader
            weekDates={weekDates}
            prevWeekDates={prevWeekDates}
            nextWeekDates={nextWeekDates}
            selectedDay={selectedDay}
            isDayView={isDayView}
            onSelectDay={handleSelectDay}
            onPrevWeek={() => handleNavClick('prev')}
            onNextWeek={() => handleNavClick('next')}
            onPrevDay={() => handleNavClick('prev')}
            onNextDay={() => handleNavClick('next')}
            onPickDate={handlePickDate}
            minDate={getAcademicYearBounds().minDate}
            maxDate={getAcademicYearBounds().maxDate}
          />

          {loadingTimetable && activeGroups.length > 0 && (
            <div className="updating-pill" aria-live="polite">
              <div className="spinner" style={{ width: 14, height: 14, borderLeftColor: 'var(--accent)' }} />
              Actualizando...
            </div>
          )}

          {!loadingTimetable && activeGroups.length === 0 && customEvents.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-muted)' }}>
                <CalendarSearch size={48} strokeWidth={1.5} />
              </div>
              <div className="empty-state-title">Tu horario aquí</div>
              <div className="empty-state-body">
                {selectedGroups.length === 0 
                  ? 'Ve a ajustes para añadir tus grupos y asignaturas, o usa el botón "+" para crear eventos personales.' 
                  : 'Todos tus grupos están ocultos. Ve a ajustes para activarlos o usa el botón "+" para eventos personales.'}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="empty-cta-btn" onClick={() => setActiveTab('ajustes')}>
                  Ir a Ajustes
                </button>
                <button className="empty-cta-btn" onClick={() => handleOpenNewEventModal()} style={{ background: 'var(--accent)', color: '#fff' }}>
                  + Añadir evento
                </button>
              </div>
            </div>
          )}

          {(activeGroups.length > 0 || customEvents.length > 0) && (
            <WeekCalendar
              ref={calendarRef}
              lessons={combinedTimetable}
              customColors={activeConfig.customColors}
              onLessonClick={handleLessonClick}
              weekDates={isDayView && selectedDay ? [selectedDay] : weekDates}
              isDayView={isDayView}
              selectedDay={selectedDay}
              fullWeekDates={weekDates}
              prevWeekDates={prevWeekDates}
              nextWeekDates={nextWeekDates}
              isDark={isDark}
              canSwipeNext={canSwipeNext}
              canSwipePrev={canSwipePrev}
              onSwipeLeft={() => handleSwipeCommit('next')}
              onSwipeRight={() => handleSwipeCommit('prev')}
              onCellDoubleClick={handleCellDoubleClick}
            />
          )}

          {/* Floating Action Button (FAB) para crear eventos personales */}
          <button
            className="fab-add-event"
            onClick={() => handleOpenNewEventModal()}
            aria-label="Añadir evento personal"
            title="Añadir evento personal"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </>
      )}

      {activeTab === 'ajustes' && (
        <SettingsView
          theme={theme}
          onThemeChange={setTheme}
          configs={configs}
          activeConfigId={activeConfigId}
          onSelectConfig={handleSelectConfig}
          onCreateConfig={handleCreateConfig}
          onRenameConfig={handleRenameConfig}
          onDuplicateConfig={handleDuplicateConfig}
          onDeleteConfig={handleDeleteConfig}

          onForceRefresh={forceRefreshTimetable}
          isRefreshingTimetable={loadingTimetable}
          timetableByGroup={timetableByGroup}
          availableSubgroupsBySubject={availableSubgroupsBySubject}

          showDimmedSubgroups={Boolean(activeConfig.showDimmedSubgroups)}
          onToggleShowDimmedSubgroups={toggleShowDimmedSubgroups}
          onToggleAllSubgroupsForGroup={toggleAllSubgroupsForGroup}
          onToggleGroupDisabled={toggleGroupDisabled}
          onToggleSubjectForGroup={toggleSubjectForGroup}
          onToggleSubgroupForSubject={toggleSubgroupForSubject}
          onRemoveGroup={removeGroup}
          onAddGroup={() => setShowGroupSearch(true)}

          customColors={activeConfig.customColors || {}}
          resolvedSubjectColors={resolvedSubjectColors}
          onSetSubjectColor={handleSetSubjectColor}
          onResetSingleSubjectColor={handleResetSingleSubjectColor}
          onResetSubjectColors={handleResetSubjectColors}
          isDark={isDark}
        />
      )}

      {activeTab === 'info' && (
        <ProfileView
          username={username}
          syncStatus={syncStatus}
          syncError={syncError}
          onRegister={handleRegister}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      )}

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'ajustes' ? ' active' : ''}`}
          onClick={() => handleTabChange('ajustes')}
          id="tab-ajustes"
        >
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}><SettingsIcon size={20} strokeWidth={2} /></span>
          <span className="tab-label">Ajustes</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'horarios' ? ' active' : ''}`}
          onClick={() => handleTabChange('horarios')}
          id="tab-horarios"
        >
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}><CalendarIcon size={20} strokeWidth={2} /></span>
          <span className="tab-label">Horarios</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'info' ? ' active' : ''}`}
          onClick={() => handleTabChange('info')}
          id="tab-info"
        >
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}><UserIcon size={20} strokeWidth={2} /></span>
          <span className="tab-label">Info</span>
        </button>
      </nav>

      {/* Modals */}
      {activeLesson && (
        <LessonModal
          lesson={activeLesson}
          isDark={isDark}
          onClose={() => setActiveLesson(null)}
        />
      )}

      {selectedCustomEvent && !editingCustomEvent && (
        <CustomEventDetailModal
          event={selectedCustomEvent}
          isDark={isDark}
          onEdit={() => {
            const evt = selectedCustomEvent;
            setSelectedCustomEvent(null);
            setEditingCustomEvent(evt);
          }}
          onDelete={handleDeleteCustomEvent}
          onClose={() => setSelectedCustomEvent(null)}
        />
      )}

      {(showNewEventModal || editingCustomEvent) && (
        <CustomEventModal
          event={editingCustomEvent}
          targetDate={editingCustomEvent ? undefined : newEventData?.date}
          initialStartTimeStr={newEventData?.startTimeStr}
          initialEndTimeStr={newEventData?.endTimeStr}
          suggestedColor={suggestedEventColor}
          onSave={handleSaveCustomEvent}
          onDelete={handleDeleteCustomEvent}
          onClose={() => {
            setShowNewEventModal(false);
            setEditingCustomEvent(null);
            setNewEventData(null);
          }}
          isDark={isDark}
        />
      )}

      {showGroupSearch && (
        <GroupSearch
          allClasses={allClasses}
          selectedGroups={selectedGroups}
          onAdd={addGroup}
          onRemove={removeGroup}
          onClose={() => setShowGroupSearch(false)}
        />
      )}
    </div>
  );
}
