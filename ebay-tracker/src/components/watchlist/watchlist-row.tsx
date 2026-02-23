'use client'
import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import Image from 'next/image'
import type { WatchlistItem, SparklineSummary, HeatIndex, CardSignal } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { DragHandle } from './drag-handle'
import { RankCell } from './rank-cell'
import { CountdownCell } from './countdown-cell'
import { PriceCell } from './price-cell'
import { StatusBadge } from './status-badge'
import { WatcherCell } from './watcher-cell'
import { SparklineCell } from './sparkline-cell'
import { SignalBadge } from '@/components/signals/signal-badge'
import { TargetBadge } from '@/components/items/target-badge'
import { useQueueToggle } from '@/hooks/use-queue-toggle'

interface WatchlistRowProps {
  item: WatchlistItem
  sparklineSummary?: SparklineSummary
  sparklinesLoading?: boolean
  heat?: HeatIndex
  latestSignal?: CardSignal
  watcherTrend?: number[]
}

function SortableWatchlistRowInner({ item, sparklineSummary, sparklinesLoading, heat, latestSignal, watcherTrend }: WatchlistRowProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const queueMutation = useQueueToggle()

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
          <Image
            src={item.imageUrl || '/placeholder.png'}
            alt={item.title}
            width={32}
            height={32}
            className="w-8 h-8 rounded object-cover bg-raised"
            unoptimized
          />
        </td>
      )}

      {/* Title */}
      {visibleColumns.title && (
        <td className="px-2 py-1.5 max-w-0">
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
          {(item as any).targetCounts && (
            <TargetBadge
              activeCount={(item as any).targetCounts.active}
              triggeredCount={(item as any).targetCounts.triggered}
            />
          )}
        </td>
      )}

      {/* Price */}
      {visibleColumns.price && (
        <td className="px-2 py-1.5">
          <PriceCell priceCents={item.currentPrice} deltaPct={item.deltaPct} />
        </td>
      )}

      {/* Delta — sparkline with price history + change % (hidden on mobile) */}
      {visibleColumns.delta && (
        <td className="hidden sm:table-cell px-2 py-1.5">
          <SparklineCell
            summary={sparklineSummary}
            isLoading={sparklinesLoading ?? false}
          />
        </td>
      )}

      {/* Watchers (hidden on mobile) */}
      {visibleColumns.watchers && (
        <td className="hidden sm:table-cell px-2 py-1.5">
          <WatcherCell
            count={item.watcherCount}
            trend={watcherTrend}
            heat={heat}
            delta={heat?.watcherDelta ?? null}
          />
        </td>
      )}

      {/* Bid count (hidden on mobile) */}
      {visibleColumns.bidCount && (
        <td className="hidden sm:table-cell w-12 px-2 py-1.5 text-center">
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

      {/* Signal (hidden on mobile) */}
      {visibleColumns.signals && (
        <td className="hidden sm:table-cell px-2 py-1.5">
          {latestSignal ? (
            <SignalBadge signal={latestSignal} />
          ) : (
            <span className="text-xs text-text-secondary">&mdash;</span>
          )}
        </td>
      )}

      {/* Queue toggle (hidden on mobile) */}
      {visibleColumns.queue && (
        <td className="hidden sm:table-cell w-8 px-1 py-1.5 text-center">
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

export const SortableWatchlistRow = memo(SortableWatchlistRowInner)
