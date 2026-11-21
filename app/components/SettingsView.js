'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  CalendarDays,
  Ban,
  ArrowUpDown,
  ArrowDownAZ,
  Pencil,
  Check,
  X,
  Search,
  FileText,
  ChevronDown,
  AlertTriangle,
  CalendarCheck,
  SlidersHorizontal,
  MoreHorizontal,
  Settings as SettingsIcon
} from 'lucide-react';
import {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle,
} from '../utils/colorLogic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { ConfirmDialog } from './ui/confirm-dialog';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { InfoToggletip } from './ui/tooltip';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { formatRooms } from '../utils/subgroups';
import { formatTime, hasLessonOverrideChanges } from '../utils/lessonOverrides';
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

function getRelativeDateLabel(dateNum, todayNum, isWeekly) {
  if (isWeekly) return 'Semanal';
  if (!dateNum || !todayNum) return null;
  const diffDays = Math.round((parseDateNumber(dateNum).getTime() - parseDateNumber(todayNum).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 1 && diffDays <= 6) return `En ${diffDays} días`;
  if (diffDays < -1 && diffDays >= -6) return `Hace ${Math.abs(diffDays)} días`;
  return null;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const SORT_OPTIONS = [
  { id: 'date-asc', label: 'Próximas primero', icon: CalendarIcon },
  { id: 'date-desc', label: 'Más lejanas primero', icon: CalendarDays },
  { id: 'title-asc', label: 'Asignatura (A - Z)', icon: ArrowDownAZ },
  { id: 'type', label: 'Tipo de cambio', icon: Layers },
];

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
  const [typeFilter, setTypeFilter] = useState('all');     // 'all' | 'cancelled' | 'swapped' | 'edited' | 'custom'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-asc');       // 'date-asc' | 'date-desc' | 'title-asc' | 'type'
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configActionsOpen, setConfigActionsOpen] = useState(false);
  const [hidePast, setHidePast] = useState(false);        // 'Ocultar pasadas' toggle
  const [visibleLimit, setVisibleLimit] = useState(25);
  const sortDropdownRef = useRef(null);
  const configDropdownRef = useRef(null);

  const handleConfigMenuKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll('button[role="menuitem"]:not(:disabled)'));
    if (items.length === 0) return;
    const currentIdx = items.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === 'Home') {
      items[0].focus();
    } else if (e.key === 'End') {
      items[items.length - 1].focus();
    } else {
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = currentIdx < 0 ? 0 : (currentIdx + delta + items.length) % items.length;
      items[nextIdx].focus();
    }
  };

  // Close sort menu and config dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
      if (configDropdownRef.current && !configDropdownRef.current.contains(event.target)) {
        setIsConfigOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsSortOpen(false);
        setIsConfigOpen(false);
      }
    }
    if (isSortOpen || isConfigOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortOpen, isConfigOpen]);

  // Modals state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetAllOverridesModalOpen, setResetAllOverridesModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

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
        if (!hasLessonOverrideChanges(ov, snap, matched)) return;
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
      // 0. User option to leave out past items ("dejar fuera las que ya han pasado")
      if (hidePast && item.isPast) return false;

      // 1. Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'custom' && item.itemKind !== 'custom_event') return false;
        if (typeFilter !== 'custom' && item.type !== typeFilter) return false;
      }

      // 2. Search query filter
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

    // Sort order based on user selection
    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return (b.dateNum || 0) - (a.dateNum || 0) || b.startTime - a.startTime;
      }
      if (sortBy === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'type') {
        const typeOrder = { cancelled: 1, swapped: 2, edited: 3, custom: 4 };
        const orderA = typeOrder[a.type] || 5;
        const orderB = typeOrder[b.type] || 5;
        if (orderA !== orderB) return orderA - orderB;
        return (a.dateNum || 0) - (b.dateNum || 0);
      }
      // Default 'date-asc': nearest upcoming first
      return (a.dateNum || 0) - (b.dateNum || 0) || a.startTime - b.startTime;
    });

    return list;
  }, [allCustomItems, typeFilter, searchQuery, sortBy, hidePast]);

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
      <div className="settings-container">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="settings-header-banner">
        <div className="settings-header-left">
          <div className="settings-header-icon">
            <SettingsIcon size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="settings-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Ajustes y Personalización
            </h1>
            <p className="settings-subtitle">
              Gestiona tus titulaciones, clases modificadas, eventos propios y preferencias
            </p>
          </div>
        </div>
      </div>

      {/* ── Modern Segmented Nav ────────────────────────────────────────────── */}
      <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-5 h-11">
          <TabsTrigger value="groups">Horario y Grupos</TabsTrigger>
          <TabsTrigger value="custom">Eventos y Cambios</TabsTrigger>
          <TabsTrigger value="appearance">Apariencia</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: HORARIO Y GRUPOS
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="groups">
          {/* Active Configuration Card */}
          <div className="settings-section !gap-0">
            <div className="flex items-center justify-between gap-3 mb-2.5 px-1">
              <div className="settings-section-label !p-0">Configuración activa</div>
              <button
                type="button"
                onClick={() => onCreateConfig()}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shrink-0"
                title="Nueva configuración"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Nueva</span>
              </button>
            </div>

            <div className="config-selector-card">
              <div className="config-selector-header">
                <div className="config-dropdown-container min-w-0" ref={configDropdownRef}>
                  <button
                    type="button"
                    className={`config-dropdown-trigger${isConfigOpen ? ' open' : ''}`}
                    onClick={() => setIsConfigOpen(prev => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isConfigOpen}
                    aria-label="Seleccionar configuración activa"
                  >
                    <div className="config-dropdown-trigger-content">
                      <Layers size={15} className="config-dropdown-icon" />
                      <span className="config-dropdown-name">{activeConfig.name}</span>
                      <span className="config-dropdown-badge tabular-nums">
                        {activeConfig.selectedGroups?.length || 0} {activeConfig.selectedGroups?.length === 1 ? 'grupo' : 'grupos'}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`config-dropdown-chevron${isConfigOpen ? ' open' : ''}`} />
                  </button>

                  {isConfigOpen && (
                    <div className="config-dropdown-menu" role="listbox">
                      <div className="config-dropdown-menu-header">Configuraciones de horario</div>
                      {configs.map(cfg => {
                        const isSelected = cfg.id === activeConfig.id;
                        const groupsCount = cfg.selectedGroups?.length || 0;
                        return (
                          <button
                            key={cfg.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`config-dropdown-menu-item${isSelected ? ' selected' : ''}`}
                            onClick={() => {
                              onSelectConfig(cfg.id);
                              setIsConfigOpen(false);
                            }}
                          >
                            <Layers size={14} className="config-dropdown-item-icon" />
                            <div className="config-dropdown-item-text">
                              <span className="config-dropdown-item-name">{cfg.name}</span>
                              <span className="config-dropdown-item-sub tabular-nums">
                                {groupsCount} {groupsCount === 1 ? 'grupo' : 'grupos'}
                              </span>
                            </div>
                            {isSelected && <Check size={14} className="config-dropdown-item-check" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Popover open={configActionsOpen} onOpenChange={setConfigActionsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-[38px] w-[38px] shrink-0 transition-colors active:scale-100"
                      aria-label="Más acciones de la configuración"
                      aria-haspopup="menu"
                      aria-expanded={configActionsOpen}
                      title="Más acciones"
                    >
                      <MoreHorizontal size={17} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    className="w-52 p-1.5"
                    role="menu"
                    aria-label="Acciones de la configuración activa"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onKeyDown={handleConfigMenuKeyDown}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setConfigActionsOpen(false);
                        openRenameModal();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>Renombrar</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setConfigActionsOpen(false);
                        onDuplicateConfig(activeConfig.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                    >
                      <Copy size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>Duplicar</span>
                    </button>

                    {(Object.keys(customColors || {}).length > 0 || Boolean(activeConfig.customColors && Object.keys(activeConfig.customColors).length > 0)) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConfigActionsOpen(false);
                          onResetSubjectColors?.();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                      >
                        <RotateCcw size={14} className="shrink-0 text-[var(--text-secondary)]" />
                        <span>Restablecer colores</span>
                      </button>
                    )}

                    {configs.length > 1 && (
                      <>
                        <hr className="my-1 border-0 border-t border-[var(--border)]" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setConfigActionsOpen(false);
                            handleDeleteClick();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} className="shrink-0" />
                          <span>Eliminar</span>
                        </button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="mt-3">
            <div className="settings-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                    Mostrar otros subgrupos (atenuados)
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    Muestra los subgrupos no elegidos en gris para ver las clases de tus compañeros
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <Switch
                    isSelected={showDimmedSubgroups}
                    onChange={onToggleShowDimmedSubgroups}
                    aria-label="Mostrar otros subgrupos atenuados"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Groups list */}
          <div className="settings-section !gap-0">
            <div className="mt-7 mb-2.5 flex items-center justify-between gap-3 px-1">
              <div className="settings-section-label !p-0 truncate">
                Grupos en &quot;{activeConfig.name}&quot;
              </div>
            </div>

            {selectedGroups.length === 0 ? (
              <div className="settings-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                  <Library size={44} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  No tienes ningún grupo añadido
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, maxWidth: 360, margin: '0 auto 18px' }}>
                  Añade tu titulación o curso para ver tu horario de WebUntis y gestionar tus subgrupos
                </div>
                <button
                  type="button"
                  className="settings-btn-primary"
                  onClick={onAddGroup}
                  style={{ display: 'inline-flex' }}
                >
                  <Plus size={16} /> Añadir grupo o titulación
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedGroups.map((g) => {
                  const key = groupKey(g);
                  const isExpanded = expandedGroups[key];
                  const isGroupDisabled = disabledGroupIds.includes(key);
                  const disabledForGroup = disabledSubjectsByGroup[key] || [];
                  const subjectsForGroup = timetableByGroup[key] || [];
                  const allEnabled = subjectsForGroup.length > 0 && subjectsForGroup.every(s => !disabledForGroup.includes(s.id));

                  return (
                    <div key={key} className="settings-card" style={{ opacity: isGroupDisabled ? 0.6 : 1, transition: 'all 0.2s ease' }}>
                      {/* Group row: linea 1 codigo + icono info para nombre completo; linea 2 contador de asignaturas activas */}
                      <div
                        className="settings-row !items-center !px-4 !py-3.5"
                        style={{ cursor: 'pointer', gap: '10px' }}
                        onClick={() => toggleExpanded(key)}
                      >
                        <span className="text-[var(--text-muted)] shrink-0">
                          <ChevronIcon open={isExpanded} />
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-[15px] leading-snug text-[var(--text-primary)] truncate">
                              {g.name}
                            </span>
                            {g.longName && g.longName.trim() !== (g.name || '').trim() && (
                              <InfoToggletip
                                content={g.longName}
                                ariaLabel={`Ver nombre completo de ${g.name}`}
                              />
                            )}
                          </div>
                          {subjectsForGroup.length > 0 && (
                            <div className="mt-1 flex items-center">
                              <span className="inline-flex items-center shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20 tabular-nums">
                                {subjectsForGroup.filter(s => !disabledForGroup.includes(s.id)).length}/{subjectsForGroup.length}{' '}
                                {subjectsForGroup.length === 1 ? 'asignatura activa' : 'asignaturas activas'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            isSelected={!isGroupDisabled}
                            onChange={() => onToggleGroupDisabled(key)}
                            aria-label={`Activar grupo ${g.name}`}
                          />
                          <button
                            type="button"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            onClick={(e) => { e.stopPropagation(); onRemoveGroup(g); }}
                            aria-label={`Eliminar grupo ${g.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Subjects expandable section */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', pointerEvents: isGroupDisabled ? 'none' : 'auto' }}>
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
                                  <div className="px-4 py-3 border-b border-[var(--border)] flex flex-wrap gap-x-5 gap-y-2.5 justify-between items-center">
                                    <div className="flex items-center gap-2.5">
                                      <Switch
                                        isSelected={allEnabled}
                                        onChange={() => {
                                          subjectsForGroup.forEach(s => {
                                            const isDisabled = disabledForGroup.includes(s.id);
                                            if (allEnabled && !isDisabled) onToggleSubjectForGroup(key, s.id);
                                            if (!allEnabled && isDisabled) onToggleSubjectForGroup(key, s.id);
                                          });
                                        }}
                                        aria-label="Activar todas las asignaturas"
                                      >
                                        <span className="font-semibold text-[13px] text-[var(--text-secondary)]">
                                          Todas las asignaturas
                                        </span>
                                      </Switch>
                                    </div>

                                    {hasAnySubgroups && (
                                      <div className="flex items-center gap-2.5">
                                        <Switch
                                          isSelected={allSubgroupsEnabled}
                                          onChange={() => onToggleAllSubgroupsForGroup(key, !allSubgroupsEnabled)}
                                          aria-label="Activar todos los subgrupos"
                                        >
                                          <span className="font-semibold text-[13px] text-[var(--text-secondary)]">
                                            Todos los subgrupos
                                          </span>
                                        </Switch>
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
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold leading-snug" style={{ color: colStyle.text }}>
                                          {subj.name}
                                        </div>
                                        {subj.shortName && (
                                          <div
                                            className="font-mono text-[11px] opacity-50 truncate mt-0.5"
                                            style={{ color: colStyle.text }}
                                          >
                                            {subj.shortName}
                                          </div>
                                        )}
                                      </div>

                                      <div
                                        className="flex items-center gap-2 shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
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
                                          <Palette size={15} />
                                        </button>
                                        <Switch
                                          isSelected={!isSubjDisabled}
                                          onChange={() => onToggleSubjectForGroup(key, subj.id)}
                                          aria-label={`Activar asignatura ${subj.name}`}
                                        />
                                      </div>
                                    </div>

                                    {!isSubjDisabled && subjectSubgroups.length > 0 && (
                                      <div className="mt-2.5 mb-0.5">
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
              <div className="mt-4">
                <button
                  type="button"
                  className="settings-btn-primary"
                  onClick={onAddGroup}
                  style={{ width: '100%', padding: '12px 18px', borderRadius: 14 }}
                >
                  <Plus size={16} /> Añadir titulación o grupo
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: EVENTOS Y CAMBIOS (FILTERED, SORTED, TIMELINE DASHBOARD)
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="custom">
        <div className="settings-section">
          {/* Header Card with Stats & Actions */}
          <div className="custom-events-header-card">
            <div>
              <div className="custom-events-header-title">
                Modificaciones y Eventos
              </div>
              <div className="custom-events-header-subtitle">
                {stats.upcomingCount} {stats.upcomingCount === 1 ? 'próximo' : 'próximos'} • {stats.total} en total
              </div>
            </div>

            <div className="custom-events-header-actions">
              <button
                type="button"
                className="settings-btn-primary"
                onClick={onCreateCustomEvent}
                title="Añadir evento personal puntual o recurrente"
              >
                <Plus size={15} />
                <span>Nuevo evento</span>
              </button>
            </div>
          </div>

          {/* ── Filters & Search Controls Toolbar ─────────────────────────────── */}
          <div className="settings-toolbar-wrap">
            {/* Search Input */}
            <div className="settings-search-bar">
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Buscar por asignatura, evento, aula o notas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="settings-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Controls Row: Custom Sort Dropdown + Hide Past Toggle (Single Horizontal Row) */}
            <div className="settings-toolbar-controls">
              {/* Custom Sort Dropdown (Zero Emojis, SVG Icons, Clean Accessible Popover) */}
              <div className="settings-sort-container" ref={sortDropdownRef}>
                <button
                  type="button"
                  className={`settings-sort-trigger${isSortOpen ? ' open' : ''}`}
                  onClick={() => setIsSortOpen(prev => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  aria-label="Ordenar eventos y cambios"
                >
                  <SlidersHorizontal size={13} className="settings-sort-icon" />
                  <span>
                    {SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Ordenar'}
                  </span>
                  <ChevronDown size={13} className={`settings-sort-chevron${isSortOpen ? ' open' : ''}`} />
                </button>

                {isSortOpen && (
                  <div className="settings-sort-menu" role="listbox">
                    <div className="settings-sort-menu-header">Ordenar por</div>
                    {SORT_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`settings-sort-menu-item${isSelected ? ' selected' : ''}`}
                          onClick={() => {
                            setSortBy(opt.id);
                            setIsSortOpen(false);
                          }}
                        >
                          <Icon size={14} className="settings-sort-item-icon" />
                          <span className="settings-sort-item-text">{opt.label}</span>
                          {isSelected && <Check size={14} className="settings-sort-item-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hide Past Toggle Chip */}
              <button
                type="button"
                className={`settings-toggle-chip${hidePast ? ' active' : ''}`}
                onClick={() => setHidePast(!hidePast)}
                title={hidePast ? 'Mostrando solo clases futuras. Pulsa para incluir pasadas' : 'Incluyendo pasadas. Pulsa para ocultarlas'}
              >
                <CalendarCheck size={13} />
                <span>Ocultar pasadas</span>
              </button>
            </div>

            {/* Type Filter Pills (Edge-to-edge horizontal scroll on mobile) */}
            <div className="settings-filter-pills-row -mx-4 px-4">
              {[
                { id: 'all', label: 'Todo' },
                { id: 'cancelled', label: 'Canceladas' },
                { id: 'swapped', label: 'Intercambiadas' },
                { id: 'edited', label: 'Editadas' },
                { id: 'custom', label: 'Eventos' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`settings-filter-pill${typeFilter === f.id ? ' active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Empty State ─────────────────────────────────────────────────── */}
          {filteredItems.length === 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '36px 20px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <Sparkles size={40} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {searchQuery
                  ? `Sin resultados para "${searchQuery}"`
                  : hidePast
                  ? 'No hay modificaciones ni eventos futuros'
                  : 'No tienes eventos ni clases modificadas'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.45 }}>
                {searchQuery
                  ? 'Prueba a buscar con otro término o limpia los filtros activos.'
                  : 'Cualquier evento personalizado que crees, o clase que canceles, edites o intercambies en el horario aparecerá aquí organizada cronológicamente.'}
              </div>
              <button
                type="button"
                className="settings-btn-primary"
                onClick={onCreateCustomEvent}
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
                const timeStr = `${formatTime(item.startTime)}–${formatTime(item.endTime)}`;
                const colorStyle = isCustom ? getSubjectColorStyle(item.colorIndex, isDark) : null;
                const relativeLabel = getRelativeDateLabel(item.dateNum, todayNum, item.isWeekly);
                const hasBadges = Boolean(
                  relativeLabel ||
                  item.type === 'cancelled' ||
                  item.type === 'swapped' ||
                  item.type === 'edited' ||
                  (isCustom && item.category)
                );

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-card)] transition-all duration-150"
                    style={{ opacity: item.isPast ? 0.72 : 1 }}
                  >
                    {/* Mini Calendar Date Badge */}
                    <div
                      className="flex flex-col items-center justify-center shrink-0 min-w-[46px] px-1.5 py-1.5 rounded-[10px] border leading-none tabular-nums"
                      style={{
                        background: item.isPast ? 'var(--bg-secondary)' : 'var(--accent-light, rgba(99, 102, 241, 0.1))',
                        borderColor: item.isPast ? 'var(--border)' : 'rgba(99, 102, 241, 0.25)',
                        color: item.isPast ? 'var(--text-muted)' : 'var(--accent)',
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide">
                        {item.isWeekly ? 'REC' : (item.dateObj ? DAYS_SHORT[item.dateObj.getDay()] : '')}
                      </span>
                      <span className="text-[15px] font-extrabold mt-0.5">
                        {item.isWeekly ? '∞' : (item.dateObj ? item.dateObj.getDate() : '')}
                      </span>
                      {!item.isWeekly && item.dateObj && (
                        <span className="text-[9px] font-semibold uppercase opacity-75 mt-0.5">
                          {MONTHS_SHORT[item.dateObj.getMonth()]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        {/* Title only (no duplicate date) */}
                        <div className="flex items-center gap-2 min-w-0">
                          {isCustom && (
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{
                                background: colorStyle.bg,
                                border: `1.5px solid ${colorStyle.border || 'currentColor'}`,
                              }}
                            />
                          )}
                          <span className="font-bold text-[0.92rem] text-[var(--text-primary)] leading-snug truncate">
                            {item.title}
                          </span>
                        </div>

                        {/* Single-line badges row */}
                        {hasBadges && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-nowrap overflow-hidden">
                            {relativeLabel && (
                              <span
                                className="inline-flex items-center shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none border"
                                style={{
                                  background: item.isPast ? 'var(--bg-secondary)' : 'var(--accent-light, rgba(99, 102, 241, 0.12))',
                                  color: item.isPast ? 'var(--text-muted)' : 'var(--accent)',
                                  borderColor: item.isPast ? 'var(--border)' : 'rgba(99, 102, 241, 0.25)',
                                }}
                              >
                                {relativeLabel}
                              </span>
                            )}

                            {item.type === 'cancelled' && (
                              <span
                                className="inline-flex items-center gap-1 min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none border"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: isDark ? '#fca5a5' : '#b91c1c',
                                  borderColor: 'rgba(239, 68, 68, 0.25)',
                                }}
                              >
                                <Ban size={10} strokeWidth={2.8} className="shrink-0" />
                                <span className="truncate">Cancelada por ti</span>
                              </span>
                            )}

                            {item.type === 'swapped' && (
                              <span
                                className="inline-flex items-center gap-1 min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none border"
                                style={{
                                  background: 'rgba(99, 102, 241, 0.12)',
                                  color: 'var(--accent)',
                                  borderColor: 'rgba(99, 102, 241, 0.25)',
                                }}
                              >
                                <ArrowUpDown size={10} strokeWidth={2.4} className="shrink-0" />
                                <span className="truncate">Intercambiada con {item.swappedWith?.subjectName}</span>
                              </span>
                            )}

                            {item.type === 'edited' && (
                              <span
                                className="inline-flex items-center gap-1 min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none border"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  color: isDark ? '#fbbf24' : '#b45309',
                                  borderColor: 'rgba(245, 158, 11, 0.25)',
                                }}
                              >
                                <Pencil size={10} strokeWidth={2.4} className="shrink-0" />
                                <span className="truncate">Personalizada</span>
                              </span>
                            )}

                            {isCustom && item.category && (
                              <span className="inline-flex items-center min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                                <span className="truncate">{item.category}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Details row */}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--text-secondary)] flex-wrap tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} className="shrink-0" /> {timeStr}
                          </span>

                          {item.rooms && item.rooms.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={12} className="shrink-0" /> {formatRooms(item.rooms)}
                            </span>
                          )}

                          {item.notes && (
                            <span className="inline-flex items-center gap-1 italic min-w-0 truncate">
                              <FileText size={12} className="shrink-0" /> &ldquo;{item.notes}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {isCustom ? (
                          <>
                            <button
                              type="button"
                              className="settings-btn-secondary"
                              onClick={() => onEditCustomEvent?.(item.rawEvent)}
                              title="Editar evento"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              <Pencil size={13} />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEventToDelete(item)}
                              title="Eliminar evento"
                              aria-label={`Eliminar evento ${item.title}`}
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
                                transition: 'background 0.15s ease',
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="settings-btn-secondary"
                            onClick={() => onResetLessonOverride?.(item.key)}
                            title="Restablecer clase al estado oficial de WebUntis"
                            style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#ef4444';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                          >
                            <RotateCcw size={13} />
                            <span>Restablecer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Show more button if filtered count exceeds limit */}
              {filteredItems.length > visibleLimit && (
                <button
                  type="button"
                  className="settings-btn-secondary"
                  onClick={() => setVisibleLimit(prev => prev + 25)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 12,
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

          {/* ── Zona de peligro delimitada visualmente ── */}
          {stats.cancelledCount + stats.swappedCount + stats.editedCount > 0 && (
            <div className="mt-8 p-4 rounded-[var(--radius-lg)] border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle size={15} />
                <span>Zona de peligro</span>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Restablecer todas las clases
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Descarta todas las modificaciones ({stats.cancelledCount + stats.swappedCount + stats.editedCount} cambios) y regresa al horario oficial de WebUntis.
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setResetAllOverridesModalOpen(true)}
                >
                  <RotateCcw size={13} className="mr-1" />
                  <span>Restablecer todo</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: APARIENCIA
      ══════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="appearance">
        <div className="settings-section !gap-0">
          <div className="flex items-center justify-between gap-3 mb-2.5 px-1">
            <div className="settings-section-label !p-0">Tema de la interfaz</div>
          </div>
          
          <div className="theme-cards-grid" role="radiogroup" aria-label="Seleccionar tema">
            <div
              className={`theme-card-option${theme === 'light' ? ' active' : ''}`}
              role="radio"
              aria-checked={theme === 'light'}
              onClick={() => onThemeChange?.('light')}
            >
              <div className="theme-card-icon-wrap">
                <Sun size={22} strokeWidth={2.2} />
              </div>
              <div className="theme-card-title">Claro</div>
            </div>

            <div
              className={`theme-card-option${theme === 'dark' ? ' active' : ''}`}
              role="radio"
              aria-checked={theme === 'dark'}
              onClick={() => onThemeChange?.('dark')}
            >
              <div className="theme-card-icon-wrap">
                <Moon size={22} strokeWidth={2.2} />
              </div>
              <div className="theme-card-title">Oscuro</div>
            </div>

            <div
              className={`theme-card-option${theme === 'system' ? ' active' : ''}`}
              role="radio"
              aria-checked={theme === 'system'}
              onClick={() => onThemeChange?.('system')}
            >
              <div className="theme-card-icon-wrap">
                <Monitor size={22} strokeWidth={2.2} />
              </div>
              <div className="theme-card-title">Sistema</div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {/* Modal: Renombrar configuración */}
      <ResponsiveModal open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <ResponsiveModalContent className="max-w-md p-6">
          <ResponsiveModalHeader className="mb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent)] shrink-0">
                <Edit2 size={18} strokeWidth={2.4} />
              </div>
              <div>
                <ResponsiveModalTitle className="text-base font-bold">
                  Renombrar configuración
                </ResponsiveModalTitle>
                <div className="text-xs text-[var(--text-secondary)]">
                  Introduce un nombre para identificar este horario.
                </div>
              </div>
            </div>
          </ResponsiveModalHeader>

          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              placeholder="Nombre de la configuración (ej. 1º Cuatrimestre)"
            />
            <ResponsiveModalFooter className="flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="md" onClick={() => setRenameModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="default" size="md">
                <Check size={15} className="mr-1.5" />
                <span>Guardar</span>
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmation modal: Eliminar configuración */}
      <ConfirmDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Eliminar configuración"
        description={`¿Eliminar "${activeConfig?.name}"? Podrás deshacerlo durante unos segundos.`}
        confirmText="Eliminar"
        variant="destructive"
        onConfirm={() => {
          onDeleteConfig(activeConfig.id);
          setDeleteModalOpen(false);
        }}
      />

      {/* Confirmation modal: Restablecer todas las clases */}
      <ConfirmDialog
        open={resetAllOverridesModalOpen}
        onOpenChange={setResetAllOverridesModalOpen}
        title="Restablecer horario oficial"
        description="Se descartarán tus personalizaciones de horario, aula y cancelaciones, volviendo a los datos oficiales de WebUntis. Tus eventos personales quedarán intactos. Podrás deshacerlo durante unos segundos."
        affectedSummary={(() => {
          const count = Object.values(lessonOverrides || {}).filter(hasLessonOverrideChanges).length;
          if (count <= 0) return undefined;
          return `${count} ${count === 1 ? 'clase personalizada' : 'clases personalizadas'}`;
        })()}
        confirmText="Restablecer todas"
        variant="destructive"
        icon={RotateCcw}
        onConfirm={() => {
          onResetAllLessonOverrides?.();
          setResetAllOverridesModalOpen(false);
        }}
      />

      {/* Confirmation modal: Eliminar evento personalizado individual */}
      <ConfirmDialog
        open={Boolean(eventToDelete)}
        onOpenChange={(open) => { if (!open) setEventToDelete(null); }}
        title="Eliminar evento"
        description={eventToDelete ? `¿Eliminar "${eventToDelete.title}"?${eventToDelete.isWeekly ? ' Se eliminarán todas sus repeticiones semanales.' : ''} Podrás deshacerlo durante unos segundos.` : ''}
        confirmText="Eliminar"
        variant="destructive"
        onConfirm={() => {
          if (eventToDelete) {
            onDeleteCustomEvent?.(eventToDelete.id, null, 'series');
            setEventToDelete(null);
          }
        }}
      />
    </div>
  );
}
