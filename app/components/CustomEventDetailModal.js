'use client';

import { useState } from 'react';
import { Pencil, MapPin, AlignLeft, Calendar, Trash2, X } from 'lucide-react';
import { getSubjectColorStyle } from '../utils/colorLogic';
import { parseDateNumber, formatDateShort } from '../utils/dayLogic';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };

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
          <div className="modal-subgroup" style={{ color: color.text }}>
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
            <div
              style={{
                marginTop: 10,
                padding: '8px 16px',
                borderRadius: 10,
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                fontSize: '0.88rem',
                lineHeight: 1.4,
                textAlign: 'center',
                maxWidth: '92%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {notes}
            </div>
          )}
        </div>

        {/* Acciones al pie */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={handleDeleteClick}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: isDark ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Eliminar
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
