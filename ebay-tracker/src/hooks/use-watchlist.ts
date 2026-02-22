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
  sort?: string
  dir?: string
}

export function useWatchlist(params: UseWatchlistParams = {}) {
  const { status, type, search, offset = 0, limit = 50, sort, dir } = params

  return useQuery<WatchlistResponse>({
    queryKey: ['watchlist', { status, type, search, offset, sort, dir }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (status && status !== 'All') searchParams.set('status', status)
      if (type && type !== 'All') searchParams.set('type', type)
      if (search) searchParams.set('search', search)
      if (offset > 0) searchParams.set('offset', String(offset))
      if (limit) searchParams.set('limit', String(limit))
      if (sort && sort !== 'rank') searchParams.set('sort', sort)
      if (dir && dir !== 'asc') searchParams.set('dir', dir)

      const res = await fetch(`/api/items?${searchParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      const json = await res.json()
      return json.data
    },
    refetchInterval: 60_000,
  })
}
