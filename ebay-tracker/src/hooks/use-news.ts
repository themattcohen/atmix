'use client'

import { useQuery } from '@tanstack/react-query'
import type { NewsDetailPage, NewsDetailParams } from '@/types'

interface NewsResponse {
  data: NewsDetailPage
}

export function useNews(params: NewsDetailParams = {}) {
  return useQuery({
    queryKey: ['news', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.limit != null) searchParams.set('limit', String(params.limit))
      if (params.offset != null) searchParams.set('offset', String(params.offset))
      if (params.source) searchParams.set('source', params.source)
      if (params.status) searchParams.set('status', params.status)
      if (params.playerSearch) searchParams.set('player', params.playerSearch)
      if (params.sortBy) searchParams.set('sortBy', params.sortBy)
      if (params.sortDir) searchParams.set('sortDir', params.sortDir)

      const res = await fetch(`/api/news?${searchParams}`)
      const json: NewsResponse = await res.json()
      return json.data
    },
    refetchInterval: 60_000,
  })
}
