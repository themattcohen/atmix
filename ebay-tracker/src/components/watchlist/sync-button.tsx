'use client'
import { useState, useEffect } from 'react'
import { useSync } from '@/hooks/use-sync'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/format'
import { POLL_FAST_MS } from '@/lib/poll-intervals'

export function SyncButton() {
  const syncMutation = useSync()
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Update the "X ago" display every POLL_FAST_MS
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), POLL_FAST_MS)
    return () => clearInterval(interval)
  }, [])

  const handleSync = () => {
    setError(null)
    syncMutation.mutate(undefined, {
      onSuccess: () => setLastSynced(new Date()),
      onError: (err) => setError(err instanceof Error ? err.message : 'Sync failed'),
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-[10px] text-status-sold">{error}</span>
      )}
      <span className="text-[10px] text-text-secondary hidden sm:inline">
        {lastSynced ? `Synced ${timeAgo(lastSynced)}` : ''}
      </span>
      <Tooltip content={syncMutation.isPending ? 'Syncing...' : 'Sync watchlist now'}>
        <Button
          variant="ghost"
          size="sm"
          loading={syncMutation.isPending}
          onClick={handleSync}
          aria-label="Sync watchlist"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Sync</span>
        </Button>
      </Tooltip>
    </div>
  )
}
