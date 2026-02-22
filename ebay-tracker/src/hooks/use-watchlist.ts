'use client'
import { useQuery } from '@tanstack/react-query'
import type { WatchlistItem, HeatIndex } from '@/types'

interface WatchlistResponse {
  ranked: WatchlistItem[]
  unranked: WatchlistItem[]
  unrankedTotal: number
  counts: { active: number; sold: number; ended: number; total: number }
  heatIndex?: Record<string, HeatIndex>
}

interface UseWatchlistParams {
  status?: string
  type?: string
  search?: string
  offset?: number
  limit?: number
}

export function useWatchlist(params: UseWatchlistParams = {}) {
  const { status, type, search, offset = 0, limit = 50 } = params

  return useQuery<WatchlistResponse>({
    queryKey: ['watchlist', { status, type, search, offset }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (status && status !== 'All') searchParams.set('status', status)
      if (type && type !== 'All') searchParams.set('type', type)
      if (search) searchParams.set('search', search)
      if (offset > 0) searchParams.set('offset', String(offset))
      if (limit !== 50) searchParams.set('limit', String(limit))

      const res = await fetch(`/api/items?${searchParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      const json = await res.json()
      return json.data
    },
    refetchInterval: 60_000,
  })
}
