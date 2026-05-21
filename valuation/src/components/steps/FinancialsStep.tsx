import type { FinancialInputs } from '../../engine';
import { Input } from '../ui/Input';
import { SectionLabel } from '../ui/Card';

interface Props {
  financials: FinancialInputs;
  onChange: (patch: Partial<FinancialInputs>) => void;
}

const FIELD = (label: string, key: keyof FinancialInputs, helper?: string) => ({
  label,
  key,
  helper,
});

const FIELDS = [
  FIELD('Top-line revenue (last full year)', 'revenue'),
  FIELD('Pre-tax profit (last full year)', 'pretaxProfit'),
  FIELD('Amortization & depreciation', 'amortizationDepreciation'),
  FIELD('Long-term interest expense', 'longTermInterest'),
  FIELD('Discretionary owner spending (one-time)', 'discretionarySpending'),
  FIELD(
    'Owner salary (W-2 + guaranteed payments)',
    'ownerSalary',
    'Full amount paid to you. We will ask for the market-rate replacement below.',
  ),
  FIELD(
    'Market-rate replacement salary',
    'marketRateReplacementSalary',
    'What it would cost to hire a managing partner to replace you. Only the delta between this and the line above gets added back to EBITDA.',
  ),
  FIELD('Rent paid to self / holding company', 'rentToSelf'),
];

const moneyOnChange =
  (k: keyof FinancialInputs, onChange: (p: Partial<FinancialInputs>) => void) =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    onChange({ [k]: raw === '' ? 0 : Number(raw) });
  };

export function FinancialsStep({ financials, onChange }: Props) {
  return (
    <div>
      <SectionLabel className="mb-3">Step 2 of 5</SectionLabel>
      <h2 className="font-display text-display-lg mb-3">Your numbers.</h2>
      <p className="text-someday-slate-mid mb-8">
        Last full fiscal year. Round to the nearest thousand. We compute adjusted EBITDA from these
        six lines, plus the salary normalization below.
      </p>

      <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            prefix="$"
            inputMode="decimal"
            value={(financials[f.key] ?? 0) === 0 ? '' : String(financials[f.key])}
            onChange={moneyOnChange(f.key, onChange)}
            helperText={f.helper}
            placeholder="0"
          />
        ))}
      </div>
    </div>
  );
}
