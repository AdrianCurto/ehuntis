const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const classes = await untis.getClasses();
  console.log(`Found ${classes.length} classes total.`);
  
  // Pick a random sample of 20 classes from different faculties
  const sampleClasses = [];
  for(let i=0; i<classes.length; i+= Math.floor(classes.length/20)) {
      if (sampleClasses.length < 20) sampleClasses.push(classes[i]);
  }
  
  const allTypes = new Set();
  
  // We'll check mid-October 2025 like before
  const start = new Date(2025, 9, 13);
  const end = new Date(2025, 9, 27);
  
  for (const c of sampleClasses) {
      try {
          const timetable = await untis.getTimetableForRange(start, end, c.id, 1);
          if (timetable && timetable.length > 0) {
              timetable.forEach(l => {
                  if (l.lstext) allTypes.add(l.lstext);
              });
          }
      } catch (e) {
          // ignore empty
      }
  }
  
  console.log("Distinct lstext values across sample classes:");
  console.log(Array.from(allTypes).sort());
}

main().catch(console.error);
