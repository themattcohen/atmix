#!/usr/bin/env node

// Load .env before any other imports (config.mjs reads env vars at top level)
import 'dotenv/config';

/**
 * index.mjs — CLI entry point for the DIY SEO/AEO content scorer.
 *
 * Usage:
 *   node scripts/seo-scorer/index.mjs score <slug> [options]
 *   node scripts/seo-scorer/index.mjs batch [options]
 *   node scripts/seo-scorer/index.mjs list
 *   node scripts/seo-scorer/index.mjs extract <keyword> [options]
 *   node scripts/seo-scorer/index.mjs validate-nlp <slug>
 *   node scripts/seo-scorer/index.mjs gsc <slug> [options]
 *   node scripts/seo-scorer/index.mjs gsc-batch [options]
 *
 * Run with --help for full option documentation.
 */

import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadArticle } from './fetchers/article.mjs';
import { fetchSerpData } from './fetchers/serp.mjs';
import { calculateOverall } from './scorers/weighted.mjs';
import {
  printConsoleReport,
  generateJsonReport,
  saveReport,
} from './scorers/report.mjs';
import {
  PASS_THRESHOLD,
  QUEUE_PATH,
  BLOG_DIR,
  DRAFTS_DIR,
  DIMENSION_WEIGHTS,
  NLP_CACHE_DIR,
  SITE_URL,
  GSC_SITE_URL,
} from './utils/config.mjs';

// NLP stemming for term comparison
import natural from 'natural';

// Phase 2: NLP extraction pipeline
import { scrapeCompetitorTexts } from './fetchers/competitor-text.mjs';
import { expandCorpus } from './fetchers/keyword-expand.mjs';
import { extractNlpTerms } from './analyzers/nlp-extract.mjs';

// Phase 3: GSC feedback loop
import { fetchGscQueries } from './fetchers/gsc.mjs';
import { matchQueriesToTerms, computeCoverage } from './utils/gsc-matcher.mjs';
import { analyzeCtrGaps } from './utils/ctr-gap.mjs';
import { saveSnapshot, getLatestSnapshot, getRankingTrends } from './utils/gsc-store.mjs';

// ---------------------------------------------------------------------------
// Analyzer imports
// ---------------------------------------------------------------------------

import { analyze as analyzeReadability } from './analyzers/readability.mjs';
import { analyze as analyzeWritingQuality } from './analyzers/writing-quality.mjs';
import { analyze as analyzeStructure } from './analyzers/structure.mjs';
import { analyze as analyzeKeywordCoverage } from './analyzers/keyword-coverage.mjs';
import { analyze as analyzeSchemaMarkup } from './analyzers/schema-markup.mjs';
import { analyze as analyzeAeoSignals } from './analyzers/aeo-signals.mjs';
import { analyze as analyzeLlmQuality } from './analyzers/llm-quality.mjs';
import { analyze as analyzeNlpCoverage } from './analyzers/nlp-coverage.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the list of analyzer functions to run, respecting --no-llm.
 *
 * @param {object} opts  CLI options.
 * @returns {Array<{ name: string, fn: Function }>}
 */
function getAnalyzers(opts) {
  const analyzers = [
    { name: 'readability', fn: analyzeReadability },
    { name: 'writingQuality', fn: analyzeWritingQuality },
    { name: 'structure', fn: analyzeStructure },
    { name: 'keywordCoverage', fn: analyzeKeywordCoverage },
    { name: 'schemaMarkup', fn: analyzeSchemaMarkup },
    { name: 'aeoSignals', fn: analyzeAeoSignals },
  ];

  if (opts.llm !== false) {
    analyzers.push({ name: 'llmQuality', fn: analyzeLlmQuality });
  }

  if (opts.nlp !== false) {
    analyzers.push({ name: 'nlpCoverage', fn: analyzeNlpCoverage });
  }

  return analyzers;
}

/**
 * Run all applicable analyzers on an article.
 *
 * @param {object} article  Loaded article object.
 * @param {object} opts     CLI options.
 * @returns {Promise<Array<{ dimension: string, score: number, weight: number, details: object, issues: string[] }>>}
 */
async function runAnalyzers(article, opts) {
  const analyzers = getAnalyzers(opts);
  let serpData = null;
  if (opts.serp !== false) {
    try {
      serpData = await fetchSerpData(article.keyword);
    } catch (err) {
      console.error(`  Warning: SERP fetch failed (${err.message}). Continuing without SERP data.`);
    }
  }

  const results = await Promise.all(
    analyzers.map(async ({ fn }) => {
      try {
        return await fn(article, { serpData, surferTargets: article.surferTargets });
      } catch (err) {
        // If an individual analyzer fails, return a zero-score placeholder
        // so scoring can still proceed with available dimensions.
        console.error(
          `  Warning: analyzer failed (${err.message}). Skipping dimension.`,
        );
        return null;
      }
    }),
  );

  // Filter out null results from failed analyzers
  return results.filter(Boolean);
}

