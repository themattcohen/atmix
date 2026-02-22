'use client'
import type { WatchlistEvent, EventType } from '@/types'

interface ItemEventsProps {
  events: WatchlistEvent[]
}

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
  price_drop:       'Price Drop',
  price_increase:   'Price Increase',
  watcher_spike:    'Watcher Spike',
  target_triggered: 'Target Hit',
}

const priceEventTypes: Set<EventType> = new Set([
  'price_increase',
  'price_drop',
  'target_triggered',
])

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatEventValues(event: WatchlistEvent): string | null {
  if (!event.oldValue || !event.newValue) return null

  if (event.eventType === 'target_triggered') {
    const threshold = formatCents(parseInt(event.oldValue, 10))
    const actual    = formatCents(parseInt(event.newValue, 10))
    return `Target ${threshold} \u2014 hit at ${actual}`
  }

  if (priceEventTypes.has(event.eventType)) {
    const oldCents = parseInt(event.oldValue, 10)
    const newCents = parseInt(event.newValue, 10)
    if (!isNaN(oldCents) && !isNaN(newCents)) {
      return `${formatCents(oldCents)} \u2192 ${formatCents(newCents)}`
    }
  }

  return `${event.oldValue} \u2192 ${event.newValue}`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ItemEvents({ events }: ItemEventsProps) {
  if (events.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4" data-testid="item-events">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Event Timeline
        </h3>
        <p className="text-xs text-text-secondary">No events recorded</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="item-events">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Event Timeline
      </h3>
      <div className="space-y-0">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 py-2 border-l-2 border-border pl-3 ml-1"
          >
            <span className="text-sm leading-none mt-0.5">{eventIcons[event.eventType]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary">
                {eventLabels[event.eventType]}
              </p>
              {event.oldValue && event.newValue && (
                <p className="text-[10px] text-text-secondary mt-0.5">
                  {formatEventValues(event) ?? `${event.oldValue} → ${event.newValue}`}
                </p>
              )}
            </div>
            <span className="text-[10px] text-text-secondary whitespace-nowrap">
              {formatTimestamp(event.detectedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
