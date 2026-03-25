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
const grouped = {};
suggestions.forEach(s => {
  const type = s.reason || 'unknown';
  if (!grouped[type]) grouped[type] = [];
  const word = plain.substring(s.index, s.index + s.offset).trim();
  const start = Math.max(0, s.index - 20);
  const end = Math.min(plain.length, s.index + s.offset + 20);
  const ctx = plain.substring(start, end).replace(/\n/g, ' ').trim();
  grouped[type].push({ word, ctx });
});

Object.keys(grouped).sort().forEach(reason => {
  console.log(`\n=== ${reason} (${grouped[reason].length}) ===`);
  grouped[reason].slice(0, 5).forEach(g => {
    console.log(`  "${g.word}" in: ...${g.ctx}...`);
  });
  if (grouped[reason].length > 5) console.log(`  ... and ${grouped[reason].length - 5} more`);
});
console.log(`\nTotal issues: ${suggestions.length}`);
