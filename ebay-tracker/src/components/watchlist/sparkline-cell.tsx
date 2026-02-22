'use client'
import type { SparklineSummary } from '@/types'
import { Sparkline } from '@/components/ui/sparkline'

interface SparklineCellProps {
  summary: SparklineSummary | undefined
  isLoading: boolean
}

export function SparklineCell({ summary, isLoading }: SparklineCellProps) {
  if (isLoading) {
    return (
      <div className="w-[72px] h-[22px] rounded bg-raised animate-pulse" />
    )
  }

  if (!summary || summary.points.length < 2) {
    return <span className="text-xs text-text-secondary">—</span>
  }

  // Extract price values from SparklinePoint array for the SVG component
  const priceSeries = summary.points.map(p => p.priceCents)

  return (
    <Sparkline
      data={priceSeries}
      width={72}
      height={22}
      showMinMax
      showTooltip
    />
  )
}
