'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarRange,
  Clock,
  MapPin,
  AlignLeft,
  Trash2,
  Check,
  X,
  BookOpen,
  Dumbbell,
  Briefcase,
  Coffee,
  User,
  Tag,
  ArrowLeft,
} from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { SegmentedControl } from './ui/segmented-control';
import { Tooltip } from './ui/tooltip';
import { DatePicker } from './ui/date-picker';
import { TimePicker } from './ui/time-picker';
import { InlineCategoryChip } from './ui/inline-category-chip';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import {
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle,
} from '../utils/colorLogic';
import {
  DEFAULT_CATEGORIES,
  getStoredCustomCategories,
  saveStoredCustomCategories,
  getDefaultEventTimes,
  timeNumberToString,
  timeStringToNumber,
} from '../utils/customEvents';
import { toDateNumber, parseDateNumber, getAcademicYearBounds } from '../utils/dayLogic';
import { cn } from '../utils/cn';

const DAYS_NAMES = [
  { day: 1, label: 'L', full: 'Lunes' },
  { day: 2, label: 'M', full: 'Martes' },
  { day: 3, label: 'X', full: 'Miércoles' },
  { day: 4, label: 'J', full: 'Jueves' },
  { day: 5, label: 'V', full: 'Viernes' },
  { day: 6, label: 'S', full: 'Sábado' },
  { day: 0, label: 'D', full: 'Domingo' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Solo una vez' },
  { value: 'weekly', label: 'Semanal' },
];

function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function CustomEventModal({
  event,
  targetDate,
  initialStartTimeStr,
  initialEndTimeStr,
  suggestedColor = 4,
  onSave,
  onDelete,
  onClose,
  isDark = false,
}) {
  const isEditing = Boolean(event);
  const rawEvent = useMemo(() => event?.rawEvent || event || {}, [event]);

  const defaultTimes = useMemo(() => getDefaultEventTimes(), []);

  const initialDate = useMemo(() => {
    if (isEditing) {
      if (event?.date) return parseDateNumber(event.date);
      if (rawEvent.recurrence?.date) return parseDateNumber(rawEvent.recurrence.date);
    }
    if (targetDate) {
      return targetDate instanceof Date ? targetDate : new Date(targetDate);
    }
    return new Date();
  }, [isEditing, event, rawEvent, targetDate]);

  const targetDateNum = toDateNumber(initialDate);
  const currentDayOfWeek = initialDate.getDay();

  // Form State
  const [title, setTitle] = useState(rawEvent.title || event?.subjects?.[0] || '');
  const [category, setCategory] = useState(rawEvent.category || event?.category || '');
  const [customCategories, setCustomCategories] = useState(() => getStoredCustomCategories());

  const [startTimeStr, setStartTimeStr] = useState(() => {
    if (isEditing) {
      const s = rawEvent.startTime || event?.startTime;
      if (s) return timeNumberToString(s);
    }
    if (initialStartTimeStr) return initialStartTimeStr;
    return defaultTimes.startStr;
  });

  const [endTimeStr, setEndTimeStr] = useState(() => {
    if (isEditing) {
      const e = rawEvent.endTime || event?.endTime;
      if (e) return timeNumberToString(e);
    }
    if (initialEndTimeStr) return initialEndTimeStr;
    return defaultTimes.endStr;
  });

  const [recurrenceType, setRecurrenceType] = useState(() => {
    if (rawEvent.recurrence?.type) return rawEvent.recurrence.type;
    return 'none';
  });

  const [singleDateStr, setSingleDateStr] = useState(() => {
    if (isEditing && rawEvent.recurrence?.date) {
      return formatDateForInput(parseDateNumber(rawEvent.recurrence.date));
    }
    if (isEditing && event?.date) {
      return formatDateForInput(parseDateNumber(event.date));
    }
    return formatDateForInput(initialDate);
  });

  const [daysOfWeek, setDaysOfWeek] = useState(() => {
    if (Array.isArray(rawEvent.recurrence?.daysOfWeek) && rawEvent.recurrence.daysOfWeek.length > 0) {
      return rawEvent.recurrence.daysOfWeek;
    }
    return [currentDayOfWeek];
  });

  const bounds = getAcademicYearBounds(initialDate);
  const defaultEndOfYearStr = formatDateForInput(bounds.end);

  const [hasNoEndDate, setHasNoEndDate] = useState(() => {
    if (isEditing && rawEvent.recurrence?.type === 'weekly') {
      return rawEvent.recurrence.endDate === null || rawEvent.recurrence.endDate === undefined;
    }
    return false;
  });

  const [customEndDateStr, setCustomEndDateStr] = useState(() => {
    if (rawEvent.recurrence?.endDate) return formatDateForInput(parseDateNumber(rawEvent.recurrence.endDate));
    return defaultEndOfYearStr;
  });

  const [location, setLocation] = useState(rawEvent.location || event?.rooms?.[0] || '');
  const [notes, setNotes] = useState(rawEvent.notes || '');
  const [selectedColor, setSelectedColor] = useState(() => {
    if (typeof rawEvent.colorIndex === 'number') return rawEvent.colorIndex;
    if (typeof event?.colorIndex === 'number') return event.colorIndex;
    return suggestedColor;
  });

  // Sub-paso interno para alcance de repeticion: 'form' | 'scope-save' | 'scope-delete'
  const [viewStep, setViewStep] = useState('form');
  const [confirmSingleDeleteOpen, setConfirmSingleDeleteOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const errorBannerRef = useRef(null);

  const isRecurringEvent = rawEvent.recurrence?.type === 'weekly' || (isEditing && event?.recurrenceType === 'weekly');

  const weeklyStartDateNum = useMemo(() => {
    if (rawEvent.recurrence?.startDate) {
      return rawEvent.recurrence.startDate;
    }
    if (isEditing && (rawEvent.recurrence?.date || event?.date)) {
      return rawEvent.recurrence?.date || event?.date;
    }
    const startNum = timeStringToNumber(startTimeStr);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = Math.floor(startNum / 100) * 60 + (startNum % 100);
    if (startMinutes > nowMinutes) {
      return toDateNumber(now);
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return toDateNumber(tomorrow);
  }, [rawEvent, isEditing, event, startTimeStr]);

  const weeklyStartDateFormatted = formatDateDisplay(parseDateNumber(weeklyStartDateNum));

  const handleToggleDay = (dayNum) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayNum);
      } else {
        return [...prev, dayNum].sort();
      }
    });
  };

  const handleStartTimeChange = (newStart) => {
    setStartTimeStr(newStart);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, time: false }));
    const startNum = timeStringToNumber(newStart);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      const nextHour = Math.min(2359, startNum + 100);
      setEndTimeStr(timeNumberToString(nextHour));
    }
  };

  const handleAddCustomCategory = (trimmed) => {
    if (!trimmed) return;
    const allExisting = [...DEFAULT_CATEGORIES, ...customCategories];
    const exists = allExisting.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setCategory(exists);
    } else {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      saveStoredCustomCategories(updated);
      setCategory(trimmed);
    }
  };

  const handleDeleteCustomCategory = (catToDelete) => {
    const updated = customCategories.filter((c) => c.toLowerCase() !== catToDelete.toLowerCase());
    setCustomCategories(updated);
    saveStoredCustomCategories(updated);
    if ((category || '').toLowerCase() === catToDelete.toLowerCase()) {
      setCategory('');
    }
  };

  const validate = () => {
    const nextFieldErrors = {};
    if (!title.trim()) {
      nextFieldErrors.title = 'Introduce un título para el evento.';
      setFieldErrors(nextFieldErrors);
      setFormError('Por favor introduce un título para el evento.');
      setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return false;
    }
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      nextFieldErrors.time = true;
      setFieldErrors(nextFieldErrors);
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return false;
    }
    if (recurrenceType === 'weekly' && !hasNoEndDate && customEndDateStr) {
      const endD = new Date(customEndDateStr + 'T23:59:59');
      const startD = parseDateNumber(weeklyStartDateNum);
      if (endD < startD) {
        nextFieldErrors.endDate = true;
        setFieldErrors(nextFieldErrors);
        setFormError('La fecha límite no puede ser anterior a la de inicio.');
        setTimeout(() => {
          errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
        return false;
      }
    }
    setFieldErrors({});
    setFormError('');
    return true;
  };

  const buildEventPayload = () => {
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);

    let recObj = {
      type: recurrenceType,
      exceptions: rawEvent.recurrence?.exceptions || [],
    };

    if (recurrenceType === 'none') {
      const parsedD = new Date(singleDateStr + 'T00:00:00');
      recObj.date = toDateNumber(parsedD);
      recObj.startDate = recObj.date;
    } else {
      recObj.daysOfWeek = daysOfWeek;
      recObj.startDate = weeklyStartDateNum;
      recObj.endDate = hasNoEndDate ? null : toDateNumber(new Date(customEndDateStr + 'T23:59:59'));
    }

    return {
      id: rawEvent.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      category: category || '',
      startTime: startNum,
      endTime: endNum,
      location: location.trim(),
      notes: notes.trim(),
      colorIndex: selectedColor,
      recurrence: recObj,
    };
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && isRecurringEvent) {
      setViewStep('scope-save');
    } else {
      const payload = buildEventPayload();
      onSave(payload, 'series');
      onClose();
    }
  };

  const handleConfirmSave = (mode) => {
    const payload = buildEventPayload();
    onSave(payload, mode);
    onClose();
  };

  const handleDeleteClick = () => {
    if (isRecurringEvent) {
      setViewStep('scope-delete');
    } else {
      setConfirmSingleDeleteOpen(true);
    }
  };

  const handleConfirmDelete = (mode) => {
    onDelete(rawEvent.id, targetDateNum, mode);
    onClose();
  };

  const activeColorStyle = getSubjectColorStyle(selectedColor, isDark);

  return (
    <>
      <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ResponsiveModalContent
          className="max-w-lg p-0 pb-0 overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col"
        >
          {/* Pildora superior de acento con margen lateral (sin efecto media luna en esquinas) */}
          <div
            className="pointer-events-none absolute top-0 left-6 right-6 h-[3px] rounded-b-[4px] z-10"
            style={{
              backgroundColor: isDark
                ? `color-mix(in oklab, ${activeColorStyle.text} 55%, ${activeColorStyle.bg})`
                : activeColorStyle.bg,
            }}
          />

          {/* Sub-paso: Seleccionar alcance para Guardar o Eliminar */}
          {viewStep === 'scope-save' || viewStep === 'scope-delete' ? (
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
              <div className="flex items-center gap-2 pr-8">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewStep('form')}
                  className="touch-target-44 px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span>Atrás</span>
                </Button>
                <ResponsiveModalTitle className="text-base font-bold">
                  {viewStep === 'scope-delete' ? 'Eliminar repeticiones' : 'Modificar repeticiones'}
                </ResponsiveModalTitle>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed text-pretty">
                {viewStep === 'scope-delete'
                  ? 'Este evento se repite semanalmente. Elige qué instancias deseas eliminar:'
                  : 'Este evento se repite semanalmente. Elige el alcance de tus cambios:'}
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    viewStep === 'scope-delete' ? handleConfirmDelete('single') : handleConfirmSave('single')
                  }
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98]',
                    viewStep === 'scope-delete'
                      ? 'border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                      : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      viewStep === 'scope-delete'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-[var(--accent-light)] text-[var(--accent)]'
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      Solo esta fecha
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {viewStep === 'scope-delete'
                        ? 'Se conservan las demás semanas del horario'
                        : 'Aplica los cambios únicamente a este día'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    viewStep === 'scope-delete' ? handleConfirmDelete('series') : handleConfirmSave('series')
                  }
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98]',
                    viewStep === 'scope-delete'
                      ? 'border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                      : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      viewStep === 'scope-delete'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-[var(--accent-light)] text-[var(--accent)]'
                    )}
                  >
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      Toda la serie semanal
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {viewStep === 'scope-delete'
                        ? 'Elimina todas las fechas pasadas y futuras'
                        : 'Actualiza todas las repeticiones del curso'}
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-end">
                <Button variant="secondary" size="md" className="w-full sm:w-auto" onClick={() => setViewStep('form')}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            /* Vista del Formulario Principal con cuerpo scrollable y pie fijo */
            <form onSubmit={handleSaveClick} className="flex flex-col flex-1 min-h-0 overflow-hidden" noValidate>
              <ResponsiveModalHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-2 mb-0 shrink-0">
                <div className="flex items-center justify-between gap-2 pr-8">
                  <ResponsiveModalTitle>
                    {isEditing ? 'Editar evento' : 'Nuevo evento'}
                  </ResponsiveModalTitle>

                  {isEditing && (
                    <Tooltip content="Eliminar evento">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleDeleteClick}
                        aria-label="Eliminar evento"
                        className="h-8 w-8 rounded-full text-rose-600 dark:text-rose-400 hover:bg-rose-500/12 hover:text-rose-700 dark:hover:text-rose-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </ResponsiveModalHeader>

              {/* Cuerpo del formulario con scroll independiente */}
              <div
                data-sheet-scroll="true"
                className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pt-3 pb-4 space-y-4"
              >
                {/* Titulo */}
                <div>
                  <Input
                    placeholder="Título del evento..."
                    value={title}
                    error={fieldErrors.title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (fieldErrors.title) {
                        setFieldErrors((prev) => ({ ...prev, title: undefined }));
                        setFormError('');
                      }
                    }}
                    autoFocus={!isEditing}
                    className="text-base font-medium"
                  />
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                    <Tag className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                    <span>Etiqueta</span>
                    <span className="ml-1 font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCategory('')}
                      className={cn(
                        'h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                        !category
                          ? 'bg-[var(--accent)] text-white border-transparent'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      )}
                    >
                      Sin etiqueta
                    </button>

                    {DEFAULT_CATEGORIES.map((cat) => {
                      const isSelected = (category || '').toLowerCase() === cat.toLowerCase();
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={cn(
                            'inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                            isSelected
                              ? 'bg-[var(--accent)] text-white border-transparent'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                          )}
                        >
                          {cat.toLowerCase() === 'estudio' && <BookOpen className="w-3 h-3 mr-1" />}
                          {cat.toLowerCase() === 'deporte' && <Dumbbell className="w-3 h-3 mr-1" />}
                          {cat.toLowerCase() === 'trabajo' && <Briefcase className="w-3 h-3 mr-1" />}
                          {cat.toLowerCase() === 'ocio' && <Coffee className="w-3 h-3 mr-1" />}
                          {cat.toLowerCase() === 'personal' && <User className="w-3 h-3 mr-1" />}
                          <span>{cat}</span>
                        </button>
                      );
                    })}

                    {customCategories.map((cat) => {
                      const isSelected = (category || '').toLowerCase() === cat.toLowerCase();
                      return (
                        <span
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={cn(
                            'inline-flex items-center h-8 pl-3 pr-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer group',
                            isSelected
                              ? 'bg-[var(--accent)] text-white border-transparent'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                          )}
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          <span>{cat}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomCategory(cat);
                            }}
                            className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                            aria-label={`Eliminar etiqueta ${cat}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}

                    <InlineCategoryChip onAdd={handleAddCustomCategory} />
                  </div>
                </div>

                {/* Horas de Inicio y Fin */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                      <span>Inicio</span>
                    </label>
                    <TimePicker
                      value={startTimeStr}
                      step={15}
                      error={fieldErrors.time}
                      onChange={(str) => handleStartTimeChange(str)}
                      ariaLabel="Hora de inicio"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                      <span>Fin</span>
                    </label>
                    <TimePicker
                      value={endTimeStr}
                      step={15}
                      error={fieldErrors.time}
                      onChange={(str) => {
                        setEndTimeStr(str);
                        setFormError('');
                        setFieldErrors((prev) => ({ ...prev, time: false }));
                      }}
                      ariaLabel="Hora de fin"
                    />
                  </div>
                </div>

                {/* Repeticion */}
                <div className="space-y-2.5">
                  <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                    <span>Repetición</span>
                  </label>

                  <SegmentedControl
                    options={RECURRENCE_OPTIONS}
                    value={recurrenceType}
                    onChange={setRecurrenceType}
                    ariaLabel="Tipo de repetición"
                  />

                  {recurrenceType === 'none' ? (
                    <div className="pt-0.5">
                      <DatePicker
                        value={singleDateStr}
                        onChange={(str) => setSingleDateStr(str)}
                        ariaLabel="Fecha del evento"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-1">
                        {DAYS_NAMES.map((d) => {
                          const isSelected = daysOfWeek.includes(d.day);
                          return (
                            <button
                              key={d.day}
                              type="button"
                              onClick={() => handleToggleDay(d.day)}
                              title={d.full}
                              aria-label={d.full.toLowerCase()}
                              aria-pressed={isSelected}
                              className={cn(
                                'touch-target-44 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                                isSelected
                                  ? 'bg-[var(--accent)] text-white shadow-xs'
                                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
                              )}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                        Empieza a repetirse desde el <span className="font-semibold text-[var(--text-primary)]">{weeklyStartDateFormatted}</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[13px] font-medium text-[var(--text-primary)] block">
                          Fecha de finalización
                        </label>
                        <DatePicker
                          value={hasNoEndDate ? '' : customEndDateStr}
                          disabled={hasNoEndDate}
                          error={fieldErrors.endDate}
                          onChange={(str) => {
                            setCustomEndDateStr(str);
                            setFieldErrors((prev) => ({ ...prev, endDate: false }));
                            setFormError('');
                          }}
                          ariaLabel="Fecha de finalización"
                        />
                        <div className="flex items-center justify-between pt-1.5 text-xs">
                          <Checkbox
                            checked={hasNoEndDate}
                            onChange={setHasNoEndDate}
                            className="text-xs text-[var(--text-secondary)]"
                          >
                            Sin fecha límite
                          </Checkbox>
                          {!hasNoEndDate && customEndDateStr !== defaultEndOfYearStr && (
                            <button
                              type="button"
                              onClick={() => setCustomEndDateStr(defaultEndOfYearStr)}
                              className="text-[var(--accent)] hover:underline font-medium cursor-pointer"
                            >
                              Fin de curso (30 junio)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ubicacion y Notas */}
                <div className="space-y-1.5">
                  <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                    <span>Lugar</span>
                    <span className="ml-1 font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <Input
                    placeholder="Aula, biblioteca, despacho..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
                    <AlignLeft className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                    <span>Notas</span>
                    <span className="ml-1 font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <Textarea
                    minRows={2}
                    placeholder="Detalles o recordatorios..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[46px] py-1.5"
                  />
                </div>

                {/* Selector de Color de la Paleta */}
                <div className="space-y-2 pt-0.5">
                  <label className="text-[13px] font-medium text-[var(--text-primary)] block">
                    Color en el horario
                  </label>
                  <div className="grid grid-cols-7 gap-2.5 sm:gap-3 p-1 justify-items-center">
                    {CHROMATIC_ORDER_MAIN.concat(CHROMATIC_ORDER_SOFT).map((idx) => {
                      const cStyle = getSubjectColorStyle(idx, isDark);
                      const isSelected = selectedColor === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedColor(idx)}
                          style={{ background: cStyle.bg, borderColor: isSelected ? 'var(--accent)' : cStyle.border }}
                          className={cn(
                            'touch-target-44 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer active:scale-95 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
                            isSelected && 'scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-elevated)]'
                          )}
                          aria-label={`Color ${idx + 1}`}
                          aria-pressed={isSelected}
                          title={`Color ${idx + 1}`}
                        >
                          {isSelected && <Check className="w-4 h-4" style={{ color: cStyle.text }} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Banner de error */}
                {formError && (
                  <div
                    ref={errorBannerRef}
                    role="alert"
                    className="p-3 rounded-[var(--radius-md)] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs font-medium"
                  >
                    {formError}
                  </div>
                )}
              </div>

              {/* Pie de Acciones fijo con solo Cancelar y Guardar (Guardar con flex-[2] en movil) */}
              <ResponsiveModalFooter className="flex flex-row items-center justify-end gap-2.5 px-5 sm:px-6 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-[var(--border-light)] bg-[var(--surface-elevated)] shrink-0 z-10 mt-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial justify-center"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="md"
                  className="flex-[2] sm:flex-initial sm:min-w-[132px] justify-center"
                >
                  {isEditing ? 'Guardar' : 'Crear evento'}
                </Button>
              </ResponsiveModalFooter>
            </form>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmacion para borrado de evento puntual */}
      <ConfirmDialog
        open={confirmSingleDeleteOpen}
        onOpenChange={setConfirmSingleDeleteOpen}
        title="Eliminar evento"
        description={`¿Eliminar "${title.trim() || 'este evento'}"? Esta acción se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
        onConfirm={() => {
          onDelete(rawEvent.id, targetDateNum, 'series');
          toast.success('Evento eliminado', {
            action: {
              label: 'Deshacer',
              onClick: () => {
                onSave(rawEvent, 'series');
              },
            },
          });
          onClose();
        }}
      />
    </>
  );
}
