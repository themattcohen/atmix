#!/usr/bin/env node
import fs from 'fs';

const raw = fs.readFileSync('src/content/blog/fbar-penalties-what-happens-if-you-dont-file.mdx','utf-8');
const body = raw.slice(raw.indexOf('---', 3) + 3).trim().toLowerCase();

function countOccurrences(text, term) {
  let count = 0;
  let pos = 0;
  const t = term.toLowerCase();
  while ((pos = text.indexOf(t, pos)) !== -1) {
    count++;
    pos += 1;
  }
  return count;
}

const highPriority = [
  ['fbar penalties', 14, 33],
  ['foreign financial accounts', 5, 17],
  ['foreign bank accounts', 3, 7],
  ['foreign bank', 6, 10],
  ['financial accounts', 7, 26],
  ['criminal penalties', 4, 7],
  ['foreign accounts', 4, 11],
  ['bank and financial accounts', 2, 8],
  ['foreign bank and financial', 2, 8],
  ['willful failure', 3, 10],
  ['willful violations', 4, 10],
  ['bank account', 4, 8],
  ['file an fbar', 7, 13],
  ['avoid penalties', 3, 8],
  ['failure to file', 5, 17],
  ['non willful', 8, 17],
  ['tax returns', 5, 9],
  ['due date', 2, 8],
  ['reasonable cause', 3, 12],
  ['willful failure to file', 3, 10],
  ['delinquent fbars', 4, 11],
  ['calendar year', 2, 8],
  ['file fbars', 3, 7],
  ['penalties', 42, 72],
  ['fbar', 53, 71],
  ['accounts', 34, 57],
  ['file', 43, 60],
  ['irs', 16, 31]
];

const medPriority = [
  ['bank secrecy act', 1, 2],
  ['financial interest', 1, 4],
  ['report foreign bank accounts', 1, 3],
  ['foreign bank account report', 1, 4],
  ['non willful violations', 2, 6],
  ['tax evasion', 2, 4],
  ['financial crimes enforcement network', 1, 2],
  ['civil penalty', 2, 4],
  ['signature authority', 1, 2],
  ['fbar form', 2, 4],
  ['tax liability', 1, 2],
  ['tax obligations', 1, 3],
  ['significant penalties', 1, 4],
  ['criminal prosecution', 1, 4],
  ['fbar reporting', 2, 6],
  ['bank statements', 1, 2],
  ['tax preparer', 1, 4],
  ['eliminate penalties', 1, 4],
  ['maximum value', 1, 2],
  ['tax evasion cases', 1, 2],
  ['harsh penalties', 1, 4],
  ['maximum penalty', 1, 2],
  ['district court', 1, 4],
  ['foreign income', 1, 2],
  ['filing requirement', 2, 6],
  ['adjusted annually', 2, 4],
  ['non willful penalties', 1, 4],
  ['assess penalties', 1, 2],
  ['unreported accounts', 1, 4],
  ['legal duty', 1, 2],
  ['automatic extension', 1, 2],
  ['aggregate value', 1, 2],
  ['treasury department', 1, 2],
  ['annual report', 1, 2],
  ['swiss accounts', 1, 4],
  ['honest mistakes', 1, 4],
  ['box indicating', 1, 2],
  ['fbar issues', 1, 2],
  ['penalties depends', 2, 4],
  ['potential penalties', 1, 2],
  ['schedule b', 2, 7],
  ['filing late', 1, 4],
  ['fbar cases', 1, 2],
  ['file late fbars', 1, 3],
  ['back taxes', 1, 2],
  ['detailed information', 1, 2],
  ['late fbars', 2, 5],
  ['multiple years', 1, 4]
];

console.log('=== HIGH PRIORITY TERMS ===');
let highMiss = 0;
for (const [term, min, max] of highPriority) {
  const count = countOccurrences(body, term);
  const status = count >= min ? (count <= max ? 'OK  ' : 'OVER') : 'MISS';
  if (status === 'MISS') highMiss++;
  console.log(`${status}  ${term.padEnd(32)} ${String(count).padStart(3)}  (${min}-${max})`);
}
console.log(`\nHigh-priority missed: ${highMiss}/${highPriority.length}`);

console.log('\n=== MEDIUM PRIORITY TERMS ===');
let medHit = 0;
let medMiss = 0;
for (const [term, min, max] of medPriority) {
  const count = countOccurrences(body, term);
  const status = count >= min ? (count <= max ? 'OK  ' : 'OVER') : 'MISS';
  if (status === 'MISS') medMiss++;
  else medHit++;
  if (status === 'MISS') console.log(`${status}  ${term.padEnd(42)} ${String(count).padStart(3)}  (${min}-${max})`);
}
console.log(`\nMedium-priority: ${medHit}/${medPriority.length} hit (${Math.round(medHit/medPriority.length*100)}%), ${medMiss} missed`);
console.log(`Target: ≥70% = ${Math.ceil(medPriority.length*0.7)} terms`);
