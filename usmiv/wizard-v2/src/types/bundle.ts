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
  readonly acuityTypeId: number;
  readonly acuityDropdownValue: string | null;
}

// Defined here (not in treatment.ts) to avoid circular imports.
// bundle.ts imports from treatment.ts; treatment.ts must not import from bundle.ts.
export type ResolvedRecommendation =
  | { kind: 'treatment'; treatment: Treatment }
  | { kind: 'bundle'; bundle: Bundle; primary: Treatment; addOn: Treatment | null };
