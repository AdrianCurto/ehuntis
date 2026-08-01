const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const classes = await untis.getClasses();
  const targetClass = classes.find(c => c.name.includes('GITECX')) || classes[0];
  console.log(`Using class: ${targetClass.name} (ID: ${targetClass.id})`);
  
  // Try several past months to find any timetable data
  const testDates = [
    new Date(2025, 9, 15), // Oct 15, 2025
    new Date(2025, 10, 15), // Nov 15, 2025
    new Date(2026, 2, 15), // Mar 15, 2026
    new Date(2024, 9, 15), // Oct 15, 2024
  ];
  
  for (const d of testDates) {
    try {
      const start = new Date(d);
      const end = new Date(d);
      end.setDate(end.getDate() + 14); // 2 weeks
      
      console.log(`\nTrying range ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}...`);
      const timetable = await untis.getTimetableForRange(start, end, targetClass.id, 1);
      
      if (timetable && timetable.length > 0) {
        console.log(`Found ${timetable.length} lessons!`);
        console.log(JSON.stringify(timetable.slice(0, 2), null, 2));
        
        // Let's summarize the properties
        const types = new Set();
        timetable.forEach(lesson => {
            const subject = lesson.su.map(s => s.name || s.longname).join(', ');
            const klasses = lesson.kl.map(k => k.name).join(', ');
            const typeStr = lesson.lstext || 'N/A';
            types.add(typeStr);
            console.log(`- Subject: ${subject} | Type: ${typeStr} | Room: ${lesson.ro ? lesson.ro.map(r=>r.name).join(',') : 'N/A'}`);
        });
        console.log("Distinct lstext values:", Array.from(types));
        return; // Stop once we find data
      }
    } catch (e) {
      console.log(`No data or error: ${e.message}`);
    }
  }
}

main().catch(console.error);
