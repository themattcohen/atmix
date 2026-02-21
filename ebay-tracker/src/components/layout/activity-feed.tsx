'use client'
import { useEvents } from '@/hooks/use-events'
import { Skeleton } from '@/components/ui/skeleton'
import type { EventType } from '@/types'

const eventIcons: Record<EventType, string> = {
  sold: '\uD83D\uDD34',
  expired: '\u23F0',
  price_drop: '\uD83D\uDCB0',
  price_increase: '\uD83D\uDCC8',
  watcher_spike: '\uD83D\uDC40',
}

const eventLabels: Record<EventType, string> = {
  sold: 'Sold',
  expired: 'Expired',
  price_drop: 'Price drop',
  price_increase: 'Price increase',
  watcher_spike: 'Watcher spike',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ActivityFeed() {
  const { data: events, isLoading } = useEvents({ limit: 20 })

  return (
    <div className="p-3 flex-1 overflow-auto">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
        Activity
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <p className="text-xs text-text-secondary">No recent activity</p>
      ) : (
        <ul className="space-y-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-raised transition-colors"
            >
              <span className="text-sm leading-none mt-0.5">{eventIcons[event.eventType]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary truncate">
                  {eventLabels[event.eventType]}
                  {event.itemTitle && (
                    <span className="text-text-secondary"> — {event.itemTitle}</span>
                  )}
                </p>
                {event.oldValue && event.newValue && (
                  <p className="text-[10px] text-text-secondary">
                    {event.oldValue} → {event.newValue}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-text-secondary whitespace-nowrap mt-0.5">
                {timeAgo(event.detectedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
