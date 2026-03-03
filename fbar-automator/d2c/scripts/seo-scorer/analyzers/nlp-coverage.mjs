/**
 * nlp-coverage.mjs — NLP term coverage dimension analyzer for the SEO/AEO scorer.
 *
 * Evaluates how well an article matches SurferSEO NLP term targets
 * (high/medium/low priority terms with frequency ranges).
 *
 * Scoring rubric (0-10 total):
 *   High priority terms at/above targetMin  — up to 5 pts
 *   Medium priority terms (≥70% at min)     — up to 3 pts
 *   Low priority terms (≥50% present)       — up to 2 pts
 *
 * Weight: 0.22 (highest — biggest Surfer Content Score predictor)
 *
 * Requires: surferTargets loaded from <slug>.surfer-targets.json
 * Fallback: Returns null when no surfer targets exist (dimension is skipped).
 */

import { getKeywordOccurrences } from '../utils/text.mjs';

const DIMENSION = 'nlpCoverage';
const WEIGHT = 0.22;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Score a single term against its target range.
 *
 * @param {number} actual   Actual occurrence count.
 * @param {number} min      Target minimum.
 * @param {number} max      Target maximum.
 * @returns {number}  0-1 score for this term.
 */
function scoreTermHit(actual, min, max) {
  if (actual >= min && actual <= max) {
    // Within target range — full credit
    return 1.0;
  }
  if (actual > max) {
    // Over target — small penalty (still mostly good)
    const overRatio = actual / max;
    // Penalty scales: 1.5x over = 0.8, 2x over = 0.6, 3x+ over = 0.4
    return Math.max(0.4, 1.0 - (overRatio - 1) * 0.4);
  }
  if (actual > 0 && min > 0) {
    // Below target but present — proportional credit
    return actual / min;
  }
  // Not present at all
  return 0;
}

/**
 * Score a priority tier of terms.
 *
 * @param {Array<{term: string, targetMin: number, targetMax: number}>} terms
 * @param {string} plainText  Article plain text.
 * @returns {{ avgScore: number, met: number, total: number, termDetails: Array }}
 */
function scoreTier(terms, plainText) {
  if (!terms || terms.length === 0) {
    return { avgScore: 1.0, met: 0, total: 0, termDetails: [] };
  }

  let totalScore = 0;
  let met = 0;
  const termDetails = [];

  for (const { term, targetMin, targetMax } of terms) {
    const actual = getKeywordOccurrences(plainText, term);
    const termScore = scoreTermHit(actual, targetMin, targetMax);
    totalScore += termScore;

    if (actual >= targetMin) {
      met++;
    }

    termDetails.push({ term, actual, targetMin, targetMax, score: Math.round(termScore * 100) / 100 });
  }

  return {
    avgScore: totalScore / terms.length,
    met,
    total: terms.length,
    termDetails,
  };
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

/**
 * Analyse NLP term coverage of an article against Surfer targets.
 *
 * @param {object} article  Parsed article object from fetchers/article.mjs.
 * @param {object} [options]
 * @param {object} [options.surferTargets]  Loaded .surfer-targets.json data.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] } | null}
 *   Returns null when no surfer targets are available (dimension is skipped).
 */
export function analyze(article, options = {}) {
  const surferTargets = options.surferTargets;

  // Graceful fallback: no surfer targets → skip this dimension entirely
  if (!surferTargets || !surferTargets.terms) {
    return null;
  }

  const { plainText = '' } = article;
  const { high_priority = [], medium_priority = [], low_priority = [] } = surferTargets.terms;

  // Score each tier
  const high = scoreTier(high_priority, plainText);
  const medium = scoreTier(medium_priority, plainText);
  const low = scoreTier(low_priority, plainText);

  // Calculate 0-10 score
  // High priority: up to 5 pts (based on average term score)
  const highScore = high.avgScore * 5;
  // Medium priority: up to 3 pts (based on % of terms at targetMin)
  const mediumPct = medium.total > 0 ? medium.met / medium.total : 1;
  const mediumScore = Math.min(1, mediumPct / 0.7) * 3; // ≥70% met = full 3 pts
  // Low priority: up to 2 pts (based on % of terms present)
  const lowPresent = low.termDetails.filter(t => t.actual > 0).length;
  const lowPct = low.total > 0 ? lowPresent / low.total : 1;
  const lowScore = Math.min(1, lowPct / 0.5) * 2; // ≥50% present = full 2 pts

  const totalScore = Math.min(10, highScore + mediumScore + lowScore);

  // Generate actionable issues — list every high-priority term below targetMin
  const issues = [];

  const highBelowMin = high.termDetails.filter(t => t.actual < t.targetMin);
  if (highBelowMin.length > 0) {
    issues.push(
      `${highBelowMin.length}/${high.total} high-priority NLP terms below target:`,
    );
    // Sort by biggest gap first (most impactful to fix)
    highBelowMin
      .sort((a, b) => (b.targetMin - b.actual) - (a.targetMin - a.actual))
      .forEach(t => {
        issues.push(`  "${t.term}": ${t.actual}/${t.targetMin} uses`);
      });
  }

  const mediumBelowMin = medium.termDetails.filter(t => t.actual < t.targetMin);
  if (mediumBelowMin.length > 0) {
    const medMissRate = Math.round((mediumBelowMin.length / medium.total) * 100);
    issues.push(
      `${mediumBelowMin.length}/${medium.total} medium-priority terms below target (${medMissRate}% miss rate)`,
    );
  }

  const lowMissing = low.termDetails.filter(t => t.actual === 0);
  if (lowMissing.length > 0) {
    const lowMissRate = Math.round((lowMissing.length / low.total) * 100);
    issues.push(
      `${lowMissing.length}/${low.total} low-priority terms missing entirely (${lowMissRate}% absent)`,
    );
  }

  return {
    dimension: DIMENSION,
    score: Math.round(totalScore * 100) / 100,
    weight: WEIGHT,
    details: {
      highPriority: {
        met: high.met,
        total: high.total,
        avgScore: Math.round(high.avgScore * 100) / 100,
        score: Math.round(highScore * 100) / 100,
      },
      mediumPriority: {
        met: medium.met,
        total: medium.total,
        pctMet: Math.round(mediumPct * 100),
        score: Math.round(mediumScore * 100) / 100,
      },
      lowPriority: {
        present: lowPresent,
        total: low.total,
        pctPresent: Math.round(lowPct * 100),
        score: Math.round(lowScore * 100) / 100,
      },
      surferContentScore: surferTargets.contentScore?.current || null,
      termsBelowMin: highBelowMin.map(t => ({
        term: t.term,
        actual: t.actual,
        targetMin: t.targetMin,
      })),
    },
    issues,
  };
}
