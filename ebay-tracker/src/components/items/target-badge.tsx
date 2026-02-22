'use client'

interface TargetBadgeProps {
  activeCount:    number
  triggeredCount: number
  onClick?:       () => void
}

/**
 * Inline badge that appears on item rows when price targets are set.
 * Shows triggered targets (orange, pulsing) with higher visual priority
 * than active targets (teal/muted). Returns null when both counts are zero.
 */
export function TargetBadge({ activeCount, triggeredCount, onClick }: TargetBadgeProps) {
  if (triggeredCount === 0 && activeCount === 0) return null

  if (triggeredCount > 0) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-urgency-caution/20 text-urgency-caution hover:bg-urgency-caution/30 transition-colors"
        title={`${triggeredCount} target${triggeredCount !== 1 ? 's' : ''} triggered`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-urgency-caution opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-urgency-caution" />
        </span>
        {triggeredCount}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-raised text-text-secondary hover:text-text-primary transition-colors"
      title={`${activeCount} active target${activeCount !== 1 ? 's' : ''}`}
    >
      <span>🎯</span>
      {activeCount}
    </button>
  )
}
