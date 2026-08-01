const { WebUntisAnonymousAuth } = require('webuntis');

async function main() {
  const untis = new WebUntisAnonymousAuth('ehu', 'ehu.webuntis.com');
  await untis.login();
  
  const classes = await untis.getClasses();
  
  const gitec = classes.filter(c => (c.name || '').toUpperCase().includes('GITEC'));
  console.log(`Found ${gitec.length} GITEC classes:`);
  gitec.forEach(c => console.log(`${c.id}: ${c.name} - ${c.longName}`));
  
}
main();
