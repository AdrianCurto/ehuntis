'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const WeekCalendar = dynamic(() => import('./components/WeekCalendar'), { ssr: false });
const WeekHeader = dynamic(() => import('./components/WeekHeader'), { ssr: false });
const LessonModal = dynamic(() => import('./components/LessonModal'), { ssr: false });
const GroupSearch = dynamic(() => import('./components/GroupSearch'), { ssr: false });
const SettingsView = dynamic(() => import('./components/SettingsView'), { ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView'), { ssr: false });

// ─── Date helpers ─────────────────────────────────────────────────────────────

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
  const m = now.getMonth();
  if (m === 6 || m === 7 || (m === 8 && now.getDate() < 7)) {
    return new Date(now.getFullYear() + (m >= 9 ? 1 : 0), 8, 7);
  }
  return now;
}

// ─── Header label ─────────────────────────────────────────────────────────────

function buildHeaderLabel(groups) {
  if (groups.length === 0) return 'EHUntis';
  if (groups.length === 1) return groups[0].name;
  if (groups.length === 2) return `${groups[0].name} · ${groups[1].name}`;
  return `${groups[0].name} +${groups.length - 1}`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState('horarios');
  const [allClasses, setAllClasses] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  // Per-group disabled subjects: { [groupKey]: [subjectId, ...] }
  const [disabledSubjectsByGroup, setDisabledSubjectsByGroup] = useState({});

  const [timetable, setTimetable] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const defaultDate = getDefaultDate();
  const [currentMonday, setCurrentMonday] = useState(() => getWeekMonday(defaultDate));
  const [selectedDay, setSelectedDay] = useState(defaultDate);

  const [activeLesson, setActiveLesson] = useState(null);
  const [showGroupSearch, setShowGroupSearch] = useState(false);

  const weekDates = getWeekDates(currentMonday);

  const groupKey = (g) => String(g.uniqueId || g.id);

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const sg = localStorage.getItem('ehuntis_groups_v2');
      const ds = localStorage.getItem('ehuntis_disabled_v2');
      if (sg) setSelectedGroups(JSON.parse(sg));
      if (ds) setDisabledSubjectsByGroup(JSON.parse(ds));
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

  // ── Timetable fetching ────────────────────────────────────────────────────
  useEffect(() => {
    if (!initDone || selectedGroups.length === 0) {
      setTimetable([]);
      return;
    }
    setLoadingTimetable(true);
    const ids = selectedGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).join(',');
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
  }, [selectedGroups, currentMonday, initDone]);

  // ── Per-group subject index ───────────────────────────────────────────────
  // Build { [groupKey]: [{ id, name, shortName }] } from the timetable
  const timetableByGroup = {};
  selectedGroups.forEach(g => {
    const key = groupKey(g);
    const seen = new Map();
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
      }
    });
    timetableByGroup[key] = Array.from(seen.values());
  });

  // ── Filtered timetable ────────────────────────────────────────────────────
  const filteredTimetable = timetable.filter(lesson => {
    // A lesson might belong to multiple groups. It is shown if it is NOT disabled in AT LEAST ONE of its owner groups.
    const ownerGroups = selectedGroups.filter(g => {
      const gIds = Array.isArray(g.id) ? g.id : [g.id];
      return lesson.classIds?.some(id => gIds.includes(id)) || (lesson.classId && gIds.includes(lesson.classId));
    });
    
    if (ownerGroups.length === 0) return true;
    
    return ownerGroups.some(g => {
      const key = groupKey(g);
      const disabled = disabledSubjectsByGroup[key] || [];
      // If none of the lesson's subjects are in the disabled list for this group, then it is visible
      return !lesson.subjectIds?.some(id => disabled.includes(id));
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
      {/* Header */}
      <header className="app-header">
        <button
          className="header-group-btn"
          onClick={() => setShowGroupSearch(true)}
          aria-label="Seleccionar grupo"
        >
          {buildHeaderLabel(selectedGroups)}
          <span className="header-chevron">▾</span>
        </button>
      </header>

      {/* Content */}
      {activeTab === 'horarios' && (
        <>
          <WeekHeader
            weekDates={weekDates}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onPrevWeek={goToPrevWeek}
            onNextWeek={goToNextWeek}
          />

          {loadingTimetable && (
            <div className="spinner-wrap" style={{ flex: 1 }}>
              <div className="spinner" />
            </div>
          )}

          {!loadingTimetable && selectedGroups.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">Tu horario aquí</div>
              <div className="empty-state-body">
                Busca y añade tu grupo para ver tu horario de la semana.
              </div>
              <button className="empty-cta-btn" onClick={() => setShowGroupSearch(true)}>
                Añadir grupo
              </button>
            </div>
          )}

          {!loadingTimetable && selectedGroups.length > 0 && (
            <WeekCalendar
              lessons={filteredTimetable}
              onLessonClick={setActiveLesson}
              weekDates={weekDates}
            />
          )}
        </>
      )}

      {activeTab === 'ajustes' && (
        <SettingsView
          selectedGroups={selectedGroups}
          disabledSubjectsByGroup={disabledSubjectsByGroup}
          timetableByGroup={timetableByGroup}
          onToggleSubjectForGroup={toggleSubjectForGroup}
          onRemoveGroup={removeGroup}
          onAddGroup={() => setShowGroupSearch(true)}
        />
      )}

      {activeTab === 'perfil' && <ProfileView />}

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'ajustes' ? ' active' : ''}`}
          onClick={() => setActiveTab('ajustes')}
          id="tab-ajustes"
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Ajustes</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'horarios' ? ' active' : ''}`}
          onClick={() => setActiveTab('horarios')}
          id="tab-horarios"
        >
          <span className="tab-icon">📅</span>
          <span className="tab-label">Horarios</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'perfil' ? ' active' : ''}`}
          onClick={() => setActiveTab('perfil')}
          id="tab-perfil"
        >
          <span className="tab-icon">👤</span>
          <span className="tab-label">Perfil</span>
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
