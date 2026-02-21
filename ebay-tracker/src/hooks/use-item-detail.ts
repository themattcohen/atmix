'use client'
import { useQuery } from '@tanstack/react-query'
import type { WatchlistItem, PriceSnapshot, WatchlistEvent } from '@/types'

interface ItemDetailResponse {
  item: WatchlistItem
  snapshots: PriceSnapshot[]
  events: WatchlistEvent[]
}

export function useItemDetail(itemId: string) {
  return useQuery<ItemDetailResponse>({
    queryKey: ['item', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/items/${itemId}`)
      if (!res.ok) throw new Error('Failed to fetch item detail')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
  })
}
