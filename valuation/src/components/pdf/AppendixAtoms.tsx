/**
 * AppendixAtoms — reusable building blocks for the math appendix pages.
 *
 * All brand tokens match ValuationReport.tsx exactly. Fonts: Times-Roman, Helvetica, Courier.
 * No em-dashes, no arrow glyphs (they are not in Helvetica WinAnsi).
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer';
import type { QuestionTrace } from '../../engine';

// ---------------------------------------------------------------------------
// Brand color tokens (mirrors ValuationReport.tsx C object)
// ---------------------------------------------------------------------------
export const C = {
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
} as const;

// ---------------------------------------------------------------------------
// Shared appendix stylesheet
// ---------------------------------------------------------------------------
export const aStyles = StyleSheet.create({
  // Page-level (matches s.page in ValuationReport.tsx)
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.slate,
    backgroundColor: C.creamLight,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 48,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
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
  // Footer
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
  // Typography
  appendixPageLabel: {
    fontSize: 7,
    color: C.slateMuted,
    letterSpacing: 2,
    marginBottom: 4,
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
    fontSize: 28,
    color: C.forest,
    fontWeight: 600,
    marginBottom: 10,
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: 'Times-Roman',
    fontSize: 16,
    color: C.forest,
    fontWeight: 600,
    marginBottom: 6,
    marginTop: 12,
  },
  h3: {
    fontFamily: 'Times-Roman',
    fontSize: 12,
    color: C.forest,
    fontWeight: 600,
    marginBottom: 4,
    marginTop: 8,
  },
  body: {
    fontSize: 9,
    color: C.slateMid,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  note: {
    fontSize: 8,
    color: C.slateMid,
    lineHeight: 1.45,
    marginTop: 4,
    marginBottom: 6,
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 8.5,
    color: C.slate,
  },
  // Generic table
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    paddingVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.forest,
    paddingVertical: 4,
  },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: C.forest,
    paddingVertical: 5,
  },
  divider: {
    height: 1,
    backgroundColor: C.hairline,
    marginVertical: 10,
  },
});

// ---------------------------------------------------------------------------
// Helper: truncate with ellipsis
// ---------------------------------------------------------------------------
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

// ---------------------------------------------------------------------------
// SectionEyebrow — "APPENDIX A2 OF 7"
// ---------------------------------------------------------------------------
interface SectionEyebrowProps {
  section: string;
  ofN: number;
}
export function SectionEyebrow({ section, ofN }: SectionEyebrowProps) {
  return (
    <Text style={aStyles.appendixPageLabel}>
      {`APPENDIX ${section} OF ${ofN}`}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// AppendixHeader — reuses ValuationReport.tsx header convention
// ---------------------------------------------------------------------------
interface AppendixHeaderProps {
  firmName: string;
  today: string;
}
export function AppendixHeader({ firmName, today }: AppendixHeaderProps) {
  return (
    <View style={aStyles.header}>
      <View>
        <Text style={aStyles.brand}>Someday Consultants</Text>
        <Text style={aStyles.brandTag}>SELL-SIDE M&amp;A ADVISORY</Text>
      </View>
      <Text style={aStyles.headerMeta}>{firmName} {today}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AppendixFooter
// ---------------------------------------------------------------------------
interface AppendixFooterProps {
  firmName: string;
  today: string;
}
export function AppendixFooter({ firmName, today }: AppendixFooterProps) {
  return (
    <Text style={aStyles.footer}>
      {firmName} prepared by Someday Consultants {today}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// FormulaBox — cream-bordered box with FORMULA / THIS FIRM slots
// ---------------------------------------------------------------------------
interface FormulaBoxProps {
  formula: string | string[];
  pluggedIn: string | string[];
  label?: string; // Override "THIS FIRM" label (for literal-mode flag)
}
export function FormulaBox({ formula, pluggedIn, label = 'THIS FIRM' }: FormulaBoxProps) {
  const formulaLines = Array.isArray(formula) ? formula : [formula];
  const pluggedLines = Array.isArray(pluggedIn) ? pluggedIn : [pluggedIn];

  return (
    <View
      wrap={false}
      style={{
        padding: 10,
        borderWidth: 0.5,
        borderColor: C.hairline,
        backgroundColor: C.cream,
        marginVertical: 8,
      }}
    >
      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: 7,
          color: C.gold,
          letterSpacing: 1,
          marginBottom: 3,
        }}
      >
        FORMULA
      </Text>
      {formulaLines.map((line, i) => (
        <Text key={i} style={aStyles.mono}>
          {'  '}{line}
        </Text>
      ))}
      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: 7,
          color: C.gold,
          letterSpacing: 1,
          marginTop: 6,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      {pluggedLines.map((line, i) => (
        <Text key={i} style={aStyles.mono}>
          {'  '}{line}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// QuestionScoringTable — 7-column scoring table (A1 + A2)
// ---------------------------------------------------------------------------
interface QuestionScoringTableProps {
  questions: QuestionTrace[];
  totalLabel: string;
  totalContribution: number;
  totalMax: number;
}
export function QuestionScoringTable({
  questions,
  totalLabel,
  totalContribution,
  totalMax,
}: QuestionScoringTableProps) {
  const colWidths = {
    prompt: '38%',
    cell: '7%',
    weight: '7%',
    answer: '22%',
    raw: '8%',
    contribution: '9%',
    max: '9%',
  } as const;

  const headerStyle = {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.gold,
    letterSpacing: 1,
  };

  const bodyStyle = {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.slate,
  };

  const totalStyle = {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.forest,
  };

  return (
    <View>
      {/* Header */}
      <View style={aStyles.tableHeaderRow}>
        <Text style={[{ width: colWidths.prompt }, headerStyle]}>Question</Text>
        <Text style={[{ width: colWidths.cell }, headerStyle]}>Cell</Text>
        <Text style={[{ width: colWidths.weight, textAlign: 'right' }, headerStyle]}>G</Text>
        <Text style={[{ width: colWidths.answer }, headerStyle]}>  Answer</Text>
        <Text style={[{ width: colWidths.raw, textAlign: 'right' }, headerStyle]}>Raw</Text>
        <Text style={[{ width: colWidths.contribution, textAlign: 'right' }, headerStyle]}>Contrib</Text>
        <Text style={[{ width: colWidths.max, textAlign: 'right' }, headerStyle]}>Max</Text>
      </View>

      {/* Body rows */}
      {questions.map((q) => {
        const answerDisplay = q.trackingOnly
          ? truncate(q.answerLabel, 45) + ' (tracking)'
          : truncate(q.answerLabel, 50);

        return (
          <View key={q.id} wrap={false} style={aStyles.tableRow}>
            <Text style={[{ width: colWidths.prompt }, bodyStyle]}>{truncate(q.prompt, 90)}</Text>
            <Text style={[{ width: colWidths.cell, fontFamily: 'Courier', fontSize: 7.5, color: C.slateMid }, bodyStyle]}>{q.cell}</Text>
            <Text style={[{ width: colWidths.weight, textAlign: 'right' }, bodyStyle]}>{q.weight_G}</Text>
            <Text style={[{ width: colWidths.answer, paddingLeft: 4 }, bodyStyle]}>{answerDisplay}</Text>
            <Text style={[{ width: colWidths.raw, textAlign: 'right' }, bodyStyle]}>{q.rawScore}</Text>
            <Text style={[{ width: colWidths.contribution, textAlign: 'right' }, bodyStyle]}>{q.contribution}</Text>
            <Text style={[{ width: colWidths.max, textAlign: 'right' }, bodyStyle]}>{q.maxPossible}</Text>
          </View>
        );
      })}

      {/* Total row */}
      <View wrap={false} style={aStyles.tableTotalRow}>
        <Text style={[{ flex: 1 }, totalStyle]}>{totalLabel}</Text>
        <Text style={[{ width: colWidths.contribution, textAlign: 'right' }, totalStyle]}>
          {totalContribution}
        </Text>
        <Text style={[{ width: colWidths.max, textAlign: 'right' }, totalStyle]}>
          {totalMax}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FinancialsTable — 3-column table: label | cell | value (right-aligned)
