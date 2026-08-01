'use client';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatTime(t) {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseDate(dateNum) {
  // dateNum is like 20260907
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

// Same palette as WeekCalendar – keep in sync
const PALETTE = [
  { bg: '#F28B82', text: '#5C1A17' },
  { bg: '#A8D5A2', text: '#1A4D1A' },
  { bg: '#86C5E4', text: '#133E52' },
  { bg: '#F5C842', text: '#5C4200' },
  { bg: '#D5A8E4', text: '#3D1A52' },
  { bg: '#F4A261', text: '#5C2E00' },
  { bg: '#8EC5C5', text: '#1A3D3D' },
  { bg: '#F08080', text: '#5C1A1A' },
];

function subjectColor(subjectId) {
  const id = typeof subjectId === 'number' ? subjectId : parseInt(subjectId, 10) || 0;
  return PALETTE[Math.abs(id) % PALETTE.length];
}

export default function LessonModal({ lesson, onClose }) {
  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  const color = subjectColor(lesson.subjectIds?.[0] || 0);

  const subjectName = lesson.subjects?.[0] || 'Sin asignatura';
  const teacher = lesson.teachers?.[0] || '';
  const room = lesson.rooms?.[0] || '';
  const classes = lesson.classes || [];

  // Detect if this lesson has a subgroup (classes array has items)
  const subgroupStr = classes.length > 0 ? classes.join(', ') : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        style={{ background: color.bg }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-drag-handle" />

        <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        <button className="modal-menu-btn" aria-label="Opciones">⋯</button>

        <div className="modal-header">
          <div className="modal-day" style={{ color: color.text, opacity: 0.7 }}>
            {dayName} {dateStr}
          </div>
          <div className="modal-time" style={{ color: color.text, opacity: 0.6 }}>
            {timeStr}
          </div>
        </div>

        {subgroupStr && (
          <div className="modal-subgroup" style={{ color: color.text }}>
            {subgroupStr}
          </div>
        )}

        <div className="modal-subject" style={{ color: color.text }}>
          {subjectName}
        </div>

        <div className="modal-detail" style={{ color: color.text }}>
          {teacher && <div>{teacher}</div>}
          {room && <div>{room}</div>}
          {lesson.code === 'cancelled' && (
            <div style={{ fontWeight: 700, marginTop: 8 }}>⚠️ Cancelada</div>
          )}
        </div>
      </div>
    </div>
  );
}
