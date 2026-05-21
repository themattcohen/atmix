import { useCallback, useMemo, useState } from 'react';
import type {
  EngineInputs,
  EngineOutput,
  FinancialInputs,
  MultipleConfig,
  WealthGapInputs,
  AccelerationConfig,
} from '../engine';
import { compute } from '../engine';
import { READINESS_QUESTIONS, RISK_QUESTIONS } from '../data/questions';
import type { Question } from '../data/questions';

export const TOTAL_STEPS = 5;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

/** Answer-text storage. Engine converts to raw scores at compute time. */
export type AnswerMap = Record<string, string | number | null>;

export interface WizardState {
  firmName: string;
  city: string;
  readinessAnswers: AnswerMap;
  riskAnswers: AnswerMap;
  financials: FinancialInputs;
  multipleConfig: MultipleConfig;
  acceleration: AccelerationConfig;
  wealthGap: WealthGapInputs;
  showWealthGap: boolean;
}

const DEFAULT_FINANCIALS: FinancialInputs = {
  revenue: 0,
  pretaxProfit: 0,
  amortizationDepreciation: 0,
  longTermInterest: 0,
  discretionarySpending: 0,
  ownerSalary: 0,
  rentToSelf: 0,
};

const DEFAULT_MULTIPLE: MultipleConfig = {
  source: 'Use Custom Multiple',
  riskWeighting: 'Risk Weighting On',
  canadian: false,
  customMultiple: 4.0,
};

const DEFAULT_ACCELERATION: AccelerationConfig = {
  targetSizeIncreasePct: 0.10,
  targetEfficiencyIncreasePct: 0.10,
  targetMultipleIncreasePct: 0.05,
};

const DEFAULT_WEALTH_GAP: WealthGapInputs = {
  dividends: 0,
  wages: 0,
  personalExpensesCoveredByBusiness: 0,
  otherPassiveIncome: 0,
  liquidAssets: 0,
  nonMortgageDebt: 0,
  desiredPostSaleAnnualIncome: 0,
  desiredExitTimelineYears: 5,
  ownershipPct: 1.0,
  feesAndTaxesPct: 0.10,
  longTermBusinessDebt: 0,
  returnOnPortfolio: 0.075,
};

const INITIAL_STATE: WizardState = {
  firmName: '',
  city: '',
  readinessAnswers: {},
  riskAnswers: {},
  financials: DEFAULT_FINANCIALS,
  multipleConfig: DEFAULT_MULTIPLE,
  acceleration: DEFAULT_ACCELERATION,
  wealthGap: DEFAULT_WEALTH_GAP,
  showWealthGap: false,
};

/** Demo mode prefills a sample CPA firm — used for live-call rehearsals. */
const DEMO_STATE: WizardState = {
  firmName: 'Sample CPA Firm',
  city: '',
  readinessAnswers: {
    q_how_heard: 'Referral from a colleague or friend',
    q_thinking_about_selling: 'Curious but no timeline yet',
    q_exit_timeline: 'Under 12 Months',
    q_busy_season_capacity: 'Moderate capacity (5 - 10 hrs/week off-season)',
    q_shareholder_count: '1 (sole owner)',
    q_partner_exit_history: 'More than 5 years ago, clean transition',
    q_shareholder_alignment: 'Complete alignment — all partners are on the same page',
    q_life_plan: 'Yes, I have a clear and written plan',
    q_sale_price_target: null,
  },
  riskAnswers: {
    q_fye: 'December 31',
    q_incorporated: 'Yes — incorporated as a PC, PLLC, LLP, or S-Corp',
    q_profit_last_year: 'Yes',
    q_profit_last_6mo: 'Yes',
    q_financial_trend: 'Modest but consistent growth each year',
    q_clean_financials: '5+ years of clean financials',
    q_gm_or_coo: 'Yes — there is a capable #2 who currently handles operations independently',
    q_advisory_revenue_mix: 'Under 10% advisory / CAS — primarily compliance',
    q_client_concentration: 'Under 15% combined',
    q_partner_billable_split: 'Roughly even split — 30 - 60% billable',
    q_realization_rate: '90 - 95%',
    q_partner_age_dynamics: 'Partners span a reasonable range (5 - 10 years) with informal succession thinking',
    q_practice_mgmt_stack: 'Drake + Canopy or similar cloud-native workflow tool',
    q_recurring_revenue_mix: 'Pure project / annual tax-season billing — no recurring contracts',
    q_active_lawsuits: 'Multiple active matters',
    q_spof_count: '3',
  },
  financials: {
    revenue: 3_400_000,
    pretaxProfit: 350_000,
    amortizationDepreciation: 0,
    longTermInterest: 0,
    discretionarySpending: 0,
    ownerSalary: 230_000,
    rentToSelf: 0,
  },
  multipleConfig: DEFAULT_MULTIPLE,
  acceleration: DEFAULT_ACCELERATION,
  wealthGap: {
    ...DEFAULT_WEALTH_GAP,
    dividends: 250_000,
    wages: 150_000,
    personalExpensesCoveredByBusiness: 50_000,
    otherPassiveIncome: 100_000,
    liquidAssets: 1_500_000,
    nonMortgageDebt: 75_000,
    desiredPostSaleAnnualIncome: 575_000,
  },
  showWealthGap: false,
};

