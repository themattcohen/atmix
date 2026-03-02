#!/usr/bin/env node
/**
 * index.mjs — CLI entry point for the DIY SEO/AEO content scorer.
 *
 * Usage:
 *   node scripts/seo-scorer/index.mjs score <slug> [options]
 *   node scripts/seo-scorer/index.mjs batch [options]
 *   node scripts/seo-scorer/index.mjs list
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
} from './utils/config.mjs';

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
        return await fn(article, { serpData });
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
// Parse and run
// ---------------------------------------------------------------------------

program.parse();
