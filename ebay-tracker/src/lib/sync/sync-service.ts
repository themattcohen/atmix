import { fetchWatchlist, getItemStatus } from '../ebay/client'
import type { ItemStatusResult } from '../ebay/client'
import { getAll, getById, upsert, markStatus, freeRank } from '../db/items'
import { insertSnapshot } from '../db/trends'
import { insert as insertEvent } from '../db/events'
import { detectPriceChange, detectWatcherSpike } from './event-detector'
import { evaluateTargets } from './target-evaluator'
import { parseSingleAndStore } from '../ai/title-parser'
import { getUnparsed } from '../db/metadata'
import type { SyncResult } from '../../types'

let syncing = false

export function isSyncing(): boolean {
  return syncing
}

export async function runSync(): Promise<SyncResult> {
  if (syncing) {
    throw new Error('Sync already in progress')
  }

  syncing = true
  const startTime = Date.now()
  let added = 0
  let updated = 0
  let sold = 0
  let expired = 0

  try {
    // 1. Fetch watchlist from eBay
    const apiItems = await fetchWatchlist()
    const apiItemIds = new Set(apiItems.map(item => item.id))

    // 2. Get all active items from DB
    const dbItems = getAll({ status: 'Active' })
    const dbItemMap = new Map(dbItems.map(item => [item.id, item]))

    // 3. Process each API item: upsert + detect changes
    for (const apiItem of apiItems) {
      const existing = dbItemMap.get(apiItem.id)

      if (!existing) {
        // New item
        upsert(apiItem)
        added++
        // Fire-and-forget: parse the new item's title without blocking sync
        void parseSingleAndStore(apiItem.id, apiItem.title).catch(err => {
          console.error(`[title-parser] Failed to parse new item ${apiItem.id}: ${err.message}`)
        })
      } else {
        // Existing item — update and detect changes
        upsert(apiItem)
        updated++

        // Detect price changes
        if (existing.currentPrice !== apiItem.currentPrice) {
          detectPriceChange(existing.currentPrice, apiItem.currentPrice, apiItem.id)
        }

        // Detect watcher spikes
        if (existing.watcherCount != null && apiItem.watcherCount != null) {
          detectWatcherSpike(existing.watcherCount, apiItem.watcherCount, apiItem.id)
        }
      }

      // Insert price snapshot for this item
      insertSnapshot({
        itemId: apiItem.id,
        priceCents: apiItem.currentPrice,
        shippingCents: apiItem.shippingCost ?? 0,
        watcherCount: apiItem.watcherCount ?? null,
        bidCount: apiItem.bidCount ?? 0,
      })

      // Evaluate price targets against the fresh price
      evaluateTargets(apiItem.id, apiItem.currentPrice)
    }

    // 4. Detect sold/expired: DB items not in API response
    for (const dbItem of dbItems) {
      if (apiItemIds.has(dbItem.id)) continue

      // Item left watchlist — determine why
      try {
        const result: ItemStatusResult = await getItemStatus(dbItem.id)

        // Speculatively persist watchCount from Browse API into both tables.
        // result.watchCount will be null until eBay App Check is approved; that's fine.
        if (result.watchCount != null) {
          upsert({ ...dbItem, watcherCount: result.watchCount })
          insertSnapshot({
            itemId: dbItem.id,
            priceCents: dbItem.currentPrice,
            shippingCents: dbItem.shippingCost ?? 0,
            watcherCount: result.watchCount,
            bidCount: dbItem.bidCount ?? 0,
          })
        }

        if (result.status === 'sold') {
          markStatus(dbItem.id, 'Sold')
          freeRank(dbItem.id)
          insertEvent({ itemId: dbItem.id, eventType: 'sold' })
          sold++
        } else if (result.status === 'ended') {
          markStatus(dbItem.id, 'Ended')
          freeRank(dbItem.id)
          insertEvent({ itemId: dbItem.id, eventType: 'expired' })
          expired++
        } else {
          // Still active but removed from watchlist by user
          markStatus(dbItem.id, 'Ended')
          freeRank(dbItem.id)
          expired++
        }
      } catch {
        // If we can't check status, mark as ended
        markStatus(dbItem.id, 'Ended')
        freeRank(dbItem.id)
        expired++
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`Sync complete: +${added} new, ${updated} updated, ${sold} sold, ${expired} expired (${durationMs}ms)`)

    // 5. Backfill unparsed items — parse up to 5 per sync cycle to avoid rate limits
    const unparsedIds = getUnparsed(5)
    if (unparsedIds.length > 0) {
      const items = getAll()
      const itemMap = new Map(items.map(i => [i.id, i]))
      let backfilled = 0
      for (const id of unparsedIds) {
        const item = itemMap.get(id)
        if (!item) continue
        void parseSingleAndStore(id, item.title).catch(err => {
          console.error(`[title-parser] Backfill failed for ${id}: ${err.message}`)
        })
        backfilled++
      }
      if (backfilled > 0) {
        console.log(`[Sync] Backfill: queued ${backfilled} unparsed items for AI parsing`)
      }
    }

    return { added, updated, sold, expired, durationMs }
  } finally {
    syncing = false
  }
}
