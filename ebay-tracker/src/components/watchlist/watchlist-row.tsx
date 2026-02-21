'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import type { WatchlistItem } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { DragHandle } from './drag-handle'
import { RankCell } from './rank-cell'
import { CountdownCell } from './countdown-cell'
import { PriceCell } from './price-cell'
import { StatusBadge } from './status-badge'
import { WatcherCell } from './watcher-cell'

interface WatchlistRowProps {
  item: WatchlistItem
}

export function WatchlistRow({ item }: WatchlistRowProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border hover:bg-raised transition-colors group"
    >
      {/* Drag handle — always visible */}
      <td className="w-8 px-1 py-1.5">
        <DragHandle listeners={listeners} attributes={attributes} />
      </td>

      {/* Rank */}
      {visibleColumns.rank && (
        <td className="w-10 px-1 py-1.5 text-center">
          <RankCell itemId={item.id} rank={item.rank} />
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

      {/* Delta — placeholder, would need snapshot comparison */}
      {visibleColumns.delta && (
        <td className="px-2 py-1.5">
          <span className="text-xs text-text-secondary">—</span>
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

      {/* Queue toggle */}
      {visibleColumns.queue && (
        <td className="w-8 px-1 py-1.5 text-center">
          <button
            className={`text-sm transition-colors ${
              item.isInQueue ? 'text-urgency-caution' : 'text-text-secondary hover:text-urgency-caution'
            }`}
            title={item.isInQueue ? 'Remove from queue' : 'Add to queue'}
          >
            {item.isInQueue ? '\u2605' : '\u2606'}
          </button>
        </td>
      )}
    </tr>
  )
}
