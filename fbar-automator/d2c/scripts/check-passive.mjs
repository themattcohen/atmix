import writeGood from 'write-good';
import fs from 'fs';

const slug = process.argv[2] || 'fbar-trust-reporting-requirements';
const text = fs.readFileSync(`src/content/drafts/${slug}.mdx`, 'utf8');
const plain = text
  .replace(/---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_>~]/g, '')
  .replace(/<[^>]+>/g, '');

const s = writeGood(plain);
const passive = s.filter(x => x.reason.includes('passive'));
passive.forEach(x => {
  const start = Math.max(0, x.index - 40);
  const end = Math.min(plain.length, x.index + x.offset + 40);
  const ctx = plain.substring(start, end).replace(/\n/g, ' ');
  const word = plain.substring(x.index, x.index + x.offset);
  console.log('PASSIVE:', JSON.stringify(word), '|||', ctx);
});
console.log('\nTotal passive:', passive.length);
