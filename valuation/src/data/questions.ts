/**
 * CPA-Firm Valuation Question Set
 * Someday Consulting — Valuation Webapp
 *
 * SOURCE: someday_valuation_engine_spec.md — Section 1 (24-question set, verified from XLSX).
 * This file is a "full CPA rewrite": 8 generic SMB questions replaced with CPA-firm-specific
 * equivalents. ALL G weights are preserved verbatim from the source sheet so the J4
 * sellability formula stays calibrated.
 *
 * CALIBRATION PROOF (read before editing G values):
 *
 *   Step 1 — READINESS (rows H12-H18, 7 scoring + 2 tracking-only = 9 total):
 *     q_exit_timeline         G=2  → max 10
 *     q_busy_season_capacity  G=2  → max 10   [CPA rewrite of "energy for sale"]
 *     q_shareholder_count     G=2  → max 10
 *     q_partner_exit_history  G=1  → max  5   [CPA rewrite of "exit-plan duration"]
 *     q_shareholder_alignment G=2  → max 10
 *     q_life_plan             G=3  → max 15
 *     q_sale_price_target     G=— → K18 = if(On, 15, 0); toggle-only
 *     ─────────────────────────────────────────
 *     STEP1_MAX = 10+10+10+5+10+15+0 = 60  (K18 = 0 when toggle Off; preserved behavior)
 *
 *   Step 2 — RISK (rows H24-H38, 15 scoring + 1 tracking-only FYE = 16 total):
 *     q_fye                   G=0  → tracking-only (K24 = 0, contributes nothing)
 *     q_incorporated          G=3  → max 15
 *     q_profit_last_year      G=3  → max 15
 *     q_profit_last_6mo       G=3  → max 15
 *     q_financial_trend       G=2  → max 10
 *     q_clean_financials      G=2  → max 10
 *     q_gm_or_coo             G=3  → max 15
 *     q_advisory_revenue_mix  G=2  → max 10   [CPA rewrite of "project-based?"]
 *     q_client_concentration  G=2  → max 10   [CPA rewrite of "largest customer %"]
 *     q_partner_billable_split G=1 → max  5   [CPA rewrite of "owner hours/week IN biz"]
 *     q_realization_rate      G=1  → max  5   [CPA rewrite of "lease remaining"]
 *     q_partner_age_dynamics  G=1  → max  5   [CPA rewrite of "company age"]
 *     q_practice_mgmt_stack   G=2  → max 10   [CPA rewrite of "business OS"]
 *     q_recurring_revenue_mix G=2  → max 10   [CPA rewrite of "payment type"]
 *     q_active_lawsuits       G=2  → max 10
 *     q_spof_count            G=1  → max  5
 *     ─────────────────────────────────────────
 *     STEP2_MAX = 0+15+15+15+10+10+15+10+10+5+5+5+10+10+10+5 = 150
 *
 *   COMBINED_MAX = 60 + 150 = 210  (= K39 in source sheet; denominator of J4)
 *
 * NOTE on Step 1 scoring: raw scores are NOT multiplied by G in Step 1 (verified from sheet
 * cells I12-I17). In Step 2, scores ARE multiplied: I_n = rawScore × G. The G weight in
 * Step 1 questions affects only the max (K_n = G × 5), not the score itself.
 */

export type ScoringMode = 'unweighted_raw' | 'weighted_raw_times_G';

export interface QuestionOption {
  label: string;     // shown in dropdown
  rawScore: number;  // 0-5 (or negative for lawsuits/SPOFs)
}

export interface Question {
  id: string;                  // e.g. 'q_exit_timeline'
  step: 1 | 2;
  cell: string;                // original sheet cell for traceability, e.g. 'H12'
  weight_G: number;            // G multiplier; max points = G × 5 (Step 2) or G × 5 (Step 1 max only)
  prompt: string;              // CPA-tailored question text
  helperText?: string;         // optional explainer shown below the dropdown
  scoringMode: ScoringMode;    // Step 1 = 'unweighted_raw', Step 2 = 'weighted_raw_times_G'
  options: QuestionOption[];   // dropdown choices in display order
  cpaRewrite: boolean;         // true if this replaces a source question
  sourceQuestion?: string;     // original sheet wording if cpaRewrite = true
  rationale?: string;          // why this CPA version captures more signal
  trackingOnly?: boolean;      // true = no score impact (Q1/Q2 per step, FYE)
}

