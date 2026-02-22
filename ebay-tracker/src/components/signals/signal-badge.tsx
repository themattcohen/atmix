'use client'

import type { CardSignal } from '@/types'

interface SignalBadgeProps {
  signal: CardSignal
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    callup: 'CALLUP',
    injury_minor: 'INJURY',
    injury_season: 'INJURY',
    trade_up: 'TRADE',
    trade_down: 'TRADE',
    award: 'AWARD',
    breakout: 'BREAKOUT',
    suspension: 'SUSPEND',
    optioned: 'OPTION',
    release: 'RELEASE',
    return_injury: 'RETURN',
    contract: 'CONTRACT',
    retirement: 'RETIRE',
  }
  return labels[eventType] || eventType.toUpperCase()
}

export function SignalBadge({ signal }: SignalBadgeProps) {
  const isPositive = signal.score > 0
  const isNegative = signal.score < 0
  const label = getEventLabel(signal.eventType)
  const scoreText = isPositive ? `+${signal.score}` : String(signal.score)

  const colorClass = isPositive
    ? 'bg-status-active/20 text-status-active'
    : isNegative
    ? 'bg-status-sold/20 text-status-sold'
    : 'bg-raised text-text-secondary'

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${colorClass}`}
      data-testid="signal-badge"
      title={signal.headline}
    >
      {label} {scoreText}
    </span>
  )
}
