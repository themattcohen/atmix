export type TreatmentCategory = 'iv' | 'nad' | 'weightLoss' | 'injection' | 'lab';

export type TreatmentId =
  | 'hydration'
  | 'myers'
  | 'immunity'
  | 'pregnancy'
  | 'altitude'
  | 'hangover'
  | 'migraine'
  | 'longevity'
  | 'myersGold'
  | 'performance'
  | 'myersPlatinum'
  | 'revival'
  | 'nad100'
  | 'nad250'
  | 'nad500'
  | 'semaglutide'
  | 'tirzepatide'
  | 'lipoShots'
  | 'b12Shot'
  | 'biotinShot'
  | 'glutathioneShot'
  | 'triImmuneShot'
  | 'vitaminDShot'
  | 'labGeneral'
  | 'labInDepth'
  | 'labVitamin'
  | 'labComplete';

export interface Ingredient {
  name: string;
  benefit: string;
}

export interface Treatment {
  readonly id: TreatmentId;
  readonly name: string;
  readonly price: number;
  readonly priceLabel?: string;          // override display (e.g., "from $199/month")
  readonly duration: string;
  readonly category: TreatmentCategory;
  readonly acuityTypeId: number;
  readonly acuityDropdownValue: string | null;
  readonly pageUrl: string;
  readonly shortDesc: string;
  readonly ingredients: readonly Ingredient[];
  readonly bestFor: readonly string[];
  // Result screen explanation text answering "why was I recommended this?"
  readonly whyMatch: string;
  // Symptom scoring weights. Key is the symptom option label (must match exactly).
  // Value is the numeric weight added to this treatment's score when that symptom is selected.
  readonly scoringWeights: Readonly<Partial<Record<string, number>>>;
  // Per-symptom explanation texts. Key is the symptom option label.
  // Value is the explanation shown on the result card under "Why this matches you."
  readonly addressedBy: Readonly<Record<string, string>>;
  readonly addonSuggestions: readonly TreatmentId[];  // injections to suggest (empty if none)
  readonly note?: string;                // italic footnote (GLP-1 programs)
  readonly tests?: readonly string[];    // lab-specific test codes
}
