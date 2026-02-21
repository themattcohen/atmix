'use client'
import { useWatchlist } from '@/hooks/use-watchlist'
import { useEvents } from '@/hooks/use-events'
import { useWatchlistStore } from '@/store/watchlist-store'
import { AppShell } from '@/components/layout/app-shell'
import { TopBar } from '@/components/layout/top-bar'
import { SuggestionCarousel } from '@/components/suggestions/suggestion-carousel'
import { FilterBar } from '@/components/watchlist/filter-bar'
import { WatchlistTable } from '@/components/watchlist/watchlist-table'
import { EmptyState } from '@/components/watchlist/empty-state'
import { ErrorState } from '@/components/watchlist/error-state'
import { Skeleton } from '@/components/ui/skeleton'

export default function WatchlistPage() {
  const { statusFilter, typeFilter, searchQuery } = useWatchlistStore()

  const { data, isLoading, isError, refetch } = useWatchlist({
    status: statusFilter,
    type: typeFilter,
    search: searchQuery,
  })

  const { data: priceDropEvents } = useEvents({ type: 'price_drop', limit: 10 })
  const { data: watcherSpikeEvents } = useEvents({ type: 'watcher_spike', limit: 10 })

  const allItems = data ? [...data.ranked, ...data.unranked] : []
  const endingSoon = allItems
    .filter((item) => item.status === 'Active' && item.endTime)
    .sort((a, b) => new Date(a.endTime!).getTime() - new Date(b.endTime!).getTime())
    .slice(0, 5)

  const hasFilters = statusFilter !== 'All' || typeFilter !== 'All' || searchQuery !== ''

  return (
    <>
      <TopBar />
      <SuggestionCarousel
        endingSoon={endingSoon}
        priceDropEvents={priceDropEvents ?? []}
        watcherSpikeEvents={watcherSpikeEvents ?? []}
        items={allItems}
      />
      <FilterBar />
      <AppShell>
        {isLoading ? (
          <div className="p-4 space-y-2" data-testid="loading-skeleton">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load watchlist" onRetry={() => refetch()} />
        ) : !data || (data.ranked.length === 0 && data.unranked.length === 0) ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <WatchlistTable ranked={data.ranked} unranked={data.unranked} />
        )}
      </AppShell>
    </>
  )
}
