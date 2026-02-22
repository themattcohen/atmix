'use client'
import type { WatchlistItem } from '@/types'
import { formatCents, formatTimeLeft } from '@/lib/format'

interface ItemStatsGridProps {
  item: WatchlistItem
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface StatBoxProps {
  label: string
  value: string
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-text-primary">{value}</p>
    </div>
  )
}

export function ItemStatsGrid({ item }: ItemStatsGridProps) {
  const totalPrice = item.currentPrice + (item.shippingCost ?? 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="item-stats-grid">
      <StatBox label="Current Price" value={formatCents(item.currentPrice)} />
      <StatBox label="Shipping" value={(item.shippingCost ?? 0) > 0 ? formatCents(item.shippingCost) : 'Free'} />
      <StatBox label="Total" value={formatCents(totalPrice)} />
      <StatBox label="Buy It Now" value={item.buyItNowPrice ? formatCents(item.buyItNowPrice) : 'N/A'} />
      <StatBox label="Watchers" value={String(item.watcherCount ?? 0)} />
      <StatBox label="Bids" value={String(item.bidCount)} />
      <StatBox label="Seller" value={item.sellerId ?? 'Unknown'} />
      <StatBox label="Feedback" value={item.sellerFeedback ? String(item.sellerFeedback) : 'N/A'} />
      <StatBox label="Time Left" value={formatTimeLeft(item.endTime)} />
      <StatBox label="First Seen" value={formatDate(item.firstSeenAt)} />
    </div>
  )
}
