'use client'
import { useState, useEffect } from 'react'
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
import type { WatchlistItem } from '@/types'

const LIMIT = 50

export default function WatchlistPage() {
  const { statusFilter, typeFilter, searchQuery } = useWatchlistStore()

  // Pagination state for unranked items
  const [unrankedOffset, setUnrankedOffset] = useState(0)
  const [accumulatedUnranked, setAccumulatedUnranked] = useState<WatchlistItem[]>([])

  const { data, isLoading, isError, isFetching, refetch } = useWatchlist({
    status: statusFilter,
    type: typeFilter,
    search: searchQuery,
    offset: unrankedOffset,
    limit: LIMIT,
  })

  // When new page arrives, append to accumulated list
  useEffect(() => {
    if (!data) return
    if (unrankedOffset === 0) {
      setAccumulatedUnranked(data.unranked)
    } else {
      setAccumulatedUnranked(prev => {
        // Deduplicate by id in case of refetch
        const existingIds = new Set(prev.map(i => i.id))
        const newItems = data.unranked.filter(i => !existingIds.has(i.id))
        return [...prev, ...newItems]
      })
    }
  }, [data, unrankedOffset])

  // Reset on filter change
  useEffect(() => {
    setUnrankedOffset(0)
    setAccumulatedUnranked([])
  }, [statusFilter, typeFilter, searchQuery])

  const handleLoadMore = () => setUnrankedOffset(prev => prev + LIMIT)

  const ranked = data?.ranked ?? []
  const unrankedTotal = data?.unrankedTotal ?? 0

  const allItems = [...ranked, ...accumulatedUnranked]
  const endingSoon = allItems
    .filter((item) => item.status === 'Active' && item.endTime)
    .sort((a, b) => new Date(a.endTime!).getTime() - new Date(b.endTime!).getTime())
    .slice(0, 5)

  const { data: priceDropEvents } = useEvents({ type: 'price_drop', limit: 10 })
  const { data: watcherSpikeEvents } = useEvents({ type: 'watcher_spike', limit: 10 })

  const hasFilters = statusFilter !== 'All' || typeFilter !== 'All' || searchQuery !== ''
  const isEmpty = !data || (ranked.length === 0 && unrankedTotal === 0)

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
        ) : isEmpty ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <WatchlistTable
            ranked={ranked}
            unranked={accumulatedUnranked}
            unrankedTotal={unrankedTotal}
            onLoadMore={handleLoadMore}
            isLoadingMore={isFetching && unrankedOffset > 0}
            heatIndex={data?.heatIndex}
          />
        )}
      </AppShell>
    </>
  )
}
