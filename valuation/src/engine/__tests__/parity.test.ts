/**
 * Parity tests — engine output must match the source XLSX cell-by-cell.
 *
 * Two modes:
 *   - 'literal': reproduce sheet's behavior, including the M16 wealth-gap bug.
 *               This proves the port is faithful.
 *   - 'corrected': webapp's shipped behavior (M16 bug fixed). Proves the fix.
 *
 * Tolerance:
 *   - Dollar amounts: within $0.01
 *   - Percentages/multiples: within 1e-9
 *   - Grade/probability/integer counts: exact
 */

import { describe, expect, it } from 'vitest';
import { compute } from '../index';
import { EXPECTED_CORRECTED, EXPECTED_LITERAL, RIGHTEXIT_SAMPLE } from './fixtures/rightexitSample';

const CENTS = 0.01;
const EPS = 1e-9;

describe('RightExit sample firm — literal-mode parity (reproduces source XLSX exactly)', () => {
  const out = compute({ ...RIGHTEXIT_SAMPLE, mode: 'literal' });

  it('Step 1 scoring', () => {
    expect(out.sellability.step1Score).toBe(EXPECTED_LITERAL.step1Score);
    expect(out.sellability.step1Max).toBe(EXPECTED_LITERAL.step1Max);
  });

  it('Step 2 scoring', () => {
    expect(out.sellability.step2Score).toBe(EXPECTED_LITERAL.step2Score);
    expect(out.sellability.step2Max).toBe(EXPECTED_LITERAL.step2Max);
  });

  it('combined max and size score', () => {
    expect(out.sellability.combinedMax).toBe(EXPECTED_LITERAL.combinedMax);
    expect(out.sellability.sizeScore).toBe(EXPECTED_LITERAL.sizeScore);
  });

  it('sellability % matches J4 to 1e-9', () => {
    expect(out.sellability.sellabilityPct).toBeCloseTo(EXPECTED_LITERAL.sellabilityPct, 9);
  });

  it('grade and probability of sale', () => {
    expect(out.sellability.grade).toBe(EXPECTED_LITERAL.grade);
    expect(out.sellability.probabilityOfSale).toBe(EXPECTED_LITERAL.probabilityOfSale);
  });

  it('adjusted EBITDA and margin', () => {
    expect(out.ebitda.adjustedEbitda).toBeCloseTo(EXPECTED_LITERAL.adjustedEbitda, 2);
    expect(out.ebitda.ebitdaMargin).toBeCloseTo(EXPECTED_LITERAL.ebitdaMargin, 9);
  });

  it('current COGS, ratio, profit margin', () => {
    expect(out.ebitda.currentCogs).toBeCloseTo(EXPECTED_LITERAL.currentCogs, 2);
    expect(out.ebitda.currentCogsRatio).toBeCloseTo(EXPECTED_LITERAL.currentCogsRatio, 9);
    expect(out.ebitda.currentProfitMargin).toBeCloseTo(EXPECTED_LITERAL.currentProfitMargin, 9);
  });

  it('multiple chain — risk-weighted display, from-financials, used', () => {
    expect(out.multiple.riskWeightedDisplay).toBeCloseTo(EXPECTED_LITERAL.riskWeightedDisplay, 6);
    expect(out.multiple.fromFinancialsFinal).toBeCloseTo(EXPECTED_LITERAL.fromFinancialsFinal, 6);
    expect(out.multiple.ebitdaMultipleUsed).toBeCloseTo(EXPECTED_LITERAL.ebitdaMultipleUsed, 6);
  });

  it('current value (Z16)', () => {
    expect(out.acceleration.currentValue).toBeCloseTo(EXPECTED_LITERAL.currentValue, 2);
  });

  it('Lever 1 — Size', () => {
    expect(out.acceleration.sizeRevenue).toBeCloseTo(EXPECTED_LITERAL.sizeRevenue, 2);
    expect(out.acceleration.sizeEbitda).toBeCloseTo(EXPECTED_LITERAL.sizeEbitda, 2);
    expect(out.acceleration.sizeValue).toBeCloseTo(EXPECTED_LITERAL.sizeValue, 2);
    expect(out.acceleration.sizeValueAdd).toBeCloseTo(EXPECTED_LITERAL.sizeValueAdd, 2);
  });

  it('Lever 2 — Efficiency', () => {
    expect(out.acceleration.efficiencyCogsRatio).toBeCloseTo(EXPECTED_LITERAL.efficiencyCogsRatio, 9);
    expect(out.acceleration.efficiencyEbitda).toBeCloseTo(EXPECTED_LITERAL.efficiencyEbitda, 2);
    expect(out.acceleration.efficiencyValue).toBeCloseTo(EXPECTED_LITERAL.efficiencyValue, 2);
    expect(out.acceleration.efficiencyValueAdd).toBeCloseTo(EXPECTED_LITERAL.efficiencyValueAdd, 2);
  });

  it('Lever 3 — Multiple', () => {
    expect(out.acceleration.multipleNewMultiple).toBeCloseTo(EXPECTED_LITERAL.multipleNewMultiple, 6);
    expect(out.acceleration.multipleValue).toBeCloseTo(EXPECTED_LITERAL.multipleValue, 2);
    expect(out.acceleration.multipleValueAdd).toBeCloseTo(EXPECTED_LITERAL.multipleValueAdd, 2);
  });

  it('Blended forecast (the headline number)', () => {
    expect(out.acceleration.blendedRevenue).toBeCloseTo(EXPECTED_LITERAL.blendedRevenue, 2);
    expect(out.acceleration.blendedEbitda).toBeCloseTo(EXPECTED_LITERAL.blendedEbitda, 2);
    expect(out.acceleration.blendedMultiple).toBeCloseTo(EXPECTED_LITERAL.blendedMultiple, 6);
    expect(out.acceleration.blendedSalePrice).toBeCloseTo(EXPECTED_LITERAL.blendedSalePrice, 2);
    expect(out.acceleration.totalValueCreated).toBeCloseTo(EXPECTED_LITERAL.totalValueCreated, 2);
  });

  it('Wealth Gap — literal mode reproduces M16 bug', () => {
    expect(out.wealthGap.currentAnnualIncome).toBeCloseTo(EXPECTED_LITERAL.currentAnnualIncome, 2);
    expect(out.wealthGap.replacementIncomeRequired).toBeCloseTo(
      EXPECTED_LITERAL.replacementIncomeRequired,
      2,
    );
    expect(out.wealthGap.portfolioRequired).toBeCloseTo(EXPECTED_LITERAL.portfolioRequired, 2);
    expect(out.wealthGap.netAvailableAssets).toBeCloseTo(EXPECTED_LITERAL.netAvailableAssets, 2);
    expect(out.wealthGap.wealthGap).toBeCloseTo(EXPECTED_LITERAL.wealthGap_literal, 2);
    expect(out.wealthGap.netProceedsNeeded).toBeCloseTo(EXPECTED_LITERAL.netProceedsNeeded_literal, 2);
    expect(out.wealthGap.targetSalePrice).toBeCloseTo(EXPECTED_LITERAL.targetSalePrice_literal, 2);
  });
});

