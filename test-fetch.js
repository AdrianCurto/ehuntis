
const { WebUntisAnonymousAuth } = require("webuntis");
async function main() {
  const untis = new WebUntisAnonymousAuth("ehu", "ehu.webuntis.com");
  await untis.login();
  const classes = await untis.getClasses();
  const gitecx = classes.find(c => c.name === "GITECX332-306");
  
  const startRange = new Date("2025-08-01T00:00:00Z");
  const endRange = new Date("2026-01-31T00:00:00Z");

  try {
    const rawTimetable = await untis.getTimetableForRange(startRange, endRange, gitecx.id, 1);
    console.log("Success, lessons: " + rawTimetable.length);
  } catch (err) {
    if (err.message && err.message.includes("Server didn\"t return any result")) {
      console.log("No lessons in this date range, this is fine");
    } else {
      console.error("Failed to fetch timetable:", err.message);
    }
  }
}
main().catch(console.error);

