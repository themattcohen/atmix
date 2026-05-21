import type { EngineOutput, WealthGapInputs } from '../../engine';
import { SectionLabel } from '../ui/Card';
import { Button } from '../ui/Button';
import { fmt } from '../../lib/format';
import { AccelerationChart } from '../results/AccelerationChart';
import { WealthGapPanel } from '../results/WealthGapPanel';
import { EmailReportForm } from '../results/EmailReportForm';

interface Props {
  firmName: string;
  outputs: EngineOutput;
  showWealthGap: boolean;
  onToggleWealthGap: (v: boolean) => void;
  wealthGapInputs: WealthGapInputs;
  onChangeWealthGap: (patch: Partial<WealthGapInputs>) => void;
  onEmailReport: () => void;
  isEmailing?: boolean;
}

export function ResultsStep({
  firmName,
  outputs,
  showWealthGap,
  onToggleWealthGap,
  wealthGapInputs,
  onChangeWealthGap,
  onEmailReport,
  isEmailing,
}: Props) {
  const { acceleration, sellability, ebitda, multiple, wealthGap } = outputs;
  const displayName = firmName.trim() || 'Your firm';

  return (
    <div>
      <SectionLabel className="mb-3">Step 5 of 5 · Results</SectionLabel>
      <h2 className="font-display text-display-lg mb-2">
        {displayName} is worth{' '}
        <span className="text-someday-gold">{fmt.usd(acceleration.currentValue)}</span> today.
      </h2>
      <p className="text-someday-slate-mid text-lg mb-8 max-w-3xl">
        And{' '}
        <strong className="text-someday-forest">{fmt.usd(acceleration.blendedSalePrice)}</strong> at
        a sale if you address the three levers on the right over the next few years.
      </p>

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <div className="card">
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">
            Sellability Grade
          </p>
          <p className="font-display text-4xl text-someday-forest">{sellability.grade}</p>
          <p className="text-sm text-someday-slate-mid mt-1">
            {fmt.pct(sellability.sellabilityPct)} · probability {sellability.probabilityOfSale}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">
            Adjusted EBITDA
          </p>
          <p className="font-display text-4xl text-someday-forest">
            {fmt.usd(ebitda.adjustedEbitda)}
          </p>
          <p className="text-sm text-someday-slate-mid mt-1">
            {fmt.pct(ebitda.ebitdaMargin)} margin · {fmt.multiple(multiple.ebitdaMultipleUsed)}{' '}
            multiple
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-someday-slate-muted uppercase tracking-wide">
            Value created if you act
          </p>
          <p className="font-display text-4xl text-someday-gold">
            +{fmt.usd(acceleration.totalValueCreated)}
          </p>
          <p className="text-sm text-someday-slate-mid mt-1">
            {fmt.pct(acceleration.totalValueCreatedPct)} above today
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <SectionLabel className="mb-2">Acceleration Scenarios</SectionLabel>
        <h3 className="font-display text-2xl text-someday-forest mb-1">
          Three levers, one blended outcome.
        </h3>
        <p className="text-someday-slate-mid mb-6 text-sm">
          Grow revenue {fmt.pct(0.10)}, reduce COGS ratio by 10 percentage points, lift the
          multiple {fmt.pct(0.05)} through risk reduction. The blended view applies all three
          compounded — that is the realistic ceiling, not a sum.
        </p>
        <AccelerationChart acceleration={acceleration} />
      </div>

      {!showWealthGap ? (
        <div className="card bg-someday-forest text-someday-cream-light border-someday-forest">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-someday-gold mb-2">
                Optional next step
              </p>
              <h3 className="font-display text-2xl">Will this sale fund your retirement?</h3>
              <p className="text-someday-cream mt-1 opacity-80 max-w-2xl">
                Six personal-finance inputs reveal whether the projected sale price actually closes
                the gap to your post-sale income goal.
              </p>
            </div>
            <Button variant="gold" size="lg" onClick={() => onToggleWealthGap(true)}>
              Run the wealth-gap check
            </Button>
          </div>
        </div>
      ) : (
        <WealthGapPanel
          inputs={wealthGapInputs}
          output={wealthGap}
          onChange={onChangeWealthGap}
        />
      )}

      <div className="mt-10 pt-8 border-t hairline space-y-4">
        <p className="text-someday-slate-mid text-sm max-w-2xl">
          Want a PDF of this valuation to keep, share with partners, or compare next year?
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <EmailReportForm
            firmName={firmName}
            outputs={outputs}
            includeWealthGap={showWealthGap}
          />
          <Button variant="secondary" size="lg" onClick={onEmailReport} disabled={isEmailing}>
            {isEmailing ? 'Generating PDF…' : 'Or download directly'}
          </Button>
        </div>
      </div>
    </div>
  );
}
