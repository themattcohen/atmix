/**
 * Sellability scoring — Part 1 cells I19, I39, K39, J4, J5, J6.
 *
 * Verbatim from XLSX:
 *   I19 = SUM(I12:I18)                            — Step 1 raw total (unweighted)
 *   I39 = SUM(I24:I38)                            — Step 2 weighted total (raw × G)
 *   K39 = SUM(K10:K38)                            — combined max (Step 1 + Step 2 maxes)
 *   J4  = MIN(1, (I39 + I53 + I19) / (K39 + 2))   — sellability %
 *   J5  = grade bands: ≥90 A, ≥75 B, ≥60 C, ≥50 D, else F
 *   J6  = probability bands: ≥90 Very High, ≥75 High, ≥60 Medium, ≥50 Low, else Very Low
 *
 * I53 is the EBITDA size score (computed from financials, supplied separately).
 *
 * Note on the "+ 2" denominator: verified directly from XLSX. The size score can add
 * up to 75 to the numerator but only 2 to the denominator — that's why MIN(1, ...) caps
 * the result. Preserved as-is for parity with the source sheet.
 */

import type {
  ReadinessQuestionScore,
  RiskQuestionScore,
  SellabilityGrade,
  ProbabilityOfSale,
  SellabilityOutput,
} from './types';

export function computeStep1Score(readiness: ReadinessQuestionScore[]): {
  score: number;
  max: number;
} {
  let score = 0;
  let max = 0;
  for (const q of readiness) {
    if (q.trackingOnly) continue;
    score += q.rawScore; // Step 1: I = raw (NOT multiplied by G)
    max += q.weight_G * 5; // K = G × 5
  }
  return { score, max };
}

export function computeStep2Score(risk: RiskQuestionScore[]): {
  score: number;
  max: number;
} {
  let score = 0;
  let max = 0;
  for (const q of risk) {
    if (q.trackingOnly) continue;
    score += q.rawScore * q.weight_G; // Step 2: I = raw × G
    max += q.weight_G * 5;
  }
  return { score, max };
}

function gradeFromPct(pct: number): SellabilityGrade {
  if (pct >= 0.9) return 'A';
  if (pct >= 0.75) return 'B';
  if (pct >= 0.6) return 'C';
  if (pct >= 0.5) return 'D';
  return 'F';
}

function probabilityFromPct(pct: number): ProbabilityOfSale {
  if (pct >= 0.9) return 'Very High';
  if (pct >= 0.75) return 'High';
  if (pct >= 0.6) return 'Medium';
  if (pct >= 0.5) return 'Low';
  return 'Very Low';
}

export interface SellabilityInputs {
  readiness: ReadinessQuestionScore[];
  risk: RiskQuestionScore[];
  /** I53 — computed by the EBITDA module from the financials and the size lookup */
  sizeScore: number;
}

export function computeSellability(inputs: SellabilityInputs): SellabilityOutput {
  const { score: step1Score, max: step1Max } = computeStep1Score(inputs.readiness);
  const { score: step2Score, max: step2Max } = computeStep2Score(inputs.risk);
  const combinedMax = step1Max + step2Max;

  // J4 verbatim: MIN(1, (I39 + I53 + I19) / (K39 + 2))
  const numerator = step2Score + inputs.sizeScore + step1Score;
  const denominator = combinedMax + 2;
  const sellabilityPct = Math.min(1, numerator / denominator);

  return {
    step1Score,
    step1Max,
    step2Score,
    step2Max,
    combinedMax,
    sizeScore: inputs.sizeScore,
    sellabilityPct,
    grade: gradeFromPct(sellabilityPct),
    probabilityOfSale: probabilityFromPct(sellabilityPct),
  };
}
