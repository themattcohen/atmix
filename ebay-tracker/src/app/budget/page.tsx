'use client'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'
import { BudgetForm } from '@/components/budget/budget-form'
import { BudgetSummary } from '@/components/budget/budget-summary'
import { BudgetResults } from '@/components/budget/budget-results'
import { PageExplainer } from '@/components/ui/page-explainer'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/watchlist/error-state'
import { useBudget, parseBudgetCents } from '@/hooks/use-budget'

export default function BudgetPage() {
  const {
    result,
    budgetDollars,
    isLoading,
    isError,
    refetch,
  } = useBudget()

  const budgetCents = parseBudgetCents(budgetDollars)
  const hasValidBudget = budgetCents > 0

  // No ranked items case: result exists but all picks=0 and excluded all 'unranked'
  const hasNoRankedCandidates =
    result !== null &&
    result.picks.length === 0 &&
    result.excluded.length > 0 &&
    result.excluded.every((item) => item.excludedReason === 'unranked')

  return (
    <>
      <TopBar />
      <div className="p-4 space-y-4" data-testid="budget-page">
        <BudgetForm />

        <PageExplainer text="Enter a budget and choose an auction cost estimate. The optimizer scores your ranked watchlist items by urgency, price, and competition, then picks the best combination that fits your budget. Only ranked active items are included." />

        {isLoading && hasValidBudget && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {isError && (
          <ErrorState message="Failed to load watchlist data" onRetry={refetch} />
        )}

        {!isLoading && !isError && result !== null && (
          <>
            {hasNoRankedCandidates ? (
              <div
                className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface border border-border rounded-lg"
                role="status"
                aria-live="polite"
              >
                <svg
                  className="w-10 h-10 text-text-secondary mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-sm text-text-primary font-medium mb-1">
                  No ranked items to optimize
                </p>
                <p className="text-xs text-text-secondary mb-4 max-w-sm">
                  Rank items in your watchlist to include them in budget optimization.
                  Drag items to assign a rank, then come back here.
                </p>
                <Link
                  href="/"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Go to Watchlist
                </Link>
              </div>
            ) : (
              <>
                <BudgetSummary result={result} />
                <BudgetResults result={result} />
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
