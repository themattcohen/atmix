/**
 * editor/types.ts -- EditableTreatment type and dirty-check utilities.
 *
 * No React dependency. Pure TypeScript.
 * The editor works on mutable copies of Treatment objects so React controlled
 * inputs can freely update them without violating the `as const` readonly
 * constraints of the catalog objects.
 */

import type { Treatment, TreatmentId, TreatmentCategory, Ingredient } from '../../../types/treatment';

// ── Mutable ingredient (mirrors Ingredient but without readonly) ──────────────

export interface MutableIngredient {
  name: string;
  benefit: string;
}

// ── EditableTreatment ─────────────────────────────────────────────────────────
//
// Every field from Treatment, with readonly stripped. Arrays become plain
// mutable arrays. Optional fields are present as string | undefined.

export interface EditableTreatment {
  id: TreatmentId;                        // never changed in the editor
  name: string;
  price: number;
  priceLabel: string | undefined;         // optional; empty string = absent
  duration: string;
  category: TreatmentCategory;            // read-only in the editor UI
  acuityTypeId: number;
  acuityDropdownValue: string | null;
  pageUrl: string;
  shortDesc: string;
  ingredients: MutableIngredient[];
  bestFor: string[];
  whyMatch: string;
  scoringWeights: Record<string, number>; // only keys with weight > 0
  addressedBy: Record<string, string>;
  addonSuggestions: TreatmentId[];
  note: string | undefined;               // optional; empty string = absent
  tests: string[] | undefined;            // lab-specific; undefined if absent
}

// ── Clone: Treatment (readonly) -> EditableTreatment (mutable) ───────────────

export function cloneToEditable(t: Treatment): EditableTreatment {
  return {
    id: t.id,
    name: t.name,
    price: t.price,
    priceLabel: t.priceLabel,
    duration: t.duration,
    category: t.category,
    acuityTypeId: t.acuityTypeId,
    acuityDropdownValue: t.acuityDropdownValue,
    pageUrl: t.pageUrl,
    shortDesc: t.shortDesc,
    ingredients: t.ingredients.map((ing) => ({ name: ing.name, benefit: ing.benefit })),
    bestFor: [...t.bestFor],
    whyMatch: t.whyMatch,
    // Only retain entries with weight > 0 to keep the editor clean
    scoringWeights: Object.fromEntries(
      Object.entries(t.scoringWeights)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => [k, v as number]),
    ) as Record<string, number>,
    addressedBy: { ...t.addressedBy },
    addonSuggestions: [...t.addonSuggestions],
    note: t.note,
    tests: t.tests ? [...t.tests] : undefined,
  };
}

// ── Clone all treatments in a map ────────────────────────────────────────────

export function cloneAllToEditable(
  treatments: Readonly<Record<TreatmentId, Treatment>>,
): Record<TreatmentId, EditableTreatment> {
  return Object.fromEntries(
    Object.entries(treatments).map(([id, t]) => [id, cloneToEditable(t)]),
  ) as Record<TreatmentId, EditableTreatment>;
}

// ── Dirty check ──────────────────────────────────────────────────────────────
//
// Compares a draft EditableTreatment against the original Treatment by
// serializing both to the same canonical JSON representation.

function canonicalize(draft: EditableTreatment): string {
  return JSON.stringify({
    name: draft.name,
    price: draft.price,
    priceLabel: draft.priceLabel ?? null,
    duration: draft.duration,
    acuityTypeId: draft.acuityTypeId,
    acuityDropdownValue: draft.acuityDropdownValue,
    pageUrl: draft.pageUrl,
    shortDesc: draft.shortDesc,
    ingredients: draft.ingredients,
    bestFor: draft.bestFor,
    whyMatch: draft.whyMatch,
    scoringWeights: draft.scoringWeights,
    addressedBy: draft.addressedBy,
    addonSuggestions: draft.addonSuggestions,
    note: draft.note ?? null,
    tests: draft.tests ?? null,
  });
}

