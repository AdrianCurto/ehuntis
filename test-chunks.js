
const { WebUntisAnonymousAuth } = require("webuntis");
async function main() {
  const untis = new WebUntisAnonymousAuth("ehu", "ehu.webuntis.com");
  await untis.login();
  const classes = await untis.getClasses();
  const gitecx = classes.find(c => c.name === "GITECX332-306");
  
  const startRange = new Date("2025-08-01T00:00:00Z");
  const endRange = new Date("2026-01-31T00:00:00Z");

  const fetchChunk = async (start, end) => {
    try {
      return await untis.getTimetableForRange(start, end, gitecx.id, 1);
    } catch (e) {
      if (e.message && e.message.includes(`Server didn${String.fromCharCode(39)}t return any result`)) return [];
      throw e;
    }
  };

  const chunks = [];
  let current = new Date(startRange);
  while (current < endRange) {
    let next = new Date(current);
    next.setDate(next.getDate() + 30);
    if (next > endRange) next = new Date(endRange);
    
    chunks.push(fetchChunk(new Date(current), new Date(next)));
    current = new Date(next);
  }

  const results = await Promise.all(chunks);
  const total = results.flat();
  console.log("Total lessons fetched via chunks: " + total.length);
}
main().catch(console.error);

