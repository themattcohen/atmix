'use client'
import { Badge } from '@/components/ui/badge'

interface PriceCellProps {
  priceCents: number
  deltaPct?: number | null
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function PriceCell({ priceCents, deltaPct }: PriceCellProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-text-primary">{formatPrice(priceCents)}</span>
      {deltaPct != null && deltaPct !== 0 && (
        <Badge variant={deltaPct < 0 ? 'success' : 'danger'} size="sm">
          {deltaPct < 0 ? '\u2193' : '\u2191'}{Math.abs(deltaPct).toFixed(1)}%
        </Badge>
      )}
    </div>
  )
}
