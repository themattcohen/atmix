'use client'
import { useRef } from 'react'
import type { WatchlistItem, WatchlistEvent } from '@/types'
import { SuggestionCard } from './suggestion-card'

interface SuggestionCarouselProps {
  endingSoon?: WatchlistItem[]
  priceDropEvents?: WatchlistEvent[]
  watcherSpikeEvents?: WatchlistEvent[]
  items?: WatchlistItem[]
}

export function SuggestionCarousel({
  endingSoon = [],
  priceDropEvents = [],
  watcherSpikeEvents = [],
  items = [],
}: SuggestionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 220
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const findItem = (itemId: string) => items.find((i) => i.id === itemId)

  const hasCards = endingSoon.length > 0 || priceDropEvents.length > 0 || watcherSpikeEvents.length > 0
  if (!hasCards) return null

  return (
    <div className="relative px-4 py-2 bg-surface border-b border-border">
      {/* Left scroll button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-raised/80 border border-border rounded-full text-text-secondary hover:text-text-primary"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {endingSoon.map((item) => (
          <SuggestionCard
            key={`end-${item.id}`}
            type="ending_soon"
            title={item.title}
            endTime={item.endTime}
          />
        ))}
        {priceDropEvents.map((event) => {
          const item = findItem(event.itemId)
          return (
            <SuggestionCard
              key={`drop-${event.id}`}
              type="price_drop"
              title={item?.title ?? event.itemTitle ?? 'Unknown item'}
              oldPrice={event.oldValue ? parseInt(event.oldValue, 10) : undefined}
              newPrice={event.newValue ? parseInt(event.newValue, 10) : undefined}
            />
          )
        })}
        {watcherSpikeEvents.map((event) => {
          const item = findItem(event.itemId)
          return (
            <SuggestionCard
              key={`spike-${event.id}`}
              type="watcher_spike"
              title={item?.title ?? event.itemTitle ?? 'Unknown item'}
              watcherCount={event.newValue ? parseInt(event.newValue, 10) : undefined}
            />
          )
        })}
      </div>

      {/* Right scroll button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-raised/80 border border-border rounded-full text-text-secondary hover:text-text-primary"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