/**
 * Score a single article end-to-end.
 *
 * @param {string} slug
 * @param {object} opts  CLI options (published, keyword, llm, serp, json, save).
 * @returns {Promise<{ result: object, report: object }>}
 */
async function scoreArticle(slug, opts) {
  // 1. Load article
  const article = await loadArticle(slug, {
    published: Boolean(opts.published),
    keywordOverride: opts.keyword || null,
  });

  // 2. Run analyzers in parallel
  const analyzerResults = await runAnalyzers(article, opts);

  // 3. Calculate weighted overall
  const result = calculateOverall(analyzerResults);

  // 4. Generate JSON report
  const report = generateJsonReport(
    slug,
    article.keyword,
    article,
    result,
    analyzerResults,
  );

  // 5. Console output
  if (!opts.json) {
    printConsoleReport(slug, article.keyword, result, analyzerResults);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  // 6. Save report if requested
  if (opts.save) {
    await saveReport(slug, report, { published: Boolean(opts.published) });
  }

  return { result, report };
}

/**
 * Read the content queue manifest.
 *
 * @returns {Promise<Array<object>>}
 */
async function readContentQueue() {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf-8');
    const queue = JSON.parse(raw);
    return queue.topics || [];
  } catch (err) {
    console.error(`Error reading content queue: ${err.message}`);
    return [];
  }
}

/**
 * Check whether a .diy-score.json file exists for a slug.
 *
 * @param {string} slug
 * @returns {Promise<{ exists: boolean, score: number|null, dir: string|null }>}
 */
async function checkScoreFile(slug) {
  for (const dir of [BLOG_DIR, DRAFTS_DIR]) {
    const scorePath = path.join(dir, `${slug}.diy-score.json`);
    try {
      const raw = await fs.readFile(scorePath, 'utf-8');
      const data = JSON.parse(raw);
      return { exists: true, score: data.overall ?? null, dir };
    } catch {
      // not found in this dir
    }
  }
  return { exists: false, score: null, dir: null };
}

// ---------------------------------------------------------------------------
// CLI: score command
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('seo-scorer')
  .description('DIY SEO/AEO content scorer for FBAR Direct blog articles')
  .version('2.0.0');

