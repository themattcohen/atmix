'use client'
import { useQuery } from '@tanstack/react-query'
import type { SparklineSummary } from '@/types'

interface SparklinesResponse {
  summaries: SparklineSummary[]
  days: number
}

export function useSparklines(itemIds: string[], days: 7 | 14 | 30 = 7) {
  // Stable query key: sort IDs so reordering the table doesn't invalidate cache
  const sortedIds = [...itemIds].sort()

  return useQuery<Map<string, SparklineSummary>>({
    queryKey: ['sparklines', sortedIds, days],
    queryFn: async () => {
      if (sortedIds.length === 0) return new Map()

      const ids = sortedIds.join(',')
      const res = await fetch(`/api/snapshots?ids=${ids}&days=${days}`)
      if (!res.ok) throw new Error('Failed to fetch sparklines')
      const json = await res.json() as { data: SparklinesResponse }

      // Index by itemId for O(1) lookup in each row
      const map = new Map<string, SparklineSummary>()
      for (const summary of json.data.summaries) {
        map.set(summary.itemId, summary)
      }
      return map
    },
    // Sparklines don't need to be as fresh as item prices.
    // Sync runs at most every 15 minutes, so 5-minute stale time is fine.
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes after the component unmounts
    gcTime: 10 * 60 * 1000,
    // Don't hammer the API if the component remounts quickly
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: sortedIds.length > 0,
  })
}
