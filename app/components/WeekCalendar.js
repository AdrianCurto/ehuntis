'use client';

// Palette of 11 distinct colors
const PALETTE = [
  { bg: '#2563EB', text: '#000000' }, // Azul (Blue 600)
  { bg: '#16A34A', text: '#000000' }, // Verde (Green 600)
  { bg: '#FACC15', text: '#000000' }, // Amarillo (Yellow 400)
  { bg: '#EA580C', text: '#000000' }, // Naranja (Orange 600)
  { bg: '#DC2626', text: '#000000' }, // Rojo (Red 600)
  { bg: '#F472B6', text: '#000000' }, // Rosa suave (Pink 400)
  { bg: '#9333EA', text: '#000000' }, // Morado (Purple 600)
  { bg: '#0891B2', text: '#000000' }, // Cyan (Cyan 600)
  { bg: '#65A30D', text: '#000000' }, // Lima (Lime 600)
  { bg: '#0D9488', text: '#000000' }, // Teal (Teal 600)
  { bg: '#4F46E5', text: '#000000' }, // Indigo (Indigo 600)
];

// Helper to assign a color index dynamically based on a unique list of subjects
let subjectColorMap = new Map();
export function updateSubjectColors(lessons) {
  const uniqueIds = Array.from(new Set(lessons.map(l => l.subjectIds?.[0] || 0))).sort();
  subjectColorMap = new Map();
  uniqueIds.forEach((id, i) => {
    subjectColorMap.set(id, PALETTE[i % PALETTE.length]);
  });
}

export function subjectColor(subjectId) {
  const id = typeof subjectId === 'number' ? subjectId : parseInt(subjectId, 10) || 0;
  return subjectColorMap.get(id) || PALETTE[0];
}

function blockDisplayName(lesson) {
  return lesson.subjects?.[0] || '';
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
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = 0;

  for (const lesson of sorted) {
    const startMins = toMinutes(lesson.startTime);
    const endMins = toMinutes(lesson.endTime);
    if (currentCluster.length === 0) {
      currentCluster.push(lesson);
      clusterEnd = endMins;
    } else if (startMins < clusterEnd) {
      currentCluster.push(lesson);
      clusterEnd = Math.max(clusterEnd, endMins);
    } else {
      clusters.push(currentCluster);
      currentCluster = [lesson];
      clusterEnd = endMins;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result = new Map();
  
  for (const cluster of clusters) {
    const columns = [];
    for (const lesson of cluster) {
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
    
    // columns.length is the total columns for this overlapping cluster
    columns.forEach((col, colIdx) => {
      col.forEach(lesson => {
        const key = lesson.startTime + '_' + (lesson.subjectIds?.join(',') || lesson.id);
        result.set(key, {
          colIdx,
          total: columns.length,
        });
      });
    });
  }
  return result;
}

export default function WeekCalendar({ lessons, onLessonClick, weekDates }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Group lessons by day index (0=Mon … 4=Fri)
  const lessonsByDay = weekDates.map((date) => {
    const dateNum = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return lessons.filter(l => l.date === dateNum);
  });

  // Assign distinct colors to the unique subjects in this week's timetable
  updateSubjectColors(lessons);

  const totalHeight = TOTAL_HOURS * SLOT_HEIGHT;

  return (
    <div className="calendar-scroll">
      <div className="calendar-grid" style={{ minHeight: totalHeight + 'px' }}>
        {/* Time labels column */}
        <div className="time-col">
          {hours.map(h => (
            <div key={h} className="time-label">
              {h < END_HOUR ? <span>{h}:00</span> : ''}
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

                    const key = lesson.startTime + '_' + (lesson.subjectIds?.join(',') || lesson.id);
                    const col = layout.get(key) || { colIdx: 0, total: 1 };
                    const widthPct = 100 / col.total;
                    const leftPct = col.colIdx * widthPct;

                    const color = subjectColor(lesson.subjectIds?.[0] || 0);
                    const displayName = blockDisplayName(lesson);
                    const isShort = height < 40; // very small block
                    
                    // 10px padding total vertically, ~14px line height (11px font * 1.2)
                    const maxLines = Math.max(1, Math.floor((height - (isShort ? 10 : 25)) / 14));

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
                        <div 
                          className="lesson-block-name" 
                          style={{ 
                            fontSize: isShort ? 10 : 12,
                            WebkitLineClamp: maxLines
                          }}
                        >
                          {displayName}
                        </div>
                        {!isShort && lesson.rooms?.[0] && (
                          <div className="lesson-block-room">{lesson.rooms[0].replace(/\s+/g, '')}</div>
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
