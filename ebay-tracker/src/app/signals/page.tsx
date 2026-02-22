'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSignals, useSignalStats, useAcknowledgeSignal } from '@/hooks/use-signals'
import { useSignalConfig } from '@/hooks/use-signal-config'
import { AppShell } from '@/components/layout/app-shell'
import { TopBar } from '@/components/layout/top-bar'
import { SignalBadge } from '@/components/signals/signal-badge'
import { timeAgo } from '@/lib/utils'
import type { NewsEventType } from '@/types'

export default function SignalsPage() {
  const { data: signalConfig } = useSignalConfig()

  const eventTypeOptions: { value: NewsEventType | ''; label: string }[] = [
    { value: '' as const, label: 'All Events' },
    ...Object.entries(signalConfig?.signalConfig ?? {}).map(([key, cfg]) => ({
      value: key as NewsEventType,
      label: cfg.labelLong,
    })),
  ]

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

  const rawSignals = data?.signals ?? []
  const signals = showAcknowledged ? rawSignals : rawSignals.filter((s) => !s.acknowledged)
  const total = data?.total ?? 0

  return (
    <>
      <TopBar />
      <AppShell>
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
          {eventTypeOptions.map((opt) => (
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
                  className={`flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded hover:bg-raised transition-colors${signal.acknowledged ? ' opacity-50' : ''}`}
                  data-testid="signal-item"
                >
                  <SignalBadge signal={signal} />

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/items/${signal.itemId}`}
                      className="text-xs text-text-primary truncate block hover:underline"
                    >
                      {signal.headline}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-secondary">
                        {Math.round(signal.confidence * 100)}%
                      </span>
                      {signal.sourceUrl ? (
                        <a
                          href={signal.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-text-secondary hover:underline"
                        >
                          {signal.source}
                        </a>
                      ) : (
                        <span className="text-[10px] text-text-secondary">
                          {signal.source}
                        </span>
                      )}
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
                      data-testid="dismiss-signal"
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
      </AppShell>
    </>
  )
}
