/**
 * issueMapper.ts -- Enriches raw ValidationIssues with human-readable metadata.
 *
 * Bridges the gap between machine-generated validation output and the editor UI.
 * Each issue is augmented with a plain-English explanation of what the field does
 * and how to fix the problem.
 */

import type { ValidationResult, ValidationIssue } from '../engine/validateConfig';
import type { TreatmentId } from '../types/treatment';

// ── MappedIssue ───────────────────────────────────────────────────────────────

export interface MappedIssue {
  /** The raw field name from the ValidationIssue (e.g. "acuityTypeId") */
  field: string;
  /** The raw validation message */
  message: string;
  /** error or warning */
  severity: 'error' | 'warning';
  /** Plain-English explanation of what this field is for */
  why: string;
  /** Actionable fix instruction */
  fix: string;
  /** Which editor section to look in */
  editorSection: string;
}

// ── Field metadata lookup ─────────────────────────────────────────────────────

interface FieldMeta {
  why: string;
  fix: string;
  editorSection: string;
}

/**
 * Lookup table keyed by field name prefix. When a field like
 * `scoringWeights['Headache']` or `addressedBy['Nausea']` comes in,
 * we match the leading key segment.
 */
const FIELD_METADATA: Record<string, FieldMeta> = {
  acuityTypeId: {
    why: 'The Acuity type ID links this treatment to the correct appointment type in the Acuity scheduling system. A value of 0 means no type has been assigned, so the booking flow cannot complete.',
    fix: 'Log into Acuity Scheduling, find the appointment type for this treatment, and paste its numeric ID into the Acuity Type ID field.',
    editorSection: 'Basic Info',
  },
  reachability: {
    why: 'A treatment is reachable when at least one question-path option points to it (via recommend), OR when it has scoring weights so the recommendation engine can surface it. Neither condition is met here.',
    fix: 'Either add this treatment as a "recommend" on a question option, or give it non-zero scoring weights for the symptoms it addresses.',
    editorSection: 'Scoring Weights',
  },
  whyMatch: {
    why: 'The whyMatch text explains to the patient why this treatment was recommended for them. It appears on the results screen below the treatment name.',
    fix: 'Write 1–3 sentences explaining why this treatment addresses the patient\'s selected symptoms or goals.',
    editorSection: 'Descriptions',
  },
  addonSuggestions: {
    why: 'Addon suggestions are injection treatments shown alongside this treatment as optional enhancements. An empty list means no upsell is offered to the patient.',
    fix: 'Check the Addon Suggestions section and tick at least one injection treatment that pairs well with this one.',
    editorSection: 'Addon Suggestions',
  },
  scoringWeights: {
    why: 'Scoring weights control how strongly this treatment scores for each symptom in the recommendation engine. A key that does not match any symptom label in the symptoms question will never fire.',
    fix: 'Open the Scoring Weights section. Remove the mismatched key and re-enter it using the exact label from the symptoms question (case-sensitive).',
    editorSection: 'Scoring Weights',
  },
  addressedBy: {
    why: 'addressedBy provides a short phrase shown on the results screen for each symptom this treatment scores. A missing entry means the symptom contribution is silent to the patient.',
    fix: 'In the Scoring Weights section, fill in the "Addressed by text" field for the flagged symptom.',
    editorSection: 'Scoring Weights',
  },
};

/**
 * Resolve metadata for a raw field name. Tries exact match first, then
 * prefix match (e.g. `scoringWeights['key']` -> `scoringWeights`).
 */
function resolveMetadata(field: string): FieldMeta {
  if (FIELD_METADATA[field]) return FIELD_METADATA[field];

  // Try prefix match: take the part before '[' or '.'
  const prefix = field.split(/[.[]/, 1)[0];
  if (FIELD_METADATA[prefix]) return FIELD_METADATA[prefix];

  // Fallback for fields not in the lookup (e.g. question-level fields)
  return {
    why: 'This field contains a broken or invalid reference.',
    fix: 'Review the flagged value and correct it to match an existing ID in the config.',
    editorSection: 'Basic Info',
  };
}

// ── mapIssuesToFields ─────────────────────────────────────────────────────────

/**
 * Filters all issues in `validationResult` that belong to the given treatment
 * and enriches them with human-readable metadata.
 *
 * Returns errors first, then warnings, preserving original order within each
 * group.
 */
export function mapIssuesToFields(
  validationResult: ValidationResult | null,
  treatmentId: TreatmentId,
): MappedIssue[] {
  if (!validationResult) return [];

  const subject = `treatment:${treatmentId}`;

  const matching: ValidationIssue[] = [
    ...validationResult.errors.filter((i) => i.subject === subject),
    ...validationResult.warnings.filter((i) => i.subject === subject),
  ];

  return matching.map((issue): MappedIssue => {
    const meta = resolveMetadata(issue.field);
    return {
      field: issue.field,
      message: issue.message,
      severity: issue.severity,
      why: meta.why,
      fix: meta.fix,
      editorSection: meta.editorSection,
    };
  });
}
