'use client'
import type { HeatIndex } from '@/types'
import { Sparkline } from '@/components/ui/sparkline'

interface WatcherCellProps {
  count: number | null
  trend?: number[]
  delta?: number | null
  heat?: HeatIndex
}

const HEAT_DOT: Record<string, string> = {
  hot:     'bg-red-500',
  warm:    'bg-amber-500',
  neutral: 'bg-blue-500',
  cold:    'bg-gray-500',
}

const HEAT_LABEL: Record<string, string> = {
  hot:     'Hot',
  warm:    'Warm',
  neutral: 'Neutral',
  cold:    'Cold',
}

export function WatcherCell({ count, trend, delta, heat }: WatcherCellProps) {
  const dotClass = heat ? (HEAT_DOT[heat.tier] ?? 'bg-gray-600') : 'bg-gray-600'
  const dotTitle = heat
    ? `Heat: ${HEAT_LABEL[heat.tier] ?? heat.tier} (score ${heat.score}${heat.watcherDelta && heat.watcherDelta > 0 ? ` — +${heat.watcherDelta} watchers` : ''})`
    : undefined

  return (
    <div className="flex items-center gap-1.5">
      {/* Heat indicator dot */}
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`}
        title={dotTitle}
        aria-label={dotTitle}
      />
      <span className="text-xs font-mono text-text-primary">{count ?? '—'}</span>
      {trend && trend.length >= 2 && (
        <Sparkline data={trend} width={40} height={14} />
      )}
      {delta != null && delta !== 0 && (
        <span className={`text-[10px] font-mono ${delta > 0 ? 'text-status-active' : 'text-status-sold'}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  )
}
