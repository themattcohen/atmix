'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SyncResult } from '@/types'

export function useSync() {
  const queryClient = useQueryClient()

  return useMutation<SyncResult>({
    mutationFn: async () => {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.status === 409) throw new Error('Sync already in progress')
      if (!res.ok) throw new Error('Sync failed')
      const json = await res.json()
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['trends'] })
      queryClient.invalidateQueries({ queryKey: ['sparklines'] })
    },
  })
}
