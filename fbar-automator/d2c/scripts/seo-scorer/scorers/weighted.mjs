/**
 * weighted.mjs — Weighted score aggregator.
 *
 * Combines individual analyzer dimension scores into a single overall
 * score using the configured weights.  Handles missing dimensions by
 * redistributing their weight proportionally across present dimensions.
 */

import { DIMENSION_WEIGHTS, PASS_THRESHOLD } from '../utils/config.mjs';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the overall weighted score from individual analyzer results.
 *
 * @param {Array<{ dimension: string, score: number, weight: number, details: object, issues: string[] }>} analyzerResults
 * @returns {{
 *   overall: number,
 *   pass: boolean,
 *   breakdown: Record<string, number>,
 *   weightedBreakdown: Record<string, number>,
 *   allIssues: string[],
 *   topIssues: string[],
 *   dimensionsMissing: string[],
 * }}
 */
export function calculateOverall(analyzerResults) {
  const allDimensions = Object.keys(DIMENSION_WEIGHTS);
  const presentDimensions = new Set(analyzerResults.map((r) => r.dimension));

  // Identify missing dimensions
  const dimensionsMissing = allDimensions.filter(
    (d) => !presentDimensions.has(d),
  );

  // Build a lookup map for quick access
  const resultsByDimension = new Map(
    analyzerResults.map((r) => [r.dimension, r]),
  );

  // Calculate the total weight of present dimensions for redistribution
  const presentWeightSum = allDimensions
    .filter((d) => presentDimensions.has(d))
    .reduce((sum, d) => sum + DIMENSION_WEIGHTS[d], 0);

  // Compute breakdown and weighted breakdown with redistributed weights
  const breakdown = {};
  const weightedBreakdown = {};
  let weightedSum = 0;

  for (const dim of allDimensions) {
    if (!presentDimensions.has(dim)) continue;

    const result = resultsByDimension.get(dim);
    const rawWeight = DIMENSION_WEIGHTS[dim];

    // Redistribute: if some dimensions are missing, scale up present weights
    // so they still sum to 1.0
    const effectiveWeight =
      presentWeightSum > 0 ? rawWeight / presentWeightSum : 0;

    breakdown[dim] = result.score;
    weightedBreakdown[dim] =
      Math.round(result.score * effectiveWeight * 1000) / 1000;
    weightedSum += result.score * effectiveWeight;
  }

  const overall = Math.round(weightedSum * 10) / 10;
  const pass = overall >= PASS_THRESHOLD;

  // Collect all issues, sorted by dimension weight (heaviest first)
  const sortedResults = [...analyzerResults].sort((a, b) => {
    const wA = DIMENSION_WEIGHTS[a.dimension] ?? 0;
    const wB = DIMENSION_WEIGHTS[b.dimension] ?? 0;
    return wB - wA;
  });

  const allIssues = [];
  for (const result of sortedResults) {
    for (const issue of result.issues) {
      allIssues.push(`[${dimensionLabel(result.dimension)}] ${issue}`);
    }
  }

  const topIssues = allIssues.slice(0, 10);

  return {
    overall,
    pass,
    breakdown,
    weightedBreakdown,
    allIssues,
    topIssues,
    dimensionsMissing,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a camelCase dimension key into a short human-readable label.
 *
 * @param {string} dimension  e.g. "writingQuality"
 * @returns {string}          e.g. "Writing Quality"
 */
function dimensionLabel(dimension) {
  const labels = {
    readability: 'Readability',
    writingQuality: 'Writing',
    structure: 'Structure',
    keywordCoverage: 'Keyword',
    schemaMarkup: 'Schema',
    aeoSignals: 'AEO',
    llmQuality: 'LLM',
    nlpCoverage: 'NLP',
  };
  return labels[dimension] || dimension;
}
