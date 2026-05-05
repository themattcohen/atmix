import type { TreatmentId, Treatment } from './treatment';

export type BundleId = 'beautyBundle' | 'nadPlusLabs' | 'weightLossConsult' | 'jetLagMyers';

export interface Bundle {
  readonly id: BundleId;
  readonly name: string;
  readonly primary: TreatmentId;
  readonly addOn?: TreatmentId;
  readonly addOnLabel?: string;
  readonly addOnInteractive: boolean;
  readonly isConsultation: boolean;
  readonly whyMatch: string;
  /** Bundle-specific subtitle shown under the headline on the result card. */
  readonly shortDesc?: string;
  /** Bundle headline price in cents/dollars. Overrides primary treatment price on the card. */
  readonly price?: number;
  /** Bundle-level price label (e.g. "from $199/month"). Overrides price when set. */
  readonly priceLabel?: string;
  /** Destination URL for the Learn More button. Overrides primary treatment pageUrl. */
  readonly pageUrl?: string;
  readonly acuityTypeId: number;
  readonly acuityDropdownValue: string | null;
}

// Defined here (not in treatment.ts) to avoid circular imports.
// bundle.ts imports from treatment.ts; treatment.ts must not import from bundle.ts.
export type ResolvedRecommendation =
  | { kind: 'treatment'; treatment: Treatment }
  | { kind: 'bundle'; bundle: Bundle; primary: Treatment; addOn: Treatment | null };
