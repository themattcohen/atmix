import { readFileSync } from 'fs';

const content = readFileSync('src/content/blog/how-to-calculate-maximum-account-value-fbar.mdx', 'utf-8').toLowerCase();

// Count headings
const headings = content.match(/^#{1,6}\s/gm);
console.log('Heading count:', headings ? headings.length : 0);

const terms = JSON.parse(readFileSync('src/content/drafts/how-to-calculate-maximum-account-value-fbar.surfer-targets.json', 'utf-8'));

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\' + '$' + '&');
}

console.log('\n=== HIGH PRIORITY TERMS ===');
let highHits = 0;
const highTotal = terms.terms.high_priority.length;
for (const t of terms.terms.high_priority) {
  const regex = new RegExp(escapeRegex(t.term), 'gi');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;
  const ok = count >= t.targetMin && count <= t.targetMax;
  const status = ok ? 'OK' : (count < t.targetMin ? 'LOW' : 'HIGH');
  if (ok) highHits++;
  console.log(`${status} ${t.term}: ${count} (target: ${t.targetMin}-${t.targetMax})`);
}
console.log(`High priority hit rate: ${highHits}/${highTotal}`);

console.log('\n=== MEDIUM PRIORITY TERMS ===');
let medHits = 0;
const medTotal = terms.terms.medium_priority.length;
for (const t of terms.terms.medium_priority) {
  const regex = new RegExp(escapeRegex(t.term), 'gi');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;
  const ok = count >= t.targetMin && count <= t.targetMax;
  const status = ok ? 'OK' : (count < t.targetMin ? 'LOW' : 'HIGH');
  if (ok) medHits++;
  console.log(`${status} ${t.term}: ${count} (target: ${t.targetMin}-${t.targetMax})`);
}
console.log(`Medium priority hit rate: ${medHits}/${medTotal}`);
console.log(`Medium priority target (70%): ${Math.ceil(medTotal * 0.7)}`);

console.log('\n=== LOW PRIORITY TERMS ===');
for (const t of terms.terms.low_priority) {
  const regex = new RegExp(escapeRegex(t.term), 'gi');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;
  console.log(`${t.term}: ${count} (target: ${t.targetMin}-${t.targetMax})`);
}
