import writeGood from 'write-good';
import { readFileSync } from 'fs';

const text = readFileSync('src/content/drafts/fbar-10000-threshold-aggregate-value.mdx', 'utf8');
const plain = text.replace(/---[\s\S]*?---/, '').replace(/import.*$/gm, '').replace(/[#*|>\[\](){}]/g, ' ').replace(/\s+/g, ' ').trim();
const suggestions = writeGood(plain);

// Show each "wordy or unneeded" with the flagged word
const wordyItems = suggestions.filter(s => s.reason.includes('wordy or unneeded'));
const wordCounts = {};
for (const item of wordyItems) {
  const word = plain.substring(item.index, item.index + item.offset).trim().toLowerCase();
  if (!wordCounts[word]) wordCounts[word] = 0;
  wordCounts[word]++;
}

console.log('Wordy/unneeded word frequencies:');
for (const [word, count] of Object.entries(wordCounts).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${word}: ${count}x`);
}
