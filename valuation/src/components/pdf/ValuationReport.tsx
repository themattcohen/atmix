/**
 * Valuation PDF report — @react-pdf/renderer document.
 *
 * Brand tokens copied from tailwind.config.js (forest / cream / gold + Cormorant + Inter).
 * Generated client-side as a Blob, attached to the owner's confirmation email via Resend.
 */

import {
  Document,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
  Rect,
} from '@react-pdf/renderer';
import type { EngineOutput } from '../../engine';
import { fmt } from '../../lib/format';
import { AppendixPages } from './AppendixPages';
import type { AppendixTrace } from '../../engine';

// Font registration is deferred to lib/pdf.tsx (runs once on import).
// PDF uses serif (display) and helvetica (body) as Cormorant + Inter approximations.

const C = {
  forest: '#1D3A28',
  forestLight: '#2D5040',
  cream: '#F5F0E8',
  creamLight: '#FAFAF7',
  gold: '#B8972E',
  goldLight: '#D4B850',
  slate: '#2E2E2E',
  slateMid: '#5A5A5A',
  slateMuted: '#8A8A8A',
  hairline: '#E5DDC9',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.slate,
    backgroundColor: C.creamLight,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  brand: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    color: C.forest,
    fontWeight: 600,
  },
  brandTag: {
    fontSize: 7,
    color: C.slateMid,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: C.slateMuted,
    textAlign: 'right',
  },
  sectionLabel: {
    fontSize: 8,
    color: C.gold,
    letterSpacing: 2,
    fontWeight: 700,
    marginBottom: 8,
  },
  h1: {
    fontFamily: 'Times-Roman',
    fontSize: 32,
    color: C.forest,
    marginBottom: 12,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: 'Times-Roman',
    fontSize: 20,
    color: C.forest,
    marginBottom: 8,
    fontWeight: 600,
  },
  h3: {
    fontFamily: 'Times-Roman',
    fontSize: 14,
    color: C.forest,
    marginBottom: 4,
    fontWeight: 600,
  },
  body: {
    fontSize: 10,
    color: C.slateMid,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 28,
  },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 3,
    padding: 14,
    backgroundColor: C.cream,
  },
  kpiLabel: {
    fontSize: 8,
    color: C.slateMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  kpiValue: {
    fontFamily: 'Times-Roman',
    fontSize: 22,
    color: C.forest,
    fontWeight: 600,
  },
  kpiSub: {
    fontSize: 8,
    color: C.slateMid,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: C.hairline,
    marginVertical: 18,
  },
  chartContainer: {
    marginVertical: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    marginTop: 8,
    marginBottom: 8,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  scenarioLabel: { fontSize: 10, color: C.slate, width: 140 },
  scenarioBar: { height: 16, marginHorizontal: 4 },
  scenarioValue: { fontSize: 10, color: C.forest, fontWeight: 600, width: 90, textAlign: 'right' },
  scenarioDelta: { fontSize: 9, color: C.gold, width: 90, textAlign: 'right' },
  cover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
    backgroundColor: C.cream,
  },
  coverLabel: {
    fontSize: 9,
    color: C.gold,
    letterSpacing: 3,
    fontWeight: 700,
    marginBottom: 24,
  },
  coverTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 40,
    color: C.forest,
    textAlign: 'center',
    fontWeight: 600,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  coverSub: {
    fontSize: 12,
    color: C.slateMid,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 1.5,
    marginBottom: 60,
  },
  coverHeadlineWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.gold,
    paddingVertical: 24,
    paddingHorizontal: 40,
    marginTop: 20,
  },
  coverHeadlineLabel: {
    fontSize: 8,
    color: C.slateMid,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverHeadlineValue: {
    fontFamily: 'Times-Roman',
    fontSize: 36,
    color: C.gold,
    textAlign: 'center',
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: C.slateMuted,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    paddingTop: 8,
  },
  contactCard: {
    marginTop: 20,
    padding: 20,
    backgroundColor: C.forest,
    borderRadius: 3,
    color: C.creamLight,
  },
  contactLabel: { fontSize: 8, color: C.goldLight, letterSpacing: 2, marginBottom: 6 },
  contactTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    color: C.creamLight,
    marginBottom: 8,
    fontWeight: 600,
  },
  contactBody: { fontSize: 10, color: C.creamLight, lineHeight: 1.5 },
  twoCol: { flexDirection: 'row', gap: 24 },
  col: { flex: 1 },
  inlineGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  inlineLabel: { fontSize: 8, color: C.slateMuted, letterSpacing: 1 },
  inlineValue: { fontSize: 11, color: C.forest, fontFamily: 'Times-Roman', fontWeight: 600 },
});

