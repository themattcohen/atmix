import type { TreatmentId, Treatment } from '../types/treatment';
import type { ScoringCandidate, ScoringResult } from '../types/scoring';
import { RULES } from '../constants/rules';

export function scoreSymptoms(
  selectedSymptomLabels: readonly string[],
  treatments: Readonly<Record<TreatmentId, Treatment>>,
): ScoringResult {
  if (selectedSymptomLabels.length === 0) {
    return { results: [], primaryTreatmentId: null };
  }

  // Step 1: Accumulate scores across all treatments
  const scores: Partial<Record<TreatmentId, number>> = {};
  const matchingSymptoms: Partial<Record<TreatmentId, string[]>> = {};
  const addressedByTexts: Partial<Record<TreatmentId, string[]>> = {};

  for (const [tid, t] of Object.entries(treatments) as [TreatmentId, Treatment][]) {
    for (const label of selectedSymptomLabels) {
      const weight = t.scoringWeights[label];
      if (!weight) continue;

      scores[tid] = (scores[tid] ?? 0) + weight;
      if (!matchingSymptoms[tid]) matchingSymptoms[tid] = [];
      matchingSymptoms[tid]!.push(label);

      const text = t.addressedBy[label];
      if (text) {
        if (!addressedByTexts[tid]) addressedByTexts[tid] = [];
        if (!addressedByTexts[tid]!.includes(text)) {
          addressedByTexts[tid]!.push(text);
        }
      }
    }
  }

  // Step 2: Build candidates
  const candidates: ScoringCandidate[] = (Object.entries(scores) as [TreatmentId, number][])
    .map(([treatmentId, score]) => ({
      treatmentId,
      score,
      category: treatments[treatmentId].category,
      matchingSymptoms: matchingSymptoms[treatmentId] ?? [],
      addressedByTexts: addressedByTexts[treatmentId] ?? [],
    }));

  // Step 3: Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  // Step 4: Deduplicate by category (keep highest scorer per category)
  const seenCategories = new Set<string>();
  const deduped = candidates.filter((c) => {
    if (seenCategories.has(c.category)) return false;
    seenCategories.add(c.category);
    return true;
  });

  // Step 5: Split into buckets (exact v1 bucket definitions)
  const ivNadResults   = deduped.filter((c) => (RULES.IV_NAD_CATEGORIES as readonly string[]).includes(c.category));
  const programResults = deduped.filter((c) => (RULES.WEIGHT_LOSS_CATEGORIES as readonly string[]).includes(c.category));
  const labResults     = deduped.filter((c) => (RULES.LAB_INJECTION_CATEGORIES as readonly string[]).includes(c.category));

  // Step 6: Assemble (top 3 IV/NAD + all programs + all labs/injections)
  const results: readonly ScoringCandidate[] = [
    ...ivNadResults.slice(0, RULES.MAX_IV_NAD_RESULTS),
    ...programResults,
    ...labResults,
  ];

  return {
    results,
    primaryTreatmentId: results.length > 0 ? results[0].treatmentId : null,
  };
}
