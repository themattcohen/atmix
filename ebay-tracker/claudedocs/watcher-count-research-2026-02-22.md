# eBay Watcher Count Research Report

**Date**: 2026-02-22
**Status**: Actionable — Browse API is the only viable path, gated behind App Check

## Problem

The eBay tracker syncs ~992 items from a buyer's watchlist using `GetMyeBayBuying` (Trading API). The `WatchCount` field is NOT returned for buyer watchlist items — it's only available in seller context. Result: `watcher_count` is always null for all 992 items and all 3,968 price snapshots.

## Database Confirmation

| Metric | Result |
|--------|--------|
| Items total | 992 |
| watcher_count (items table) | 0/992 have data — **always null** |
| watcher_count (price_snapshots) | 0/3,968 have data — **always null** |
| bid_count | All 0 (all FixedPrice listings) |
| Status | All 992 Active |

## Approaches Evaluated

| # | Approach | Returns watchCount for buyer items? | Status | Rate Limit | SDK Support |
|---|----------|-------------------------------------|--------|------------|-------------|
| 1 | **Browse API `getItem`/`getItems`** | **Yes, after App Check** | **Live, gated** | 5,000/day | Yes (`ebay.buy.browse.getItem`) |
| 2 | Browse API `search` | Yes, after App Check | Live, wrong tool (no ID lookup) | 5,000/day | Yes |
| 3 | Trading API `GetItem` IncludeWatchCount | No — seller only | Live but blocked | 5,000/day | Yes |
| 4 | Shopping API `GetSingleItem`/`GetMultipleItems` | Was yes | **Decommissioned Feb 5, 2025** | N/A | N/A |
| 5 | Finding API `findItemsAdvanced` | Was yes | **Decommissioned Feb 5, 2025** | N/A | N/A |
| 6 | Marketplace Insights API | No — sold items only | Live, limited access | Unknown | Partial |
| 7 | Scraping listing pages | Unreliable — watch count removed from listing pages | Against ToS | N/A | N/A |

## Recommended Solution: Browse API

### Why Browse API Works
- `getItem`, `getItemByLegacyId`, `getItems` all return `watchCount` in the `Item` response type
- Works in **buyer context** — you don't need to own the listing
- The app already has Browse API production access (`client.ts:117` calls `ebay.buy.browse.getItem()`)
- `watchCount` is a separate permission layer — requires an **App Check** ticket to unlock

### Batch Efficiency
- `getItems` accepts up to **20 item IDs per call** in `v1|{legacyId}|0` format
- 992 items = 50 API calls (well within 5,000/day limit)
- For ranked-only (~20-50 items) = 1-3 calls/day

### App Check Process
1. Log in to `developer.ebay.com`
2. Open a Support ticket / App Check request
3. State: "Requesting access to the `watchCount` field in Browse API (getItem, getItems, getItemByLegacyId)"
4. Reference production app (asa-collectibles)
5. eBay reviews and flips a flag on the app credentials
6. Turnaround: days to ~2 weeks (community reports)

### Implementation Plan

**Phase 1 (immediate, zero cost):** Capture `response.watchCount` speculatively in existing `getItemStatus()` Browse API calls. Field will be `undefined` until App Check approved, then auto-populates.

**Phase 2 (after App Check approved):** Add `fetchWatchCounts(itemIds)` batch function using `getItems` endpoint. Wire into cron job for ranked items refresh.

### Code: Batch Watcher Refresh Function

```typescript
export async function fetchWatchCounts(itemIds: string[]): Promise<Map<string, number>> {
  const ebay = getEbayClient()
  const result = new Map<string, number>()
  const BATCH_SIZE = 20

  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BATCH_SIZE)
    const ids = batch.map(id => `v1|${id}|0`).join(',')

    try {
      const resp = await ebay.buy.browse.getItems({ item_ids: ids })
      for (const item of resp.items ?? []) {
        const numericId = item.itemId?.split('|')[1]
        if (numericId && item.watchCount !== undefined) {
          result.set(numericId, item.watchCount)
        }
      }
    } catch (err) {
      console.error(`Batch ${i / BATCH_SIZE} failed:`, err)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  return result
}
```

## Key 2025/2026 API Changes

- **Shopping API decommissioned**: February 5, 2025 — was the cleanest buyer-context watch count source
- **Finding API decommissioned**: February 5, 2025
- **Browse API `watchCount` restriction**: Unchanged since 2023. App Check is still the gate
- **Watch count removed from listing pages**: eBay no longer displays "X watchers" on individual listing pages (only in search results for 10+ watchers)
- **No new buyer-friendly watcher API** has launched to replace the deprecated ones

## Sources

- [Retrieving the watch count of an item - eBay KB](https://developer.ebay.com/support/kb-article?KBid=2084)
- [ItemType.getWatchCount() returns null - eBay KB](https://developer.ebay.com/support/kb-article?KBid=392)
- [Alert: Finding API and Shopping API decommissioned 2025](https://community.ebay.com/t5/Traditional-APIs-Search/Alert-Finding-API-and-Shopping-API-to-be-decommissioned-in-2025/td-p/34222062)
- [Pulling watch count - possible? (Community)](https://community.ebay.com/t5/RESTful-Buy-APIs-Browse/Pulling-watch-count-possible/td-p/34513820)
- [Browse API getItem reference](https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItem)
- [Browse API getItems reference](https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItems)
- [Item type - Browse API](https://developer.ebay.com/api-docs/buy/browse/types/gct:Item)
- [eBay API call limits](https://developer.ebay.com/develop/get-started/api-call-limits)
