/**
 * report.mjs — Report generation for console and JSON output.
 *
 * Produces human-readable console reports and machine-readable JSON
 * score files.  Handles score archival so previous attempts are
 * preserved as <slug>.diy-score.attempt-N.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  PASS_THRESHOLD,
  DIMENSION_WEIGHTS,
  BLOG_DIR,
  DRAFTS_DIR,
  QUEUE_PATH,
} from '../utils/config.mjs';

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

/**
 * Pretty-print a scoring report to the console.
 *
 * @param {string} slug             Article slug.
 * @param {string} keyword          Target keyword.
 * @param {object} result           Output from calculateOverall().
 * @param {Array}  analyzerResults  Individual analyzer result objects.
 */
export function printConsoleReport(slug, keyword, result, analyzerResults) {
  const resultMap = new Map(analyzerResults.map((r) => [r.dimension, r]));

  console.log('');
  console.log(`=== DIY SEO Score: ${slug} ===`);
  console.log('');
  console.log(`Keyword: ${keyword}`);

  // Word count — pull from article data if available in analyzer details
  const readabilityResult = resultMap.get('readability');
  const wordCount = readabilityResult?.details?.wordCount;
  if (wordCount != null) {
    console.log(`Words: ${Number(wordCount).toLocaleString()}`);
  }

  console.log('');

  // Print each dimension in display order
  const displayOrder = [
    'readability',
    'writingQuality',
    'structure',
    'keywordCoverage',
    'nlpCoverage',
    'schemaMarkup',
    'aeoSignals',
    'llmQuality',
  ];

  for (const dim of displayOrder) {
    const r = resultMap.get(dim);
    if (!r) continue;

    const label = DIMENSION_DISPLAY_NAMES[dim] || dim;
    const padded = `${label}:`.padEnd(20);
    const scoreStr = `${r.score.toFixed(1)}/10`;
    const detail = formatDetailSummary(dim, r.details);

    console.log(`  ${padded}${scoreStr}  (${detail})`);
  }

  // Separator
  console.log(`  ${''.padEnd(39, '\u2500')}`);

  // Overall
  const passEmoji = result.pass ? '\u2705' : '\u26A0\uFE0F';
  const passText = result.pass ? 'PASS' : 'NEEDS IMPROVEMENT';
  const targetNote = result.pass ? '' : ` (target: \u2265${PASS_THRESHOLD.toFixed(1)})`;
  console.log(
    `  ${'OVERALL:'.padEnd(20)}${result.overall.toFixed(1)}/10  ${passEmoji} ${passText}${targetNote}`,
  );

  // Missing dimensions
  if (result.dimensionsMissing.length > 0) {
    console.log('');
    console.log(
      `  Skipped: ${result.dimensionsMissing.map((d) => DIMENSION_DISPLAY_NAMES[d] || d).join(', ')}`,
    );
  }

  // Top issues
  if (result.topIssues.length > 0) {
    console.log('');
    console.log('  Top issues:');
    for (const issue of result.topIssues) {
      console.log(`  - ${issue}`);
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

/**
 * Generate a JSON report object (not stringified).
 *
 * @param {string} slug             Article slug.
 * @param {string} keyword          Target keyword.
 * @param {object} article          Loaded article object from fetchers/article.mjs.
 * @param {object} result           Output from calculateOverall().
 * @param {Array}  analyzerResults  Individual analyzer result objects.
 * @returns {object}
 */
export function generateJsonReport(
  slug,
  keyword,
  article,
  result,
  analyzerResults,
) {
  const dimensions = {};
  for (const r of analyzerResults) {
    dimensions[r.dimension] = {
      score: r.score,
      weight: DIMENSION_WEIGHTS[r.dimension] ?? r.weight,
      details: r.details,
      issues: r.issues,
    };
  }

  return {
    slug,
    keyword,
    scorer: 'diy-v2',
    scoredAt: new Date().toISOString(),
    wordCount: article.wordCount,
    overall: result.overall,
    pass: result.pass,
    dimensions,
    topIssues: result.topIssues,
    meta: {
      title: article.meta.title || null,
      description: article.meta.description || null,
      publishedDate: article.meta.publishedDate || article.meta.publishDate || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Save report to disk
// ---------------------------------------------------------------------------

/**
 * Save a JSON report to the article's content directory.
 *
 * If a previous score file exists, it is archived as
 * <slug>.diy-score.attempt-N.json (where N increments).
 *
 * @param {string}  slug     Article slug.
 * @param {object}  report   JSON report object from generateJsonReport().
 * @param {object}  [opts]
 * @param {boolean} [opts.published=false]  Save alongside published blog article.
 */
export async function saveReport(slug, report, { published = false } = {}) {
  const dir = published ? BLOG_DIR : DRAFTS_DIR;
  const scorePath = path.join(dir, `${slug}.diy-score.json`);

  // Archive existing score file if present
  try {
    await fs.access(scorePath);

    // Find the next attempt number
    let attempt = 1;
    while (true) {
      const archivePath = path.join(
        dir,
        `${slug}.diy-score.attempt-${attempt}.json`,
      );
      try {
        await fs.access(archivePath);
        attempt++;
      } catch {
        // Archive slot is free
        await fs.rename(scorePath, archivePath);
        break;
      }
    }
  } catch {
    // No existing score file — nothing to archive
  }

  await fs.writeFile(scorePath, JSON.stringify(report, null, 2) + '\n', 'utf-8');

  console.log(`  Score saved: ${scorePath}`);

  // Update content-queue.json with DIY score
  await updateContentQueue(slug, report.overall, report.scoredAt);
}

/**
 * Update content-queue.json with DIY score data for a given article.
 *
 * Mirrors what score-via-swa.mjs does for SWA scores: adds `diyScore`
 * and `diyScoredAt` fields to the matching topic entry.
 *
 * @param {string} slug       Article slug.
 * @param {number} score      Overall DIY score.
 * @param {string} scoredAt   ISO timestamp of scoring.
 */
async function updateContentQueue(slug, score, scoredAt) {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf-8');
    const queue = JSON.parse(raw);

    const topic = (queue.topics || []).find((t) => t.slug === slug);
    if (!topic) {
      console.log(`  Note: "${slug}" not found in content-queue.json — skipping queue update.`);
      return;
    }

    topic.diyScore = score;
    topic.diyScoredAt = scoredAt;

    await fs.writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf-8');
    console.log(`  Queue updated: diyScore=${score.toFixed(1)} for ${slug}`);
  } catch (err) {
    console.error(`  Warning: Could not update content-queue.json: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Human-readable display names for each dimension. */
const DIMENSION_DISPLAY_NAMES = {
  readability: 'Readability',
  writingQuality: 'Writing Quality',
  structure: 'Structure',
  keywordCoverage: 'Keyword Coverage',
  nlpCoverage: 'NLP Coverage',
  schemaMarkup: 'Schema Markup',
  aeoSignals: 'AEO Signals',
  llmQuality: 'LLM Quality',
};

/**
 * Format a short detail summary string for a dimension.
 *
 * Each dimension may have different detail keys — this function picks
 * the most informative fields for the one-line console display.
 *
 * @param {string} dimension
 * @param {object} details
 * @returns {string}
 */
function formatDetailSummary(dimension, details) {
  if (!details) return '';

  switch (dimension) {
    case 'readability': {
      const parts = [];
      if (details.flesch != null) {
        parts.push(`Flesch: ${Number(details.flesch).toFixed(1)}`);
      }
      if (details.avgSentenceLength != null) {
        parts.push(
          `Avg sentence: ${Number(details.avgSentenceLength).toFixed(1)} words`,
        );
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'writingQuality': {
      const parts = [];
      if (details.issuesPer500 != null) {
        parts.push(`${Number(details.issuesPer500).toFixed(1)} issues/500w`);
      }
      if (details.passiveCount != null) {
        parts.push(`${details.passiveCount} passive`);
      }
      if (details.clicheCount != null && details.clicheCount > 0) {
        parts.push(`${details.clicheCount} clichés`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'structure': {
      const parts = [];
      if (details.h1Count != null) parts.push(`${details.h1Count} H1`);
      if (details.h2Count != null) parts.push(`${details.h2Count} H2`);
      if (details.h3Count != null) parts.push(`${details.h3Count} H3`);
      if (details.hasFAQ != null) {
        parts.push(`FAQ ${details.hasFAQ ? '\u2705' : '\u274C'}`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'keywordCoverage': {
      const parts = [];
      if (details.density != null) {
        parts.push(`Density: ${Number(details.density).toFixed(1)}%`);
      }
      if (details.kwInH1 != null) {
        parts.push(`H1 ${details.kwInH1 ? '\u2705' : '\u274C'}`);
      }
      if (details.kwInH2 != null) {
        parts.push(`H2 ${details.kwInH2 ? '\u2705' : '\u274C'}`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'schemaMarkup': {
      const parts = [];
      if (details.hasFaqSchema != null) {
        parts.push(`FAQ schema ${details.hasFaqSchema ? '\u2705' : '\u274C'}`);
      }
      if (details.metaDescLength != null) {
        parts.push(`meta desc ${details.metaDescLength} chars`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'aeoSignals': {
      const parts = [];
      if (details.questionHeadingCount != null) {
        parts.push(`${details.questionHeadingCount} Q&A headings`);
      }
      if (details.citationDensity?.per500Words != null) {
        parts.push(
          `${Number(details.citationDensity.per500Words).toFixed(1)} citations/500w`,
        );
      }
      if (details.answerParaQuality?.ratio != null) {
        parts.push(`${Math.round(details.answerParaQuality.ratio * 100)}% answer quality`);
      }
      if (details.entityCoverage?.count != null) {
        parts.push(`${details.entityCoverage.count} entities`);
      }
      return parts.join(', ') || 'no details';
    }

    case 'nlpCoverage': {
      const parts = [];
      if (details.highPriority != null) {
        parts.push(`High: ${details.highPriority.met}/${details.highPriority.total}`);
      }
      if (details.mediumPriority != null) {
        parts.push(`Med: ${details.mediumPriority.pctMet}%`);
      }
      if (details.lowPriority != null) {
        parts.push(`Low: ${details.lowPriority.pctPresent}%`);
      }
      if (details.surferContentScore != null) {
        parts.push(`Surfer: ${details.surferContentScore}`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    case 'llmQuality': {
      const parts = [];
      if (details.accuracy != null) {
        parts.push(`Accuracy: ${Number(details.accuracy).toFixed(1)}`);
      }
      if (details.depth != null) {
        parts.push(`Depth: ${Number(details.depth).toFixed(1)}`);
      }
      if (details.actionability != null) {
        parts.push(`Action: ${Number(details.actionability).toFixed(1)}`);
      }
      return parts.join(', ') || summarizeDetails(details);
    }

    default:
      return summarizeDetails(details);
  }
}

/**
 * Generic fallback: pick up to 3 key-value pairs from a details object.
 *
 * @param {object} details
 * @returns {string}
 */
function summarizeDetails(details) {
  const entries = Object.entries(details).slice(0, 3);
  return entries
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k}: ${v ? 'yes' : 'no'}`;
      if (typeof v === 'number') return `${k}: ${v}`;
      return `${k}: ${v}`;
    })
    .join(', ');
}