program
  .command('score <slug>')
  .description('Score a single article')
  .option('--published', 'Read from published blog directory', false)
  .option('--keyword <kw>', 'Override the target keyword')
  .option('--no-llm', 'Skip LLM quality dimension (faster, cheaper)')
  .option('--no-nlp', 'Skip NLP coverage dimension (ignore Surfer targets)')
  .option('--no-serp', 'Skip SERP data fetching')
  .option('--json', 'Output JSON only (no console report)', false)
  .option('--save', 'Save report to disk alongside the article', false)
  .action(async (slug, opts) => {
    try {
      const { result } = await scoreArticle(slug, opts);
      process.exit(result.pass ? 0 : 1);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: batch command
// ---------------------------------------------------------------------------

program
  .command('batch')
  .description(
    'Score all published articles that do not have a DIY score yet',
  )
  .option('--no-llm', 'Skip LLM quality dimension')
  .option('--no-nlp', 'Skip NLP coverage dimension')
  .option('--no-serp', 'Skip SERP data fetching')
  .option('--save', 'Save reports to disk', false)
  .action(async (opts) => {
    try {
      const topics = await readContentQueue();
      const published = topics.filter((t) => t.status === 'published');

      if (published.length === 0) {
        console.log('No published articles found in content queue.');
        process.exit(0);
      }

      // Filter to articles without existing score files
      const toScore = [];
      for (const topic of published) {
        const { exists } = await checkScoreFile(topic.slug);
        if (!exists) {
          toScore.push(topic);
        }
      }

      if (toScore.length === 0) {
        console.log('All published articles already have DIY scores.');
        process.exit(0);
      }

      console.log(
        `\nScoring ${toScore.length} article(s) without DIY scores...\n`,
      );

      const summaryRows = [];
      let passCount = 0;
      let failCount = 0;

      // Score sequentially to avoid API rate limits
      for (const topic of toScore) {
        try {
          const { result, report } = await scoreArticle(topic.slug, {
            ...opts,
            published: true,
            keyword: null,
            json: false,
          });

          summaryRows.push({
            slug: topic.slug,
            score: result.overall,
            pass: result.pass,
          });

          if (result.pass) {
            passCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`  Skipping ${topic.slug}: ${err.message}`);
          summaryRows.push({
            slug: topic.slug,
            score: null,
            pass: false,
          });
          failCount++;
        }
      }

      // Print summary table
      console.log('\n=== Batch Summary ===\n');
      console.log(
        `${'Slug'.padEnd(50)} ${'Score'.padStart(7)} ${'Status'.padStart(8)}`,
      );
      console.log(''.padEnd(67, '\u2500'));

      for (const row of summaryRows) {
        const scoreStr =
          row.score != null ? `${row.score.toFixed(1)}/10` : 'ERROR';
        const statusStr = row.score == null
          ? '\u274C ERROR'
          : row.pass
            ? '\u2705 PASS'
            : '\u26A0\uFE0F FAIL';
        console.log(
          `${row.slug.padEnd(50)} ${scoreStr.padStart(7)} ${statusStr.padStart(8)}`,
        );
      }

      console.log(''.padEnd(67, '\u2500'));
      console.log(
        `Total: ${summaryRows.length} | Pass: ${passCount} | Fail: ${failCount}\n`,
      );

      // Exit 1 if any article failed
      process.exit(failCount > 0 ? 1 : 0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: revise command
// ---------------------------------------------------------------------------

program
  .command('revise <slug>')
  .description(
    'Generate a prioritized revision checklist from the latest DIY score',
  )
  .option('--published', 'Look in published blog directory', false)
  .action(async (slug, opts) => {
    try {
      // 1. Find the latest score file
      const dirs = opts.published ? [BLOG_DIR] : [BLOG_DIR, DRAFTS_DIR];
      let scoreData = null;
      let scorePath = null;

      for (const dir of dirs) {
        const candidate = path.join(dir, `${slug}.diy-score.json`);
        try {
          const raw = await fs.readFile(candidate, 'utf-8');
          scoreData = JSON.parse(raw);
          scorePath = candidate;
          break;
        } catch {
          // not found in this dir
        }
      }

      if (!scoreData) {
        console.error(
          `\nNo DIY score found for "${slug}". Run \`score ${slug} --save\` first.\n`,
        );
        process.exit(2);
      }

      console.log('');
      console.log(`=== Revision Checklist: ${slug} ===`);
      console.log(`  Current score: ${scoreData.overall.toFixed(1)}/10`);
      console.log(`  Target: >=${PASS_THRESHOLD.toFixed(1)}`);
      console.log(`  Source: ${scorePath}`);
      console.log('');

      if (scoreData.overall >= PASS_THRESHOLD) {
        console.log('  This article already meets the target score. No revisions needed.');
        console.log('');
        process.exit(0);
      }

      // 2. Sort dimensions by weighted gap: (10 - score) * weight
      const dims = scoreData.dimensions || {};
      const ranked = Object.entries(dims)
        .map(([dim, data]) => {
          const weight = DIMENSION_WEIGHTS[dim] ?? data.weight ?? 0;
          const gap = 10 - (data.score ?? 0);
          const weightedGap = gap * weight;
          return { dim, score: data.score ?? 0, weight, gap, weightedGap, issues: data.issues || [] };
        })
        .sort((a, b) => b.weightedGap - a.weightedGap);

      // 3. Print prioritized checklist
      const DISPLAY_NAMES = {
        readability: 'Readability',
        writingQuality: 'Writing Quality',
        structure: 'Structure',
        keywordCoverage: 'Keyword Coverage',
        schemaMarkup: 'Schema Markup',
        aeoSignals: 'AEO Signals',
        llmQuality: 'LLM Quality',
        nlpCoverage: 'NLP Coverage',
      };

      let itemNum = 0;
      for (const r of ranked) {
        if (r.issues.length === 0 && r.gap <= 1) continue; // skip near-perfect dimensions

        const label = DISPLAY_NAMES[r.dim] || r.dim;
        const potentialGain = (r.gap * r.weight).toFixed(2);

        console.log(
          `  [${label}] ${r.score.toFixed(1)}/10 (weight ${(r.weight * 100).toFixed(0)}%) — up to +${potentialGain} pts recoverable`,
        );

        if (r.issues.length > 0) {
          for (const issue of r.issues) {
            itemNum++;
            console.log(`    ${itemNum}. ${issue}`);
          }
        } else {
          itemNum++;
          console.log(`    ${itemNum}. Score is ${r.score.toFixed(1)} — review dimension details in .diy-score.json`);
        }
        console.log('');
      }

      // 4. Summary
      const totalRecoverable = ranked.reduce((sum, r) => sum + r.weightedGap, 0);
      const neededGain = PASS_THRESHOLD - scoreData.overall;
      console.log(`  Points needed: +${neededGain.toFixed(1)} (total recoverable: +${totalRecoverable.toFixed(1)})`);
      console.log('');
      console.log('  Workflow:');
      console.log('    1. Edit src/content/drafts/' + slug + '.mdx (or blog/ if published)');
      console.log('    2. Re-validate: node scripts/validate-article.mjs ' + slug);
      console.log('    3. Re-score:   node scripts/seo-scorer/index.mjs score ' + slug + ' --save');
      console.log('    4. Repeat until >=' + PASS_THRESHOLD.toFixed(1) + ' or 3 attempts exhausted');
      console.log('');

      process.exit(0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: list command
// ---------------------------------------------------------------------------

program
  .command('list')
  .description('List all articles and their scoring status')
  .action(async () => {
    try {
      const topics = await readContentQueue();

      if (topics.length === 0) {
        console.log('No articles found in content queue.');
        process.exit(0);
      }

      console.log('\n=== Article Scoring Status ===\n');
      console.log(
        `${'Slug'.padEnd(50)} ${'Status'.padEnd(12)} ${'DIY'.padStart(7)} ${'Keyword'.padEnd(0)}`,
      );
      console.log(''.padEnd(95, '\u2500'));

      for (const topic of topics) {
        const { exists, score } = await checkScoreFile(topic.slug);

        const statusStr = topic.status.padEnd(12);
        const diyStr = exists
          ? `${score != null ? score.toFixed(1) : '?'}/10`
          : '  --  ';
        const kwStr = topic.keyword || '';

        console.log(
          `${topic.slug.padEnd(50)} ${statusStr} ${diyStr.padStart(7)} ${kwStr}`,
        );
      }

      console.log(''.padEnd(95, '\u2500'));

      // Summary counts
      const total = topics.length;
      const publishedCount = topics.filter(
        (t) => t.status === 'published',
      ).length;
      const pendingCount = topics.filter((t) => t.status === 'pending').length;

      console.log(
        `\nTotal: ${total} | Published: ${publishedCount} | Pending: ${pendingCount}\n`,
      );

      process.exit(0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: extract command (Phase 2 — NLP term extraction)
// ---------------------------------------------------------------------------

/**
 * Convert a keyword string to a filesystem-safe slug.
 *
 * @param {string} keyword
 * @returns {string}
 */
function keywordToSlug(keyword) {
  return keyword
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

program
  .command('extract <keyword>')
  .description('Extract NLP terms from SERP competitor analysis (replaces SurferSEO)')
  .option('--slug <slug>', 'Save output as <slug>.surfer-targets.json')
  .option('--num <n>', 'Number of SERP results to analyze', '10')
  .option('--no-expand', 'Skip query expansion (only use primary keyword SERP)')
  .option('--no-google-nlp', 'Skip Google NLP API enrichment')
  .option('--no-cache', 'Force fresh scraping (ignore cached competitor texts)')
  .option('--json', 'Output JSON only (no console report)', false)
  .action(async (keyword, opts) => {
    try {
      const slug = opts.slug || keywordToSlug(keyword);
      const num = parseInt(opts.num, 10) || 10;

      if (!opts.json) {
        console.log('');
        console.log(`=== NLP Term Extraction: "${keyword}" ===`);
        console.log('');
      }

      // 1. Fetch SERP data for primary keyword
      const serpData = await fetchSerpData(keyword, { num });
      const serpUrls = serpData?.topResults?.map((r) => r.url) || [];
      const relatedSearches = serpData?.relatedKeywords || [];

      if (!opts.json) {
        console.log(`SERP: ${serpUrls.length} results for "${keyword}"`);
      }

      // 2. Corpus expansion (if enabled and needed)
      let allUrls = [...serpUrls];
      let expansion = { expandedUrls: [], queryVariations: [], authSeeds: [], selfRefArticles: [] };

      if (opts.expand !== false && serpUrls.length < 7) {
        expansion = await expandCorpus(keyword, {
          serpRelatedSearches: relatedSearches,
          draftsDir: DRAFTS_DIR,
          blogDir: BLOG_DIR,
        });

        // Merge expanded URLs (deduplicate)
        const existingSet = new Set(allUrls);
        const newExpanded = expansion.expandedUrls.filter((u) => !existingSet.has(u));
        allUrls = [...allUrls, ...newExpanded];

        // Add authority seed URLs
        allUrls = [...allUrls, ...expansion.authSeeds];

        if (!opts.json) {
          if (expansion.queryVariations.length > 0) {
            console.log(
              `Expansion: +${expansion.queryVariations.length} queries -> ${expansion.queryVariations.map((q) => `"${q}"`).join(', ')}`,
            );
            console.log(`  Additional: +${newExpanded.length} URLs (after dedup)`);
          }
          if (expansion.authSeeds.length > 0) {
            console.log(`Authority seeds: +${expansion.authSeeds.length}`);
          }
          if (expansion.selfRefArticles.length > 0) {
            console.log(
              `Self-reference: +${expansion.selfRefArticles.length} (${expansion.selfRefArticles.map((a) => a.slug).join(', ')})`,
            );
          }
        }
      }

      // 3. Scrape competitor texts
      const scraped = await scrapeCompetitorTexts(allUrls, {
        cacheDir: NLP_CACHE_DIR,
        keywordSlug: slug,
        noCache: opts.cache === false,
      });

      const successfulScrapes = scraped.filter((s) => s.success);
      const totalWords = successfulScrapes.reduce((sum, s) => sum + s.wordCount, 0);

      if (!opts.json) {
        const competitorCount = successfulScrapes.length;
        const authCount = expansion.authSeeds.length;
        const selfCount = expansion.selfRefArticles.length;
        console.log('');
        console.log(
          `Corpus: ${totalWords.toLocaleString()} words across ${competitorCount} documents` +
            (authCount > 0 ? ` (incl. ${authCount} authority seeds)` : '') +
            (selfCount > 0 ? ` + ${selfCount} self-reference` : ''),
        );
        console.log(`Scraping: ${successfulScrapes.length}/${allUrls.length} succeeded`);
      }

      // 4. Prepare self-reference texts
      const selfRefTexts = expansion.selfRefArticles.map((a) => ({
        text: a.text,
        slug: a.slug,
        keyword: a.keyword,
        weight: 0.7,
      }));

      // 5. Run NLP extraction
      const nlpResult = await extractNlpTerms(scraped, {
        keyword,
        useGoogleNlp: opts.googleNlp !== false,
        selfRefTexts,
      });

      // Fill in slug
      nlpResult.slug = slug;

      // 6. Save as .surfer-targets.json
      const outputPath = path.join(DRAFTS_DIR, `${slug}.diy-surfer-targets.json`);
      await fs.writeFile(outputPath, JSON.stringify(nlpResult, null, 2), 'utf-8');

      // 7. Console report
      if (opts.json) {
        console.log(JSON.stringify(nlpResult, null, 2));
      } else {
        const { high_priority, medium_priority, low_priority } = nlpResult.terms;

        console.log('');
        console.log(`High priority (${high_priority.length} terms):`);
        for (const t of high_priority.slice(0, 10)) {
          console.log(`  "${t.term}"`.padEnd(38) + `min: ${t.targetMin}  max: ${t.targetMax}`);
        }
        if (high_priority.length > 10) {
          console.log(`  ... and ${high_priority.length - 10} more`);
        }

        console.log(`Medium priority (${medium_priority.length} terms):`);
        for (const t of medium_priority.slice(0, 5)) {
          console.log(`  "${t.term}"`.padEnd(38) + `min: ${t.targetMin}  max: ${t.targetMax}`);
        }
        if (medium_priority.length > 5) {
          console.log(`  ... and ${medium_priority.length - 5} more`);
        }

        console.log(`Low priority (${low_priority.length} terms):`);
        for (const t of low_priority.slice(0, 3)) {
          console.log(`  "${t.term}"`.padEnd(38) + `min: ${t.targetMin}  max: ${t.targetMax}`);
        }
        if (low_priority.length > 3) {
          console.log(`  ... and ${low_priority.length - 3} more`);
        }

        console.log('');
        console.log(`Saved: ${outputPath}`);
        console.log('');
      }

      process.exit(0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: validate-nlp command
// ---------------------------------------------------------------------------

program
  .command('validate-nlp <slug>')
  .description('Validate DIY-extracted NLP terms against existing Surfer targets')
  .action(async (slug) => {
    try {
      // 1. Load existing Surfer targets (ground truth)
      const surferPath = path.join(DRAFTS_DIR, `${slug}.surfer-targets.json`);
      let surferData;
      try {
        const raw = await fs.readFile(surferPath, 'utf-8');
        surferData = JSON.parse(raw);
      } catch {
        console.error(`\nNo .surfer-targets.json found for "${slug}" at ${surferPath}\n`);
        process.exit(2);
      }

      const surferKeyword = surferData.keyword;
      if (!surferKeyword) {
        console.error(`\nNo keyword found in ${surferPath}\n`);
        process.exit(2);
      }

      console.log('');
      console.log(`=== NLP Validation: ${slug} ===`);
      console.log(`  Keyword: "${surferKeyword}"`);
      console.log(`  Source: ${surferData.source === 'diy-extract' ? 'DIY' : 'Surfer'}`);
      console.log('');

      // 2. Run DIY extraction
      console.log('Running DIY extraction...');
      const serpData = await fetchSerpData(surferKeyword);
      const serpUrls = serpData?.topResults?.map((r) => r.url) || [];
      const relatedSearches = serpData?.relatedKeywords || [];

      let allUrls = [...serpUrls];
      if (serpUrls.length < 7) {
        const expansion = await expandCorpus(surferKeyword, {
          serpRelatedSearches: relatedSearches,
          draftsDir: DRAFTS_DIR,
          blogDir: BLOG_DIR,
        });
        const existingSet = new Set(allUrls);
        allUrls = [...allUrls, ...expansion.expandedUrls.filter((u) => !existingSet.has(u)), ...expansion.authSeeds];
      }

      const scraped = await scrapeCompetitorTexts(allUrls, {
        cacheDir: NLP_CACHE_DIR,
        keywordSlug: slug,
      });

      const diyResult = await extractNlpTerms(scraped, { keyword: surferKeyword });

      // 3. Compare: precision, recall, F1 for each priority tier
      console.log('');
      const tiers = ['high_priority', 'medium_priority', 'low_priority'];
      const tierLabels = { high_priority: 'High', medium_priority: 'Medium', low_priority: 'Low' };

      let totalSurferTerms = 0;
      let totalRecalled = 0;

      // Porter stemming helper for fuzzy term matching
      const stemPhrase = (phrase) =>
        phrase.split(/\s+/).map((w) => natural.PorterStemmer.stem(w)).join(' ');

      for (const tier of tiers) {
        const surferTerms = (surferData.terms?.[tier] || []).map((t) => t.term.toLowerCase());
        const diyTerms = (diyResult.terms?.[tier] || []).map((t) => t.term.toLowerCase());
        const allDiyTerms = [
          ...(diyResult.terms?.high_priority || []),
          ...(diyResult.terms?.medium_priority || []),
          ...(diyResult.terms?.low_priority || []),
        ].map((t) => t.term.toLowerCase());

        // Recall: how many Surfer terms appear in DIY results (any tier)
        const recalled = surferTerms.filter((st) => {
          const stemmedSt = stemPhrase(st);
          return allDiyTerms.some((dt) =>
            dt === st || dt === st + 's' || dt + 's' === st || stemPhrase(dt) === stemmedSt,
          );
        });

        // Precision: how many DIY terms in this tier match Surfer terms (any tier)
        const allSurferTerms = [
          ...(surferData.terms?.high_priority || []),
          ...(surferData.terms?.medium_priority || []),
          ...(surferData.terms?.low_priority || []),
        ].map((t) => t.term.toLowerCase());

        const preciseHits = diyTerms.filter((dt) => {
          const stemmedDt = stemPhrase(dt);
          return allSurferTerms.some((st) =>
            dt === st || dt === st + 's' || dt + 's' === st || stemmedDt === stemPhrase(st),
          );
        });

        const recall = surferTerms.length > 0 ? recalled.length / surferTerms.length : 1;
        const precision = diyTerms.length > 0 ? preciseHits.length / diyTerms.length : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        totalSurferTerms += surferTerms.length;
        totalRecalled += recalled.length;

        console.log(`  [${tierLabels[tier]}] Surfer: ${surferTerms.length} | DIY: ${diyTerms.length}`);
        console.log(`    Recall: ${(recall * 100).toFixed(0)}% (${recalled.length}/${surferTerms.length})`);
        console.log(`    Precision: ${(precision * 100).toFixed(0)}% (${preciseHits.length}/${diyTerms.length})`);
        console.log(`    F1: ${(f1 * 100).toFixed(0)}%`);

        // List missed terms
        const missed = surferTerms.filter((st) => {
          const stemmedSt = stemPhrase(st);
          return !allDiyTerms.some((dt) =>
            dt === st || dt === st + 's' || dt + 's' === st || stemPhrase(dt) === stemmedSt,
          );
        });
        if (missed.length > 0) {
          console.log(`    Missed: ${missed.slice(0, 5).map((t) => `"${t}"`).join(', ')}${missed.length > 5 ? ` + ${missed.length - 5} more` : ''}`);
        }
        console.log('');
      }

      // Overall recall
      const overallRecall = totalSurferTerms > 0 ? totalRecalled / totalSurferTerms : 1;
      const target = 0.7;
      const passStr = overallRecall >= target ? 'PASS' : 'FAIL';
      console.log(`  Overall recall: ${(overallRecall * 100).toFixed(0)}% (target: >=${(target * 100).toFixed(0)}%) — ${passStr}`);
      console.log('');

      process.exit(overallRecall >= target ? 0 : 1);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: gsc command (Phase 3 — GSC feedback)
// ---------------------------------------------------------------------------

program
  .command('gsc <slug>')
  .description('GSC feedback analysis for an article')
  .option('--days <n>', 'Date range in days', '28')
  .option('--site-url <url>', 'GSC property URL')
  .option('--json', 'Output JSON only', false)
  .option('--save', 'Save snapshot to SQLite for trend tracking', false)
  .action(async (slug, opts) => {
    try {
      const days = parseInt(opts.days, 10) || 28;
      const siteUrl = opts.siteUrl || GSC_SITE_URL;
      const pageUrl = `${SITE_URL}/blog/${slug}`;

      // Date range: last N days, excluding 3-day lag
      const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      const endStr = endDate.toISOString().split('T')[0];
      const startStr = startDate.toISOString().split('T')[0];

      const gscQueries = await fetchGscQueries(pageUrl, {
        startDate: startStr,
        endDate: endStr,
        siteUrl,
      });

      if (gscQueries === null) {
        console.log('\nGSC not configured. Set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY in .env.\n');
        process.exit(0);
      }

      // Load surfer targets for NLP term matching (optional)
      let nlpTerms = [];
      try {
        const surferPath = path.join(DRAFTS_DIR, `${slug}.surfer-targets.json`);
        const raw = await fs.readFile(surferPath, 'utf-8');
        const surferData = JSON.parse(raw);
        nlpTerms = [
          ...(surferData.terms?.high_priority || []),
          ...(surferData.terms?.medium_priority || []),
          ...(surferData.terms?.low_priority || []),
        ];
      } catch {
        // No surfer targets — proceed without NLP coverage analysis
      }

      // Match queries to NLP terms
      const matches = nlpTerms.length > 0 ? matchQueriesToTerms(gscQueries, nlpTerms) : [];
      const coverage = nlpTerms.length > 0 ? computeCoverage(matches, nlpTerms) : null;

      // CTR gap analysis
      const ctrGaps = analyzeCtrGaps(gscQueries);

      // Save snapshot if requested
      if (opts.save) {
        saveSnapshot(pageUrl, gscQueries, {
          fetchDate: new Date().toISOString().split('T')[0],
          periodStart: startStr,
          periodEnd: endStr,
        });
      }

      // Ranking trends (from saved snapshots)
      const trends = getRankingTrends(pageUrl);

      // Output
      if (opts.json) {
        console.log(JSON.stringify({
          slug,
          pageUrl,
          period: { start: startStr, end: endStr },
          queries: gscQueries,
          nlpCoverage: coverage,
          ctrGaps,
          trends,
        }, null, 2));
      } else {
        console.log('');
        console.log(`=== GSC Feedback: ${slug} ===`);
        console.log('');
        console.log(`URL: ${pageUrl}`);
        console.log(`Period: ${startStr} -> ${endStr} (${days} days)`);
        console.log('');

        // Top queries by impressions
        const sorted = [...gscQueries].sort((a, b) => b.impressions - a.impressions);
        console.log(`Top queries (by impressions):`);
        for (const q of sorted.slice(0, 10)) {
          const ctrPct = (q.ctr * 100).toFixed(1);
          const posStr = q.position.toFixed(1);
          const gapFlag = ctrGaps.some((g) => g.query === q.query) ? '  ** CTR gap' : '';
          console.log(
            `  "${q.query}"`.padEnd(50) +
              `Imp: ${String(q.impressions).padStart(5)}  Clicks: ${String(q.clicks).padStart(4)}  CTR: ${ctrPct.padStart(5)}%  Pos: ${posStr.padStart(5)}${gapFlag}`,
          );
        }

        // NLP coverage
        if (coverage) {
          console.log('');
          console.log(`NLP term coverage: ${coverage.covered}/${coverage.total} terms have real search demand`);
          if (coverage.uncoveredTerms.length > 0) {
            console.log(`  Uncovered: ${coverage.uncoveredTerms.slice(0, 5).map((t) => `"${t}"`).join(', ')}${coverage.uncoveredTerms.length > 5 ? ` + ${coverage.uncoveredTerms.length - 5} more` : ''}`);
          }
        }

        // CTR gaps
        if (ctrGaps.length > 0) {
          console.log('');
          console.log('CTR gaps (high impressions, low CTR):');
          for (const gap of ctrGaps.slice(0, 5)) {
            console.log(
              `  "${gap.query}" — Pos ${gap.position.toFixed(1)}, CTR ${(gap.actualCtr * 100).toFixed(1)}% vs expected ${(gap.expectedCtr * 100).toFixed(1)}%`,
            );
          }
        }

        // Ranking trends
        if (trends && trends.length > 0) {
          console.log('');
          console.log('Ranking trends (vs previous snapshot):');
          for (const t of trends.slice(0, 10)) {
            const arrow = t.direction === 'improved' ? 'UP' : t.direction === 'declined' ? 'DOWN' : t.direction === 'new' ? 'NEW' : '--';
            const prevStr = t.prevPosition != null ? t.prevPosition.toFixed(1) : 'n/a';
            console.log(
              `  "${t.query}"`
                .padEnd(50) + `${prevStr} -> ${t.currPosition.toFixed(1)}  ${arrow}`,
            );
          }
        }

        console.log('');
      }

      process.exit(0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// CLI: gsc-batch command
// ---------------------------------------------------------------------------

program
  .command('gsc-batch')
  .description('GSC analysis for all published articles')
  .option('--days <n>', 'Date range in days', '28')
  .option('--save', 'Save all snapshots to SQLite', false)
  .action(async (opts) => {
    try {
      const topics = await readContentQueue();
      const published = topics.filter((t) => t.status === 'published');

      if (published.length === 0) {
        console.log('No published articles found in content queue.');
        process.exit(0);
      }

      const days = parseInt(opts.days, 10) || 28;
      const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      const endStr = endDate.toISOString().split('T')[0];
      const startStr = startDate.toISOString().split('T')[0];

      console.log('');
      console.log(`=== GSC Batch Analysis ===`);
      console.log(`Period: ${startStr} -> ${endStr} (${days} days)`);
      console.log(`Articles: ${published.length}`);
      console.log('');

      const summaryRows = [];

      for (const topic of published) {
        const pageUrl = `${SITE_URL}/blog/${topic.slug}`;
        const gscQueries = await fetchGscQueries(pageUrl, {
          startDate: startStr,
          endDate: endStr,
        });

        if (gscQueries === null) {
          console.log('GSC not configured. Set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY in .env.');
          process.exit(0);
        }

        const totalImpressions = gscQueries.reduce((sum, q) => sum + q.impressions, 0);
        const totalClicks = gscQueries.reduce((sum, q) => sum + q.clicks, 0);
        const topQuery = gscQueries.length > 0
          ? [...gscQueries].sort((a, b) => b.impressions - a.impressions)[0]
          : null;

        if (opts.save) {
          saveSnapshot(pageUrl, gscQueries, {
            fetchDate: new Date().toISOString().split('T')[0],
            periodStart: startStr,
            periodEnd: endStr,
          });
        }

        summaryRows.push({
          slug: topic.slug,
          queries: gscQueries.length,
          impressions: totalImpressions,
          clicks: totalClicks,
          topQuery: topQuery?.query || '-',
        });
      }

      // Print summary table
      console.log(
        `${'Slug'.padEnd(50)} ${'Queries'.padStart(8)} ${'Imp'.padStart(8)} ${'Clicks'.padStart(8)} ${'Top Query'}`,
      );
      console.log(''.padEnd(110, '\u2500'));

      for (const row of summaryRows) {
        console.log(
          `${row.slug.padEnd(50)} ${String(row.queries).padStart(8)} ${String(row.impressions).padStart(8)} ${String(row.clicks).padStart(8)} ${row.topQuery}`,
        );
      }

      console.log(''.padEnd(110, '\u2500'));
      const totalImp = summaryRows.reduce((s, r) => s + r.impressions, 0);
      const totalClk = summaryRows.reduce((s, r) => s + r.clicks, 0);
      console.log(
        `${'Total'.padEnd(50)} ${String(summaryRows.reduce((s, r) => s + r.queries, 0)).padStart(8)} ${String(totalImp).padStart(8)} ${String(totalClk).padStart(8)}`,
      );
      console.log('');

      process.exit(0);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

program.parse();
