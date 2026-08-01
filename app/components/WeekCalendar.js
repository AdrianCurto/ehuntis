'use client';

import { extractSubgroupNumber } from '../utils/subgroups';

// Palette of 11 distinct colors
const PALETTE = [
  { bg: '#FFB3BA', text: '#0F172A' }, // Pastel Pink/Red
  { bg: '#FFDFBA', text: '#0F172A' }, // Pastel Orange
  { bg: '#FFF6BA', text: '#0F172A' }, // Pastel Yellow
  { bg: '#BAFFC9', text: '#0F172A' }, // Pastel Green
  { bg: '#BAFFFF', text: '#0F172A' }, // Pastel Cyan
  { bg: '#BAE1FF', text: '#0F172A' }, // Pastel Blue
  { bg: '#D9BAFF', text: '#0F172A' }, // Pastel Purple
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

function formatTeacher(teacherRaw) {
  if (!teacherRaw) return '';
  const namePart = teacherRaw.split('-')[0];
  if (namePart && namePart.length > 1) {
    const initial = namePart.charAt(0).toUpperCase();
    const rest = namePart.slice(1).toLowerCase();
    return `${initial}. ${rest.charAt(0).toUpperCase() + rest.slice(1)}`;
  }
  return teacherRaw;
}

const START_MINUTES = 7 * 60 + 30; // 7:30 AM
const END_MINUTES = 22 * 60;       // 22:00 PM
const SLOT_HEIGHT = 60; // px per hour
const TOTAL_HOURS = (END_MINUTES - START_MINUTES) / 60;

function toMinutes(t) {
  return Math.floor(t / 100) * 60 + (t % 100);
}

function minutesSinceStart(t) {
  return toMinutes(t) - START_MINUTES;
}

function arrangeColumns(lessons) {
  const sorted = [...lessons].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return b.endTime - a.endTime; // Longer first
  });

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
    
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      for (const lesson of columns[colIdx]) {
        let span = 1;
        // Expand lesson width across empty adjacent columns
        for (let nextColIdx = colIdx + 1; nextColIdx < columns.length; nextColIdx++) {
          const hasOverlap = columns[nextColIdx].some(other => {
            return toMinutes(other.startTime) < toMinutes(lesson.endTime) &&
                   toMinutes(other.endTime) > toMinutes(lesson.startTime);
          });
          if (!hasOverlap) {
            span++;
          } else {
            break;
          }
        }
        result.set(lesson.id, {
          colIdx,
          span,
          total: columns.length,
        });
      }
    }
  }
  return result;
}

export default function WeekCalendar({ lessons, onLessonClick, weekDates }) {
  // Generamos etiquetas de hora desde las 8:00 hasta las 21:00
  const hours = Array.from({ length: 14 }, (_, i) => 8 + i);

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
          {hours.map(h => {
            const top = ((h * 60 - START_MINUTES) / 60) * SLOT_HEIGHT;
            return (
              <div key={h} className="time-label-abs" style={{ top: `${top}px` }}>
                <span>{h}:00</span>
              </div>
            );
          })}
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

                    const key = lesson.id;
                    const col = layout.get(key) || { colIdx: 0, total: 1, span: 1 };
                    const widthPct = 100 / col.total;
                    const leftPct = col.colIdx * widthPct;

                    const color = subjectColor(lesson.subjectIds?.[0] || 0);
                    const displayName = blockDisplayName(lesson);
                    const isShort = height < 40; // very small block
                    
                    // 10px padding total vertically, ~14px line height (11px font * 1.2)
                    const maxLines = Math.max(1, Math.floor((height - (isShort ? 10 : 25)) / 14));

                    const isDayView = weekDates.length === 1;

                    const subNum = extractSubgroupNumber(lesson.type);
                    const typeBadge = subNum !== null ? (
                      <div style={{
                        fontSize: 9,
                        fontWeight: 800,
                        background: 'rgba(0,0,0,0.15)',
                        padding: '1px 3px',
                        borderRadius: 3,
                        marginBottom: 1,
                        display: 'inline-block',
                        lineHeight: 1.1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                      }}>
                        {lesson.type}
                      </div>
                    ) : null;

                    return (
                      <div
                        key={`${lesson.id}-${idx}`}
                        className={`lesson-block${lesson.code === 'cancelled' ? ' cancelled' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${leftPct + 0.5}%`,
                          width: `${(widthPct * col.span) - 1}%`,
                          background: color.bg,
                          color: color.text,
                          position: 'absolute',
                          ...(isDayView ? {
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: '4px 8px'
                          } : {})
                        }}
                        onClick={() => onLessonClick(lesson)}
                      >
                        {isDayView ? (
                          <div style={{ margin: 'auto 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {typeBadge}
                            <div className="lesson-block-name" style={{ fontSize: isShort ? 12 : 13, WebkitLineClamp: maxLines, marginBottom: '2px', flexShrink: 0, width: '100%' }}>
                              {displayName}
                            </div>
                            {!isShort && lesson.rooms?.[0] && (
                              <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, marginBottom: '1px', flexShrink: 0 }}>
                                {lesson.rooms[0].replace(/\s+/g, '')}
                              </div>
                            )}
                            {!isShort && lesson.teachers?.[0] && (
                              <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, flexShrink: 0 }}>
                                {formatTeacher(lesson.teachers[0])}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {typeBadge}
                            <div className="lesson-block-name" style={{ fontSize: isShort ? 10 : 12, WebkitLineClamp: maxLines }}>
                              {displayName}
                            </div>
                            {!isShort && lesson.rooms?.[0] && (
                              <div className="lesson-block-room">{lesson.rooms[0].replace(/\s+/g, '')}</div>
                            )}
                          </>
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
