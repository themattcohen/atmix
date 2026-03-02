#!/usr/bin/env node
// validate-article.mjs
// Validates blog article drafts against anti-slop-rules.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D2C_ROOT = path.resolve(__dirname, '..');

// --- CLI ---
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/validate-article.mjs <slug>');
  console.error('  Reads from: src/content/drafts/<slug>.mdx');
  console.error('  Outputs to: src/content/drafts/<slug>.validation.json');
  process.exit(1);
}

// --- Load rules ---
const rulesPath = path.join(D2C_ROOT, 'src/content/anti-slop-rules.json');
if (!fs.existsSync(rulesPath)) {
  console.error(`ERROR: anti-slop-rules.json not found at ${rulesPath}`);
  process.exit(1);
}
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

// --- Load MDX ---
const draftPath = path.join(D2C_ROOT, 'src/content/drafts', `${slug}.mdx`);
if (!fs.existsSync(draftPath)) {
  console.error(`ERROR: Draft not found at ${draftPath}`);
  process.exit(1);
}
const raw = fs.readFileSync(draftPath, 'utf-8');

// --- Parse frontmatter & body ---
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const meta = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) meta[key] = val;
  }
  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

const { meta, body } = parseFrontmatter(raw);
const bodyLower = body.toLowerCase();
const words = body.split(/\s+/).filter(w => w.length > 0);
const wordCount = words.length;
const lines = body.split('\n');

// --- Helpers ---
const checks = {};
const failedChecks = [];
const warnings = [];

function pass(name, detail) {
  checks[name] = detail ? `PASS (${detail})` : 'PASS';
  console.log(`  \u2705 ${name}${detail ? ': ' + detail : ''}`);
}

function fail(name, detail) {
  checks[name] = `FAIL (${detail})`;
  failedChecks.push(`${name}: ${detail}`);
  console.log(`  \u274C ${name}: ${detail}`);
}

function warn(name, detail) {
  warnings.push(`${name}: ${detail}`);
  console.log(`  \u26A0\uFE0F  ${name}: ${detail}`);
}

console.log(`Validating: ${slug}\n`);

// === HARD CHECKS ===

// 1. Top disclaimer
const topDisc = rules.disclaimers.topDisclaimer;
if (bodyLower.includes(topDisc.toLowerCase())) {
  pass('disclaimer_top');
} else {
  fail('disclaimer_top', 'Top disclaimer text not found in article body');
}

// 2. Bottom disclaimer — match core static part (allow [publishedDate] placeholder replacement)
const bottomCore = 'tax regulations change frequently. always verify current requirements at';
if (bodyLower.includes(bottomCore)) {
  pass('disclaimer_bottom');
} else {
  fail('disclaimer_bottom', 'Bottom disclaimer text not found in article body');
}

// 3. Frontmatter completeness
const requiredFields = ['title', 'description', 'publishedDate', 'author'];
const missingFields = requiredFields.filter(f => !meta[f]);
if (missingFields.length === 0) {
  pass('frontmatter');
} else {
  fail('frontmatter', `Missing: ${missingFields.join(', ')}`);
}

// 4. Word count
const minWords = rules.structuralRequirements.minWordCount;
if (wordCount >= minWords) {
  pass('word_count', `${wordCount} words`);
} else {
  fail('word_count', `${wordCount} words (minimum ${minWords})`);
}