function lookupRawScore(question: Question, answer: string | number | null): number {
  if (answer === null || answer === undefined) return 0;
  // Toggle question: stored as { toggle: 'On'|'Off', ratio: number } — handled at engine layer
  if (question.id === 'q_sale_price_target') return 0;
  // SPOF count is numeric in dropdown
  if (question.id === 'q_spof_count') {
    const opt = question.options.find((o) => o.label === answer);
    return opt?.rawScore ?? 0;
  }
  const opt = question.options.find((o) => o.label === answer);
  return opt?.rawScore ?? 0;
}

export function buildEngineInputs(state: WizardState): EngineInputs {
  return {
    readiness: READINESS_QUESTIONS.map((q) => ({
      id: q.id,
      weight_G: q.weight_G,
      rawScore: lookupRawScore(q, state.readinessAnswers[q.id] ?? null),
      trackingOnly: q.trackingOnly,
    })),
    risk: RISK_QUESTIONS.map((q) => ({
      id: q.id,
      weight_G: q.weight_G,
      rawScore: lookupRawScore(q, state.riskAnswers[q.id] ?? null),
      trackingOnly: q.trackingOnly,
    })),
    financials: state.financials,
    multipleConfig: state.multipleConfig,
    acceleration: state.acceleration,
    wealthGap: state.wealthGap,
    mode: 'corrected',
  };
}

export function useWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [step, setStep] = useState<StepIndex>(0);

  const outputs: EngineOutput = useMemo(() => compute(buildEngineInputs(state)), [state]);

  const next = useCallback(() => {
    setStep((s) => (s < TOTAL_STEPS - 1 ? ((s + 1) as StepIndex) : s));
  }, []);
  const back = useCallback(() => {
    setStep((s) => (s > 0 ? ((s - 1) as StepIndex) : s));
  }, []);
  const goTo = useCallback((s: StepIndex) => setStep(s), []);
  const loadDemo = useCallback(() => setState(DEMO_STATE), []);
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setStep(0);
  }, []);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const updateReadiness = useCallback((id: string, value: string | number | null) => {
    setState((s) => ({ ...s, readinessAnswers: { ...s.readinessAnswers, [id]: value } }));
  }, []);
  const updateRisk = useCallback((id: string, value: string | number | null) => {
    setState((s) => ({ ...s, riskAnswers: { ...s.riskAnswers, [id]: value } }));
  }, []);
  const updateFinancials = useCallback((patch: Partial<FinancialInputs>) => {
    setState((s) => ({ ...s, financials: { ...s.financials, ...patch } }));
  }, []);
  const updateWealthGap = useCallback((patch: Partial<WealthGapInputs>) => {
    setState((s) => ({ ...s, wealthGap: { ...s.wealthGap, ...patch } }));
  }, []);

  return {
    state,
    step,
    outputs,
    next,
    back,
    goTo,
    loadDemo,
    reset,
    update,
    updateReadiness,
    updateRisk,
    updateFinancials,
    updateWealthGap,
  };
}
