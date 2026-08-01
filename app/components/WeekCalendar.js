'use client';

// Palette of 8 curated colors (same as CSS vars)
const PALETTE = [
  { bg: '#F28B82', text: '#5C1A17' }, // salmon
  { bg: '#A8D5A2', text: '#1A4D1A' }, // mint
  { bg: '#86C5E4', text: '#133E52' }, // sky blue
  { bg: '#F5C842', text: '#5C4200' }, // yellow
  { bg: '#D5A8E4', text: '#3D1A52' }, // lavender
  { bg: '#F4A261', text: '#5C2E00' }, // orange
  { bg: '#8EC5C5', text: '#1A3D3D' }, // teal
  { bg: '#F08080', text: '#5C1A1A' }, // coral
];

// Stable hash from subject id
function subjectColor(subjectId) {
  const id = typeof subjectId === 'number' ? subjectId : parseInt(subjectId, 10) || 0;
  return PALETTE[Math.abs(id) % PALETTE.length];
}

// Hours visible in the calendar
const START_HOUR = 7;
const END_HOUR = 22;
const SLOT_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;

function toMinutes(t) {
  // t is integer like 830 → 8:30
  const h = Math.floor(t / 100);
  const m = t % 100;
  return h * 60 + m;
}

function minutesSinceStart(t) {
  return toMinutes(t) - START_HOUR * 60;
}

// Groups overlapping lessons into columns within a day
function arrangeColumns(lessons) {
  // Sort by start time
  const sorted = [...lessons].sort((a, b) => a.startTime - b.startTime);
  const columns = []; // each column is an array of lessons

  for (const lesson of sorted) {
    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      if (toMinutes(lastInCol.endTime) <= toMinutes(lesson.startTime)) {
        col.push(lesson);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([lesson]);
  }

  // Assign column index and total to each lesson
  const result = new Map();
  columns.forEach((col, colIdx) => {
    col.forEach(lesson => {
      result.set(lesson.id + '_' + lesson.startTime, {
        colIdx,
        total: columns.length,
      });
    });
  });
  return result;
}

export default function WeekCalendar({ lessons, selectedDay, onSelectDay, onLessonClick, weekDates }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);
  const DAYS = ['LU', 'MA', 'MI', 'JU', 'VI'];

  // Group lessons by day-of-week (0=Mon … 4=Fri)
  const lessonsByDay = weekDates.map((date) => {
    const dateNum = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return lessons.filter(l => l.date === dateNum);
  });

  return (
    <div className="calendar-scroll">
      <div className="calendar-grid">
        {/* Time labels */}
        <div className="time-col">
          {hours.map(h => (
            <div key={h} className="time-label">
              {h < END_HOUR ? `${h}:00` : ''}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="days-grid">
          {weekDates.map((date, dayIdx) => {
            const dayLessons = lessonsByDay[dayIdx];
            const layout = arrangeColumns(dayLessons);

            return (
              <div key={dayIdx} className="day-col">
                <div className="day-col-inner" style={{ height: `${TOTAL_HOURS * SLOT_HEIGHT}px` }}>
                  {dayLessons.map((lesson, idx) => {
                    const startMin = minutesSinceStart(lesson.startTime);
                    const endMin = minutesSinceStart(lesson.endTime);
                    const top = (startMin / 60) * SLOT_HEIGHT;
                    const height = Math.max(((endMin - startMin) / 60) * SLOT_HEIGHT - 3, 24);

                    const key = lesson.id + '_' + lesson.startTime;
                    const col = layout.get(key) || { colIdx: 0, total: 1 };
                    const widthPct = 100 / col.total;
                    const leftPct = col.colIdx * widthPct;

                    const color = subjectColor(lesson.subjectIds?.[0] || 0);
                    const name = lesson.subjects?.[0] || '';
                    // Short name: take up to first 12 chars or abbreviation
                    const shortName = name.length > 18 ? name.split(' ').map(w => w[0]).join('').substring(0, 5) : name;

                    return (
                      <div
                        key={`${lesson.id}-${idx}`}
                        className={`lesson-block${lesson.code === 'cancelled' ? ' cancelled' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${leftPct + 1}%`,
                          width: `${widthPct - 2}%`,
                          background: color.bg,
                          color: color.text,
                          position: 'absolute',
                        }}
                        onClick={() => onLessonClick(lesson)}
                      >
                        <div className="lesson-block-name">{shortName}</div>
                        {height > 44 && lesson.rooms?.[0] && (
                          <div className="lesson-block-room">{lesson.rooms[0]}</div>
                        )}
                        {lesson.code === 'cancelled' && (
                          <div className="cancelled-badge">Cancelada</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
