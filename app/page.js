'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load heavy components
const WeekCalendar = dynamic(() => import('./components/WeekCalendar'), { ssr: false });
const WeekHeader = dynamic(() => import('./components/WeekHeader'), { ssr: false });
const LessonModal = dynamic(() => import('./components/LessonModal'), { ssr: false });
const GroupSearch = dynamic(() => import('./components/GroupSearch'), { ssr: false });
const SettingsView = dynamic(() => import('./components/SettingsView'), { ssr: false });
const ProfileView = dynamic(() => import('./components/ProfileView'), { ssr: false });

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date` */
function getWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns Mon–Fri dates for a given Monday */
function getWeekDates(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Default date: current week, unless it's summer → go to Sept 7 */
function getDefaultDate() {
  const now = new Date();
  const m = now.getMonth(); // 0-indexed
  if (m === 6 || m === 7 || (m === 8 && now.getDate() < 7)) {
    return new Date(now.getFullYear() + (m >= 9 ? 1 : 0), 8, 7); // Sept 7
  }
  return now;
}

// ─── Header label helpers ────────────────────────────────────────────────────

function buildHeaderLabel(selectedGroups) {
  if (selectedGroups.length === 0) return 'EHUntis';
  if (selectedGroups.length === 1) return selectedGroups[0].name;
  if (selectedGroups.length === 2) return `${selectedGroups[0].name} · ${selectedGroups[1].name}`;
  return `${selectedGroups[0].name} +${selectedGroups.length - 1}`;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function Home() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('horarios');
  const [allClasses, setAllClasses] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [disabledSubjects, setDisabledSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const defaultDate = getDefaultDate();
  const [currentMonday, setCurrentMonday] = useState(() => getWeekMonday(defaultDate));
  const [selectedDay, setSelectedDay] = useState(defaultDate);

  const [activeLesson, setActiveLesson] = useState(null); // modal
  const [showGroupSearch, setShowGroupSearch] = useState(false);

  const weekDates = getWeekDates(currentMonday);

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const sg = localStorage.getItem('ehuntis_groups');
      const ds = localStorage.getItem('ehuntis_disabled');
      if (sg) setSelectedGroups(JSON.parse(sg));
      if (ds) setDisabledSubjects(JSON.parse(ds));
    } catch (_) {}
    setInitDone(true);

    // Fetch class list
    fetch('/api/classes')
      .then(r => r.json())
      .then(d => { if (!d.error) setAllClasses(d); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_groups', JSON.stringify(selectedGroups));
  }, [selectedGroups, initDone]);

  useEffect(() => {
    if (initDone) localStorage.setItem('ehuntis_disabled', JSON.stringify(disabledSubjects));
  }, [disabledSubjects, initDone]);

  // ── Timetable fetching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!initDone || selectedGroups.length === 0) {
      setTimetable([]);
      return;
    }
    setLoadingTimetable(true);
    const ids = selectedGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).join(',');
    const dateStr = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, '0')}-${String(currentMonday.getDate()).padStart(2, '0')}`;
    fetch(`/api/timetable?classIds=${ids}&date=${dateStr}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setTimetable(d); })
      .catch(console.error)
      .finally(() => setLoadingTimetable(false));
  }, [selectedGroups, currentMonday, initDone]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredTimetable = timetable.filter(l =>
    !l.subjectIds?.some(id => disabledSubjects.includes(id))
  );

  const uniqueSubjects = [];
  timetable.forEach(lesson => {
    (lesson.subjects || []).forEach((name, idx) => {
      const id = lesson.subjectIds?.[idx];
      if (id && !uniqueSubjects.find(s => s.id === id)) {
        uniqueSubjects.push({ id, name });
      }
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
    setSelectedGroups(prev => prev.filter(x => x.id !== g.id));
  }, []);

  const toggleSubject = useCallback((id) => {
    setDisabledSubjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleGroup = useCallback((g) => {
    const key = 'group_' + (g.uniqueId || g.id);
    setDisabledSubjects(prev =>
      prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
    );
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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!initDone) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  const headerLabel = buildHeaderLabel(selectedGroups);

  return (
    <div className="app-shell">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="app-header">
        <button
          className="header-group-btn"
          onClick={() => setShowGroupSearch(true)}
          aria-label="Seleccionar grupo"
        >
          {headerLabel}
          <span className="header-chevron">▾</span>
        </button>
        <button className="header-menu-btn" aria-label="Menú">⋯</button>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
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
            <div className="spinner-wrap"><div className="spinner" /></div>
          )}

          {!loadingTimetable && selectedGroups.length === 0 && (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">Sin horario</div>
              <div className="empty-state-body">
                Añade tu grupo para ver tu horario personalizado.
              </div>
              <button className="empty-cta-btn" onClick={() => setShowGroupSearch(true)}>
                Añadir grupo
              </button>
            </div>
          )}

          {!loadingTimetable && selectedGroups.length > 0 && (
            <WeekCalendar
              lessons={filteredTimetable}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onLessonClick={setActiveLesson}
              weekDates={weekDates}
            />
          )}
        </>
      )}

      {activeTab === 'ajustes' && (
        <SettingsView
          selectedGroups={selectedGroups}
          disabledSubjects={disabledSubjects}
          uniqueSubjects={uniqueSubjects}
          onToggleGroup={toggleGroup}
          onToggleSubject={toggleSubject}
          onRemoveGroup={removeGroup}
          onAddGroup={() => setShowGroupSearch(true)}
        />
      )}

      {activeTab === 'perfil' && <ProfileView />}

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
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

      {/* ── Modals ───────────────────────────────────────────────────────── */}
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
