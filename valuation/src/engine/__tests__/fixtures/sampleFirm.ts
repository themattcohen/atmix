/**
 * Sample firm fixture — verified against the source spreadsheet cell-by-cell.
 *
 * Raw scores per question (1-5) reflect the source spreadsheet's answer→score mapping
 * for the sample's entered answers. Step 1 stores unweighted raw; Step 2 sums raw × G.
 *
 * Expected outputs come from the cached values in the source spreadsheet (via openpyxl
 * data_only=True). Two output sets:
 *   - expectedLiteral: what the source spreadsheet computes (bugs preserved)
 *   - expectedCorrected: what the webapp should ship (M16 wealth-gap bug fixed)
 */

import type { EngineInputs } from '../../types';

// G weights match the source sheet's Step 1 (sum to 12 → max 60)
export const SAMPLE_READINESS: EngineInputs['readiness'] = [
  // Q1 + Q2 tracking-only (zero contribution to score AND max)
  { id: 'q_how_heard', weight_G: 0, rawScore: 0, trackingOnly: true },
  { id: 'q_thinking_about_selling', weight_G: 0, rawScore: 0, trackingOnly: true },
  // Q3 — Exit timeline; "< 12 Months" → raw 2; G=2; contributes 2 to score, 10 to max
  { id: 'q_exit_timeline', weight_G: 2, rawScore: 2 },
  // Q4 — Energy; "A Medium Amount" → raw 3; G=2; contributes 3 to score, 10 to max
  { id: 'q_energy_for_sale', weight_G: 2, rawScore: 3 },
  // Q5 — Shareholder count; 1 → raw 5; G=2; contributes 5 to score, 10 to max
  { id: 'q_shareholder_count', weight_G: 2, rawScore: 5 },
  // Q6 — Exit plan duration; "1 year" → raw 2; G=1; contributes 2 to score, 5 to max
  { id: 'q_exit_plan_duration', weight_G: 1, rawScore: 2 },
  // Q7 — Alignment; "Complete Alignment" → raw 5; G=2; contributes 5 to score, 10 to max
  { id: 'q_shareholder_alignment', weight_G: 2, rawScore: 5 },
  // Q8 — Life plan; "Yes, I have a clear plan" → raw 5; G=3; contributes 5 to score, 15 to max
  { id: 'q_life_after_sale', weight_G: 3, rawScore: 5 },
  // Q9 — Sale price toggle; "Off" → raw 0; G=0 (sheet K18 = if G18="On",15,0 = 0)
  { id: 'q_sale_price_target', weight_G: 0, rawScore: 0 },
];

// G weights match the source sheet's Step 2 (sum to 30 → max 150)
export const SAMPLE_RISK: EngineInputs['risk'] = [
  // Q1 FYE tracking-only
  { id: 'q_fiscal_year_end', weight_G: 0, rawScore: 0, trackingOnly: true },
  // Q2 Incorporated; "Yes" → raw 5; G=3 → contributes 15
  { id: 'q_incorporated', weight_G: 3, rawScore: 5 },
  // Q3 Profit last year; "Yes" → raw 5; G=3 → contributes 15
  { id: 'q_profit_last_year', weight_G: 3, rawScore: 5 },
  // Q4 Profit last 6mo; "Yes" → raw 5; G=3 → contributes 15
  { id: 'q_profit_last_6mo', weight_G: 3, rawScore: 5 },
  // Q5 Financial trend; "Modest YOY Steady Growth" → raw 4; G=2 → contributes 8
  { id: 'q_financial_trend', weight_G: 2, rawScore: 4 },
  // Q6 Clean financials; "5+ years" → raw 5; G=2 → contributes 10
  { id: 'q_clean_financials', weight_G: 2, rawScore: 5 },
  // Q7 GM/COO; "Yes" → raw 5; G=3 → contributes 15
  { id: 'q_has_gm_or_coo', weight_G: 3, rawScore: 5 },
  // Q8 Project-based; "Yes" → raw 1; G=2 → contributes 2
  { id: 'q_project_based', weight_G: 2, rawScore: 1 },
  // Q9 Largest customer; "Under 5%" → raw 4; G=2 → contributes 8
  { id: 'q_largest_customer_pct', weight_G: 2, rawScore: 4 },
  // Q10 Owner hours; "20 - 30" → raw 3; G=1 → contributes 3
  { id: 'q_owner_hours_per_week', weight_G: 1, rawScore: 3 },
  // Q11 Lease remaining; "Over 8 years" → raw 4; G=1 → contributes 4
  { id: 'q_lease_remaining', weight_G: 1, rawScore: 4 },
  // Q12 Company age; "Over 15 years" → raw 4; G=1 → contributes 4
  { id: 'q_company_age', weight_G: 1, rawScore: 4 },
  // Q13 Business OS; "Basic CRM" → raw 3; G=2 → contributes 6
  { id: 'q_business_os', weight_G: 2, rawScore: 3 },
  // Q14 Payment type; "Cash and Carry" → raw 3.5; G=2 → contributes 7
  { id: 'q_payment_type', weight_G: 2, rawScore: 3.5 },
  // Q15 Lawsuits; "Multiple Active" → raw -2; G=2 → contributes -4
  { id: 'q_active_lawsuits', weight_G: 2, rawScore: -2 },
  // Q16 SPOFs; 3 SPOFs → raw -4; G=1 → contributes -4
  { id: 'q_spof_count', weight_G: 1, rawScore: -4 },
];

