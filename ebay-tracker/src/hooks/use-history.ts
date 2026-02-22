'use client'
import { useQuery } from '@tanstack/react-query'
import type { OHLCDataPoint, HistoricalSummary, RollupPeriod } from '@/types'

// ── useHistory ───────────────────────────────────────────────────────────────

interface UseHistoryParams {
  itemId: string
  period: RollupPeriod
  from?: string   // ISO date 'YYYY-MM-DD', inclusive lower bound
  to?: string     // ISO date 'YYYY-MM-DD', inclusive upper bound
}

/**
 * Fetch OHLC data points for a single item and period.
 * Data is refetched at most once per hour — rollups only change after
 * the nightly cron job at 00:05 UTC.
 */
export function useHistory({ itemId, period, from, to }: UseHistoryParams) {
  return useQuery<OHLCDataPoint[]>({
    queryKey: ['history', itemId, period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (from) params.set('from', from)
      if (to)   params.set('to', to)
      const res = await fetch(`/api/history/${itemId}?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch price history')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
    staleTime: 60 * 60 * 1000,  // 1 hour — rollups are updated nightly
  })
}

// ── useHistorySummary ────────────────────────────────────────────────────────

/**
 * Fetch all-time historical summary statistics for a single item.
 * Returns null when no rollup data exists yet (first day of tracking).
 */
export function useHistorySummary(itemId: string) {
  return useQuery<HistoricalSummary>({
    queryKey: ['history-summary', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/history/${itemId}/summary`)
      if (!res.ok) throw new Error('Failed to fetch history summary')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
    staleTime: 60 * 60 * 1000,
    retry: (failureCount, error: any) => {
      // Do not retry 404 — item genuinely has no rollup data yet
      if (error?.message?.includes('404')) return false
      return failureCount < 2
    },
  })
}
