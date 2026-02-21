'use client'
import { Sparkline } from '@/components/ui/sparkline'

interface WatcherCellProps {
  count: number | null
  trend?: number[]
  delta?: number | null
}

export function WatcherCell({ count, trend, delta }: WatcherCellProps) {
  return (
    <div className="flex items-center gap-1.5">
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
