import { IV_TREATMENTS }          from './catalog/iv';
import { NAD_TREATMENTS }         from './catalog/nad';
import { WEIGHT_LOSS_TREATMENTS } from './catalog/weightLoss';
import { INJECTION_TREATMENTS }   from './catalog/injections';
import { LAB_TREATMENTS }         from './catalog/labs';
import { BUNDLES_ARRAY }          from './bundles';
import { QUESTIONS_ARRAY }        from './questions';
import type { TreatmentId, Treatment } from '../types/treatment';
import type { BundleId, Bundle }       from '../types/bundle';
import type { QuestionId, Question }   from '../types/question';

const ALL_TREATMENTS = [
  ...IV_TREATMENTS,
  ...NAD_TREATMENTS,
  ...WEIGHT_LOSS_TREATMENTS,
  ...INJECTION_TREATMENTS,
  ...LAB_TREATMENTS,
] as const;

// O(1) lookup map used by engine and components
export const TREATMENTS: Readonly<Record<TreatmentId, Treatment>> =
  Object.fromEntries(ALL_TREATMENTS.map((t) => [t.id, t])) as unknown as Readonly<Record<TreatmentId, Treatment>>;

export const BUNDLES: Readonly<Record<BundleId, Bundle>> =
  Object.fromEntries(BUNDLES_ARRAY.map((b) => [b.id, b])) as unknown as Readonly<Record<BundleId, Bundle>>;

export const QUESTIONS: Readonly<Record<QuestionId, Question>> =
  Object.fromEntries(QUESTIONS_ARRAY.map((q) => [q.id, q])) as unknown as Readonly<Record<QuestionId, Question>>;

export { META } from './meta';

// The 10 symptom option labels in display order.
// Used by the scoring engine as join keys against Treatment.scoringWeights.
// Must stay in sync with the options array in questions.ts.
export const SYMPTOM_LABELS: readonly string[] = [
  'Tired all the time',
  'Frequent headaches',
  'Getting sick often',
  'Skin looks dull or aging',
  'Sore muscles / slow recovery',
  'Struggling with weight',
  "Brain fog / can't focus",
  'Dehydrated / dry all the time',
  'Stressed and burnt out',
  "Not sure what I'm missing",
];
