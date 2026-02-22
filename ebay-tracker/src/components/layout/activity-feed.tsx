'use client'
import Link from 'next/link'
import { useEvents } from '@/hooks/use-events'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import type { EventType, WatchlistEvent } from '@/types'

const eventIcons: Record<EventType, string> = {
  sold:             '\uD83D\uDD34',
  expired:          '\u23F0',
  price_drop:       '\uD83D\uDCB0',
  price_increase:   '\uD83D\uDCC8',
  watcher_spike:    '\uD83D\uDC40',
  target_triggered: '\uD83C\uDFAF',
}

const eventLabels: Record<EventType, string> = {
  sold:             'Sold',
  expired:          'Expired',
  price_drop:       'Price drop',
  price_increase:   'Price increase',
  watcher_spike:    'Watcher spike',
  target_triggered: 'Target hit',
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatEventValues(event: WatchlistEvent): string | null {
  if (!event.oldValue || !event.newValue) return null

  if (event.eventType === 'target_triggered') {
    const threshold = formatCents(parseInt(event.oldValue, 10))
    const actual    = formatCents(parseInt(event.newValue, 10))
    return `Target ${threshold} \u2014 hit at ${actual}`
  }

  // Default: display as dollar amounts for price events
  const oldCents = parseInt(event.oldValue, 10)
  const newCents = parseInt(event.newValue, 10)
  if (!isNaN(oldCents) && !isNaN(newCents)) {
    return `${formatCents(oldCents)} \u2192 ${formatCents(newCents)}`
  }

  return `${event.oldValue} \u2192 ${event.newValue}`
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
          {events.map((event) => {
            const formattedValues = formatEventValues(event)
            return (
              <li
                key={event.id}
                className="rounded hover:bg-raised transition-colors"
              >
                <Link
                  href={`/items/${event.itemId}`}
                  className="flex items-start gap-2 px-2 py-1.5 cursor-pointer"
                >
                <span className="text-sm leading-none mt-0.5">{eventIcons[event.eventType]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">
                    {eventLabels[event.eventType]}
                    {event.itemTitle && (
                      <span className="text-text-secondary"> \u2014 {event.itemTitle}</span>
                    )}
                  </p>
                  {formattedValues && (
                    <p className="text-[10px] text-text-secondary">
                      {formattedValues}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-text-secondary whitespace-nowrap mt-0.5">
                  {timeAgo(event.detectedAt)}
                </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
