const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const classes = await untis.getClasses();
  const gitecx = classes.filter(c => c.name.includes('GITECX'));
  console.log(`Found ${gitecx.length} GITECX classes.`);
  
  if (gitecx.length > 0) {
      console.log('First 5:', gitecx.slice(0, 5).map(c => c.name));
      const c = gitecx[0];
      const start = new Date(2025, 9, 13);
      const end = new Date(2025, 9, 27);
      const timetable = await untis.getTimetableForRange(start, end, c.id, 1);
      console.log(`Timetable for ${c.name}: ${timetable.length} lessons`);
      timetable.slice(0, 3).forEach(l => {
          console.log('- lstext:', l.lstext, 'lstype:', l.lstype, 'activityType:', l.activityType);
      });
  }
}

main().catch(console.error);
