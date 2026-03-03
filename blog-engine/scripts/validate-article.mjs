#!/usr/bin/env node
// validate-article.mjs
// Validates blog article drafts against anti-slop-rules.json + niche config.
// Generalized from the FBAR D2C validator — works for any niche.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, '..');

// --- CLI ---
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const configFlag = args.indexOf('--config');
const configArg = configFlag !== -1 ? args[configFlag + 1] : null;

if (!slug) {
  console.error('Usage: node scripts/validate-article.mjs <slug> [--config <config-path>]');
  console.error('  Reads from:  output/<slug>/article.mdx');
  console.error('  Outputs to:  output/<slug>/article.validation.json');
  console.error('');
  console.error('Options:');
  console.error('  --config <path>  Path to niche config JSON (defaults to first .json in configs/)');
  process.exit(1);
}

// --- Load universal anti-slop rules ---
const rulesPath = path.join(ENGINE_ROOT, 'anti-slop-rules.json');
if (!fs.existsSync(rulesPath)) {
  console.error(`ERROR: anti-slop-rules.json not found at ${rulesPath}`);
  process.exit(1);
}
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

// --- Load niche config ---
function findConfig() {
  if (configArg) {
    const p = path.isAbsolute(configArg) ? configArg : path.resolve(configArg);
    if (!fs.existsSync(p)) {
      console.error(`ERROR: Config not found at ${p}`);
      process.exit(1);
    }
    return p;
  }
  // Default: first non-template .json in configs/
  const configsDir = path.join(ENGINE_ROOT, 'configs');
  const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  if (files.length === 0) {
    console.error('ERROR: No config files found in configs/. Create one or use --config flag.');
    process.exit(1);
  }
  if (files.length > 1) {
    console.error(`WARNING: Multiple configs found: ${files.join(', ')}. Using ${files[0]}. Specify with --config.`);
  }
  return path.join(configsDir, files[0]);
}

const configPath = findConfig();
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(`Config: ${path.relative(ENGINE_ROOT, configPath)}`);