// ---------------------------------------------------------------------------
// STEP 1 — READINESS (9 items: 2 tracking-only, 7 scoring)
// ---------------------------------------------------------------------------

export const READINESS_QUESTIONS: Question[] = [
  // ── Tracking-only ─────────────────────────────────────────────────────────
  {
    id: 'q_how_heard',
    step: 1,
    cell: 'H10',
    weight_G: 0,
    prompt: 'How did you hear about Someday?',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Referral from a colleague or friend', rawScore: 0 },
      { label: 'Industry conference or event', rawScore: 0 },
      { label: 'Online search', rawScore: 0 },
      { label: 'Social media', rawScore: 0 },
      { label: 'Other', rawScore: 0 },
    ],
    cpaRewrite: false,
    trackingOnly: true,
  },
  {
    id: 'q_thinking_about_selling',
    step: 1,
    cell: 'H11',
    weight_G: 0,
    prompt: 'Are you actively thinking about selling your firm?',
    helperText: 'This helps us tailor the rest of your assessment.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Yes, actively planning', rawScore: 0 },
      { label: 'Starting to explore options', rawScore: 0 },
      { label: 'Curious but no timeline yet', rawScore: 0 },
      { label: 'Just benchmarking my firm\'s value', rawScore: 0 },
    ],
    cpaRewrite: false,
    trackingOnly: true,
  },

  // ── Scoring questions ──────────────────────────────────────────────────────
  {
    id: 'q_exit_timeline',
    step: 1,
    cell: 'H12',
    weight_G: 2,
    prompt: 'What is your target exit timeline?',
    helperText:
      'Buyers pay more when sellers have time to run a proper process. Rushed exits close at lower multiples.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: '5+ Years', rawScore: 5 },
      { label: '2 - 4 Years', rawScore: 4 },
      { label: '1 - 2 Years', rawScore: 3 },
      { label: 'Under 12 Months', rawScore: 2 },
      { label: 'Not sure', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_busy_season_capacity',
    step: 1,
    cell: 'H13',
    weight_G: 2,
    prompt: 'How much capacity will you have between busy seasons to prepare for a sale?',
    helperText:
      'Sale prep for a CPA firm (clean financials, staff documentation, client transition plan) takes real time. Capacity between January–April and September–October crunch periods is the realistic window.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Significant capacity (I can dedicate 10+ hrs/week off-season)', rawScore: 5 },
      { label: 'Moderate capacity (5 - 10 hrs/week off-season)', rawScore: 3 },
      { label: 'Limited capacity (under 5 hrs/week even off-season)', rawScore: 2 },
      { label: 'No realistic capacity, the firm runs on me year-round', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How much energy and time do you have available for sale preparation?',
    rationale:
      'CPA firms have a defined off-season structure. "A Large Amount of energy" is meaningless without acknowledging busy-season constraints. This version surfaces whether the owner can realistically prep without degrading client service.',
  },
  {
    id: 'q_shareholder_count',
    step: 1,
    cell: 'H14',
    weight_G: 2,
    prompt: 'How many equity partners does the firm have?',
    helperText:
      'More equity partners means more people who must agree on deal terms, price, and timing. Single-owner firms close faster.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: '1 (sole owner)', rawScore: 5 },
      { label: '2', rawScore: 4 },
      { label: '3', rawScore: 3 },
      { label: '4', rawScore: 2 },
      { label: '5 or more', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_partner_exit_history',
    step: 1,
    cell: 'H15',
    weight_G: 1,
    prompt: 'When did the most recent partner retire or exit the firm, and was the transition clean?',
    helperText:
      'A recent, clean partner exit is evidence that the firm has governance muscle and that clients transferred without attrition. "Clean" means no litigation, no client walkout, and the book of business stayed.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Within the last 5 years, clean transition', rawScore: 5 },
      { label: 'More than 5 years ago, clean transition', rawScore: 4 },
      { label: 'No prior partner exit (founder-only firm)', rawScore: 4 },
      { label: 'Within the last 5 years, but transition was rocky', rawScore: 2 },
      { label: 'Exit ended in dispute or significant client loss', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How long have you been working on your exit plan? (5+ years / 3+ years / 2 years / 1 year)',
    rationale:
      'For CPA firms, the number of years spent thinking about an exit matters far less than demonstrated client-transition capability. A prior clean partner exit is the strongest proxy for that. Buyers discount firms with no evidence of transferable client relationships.',
  },
  {
    id: 'q_shareholder_alignment',
    step: 1,
    cell: 'H16',
    weight_G: 2,
    prompt: 'How aligned are all equity partners on the decision to sell, the timing, and price expectations?',
    helperText:
      'Misalignment between partners is the single most common deal-killer in CPA firm M&A. Buyers walk when they sense a divided partnership mid-process.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Complete alignment, all partners are on the same page', rawScore: 5 },
      { label: 'Mostly aligned, minor differences on timing or price', rawScore: 4 },
      { label: 'Alignment is a work in progress, active conversations underway', rawScore: 2 },
      { label: 'Significant disagreement among partners', rawScore: 0 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_life_plan',
    step: 1,
    cell: 'H17',
    weight_G: 3,
    prompt: 'Do you have a clear plan for what you will do after the sale?',
    helperText:
      'Sellers with a defined post-sale identity (a board seat, a new practice, a retirement plan) negotiate from strength. Sellers who are ambivalent often sabotage their own deals.',
    scoringMode: 'unweighted_raw',
    options: [
      { label: 'Yes, I have a clear and written plan', rawScore: 5 },
      { label: 'Partial plan, the broad strokes are clear', rawScore: 3 },
      { label: 'Just starting to think about life after the firm', rawScore: 2 },
      { label: 'No plan yet', rawScore: 0 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_sale_price_target',
    step: 1,
    cell: 'H18',
    weight_G: 0, // special: K18 = if(toggle=On, 15, 0). Computed separately in engine.
    prompt: 'Do you have a specific sale price you need to achieve?',
    helperText:
      'If you enter a target, we will show you how your valuation compares and how large the gap is. Leave this off if you want an unanchored assessment first.',
    scoringMode: 'unweighted_raw',
    options: [], // toggle + numeric input — handled as a special UI component, not a dropdown
    cpaRewrite: false,
  },
];

// ---------------------------------------------------------------------------
// STEP 2 — RISK (16 items: 1 tracking-only FYE, 15 scoring)
// ---------------------------------------------------------------------------

export const RISK_QUESTIONS: Question[] = [
  // ── Tracking-only ─────────────────────────────────────────────────────────
  {
    id: 'q_fye',
    step: 2,
    cell: 'H24',
    weight_G: 0,
    prompt: 'What is your fiscal year end?',
    helperText: 'Used to align financial period questions below.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'December 31', rawScore: 0 },
      { label: 'March 31', rawScore: 0 },
      { label: 'June 30', rawScore: 0 },
      { label: 'September 30', rawScore: 0 },
      { label: 'Other', rawScore: 0 },
    ],
    cpaRewrite: false,
    trackingOnly: true,
  },

  // ── Scoring questions ──────────────────────────────────────────────────────
  {
    id: 'q_incorporated',
    step: 2,
    cell: 'H25',
    weight_G: 3,
    prompt: 'Is the firm incorporated as a legal entity separate from you personally?',
    helperText:
      'Incorporated firms (PC, PLLC, LLP, S-Corp) are structurally easier to sell. Sole proprietorships must convert before a deal can close, adding cost and time.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Yes, incorporated as a PC, PLLC, LLP, or S-Corp', rawScore: 5 },
      { label: 'No, operating as a sole proprietor or DBA', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_profit_last_year',
    step: 2,
    cell: 'H26',
    weight_G: 3,
    prompt: 'Was the firm profitable in its most recent full fiscal year?',
    helperText:
      'A single year of losses is not disqualifying, but it requires explanation. Two consecutive losing years will materially compress multiples.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Yes', rawScore: 5 },
      { label: 'No', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_profit_last_6mo',
    step: 2,
    cell: 'H27',
    weight_G: 3,
    prompt: 'Has the firm been profitable in the last 6 months?',
    helperText: 'Trailing profitability confirms the most recent full-year results are not a one-time event.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Yes', rawScore: 5 },
      { label: 'No', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_financial_trend',
    step: 2,
    cell: 'H28',
    weight_G: 2,
    prompt: 'How would you describe your firm\'s revenue trend over the last 5 years?',
    helperText:
      'Acquirers underwrite future cash flows. A consistent upward trend is the single strongest predictor of a premium multiple.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: '10%+ year-over-year steady growth', rawScore: 5 },
      { label: 'Modest but consistent growth each year', rawScore: 4 },
      { label: 'Flat, stable and consistent but not growing', rawScore: 3 },
      { label: 'Steadily declining', rawScore: 2 },
      { label: 'Volatile (mix of up and down years)', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_clean_financials',
    step: 2,
    cell: 'H29',
    weight_G: 2,
    prompt: 'How many years of clean, reviewed or compiled financial statements does the firm have?',
    helperText:
      'Reviewed financials (not necessarily audited) dramatically reduce due-diligence friction. "Clean" means no restatements, minimal personal-expense commingling, and consistent treatment of owner add-backs.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: '5+ years of clean financials', rawScore: 5 },
      { label: '3 - 4 years', rawScore: 4 },
      { label: '2 years', rawScore: 3 },
      { label: '1 year', rawScore: 2 },
      { label: 'Less than 1 year or financials need cleanup', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_gm_or_coo',
    step: 2,
    cell: 'H30',
    weight_G: 3,
    prompt: 'Is there a senior manager, managing director, or operations lead who can run day-to-day firm operations without you?',
    helperText:
      'The acquirer is not buying your hours; they are buying a system. If you are the system, they are buying a job. A capable #2 can add 0.5 - 1.0x to the multiple.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Yes, there is a capable #2 who currently handles operations independently', rawScore: 5 },
      { label: 'No', rawScore: 1 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_advisory_revenue_mix',
    step: 2,
    cell: 'H31',
    weight_G: 2,
    prompt: 'What percentage of your firm\'s revenue comes from advisory, CFO, or CAS (Client Accounting Services) work vs. compliance/tax prep?',
    helperText:
      'Advisory and CAS revenue commands higher multiples because it is recurring, relationship-based, and not subject to annual re-engagement. Pure compliance shops trade at 0.8 - 1.2x gross revenue; firms with 30%+ advisory routinely clear 1.5x+.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Over 50% advisory / CAS', rawScore: 5 },
      { label: '25 - 50% advisory / CAS', rawScore: 4 },
      { label: '10 - 25% advisory / CAS', rawScore: 3 },
      { label: 'Under 10% advisory / CAS, primarily compliance', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'Is your business primarily project-based? (No / Between / Yes)',
    rationale:
      'The generic "project-based?" question conflates one-time projects with annual compliance engagements. For CPA firms, the meaningful distinction is advisory/CAS vs. compliance, because that mix directly maps to the multiples buyers use. A compliance-only firm at 10% EBITDA margin is worth 1.0x gross; an advisory-forward firm at the same margin is worth 1.5 - 2.0x. This question unlocks that delta.',
  },
  {
    id: 'q_client_concentration',
    step: 2,
    cell: 'H32',
    weight_G: 2,
    prompt: 'What percentage of your firm\'s revenue comes from your top 3 clients combined?',
    helperText:
      'CPA firm acquirers routinely require reps that no single client exceeds 15% of revenue. High concentration is a deal-breaker or triggers an earnout for those specific clients.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Under 15% combined', rawScore: 5 },
      { label: '15 - 30% combined', rawScore: 4 },
      { label: '30 - 50% combined', rawScore: 3 },
      { label: 'Over 50% combined', rawScore: 2 },
      { label: 'One client alone exceeds 30% of revenue', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'What percentage of revenue comes from your largest single customer? (Under 1% / Under 5% / 5%-15% / Over 15%)',
    rationale:
      'Generic concentration bands designed for product businesses. CPA buyers care about the top 3 combined, not just the single largest, because three concentrated tax clients who all retire simultaneously is the same risk as one whale. The 15% / 30% / 50% breakpoints match standard rep & warranty thresholds in CPA M&A term sheets.',
  },
  {
    id: 'q_partner_billable_split',
    step: 2,
    cell: 'H33',
    weight_G: 1,
    prompt: 'As the managing partner, roughly what share of your time is spent on billable client work versus firm management, business development, and administration?',
    helperText:
      'A partner who is still 80% billable has not built a firm; they have built a practice. Buyers want leaders who have already transitioned to management, because that signals the revenue is not personally held.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Mostly management, under 30% of my time is billable', rawScore: 5 },
      { label: 'Roughly even split, 30 to 60% billable', rawScore: 3 },
      { label: 'Mostly billable, over 60% of my time is client-facing work', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How many hours per week does the owner work IN the business? (Under 10 / Under 20 / 20-30 / 30-50 / Over 50)',
    rationale:
      'Raw hours/week is a noisy signal for CPA firms where billing utilization matters more than clock time. A partner billing 35 hrs/week but running no business development is a critical risk; a partner billing 15 hrs/week but driving $800K in new business is an asset. The billable-vs.-management split is the variable acquirers actually diligence.',
  },
  {
    id: 'q_realization_rate',
    step: 2,
    cell: 'H34',
    weight_G: 1,
    prompt: 'What is your firm\'s average realization rate? (Collected revenue as a percentage of billable hours at standard rates)',
    helperText:
      'A healthy CPA firm realizes nearly all of its billings. Anything under 95% indicates active discounting (often to retain at-risk clients), and buyers will model that downward.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: '95% or higher', rawScore: 5 },
      { label: '90 - 95%', rawScore: 3 },
      { label: '85 - 90%', rawScore: 2 },
      { label: 'Under 85%', rawScore: 1 },
      { label: 'We don\'t track realization rate', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How long is your remaining lease? (Over 10 years / Over 8 years / 5-8 years / Under 5 years / Building is Owned)',
    rationale:
      'Lease length is nearly irrelevant for CPA firms: most operate in standard Class B office and buyers either assume the lease or convert staff to remote. Realization rate, by contrast, is a direct margin proxy that survives normalization. A firm at 80% realization on $1M of standard billings collects $800K; improving to 90% is a $100K revenue gain with zero incremental cost.',
  },
  {
    id: 'q_partner_age_dynamics',
    step: 2,
    cell: 'H35',
    weight_G: 1,
    prompt: 'What is the age profile of the equity partner group, and are partners aligned on retirement timing?',
    helperText:
      'CPA firms where all partners are within 5 years of retirement face an accelerated timeline regardless of readiness. Staggered partner ages with documented succession plans are far more attractive to buyers.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'Partners span a 10+ year age range and have a documented succession plan', rawScore: 5 },
      { label: 'Partners span a reasonable range (5 - 10 years) with informal succession thinking', rawScore: 4 },
      { label: 'Partners are close in age (within 5 years of each other) but are in no rush', rawScore: 3 },
      { label: 'Multiple partners are within 3 - 5 years of retirement with no succession plan', rawScore: 2 },
      { label: 'Single partner (succession risk is all concentrated in one person)', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How old is the company? (Over 25 years / Over 15 years / 10-15 years / Under 10 years)',
    rationale:
      'Firm age is a weak signal for CPA M&A; acquirers care about partner-age dynamics because that drives exit urgency and negotiating leverage. A 40-year-old firm where all three partners are 63 has much higher key-man risk than a 12-year-old firm with one 45-year-old managing partner. This question directly captures the succession risk that buyers price into earnout structures.',
  },
  {
    id: 'q_practice_mgmt_stack',
    step: 2,
    cell: 'H36',
    weight_G: 2,
    prompt: 'Which practice management and tax preparation platform does the firm use?',
    helperText:
      'Platform matters for integration cost. Acquirers already on Thomson Reuters or Wolters Kluwer ecosystems can onboard your staff faster, reducing post-close risk. Excel-based workflows signal manual overhead that must be priced into transition cost.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'CCH Axcess (cloud) + integrated workflow (e.g., CCH Axcess Workflow)', rawScore: 5 },
      { label: 'UltraTax CS + Karbon or Practice CS', rawScore: 4 },
      { label: 'Drake + Canopy or similar cloud-native workflow tool', rawScore: 3 },
      { label: 'Lacerte + QuickBooks or QBO-based workflow', rawScore: 2 },
      { label: 'Excel / email-driven workflow with no integrated practice management', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'Does the business use a business operating system? (Cloud-based ERP / Customized CRM / Basic CRM / Excel Sheets)',
    rationale:
      'Generic "ERP vs. CRM vs. Excel" tiers do not map to CPA firm technology. No CPA firm uses a "Cloud-based ERP" in the SMB sense. The relevant axis is: is the firm on a modern integrated practice management platform (CCH Axcess, Thomson Reuters) or is it cobbled together? This directly affects integration cost and therefore post-close earnout risk, which buyers price explicitly.',
  },
  {
    id: 'q_recurring_revenue_mix',
    step: 2,
    cell: 'H37',
    weight_G: 2,
    prompt: 'What best describes how clients pay for ongoing work?',
    helperText:
      'Monthly retainer or subscription arrangements allow the acquirer to underwrite cash flow with confidence. Annual tax-season billings carry reinstatement risk: the client can, and occasionally does, not come back.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: '70%+ of revenue is monthly retainer or subscription-based', rawScore: 5 },
      { label: '30 - 70% retainer / subscription, rest is project or annual', rawScore: 4 },
      { label: 'Mostly project-based or annual engagements with some retainers', rawScore: 3 },
      { label: 'Pure project / annual tax-season billing, no recurring contracts', rawScore: 1 },
    ],
    cpaRewrite: true,
    sourceQuestion: 'How do your customers pay? (Contracted Recurring Monthly / Some Recurring Revenue / Cash and Carry / Deposit + Payment on Completion / 30-90 day terms)',
    rationale:
      '"Cash and carry" and "30-90 day terms" do not translate to a professional services context. CPA firms bill on retainer or by engagement; the meaningful distinction is whether those engagements auto-renew monthly or require annual re-engagement. Monthly retainer coverage above 70% is explicitly modeled in CPA deal structures as a value premium.',
  },
  {
    id: 'q_active_lawsuits',
    step: 2,
    cell: 'H38',
    weight_G: 2,
    prompt: 'Does the firm have any active malpractice claims, regulatory actions, or litigation?',
    helperText:
      'Even a single active malpractice claim is disclosed in reps & warranties and requires an escrow holdback. Multiple claims typically delay or kill deals.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: 'No active claims, suits, or regulatory actions', rawScore: 5 },
      { label: 'One active matter (malpractice, dispute, or regulatory inquiry)', rawScore: -1 },
      { label: 'Multiple active matters', rawScore: -2 },
    ],
    cpaRewrite: false,
  },
  {
    id: 'q_spof_count',
    step: 2,
    cell: 'H39',
    weight_G: 1,
    prompt:
      'How many single points of failure can you identify in the firm? (Count each: key staff with no backup, one client over 20% of revenue, a key vendor with no alternative, a proprietary process only you know)',
    helperText:
      'Single points of failure are the primary driver of post-close earnout clawbacks in CPA firm deals. Buyers identify them in diligence and either price them out or hold back proceeds until they are resolved.',
    scoringMode: 'weighted_raw_times_G',
    options: [
      { label: '0 (no identifiable SPOFs)', rawScore: 0 },
      { label: '1', rawScore: -2 },
      { label: '2', rawScore: -3 },
      { label: '3', rawScore: -4 },
      { label: '4 or more', rawScore: -5 },
    ],
    cpaRewrite: false,
  },
];

// ---------------------------------------------------------------------------
// Sanity-check exports (consumed by the test suite)
// ---------------------------------------------------------------------------

/** Sum of max points for all Step 1 scoring questions (K12:K18 in source sheet). */
export const STEP1_MAX = 60;

/** Sum of max points for all Step 2 scoring questions (K24:K38 in source sheet). */
export const STEP2_MAX = 150;

/**
 * Combined max = STEP1_MAX + STEP2_MAX = K39 in source sheet.
 * This is the denominator in the J4 sellability formula (plus the +2 quirk):
 *   J4 = MIN(1, (step2Total + sizeScore + step1Total) / (COMBINED_MAX + 2))
 * Do NOT change this value — doing so changes every sellability score.
 */
export const COMBINED_MAX = 210;
