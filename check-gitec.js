const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  const classes = await untis.getClasses();
  const gitec = classes.filter(c => (c.longName || '').toLowerCase().includes('gitec') || (c.name || '').toLowerCase().includes('gitec'));
  console.log(JSON.stringify(gitec, null, 2));
}
main();
