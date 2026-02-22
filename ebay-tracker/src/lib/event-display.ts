import { formatDollars } from '@/lib/format'
import type { EventType } from '@/types'

export const eventIcons: Record<EventType, string> = {
  sold:             '\uD83D\uDD34',
  expired:          '\u23F0',
  price_drop:       '\uD83D\uDCB0',
  price_increase:   '\uD83D\uDCC8',
  watcher_spike:    '\uD83D\uDC40',
  target_triggered: '\uD83C\uDFAF',
}

export const eventLabels: Record<EventType, string> = {
  sold:             'Sold',
  expired:          'Expired',
  price_drop:       'Price Drop',
  price_increase:   'Price Increase',
  watcher_spike:    'Watcher Spike',
  target_triggered: 'Target Hit',
}

export const priceEventTypes: Set<EventType> = new Set([
  'price_increase',
  'price_drop',
  'target_triggered',
])

export function formatEventValues(
  event: { eventType: string; oldValue?: number | string | null; newValue?: number | string | null },
): string | null {
  if (!event.oldValue || !event.newValue) return null

  if (event.eventType === 'target_triggered') {
    const threshold = formatDollars(parseInt(String(event.oldValue), 10))
    const actual    = formatDollars(parseInt(String(event.newValue), 10))
    return `Target ${threshold} \u2014 hit at ${actual}`
  }

  if (priceEventTypes.has(event.eventType as EventType)) {
    const oldCents = parseInt(String(event.oldValue), 10)
    const newCents = parseInt(String(event.newValue), 10)
    if (!isNaN(oldCents) && !isNaN(newCents)) {
      return `${formatDollars(oldCents)} \u2192 ${formatDollars(newCents)}`
    }
  }

  return `${event.oldValue} \u2192 ${event.newValue}`
}
