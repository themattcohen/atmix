'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useTrends } from '@/hooks/use-trends'
import { TopBar } from '@/components/layout/top-bar'
import { PortfolioStats } from '@/components/trends/portfolio-stats'
import { MoversTable } from '@/components/trends/movers-table'
import { ErrorState } from '@/components/watchlist/error-state'
import { PageExplainer } from '@/components/ui/page-explainer'
import { Skeleton } from '@/components/ui/skeleton'

const PortfolioChart = dynamic(
  () => import('@/components/trends/portfolio-chart').then((mod) => mod.PortfolioChart),
  {
    ssr: false,
    loading: () => <div className="h-[290px] animate-pulse bg-muted rounded-lg" />,
  }
)

type Range = '7d' | '30d' | '90d'

export default function TrendsPage() {
  const [range, setRange] = useState<Range>('7d')
  const { data, isLoading, isError, refetch } = useTrends(range)

  const rangeOptions: Range[] = ['7d', '30d', '90d']

  return (
    <>
      <TopBar />
      <div className="p-4 space-y-4" data-testid="trends-page">
        {/* Range selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary font-medium">Range:</span>
          {rangeOptions.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                range === r
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-raised'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <PageExplainer text="A portfolio view of your watchlist. Stats reflect the latest sync snapshot. The chart shows how total tracked value changes over the selected period and fills in as syncs accumulate. Movers highlight items with the biggest price drops or watcher gains." />

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load trends" onRetry={() => refetch()} />
        ) : data ? (
          <>
            <PortfolioStats stats={data.stats} />
            <PortfolioChart data={data.portfolio} />
            <MoversTable
              priceDrops={data.topPriceDrops}
              watcherGains={data.topWatcherGains}
            />
          </>
        ) : null}
      </div>
    </>
  )
}
