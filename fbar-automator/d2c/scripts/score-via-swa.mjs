#!/usr/bin/env node
// score-via-swa.mjs
// SWA (Semrush Writing Assistant) scoring automation helper.
// Used alongside Chrome DevTools MCP for browser interaction.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D2C_ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(D2C_ROOT, 'src/content/content-queue.json');
const DRAFTS_DIR = path.join(D2C_ROOT, 'src/content/drafts');
const BASE_URL = 'https://fbardirect.com/blog';
const PASS_THRESHOLD = 9.0;
const MAX_ATTEMPTS = 3;

// --- CLI parsing ---
const args = process.argv.slice(2);

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function getMultiArg(name) {
  const values = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === `--${name}` && i + 1 < args.length) {
      i++;
      values.push(args[i]);
    }
    i++;
  }
  return values;
}

// --- Helpers ---
function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`\u274C content-queue.json not found at ${QUEUE_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
}

function scoreFilePath(slug) {
  return path.join(DRAFTS_DIR, `${slug}.swa-score.json`);
}

function attemptFilePath(slug, attempt) {
  return path.join(DRAFTS_DIR, `${slug}.swa-score.attempt-${attempt}.json`);
}

// === MODE: --list ===
function handleList() {
  const queue = loadQueue();
  const published = queue.topics.filter(t => t.status === 'published');

  if (published.length === 0) {
    console.log('No published articles found in content-queue.json');
    return;
  }

  console.log('=== SWA Scoring Status ===\n');
  console.log(
    'Slug'.padEnd(50) +
    'Keyword'.padEnd(35) +
    'Score'.padEnd(10) +
    'Action'
  );
  console.log('-'.repeat(110));

  let needScoring = 0;
  let needRevision = 0;
  let passing = 0;

  for (const topic of published) {
    const hasScoreField = topic.swaScore != null;
    const hasScoreFile = fs.existsSync(scoreFilePath(topic.slug));
    let score = null;
    let action = '';

    if (hasScoreFile) {
      const data = JSON.parse(fs.readFileSync(scoreFilePath(topic.slug), 'utf-8'));
      score = data.overall;
    } else if (hasScoreField) {
      score = topic.swaScore;
    }

    if (score == null) {
      action = '\u274C  NEEDS SCORING';
      needScoring++;
    } else if (score >= PASS_THRESHOLD) {
      action = '\u2705 PASS';
      passing++;
    } else {
      let attempt = 1;
      if (hasScoreFile) {
        const data = JSON.parse(fs.readFileSync(scoreFilePath(topic.slug), 'utf-8'));
        attempt = data.attempt || 1;
      }
      if (attempt >= MAX_ATTEMPTS) {
        action = `\u274C  MANUAL REVIEW (attempt ${attempt}/${MAX_ATTEMPTS})`;
      } else {
        action = `\u26A0\uFE0F  NEEDS REVISION (attempt ${attempt}/${MAX_ATTEMPTS})`;
      }
      needRevision++;
    }

    const scoreStr = score != null ? `${score}/10` : 'unscored';
    console.log(
      topic.slug.padEnd(50) +
      (topic.keyword || '').padEnd(35) +
      scoreStr.padEnd(10) +
      action
    );
  }

  console.log('-'.repeat(110));
  console.log(`\nSummary: ${passing} passing, ${needScoring} unscored, ${needRevision} need revision (${published.length} total)`);
}

// === MODE: --save ===
function handleSave() {
  const slug = getArg('slug');
  const keyword = getArg('keyword');
  const overall = parseFloat(getArg('overall'));
  const readability = parseFloat(getArg('readability'));
  const seo = parseFloat(getArg('seo'));
  const tone = parseFloat(getArg('tone'));
  const originality = parseFloat(getArg('originality'));
  const recommendations = getMultiArg('recommendations');

  // Validate required args
  const missing = [];
  if (!slug) missing.push('--slug');
  if (!keyword) missing.push('--keyword');
  if (isNaN(overall)) missing.push('--overall');
  if (isNaN(readability)) missing.push('--readability');
  if (isNaN(seo)) missing.push('--seo');
  if (isNaN(tone)) missing.push('--tone');
  if (isNaN(originality)) missing.push('--originality');

  if (missing.length > 0) {
    console.error(`\u274C Missing required arguments: ${missing.join(', ')}`);
    console.error('\nUsage: node scripts/score-via-swa.mjs --save \\');
    console.error('  --slug <slug> --keyword "<keyword>" \\');
    console.error('  --overall <n> --readability <n> --seo <n> --tone <n> --originality <n> \\');
    console.error('  [--recommendations "rec 1" --recommendations "rec 2"]');
    process.exit(1);
  }

  // Determine attempt number
  let attempt = 1;
  const existingPath = scoreFilePath(slug);
  if (fs.existsSync(existingPath)) {
    const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
    attempt = (existing.attempt || 1) + 1;
    // Archive the old score file
    const archivePath = attemptFilePath(slug, existing.attempt || 1);
    fs.renameSync(existingPath, archivePath);
    console.log(`  Archived previous score to: ${path.basename(archivePath)}`);
  }

  // Build score object
  const score = {
    slug,
    url: `${BASE_URL}/${slug}`,
    keyword,
    scoredAt: new Date().toISOString(),
    overall,
    readability,
    seo,
    tone,
    originality,
    attempt,
    recommendations: recommendations.length > 0 ? recommendations : []
  };

  // Save score file
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
  fs.writeFileSync(existingPath, JSON.stringify(score, null, 2));
  console.log(`  Score saved to: src/content/drafts/${slug}.swa-score.json`);

  // Update content-queue.json
  const queue = loadQueue();
  const topic = queue.topics.find(t => t.slug === slug);
  if (topic) {
    topic.swaScore = overall;
    topic.swaScoredAt = score.scoredAt;
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
    console.log(`  Queue updated: swaScore=${overall}, swaScoredAt=${score.scoredAt}`);
  } else {
    console.log(`  \u26A0\uFE0F  Slug "${slug}" not found in content-queue.json (score file saved anyway)`);
  }

  // Print result
  console.log('');
  if (overall >= PASS_THRESHOLD) {
    console.log(`\u2705 PASS (${overall}/10)`);
  } else if (attempt >= MAX_ATTEMPTS) {
    console.log(`\u274C MANUAL REVIEW NEEDED (${overall}/10) \u2014 ${attempt} attempts exhausted`);
  } else {
    console.log(`\u26A0\uFE0F  NEEDS REVISION (${overall}/10) \u2014 attempt ${attempt} of ${MAX_ATTEMPTS}`);
  }

  if (recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of recommendations) {
      console.log(`  - ${rec}`);
    }
  }
}

// === MODE: --playbook ===
function handlePlaybook() {
  const slug = getArg('slug');
  const keyword = getArg('keyword');

  if (!slug || !keyword) {
    console.error('\u274C --playbook requires --slug and --keyword');
    console.error('Usage: node scripts/score-via-swa.mjs --playbook --slug <slug> --keyword "<keyword>"');
    process.exit(1);
  }

  const url = `${BASE_URL}/${slug}`;

  console.log(`=== SWA Scoring Playbook ===

