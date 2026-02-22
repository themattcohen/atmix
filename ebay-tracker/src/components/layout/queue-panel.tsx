'use client'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '@/lib/format'

export function QueuePanel() {
  const { data, isLoading, isError, refetch } = useWatchlist()

  const queueItems = data
    ? [...data.ranked, ...data.unranked]
        .filter((item) => item.isInQueue)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    : []

  return (
    <div className="p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
        My Queue ({queueItems.length})
      </h3>

      {isError ? (
        <div className="text-center py-4">
          <p className="text-xs text-status-sold">Failed to load queue</p>
          <button onClick={() => refetch()} className="text-xs text-accent hover:underline mt-1">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : queueItems.length === 0 ? (
        <p className="text-xs text-text-secondary">No items in queue</p>
      ) : (
        <ul className="space-y-1">
          {queueItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-raised transition-colors text-xs"
            >
              <span className="text-text-secondary w-4 text-right font-mono text-[10px]">
                {item.rank ?? '—'}
              </span>
              <span className="flex-1 truncate text-text-primary">{item.title}</span>
              <span className="text-text-secondary whitespace-nowrap font-mono text-[10px]">
                {formatCents(item.currentPrice)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
