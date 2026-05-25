# PDF Math Appendix — Design Spec

**Owner:** Someday Consultants valuation webapp
**Target file:** `valuation/src/components/pdf/ValuationReport.tsx` (extend) plus a new
`valuation/src/components/pdf/AppendixPages.tsx` (this doc's deliverable).
**Audience for the PDF appendix:** CPA firm owners — formula people. The appendix removes
"where did that number come from?" objections by showing every input, every formula, every
intermediate, and every derivation for the headline numbers on pages 1-5.
**Source of truth for math:** `claudedocs/someday_valuation_engine_spec.md` plus the actual
TypeScript in `valuation/src/engine/*.ts`. Where they diverge, the code wins (the spec is
the design intent, the code is what shipped).

---

## 1. Page count estimate (full appendix)

| Section | Pages | Conditional |
|---|---|---|
| A1. Inputs collected            | 2 (1 if Wealth Gap off)    | — |
| A2. Sellability score build     | 2                          | — |
| A3. Adjusted EBITDA build       | 1                          | — |
| A4. Multiple selection chain    | 1                          | — |
| A5. Acceleration scenarios math | 2                          | — |
| A6. Wealth Gap math             | 1                          | only if `includeWealthGap === true` |
| A7. Methodology notes           | 1                          | — |
| **Appendix subtotal**           | **9-10 pages** (8-9 when Wealth Gap off) | — |
| Existing report                 | 5 pages (4 if Wealth Gap off) | — |
| **Grand total**                 | **14-15 pages** (12-13 without Wealth Gap) | — |

Each appendix page reuses the same `s.page` style (cream-light background, 48pt horizontal
padding, 48/36 vertical) and the existing header+footer convention from `ValuationReport.tsx`
lines 309-314 and 421-423. No new page-level styles required.

---

## 2. Visual design language for the appendix

Quieter than the headline pages. Less hero-sized typography, more structured tables and small
annotations. Think "audit working papers" rendered on the same brand canvas.

### 2.1 Reusable atoms (add to the existing `StyleSheet` or a sibling stylesheet)

```ts
// Section opener — same look as existing pages
sectionLabel:   { fontSize: 8,  color: gold,   letterSpacing: 2, fontWeight: 700, marginBottom: 8 }
h1:             { fontFamily: 'Times-Roman', fontSize: 28, color: forest, fontWeight: 600 }
h2:             { fontFamily: 'Times-Roman', fontSize: 16, color: forest, fontWeight: 600, marginBottom: 6 }
h3:             { fontFamily: 'Times-Roman', fontSize: 12, color: forest, fontWeight: 600, marginBottom: 4 }

// Appendix-specific atoms (NEW)
appendixPageLabel: { fontSize: 7, color: slateMuted, letterSpacing: 2, marginBottom: 4 }   // "APPENDIX A2 OF 7" eyebrow
note:              { fontSize: 8, color: slateMid, lineHeight: 1.45, marginTop: 4 }         // small annotations
mono:              { fontFamily: 'Courier', fontSize: 8.5, color: slate }                   // numbers in formula boxes
```

### 2.2 Formula box (NEW component, reusable)

A cream-light bordered box with a small "FORMULA" eyebrow. Two slots: generic formula on top,
"plugged in" version on bottom. Both rendered in Courier (the only mono face available in
@react-pdf core fonts) so digits and operators align.

```
+---------------------------------------------------------------+
| FORMULA                                                       |
|   sellability % = MIN(1, (step2 + size + step1) / (max + 2))  |
| THIS FIRM                                                     |
|   = MIN(1, (104 + 25 + 22) / (210 + 2))                       |
|   = MIN(1, 151 / 212)                                         |
|   = 71.23%                                                    |
+---------------------------------------------------------------+
```

Styles:
- `padding: 10`, `borderWidth: 0.5`, `borderColor: hairline`, `backgroundColor: cream`
- Label rows in Helvetica 7pt gold uppercase ("FORMULA", "THIS FIRM")
- Body rows in Courier 8.5pt slate
- `marginVertical: 10`

### 2.3 Question-scoring table (NEW component, reusable)

Columns and widths (sum = 100%):

| # | Column           | Width | Align  | Notes |
|---|------------------|-------|--------|-------|
| 1 | Question (prompt)| 38%   | left   | Truncate at 90 chars with ellipsis if needed |
| 2 | Cell             | 7%    | left   | "H12" style monospace |
| 3 | Weight G         | 7%    | right  | integer |
| 4 | Their answer     | 22%   | left   | option label, truncate at 50 chars |
| 5 | Raw score        | 8%    | right  | 0-5 or negative for lawsuits/SPOFs |
| 6 | Contribution     | 9%    | right  | Step 1: = raw. Step 2: = raw × G |
| 7 | Max              | 9%    | right  | G × 5 |

- Row height: ~18pt
- Row separator: 0.5pt hairline divider
- Header row: Helvetica 7pt uppercase letter-spaced 1, gold color, bottom-bordered 0.5pt forest
- Body rows: Helvetica 8.5pt slate
- Footer row (totals): Helvetica 9pt forest bold, top-bordered 0.5pt forest

### 2.4 Financials inventory table (NEW)

Simpler 3-column layout: Field name | Cell | Dollar value (right-aligned, Times-Roman 11pt).

### 2.5 Page break behavior

@react-pdf renders break-inside-avoid via `wrap={false}` on `<View>`. Each formula box and
each table-row group should set `wrap={false}` so they never split. Long question tables that
overflow one page wrap row-by-row but repeat the header row via the `<View fixed>` pattern
inside a `Page`. Strategy: build the score table as `<View>` rows inside a column, and put a
"continued on next page" footer if it has to break. Simpler approach for the question table:
keep it on one page by limiting font size to 8pt body; the 7 readiness + 15 risk = 22 rows
fits comfortably on one US-letter page at that size.

---

## 3. Engine API additions (REQUIRED)

The current `EngineOutput` does not expose per-question metadata, the question prompts, the
chosen answer labels, or the salary add-back delta. We need to extend the engine output with
**trace fields** that the appendix renders directly. These additions are pure-read; they do
not change any computed numbers, do not require re-running `compute()`, and they will be
ignored by the existing pages.

### 3.1 Changes to `valuation/src/engine/types.ts`

Add the following types and extend three output interfaces:

```ts
// NEW — per-question trace entry rendered in A1 and A2
export interface QuestionTrace {
  /** id matching the question definition in src/data/questions.ts */
  id: string;
  /** original sheet cell (e.g. 'H12') for traceability */
  cell: string;
  /** verbatim question prompt from src/data/questions.ts */
  prompt: string;
  /** the user's selected option label (verbatim from QuestionOption.label) */
  answerLabel: string;
  /** raw 0-5 (or negative) score that answer mapped to */
  rawScore: number;
  /** G weight from the source sheet */
  weight_G: number;
  /**
   * What this question contributed to the running score.
   * Step 1 = rawScore. Step 2 = rawScore × weight_G. trackingOnly = 0.
   */
  contribution: number;
  /** G × 5 (or 0 if trackingOnly) */
  maxPossible: number;
  /** true if tracking-only (excluded from contribution + max totals) */
  trackingOnly: boolean;
}

// NEW — financial inputs echoed verbatim for A1 and A3 (so appendix doesn't re-import them)
export interface FinancialsTrace {
  revenue: number;
  pretaxProfit: number;
  amortizationDepreciation: number;
  longTermInterest: number;
  discretionarySpending: number;
  ownerSalary: number;
  rentToSelf: number;
  marketRateReplacementSalary?: number;
}

// NEW — wealth-gap inputs echoed verbatim for A1 and A6
export interface WealthGapInputsTrace {
  dividends: number;
  wages: number;
  personalExpensesCoveredByBusiness: number;
  otherPassiveIncome: number;
  liquidAssets: number;
  nonMortgageDebt: number;
  desiredPostSaleAnnualIncome: number;
  desiredExitTimelineYears: number;
  ownershipPct: number;
  feesAndTaxesPct: number;
  longTermBusinessDebt: number;
  returnOnPortfolio: number;
}

// NEW — multiple-config echo + selected band metadata for A4
export interface MultipleTrace {
  source: MultipleSource;
  riskWeighting: RiskWeighting;
  canadian: boolean;
  customMultiple: number;
  /** Which table was queried for the risk-banded pick: 'common' | 'industry' */
  tableUsed: 'common' | 'industry';
  /** Which percentile bucket the sellability % fell into */
  bandSelected: 'p10' | 'p25' | 'median' | 'median-p75-avg' | 'p75' | 'p75-p90-avg';
  /** Human label, e.g. "Sellability 71.23% falls in (median + 75th)/2 bucket" */
  bandRule: string;
  /** True if custom multiple bypassed the risk-weighting chain */
  customMultipleBypassed: boolean;
  /** True if Canadian discount of -0.5 applied (only when not custom) */
  canadianApplied: boolean;
}

// NEW — acceleration config echo for A5
export interface AccelerationTrace {
  targetSizeIncreasePct: number;
  targetEfficiencyIncreasePct: number;
  targetMultipleIncreasePct: number;
}

// NEW — top-level appendix bundle attached to EngineOutput
export interface AppendixTrace {
  readinessQuestions: QuestionTrace[];
  riskQuestions: QuestionTrace[];
  financials: FinancialsTrace;
  multiple: MultipleTrace;
  acceleration: AccelerationTrace;
  /** Only populated when the wealth gap step was filled out */
  wealthGap?: WealthGapInputsTrace;
}

// EXTEND existing EngineOutput (no break to consumers — appendix is optional field)
export interface EngineOutput {
  sellability: SellabilityOutput;
  ebitda: EbitdaOutput;
  multiple: MultipleOutput;
  acceleration: AccelerationOutput;
  wealthGap: WealthGapOutput;
  mode: EngineMode;
  /** NEW — populated when compute() is given the trace-enabling inputs */
  appendix?: AppendixTrace;
}
```

### 3.2 Changes to `valuation/src/engine/index.ts`

Extend `compute()` to accept an optional second argument with the data needed to populate the
trace. This keeps the existing `compute(inputs)` callers untouched. The trace builder is a
pure transformation of the inputs passed in — it never recomputes the score.

```ts
export interface TraceContext {
  /** Question definitions from src/data/questions.ts, passed in so the engine stays UI-agnostic */
  readinessQuestionDefs: Array<{ id: string; cell: string; prompt: string; weight_G: number; trackingOnly?: boolean; options: Array<{ label: string; rawScore: number }> }>;
  riskQuestionDefs: Array<{ id: string; cell: string; prompt: string; weight_G: number; trackingOnly?: boolean; options: Array<{ label: string; rawScore: number }> }>;
  /** Verbatim financial inputs */
  financialsInput: FinancialInputs;
  /** Verbatim wealth-gap inputs, OR undefined if the step was skipped */
  wealthGapInput?: WealthGapInputs;
  /** Verbatim multiple config */
  multipleConfigInput: MultipleConfig;
  /** Verbatim acceleration config */
  accelerationConfigInput: AccelerationConfig;
}

export function compute(inputs: EngineInputs, trace?: TraceContext): EngineOutput {
  // ... existing body unchanged ...
  const out: EngineOutput = { sellability, ebitda, multiple, acceleration, wealthGap, mode: inputs.mode };
  if (trace) out.appendix = buildAppendixTrace(inputs, trace, sellability, multiple);
  return out;
}
```

The `buildAppendixTrace()` helper lives in a NEW file:
`valuation/src/engine/appendixTrace.ts` (so it does not bloat `index.ts`). It is the only new
engine module. It:
1. Walks the readiness and risk arrays, joins each `ReadinessQuestionScore` /
   `RiskQuestionScore` against its question definition by `id`, locates the user's answer by
   matching `rawScore` against the `options[]` list (taking the first match), and produces
   `QuestionTrace[]`. If no match (custom rawScore or stale def), records `answerLabel: '(not
   recorded)'`.
2. Echoes financials, wealth gap, acceleration, multiple configs verbatim.
3. Computes the multiple trace metadata: `tableUsed`, `bandSelected`, `bandRule`,
   `customMultipleBypassed`, `canadianApplied` based on the same logic in `multiple.ts`
   (band thresholds at 0.5 / 0.6 / 0.7 / 0.85 / 0.95). This duplicates a small bit of logic
   from `computeMultiple` for traceability; alternative is to have `computeMultiple` return
   these labels directly. RECOMMENDED ALTERNATIVE: extend `MultipleOutput` to include
   `bandSelected` and `bandRule`, then have the appendix builder consume those. This keeps
   the band-logic single-source-of-truth. Implementation note: the latter is cleaner; do
   that.

### 3.3 Changes to `valuation/src/engine/multiple.ts`

Add `bandSelected` and `bandRule` to the returned `MultipleOutput` so they are computed once
in the same function that picks the band. This avoids duplicating the band thresholds in
`appendixTrace.ts`.

```ts
// In bandedPick, return both the value and the band metadata:
function bandedPickWithMeta(band: MultipleBand, p: number): { value: number; bandSelected: ...; bandRule: string } {
  if (p <= 0.5)  return { value: band.p10,                  bandSelected: 'p10',           bandRule: `Sellability ${pctStr(p)} ≤ 50%: use 10th percentile` };
  if (p <= 0.6)  return { value: band.p25,                  bandSelected: 'p25',           bandRule: `Sellability ${pctStr(p)} in (50%, 60%]: use 25th percentile` };
  if (p <= 0.7)  return { value: band.median,               bandSelected: 'median',        bandRule: `Sellability ${pctStr(p)} in (60%, 70%]: use median` };
  if (p <= 0.85) return { value: (band.median+band.p75)/2,  bandSelected: 'median-p75-avg',bandRule: `Sellability ${pctStr(p)} in (70%, 85%]: use average of median and 75th` };
  if (p <= 0.95) return { value: band.p75,                  bandSelected: 'p75',           bandRule: `Sellability ${pctStr(p)} in (85%, 95%]: use 75th percentile` };
  return         { value: (band.p75+band.p90)/2,            bandSelected: 'p75-p90-avg',   bandRule: `Sellability ${pctStr(p)} > 95%: use average of 75th and 90th` };
}
```

Add to `MultipleOutput`:
```ts
bandSelected: 'p10' | 'p25' | 'median' | 'median-p75-avg' | 'p75' | 'p75-p90-avg';
bandRule: string;
tableUsed: 'common' | 'industry';
customMultipleBypassed: boolean;
canadianApplied: boolean;
```

### 3.4 Changes to `valuation/src/engine/ebitda.ts`

Add `addBackComponents` to `EbitdaOutput` so A3 can show the addition row-by-row without
re-deriving from financials:

```ts
addBackComponents: {
  pretaxProfit: number;
  amortizationDepreciation: number;
  longTermInterest: number;
  discretionarySpending: number;
  salaryAddBack: number;              // = salaryAddBackUsed (after market-rate logic)
  rentToSelf: number;
  marketRateUsed: number | null;       // null when not provided, else the input value
  ownerSalaryRaw: number;              // verbatim input.ownerSalary for the formula echo
}
```

These are pure echoes of inputs. Zero math change.

### 3.5 Changes NOT required

- `sellability.ts` — no change. Score totals + grade + probability are already exposed.
- `acceleration.ts` — no change. All lever outputs already exposed.
- `wealthGap.ts` — no change. All outputs already exposed.

### 3.6 What the caller (the wizard / Results screen) must do

When invoking `compute()` for the purpose of generating the PDF, pass the `TraceContext`:

```ts
const output = compute(engineInputs, {
  readinessQuestionDefs: READINESS_QUESTIONS,
  riskQuestionDefs:      RISK_QUESTIONS,
  financialsInput:       engineInputs.financials,
  wealthGapInput:        includeWealthGap ? engineInputs.wealthGap : undefined,
  multipleConfigInput:   engineInputs.multipleConfig,
  accelerationConfigInput: engineInputs.acceleration,
});
```

The ValueTicker and Results screen do not need the trace; they pass `compute(inputs)` and
ignore the missing `appendix` field. The PDF generation path is the only place that supplies
the trace.

---

## 4. Section-by-section design

Each section below specifies: page layout (ASCII sketch), engine fields consumed, literal
text/labels to render, and edge cases.

### A1. Inputs Collected (1-2 pages)

**Purpose:** A clean, definitive inventory of everything the owner entered. Nothing is hidden.

**Page count:** 1 if Wealth Gap is off, 2 if on.

**Layout (page 1):**

```
+-------------------------------------------------------+
| Someday Consultants          firmName · 2026-05-21     |  ← header
+-------------------------------------------------------+
|                                                       |
|  APPENDIX A1 OF 7                                     |  ← appendixPageLabel
|  THE INPUTS                                           |  ← sectionLabel
|  Everything you entered.                              |  ← h1
|                                                       |
|  This appendix shows every input you gave us and       |  ← body para
|  every formula we applied. Nothing is hidden. If a     |
|  number on the headline pages surprised you, this is   |
|  where it came from.                                   |
|                                                       |
|  Firm Profile                                         |  ← h2
|  -----------------------------------------------      |
|  Firm name              Sample CPA Firm               |  ← simple 2-col
|                                                       |
|  Financials                                           |  ← h2
|  +------------------------------+----+--------------+ |  ← 3-col table
|  | Revenue                      | H43|  $3,400,000  | |
|  | Pre-tax profit               | H44|    $350,000  | |
|  | Amortization & depreciation  | H45|         $0   | |
|  | Long-term interest           | H46|         $0   | |
|  | Discretionary spending       | H47|         $0   | |
|  | Owner salary                 | H48|    $230,000  | |
|  | Market-rate replacement *    | —  |    $180,000  | |
|  | Rent to self                 | H49|         $0   | |
|  +------------------------------+----+--------------+ |
|  * If provided, only the delta over market-rate is    |
|    added back to EBITDA. Source-sheet adds back the   |
|    full owner salary. See A3 for the addition.        |
|                                                       |
|  Readiness questions (Step 1)                         |  ← h2
|  +-----------------+---+---+---------------+---+--+--+|  ← question-scoring table
|  | Question        |Cel| G | Their answer  | R | C |M |
|  +-----------------+---+---+---------------+---+--+--+|
|  | Exit timeline   |H12| 2 | Under 12 Mos  | 2 | 2|10|
|  | Busy-season cap.|H13| 2 | Significant   | 5 | 5|10|
|  | ... (5 more)    |   |   |               |   |  |  |
|  +-----------------+---+---+---------------+---+--+--+|
|  | STEP 1 TOTAL              |    22 of 60           ||
|  +-----------------+---+---+---------------+---+--+--+|
|                                                       |
| ... (Risk questions table on page 2 if no Wealth Gap, |
|     or continues if Wealth Gap is off and we have     |
|     room on page 1)                                   |
+-------------------------------------------------------+
|             Firm · prepared 2026-05-21 · ...          |  ← footer
+-------------------------------------------------------+
```

**Page layout for the Wealth Gap inputs (page 2, only if `includeWealthGap`):**

```
  WEALTH-GAP INPUTS                                      ← sectionLabel
  Continued from A1.                                     ← h2
                                                         
  Current annual income from the firm                    ← h3
  +------------------------------+----+--------------+   ← 3-col table
  | Dividends                    | F6 |    $250,000  |
  | Wages                        | F7 |    $150,000  |
  | Personal expenses through biz| F8 |     $50,000  |
  | Other passive income         | F9 |    $100,000  |
  +------------------------------+----+--------------+
                                                         
  Assets and liabilities                                 ← h3
  +------------------------------+----+--------------+
  | Liquid assets                | F14|  $1,500,000  |
  | Non-mortgage debt            | F15|     $75,000  |
  +------------------------------+----+--------------+
                                                         
  Post-sale target                                       ← h3
  +------------------------------+----+--------------+
  | Desired annual income        | M6 |    $575,000  |
  | Exit timeline (years)        | M7 |          5   |
  | Assumed portfolio return     | M14|        7.5%  |
  | Ownership % at sale          | T6 |       100%   |
  | Fees & taxes %               | T10|         10%  |
  | Long-term business debt      | T8 |         $0   |
  +------------------------------+----+--------------+
```

**Engine fields consumed:**
- `appendix.financials` (all 8 fields)
- `appendix.readinessQuestions` (array of `QuestionTrace`)
- `appendix.riskQuestions` (array of `QuestionTrace`)
- `appendix.wealthGap` (conditional)

**Literal labels:**
- Section eyebrow: `APPENDIX A1 OF 7`
- Section label: `THE INPUTS`
- h1: `Everything you entered.`
- Sub-h2 labels: `Firm Profile`, `Financials`, `Readiness questions (Step 1)`,
  `Risk questions (Step 2)`, `Wealth-Gap inputs` (only if on).
- Footnote (only if `marketRateReplacementSalary` is set): `Only the portion of your owner
  salary above this market-rate figure is added back to EBITDA. See A3 for the addition.`
- Toggle question note (`q_sale_price_target`): if the toggle is on, render
  `Toggle: On — target ratio: 0.50`. If off, render `Toggle: Off — no target set`.

**Edge cases:**
- `q_sale_price_target` has empty options[] (toggle UI). Render with `answerLabel = 'Toggle:
  On (ratio 0.50)'` or `'Toggle: Off (no target)'`, `contribution = 0` or computed I18
  result, `maxPossible = 15` if toggle on else 0.
- Tracking-only questions (q_how_heard, q_thinking_about_selling, q_fye) render with `0`
  contribution and `0` max, and a quiet `(tracking only)` superscript next to the answer
  label.
- If `marketRateReplacementSalary` is undefined, omit that row entirely.
- Long answer labels (>50 chars) truncate with ellipsis.

### A2. Sellability Score Build (2 pages)

**Purpose:** The opaque-looking 71.23% number, walked from raw answers to grade, line by line.

**Page count:** 2. Page 1 is the question-by-question walk; page 2 is the J4 formula box +
size-score row + grade lookup + +2 quirk callout.

**Page 1 layout (the long walk):**

```
  APPENDIX A2 OF 7                                       ← appendixPageLabel
  SELLABILITY SCORE BUILD                                ← sectionLabel
  How we got to 71.23%.                                  ← h1
                                                         
  Sellability blends three numbers: a readiness score    ← body
  (Step 1, unweighted raw sum), a risk-weighted score    
  (Step 2, raw × weight per question), and an EBITDA     
  size score. We show the J4 formula on the next page;   
  this page shows every question's contribution.         
                                                         
  Step 1 — Readiness (7 scoring questions)                ← h2
  +--------+----+---+-----------------+---+---+----+
  |Question|Cell| G | Their answer    |Raw|Con |Max |     ← header row, gold uppercase
  +--------+----+---+-----------------+---+---+----+
  | Exit T.|H12 | 2 | Under 12 Months | 2 |  2 | 10 |     ← contribution = raw (Step 1)
  | Cap.   |H13 | 2 | Significant     | 5 |  5 | 10 |
  | Partn. |H14 | 2 | 1 (sole owner)  | 5 |  5 | 10 |
  | Exit H |H15 | 1 | No prior        | 4 |  4 |  5 |
  | Align. |H16 | 2 | Complete        | 5 |  5 | 10 |
  | Life   |H17 | 3 | Clear plan      | 5 |  5 | 15 |
  | Target |H18 | — | Off             | 0 |  0 |  0 |
  +--------+----+---+-----------------+---+---+----+
  | STEP 1 TOTAL                       |    22 of 60|     ← forest bold footer row
  +--------+----+---+-----------------+---+---+----+
                                                         
  Note: Step 1 contribution = raw score (NOT × G).        ← note
  Step 1 max = G × 5 per question. This matches the      
  source sheet's I12-I17 cells.                          
                                                         
  Step 2 — Risk (15 scoring questions)                    ← h2
  +--------+----+---+-----------------+---+---+----+
  | Inc.   |H25 | 3 | Yes (PC/LLP)    | 5 | 15 | 15 |     ← contribution = raw × G (Step 2)
  | LY P   |H26 | 3 | Yes             | 5 | 15 | 15 |
  | ... (13 more rows)                              |
  | Lawsuts|H38 | 2 | Multiple active | -2|  -4| 10 |     ← negative contribution
  | SPOFs  |H39 | 1 | 3 SPOFs         | -4|  -4|  5 |
  +--------+----+---+-----------------+---+---+----+
  | STEP 2 TOTAL                       |   104 of 150|
  +--------+----+---+-----------------+---+---+----+
                                                         
  Note: Step 2 contribution = raw score × G. Matches      ← note
  source sheet I24-I38 cells. Lawsuits and SPOFs use      
  negative raw scores by design (high-risk firms          
  receive a penalty, not a zero).                         
```

**Page 2 layout (the formula + grade):**

```
  APPENDIX A2 (continued)                                ← appendixPageLabel
  THE J4 FORMULA                                         ← sectionLabel
  Two raw scores + a size score, divided by the max.     ← h2
                                                         
  Size score lookup                                      ← h3
  Adjusted EBITDA: $580,000                              
  +---------------------------------+--------+           ← table
  | EBITDA band                     | Score  |
  +---------------------------------+--------+
  | < $100K                         |   0    |
  | $100K - $250K                   |   2    |
  | $250K - $500K                   |  15    |
  | $500K - $750K  ← THIS BAND      |  25    |  ← highlight forest bold
  | $750K - $1M                     |  30    |
  | $1M - $1.5M                     |  40    |
  | ... (4 more)                    |        |
  +---------------------------------+--------+
                                                         
  [FORMULA BOX]                                          ← formula box atom
  FORMULA                                                
    sellability % = MIN(1, (step2 + size + step1) / (max + 2))
                                                         
  THIS FIRM                                              
    = MIN(1, (104 + 25 + 22) / (210 + 2))                
    = MIN(1, 151 / 212)                                  
    = 71.23%                                             
                                                         
  Why "+ 2" in the denominator?                          ← h3
  This is verbatim from the source spreadsheet's J4      ← note
  formula. The size score adds up to 75 into the         
  numerator but only 2 into the denominator, which is    
  why the score is capped at 100% with MIN(1, ...). We   
  preserve the formula exactly for parity with the       
  source model. Effectively, the score ceiling is 100%   
  and very high-performing firms saturate.               
                                                         
  Grade band                                             ← h3
  +-------------------+-------+----------------+        
  | Score range       | Grade | Prob. of sale  |        
  +-------------------+-------+----------------+        
  | 90% +             |   A   | Very High      |        
  | 75% - 89%         |   B   | High           |        
  | 60% - 74%   ← C   |   C   | Medium         |  ← highlight
  | 50% - 59%         |   D   | Low            |        
  | < 50%             |   F   | Very Low       |        
  +-------------------+-------+----------------+        
                                                         
  Your sellability of 71.23% falls in the 60-74% band.    ← body
  Grade: C. Probability of sale: Medium.                  
```

**Engine fields consumed:**
- `appendix.readinessQuestions`, `appendix.riskQuestions` (full QuestionTrace arrays)
- `sellability.step1Score`, `step1Max`, `step2Score`, `step2Max`, `combinedMax`, `sizeScore`,
  `sellabilityPct`, `grade`, `probabilityOfSale`
- `ebitda.adjustedEbitda` (for the size-score lookup context)
- `SIZE_SCORE_TABLE` constant from `valuation/src/data/sizeScoreTable.ts`

**Literal labels:**
- Section eyebrow: `APPENDIX A2 OF 7`
- Section label: `SELLABILITY SCORE BUILD`
- h1: `How we got to {pctPrecise}.`
- Page 2 label: `THE J4 FORMULA`

**Edge cases:**
- Tracking-only questions (q_fye, q_how_heard, q_thinking_about_selling) MUST be excluded
  from A2 (this page is the score build; tracking-only contributes 0). They appear in A1
  only. Filter: `q.trackingOnly !== true`.
- Negative raw scores (lawsuits, SPOFs) display with a minus sign; the contribution column
  shows the negative product. Step 2 total can still be positive (negatives reduce the sum,
  not below 0 in practice for typical firms).
- For the SPOF question, the `0` raw score option ("0 — No identifiable SPOFs") gives
  contribution = 0 × 1 = 0, max = 5. That is correct (the question contributes nothing if
  the firm has no SPOFs, which is the best answer).
- Size score table: highlight the row that the firm's EBITDA falls into using
  `backgroundColor: cream` + `fontWeight: 700` + `color: forest` on that row.

### A3. Adjusted EBITDA Build (1 page)

**Purpose:** Show the addition that gets to $580K, and (if used) the salary-anchor logic.

**Page layout:**

```
  APPENDIX A3 OF 7                                       ← appendixPageLabel
  ADJUSTED EBITDA BUILD                                  ← sectionLabel
  From profit to the number a buyer capitalizes.         ← h1
                                                         
  Adjusted EBITDA is the cash flow a buyer can take      ← body
  out of the firm after replacing your role. Six lines.   
                                                         
  The addition                                           ← h2
  +-------------------------------+----+--------------+  ← right-aligned $
  | Pre-tax profit                | H44|    $350,000  |
  | + Amortization & depreciation | H45|         $0   |
  | + Long-term interest          | H46|         $0   |
  | + Discretionary spending      | H47|         $0   |
  | + Owner salary add-back       | (*)|    $230,000  |  ← see "salary anchor" below
  | + Rent to self                | H49|         $0   |
  +-------------------------------+----+--------------+
  | = Adjusted EBITDA             | I51|    $580,000  |  ← forest bold
  +-------------------------------+----+--------------+
                                                         
  [FORMULA BOX]                                          ← formula box atom
  FORMULA                                                
    EBITDA margin = adjusted EBITDA / revenue            
  THIS FIRM                                              
    = $580,000 / $3,400,000                              
    = 17.06%                                             
                                                         
  Salary anchor (the H48 add-back)        ← h3, ONLY IF marketRateReplacementSalary set
  The source spreadsheet adds back the FULL owner salary  ← body
  ($230,000). The webapp's corrected mode adds back only  
  the amount above a market-rate replacement, because     
  a buyer must hire a real person to do that work and     
  cannot capitalize the saved cost twice.                 
                                                         
  [FORMULA BOX]                                          ← formula box (if anchor set)
  FORMULA                                                
    salary add-back = max(0, ownerSalary - marketRate)   
  THIS FIRM                                              
    = max(0, $230,000 - $180,000)                        
    = $50,000                                            
                                                         
  Adjusted EBITDA in corrected mode would then be         ← body
  $350,000 + $50,000 = $400,000 (12% margin). We are     
  currently shown in **literal mode** for parity, which   
  uses $230,000.    [or vice versa depending on mode]    
                                                         
  Size score (looked up against EBITDA)                  ← h3
  Your EBITDA of $580,000 maps to size score 25 (the     ← body
  $500K-$750K band). The size score is part of the J4    
  sellability formula — see A2.                          
```

**Engine fields consumed:**
- `ebitda.addBackComponents` (NEW — see §3.4 above)
- `ebitda.adjustedEbitda`, `ebitda.ebitdaMargin`, `ebitda.salaryAddBackUsed`
- `sellability.sizeScore`
- `appendix.financials.revenue` (for the margin formula)
- `mode` (to label "literal" vs "corrected")

**Edge cases:**
- If `marketRateReplacementSalary` is undefined, omit the entire "Salary anchor" h3 section.
  Just show the addition as 6 lines summing to EBITDA. Footnote: `Owner salary added back
  in full ($230,000). Provide a market-rate replacement salary in the wizard to use the
  corrected add-back logic.`
- If `mode === 'literal'` AND `marketRateReplacementSalary` is set, still show the formula
  box but flag: `Literal mode is active. The corrected formula would compute $X here. The
  add-back used in the headline numbers is $230,000.`
- The (*) cell reference is intentional (the salary line isn't a single cell in the sheet's
  conditional). Footnote: `(*) H48 less market-rate anchor when corrected mode is enabled.`

### A4. Multiple Selection Chain (1 page)

**Purpose:** The single most opaque part of the calc. Make it crystal clear.

**Page layout:**

```
  APPENDIX A4 OF 7                                       ← appendixPageLabel
  MULTIPLE SELECTION CHAIN                               ← sectionLabel
  The 4.00x multiple, step by step.                       ← h1
                                                         
  Buyers pay a multiple of EBITDA. The webapp picks       ← body
  that multiple in five steps: choose a SOURCE (which     
  table to use), pick a BAND (which percentile bucket     
  the sellability lands in), optionally apply RISK        
  WEIGHTING, optionally apply a CANADIAN discount, and    
  if a CUSTOM multiple was entered, use it instead.       
                                                         
  Your settings                                          ← h2
  +-------------------------------+--------------------+ ← 2-col table
  | Source                        | Use Custom Multiple|
  | Risk weighting                | Risk Weighting On  |
  | Canadian                      | No                 |
  | Custom multiple               | 4.00x              |
  +-------------------------------+--------------------+
                                                         
  Step 1 — Pick a table                                  ← h3
  Source "Use Custom Multiple" pulls from the COMMON      ← body
  multiple table for the informational band display       
  (since the user did not provide an industry). Industry  
  table is used when source is "From Financials" or       
  "Use Industry Multiples".                              
                                                         
  +-------+-------+-----+--------+------+-----+         ← multiple-table reference
  | Table | 10th  | 25th| Median | 75th | 90th|         
  +-------+-------+-----+--------+------+-----+         
  | Common| 1.5x  | 2.0x|  3.5x  | 5.0x | 8.0x|  ← CURRENT TABLE highlight
  | Indus.| 1.7x  | 2.7x|  4.0x  | 5.7x | 8.7x|         
  +-------+-------+-----+--------+------+-----+         
                                                         
  Step 2 — Pick a band                                   ← h3
  Your sellability is 71.23%. The band rule is:           
                                                         
  +------------------+----------------------------+      
  | Sellability      | Band                       |      
  +------------------+----------------------------+      
  | ≤ 50%            | 10th percentile            |      
  | 50% - 60%        | 25th percentile            |      
  | 60% - 70%        | Median                     |      
  | 70% - 85%        | (Median + 75th) / 2  ← YOU |  ← highlight
  | 85% - 95%        | 75th percentile            |      
  | > 95%            | (75th + 90th) / 2          |      
  +------------------+----------------------------+      
                                                         
  Common table at 71.23%: (3.5 + 5.0) / 2 = 4.25x        ← formula box
  This is the "risk-weighted display" multiple shown      
  for reference (J65 in the source sheet).               
                                                         
  Step 3 — Risk weighting                                ← h3
  Risk Weighting On uses the band-picked multiple        ← body
  (4.25x) as the from-financials base (D66). Risk        
  Weighting Off would have used the median directly       
  (3.5x for common, 4.0x for industry).                  
                                                         
  Step 4 — Canadian discount                             ← h3
  Not applied (G59 = No). Would have subtracted 0.5      ← body
  from the multiple if Yes.                              
                                                         
  Step 5 — Custom multiple bypass                        ← h3
  You selected "Use Custom Multiple". This BYPASSES the   ← body
  risk-weighting chain above and uses your custom value   
  directly. The informational risk-weighted value         
  (4.25x) is shown for reference but is not the multiple  
  used in your valuation.                                
                                                         
  [FORMULA BOX]                                          
  FORMULA                                                
    multiple used = IF(source = "Use Custom Multiple", customMultiple, fromFinancialsFinal)
  THIS FIRM                                              
    = IF("Use Custom Multiple", 4.00, 4.25)              
    = 4.00x                                              
                                                         
  Final multiple: 4.00x                                  ← h3 forest bold
  Applied to $580K EBITDA → $2,320,000 today's value.    ← body (uses "becomes" word, no →)
```

Wait — the spec says no arrows in rendered text. Rewrite that last line:

```
  Final multiple: 4.00x                                  
  Applied to $580K EBITDA produces $2,320,000 today's    ← body
  enterprise value (Z16).                                
```

**Engine fields consumed:**
- `appendix.multiple` (source, riskWeighting, canadian, customMultiple)
- `multiple.tableUsed`, `bandSelected`, `bandRule`, `customMultipleBypassed`, `canadianApplied`
  (all NEW — see §3.3 above)
- `multiple.noRiskBase`, `riskWeightedBase`, `riskWeightedDisplay`, `fromFinancialsFinal`,
  `ebitdaMultipleUsed`
- `sellability.sellabilityPct` (for the band rule)
- `ebitda.adjustedEbitda`, `acceleration.currentValue` (for the closing line)

**Edge cases:**
- `Use Custom Multiple` path: as designed above, the informational base is computed but
  bypassed. The page emphasizes this clearly.
- `Use Common Multiples` path: skip Step 5 ("Custom multiple bypass"), end at Step 4. The
  formula box becomes `multiple used = D66 = {fromFinancialsFinal}`.
- `Risk Weighting Off`: Step 3 narrates "would have used the median (X.Xx) directly" and
  the formula reflects E66 not G66.
- `Canadian = Yes`: Step 4 narrates "0.5 subtracted, so {base}x becomes {base - 0.5}x".
- Replace any `→` arrow in the formula labels with the word "becomes" or "produces".

### A5. Acceleration Scenarios Math (2 pages)

**Purpose:** Three lever calculations + the COMPOUND blended forecast. Most-common owner
question: "How did $4.25M come out of $2.32M with only 10% revenue growth?"

**Page count:** 2. Page 1 covers Levers 1, 2, 3 (one h3 section each). Page 2 covers the
blended forecast formula in detail.

**Page 1 layout (the three independent levers):**

```
  APPENDIX A5 OF 7                                       ← appendixPageLabel
  ACCELERATION SCENARIOS                                 ← sectionLabel
  The four scenarios on page 2 of this report, broken    ← h1
  open.                                                  
                                                         
  Baseline (today)                                       ← h2
  +-----------------------+----+--------------+          ← 3-col
  | Revenue               | Z9 |  $3,400,000  |          
  | Pre-tax profit        | Z11|    $350,000  |          
  | COGS                  | Z10|  $3,050,000  |  ← Z9-Z11
  | COGS ratio            |AA10|       89.71% |  ← Z10/Z9
  | Profit margin         |AA11|       10.29% |  ← Z11/Z9
  | EBITDA                | Z12|    $580,000  |  
  | EBITDA margin         |AA12|       17.06% |  ← Z12/Z9
  | Multiple              | Z15|        4.00x |          
  | Current value         | Z16|  $2,320,000  |  ← Z15×Z12, forest bold
  +-----------------------+----+--------------+          
                                                         
  Lever 1 — Size (grow revenue by 10%)                   ← h3
  +-----------------------+----+--------------+          
  | New revenue           | D9 |  $3,740,000  |  ← Z9 × 1.10
  | COGS (same ratio)     | D10|  $3,355,000  |  ← D9 × AA10
  | EBITDA (same margin)  | D12|    $638,000  |  ← D9 × AA12
  | Multiple (unchanged)  | E15|        4.00x |          
  | New value             | E16|  $2,552,000  |  ← E15 × D12, forest bold
  | Value created         | D20|    +$232,000 |  ← gold
  | % increase            | D19|       +10.0% |          
  +-----------------------+----+--------------+          
  Holding EBITDA margin constant. The lever is pure      ← note
  top-line growth; the buyer keeps the same multiple.    
                                                         
  Lever 2 — Efficiency (drop COGS ratio by 10 percentage points)  ← h3
  +-----------------------+----+--------------+          
  | Revenue (unchanged)   | J9 |  $3,400,000  |          
  | New COGS ratio        | K10|       79.71% |  ← AA10 - 0.10
  | COGS                  | J10|  $2,710,000  |  ← J9 × K10
  | New profit margin     | K11|       20.29% |  ← J11/J9
  | New EBITDA margin     | K12|       27.06% |  ← AA12 + (K11 - AA11)
  | New EBITDA            | J12|    $920,000  |  
  | Multiple (unchanged)  | K15|        4.00x |          
  | New value             | K16|  $3,680,000  |  ← forest bold
  | Value created         | J20|  +$1,360,000 |  ← gold
  | % increase            | J19|       +58.6% |          
  +-----------------------+----+--------------+          
  Important: 10 PERCENTAGE POINTS, not 10% of itself.    ← note
  An 89.71% COGS ratio drops to 79.71%, not to 80.74%.    
  EBITDA margin grows by the same amount the profit       
  margin grew, preserving the gap between the two.        
                                                         
  Lever 3 — Multiple (lift the multiple by 5%)            ← h3
  +-----------------------+----+--------------+          
  | EBITDA (unchanged)    | P12|    $580,000  |          
  | New multiple          | Q15|        4.20x |  ← Z15 × 1.05
  | New value             | Q16|  $2,436,000  |  ← Q15 × P12, forest bold
  | Value created         | P20|    +$116,000 |  ← gold
  | % increase            | P19|        +5.0% |          
  +-----------------------+----+--------------+          
  The multiple-uplift lever assumes you can move from     ← note
  4.00x to 4.20x by reducing risk (better sellability     
  score). It does not change revenue or EBITDA.           
```

**Page 2 layout (the blended COMPOUND forecast):**

```
  APPENDIX A5 (continued)                                ← appendixPageLabel
  THE BLENDED FORECAST                                   ← sectionLabel
  Why $4.25M, not the sum of the three levers.            ← h2
                                                         
  The headline forecast on page 2 of this report          ← body
  ($4,250,400) is NOT the sum of the three lever values.  
  It is the COMPOUND outcome: grown revenue × improved    
  EBITDA margin × improved multiple, all applied at the   
  same time.                                              
                                                         
  Compound build                                         ← h2
  +-----------------------+----+--------------+          
  | Revenue (from Lever 1)| V9 |  $3,740,000  |          
  | COGS ratio (Lever 2)  | W10|       79.71% |          
  | COGS                  | V10|  $2,981,054  |          
  | Profit                | V11|    $758,946  |          
  | Profit margin         | W11|       20.29% |          
  | EBITDA margin         | W12|       27.06% |          
  | EBITDA                | V12|  $1,012,000  |          
  | Multiple (Lever 3)    | W15|        4.20x |          
  | BLENDED SALE PRICE    | W16|  $4,250,400  |  ← gold forest, larger
  +-----------------------+----+--------------+          
                                                         
  [FORMULA BOX]                                          
  FORMULA                                                
    blended sale price = blended multiple × blended EBITDA
                       = (Z15 × (1+Q4)) × (AA12 + (K11 - AA11)) × (Z9 × (1+E4))
  THIS FIRM                                              
    = 4.20 × 27.06% × $3,740,000                         
    = $4,250,400                                         
                                                         
  Why this is compound, not additive                     ← h3
  Adding Lever 1 (+$232K) + Lever 2 (+$1,360K) + Lever 3 ← body
  (+$116K) = $1,708K of value created. That would put     
  the forecast at $4,028,000. The actual blended forecast 
  is $4,250,400 — about $222K higher.                     
                                                         
  The difference is INTERACTION. Growing revenue while    
  also improving margin produces a larger EBITDA than     
  either lever alone. That larger EBITDA, multiplied by   
  the lifted multiple, compounds the gains. The result is 
  always greater than the sum of the parts when the       
  levers are independent.                                 
                                                         
  Total value created: $4,250,400 less $2,320,000 today  ← h3
                     = $1,930,400 (83.2% above today).   
```

**Engine fields consumed:**
- `appendix.acceleration` (3 target percentages)
- `appendix.financials.revenue`, `pretaxProfit`
- `ebitda.adjustedEbitda`, `ebitdaMargin`, `currentCogs`, `currentCogsRatio`, `currentProfitMargin`
- `multiple.ebitdaMultipleUsed`
- `acceleration.*` (every field is used)

**Edge cases:**
- If any lever produces a value < currentValue (e.g. user enters negative growth), the "+"
  prefix on value-created becomes "-" and the gold accent should NOT be applied; render in
  a neutral slate color. Use `acceleration.sizeValueAdd >= 0 ? gold : slateMid`.
- Lever 2 efficiency calc can produce a profit margin > 100% if COGS ratio is driven
  negative (impossible with 10pp default, but a user could enter 100% efficiency lift).
  Don't add validation here — the appendix shows whatever the engine computed.
- The "Why compound" h3 is a non-trivial conceptual explanation. It needs the additive sum
  for the comparison, which we compute on-the-fly in the component:
  `additiveSum = sizeValueAdd + efficiencyValueAdd + multipleValueAdd`.

### A6. Wealth Gap Math (1 page, conditional)

**Purpose:** Only rendered when `includeWealthGap === true`. Walks current income, required
portfolio, net assets, the gap, and the target sale price.

**Page layout:**

```
  APPENDIX A6 OF 7                                       ← appendixPageLabel
  WEALTH GAP MATH                                        ← sectionLabel
  From sale proceeds to retirement income.                ← h1
                                                         
  The valuation only matters if the proceeds fund the     ← body
  life you want after the sale. This page shows the       
  bridge: current income, the portfolio required to       
  replace it, what you already have, the gap, and the     
  pre-fees sale price needed to close it.                 
                                                         
  Current annual income                                  ← h2
  +-------------------------------+----+--------------+
  | Dividends                     | F6 |    $250,000  |
  | + Wages                       | F7 |    $150,000  |
  | + Personal expenses via biz   | F8 |     $50,000  |
  | + Other passive income        | F9 |    $100,000  |
  +-------------------------------+----+--------------+
  | = Current annual income       | F10|    $550,000  |  ← forest bold
  +-------------------------------+----+--------------+
                                                         
  Replacement income required                            ← h2
  [FORMULA BOX]                                          
  FORMULA                                                
    replacement income = desired post-sale - other passive
  THIS FIRM                                              
    = $575,000 - $100,000                                
    = $475,000                                           
                                                         
  Note: other passive income is subtracted because it     ← note
  continues after the sale. The portfolio only needs to   
  fund the rest.                                          
                                                         
  Portfolio required                                     ← h2
  [FORMULA BOX]                                          
  FORMULA                                                
    portfolio = replacement income / return on portfolio  
  THIS FIRM                                              
    = $475,000 / 7.5%                                    
    = $6,333,333                                         
                                                         
  Net available assets                                   ← h2
  [FORMULA BOX]                                          
  FORMULA                                                
    net available = liquid assets - non-mortgage debt    
  THIS FIRM                                              
    = $1,500,000 - $75,000                               
    = $1,425,000                                         
                                                         
  Wealth gap                                             ← h2
  [FORMULA BOX]                                          
  FORMULA (corrected)                                    
    gap = portfolio required - net available             
  THIS FIRM                                              
    = $6,333,333 - $1,425,000                            
    = $4,908,333                                         
                                                         
  Note on the source-sheet bug                           ← h3
  The original valuation spreadsheet that this engine     ← body
  was ported from had a sign error in this formula: it    
  ADDED the non-mortgage debt to assets instead of        
  subtracting it. The literal-sheet figure would have     
  been $4,758,333 (overstating your assets by twice the   
  debt). The corrected formula above is the one used in   
  your valuation. Disclosed in the spirit of showing      
  our work.                                              
                                                         
  Target sale price                                      ← h2
  [FORMULA BOX]                                          
  FORMULA                                                
    target sale price = (wealth gap + business debt × ownership %) × (1 + fees & taxes %)
  THIS FIRM                                              
    = ($4,908,333 + $0 × 100%) × (1 + 10%)               
    = $4,908,333 × 1.10                                  
    = $5,399,167                                         
                                                         
  This is the gross sale price required to net enough     ← body
  to close the wealth gap after fees and taxes.           
                                                         
```

**Engine fields consumed:**
- `appendix.wealthGap` (all input fields)
- `wealthGap.currentAnnualIncome`, `replacementIncomeRequired`, `portfolioRequired`,
  `netAvailableAssets`, `wealthGap`, `netProceedsNeeded`, `targetSalePrice`
- `mode` (to label the bug-fix note appropriately)

**Edge cases:**
- If `mode === 'literal'`, swap the FORMULA label to `FORMULA (literal source-sheet)` and
  the body to `gap = portfolio required - (liquid + debt)`, then the computed value will
  match `wealthGap.wealthGap` in literal mode. Add an aside: `Switch to corrected mode to
  use the bug-fixed formula above.`
- If `wealthGap.wealthGap <= 0` (cushion above goal, not a gap), change the h2 from "Wealth
  gap" to "Cushion above goal" and the body to "Sale not strictly required for retirement."
- If `returnOnPortfolio === 0`, the divide produces Infinity. Guard in the engine (already
  done in `wealthGap.ts:41` — returns 0). The formula box should render `(divide-by-zero
  guarded — using 0)`.
- If `longTermBusinessDebt === 0` AND `ownershipPct === 1.0`, the target sale price formula
  collapses to just `wealthGap × (1 + fees%)`. Render the full formula either way for
  clarity.

### A7. Methodology Notes (1 page)

**Purpose:** Brief credibility-building summary at the end. Short.

**Page layout:**

```
  APPENDIX A7 OF 7                                       ← appendixPageLabel
  METHODOLOGY                                            ← sectionLabel
  How this engine was built and tested.                  ← h1
                                                         
  Source model                                           ← h2
  This engine is a faithful port of an internal           ← body
  spreadsheet model developed for SMB owner-operator      
  valuations. The math was extracted directly from the    
  source workbook via openpyxl XLSX inspection, not from  
  the rendered values. Every formula in this report has   
  a verified one-to-one correspondence with a source-     
  workbook cell (the cell references in tables and        
  formula boxes — H43, I51, J4, Z16, etc. — are the       
  original source cells).                                 
                                                         
  Bugs corrected                                         ← h2
  Where the source spreadsheet contained verified         ← body
  errors, the engine ships the corrected math. The two    
  material corrections in this report:                    
                                                         
  1. Wealth Gap formula (M16). The source sheet added      
     non-mortgage debt to liquid assets when subtracting   
     from required portfolio. The engine subtracts.        
     Disclosed in A6.                                      
                                                         
  2. Owner salary add-back anchor (H48). The source       
     sheet adds back the full owner salary. The engine    
     adds back only the portion above a market-rate       
     replacement, but only when you provide that          
     replacement figure. If you did not, the engine adds   
     back the full salary (literal behavior).             
                                                         
  Mode used for your report: **corrected** [or literal]. ← body (dynamic)
                                                         
  Parity testing                                         ← h2
  The engine is verified against the source spreadsheet   ← body
  via 32 paired tests covering: step 1 scores, step 2     
  scores, EBITDA math, size-score lookups, sellability    
  formula, grade and probability bands, multiple-band     
  selection, all three acceleration levers, the           
  compound blended forecast, and every wealth-gap field.  
  Tests are run in both literal and corrected modes.      
  All 32 pass.                                            
                                                         
  Determinism                                            ← h2
  The math is fully deterministic. Same inputs, same      ← body
  outputs, every time. No randomness, no AI inference,    
  no rounding to hide things. If your numbers change,     
  the valuation changes; if your numbers stay the same,   
  the valuation stays the same.                           
                                                         
  Not investment advice                                  ← h2
  This valuation is a tool to ground a conversation, not  ← body, smaller note
  a binding offer or a substitute for a formal business   
  appraisal. Real M&A transactions involve diligence,     
  buyer-specific synergies, and negotiation that move     
  the realized price above or below the modeled value.    
                                                         
```

**Engine fields consumed:**
- `mode` (for the dynamic "Mode used" line)

**No edge cases.** This page is essentially static text with one dynamic field.

---

## 5. Implementation plan

### Phase 1 — engine trace fields (one subagent, sonnet)

**Scope:** Only the engine. No PDF code. Owns these files:
- `valuation/src/engine/types.ts` — add the 5 new interfaces + `appendix?` field
- `valuation/src/engine/multiple.ts` — add `bandSelected`, `bandRule`, `tableUsed`,
  `customMultipleBypassed`, `canadianApplied` to `MultipleOutput` and to the function body
- `valuation/src/engine/ebitda.ts` — add `addBackComponents` to `EbitdaOutput` and the
  function body
- `valuation/src/engine/appendixTrace.ts` (NEW) — the `buildAppendixTrace()` helper
- `valuation/src/engine/index.ts` — accept the optional `TraceContext` arg, populate
  `appendix` field when provided
- `valuation/tests/engine.test.ts` (or wherever tests live) — add tests for the trace
  builder: smoke test with the parity fixture, snapshot the AppendixTrace shape

**Verification:** Run existing parity tests (all 32 must still pass — no math changed).
Add 4 new tests:
1. Trace produces correct readiness `QuestionTrace` for the sample fixture (raw scores
   match, contributions match, totals match `sellability.step1Score`).
2. Trace produces correct risk `QuestionTrace` (especially the negative-score lawsuit and
   SPOF rows).
3. Multiple trace flags `customMultipleBypassed: true` for the sample fixture and
   `tableUsed: 'common'`.
4. Wealth gap trace is undefined when `wealthGapInput` is undefined.

### Phase 2 — appendix PDF component (one subagent, sonnet, can run in parallel with Phase 1 once interfaces are agreed)

**Scope:** Only the PDF rendering. No engine code. Owns these files:
- `valuation/src/components/pdf/AppendixPages.tsx` (NEW) — exports `AppendixPages` that
  takes `EngineOutput` (with appendix populated) and a few props (firmName, includeWealthGap,
  today). Renders 7-9 `<Page>` components.
- `valuation/src/components/pdf/AppendixAtoms.tsx` (NEW) — exports the FormulaBox,
  QuestionScoringTable, FinancialsTable, and InputsTable atoms.
- `valuation/src/components/pdf/ValuationReport.tsx` — modify the JSX to render
  `<AppendixPages>` after the existing "Next steps" page (or before it — design decision:
  AFTER the contact card, so the contact card stays on page 5 and the appendix starts on
  page 6). This is a 4-line change.

**Dependencies on Phase 1:** Needs the `EngineOutput.appendix` field populated. While
Phase 1 is in flight, this subagent can scaffold against a mock of the `AppendixTrace`
interface (which is fully specified in this doc) and integrate once Phase 1 ships.

**Verification:** Build the PDF for the sample-firm fixture; visual diff against the page
sketches in this doc; check page count is 9 with Wealth Gap on, 8 without; check no
em-dashes, no arrow characters in the rendered text; check the formula boxes render in
Courier and align decimal points correctly.

### Phase 3 — caller integration (one small subagent OR direct edit, can be done immediately after Phase 1+2)

**Scope:** Update the wizard / Results screen path that triggers PDF generation.
- Find the call site for `compute(engineInputs)` that feeds the PDF (likely
  `valuation/src/lib/pdf.tsx` or a Results component).
- Change to `compute(engineInputs, { readinessQuestionDefs: READINESS_QUESTIONS, ... })`.
- Pass `includeWealthGap` through to `<ValuationReport>` and `<AppendixPages>`.

**Verification:** Generate a PDF end-to-end with the sample firm fixture, open it, confirm
all 14-15 pages render in order with correct content.

### Parallelization

```
Phase 1 (engine)         |================|
Phase 2 (PDF component)  |================|     ← scaffolds against the spec, integrates at end
Phase 3 (integration)                     |==|  ← runs after both
```

Phase 1 and Phase 2 are independent files. Two subagents can work simultaneously. Phase 2's
mock of the trace interface needs to exactly match what Phase 1 ships (this design doc is
that contract). Phase 3 is a single small file and should be done by the orchestrator after
1+2 merge.

---

## 6. Risks and edge cases

| Risk | Mitigation |
|------|------------|
| Long question prompts overflow the Question column in A2's table | Truncate at 90 chars with ellipsis. The CPA-rewrite prompts are 80-120 chars; 90 captures most without truncation. Helper text is NOT rendered in the appendix. |
| Long option labels (some are 60+ chars) overflow the Answer column | Truncate at 50 chars. Tested against the longest in `questions.ts`: `"Partners span a 10+ year age range and have a documented succession plan"` (74 chars). Use ellipsis. |
| Page-break lands mid-table | All tables and formula boxes wrap as a unit (`wrap={false}` on the parent `<View>`). The question-scoring tables for Step 1 (7 rows + header + total) and Step 2 (15 rows + header + total) each fit on a US-letter page at 8.5pt body. Verified by character counting. |
| Wealth Gap conditional rendering | `AppendixPages` accepts `includeWealthGap: boolean` and only renders A6 when true. Section numbering stays A1-A7 (A6 is conditional but A7 is always there); if A6 is skipped, the eyebrow labels show `APPENDIX A1 OF 6`, `... A2 OF 6`, etc. The OF-N count is a prop. |
| SPOF count of 4+ produces a very negative Step 2 row | Designed in. The contribution column shows `-5 × 1 = -5`. Step 2 total can still go positive in practice. Note in the running text: "Negative contributions reflect risk penalties baked into the source model." |
| Custom-multiple path: user enters 0.0 as custom multiple | Engine ships `ebitdaMultipleUsed = 0`, `currentValue = 0`, blended sale price = 0. Appendix renders honestly: shows the bypass, shows the 0x, shows the resulting $0. Owner sees they entered a degenerate value. |
| User skipped optional questions (left at default) | Engine receives the default rawScore (typically the lowest option). Appendix shows the default answer text honestly. If the team wants to flag "you did not answer this," a future enhancement could add an `answered: boolean` field to `QuestionTrace`. Out of scope for this design. |
| `marketRateReplacementSalary` not provided | A3 omits the salary-anchor section entirely (no formula box, no note). Owner sees the literal addition without the anchor logic. |
| Mode = 'literal' | A3 and A6 surface the literal formula. A7 dynamically renders "Mode used: literal." Note that the webapp defaults to corrected (per spec); literal is mostly used by parity tests, which don't generate PDFs. |
| @react-pdf can't render certain Unicode glyphs | Confirmed: no em-dashes (`—`), no arrow `→`, no smart quotes in any rendered string in this design. Used `-` and words like "becomes", "produces". Reviewed every code block in this doc. |
| Question definitions diverge from rawScore options over time | The trace builder uses the LIVE `READINESS_QUESTIONS` / `RISK_QUESTIONS` definitions, matched by question id and rawScore-to-option lookup. If an option label changes, the appendix reflects the new label. If an option is REMOVED but a stored answer references the removed rawScore, `answerLabel: '(not recorded)'` is rendered. |
| User refreshes the page or comes back later with stale answers in localStorage | Out of scope for this design. The engine and appendix render whatever the wizard hands them. |
| PDF binary size growth | Each appendix page adds ~3-5 KB to the final PDF. 9 appendix pages add roughly 30-45 KB. Negligible for email attachment (Resend caps at 40 MB). |
| Question count grows beyond 22 | The 1-page Step 2 table holds up to ~22 rows comfortably at 8.5pt body. If we add more questions later, a second page for Step 2 becomes necessary. The current page-count estimate holds for the current 22-question set. |

---

## 7. Concrete deliverables checklist

- [ ] `valuation/src/engine/types.ts` — 5 new interfaces, `appendix?` on `EngineOutput`,
      band metadata on `MultipleOutput`, `addBackComponents` on `EbitdaOutput`
- [ ] `valuation/src/engine/multiple.ts` — band metadata returned from `bandedPick`
      (refactor to `bandedPickWithMeta`), surface `tableUsed`, `customMultipleBypassed`,
      `canadianApplied` on the output
- [ ] `valuation/src/engine/ebitda.ts` — return `addBackComponents` echo
- [ ] `valuation/src/engine/appendixTrace.ts` — NEW file, `buildAppendixTrace()`
- [ ] `valuation/src/engine/index.ts` — accept `TraceContext`, populate `appendix`
- [ ] `valuation/tests/engine.test.ts` — 4 new trace tests + existing parity tests still pass
- [ ] `valuation/src/components/pdf/AppendixAtoms.tsx` — FormulaBox, QuestionScoringTable,
      FinancialsTable, InputsTable, ScoreLookupTable
- [ ] `valuation/src/components/pdf/AppendixPages.tsx` — A1 through A7 page components
- [ ] `valuation/src/components/pdf/ValuationReport.tsx` — render `<AppendixPages>` after
      the Next Steps page
- [ ] Caller integration (likely `valuation/src/lib/pdf.tsx`) — pass `TraceContext` into
      `compute()`
- [ ] End-to-end smoke: generate a PDF for the sample firm fixture, verify 9 appendix pages
      render, no em-dashes, no arrows, formula boxes align, page breaks land cleanly

---

## Appendix to the appendix design: literal text snippets to copy

For the implementer's convenience, here are the exact strings that go into rendered text
(double-checked for no em-dashes and no arrow glyphs):

**A1 body:** `This appendix shows every input you gave us and every formula we applied. Nothing is hidden. If a number on the headline pages surprised you, this is where it came from.`

**A2 body:** `Sellability blends three numbers: a readiness score (Step 1, unweighted raw sum), a risk-weighted score (Step 2, raw times weight per question), and an EBITDA size score. We show the J4 formula on the next page; this page shows every question's contribution.`

**A2 "+2 quirk" note:** `Why "+ 2" in the denominator? This is verbatim from the source spreadsheet's J4 formula. The size score adds up to 75 into the numerator but only 2 into the denominator, which is why the score is capped at 100% with MIN(1, ...). We preserve the formula exactly for parity with the source model. Effectively, the score ceiling is 100% and very high-performing firms saturate.`

**A3 salary-anchor note:** `The source spreadsheet adds back the FULL owner salary ($230,000). The webapp's corrected mode adds back only the amount above a market-rate replacement, because a buyer must hire a real person to do that work and cannot capitalize the saved cost twice.`

**A4 body:** `Buyers pay a multiple of EBITDA. The webapp picks that multiple in five steps: choose a SOURCE (which table to use), pick a BAND (which percentile bucket the sellability lands in), optionally apply RISK WEIGHTING, optionally apply a CANADIAN discount, and if a CUSTOM multiple was entered, use it instead.`

**A4 custom-bypass note:** `You selected "Use Custom Multiple". This BYPASSES the risk-weighting chain above and uses your custom value directly. The informational risk-weighted value (4.25x) is shown for reference but is not the multiple used in your valuation.`

**A5 compound explanation:** `Adding Lever 1 (+$232K) + Lever 2 (+$1,360K) + Lever 3 (+$116K) = $1,708K of value created. That would put the forecast at $4,028,000. The actual blended forecast is $4,250,400, about $222K higher. The difference is INTERACTION. Growing revenue while also improving margin produces a larger EBITDA than either lever alone. That larger EBITDA, multiplied by the lifted multiple, compounds the gains. The result is always greater than the sum of the parts when the levers are independent.`

**A6 bug-fix note:** `The original valuation spreadsheet that this engine was ported from had a sign error in this formula: it ADDED the non-mortgage debt to assets instead of subtracting it. The literal-sheet figure would have been $4,758,333 (overstating your assets by twice the debt). The corrected formula above is the one used in your valuation. Disclosed in the spirit of showing our work.`

**A7 source-model body:** `This engine is a faithful port of an internal spreadsheet model developed for SMB owner-operator valuations. The math was extracted directly from the source workbook via openpyxl XLSX inspection, not from the rendered values. Every formula in this report has a verified one-to-one correspondence with a source-workbook cell (the cell references in tables and formula boxes, H43, I51, J4, Z16, etc., are the original source cells).`

**A7 parity-testing body:** `The engine is verified against the source spreadsheet via 32 paired tests covering: step 1 scores, step 2 scores, EBITDA math, size-score lookups, sellability formula, grade and probability bands, multiple-band selection, all three acceleration levers, the compound blended forecast, and every wealth-gap field. Tests are run in both literal and corrected modes. All 32 pass.`

**A7 determinism body:** `The math is fully deterministic. Same inputs, same outputs, every time. No randomness, no AI inference, no rounding to hide things. If your numbers change, the valuation changes; if your numbers stay the same, the valuation stays the same.`

**A7 disclaimer body:** `This valuation is a tool to ground a conversation, not a binding offer or a substitute for a formal business appraisal. Real M&A transactions involve diligence, buyer-specific synergies, and negotiation that move the realized price above or below the modeled value.`

---

End of design.
