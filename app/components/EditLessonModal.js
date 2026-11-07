'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin, AlignLeft, AlertCircle } from 'lucide-react';
import { subjectColor } from './WeekCalendar';
import { formatRoom, formatRooms } from '../utils/subgroups';

function timeNumberToString(t) {
  if (typeof t !== 'number') return '08:00';
  const h = Math.floor(t / 100);
  const m = t % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStringToNumber(s) {
  if (!s || typeof s !== 'string') return 0;
  const parts = s.split(':').map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

function parseDate(dateNum) {
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function EditLessonModal({ lesson, onSave, onClose, isDark = false }) {
  const [startTimeStr, setStartTimeStr] = useState(() => timeNumberToString(lesson?.startTime));
  const [endTimeStr, setEndTimeStr] = useState(() => timeNumberToString(lesson?.endTime));
  const [roomsStr, setRoomsStr] = useState(() => formatRooms(lesson?.rooms));
  const [notes, setNotes] = useState(() => lesson?.notes || '');
  const [error, setError] = useState('');

  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 60) {
      onClose?.();
    }
    touchStartY.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleStartTimeChange = (newStart) => {
    setStartTimeStr(newStart);
    setError('');
    const startNum = timeStringToNumber(newStart);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      const nextHour = Math.min(2359, startNum + 100);
      setEndTimeStr(timeNumberToString(nextHour));
    }
  };

  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateFormatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const subjectName = lesson.subjects?.[0] || 'Clase';

  const handleSubmit = (e) => {
    e.preventDefault();
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);

    if (endNum <= startNum) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    const roomsArr = roomsStr
      .split(',')
      .map(r => formatRoom(r.trim()))
      .filter(Boolean);

    onSave(lesson, {
      customStartTime: startNum,
      customEndTime: endNum,
      customRooms: roomsArr.length > 0 ? roomsArr : undefined,
      customNotes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-sheet custom-event-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderTop: `4px solid ${color.bg}`,
        }}
      >
        <div
          className="modal-drag-handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: 'grab', touchAction: 'none' }}
        />

        <div className="custom-event-modal-header" style={{ marginBottom: 12 }}>
          <div>
            <div className="custom-event-modal-title">
              Personalizar clase
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.65, marginTop: 2 }}>
              {dayName} {dateFormatted}
            </div>
          </div>
          <button className="custom-modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Info cabecera de la asignatura */}
        <div
          style={{
            background: color.bg,
            color: color.text,
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 16,
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{subjectName}</span>
          {lesson.type && (
            <span style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 500 }}>
              {lesson.type}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="custom-event-form" noValidate>
          {/* Horas de Inicio y Fin (precisión 5 min) */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                <Clock size={15} style={{ marginRight: 6 }} /> Inicio
              </label>
              <input
                type="time"
                step="300"
                className="event-input-time"
                value={startTimeStr}
                onChange={e => handleStartTimeChange(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">
                <Clock size={15} style={{ marginRight: 6 }} /> Fin
              </label>
              <input
                type="time"
                step="300"
                className="event-input-time"
                value={endTimeStr}
                onChange={e => {
                  setEndTimeStr(e.target.value);
                  setError('');
                }}
                required
              />
            </div>
          </div>

          {/* Aula */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={15} style={{ marginRight: 6 }} /> Aula / Ubicación (opcional)
            </label>
            <input
              type="text"
              className="event-input-text"
              placeholder="Aula o ubicación..."
              value={roomsStr}
              onChange={e => setRoomsStr(e.target.value)}
            />
          </div>

          {/* Notas personales */}
          <div className="form-group">
            <label className="form-label">
              <AlignLeft size={15} style={{ marginRight: 6 }} /> Notas personales (opcional)
            </label>
            <textarea
              className="event-input-textarea"
              placeholder="Detalles o recordatorios..."
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div
              className="custom-event-error-banner"
              style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="custom-event-actions">
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
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
