import { readFileSync } from 'fs';

const text = readFileSync('src/content/blog/fbar-canada-rrsp-tfsa-reporting.mdx', 'utf8').toLowerCase();

function count(term) {
  const escaped = term.replace(/[-[\]{}()*+?.,\^$|#\s]/g, '\$&');
  const regex = new RegExp(escaped, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

const terms = [
  { term: 'foreign financial accounts', min: 3, pri: 'H' },
  { term: 'u.s tax', min: 8, pri: 'H' },
  { term: 'foreign tax credit', min: 3, pri: 'H' },
  { term: 'financial accounts', min: 5, pri: 'H' },
  { term: 'foreign bank', min: 4, pri: 'H' },
  { term: 'foreign accounts', min: 4, pri: 'H' },
  { term: 'mutual funds', min: 5, pri: 'H' },
  { term: 'tax return', min: 4, pri: 'H' },
  { term: 'bank accounts', min: 3, pri: 'H' },
  { term: 'revenue procedure', min: 3, pri: 'H' },
  { term: 'tax purposes', min: 3, pri: 'H' },
  { term: 'foreign trusts', min: 3, pri: 'H' },
  { term: 'u.s person', min: 8, pri: 'H' },
  { term: 'tax free', min: 5, pri: 'H' },
  { term: 'canadian tax', min: 4, pri: 'H' },
  { term: 'fincen form', min: 5, pri: 'H' },
  { term: 'reporting requirements', min: 3, pri: 'H' },
  { term: 'fincen form 114', min: 5, pri: 'H' },
  { term: 'income', min: 12, pri: 'H' },
  { term: 'tax', min: 48, pri: 'H' },
  { term: 'form 3520', min: 7, pri: 'H' },
  { term: 'taxable', min: 4, pri: 'H' },
  { term: 'report', min: 28, pri: 'H' },
  { term: 'form 8938', min: 8, pri: 'H' },
  { term: 'investment', min: 10, pri: 'H' },
  { term: 'accounts', min: 25, pri: 'H' },
  { term: 'irs', min: 9, pri: 'H' },
  { term: 'form', min: 29, pri: 'H' },
  { term: 'subject', min: 4, pri: 'H' },
  { term: 'canada', min: 11, pri: 'H' },
  { term: 'pay', min: 5, pri: 'H' },
  { term: 'taxpayer', min: 8, pri: 'H' },
  { term: 'funds', min: 8, pri: 'H' },
  { term: 'exempt', min: 3, pri: 'H' },
  { term: 'person', min: 10, pri: 'H' },
  { term: 'file', min: 26, pri: 'H' },
  { term: 'qualify', min: 4, pri: 'H' },
  { term: 'rrsp', min: 28, pri: 'H' },
  { term: 'retirement', min: 9, pri: 'H' },
  { term: 'plan', min: 10, pri: 'H' },
  { term: 'fbar canada rrsp tfsa', min: 1, pri: 'M' },
  { term: 'foreign financial accounts reportable', min: 2, pri: 'M' },
  { term: 'foreign financial assets', min: 1, pri: 'M' },
  { term: 'specified foreign financial assets', min: 1, pri: 'M' },
  { term: 'canadian tax law', min: 1, pri: 'M' },
  { term: 'canadian tax treatment', min: 1, pri: 'M' },
  { term: 'worldwide income', min: 1, pri: 'M' },
  { term: 'canadian mutual funds', min: 2, pri: 'M' },
  { term: 'tax savings', min: 1, pri: 'M' },
  { term: 'pay tax', min: 2, pri: 'M' },
  { term: 'tax laws', min: 2, pri: 'M' },
  { term: 'mexican individual retirement accounts', min: 1, pri: 'M' },
  { term: 'interest income', min: 1, pri: 'M' },
  { term: 'tax treatment', min: 1, pri: 'M' },
  { term: 'annual tax', min: 1, pri: 'M' },
  { term: 'tax exposure', min: 1, pri: 'M' },
  { term: 'investment accounts', min: 1, pri: 'M' },
  { term: 'exchange traded funds', min: 1, pri: 'M' },
  { term: 'reporting obligations', min: 2, pri: 'M' },
  { term: 'capital gains', min: 2, pri: 'M' },
  { term: 'double taxation', min: 1, pri: 'M' },
  { term: 'filing obligations', min: 1, pri: 'M' },
  { term: 'canadian residents', min: 1, pri: 'M' },
  { term: 'combined balance', min: 1, pri: 'M' },
  { term: 'aggregate value', min: 1, pri: 'M' },
  { term: 'green card holders', min: 1, pri: 'M' },
  { term: 'substantial presence', min: 2, pri: 'M' },
  { term: 'streamlined filing', min: 1, pri: 'M' },
  { term: 'streamlined procedures', min: 2, pri: 'M' },
  { term: 'fully taxable', min: 1, pri: 'M' },
  { term: 'automatic extension', min: 1, pri: 'M' },
  { term: 'pfic reporting', min: 1, pri: 'M' },
  { term: 'certain thresholds', min: 1, pri: 'M' },
  { term: 'due date', min: 1, pri: 'M' },
  { term: 'calendar year', min: 1, pri: 'M' },
  { term: 'american living', min: 1, pri: 'M' },
  { term: 'non willful', min: 2, pri: 'M' },
  { term: 'tax free savings account', min: 2, pri: 'M' },
  { term: 'free savings account tfsa', min: 2, pri: 'M' },
  { term: 'registered retirement savings', min: 2, pri: 'M' },
  { term: 'taxation', min: 2, pri: 'M' },
];

const underused = [];
const ok = [];

for (const { term, min, pri } of terms) {
  const c = count(term);
  const gap = min - c;
  if (gap > 0) underused.push({ term, count: c, min, gap, pri });
  else ok.push({ term, count: c, min, pri });
}

underused.sort((a, b) => (a.pri === b.pri ? b.gap - a.gap : a.pri === 'H' ? -1 : 1));

console.log('UNDERUSED TERMS:');
for (const { term, count: c, min, gap, pri } of underused) {
  console.log(`  [${pri}] gap=${String(gap).padStart(3)}  current=${String(c).padStart(3)}  min=${String(min).padStart(3)}  '${term}'`);
}
console.log(`\nTotal underused: ${underused.length} / ${terms.length}`);
