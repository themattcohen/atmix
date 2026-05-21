import type { WealthGapInputs, WealthGapOutput } from '../../engine';
import { Input } from '../ui/Input';
import { SectionLabel } from '../ui/Card';
import { fmt } from '../../lib/format';

interface Props {
  inputs: WealthGapInputs;
  output: WealthGapOutput;
  onChange: (patch: Partial<WealthGapInputs>) => void;
}

const moneyChange =
  (k: keyof WealthGapInputs, onChange: (p: Partial<WealthGapInputs>) => void) =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    onChange({ [k]: raw === '' ? 0 : Number(raw) });
  };

export function WealthGapPanel({ inputs, output, onChange }: Props) {
  const closesGap = output.wealthGap <= 0;

  return (
    <div className="card bg-someday-cream border-someday-hairline mt-8">
      <SectionLabel className="mb-2">Optional · Will this fund your retirement?</SectionLabel>
      <h3 className="font-display text-2xl text-someday-forest mb-3">
        Bridge the gap from sale proceeds to retirement income.
      </h3>
      <p className="text-someday-slate-mid mb-6 max-w-3xl">
        Tell me what you take out of the firm today and what you need post-sale. I'll show whether
        the projected sale price actually funds the lifestyle you want.
      </p>

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-5">
        <div className="space-y-5">
          <h4 className="font-display text-lg text-someday-forest">What you take today</h4>
          <Input
            label="Dividends / distributions"
            prefix="$"
            inputMode="decimal"
            value={inputs.dividends === 0 ? '' : String(inputs.dividends)}
            onChange={moneyChange('dividends', onChange)}
            placeholder="0"
          />
          <Input
            label="Wages / W-2"
            prefix="$"
            inputMode="decimal"
            value={inputs.wages === 0 ? '' : String(inputs.wages)}
            onChange={moneyChange('wages', onChange)}
            placeholder="0"
          />
          <Input
            label="Personal expenses paid by the business"
            prefix="$"
            inputMode="decimal"
            value={
              inputs.personalExpensesCoveredByBusiness === 0
                ? ''
                : String(inputs.personalExpensesCoveredByBusiness)
            }
            onChange={moneyChange('personalExpensesCoveredByBusiness', onChange)}
            placeholder="0"
          />
          <Input
            label="Other passive income (rentals, investments, etc.)"
            prefix="$"
            inputMode="decimal"
            value={inputs.otherPassiveIncome === 0 ? '' : String(inputs.otherPassiveIncome)}
            onChange={moneyChange('otherPassiveIncome', onChange)}
            placeholder="0"
          />
        </div>

        <div className="space-y-5">
          <h4 className="font-display text-lg text-someday-forest">What you need after</h4>
          <Input
            label="Desired annual income, post-sale"
            prefix="$"
            inputMode="decimal"
            value={
              inputs.desiredPostSaleAnnualIncome === 0
                ? ''
                : String(inputs.desiredPostSaleAnnualIncome)
            }
            onChange={moneyChange('desiredPostSaleAnnualIncome', onChange)}
            placeholder="0"
          />
          <Input
            label="Liquid assets / investments today"
            prefix="$"
            inputMode="decimal"
            value={inputs.liquidAssets === 0 ? '' : String(inputs.liquidAssets)}
            onChange={moneyChange('liquidAssets', onChange)}
            placeholder="0"
          />
          <Input
            label="Non-mortgage debt to pay off"
            prefix="$"
            inputMode="decimal"
            value={inputs.nonMortgageDebt === 0 ? '' : String(inputs.nonMortgageDebt)}
            onChange={moneyChange('nonMortgageDebt', onChange)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t hairline grid md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">Income today</p>
          <p className="font-display text-2xl text-someday-forest">
            {fmt.usd(output.currentAnnualIncome)}
          </p>
        </div>
        <div>
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">
            Portfolio you need
          </p>
          <p className="font-display text-2xl text-someday-forest">
            {fmt.usd(output.portfolioRequired)}
          </p>
        </div>
        <div>
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">
            {closesGap ? 'Cushion above goal' : 'Sale must net'}
          </p>
          <p className="font-display text-2xl text-someday-gold">
            {fmt.usd(Math.abs(output.wealthGap))}
          </p>
        </div>
      </div>

      <div className="mt-4 text-sm text-someday-slate-mid">
        Target sale price required (gross, before fees & taxes):{' '}
        <strong className="text-someday-forest">{fmt.usd(output.targetSalePrice)}</strong>
      </div>
    </div>
  );
}
