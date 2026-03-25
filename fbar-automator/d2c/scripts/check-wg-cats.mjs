import writeGood from 'write-good';
import fs from 'fs';

const slug = process.argv[2] || 'fbar-filing-for-expats-living-abroad';
const text = fs.readFileSync(`src/content/drafts/${slug}.mdx`, 'utf8');
const plain = text
  .replace(/---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_>~]/g, '')
  .replace(/<[^>]+>/g, '');

const s = writeGood(plain);
const reasons = {};
s.forEach(x => {
  const key = x.reason.replace(/".*?"/g, 'X');
  reasons[key] = (reasons[key] || 0) + 1;
});
Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
console.log('\nTotal:', s.length);
console.log('Words:', plain.split(/\s+/).filter(w => w.length > 0).length);
