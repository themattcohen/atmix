'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { WatchlistItem } from '@/types'
import { formatCents } from '@/lib/format'
import { Tooltip } from '@/components/ui/tooltip'

interface MoversTableProps {
  priceDrops: WatchlistItem[]
  watcherGains: WatchlistItem[]
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
          <p className="text-xs text-text-secondary">
            {tab === 'drops'
              ? "No price drops detected in this period. Drops appear when an item\u2019s price falls between syncs within the selected window."
              : "No watcher gains detected. Watcher data is only available to item owners \u2014 if your counts show dashes in the main table, gains here will also be empty."}
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={`w-10 ${headerClass} text-center`}>#</th>
              <th className={headerClass}>Title</th>
              <th className={headerClass}>
                {tab === 'drops' ? 'Price' : (
                  <Tooltip content="Current number of eBay users watching this item">
                    <span className="cursor-help">Watchers</span>
                  </Tooltip>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-t border-border hover:bg-raised transition-colors">
                <td className="w-10 px-2 py-1.5 text-center">
                  <span className="text-[10px] font-mono text-text-secondary">{i + 1}</span>
                </td>
                <td className="px-2 py-1.5">
                  <Link href={`/items/${item.id}`} className="text-xs text-text-primary truncate block max-w-[300px] hover:underline">
                    {item.title}
                  </Link>
                </td>
                <td className="px-2 py-1.5">
                  <span className="text-xs font-mono text-text-primary">
                    {tab === 'drops' ? formatCents(item.currentPrice) : item.watcherCount ?? 0}
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
