'use client'

interface StatsCardProps {
  label: string
  value: string
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
}

export function StatsCard({ label, value, delta, deltaType = 'neutral' }: StatsCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-delta-drop'
      : deltaType === 'negative'
        ? 'text-delta-rise'
        : 'text-text-secondary'

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="stats-card">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      {delta && (
        <p className={`text-xs mt-0.5 ${deltaColor}`}>{delta}</p>
      )}
    </div>
  )
}
