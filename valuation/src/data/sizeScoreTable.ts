/**
 * EBITDA Size Score lookup — Data Page rows 5-14 (hardcoded constants in the sheet).
 * Floor-VLOOKUP equivalent: pick the score for the largest threshold that's > EBITDA.
 */

export interface SizeScoreBand {
  thresholdBelow: number;
  score: number;
}

export const SIZE_SCORE_TABLE: readonly SizeScoreBand[] = [
  { thresholdBelow: 100_000, score: 0 },
  { thresholdBelow: 250_000, score: 2 },
  { thresholdBelow: 500_000, score: 15 },
  { thresholdBelow: 750_000, score: 25 },
  { thresholdBelow: 1_000_000, score: 30 },
  { thresholdBelow: 1_500_000, score: 40 },
  { thresholdBelow: 2_000_000, score: 55 },
  { thresholdBelow: 2_500_000, score: 60 },
  { thresholdBelow: 3_000_000, score: 75 },
];

/** Max possible size score (row 14 in source sheet — same as $3M band). */
export const SIZE_SCORE_MAX = 75;

export function lookupSizeScore(ebitda: number): number {
  for (const band of SIZE_SCORE_TABLE) {
    if (ebitda < band.thresholdBelow) return band.score;
  }
  return SIZE_SCORE_MAX;
}
