/**
 * ctr-gap.mjs — CTR gap analysis with position-based benchmarks.
 *
 * Identifies GSC queries where actual click-through rate falls significantly
 * below the expected rate for that ranking position. Only surfaces actionable
 * gaps (impressions > 100 AND gap > 0.02), sorted by opportunity descending.
 */

// ---------------------------------------------------------------------------
// CTR benchmarks by position
// ---------------------------------------------------------------------------

/**
 * Expected CTR by position (1-indexed). Positions beyond 10 are interpolated
 * linearly down to 0.005 at position 50.
 *
 * @type {Array<{maxPos: number, expectedCtr: number}>}
 */
const CTR_BENCHMARKS = [
  { maxPos: 1,  expectedCtr: 0.28 },
  { maxPos: 2,  expectedCtr: 0.15 },
  { maxPos: 3,  expectedCtr: 0.11 },
  { maxPos: 4,  expectedCtr: 0.08 },
  { maxPos: 5,  expectedCtr: 0.06 },
  { maxPos: 6,  expectedCtr: 0.045 },
  { maxPos: 7,  expectedCtr: 0.035 },
  { maxPos: 8,  expectedCtr: 0.03 },
  { maxPos: 9,  expectedCtr: 0.025 },
  { maxPos: 10, expectedCtr: 0.02 },
];

// Interpolation anchor for positions > 10
const TAIL_ANCHOR = { pos: 50, ctr: 0.005 };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look up the expected CTR for a given average position.
 *
 * For positions 1–10: step-function lookup from CTR_BENCHMARKS.
 * For positions > 10: linear interpolation between position-10 benchmark
 *   and 0.005 at position 50.
 *
 * @param {number} position  Average position (may be fractional).
 * @returns {number}  Expected CTR as a decimal (e.g. 0.28 = 28%).
 */
function expectedCtrForPosition(position) {
  // Find the first benchmark whose maxPos >= position (floor to bucket)
  const bucket = CTR_BENCHMARKS.find(b => position <= b.maxPos);
  if (bucket) return bucket.expectedCtr;

  // Linear interpolation for positions > 10
  const pos10Ctr = CTR_BENCHMARKS[CTR_BENCHMARKS.length - 1].expectedCtr; // 0.02
  const slope = (TAIL_ANCHOR.ctr - pos10Ctr) / (TAIL_ANCHOR.pos - 10);
  const interpolated = pos10Ctr + slope * (position - 10);
  return Math.max(interpolated, TAIL_ANCHOR.ctr);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze CTR gaps for GSC queries.
 *
 * Only returns rows where impressions > 100 AND gap > 0.02 (actionable only).
 * Results are sorted by opportunity (impressions * gap) descending.
 *
 * @param {Array<{query: string, clicks: number, impressions: number, ctr: number, position: number}>} gscQueries
 * @returns {Array<{
 *   query: string,
 *   position: number,
 *   actualCtr: number,
 *   expectedCtr: number,
 *   gap: number,
 *   impressions: number,
 *   opportunity: number
 * }>}
 */
export function analyzeCtrGaps(gscQueries) {
  if (!gscQueries?.length) return [];

  const gaps = [];

  for (const row of gscQueries) {
    const { query, impressions, ctr: actualCtr, position } = row;

    // Skip rows with insufficient impression volume
    if (impressions <= 100) continue;

    const expectedCtr = expectedCtrForPosition(position);
    const gap = expectedCtr - actualCtr;

    // Only surface actionable gaps
    if (gap <= 0.02) continue;

    gaps.push({
      query,
      position: Math.round(position * 10) / 10, // 1 decimal place
      actualCtr: Math.round(actualCtr * 10000) / 10000,
      expectedCtr: Math.round(expectedCtr * 10000) / 10000,
      gap: Math.round(gap * 10000) / 10000,
      impressions,
      opportunity: Math.round(impressions * gap),
    });
  }

  // Sort by opportunity descending
  gaps.sort((a, b) => b.opportunity - a.opportunity);

  return gaps;
}
