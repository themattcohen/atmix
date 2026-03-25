import { getKeywordDensity, getKeywordOccurrences, countWords } from './seo-scorer/utils/text.mjs';
import { readFileSync } from 'fs';

const mdx = readFileSync('src/content/drafts/fbar-reporting-closed-accounts.mdx', 'utf8');
const body = mdx.replace(/^---[\s\S]*?---/, '');

let plain = body
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/^#+\s+/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\|[^|]*\|/g, ' ')
  .replace(/---+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const total = countWords(plain);
console.log('Total words:', total);
console.log('Overall density:', getKeywordDensity(plain, 'fbar report closed account').toFixed(2) + '%');

const kws = ['fbar', 'report', 'closed', 'account'];
for (const kw of kws) {
  const count = getKeywordOccurrences(plain, kw);
  const density = (count * 100) / total;
  console.log(kw + ':', count, 'occurrences, density:', density.toFixed(2) + '%');
}

const avgDensity = kws.reduce((sum, kw) => {
  const c = getKeywordOccurrences(plain, kw);
  return sum + (c * 100) / total;
}, 0) / kws.length;
console.log('Avg sig-word density:', avgDensity.toFixed(2) + '%');
