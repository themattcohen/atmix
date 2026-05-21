import { cn } from '../../lib/cn';
import type { StepIndex } from '../../state/useWizard';

const STEPS = [
  { label: 'Firm Profile' },
  { label: 'Financials' },
  { label: 'Readiness' },
  { label: 'Risk' },
  { label: 'Results' },
];

interface Props {
  current: StepIndex;
  onJump: (s: StepIndex) => void;
}

export function StepNav({ current, onJump }: Props) {
  return (
    <nav aria-label="Wizard steps" className="border-b hairline bg-someday-cream">
      <ol className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2 overflow-x-auto">
        {STEPS.map((step, i) => {
          const idx = i as StepIndex;
          const isCurrent = i === current;
          const isCompleted = i < current;
          const isFuture = i > current;
          return (
            <li key={step.label} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onJump(idx)}
                disabled={isFuture}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-someday-gold',
                  isCurrent && 'bg-someday-forest text-someday-cream-light',
                  isCompleted && 'text-someday-forest hover:bg-someday-cream-light',
                  isFuture && 'text-someday-slate-muted cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold',
                    isCurrent && 'bg-someday-gold text-someday-forest',
                    isCompleted && 'bg-someday-forest text-someday-cream-light',
                    isFuture && 'bg-someday-hairline text-someday-slate-muted',
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'h-px w-4 sm:w-8',
                    i < current ? 'bg-someday-forest' : 'bg-someday-hairline',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
