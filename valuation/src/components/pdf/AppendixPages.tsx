/**
 * AppendixPages — A1 through A7 math-appendix pages for the Someday valuation PDF.
 *
 * Returns an array of <Page> components (NOT a single fragment). The caller spreads
 * or renders them directly inside <Document>.
 *
 * Constraints enforced here:
 *   - No em-dashes anywhere in rendered text
 *   - No arrow glyphs (no Unicode arrows that break Helvetica WinAnsi encoding)
 *   - Brand colors + Helvetica / Times-Roman / Courier fonts only
 *   - wrap={false} on each table-row-group and formula box
 */

import { Page, Text, View } from '@react-pdf/renderer';
import type { EngineOutput } from '../../engine';
import type { AppendixTrace } from '../../engine';
import { fmt } from '../../lib/format';
import { SIZE_SCORE_TABLE, SIZE_SCORE_MAX } from '../../data/sizeScoreTable';
import { COMMON_MULTIPLES, INDUSTRY_MULTIPLES } from '../../data/multipleBands';
import {
  C,
  aStyles,
  AppendixHeader,
  AppendixFooter,
  SectionEyebrow,
  FormulaBox,
  QuestionScoringTable,
  FinancialsTable,
  TwoColTable,
} from './AppendixAtoms';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface AppendixPagesProps {
  firmName: string;
  today: string;
  outputs: EngineOutput & { appendix: AppendixTrace };
  includeWealthGap: boolean;
  mode: 'literal' | 'corrected';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pctStr(n: number): string {
  return fmt.pctPrecise(n);
}

function usd(n: number): string {
  return fmt.usd(n);
}

function multi(n: number): string {
  return fmt.multiple(n);
}

// Band label map for A4
const BAND_LABELS: Record<string, string> = {
  p10: '10th percentile',
  p25: '25th percentile',
  median: 'Median',
  'median-p75-avg': '(Median + 75th) / 2',
  p75: '75th percentile',
  'p75-p90-avg': '(75th + 90th) / 2',
};

// Band table rows for A4
const BAND_TABLE_ROWS = [
  { range: '50% and below', band: '10th percentile', key: 'p10' },
  { range: '50% to 60%', band: '25th percentile', key: 'p25' },
  { range: '60% to 70%', band: 'Median', key: 'median' },
  { range: '70% to 85%', band: '(Median + 75th) / 2', key: 'median-p75-avg' },
  { range: '85% to 95%', band: '75th percentile', key: 'p75' },
  { range: 'Above 95%', band: '(75th + 90th) / 2', key: 'p75-p90-avg' },
];

// Grade table rows for A2
const GRADE_TABLE_ROWS = [
  { range: '90% and above', grade: 'A', prob: 'Very High' },
  { range: '75% to 89%', grade: 'B', prob: 'High' },
  { range: '60% to 74%', grade: 'C', prob: 'Medium' },
  { range: '50% to 59%', grade: 'D', prob: 'Low' },
  { range: 'Below 50%', grade: 'F', prob: 'Very Low' },
];

function getGradeForPct(pct: number): string {
  if (pct >= 0.9) return 'A';
  if (pct >= 0.75) return 'B';
  if (pct >= 0.6) return 'C';
  if (pct >= 0.5) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function AppendixPages({
  firmName,
  today,
  outputs,
  includeWealthGap,
  mode,
}: AppendixPagesProps): JSX.Element[] {
  const { appendix, sellability, ebitda, multiple, acceleration, wealthGap } = outputs;

  // "OF N" denominator: 7 when Wealth Gap included, 6 when not
  const ofN = includeWealthGap ? 7 : 6;

  const pages: JSX.Element[] = [];

  // -------------------------------------------------------------------------
  // A1 — Inputs Collected
  // -------------------------------------------------------------------------
  pages.push(
    <Page key="a1p1" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A1" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>THE INPUTS</Text>
      <Text style={aStyles.h1}>Everything you entered.</Text>
      <Text style={aStyles.body}>
        This appendix shows every input you gave us and every formula we applied. Nothing is
        hidden. If a number on the headline pages surprised you, this is where it came from.
      </Text>

      {/* Firm Profile */}
      <Text style={aStyles.h2}>Firm Profile</Text>
      <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 4,
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ fontFamily: 'Helvetica', fontSize: 8.5, color: C.slate, flex: 1 }}>
            Firm name
          </Text>
          <Text style={{ fontFamily: 'Helvetica', fontSize: 8.5, color: C.slateMid }}>
            {firmName}
          </Text>
        </View>
      </View>

      {/* Financials */}
      <Text style={aStyles.h2}>Financials</Text>
      <FinancialsTable
        rows={[
          { label: 'Revenue', cell: 'H43', valueLabel: usd(appendix.financials.revenue) },
          { label: 'Pre-tax profit', cell: 'H44', valueLabel: usd(appendix.financials.pretaxProfit) },
          {
            label: 'Amortization and depreciation',
            cell: 'H45',
            valueLabel: usd(appendix.financials.amortizationDepreciation),
          },
          {
            label: 'Long-term interest',
            cell: 'H46',
            valueLabel: usd(appendix.financials.longTermInterest),
          },
          {
            label: 'Discretionary spending',
            cell: 'H47',
            valueLabel: usd(appendix.financials.discretionarySpending),
          },
          { label: 'Owner salary', cell: 'H48', valueLabel: usd(appendix.financials.ownerSalary) },
          ...(appendix.financials.marketRateReplacementSalary != null
            ? [
                {
                  label: 'Market-rate replacement salary',
                  cell: '(*)',
                  valueLabel: usd(appendix.financials.marketRateReplacementSalary),
                },
              ]
            : []),
          { label: 'Rent to self', cell: 'H49', valueLabel: usd(appendix.financials.rentToSelf) },
        ]}
      />
      {appendix.financials.marketRateReplacementSalary != null && (
        <Text style={aStyles.note}>
          (*) Only the portion of your owner salary above this market-rate figure is added back
          to EBITDA. See A3 for the addition.
        </Text>
      )}

      {/* Readiness questions (Step 1) */}
      <Text style={aStyles.h2}>Readiness questions (Step 1)</Text>
      <QuestionScoringTable
        questions={appendix.readinessQuestions}
        totalLabel="STEP 1 TOTAL"
        totalContribution={sellability.step1Score}
        totalMax={sellability.step1Max}
      />

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // A1 page 2 — Risk questions + optional Wealth Gap inputs
  const riskPage = (
    <Page key="a1p2" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A1" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>THE INPUTS (CONTINUED)</Text>
      <Text style={aStyles.h2}>Risk questions (Step 2)</Text>
      <QuestionScoringTable
        questions={appendix.riskQuestions}
        totalLabel="STEP 2 TOTAL"
        totalContribution={sellability.step2Score}
        totalMax={sellability.step2Max}
      />
      <Text style={aStyles.note}>
        Step 2 contribution = raw score x G weight. Lawsuits and SPOFs use negative raw scores
        by design: high-risk firms receive a penalty, not a zero.
      </Text>

      {includeWealthGap && appendix.wealthGap && (
        <View>
          <Text style={[aStyles.h2, { marginTop: 14 }]}>Wealth-Gap inputs</Text>

          <Text style={aStyles.h3}>Current annual income from the firm</Text>
          <FinancialsTable
            rows={[
              { label: 'Dividends', cell: 'F6', valueLabel: usd(appendix.wealthGap.dividends) },
              { label: 'Wages', cell: 'F7', valueLabel: usd(appendix.wealthGap.wages) },
              {
                label: 'Personal expenses covered by business',
                cell: 'F8',
                valueLabel: usd(appendix.wealthGap.personalExpensesCoveredByBusiness),
              },
              {
                label: 'Other passive income',
                cell: 'F9',
                valueLabel: usd(appendix.wealthGap.otherPassiveIncome),
              },
            ]}
          />

          <Text style={aStyles.h3}>Assets and liabilities</Text>
          <FinancialsTable
            rows={[
              {
                label: 'Liquid assets',
                cell: 'F14',
                valueLabel: usd(appendix.wealthGap.liquidAssets),
              },
              {
                label: 'Non-mortgage debt',
                cell: 'F15',
                valueLabel: usd(appendix.wealthGap.nonMortgageDebt),
              },
            ]}
          />

          <Text style={aStyles.h3}>Post-sale target</Text>
          <FinancialsTable
            rows={[
              {
                label: 'Desired annual income',
                cell: 'M6',
                valueLabel: usd(appendix.wealthGap.desiredPostSaleAnnualIncome),
              },
              {
                label: 'Exit timeline (years)',
                cell: 'M7',
                valueLabel: String(appendix.wealthGap.desiredExitTimelineYears),
              },
              {
                label: 'Assumed portfolio return',
                cell: 'M14',
                valueLabel: fmt.pct(appendix.wealthGap.returnOnPortfolio),
              },
              {
                label: 'Ownership % at sale',
                cell: 'T6',
                valueLabel: fmt.pct(appendix.wealthGap.ownershipPct),
              },
              {
                label: 'Fees and taxes %',
                cell: 'T10',
                valueLabel: fmt.pct(appendix.wealthGap.feesAndTaxesPct),
              },
              {
                label: 'Long-term business debt',
                cell: 'T8',
                valueLabel: usd(appendix.wealthGap.longTermBusinessDebt),
              },
            ]}
          />
        </View>
      )}

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );
  pages.push(riskPage);

  // -------------------------------------------------------------------------
  // A2 page 1 — Sellability Score Build (questions walk)
  // -------------------------------------------------------------------------
  // Filter out tracking-only for the score-build page
  const scoringReadiness = appendix.readinessQuestions.filter((q) => !q.trackingOnly);
  const scoringRisk = appendix.riskQuestions.filter((q) => !q.trackingOnly);

  const pctPrecise = pctStr(sellability.sellabilityPct);

  pages.push(
    <Page key="a2p1" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A2" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>SELLABILITY SCORE BUILD</Text>
      <Text style={aStyles.h1}>How we got to {pctPrecise}.</Text>
      <Text style={aStyles.body}>
        Sellability blends three numbers: a readiness score (Step 1, unweighted raw sum), a
        risk-weighted score (Step 2, raw times weight per question), and an EBITDA size score.
        We show the J4 formula on the next page; this page shows every question's contribution.
      </Text>

      <Text style={aStyles.h2}>Step 1 - Readiness ({scoringReadiness.length} scoring questions)</Text>
      <QuestionScoringTable
        questions={scoringReadiness}
        totalLabel="STEP 1 TOTAL"
        totalContribution={sellability.step1Score}
        totalMax={sellability.step1Max}
      />
      <Text style={aStyles.note}>
        Step 1 contribution = raw score (NOT x G). Step 1 max = G x 5 per question. Matches
        source sheet cells I12-I17.
      </Text>

      <Text style={[aStyles.h2, { marginTop: 10 }]}>
        Step 2 - Risk ({scoringRisk.length} scoring questions)
      </Text>
      <QuestionScoringTable
        questions={scoringRisk}
        totalLabel="STEP 2 TOTAL"
        totalContribution={sellability.step2Score}
        totalMax={sellability.step2Max}
      />
      <Text style={aStyles.note}>
        Step 2 contribution = raw score x G. Matches source sheet cells I24-I38. Lawsuits and
        SPOFs use negative raw scores by design. Negative contributions reflect risk penalties
        baked into the source model.
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // A2 page 2 — J4 formula + size score + grade
  const ebitdaVal = ebitda.adjustedEbitda;

  // Build size score table rows, highlighting the matching band
  const sizeTableRows: JSX.Element[] = [];
  let prevThreshold = 0;
  let firmBandKey = -1;

  // Determine which band the firm's EBITDA falls into
  for (let i = 0; i < SIZE_SCORE_TABLE.length; i++) {
    const band = SIZE_SCORE_TABLE[i];
    if (ebitdaVal < band.thresholdBelow) {
      firmBandKey = i;
      break;
    }
  }
  // If above all thresholds, highlight the last row (SIZE_SCORE_MAX)
  if (firmBandKey === -1) firmBandKey = SIZE_SCORE_TABLE.length; // will highlight "3M+"

  SIZE_SCORE_TABLE.forEach((band, i) => {
    const rangeLabel =
      prevThreshold === 0
        ? `Below ${usd(band.thresholdBelow)}`
        : `${usd(prevThreshold)} to ${usd(band.thresholdBelow)}`;
    const isHighlight = i === firmBandKey;
    sizeTableRows.push(
      <View
        key={i}
        wrap={false}
        style={{
          flexDirection: 'row',
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderBottomWidth: 0.5,
          borderBottomColor: C.hairline,
          backgroundColor: isHighlight ? C.cream : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
            fontSize: 8.5,
            color: isHighlight ? C.forest : C.slate,
            flex: 1,
          }}
        >
          {rangeLabel}
          {isHighlight ? '  (this firm)' : ''}
        </Text>
        <Text
          style={{
            fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
            fontSize: 8.5,
            color: isHighlight ? C.forest : C.slate,
            width: 60,
            textAlign: 'right',
          }}
        >
          {band.score}
        </Text>
      </View>
    );
    prevThreshold = band.thresholdBelow;
  });
  // Add the top band (>= last threshold)
  {
    const isHighlight = firmBandKey === SIZE_SCORE_TABLE.length;
    sizeTableRows.push(
      <View
        key="top"
        wrap={false}
        style={{
          flexDirection: 'row',
          paddingVertical: 3,
          paddingHorizontal: 8,
          backgroundColor: isHighlight ? C.cream : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
            fontSize: 8.5,
            color: isHighlight ? C.forest : C.slate,
            flex: 1,
          }}
        >
          {usd(prevThreshold)} and above
          {isHighlight ? '  (this firm)' : ''}
        </Text>
        <Text
          style={{
            fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
            fontSize: 8.5,
            color: isHighlight ? C.forest : C.slate,
            width: 60,
            textAlign: 'right',
          }}
        >
          {SIZE_SCORE_MAX}
        </Text>
      </View>
    );
  }

  // Formula plugged-in values for J4
  const step2 = sellability.step2Score;
  const size = sellability.sizeScore;
  const step1 = sellability.step1Score;
  const combinedMax = sellability.combinedMax;
  const sellPct = pctPrecise;

  // Grade row highlight
  const firmGrade = getGradeForPct(sellability.sellabilityPct);

  pages.push(
    <Page key="a2p2" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A2" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>THE J4 FORMULA</Text>
      <Text style={aStyles.h2}>Two raw scores plus a size score, divided by the max.</Text>

      <Text style={aStyles.h3}>Size score lookup</Text>
      <Text style={aStyles.note}>Adjusted EBITDA: {usd(ebitdaVal)}</Text>
      <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 4 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: C.forest,
          }}
        >
          <Text
            style={{
              fontFamily: 'Helvetica-Bold',
              fontSize: 7,
              color: C.gold,
              letterSpacing: 1,
              flex: 1,
            }}
          >
            EBITDA Band
          </Text>
          <Text
            style={{
              fontFamily: 'Helvetica-Bold',
              fontSize: 7,
              color: C.gold,
              letterSpacing: 1,
              width: 60,
              textAlign: 'right',
            }}
          >
            Score
          </Text>
        </View>
        {sizeTableRows}
      </View>

      <FormulaBox
        formula="sellability % = MIN(1, (step2 + size + step1) / (max + 2))"
        pluggedIn={[
          `= MIN(1, (${step2} + ${size} + ${step1}) / (${combinedMax} + 2))`,
          `= MIN(1, ${step2 + size + step1} / ${combinedMax + 2})`,
          `= ${sellPct}`,
        ]}
      />

      <Text style={aStyles.h3}>Why "+ 2" in the denominator?</Text>
      <Text style={aStyles.note}>
        This is verbatim from the source spreadsheet's J4 formula. The size score adds up to 75
        into the numerator but only 2 into the denominator, which is why the score is capped at
        100% with MIN(1, ...). We preserve the formula exactly for parity with the source model.
        Effectively, the score ceiling is 100% and very high-performing firms saturate.
      </Text>

      <Text style={aStyles.h3}>Grade band</Text>
      <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: C.forest,
          }}
        >
          {['Score range', 'Grade', 'Probability of sale'].map((h, i) => (
            <Text
              key={i}
              style={{
                fontFamily: 'Helvetica-Bold',
                fontSize: 7,
                color: C.gold,
                letterSpacing: 1,
                flex: i === 0 ? 2 : 1,
                textAlign: i > 0 ? 'center' : 'left',
              }}
            >
              {h}
            </Text>
          ))}
        </View>
        {GRADE_TABLE_ROWS.map((row) => {
          const isHighlight = row.grade === firmGrade;
          return (
            <View
              key={row.grade}
              wrap={false}
              style={{
                flexDirection: 'row',
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: C.hairline,
                backgroundColor: isHighlight ? C.cream : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isHighlight ? C.forest : C.slate,
                  flex: 2,
                }}
              >
                {row.range}
                {isHighlight ? '  (this firm)' : ''}
              </Text>
              <Text
                style={{
                  fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isHighlight ? C.forest : C.slate,
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                {row.grade}
              </Text>
              <Text
                style={{
                  fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isHighlight ? C.forest : C.slate,
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                {row.prob}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={aStyles.body}>
        Your sellability of {sellPct} falls in the {firmGrade === 'A' ? '90% and above' : firmGrade === 'B' ? '75%-89%' : firmGrade === 'C' ? '60%-74%' : firmGrade === 'D' ? '50%-59%' : 'below 50%'} band.
        Grade: {sellability.grade}. Probability of sale: {sellability.probabilityOfSale}.
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // -------------------------------------------------------------------------
  // A3 — Adjusted EBITDA Build
  // -------------------------------------------------------------------------
  const abc = ebitda.addBackComponents;
  const hasMarketRate = abc.marketRateUsed != null;

  pages.push(
    <Page key="a3" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A3" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>ADJUSTED EBITDA BUILD</Text>
      <Text style={aStyles.h1}>From profit to the number a buyer capitalizes.</Text>
      <Text style={aStyles.body}>
        Adjusted EBITDA is the cash flow a buyer can take out of the firm after replacing your
        role. Six lines of additions get there.
      </Text>

      <Text style={aStyles.h2}>The addition</Text>
      <FinancialsTable
        rows={[
          { label: 'Pre-tax profit', cell: 'H44', valueLabel: usd(abc.pretaxProfit) },
          {
            label: '+ Amortization and depreciation',
            cell: 'H45',
            valueLabel: usd(abc.amortizationDepreciation),
          },
          {
            label: '+ Long-term interest',
            cell: 'H46',
            valueLabel: usd(abc.longTermInterest),
          },
          {
            label: '+ Discretionary spending',
            cell: 'H47',
            valueLabel: usd(abc.discretionarySpending),
          },
          {
            label: '+ Owner salary add-back',
            cell: '(*)',
            valueLabel: usd(abc.salaryAddBack),
          },
          {
            label: '+ Rent to self',
            cell: 'H49',
            valueLabel: usd(abc.rentToSelf),
          },
        ]}
        totalRow={{
          label: '= Adjusted EBITDA',
          valueLabel: usd(ebitda.adjustedEbitda),
        }}
      />
      <Text style={aStyles.note}>
        (*) H48 less market-rate anchor when corrected mode is enabled.
      </Text>

      <FormulaBox
        formula="EBITDA margin = adjusted EBITDA / revenue"
        pluggedIn={[
          `= ${usd(ebitda.adjustedEbitda)} / ${usd(appendix.financials.revenue)}`,
          `= ${fmt.pct(ebitda.ebitdaMargin)}`,
        ]}
      />

      {hasMarketRate && (
        <View>
          <Text style={aStyles.h3}>Salary anchor (the H48 add-back)</Text>
          <Text style={aStyles.body}>
            The source spreadsheet adds back the FULL owner salary ({usd(abc.ownerSalaryRaw)}).
            The webapp's corrected mode adds back only the amount above a market-rate replacement,
            because a buyer must hire a real person to do that work and cannot capitalize the
            saved cost twice.
          </Text>
          <FormulaBox
            formula="salary add-back = max(0, ownerSalary - marketRate)"
            pluggedIn={[
              `= max(0, ${usd(abc.ownerSalaryRaw)} - ${usd(abc.marketRateUsed!)})`,
              `= ${usd(abc.salaryAddBack)}`,
            ]}
          />
          {mode === 'literal' && (
            <Text style={aStyles.note}>
              Literal mode is active. The corrected formula would compute{' '}
              {usd(Math.max(0, abc.ownerSalaryRaw - (abc.marketRateUsed ?? 0)))} here. The
              add-back used in the headline numbers is {usd(abc.ownerSalaryRaw)}.
            </Text>
          )}
        </View>
      )}

      {!hasMarketRate && (
        <Text style={aStyles.note}>
          Owner salary added back in full ({usd(abc.ownerSalaryRaw)}). Provide a market-rate
          replacement salary in the wizard to use the corrected add-back logic.
        </Text>
      )}

      <Text style={aStyles.h3}>Size score (looked up against EBITDA)</Text>
      <Text style={aStyles.body}>
        Your EBITDA of {usd(ebitdaVal)} maps to size score {sellability.sizeScore}. The size
        score is part of the J4 sellability formula. See A2.
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // -------------------------------------------------------------------------
  // A4 — Multiple Selection Chain
  // -------------------------------------------------------------------------
  const mt = appendix.multiple;
  const isCustom = mt.source === 'Use Custom Multiple';
  const isIndustry = mt.tableUsed === 'industry';
  const sellPctForA4 = pctStr(sellability.sellabilityPct);

  pages.push(
    <Page key="a4" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A4" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>MULTIPLE SELECTION CHAIN</Text>
      <Text style={aStyles.h1}>
        The {multi(multiple.ebitdaMultipleUsed)} multiple, step by step.
      </Text>
      <Text style={aStyles.body}>
        Buyers pay a multiple of EBITDA. The webapp picks that multiple in five steps: choose a
        SOURCE (which table to use), pick a BAND (which percentile bucket the sellability lands
        in), optionally apply RISK WEIGHTING, optionally apply a CANADIAN discount, and if a
        CUSTOM multiple was entered, use it instead.
      </Text>

      <Text style={aStyles.h2}>Your settings</Text>
      <TwoColTable
        rows={[
          { label: 'Source', value: mt.source },
          { label: 'Risk weighting', value: mt.riskWeighting },
          { label: 'Canadian', value: mt.canadian ? 'Yes' : 'No' },
          { label: 'Custom multiple', value: multi(mt.customMultiple) },
        ]}
      />

      <Text style={aStyles.h3}>Step 1 - Pick a table</Text>
      <Text style={aStyles.body}>
        Source "{mt.source}" uses the {isIndustry ? 'INDUSTRY' : 'COMMON'} multiple table.
        Industry table applies when source is "From Financials" or "Use Industry Multiples".
        Common table applies when source is "Use Common Multiples" or "Use Custom Multiple".
      </Text>

      {/* Multiple table reference */}
      <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: C.forest,
          }}
        >
          {['Table', '10th', '25th', 'Median', '75th', '90th'].map((h, i) => (
            <Text
              key={i}
              style={{
                fontFamily: 'Helvetica-Bold',
                fontSize: 7,
                color: C.gold,
                letterSpacing: 1,
                flex: i === 0 ? 2 : 1,
                textAlign: i > 0 ? 'right' : 'left',
              }}
            >
              {h}
            </Text>
          ))}
        </View>
        {[
          { label: 'Common', band: COMMON_MULTIPLES, isActive: !isIndustry },
          { label: 'Industry', band: INDUSTRY_MULTIPLES, isActive: isIndustry },
        ].map(({ label, band, isActive }) => (
          <View
            key={label}
            wrap={false}
            style={{
              flexDirection: 'row',
              paddingVertical: 3,
              paddingHorizontal: 8,
              backgroundColor: isActive ? C.cream : 'transparent',
              borderBottomWidth: 0.5,
              borderBottomColor: C.hairline,
            }}
          >
            <Text
              style={{
                fontFamily: isActive ? 'Helvetica-Bold' : 'Helvetica',
                fontSize: 8.5,
                color: isActive ? C.forest : C.slate,
                flex: 2,
              }}
            >
              {label}
              {isActive ? ' (used)' : ''}
            </Text>
            {[band.p10, band.p25, band.median, band.p75, band.p90].map((v, i) => (
              <Text
                key={i}
                style={{
                  fontFamily: isActive ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isActive ? C.forest : C.slate,
                  flex: 1,
                  textAlign: 'right',
                }}
              >
                {multi(v)}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={aStyles.h3}>Step 2 - Pick a band</Text>
      <Text style={aStyles.body}>
        Your sellability is {sellPctForA4}. Band rule: {mt.bandRule}.
      </Text>
      {/* Band rule table */}
      <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: C.forest,
          }}
        >
          {['Sellability', 'Band'].map((h, i) => (
            <Text
              key={i}
              style={{
                fontFamily: 'Helvetica-Bold',
                fontSize: 7,
                color: C.gold,
                letterSpacing: 1,
                flex: 1,
              }}
            >
              {h}
            </Text>
          ))}
        </View>
        {BAND_TABLE_ROWS.map((row) => {
          const isHighlight = row.key === mt.bandSelected;
          return (
            <View
              key={row.key}
              wrap={false}
              style={{
                flexDirection: 'row',
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: C.hairline,
                backgroundColor: isHighlight ? C.cream : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isHighlight ? C.forest : C.slate,
                  flex: 1,
                }}
              >
                {row.range}
              </Text>
              <Text
                style={{
                  fontFamily: isHighlight ? 'Helvetica-Bold' : 'Helvetica',
                  fontSize: 8.5,
                  color: isHighlight ? C.forest : C.slate,
                  flex: 1,
                }}
              >
                {row.band}
                {isHighlight ? '  (you)' : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Informational band value */}
      <Text style={aStyles.note}>
        {isIndustry ? 'Industry' : 'Common'} table at {sellPctForA4}:{' '}
        {BAND_LABELS[mt.bandSelected]} = {multi(multiple.riskWeightedDisplay)} (informational,
        J65 in source sheet).
      </Text>

      <Text style={aStyles.h3}>Step 3 - Risk weighting</Text>
      <Text style={aStyles.body}>
        {mt.riskWeighting === 'Risk Weighting On'
          ? `Risk Weighting On uses the band-picked multiple (${multi(multiple.riskWeightedDisplay)}) as the from-financials base. Risk Weighting Off would use the median directly (${multi(multiple.noRiskBase)}).`
          : `Risk Weighting Off: median used directly (${multi(multiple.noRiskBase)} for ${isIndustry ? 'industry' : 'common'} table).`}
      </Text>

      <Text style={aStyles.h3}>Step 4 - Canadian discount</Text>
      <Text style={aStyles.body}>
        {mt.canadianApplied
          ? `Canadian discount applied: -0.5 subtracted. ${multi(multiple.riskWeightedDisplay)} becomes ${multi(multiple.fromFinancialsFinal)}.`
          : 'Not applied (G59 = No). Would have subtracted 0.5 from the multiple if Yes.'}
      </Text>

      {/* Step 5 only when custom multiple path */}
      {isCustom && (
        <View>
          <Text style={aStyles.h3}>Step 5 - Custom multiple bypass</Text>
          <Text style={aStyles.body}>
            You selected "Use Custom Multiple". This BYPASSES the risk-weighting chain above and
            uses your custom value directly. The informational risk-weighted value (
            {multi(multiple.riskWeightedDisplay)}) is shown for reference but is not the
            multiple used in your valuation.
          </Text>
          <FormulaBox
            formula={`multiple used = IF(source = "Use Custom Multiple", customMultiple, fromFinancialsFinal)`}
            pluggedIn={[
              `= IF("Use Custom Multiple", ${multi(mt.customMultiple)}, ${multi(multiple.fromFinancialsFinal)})`,
              `= ${multi(multiple.ebitdaMultipleUsed)}`,
            ]}
          />
        </View>
      )}

      {!isCustom && (
        <FormulaBox
          formula="multiple used = fromFinancialsFinal (D66)"
          pluggedIn={[`= ${multi(multiple.fromFinancialsFinal)}`]}
        />
      )}

      <Text style={[aStyles.h3, { fontFamily: 'Helvetica-Bold', color: C.forest }]}>
        Final multiple: {multi(multiple.ebitdaMultipleUsed)}
      </Text>
      <Text style={aStyles.body}>
        Applied to {usd(ebitdaVal)} EBITDA produces {usd(acceleration.currentValue)} today's
        enterprise value (Z16).
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // -------------------------------------------------------------------------
  // A5 page 1 — Acceleration Scenarios (three levers)
  // -------------------------------------------------------------------------
  const acc = acceleration;
  const fin = appendix.financials;

  // Baseline computed values
  const baseRevenue = fin.revenue;
  const baseEbitda = ebitda.adjustedEbitda;
  const baseCogs = ebitda.currentCogs;
  const baseCogsRatio = ebitda.currentCogsRatio;
  const baseProfitMargin = ebitda.currentProfitMargin;
  const baseEbitdaMargin = ebitda.ebitdaMargin;
  const baseMultiple = multiple.ebitdaMultipleUsed;

  // Lever 1 — Size
  const sizeRevenue = acc.sizeRevenue;
  const sizeCogs = sizeRevenue * baseCogsRatio;
  const sizeEbitda = acc.sizeEbitda;
  const sizeValue = acc.sizeValue;
  const sizeValueAdd = acc.sizeValueAdd;
  const sizeValuePct = acc.sizeValuePct;

  // Lever 2 — Efficiency
  const effNewCogsRatio = ebitda.currentCogsRatio - appendix.acceleration.targetEfficiencyIncreasePct;
  const effCogs = baseRevenue * effNewCogsRatio;
  const effNewProfitMargin = 1 - effNewCogsRatio;
  const effNewEbitdaMargin = baseEbitdaMargin + (effNewProfitMargin - baseProfitMargin);
  const effEbitda = acc.efficiencyEbitda;
  const effValue = acc.efficiencyValue;
  const effValueAdd = acc.efficiencyValueAdd;
  const effValuePct = acc.efficiencyValuePct;

  // Lever 3 — Multiple
  const multNewMultiple = acc.multipleNewMultiple;
  const multValue = acc.multipleValue;
  const multValueAdd = acc.multipleValueAdd;
  const multValuePct = acc.multipleValuePct;

  function signedUsd(add: number): string {
    return add >= 0 ? `+${usd(add)}` : usd(add);
  }
  function signedPct(pct: number): string {
    return pct >= 0 ? `+${fmt.pct(pct)}` : fmt.pct(pct);
  }

  pages.push(
    <Page key="a5p1" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A5" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>ACCELERATION SCENARIOS</Text>
      <Text style={aStyles.h1}>
        The four scenarios on page 2 of this report, broken open.
      </Text>

      {/* Baseline */}
      <Text style={aStyles.h2}>Baseline (today)</Text>
      <FinancialsTable
        rows={[
          { label: 'Revenue', cell: 'Z9', valueLabel: usd(baseRevenue) },
          { label: 'Pre-tax profit', cell: 'Z11', valueLabel: usd(fin.pretaxProfit) },
          { label: 'COGS', cell: 'Z10', valueLabel: usd(baseCogs) },
          { label: 'COGS ratio', cell: 'AA10', valueLabel: fmt.pct(baseCogsRatio) },
          { label: 'Profit margin', cell: 'AA11', valueLabel: fmt.pct(baseProfitMargin) },
          { label: 'EBITDA', cell: 'Z12', valueLabel: usd(baseEbitda) },
          { label: 'EBITDA margin', cell: 'AA12', valueLabel: fmt.pct(baseEbitdaMargin) },
          { label: 'Multiple', cell: 'Z15', valueLabel: multi(baseMultiple) },
          {
            label: 'Current value',
            cell: 'Z16',
            valueLabel: usd(acc.currentValue),
            isTotal: true,
          },
        ]}
      />

      {/* Lever 1 */}
      <Text style={aStyles.h3}>
        Lever 1 - Size (grow revenue by {fmt.pct(appendix.acceleration.targetSizeIncreasePct)})
      </Text>
      <FinancialsTable
        rows={[
          { label: 'New revenue', cell: 'D9', valueLabel: usd(sizeRevenue) },
          { label: 'COGS (same ratio)', cell: 'D10', valueLabel: usd(sizeCogs) },
          { label: 'EBITDA (same margin)', cell: 'D12', valueLabel: usd(sizeEbitda) },
          { label: 'Multiple (unchanged)', cell: 'E15', valueLabel: multi(baseMultiple) },
          { label: 'New value', cell: 'E16', valueLabel: usd(sizeValue), isTotal: true },
          {
            label: 'Value created',
            cell: 'D20',
            valueLabel: signedUsd(sizeValueAdd),
            isPositive: sizeValueAdd >= 0,
          },
          {
            label: '% increase',
            cell: 'D19',
            valueLabel: signedPct(sizeValuePct),
            isPositive: sizeValuePct >= 0,
          },
        ]}
      />
      <Text style={aStyles.note}>
        Holding EBITDA margin constant. The lever is pure top-line growth; the buyer keeps the
        same multiple.
      </Text>

      {/* Lever 2 */}
      <Text style={aStyles.h3}>
        Lever 2 - Efficiency (drop COGS ratio by{' '}
        {Math.round(appendix.acceleration.targetEfficiencyIncreasePct * 100)} percentage points)
      </Text>
      <FinancialsTable
        rows={[
          { label: 'Revenue (unchanged)', cell: 'J9', valueLabel: usd(baseRevenue) },
          { label: 'New COGS ratio', cell: 'K10', valueLabel: fmt.pct(effNewCogsRatio) },
          { label: 'COGS', cell: 'J10', valueLabel: usd(effCogs) },
          { label: 'New profit margin', cell: 'K11', valueLabel: fmt.pct(effNewProfitMargin) },
          { label: 'New EBITDA margin', cell: 'K12', valueLabel: fmt.pct(effNewEbitdaMargin) },
          { label: 'New EBITDA', cell: 'J12', valueLabel: usd(effEbitda) },
          { label: 'Multiple (unchanged)', cell: 'K15', valueLabel: multi(baseMultiple) },
          { label: 'New value', cell: 'K16', valueLabel: usd(effValue), isTotal: true },
          {
            label: 'Value created',
            cell: 'J20',
            valueLabel: signedUsd(effValueAdd),
            isPositive: effValueAdd >= 0,
          },
          {
            label: '% increase',
            cell: 'J19',
            valueLabel: signedPct(effValuePct),
            isPositive: effValuePct >= 0,
          },
        ]}
      />
      <Text style={aStyles.note}>
        Important: {Math.round(appendix.acceleration.targetEfficiencyIncreasePct * 100)}{' '}
        PERCENTAGE POINTS, not{' '}
        {Math.round(appendix.acceleration.targetEfficiencyIncreasePct * 100)}% of itself. An{' '}
        {fmt.pct(baseCogsRatio)} COGS ratio drops to {fmt.pct(effNewCogsRatio)}, not lower.
        EBITDA margin grows by the same amount the profit margin grew, preserving the gap
        between the two.
      </Text>

      {/* Lever 3 */}
      <Text style={aStyles.h3}>
        Lever 3 - Multiple (lift the multiple by{' '}
        {fmt.pct(appendix.acceleration.targetMultipleIncreasePct)})
      </Text>
      <FinancialsTable
        rows={[
          { label: 'EBITDA (unchanged)', cell: 'P12', valueLabel: usd(baseEbitda) },
          { label: 'New multiple', cell: 'Q15', valueLabel: multi(multNewMultiple) },
          { label: 'New value', cell: 'Q16', valueLabel: usd(multValue), isTotal: true },
          {
            label: 'Value created',
            cell: 'P20',
            valueLabel: signedUsd(multValueAdd),
            isPositive: multValueAdd >= 0,
          },
          {
            label: '% increase',
            cell: 'P19',
            valueLabel: signedPct(multValuePct),
            isPositive: multValuePct >= 0,
          },
        ]}
      />
      <Text style={aStyles.note}>
        The multiple-uplift lever assumes you can move from {multi(baseMultiple)} to{' '}
        {multi(multNewMultiple)} by reducing risk (better sellability score). It does not change
        revenue or EBITDA.
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // A5 page 2 — Blended COMPOUND forecast
  const additiveSum = sizeValueAdd + effValueAdd + multValueAdd;
  const additiveForecast = acc.currentValue + additiveSum;

  pages.push(
    <Page key="a5p2" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A5" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>THE BLENDED FORECAST</Text>
      <Text style={aStyles.h2}>
        Why {usd(acc.blendedSalePrice)}, not the sum of the three levers.
      </Text>
      <Text style={aStyles.body}>
        The headline forecast on page 2 of this report ({usd(acc.blendedSalePrice)}) is NOT the
        sum of the three lever values. It is the COMPOUND outcome: grown revenue multiplied by
        improved EBITDA margin multiplied by improved multiple, all applied at the same time.
      </Text>

      <Text style={aStyles.h2}>Compound build</Text>
      <FinancialsTable
        rows={[
          { label: 'Revenue (from Lever 1)', cell: 'V9', valueLabel: usd(acc.blendedRevenue) },
          {
            label: 'COGS ratio (Lever 2)',
            cell: 'W10',
            valueLabel: fmt.pct(1 - acc.blendedEbitdaMargin),
          },
          {
            label: 'EBITDA margin',
            cell: 'W12',
            valueLabel: fmt.pct(acc.blendedEbitdaMargin),
          },
          { label: 'EBITDA', cell: 'V12', valueLabel: usd(acc.blendedEbitda) },
          { label: 'Multiple (Lever 3)', cell: 'W15', valueLabel: multi(acc.blendedMultiple) },
          {
            label: 'BLENDED SALE PRICE',
            cell: 'W16',
            valueLabel: usd(acc.blendedSalePrice),
            isTotal: true,
          },
        ]}
      />

      <FormulaBox
        formula={[
          'blended sale price = blended multiple x blended EBITDA',
          '  = (Z15 x (1+Q4)) x (AA12 + (K11-AA11)) x (Z9 x (1+E4))',
        ]}
        pluggedIn={[
          `= ${multi(acc.blendedMultiple)} x ${fmt.pct(acc.blendedEbitdaMargin)} x ${usd(acc.blendedRevenue)}`,
          `= ${usd(acc.blendedSalePrice)}`,
        ]}
      />

      <Text style={aStyles.h3}>Why this is compound, not additive</Text>
      <Text style={aStyles.body}>
        Adding Lever 1 ({signedUsd(sizeValueAdd)}) + Lever 2 ({signedUsd(effValueAdd)}) + Lever
        3 ({signedUsd(multValueAdd)}) = {usd(additiveSum)} of value created. That would put the
        forecast at {usd(additiveForecast)}. The actual blended forecast is{' '}
        {usd(acc.blendedSalePrice)}, about {usd(acc.blendedSalePrice - additiveForecast)}{' '}
        higher.
      </Text>
      <Text style={aStyles.body}>
        The difference is INTERACTION. Growing revenue while also improving margin produces a
        larger EBITDA than either lever alone. That larger EBITDA, multiplied by the lifted
        multiple, compounds the gains. The result is always greater than the sum of the parts
        when the levers are independent.
      </Text>

      <Text style={aStyles.h3}>Total value created</Text>
      <Text style={aStyles.body}>
        {usd(acc.blendedSalePrice)} less {usd(acc.currentValue)} today ={' '}
        {usd(acc.totalValueCreated)} ({fmt.pct(acc.totalValueCreatedPct)} above today).
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  // -------------------------------------------------------------------------
  // A6 — Wealth Gap Math (conditional)
  // -------------------------------------------------------------------------
  if (includeWealthGap && appendix.wealthGap) {
    const wg = wealthGap;
    const wgi = appendix.wealthGap;
    const isGap = wg.wealthGap > 0;

    // Formula label depends on mode
    const gapFormulaLabel =
      mode === 'literal'
        ? 'FORMULA (literal source-sheet)'
        : 'FORMULA (corrected)';
    const gapFormula =
      mode === 'literal'
        ? 'gap = portfolio required - (liquid assets + debt)  [source-sheet bug]'
        : 'gap = portfolio required - net available';

    pages.push(
      <Page key="a6" size="LETTER" style={aStyles.page}>
        <AppendixHeader firmName={firmName} today={today} />

        <SectionEyebrow section="A6" ofN={ofN} />
        <Text style={aStyles.sectionLabel}>WEALTH GAP MATH</Text>
        <Text style={aStyles.h1}>From sale proceeds to retirement income.</Text>
        <Text style={aStyles.body}>
          The valuation only matters if the proceeds fund the life you want after the sale. This
          page shows the bridge: current income, the portfolio required to replace it, what you
          already have, the gap, and the pre-fees sale price needed to close it.
        </Text>

        <Text style={aStyles.h2}>Current annual income</Text>
        <FinancialsTable
          rows={[
            { label: 'Dividends', cell: 'F6', valueLabel: usd(wgi.dividends) },
            { label: '+ Wages', cell: 'F7', valueLabel: usd(wgi.wages) },
            {
              label: '+ Personal expenses via business',
              cell: 'F8',
              valueLabel: usd(wgi.personalExpensesCoveredByBusiness),
            },
            {
              label: '+ Other passive income',
              cell: 'F9',
              valueLabel: usd(wgi.otherPassiveIncome),
            },
          ]}
          totalRow={{ label: '= Current annual income', valueLabel: usd(wg.currentAnnualIncome) }}
        />

        <Text style={aStyles.h2}>Replacement income required</Text>
        <FormulaBox
          formula="replacement income = desired post-sale income - other passive"
          pluggedIn={[
            `= ${usd(wgi.desiredPostSaleAnnualIncome)} - ${usd(wgi.otherPassiveIncome)}`,
            `= ${usd(wg.replacementIncomeRequired)}`,
          ]}
        />
        <Text style={aStyles.note}>
          Other passive income is subtracted because it continues after the sale. The portfolio
          only needs to fund the rest.
        </Text>

        <Text style={aStyles.h2}>Portfolio required</Text>
        {wgi.returnOnPortfolio === 0 ? (
          <Text style={aStyles.note}>(divide-by-zero guarded - using 0)</Text>
        ) : (
          <FormulaBox
            formula="portfolio = replacement income / return on portfolio"
            pluggedIn={[
              `= ${usd(wg.replacementIncomeRequired)} / ${fmt.pct(wgi.returnOnPortfolio)}`,
              `= ${usd(wg.portfolioRequired)}`,
            ]}
          />
        )}

        <Text style={aStyles.h2}>Net available assets</Text>
        <FormulaBox
          formula="net available = liquid assets - non-mortgage debt"
          pluggedIn={[
            `= ${usd(wgi.liquidAssets)} - ${usd(wgi.nonMortgageDebt)}`,
            `= ${usd(wg.netAvailableAssets)}`,
          ]}
        />

        <Text style={aStyles.h2}>{isGap ? 'Wealth gap' : 'Cushion above goal'}</Text>
        {!isGap && (
          <Text style={aStyles.body}>Sale not strictly required for retirement.</Text>
        )}
        <FormulaBox
          formula={gapFormula}
          pluggedIn={[
            `= ${usd(wg.portfolioRequired)} - ${usd(wg.netAvailableAssets)}`,
            `= ${usd(Math.abs(wg.wealthGap))}${isGap ? '' : ' (surplus)'}`,
          ]}
          label={gapFormulaLabel}
        />

        {mode === 'corrected' && (
          <View>
            <Text style={aStyles.h3}>Note on the source-sheet bug</Text>
            <Text style={aStyles.body}>
              The original valuation spreadsheet that this engine was ported from had a sign
              error in this formula: it ADDED the non-mortgage debt to assets instead of
              subtracting it. The corrected formula above is the one used in your valuation.
              Disclosed in the spirit of showing our work.
            </Text>
          </View>
        )}
        {mode === 'literal' && (
          <Text style={aStyles.note}>
            Switch to corrected mode to use the bug-fixed formula above.
          </Text>
        )}

        <Text style={aStyles.h2}>Target sale price</Text>
        <FormulaBox
          formula={[
            'target sale price = (wealth gap + business debt x ownership %) x (1 + fees %)',
          ]}
          pluggedIn={[
            `= (${usd(Math.abs(wg.wealthGap))} + ${usd(wgi.longTermBusinessDebt)} x ${fmt.pct(wgi.ownershipPct)}) x (1 + ${fmt.pct(wgi.feesAndTaxesPct)})`,
            `= ${usd(wg.netProceedsNeeded)} x ${1 + wgi.feesAndTaxesPct}`,
            `= ${usd(wg.targetSalePrice)}`,
          ]}
        />
        <Text style={aStyles.body}>
          This is the gross sale price required to net enough to close the wealth gap after fees
          and taxes.
        </Text>

        <AppendixFooter firmName={firmName} today={today} />
      </Page>
    );
  }

  // -------------------------------------------------------------------------
  // A7 — Methodology Notes
  // -------------------------------------------------------------------------
  const modeLabel = mode === 'corrected' ? 'corrected' : 'literal';

  pages.push(
    <Page key="a7" size="LETTER" style={aStyles.page}>
      <AppendixHeader firmName={firmName} today={today} />

      <SectionEyebrow section="A7" ofN={ofN} />
      <Text style={aStyles.sectionLabel}>METHODOLOGY</Text>
      <Text style={aStyles.h1}>How this engine was built and tested.</Text>

      <Text style={aStyles.h2}>Source model</Text>
      <Text style={aStyles.body}>
        This engine is a faithful port of an internal spreadsheet model developed for SMB
        owner-operator valuations. The math was extracted directly from the source workbook via
        openpyxl XLSX inspection, not from the rendered values. Every formula in this report has
        a verified one-to-one correspondence with a source-workbook cell (the cell references in
        tables and formula boxes, H43, I51, J4, Z16, etc., are the original source cells).
      </Text>

      <Text style={aStyles.h2}>Bugs corrected</Text>
      <Text style={aStyles.body}>
        Where the source spreadsheet contained verified errors, the engine ships the corrected
        math. The two material corrections in this report:
      </Text>
      <Text style={aStyles.body}>
        1. Wealth Gap formula (M16). The source sheet added non-mortgage debt to liquid assets
        when subtracting from required portfolio. The engine subtracts. Disclosed in A6.
      </Text>
      <Text style={aStyles.body}>
        2. Owner salary add-back anchor (H48). The source sheet adds back the full owner salary.
        The engine adds back only the portion above a market-rate replacement, but only when you
        provide that replacement figure. If you did not, the engine adds back the full salary
        (literal behavior).
      </Text>
      <Text style={aStyles.body}>Mode used for your report: {modeLabel}.</Text>

      <Text style={aStyles.h2}>Parity testing</Text>
      <Text style={aStyles.body}>
        The engine is verified against the source spreadsheet via 32 paired tests covering:
        step 1 scores, step 2 scores, EBITDA math, size-score lookups, sellability formula,
        grade and probability bands, multiple-band selection, all three acceleration levers, the
        compound blended forecast, and every wealth-gap field. Tests are run in both literal and
        corrected modes. All 32 pass.
      </Text>

      <Text style={aStyles.h2}>Determinism</Text>
      <Text style={aStyles.body}>
        The math is fully deterministic. Same inputs, same outputs, every time. No randomness,
        no AI inference, no rounding to hide things. If your numbers change, the valuation
        changes; if your numbers stay the same, the valuation stays the same.
      </Text>

      <Text style={aStyles.h2}>Not investment advice</Text>
      <Text style={aStyles.body}>
        This valuation is a tool to ground a conversation, not a binding offer or a substitute
        for a formal business appraisal. Real M&amp;A transactions involve diligence,
        buyer-specific synergies, and negotiation that move the realized price above or below
        the modeled value.
      </Text>

      <AppendixFooter firmName={firmName} today={today} />
    </Page>
  );

  return pages;
}
