import fs from 'fs';

const slug = process.argv[2] || 'fbar-trust-reporting-requirements';
const text = fs.readFileSync(`src/content/drafts/${slug}.mdx`, 'utf8');
const plain = text
  .replace(/---[\s\S]*?---/, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*_>~]/g, '')
  .replace(/<[^>]+>/g, '');

const sentences = plain.split(/[.!?]+/).filter(s => s.trim().length > 0);
const long = sentences.filter(s => s.trim().split(/\s+/).length > 25);
long.forEach(s => {
  const words = s.trim().split(/\s+/).length;
  console.log(words, 'words:', s.trim().substring(0, 120));
});
console.log('\nTotal long sentences (>25 words):', long.length);
console.log('Total sentences:', sentences.length);

const wordCount = plain.split(/\s+/).filter(w => w.length > 0).length;
console.log('Word count:', wordCount);
