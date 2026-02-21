'use client'
import { useEffect, useState } from 'react'
import { useWatchlistStore } from '@/store/watchlist-store'
import { ColumnToggle } from './column-toggle'
import type { ListingStatus, ListingType } from '@/types'

export function FilterBar() {
  const { statusFilter, typeFilter, setStatusFilter, setTypeFilter, setSearchQuery } =
    useWatchlistStore()

  const [localSearch, setLocalSearch] = useState('')

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localSearch), 300)
    return () => clearTimeout(timer)
  }, [localSearch, setSearchQuery])

  const statusOptions: (ListingStatus | 'All')[] = ['All', 'Active', 'Sold', 'Ended', 'Relisted']
  const typeOptions: (ListingType | 'All')[] = ['All', 'Auction', 'FixedPrice', 'AuctionWithBIN']

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[140px] max-w-xs">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search items..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 bg-background border border-border rounded text-xs text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as ListingStatus | 'All')}
        className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>{s === 'All' ? 'All Status' : s}</option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value as ListingType | 'All')}
        className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        {typeOptions.map((t) => (
          <option key={t} value={t}>
            {t === 'All' ? 'All Types' : t === 'FixedPrice' ? 'Buy It Now' : t === 'AuctionWithBIN' ? 'Auction + BIN' : t}
          </option>
        ))}
      </select>

      {/* Column toggle */}
      <ColumnToggle />
    </div>
  )
}
