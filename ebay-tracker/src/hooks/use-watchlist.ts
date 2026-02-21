'use client'
import { useQuery } from '@tanstack/react-query'
import type { WatchlistItem } from '@/types'

interface WatchlistResponse {
  ranked: WatchlistItem[]
  unranked: WatchlistItem[]
  counts: { active: number; sold: number; ended: number; total: number }
}

interface UseWatchlistParams {
  status?: string
  type?: string
  search?: string
}

export function useWatchlist(params: UseWatchlistParams = {}) {
  const { status, type, search } = params

  return useQuery<WatchlistResponse>({
    queryKey: ['watchlist', { status, type, search }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (status && status !== 'All') searchParams.set('status', status)
      if (type && type !== 'All') searchParams.set('type', type)
      if (search) searchParams.set('search', search)

      const res = await fetch(`/api/items?${searchParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      const json = await res.json()
      return json.data
    },
    refetchInterval: 60_000,
  })
}
