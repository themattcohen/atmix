/**
 * Engine entry point — single function that takes all inputs and returns all outputs.
 *
 * Used by:
 *   - The wizard's ValueTicker (sticky live-updating valuation)
 *   - The Results screen (full breakdown)
 *   - The PDF report
 *   - The parity test suite (literal mode) and corrected test suite (corrected mode)
 */

import { computeAcceleration } from './acceleration';
import { computeEbitda } from './ebitda';
import { computeMultiple } from './multiple';
import { computeSellability } from './sellability';
import { computeWealthGap } from './wealthGap';
import type { EngineInputs, EngineOutput } from './types';

export function compute(inputs: EngineInputs): EngineOutput {
  const ebitdaFull = computeEbitda(inputs.financials, inputs.mode);
  const { sizeScore, ...ebitda } = ebitdaFull;

  const sellability = computeSellability({
    readiness: inputs.readiness,
    risk: inputs.risk,
    sizeScore,
  });

  const multiple = computeMultiple({
    config: inputs.multipleConfig,
    sellabilityPct: sellability.sellabilityPct,
  });

  const acceleration = computeAcceleration({
    financials: inputs.financials,
    ebitda: ebitdaFull,
    ebitdaMultipleUsed: multiple.ebitdaMultipleUsed,
    config: inputs.acceleration,
  });

  const wealthGap = computeWealthGap(inputs.wealthGap, inputs.mode);

  return {
    sellability,
    ebitda,
    multiple,
    acceleration,
    wealthGap,
    mode: inputs.mode,
  };
}

export type * from './types';