// --- Load MDX ---
const articleDir = path.join(ENGINE_ROOT, 'output', slug);
const draftPath = path.join(articleDir, 'article.mdx');
if (!fs.existsSync(draftPath)) {
  console.error(`ERROR: Article not found at ${draftPath}`);
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

console.log(`\nValidating: ${slug}\n`);

// ============================================================
// UNIVERSAL CHECKS (always run)
// ============================================================

// 1. Frontmatter completeness
const requiredFields = ['title', 'description', 'publishedDate', 'author', 'heroImage'];
const missingFields = requiredFields.filter(f => !meta[f]);
if (missingFields.length === 0) {
  pass('frontmatter');
} else {
  fail('frontmatter', `Missing: ${missingFields.join(', ')}`);
}

// 2. Word count
const minWords = rules.structuralRequirements.minWordCount;
if (wordCount >= minWords) {
  pass('word_count', `${wordCount} words`);
} else {
  fail('word_count', `${wordCount} words (minimum ${minWords})`);
}

// 3. H1 count
const h1Count = lines.filter(l => /^# [^#]/.test(l.trim())).length;
const reqH1 = rules.structuralRequirements.requiredH1Count;
if (h1Count === reqH1) {
  pass('h1_count', `${h1Count}`);
} else {
  fail('h1_count', `${h1Count} (expected ${reqH1})`);
}

// 4. Banned phrases (from anti-slop-rules.json)
const foundBanned = [];
for (const phrase of rules.bannedPhrases) {
  const idx = bodyLower.indexOf(phrase.toLowerCase());
  if (idx !== -1) {
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

// 5. Published date is valid future ISO date
if (meta.publishedDate) {
  const d = new Date(meta.publishedDate);
  const today = new Date();
  if (isNaN(d.getTime())) {
    fail('published_date', `Invalid date: ${meta.publishedDate}`);
  } else if (d > today) {
    pass('published_date', meta.publishedDate);
  } else {
    fail('published_date', `${meta.publishedDate} is not a future date`);
  }
} else {
  fail('published_date', 'No publishedDate in frontmatter');
}

// ============================================================
// CONFIG-DRIVEN CHECKS (only run if config enables them)
// ============================================================

// 6. Disclaimers (config.validation.requireDisclaimers)
if (config.validation.requireDisclaimers) {
  // Top disclaimer
  const topDisc = config.content.disclaimerTop;
  if (topDisc) {
    if (bodyLower.includes(topDisc.toLowerCase())) {
      pass('disclaimer_top');
    } else {
      fail('disclaimer_top', 'Top disclaimer text not found in article body');
    }
  } else {
    warn('disclaimer_top', 'requireDisclaimers is true but no disclaimerTop text in config');
  }

  // Bottom disclaimer — match core phrase to allow variation in links/dates
  const bottomDisc = config.content.disclaimerBottom;
  if (bottomDisc) {
    // Extract a stable substring (first sentence-like chunk before any markdown link)
    const bottomCore = bottomDisc.toLowerCase().split('[')[0].trim().replace(/\.$/, '');
    if (bodyLower.includes(bottomCore)) {
      pass('disclaimer_bottom');
    } else {
      fail('disclaimer_bottom', 'Bottom disclaimer text not found in article body');
    }
  } else {
    warn('disclaimer_bottom', 'requireDisclaimers is true but no disclaimerBottom text in config');
  }
} else {
  console.log('  -- disclaimer checks skipped (not required by config)');
}

// 7. CTA count (config.validation.requireCTAs)
if (config.validation.requireCTAs) {
  const ctaPatterns = config.content.ctaPatterns || [];
  if (ctaPatterns.length > 0) {
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let ctaCount = 0;
    let matchResult;
    while ((matchResult = linkRegex.exec(body)) !== null) {
      const url = matchResult[2];
      if (ctaPatterns.some(p => url.includes(p))) {
        ctaCount++;
      }
    }
    if (ctaCount >= 2) {
      pass('cta_count', `${ctaCount}`);
    } else {
      fail('cta_count', `${ctaCount} (minimum 2)`);
    }
  } else {
    warn('cta_count', 'requireCTAs is true but no ctaPatterns in config');
  }
} else {
  console.log('  -- CTA checks skipped (not required by config)');
}

// 8. Dollar amount density (config.validation.requireDollarAmounts)
if (config.validation.requireDollarAmounts) {
  const dollarRegex = /\$[\d,]+(?:\.\d{2})?/g;
  const dollarMatches = body.match(dollarRegex) || [];
  const dollarCount = dollarMatches.length;
  const minDollarPer500 = config.validation.dollarAmountDensity?.minPer500Words || 0;
  const dollarDensity = wordCount > 0 ? (dollarCount / wordCount) * 500 : 0;
  const dollarDensityRounded = Math.round(dollarDensity * 10) / 10;
  if (dollarDensity >= minDollarPer500) {
    pass('dollar_density', `${dollarDensityRounded} per 500 words`);
  } else {
    fail('dollar_density', `${dollarDensityRounded} per 500 words (minimum ${minDollarPer500})`);
  }
} else {
  console.log('  -- dollar density checks skipped (not required by config)');
}

// 9. Statute citations (config.validation.requireStatuteCitations)
if (config.validation.requireStatuteCitations) {
  const authorityDomains = config.research.authorityDomains || [];
  const authorityKeywords = ['USC', 'CFR', 'IRC', 'Rev. Proc.', 'Notice'];

  const citationUrls = [];
  // Markdown links
  const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let m;
  while ((m = mdLinkRegex.exec(body)) !== null) {
    const url = m[2];
    if (authorityDomains.some(d => url.includes(d)) || authorityKeywords.some(k => url.includes(k))) {
      citationUrls.push(url);
    }
  }
  // Bare URLs
  const bareUrlRegex = /(?<!\()(https?:\/\/[^\s)<>]+)/g;
  while ((m = bareUrlRegex.exec(body)) !== null) {
    const url = m[1];
    if (citationUrls.includes(url)) continue;
    if (authorityDomains.some(d => url.includes(d)) || authorityKeywords.some(k => url.includes(k))) {
      citationUrls.push(url);
    }
  }
  // Text references to statutes
  const statuteRefRegex = /\b(?:\d+\s+U\.?S\.?C\.?\s*\u00A7?\s*\d+|\d+\s+C\.?F\.?R\.?\s*\u00A7?\s*[\d.]+|IRC\s*(?:\u00A7|Section)\s*\d+|Rev\.\s*Proc\.\s*\d{4}-\d+|Notice\s*\d{4}-\d+)/gi;
  while ((m = statuteRefRegex.exec(body)) !== null) {
    citationUrls.push(m[0]);
  }

  const citationCount = citationUrls.length;
  const minCitPer500 = config.validation.citationDensity?.minPer500Words || 0;
  const citDensity = wordCount > 0 ? (citationCount / wordCount) * 500 : 0;
  const citDensityRounded = Math.round(citDensity * 10) / 10;
  if (citDensity >= minCitPer500) {
    pass('citation_density', `${citDensityRounded} per 500 words`);
  } else {
    fail('citation_density', `${citDensityRounded} per 500 words (minimum ${minCitPer500})`);
  }

  // Penalty claims need statute (only if pattern is configured)
  const penaltyPattern = config.validation.penaltyClaimPattern;
  if (penaltyPattern) {
    const penaltyRegex = new RegExp(penaltyPattern, 'gi');
    const penaltyCitations = ['USC', 'CFR', 'IRC', 'U.S.C.', 'C.F.R.'];
    const penaltyFails = [];
    while ((m = penaltyRegex.exec(body)) !== null) {
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
  }

  // Deadline claims need citation (only if pattern is configured)
  const deadlinePattern = config.validation.deadlineClaimPattern;
  if (deadlinePattern) {
    const deadlineRegex = new RegExp(deadlinePattern, 'gi');
    const deadlineCitations = ['CFR', 'IRS', 'Notice', 'Rev. Proc.', 'IRC'];
    const deadlineFails = [];
    while ((m = deadlineRegex.exec(body)) !== null) {
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
  }
} else {
  console.log('  -- statute citation checks skipped (not required by config)');
}

// ============================================================
// SOFT WARNINGS (always run)
// ============================================================

// Hero image in frontmatter
if (meta.heroImage) {
  const imgPath = path.join(articleDir, 'hero.webp');
  if (fs.existsSync(imgPath)) {
    pass('hero_image');
  } else {
    warn('hero_image', `File not found: output/${slug}/hero.webp — generate before publishing`);
  }
} else {
  warn('hero_image', 'No heroImage in frontmatter — add before publishing');
}

// Readability: average sentence length
const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0);
if (sentences.length > 0) {
  const avgSentenceLen = wordCount / sentences.length;
  if (avgSentenceLen > 25) {
    warn('readability', `Average sentence length ${Math.round(avgSentenceLen)} words (recommend <= 25)`);
  }
}

// Length warning
const maxWords = rules.structuralRequirements.maxWordCountWarning;
if (wordCount > maxWords) {
  warn('word_count_high', `${wordCount} words (recommend <= ${maxWords})`);
}

// ============================================================
// RESULT
// ============================================================
const passed = failedChecks.length === 0;

console.log('');
console.log(`RESULT: ${passed ? 'PASSED' : `FAILED - ${failedChecks.length} check(s) failed`}`);

const report = {
  slug,
  config: path.relative(ENGINE_ROOT, configPath),
  validatedAt: new Date().toISOString(),
  passed,
  checks,
  warnings,
  failedChecks,
};

// Ensure output dir exists
if (!fs.existsSync(articleDir)) {
  fs.mkdirSync(articleDir, { recursive: true });
}

const reportPath = path.join(articleDir, 'article.validation.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Report saved to: output/${slug}/article.validation.json`);

process.exit(passed ? 0 : 1);
