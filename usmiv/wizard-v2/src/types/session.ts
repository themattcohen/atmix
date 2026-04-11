import type { TreatmentId } from './treatment';

export interface SessionItem {
  readonly treatmentId: TreatmentId;
  readonly name: string;
  readonly price: number;
  readonly priceLabel?: string;
  readonly isInjection: boolean;
}

export interface SessionPlan {
  readonly items: readonly SessionItem[];
  readonly total: number;
  readonly hasWeightLoss: boolean;
}
