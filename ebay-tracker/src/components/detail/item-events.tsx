'use client'
import type { WatchlistEvent } from '@/types'
import { eventIcons, eventLabels, formatEventValues } from '@/lib/event-display'

interface ItemEventsProps {
  events: WatchlistEvent[]
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
