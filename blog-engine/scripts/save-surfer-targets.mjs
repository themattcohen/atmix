#!/usr/bin/env node
/**
 * Converts raw Surfer NLP entity extraction into surfer-targets.json format.
 * Usage: echo '<json>' | node scripts/save-surfer-targets.mjs <slug> <draftId> <score> <wordMin> <wordMax> <headMin> <headMax>
 *
 * Output: output/<slug>/surfer-targets.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = resolve(__dirname, '..');

const [slug, draftId, score, wordMin, wordMax, headMin, headMax] = process.argv.slice(2);
if (!slug) { console.error('Usage: ... | node save-surfer-targets.mjs <slug> <draftId> <score> <wordMin> <wordMax> <headMin> <headMax>'); process.exit(1); }

const raw = JSON.parse(readFileSync('/dev/stdin', 'utf8'));

function parseTarget(t) {
  if (t.includes('\u2013')) {
    const [min, max] = t.split('\u2013').map(Number);
    return { min, max };
  }
  const n = Number(t);
  return { min: n, max: n };
}

function classify(term) {
  const { min, max } = parseTarget(term.target);
  // High: big gap between current and target, or high target range
  if (max >= 8 || (min >= 3 && max >= 5)) return 'high_priority';
  // Medium: moderate targets
  if (max >= 2) return 'medium_priority';
  // Low: already met or tiny targets
  return 'low_priority';
}

const high_priority = [];
const medium_priority = [];
const low_priority = [];

for (const t of raw) {
  const { min, max } = parseTarget(t.target);
  const entry = { term: t.term, targetMin: min, targetMax: max };
  const cat = classify(t);
  if (cat === 'high_priority') high_priority.push(entry);
  else if (cat === 'medium_priority') medium_priority.push(entry);
  else low_priority.push(entry);
}

const output = {
  slug,
  keyword: slug.replace(/-/g, ' ').replace(/^how to /, 'how to '),
  surferDraftId: draftId,
  extractedAt: new Date().toISOString(),
  contentScore: { current: Number(score), avg: 0, top: 0 },
  targets: {
    wordCount: { min: Number(wordMin), max: Number(wordMax) },
    headings: { min: Number(headMin), max: Number(headMax) }
  },
  terms: { high_priority, medium_priority, low_priority }
};

const outDir = resolve(ENGINE_ROOT, 'output', slug);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
const outPath = resolve(outDir, 'surfer-targets.json');
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${outPath} \u2014 ${high_priority.length}H / ${medium_priority.length}M / ${low_priority.length}L`);