function canonicalizeOriginal(t: Treatment): string {
  return JSON.stringify({
    name: t.name,
    price: t.price,
    priceLabel: t.priceLabel ?? null,
    duration: t.duration,
    acuityTypeId: t.acuityTypeId,
    acuityDropdownValue: t.acuityDropdownValue,
    pageUrl: t.pageUrl,
    shortDesc: t.shortDesc,
    ingredients: t.ingredients.map((ing) => ({ name: ing.name, benefit: ing.benefit })),
    bestFor: [...t.bestFor],
    whyMatch: t.whyMatch,
    scoringWeights: Object.fromEntries(
      Object.entries(t.scoringWeights)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => [k, v as number]),
    ),
    addressedBy: { ...t.addressedBy },
    addonSuggestions: [...t.addonSuggestions],
    note: t.note ?? null,
    tests: t.tests ? [...t.tests] : null,
  });
}

/**
 * Returns true if the draft has been modified relative to the original.
 */
export function isDirty(draft: EditableTreatment, original: Treatment): boolean {
  return canonicalize(draft) !== canonicalizeOriginal(original);
}

// ── Build a Treatment-shaped map from EditableTreatments ─────────────────────
//
// Used to pass current drafts into validateConfig, which expects the full
// Readonly<Record<TreatmentId, Treatment>> signature.

export function toTreatmentMap(
  drafts: Record<TreatmentId, EditableTreatment>,
): Readonly<Record<TreatmentId, Treatment>> {
  return Object.fromEntries(
    Object.entries(drafts).map(([id, d]) => [id, editableToTreatment(d)]),
  ) as Readonly<Record<TreatmentId, Treatment>>;
}

/**
 * Convert an EditableTreatment back to the Treatment interface shape.
 * The result is structurally compatible with Treatment (no `as const`
 * deep-readonly, but that is only a compile-time annotation).
 */
export function editableToTreatment(d: EditableTreatment): Treatment {
  const t: Treatment = {
    id: d.id,
    name: d.name,
    price: d.price,
    duration: d.duration,
    category: d.category,
    acuityTypeId: d.acuityTypeId,
    acuityDropdownValue: d.acuityDropdownValue,
    pageUrl: d.pageUrl,
    shortDesc: d.shortDesc,
    ingredients: d.ingredients.map((ing) => ({
      name: ing.name,
      benefit: ing.benefit,
    })) as unknown as readonly Ingredient[],
    bestFor: d.bestFor as unknown as readonly string[],
    whyMatch: d.whyMatch,
    scoringWeights: d.scoringWeights,
    addressedBy: d.addressedBy,
    addonSuggestions: d.addonSuggestions as unknown as readonly TreatmentId[],
  };

  if (d.priceLabel !== undefined && d.priceLabel !== '') {
    (t as { priceLabel?: string }).priceLabel = d.priceLabel;
  }
  if (d.note !== undefined && d.note !== '') {
    (t as { note?: string }).note = d.note;
  }
  if (d.tests !== undefined && d.tests.length > 0) {
    (t as { tests?: readonly string[] }).tests = d.tests as unknown as readonly string[];
  }

  return t;
}

// ── Derive dirty and error ID sets (for sidebar indicators) ──────────────────

import type { ValidationResult } from '../../../engine/validateConfig';

/**
 * Returns the set of treatment IDs that have at least one validation error.
 * Parses subjects of the form 'treatment:<id>'.
 */
export function computeErrorIds(result: ValidationResult | null): Set<TreatmentId> {
  const ids = new Set<TreatmentId>();
  if (!result) return ids;
  for (const issue of result.errors) {
    if (issue.subject.startsWith('treatment:')) {
      ids.add(issue.subject.slice('treatment:'.length) as TreatmentId);
    }
  }
  return ids;
}

/**
 * Returns the validation errors/warnings for a specific treatment ID.
 */
export function issuesForTreatment(
  result: ValidationResult | null,
  id: TreatmentId,
) {
  if (!result) return { errors: [], warnings: [] };
  const subject = `treatment:${id}`;
  return {
    errors: result.errors.filter((i) => i.subject === subject),
    warnings: result.warnings.filter((i) => i.subject === subject),
  };
}

