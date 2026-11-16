'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { DatePicker } from './ui/date-picker';
import { TimePicker } from './ui/time-picker';
import { InlineCategoryChip } from './ui/inline-category-chip';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import {
  PALETTE,
  PALETTE_DARK,
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

function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const rawEvent = event?.rawEvent || event || {};

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

  // ── Form State ─────────────────────────────────────────────────────────────
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

  // Sub-paso interno para alcance de repetición: 'form' | 'scope-save' | 'scope-delete'
  const [viewStep, setViewStep] = useState('form');
  const [confirmSingleDeleteOpen, setConfirmSingleDeleteOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const errorBannerRef = useRef(null);

  const isRecurringEvent = rawEvent.recurrence?.type === 'weekly' || (isEditing && event?.recurrenceType === 'weekly');

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
    if (!title.trim()) {
      setFormError('Por favor introduce un título para el evento.');
      setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return false;
    }
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return false;
    }
    if (recurrenceType === 'weekly' && !hasNoEndDate && customEndDateStr) {
      const endD = new Date(customEndDateStr + 'T23:59:59');
      const startD = parseDateNumber(rawEvent.recurrence?.startDate || toDateNumber(initialDate));
      if (endD < startD) {
        setFormError('La fecha límite no puede ser anterior a la de inicio.');
        setTimeout(() => {
          errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
        return false;
      }
    }
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

      let computedStartDate;
      if (rawEvent.recurrence?.startDate) {
        computedStartDate = rawEvent.recurrence.startDate;
      } else if (isEditing && (rawEvent.recurrence?.date || event?.date)) {
        computedStartDate = rawEvent.recurrence?.date || event?.date;
      } else {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = Math.floor(startNum / 100) * 60 + (startNum % 100);
        if (startMinutes > nowMinutes) {
          computedStartDate = toDateNumber(now);
        } else {
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          computedStartDate = toDateNumber(tomorrow);
        }
      }

      recObj.startDate = computedStartDate;
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
          className="max-w-lg p-5 sm:p-6 overflow-y-auto max-h-[90vh]"
          style={{ borderTop: `4px solid ${activeColorStyle.bg}` }}
        >
          {/* Sub-paso: Seleccionar alcance para Guardar o Eliminar (sin modal sobre modal) */}
          {viewStep === 'scope-save' || viewStep === 'scope-delete' ? (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewStep('form')}
                  className="px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span>Atrás</span>
                </Button>
                <ResponsiveModalTitle className="text-base font-semibold">
                  {viewStep === 'scope-delete' ? 'Eliminar repeticiones' : 'Modificar repeticiones'}
                </ResponsiveModalTitle>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
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

              <div className="pt-2 flex justify-end">
                <Button variant="secondary" size="md" onClick={() => setViewStep('form')}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            /* Vista del Formulario Principal */
            <form onSubmit={handleSaveClick} className="space-y-4" noValidate>
              <ResponsiveModalHeader className="mb-2">
                <ResponsiveModalTitle>
                  {isEditing ? 'Editar evento' : 'Nuevo evento'}
                </ResponsiveModalTitle>
              </ResponsiveModalHeader>

              {/* Título */}
              <div className="space-y-1.5">
                <Input
                  placeholder="Título del evento..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus={!isEditing}
                  className="text-base font-medium"
                />
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Etiqueta (opcional)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCategory('')}
                    className={cn(
                      'h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer',
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
                          'inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer',
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

              {/* Horas de Inicio y Fin (precisión asistida 15 min + tecleado directo) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Inicio
                  </label>
                  <TimePicker
                    value={startTimeStr}
                    step={15}
                    onChange={(str) => handleStartTimeChange(str)}
                    ariaLabel="Hora de inicio"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Fin
                  </label>
                  <TimePicker
                    value={endTimeStr}
                    step={15}
                    onChange={(str) => setEndTimeStr(str)}
                    ariaLabel="Hora de fin"
                  />
                </div>
              </div>

              {/* Repetición */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Repetición
                </label>
                <div className="grid grid-cols-2 p-1 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('none')}
                    className={cn(
                      'py-1.5 text-xs font-medium rounded-[var(--radius-md)] transition-all cursor-pointer select-none',
                      recurrenceType === 'none'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    Solo una vez
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('weekly')}
                    className={cn(
                      'py-1.5 text-xs font-medium rounded-[var(--radius-md)] transition-all cursor-pointer select-none',
                      recurrenceType === 'weekly'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    Semanal
                  </button>
                </div>

                {recurrenceType === 'none' ? (
                  <div className="pt-1">
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
                        const isWeekend = d.day === 6 || d.day === 0;
                        return (
                          <button
                            key={d.day}
                            type="button"
                            onClick={() => handleToggleDay(d.day)}
                            title={d.full}
                            className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none active:scale-[0.96]',
                              isSelected
                                ? 'bg-[var(--accent)] text-white shadow-xs'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]',
                              isWeekend && !isSelected && 'opacity-65'
                            )}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Fecha de finalización
                      </label>
                      <DatePicker
                        value={hasNoEndDate ? '' : customEndDateStr}
                        disabled={hasNoEndDate}
                        onChange={(str) => setCustomEndDateStr(str)}
                        ariaLabel="Fecha de finalización"
                      />
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={hasNoEndDate}
                            onChange={(e) => setHasNoEndDate(e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                          />
                          <span>Sin fecha límite</span>
                        </label>
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

              {/* Ubicación y Notas */}
              <div className="space-y-1.5">
                <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Lugar (opcional)
                </label>
                <Input
                  placeholder="Aula, biblioteca, despacho..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <AlignLeft className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Notas (opcional)
                </label>
                <Textarea
                  placeholder="Detalles o recordatorios..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Selector de Color de la Paleta */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Color en el horario
                </label>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-2 p-1">
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
                          'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer active:scale-95 shadow-xs',
                          isSelected && 'scale-110 ring-2 ring-[var(--accent)] ring-offset-2'
                        )}
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
                  className="p-3 rounded-[var(--radius-md)] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-medium"
                >
                  {formError}
                </div>
              )}

              {/* Botones de Acción */}
              <ResponsiveModalFooter className="flex-row justify-between items-center gap-2 pt-4">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="destructiveOutline"
                    size="md"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    <span>Eliminar</span>
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="md" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="default" size="md">
                    {isEditing ? 'Guardar' : 'Crear evento'}
                  </Button>
                </div>
              </ResponsiveModalFooter>
            </form>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmación para borrado de evento puntual */}
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
