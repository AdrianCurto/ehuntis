'use client';

import { useRef, useState, useLayoutEffect, useEffect } from 'react';
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

// ─── Progressive text-fitting system ─────────────────────────────────────────
// Each level applies progressively more aggressive space-saving measures.
// The component measures each block after render; if content overflows, it
// bumps that block to the next level.  This repeats until everything fits or
// the maximum level is reached.  Measures are applied in order and only when
// needed — if level 1 already makes the text fit, level 2+ is never used.
//
// Measure order (week view):
//   0  Default — full fonts, full padding, all elements
//   1  Reduce font sizes
//   2  Tighten padding + line-height
//   3  Hide room
//   4  Hide type badge
//   5  Minimal fonts + tightest spacing
//   6  Absolute minimum — last resort
//
// Day view adds a "hide teacher" step (level 3) before hiding room (level 4).

const MAX_FIT_LEVEL = 6;

const WEEK_FIT = [
  { name: 11, room: 10, badge: 10, padding: '5px 6px', lh: 1.2,  showRoom: true,  showBadge: true  },
  { name: 10, room: 9,  badge: 9,  padding: '5px 6px', lh: 1.2,  showRoom: true,  showBadge: true  },
  { name: 10, room: 9,  badge: 9,  padding: '3px 4px', lh: 1.1,  showRoom: true,  showBadge: true  },
  { name: 10, room: 9,  badge: 9,  padding: '3px 4px', lh: 1.1,  showRoom: false, showBadge: true  },
  { name: 10, room: 9,  badge: 9,  padding: '3px 4px', lh: 1.1,  showRoom: false, showBadge: false },
  { name: 9,  room: 8,  badge: 8,  padding: '2px 3px', lh: 1.05, showRoom: false, showBadge: false },
  { name: 8,  room: 7,  badge: 7,  padding: '1px 2px', lh: 1.0,  showRoom: false, showBadge: false },
];

const DAY_FIT = [
  { name: 13, room: 11, teacher: 11, badge: 10, padding: '4px 8px', lh: 1.2,  showRoom: true,  showTeacher: true,  showBadge: true  },
  { name: 12, room: 10, teacher: 10, badge: 9,  padding: '4px 8px', lh: 1.2,  showRoom: true,  showTeacher: true,  showBadge: true  },
  { name: 12, room: 10, teacher: 10, badge: 9,  padding: '3px 6px', lh: 1.1,  showRoom: true,  showTeacher: true,  showBadge: true  },
  { name: 12, room: 10, teacher: 10, badge: 9,  padding: '3px 6px', lh: 1.1,  showRoom: true,  showTeacher: false, showBadge: true  },
  { name: 12, room: 10, teacher: 10, badge: 9,  padding: '3px 6px', lh: 1.1,  showRoom: false, showTeacher: false, showBadge: true  },
  { name: 12, room: 10, teacher: 10, badge: 9,  padding: '3px 6px', lh: 1.1,  showRoom: false, showTeacher: false, showBadge: false },
  { name: 10, room: 9,  teacher: 9,  badge: 8,  padding: '2px 4px', lh: 1.05, showRoom: false, showTeacher: false, showBadge: false },
];

// ─── Touch / swipe handling ──────────────────────────────────────────────────
const SWIPE_MIN_DISTANCE = 42;
const SWIPE_MAX_OFF_AXIS = 70;
const SWIPE_MAX_DURATION = 700;
const SWIPE_DOMINANCE_RATIO = 1.35;