describe('RightExit sample firm — corrected-mode (webapp default)', () => {
  const out = compute({ ...RIGHTEXIT_SAMPLE, mode: 'corrected' });

  it('Sellability, EBITDA, multiple, and acceleration are unchanged by mode', () => {
    expect(out.sellability.sellabilityPct).toBeCloseTo(EXPECTED_CORRECTED.sellabilityPct, 9);
    expect(out.ebitda.adjustedEbitda).toBeCloseTo(EXPECTED_CORRECTED.adjustedEbitda, 2);
    expect(out.multiple.ebitdaMultipleUsed).toBeCloseTo(EXPECTED_CORRECTED.ebitdaMultipleUsed, 6);
    expect(out.acceleration.blendedSalePrice).toBeCloseTo(EXPECTED_CORRECTED.blendedSalePrice, 2);
  });

  it('Wealth Gap reflects the fix (debt subtracted not added)', () => {
    expect(out.wealthGap.wealthGap).toBeCloseTo(EXPECTED_CORRECTED.wealthGap_corrected, 2);
    expect(out.wealthGap.netProceedsNeeded).toBeCloseTo(
      EXPECTED_CORRECTED.netProceedsNeeded_corrected,
      2,
    );
    expect(out.wealthGap.targetSalePrice).toBeCloseTo(
      EXPECTED_CORRECTED.targetSalePrice_corrected,
      2,
    );
  });

  it('Correction is exactly 2 × non-mortgage debt vs literal (the bug magnitude)', () => {
    const literal = compute({ ...RIGHTEXIT_SAMPLE, mode: 'literal' });
    const diff = out.wealthGap.wealthGap - literal.wealthGap.wealthGap;
    expect(diff).toBeCloseTo(2 * RIGHTEXIT_SAMPLE.wealthGap.nonMortgageDebt, CENTS);
  });
});

