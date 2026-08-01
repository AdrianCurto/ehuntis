const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const classes = await untis.getClasses();
  const gitec = classes.find(c => c.name === 'GITECX301');
  if (!gitec) {
      console.log('GITECX301 not found');
      return;
  }
  console.log('Found GITECX301:', gitec.id);
  
  const start = new Date(2025, 9, 13);
  const end = new Date(2025, 9, 27);
  
  const timetable = await untis.getTimetableForRange(start, end, gitec.id, 1);
  console.log(`Found ${timetable.length} lessons in this range.`);
  
  const types = new Set();
  timetable.forEach(l => {
      if (l.lstext) types.add(l.lstext);
  });
  console.log('Unique lstexts:', Array.from(types));
}

main().catch(console.error);
