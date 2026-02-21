import { insert } from '../db/events'

export function detectPriceChange(oldPrice: number, newPrice: number, itemId: string): void {
  if (oldPrice === newPrice) return

  if (newPrice < oldPrice) {
    insert({
      itemId,
      eventType: 'price_drop',
      oldValue: String(oldPrice),
      newValue: String(newPrice),
    })
  } else {
    insert({
      itemId,
      eventType: 'price_increase',
      oldValue: String(oldPrice),
      newValue: String(newPrice),
    })
  }
}

export function detectWatcherSpike(oldCount: number, newCount: number, itemId: string): void {
  if (oldCount <= 0 || newCount <= oldCount) return

  const increase = (newCount - oldCount) / oldCount
  if (increase > 0.2) {
    insert({
      itemId,
      eventType: 'watcher_spike',
      oldValue: String(oldCount),
      newValue: String(newCount),
    })
  }
}
