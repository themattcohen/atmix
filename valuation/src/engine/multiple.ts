/**
 * Multiple selection — Part 1 cells E66, G66, J65, D66, J67.
 *
 * Verbatim from XLSX:
 *   E66 = IF(G57="Use Common Multiples", F63 [common median], F64 [industry median])
 *   G66 = banded VLOOKUP into multiple table by sellability % (J4):
 *           ≤0.5  → 10th pct
 *           ≤0.6  → 25th pct
 *           ≤0.7  → median
 *           ≤0.85 → (median + 75th) / 2
 *           ≤0.95 → 75th
 *           else  → (75th + 90th) / 2
 *         table selected: common if G57 in {Common, Custom}; industry otherwise
 *   D66 = if Risk Weighting Off → E66 (with -0.5 if Canadian)
 *         if Risk Weighting On  → G66 (with -0.5 if Canadian)
 *   J65 = always G66 (informational display)
 *   J67 = if G57="Use Custom Multiple" → G60 (custom)
 *         else → D66
 *
 * Custom multiple BYPASSES risk weighting (verified from XLSX).
 * Canadian discount is FLAT -0.5 from the multiple (verified D66 formula).
 */

import {
  CANADIAN_DISCOUNT,
  COMMON_MULTIPLES,
  INDUSTRY_MULTIPLES,
  type MultipleBand,
} from '../data/multipleBands';
import type { BandSelected, MultipleConfig, MultipleOutput } from './types';

function pctStr(p: number): string {
  return (p * 100).toFixed(2) + '%';
}

interface BandMeta {
  value: number;
  bandSelected: BandSelected;
  bandRule: string;
}

function bandedPickWithMeta(band: MultipleBand, sellabilityPct: number): BandMeta {
  const p = sellabilityPct;
  if (p <= 0.5)
    return { value: band.p10, bandSelected: 'p10', bandRule: `Sellability ${pctStr(p)} <= 50%: use 10th percentile` };
  if (p <= 0.6)
    return { value: band.p25, bandSelected: 'p25', bandRule: `Sellability ${pctStr(p)} in (50%, 60%]: use 25th percentile` };
  if (p <= 0.7)
    return { value: band.median, bandSelected: 'median', bandRule: `Sellability ${pctStr(p)} in (60%, 70%]: use median` };
  if (p <= 0.85)
    return { value: (band.median + band.p75) / 2, bandSelected: 'median-p75-avg', bandRule: `Sellability ${pctStr(p)} in (70%, 85%]: use average of median and 75th` };
  if (p <= 0.95)
    return { value: band.p75, bandSelected: 'p75', bandRule: `Sellability ${pctStr(p)} in (85%, 95%]: use 75th percentile` };
  return { value: (band.p75 + band.p90) / 2, bandSelected: 'p75-p90-avg', bandRule: `Sellability ${pctStr(p)} > 95%: use average of 75th and 90th` };
}

function bandedPick(band: MultipleBand, sellabilityPct: number): number {
  return bandedPickWithMeta(band, sellabilityPct).value;
}

export interface MultipleInputs {
  config: MultipleConfig;
  sellabilityPct: number;
}

export function computeMultiple(inputs: MultipleInputs): MultipleOutput {
  const { source, riskWeighting, canadian, customMultiple } = inputs.config;

  const commonArr = [
    COMMON_MULTIPLES.p10,
    COMMON_MULTIPLES.p25,
    COMMON_MULTIPLES.median,
    COMMON_MULTIPLES.p75,
    COMMON_MULTIPLES.p90,
    COMMON_MULTIPLES.mean,
  ];
  const industryArr = [
    INDUSTRY_MULTIPLES.p10,
    INDUSTRY_MULTIPLES.p25,
    INDUSTRY_MULTIPLES.median,
    INDUSTRY_MULTIPLES.p75,
    INDUSTRY_MULTIPLES.p90,
    INDUSTRY_MULTIPLES.mean,
  ];

  // E66 — no-risk base (median pick)
  const noRiskBase =
    source === 'Use Common Multiples' ? COMMON_MULTIPLES.median : INDUSTRY_MULTIPLES.median;

  // G66 — risk-banded pick. Common table when source is Common or Custom; industry otherwise.
  const useCommonTable = source === 'Use Common Multiples' || source === 'Use Custom Multiple';
  const tableForRisk = useCommonTable ? COMMON_MULTIPLES : INDUSTRY_MULTIPLES;
  const riskBandMeta = bandedPickWithMeta(tableForRisk, inputs.sellabilityPct);
  const riskWeightedBase = riskBandMeta.value;

  // J65 — informational display always = G66 (in the sheet J65 actually does the
  // same banded pick fresh, but the formula collapses to G66 when same table is used).
  const riskWeightedDisplay = riskWeightedBase;

  // D66 — final from-financials multiple after risk + Canadian
  // For "From Financials" / "Use Industry Multiples", the risk pick uses INDUSTRY table.
  const tableForFromFinancials =
    source === 'Use Common Multiples' ? COMMON_MULTIPLES : INDUSTRY_MULTIPLES;
  const fromFinancialsRiskPick = bandedPick(tableForFromFinancials, inputs.sellabilityPct);
  const fromFinancialsNoRiskPick =
    source === 'Use Common Multiples' ? COMMON_MULTIPLES.median : INDUSTRY_MULTIPLES.median;

  let fromFinancialsFinal: number;
  if (riskWeighting === 'Risk Weighting Off') {
    fromFinancialsFinal = canadian ? fromFinancialsNoRiskPick - CANADIAN_DISCOUNT : fromFinancialsNoRiskPick;
  } else {
    fromFinancialsFinal = canadian ? fromFinancialsRiskPick - CANADIAN_DISCOUNT : fromFinancialsRiskPick;
  }

  // J67 — actual multiple used. Custom bypasses risk weighting.
  const customMultipleBypassed = source === 'Use Custom Multiple';
  const ebitdaMultipleUsed = customMultipleBypassed ? customMultiple : fromFinancialsFinal;

  // tableUsed: common when source is 'Use Common Multiples' or 'Use Custom Multiple'
  const tableUsed: 'common' | 'industry' = useCommonTable ? 'common' : 'industry';

  // canadianApplied: true only when Canadian flag set AND custom multiple was NOT bypassed
  const canadianApplied = canadian && !customMultipleBypassed;

  return {
    commonMultiples: commonArr,
    industryMultiples: industryArr,
    noRiskBase,
    riskWeightedBase,
    riskWeightedDisplay,
    fromFinancialsFinal,
    ebitdaMultipleUsed,
    bandSelected: riskBandMeta.bandSelected,
    bandRule: riskBandMeta.bandRule,
    tableUsed,
    customMultipleBypassed,
    canadianApplied,
  };
}
