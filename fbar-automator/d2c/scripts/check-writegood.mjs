import writeGood from 'write-good';
import fs from 'fs';

const text = fs.readFileSync('src/content/blog/how-to-calculate-maximum-account-value-fbar.mdx', 'utf8');
// Strip frontmatter, imports, markdown links, markdown formatting, and HTML tags
const plain = text
  .replace(/---[\s\S]*?---/, '')
  .replace(/import.*\n/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_`|>]/g, '')
  .replace(/<[^>]+>/g, '');

const suggestions = writeGood(plain);
suggestions.forEach(s => {
  const snippet = plain.substring(s.index, s.index + s.offset);
  console.log(`${s.reason} -> "${snippet}"`);
});
console.log('\nTotal issues:', suggestions.length);
console.log('Word count (approx):', plain.split(/\s+/).filter(w => w.length > 0).length);
console.log('Issues per 500:', ((suggestions.length / plain.split(/\s+/).filter(w => w.length > 0).length) * 500).toFixed(1));
