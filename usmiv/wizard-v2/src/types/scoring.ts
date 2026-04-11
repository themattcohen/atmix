import type { TreatmentId, TreatmentCategory } from './treatment';

export interface ScoringCandidate {
  readonly treatmentId: TreatmentId;
  readonly score: number;
  readonly category: TreatmentCategory;
  readonly matchingSymptoms: readonly string[];
  readonly addressedByTexts: readonly string[];
}

export interface ScoringResult {
  readonly results: readonly ScoringCandidate[];
  // The primary result (first element) drives addon suggestions
  readonly primaryTreatmentId: TreatmentId | null;
}
