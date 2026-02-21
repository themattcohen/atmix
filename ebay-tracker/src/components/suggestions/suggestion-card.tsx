'use client'
import { useCountdown } from '@/hooks/use-countdown'

type SuggestionType = 'ending_soon' | 'price_drop' | 'watcher_spike'

interface SuggestionCardProps {
  type: SuggestionType
  title: string
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

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function SuggestionCard({ type, title, endTime, oldPrice, newPrice, watcherCount }: SuggestionCardProps) {
  const countdown = useCountdown(endTime ?? null)
  const config = typeConfig[type]

  return (
    <div className="flex-shrink-0 w-[200px] bg-surface border border-border rounded-lg p-3 snap-start">
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
          <span className="text-text-secondary line-through">{formatPrice(oldPrice)}</span>
          <span className="text-delta-drop ml-1">{formatPrice(newPrice)}</span>
        </div>
      )}
      {type === 'watcher_spike' && watcherCount != null && (
        <span className="text-xs text-accent font-mono">{watcherCount} watchers</span>
      )}
    </div>
  )
}
