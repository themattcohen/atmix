import fs from 'fs';

const text = fs.readFileSync('src/content/drafts/fbar-voluntary-disclosure-practice.mdx', 'utf8').toLowerCase();
const targets = JSON.parse(fs.readFileSync('src/content/drafts/fbar-voluntary-disclosure-practice.diy-surfer-targets.json', 'utf8'));

function countTerm(text, term) {
  let count = 0;
  let pos = 0;
  const lowerTerm = term.toLowerCase();
  while ((pos = text.indexOf(lowerTerm, pos)) !== -1) {
    count++;
    pos += lowerTerm.length;
  }
  return count;
}

const medTerms = targets.terms.medium_priority;
const missing = [];
for (const t of medTerms) {
  const count = countTerm(text, t.term);
  if (count < t.targetMin) {
    missing.push({ term: t.term, have: count, need: t.targetMin, max: t.targetMax });
  }
}

console.log(`Missing medium terms (${missing.length}):`);
missing.forEach(m => console.log(`  "${m.term}": ${m.have}/${m.need} (max ${m.max})`));
