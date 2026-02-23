'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNews } from '@/hooks/use-news'
import { AppShell } from '@/components/layout/app-shell'
import { TopBar } from '@/components/layout/top-bar'
import { NewsStatusBadge } from '@/components/news/news-status-badge'
import { ErrorState } from '@/components/watchlist/error-state'
import { useNewsStore, type NewsSortKey } from '@/store/news-store'
import { SIGNAL_CONFIG } from '@/lib/news/signal-config'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/utils'
import { PageExplainer } from '@/components/ui/page-explainer'
import type { SourceName, NewsProcessedStatus, NewsItemDetail, NewsItemSignalDetail } from '@/types'

const PAGE_SIZE = 50

const sourceOptions: { value: SourceName | ''; label: string }[] = [
  { value: '', label: 'All Sources' },
  { value: 'rotowire_rss', label: 'RotoWire' },
  { value: 'mlb_transactions', label: 'MLB Transactions' },
  { value: 'google_news_rss', label: 'Google News' },
  { value: 'espn_rss', label: 'ESPN' },
  { value: 'cbs_sports_rss', label: 'CBS Sports' },
  { value: 'rotoballer_rss', label: 'RotoBaller' },
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
  cbs_sports_rss: 'CBS',
  rotoballer_rss: 'Roto',
}

const sourceColors: Record<SourceName, string> = {
  rotowire_rss: 'bg-emerald-500/15 text-emerald-400',
  mlb_transactions: 'bg-blue-500/15 text-blue-400',
  google_news_rss: 'bg-orange-500/15 text-orange-400',
  espn_rss: 'bg-red-500/15 text-red-400',
  cbs_sports_rss: 'bg-purple-500/15 text-purple-400',
  rotoballer_rss: 'bg-teal-500/15 text-teal-400',
}

const columnLabels: Record<string, string> = {
  fetchedAt: 'Time',
  source: 'Source',
  title: 'Headline',
  status: 'Status',
  method: 'Method',
  mentions: 'Players',
  confidence: 'Conf%',
  eventType: 'Event',
  score: 'Score',
  keyword: 'Keyword',
  decay: 'Decay',
  signalCount: 'Signals#',
}

// Columns that support server-side sorting
const SORTABLE_COLUMNS: Record<string, NewsSortKey> = {
  fetchedAt: 'fetched_at',
  source: 'source',
  status: 'status',
  mentions: 'mentions',
  signalCount: 'signals',
}

/* ------------------------------------------------------------------ */
/*  ResizableTh                                                        */
/* ------------------------------------------------------------------ */

function ResizableTh({
  colKey,
  children,
  className = '',
}: {
  colKey: string
  children?: React.ReactNode
  className?: string
}) {
  const width = useNewsStore((s) => s.columnWidths[colKey])
  const setColumnWidth = useNewsStore((s) => s.setColumnWidth)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startX.current = e.clientX
      startW.current = width ?? 80

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current
        setColumnWidth(colKey, startW.current + delta)
      }
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [colKey, width, setColumnWidth]
  )

  return (
    <th
      className={`relative ${className}`}
      style={{ width: width ? `${width}px` : undefined }}
    >
      {children}
      <span
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 bottom-0 w-0.5 bg-border/30 hover:bg-accent/60 cursor-col-resize transition-colors z-10"
      />
    </th>
  )
}

/* ------------------------------------------------------------------ */
/*  SortableHeader                                                     */
/* ------------------------------------------------------------------ */

