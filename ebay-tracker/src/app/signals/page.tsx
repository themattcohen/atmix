'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSignals, useSignalStats, useAcknowledgeSignal } from '@/hooks/use-signals'
import { useSignalConfig } from '@/hooks/use-signal-config'
import { AppShell } from '@/components/layout/app-shell'
import { TopBar } from '@/components/layout/top-bar'
import { ErrorState } from '@/components/watchlist/error-state'
import { SignalBadge } from '@/components/signals/signal-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/utils'
import { PageExplainer } from '@/components/ui/page-explainer'
import { SignalExplainer } from '@/components/signals/signal-explainer'
import type { CardSignal, NewsEventType } from '@/types'

interface SignalGroup {
  newsItemId: number
  signals: CardSignal[]
  latestCreatedAt: string
}

function groupSignals(signals: CardSignal[]): SignalGroup[] {
  const map = new Map<number, CardSignal[]>()
  for (const signal of signals) {
    const existing = map.get(signal.newsItemId)
    if (existing) {
      existing.push(signal)
    } else {
      map.set(signal.newsItemId, [signal])
    }
  }
  const groups: SignalGroup[] = []
  for (const [newsItemId, sigs] of map.entries()) {
    const latestCreatedAt = sigs.reduce((latest, s) =>
      s.createdAt > latest ? s.createdAt : latest, sigs[0].createdAt
    )
    groups.push({ newsItemId, signals: sigs, latestCreatedAt })
  }
  // sort by most recent signal
  groups.sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt))
  return groups
}

function SingleSignalRow({
  signal,
  acknowledgeMutation,
}: {
  signal: CardSignal
  acknowledgeMutation: ReturnType<typeof useAcknowledgeSignal>
}) {
  return (
    <div
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
          <Tooltip content="Signal confidence score — higher means more reliable">
            <span className="text-[10px] text-text-secondary cursor-help">
              conf {Math.round(signal.confidence * 100)}%
            </span>
          </Tooltip>
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
          className="border border-border px-2 py-0.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface transition-colors shrink-0"
          disabled={acknowledgeMutation.isPending}
          data-testid="dismiss-signal"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}

function GroupedSignalRow({
  group,
  acknowledgeMutation,
}: {
  group: SignalGroup
  acknowledgeMutation: ReturnType<typeof useAcknowledgeSignal>
}) {
  const [expanded, setExpanded] = useState(false)
  const representative = group.signals[0]
  const count = group.signals.length
  const allAcknowledged = group.signals.every((s) => s.acknowledged)

  return (
    <div
      className={`bg-surface border border-border rounded${allAcknowledged ? ' opacity-50' : ''}`}
      data-testid="signal-item"
    >
      {/* Main grouped row */}
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-raised transition-colors">
        <SignalBadge signal={representative} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-primary truncate">
              {representative.headline}
            </span>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/10 border border-accent/30 rounded text-[10px] text-accent font-medium hover:bg-accent/20 transition-colors"
              data-testid="affects-badge"
            >
              Affects {count} cards {expanded ? '▲' : '▼'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Tooltip content="Signal confidence score — higher means more reliable">
              <span className="text-[10px] text-text-secondary cursor-help">
                conf {Math.round(representative.confidence * 100)}%
              </span>
            </Tooltip>
            {representative.sourceUrl ? (
              <a
                href={representative.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-text-secondary hover:underline"
              >
                {representative.source}
              </a>
            ) : (
              <span className="text-[10px] text-text-secondary">
                {representative.source}
              </span>
            )}
            <span className="text-[10px] text-text-secondary">
              {timeAgo(representative.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded list of affected cards */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
          {group.signals.map((signal) => (
            <div
              key={signal.id}
              className={`flex items-center gap-2${signal.acknowledged ? ' opacity-50' : ''}`}
            >
              <Link
                href={`/items/${signal.itemId}`}
                className="flex-1 text-xs text-text-primary hover:underline truncate"
              >
                Card #{signal.itemId}
              </Link>
              {!signal.acknowledged && (
                <button
                  onClick={() => acknowledgeMutation.mutate(signal.id)}
                  className="border border-border px-2 py-0.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-raised transition-colors shrink-0"
                  disabled={acknowledgeMutation.isPending}
                  data-testid="dismiss-signal"
                >
                  Dismiss
                </button>
              )}
              {signal.acknowledged && (
                <span className="text-[10px] text-text-secondary shrink-0">Dismissed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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

  const { data, isLoading, isError, refetch } = useSignals({
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

  const hasFilters = eventTypeFilter !== '' || minScore > 0 || showAcknowledged

  const groups = groupSignals(signals)

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

      <PageExplainer text="Signals fire when sports news — trades, call-ups, injuries, awards — matches a player on one of your watchlist cards. Each signal has a score reflecting its impact. Signals expire automatically over time. Use the filters to narrow by event type or score." />

      <SignalExplainer />

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
        {isError ? (
          <ErrorState message="Failed to load signals" onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="text-center py-8 text-xs text-text-secondary">Loading signals...</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-8">
            {hasFilters ? (
              <>
                <p className="text-sm text-text-secondary">No signals match your current filters</p>
                <p className="text-xs text-text-secondary mt-1">
                  Try lowering the minimum score or selecting &ldquo;All Events&rdquo;.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">No signals yet</p>
                <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                  Signals are generated when sports news matches a player on a card in your watchlist. This requires cards with a detected player name, a populated roster, and an active news pipeline.
                </p>
                <Link
                  href="/news"
                  className="inline-block mt-3 text-xs font-medium text-accent hover:underline"
                >
                  View news pipeline &rarr;
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="text-[10px] text-text-secondary mb-2">{total} total signals</div>
            <div className="flex flex-col gap-1">
              {groups.map((group) =>
                group.signals.length === 1 ? (
                  <SingleSignalRow
                    key={group.signals[0].id}
                    signal={group.signals[0]}
                    acknowledgeMutation={acknowledgeMutation}
                  />
                ) : (
                  <GroupedSignalRow
                    key={group.newsItemId}
                    group={group}
                    acknowledgeMutation={acknowledgeMutation}
                  />
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
      </AppShell>
    </>
  )
}
