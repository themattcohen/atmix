'use client'
import { useQuery } from '@tanstack/react-query'
import type { TrendStats, PortfolioDataPoint, WatchlistItem } from '@/types'

interface TrendsResponse {
  stats: TrendStats
  portfolio: PortfolioDataPoint[]
  topPriceDrops: WatchlistItem[]
  topWatcherGains: WatchlistItem[]
  endingSoon: WatchlistItem[]
}

export function useTrends(range: '7d' | '30d' | '90d' = '7d') {
  return useQuery<TrendsResponse>({
    queryKey: ['trends', range],
    queryFn: async () => {
      const res = await fetch(`/api/trends?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch trends')
      const json = await res.json()
      return json.data
    },
  })
}
