import { readFileSync } from 'fs';
const slug = process.argv[2];
const data = JSON.parse(readFileSync(`src/content/drafts/${slug}.diy-surfer-targets.json`, 'utf8'));
const mdx = readFileSync(`src/content/drafts/${slug}.mdx`, 'utf8').toLowerCase();

function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

for (const [priority, terms] of Object.entries(data.terms)) {
  if (priority === 'low_priority') continue;
  const below = terms.filter(t => countTerm(mdx, t.term) < (t.targetMin || 1));
  console.log(`${priority}: ${below.length} below target out of ${terms.length}`);
  below.forEach(t => {
    const c = countTerm(mdx, t.term);
    console.log(`  "${t.term}": ${c}/${t.targetMin}`);
  });
}
