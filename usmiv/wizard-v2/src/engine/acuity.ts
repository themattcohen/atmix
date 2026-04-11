import type { BookingState } from '../types/state';
import type { SessionItem } from '../types/session';

// WizardMeta is defined in src/types/meta.ts. Declared inline here so this
// engine module compiles independently of the types barrel. When T2 meta.ts is
// confirmed present, replace this block with:
//   import type { WizardMeta } from '../types/meta';
// and remove the interface below.
export interface WizardMeta {
  readonly version: string;
  readonly acuityBase: string;
  readonly acuityScheduleBase: string;
  readonly acuityFieldId: number;
  readonly proxyBase: string;
  readonly phoneNumber: string;
  readonly reviewCount: string;
  readonly reviewRating: string;
}

// Inline booking flow URL (after date+time selection via proxy).
// V1 bug fix: bundleAddonAdded now writes the add-on name into Acuity notes
// so the nurse's booking view shows the correct session contents.
export function buildSmartAcuityUrl(
  booking: BookingState,
  sessionPlan: readonly SessionItem[],
  bundleAddonAdded: boolean,
  bundleAddonName: string | null,
  meta: WizardMeta,
): string {
  const params = new URLSearchParams();

  params.set('appointmentType', String(booking.acuityTypeId));

  if (booking.selectedTime) {
    params.set('datetime', booking.selectedTime);
  }

  if (booking.acuityDropdownValue) {
    params.set(`field:${meta.acuityFieldId}`, booking.acuityDropdownValue);
  }

  // Build session notes. V1 bug fix: bundleAddonAdded now writes to notes.
  const addOnNames: string[] = [];
  if (bundleAddonAdded && bundleAddonName) {
    addOnNames.push(bundleAddonName);
  }
  for (const item of sessionPlan) {
    if (item.isInjection) {
      addOnNames.push(item.name);
    }
  }
  if (addOnNames.length > 0) {
    const primaryName = sessionPlan.find((i) => !i.isInjection)?.name ?? '';
    params.set('notes', `Session: ${primaryName} + ${addOnNames.join(', ')}`);
  }

  return `${meta.acuityScheduleBase}?${params.toString()}`;
}

// Direct Acuity link (fallback when proxyBase is empty, or for opening booking
// without inline availability flow).
export function buildDirectAcuityUrl(
  acuityTypeId: number,
  meta: WizardMeta,
): string {
  return `${meta.acuityBase}?appointmentTypeID=${acuityTypeId}`;
}
