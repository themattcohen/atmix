'use client'

import { useState } from 'react'
import { useSignals, useSignalStats, useAcknowledgeSignal } from '@/hooks/use-signals'
import { SignalBadge } from '@/components/signals/signal-badge'
import type { NewsEventType } from '@/types'

const EVENT_TYPE_OPTIONS: { value: NewsEventType | ''; label: string }[] = [
  { value: '', label: 'All Events' },
  { value: 'callup', label: 'Callup' },
  { value: 'injury_minor', label: 'Injury (Minor)' },
  { value: 'injury_season', label: 'Injury (Season)' },
  { value: 'trade_up', label: 'Trade (Up)' },
  { value: 'trade_down', label: 'Trade (Down)' },
  { value: 'award', label: 'Award' },
  { value: 'breakout', label: 'Breakout' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'optioned', label: 'Optioned' },
  { value: 'release', label: 'Release' },
  { value: 'return_injury', label: 'Return from Injury' },
  { value: 'contract', label: 'Contract' },
  { value: 'retirement', label: 'Retirement' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function SignalsPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState<NewsEventType | ''>('')
  const [minScore, setMinScore] = useState(0)
  const [showAcknowledged, setShowAcknowledged] = useState(false)

  const { data, isLoading } = useSignals({
    limit: 100,
    eventType: eventTypeFilter || undefined,
    minScore: minScore || undefined,
    acknowledged: showAcknowledged ? undefined : false,
  })

  const { data: stats } = useSignalStats()
  const acknowledgeMutation = useAcknowledgeSignal()

  const signals = data?.signals ?? []
  const total = data?.total ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" data-testid="signals-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text-primary">Player Signals</h1>
        {stats && (
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>{stats.countToday} today</span>
            <span>{stats.countUnacknowledged} unread</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-surface border border-border rounded-lg">
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value as NewsEventType | '')}
          className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary"
        >
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-text-secondary uppercase tracking-wider">
            Min Score
          </label>
          <input
            type="range"
            min={0}
            max={3}
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
            className="w-20"
          />
          <span className="text-xs text-text-primary font-mono w-4">{minScore}</span>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
            className="rounded border-border"
          />
          Show acknowledged
        </label>
      </div>

      {/* Signal feed */}
      <div data-testid="signal-feed">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-text-secondary">Loading signals...</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">No signals found</p>
            <p className="text-xs text-text-secondary mt-1">
              Signals appear when player news matches your watchlist cards
            </p>
          </div>
        ) : (
          <>
            <div className="text-[10px] text-text-secondary mb-2">{total} total signals</div>
            <div className="flex flex-col gap-1">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded hover:bg-raised transition-colors"
                  data-testid="signal-item"
                >
                  <SignalBadge signal={signal} />

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">{signal.headline}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-secondary">
                        {Math.round(signal.confidence * 100)}%
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {signal.source.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {timeAgo(signal.createdAt)}
                      </span>
                    </div>
                  </div>

                  {!signal.acknowledged && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(signal.id)}
                      className="text-[10px] text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-background transition-colors shrink-0"
                      disabled={acknowledgeMutation.isPending}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
