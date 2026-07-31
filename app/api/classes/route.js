import { NextResponse } from 'next/server';
import { WebUntisAnonymousAuth } from 'webuntis';

export async function GET() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  
  try {
    await untis.login();
    const classes = await untis.getClasses();
    
    // Sort classes by longName for easier searching
    const sortedClasses = classes
      .map(c => ({
        id: c.id,
        name: c.name,
        longName: c.longName
      }))
      .sort((a, b) => (a.longName || a.name).localeCompare(b.longName || b.name));

    return NextResponse.json(sortedClasses);
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
