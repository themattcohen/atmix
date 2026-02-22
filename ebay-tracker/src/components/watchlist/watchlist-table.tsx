'use client'
import { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { WatchlistItem, HeatIndex, CardSignal } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { useDragRank } from '@/hooks/use-drag-rank'
import { useSparklines } from '@/hooks/use-sparklines'
import { useSignals } from '@/hooks/use-signals'
import { useWatcherSeries } from '@/hooks/use-watcher-series'
import { SortableWatchlistRow } from './watchlist-row'
import { StaticWatchlistRow } from './static-watchlist-row'

interface WatchlistTableProps {
  ranked:        WatchlistItem[]
  unranked:      WatchlistItem[]   // current accumulated pages
  unrankedTotal: number            // total unranked matching current filters
  onLoadMore:    () => void
  isLoadingMore: boolean
  heatIndex?:    Record<string, HeatIndex>
}

export function WatchlistTable({ ranked, unranked, unrankedTotal, onLoadMore, isLoadingMore, heatIndex }: WatchlistTableProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const sparklineDays  = useWatchlistStore((s) => s.sparklineDays)
  const rankMutation   = useDragRank()

  // Load sparklines for ranked items only (unranked use static row without sparklines)
  const rankedIds = useMemo(() => ranked.map((i) => i.id), [ranked])
  const { data: sparklineMap, isLoading: sparklinesLoading } = useSparklines(rankedIds, sparklineDays)
  const { data: watcherSeriesMap } = useWatcherSeries(rankedIds, 14)

  // Load latest signal per item (ranked items only)
  const { data: signalsData } = useSignals({ limit: 100, acknowledged: false })
  const signalMap = useMemo(() => {
    const map = new Map<string, CardSignal>()
    if (!signalsData?.signals) return map
    for (const signal of signalsData.signals) {
      if (!map.has(signal.itemId)) {
        map.set(signal.itemId, signal)
      }
    }
    return map
  }, [signalsData])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ranked.findIndex((i) => i.id === active.id)
    const newIndex = ranked.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newRank = newIndex + 1
    rankMutation.mutate({ itemId: String(active.id), newRank })
  }

  const headerClass = 'text-[10px] uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left whitespace-nowrap'
  const colCount = Object.values(visibleColumns).filter(Boolean).length + 1 // +1 for drag handle col
  const hasMore = unranked.length < unrankedTotal

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface z-10 border-b border-border">
            <tr>
              <th className="w-8" />
              {visibleColumns.rank     && <th className={`w-10 ${headerClass} text-center`}>#</th>}
              {visibleColumns.image    && <th className={`w-10 ${headerClass}`} />}
              {visibleColumns.title    && <th className={headerClass}>Title</th>}
              {visibleColumns.price    && <th className={headerClass}>Price</th>}
              {visibleColumns.delta    && <th className={headerClass}>Delta</th>}
              {visibleColumns.watchers && <th className={headerClass}>Watchers</th>}
              {visibleColumns.bidCount && <th className={`w-12 ${headerClass} text-center`}>Bids</th>}
              {visibleColumns.timeLeft && <th className={headerClass}>Time Left</th>}
              {visibleColumns.status   && <th className={headerClass}>Status</th>}
              {visibleColumns.signals  && <th className={headerClass}>Signal</th>}
              {visibleColumns.queue    && <th className="w-8" />}
            </tr>
          </thead>

          {/* Ranked items — draggable via dnd-kit */}
          <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {ranked.map((item) => (
                <SortableWatchlistRow
                  key={item.id}
                  item={item}
                  sparklineSummary={sparklineMap?.get(item.id)}
                  sparklinesLoading={sparklinesLoading}
                  heat={heatIndex?.[item.id]}
                  latestSignal={signalMap.get(item.id)}
                  watcherTrend={watcherSeriesMap?.[item.id]}
                />
              ))}
            </tbody>
          </SortableContext>

          {/* Unranked section divider */}
          {(unranked.length > 0 || unrankedTotal > 0) && (
            <tbody>
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-2 text-[10px] uppercase tracking-wider text-text-secondary font-semibold bg-background border-y border-border"
                >
                  Unranked ({unrankedTotal.toLocaleString()} items)
                </td>
              </tr>
            </tbody>
          )}

          {/* Unranked rows — static, no dnd-kit hooks */}
          <tbody>
            {unranked.map((item) => (
              <StaticWatchlistRow key={item.id} item={item} heat={heatIndex?.[item.id]} latestSignal={signalMap.get(item.id)} />
            ))}
          </tbody>

          {/* Load More row */}
          {hasMore && (
            <tbody>
              <tr>
                <td colSpan={colCount} className="px-4 py-3 text-center border-t border-border">
                  <button
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="text-xs text-accent hover:text-accent/80 disabled:text-text-secondary transition-colors"
                  >
                    {isLoadingMore
                      ? 'Loading...'
                      : `Load more (${(unrankedTotal - unranked.length).toLocaleString()} remaining)`}
                  </button>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </DndContext>
  )
}
