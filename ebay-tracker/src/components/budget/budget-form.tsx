'use client'
import { useBudgetStore, parseBudgetCents } from '@/hooks/use-budget'
import type { AuctionMode } from '@/types'

const modeOptions: { value: AuctionMode; label: string; subtitle: string }[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    subtitle: '1.5x current price — safe estimate',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    subtitle: '1.25x current price — typical outcome',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    subtitle: '1.1x current price — minimal bidding',
  },
]

function getInputError(value: string): string | null {
  if (value === '') return null
  const cleaned = value.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return 'Enter a valid dollar amount'
  if (dollars <= 0) return 'Budget must be greater than zero'
  return null
}

export function BudgetForm() {
  const { budgetDollars, auctionMode, setBudgetDollars, setAuctionMode } = useBudgetStore()

  const inputError = getInputError(budgetDollars)
  const errorId = 'budget-input-error'

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
        Budget Optimizer
      </h2>

      {/* Dollar input */}
      <div className="space-y-1">
        <label
          htmlFor="budget-input"
          className="block text-xs font-medium text-text-secondary"
        >
          Budget
        </label>
        <input
          id="budget-input"
          type="text"
          value={budgetDollars}
          onChange={(e) => setBudgetDollars(e.target.value)}
          placeholder="e.g. 500"
          aria-label="Budget"
          aria-describedby={inputError ? errorId : undefined}
          aria-invalid={inputError ? true : undefined}
          className={`w-full max-w-xs bg-bg border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 transition-colors ${
            inputError
              ? 'border-status-sold focus:ring-status-sold'
              : 'border-border focus:ring-accent'
          }`}
        />
        {inputError && (
          <p id={errorId} className="text-xs text-status-sold" role="alert">
            {inputError}
          </p>
        )}
      </div>

      {/* Auction mode radio group */}
      <div
        role="radiogroup"
        aria-label="Auction cost estimation mode"
        className="space-y-1"
      >
        <p className="text-xs font-medium text-text-secondary">Auction cost estimate</p>
        <div className="flex flex-col sm:flex-row gap-2">
          {modeOptions.map((option) => {
            const isSelected = auctionMode === option.value
            const inputId = `auction-mode-${option.value}`
            return (
              <div key={option.value} className="flex-1 relative">
                {/* Radio input sits at (0,0) of the container, visible to a11y tree */}
                <input
                  id={inputId}
                  type="radio"
                  name="auction-mode"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setAuctionMode(option.value)}
                  aria-label={`${option.label} mode — ${option.subtitle}`}
                  className="absolute opacity-0 w-full h-full top-0 left-0 cursor-pointer z-10"
                />
                {/* Visual label — pointer-events-none so clicks reach the input above */}
                <label
                  htmlFor={inputId}
                  className={`flex flex-col gap-0.5 px-3 py-2 rounded border cursor-pointer transition-colors pointer-events-none ${
                    isSelected
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  <span className="text-xs font-medium">{option.label}</span>
                  <span className={`text-[10px] leading-tight ${isSelected ? 'text-accent/80' : 'text-text-secondary'}`}>
                    {option.subtitle}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-text-secondary flex items-start gap-1 mt-1">
          <span aria-hidden="true">ℹ</span>
          <span>Auction mode adjusts estimated final price for Auction-type listings only. Fixed-price (Buy It Now) listings are unaffected.</span>
        </p>
      </div>
    </div>
  )
}
