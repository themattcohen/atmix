import type { TreatmentId, Treatment } from '../types/treatment';
import type { Question, QuestionId, SingleQuestion } from '../types/question';
import type { Bundle, BundleId } from '../types/bundle';
import { computeAllPaths, reachableTreatmentIds } from '../utils/pathResolver';

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

  // v2.0.5 server-mirrored constants
  const VALID_CATEGORIES = new Set(['iv', 'nad', 'weightLoss', 'injection', 'lab']);
  const PAGE_URL_RE = /^\/[a-zA-Z0-9_/-]+\/?$/;

  // Check all treatments
  const reachableIds = reachableTreatmentIds(computeAllPaths(questions, bundles));

  for (const [tid, t] of Object.entries(treatments) as [TreatmentId, Treatment][]) {
    // Error: missing Acuity type ID (> 0 required -- mirrors server H5)
    if (!t.acuityTypeId || t.acuityTypeId <= 0) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'acuityTypeId',
        message: 'acuityTypeId must be a positive integer -- booking flow will fail',
      });
    }

    // Error: invalid category (mirrors server H2)
    if (!VALID_CATEGORIES.has(t.category)) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'category',
        message: `category '${t.category}' is not in [iv, nad, weightLoss, injection, lab]`,
      });
    }

    // Error: name required, max 200 chars (mirrors server H3)
    if (!t.name || t.name.trim() === '') {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'name',
        message: 'name is required',
      });
    } else if (t.name.length > 200) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'name',
        message: `name exceeds 200 characters (${t.name.length})`,
      });
    }

    // Error: pageUrl format (mirrors server H4)
    if (t.pageUrl && t.pageUrl.trim() !== '') {
      if (t.pageUrl.length > 200) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: 'pageUrl',
          message: `pageUrl exceeds 200 characters (${t.pageUrl.length})`,
        });
      } else if (!PAGE_URL_RE.test(t.pageUrl)) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: 'pageUrl',
          message: `pageUrl must match ^/[a-zA-Z0-9_/-]+/?$`,
        });
      }
    }

    // Error: shortDesc max 500 chars
    if (t.shortDesc && t.shortDesc.length > 500) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'shortDesc',
        message: `shortDesc exceeds 500 characters (${t.shortDesc.length})`,
      });
    }

    // Error: whyMatch max 5000 chars
    if (t.whyMatch && t.whyMatch.length > 5000) {
      errors.push({
        severity: 'error',
        subject: `treatment:${tid}`,
        field: 'whyMatch',
        message: `whyMatch exceeds 5000 characters (${t.whyMatch.length})`,
      });
    }

    // Error: ingredient name/benefit length caps
    t.ingredients.forEach((ing, idx) => {
      if (ing.name.length > 100) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: `ingredients[${idx}].name`,
          message: `ingredient name exceeds 100 characters (${ing.name.length})`,
        });
      }
      if (ing.benefit.length > 300) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: `ingredients[${idx}].benefit`,
          message: `ingredient benefit exceeds 300 characters (${ing.benefit.length})`,
        });
      }
    });

    // Error: bestFor entry max 100 chars
    t.bestFor.forEach((entry, idx) => {
      if (entry.length > 100) {
        errors.push({
          severity: 'error',
          subject: `treatment:${tid}`,
          field: `bestFor[${idx}]`,
          message: `bestFor entry exceeds 100 characters (${entry.length})`,
        });
      }
    });

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
    // Error: missing Acuity type ID on bundle (> 0 required)
    if (!b.acuityTypeId || b.acuityTypeId <= 0) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'acuityTypeId',
        message: 'acuityTypeId must be a positive integer -- booking flow will fail',
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

    // Error: bundle name required, max 200 chars
    if (!b.name || b.name.trim() === '') {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'name',
        message: 'name is required',
      });
    } else if (b.name.length > 200) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'name',
        message: `name exceeds 200 characters (${b.name.length})`,
      });
    }

    // Error: bundle pageUrl format
    if (b.pageUrl && b.pageUrl.trim() !== '') {
      if (b.pageUrl.length > 200) {
        errors.push({
          severity: 'error',
          subject: `bundle:${bid}`,
          field: 'pageUrl',
          message: `pageUrl exceeds 200 characters (${b.pageUrl.length})`,
        });
      } else if (!PAGE_URL_RE.test(b.pageUrl)) {
        errors.push({
          severity: 'error',
          subject: `bundle:${bid}`,
          field: 'pageUrl',
          message: `pageUrl must match ^/[a-zA-Z0-9_/-]+/?$`,
        });
      }
    }

    // Error: bundle shortDesc max 500 chars
    if (b.shortDesc && b.shortDesc.length > 500) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'shortDesc',
        message: `shortDesc exceeds 500 characters (${b.shortDesc.length})`,
      });
    }

    // Error: bundle price must be >= 0 if set
    if (b.price !== undefined && b.price !== null && b.price < 0) {
      errors.push({
        severity: 'error',
        subject: `bundle:${bid}`,
        field: 'price',
        message: 'price must be >= 0',
      });
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