function SortableHeader({
  colKey,
  label,
}: {
  colKey: string
  label: string
}) {
  const sortKey = SORTABLE_COLUMNS[colKey]
  const sortBy = useNewsStore((s) => s.sortBy)
  const sortDir = useNewsStore((s) => s.sortDir)
  const setSortAndDir = useNewsStore((s) => s.setSortAndDir)

  if (!sortKey) {
    return <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">{label}</span>
  }

  const isActive = sortBy === sortKey
  const arrow = isActive ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'
  const arrowClass = isActive ? 'text-accent' : 'text-text-secondary/50'

  const handleClick = () => {
    if (isActive) {
      setSortAndDir(sortKey, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortAndDir(sortKey, 'desc')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-0.5 hover:text-text-primary transition-colors cursor-pointer text-[10px] font-medium text-text-secondary uppercase tracking-wide"
    >
      {label}
      <span className={`text-[9px] ${arrowClass}`}>{arrow}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  NewsColumnToggle                                                    */
/* ------------------------------------------------------------------ */

function NewsColumnToggle() {
  const [open, setOpen] = useState(false)
  const { visibleColumns, toggleColumn } = useNewsStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 bg-background border border-border rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
        </svg>
        Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-raised border border-border rounded shadow-lg py-1 z-50 min-w-[140px]">
          {Object.entries(columnLabels).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleColumns[key] ?? true}
                onChange={() => toggleColumn(key)}
                className="rounded border-border"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helper: get primary signal from item                                */
/* ------------------------------------------------------------------ */

function getPrimarySignal(signals: NewsItemSignalDetail[]): NewsItemSignalDetail | null {
  if (signals.length === 0) return null
  // Pick the signal with the highest absolute score
  return signals.reduce((best, s) => (Math.abs(s.score) > Math.abs(best.score) ? s : best), signals[0])
}

function getDecayLabel(signal: NewsItemSignalDetail | null): string {
  if (!signal) return '-'
  if (!signal.expiresAt) return 'perm'
  const remaining = new Date(signal.expiresAt).getTime() - Date.now()
  if (remaining <= 0) return 'expired'
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24))
  if (days >= 1) return `${days}d`
  const hours = Math.ceil(remaining / (1000 * 60 * 60))
  return `${hours}h`
}

function getDecayColor(signal: NewsItemSignalDetail | null): string {
  if (!signal || !signal.expiresAt) return 'text-text-secondary'
  const remaining = new Date(signal.expiresAt).getTime() - Date.now()
  if (remaining <= 0) return 'text-text-secondary/50'
  const days = remaining / (1000 * 60 * 60 * 24)
  if (days > 7) return 'text-green-400'
  if (days >= 1) return 'text-amber-400'
  return 'text-red-400'
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function NewsPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceName | ''>('')
  const [statusFilter, setStatusFilter] = useState<NewsProcessedStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const sortBy = useNewsStore((s) => s.sortBy)
  const sortDir = useNewsStore((s) => s.sortDir)
  const visibleColumns = useNewsStore((s) => s.visibleColumns)
  const hydrated = useNewsStore((s) => s._hydrated)

  // Hydrate persisted store on mount
  useEffect(() => {
    useNewsStore.persist.rehydrate()
  }, [])

  const { data, isLoading, isError, refetch } = useNews({
    limit: PAGE_SIZE,
    offset,
    source: sourceFilter || undefined,
    status: statusFilter || undefined,
    playerSearch: debouncedSearch || undefined,
    sortBy,
    sortDir,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const handleFilterChange = () => setOffset(0)

  const vis = (col: string) => hydrated ? (visibleColumns[col] ?? true) : true

  return (
    <>
      <TopBar />
      <AppShell>
        <div className="w-full px-4 py-6" data-testid="news-page">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-text-primary">News Pipeline</h1>
            <span className="text-xs text-text-secondary">{total} items</span>
          </div>

          <PageExplainer text="Every headline the news pipeline has fetched. Headlines are matched to players in the roster; matches generate signals on your watchlist cards. Status shows whether a match was found by keyword, AI fallback, or not at all. Sources are polled continuously throughout the day." />

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
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); handleFilterChange() }}
              placeholder="Search player..."
              className="bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary w-40"
            />

            <div className="ml-auto">
              <NewsColumnToggle />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-border rounded-lg" data-testid="news-feed">
            {isError ? (
              <ErrorState message="Failed to load news" onRetry={() => refetch()} />
            ) : isLoading ? (
              <div className="flex flex-col gap-1 p-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-8 bg-surface border border-border rounded animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                {(sourceFilter || statusFilter || searchInput) ? (
                  <>
                    <p className="text-sm text-text-secondary">No headlines match your filters</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Try clearing the source, status, or player search.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary">No headlines yet</p>
                    <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                      The news pipeline polls RotoWire, MLB Transactions, Google News, and ESPN. Headlines appear as they are fetched. If this stays empty, the pipeline may not have run yet.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-surface border-b border-border">
                  <tr>
                    {vis('fetchedAt') && (
                      <ResizableTh colKey="fetchedAt" className="px-2 py-2 text-left">
                        <span title="When this article was ingested by the news pipeline">
                          <SortableHeader colKey="fetchedAt" label="Time" />
                        </span>
                      </ResizableTh>
                    )}
                    {vis('source') && (
                      <ResizableTh colKey="source" className="px-2 py-2 text-left">
                        <span title="RSS feed source. Confidence: MLB Txns 95%, RotoWire 85%, ESPN 85%, CBS 80%, RotoBaller 75%, Google 65%">
                          <SortableHeader colKey="source" label="Source" />
                        </span>
                      </ResizableTh>
                    )}
                    {vis('title') && (
                      <ResizableTh colKey="title" className="px-2 py-2 text-left">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="Article headline. Click to open source URL">Headline</span>
                      </ResizableTh>
                    )}
                    {vis('status') && (
                      <ResizableTh colKey="status" className="px-2 py-2 text-left">
                        <span title="Processing result: matched, ai_fallback, no_match, pending">
                          <SortableHeader colKey="status" label="Status" />
                        </span>
                      </ResizableTh>
                    )}
                    {vis('method') && (
                      <ResizableTh colKey="method" className="px-2 py-2 text-left">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="How player was identified: regex or AI extraction">Method</span>
                      </ResizableTh>
                    )}
                    {vis('mentions') && (
                      <ResizableTh colKey="mentions" className="px-2 py-2 text-left">
                        <span title="Players mentioned matching your watchlist">
                          <SortableHeader colKey="mentions" label="Players" />
                        </span>
                      </ResizableTh>
                    )}
                    {vis('confidence') && (
                      <ResizableTh colKey="confidence" className="px-2 py-2 text-right">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="Composite: 40% source + 30% classification + 30% match">Conf%</span>
                      </ResizableTh>
                    )}
                    {vis('eventType') && (
                      <ResizableTh colKey="eventType" className="px-2 py-2 text-left">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="Classified event type. Determines base score and decay period">Event</span>
                      </ResizableTh>
                    )}
                    {vis('score') && (
                      <ResizableTh colKey="score" className="px-2 py-2 text-right">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="Base score × confidence. Range: -3 (season injury) to +2 (trade up)">Score</span>
                      </ResizableTh>
                    )}
                    {vis('keyword') && (
                      <ResizableTh colKey="keyword" className="px-2 py-2 text-left">
                        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide" title="Phrase that triggered event classification">Keyword</span>
                      </ResizableTh>
                    )}
                    {vis('decay') && (
                      <ResizableTh colKey="decay" className="px-2 py-2 text-center">
                        <Tooltip content="Time until signal expires. 14d injuries/trades, 30d awards/contracts, perm retirement">
                          <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide cursor-help">Decay</span>
                        </Tooltip>
                      </ResizableTh>
                    )}
                    {vis('signalCount') && (
                      <ResizableTh colKey="signalCount" className="px-2 py-2 text-right">
                        <span title="Watchlist card signals generated from this article">
                          <SortableHeader colKey="signalCount" label="Sig#" />
                        </span>
                      </ResizableTh>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <NewsRow key={item.id} item={item} vis={vis} />
                  ))}
                </tbody>
              </table>
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

/* ------------------------------------------------------------------ */
/*  NewsRow                                                             */
/* ------------------------------------------------------------------ */

function NewsRow({ item, vis }: { item: NewsItemDetail; vis: (col: string) => boolean }) {
  const primary = getPrimarySignal(item.signals)
  const highestConf = item.mentions.length > 0
    ? Math.max(...item.mentions.map((m) => m.confidence))
    : null

  const eventCfg = primary ? SIGNAL_CONFIG[primary.eventType] : (item.eventType ? SIGNAL_CONFIG[item.eventType] : null)

  return (
    <tr className="border-b border-border/50 hover:bg-raised/50 transition-colors">
      {/* Time */}
      {vis('fetchedAt') && (
        <td className="px-2 py-1.5 whitespace-nowrap cursor-help">
          <Tooltip content={new Date(item.fetchedAt).toLocaleString()}>
            <span className="text-text-secondary">{timeAgo(item.fetchedAt)}</span>
          </Tooltip>
        </td>
      )}

      {/* Source */}
      {vis('source') && (
        <td className="px-2 py-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColors[item.source]}`}>
            {sourceLabels[item.source]}
          </span>
        </td>
      )}

      {/* Headline */}
      {vis('title') && (
        <td className="px-2 py-1.5 max-w-[300px]">
          <span className="text-text-primary leading-snug line-clamp-1">
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
        </td>
      )}

      {/* Status */}
      {vis('status') && (
        <td className="px-2 py-1.5">
          <NewsStatusBadge status={item.processedStatus} method={item.extractionMethod} />
        </td>
      )}

      {/* Method */}
      {vis('method') && (
        <td className="px-2 py-1.5 text-text-secondary">
          {item.extractionMethod === 'none' ? '-' : item.extractionMethod}
        </td>
      )}

      {/* Players */}
      {vis('mentions') && (
        <td className="px-2 py-1.5 max-w-[150px]">
          {item.mentions.length > 0 ? (
            <span className="text-text-primary line-clamp-1">
              {item.mentions.map((m) => (
                <span key={m.playerId} className="inline-flex items-center gap-0.5 mr-1">
                  {m.playerName}
                  <span className="text-text-secondary text-[9px]">
                    {Math.round(m.confidence * 100)}%
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-text-secondary">-</span>
          )}
        </td>
      )}

      {/* Confidence */}
      {vis('confidence') && (
        <td className="px-2 py-1.5 text-right tabular-nums">
          {primary ? (
            <span
              className={primary.confidence >= 0.8 ? 'text-green-400' : primary.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400'}
              title={`Composite: 40% source + 30% classification + 30% match`}
            >
              {Math.round(primary.confidence * 100)}%
            </span>
          ) : highestConf !== null ? (
            <span
              className={highestConf >= 0.8 ? 'text-green-400' : highestConf >= 0.65 ? 'text-amber-400' : 'text-red-400'}
              title="Match confidence — how certain the pipeline is that this headline refers to the detected player"
            >
              {Math.round(highestConf * 100)}%
            </span>
          ) : (
            <span className="text-text-secondary">-</span>
          )}
        </td>
      )}

      {/* Event Type */}
      {vis('eventType') && (
        <td className="px-2 py-1.5">
          {eventCfg ? (
            <span className="inline-flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${eventCfg.bgColor} ${eventCfg.color}`}>
                {eventCfg.label}
              </span>
              {item.classificationMethod === 'ai' && (
                <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-violet-500/15 text-violet-400">AI</span>
              )}
            </span>
          ) : (
            <span className="text-text-secondary">-</span>
          )}
        </td>
      )}

      {/* Score */}
      {vis('score') && (
        <td className="px-2 py-1.5 text-right tabular-nums">
          {primary ? (
            <span
              className={primary.score > 0 ? 'text-green-400' : primary.score < 0 ? 'text-red-400' : 'text-text-secondary'}
              title={`Base: ${SIGNAL_CONFIG[primary.eventType]?.baseScore} × Conf: ${Math.round(primary.confidence * 100)}% = ${primary.score > 0 ? '+' : ''}${primary.score}`}
            >
              {primary.score > 0 ? '+' : ''}{primary.score}
            </span>
          ) : item.eventScore !== null ? (
            <span
              className={item.eventScore > 0 ? 'text-green-400' : item.eventScore < 0 ? 'text-red-400' : 'text-text-secondary'}
              title="Base score (no signal generated)"
            >
              {item.eventScore > 0 ? '+' : ''}{item.eventScore}
            </span>
          ) : (
            <span className="text-text-secondary">-</span>
          )}
        </td>
      )}

      {/* Keyword */}
      {vis('keyword') && (
        <td className="px-2 py-1.5 max-w-[100px]">
          {primary?.matchedKeyword ? (
            <span className="text-text-secondary text-[10px] line-clamp-1">{primary.matchedKeyword}</span>
          ) : item.matchedKeyword ? (
            <span className="text-text-secondary text-[10px] line-clamp-1">{item.matchedKeyword}</span>
          ) : (
            <span className="text-text-secondary">-</span>
          )}
        </td>
      )}

      {/* Decay */}
      {vis('decay') && (
        <td className="px-2 py-1.5 text-center cursor-help">
          <span
            className={getDecayColor(primary)}
            title={primary?.expiresAt ? `Expires: ${new Date(primary.expiresAt).toLocaleString()}` : primary ? 'Permanent — never expires' : ''}
          >
            {getDecayLabel(primary)}
          </span>
        </td>
      )}

      {/* Signals Count */}
      {vis('signalCount') && (
        <td className="px-2 py-1.5 text-right tabular-nums">
          {item.signals.length > 0 ? (
            <span className="text-amber-400">{item.signals.length}</span>
          ) : (
            <span className="text-text-secondary">0</span>
          )}
        </td>
      )}
    </tr>
  )
}
