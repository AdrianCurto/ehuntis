const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  // Fetch all classes
  const classes = await untis.getClasses();
  
  // Find GITECX classes
  const gitecx = classes.filter(c => (c.name || '').toUpperCase().startsWith('GITECX'));
  console.log(`Found ${gitecx.length} GITECX classes:`, gitecx.map(c => c.name));
  
  if (gitecx.length === 0) {
    console.log("No GITECX classes found.");
    return;
  }
  
  // Let's pick GITECX301 (or the first one)
  const targetClass = gitecx.find(c => c.name.toUpperCase() === 'GITECX301') || gitecx[0];
  console.log(`\nFetching timetable for: ${targetClass.name} (ID: ${targetClass.id})`);
  
  // Fetch timetable for the target class (we need a date range, e.g., a typical week)
  // Let's use a week in the middle of a typical semester, say early October 2024 or current date.
  // We'll fetch for the whole month to see the variation.
  const today = new Date();
  
  // Just fetch for a specific date range, e.g. Sep 1 to Sep 30 of the current year
  const startDate = new Date(today.getFullYear(), 8, 1); // Sep 1
  const endDate = new Date(today.getFullYear(), 8, 30); // Sep 30
  
  try {
    const timetable = await untis.getTimetableForRange(startDate, endDate, targetClass.id, 1); // 1 = type class
    console.log(`\nFound ${timetable.length} lessons in the timetable.`);
    
    if (timetable.length > 0) {
      // Let's analyze the properties of the first few lessons, and also try to find distinct properties
      const sample = timetable.slice(0, 3);
      console.log("\nSample of lessons (first 3):");
      console.log(JSON.stringify(sample, null, 2));
      
      // Look for properties that might indicate "magistral", "práctica", etc.
      console.log("\nAnalyzing lesson subjects/activities...");
      const activities = new Map();
      for (const lesson of timetable) {
        // Collect subject names
        const subjectNames = lesson.su.map(s => s.name || s.longname).join(', ');
        
        // Collect class names (this might indicate the subgroup, e.g., GITECX301 vs GITECX301-PL1)
        const classNames = lesson.kl.map(k => k.name).join(', ');
        
        const key = `${subjectNames} | Classes: ${classNames} | activityType: ${lesson.activityType || 'N/A'}`;
        if (!activities.has(key)) {
            activities.set(key, lesson);
        }
      }
      
      console.log("\nDistinct types of lessons found (based on Subject + Classes + activityType):");
      for (const [key, lesson] of activities.entries()) {
        console.log(`- ${key}`);
      }
    }
  } catch (e) {
    console.error("Error fetching timetable:", e);
  }
}
main();
