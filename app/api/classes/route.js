import { NextResponse } from 'next/server';
import { WebUntisAnonymousAuth } from 'webuntis';

export async function GET() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  
  try {
    await untis.login();
    // Determinar la fecha objetivo (si es verano, saltar a septiembre)
    let targetDate = new Date();
    const currentMonth = targetDate.getMonth(); // 0 = Jan, 6 = Jul, 7 = Aug, 8 = Sep
    if (currentMonth === 6 || currentMonth === 7 || (currentMonth === 8 && targetDate.getDate() < 7)) {
        targetDate = new Date(targetDate.getFullYear(), 8, 7);
    }

    // Buscar el schoolyear que contiene la targetDate
    const schoolyears = await untis.getSchoolyears();
    const targetYear = schoolyears.find(y => {
        const start = new Date(y.startDate);
        const end = new Date(y.endDate);
        return targetDate >= start && targetDate <= end;
    });

    // Pedir las clases de ese schoolyear concreto
    let classes;
    if (targetYear) {
        classes = await untis.getClasses(true, targetYear.id);
    } else {
        classes = await untis.getClasses();
    }
    
    // Deduplicate classes with same name and longName, merging their IDs
    const classMap = new Map();
    classes.forEach(c => {
      // Clean up longName if it starts with an identifier like "306-X3 "
      let cleanLongName = c.longName || '';
      const prefixMatch = cleanLongName.match(/^[0-9A-Z]+-[0-9A-Z]+\s+(.*)$/i);
      if (prefixMatch) {
        cleanLongName = prefixMatch[1];
      }
      
      const key = `${c.name}::${cleanLongName}`;
      
      let year = null;
      let group = null;
      // Intenta extraer el curso y grupo del nombre (ej: GITECX301 -> Curso 3, Grupo 01)
      const nameMatch = c.name.match(/^([a-zA-Z]+)(\d)(\d{2})/);
      if (nameMatch) {
          year = parseInt(nameMatch[2], 10);
          group = nameMatch[3];
      }

      if (!classMap.has(key)) {
        classMap.set(key, {
          uniqueId: key,
          id: [c.id],
          name: c.name,
          longName: cleanLongName,
          rawLongName: c.longName,
          year: year,
          group: group
        });
      } else {
        classMap.get(key).id.push(c.id);
      }
    });

    const sortedClasses = Array.from(classMap.values())
      .sort((a, b) => (a.longName || a.name).localeCompare(b.longName || b.name));

    return NextResponse.json(sortedClasses);
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
