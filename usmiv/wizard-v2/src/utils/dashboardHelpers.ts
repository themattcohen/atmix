/**
 * dashboardHelpers.ts -- Shared display-layer utilities for the dev dashboard.
 *
 * Centralizes category display constants and pure functions that were
 * previously copy-pasted across WizardDevDashboard, PathsTab, EditorMain,
 * and EditorSidebar.
 */

import type { TreatmentCategory, Treatment } from '../types/treatment';

// ── Category order ────────────────────────────────────────────────────────────

export const CATEGORY_ORDER: TreatmentCategory[] = [
  'iv', 'nad', 'weightLoss', 'injection', 'lab',
];

// ── Category badge classes ────────────────────────────────────────────────────

/** Returns the CSS class string for a wdd- category badge. */
export function categoryBadgeClass(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'wdd-cat-badge wdd-cat-badge--iv';
    case 'nad':        return 'wdd-cat-badge wdd-cat-badge--nad';
    case 'weightLoss': return 'wdd-cat-badge wdd-cat-badge--weightloss';
    case 'injection':  return 'wdd-cat-badge wdd-cat-badge--injection';
    case 'lab':        return 'wdd-cat-badge wdd-cat-badge--lab';
  }
}

/** Returns the CSS class string for a wde- small category badge (editor sidebar). */
export function catBadgeSmClass(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'wde-cat-badge-sm wde-cat-badge-sm--iv';
    case 'nad':        return 'wde-cat-badge-sm wde-cat-badge-sm--nad';
    case 'weightLoss': return 'wde-cat-badge-sm wde-cat-badge-sm--weightloss';
    case 'injection':  return 'wde-cat-badge-sm wde-cat-badge-sm--injection';
    case 'lab':        return 'wde-cat-badge-sm wde-cat-badge-sm--lab';
  }
}

// ── Category labels ───────────────────────────────────────────────────────────

/** Returns the human-readable label for a category. */
export function categoryLabel(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'IV';
    case 'nad':        return 'NAD';
    case 'weightLoss': return 'Weight Loss';
    case 'injection':  return 'Injection';
    case 'lab':        return 'Lab';
  }
}

// ── Sorted treatments ─────────────────────────────────────────────────────────

/**
 * Returns treatments sorted by CATEGORY_ORDER, then descending price within
 * each category.
 */
export function sortedTreatments(
  treatments: Readonly<Record<string, Treatment>>,
): Treatment[] {
  return Object.values(treatments).sort((a, b) => {
    const catDiff =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return b.price - a.price;
  });
}

// ── Price formatting ──────────────────────────────────────────────────────────

/** Returns the display price for a treatment (priceLabel if set, else $N). */
export function formatTreatmentPrice(t: { price: number; priceLabel?: string }): string {
  if (t.priceLabel) return t.priceLabel;
  return `$${t.price}`;
}
