'use client'
import { useQuery } from '@tanstack/react-query'

export function useWatcherSeries(itemIds: string[], days = 14) {
  return useQuery<Record<string, number[]>>({
    queryKey: ['watcher-series', itemIds, days],
    queryFn: async () => {
      if (itemIds.length === 0) return {}
      const params = new URLSearchParams({
        ids: itemIds.join(','),
        days: String(days),
      })
      const res = await fetch(`/api/watcher-series?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch watcher series')
      const json = await res.json()
      return json.data
    },
    enabled: itemIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