// ---------------------------------------------------------------------------
export interface FinancialsTableRow {
  label: string;
  cell: string;
  valueLabel: string;
  isTotal?: boolean;
  isPositive?: boolean; // for "+" prefix coloring (gold)
}

interface FinancialsTableProps {
  rows: FinancialsTableRow[];
  totalRow?: { label: string; valueLabel: string };
}

export function FinancialsTable({ rows, totalRow }: FinancialsTableProps) {
  const labelStyle = {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.slate,
    flex: 1,
  };
  const cellStyle = {
    fontFamily: 'Courier',
    fontSize: 7.5,
    color: C.slateMuted,
    width: 40,
    paddingHorizontal: 2,
  };
  const valueStyle = {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.slate,
    width: 100,
    textAlign: 'right' as const,
  };
  const totalLabelStyle = {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: C.forest,
    flex: 1,
  };
  const totalValueStyle = {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: C.forest,
    width: 100,
    textAlign: 'right' as const,
  };

  return (
    <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 6 }}>
      {rows.map((row, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: C.hairline,
            backgroundColor: row.isTotal ? C.cream : 'transparent',
          }}
        >
          <Text style={row.isTotal ? totalLabelStyle : labelStyle}>{row.label}</Text>
          <Text style={cellStyle}>{row.cell}</Text>
          <Text
            style={
              row.isTotal
                ? totalValueStyle
                : row.isPositive
                ? { ...valueStyle, color: C.gold }
                : valueStyle
            }
          >
            {row.valueLabel}
          </Text>
        </View>
      ))}
      {totalRow && (
        <View
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 5,
            paddingHorizontal: 8,
            borderTopWidth: 0.5,
            borderTopColor: C.forest,
            backgroundColor: C.cream,
          }}
        >
          <Text style={totalLabelStyle}>{totalRow.label}</Text>
          <Text style={{ width: 40 }} />
          <Text style={totalValueStyle}>{totalRow.valueLabel}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TwoColTable — simple 2-column label/value table (used in A4 settings)
// ---------------------------------------------------------------------------
export interface TwoColRow {
  label: string;
  value: string;
}
interface TwoColTableProps {
  rows: TwoColRow[];
}
export function TwoColTable({ rows }: TwoColTableProps) {
  return (
    <View style={{ borderWidth: 0.5, borderColor: C.hairline, marginVertical: 6 }}>
      {rows.map((row, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderBottomWidth: i < rows.length - 1 ? 0.5 : 0,
            borderBottomColor: C.hairline,
          }}
        >
          <Text style={{ fontFamily: 'Helvetica', fontSize: 8.5, color: C.slate, flex: 1 }}>
            {row.label}
          </Text>
          <Text style={{ fontFamily: 'Helvetica', fontSize: 8.5, color: C.slateMid, textAlign: 'right' }}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
