'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { OptimizationResult, ScoredItem } from '@/types'
import { CountdownCell } from '@/components/watchlist/countdown-cell'
import { Badge } from '@/components/ui/badge'
import { ScoreBreakdownChip } from './score-breakdown'
import { estimatedCost } from '@/lib/budget/optimizer'

interface BudgetResultsProps {
  result: OptimizationResult
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Display text for excluded reason — we infer from context since the existing
// type only has 3 values but we need richer display text
function getExclusionDisplay(item: ScoredItem, budgetCents: number): { short: string; long: string } {
  if (item.excludedReason === 'unranked') {
    return {
      short: 'Not ranked',
      long: 'Unranked items are not included in optimization. Assign a rank on the watchlist page to include this item.',
    }
  }
  if (item.excludedReason === 'negative_score') {
    return {
      short: 'Not active',
      long: `This item is not currently active and cannot be purchased.`,
    }
  }
  // 'over_budget' — differentiate between over total budget vs insufficient remaining
  if (item.estimatedCost > budgetCents) {
    return {
      short: 'Over budget',
      long: `This item's estimated cost (${formatDollars(item.estimatedCost)}) exceeds your total budget. Even at the start with full budget, it wouldn't fit.`,
    }
  }
  return {
    short: 'Budget used up',
    long: `Higher-priority items consumed the remaining budget before reaching this item. It would cost ${formatDollars(item.estimatedCost)} but the budget was already used.`,
  }
}

const colHeader = 'text-[10px] uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left'

function PicksTable({ picks }: { picks: ScoredItem[] }) {
  if (picks.length === 0) {
    return (
      <div
        className="p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs text-text-secondary">
          No items fit within your budget. Try increasing the budget or switching to Aggressive mode.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-testid="budget-picks-table">
        <thead>
          <tr>
            <th scope="col" className={`w-9 ${colHeader} text-center`}>#</th>
            <th scope="col" className={colHeader}>Title</th>
            <th scope="col" className={`w-20 ${colHeader}`}>Est. Cost</th>
            <th scope="col" className={`w-16 ${colHeader}`}>Score</th>
            <th scope="col" className={`w-[72px] hidden sm:table-cell ${colHeader}`}>Type</th>
            <th scope="col" className={`w-20 hidden lg:table-cell ${colHeader}`}>Time Left</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((scoredItem) => {
            const { item } = scoredItem
            const typeVariant =
              item.listingType === 'FixedPrice' ? 'success'
              : item.listingType === 'AuctionWithBIN' ? 'default'
              : 'info'
            const typeLabel =
              item.listingType === 'FixedPrice' ? 'BIN'
              : item.listingType === 'AuctionWithBIN' ? 'AuctionBIN'
              : 'Auction'

            return (
              <tr
                key={item.id}
                className="border-t border-border hover:bg-raised transition-colors"
              >
                <td className="w-9 px-2 py-1.5 text-center">
                  <span className="text-[10px] font-mono text-text-secondary">
                    {item.rank ?? '—'}
                  </span>
                </td>
                <td className="px-2 py-1.5 max-w-0">
                  <Link
                    href={`/items/${item.id}`}
                    className="text-xs text-accent hover:underline truncate block"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="w-20 px-2 py-1.5">
                  <span className="text-xs font-mono text-text-primary">
                    {formatDollars(scoredItem.estimatedCost)}
                  </span>
                </td>
                <td className="w-16 px-2 py-1.5">
                  <ScoreBreakdownChip
                    score={scoredItem.score}
                    breakdown={scoredItem.breakdown}
                  />
                </td>
                <td className="w-[72px] px-2 py-1.5 hidden sm:table-cell">
                  <Badge variant={typeVariant} size="sm">
                    {typeLabel}
                  </Badge>
                </td>
                <td className="w-20 px-2 py-1.5 hidden lg:table-cell">
                  <CountdownCell endTime={item.endTime} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExcludedTable({ excluded, budgetCents }: { excluded: ScoredItem[]; budgetCents: number }) {
  if (excluded.length === 0) {
    return (
      <div
        className="p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs text-text-secondary">
          All ranked active items fit within your budget.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full opacity-75" data-testid="budget-excluded-table">
        <thead>
          <tr>
            <th scope="col" className={`w-9 ${colHeader} text-center`}>#</th>
            <th scope="col" className={colHeader}>Title</th>
            <th scope="col" className={`w-20 ${colHeader}`}>Est. Cost</th>
            <th scope="col" className={`w-16 ${colHeader}`}>Score</th>
            <th scope="col" className={`w-40 hidden sm:table-cell ${colHeader}`}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {excluded.map((scoredItem) => {
            const { item } = scoredItem
            const { short: reasonShort, long: reasonLong } = getExclusionDisplay(scoredItem, budgetCents)

            return (
              <tr
                key={item.id}
                className="border-t border-border"
              >
                <td className="w-9 px-2 py-1.5 text-center">
                  <span className="text-[10px] font-mono text-text-secondary">
                    {item.rank ?? '—'}
                  </span>
                </td>
                <td className="px-2 py-1.5 max-w-0">
                  <Link
                    href={`/items/${item.id}`}
                    className="text-xs text-text-secondary hover:text-accent hover:underline truncate block"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="w-20 px-2 py-1.5">
                  <span className="text-xs font-mono text-text-secondary">
                    {formatDollars(scoredItem.estimatedCost)}
                  </span>
                </td>
                <td className="w-16 px-2 py-1.5">
                  <ScoreBreakdownChip
                    score={scoredItem.score}
                    breakdown={scoredItem.breakdown}
                    muted
                  />
                </td>
                <td className="w-40 px-2 py-1.5 hidden sm:table-cell">
                  <span
                    className="text-xs text-text-secondary truncate block"
                    title={reasonLong}
                  >
                    {reasonShort}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function BudgetResults({ result, budgetCents }: BudgetResultsProps & { budgetCents: number }) {
  const [tab, setTab] = useState<'picks' | 'excluded'>('picks')

  const picksCount = result.picks.length
  const excludedCount = result.excluded.length

  return (
    <div
      className="bg-surface border border-border rounded-lg"
      data-testid="budget-results"
    >
      {/* Tab bar */}
      <div
        className="flex border-b border-border"
        role="tablist"
        aria-label="Optimization results tabs"
      >
        <button
          role="tab"
          aria-selected={tab === 'picks'}
          aria-controls="budget-picks-panel"
          onClick={() => setTab('picks')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'picks'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Picks ({picksCount})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'excluded'}
          aria-controls="budget-excluded-panel"
          onClick={() => setTab('excluded')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'excluded'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Excluded ({excludedCount})
        </button>
      </div>

      {/* Content */}
      {tab === 'picks' ? (
        <div id="budget-picks-panel" role="tabpanel">
          <PicksTable picks={result.picks} />
        </div>
      ) : (
        <div id="budget-excluded-panel" role="tabpanel">
          <ExcludedTable excluded={result.excluded} budgetCents={budgetCents} />
        </div>
      )}
    </div>
  )
}
