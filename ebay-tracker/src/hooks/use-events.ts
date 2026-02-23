'use client'
import { useQuery } from '@tanstack/react-query'
import type { WatchlistEvent, EventType } from '@/types'
import { POLL_FAST_MS } from '@/lib/poll-intervals'

interface UseEventsParams {
  type?: EventType
  itemId?: string
  limit?: number
}

export function useEvents(params: UseEventsParams = {}) {
  const { type, itemId, limit = 50 } = params

  return useQuery<WatchlistEvent[]>({
    queryKey: ['events', { type, itemId, limit }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (type) searchParams.set('type', type)
      if (itemId) searchParams.set('itemId', itemId)
      searchParams.set('limit', String(limit))

      const res = await fetch(`/api/events?${searchParams.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch events')
      const json = await res.json()
      return json.data
    },
    refetchInterval: POLL_FAST_MS,
    refetchIntervalInBackground: false,
  })
}