interface Props {
  firmName: string;
  city?: string;
  outputs: EngineOutput;
  includeWealthGap: boolean;
  contact?: { matt?: { name: string; email: string; calendly?: string } };
}

function ScenarioBar({
  label,
  value,
  delta,
  maxValue,
  highlight,
}: {
  label: string;
  value: number;
  delta?: number;
  maxValue: number;
  highlight?: boolean;
}) {
  const widthPct = maxValue > 0 ? Math.max(0.02, value / maxValue) : 0;
  return (
    <View style={s.scenarioRow}>
      <Text style={s.scenarioLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={[
            s.scenarioBar,
            {
              width: `${widthPct * 100}%`,
              backgroundColor: highlight ? C.forest : C.gold,
              borderRadius: 2,
            },
          ]}
        />
      </View>
      <Text style={s.scenarioValue}>{fmt.usd(value)}</Text>
      <Text style={s.scenarioDelta}>{delta !== undefined ? `+${fmt.usd(delta)}` : ''}</Text>
    </View>
  );
}

export function ValuationReport({ firmName, city, outputs, includeWealthGap, contact }: Props) {
  const { acceleration, sellability, ebitda, multiple, wealthGap } = outputs;
  const maxScenario = Math.max(
    acceleration.currentValue,
    acceleration.sizeValue,
    acceleration.efficiencyValue,
    acceleration.multipleValue,
    acceleration.blendedSalePrice,
  );
  const displayName = firmName.trim() || 'Your firm';
  const today = fmt.mtDate();
  const matt = contact?.matt;

  return (
    <Document title={`${displayName} Valuation`} author="Someday Consulting">
      {/* Cover page */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Someday Consulting</Text>
            <Text style={s.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
          </View>
          <Text style={s.headerMeta}>{today}</Text>
        </View>

        <View style={s.cover}>
          <Text style={s.coverLabel}>FIRM VALUATION</Text>
          <Text style={s.coverTitle}>{displayName}</Text>
          {city ? <Text style={s.coverSub}>{city}</Text> : null}
          <Text style={s.coverSub}>
            What your firm is worth today, what it could be worth with the right acceleration plan,
            and what stands between the two.
          </Text>
          <View style={s.coverHeadlineWrap}>
            <Text style={s.coverHeadlineLabel}>CURRENT VALUE</Text>
            <Text style={s.coverHeadlineValue}>{fmt.usd(acceleration.currentValue)}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          Prepared by Someday Consulting · {today} · Internal valuation, not an offer
        </Text>
      </Page>

      {/* Page 2 — Summary */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Someday Consulting</Text>
            <Text style={s.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
          </View>
          <Text style={s.headerMeta}>{displayName} · {today}</Text>
        </View>

        <Text style={s.sectionLabel}>OVERVIEW</Text>
        <Text style={s.h1}>
          Today: {fmt.usd(acceleration.currentValue)}.{'\n'}
          With work: {fmt.usd(acceleration.blendedSalePrice)}.
        </Text>
        <Text style={s.body}>
          Your firm's enterprise value is the product of two numbers: adjusted EBITDA and the
          multiple buyers will pay for it. Both are addressable, and both can be moved over a
          12-36 month horizon with the right pre-sale work.
        </Text>

        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>SELLABILITY GRADE</Text>
            <Text style={s.kpiValue}>{sellability.grade}</Text>
            <Text style={s.kpiSub}>
              {fmt.pct(sellability.sellabilityPct)} · probability {sellability.probabilityOfSale}
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>ADJUSTED EBITDA</Text>
            <Text style={s.kpiValue}>{fmt.usd(ebitda.adjustedEbitda)}</Text>
            <Text style={s.kpiSub}>
              {fmt.pct(ebitda.ebitdaMargin)} margin · {fmt.multiple(multiple.ebitdaMultipleUsed)} multiple
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>VALUE CREATED IF YOU ACT</Text>
            <Text style={[s.kpiValue, { color: C.gold }]}>
              +{fmt.usd(acceleration.totalValueCreated)}
            </Text>
            <Text style={s.kpiSub}>{fmt.pct(acceleration.totalValueCreatedPct)} above today</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>ACCELERATION SCENARIOS</Text>
        <Text style={s.h2}>Three levers, one compound outcome.</Text>
        <Text style={s.body}>
          Each row shows what a single lever does in isolation. The final "All three combined" row
          applies them compounded. That is the realistic ceiling at a sale, not a sum.
        </Text>

        <View style={s.chartContainer}>
          <ScenarioBar
            label="Today (baseline)"
            value={acceleration.currentValue}
            maxValue={maxScenario}
          />
          <ScenarioBar
            label={`Grow revenue ${fmt.pct(0.10)}`}
            value={acceleration.sizeValue}
            delta={acceleration.sizeValueAdd}
            maxValue={maxScenario}
          />
          <ScenarioBar
            label="Improve operating margins"
            value={acceleration.efficiencyValue}
            delta={acceleration.efficiencyValueAdd}
            maxValue={maxScenario}
          />
          <ScenarioBar
            label="Reduce risk, lift the multiple"
            value={acceleration.multipleValue}
            delta={acceleration.multipleValueAdd}
            maxValue={maxScenario}
          />
          <ScenarioBar
            label="All three combined"
            value={acceleration.blendedSalePrice}
            delta={acceleration.totalValueCreated}
            maxValue={maxScenario}
            highlight
          />
        </View>

        <Text style={s.footer}>
          {displayName} · Prepared by Someday Consulting · {today}
        </Text>
      </Page>

      {/* Page 3 — Sellability detail */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Someday Consulting</Text>
            <Text style={s.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
          </View>
          <Text style={s.headerMeta}>{displayName} · {today}</Text>
        </View>

        <Text style={s.sectionLabel}>SELLABILITY BREAKDOWN</Text>
        <Text style={s.h1}>Why your sellability is {sellability.grade}.</Text>
        <Text style={s.body}>
          Buyers value firms on EBITDA and multiple, but they only pay top dollar when the firm
          will actually transfer. Sellability is the score of how cleanly the firm transitions:
          governance, financials, key-person risk, client concentration, and the partner's own
          readiness.
        </Text>

        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.h3}>Owner readiness</Text>
            <View style={s.inlineGrid}>
              <Text style={s.inlineLabel}>SCORE</Text>
              <Text style={s.inlineValue}>
                {sellability.step1Score} / {sellability.step1Max}
              </Text>
            </View>
            <Text style={[s.body, { marginTop: 8 }]}>
              Exit timeline, post-sale plan, capacity to prep the firm between busy seasons, and
              partner alignment.
            </Text>
          </View>
          <View style={s.col}>
            <Text style={s.h3}>Business risk</Text>
            <View style={s.inlineGrid}>
              <Text style={s.inlineLabel}>SCORE</Text>
              <Text style={s.inlineValue}>
                {sellability.step2Score} / {sellability.step2Max}
              </Text>
            </View>
            <Text style={[s.body, { marginTop: 8 }]}>
              Financial hygiene, client concentration, advisory mix, practice management stack,
              malpractice exposure, single points of failure.
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        <Text style={s.h3}>EBITDA build</Text>
        <Text style={s.body}>
          Adjusted EBITDA is your pre-tax profit plus non-cash items, plus the portion of your
          salary above a market-rate replacement, plus rent paid to yourself, plus one-time
          discretionary spend. This is the number a buyer actually capitalizes.
        </Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>EBITDA</Text>
            <Text style={s.kpiValue}>{fmt.usd(ebitda.adjustedEbitda)}</Text>
            <Text style={s.kpiSub}>{fmt.pct(ebitda.ebitdaMargin)} of revenue</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>SIZE SCORE</Text>
            <Text style={s.kpiValue}>{sellability.sizeScore}</Text>
            <Text style={s.kpiSub}>
              Larger EBITDA bands earn premium multiples
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>MULTIPLE USED</Text>
            <Text style={s.kpiValue}>{fmt.multiple(multiple.ebitdaMultipleUsed)}</Text>
            <Text style={s.kpiSub}>Risk-adjusted band, CPA firm comps</Text>
          </View>
        </View>

        <Text style={s.footer}>
          {displayName} · Prepared by Someday Consulting · {today}
        </Text>
      </Page>

      {/* Page 4 (optional) — Wealth Gap */}
      {includeWealthGap && (
        <Page size="LETTER" style={s.page}>
          <View style={s.header}>
            <View>
              <Text style={s.brand}>Someday Consulting</Text>
              <Text style={s.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
            </View>
            <Text style={s.headerMeta}>{displayName} · {today}</Text>
          </View>

          <Text style={s.sectionLabel}>WEALTH GAP</Text>
          <Text style={s.h1}>Will the sale fund your retirement?</Text>
          <Text style={s.body}>
            The valuation only matters if the proceeds fund the life you want after the sale. This
            page bridges from the projected sale price to your post-sale income goal.
          </Text>

          <View style={s.kpiRow}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>INCOME TODAY</Text>
              <Text style={s.kpiValue}>{fmt.usd(wealthGap.currentAnnualIncome)}</Text>
              <Text style={s.kpiSub}>Total annual draw from the firm</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>PORTFOLIO NEEDED</Text>
              <Text style={s.kpiValue}>{fmt.usd(wealthGap.portfolioRequired)}</Text>
              <Text style={s.kpiSub}>To produce desired income at 7.5%</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>
                {wealthGap.wealthGap <= 0 ? 'CUSHION ABOVE GOAL' : 'GAP TO BRIDGE'}
              </Text>
              <Text style={[s.kpiValue, { color: C.gold }]}>
                {fmt.usd(Math.abs(wealthGap.wealthGap))}
              </Text>
              <Text style={s.kpiSub}>
                {wealthGap.wealthGap <= 0
                  ? 'Sale not strictly required for retirement'
                  : 'Sale must net at least this much'}
              </Text>
            </View>
          </View>

          <Text style={s.body}>
            Target sale price (gross, before fees & taxes):{' '}
            <Text style={{ color: C.forest, fontWeight: 700 }}>
              {fmt.usd(wealthGap.targetSalePrice)}
            </Text>
          </Text>

          <Text style={s.footer}>
            {displayName} · Prepared by Someday Consulting · {today}
          </Text>
        </Page>
      )}

      {/* Final page — Next steps */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Someday Consulting</Text>
            <Text style={s.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
          </View>
          <Text style={s.headerMeta}>{displayName} · {today}</Text>
        </View>

        <Text style={s.sectionLabel}>NEXT STEPS</Text>
        <Text style={s.h1}>What to do with these numbers.</Text>
        <Text style={s.body}>
          A valuation is a starting point, not a verdict. If you want to move the numbers (by
          tightening the firm, improving margins, or finding the right buyer), the next
          conversation is about how, not whether.
        </Text>

        <Svg width="100%" height="2" style={{ marginVertical: 20 }}>
          <Rect x="0" y="0" width="100%" height="1" fill={C.gold} />
        </Svg>

        <View style={s.contactCard}>
          <Text style={s.contactLabel}>WORK WITH SOMEDAY</Text>
          <Text style={s.contactTitle}>
            {matt?.name ?? 'Matt Cohen'} runs the first conversation.
          </Text>
          <Text style={s.contactBody}>
            Matt is a CPA who sold his own firm through Sara, then joined Someday. The first 15
            minutes are about whether this is the right time. About half of those calls end with
            "not yet, here is the plan to revisit in 12-24 months."{'\n\n'}
            Reach out:{' '}
            <Text style={{ color: C.goldLight, fontWeight: 600 }}>
              {matt?.email ?? 'hello@somedayconsultants.com'}
            </Text>
            {matt?.calendly ? `\nBook a call: ${matt.calendly}` : ''}
          </Text>
        </View>

        <Text style={s.body}>{'\n'}This report was generated from the numbers and answers you provided. The math is
        deterministic. Same inputs, same outputs. If your numbers change, the valuation changes.
        Run it again any time at valuation.somedayconsultants.com.</Text>

        <Text style={s.footer}>
          {displayName} · Prepared by Someday Consulting · {today}
        </Text>
      </Page>

      {/* Appendix — only rendered when engine was called with TraceContext */}
      {outputs.appendix && (
        <>
          {AppendixPages({
            firmName: displayName,
            today,
            outputs: outputs as EngineOutput & { appendix: AppendixTrace },
            includeWealthGap,
            mode: outputs.mode,
          })}
        </>
      )}
    </Document>
  );
}
