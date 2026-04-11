import type { TreatmentId } from './treatment';
import type { BundleId } from './bundle';

export type QuestionId =
  | 'start'
  | 'acute'
  | 'wellness'
  | 'energy'
  | 'dehydratedOrTired'
  | 'athleticGoal'
  | 'nadDose'
  | 'antiAging'
  | 'myersUpgrade'
  | 'quickShot'
  | 'weightLoss'
  | 'weightLossBoost'
  | 'glp1Choice'
  | 'glp1Compare'
  | 'labs'
  | 'symptoms';

// The join key used to look up treatment scoring weights and addressedBy texts.
// Must match Treatment.scoringWeights keys exactly (validated by validateConfig at startup).
export type RecommendId = TreatmentId | BundleId;

// Single-select navigation option
export interface SingleOption {
  readonly label: string;
  readonly sublabel?: string;
  readonly icon?: string;
  readonly next?: QuestionId;
  readonly recommend?: RecommendId;
}

// Multi-select symptom option.
// label is used as the join key against Treatment.scoringWeights and Treatment.addressedBy.
// It must match exactly (case-sensitive). validateConfig() checks this at startup.
export interface SymptomOption {
  readonly label: string;
  readonly sublabel?: string;
  readonly icon?: string;
}

export interface SingleQuestion {
  readonly id: QuestionId;
  readonly type: 'single';
  readonly title: string;
  readonly subtitle?: string;
  readonly options: readonly SingleOption[];
}

export interface MultiQuestion {
  readonly id: 'symptoms';          // only one multi question exists
  readonly type: 'multi';
  readonly title: string;
  readonly subtitle?: string;
  readonly options: readonly SymptomOption[];
}

export type Question = SingleQuestion | MultiQuestion;
