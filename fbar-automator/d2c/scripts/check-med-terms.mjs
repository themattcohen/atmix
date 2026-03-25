import fs from 'fs';
import { getKeywordOccurrences } from './seo-scorer/utils/text.mjs';

const slug = process.argv[2] || 'fbar-trust-reporting-requirements';
const data = JSON.parse(fs.readFileSync(`src/content/drafts/${slug}.diy-surfer-targets.json`, 'utf8'));
const text = fs.readFileSync(`src/content/drafts/${slug}.mdx`, 'utf8');
// Strip frontmatter and markdown
const plain = text
  .replace(/^---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_>~]/g, '');

const med = data.terms.medium_priority;
const below = med.filter(t => getKeywordOccurrences(plain, t.term) < t.targetMin);
console.log('Total below target:', below.length, '/', med.length);
below.forEach(t => {
  const count = getKeywordOccurrences(plain, t.term);
  console.log(`${count}/${t.targetMin} | ${t.term}`);
});
