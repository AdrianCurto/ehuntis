'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ArrowUpDown, Clock, MapPin, AlertCircle } from 'lucide-react';
import { subjectColor } from './WeekCalendar';
import { formatTime } from '../utils/lessonOverrides';
import { toMinutes } from '../utils/dayLogic';

function parseDate(dateNum) {
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const fromMinutes = (m) => Math.floor(m / 60) * 100 + (m % 60);

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function SwapLessonModal({
  lesson,
  candidateLessons = [],
  onSwap,
  onClose,
  isDark = false,
}) {
  const [keepDuration, setKeepDuration] = useState(true);
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

  const originDuration = toMinutes(lesson.endTime) - toMinutes(lesson.startTime);

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateFormatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const currentColor = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const currentSubject = lesson.subjects?.[0] || 'Clase';

  // Filter out the lesson itself and any custom events
  const validCandidates = candidateLessons.filter(c => {
    if (!c || c.isCustomEvent) return false;
    if (c.lessonKey && c.lessonKey === lesson.lessonKey) return false;
    if (c.id && lesson.id && c.id === lesson.id) return false;
    return true;
  });

  const hasAnyDurationDiff = validCandidates.some(c => (toMinutes(c.endTime) - toMinutes(c.startTime)) !== originDuration);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="custom-event-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderTop: `4px solid ${currentColor.bg}`,
          width: '100%',
          maxWidth: '500px',
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
            <div className="custom-event-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.15rem' }}>
              <ArrowUpDown size={18} /> Intercambiar clases
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.65, marginTop: 2 }}>
              {dayName} {dateFormatted}
            </div>
          </div>
          <button className="custom-modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Clase actual seleccionada */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>
            Clase origen:
          </div>
          <div
            style={{
              background: currentColor.bg,
              color: currentColor.text,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: '0.92rem',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span>{currentSubject}</span>
              {lesson.type && (
                <span style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 500, marginLeft: 6 }}>
                  ({lesson.type})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
            </div>
          </div>
        </div>

        {hasAnyDurationDiff && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.83rem',
              fontWeight: 500,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--surface-sunken, rgba(0,0,0,0.03))',
              border: '1px solid var(--border)',
              marginBottom: 14,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={keepDuration}
              onChange={e => setKeepDuration(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>Mantener la duración original de cada clase</span>
          </label>
        )}

        <p style={{ fontSize: '0.86rem', opacity: 0.75, marginBottom: 14 }}>
          Selecciona con qué clase de este día deseas permutar el horario y el aula:
        </p>

        {validCandidates.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--surface-sunken, rgba(0,0,0,0.03))',
              borderRadius: 10,
              fontSize: '0.9rem',
              opacity: 0.7,
              marginBottom: 16,
            }}
          >
            No hay otras clases programadas este día para realizar un intercambio.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '320px', overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
            {validCandidates.map((cand, idx) => {
              const candColor = subjectColor(cand.subjectIds?.[0] || 0, isDark);
              const candSubject = cand.subjects?.[0] || 'Clase';
              const candRoom = (cand.rooms || []).join(', ') || 'Sin aula';
              const candDuration = toMinutes(cand.endTime) - toMinutes(cand.startTime);
              const diffDuration = originDuration !== candDuration;
              const newEndForOrigin = fromMinutes(toMinutes(cand.startTime) + originDuration);

              return (
                <div
                  key={cand.lessonKey || cand.id || idx}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: 'var(--surface)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: candColor.bg,
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {candSubject}
                      </span>
                      {cand.type && (
                        <span style={{ fontSize: '0.75rem', opacity: 0.7, flexShrink: 0 }}>
                          {cand.type}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', opacity: 0.75, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {formatTime(cand.startTime)}–{formatTime(cand.endTime)}
                      </span>
                      {candRoom && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {candRoom}
                        </span>
                      )}
                    </div>
                    {diffDuration && (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '0.74rem',
                          color: isDark ? '#93c5fd' : '#1d4ed8',
                          background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 246, 255, 0.95)',
                          padding: '3px 8px',
                          borderRadius: 6,
                        }}
                      >
                        <Clock size={11} />
                        <span>
                          {keepDuration
                            ? `Mantendrá ${originDuration}m (${formatTime(cand.startTime)}–${formatTime(newEndForOrigin)})`
                            : `Se adaptará a ${candDuration}m (${formatTime(cand.startTime)}–${formatTime(cand.endTime)})`}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="settings-btn-primary"
                    onClick={() => {
                      onSwap(lesson, cand, { keepDuration });
                      onClose();
                    }}
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ArrowUpDown size={13} /> Intercambiar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.88rem' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
