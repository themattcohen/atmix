'use client'
import { useState, useRef, useEffect } from 'react'
import { useWatchlistStore } from '@/store/watchlist-store'

const columnLabels: Record<string, string> = {
  rank: 'Rank',
  image: 'Image',
  title: 'Title',
  price: 'Price',
  delta: 'Delta',
  watchers: 'Watchers',
  bidCount: 'Bids',
  timeLeft: 'Time Left',
  status: 'Status',
  signals: 'Signals',
  queue: 'Queue',
}

export function ColumnToggle() {
  const [open, setOpen] = useState(false)
  const { visibleColumns, toggleColumn } = useWatchlistStore()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 bg-background border border-border rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
        </svg>
        Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-raised border border-border rounded shadow-lg py-1 z-50 min-w-[140px]">
          {Object.entries(columnLabels).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleColumns[key] ?? true}
                onChange={() => toggleColumn(key)}
                className="rounded border-border"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
