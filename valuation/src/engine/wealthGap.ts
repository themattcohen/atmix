/**
 * Wealth Gap — Part 3 cells F10, M13, M15, F16, M16, T9, T13.
 *
 * Verbatim from XLSX:
 *   F10 = SUM(F6:F9)                      current annual income
 *   M13 = M6 - F9                         replacement income required (less other passive)
 *   M14 = 0.075 (hardcoded)               assumed portfolio return
 *   M15 = M13 / M14                       required portfolio size
 *   F16 = F14 - F15                       net available assets (informational)
 *
 *   M16 (LITERAL SHEET BUG)  = M15 - (F15 + F14)   ← debt ADDED to assets
 *   M16 (CORRECTED)          = M15 - (F14 - F15)   ← debt subtracted from assets
 *
 *   T9  = (T8 × T6) + M16                 net proceeds needed
 *   T13 = T9 + (T9 × T10) = T9 × (1+T10)  target sale price (gross-up by markup, NOT divide-by-(1-T10))
 *
 * The sheet's M16 bug means it understates the wealth gap whenever non-mortgage
 * debt is positive. Webapp defaults to 'corrected' mode. Parity tests run 'literal'.
 */

import type { EngineMode, WealthGapInputs, WealthGapOutput } from './types';

export function computeWealthGap(inputs: WealthGapInputs, mode: EngineMode): WealthGapOutput {
  const {
    dividends,
    wages,
    personalExpensesCoveredByBusiness,
    otherPassiveIncome,
    liquidAssets,
    nonMortgageDebt,
    desiredPostSaleAnnualIncome,
    ownershipPct,
    feesAndTaxesPct,
    longTermBusinessDebt,
    returnOnPortfolio,
  } = inputs;

  const currentAnnualIncome =
    dividends + wages + personalExpensesCoveredByBusiness + otherPassiveIncome;
  const replacementIncomeRequired = desiredPostSaleAnnualIncome - otherPassiveIncome;
  const portfolioRequired = returnOnPortfolio === 0 ? 0 : replacementIncomeRequired / returnOnPortfolio;
  const netAvailableAssets = liquidAssets - nonMortgageDebt;

  // M16 — the bug fix point
  const wealthGap =
    mode === 'literal'
      ? portfolioRequired - (nonMortgageDebt + liquidAssets) // sheet bug
      : portfolioRequired - (liquidAssets - nonMortgageDebt); // correct

  const netProceedsNeeded = longTermBusinessDebt * ownershipPct + wealthGap;
  const targetSalePrice = netProceedsNeeded + netProceedsNeeded * feesAndTaxesPct;

  return {
    currentAnnualIncome,
    replacementIncomeRequired,
    portfolioRequired,
    netAvailableAssets,
    wealthGap,
    netProceedsNeeded,
    targetSalePrice,
  };
}
