import type { TreatmentId, Treatment } from '../types/treatment';
import type { Question, QuestionId, SingleQuestion } from '../types/question';
import type { Bundle, BundleId } from '../types/bundle';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  subject: string;   // e.g., "treatment:hangover" or "question:myersUpgrade[1]"
  field: string;     // e.g., "acuityTypeId" or "options[1].recommend"
  message: string;
}

export interface ValidationResult {
  errors:   readonly ValidationIssue[];
  warnings: readonly ValidationIssue[];
  isValid: boolean;  // true only if errors is empty
}

// Walk all question paths from 'start' and collect every recommend value
// reachable via single-select navigation. Bundles are resolved to their
// primary treatmentId as well, so we track treatment reachability correctly.
function collectReachableIds(
  questions: Readonly<Record<QuestionId, Question>>,
  bundles: Readonly<Record<BundleId, Bundle>>,
): Set<string> {
  const reachable = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = ['start'];

  while (queue.length > 0) {
    const qid = queue.shift()!;
    if (visited.has(qid)) continue;
    visited.add(qid);

    const q = questions[qid as QuestionId];
    if (!q || q.type !== 'single') continue;

    for (const opt of (q as SingleQuestion).options) {
      if (opt.recommend) {
        reachable.add(opt.recommend);
        // If the recommend is a bundle, also mark the bundle's primary as reachable
        const bundle = bundles[opt.recommend as BundleId];
        if (bundle) {
          reachable.add(bundle.primary);
          if (bundle.addOn) reachable.add(bundle.addOn);
        }
      }
      if (opt.next) {
        queue.push(opt.next);
      }
    }
  }

  return reachable;
}

export function validateConfig(
  treatments: Readonly<Record<TreatmentId, Treatment>>,
  questions:  Readonly<Record<QuestionId, Question>>,
  bundles:    Readonly<Record<BundleId,   Bundle>>,
): ValidationResult {
  const errors:   ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const allTreatmentIds  = new Set(Object.keys(treatments));
  const allQuestionIds   = new Set(Object.keys(questions));
  const allBundleIds     = new Set(Object.keys(bundles));
  const validRecommendIds = new Set([...allTreatmentIds, ...allBundleIds]);

  // Collect all symptom option labels from the symptoms question
  const symptomsQ = questions['symptoms' as QuestionId];
  const symptomLabels = symptomsQ?.type === 'multi'
    ? new Set(symptomsQ.options.map((o) => o.label))
    : new Set<string>();

  // Check all question options
  for (const [qid, q] of Object.entries(questions)) {
    if (q.type === 'single') {
      (q as SingleQuestion).options.forEach((opt, i) => {
        if (opt.recommend && !validRecommendIds.has(opt.recommend)) {
          errors.push({
            severity: 'error',
            subject: `question:${qid}[${i}]`,
            field: 'recommend',
            message: `'${opt.recommend}' is not a valid TreatmentId or BundleId`,
          });
        }
        if (opt.next && !allQuestionIds.has(opt.next)) {
          errors.push({
            severity: 'error',
            subject: `question:${qid}[${i}]`,
            field: 'next',
            message: `'${opt.next}' is not a valid QuestionId`,
          });
        }
      });
    }
  }

  // Check all treatments
  const reachableIds = collectReachableIds(questions, bundles);

  for (const [tid, t] of Object.entries(treatments) as [TreatmentId, Treatment][]) {
    // Error: missing Acuity type ID
    if (t.acuityTypeId === 0) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'acuityTypeId',
        message: 'acuityTypeId is 0 -- booking flow will fail',
      });
    }

    // Error: orphan symptom weight key (typo guard)
    for (const key of Object.keys(t.scoringWeights)) {
      if (!symptomLabels.has(key)) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: `scoringWeights['${key}']`,
          message: `'${key}' does not match any symptom option label in the symptoms question`,
        });
      }
    }

    // Error: broken addonSuggestions reference
    for (const addonId of t.addonSuggestions) {
      if (!allTreatmentIds.has(addonId)) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: 'addonSuggestions',
          message: `'${addonId}' is not a valid TreatmentId`,
        });
      }
    }

    // Warning: unreachable treatment (not in any question path AND no scoring weights)
    const isScoringReachable = Object.keys(t.scoringWeights).length > 0;
    const isDirectlyReachable = reachableIds.has(tid);
    if (!isScoringReachable && !isDirectlyReachable) {
      warnings.push({
        severity: 'warning',
        subject: `treatment:${tid}`,
        field: 'reachability',
        message: 'treatment is unreachable -- not referenced by any question path and has no scoringWeights',
      });
    }

    // Warning: empty whyMatch
    if (t.whyMatch.trim() === '') {
      warnings.push({
        severity: 'warning',
        subject: `treatment:${tid}`,
        field: 'whyMatch',
        message: 'whyMatch is empty -- result screen will show no explanation',
      });
    }

    // Warning: empty addonSuggestions
    if (t.addonSuggestions.length === 0) {
      warnings.push({
        severity: 'warning',
        subject: `treatment:${tid}`,
        field: 'addonSuggestions',
        message: 'addonSuggestions is empty -- no upsell opportunity',
      });
    }

    // Warning: missing addressedBy text for a scored symptom
    for (const [symptom, weight] of Object.entries(t.scoringWeights)) {
      if ((weight ?? 0) > 0 && !t.addressedBy[symptom]) {
        warnings.push({
          severity: 'warning',
          subject: `treatment:${tid}`,
          field: `addressedBy['${symptom}']`,
          message: `treatment scores symptom '${symptom}' but has no addressedBy text for it`,
        });
      }
    }
  }

  // Check all bundles
  for (const [bid, b] of Object.entries(bundles)) {
    // Error: missing Acuity type ID on bundle
    if (b.acuityTypeId === 0) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'acuityTypeId',
        message: 'acuityTypeId is 0 -- booking flow will fail',
      });
    }

    // Error: broken bundle primary reference
    if (!allTreatmentIds.has(b.primary)) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'primary',
        message: `'${b.primary}' is not a valid TreatmentId`,
      });
    }

    // Error: broken bundle addOn reference
    if (b.addOn && !allTreatmentIds.has(b.addOn)) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'addOn',
        message: `'${b.addOn}' is not a valid TreatmentId`,
      });
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
