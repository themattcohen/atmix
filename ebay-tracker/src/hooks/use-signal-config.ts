'use client'

import { useQuery } from '@tanstack/react-query'
import type { NewsEventType, SourceName } from '@/types'
import type { SignalEventConfig, SignalSourceConfig } from '@/lib/news/signal-config'

interface SignalConfigResponse {
  data: {
    signalConfig: Record<NewsEventType, SignalEventConfig>
    sourceConfig: Record<SourceName, SignalSourceConfig>
    scoringFormula: { sourceWeight: number; classificationWeight: number; matchWeight: number; description: string }
  }
}

export function useSignalConfig() {
  return useQuery({
    queryKey: ['signal-config'],
    queryFn: async () => {
      const res = await fetch('/api/signals/config')
      if (!res.ok) throw new Error(res.statusText)
      const json: SignalConfigResponse = await res.json()
      return json.data
    },
    staleTime: Infinity,
  })
}