// 5. H1 count
const h1Count = lines.filter(l => /^# [^#]/.test(l.trim())).length;
const reqH1 = rules.structuralRequirements.requiredH1Count;
if (h1Count === reqH1) {
  pass('h1_count', `${h1Count}`);
} else {
  fail('h1_count', `${h1Count} (expected ${reqH1})`);
}

// 6. CTA count
const ctaPatterns = rules.ctaPatterns.ctaLinkPatterns;
const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
let ctaCount = 0;
let matchResult;
while ((matchResult = linkRegex.exec(body)) !== null) {
  const url = matchResult[2];
  if (ctaPatterns.some(p => url.includes(p))) {
    ctaCount++;
  }
}
const minCTA = rules.structuralRequirements.minCTACount;
if (ctaCount >= minCTA) {
  pass('cta_count', `${ctaCount}`);
} else {
  fail('cta_count', `${ctaCount} (minimum ${minCTA})`);
}

// 7. Banned phrases
const foundBanned = [];
for (const phrase of rules.bannedPhrases) {
  const idx = bodyLower.indexOf(phrase.toLowerCase());
  if (idx !== -1) {
    // Find line number
    const textBefore = body.slice(0, idx);
    const lineNum = textBefore.split('\n').length;
    foundBanned.push(`"${phrase}" at line ${lineNum}`);
  }
}
if (foundBanned.length === 0) {
  pass('banned_phrases');
} else {
  fail('banned_phrases', `Found ${foundBanned.join(', ')}`);
}

// 8. Citation density
const authoritativeDomains = ['irs.gov', 'fincen.gov', 'law.cornell.edu', 'congress.gov', 'treasury.gov', 'gpo.gov'];
const authoritativeKeywords = ['USC', 'CFR', 'IRC', 'Rev. Proc.', 'Notice'];

const citationUrls = [];
// Markdown links
const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
let m;
while ((m = mdLinkRegex.exec(body)) !== null) {
  const url = m[2];
  if (authoritativeDomains.some(d => url.includes(d)) || authoritativeKeywords.some(k => url.includes(k))) {
    citationUrls.push(url);
  }
}
// Bare URLs
const bareUrlRegex = /(?<!\()(https?:\/\/[^\s)<>]+)/g;
while ((m = bareUrlRegex.exec(body)) !== null) {
  const url = m[1];
  // Skip if already captured as markdown link target
  if (citationUrls.includes(url)) continue;
  if (authoritativeDomains.some(d => url.includes(d)) || authoritativeKeywords.some(k => url.includes(k))) {
    citationUrls.push(url);
  }
}
// Also count text references to statutes
const statuteRefRegex = /\b(?:\d+\s+U\.?S\.?C\.?\s*\u00A7?\s*\d+|\d+\s+C\.?F\.?R\.?\s*\u00A7?\s*[\d.]+|IRC\s*(?:\u00A7|Section)\s*\d+|Rev\.\s*Proc\.\s*\d{4}-\d+|Notice\s*\d{4}-\d+)/gi;
while ((m = statuteRefRegex.exec(body)) !== null) {
  citationUrls.push(m[0]);
}

const citationCount = citationUrls.length;
const minCitPer500 = rules.structuralRequirements.citationDensity.minPer500Words;
const citDensity = wordCount > 0 ? (citationCount / wordCount) * 500 : 0;
const citDensityRounded = Math.round(citDensity * 10) / 10;
if (citDensity >= minCitPer500) {
  pass('citation_density', `${citDensityRounded} per 500 words`);
} else {
  fail('citation_density', `${citDensityRounded} per 500 words (minimum ${minCitPer500})`);
}

// 9. Dollar amount density
const dollarRegex = /\$[\d,]+(?:\.\d{2})?/g;
const dollarMatches = body.match(dollarRegex) || [];
const dollarCount = dollarMatches.length;
const minDollarPer500 = rules.structuralRequirements.dollarAmountDensity.minPer500Words;
const dollarDensity = wordCount > 0 ? (dollarCount / wordCount) * 500 : 0;
const dollarDensityRounded = Math.round(dollarDensity * 10) / 10;
if (dollarDensity >= minDollarPer500) {
  pass('dollar_density', `${dollarDensityRounded} per 500 words`);
} else {
  fail('dollar_density', `${dollarDensityRounded} per 500 words (minimum ${minDollarPer500})`);
}

// 10. Penalty claims need statute
const penaltyPattern = new RegExp(rules.patternChecks.penaltyClaimPattern, 'gi');
const penaltyCitations = rules.patternChecks.penaltyRequiresCitation;
let penaltyFails = [];
while ((m = penaltyPattern.exec(body)) !== null) {
  const surrounding = body.slice(m.index, m.index + m[0].length + 200);
  const hasCitation = penaltyCitations.some(c => surrounding.includes(c));
  if (!hasCitation) {
    const lineNum = body.slice(0, m.index).split('\n').length;
    penaltyFails.push(`line ${lineNum}`);
  }
}
if (penaltyFails.length === 0) {
  pass('penalty_citations');
} else {
  fail('penalty_citations', `Penalty claims without statute citation at ${penaltyFails.join(', ')}`);
}

// 11. Deadline claims need citation
const deadlinePattern = new RegExp(rules.patternChecks.deadlineClaimPattern, 'gi');
const deadlineCitations = rules.patternChecks.deadlineRequiresCitation;
let deadlineFails = [];
while ((m = deadlinePattern.exec(body)) !== null) {
  const surrounding = body.slice(m.index, m.index + m[0].length + 200);
  const hasCitation = deadlineCitations.some(c => surrounding.includes(c));
  if (!hasCitation) {
    const lineNum = body.slice(0, m.index).split('\n').length;
    deadlineFails.push(`line ${lineNum}`);
  }
}
if (deadlineFails.length === 0) {
  pass('deadline_citations');
} else {
  fail('deadline_citations', `Deadline claims without citation at ${deadlineFails.join(', ')}`);
}

// 12. Hero image exists (soft warning — add before final promotion)
if (meta.heroImage) {
  const imgPath = meta.heroImage.startsWith('/') ? meta.heroImage.slice(1) : meta.heroImage;
  const fullImgPath = path.join(D2C_ROOT, 'public', imgPath);
  if (fs.existsSync(fullImgPath)) {
    pass('hero_image');
  } else {
    warn('hero_image', `File not found: public/${imgPath} — add before final promotion`);
  }
} else {
  warn('hero_image', 'No heroImage in frontmatter — add before final promotion');
}

// 13. Published date is valid future ISO date
if (meta.publishedDate) {
  const d = new Date(meta.publishedDate);
  const today = new Date();
  if (isNaN(d.getTime())) {
    fail('published_date', `Invalid date: ${meta.publishedDate}`);
  } else if (d > today) {
    pass('published_date', meta.publishedDate);
  } else {
    fail('published_date', `${meta.publishedDate} is not a future date (must be after 2026-03-01)`);
  }
} else {
  fail('published_date', 'No publishedDate in frontmatter');
}

// === SOFT WARNINGS ===

// Readability: average sentence length
const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0);
if (sentences.length > 0) {
  const avgSentenceLen = wordCount / sentences.length;
  if (avgSentenceLen > 25) {
    warn('readability', `Average sentence length ${Math.round(avgSentenceLen)} words (recommend <= 25)`);
  }
}

// Crosslinks
const crosslinkRegex = /\[([^\]]*)\]\(\/blog\/[^)]+\)/g;
let crosslinkCount = 0;
while (crosslinkRegex.exec(body) !== null) crosslinkCount++;
const minCrosslinks = rules.structuralRequirements.minCrosslinkCountWarning;
if (crosslinkCount < minCrosslinks) {
  warn('crosslink_count', `${crosslinkCount} (recommend >= ${minCrosslinks})`);
}

// Length warning
const maxWords = rules.structuralRequirements.maxWordCountWarning;
if (wordCount > maxWords) {
  warn('word_count_high', `${wordCount} words (recommend <= ${maxWords})`);
}

// === RESULT ===
const passed = failedChecks.length === 0;

console.log('');
console.log(`RESULT: ${passed ? 'PASSED' : `FAILED - ${failedChecks.length} check(s) failed`}`);

const report = {
  slug,
  validatedAt: new Date().toISOString(),
  passed,
  checks,
  warnings,
  failedChecks,
  citationUrls: [...new Set(citationUrls)]
};

const reportPath = path.join(D2C_ROOT, 'src/content/drafts', `${slug}.validation.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Report saved to: src/content/drafts/${slug}.validation.json`);

process.exit(passed ? 0 : 1);
