/**
 * Acceleration scenarios — Part 2 cells D9-W20.
 *
 * Three independent levers + a COMPOUND blended forecast.
 *
 * Baseline (column Z):
 *   Z9   = revenue                              Z11  = pretax profit
 *   Z10  = Z9 - Z11 (current COGS)              Z12  = adjustedEbitda
 *   AA10 = Z10/Z9 (COGS ratio)                  AA11 = Z11/Z9 (profit margin)
 *   AA12 = Z12/Z9 (EBITDA margin)
 *   Z15  = current multiple
 *   Z16  = Z15 × Z12 (current value)
 *
 * Lever 1 — Size (revenue grows by E4):
 *   D9  = Z9 × (1 + E4)
 *   D10 = D9 × AA10            (same COGS ratio)
 *   D11 = D9 - D10
 *   D12 = D9 × AA12            (same EBITDA margin)
 *   E15 = Z15                  (same multiple)
 *   E16 = E15 × D12
 *
 * Lever 2 — Efficiency (COGS ratio drops by K4 PERCENTAGE POINTS, not %):
 *   J9  = Z9                   (revenue unchanged)
 *   K10 = AA10 - K4
 *   J10 = J9 × K10
 *   J11 = J9 - J10
 *   K11 = J11 / J9             (new profit margin)
 *   K12 = AA12 + (K11 - AA11)  (preserves the gap between profit margin and EBITDA margin)
 *   J12 = J9 × K12
 *   K15 = Z15
 *   K16 = K15 × J12
 *
 * Lever 3 — Multiple (multiple grows by Q4):
 *   P12 = Z12 (unchanged)
 *   Q15 = Z15 × (1 + Q4)
 *   Q16 = Q15 × P12
 *
 * Blended (the headline forecast):
 *   V9  = D9                    (grown revenue)
 *   W10 = K10                   (improved COGS ratio)
 *   V10 = V9 × W10
 *   V11 = V9 - V10
 *   W11 = V11 / V9
 *   W12 = AA12 + (K11 - AA11)   (same EBITDA-margin-improvement formula)
 *   V12 = W12 × V9
 *   W15 = Q15                   (improved multiple)
 *   W16 = W15 × V12             (HEADLINE — forecasted sale price)
 */

import type { AccelerationConfig, AccelerationOutput, EbitdaOutput, FinancialInputs } from './types';

export interface AccelerationInputs {
  financials: FinancialInputs;
  ebitda: Pick<EbitdaOutput, 'adjustedEbitda' | 'ebitdaMargin' | 'currentCogsRatio' | 'currentProfitMargin'>;
  ebitdaMultipleUsed: number;
  config: AccelerationConfig;
}

export function computeAcceleration(inputs: AccelerationInputs): AccelerationOutput {
  const { revenue } = inputs.financials;
  const { adjustedEbitda, ebitdaMargin, currentCogsRatio, currentProfitMargin } = inputs.ebitda;
  const multiple = inputs.ebitdaMultipleUsed;
  const { targetSizeIncreasePct: sizeP, targetEfficiencyIncreasePct: effP, targetMultipleIncreasePct: multP } = inputs.config;

  const currentValue = multiple * adjustedEbitda;

  // Lever 1 — Size
  const sizeRevenue = revenue * (1 + sizeP);
  const sizeEbitda = sizeRevenue * ebitdaMargin;
  const sizeValue = multiple * sizeEbitda;
  const sizeValueAdd = sizeValue - currentValue;
  const sizeValuePct = currentValue === 0 ? 0 : sizeValueAdd / currentValue;

  // Lever 2 — Efficiency (subtract percentage points from COGS ratio)
  const efficiencyCogsRatio = currentCogsRatio - effP;
  const efficiencyCogs = revenue * efficiencyCogsRatio;
  const efficiencyProfit = revenue - efficiencyCogs;
  const efficiencyProfitMargin = revenue === 0 ? 0 : efficiencyProfit / revenue;
  const efficiencyEbitdaMargin = ebitdaMargin + (efficiencyProfitMargin - currentProfitMargin);
  const efficiencyEbitda = revenue * efficiencyEbitdaMargin;
  const efficiencyValue = multiple * efficiencyEbitda;
  const efficiencyValueAdd = efficiencyValue - currentValue;
  const efficiencyValuePct = currentValue === 0 ? 0 : efficiencyValueAdd / currentValue;

  // Lever 3 — Multiple (uplift the multiple, EBITDA unchanged)
  const multipleNewMultiple = multiple * (1 + multP);
  const multipleValue = multipleNewMultiple * adjustedEbitda;
  const multipleValueAdd = multipleValue - currentValue;
  const multipleValuePct = currentValue === 0 ? 0 : multipleValueAdd / currentValue;

  // Blended (compound)
  const blendedRevenue = sizeRevenue;
  const blendedEbitdaMargin = ebitdaMargin + (efficiencyProfitMargin - currentProfitMargin);
  const blendedEbitda = blendedEbitdaMargin * blendedRevenue;
  const blendedMultiple = multipleNewMultiple;
  const blendedSalePrice = blendedMultiple * blendedEbitda;
  const totalValueCreated = blendedSalePrice - currentValue;
  const totalValueCreatedPct = currentValue === 0 ? 0 : totalValueCreated / currentValue;

  return {
    currentValue,
    sizeRevenue,
    sizeEbitda,
    sizeValue,
    sizeValueAdd,
    sizeValuePct,
    efficiencyCogsRatio,
    efficiencyEbitda,
    efficiencyValue,
    efficiencyValueAdd,
    efficiencyValuePct,
    multipleNewMultiple,
    multipleValue,
    multipleValueAdd,
    multipleValuePct,
    blendedRevenue,
    blendedEbitdaMargin,
    blendedEbitda,
    blendedMultiple,
    blendedSalePrice,
    totalValueCreated,
    totalValueCreatedPct,
  };
}
