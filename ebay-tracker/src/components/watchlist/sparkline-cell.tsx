'use client'
import type { SparklineSummary } from '@/types'
import { Sparkline } from '@/components/ui/sparkline'
import { Tooltip } from '@/components/ui/tooltip'

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
    return (
      <Tooltip content="Price history builds after two or more syncs. Sync again to see the sparkline." wide>
        <span className="text-xs text-text-secondary cursor-help border-b border-dashed border-text-secondary/40">—</span>
      </Tooltip>
    )
  }

  // Extract price values from SparklinePoint array for the SVG component
  const priceSeries = summary.points.map(p => p.priceCents)

  return (
    <div className="cursor-crosshair" title="Hover to see price history">
      <Sparkline
        data={priceSeries}
        width={72}
        height={22}
        showMinMax
        showTooltip
      />
    </div>
  )
}