export default function WeekCalendar({ lessons, onLessonClick, weekDates, onSwipeLeft, onSwipeRight }) {
  const touchStartRef = useRef(null);
  const blockRefs = useRef(new Map());
  const [fitLevels, setFitLevels] = useState({});
  const lastLessonsKey = useRef('');

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
    };
  };

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = Date.now() - start.t;

    if (elapsed > SWIPE_MAX_DURATION) return;
    if (absX < SWIPE_MIN_DISTANCE) return;
    if (absY > SWIPE_MAX_OFF_AXIS) return;
    if (absX < absY * SWIPE_DOMINANCE_RATIO) return;

    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  // Reset fit levels on viewport resize (orientation change, etc.)
  useEffect(() => {
    const handleResize = () => {
      setFitLevels({});
      lastLessonsKey.current = '';
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Measure each block after render; bump the fit level of any block whose
  // content overflows.  Runs synchronously before paint so the user never
  // sees intermediate states — only the final, fitted result.
  useLayoutEffect(() => {
    const currentKey = lessons.map(l => l.id).join(',');
    const isReset = lastLessonsKey.current !== currentKey;
    if (isReset) {
      lastLessonsKey.current = currentKey;
    }

    let needsUpdate = isReset;
    const newLevels = isReset ? {} : { ...fitLevels };

    for (const [key, el] of blockRefs.current) {
      if (!el) {
        blockRefs.current.delete(key);
        continue;
      }
      const currentLevel = newLevels[key] || 0;
      if (currentLevel >= MAX_FIT_LEVEL) continue;

      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
        newLevels[key] = currentLevel + 1;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setFitLevels(newLevels);
    }
  }, [fitLevels, lessons, weekDates]);

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
  const isDayView = weekDates.length === 1;
  const fitTable = isDayView ? DAY_FIT : WEEK_FIT;

  return (
    <div
      className="calendar-scroll"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStartRef.current = null; }}
    >
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

                    const blockKey = `${lesson.id}-${idx}`;
                    const col = layout.get(lesson.id) || { colIdx: 0, total: 1, span: 1 };
                    const widthPct = 100 / col.total;
                    const leftPct = col.colIdx * widthPct;

                    const color = subjectColor(lesson.subjectIds?.[0] || 0);
                    const displayName = blockDisplayName(lesson);
                    const fitLevel = fitLevels[blockKey] || 0;
                    const fit = fitTable[fitLevel];

                    const subNum = extractSubgroupNumber(lesson.type);
                    const typeBadge = subNum !== null && fit.showBadge ? (
                      <div style={{
                        fontSize: fit.badge,
                        fontWeight: 800,
                        background: 'rgba(0,0,0,0.15)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginBottom: 2,
                        display: 'inline-block',
                        lineHeight: 1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        maxWidth: '100%'
                      }}>
                        {lesson.type}
                      </div>
                    ) : null;

                    return (
                      <div
                        key={blockKey}
                        ref={el => { blockRefs.current[blockKey] = el; }}
                        className={`lesson-block${lesson.code === 'cancelled' ? ' cancelled' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${leftPct + 0.5}%`,
                          width: `${(widthPct * col.span) - 1}%`,
                          background: color.bg,
                          color: color.text,
                          position: 'absolute',
                          padding: fit.padding,
                          ...(isDayView ? {
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            textAlign: 'center',
                          } : {})
                        }}
                        onClick={() => onLessonClick(lesson)}
                      >
                        {isDayView ? (
                          <div style={{ margin: 'auto 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {typeBadge}
                            <div className="lesson-block-name" style={{ fontSize: fit.name, lineHeight: fit.lh, marginBottom: '2px', flexShrink: 0, width: '100%' }}>
                              {displayName}
                            </div>
                            {fit.showRoom && lesson.rooms?.[0] && (
                              <div style={{ fontSize: fit.room, opacity: 0.75, fontWeight: 500, marginBottom: '1px', flexShrink: 0 }}>
                                {lesson.rooms[0].replace(/\s+/g, '')}
                              </div>
                            )}
                            {fit.showTeacher && lesson.teachers?.[0] && (
                              <div style={{ fontSize: fit.teacher, opacity: 0.85, fontWeight: 600, flexShrink: 0 }}>
                                {formatTeacher(lesson.teachers[0])}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {typeBadge}
                            <div className="lesson-block-name" style={{ fontSize: fit.name, lineHeight: fit.lh }}>
                              {displayName}
                            </div>
                            {fit.showRoom && lesson.rooms?.[0] && (
                              <div className="lesson-block-room" style={{ fontSize: fit.room }}>
                                {lesson.rooms[0].replace(/\s+/g, '')}
                              </div>
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
