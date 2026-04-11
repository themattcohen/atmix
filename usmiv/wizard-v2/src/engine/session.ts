import type { SessionItem } from '../types/session';
import { RULES } from '../constants/rules';

// Pure reducer: add an item to the session plan.
//
// Enforcement rules:
//   - No duplicate treatment IDs (silently ignored if already present).
//   - RULES.MAX_INJECTIONS (3): a 4th injection is silently dropped.
//     Tied to the "Buy 3 injections, get 4th free" promotion where the 4th is
//     dispensed on-site; the wizard only allows booking up to 3.
//   - RULES.MAX_PRIMARY (1): adding a second non-injection primary replaces
//     the existing one (keeps addons).
//
// Returns a new readonly array -- never mutates the input.
export function addToSessionPure(
  items: readonly SessionItem[],
  item: SessionItem,
): readonly SessionItem[] {
  // No-op: duplicate treatment IDs not allowed
  if (items.some((i) => i.treatmentId === item.treatmentId)) {
    return items;
  }

  if (item.isInjection) {
    // Enforce injection cap
    const injectionCount = items.filter((i) => i.isInjection).length;
    if (injectionCount >= RULES.MAX_INJECTIONS) {
      return items;
    }
    return [...items, item];
  }

  // Non-injection primary: enforce MAX_PRIMARY by replacing existing primary
  const hasPrimary = items.some((i) => !i.isInjection);
  if (hasPrimary) {
    // Replace the existing primary, preserve injections (addons)
    return [...items.filter((i) => i.isInjection), item];
  }

  return [...items, item];
}

// Pure reducer: remove an item from the session plan by treatmentId.
// Returns a new readonly array -- never mutates the input.
export function removeFromSessionPure(
  items: readonly SessionItem[],
  treatmentId: string,
): readonly SessionItem[] {
  return items.filter((i) => i.treatmentId !== treatmentId);
}

// Calculate the total price for all items in the session plan.
export function calculateSessionTotal(items: readonly SessionItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Build a human-readable session notes string for Acuity booking.
// Format: "Session: {primary name} + {addon1 name}, {addon2 name}"
// If no primary treatment is present, returns just the addon names.
export function buildSessionNotes(items: readonly SessionItem[]): string {
  if (items.length === 0) return '';

  const primary = items.find((i) => !i.isInjection);
  const addons = items.filter((i) => i.isInjection);

  if (addons.length === 0) {
    return primary ? `Session: ${primary.name}` : '';
  }

  const addonNames = addons.map((a) => a.name).join(', ');
  if (primary) {
    return `Session: ${primary.name} + ${addonNames}`;
  }
  return `Session: ${addonNames}`;
}
