'use client'
import Link from 'next/link'
import { useEvents } from '@/hooks/use-events'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import { eventIcons, eventLabels, formatEventValues } from '@/lib/event-display'

export function ActivityFeed() {
  const { data: events, isLoading, isError, refetch } = useEvents({ limit: 20 })

  return (
    <div className="p-3 flex-1 overflow-auto">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
        Activity
      </h3>

      {isError ? (
        <div className="text-center py-4">
          <p className="text-xs text-status-sold">Failed to load activity</p>
          <button onClick={() => refetch()} className="text-xs text-accent hover:underline mt-1">Retry</button>
        </div>
      ) : isLoading ? (
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