export const SAMPLE_FIRM: EngineInputs = {
  readiness: SAMPLE_READINESS,
  risk: SAMPLE_RISK,
  financials: {
    revenue: 3_400_000,
    pretaxProfit: 350_000,
    amortizationDepreciation: 0,
    longTermInterest: 0,
    discretionarySpending: 0,
    ownerSalary: 230_000,
    rentToSelf: 0,
  },
  multipleConfig: {
    source: 'Use Custom Multiple',
    riskWeighting: 'Risk Weighting On',
    canadian: false,
    customMultiple: 4.0,
  },
  acceleration: {
    targetSizeIncreasePct: 0.10,
    targetEfficiencyIncreasePct: 0.10,
    targetMultipleIncreasePct: 0.05,
  },
  wealthGap: {
    dividends: 250_000,
    wages: 150_000,
    personalExpensesCoveredByBusiness: 50_000,
    otherPassiveIncome: 100_000,
    liquidAssets: 1_500_000,
    nonMortgageDebt: 75_000,
    desiredPostSaleAnnualIncome: 575_000,
    desiredExitTimelineYears: 5,
    ownershipPct: 1.0,
    feesAndTaxesPct: 0.10,
    longTermBusinessDebt: 0,
    returnOnPortfolio: 0.075,
  },
  mode: 'literal', // override per test
};

/** Outputs verified directly from the XLSX cached values. */
export const EXPECTED_LITERAL = {
  step1Score: 22,
  step1Max: 60,
  step2Score: 104,
  step2Max: 150,
  combinedMax: 210,
  sizeScore: 25,
  sellabilityPct: 151 / 212, // 0.71226415094...
  grade: 'C' as const,
  probabilityOfSale: 'Medium' as const,

  adjustedEbitda: 580_000,
  ebitdaMargin: 580_000 / 3_400_000, // 0.17058823529...
  currentCogs: 3_050_000,
  currentCogsRatio: 3_050_000 / 3_400_000, // 0.89705882352...
  currentProfitMargin: 350_000 / 3_400_000, // 0.10294117647...

  // Multiple chain (Use Custom + Risk Weighting On)
  // For "Use Custom Multiple", risk table = COMMON, sellabilityPct=0.7123 → bucket ≤0.85 →
  // (median + p75)/2 = (3.5 + 5.0)/2 = 4.25
  riskWeightedDisplay: 4.25,
  // For "from financials" (informational), uses INDUSTRY table → (4.0 + 5.7)/2 = 4.85
  fromFinancialsFinal: 4.85,
  ebitdaMultipleUsed: 4.0, // custom bypasses risk weighting

  currentValue: 2_320_000,
  sizeRevenue: 3_740_000,
  sizeEbitda: 638_000,
  sizeValue: 2_552_000,
  sizeValueAdd: 232_000,
  efficiencyCogsRatio: 3_050_000 / 3_400_000 - 0.10, // 0.79705882352
  efficiencyEbitda: 920_000,
  efficiencyValue: 3_680_000,
  efficiencyValueAdd: 1_360_000,
  multipleNewMultiple: 4.2,
  multipleValue: 2_436_000,
  multipleValueAdd: 116_000,
  blendedRevenue: 3_740_000,
  blendedEbitda: 1_012_000,
  blendedMultiple: 4.2,
  blendedSalePrice: 4_250_400,
  totalValueCreated: 1_930_400,

  // Wealth gap (literal — sheet bug active)
  currentAnnualIncome: 550_000,
  replacementIncomeRequired: 475_000,
  portfolioRequired: 475_000 / 0.075, // 6,333,333.33
  netAvailableAssets: 1_425_000,
  wealthGap_literal: 475_000 / 0.075 - (75_000 + 1_500_000), // 4,758,333.33
  netProceedsNeeded_literal: 475_000 / 0.075 - (75_000 + 1_500_000),
  targetSalePrice_literal:
    (475_000 / 0.075 - (75_000 + 1_500_000)) * 1.10, // 5,234,166.67
};

/** Corrected wealth-gap math the webapp ships by default. */
export const EXPECTED_CORRECTED = {
  ...EXPECTED_LITERAL,
  wealthGap_corrected: 475_000 / 0.075 - (1_500_000 - 75_000), // 4,908,333.33
  netProceedsNeeded_corrected: 475_000 / 0.075 - (1_500_000 - 75_000),
  targetSalePrice_corrected:
    (475_000 / 0.075 - (1_500_000 - 75_000)) * 1.10, // 5,399,166.67
};
