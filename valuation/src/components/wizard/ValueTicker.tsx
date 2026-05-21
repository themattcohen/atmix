import type { EngineOutput } from '../../engine';
import { fmt } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  outputs: EngineOutput;
  hasFinancials: boolean;
}

export function ValueTicker({ outputs, hasFinancials }: Props) {
  const { acceleration, sellability, multiple } = outputs;

  return (
    <aside
      aria-label="Live valuation summary"
      className="lg:sticky lg:top-6 lg:self-start"
    >
      <div className="card bg-someday-forest text-someday-cream-light border-someday-forest">
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-someday-gold mb-2">
          Live Valuation
        </p>

        <p className="text-sm text-someday-cream uppercase tracking-wide mt-4 opacity-70">
          Current value
        </p>
        <p
          className={cn(
            'font-display text-4xl font-semibold',
            !hasFinancials && 'opacity-40',
          )}
        >
          {hasFinancials ? fmt.usd(acceleration.currentValue) : '$—'}
        </p>

        <p className="text-sm text-someday-cream uppercase tracking-wide mt-5 opacity-70">
          Accelerated forecast
        </p>
        <p
          className={cn(
            'font-display text-2xl font-semibold text-someday-gold-light',
            !hasFinancials && 'opacity-40',
          )}
        >
          {hasFinancials ? fmt.usd(acceleration.blendedSalePrice) : '$—'}
        </p>

        <div className="mt-6 pt-4 border-t border-someday-forest-light grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-someday-cream opacity-70 text-xs uppercase tracking-wide">
              Sellability
            </p>
            <p className="font-medium">
              {fmt.pct(sellability.sellabilityPct)}{' '}
              <span className="text-someday-gold">({sellability.grade})</span>
            </p>
          </div>
          <div>
            <p className="text-someday-cream opacity-70 text-xs uppercase tracking-wide">
              Multiple used
            </p>
            <p className="font-medium">
              {hasFinancials ? fmt.multiple(multiple.ebitdaMultipleUsed) : '—'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
