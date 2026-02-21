'use client'
import { useCountdown } from '@/hooks/use-countdown'

interface CountdownCellProps {
  endTime: string | null
}

const urgencyColors = {
  normal: 'text-urgency-normal',
  caution: 'text-urgency-caution',
  urgent: 'text-status-sold',
  critical: 'text-status-sold animate-pulse-urgent',
}

export function CountdownCell({ endTime }: CountdownCellProps) {
  const { timeLeft, urgency } = useCountdown(endTime)

  return (
    <span className={`text-xs font-mono whitespace-nowrap ${urgencyColors[urgency]}`}>
      {timeLeft}
    </span>
  )
}