Article: ${slug}
URL: ${url}
Keyword: ${keyword}

Steps (execute via Chrome DevTools MCP):

1. Navigate to SWA checker:
   navigate_page({ url: 'https://www.semrush.com/swa/checker' })

2. Take snapshot to find the keyword input:
   take_snapshot()
   -> Find the keyword/keyphrase input field UID

3. Enter the target keyword:
   fill({ uid: '<keyword_input_uid>', value: '${keyword}' })

4. Look for "Import text from web" or "Import from URL" button:
   take_snapshot()
   -> Find the import button UID

5. Click the import button:
   click({ uid: '<import_button_uid>' })

6. Enter the article URL:
   fill({ uid: '<url_input_uid>', value: '${url}' })

7. Click submit/import:
   click({ uid: '<submit_uid>' })

8. Wait for scoring to complete:
   wait_for({ text: '/10' })

9. Take snapshot and extract scores:
   take_snapshot()
   -> Parse: Overall, Readability, SEO, Tone, Originality scores

10. Save the score:
    node scripts/score-via-swa.mjs --save \\
      --slug ${slug} \\
      --keyword "${keyword}" \\
      --overall <X> --readability <X> --seo <X> --tone <X> --originality <X> \\
      --recommendations "rec 1" --recommendations "rec 2"
`);
}

// === MAIN ===
if (getFlag('list')) {
  handleList();
} else if (getFlag('save')) {
  handleSave();
} else if (getFlag('playbook')) {
  handlePlaybook();
} else {
  console.error('Usage: node scripts/score-via-swa.mjs <mode>\n');
  console.error('Modes:');
  console.error('  --list                        List articles needing SWA scoring');
  console.error('  --save --slug <s> ...         Save a score result');
  console.error('  --playbook --slug <s> ...     Show Chrome DevTools automation steps');
  console.error('\nExamples:');
  console.error('  node scripts/score-via-swa.mjs --list');
  console.error('  node scripts/score-via-swa.mjs --save --slug my-article --keyword "target keyword" --overall 8.2 --readability 7.8 --seo 8.5 --tone 9.1 --originality 7.4');
  console.error('  node scripts/score-via-swa.mjs --playbook --slug my-article --keyword "target keyword"');
  process.exit(1);
}
