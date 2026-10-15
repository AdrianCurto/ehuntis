'use client';

import { useState } from 'react';
import { Pencil, MapPin, AlignLeft, Calendar, Trash2, X } from 'lucide-react';
import { getSubjectColorStyle } from '../utils/colorLogic';
import { parseDateNumber } from '../utils/dayLogic';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_SHORT = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

function formatTime(t) {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function CustomEventDetailModal({
  event,
  onEdit,
  onDelete,
  onClose,
  isDark = false
}) {
  const [confirmScopeDelete, setConfirmScopeDelete] = useState(false);

  if (!event) return null;

  const rawEvent = event.rawEvent || event;
  const date = parseDateNumber(event.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(event.startTime)}–${formatTime(event.endTime)}`;
  const color = getSubjectColorStyle(event.colorIndex ?? 4, isDark);

  const title = event.subjects?.[0] || rawEvent.title || 'Evento personal';
  const location = event.rooms?.[0] || rawEvent.location || '';
  const notes = event.notes || rawEvent.notes || '';
  const category = event.category || rawEvent.category || '';
  const isRecurring = rawEvent.recurrence?.type === 'weekly';

  let recurrenceDescription = 'Evento puntual';
  if (isRecurring) {
    const days = (rawEvent.recurrence.daysOfWeek || []).map(d => DAYS_SHORT[d] || '').filter(Boolean).join(', ');
    const endStr = rawEvent.recurrence.endDate 
      ? `hasta ${formatDateShort(parseDateNumber(rawEvent.recurrence.endDate))}`
      : 'hasta fin de curso';
    recurrenceDescription = `Repetición semanal: ${days} (${endStr})`;
  }

  function formatDateShort(d) {
    return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }

  const handleDeleteClick = () => {
    if (isRecurring) {
      setConfirmScopeDelete(true);
    } else {
      onDelete(rawEvent.id, event.date, 'series');
      onClose();
    }
  };

  const handleConfirmDelete = (mode) => {
    onDelete(rawEvent.id, event.date, mode);
    setConfirmScopeDelete(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        style={{ background: color.bg, borderTop: color.border ? `1px solid ${color.border}` : undefined }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-drag-handle" style={{ background: color.text, opacity: 0.3 }} />

        {/* Botón Cerrar (Izquierda) */}
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar"
          style={{ color: color.text }}
        >
          ✕
        </button>

        {/* Botón Editar con icono de lápiz (Derecha) */}
        <button
          className="modal-menu-btn"
          onClick={onEdit}
          aria-label="Editar evento"
          title="Editar evento"
          style={{
            color: color.text,
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Pencil size={18} strokeWidth={2.2} />
        </button>

        <div className="modal-header">
          <div className="modal-day" style={{ color: color.text, opacity: 0.7 }}>
            {dayName} {dateStr}
          </div>
          <div className="modal-time" style={{ color: color.text, opacity: 0.6 }}>
            {timeStr}
          </div>
        </div>

        {/* Categoría si existe */}
        {category && (
          <div
            className="modal-subgroup"
            style={{
              color: color.text,
              background: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)',
              borderRadius: 6,
              padding: '2px 8px',
              display: 'inline-block',
              alignSelf: 'center',
              marginBottom: 4,
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            {category}
          </div>
        )}

        {/* Título del evento */}
        <div className="modal-subject" style={{ color: color.text, marginTop: 4 }}>
          {title}
        </div>

        {/* Detalles adicionales */}
        <div className="modal-detail" style={{ color: color.text, gap: 8, marginTop: 12 }}>
          {location && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <MapPin size={16} style={{ opacity: 0.7 }} />
              <span>{location}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.85rem', opacity: 0.8 }}>
            <Calendar size={14} style={{ opacity: 0.7 }} />
            <span>{recurrenceDescription}</span>
          </div>

          {notes && (
            <div style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              fontSize: '0.9rem',
              lineHeight: 1.4,
              textAlign: 'left',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7, marginBottom: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                <AlignLeft size={13} /> Notas
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>
            </div>
          )}
        </div>

        {/* Acciones al pie */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, width: '100%' }}>
          <button
            type="button"
            onClick={handleDeleteClick}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: isDark ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Trash2 size={15} /> Eliminar
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.85)',
              color: isDark ? '#fff' : '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Pencil size={15} /> Editar
          </button>
        </div>

        {/* Diálogo de confirmación para borrar serie recurrente */}
        {confirmScopeDelete && (
          <div className="scope-dialog-overlay" onClick={() => setConfirmScopeDelete(false)}>
            <div className="scope-dialog-card" onClick={e => e.stopPropagation()}>
              <div className="scope-dialog-title">
                ¿Qué repeticiones deseas eliminar?
              </div>
              <div className="scope-dialog-subtitle">
                Este es un evento semanal recurrente.
              </div>
              <div className="scope-dialog-buttons">
                <button
                  type="button"
                  className="scope-btn single"
                  onClick={() => handleConfirmDelete('single')}
                >
                  Eliminar solo esta fecha
                </button>
                <button
                  type="button"
                  className="scope-btn series"
                  onClick={() => handleConfirmDelete('series')}
                >
                  Eliminar todas las repeticiones
                </button>
                <button
                  type="button"
                  className="scope-btn cancel"
                  onClick={() => setConfirmScopeDelete(false)}
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
