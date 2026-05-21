/**
 * EBITDA computation — Part 1 cells I51, I52, I53 + Part 2 baseline references.
 *
 * Verbatim from XLSX:
 *   I51 = pretaxProfit + ad + interest + discretionary + ownerSalary + rentToSelf
 *   I52 = I51 / H43                                       (EBITDA margin)
 *   I53 = floor-lookup of EBITDA against Data Page!B5:C14 (size score)
 *
 * Part 2 baseline (column Z):
 *   Z9  = revenue
 *   Z11 = pretax profit  → Z10 (current COGS) = Z9 - Z11
 *   AA10 = COGS ratio    = Z10 / Z9
 *   AA11 = profit margin = Z11 / Z9
 *   AA12 = EBITDA margin = Z12 / Z9
 *
 * Corrected mode: when marketRateReplacementSalary is provided, only the delta
 * (max(0, ownerSalary - marketRate)) is added back, not the full salary. This fixes
 * the source-sheet bug where the full owner salary was always added back.
 */

import type { EbitdaOutput, EngineMode, FinancialInputs } from './types';
import { lookupSizeScore } from '../data/sizeScoreTable';

export function computeEbitda(
  fin: FinancialInputs,
  mode: EngineMode,
): EbitdaOutput & { sizeScore: number } {
  let salaryAddBackUsed = fin.ownerSalary;
  if (mode === 'corrected' && typeof fin.marketRateReplacementSalary === 'number') {
    salaryAddBackUsed = Math.max(0, fin.ownerSalary - fin.marketRateReplacementSalary);
  }

  const adjustedEbitda =
    fin.pretaxProfit +
    fin.amortizationDepreciation +
    fin.longTermInterest +
    fin.discretionarySpending +
    salaryAddBackUsed +
    fin.rentToSelf;

  const ebitdaMargin = fin.revenue === 0 ? 0 : adjustedEbitda / fin.revenue;
  const currentCogs = fin.revenue - fin.pretaxProfit;
  const currentCogsRatio = fin.revenue === 0 ? 0 : currentCogs / fin.revenue;
  const currentProfitMargin = fin.revenue === 0 ? 0 : fin.pretaxProfit / fin.revenue;
  const sizeScore = lookupSizeScore(adjustedEbitda);

  return {
    adjustedEbitda,
    ebitdaMargin,
    currentCogs,
    currentCogsRatio,
    currentProfitMargin,
    salaryAddBackUsed,
    sizeScore,
    addBackComponents: {
      pretaxProfit: fin.pretaxProfit,
      amortizationDepreciation: fin.amortizationDepreciation,
      longTermInterest: fin.longTermInterest,
      discretionarySpending: fin.discretionarySpending,
      salaryAddBack: salaryAddBackUsed,
      rentToSelf: fin.rentToSelf,
      marketRateUsed: typeof fin.marketRateReplacementSalary === 'number' ? fin.marketRateReplacementSalary : null,
      ownerSalaryRaw: fin.ownerSalary,
    },
  };
}
