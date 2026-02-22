'use client'
import Link from 'next/link'
import type { WatchlistItem } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { useQueueToggle } from '@/hooks/use-queue-toggle'
import { CountdownCell } from './countdown-cell'
import { PriceCell } from './price-cell'
import { StatusBadge } from './status-badge'
import { WatcherCell } from './watcher-cell'

interface StaticWatchlistRowProps {
  item: WatchlistItem
}

export function StaticWatchlistRow({ item }: StaticWatchlistRowProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const queueMutation = useQueueToggle()

  return (
    <tr className="border-b border-border hover:bg-raised transition-colors">
      {/* No drag handle — static rows cannot be dragged */}
      <td className="w-8" />

      {/* Rank — unranked rows show em dash */}
      {visibleColumns.rank && (
        <td className="w-10 px-1 py-1.5 text-center">
          <span className="text-xs text-text-secondary font-mono">&mdash;</span>
        </td>
      )}

      {/* Image */}
      {visibleColumns.image && (
        <td className="w-10 px-1 py-1.5">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="w-8 h-8 rounded object-cover bg-raised"
              loading="lazy"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-raised" />
          )}
        </td>
      )}

      {/* Title */}
      {visibleColumns.title && (
        <td className="px-2 py-1.5 max-w-[200px] lg:max-w-[300px]">
          <Link
            href={`/items/${item.id}`}
            className="text-xs text-text-primary hover:text-accent truncate block"
            title={item.title}
          >
            {item.title}
          </Link>
          {item.listingType !== 'FixedPrice' && item.bidCount > 0 && (
            <span className="text-[10px] text-text-secondary">
              {item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}
            </span>
          )}
        </td>
      )}

      {/* Price */}
      {visibleColumns.price && (
        <td className="px-2 py-1.5">
          <PriceCell priceCents={item.currentPrice} />
        </td>
      )}

      {/* Delta — static rows show a placeholder */}
      {visibleColumns.delta && (
        <td className="px-2 py-1.5">
          <span className="text-xs text-text-secondary">&mdash;</span>
        </td>
      )}

      {/* Watchers */}
      {visibleColumns.watchers && (
        <td className="px-2 py-1.5">
          <WatcherCell count={item.watcherCount} />
        </td>
      )}

      {/* Bid count */}
      {visibleColumns.bidCount && (
        <td className="w-12 px-2 py-1.5 text-center">
          <span className="text-xs font-mono text-text-primary">{item.bidCount}</span>
        </td>
      )}

      {/* Time left */}
      {visibleColumns.timeLeft && (
        <td className="px-2 py-1.5">
          <CountdownCell endTime={item.endTime} />
        </td>
      )}

      {/* Status */}
      {visibleColumns.status && (
        <td className="px-2 py-1.5">
          <StatusBadge status={item.status} />
        </td>
      )}

      {/* Signal — static rows show placeholder */}
      {visibleColumns.signals && (
        <td className="px-2 py-1.5">
          <span className="text-xs text-text-secondary">&mdash;</span>
        </td>
      )}

      {/* Queue toggle */}
      {visibleColumns.queue && (
        <td className="w-8 px-1 py-1.5 text-center">
          <button
            className={`text-sm transition-colors ${
              item.isInQueue ? 'text-urgency-caution' : 'text-text-secondary hover:text-urgency-caution'
            }`}
            title={item.isInQueue ? 'Remove from queue' : 'Add to queue'}
            onClick={() => queueMutation.mutate({ itemId: item.id, isInQueue: !item.isInQueue })}
            disabled={queueMutation.isPending}
          >
            {item.isInQueue ? '\u2605' : '\u2606'}
          </button>
        </td>
      )}
    </tr>
  )
}
