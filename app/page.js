'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { extractSubgroupNumber } from './utils/subgroups';
import { Settings as SettingsIcon, Calendar as CalendarIcon, User as UserIcon, CalendarSearch } from 'lucide-react';

const WeekCalendar = dynamic(() => import('./components/WeekCalendar'), { ssr: false });
const WeekHeader = dynamic(() => import('./components/WeekHeader'), { ssr: false });
const LessonModal = dynamic(() => import('./components/LessonModal'), { ssr: false });
const GroupSearch = dynamic(() => import('./components/GroupSearch'), { ssr: false });
const SettingsView = dynamic(() => import('./components/SettingsView'), { ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView'), { ssr: false });

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

// ─── Header label ─────────────────────────────────────────────────────────────

// Header label function removed

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState('horarios');
  const [allClasses, setAllClasses] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [disabledGroupIds, setDisabledGroupIds] = useState([]);

  // Per-group disabled subjects: { [groupKey]: [subjectId, ...] }
  const [disabledSubjectsByGroup, setDisabledSubjectsByGroup] = useState({});
  // Per-group disabled subgroup numbers: { [groupKey]: [1, 2, ...] }
  const [disabledSubgroupNumbersByGroup, setDisabledSubgroupNumbersByGroup] = useState({});

  const [timetable, setTimetable] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const [currentMonday, setCurrentMonday] = useState(() => getWeekMonday(getDefaultDate()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDayView, setIsDayView] = useState(false);

  const [activeLesson, setActiveLesson] = useState(null);
  const [showGroupSearch, setShowGroupSearch] = useState(false);

  const weekDates = getWeekDates(currentMonday);

  const groupKey = (g) => String(g.uniqueId || g.id);
  const activeGroups = selectedGroups.filter(g => !disabledGroupIds.includes(groupKey(g)));

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const sg = localStorage.getItem('ehuntis_groups_v2');
      const ds = localStorage.getItem('ehuntis_disabled_v2');
      const dg = localStorage.getItem('ehuntis_disabled_groups_v2');
      const dsub = localStorage.getItem('ehuntis_disabled_subgroups_v2');
      if (sg) setSelectedGroups(JSON.parse(sg));
      if (ds) setDisabledSubjectsByGroup(JSON.parse(ds));
      if (dg) setDisabledGroupIds(JSON.parse(dg));
      if (dsub) setDisabledSubgroupNumbersByGroup(JSON.parse(dsub));
    } catch (_) {}
    setInitDone(true);

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
    if (!initDone || activeGroups.length === 0) {
      setTimetable([]);
      return;
    }
    setLoadingTimetable(true);
    const ids = activeGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).join(',');
    const dateStr = [
      currentMonday.getFullYear(),
      String(currentMonday.getMonth() + 1).padStart(2, '0'),
      String(currentMonday.getDate()).padStart(2, '0'),
    ].join('-');

    fetch(`/api/timetable?classIds=${ids}&date=${dateStr}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setTimetable(d); })
      .catch(console.error)
      .finally(() => setLoadingTimetable(false));
  }, [selectedGroups, disabledGroupIds, currentMonday, initDone]);

  // ── Per-group subject index ───────────────────────────────────────────────
  // Build { [groupKey]: [{ id, name, shortName }] } from the timetable
  const timetableByGroup = {};
  const availableSubgroupsByGroup = {};
  
  activeGroups.forEach(g => {
    const key = groupKey(g);
    const seen = new Map();
    const subgroupNums = new Set();
    
    timetable.forEach(lesson => {
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
  const goToPrevWeek = () => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
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
          />

          {loadingTimetable && (
            <div className="spinner-wrap" style={{ flex: 1 }}>
              <div className="spinner" />
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

          {!loadingTimetable && activeGroups.length > 0 && (
            <WeekCalendar
              lessons={filteredTimetable}
              onLessonClick={setActiveLesson}
              weekDates={isDayView && selectedDay ? [selectedDay] : weekDates}
            />
          )}
        </>
      )}

      {activeTab === 'ajustes' && (
        <SettingsView
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
