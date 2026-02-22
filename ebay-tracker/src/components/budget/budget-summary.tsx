'use client'
import type { OptimizationResult } from '@/types'
import { StatsCard } from '@/components/trends/stats-card'
import { formatDollars } from '@/lib/format'

interface BudgetSummaryProps {
  result: OptimizationResult
}

export function BudgetSummary({ result }: BudgetSummaryProps) {
  const utilizationPct = result.budgetUtilization

  // Color signal based on remaining budget percentage
  const remainingPct = 1 - utilizationPct
  const remainingDeltaType: 'positive' | 'negative' | 'neutral' =
    remainingPct > 0.20 ? 'positive'
    : remainingPct > 0.05 ? 'neutral'
    : 'negative'

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="budget-summary"
    >
      <StatsCard
        label="Items Selected"
        value={String(result.picks.length)}
      />
      <StatsCard
        label="Est. Total Cost"
        value={formatDollars(result.totalEstimated)}
      />
      <StatsCard
        label="Remaining Budget"
        value={formatDollars(result.budgetRemaining)}
        deltaType={remainingDeltaType}
      />
      <StatsCard
        label="Budget Used"
        value={`${(utilizationPct * 100).toFixed(0)}%`}
      />
    </div>
  )
}
