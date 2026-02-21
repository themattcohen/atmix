'use client'
import { useState } from 'react'
import type { WatchlistItem } from '@/types'

interface MoversTableProps {
  priceDrops: WatchlistItem[]
  watcherGains: WatchlistItem[]
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function MoversTable({ priceDrops, watcherGains }: MoversTableProps) {
  const [tab, setTab] = useState<'drops' | 'gainers'>('drops')

  const items = tab === 'drops' ? priceDrops : watcherGains
  const headerClass = 'text-[10px] uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left'

  return (
    <div className="bg-surface border border-border rounded-lg" data-testid="movers-table">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('drops')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'drops'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Price Drops
        </button>
        <button
          onClick={() => setTab('gainers')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'gainers'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Watcher Gains
        </button>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs text-text-secondary">No movers in this period</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={`w-10 ${headerClass} text-center`}>#</th>
              <th className={headerClass}>Title</th>
              <th className={headerClass}>{tab === 'drops' ? 'Price' : 'Watchers'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-t border-border hover:bg-raised transition-colors">
                <td className="w-10 px-2 py-1.5 text-center">
                  <span className="text-[10px] font-mono text-text-secondary">{i + 1}</span>
                </td>
                <td className="px-2 py-1.5">
                  <span className="text-xs text-text-primary truncate block max-w-[300px]">
                    {item.title}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className="text-xs font-mono text-text-primary">
                    {tab === 'drops' ? formatPrice(item.currentPrice) : item.watcherCount ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
