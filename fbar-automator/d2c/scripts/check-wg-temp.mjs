import writegood from 'write-good';
import { readFileSync } from 'fs';

const file = process.argv[2];
const t = readFileSync(file, 'utf8')
  .replace(/^---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_|]/g, '');

const s = writegood(t);
console.log('=== PASSIVE ===');
s.filter(i => i.reason.includes('passive')).forEach(i => {
  console.log(t.substring(Math.max(0, i.index - 40), i.index + i.offset + 40).replace(/\n/g, ' '));
});
console.log('\n=== WEASEL ===');
s.filter(i => i.reason.includes('weasel')).forEach(i => {
  console.log(t.substring(Math.max(0, i.index - 20), i.index + i.offset + 20).replace(/\n/g, ' '));
});
console.log('\nPassive:', s.filter(i => i.reason.includes('passive')).length);
console.log('Weasel:', s.filter(i => i.reason.includes('weasel')).length);
console.log('Total:', s.length);
