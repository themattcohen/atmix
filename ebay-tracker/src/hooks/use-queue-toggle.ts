'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useQueueToggle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, isInQueue }: { itemId: string; isInQueue: boolean }) => {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isInQueue }),
      })
      if (!res.ok) throw new Error('Failed to toggle queue')
      const json = await res.json()
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}
