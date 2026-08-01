const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const currentSchoolYear = await untis.getLatestSchoolyear();
  console.log("Current School Year:", currentSchoolYear);
  
  const classes = await untis.getClasses();
  const gitecx = classes.filter(c => (c.name || '').toUpperCase().includes('GITECX'));
  
  if (gitecx.length === 0) {
    console.log("No GITECX classes found.");
    return;
  }
  
  const targetClass = gitecx[0];
  console.log(`\nFetching timetable for: ${targetClass.name} (ID: ${targetClass.id})`);
  
  try {
    // Let's use the start and end of the school year
    const startDate = currentSchoolYear.startDate;
    const endDate = currentSchoolYear.endDate;
    console.log(`Fetching from ${startDate} to ${endDate}`);
    
    // Instead of the whole year (might be too big or slow), let's fetch for just 4 weeks after the start of the school year
    const limitDate = new Date(startDate.getTime());
    limitDate.setDate(limitDate.getDate() + 28);
    
    console.log(`Actually fetching from ${startDate} to ${limitDate}`);
    
    const timetable = await untis.getTimetableForRange(startDate, limitDate, targetClass.id, 1); // 1 = type class
    console.log(`\nFound ${timetable.length} lessons in the timetable.`);
    
    if (timetable.length > 0) {
      console.log("\nSample of a single lesson object:");
      console.log(JSON.stringify(timetable[0], null, 2));
      
      console.log("\nAnalyzing distinct types of lessons/activities...");
      const activities = new Map();
      for (const lesson of timetable) {
        const subjectNames = lesson.su.map(s => s.name || s.longname).join(', ');
        const classNames = lesson.kl.map(k => k.name).join(', ');
        const statflags = lesson.statflags || '';
        const activityType = lesson.activityType || 'N/A';
        const lstype = lesson.lstype || 'N/A';
        
        const key = `Subject: ${subjectNames} | Classes: ${classNames} | activityType: ${activityType} | lstype: ${lstype} | statflags: ${statflags}`;
        
        if (!activities.has(key)) {
            activities.set(key, lesson);
        }
      }
      
      console.log("\nDistinct types of lessons found:");
      for (const key of activities.keys()) {
        console.log(`- ${key}`);
      }
    }
  } catch (e) {
    console.error("Error fetching timetable:", e);
  }
}
main();
