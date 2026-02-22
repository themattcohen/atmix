'use client'

import Link from 'next/link'
import { useSignalStats, useSignals } from '@/hooks/use-signals'

export function SignalSummary() {
  const { data: stats } = useSignalStats()
  const { data: recent } = useSignals({ limit: 3, acknowledged: false })

  const unacknowledged = stats?.countUnacknowledged ?? 0
  const previews = recent?.signals ?? []

  return (
    <div className="px-3 py-3" data-testid="signal-summary">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
          Signals
        </h3>
        {unacknowledged > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-accent text-white rounded-full">
            {unacknowledged}
          </span>
        )}
      </div>

      {previews.length === 0 ? (
        <p className="text-[11px] text-text-secondary">No recent signals</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {previews.map((signal) => {
            const isPositive = signal.score > 0
            const scoreColor = isPositive ? 'text-status-active' : 'text-status-sold'

            return (
              <div key={signal.id} className="flex items-start gap-1.5">
                <span className={`text-[10px] font-bold ${scoreColor} shrink-0`}>
                  {isPositive ? '+' : ''}{signal.score}
                </span>
                <p className="text-[11px] text-text-primary truncate">
                  {signal.headline}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/signals"
        className="block mt-2 text-[10px] text-accent hover:text-accent/80 font-medium"
      >
        View all &rarr;
      </Link>
    </div>
  )
}
