'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  ArrowUpDown, 
  Clock, 
  MapPin, 
  Calendar as CalendarIcon, 
  Check, 
  Search,
  Sparkles,
  MousePointerClick
} from 'lucide-react';
import { subjectColor } from './WeekCalendar';
import { formatTime } from '../utils/lessonOverrides';
import { toMinutes } from '../utils/dayLogic';
import { formatRooms } from '../utils/subgroups';

function parseDate(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const fromMinutes = (m) => Math.floor(m / 60) * 100 + (m % 60);

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function SwapLessonModal({
  lesson,                 // Clase de origen
  targetLesson = null,    // Clase de destino seleccionada (si ya se pulsó en el calendario)
  candidateLessons = [],  // Lista de todas las lecciones candidatas
  onSelectFromCalendar,   // Callback para activar selección interactiva en el horario
  onSwap,
  onClose,
  isDark = false,
}) {
  const [selectedTarget, setSelectedTarget] = useState(targetLesson);
  const [keepDuration, setKeepDuration] = useState(true);
  const [swapRooms, setSwapRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'same_day' | 'all'
  const touchStartY = useRef(null);

  useEffect(() => {
    setSelectedTarget(targetLesson);
    setSwapRooms(false);
  }, [targetLesson]);

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
  const originDate = parseDate(lesson.date);
  const originDayName = DAYS_LONG[originDate.getDay()];
  const originDateFormatted = `${String(originDate.getDate()).padStart(2, '0')}/${String(originDate.getMonth() + 1).padStart(2, '0')}/${originDate.getFullYear()}`;
  const originColor = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const originSubject = lesson.subjects?.[0] || 'Clase';
  const originRoom = formatRooms(lesson.rooms) || 'Sin aula';

  // Filter valid candidate lessons (exclude self and custom events)
  const validCandidates = useMemo(() => {
    return candidateLessons.filter(c => {
      if (!c || c.isCustomEvent) return false;
      if (c.lessonKey && c.lessonKey === lesson.lessonKey) return false;
      if (c.id && lesson.id && c.id === lesson.id) return false;
      if (filterMode === 'same_day' && c.date !== lesson.date) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sub = (c.subjects?.[0] || '').toLowerCase();
        const rm = formatRooms(c.rooms).toLowerCase();
        const tp = (c.type || '').toLowerCase();
        return sub.includes(q) || rm.includes(q) || tp.includes(q);
      }
      return true;
    });
  }, [candidateLessons, lesson, filterMode, searchQuery]);

  // If a target lesson is chosen (from calendar or list), show the Confirmation View
  if (selectedTarget) {
    const targetDuration = toMinutes(selectedTarget.endTime) - toMinutes(selectedTarget.startTime);
    const targetDate = parseDate(selectedTarget.date);
    const targetDayName = DAYS_LONG[targetDate.getDay()];
    const targetDateFormatted = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
    const targetColor = subjectColor(selectedTarget.subjectIds?.[0] || 0, isDark);
    const targetSubject = selectedTarget.subjects?.[0] || 'Clase';
    const targetRoom = formatRooms(selectedTarget.rooms) || 'Sin aula';

    const isDifferentDay = lesson.date !== selectedTarget.date;
    const diffDuration = originDuration !== targetDuration;
    const roomA = (formatRooms(lesson.rooms) || '').trim().toLowerCase();
    const roomB = (formatRooms(selectedTarget.rooms) || '').trim().toLowerCase();
    const diffRooms = roomA !== roomB;

    // Projected new hours if keepDuration is active
    const newEndForOrigin = fromMinutes(toMinutes(selectedTarget.startTime) + originDuration);
    const newEndForTarget = fromMinutes(toMinutes(lesson.startTime) + targetDuration);

    const handleConfirm = () => {
      onSwap(lesson, selectedTarget, { keepDuration, swapRooms });
      onClose();
    };

    return (
      <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
        <div
          className="modal-sheet custom-event-modal"
          onClick={e => e.stopPropagation()}
          style={{
            borderTop: `4px solid var(--accent)`,
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <div
            className="modal-drag-handle"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: 'grab', touchAction: 'none' }}
          />

          <div className="custom-event-modal-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="custom-event-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.15rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}
                >
                  <ArrowUpDown size={16} />
                </span>
                Confirmar intercambio
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Las dos clases intercambiarán sus horarios y aulas
              </div>
            </div>
            <button className="custom-modal-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {/* Banner de aviso si es entre días distintos */}
          {isDifferentDay && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 10,
                background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 110, 247, 0.1)',
                border: '1px solid rgba(79, 110, 247, 0.25)',
                color: isDark ? '#a5b4fc' : '#3730a3',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <CalendarIcon size={15} style={{ flexShrink: 0 }} />
              <span>Intercambio entre días distintos ({originDayName} ⇄ {targetDayName})</span>
            </div>
          )}

          {/* Comparativa visual de las dos clases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {/* Clase Origen */}
            <div
              style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: originColor.bg,
                  color: originColor.text,
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                }}
              >
                <span>Clase A: {originSubject}</span>
                <span style={{ fontSize: '0.76rem', opacity: 0.9, fontWeight: 500 }}>
                  {originDayName} {originDateFormatted}
                </span>
              </div>
              <div style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} /> Horario actual: <strong>{formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} /> Aula: <strong>{swapRooms ? targetRoom : originRoom}</strong>
                  {diffRooms && !swapRooms && <span style={{ fontSize: '0.74rem', opacity: 0.8, marginLeft: 4 }}>(se mantiene)</span>}
                </span>
              </div>
            </div>

            {/* Icono central de intercambio */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '-4px 0' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <ArrowUpDown size={15} />
              </div>
            </div>

            {/* Clase Destino */}
            <div
              style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: targetColor.bg,
                  color: targetColor.text,
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                }}
              >
                <span>Clase B: {targetSubject}</span>
                <span style={{ fontSize: '0.76rem', opacity: 0.9, fontWeight: 500 }}>
                  {targetDayName} {targetDateFormatted}
                </span>
              </div>
              <div style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} /> Horario actual: <strong>{formatTime(selectedTarget.startTime)}–{formatTime(selectedTarget.endTime)}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} /> Aula: <strong>{swapRooms ? originRoom : targetRoom}</strong>
                  {diffRooms && !swapRooms && <span style={{ fontSize: '0.74rem', opacity: 0.8, marginLeft: 4 }}>(se mantiene)</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Opción cambiar también las aulas cuando no coincidan */}
          {diffRooms && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.83rem',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                marginBottom: 14,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={swapRooms}
                onChange={e => setSwapRooms(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Intercambiar también las aulas
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
                  {swapRooms ? (
                    <>
                      • <strong>{originSubject}</strong> pasará a <strong>{targetRoom}</strong><br />
                      • <strong>{targetSubject}</strong> pasará a <strong>{originRoom}</strong>
                    </>
                  ) : (
                    <>
                      Por defecto se mantiene cada clase en su aula habitual (<strong>{originSubject}</strong> en {originRoom}, <strong>{targetSubject}</strong> en {targetRoom}).
                    </>
                  )}
                </div>
              </div>
            </label>
          )}

          {/* Diferencia de duración / Opción mantener duración */}
          {diffDuration && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.83rem',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                marginBottom: 16,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={keepDuration}
                onChange={e => setKeepDuration(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mantener la duración original de cada clase
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
                  {keepDuration ? (
                    <>
                      • <strong>{originSubject}</strong> mantendrá {originDuration} min ({formatTime(selectedTarget.startTime)}–{formatTime(newEndForOrigin)})<br />
                      • <strong>{targetSubject}</strong> mantendrá {targetDuration} min ({formatTime(lesson.startTime)}–{formatTime(newEndForTarget)})
                    </>
                  ) : (
                    'Cada clase adoptará exactamente las horas de inicio y fin del bloque de destino.'
                  )}
                </div>
              </div>
            </label>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              className="settings-btn-secondary"
              onClick={() => {
                if (targetLesson) {
                  onSelectFromCalendar?.(lesson);
                  onClose();
                } else {
                  setSelectedTarget(null);
                }
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: '0.86rem',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Elegir otra clase
            </button>

            <button
              type="button"
              className="settings-btn-primary"
              onClick={handleConfirm}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: '0.88rem',
                fontWeight: 700,
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <Check size={16} /> Confirmar intercambio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, show the Interactive Selection modal with option to choose directly from calendar or search list
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-sheet custom-event-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderTop: `4px solid ${originColor.bg}`,
          width: '100%',
          maxWidth: '520px',
        }}
      >
        <div
          className="modal-drag-handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: 'grab', touchAction: 'none' }}
        />

        <div className="custom-event-modal-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="custom-event-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.15rem' }}>
              <ArrowUpDown size={18} /> Intercambiar clase
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {originDayName} {originDateFormatted} • {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
            </div>
          </div>
          <button className="custom-modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Clase actual seleccionada como origen */}
        <div
          style={{
            background: originColor.bg,
            color: originColor.text,
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <span>{originSubject}</span>
            {lesson.type && (
              <span style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 500, marginLeft: 6 }}>
                ({lesson.type})
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {originRoom}
          </div>
        </div>

        {/* Botón destacado: Seleccionar directamente en el calendario */}
        <button
          type="button"
          onClick={() => {
            onSelectFromCalendar?.(lesson);
            onClose();
          }}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--accent-light)',
            border: '1.5px solid var(--accent)',
            color: 'var(--accent)',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'transform 0.15s, background 0.15s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MousePointerClick size={18} />
          <span>Seleccionar clase directamente en el horario</span>
        </button>

        {/* Separador con "o busca en la lista" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '0 0 12px',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>O selecciona de la lista</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Filtros y buscador */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar por asignatura, aula..."
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
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
            }}
          >
            <button
              type="button"
              onClick={() => setFilterMode('same_day')}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                background: filterMode === 'same_day' ? 'var(--accent)' : 'transparent',
                color: filterMode === 'same_day' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Mismo día
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                background: filterMode === 'all' ? 'var(--accent)' : 'transparent',
                color: filterMode === 'all' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cualquier día
            </button>
          </div>
        </div>

        {/* Lista de candidatos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '280px', overflowY: 'auto', marginBottom: 14, paddingRight: 4 }}>
          {validCandidates.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                borderRadius: 10,
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
              }}
            >
              No se encontraron clases coincidentes para intercambiar.
            </div>
          ) : (
            validCandidates.map((cand, idx) => {
              const candColor = subjectColor(cand.subjectIds?.[0] || 0, isDark);
              const candSubject = cand.subjects?.[0] || 'Clase';
              const candRoom = formatRooms(cand.rooms) || 'Sin aula';
              const candDate = parseDate(cand.date);
              const candDayName = DAYS_LONG[candDate.getDay()];
              const candDateFormatted = `${String(candDate.getDate()).padStart(2, '0')}/${String(candDate.getMonth() + 1).padStart(2, '0')}`;
              const isDifferentDay = cand.date !== lesson.date;

              return (
                <div
                  key={cand.lessonKey || cand.id || idx}
                  onClick={() => setSelectedTarget(cand)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--surface-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
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
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {candSubject}
                      </span>
                      {cand.type && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          ({cand.type})
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: isDifferentDay ? 600 : 400, color: isDifferentDay ? 'var(--accent)' : 'inherit' }}>
                        <CalendarIcon size={12} /> {candDayName} {candDateFormatted}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {formatTime(cand.startTime)}–{formatTime(cand.endTime)}
                      </span>
                      {candRoom && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {candRoom}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="settings-btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Elegir
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.86rem',
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
