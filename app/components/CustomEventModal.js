'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
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
  Tag
} from 'lucide-react';
import {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle
} from '../utils/colorLogic';
import {
  EVENT_CATEGORIES,
  timeNumberToString,
  timeStringToNumber
} from '../utils/customEvents';
import { toDateNumber, parseDateNumber, getAcademicYearBounds } from '../utils/dayLogic';

const DAYS_NAMES = [
  { day: 1, label: 'L', full: 'Lunes' },
  { day: 2, label: 'M', full: 'Martes' },
  { day: 3, label: 'X', full: 'Miércoles' },
  { day: 4, label: 'J', full: 'Jueves' },
  { day: 5, label: 'V', full: 'Viernes' },
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
  event,          // Instancia del evento a editar, o null si es nuevo
  targetDate,     // Fecha de la celda pulsada o día activo
  suggestedColor = 4,
  onSave,
  onDelete,
  onClose,
  isDark = false
}) {
  const isEditing = Boolean(event);
  const rawEvent = event?.rawEvent || event || {};

  // Fecha base para inicializar
  const initialDate = useMemo(() => {
    if (event?.date) return parseDateNumber(event.date);
    if (targetDate) return new Date(targetDate);
    return new Date();
  }, [event, targetDate]);

  // Si hoy es fin de semana, ajustar a lunes para no tener días fuera de rango
  const safeInitialDate = useMemo(() => {
    const d = new Date(initialDate);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d;
  }, [initialDate]);

  const targetDateNum = toDateNumber(safeInitialDate);
  const currentDayOfWeek = safeInitialDate.getDay();

  // ── Form State ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(rawEvent.title || event?.subjects?.[0] || '');
  const [category, setCategory] = useState(rawEvent.category || event?.category || '');
  const [startTimeStr, setStartTimeStr] = useState(() => {
    return timeNumberToString(rawEvent.startTime || event?.startTime || 1200);
  });
  const [endTimeStr, setEndTimeStr] = useState(() => {
    return timeNumberToString(rawEvent.endTime || event?.endTime || 1300);
  });

  const [recurrenceType, setRecurrenceType] = useState(() => {
    if (rawEvent.recurrence?.type) return rawEvent.recurrence.type;
    return 'none'; // 'none' (puntual) o 'weekly'
  });

  const [singleDateStr, setSingleDateStr] = useState(() => {
    if (rawEvent.recurrence?.date) return formatDateForInput(parseDateNumber(rawEvent.recurrence.date));
    return formatDateForInput(safeInitialDate);
  });

  const [daysOfWeek, setDaysOfWeek] = useState(() => {
    if (Array.isArray(rawEvent.recurrence?.daysOfWeek) && rawEvent.recurrence.daysOfWeek.length > 0) {
      return rawEvent.recurrence.daysOfWeek;
    }
    return [currentDayOfWeek >= 1 && currentDayOfWeek <= 5 ? currentDayOfWeek : 1];
  });

  const bounds = getAcademicYearBounds(safeInitialDate);
  const [untilEndOfYear, setUntilEndOfYear] = useState(() => {
    return !rawEvent.recurrence?.endDate;
  });
  const [customEndDateStr, setCustomEndDateStr] = useState(() => {
    if (rawEvent.recurrence?.endDate) return formatDateForInput(parseDateNumber(rawEvent.recurrence.endDate));
    return formatDateForInput(bounds.end);
  });

  const [location, setLocation] = useState(rawEvent.location || event?.rooms?.[0] || '');
  const [notes, setNotes] = useState(rawEvent.notes || '');
  const [selectedColor, setSelectedColor] = useState(() => {
    if (typeof rawEvent.colorIndex === 'number') return rawEvent.colorIndex;
    if (typeof event?.colorIndex === 'number') return event.colorIndex;
    return suggestedColor;
  });

  // Modal para preguntar si editar/borrar solo esta fecha o la serie recurrente
  const [confirmScopeModal, setConfirmScopeModal] = useState(null); // 'save' | 'delete' | null
  const [formError, setFormError] = useState('');

  const isRecurringEvent = rawEvent.recurrence?.type === 'weekly' || (isEditing && event?.recurrenceType === 'weekly');

  const handleToggleDay = (dayNum) => {
    setDaysOfWeek(prev => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev; // Al menos un día seleccionado
        return prev.filter(d => d !== dayNum);
      } else {
        return [...prev, dayNum].sort();
      }
    });
  };

  const validate = () => {
    if (!title.trim()) {
      setFormError('Por favor introduce un título para el evento.');
      return false;
    }
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      return false;
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
      recObj.startDate = rawEvent.recurrence?.startDate || toDateNumber(safeInitialDate);
      recObj.endDate = untilEndOfYear ? null : toDateNumber(new Date(customEndDateStr + 'T23:59:59'));
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
      // Preguntar si afecta solo a esta fecha o a toda la serie
      setConfirmScopeModal('save');
    } else {
      const payload = buildEventPayload();
      onSave(payload, 'series');
      onClose();
    }
  };

  const handleConfirmSave = (mode) => {
    const payload = buildEventPayload();
    onSave(payload, mode);
    setConfirmScopeModal(null);
    onClose();
  };

  const handleDeleteClick = () => {
    if (isRecurringEvent) {
      setConfirmScopeModal('delete');
    } else {
      onDelete(rawEvent.id, targetDateNum, 'series');
      onClose();
    }
  };

  const handleConfirmDelete = (mode) => {
    onDelete(rawEvent.id, targetDateNum, mode);
    setConfirmScopeModal(null);
    onClose();
  };

  const activeColorStyle = getSubjectColorStyle(selectedColor, isDark);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet custom-event-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderTop: `4px solid ${activeColorStyle.bg}`,
        }}
      >
        <div className="modal-drag-handle" />

        <div className="custom-event-modal-header">
          <div className="custom-event-modal-title">
            {isEditing ? 'Editar evento' : 'Nuevo evento'}
          </div>
          <button className="custom-modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {formError && (
          <div className="custom-event-error-banner">
            {formError}
          </div>
        )}

        <form onSubmit={handleSaveClick} className="custom-event-form">
          {/* Título */}
          <div className="form-group">
            <input
              type="text"
              className="event-input-title"
              placeholder="¿Qué tienes planeado? (ej. Gimnasio, Estudio...)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus={!isEditing}
            />
          </div>

          {/* Categoría (opcional) */}
          <div className="form-group">
            <label className="form-label">
              <Tag size={15} style={{ marginRight: 6 }} /> Etiqueta (opcional)
            </label>
            <div className="category-chips">
              <button
                type="button"
                className={`category-chip${!category ? ' active' : ''}`}
                onClick={() => setCategory('')}
              >
                Sin etiqueta
              </button>
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip${category === cat.id ? ' active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.id === 'estudio' && <BookOpen size={13} style={{ marginRight: 4 }} />}
                  {cat.id === 'deporte' && <Dumbbell size={13} style={{ marginRight: 4 }} />}
                  {cat.id === 'trabajo' && <Briefcase size={13} style={{ marginRight: 4 }} />}
                  {cat.id === 'ocio' && <Coffee size={13} style={{ marginRight: 4 }} />}
                  {cat.id === 'personal' && <User size={13} style={{ marginRight: 4 }} />}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horas de Inicio y Fin (precisión 5 min) */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <Clock size={15} style={{ marginRight: 6 }} /> Inicio
              </label>
              <input
                type="time"
                name="startTime"
                aria-label="Hora de inicio"
                step="300"
                className="event-input-time"
                value={startTimeStr}
                onChange={e => setStartTimeStr(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">
                <Clock size={15} style={{ marginRight: 6 }} /> Fin
              </label>
              <input
                type="time"
                name="endTime"
                aria-label="Hora de fin"
                step="300"
                className="event-input-time"
                value={endTimeStr}
                onChange={e => setEndTimeStr(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Tipo de Recurrencia */}
          <div className="form-group">
            <label className="form-label">
              <CalendarIcon size={15} style={{ marginRight: 6 }} /> Repetición
            </label>
            <div className="recurrence-toggle-bar">
              <button
                type="button"
                className={`recurrence-tab${recurrenceType === 'none' ? ' active' : ''}`}
                onClick={() => setRecurrenceType('none')}
              >
                Solo una vez
              </button>
              <button
                type="button"
                className={`recurrence-tab${recurrenceType === 'weekly' ? ' active' : ''}`}
                onClick={() => setRecurrenceType('weekly')}
              >
                Semanal
              </button>
            </div>

            {recurrenceType === 'none' ? (
              <div className="recurrence-panel" style={{ marginTop: 10 }}>
                <input
                  type="date"
                  className="event-input-date"
                  value={singleDateStr}
                  onChange={e => setSingleDateStr(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="recurrence-panel" style={{ marginTop: 10 }}>
                <div className="days-picker">
                  {DAYS_NAMES.map(d => {
                    const isSelected = daysOfWeek.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        className={`day-pick-btn${isSelected ? ' active' : ''}`}
                        onClick={() => handleToggleDay(d.day)}
                        title={d.full}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                <div className="end-date-toggle" style={{ marginTop: 12 }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={untilEndOfYear}
                      onChange={e => setUntilEndOfYear(e.target.checked)}
                    />
                    <span>Hasta fin de curso (30 de junio)</span>
                  </label>
                  {!untilEndOfYear && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="date"
                        className="event-input-date"
                        value={customEndDateStr}
                        onChange={e => setCustomEndDateStr(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ubicación y Notas (Opcionales) */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={15} style={{ marginRight: 6 }} /> Lugar / Ubicación (opcional)
            </label>
            <input
              type="text"
              className="event-input-text"
              placeholder="ej. Biblioteca, Polideportivo, Aula 2.3..."
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <AlignLeft size={15} style={{ marginRight: 6 }} /> Notas adicionales (opcional)
            </label>
            <textarea
              className="event-input-textarea"
              placeholder="Apuntes, recordatorios, material a llevar..."
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Selector de Color de la Paleta */}
          <div className="form-group">
            <label className="form-label">Color en el horario</label>
            <div className="color-swatches-grid">
              {CHROMATIC_ORDER_MAIN.concat(CHROMATIC_ORDER_SOFT).map(idx => {
                const cStyle = getSubjectColorStyle(idx, isDark);
                const isSelected = selectedColor === idx;
                const isSuggested = suggestedColor === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`color-swatch-btn${isSelected ? ' selected' : ''}`}
                    style={{
                      background: cStyle.bg,
                      borderColor: isSelected ? 'var(--accent)' : cStyle.border,
                    }}
                    onClick={() => setSelectedColor(idx)}
                    title={`Color ${idx + 1}${isSuggested ? ' (Recomendado)' : ''}`}
                  >
                    {isSelected && <Check size={14} color={cStyle.text} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="custom-event-actions">
            {isEditing && (
              <button
                type="button"
                className="event-btn-delete"
                onClick={handleDeleteClick}
              >
                <Trash2 size={16} style={{ marginRight: 6 }} /> Eliminar
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="event-btn-cancel"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="event-btn-save"
            >
              {isEditing ? 'Guardar' : 'Crear evento'}
            </button>
          </div>
        </form>

        {/* Modal de confirmación para eventos recurrentes (Guardar / Eliminar) */}
        {confirmScopeModal && (
          <div className="scope-dialog-overlay" onClick={() => setConfirmScopeModal(null)}>
            <div className="scope-dialog-card" onClick={e => e.stopPropagation()}>
              <div className="scope-dialog-title">
                {confirmScopeModal === 'delete' ? '¿Qué repeticiones deseas eliminar?' : '¿Qué repeticiones deseas modificar?'}
              </div>
              <div className="scope-dialog-subtitle">
                Este es un evento semanal recurrente.
              </div>
              <div className="scope-dialog-buttons">
                <button
                  type="button"
                  className="scope-btn single"
                  onClick={() => confirmScopeModal === 'delete' ? handleConfirmDelete('single') : handleConfirmSave('single')}
                >
                  {confirmScopeModal === 'delete' ? 'Eliminar solo esta fecha' : 'Modificar solo esta fecha'}
                </button>
                <button
                  type="button"
                  className="scope-btn series"
                  onClick={() => confirmScopeModal === 'delete' ? handleConfirmDelete('series') : handleConfirmSave('series')}
                >
                  {confirmScopeModal === 'delete' ? 'Eliminar todas las repeticiones' : 'Modificar toda la repetición'}
                </button>
                <button
                  type="button"
                  className="scope-btn cancel"
                  onClick={() => setConfirmScopeModal(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
