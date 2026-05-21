/**
 * Multiple lookup tables — Part 1 rows 63-64 of the source sheet (hardcoded constants).
 *
 * Common bands apply when source = 'Use Common Multiples' or 'Use Custom Multiple'.
 * Industry bands apply when source = 'From Financials' or 'Use Industry Multiples'.
 *
 * Source-sheet NAICS-to-industry-band lookup was BROKEN (dead 'Multiple Data' ref). We
 * preserve the industry-band defaults until a per-NAICS table is sourced from CPA-firm
 * M&A benchmarks (Mostad & Christensen, Accounting Today annual survey).
 */

export interface MultipleBand {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
}

export const COMMON_MULTIPLES: MultipleBand = {
  p10: 1.5,
  p25: 2.0,
  median: 3.5,
  p75: 5.0,
  p90: 8.0,
  mean: 3.5, // sheet J63 = median(D63:I63) = 3.5
};

export const INDUSTRY_MULTIPLES: MultipleBand = {
  p10: 1.7,
  p25: 2.7,
  median: 4.0,
  p75: 5.7,
  p90: 8.7,
  mean: 4.0, // sheet J64 = F64 = 4.0
};

/** Canadian discount: flat -0.5 from the multiple when G59='Yes' (verified D66 formula). */
export const CANADIAN_DISCOUNT = 0.5;
