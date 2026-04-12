/**
 * editor/codeGen.ts -- TypeScript code generation for treatment catalog files.
 *
 * No React dependency. Pure TypeScript.
 * Output is formatted to match the hand-written catalog files in
 * src/data/catalog/ as closely as possible:
 *   - 2-space indentation
 *   - Single-quoted strings
 *   - Trailing commas on every property
 *   - Deterministic SYMPTOM_LABELS ordering for scoringWeights / addressedBy
 *   - `as const satisfies Treatment` closing line
 */

import type { TreatmentCategory } from '../../../types/treatment';
import type { EditableTreatment, EditableBundle } from './types';
import { SYMPTOM_LABELS } from '../../../data';

// ── String escaping ───────────────────────────────────────────────────────────

/**
 * Wraps a string in single quotes and escapes internal single quotes and
 * backslashes. Does NOT use JSON.stringify (that would produce double quotes).
 */
function escapeStr(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ── Ingredient formatting ─────────────────────────────────────────────────────

/**
 * Formats the ingredients array. When the array has 3+ items and all name
 * strings are short enough (< 40 chars each), the `benefit:` values are
 * padded to align at a common column. This matches the style used in iv.ts
 * (e.g., the myers object). Otherwise, no alignment.
 */
function formatIngredients(
  ingredients: EditableTreatment['ingredients'],
  indent: string,
): string {
  if (ingredients.length === 0) {
    return `${indent}ingredients: [],`;
  }

  const inner = `${indent}  `;
  const shouldAlign =
    ingredients.length >= 3 &&
    ingredients.every((ing) => ing.name.length < 40);

  let valueLines: string;

  if (shouldAlign) {
    // Pad name fields to align benefit values
    const maxNameLen = Math.max(...ingredients.map((ing) => escapeStr(ing.name).length));
    valueLines = ingredients
      .map((ing) => {
        const escapedName = escapeStr(ing.name);
        const pad = ' '.repeat(maxNameLen - escapedName.length);
        return `${inner}{ name: ${escapedName},${pad} benefit: ${escapeStr(ing.benefit)} },`;
      })
      .join('\n');
  } else {
    valueLines = ingredients
      .map((ing) => `${inner}{ name: ${escapeStr(ing.name)}, benefit: ${escapeStr(ing.benefit)} },`)
      .join('\n');
  }

  return `${indent}ingredients: [\n${valueLines}\n${indent}],`;
}

// ── bestFor formatting ────────────────────────────────────────────────────────

function formatBestFor(bestFor: string[], indent: string): string {
  if (bestFor.length === 0) {
    return `${indent}bestFor: [],`;
  }
  const items = bestFor.map((s) => escapeStr(s)).join(', ');
  return `${indent}bestFor: [${items}],`;
}

// ── scoringWeights formatting ─────────────────────────────────────────────────

/**
 * Emits scoringWeights in SYMPTOM_LABELS order (not insertion order).
 * Omits symptoms with weight 0 or absent. If no weights, emits {}.
 * When 2+ entries, aligns values on the colon column.
 */
function formatScoringWeights(
  weights: Record<string, number>,
  indent: string,
): string {
  const orderedEntries = SYMPTOM_LABELS
    .filter((label) => (weights[label] ?? 0) > 0)
    .map((label) => [label, weights[label]] as [string, number]);

  if (orderedEntries.length === 0) {
    return `${indent}scoringWeights: {},`;
  }

  if (orderedEntries.length === 1) {
    const [label, weight] = orderedEntries[0];
    return `${indent}scoringWeights: {\n${indent}  ${escapeStr(label)}: ${weight},\n${indent}},`;
  }

  // Align values when 2+ entries
  const maxKeyLen = Math.max(...orderedEntries.map(([label]) => escapeStr(label).length));
  const inner = `${indent}  `;
  const lines = orderedEntries.map(([label, weight]) => {
    const escapedKey = escapeStr(label);
    const pad = ' '.repeat(maxKeyLen - escapedKey.length);
    return `${inner}${escapedKey}:${pad} ${weight},`;
  });

  return `${indent}scoringWeights: {\n${lines.join('\n')}\n${indent}},`;
}

// ── addressedBy formatting ────────────────────────────────────────────────────

/**
 * Emits addressedBy in SYMPTOM_LABELS order. Only emits entries that exist
 * (non-empty string). Aligns values when 2+ entries.
 */
function formatAddressedBy(
  addressedBy: Record<string, string>,
  indent: string,
): string {
  const orderedEntries = SYMPTOM_LABELS
    .filter((label) => addressedBy[label] && addressedBy[label].trim() !== '')
    .map((label) => [label, addressedBy[label]] as [string, string]);

  if (orderedEntries.length === 0) {
    return `${indent}addressedBy: {},`;
  }

  if (orderedEntries.length === 1) {
    const [label, text] = orderedEntries[0];
    return `${indent}addressedBy: {\n${indent}  ${escapeStr(label)}: ${escapeStr(text)},\n${indent}},`;
  }

  // Align values when 2+ entries
  const maxKeyLen = Math.max(...orderedEntries.map(([label]) => escapeStr(label).length));
  const inner = `${indent}  `;
  const lines = orderedEntries.map(([label, text]) => {
    const escapedKey = escapeStr(label);
    const pad = ' '.repeat(maxKeyLen - escapedKey.length);
    return `${inner}${escapedKey}:${pad} ${escapeStr(text)},`;
  });

  return `${indent}addressedBy: {\n${lines.join('\n')}\n${indent}},`;
}

// ── addonSuggestions formatting ───────────────────────────────────────────────

/**
 * Single-line when 0-3 items, multi-line when 4+.
 */
function formatAddonSuggestions(ids: string[], indent: string): string {
  if (ids.length === 0) {
    return `${indent}addonSuggestions: [],`;
  }
  if (ids.length <= 3) {
    const items = ids.map((id) => escapeStr(id)).join(', ');
    return `${indent}addonSuggestions: [${items}],`;
  }
  const inner = `${indent}  `;
  const lines = ids.map((id) => `${inner}${escapeStr(id)},`).join('\n');
  return `${indent}addonSuggestions: [\n${lines}\n${indent}],`;
}

// ── Single treatment block ────────────────────────────────────────────────────

/**
 * Generates the full `export const <id> = { ... } as const satisfies Treatment;`
 * block for one treatment. Output ends with a newline.
 */
export function generateTreatmentTs(draft: EditableTreatment): string {
  const i = '  '; // 2-space indent
  const lines: string[] = [];

  lines.push(`export const ${draft.id} = {`);
  lines.push(`${i}id: ${escapeStr(draft.id)},`);
  lines.push(`${i}name: ${escapeStr(draft.name)},`);
  lines.push(`${i}price: ${draft.price},`);

  if (draft.priceLabel && draft.priceLabel.trim() !== '') {
    lines.push(`${i}priceLabel: ${escapeStr(draft.priceLabel)},`);
  }

  lines.push(`${i}duration: ${escapeStr(draft.duration)},`);
  lines.push(`${i}category: ${escapeStr(draft.category)},`);
  lines.push(`${i}acuityTypeId: ${draft.acuityTypeId},`);

  if (draft.acuityDropdownValue === null) {
    lines.push(`${i}acuityDropdownValue: null,`);
  } else {
    lines.push(`${i}acuityDropdownValue: ${escapeStr(draft.acuityDropdownValue)},`);
  }

  lines.push(`${i}pageUrl: ${escapeStr(draft.pageUrl)},`);
  lines.push(`${i}shortDesc: ${escapeStr(draft.shortDesc)},`);
  lines.push(formatIngredients(draft.ingredients, i));
  lines.push(formatBestFor(draft.bestFor, i));
  lines.push(`${i}whyMatch:`);
  // whyMatch is always written as a continuation line to stay within ~80 chars
  lines.push(`${i}  ${escapeStr(draft.whyMatch)},`);
  lines.push(formatScoringWeights(draft.scoringWeights, i));
  lines.push(formatAddressedBy(draft.addressedBy, i));
  lines.push(formatAddonSuggestions(draft.addonSuggestions, i));

  if (draft.note && draft.note.trim() !== '') {
    lines.push(`${i}note: ${escapeStr(draft.note)},`);
  }

  if (draft.tests && draft.tests.length > 0) {
    const items = draft.tests.map((t) => escapeStr(t)).join(', ');
    lines.push(`${i}tests: [${items}],`);
  }

  lines.push('} as const satisfies Treatment;');

  return lines.join('\n') + '\n';
}

// ── Category metadata ─────────────────────────────────────────────────────────

/**
 * Maps a TreatmentCategory to the exported array constant name in its
 * catalog file, matching the names used in src/data/catalog/*.ts.
 */
export function categoryConstName(category: TreatmentCategory): string {
  switch (category) {
    case 'iv':         return 'IV_TREATMENTS';
    case 'nad':        return 'NAD_TREATMENTS';
    case 'weightLoss': return 'WEIGHT_LOSS_TREATMENTS';
    case 'injection':  return 'INJECTION_TREATMENTS';
    case 'lab':        return 'LAB_TREATMENTS';
  }
}

/**
 * Maps a TreatmentCategory to the source file basename (without extension),
 * matching the actual files in src/data/catalog/.
 */
export function categoryFileName(category: TreatmentCategory): string {
  switch (category) {
    case 'iv':         return 'iv';
    case 'nad':        return 'nad';
    case 'weightLoss': return 'weightLoss';
    case 'injection':  return 'injections';
    case 'lab':        return 'labs';
  }
}

// ── Full category file ────────────────────────────────────────────────────────

/**
 * Generates the complete contents of a category file, suitable for replacing
 * e.g. src/data/catalog/iv.ts in its entirety.
 *
 * Format:
 *   import type { Treatment } from '../../types/treatment';
 *   <blank line>
 *   <export const t1 = ...>
 *   <blank line>
 *   <export const t2 = ...>
 *   ...
 *   <blank line>
 *   export const IV_TREATMENTS = [
 *     t1,
 *     t2,
 *   ] as const;
 */
export function generateCategoryFileTs(
  drafts: EditableTreatment[],
  category: TreatmentCategory,
): string {
  const constName = categoryConstName(category);

  const blocks: string[] = [];

  // File header
  blocks.push("import type { Treatment } from '../../types/treatment';");
  blocks.push('');

  // Treatment export blocks, separated by blank lines
  for (const draft of drafts) {
    blocks.push(generateTreatmentTs(draft));
    blocks.push('');
  }

  // Footer array
  const footerIds = drafts.map((d) => `  ${d.id},`).join('\n');
  blocks.push(`export const ${constName} = [`);
  blocks.push(footerIds);
  blocks.push('] as const;');
  blocks.push('');

  return blocks.join('\n');
}

// ── Bundle code generation ────────────────────────────────────────────────────

/**
 * Generates the `export const <id> = { ... } as const satisfies Bundle;` block
 * for a single bundle. Matches the format of src/data/bundles.ts.
 * Output ends with a newline.
 */
export function generateBundleTs(bundle: EditableBundle): string {
  const i = '  ';
  const lines: string[] = [];

  lines.push(`export const ${bundle.id} = {`);
  lines.push(`${i}id: ${escapeStr(bundle.id)},`);
  lines.push(`${i}name: ${escapeStr(bundle.name)},`);
  lines.push(`${i}primary: ${escapeStr(bundle.primary)},`);

  if (bundle.addOn !== null && bundle.addOn.trim() !== '') {
    lines.push(`${i}addOn: ${escapeStr(bundle.addOn)},`);
    // addOnLabel is not editable in this editor (we omit it from EditableBundle),
    // so we emit a placeholder comment to prompt manual update.
    lines.push(`${i}// TODO: update addOnLabel if needed`);
  }

  lines.push(`${i}addOnInteractive: ${bundle.addOnInteractive},`);
  lines.push(`${i}isConsultation: false,`);
  lines.push(`${i}whyMatch:`);
  lines.push(`${i}  ${escapeStr(bundle.whyMatch)},`);
  lines.push(`${i}acuityTypeId: 0, // TODO: set correct acuityTypeId`);
  lines.push(`${i}acuityDropdownValue: null, // TODO: set correct value`);
  lines.push('} as const satisfies Bundle;');

  return lines.join('\n') + '\n';
}

/**
 * Generates the complete bundles.ts file for all bundles.
 * Matches the format of src/data/bundles.ts.
 */
export function generateBundlesFileTs(bundles: EditableBundle[]): string {
  const blocks: string[] = [];

  blocks.push("import type { Bundle } from '../types/bundle';");
  blocks.push('');

  for (const bundle of bundles) {
    blocks.push(generateBundleTs(bundle));
    blocks.push('');
  }

  const ids = bundles.map((b) => b.id).join(', ');
  blocks.push(`export const BUNDLES_ARRAY = [${ids}] as const;`);
  blocks.push('');

  return blocks.join('\n');
}
