'use client'
import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { WatchlistItem, HeatIndex, CardSignal } from '@/types'
import { formatCents } from '@/lib/utils'
import { useWatchlistStore, type SortKey } from '@/store/watchlist-store'
import { useDragRank } from '@/hooks/use-drag-rank'
import { useSparklines } from '@/hooks/use-sparklines'
import { useSignals } from '@/hooks/use-signals'
import { useWatcherSeries } from '@/hooks/use-watcher-series'
import { Tooltip } from '@/components/ui/tooltip'
import { SortableWatchlistRow } from './watchlist-row'
import { StaticWatchlistRow } from './static-watchlist-row'

/* ------------------------------------------------------------------ */
/*  Resizable header component (Feature 3)                            */
/* ------------------------------------------------------------------ */

function ResizableTh({
  colKey,
  children,
  className = '',
  resizable = true,
}: {
  colKey: string
  children?: React.ReactNode
  className?: string
  resizable?: boolean
}) {
  const width = useWatchlistStore((s) => s.columnWidths[colKey])
  const setColumnWidth = useWatchlistStore((s) => s.setColumnWidth)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startX.current = e.clientX
      startW.current = width ?? 80

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current
        setColumnWidth(colKey, startW.current + delta)
      }
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [colKey, width, setColumnWidth]
  )

  return (
    <th
      className={`relative ${className}`}
      style={{ width: width ? `${width}px` : undefined }}
    >
      {children}
      {resizable && (
        <span
          onMouseDown={onMouseDown}
          className="absolute right-0 top-0 bottom-0 w-0.5 cursor-col-resize bg-border/30 hover:bg-accent/60 transition-colors z-10"
        />
      )}
    </th>
  )
}

/* ------------------------------------------------------------------ */
/*  Sort header component (Feature 2)                                 */
/* ------------------------------------------------------------------ */

