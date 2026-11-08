'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  Trash2, 
  Library, 
  Plus, 
  Edit2, 
  Copy, 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Ban,
  ArrowUpDown,
  Pencil,
  Check,
  X,
  Search,
  FileText,
  ChevronDown
} from 'lucide-react';
import {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle,
} from '../utils/colorLogic';
import { formatRooms } from '../utils/subgroups';
import { formatTime } from '../utils/lessonOverrides';
import { toDateNumber } from '../utils/dayLogic';

function parseDateNumber(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle" htmlFor={id} onClick={(e) => e.stopPropagation()}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}

function ChevronIcon({ open }) {
  return (
    <ChevronRight
      size={18}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
    />
  );
}

export default function SettingsView({
  theme = 'system',
  onThemeChange,

  configs = [],
  activeConfigId,
  onSelectConfig,
  onCreateConfig,
  onRenameConfig,
  onDuplicateConfig,
  onDeleteConfig,

  timetableByGroup,
  availableSubgroupsBySubject = {},

  showDimmedSubgroups = false,
  onToggleShowDimmedSubgroups,
  onToggleAllSubgroupsForGroup,

  onToggleGroupDisabled,
  onToggleSubjectForGroup,
  onToggleSubgroupForSubject,
  onRemoveGroup,
  onAddGroup,

  customColors = {},
  resolvedSubjectColors = {},
  onSetSubjectColor,
  onResetSingleSubjectColor,
  onResetSubjectColors,
  isDark = false,

  // Event & Overrides Management
  customEvents = [],
  onCreateCustomEvent,
  onEditCustomEvent,
  onDeleteCustomEvent,
  lessonOverrides = {},
  timetable = [],
  onResetLessonOverride,
  onResetAllLessonOverrides,
}) {
  const [settingsTab, setSettingsTab] = useState('groups'); // 'groups' | 'custom' | 'appearance'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [pickerSubjectId, setPickerSubjectId] = useState(null);

  // Filters & State for Custom Events and Overrides Manager
  const [timeScope, setTimeScope] = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [typeFilter, setTypeFilter] = useState('all');     // 'all' | 'cancelled' | 'swapped' | 'edited' | 'custom'
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(25);

  // Modals state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetAllOverridesModalOpen, setResetAllOverridesModalOpen] = useState(false);

  useEffect(() => {
    if (!pickerSubjectId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.color-picker-popover') && !e.target.closest('.subject-color-btn')) {
        setPickerSubjectId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [pickerSubjectId]);

  const activeConfig = configs.find(c => c.id === activeConfigId) || configs[0] || {
    id: 'default',
    name: 'Configuración 1',
    selectedGroups: [],
    disabledGroupIds: [],
    disabledSubjectsByGroup: {},
    disabledSubgroupsBySubject: {},
  };

  const selectedGroups = activeConfig.selectedGroups || [];
  const disabledGroupIds = activeConfig.disabledGroupIds || [];
  const disabledSubjectsByGroup = activeConfig.disabledSubjectsByGroup || {};
  const disabledSubgroupsBySubject = activeConfig.disabledSubgroupsBySubject || {};

  const toggleExpanded = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupKey = (g) => String(g.uniqueId || g.id);

  const openRenameModal = () => {
    setRenameValue(activeConfig.name);
    setRenameModalOpen(true);
  };

  const handleRenameSubmit = (e) => {
    e?.preventDefault();
    if (renameValue.trim()) {
      onRenameConfig(activeConfig.id, renameValue.trim());
      setRenameModalOpen(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedGroups.length === 0) {
      onDeleteConfig(activeConfig.id);
    } else {
      setDeleteModalOpen(true);
    }
  };

  // ── Unified, Sorted and Filtered Overrides & Custom Events ───────────────
  const today = useMemo(() => new Date(), []);
  const todayNum = useMemo(() => toDateNumber(today), [today]);

  const currentMonday = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  const endOfWeekNum = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(sun.getDate() + 6);
    return toDateNumber(sun);
  }, [currentMonday]);

  const endOfMonthNum = useMemo(() => {
    const endM = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return toDateNumber(endM);
  }, [today]);

  // Aggregate all items: overrides + custom events
  const allCustomItems = useMemo(() => {
    const items = [];

    // 1. Lesson Overrides
    if (lessonOverrides && typeof lessonOverrides === 'object') {
      Object.entries(lessonOverrides).forEach(([key, ov]) => {
        if (!ov) return;
        const matched = timetable.find(l => (l.lessonKey && l.lessonKey === key) || (l.id && l.id === ov.lessonId));
        const snap = ov.originalSnapshot || {};
        const subjectName = matched?.subjects?.[0] || ov.swappedWith?.subjectName || 'Clase';
        const dateNum = ov.customDate || ov.date || matched?.date || snap.date || 0;
        const dateObj = parseDateNumber(dateNum);

        let type = 'edited';
        if (ov.userCancelled) type = 'cancelled';
        else if (ov.swappedWith) type = 'swapped';

        const isPast = dateNum < todayNum;
        const isThisWeek = dateNum >= todayNum && dateNum <= endOfWeekNum;
        const isThisMonth = dateNum > endOfWeekNum && dateNum <= endOfMonthNum;

        items.push({
          id: key,
          key,
          itemKind: 'override',
          type,
          title: subjectName,
          dateNum,
          dateObj,
          startTime: ov.customStartTime ?? matched?.startTime ?? snap.startTime ?? 0,
          endTime: ov.customEndTime ?? matched?.endTime ?? snap.endTime ?? 0,
          rooms: ov.customRooms || matched?.rooms || snap.rooms || [],
          notes: ov.customNotes || '',
          swappedWith: ov.swappedWith || null,
          snap,
          isPast,
          isThisWeek,
          isThisMonth,
        });
      });
    }

    // 2. Custom Events
    if (Array.isArray(customEvents)) {
      customEvents.forEach(evt => {
        const raw = evt.rawEvent || evt;
        const isWeekly = raw.recurrence?.type === 'weekly';
        const dateNum = raw.recurrence?.date || 0;
        const dateObj = parseDateNumber(dateNum);

        // Weekly events are considered active/upcoming unless an explicit end date has passed
        let isPast = false;
        if (!isWeekly && dateNum > 0) {
          isPast = dateNum < todayNum;
        } else if (isWeekly && raw.recurrence?.endDate) {
          isPast = raw.recurrence.endDate < todayNum;
        }

        const isThisWeek = !isPast && (isWeekly || (dateNum >= todayNum && dateNum <= endOfWeekNum));
        const isThisMonth = !isPast && !isThisWeek && (dateNum > endOfWeekNum && dateNum <= endOfMonthNum);

        items.push({
          id: raw.id,
          key: raw.id,
          itemKind: 'custom_event',
          type: 'custom',
          title: raw.title || 'Evento personal',
          category: raw.category || '',
          colorIndex: raw.colorIndex ?? 4,
          isWeekly,
          recurrence: raw.recurrence,
          dateNum,
          dateObj,
          startTime: raw.startTime ?? 800,
          endTime: raw.endTime ?? 900,
          rooms: raw.location ? [raw.location] : [],
          notes: raw.notes || '',
          rawEvent: raw,
          isPast,
          isThisWeek,
          isThisMonth,
        });
      });
    }

    return items;
  }, [lessonOverrides, timetable, customEvents, todayNum, endOfWeekNum, endOfMonthNum]);

  // Counts for filters and stats
  const stats = useMemo(() => {
    let upcomingCount = 0;
    let pastCount = 0;
    let cancelledCount = 0;
    let swappedCount = 0;
    let editedCount = 0;
    let customCount = 0;

    allCustomItems.forEach(item => {
      if (item.isPast) pastCount++;
      else upcomingCount++;

      if (item.type === 'cancelled') cancelledCount++;
      else if (item.type === 'swapped') swappedCount++;
      else if (item.type === 'edited') editedCount++;
      else if (item.type === 'custom') customCount++;
    });

    return {
      total: allCustomItems.length,
      upcomingCount,
      pastCount,
      cancelledCount,
      swappedCount,
      editedCount,
      customCount,
    };
  }, [allCustomItems]);

  // Filter and sort items based on user selection
  const filteredItems = useMemo(() => {
    let list = allCustomItems.filter(item => {
      // 1. Time scope filter
      if (timeScope === 'upcoming' && item.isPast) return false;
      if (timeScope === 'past' && !item.isPast) return false;

      // 2. Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'custom' && item.itemKind !== 'custom_event') return false;
        if (typeFilter !== 'custom' && item.type !== typeFilter) return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const t = (item.title || '').toLowerCase();
        const r = (item.rooms || []).join(' ').toLowerCase();
        const n = (item.notes || '').toLowerCase();
        const c = (item.category || '').toLowerCase();
        const sw = (item.swappedWith?.subjectName || '').toLowerCase();
        if (!t.includes(q) && !r.includes(q) && !n.includes(q) && !c.includes(q) && !sw.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // Sort order:
    // Past: descending (most recent first)
    // Upcoming/All: ascending (nearest first, weekly events floating cleanly)
    list.sort((a, b) => {
      if (timeScope === 'past') {
        return (b.dateNum || 0) - (a.dateNum || 0) || b.startTime - a.startTime;
      }
      return (a.dateNum || 0) - (b.dateNum || 0) || a.startTime - b.startTime;
    });

    return list;
  }, [allCustomItems, timeScope, typeFilter, searchQuery]);

  // Group by timeline section
  const groupedItems = useMemo(() => {
    const groups = {
      thisWeek: [],
      thisMonth: [],
      later: [],
      past: [],
    };

    filteredItems.forEach(item => {
      if (item.isPast) {
        groups.past.push(item);
      } else if (item.isThisWeek || item.isWeekly) {
        groups.thisWeek.push(item);
      } else if (item.isThisMonth) {
        groups.thisMonth.push(item);
      } else {
        groups.later.push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  const displayedList = useMemo(() => {
    return filteredItems.slice(0, visibleLimit);
  }, [filteredItems, visibleLimit]);

  return (
    <div className="settings-view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div className="settings-title">Ajustes</div>
      </div>

      {/* ── Modern Segmented Nav ────────────────────────────────────────────── */}
      <div className="settings-segmented-nav" role="tablist" aria-label="Secciones de ajustes">
        <button
          type="button"
          role="tab"
          aria-selected={settingsTab === 'groups'}
          className={`settings-nav-tab${settingsTab === 'groups' ? ' active' : ''}`}
          onClick={() => setSettingsTab('groups')}
        >
          <Layers size={14} />
          <span>Horario y Grupos</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={settingsTab === 'custom'}
          className={`settings-nav-tab${settingsTab === 'custom' ? ' active' : ''}`}
          onClick={() => setSettingsTab('custom')}
        >
          <Sparkles size={14} />
          <span>Eventos y Cambios</span>
          {stats.total > 0 && (
            <span className="settings-nav-badge">{stats.upcomingCount > 0 ? stats.upcomingCount : stats.total}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={settingsTab === 'appearance'}
          className={`settings-nav-tab${settingsTab === 'appearance' ? ' active' : ''}`}
          onClick={() => setSettingsTab('appearance')}
        >
          <Palette size={14} />
          <span>Apariencia</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: HORARIO Y GRUPOS
      ══════════════════════════════════════════════════════════════════════ */}
      {settingsTab === 'groups' && (
        <>
          {/* Active Configuration Card */}
          <div className="settings-section" style={{ paddingBottom: 0 }}>
            <div className="settings-section-label">Configuración activa</div>
            <div className="config-selector-card">
              <div className="config-selector-header">
                <select
                  className="config-select-native"
                  value={activeConfig.id}
                  onChange={(e) => onSelectConfig(e.target.value)}
                  aria-label="Seleccionar configuración activa"
                >
                  {configs.map(cfg => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.name} ({cfg.selectedGroups?.length || 0} {cfg.selectedGroups?.length === 1 ? 'grupo' : 'grupos'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="config-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="config-icon-btn"
                    onClick={openRenameModal}
                    title="Renombrar configuración"
                  >
                    <Edit2 size={13} />
                    <span>Renombrar</span>
                  </button>

                  <button
                    type="button"
                    className="config-icon-btn"
                    onClick={() => onDuplicateConfig(activeConfig.id)}
                    title="Duplicar configuración"
                  >
                    <Copy size={13} />
                    <span>Duplicar</span>
                  </button>

                  {configs.length > 1 && (
                    <button
                      type="button"
                      className="config-icon-btn destructive"
                      onClick={handleDeleteClick}
                      title="Eliminar configuración"
                    >
                      <Trash2 size={13} />
                      <span>Eliminar</span>
                    </button>
                  )}

                  {Boolean(activeConfig.customColors && Object.keys(activeConfig.customColors).length > 0) && (
                    <button
                      type="button"
                      className="config-icon-btn"
                      onClick={onResetSubjectColors}
                      title="Restablecer colores predeterminados"
                    >
                      <RotateCcw size={13} />
                      <span>Restablecer colores</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="config-icon-btn"
                  style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
                  onClick={() => onCreateConfig()}
                  title="Nueva configuración"
                >
                  <Plus size={14} />
                  <span>Nueva</span>
                </button>
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="settings-section" style={{ paddingBottom: 0 }}>
            <div className="settings-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Mostrar otros subgrupos (atenuados)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Muestra los subgrupos no elegidos en gris para ver las clases de tus compañeros
                  </div>
                </div>
                <Toggle
                  id="toggle-dimmed-subgroups"
                  checked={showDimmedSubgroups}
                  onChange={onToggleShowDimmedSubgroups}
                />
              </div>
            </div>
          </div>

          {/* Groups list */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-label">Grupos en &quot;{activeConfig.name}&quot;</div>
              {Object.keys(customColors || {}).length > 0 && (
                <button
                  type="button"
                  className="reset-colors-btn"
                  onClick={onResetSubjectColors}
                  title="Restablecer todos los colores personalizados al modo automático"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer colores</span>
                </button>
              )}
            </div>

            {selectedGroups.length === 0 ? (
              <div className="settings-card">
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                    <Library size={44} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    No tienes ningún grupo añadido
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Añade tu titulación o curso para ver tu horario de WebUntis
                  </div>
                  <button
                    type="button"
                    className="settings-btn-primary"
                    onClick={onAddGroup}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 10,
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Plus size={16} /> Añadir grupo o titulación
                  </button>
                </div>
              </div>
            ) : (
              <div className="settings-card">
                {selectedGroups.map((g) => {
                  const key = groupKey(g);
                  const isExpanded = expandedGroups[key];
                  const isGroupDisabled = disabledGroupIds.includes(key);
                  const disabledForGroup = disabledSubjectsByGroup[key] || [];
                  const subjectsForGroup = timetableByGroup[key] || [];
                  const allEnabled = subjectsForGroup.length > 0 && subjectsForGroup.every(s => !disabledForGroup.includes(s.id));

                  return (
                    <div key={key} style={{ opacity: isGroupDisabled ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
                      {/* Group row */}
                      <div
                        className="settings-row"
                        style={{ cursor: 'pointer', gap: '12px' }}
                        onClick={() => toggleExpanded(key)}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>
                          <ChevronIcon open={isExpanded} />
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Toggle
                            id={`group-toggle-${key}`}
                            checked={!isGroupDisabled}
                            onChange={() => onToggleGroupDisabled(key)}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                            {g.name}
                          </div>
                          {g.longName && (
                            <div style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {g.longName}
                            </div>
                          )}
                        </div>

                        {subjectsForGroup.length > 0 && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: 'var(--bg-secondary)',
                            padding: '2px 8px',
                            borderRadius: 20,
                            flexShrink: 0,
                          }}>
                            {subjectsForGroup.filter(s => !disabledForGroup.includes(s.id)).length}/{subjectsForGroup.length}
                          </span>
                        )}

                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          onClick={(e) => { e.stopPropagation(); onRemoveGroup(g); }}
                          aria-label="Eliminar grupo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {/* Subjects expandable section */}
                      {isExpanded && (
                        <div style={{ background: 'var(--bg-secondary)', pointerEvents: isGroupDisabled ? 'none' : 'auto' }}>
                          {subjectsForGroup.length === 0 ? (
                            <div style={{ padding: '12px 20px 12px 44px', fontSize: 13, color: 'var(--text-muted)' }}>
                              Carga el horario para ver las asignaturas
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const groupAvailableSubgroups = availableSubgroupsBySubject[key] || {};
                                const hasAnySubgroups = Object.values(groupAvailableSubgroups).some(subs => subs && subs.length > 0);
                                const groupDisabledSubgroups = disabledSubgroupsBySubject[key] || {};
                                const allSubgroupsEnabled = hasAnySubgroups && Object.entries(groupAvailableSubgroups).every(([subjId, subs]) => {
                                  const disabledForSubj = groupDisabledSubgroups[subjId] || [];
                                  return subs.every(subKey => !disabledForSubj.includes(subKey));
                                });

                                return (
                                  <div
                                    className="settings-subrow"
                                    style={{
                                      borderBottom: '1px solid var(--border)',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: 16,
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <Toggle
                                        id={`all-${key}`}
                                        checked={allEnabled}
                                        onChange={() => {
                                          subjectsForGroup.forEach(s => {
                                            const isDisabled = disabledForGroup.includes(s.id);
                                            if (allEnabled && !isDisabled) onToggleSubjectForGroup(key, s.id);
                                            if (!allEnabled && isDisabled) onToggleSubjectForGroup(key, s.id);
                                          });
                                        }}
                                      />
                                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        Todas las asignaturas
                                      </span>
                                    </div>

                                    {hasAnySubgroups && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Toggle
                                          id={`all-subgroups-${key}`}
                                          checked={allSubgroupsEnabled}
                                          onChange={() => onToggleAllSubgroupsForGroup(key, !allSubgroupsEnabled)}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                                          Todos los subgrupos
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Individual subjects */}
                              {subjectsForGroup.map(subj => {
                                const isSubjDisabled = disabledForGroup.includes(subj.id);
                                const subjectSubgroups = availableSubgroupsBySubject[key]?.[subj.id] || [];
                                const disabledSubgroups = disabledSubgroupsBySubject[key]?.[subj.id] || [];

                                const colorIdx = resolvedSubjectColors?.[subj.id] !== undefined
                                  ? resolvedSubjectColors[subj.id]
                                  : (Math.abs(Number(subj.id) || 0) % PALETTE.length);
                                const colStyle = getSubjectColorStyle(colorIdx, isDark);
                                const isPickerOpen = pickerSubjectId === subj.id;

                                return (
                                  <div
                                    key={subj.id}
                                    className={`settings-subject-card${isSubjDisabled ? ' is-disabled' : ''}`}
                                    style={{
                                      background: colStyle.bg,
                                      border: `1px solid ${colStyle.border || 'rgba(0,0,0,0.12)'}`,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                        <Toggle
                                          id={`subj-${key}-${subj.id}`}
                                          checked={!isSubjDisabled}
                                          onChange={() => onToggleSubjectForGroup(key, subj.id)}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 14, color: colStyle.text, fontWeight: 700, lineHeight: 1.25 }}>
                                            {subj.name}
                                          </div>
                                          {subj.shortName && (
                                            <div style={{ fontSize: 11, color: colStyle.text, opacity: 0.8, marginTop: 2 }}>
                                              {subj.shortName}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        className="subject-palette-btn subject-color-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPickerSubjectId(prev => (prev === subj.id ? null : subj.id));
                                        }}
                                        title="Personalizar color de la asignatura"
                                        style={{ color: colStyle.text }}
                                        aria-expanded={isPickerOpen}
                                        aria-label={`Personalizar color de ${subj.name}`}
                                      >
                                        <Palette size={16} />
                                      </button>
                                    </div>

                                    {!isSubjDisabled && subjectSubgroups.length > 0 && (
                                      <div style={{ paddingLeft: 44, marginTop: 8, marginBottom: 2 }}>
                                        <div className="subgroups-pill-grid">
                                          {subjectSubgroups.map(subKey => {
                                            const isSubActive = !disabledSubgroups.includes(subKey);
                                            return (
                                              <button
                                                key={subKey}
                                                type="button"
                                                className={`subgroup-pill ${isSubActive ? 'active' : 'inactive'}`}
                                                onClick={() => onToggleSubgroupForSubject(key, subj.id, subKey)}
                                                title={`${isSubActive ? 'Ocultar' : 'Mostrar'} subgrupo ${subKey}`}
                                              >
                                                <span className="subgroup-pill-icon">
                                                  {isSubActive ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2.5} />}
                                                </span>
                                                <span>{subKey}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Color picker popover */}
                                    {isPickerOpen && (
                                      <div
                                        className="color-picker-popover"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="color-picker-popover-header">
                                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Color de {subj.name}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setPickerSubjectId(null)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              color: 'var(--text-muted)',
                                              padding: 4,
                                              display: 'flex',
                                              alignItems: 'center',
                                            }}
                                            aria-label="Cerrar selector"
                                          >
                                            <X size={15} />
                                          </button>
                                        </div>

                                        <div className="color-picker-section-label">Colores principales</div>
                                        <div className="color-picker-grid-main">
                                          {CHROMATIC_ORDER_MAIN.map((idx) => {
                                            const p = isDark ? PALETTE_DARK[idx] : PALETTE[idx];
                                            const isSelected = colorIdx === idx;
                                            return (
                                              <button
                                                key={idx}
                                                type="button"
                                                className="color-swatch-btn"
                                                onClick={() => {
                                                  onSetSubjectColor?.(subj.id, idx);
                                                  setPickerSubjectId(null);
                                                }}
                                                title={`Color ${idx + 1}`}
                                                style={{
                                                  background: p.bg,
                                                  border: isSelected ? '3px solid var(--accent)' : `1px solid ${p.border || 'rgba(0,0,0,0.2)'}`,
                                                  boxShadow: isSelected ? '0 0 0 2px var(--surface), 0 2px 5px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.1)',
                                                  color: p.text,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                }}
                                              >
                                                {isSelected ? <Check size={14} strokeWidth={2.5} /> : null}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        <div className="color-picker-section-label" style={{ marginTop: 12 }}>Tonos complementarios</div>
                                        <div className="color-picker-grid-soft">
                                          {CHROMATIC_ORDER_SOFT.map((idx) => {
                                            const p = isDark ? PALETTE_DARK[idx] : PALETTE[idx];
                                            const isSelected = colorIdx === idx;
                                            return (
                                              <button
                                                key={idx}
                                                type="button"
                                                className="color-swatch-btn"
                                                onClick={() => {
                                                  onSetSubjectColor?.(subj.id, idx);
                                                  setPickerSubjectId(null);
                                                }}
                                                title={`Color suave ${idx + 1}`}
                                                style={{
                                                  background: p.bg,
                                                  border: isSelected ? '3px solid var(--accent)' : `1px solid ${p.border || 'rgba(0,0,0,0.2)'}`,
                                                  boxShadow: isSelected ? '0 0 0 2px var(--surface), 0 2px 5px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.1)',
                                                  color: p.text,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                }}
                                              >
                                                {isSelected ? <Check size={14} strokeWidth={2.5} /> : null}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {customColors && (customColors[subj.id] !== undefined || customColors[String(subj.id)] !== undefined) && (
                                          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onResetSingleSubjectColor?.(subj.id);
                                                setPickerSubjectId(null);
                                              }}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5,
                                              }}
                                            >
                                              <RotateCcw size={12} /> Restablecer automático
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedGroups.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="add-group-btn"
                  onClick={onAddGroup}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} /> Añadir titulación o grupo
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: EVENTOS Y CAMBIOS (FILTERED, SORTED, TIMELINE DASHBOARD)
      ══════════════════════════════════════════════════════════════════════ */}
      {settingsTab === 'custom' && (
        <div className="settings-section">
          {/* Header Card with Stats & Primary Action */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '16px 18px',
              marginBottom: 16,
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Modificaciones y Eventos
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {stats.upcomingCount} {stats.upcomingCount === 1 ? 'próximo' : 'próximos'} • {stats.total} en total
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {stats.cancelledCount + stats.swappedCount + stats.editedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setResetAllOverridesModalOpen(true)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Restablecer todas las clases a su horario oficial"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer clases</span>
                </button>
              )}

              <button
                type="button"
                className="settings-btn-primary"
                onClick={onCreateCustomEvent}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <Plus size={15} />
                <span>Nuevo evento</span>
              </button>
            </div>
          </div>

          {/* ── Filters & Search Controls Toolbar ─────────────────────────────── */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Buscar por asignatura, evento, aula..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.84rem',
                  color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Time Horizon Scope Filter (Próximos / Pasados / Todos) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setTimeScope('upcoming')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: timeScope === 'upcoming' ? 'var(--surface)' : 'transparent',
                    color: timeScope === 'upcoming' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: timeScope === 'upcoming' ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: timeScope === 'upcoming' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Próximos ({stats.upcomingCount})
                </button>

                <button
                  type="button"
                  onClick={() => setTimeScope('past')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: timeScope === 'past' ? 'var(--surface)' : 'transparent',
                    color: timeScope === 'past' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: timeScope === 'past' ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: timeScope === 'past' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Pasados ({stats.pastCount})
                </button>

                <button
                  type="button"
                  onClick={() => setTimeScope('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: timeScope === 'all' ? 'var(--surface)' : 'transparent',
                    color: timeScope === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: timeScope === 'all' ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: timeScope === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Todos ({stats.total})
                </button>
              </div>

              {/* Type Filter Pills */}
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
                {[
                  { id: 'all', label: 'Todo' },
                  { id: 'cancelled', label: `Canceladas (${stats.cancelledCount})` },
                  { id: 'swapped', label: `Permutadas (${stats.swappedCount})` },
                  { id: 'edited', label: `Editadas (${stats.editedCount})` },
                  { id: 'custom', label: `Eventos (${stats.customCount})` },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: typeFilter === f.id ? 'var(--accent)' : 'var(--border)',
                      background: typeFilter === f.id ? 'var(--accent-light)' : 'transparent',
                      color: typeFilter === f.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Empty State ─────────────────────────────────────────────────── */}
          {filteredItems.length === 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '32px 20px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <Sparkles size={38} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {searchQuery
                  ? `Sin resultados para "${searchQuery}"`
                  : timeScope === 'past'
                  ? 'No hay eventos ni cambios en el historial pasado'
                  : 'No tienes eventos ni clases modificadas próximas'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.4 }}>
                {searchQuery
                  ? 'Prueba a buscar con otro término o limpia los filtros activos.'
                  : 'Cualquier clase que canceles, edites o permutes en el horario aparecerá aquí organizada cronológicamente.'}
              </div>
              <button
                type="button"
                className="settings-btn-primary"
                onClick={onCreateCustomEvent}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Crear evento personal
              </button>
            </div>
          )}

          {/* ── Chronological Items List ────────────────────────────────────── */}
          {filteredItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayedList.map(item => {
                const isCustom = item.itemKind === 'custom_event';
                const dateStr = item.dateObj
                  ? `${DAYS_SHORT[item.dateObj.getDay()]} ${item.dateObj.getDate()} ${MONTHS_SHORT[item.dateObj.getMonth()]}`
                  : '';
                const timeStr = `${formatTime(item.startTime)}–${formatTime(item.endTime)}`;
                const colorStyle = isCustom ? getSubjectColorStyle(item.colorIndex, isDark) : null;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: 'var(--shadow-card)',
                      opacity: item.isPast ? 0.75 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        {isCustom && (
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: colorStyle.bg,
                              border: `1.5px solid ${colorStyle.border || 'currentColor'}`,
                              flexShrink: 0,
                            }}
                          />
                        )}

                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {item.title}
                        </span>

                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          • {item.isWeekly ? 'Semanal' : dateStr}
                        </span>

                        {/* Badges */}
                        {item.type === 'cancelled' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.14)',
                              color: isDark ? '#fca5a5' : '#b91c1c',
                              padding: '2px 8px',
                              borderRadius: 10,
                            }}
                          >
                            <Ban size={11} strokeWidth={2.8} /> Cancelada por ti
                          </span>
                        )}

                        {item.type === 'swapped' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(99, 102, 241, 0.14)',
                              color: 'var(--accent)',
                              padding: '2px 8px',
                              borderRadius: 10,
                            }}
                          >
                            <ArrowUpDown size={11} strokeWidth={2.4} /> Permutada con {item.swappedWith?.subjectName}
                          </span>
                        )}

                        {item.type === 'edited' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(245, 158, 11, 0.14)',
                              color: isDark ? '#fbbf24' : '#b45309',
                              padding: '2px 8px',
                              borderRadius: 10,
                            }}
                          >
                            <Pencil size={11} strokeWidth={2.4} /> Personalizada
                          </span>
                        )}

                        {isCustom && item.category && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              padding: '2px 8px',
                              borderRadius: 10,
                            }}
                          >
                            {item.category}
                          </span>
                        )}

                        {item.isPast && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              color: 'var(--text-muted)',
                              background: 'var(--bg-secondary)',
                              padding: '1px 6px',
                              borderRadius: 6,
                            }}
                          >
                            Pasada
                          </span>
                        )}
                      </div>

                      {/* Details row */}
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {timeStr}
                        </span>

                        {item.rooms && item.rooms.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} /> {formatRooms(item.rooms)}
                          </span>
                        )}

                        {item.notes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic' }}>
                            <FileText size={12} /> &ldquo;{item.notes}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {isCustom ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditCustomEvent?.(item.rawEvent)}
                            title="Editar evento"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            <Pencil size={13} />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteCustomEvent?.(item.id, null, 'series')}
                            title="Eliminar evento"
                            style={{
                              padding: '6px 8px',
                              borderRadius: 8,
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onResetLessonOverride?.(item.key)}
                          title="Restablecer clase al estado oficial de WebUntis"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>Restablecer</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Show more button if filtered count exceeds limit */}
              {filteredItems.length > visibleLimit && (
                <button
                  type="button"
                  onClick={() => setVisibleLimit(prev => prev + 25)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--accent)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <ChevronDown size={15} />
                  <span>Cargar más ({filteredItems.length - visibleLimit} restantes)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: APARIENCIA
      ══════════════════════════════════════════════════════════════════════ */}
      {settingsTab === 'appearance' && (
        <div className="settings-section" style={{ paddingBottom: 0 }}>
          <div className="settings-section-label">Tema de la interfaz</div>
          <div className="theme-selector-card">
            <div
              className="theme-segmented-group"
              role="radiogroup"
              aria-label="Seleccionar tema"
            >
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'light'}
                className={`theme-segment-btn${theme === 'light' ? ' active' : ''}`}
                onClick={() => onThemeChange?.('light')}
              >
                <Sun size={15} />
                <span>Claro</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={theme === 'dark'}
                className={`theme-segment-btn${theme === 'dark' ? ' active' : ''}`}
                onClick={() => onThemeChange?.('dark')}
              >
                <Moon size={15} />
                <span>Oscuro</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={theme === 'system'}
                className={`theme-segment-btn${theme === 'system' ? ' active' : ''}`}
                onClick={() => onThemeChange?.('system')}
              >
                <Monitor size={15} />
                <span>Sistema</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {renameModalOpen && (
        <div className="modal-backdrop" onClick={() => setRenameModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <span className="modal-title" style={{ fontSize: 17, fontWeight: 700 }}>Renombrar configuración</span>
              <button className="modal-close-btn" onClick={() => setRenameModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <input
                type="text"
                className="config-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                placeholder="Nombre de la configuración"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="settings-btn-secondary"
                  onClick={() => setRenameModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="settings-btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <span className="modal-title" style={{ fontSize: 17, fontWeight: 700, color: 'var(--danger, #ef4444)' }}>
                Eliminar configuración
              </span>
              <button className="modal-close-btn" onClick={() => setDeleteModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              ¿Estás seguro de que deseas eliminar <strong>&quot;{activeConfig.name}&quot;</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="settings-btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="settings-btn-primary destructive"
                onClick={() => {
                  onDeleteConfig(activeConfig.id);
                  setDeleteModalOpen(false);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {resetAllOverridesModalOpen && (
        <div className="modal-backdrop" onClick={() => setResetAllOverridesModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <span className="modal-title" style={{ fontSize: 17, fontWeight: 700, color: '#ef4444' }}>
                Restablecer clases a oficial
              </span>
              <button className="modal-close-btn" onClick={() => setResetAllOverridesModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              ¿Deseas descartar todas las modificaciones ({stats.cancelledCount + stats.swappedCount + stats.editedCount}) y devolver todas las clases a sus horarios y aulas oficiales de WebUntis?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="settings-btn-secondary"
                onClick={() => setResetAllOverridesModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="settings-btn-primary destructive"
                onClick={() => {
                  onResetAllLessonOverrides?.();
                  setResetAllOverridesModalOpen(false);
                }}
              >
                Restablecer todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
