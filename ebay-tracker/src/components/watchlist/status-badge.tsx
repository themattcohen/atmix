'use client'
import { Badge } from '@/components/ui/badge'
import type { ListingStatus } from '@/types'

interface StatusBadgeProps {
  status: ListingStatus
}

const statusVariant: Record<ListingStatus, 'success' | 'danger' | 'default' | 'info'> = {
  Active: 'success',
  Sold: 'danger',
  Ended: 'default',
  Relisted: 'info',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} size="sm">
      {status}
    </Badge>
  )
}
