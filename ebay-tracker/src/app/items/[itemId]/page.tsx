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
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

export default function ItemDetailPage() {
  const params = useParams()
  const itemId = params.itemId as string
  const { data, isLoading, isError } = useItemDetail(itemId)
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
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
            <svg className="w-10 h-10 text-status-sold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-status-sold font-medium">Item not found</p>
            <Link href="/" className="text-sm text-accent hover:underline">
              Back to watchlist
            </Link>
          </div>
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
