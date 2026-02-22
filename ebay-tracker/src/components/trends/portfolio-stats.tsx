'use client'
import type { TrendStats } from '@/types'
import { StatsCard } from './stats-card'
import { formatDollars } from '@/lib/format'

interface PortfolioStatsProps {
  stats: TrendStats
}

export function PortfolioStats({ stats }: PortfolioStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="portfolio-stats">
      <StatsCard label="Total Items" value={String(stats.totalItems)} />
      <StatsCard label="Active" value={String(stats.activeItems)} />
      <StatsCard label="Sold" value={String(stats.soldItems)} />
      <StatsCard label="Total Value" value={formatDollars(stats.totalValueCents)} />
      <StatsCard label="Avg Watchers" value={String(Math.round(stats.avgWatchers))} />
      <StatsCard label="Ending Soon" value={String(stats.endingSoon)} />
    </div>
  )
}
