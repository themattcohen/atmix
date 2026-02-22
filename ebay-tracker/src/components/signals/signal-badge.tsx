'use client'

import type { CardSignal } from '@/types'
import { useSignalConfig } from '@/hooks/use-signal-config'
import { Tooltip } from '@/components/ui/tooltip'
import { SignalDetailTooltip } from './signal-detail-tooltip'

interface SignalBadgeProps {
  signal: CardSignal
}

export function SignalBadge({ signal }: SignalBadgeProps) {
  const { data: config } = useSignalConfig()

  const eventConfig = config?.signalConfig[signal.eventType]
  const label = eventConfig?.label ?? signal.eventType.toUpperCase()
  const scoreText = signal.score > 0 ? `+${signal.score}` : String(signal.score)

  // Use per-event colors from config, fallback to simple positive/negative
  const colorClass = eventConfig
    ? `${eventConfig.bgColor} ${eventConfig.color}`
    : signal.score > 0
    ? 'bg-status-active/20 text-status-active'
    : signal.score < 0
    ? 'bg-status-sold/20 text-status-sold'
    : 'bg-raised text-text-secondary'

  return (
    <Tooltip content={<SignalDetailTooltip signal={signal} />} wide>
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide cursor-help ${colorClass}`}
        data-testid="signal-badge"
      >
        {label} {scoreText}
      </span>
    </Tooltip>
  )
}
