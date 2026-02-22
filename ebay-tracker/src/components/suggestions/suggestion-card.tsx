'use client'
import Link from 'next/link'
import { useCountdown } from '@/hooks/use-countdown'
import { formatCents } from '@/lib/format'

type SuggestionType = 'ending_soon' | 'price_drop' | 'watcher_spike'

interface SuggestionCardProps {
  type: SuggestionType
  title: string
  itemId?: string
  endTime?: string | null
  oldPrice?: number
  newPrice?: number
  watcherCount?: number
}

const typeConfig: Record<SuggestionType, { icon: string; label: string }> = {
  ending_soon: { icon: '\u23F0', label: 'Ending Soon' },
  price_drop: { icon: '\uD83D\uDCB0', label: 'Price Drop' },
  watcher_spike: { icon: '\uD83D\uDC40', label: 'Watcher Spike' },
}

export function SuggestionCard({ type, title, itemId, endTime, oldPrice, newPrice, watcherCount }: SuggestionCardProps) {
  const countdown = useCountdown(endTime ?? null)
  const config = typeConfig[type]

  const content = (
    <div className={`flex-shrink-0 w-[200px] bg-surface border border-border rounded-lg p-3 snap-start${
      itemId ? ' hover:bg-raised cursor-pointer transition-colors' : ''
    }`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{config.icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
          {config.label}
        </span>
      </div>
      <p className="text-xs text-text-primary truncate mb-1" title={title}>
        {title}
      </p>
      {type === 'ending_soon' && (
        <span className={`text-xs font-mono ${
          countdown.urgency === 'critical' ? 'text-status-sold animate-pulse-urgent' :
          countdown.urgency === 'urgent' ? 'text-status-sold' :
          'text-urgency-caution'
        }`}>
          {countdown.timeLeft}
        </span>
      )}
      {type === 'price_drop' && oldPrice != null && newPrice != null && (
        <div className="text-xs">
          <span className="text-text-secondary line-through">{formatCents(oldPrice)}</span>
          <span className="text-delta-drop ml-1">{formatCents(newPrice)}</span>
        </div>
      )}
      {type === 'watcher_spike' && watcherCount != null && (
        <span className="text-xs text-accent font-mono">{watcherCount} watchers</span>
      )}
    </div>
  )

  if (itemId) {
    return <Link href={`/items/${itemId}`}>{content}</Link>
  }

  return content
}
