import { readFileSync } from 'fs';

const slug = process.argv[2] || 'fbar-vs-form-3520-foreign-trusts';

let mdxPath = `src/content/drafts/${slug}.mdx`;
try { readFileSync(mdxPath); } catch { mdxPath = `src/content/blog/${slug}.mdx`; }
const text = readFileSync(mdxPath, 'utf8');
const plain = text.replace(/---[\s\S]*?---/, '').replace(/import.*$/gm, '').replace(/[#*|>\[\](){}]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

let targetsPath = `src/content/drafts/${slug}.diy-surfer-targets.json`;
try { readFileSync(targetsPath); } catch { targetsPath = `src/content/drafts/${slug}.surfer-targets.json`; }
const targets = JSON.parse(readFileSync(targetsPath, 'utf8'));

function countTerm(text, term) {
  const normalized = text.replace(/[-–—]/g, ' ');
  const normTerm = term.replace(/[-–—]/g, ' ');
  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
  const matches = normalized.match(regex);
  return matches ? matches.length : 0;
}

console.log('=== HIGH PRIORITY GAPS ===');
let highMissing = 0;
for (const t of targets.terms.high_priority) {
  const count = countTerm(plain, t.term);
  if (count < t.targetMin) {
    highMissing++;
    console.log('  "' + t.term + '": ' + count + '/' + t.targetMin + ' (need ' + (t.targetMin - count) + ' more)');
  }
}
console.log(`\nHigh: ${targets.terms.high_priority.length - highMissing}/${targets.terms.high_priority.length} met`);

console.log('\n=== MEDIUM PRIORITY GAPS ===');
const medGaps = [];
for (const t of targets.terms.medium_priority) {
  const count = countTerm(plain, t.term);
  if (count < t.targetMin) {
    medGaps.push({ term: t.term, count, needed: t.targetMin, gap: t.targetMin - count });
  }
}
medGaps.sort((a, b) => a.gap - b.gap);
for (const g of medGaps) {
  console.log('  "' + g.term + '": ' + g.count + '/' + g.needed + ' (need ' + g.gap + ' more)');
}

const medTotal = targets.terms.medium_priority.length;
const medMet = medTotal - medGaps.length;
console.log('\nMedium: ' + medMet + '/' + medTotal + ' met (' + Math.round(medMet/medTotal*100) + '%)');
