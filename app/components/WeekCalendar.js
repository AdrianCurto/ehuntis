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

export function subjectColor(subjectId) {
  const id = typeof subjectId === 'number' ? subjectId : parseInt(subjectId, 10) || 0;
  return PALETTE[Math.abs(id) % PALETTE.length];
}

/**
 * Smart display name for a lesson block.
 * Priority: use the WebUntis short name (e.g. "TeoMecVibMec") → strip trailing "_NNNN" codes
 * → fall back to first 2 words of long name.
 */
function blockDisplayName(lesson) {
  const shortRaw = lesson.subjectShortNames?.[0] || '';
  // Strip year-suffix codes like "_27315" or "_2627"
  const shortClean = shortRaw.replace(/_\d{4,}$/, '').trim();
  if (shortClean && shortClean.length <= 20) return shortClean;

  // Fall back to first 2 significant words of long name
  const longName = lesson.subjects?.[0] || '';
  const words = longName.split(' ').filter(w => w.length > 2);
  return words.slice(0, 2).join(' ') || longName.substring(0, 16);
}

const START_HOUR = 7;
const END_HOUR = 22;
const SLOT_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;

function toMinutes(t) {
  return Math.floor(t / 100) * 60 + (t % 100);
}

function minutesSinceStart(t) {
  return toMinutes(t) - START_HOUR * 60;
}

// Groups overlapping lessons into columns within a day
function arrangeColumns(lessons) {
  const sorted = [...lessons].sort((a, b) => a.startTime - b.startTime);
  const columns = [];

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

  const result = new Map();
  columns.forEach((col, colIdx) => {
    col.forEach(lesson => {
      result.set(lesson.id + '_' + lesson.startTime + '_' + lesson.classId, {
        colIdx,
        total: columns.length,
      });
    });
  });
  return result;
}

export default function WeekCalendar({ lessons, onLessonClick, weekDates }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Group lessons by day index (0=Mon … 4=Fri)
  const lessonsByDay = weekDates.map((date) => {
    const dateNum = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return lessons.filter(l => l.date === dateNum);
  });

  const totalHeight = TOTAL_HOURS * SLOT_HEIGHT;

  return (
    <div className="calendar-scroll">
      <div className="calendar-grid" style={{ minHeight: totalHeight + 'px' }}>
        {/* Time labels column */}
        <div className="time-col">
          {hours.map(h => (
            <div key={h} className="time-label">
              {h < END_HOUR ? `${h}:00` : ''}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="days-grid" style={{ height: totalHeight + 'px' }}>
          {weekDates.map((date, dayIdx) => {
            const dayLessons = lessonsByDay[dayIdx];
            const layout = arrangeColumns(dayLessons);

            return (
              <div key={dayIdx} className="day-col">
                <div
                  className="day-col-inner"
                  style={{ height: totalHeight + 'px' }}
                >
                  {dayLessons.map((lesson, idx) => {
                    const startMin = minutesSinceStart(lesson.startTime);
                    const endMin = minutesSinceStart(lesson.endTime);
                    const top = (startMin / 60) * SLOT_HEIGHT;
                    const height = Math.max(((endMin - startMin) / 60) * SLOT_HEIGHT - 2, 22);

                    const key = lesson.id + '_' + lesson.startTime + '_' + lesson.classId;
                    const col = layout.get(key) || { colIdx: 0, total: 1 };
                    const widthPct = 100 / col.total;
                    const leftPct = col.colIdx * widthPct;

                    const color = subjectColor(lesson.subjectIds?.[0] || 0);
                    const displayName = blockDisplayName(lesson);
                    const isShort = height < 40; // very small block

                    return (
                      <div
                        key={`${lesson.id}-${idx}`}
                        className={`lesson-block${lesson.code === 'cancelled' ? ' cancelled' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${leftPct + 0.5}%`,
                          width: `${widthPct - 1}%`,
                          background: color.bg,
                          color: color.text,
                          position: 'absolute',
                        }}
                        onClick={() => onLessonClick(lesson)}
                      >
                        <div className="lesson-block-name" style={{ fontSize: isShort ? 10 : 12 }}>
                          {displayName}
                        </div>
                        {!isShort && lesson.rooms?.[0] && (
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
