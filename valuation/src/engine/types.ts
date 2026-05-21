/**
 * Engine types — verified against claudedocs/someday_valuation_engine_spec.md.
 *
 * The engine is independent of the UI question set. Inputs are raw 1-5 scores per
 * question (already mapped by the UI layer using src/data/questions.ts), plus
 * financial figures and config flags. Outputs are everything the on-screen value
 * ticker and PDF report need.
 */

export type MultipleSource =
  | 'From Financials'
  | 'Use Common Multiples'
  | 'Use Industry Multiples'
  | 'Use Custom Multiple';

export type RiskWeighting = 'Risk Weighting On' | 'Risk Weighting Off';

export type EngineMode = 'literal' | 'corrected';

export interface ReadinessQuestionScore {
  /** Question id (matches src/data/questions.ts) */
  id: string;
  /** G weight from the source sheet (so max = G × 5) */
  weight_G: number;
  /** The raw 1-5 score from the user's answer (Step 1 stores unweighted raw) */
  rawScore: number;
  /** Whether this question is tracking-only (contributes 0 to score, 0 to max) */
  trackingOnly?: boolean;
}

export interface RiskQuestionScore {
  id: string;
  weight_G: number;
  /** Raw answer score before weighting. Engine multiplies by G to produce the actual contribution (matches sheet's Step 2 I = raw × G). */
  rawScore: number;
  trackingOnly?: boolean;
}

export interface FinancialInputs {
  revenue: number;
  pretaxProfit: number;
  amortizationDepreciation: number;
  longTermInterest: number;
  discretionarySpending: number;
  ownerSalary: number;
  rentToSelf: number;
  /** Optional: webapp adds this to fix the source-sheet "salary anchor missing" bug. Engine adds back only max(0, ownerSalary - marketRateReplacementSalary) when mode='corrected' AND this is provided. */
  marketRateReplacementSalary?: number;
}

export interface MultipleConfig {
  source: MultipleSource;
  riskWeighting: RiskWeighting;
  canadian: boolean;
  customMultiple: number;
}

export interface AccelerationConfig {
  /** Defaults to 0.10 (10% revenue growth) — Part 2 cell E4 */
  targetSizeIncreasePct: number;
  /** Defaults to 0.10 (10 PERCENTAGE-POINT reduction in COGS ratio) — Part 2 cell K4 */
  targetEfficiencyIncreasePct: number;
  /** Defaults to 0.05 (5% multiple boost) — Part 2 cell Q4 */
  targetMultipleIncreasePct: number;
}

export interface WealthGapInputs {
  dividends: number;
  wages: number;
  personalExpensesCoveredByBusiness: number;
  otherPassiveIncome: number;
  liquidAssets: number;
  nonMortgageDebt: number;
  desiredPostSaleAnnualIncome: number;
  desiredExitTimelineYears: number;
  ownershipPct: number;
  feesAndTaxesPct: number;
  longTermBusinessDebt: number;
  /** Sheet hardcodes M14 = 0.075. Override per-firm if desired. */
  returnOnPortfolio: number;
}

export interface EngineInputs {
  readiness: ReadinessQuestionScore[];
  risk: RiskQuestionScore[];
  financials: FinancialInputs;
  multipleConfig: MultipleConfig;
  acceleration: AccelerationConfig;
  wealthGap: WealthGapInputs;
  /** 'literal' reproduces the source sheet's behavior (bugs included). 'corrected' ships the webapp's fixed math. */
  mode: EngineMode;
}

export type SellabilityGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ProbabilityOfSale = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';

export interface SellabilityOutput {
  step1Score: number;
  step1Max: number;
  step2Score: number;
  step2Max: number;
  combinedMax: number;
  sizeScore: number;
  sellabilityPct: number;
  grade: SellabilityGrade;
  probabilityOfSale: ProbabilityOfSale;
}

export interface EbitdaOutput {
  adjustedEbitda: number;
  ebitdaMargin: number;
  currentCogs: number;
  currentCogsRatio: number;
  currentProfitMargin: number;
  /** Only differs from sheet when mode='corrected' AND marketRateReplacementSalary is provided */
  salaryAddBackUsed: number;
}

export interface MultipleOutput {
  /** D63-I63 common bands and D64-I64 industry bands as constants */
  commonMultiples: number[];
  industryMultiples: number[];
  /** E66 — median pick before risk weighting */
  noRiskBase: number;
  /** G66 — risk-banded pick from the table (varies by sellabilityPct and source) */
  riskWeightedBase: number;
  /** J65 — informational risk-weighted display value (always shown on sheet) */
  riskWeightedDisplay: number;
  /** D66 — final from-financials multiple after risk + Canadian discount */
  fromFinancialsFinal: number;
  /** J67 — the actual multiple used in valuation. Custom bypasses risk weighting. */
  ebitdaMultipleUsed: number;
}

export interface AccelerationOutput {
  currentValue: number;
  // Lever 1: Size
  sizeRevenue: number;
  sizeEbitda: number;
  sizeValue: number;
  sizeValueAdd: number;
  sizeValuePct: number;
  // Lever 2: Efficiency
  efficiencyCogsRatio: number;
  efficiencyEbitda: number;
  efficiencyValue: number;
  efficiencyValueAdd: number;
  efficiencyValuePct: number;
  // Lever 3: Multiple
  multipleNewMultiple: number;
  multipleValue: number;
  multipleValueAdd: number;
  multipleValuePct: number;
  // Blended (compound) — the headline forecast
  blendedRevenue: number;
  blendedEbitdaMargin: number;
  blendedEbitda: number;
  blendedMultiple: number;
  blendedSalePrice: number;
  totalValueCreated: number;
  totalValueCreatedPct: number;
}

export interface WealthGapOutput {
  currentAnnualIncome: number;
  replacementIncomeRequired: number;
  portfolioRequired: number;
  netAvailableAssets: number;
  /** literal: M15 - (F15 + F14) — sheet bug. corrected: M15 - (F14 - F15) */
  wealthGap: number;
  netProceedsNeeded: number;
  /** T13 = T9 × (1 + T10) */
  targetSalePrice: number;
}

export interface EngineOutput {
  sellability: SellabilityOutput;
  ebitda: EbitdaOutput;
  multiple: MultipleOutput;
  acceleration: AccelerationOutput;
  wealthGap: WealthGapOutput;
  mode: EngineMode;
}
