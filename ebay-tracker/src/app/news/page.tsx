'use client'

import { useState } from 'react'
import { useNews } from '@/hooks/use-news'
import { AppShell } from '@/components/layout/app-shell'
import { TopBar } from '@/components/layout/top-bar'
import { NewsStatusBadge } from '@/components/news/news-status-badge'
import { timeAgo } from '@/lib/utils'
import type { SourceName, NewsProcessedStatus } from '@/types'

const PAGE_SIZE = 50

const sourceOptions: { value: SourceName | ''; label: string }[] = [
  { value: '', label: 'All Sources' },
  { value: 'rotowire_rss', label: 'RotoWire' },
  { value: 'mlb_transactions', label: 'MLB Transactions' },
  { value: 'google_news_rss', label: 'Google News' },
  { value: 'espn_rss', label: 'ESPN' },
]

const statusOptions: { value: NewsProcessedStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'matched', label: 'Matched' },
  { value: 'ai_fallback', label: 'AI Fallback' },
  { value: 'no_match', label: 'No Match' },
  { value: 'pending', label: 'Pending' },
]

const sourceLabels: Record<SourceName, string> = {
  rotowire_rss: 'RotoWire',
  mlb_transactions: 'MLB',
  google_news_rss: 'Google',
  espn_rss: 'ESPN',
}

export default function NewsPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceName | ''>('')
  const [statusFilter, setStatusFilter] = useState<NewsProcessedStatus | ''>('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useNews({
    limit: PAGE_SIZE,
    offset,
    source: sourceFilter || undefined,
    status: statusFilter || undefined,
    playerSearch: playerSearch || undefined,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const handleFilterChange = () => setOffset(0)

  return (
    <>
      <TopBar />
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-6" data-testid="news-page">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-text-primary">News Pipeline</h1>
            <span className="text-xs text-text-secondary">{total} items</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-surface border border-border rounded-lg">
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value as SourceName | ''); handleFilterChange() }}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary"
            >
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as NewsProcessedStatus | ''); handleFilterChange() }}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => { setPlayerSearch(e.target.value); handleFilterChange() }}
              placeholder="Search player..."
              className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary w-40"
            />
          </div>

          {/* Feed */}
          <div data-testid="news-feed">
            {isLoading ? (
              <div className="flex flex-col gap-1">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-14 bg-surface border border-border rounded animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-text-secondary">No news items found</p>
                <p className="text-xs text-text-secondary mt-1">
                  Headlines appear here as the news pipeline fetches them
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 bg-surface border border-border rounded hover:bg-raised transition-colors"
                    data-testid="news-item"
                  >
                    {/* Row 1: headline + time */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-text-primary leading-snug">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </span>
                      <span className="text-[10px] text-text-secondary whitespace-nowrap shrink-0">
                        {timeAgo(item.fetchedAt)}
                      </span>
                    </div>

                    {/* Row 2: source + status + players + signals */}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 font-medium">
                        {sourceLabels[item.source]}
                      </span>
                      <NewsStatusBadge status={item.processedStatus} method={item.extractionMethod} />
                      {item.mentions.length > 0 && (
                        <span className="text-[10px] text-text-secondary">
                          {item.mentions.map((m) => m.playerName).join(', ')}
                        </span>
                      )}
                      {item.signals.length > 0 && (
                        <span className="text-[10px] text-amber-400">
                          {item.signals.length} signal{item.signals.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border text-text-primary hover:bg-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-[10px] text-text-secondary">
                {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1.5 text-xs font-medium rounded bg-surface border border-border text-text-primary hover:bg-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </AppShell>
    </>
  )
}
