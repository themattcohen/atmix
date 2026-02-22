'use client'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'

interface PriceCellProps {
  priceCents: number
  deltaPct?: number | null
}

export function PriceCell({ priceCents, deltaPct }: PriceCellProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-text-primary">{formatCents(priceCents)}</span>
      {deltaPct != null && deltaPct !== 0 && (
        <Badge variant={deltaPct < 0 ? 'success' : 'danger'} size="sm">
          {deltaPct < 0 ? '\u2193' : '\u2191'}{Math.abs(deltaPct).toFixed(1)}%
        </Badge>
      )}
    </div>
  )
}
