import { NextResponse } from 'next/server';
import { WebUntisAnonymousAuth } from 'webuntis';

export async function GET() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  
  try {
    await untis.login();
    const classes = await untis.getClasses();
    
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
      if (!classMap.has(key)) {
        classMap.set(key, {
          uniqueId: key,
          id: [c.id],
          name: c.name,
          longName: cleanLongName,
          rawLongName: c.longName
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
