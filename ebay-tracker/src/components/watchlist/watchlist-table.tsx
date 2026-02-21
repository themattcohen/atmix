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
import type { WatchlistItem } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { useDragRank } from '@/hooks/use-drag-rank'
import { WatchlistRow } from './watchlist-row'

interface WatchlistTableProps {
  ranked: WatchlistItem[]
  unranked: WatchlistItem[]
}

export function WatchlistTable({ ranked, unranked }: WatchlistTableProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const rankMutation = useDragRank()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const rankedIds = useMemo(() => ranked.map((item) => item.id), [ranked])

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-surface z-10 border-b border-border">
          <tr>
            <th className="w-8" />
            {visibleColumns.rank && <th className={`w-10 ${headerClass} text-center`}>#</th>}
            {visibleColumns.image && <th className={`w-10 ${headerClass}`} />}
            {visibleColumns.title && <th className={headerClass}>Title</th>}
            {visibleColumns.price && <th className={headerClass}>Price</th>}
            {visibleColumns.delta && <th className={headerClass}>Delta</th>}
            {visibleColumns.watchers && <th className={headerClass}>Watchers</th>}
            {visibleColumns.bidCount && <th className={`w-12 ${headerClass} text-center`}>Bids</th>}
            {visibleColumns.timeLeft && <th className={headerClass}>Time Left</th>}
            {visibleColumns.status && <th className={headerClass}>Status</th>}
            {visibleColumns.queue && <th className="w-8" />}
          </tr>
        </thead>

        {/* Ranked items — draggable */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {ranked.map((item) => (
                <WatchlistRow key={item.id} item={item} />
              ))}
            </tbody>
          </SortableContext>
        </DndContext>

        {/* Unranked section */}
        {unranked.length > 0 && (
          <>
            <tbody>
              <tr>
                <td
                  colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                  className="px-4 py-2 text-[10px] uppercase tracking-wider text-text-secondary font-semibold bg-background border-y border-border"
                >
                  Unranked
                </td>
              </tr>
            </tbody>
            <tbody>
              {unranked.map((item) => (
                <WatchlistRow key={item.id} item={item} />
              ))}
            </tbody>
          </>
        )}
      </table>
    </div>
  )
}
