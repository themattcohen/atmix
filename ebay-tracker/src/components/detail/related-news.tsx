'use client'
import { useNews } from '@/hooks/use-news'
import { timeAgo } from '@/lib/format'
import { SIGNAL_CONFIG, SOURCE_CONFIG } from '@/lib/news/signal-config'
import type { NewsEventType, SourceName } from '@/types'

interface RelatedNewsProps {
  itemId: string
}

function SourceBadge({ source }: { source: SourceName }) {
  const config = SOURCE_CONFIG[source]
  const label = config?.label ?? source
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-raised text-text-secondary border border-border">
      {label}
    </span>
  )
}

function EventTypeBadge({ eventType }: { eventType: NewsEventType }) {
  const config = SIGNAL_CONFIG[eventType]
  if (!config) return null
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.color} ${config.bgColor}`}
    >
      {config.label}
    </span>
  )
}

export function RelatedNews({ itemId }: RelatedNewsProps) {
  const { data, isLoading } = useNews({ itemId, limit: 20 })

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="related-news">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6 4h.01" />
        </svg>
        Related News
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 bg-raised rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-raised rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-xs text-text-secondary">
          No news articles have matched this card's player yet.
        </p>
      ) : (
        <div className="space-y-0">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 py-2.5 border-l-2 border-border pl-3 ml-1"
            >
              <div className="flex-1 min-w-0">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-primary hover:text-accent hover:underline line-clamp-2 leading-snug"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="text-xs text-text-primary line-clamp-2 leading-snug">
                    {item.title}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <SourceBadge source={item.source} />
                  {item.eventType && <EventTypeBadge eventType={item.eventType} />}
                  {item.signals[0] && (
                    <span className="text-[10px] text-text-secondary">
                      {Math.round(item.signals[0].confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-text-secondary whitespace-nowrap mt-0.5">
                {timeAgo(item.fetchedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
