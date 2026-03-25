import fs from 'fs';

const targets = JSON.parse(fs.readFileSync('src/content/drafts/fbar-vs-form-3520-foreign-trusts.diy-surfer-targets.json','utf8'));
const article = fs.readFileSync('src/content/drafts/fbar-vs-form-3520-foreign-trusts.mdx','utf8');

const text = article
  .replace(/---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*|_`>]/g, ' ')
  .replace(/\s+/g, ' ')
  .toLowerCase();

function countTerm(text, term) {
  let count = 0;
  let idx = 0;
  const t = term.toLowerCase();
  while ((idx = text.indexOf(t, idx)) !== -1) {
    count++;
    idx += 1;
  }
  return count;
}

console.log('=== HIGH PRIORITY MISSING ===');
const missingHigh = [];
for (const t of targets.terms.high_priority) {
  const count = countTerm(text, t.term);
  if (count < t.targetMin) {
    missingHigh.push({ term: t.term, have: count, need: t.targetMin });
  }
}
missingHigh.sort((a,b) => (b.need - b.have) - (a.need - a.have));
console.log(`Total missing: ${missingHigh.length}/${targets.terms.high_priority.length}`);
missingHigh.forEach(m => console.log(`  "${m.term}": ${m.have}/${m.need}`));

console.log('\n=== MEDIUM PRIORITY MISSING ===');
const missingMed = [];
for (const t of targets.terms.medium_priority) {
  const count = countTerm(text, t.term);
  if (count < t.targetMin) {
    missingMed.push({ term: t.term, have: count, need: t.targetMin });
  }
}
missingMed.sort((a,b) => (b.need - b.have) - (a.need - a.have));
console.log(`Total missing: ${missingMed.length}/${targets.terms.medium_priority.length}`);
missingMed.forEach(m => console.log(`  "${m.term}": ${m.have}/${m.need}`));

console.log('\n=== LOW PRIORITY MISSING (zero count only) ===');
const missingLow = [];
for (const t of targets.terms.low_priority) {
  const count = countTerm(text, t.term);
  if (count === 0) {
    missingLow.push({ term: t.term, have: count, need: t.targetMin });
  }
}
console.log(`Total zero: ${missingLow.length}/${targets.terms.low_priority.length}`);
missingLow.forEach(m => console.log(`  "${m.term}": ${m.have}/${m.need}`));
