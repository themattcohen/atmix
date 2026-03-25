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
const weaken = s.filter(x => x.reason.includes('can weaken') && !x.reason.includes('weasel'));
const wordCounts = {};
weaken.forEach(x => {
  const snippet = plain.substring(x.index, x.index + x.offset).toLowerCase();
  wordCounts[snippet] = (wordCounts[snippet] || 0) + 1;
});
Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
console.log('\nTotal weaken:', weaken.length);
