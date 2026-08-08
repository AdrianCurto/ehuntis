'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { extractSubgroupNumber } from './utils/subgroups';
import { Settings as SettingsIcon, Calendar as CalendarIcon, User as UserIcon, CalendarSearch } from 'lucide-react';

const WeekCalendar = dynamic(() => import('./components/WeekCalendar'), { ssr: false });
const WeekHeader = dynamic(() => import('./components/WeekHeader'), { ssr: false });
const LessonModal = dynamic(() => import('./components/LessonModal'), { ssr: false });
const GroupSearch = dynamic(() => import('./components/GroupSearch'), { ssr: false });
const SettingsView = dynamic(() => import('./components/SettingsView'), { ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView'), { ssr: false });
const LAST_TIMETABLE_CACHE_KEY = 'ehuntis_timetable_last_v1';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getDefaultDate() {
  const now = new Date();

  if (now.getDay() === 0) {
    now.setDate(now.getDate() + 1);
  } else if (now.getDay() === 6) {
    now.setDate(now.getDate() + 2);
  }

  const m = now.getMonth();
  if (m === 6 || m === 7 || (m === 8 && now.getDate() < 7)) {
    return new Date(now.getFullYear(), 8, 7);
  }
  return now;
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

function getInitialSemesterTimetable() {
  const parsedLast = readStoredJson(LAST_TIMETABLE_CACHE_KEY, null);
  return Array.isArray(parsedLast?.data) ? parsedLast.data : [];
}

// ─── Header label ─────────────────────────────────────────────────────────────

// Header label function removed

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState('horarios');
  const [allClasses, setAllClasses] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(() => readStoredJson('ehuntis_groups_v2', []));
  const [disabledGroupIds, setDisabledGroupIds] = useState(() => readStoredJson('ehuntis_disabled_groups_v2', []));

  // Per-group disabled subjects: { [groupKey]: [subjectId, ...] }
  const [disabledSubjectsByGroup, setDisabledSubjectsByGroup] = useState(() => readStoredJson('ehuntis_disabled_v2', {}));
  // Per-group disabled subgroup numbers: { [groupKey]: [1, 2, ...] }
  const [disabledSubgroupNumbersByGroup, setDisabledSubgroupNumbersByGroup] = useState(() => readStoredJson('ehuntis_disabled_subgroups_v2', {}));

  const [semesterTimetable, setSemesterTimetable] = useState(() => getInitialSemesterTimetable());
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [initDone] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [currentMonday, setCurrentMonday] = useState(() => getWeekMonday(getDefaultDate()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDayView, setIsDayView] = useState(false);

  const [activeLesson, setActiveLesson] = useState(null);
  const [showGroupSearch, setShowGroupSearch] = useState(false);

  const weekDates = getWeekDates(currentMonday);

  const groupKey = (g) => String(g.uniqueId || g.id);
  const activeGroups = useMemo(
    () => selectedGroups.filter(g => !disabledGroupIds.includes(groupKey(g))),
    [selectedGroups, disabledGroupIds]
  );

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(d => { if (!d.error) setAllClasses(d); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_groups_v2', JSON.stringify(selectedGroups));
  }, [selectedGroups, initDone]);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_disabled_v2', JSON.stringify(disabledSubjectsByGroup));
  }, [disabledSubjectsByGroup, initDone]);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_disabled_groups_v2', JSON.stringify(disabledGroupIds));
  }, [disabledGroupIds, initDone]);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_disabled_subgroups_v2', JSON.stringify(disabledSubgroupNumbersByGroup));
  }, [disabledSubgroupNumbersByGroup, initDone]);

  // ── Timetable fetching ────────────────────────────────────────────────────
  useEffect(() => {
    if (!initDone || activeGroups.length === 0) return;

    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    // Academic year runs from Sept 1 (startYear) to June 30 (startYear + 1)
    // If today is Aug-Dec (month >= 7), startYear is current year
    // If today is Jan-July (month < 7), startYear is previous year
    const startYear = month >= 7 ? year : year - 1;

    const startDate = new Date(startYear, 8, 1); // Sept 1
    const endDate = new Date(startYear + 1, 5, 30); // June 30

    const ids = activeGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).sort().join(',');
    const cacheKey = `ehuntis_timetable_cache_${ids}_${startDate.getFullYear()}_${startDate.getMonth()}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.data)) {
          Promise.resolve().then(() => setSemesterTimetable(parsed.data));
        }
        // Check if cache is younger than 24h
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) return;
      }
    } catch (e) {}

    Promise.resolve().then(() => setLoadingTimetable(true));

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    fetch(`/api/timetable?classIds=${ids}&startDate=${startStr}&endDate=${endStr}`)
      .then(r => r.json())
      .then(d => { 
        if (!d.error) {
          setSemesterTimetable(d); 
          try {
            const cachePayload = {
              timestamp: Date.now(),
              data: d
            };
            localStorage.setItem(cacheKey, JSON.stringify({
              ...cachePayload
            }));
            localStorage.setItem(LAST_TIMETABLE_CACHE_KEY, JSON.stringify(cachePayload));
          } catch(e) {}
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTimetable(false));
  }, [activeGroups, initDone, refreshTrigger]);

  const timetable = useMemo(() => {
    const endOfWeek = new Date(currentMonday);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return semesterTimetable.filter(lesson => {
      const lessonDateStr = String(lesson.date);
      const y = parseInt(lessonDateStr.substring(0, 4));
      const m = parseInt(lessonDateStr.substring(4, 6)) - 1;
      const d = parseInt(lessonDateStr.substring(6, 8));
      const lessonDate = new Date(y, m, d);
      return lessonDate >= currentMonday && lessonDate <= endOfWeek;
    });
  }, [semesterTimetable, currentMonday]);

  const forceRefreshTimetable = useCallback(() => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ehuntis_timetable_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
    // We intentionally DO NOT clear semesterTimetable here to prevent screen blanking
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ── Per-group subject index ───────────────────────────────────────────────
  // Build { [groupKey]: [{ id, name, shortName }] } from the semester timetable
  const timetableByGroup = {};
  const availableSubgroupsByGroup = {};

  activeGroups.forEach(g => {
    const key = groupKey(g);
    const seen = new Map();
    const subgroupNums = new Set();

    // We scan the ENTIRE semester timetable to find all available subjects and subgroups
    semesterTimetable.forEach(lesson => {
      // Check if this lesson belongs to this group
      const belongsToGroup = lesson.classIds?.some(id => {
        const gIds = Array.isArray(g.id) ? g.id : [g.id];
        return gIds.includes(id);
      }) || (lesson.classId && (Array.isArray(g.id) ? g.id : [g.id]).includes(lesson.classId));

      if (belongsToGroup) {
        (lesson.subjectIds || []).forEach((id, idx) => {
          if (!seen.has(id)) {
            seen.set(id, {
              id,
              name: lesson.subjects?.[idx] || String(id),
              shortName: lesson.subjectShortNames?.[idx] || '',
            });
          }
        });

        const subNum = extractSubgroupNumber(lesson.type);
        if (subNum !== null) {
          subgroupNums.add(subNum);
        }
      }
    });
    timetableByGroup[key] = Array.from(seen.values());
    availableSubgroupsByGroup[key] = Array.from(subgroupNums).sort((a,b) => a - b);
  });

  // ── Filtered timetable ────────────────────────────────────────────────────
  const filteredTimetable = timetable.filter(lesson => {
    // A lesson might belong to multiple groups. It is shown if it is NOT disabled in AT LEAST ONE of its active owner groups.
    const ownerGroups = activeGroups.filter(g => {
      const gIds = Array.isArray(g.id) ? g.id : [g.id];
      return lesson.classIds?.some(id => gIds.includes(id)) || (lesson.classId && gIds.includes(lesson.classId));
    });

    if (ownerGroups.length === 0) return true;

    return ownerGroups.some(g => {
      const key = groupKey(g);
      const disabledSubjs = disabledSubjectsByGroup[key] || [];
      const disabledSubgroups = disabledSubgroupNumbersByGroup[key] || [];

      // Check if subject is disabled
      if (lesson.subjectIds?.some(id => disabledSubjs.includes(id))) {
        return false;
      }

      // Check if subgroup is disabled
      const lessonSubNum = extractSubgroupNumber(lesson.type);
      if (lessonSubNum !== null && disabledSubgroups.includes(lessonSubNum)) {
        return false;
      }

      return true;
    });
  });

  // ── Group management ───────────────────────────────────────────────────────
  const addGroup = useCallback((c) => {
    setSelectedGroups(prev => {
      if (prev.find(g => (g.uniqueId && g.uniqueId === c.uniqueId) || g.id === c.id)) return prev;
      return [...prev, c];
    });
  }, []);

  const removeGroup = useCallback((g) => {
    const key = groupKey(g);
    setSelectedGroups(prev => prev.filter(x => x.id !== g.id));
    setDisabledSubjectsByGroup(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const toggleSubjectForGroup = useCallback((gKey, subjectId) => {
    setDisabledSubjectsByGroup(prev => {
      const current = prev[gKey] || [];
      const next = current.includes(subjectId)
        ? current.filter(id => id !== subjectId)
        : [...current, subjectId];
      return { ...prev, [gKey]: next };
    });
  }, []);

  const toggleSubgroupForGroup = useCallback((gKey, subNum) => {
    setDisabledSubgroupNumbersByGroup(prev => {
      const current = prev[gKey] || [];
      const next = current.includes(subNum)
        ? current.filter(n => n !== subNum)
        : [...current, subNum];
      return { ...prev, [gKey]: next };
    });
  }, []);

  const toggleGroupDisabled = useCallback((gKey) => {
    setDisabledGroupIds(prev => prev.includes(gKey) ? prev.filter(id => id !== gKey) : [...prev, gKey]);
  }, []);

  // ── Week navigation ────────────────────────────────────────────────────────
  const getAcademicYearBounds = () => {
    const today = new Date();
    const month = today.getMonth();
    const startYear = month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    return {
      minDate: new Date(startYear, 8, 1), // Sept 1
      maxDate: new Date(startYear + 1, 5, 30) // June 30
    };
  };

  const goToPrevWeek = () => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      const { minDate } = getAcademicYearBounds();
      // Ensure we don't go before Sept 1 of the current academic year
      if (d < getWeekMonday(minDate)) return prev;
      return d;
    });
  };

  const goToNextWeek = () => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      const { maxDate } = getAcademicYearBounds();
      // Ensure we don't go past June 30 of the current academic year
      if (d > getWeekMonday(maxDate)) return prev;
      return d;
    });
  };

  const handlePrevDay = () => {
    setSelectedDay(prev => {
      if (!prev) return prev;
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      // Skip weekends
      if (d.getDay() === 0) d.setDate(d.getDate() - 2);
      else if (d.getDay() === 6) d.setDate(d.getDate() - 1);

      if (d < currentMonday) {
        setCurrentMonday(getWeekMonday(d));
      }
      return d;
    });
  };

  const handleNextDay = () => {
    setSelectedDay(prev => {
      if (!prev) return prev;
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      // Skip weekends
      if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      else if (d.getDay() === 0) d.setDate(d.getDate() + 1);

      const nextMonday = new Date(currentMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      if (d >= nextMonday) {
        setCurrentMonday(getWeekMonday(d));
      }
      return d;
    });
  };

  const handleSelectDay = (date) => {
    if (isDayView && selectedDay && isSameDay(selectedDay, date)) {
      setIsDayView(false);
      setSelectedDay(null);
    } else {
      setSelectedDay(date);
      setIsDayView(true);
    }
  };

  const handlePickDate = (pickedDate) => {
    const { minDate, maxDate } = getAcademicYearBounds();
    const date = new Date(pickedDate);
    date.setHours(0, 0, 0, 0);

    // Sábado o domingo: saltar al viernes de esa misma semana (en vez de ignorar el clic)
    if (date.getDay() === 6) date.setDate(date.getDate() - 1);
    else if (date.getDay() === 0) date.setDate(date.getDate() - 2);

    if (date < minDate) date.setTime(minDate.getTime());
    if (date > maxDate) date.setTime(maxDate.getTime());

    if (isDayView) {
      setSelectedDay(date);
      setCurrentMonday(getWeekMonday(date));
      return;
    }

    setCurrentMonday(getWeekMonday(date));
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
            selectedDay={selectedDay}
            isDayView={isDayView}
            onSelectDay={handleSelectDay}
            onPrevWeek={goToPrevWeek}
            onNextWeek={goToNextWeek}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
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

          {!loadingTimetable && activeGroups.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-muted)' }}>
                <CalendarSearch size={48} strokeWidth={1.5} />
              </div>
              <div className="empty-state-title">Tu horario aquí</div>
              <div className="empty-state-body">
                {selectedGroups.length === 0 
                  ? 'Ve a ajustes para añadir tus grupos y asignaturas.' 
                  : 'Todos tus grupos están ocultos. Ve a ajustes para activarlos.'}
              </div>
              <button className="empty-cta-btn" onClick={() => setActiveTab('ajustes')}>
                Ir a Ajustes
              </button>
            </div>
          )}

          {activeGroups.length > 0 && (
            <WeekCalendar
              lessons={filteredTimetable}
              onLessonClick={setActiveLesson}
              weekDates={isDayView && selectedDay ? [selectedDay] : weekDates}
              onSwipeLeft={isDayView ? handleNextDay : goToNextWeek}
              onSwipeRight={isDayView ? handlePrevDay : goToPrevWeek}
            />
          )}
        </>
      )}

      {activeTab === 'ajustes' && (
        <SettingsView
          onForceRefresh={forceRefreshTimetable}
          isRefreshingTimetable={loadingTimetable}
          selectedGroups={selectedGroups}
          disabledGroupIds={disabledGroupIds}
          disabledSubjectsByGroup={disabledSubjectsByGroup}
          timetableByGroup={timetableByGroup}
          availableSubgroupsByGroup={availableSubgroupsByGroup}
          disabledSubgroupNumbersByGroup={disabledSubgroupNumbersByGroup}
          onToggleSubjectForGroup={toggleSubjectForGroup}
          onToggleSubgroupForGroup={toggleSubgroupForGroup}
          onToggleGroupDisabled={toggleGroupDisabled}
          onRemoveGroup={removeGroup}
          onAddGroup={() => setShowGroupSearch(true)}
        />
      )}

      {activeTab === 'info' && <ProfileView />}

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'ajustes' ? ' active' : ''}`}
          onClick={() => setActiveTab('ajustes')}
          id="tab-ajustes"
        >
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}><SettingsIcon size={20} strokeWidth={2} /></span>
          <span className="tab-label">Ajustes</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'horarios' ? ' active' : ''}`}
          onClick={() => setActiveTab('horarios')}
          id="tab-horarios"
        >
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}><CalendarIcon size={20} strokeWidth={2} /></span>
          <span className="tab-label">Horarios</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'info' ? ' active' : ''}`}
          onClick={() => setActiveTab('info')}
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
          onClose={() => setActiveLesson(null)}
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