// ── EditableBundle ────────────────────────────────────────────────────────────

import type { Bundle, BundleId } from '../../../types/bundle';

export interface EditableBundle {
  id: BundleId;
  name: string;
  primary: string;       // treatment ID
  addOn: string | null;  // treatment ID or null
  addOnInteractive: boolean;
  whyMatch: string;
  acuityTypeId: number;
  // Fields that now have editor UIs (previously preservation-only)
  addOnLabel?: string;
  acuityDropdownValue?: string | null;
  price?: number;
  priceLabel?: string;
  shortDesc?: string;
  pageUrl?: string;
}

// ── Clone: Bundle (readonly) -> EditableBundle (mutable) ─────────────────────

export function cloneBundleToEditable(b: Bundle): EditableBundle {
  return {
    id: b.id,
    name: b.name,
    primary: b.primary,
    addOn: b.addOn ?? null,
    addOnInteractive: b.addOnInteractive,
    whyMatch: b.whyMatch,
    acuityTypeId: b.acuityTypeId ?? 0,
    addOnLabel: b.addOnLabel,
    acuityDropdownValue: b.acuityDropdownValue,
    price: b.price,
    priceLabel: b.priceLabel,
    shortDesc: b.shortDesc,
    pageUrl: b.pageUrl,
  };
}

// ── Clone all bundles in a record ────────────────────────────────────────────

export function cloneAllBundlesToEditable(
  bundles: Readonly<Record<BundleId, Bundle>>,
): Record<BundleId, EditableBundle> {
  return Object.fromEntries(
    Object.entries(bundles).map(([id, b]) => [id, cloneBundleToEditable(b as Bundle)]),
  ) as Record<BundleId, EditableBundle>;
}

// ── Bundle dirty check ────────────────────────────────────────────────────────

function canonicalizeBundle(b: EditableBundle): string {
  return JSON.stringify({
    name: b.name,
    primary: b.primary,
    addOn: b.addOn,
    addOnInteractive: b.addOnInteractive,
    whyMatch: b.whyMatch,
    acuityTypeId: b.acuityTypeId,
    addOnLabel: b.addOnLabel ?? null,
    acuityDropdownValue: b.acuityDropdownValue ?? null,
    price: b.price ?? null,
    priceLabel: b.priceLabel ?? null,
    shortDesc: b.shortDesc ?? null,
    pageUrl: b.pageUrl ?? null,
  });
}

function canonicalizeBundleOriginal(b: Bundle): string {
  return JSON.stringify({
    name: b.name,
    primary: b.primary,
    addOn: b.addOn ?? null,
    addOnInteractive: b.addOnInteractive,
    whyMatch: b.whyMatch,
    acuityTypeId: b.acuityTypeId ?? 0,
    addOnLabel: b.addOnLabel ?? null,
    acuityDropdownValue: b.acuityDropdownValue ?? null,
    price: b.price ?? null,
    priceLabel: b.priceLabel ?? null,
    shortDesc: b.shortDesc ?? null,
    pageUrl: b.pageUrl ?? null,
  });
}

export function isBundleDirty(draft: EditableBundle, original: Bundle): boolean {
  return canonicalizeBundle(draft) !== canonicalizeBundleOriginal(original);
}

// ── Derive dirty bundle ID sets ───────────────────────────────────────────────

export function computeDirtyBundleIds(
  drafts: Record<BundleId, EditableBundle>,
  originals: Readonly<Record<BundleId, Bundle>>,
): Set<BundleId> {
  const dirty = new Set<BundleId>();
  for (const id of Object.keys(drafts) as BundleId[]) {
    if (isBundleDirty(drafts[id], originals[id])) {
      dirty.add(id);
    }
  }
  return dirty;
}

// ── EditableOption / EditableQuestion ─────────────────────────────────────────

import type { Question, SingleQuestion, MultiQuestion, SingleOption, SymptomOption } from '../../../types/question';
import type { QuestionId } from '../../../types/question';

