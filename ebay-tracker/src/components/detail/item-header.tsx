'use client'
import { useState } from 'react'
import type { WatchlistItem } from '@/types'
import { Badge } from '@/components/ui/badge'

interface ItemHeaderProps {
  item: WatchlistItem
}

const statusVariants: Record<string, 'success' | 'danger' | 'default' | 'info'> = {
  Active: 'success',
  Sold: 'danger',
  Ended: 'default',
  Relisted: 'info',
}

export function ItemHeader({ item }: ItemHeaderProps) {
  const [notes, setNotes] = useState(item.notes ?? '')

  const handleBlur = () => {
    if (notes === (item.notes ?? '')) return
    fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  }

  return (
    <div className="space-y-3" data-testid="item-header">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary leading-tight">{item.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusVariants[item.status] ?? 'default'} size="md">
              {item.status}
            </Badge>
            {item.listingUrl && (
              <a
                href={item.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View on eBay
              </a>
            )}
          </div>
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add notes..."
        rows={2}
        className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary outline-none focus:border-accent resize-none"
      />
    </div>
  )
}
