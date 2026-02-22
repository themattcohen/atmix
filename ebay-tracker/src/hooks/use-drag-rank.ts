'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WatchlistItem } from '@/types'

interface RankMutationVars {
  itemId: string
  newRank: number
}

export function useDragRank() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, newRank }: RankMutationVars) => {
      const res = await fetch('/api/rank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, newRank }),
      })
      if (!res.ok) throw new Error('Failed to update rank')
      const json = await res.json()
      return json.data
    },
    onMutate: async ({ itemId, newRank }) => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] })

      const previousData = queryClient.getQueryData(['watchlist'])

      queryClient.setQueriesData<{
        ranked: WatchlistItem[]
        unranked: WatchlistItem[]
        counts: Record<string, number>
      }>({ queryKey: ['watchlist'] }, (old) => {
        if (!old) return old

        const allItems = [...old.ranked, ...old.unranked]
        const item = allItems.find((i) => i.id === itemId)
        if (!item) return old

        // Remove item from its current position
        const remaining = allItems.filter((i) => i.id !== itemId)
        const ranked = remaining
          .filter((i) => i.rank !== null)
          .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        const unranked = remaining.filter((i) => i.rank === null)

        // Insert at new rank position (1-based)
        const updatedItem = { ...item, rank: newRank }
        ranked.splice(newRank - 1, 0, updatedItem)

        // Reassign sequential ranks (immutable update for React Query cache)
        const reranked = ranked.map((r, i) => ({ ...r, rank: i + 1 }))

        return { ...old, ranked: reranked, unranked }
      })

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ['watchlist'] }, context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}