describe('Owner-salary anchor — corrected mode only', () => {
  it('without marketRateReplacementSalary, behaves like literal (adds back full $230K)', () => {
    const out = compute({ ...RIGHTEXIT_SAMPLE, mode: 'corrected' });
    expect(out.ebitda.salaryAddBackUsed).toBeCloseTo(230_000, CENTS);
    expect(out.ebitda.adjustedEbitda).toBeCloseTo(580_000, CENTS);
  });

  it('with market rate $180K, adds back only the $50K delta → EBITDA $400K', () => {
    const out = compute({
      ...RIGHTEXIT_SAMPLE,
      mode: 'corrected',
      financials: { ...RIGHTEXIT_SAMPLE.financials, marketRateReplacementSalary: 180_000 },
    });
    expect(out.ebitda.salaryAddBackUsed).toBeCloseTo(50_000, CENTS);
    expect(out.ebitda.adjustedEbitda).toBeCloseTo(400_000, CENTS);
  });

  it('with market rate $300K (owner under-paid), adds back $0 → EBITDA $350K', () => {
    const out = compute({
      ...RIGHTEXIT_SAMPLE,
      mode: 'corrected',
      financials: { ...RIGHTEXIT_SAMPLE.financials, marketRateReplacementSalary: 300_000 },
    });
    expect(out.ebitda.salaryAddBackUsed).toBeCloseTo(0, CENTS);
    expect(out.ebitda.adjustedEbitda).toBeCloseTo(350_000, CENTS);
  });
});

describe('Multiple chain edge cases', () => {
  it('From Financials + Risk Weighting Off + Canadian = industry median - 0.5', () => {
    const out = compute({
      ...RIGHTEXIT_SAMPLE,
      mode: 'literal',
      multipleConfig: {
        source: 'From Financials',
        riskWeighting: 'Risk Weighting Off',
        canadian: true,
        customMultiple: 0,
      },
    });
    // industry median 4.0 - 0.5 (Canadian) = 3.5
    expect(out.multiple.ebitdaMultipleUsed).toBeCloseTo(3.5, 6);
  });

  it('From Financials + Risk Weighting On + sellability ≤0.5 → industry 10th pct', () => {
    // Force a low sellability by zeroing all risk answers
    const out = compute({
      ...RIGHTEXIT_SAMPLE,
      mode: 'literal',
      risk: RIGHTEXIT_SAMPLE.risk.map((q) => ({ ...q, rawScore: 0 })),
      multipleConfig: {
        source: 'From Financials',
        riskWeighting: 'Risk Weighting On',
        canadian: false,
        customMultiple: 0,
      },
    });
    // With Step 2 score = 0, sellability = (0+25+22)/212 = 0.222 → bucket ≤0.5 → industry p10 = 1.7
    expect(out.sellability.sellabilityPct).toBeCloseTo(47 / 212, 6);
    expect(out.multiple.ebitdaMultipleUsed).toBeCloseTo(1.7, 6);
  });

  it('Use Custom Multiple + Risk Weighting On still returns custom value, NOT risk-adjusted', () => {
    const out = compute({ ...RIGHTEXIT_SAMPLE, mode: 'literal' });
    // Sample fixture: customMultiple=4.0, but risk-weighted display would be 4.25
    expect(out.multiple.ebitdaMultipleUsed).toBe(4.0);
    expect(out.multiple.riskWeightedDisplay).toBeCloseTo(4.25, 6);
  });
});

describe('Size-score lookup boundaries', () => {
  it.each([
    [99_999, 0],
    [100_000, 2],
    [249_999, 2],
    [250_000, 15],
    [580_000, 25], // sample firm
    [749_999, 25],
    [750_000, 30],
    [3_000_000, 75],
    [99_999_999, 75],
  ])('EBITDA $%d → size score %d', (ebitda, expectedScore) => {
    const out = compute({
      ...RIGHTEXIT_SAMPLE,
      mode: 'literal',
      financials: {
        ...RIGHTEXIT_SAMPLE.financials,
        // Make EBITDA exactly the target value by zeroing add-backs and setting profit
        pretaxProfit: ebitda,
        ownerSalary: 0,
        amortizationDepreciation: 0,
        longTermInterest: 0,
        discretionarySpending: 0,
        rentToSelf: 0,
      },
    });
    expect(out.ebitda.adjustedEbitda).toBe(ebitda);
    expect(out.sellability.sizeScore).toBe(expectedScore);
    void EPS;
  });
});
