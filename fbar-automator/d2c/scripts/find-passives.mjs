import { readFileSync } from 'fs';
import writeGood from 'write-good';

const slug = process.argv[2] || 'fbar-what-counts-as-foreign-financial-account';
let mdxPath = `src/content/drafts/${slug}.mdx`;
try { readFileSync(mdxPath); } catch { mdxPath = `src/content/blog/${slug}.mdx`; }
const text = readFileSync(mdxPath, 'utf8');
const plain = text
  .replace(/---[\s\S]*?---/, '')
  .replace(/import.*$/gm, '')
  .replace(/\|[^\n]+/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*>]/g, '');

const suggestions = writeGood(plain);
const passives = suggestions.filter(s => s.reason && s.reason.includes('passive'));
passives.forEach(s => {
  const start = Math.max(0, s.index - 40);
  const end = Math.min(plain.length, s.index + s.offset + 40);
  const context = plain.substring(start, end).replace(/\n/g, ' ').trim();
  const word = plain.substring(s.index, s.index + s.offset).trim();
  console.log(`PASSIVE: "${word}" in: ...${context}...`);
});
console.log(`\nTotal passive: ${passives.length}`);
