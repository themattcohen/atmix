'use client'
import type { WatchlistItem } from '@/types'

interface ItemStatsGridProps {
  item: WatchlistItem
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeLeftDisplay(endTime: string | null): string {
  if (!endTime) return 'N/A'
  const ms = new Date(endTime).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  return `${hours}h ${minutes}m`
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
  const totalPrice = item.currentPrice + item.shippingCost

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="item-stats-grid">
      <StatBox label="Current Price" value={formatPrice(item.currentPrice)} />
      <StatBox label="Shipping" value={item.shippingCost > 0 ? formatPrice(item.shippingCost) : 'Free'} />
      <StatBox label="Total" value={formatPrice(totalPrice)} />
      <StatBox label="Buy It Now" value={item.buyItNowPrice ? formatPrice(item.buyItNowPrice) : 'N/A'} />
      <StatBox label="Watchers" value={String(item.watcherCount ?? 0)} />
      <StatBox label="Bids" value={String(item.bidCount)} />
      <StatBox label="Seller" value={item.sellerId ?? 'Unknown'} />
      <StatBox label="Feedback" value={item.sellerFeedback ? String(item.sellerFeedback) : 'N/A'} />
      <StatBox label="Time Left" value={timeLeftDisplay(item.endTime)} />
      <StatBox label="First Seen" value={formatDate(item.firstSeenAt)} />
    </div>
  )
}
