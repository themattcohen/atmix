'use client'
import { useParams } from 'next/navigation'
import { useItemDetail } from '@/hooks/use-item-detail'
import { useSignals } from '@/hooks/use-signals'
import { TopBar } from '@/components/layout/top-bar'
import { ItemHeader } from '@/components/detail/item-header'
import { ItemStatsGrid } from '@/components/detail/item-stats-grid'
import { PriceChart } from '@/components/detail/price-chart'
import { WatcherChart } from '@/components/detail/watcher-chart'
import { ItemEvents } from '@/components/detail/item-events'
import { OHLCChart } from '@/components/detail/ohlc-chart'
import { ErrorState } from '@/components/watchlist/error-state'
import { Skeleton } from '@/components/ui/skeleton'

export default function ItemDetailPage() {
  const params = useParams()
  const itemId = params.itemId as string
  const { data, isLoading, isError, refetch } = useItemDetail(itemId)
  const { data: signalData } = useSignals({ itemId })

  return (
    <>
      <TopBar />
      <div className="p-4 space-y-4" data-testid="item-detail-page">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load item" onRetry={() => refetch()} />
        ) : data ? (
          <>
            <ItemHeader item={data.item} />
            <ItemStatsGrid item={data.item} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PriceChart snapshots={data.snapshots} signals={signalData?.signals} />
              <WatcherChart snapshots={data.snapshots} />
            </div>
            {/* Historical archive — empty state shown gracefully until first nightly rollup */}
            <OHLCChart itemId={data.item.id} />
            <ItemEvents events={data.events} />
          </>
        ) : null}
      </div>
    </>
  )
}
