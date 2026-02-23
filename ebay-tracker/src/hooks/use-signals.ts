'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CardSignal, SourceHealth, NewsEventType } from '@/types'
import { POLL_SLOW_MS } from '@/lib/poll-intervals'

interface SignalParams {
  limit?: number
  offset?: number
  itemId?: string
  eventType?: NewsEventType
  minScore?: number
  acknowledged?: boolean
}

interface SignalsResponse {
  data: {
    signals: CardSignal[]
    total: number
  }
}

interface SignalStatsResponse {
  data: {
    countToday: number
    countUnacknowledged: number
    sourceHealth: SourceHealth[]
  }
}

export function useSignals(params: SignalParams = {}) {
  return useQuery({
    queryKey: ['signals', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.limit != null) searchParams.set('limit', String(params.limit))
      if (params.offset != null) searchParams.set('offset', String(params.offset))
      if (params.itemId) searchParams.set('itemId', params.itemId)
      if (params.eventType) searchParams.set('eventType', params.eventType)
      if (params.minScore != null) searchParams.set('minScore', String(params.minScore))
      if (params.acknowledged != null) searchParams.set('acknowledged', String(params.acknowledged))

      const res = await fetch(`/api/signals?${searchParams}`)
      if (!res.ok) throw new Error(res.statusText)
      const json: SignalsResponse = await res.json()
      return json.data
    },
    refetchInterval: POLL_SLOW_MS,
    refetchIntervalInBackground: false,
  })
}

export function useSignalStats() {
  return useQuery({
    queryKey: ['signal-stats'],
    queryFn: async () => {
      const res = await fetch('/api/signals/stats')
      if (!res.ok) throw new Error(res.statusText)
      const json: SignalStatsResponse = await res.json()
      return json.data
    },
    refetchInterval: POLL_SLOW_MS,
    refetchIntervalInBackground: false,
  })
}

export function useAcknowledgeSignal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (signalId: number) => {
      const res = await fetch(`/api/signals/${signalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Failed to acknowledge signal' } }))
        throw new Error(err.error?.message || 'Failed to acknowledge signal')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      queryClient.invalidateQueries({ queryKey: ['signal-stats'] })
    },
  })
}
