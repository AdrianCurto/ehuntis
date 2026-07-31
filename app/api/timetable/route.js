import { NextResponse } from 'next/server';
import { WebUntisAnonymousAuth, WebUntisElementType } from 'webuntis';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const classIds = searchParams.get('classIds')?.split(',').map(Number);
  const dateStr = searchParams.get('date');

  if (!classIds || classIds.length === 0) {
    return NextResponse.json({ error: 'Missing classIds' }, { status: 400 });
  }

  // Use requested date or today
  const date = dateStr ? new Date(dateStr) : new Date();
  
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  
  try {
    await untis.login();
    
    // Fetch master data to resolve IDs into human-readable names
    const [subjects, rooms, teachers] = await Promise.all([
      untis.getSubjects(),
      untis.getRooms(),
      untis.getTeachers()
    ]);
    
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const roomMap = new Map(rooms.map(r => [r.id, r]));
    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    let allTimetables = [];

    // Fetch timetable for each requested class
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
           // Resolve full readable names, fallback to short name or ID
           subjects: lesson.su.map(s => subjectMap.get(s.id)?.longName || subjectMap.get(s.id)?.name || s.id),
           subjectIds: lesson.su.map(s => s.id),
           rooms: lesson.ro.map(r => roomMap.get(r.id)?.longName || roomMap.get(r.id)?.name || r.id),
           teachers: lesson.te.map(t => teacherMap.get(t.id)?.longName || teacherMap.get(t.id)?.name || t.id),
           code: lesson.code, // Indicates cancellations, exams, etc.
           type: lesson.lstype
        }));
        
        allTimetables = allTimetables.concat(mappedTt);
      } catch (err) {
        console.error(`Failed to fetch timetable for class ${classId}:`, err.message);
        // We continue with other classes if one fails
      }
    }
    
    return NextResponse.json(allTimetables);
  } catch (error) {
    console.error("Error in timetable API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
