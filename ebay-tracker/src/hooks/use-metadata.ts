'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CardMetadata, TitleParseRequest } from '@/types'

// Fetch metadata for a single item
export function useItemMetadata(itemId: string) {
  return useQuery<CardMetadata | null>({
    queryKey: ['metadata', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata?itemId=${itemId}`)
      if (!res.ok) throw new Error('Failed to fetch metadata')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
  })
}

// Trigger parse for a single item
export function useParseMutation() {
  const queryClient = useQueryClient()
  return useMutation<CardMetadata, Error, TitleParseRequest>({
    mutationFn: async (body) => {
      const res = await fetch('/api/metadata/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Parse failed')
      const json = await res.json()
      return json.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', vars.itemId] })
    },
  })
}
