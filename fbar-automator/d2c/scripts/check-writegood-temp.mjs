import writeGood from 'write-good';
import { readFileSync } from 'fs';

const text = readFileSync('src/content/drafts/fbar-10000-threshold-aggregate-value.mdx', 'utf8');
// Strip frontmatter, imports, and markdown syntax
const plain = text.replace(/---[\s\S]*?---/, '').replace(/import.*$/gm, '').replace(/[#*|>\[\](){}]/g, ' ').replace(/\s+/g, ' ').trim();
const suggestions = writeGood(plain);
console.log('Total issues:', suggestions.length);
console.log('Word count:', plain.split(/\s+/).length);

// Group by reason pattern
const reasons = {};
for (const s of suggestions) {
  const key = s.reason.replace(/".*?"/g, '"X"');
  if (!reasons[key]) reasons[key] = [];
  reasons[key].push(s);
}
for (const [reason, items] of Object.entries(reasons).sort((a,b) => b[1].length - a[1].length)) {
  console.log('\n' + items.length + 'x: ' + reason);
  for (const item of items.slice(0, 5)) {
    const idx = item.index;
    const snippet = plain.substring(Math.max(0, idx - 30), idx + item.offset + 30);
    console.log('   "' + snippet.replace(/\n/g, ' ') + '"');
  }
}
