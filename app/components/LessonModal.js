'use client';

import { useEffect, useRef } from 'react';
import { 
  X, 
  Clock, 
  MapPin, 
  User, 
  Pencil, 
  ArrowUpDown, 
  Ban, 
  CheckCircle2, 
  RotateCcw, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { subjectColor } from './WeekCalendar';
import { formatTeacher } from '../utils/teachers';
import { formatTime } from '../utils/lessonOverrides';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseDate(dateNum) {
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

export default function LessonModal({
  lesson,
  onClose,
  isDark = false,
  onToggleCancelled,
  onOpenEdit,
  onOpenSwap,
  onResetOverride,
  onResolveDrift,
}) {
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

  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);

  const subjectName = lesson.subjects?.[0] || 'Sin asignatura';
  const teacher = formatTeacher(lesson.teachers?.[0] || '');
  const room = (lesson.rooms || []).join(', ') || '';
  const classes = lesson.classes || [];
  const subgroupStr = classes.length > 0 ? classes.join(', ') : '';

  const isUserCancelled = Boolean(lesson.isUserCancelled);
  const isWebUntisCancelled = lesson.rawCode === 'cancelled' || (lesson.code === 'cancelled' && !isUserCancelled);
  const isOverridden = Boolean(lesson.isOverridden);
  const hasDrift = Boolean(lesson.hasRemoteDrift && lesson.driftChanges && lesson.driftChanges.length > 0);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-sheet"
        style={{
          background: color.bg,
          borderTop: color.border ? `1px solid ${color.border}` : undefined,
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="modal-drag-handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ background: color.text, opacity: 0.3, cursor: 'grab', touchAction: 'none' }}
        />

        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar"
          style={{ color: color.text }}
        >
          ✕
        </button>

        {/* Cabecera */}
        <div className="modal-header" style={{ marginBottom: 14 }}>
          <div className="modal-day" style={{ color: color.text, opacity: 0.75 }}>
            {dayName} {dateStr}
          </div>
          <div className="modal-time" style={{ color: color.text, opacity: 0.7, fontWeight: 600 }}>
            {timeStr}
          </div>
        </div>

        {/* Drift warning banner si WebUntis actualizó datos */}
        {hasDrift && (
          <div
            style={{
              background: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(254, 243, 199, 0.95)',
              border: '1px solid #f59e0b',
              color: isDark ? '#fbbf24' : '#92400e',
              padding: '12px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: '0.86rem',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
              <AlertTriangle size={16} /> WebUntis ha actualizado esta clase:
            </div>
            <ul style={{ margin: '4px 0 10px 18px', padding: 0 }}>
              {lesson.driftChanges.map((ch, idx) => (
                <li key={idx} style={{ marginBottom: 2 }}>
                  <strong>{ch.label}:</strong> {ch.before} → <span style={{ fontWeight: 600 }}>{ch.after}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onResolveDrift?.(lesson, 'adopt_remote')}
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Adoptar cambio oficial
              </button>
              <button
                type="button"
                onClick={() => onResolveDrift?.(lesson, 'keep_local')}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid currentColor',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Mantener mi versión
              </button>
            </div>
          </div>
        )}

        {/* Subgrupo */}
        {subgroupStr && (
          <div className="modal-subgroup" style={{ color: color.text }}>
            {subgroupStr}
          </div>
        )}

        {/* Nombre Asignatura */}
        <div className="modal-subject" style={{ color: color.text }}>
          {subjectName}
        </div>

        {/* Tipo de clase */}
        {lesson.type && (
          <div style={{ color: color.text, opacity: 0.85, fontSize: '0.9rem', marginBottom: '8px', textAlign: 'center' }}>
            {lesson.type}
          </div>
        )}

        {/* Badges de estado / Swap */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {isUserCancelled && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239, 68, 68, 0.2)',
                color: isDark ? '#fca5a5' : '#b91c1c',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <Ban size={14} /> Cancelada por ti
            </div>
          )}

          {isWebUntisCancelled && !isUserCancelled && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(245, 158, 11, 0.2)',
                color: isDark ? '#fcd34d' : '#b45309',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              ⚠️ Cancelada por la universidad
            </div>
          )}

          {lesson.swappedWith && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(59, 130, 246, 0.2)',
                color: isDark ? '#93c5fd' : '#1d4ed8',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              <ArrowUpDown size={13} /> Permutada con {lesson.swappedWith.subjectName}
            </div>
          )}

          {isOverridden && !isUserCancelled && !lesson.swappedWith && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0, 0, 0, 0.12)',
                color: color.text,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <Pencil size={12} /> Personalizada
            </div>
          )}
        </div>

        {/* Detalles: Profesor y Aula */}
        <div className="modal-detail" style={{ color: color.text, marginBottom: 12 }}>
          {teacher && <div>{teacher}</div>}
          {room && <div>{room}</div>}
        </div>

        {/* Notas personales */}
        {lesson.notes && (
          <div
            style={{
              background: 'rgba(0,0,0,0.08)',
              color: color.text,
              borderRadius: 10,
              padding: '10px 14px',
              margin: '12px 0 16px',
              fontSize: '0.88rem',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8rem', opacity: 0.75, marginBottom: 4 }}>
              <FileText size={14} /> Notas personales:
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{lesson.notes}</div>
          </div>
        )}

        {/* ── Botones de Personalización / Acciones ── */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Fila de acciones principales: Cancelar toggle + Editar */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Toggle Cancelar */}
            <button
              type="button"
              onClick={() => onToggleCancelled?.(lesson)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: isUserCancelled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                color: isUserCancelled ? (isDark ? '#86efac' : '#15803d') : (isDark ? '#fca5a5' : '#b91c1c'),
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {isUserCancelled ? (
                <>
                  <CheckCircle2 size={16} /> Reactivar clase
                </>
              ) : (
                <>
                  <Ban size={16} /> Marcar como cancelada
                </>
              )}
            </button>

            {/* Editar clase */}
            <button
              type="button"
              onClick={() => onOpenEdit?.(lesson)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(0, 0, 0, 0.12)',
                color: color.text,
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Pencil size={15} /> Editar clase
            </button>
          </div>

          {/* Fila secundaria: Intercambiar + Restablecer */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => onOpenSwap?.(lesson)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(0, 0, 0, 0.08)',
                color: color.text,
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              <ArrowUpDown size={15} /> Intercambiar horario
            </button>

            {isOverridden && (
              <button
                type="button"
                onClick={() => onResetOverride?.(lesson)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.08)',
                  color: color.text,
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
                title="Descartar todas las modificaciones y volver al estado oficial de WebUntis"
              >
                <RotateCcw size={14} /> Restablecer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