export interface EditableOption {
  label: string;
  sublabel: string;
  icon: string;
  next: string;       // question ID, '' if using recommend
  recommend: string;  // treatment/bundle ID, '' if using next
}

export interface EditableQuestion {
  id: string;
  type: 'single' | 'multi';
  title: string;
  subtitle: string;
  options: EditableOption[];
}

// ── Clone: Question (readonly) -> EditableQuestion (mutable) ─────────────────

function cloneOptionToEditable(opt: SingleOption | SymptomOption): EditableOption {
  return {
    label: opt.label,
    sublabel: opt.sublabel ?? '',
    icon: opt.icon ?? '',
    next: ('next' in opt ? opt.next : undefined) ?? '',
    recommend: ('recommend' in opt ? opt.recommend : undefined) ?? '',
  };
}

export function cloneQuestionToEditable(q: Question): EditableQuestion {
  return {
    id: q.id,
    type: q.type,
    title: q.title,
    subtitle: q.subtitle ?? '',
    options: q.options.map((opt) => cloneOptionToEditable(opt as SingleOption | SymptomOption)),
  };
}

export function cloneAllQuestionsToEditable(
  questions: Record<string, Question>,
): Record<string, EditableQuestion> {
  return Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [id, cloneQuestionToEditable(q)]),
  );
}

// ── Question dirty checks ─────────────────────────────────────────────────────

function canonicalizeQuestion(q: EditableQuestion): string {
  return JSON.stringify({
    title: q.title,
    subtitle: q.subtitle,
    options: q.options.map((o) => ({
      label: o.label,
      sublabel: o.sublabel,
      icon: o.icon,
      next: o.next,
      recommend: o.recommend,
    })),
  });
}

export function isQuestionDirty(draft: EditableQuestion, original: EditableQuestion): boolean {
  return canonicalizeQuestion(draft) !== canonicalizeQuestion(original);
}

export function computeDirtyQuestionIds(
  drafts: Record<string, EditableQuestion>,
  originals: Record<string, EditableQuestion>,
): Set<string> {
  const dirty = new Set<string>();
  for (const id of Object.keys(drafts)) {
    const orig = originals[id];
    if (!orig || isQuestionDirty(drafts[id], orig)) {
      dirty.add(id);
    }
  }
  return dirty;
}

// ── Convert EditableQuestion drafts back to Question map ─────────────────────

function editableToSingleOption(o: EditableOption): SingleOption {
  return {
    label: o.label,
    ...(o.sublabel ? { sublabel: o.sublabel } : {}),
    ...(o.icon ? { icon: o.icon } : {}),
    ...(o.next ? { next: o.next as QuestionId } : {}),
    ...(o.recommend ? { recommend: o.recommend } : {}),
  } as SingleOption;
}

function editableToSymptomOption(o: EditableOption): SymptomOption {
  return {
    label: o.label,
    ...(o.sublabel ? { sublabel: o.sublabel } : {}),
    ...(o.icon ? { icon: o.icon } : {}),
  } as SymptomOption;
}

function editableToQuestion(q: EditableQuestion): Question {
  if (q.type === 'multi') {
    const mq: MultiQuestion = {
      id: q.id as 'symptoms',
      type: 'multi',
      title: q.title,
      options: q.options.map(editableToSymptomOption) as unknown as readonly SymptomOption[],
    };
    if (q.subtitle) (mq as { subtitle?: string }).subtitle = q.subtitle;
    return mq;
  }
  const sq: SingleQuestion = {
    id: q.id as QuestionId,
    type: 'single',
    title: q.title,
    options: q.options.map(editableToSingleOption) as unknown as readonly SingleOption[],
  };
  if (q.subtitle) (sq as { subtitle?: string }).subtitle = q.subtitle;
  return sq;
}

export function toQuestionMap(
  drafts: Record<string, EditableQuestion>,
): Record<string, Question> {
  return Object.fromEntries(
    Object.entries(drafts).map(([id, q]) => [id, editableToQuestion(q)]),
  );
}
