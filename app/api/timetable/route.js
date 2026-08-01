import { NextResponse } from 'next/server';
import { WebUntisAnonymousAuth, WebUntisElementType } from 'webuntis';

/**
 * Merges consecutive 30-min WebUntis blocks that belong to the same lesson.
 * Two blocks are merged if they share: same date, same subjectIds, same room, same teacher,
 * and the endTime of one equals the startTime of the next.
 */
function mergeConsecutiveBlocks(lessons) {
  if (lessons.length === 0) return [];

  // Sort by date, then startTime
  const sorted = [...lessons].sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    return a.startTime - b.startTime;
  });

  const merged = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Same day, same subjects, same room, consecutive times?
    const sameDay = current.date === next.date;
    const consecutive = current.endTime === next.startTime;
    const sameSubjects = JSON.stringify(current.subjectIds) === JSON.stringify(next.subjectIds);
    const sameRoom = JSON.stringify(current.rooms) === JSON.stringify(next.rooms);
    const sameClass = current.classId === next.classId;

    if (sameDay && consecutive && sameSubjects && sameRoom && sameClass) {
      // Extend the current block
      current = {
        ...current,
        endTime: next.endTime,
        // Keep the most severe code (cancelled wins over normal)
        code: next.code || current.code,
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const classIds = searchParams.get('classIds')?.split(',').map(Number);
  const dateStr = searchParams.get('date');

  if (!classIds || classIds.length === 0) {
    return NextResponse.json({ error: 'Missing classIds' }, { status: 400 });
  }

  // Use requested date or today
  let date = dateStr ? new Date(dateStr) : new Date();
  
  if (!dateStr) {
    const currentMonth = date.getMonth();
    if (currentMonth === 6 || currentMonth === 7 || (currentMonth === 8 && date.getDate() < 7)) {
      date = new Date(date.getFullYear(), 8, 7);
    }
  }
  
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  
  try {
    await untis.login();
    
    let allTimetables = [];

    for (const classId of classIds) {
      if (!classId) continue;
      
      try {
        const tt = await untis.getTimetableForWeek(date, classId, WebUntisElementType.CLASS);
        
        const mappedTt = tt.map(lesson => ({
          id: lesson.id,
          date: lesson.date,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          classId: classId,
          subjects: (lesson.subjects || []).map(s => s.element?.longName || s.element?.name || s.id),
          subjectShortNames: (lesson.subjects || []).map(s => s.element?.name || ''),
          subjectIds: (lesson.subjects || []).map(s => s.id),
          rooms: (lesson.rooms || []).map(r => r.element?.longName || r.element?.name || r.id),
          teachers: (lesson.teachers || []).map(t => t.element?.longName || t.element?.name || t.id),
          code: lesson.code,
          type: lesson.lstype,
        }));
        
        allTimetables = allTimetables.concat(mappedTt);
      } catch (err) {
        console.error(`Failed to fetch timetable for class ${classId}:`, err.message);
      }
    }

    // Merge consecutive 30-min blocks from same lesson
    const mergedTimetables = mergeConsecutiveBlocks(allTimetables);
    
    return NextResponse.json(mergedTimetables);
  } catch (error) {
    console.error('Error in timetable API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