function SortableHeader({
  colKey,
  label,
  tooltip,
}: {
  colKey: SortKey
  label: string
  tooltip?: string
}) {
  const sortBy = useWatchlistStore((s) => s.sortBy)
  const sortDir = useWatchlistStore((s) => s.sortDir)
  const setSortAndDir = useWatchlistStore((s) => s.setSortAndDir)

  const isActive = sortBy === colKey
  const arrow = isActive ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'
  const arrowClass = isActive ? 'text-accent' : 'text-text-secondary/50'

  const handleClick = () => {
    if (isActive) {
      setSortAndDir(colKey, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortAndDir(colKey, 'asc')
    }
  }

  const content = (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-0.5 hover:text-text-primary transition-colors cursor-pointer"
    >
      <span>{label}</span>
      <span className={`text-[9px] ${arrowClass}`}>{arrow}</span>
    </button>
  )

  if (tooltip) {
    return (
      <Tooltip content={tooltip} wide>
        <span className="cursor-help border-b border-dashed border-text-secondary/40">
          {content}
        </span>
      </Tooltip>
    )
  }

  return content
}

/* ------------------------------------------------------------------ */
/*  Main table                                                        */
/* ------------------------------------------------------------------ */

interface WatchlistTableProps {
  ranked:        WatchlistItem[]
  unranked:      WatchlistItem[]
  unrankedTotal: number
  onLoadMore:    () => void
  isLoadingMore: boolean
  heatIndex?:    Record<string, HeatIndex>
}

export function WatchlistTable({ ranked, unranked, unrankedTotal, onLoadMore, isLoadingMore, heatIndex }: WatchlistTableProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const sparklineDays  = useWatchlistStore((s) => s.sparklineDays)
  const rankMutation   = useDragRank()

  // Rehydrate persisted store on mount (SSR safety)
  useEffect(() => {
    useWatchlistStore.persist.rehydrate()
  }, [])

  // Load sparklines for ranked items only
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

  // Track active drag for DragOverlay (Feature 4)
  const [activeDragItem, setActiveDragItem] = useState<WatchlistItem | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    // Check if dragging an unranked item
    if (id.startsWith('unranked-')) {
      const realId = id.replace('unranked-', '')
      const item = unranked.find((i) => i.id === realId)
      if (item) setActiveDragItem(item)
    } else {
      const item = ranked.find((i) => i.id === id)
      if (item) setActiveDragItem(item)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)

    // Unranked item dropped on ranked zone → promote to end of ranked
    if (activeId.startsWith('unranked-')) {
      const realId = activeId.replace('unranked-', '')
      if (over.id === 'ranked-zone' || !String(over.id).startsWith('unranked-')) {
        rankMutation.mutate({ itemId: realId, newRank: ranked.length + 1 })
      }
      return
    }

    // Normal ranked reorder
    if (active.id === over.id) return
    const oldIndex = ranked.findIndex((i) => i.id === active.id)
    const newIndex = ranked.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newRank = newIndex + 1
    rankMutation.mutate({ itemId: String(active.id), newRank })
  }

  // Droppable zone for ranked tbody (Feature 4)
  const { setNodeRef: setRankedRef, isOver: isOverRanked } = useDroppable({ id: 'ranked-zone' })

  const headerClass = 'text-[10px] uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left whitespace-nowrap'
  const colCount = Object.values(visibleColumns).filter(Boolean).length + 1 // +1 for drag handle col
  const hasMore = unranked.length < unrankedTotal

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="sticky top-0 bg-surface z-10 border-b border-border">
            <tr>
              {/* Drag handle column — fixed, not resizable */}
              <th className="w-8" />

              {visibleColumns.rank && (
                <ResizableTh colKey="rank" className={`${headerClass} text-center`} resizable={false}>
                  #
                </ResizableTh>
              )}

              {visibleColumns.image && (
                <ResizableTh colKey="image" className={headerClass} resizable={false} />
              )}

              {visibleColumns.title && (
                <ResizableTh colKey="title" className={headerClass}>
                  Title
                </ResizableTh>
              )}

              {visibleColumns.price && (
                <ResizableTh colKey="price" className={headerClass}>
                  <SortableHeader colKey="price" label="Price" />
                </ResizableTh>
              )}

              {visibleColumns.delta && (
                <ResizableTh colKey="delta" className={`hidden sm:table-cell ${headerClass}`}>
                  <Tooltip content="Price change % between the two most recent sync snapshots. Green ↓ = price dropped. Red ↑ = price increased." wide>
                    <span className="cursor-help border-b border-dashed border-text-secondary/40">Delta</span>
                  </Tooltip>
                </ResizableTh>
              )}

              {visibleColumns.watchers && (
                <ResizableTh colKey="watchers" className={`hidden sm:table-cell ${headerClass}`}>
                  <SortableHeader colKey="watchers" label="Watchers" />
                </ResizableTh>
              )}

              {visibleColumns.bidCount && (
                <ResizableTh colKey="bidCount" className={`hidden sm:table-cell ${headerClass} text-center`}>
                  <SortableHeader colKey="bid_count" label="Bids" />
                </ResizableTh>
              )}

              {visibleColumns.timeLeft && (
                <ResizableTh colKey="timeLeft" className={headerClass}>
                  <SortableHeader colKey="end_time" label="Time Left" />
                </ResizableTh>
              )}

              {visibleColumns.status && (
                <ResizableTh colKey="status" className={headerClass}>
                  <SortableHeader colKey="status" label="Status" />
                </ResizableTh>
              )}

              {visibleColumns.signals && (
                <ResizableTh colKey="signals" className={`hidden sm:table-cell ${headerClass}`}>
                  <Tooltip content="Latest unacknowledged news signal (callup, trade, injury, etc.). Score reflects magnitude and source quality." wide>
                    <span className="cursor-help border-b border-dashed border-text-secondary/40">Signal</span>
                  </Tooltip>
                </ResizableTh>
              )}

              {visibleColumns.queue && (
                <th className="hidden sm:table-cell w-8">
                  <Tooltip content="Star items to add them to your Buy Queue for focused monitoring.">
                    <span className="cursor-help text-text-secondary text-xs">{'\u2606'}</span>
                  </Tooltip>
                </th>
              )}
            </tr>
          </thead>

          {/* Ranked items — draggable via dnd-kit + droppable zone for unranked promotion */}
          <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
            <tbody
              ref={setRankedRef}
              className={`transition-colors ${isOverRanked ? 'bg-accent/5 ring-1 ring-accent/20 ring-inset' : ''}`}
            >
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

          {/* Unranked rows — draggable for promotion into ranked */}
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

      {/* DragOverlay — ghost row shown during drag (Feature 4) */}
      <DragOverlay>
        {activeDragItem ? (
          <div className="bg-surface border border-accent/30 rounded px-3 py-2 shadow-lg text-xs text-text-primary max-w-xs truncate">
            <span className="font-mono text-accent mr-2">
              {formatCents(activeDragItem.currentPrice)}
            </span>
            {activeDragItem.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
