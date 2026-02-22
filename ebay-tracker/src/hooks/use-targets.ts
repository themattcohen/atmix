'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PriceTarget, CreateTargetInput, UpdateTargetInput } from '@/types'

export function useTargets(itemId?: string) {
  const qc = useQueryClient()

  const query = useQuery<PriceTarget[]>({
    queryKey: ['targets', { itemId }],
    queryFn: async () => {
      const url = itemId
        ? `/api/targets?itemId=${encodeURIComponent(itemId)}`
        : '/api/targets'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch targets')
      return (await res.json()).data
    },
    refetchInterval: 30_000,
  })

  const create = useMutation({
    mutationFn: async (input: CreateTargetInput) => {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to create target')
      }
      return (await res.json()).data as PriceTarget
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: UpdateTargetInput['action'] }) => {
      const res = await fetch(`/api/targets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to update target')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to delete target')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  return { ...query, create, update, remove }
}
