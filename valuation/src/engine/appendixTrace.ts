/**
 * Appendix trace builder — pure transformation that annotates engine inputs with
 * question definitions to produce the AppendixTrace used by the PDF appendix.
 *
 * This file does NOT recompute any scores. It reads already-computed outputs from
 * MultipleOutput and SellabilityOutput and echoes inputs verbatim.
 */

import type {
  AccelerationConfig,
  AppendixTrace,
  EngineInputs,
  FinancialInputs,
  MultipleConfig,
  MultipleOutput,
  QuestionTrace,
  ReadinessQuestionScore,
  RiskQuestionScore,
  SellabilityOutput,
  WealthGapInputs,
} from './types';

export interface QuestionDef {
  id: string;
  cell: string;
  prompt: string;
  weight_G: number;
  trackingOnly?: boolean;
  options: Array<{ label: string; rawScore: number }>;
}

export interface TraceContext {
  readinessQuestionDefs: QuestionDef[];
  riskQuestionDefs: QuestionDef[];
  financialsInput: FinancialInputs;
  wealthGapInput?: WealthGapInputs;
  multipleConfigInput: MultipleConfig;
  accelerationConfigInput: AccelerationConfig;
}

function buildQuestionTrace(
  score: ReadinessQuestionScore | RiskQuestionScore,
  defs: QuestionDef[],
  step: 1 | 2,
): QuestionTrace {
  const def = defs.find((d) => d.id === score.id);

  if (!def) {
    // Definition not found — produce a minimal trace row
    const trackingOnly = score.trackingOnly === true;
    const contribution = trackingOnly ? 0 : step === 1 ? score.rawScore : score.rawScore * score.weight_G;
    const maxPossible = trackingOnly ? 0 : score.weight_G * 5;
    return {
      id: score.id,
      cell: '',
      prompt: '(question definition not found)',
      answerLabel: '(question definition not found)',
      rawScore: score.rawScore,
      weight_G: score.weight_G,
      contribution,
      maxPossible,
      trackingOnly,
    };
  }

  const trackingOnly = def.trackingOnly === true;

  // Find the option label matching the rawScore (first match wins)
  const matchedOption = def.options.find((o) => o.rawScore === score.rawScore);
  const answerLabel = matchedOption ? matchedOption.label : '(not recorded)';

  // Step 1: contribution = rawScore (NOT x G). Step 2: contribution = rawScore x G.
  // trackingOnly: contribution = 0.
  let contribution: number;
  if (trackingOnly) {
    contribution = 0;
  } else if (step === 1) {
    contribution = score.rawScore;
  } else {
    contribution = score.rawScore * score.weight_G;
  }

  const maxPossible = trackingOnly ? 0 : score.weight_G * 5;

  return {
    id: score.id,
    cell: def.cell,
    prompt: def.prompt,
    answerLabel,
    rawScore: score.rawScore,
    weight_G: score.weight_G,
    contribution,
    maxPossible,
    trackingOnly,
  };
}

export function buildAppendixTrace(
  inputs: EngineInputs,
  trace: TraceContext,
  _sellability: SellabilityOutput,
  multiple: MultipleOutput,
): AppendixTrace {
  const readinessQuestions: QuestionTrace[] = inputs.readiness.map((score) =>
    buildQuestionTrace(score, trace.readinessQuestionDefs, 1),
  );

  const riskQuestions: QuestionTrace[] = inputs.risk.map((score) =>
    buildQuestionTrace(score, trace.riskQuestionDefs, 2),
  );

  const fin = trace.financialsInput;
  const financials = {
    revenue: fin.revenue,
    pretaxProfit: fin.pretaxProfit,
    amortizationDepreciation: fin.amortizationDepreciation,
    longTermInterest: fin.longTermInterest,
    discretionarySpending: fin.discretionarySpending,
    ownerSalary: fin.ownerSalary,
    rentToSelf: fin.rentToSelf,
    ...(typeof fin.marketRateReplacementSalary === 'number'
      ? { marketRateReplacementSalary: fin.marketRateReplacementSalary }
      : {}),
  };

  const cfg = inputs.multipleConfig;
  const multipleTrace = {
    source: cfg.source,
    riskWeighting: cfg.riskWeighting,
    canadian: cfg.canadian,
    customMultiple: cfg.customMultiple,
    tableUsed: multiple.tableUsed,
    bandSelected: multiple.bandSelected,
    bandRule: multiple.bandRule,
    customMultipleBypassed: multiple.customMultipleBypassed,
    canadianApplied: multiple.canadianApplied,
  };

  const acc = trace.accelerationConfigInput;
  const acceleration = {
    targetSizeIncreasePct: acc.targetSizeIncreasePct,
    targetEfficiencyIncreasePct: acc.targetEfficiencyIncreasePct,
    targetMultipleIncreasePct: acc.targetMultipleIncreasePct,
  };

  const result: AppendixTrace = {
    readinessQuestions,
    riskQuestions,
    financials,
    multiple: multipleTrace,
    acceleration,
  };

  if (trace.wealthGapInput !== undefined) {
    const wg = trace.wealthGapInput;
    result.wealthGap = {
      dividends: wg.dividends,
      wages: wg.wages,
      personalExpensesCoveredByBusiness: wg.personalExpensesCoveredByBusiness,
      otherPassiveIncome: wg.otherPassiveIncome,
      liquidAssets: wg.liquidAssets,
      nonMortgageDebt: wg.nonMortgageDebt,
      desiredPostSaleAnnualIncome: wg.desiredPostSaleAnnualIncome,
      desiredExitTimelineYears: wg.desiredExitTimelineYears,
      ownershipPct: wg.ownershipPct,
      feesAndTaxesPct: wg.feesAndTaxesPct,
      longTermBusinessDebt: wg.longTermBusinessDebt,
      returnOnPortfolio: wg.returnOnPortfolio,
    };
  }

  return result;
}
