# Design: Delta Column — Price Change % Since Last Sync

**Effort**: ~1 hour
**Scope**: 3 files modified, 0 new files, 0 migrations, 0 new dependencies
**Status**: Implementation-ready

---

## 1. Overview

The watchlist table has a `visibleColumns.delta` toggle (already `true` by default) and a `PriceCell` component that already accepts and renders a `deltaPct` prop with a colored up/down Badge. The delta column cell currently renders a `—` placeholder because `deltaPct` is never computed or passed. This document specifies all changes needed to wire it end-to-end.

**User value**: At-a-glance % change between the two most recent price snapshots for each item. Green badge with down arrow = price dropped (good for buyers). Red badge with up arrow = price rose.

---

## 2. SQL Query and Type Definitions

### Query

```sql
-- Returns one row per item_id: current price, previous price, and delta_pct.
-- Items with only one snapshot get previous_price = NULL and delta_pct = NULL.
WITH latest AS (
  SELECT
    item_id,
    price_cents,
    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY recorded_at DESC) AS rn
  FROM price_snapshots
)
SELECT
  l1.item_id,
  l1.price_cents  AS current_price,
  l2.price_cents  AS previous_price,
  ROUND(
    (l1.price_cents - l2.price_cents) * 100.0 / l2.price_cents,
    1
  ) AS delta_pct
FROM latest l1
LEFT JOIN latest l2
  ON l1.item_id = l2.item_id AND l2.rn = 2
WHERE l1.rn = 1
```

### TypeScript types (add to `src/types/index.ts`)

```ts
export interface PriceDelta {
  itemId: string
  currentPrice: number       // cents
  previousPrice: number | null
  deltaPct: number | null    // e.g. -5.3 = 5.3% drop, +2.0 = 2% rise
}
```

Also extend `WatchlistItem` with one optional field so the API can carry it through:

```ts
export interface WatchlistItem {
  // ... all existing fields unchanged ...
  deltaPct?: number | null   // injected by /api/items, absent when no snapshot pair
}
```

`deltaPct` is optional (`?`) so existing code that constructs `WatchlistItem` (sync, upsert, rowToItem) requires no changes.

---

## 3. DB Layer — `src/lib/db/trends.ts`

### 3a. New function: `getPriceDeltas()`

Add after `getSnapshots()`, before `getStats()`.

```ts
export function getPriceDeltas(): PriceDelta[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      WITH latest AS (
        SELECT
          item_id,
          price_cents,
          ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY recorded_at DESC) AS rn
        FROM price_snapshots
      )
      SELECT
        l1.item_id,
        l1.price_cents  AS current_price,
        l2.price_cents  AS previous_price,
        ROUND(
          (l1.price_cents - l2.price_cents) * 100.0 / l2.price_cents,
          1
        ) AS delta_pct
      FROM latest l1
      LEFT JOIN latest l2
        ON l1.item_id = l2.item_id AND l2.rn = 2
      WHERE l1.rn = 1
    `).all() as any[]

    return rows.map(row => ({
      itemId: row.item_id,
      currentPrice: row.current_price,
      previousPrice: row.previous_price ?? null,
      deltaPct: row.delta_pct ?? null,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get price deltas: ${err.message}`)
  }
}
```

**Notes:**
- `.all()` with no parameters — no filter needed; the API merges by item ID.
- `?? null` coerces SQLite `NULL` from the LEFT JOIN to TypeScript `null`.
- The `ROUND(..., 1)` is done in SQL to avoid floating-point drift in JS.

### 3b. Export — add to `trendsRepo` object

```ts
export const trendsRepo: TrendsRepo = {
  insertSnapshot,
  getSnapshots,
  getPriceDeltas,   // <-- add
  getStats,
  getPortfolio,
}
```

### 3c. `TrendsRepo` interface — `src/types/index.ts`

```ts
export interface TrendsRepo {
  insertSnapshot(input: { ... }): void
  getSnapshots(itemId: string, days: number): PriceSnapshot[]
  getPriceDeltas(): PriceDelta[]   // <-- add
  getStats(): TrendStats
  getPortfolio(days: number): PortfolioDataPoint[]
}
```

---

## 4. API Route — `src/app/api/items/route.ts`

### Strategy

Call `getPriceDeltas()` once, build a `Map<itemId, deltaPct>` for O(1) lookup, then annotate each item before returning. This keeps the existing sort/filter logic untouched.

### Full updated route

```ts
import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll } from '@/lib/db/items'
import { getPriceDeltas } from '@/lib/db/trends'
import type { ListingStatus, WatchlistItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const status = params.get('status') ?? 'Active'
    const sort = params.get('sort') ?? 'rank'
    const dir = params.get('dir') ?? 'asc'
    const search = params.get('search') ?? undefined

    const filters = status === 'All'
      ? { search }
      : { status: status as ListingStatus, search }

    const items = getAll(filters)

    // Build delta lookup map (one DB call, covers all items)
    const deltaMap = new Map<string, number | null>(
      getPriceDeltas().map(d => [d.itemId, d.deltaPct])
    )

    // Annotate items with deltaPct
    const annotated: WatchlistItem[] = items.map(item => ({
      ...item,
      deltaPct: deltaMap.get(item.id) ?? null,
    }))

    // Separate ranked from unranked
    const ranked = annotated.filter(
      (i): i is WatchlistItem & { rank: number } => i.rank !== null
    )
    const unranked = annotated.filter(i => i.rank === null)

    ranked.sort((a, b) => {
      if (sort === 'rank') return dir === 'asc' ? a.rank - b.rank : b.rank - a.rank
      return sortBy(a, b, sort, dir)
    })

    unranked.sort((a, b) => {
      if (sort !== 'rank') return sortBy(a, b, sort, dir)
      if (!a.endTime && !b.endTime) return 0
      if (!a.endTime) return 1
      if (!b.endTime) return -1
      return a.endTime.localeCompare(b.endTime)
    })

    const allItems = status === 'All' ? annotated : getAll()
    const counts = {
      active: allItems.filter(i => i.status === 'Active').length,
      sold: allItems.filter(i => i.status === 'Sold').length,
      ended: allItems.filter(i => i.status === 'Ended').length,
      total: allItems.length,
    }

    return routeOk({ ranked, unranked, counts })
  } catch (err) {
    return routeError(err)
  }
}

function sortBy(a: WatchlistItem, b: WatchlistItem, sort: string, dir: string): number {
  let cmp = 0
  switch (sort) {
    case 'price':
      cmp = a.currentPrice - b.currentPrice
      break
    case 'watchers':
      cmp = (a.watcherCount ?? 0) - (b.watcherCount ?? 0)
      break
    case 'end_time':
      if (!a.endTime && !b.endTime) cmp = 0
      else if (!a.endTime) cmp = 1
      else if (!b.endTime) cmp = -1
      else cmp = a.endTime.localeCompare(b.endTime)
      break
    default:
      cmp = 0
  }
  return dir === 'asc' ? cmp : -cmp
}
```

**Key change**: `getPriceDeltas()` is called once before building `ranked`/`unranked`, not per-item. The `deltaMap` lookup is `O(1)`. The rest of the function is structurally identical to the original.

---

## 5. Component — `src/components/watchlist/watchlist-row.tsx`

Replace the delta cell's placeholder span with a `PriceCell` call that passes `deltaPct`.

**Before** (lines 89–100):
```tsx
{/* Price */}
{visibleColumns.price && (
  <td className="px-2 py-1.5">
    <PriceCell priceCents={item.currentPrice} />
  </td>
)}

{/* Delta — placeholder, would need snapshot comparison */}
{visibleColumns.delta && (
  <td className="px-2 py-1.5">
    <span className="text-xs text-text-secondary">—</span>
  </td>
)}
```

**After**:
```tsx
{/* Price */}
{visibleColumns.price && (
  <td className="px-2 py-1.5">
    <PriceCell priceCents={item.currentPrice} />
  </td>
)}

{/* Delta — price change % vs previous snapshot */}
{visibleColumns.delta && (
  <td className="px-2 py-1.5">
    <PriceCell priceCents={item.currentPrice} deltaPct={item.deltaPct ?? null} />
  </td>
)}
```

`PriceCell` already renders:
- Nothing extra when `deltaPct` is `null` or `0` — just shows the price.
- Green `Badge` with `↓X.X%` when `deltaPct < 0` (price dropped).
- Red `Badge` with `↑X.X%` when `deltaPct > 0` (price rose).

The `item.deltaPct` field comes through from the API response via `useWatchlist` → React Query → `WatchlistResponse` which types `ranked` and `unranked` as `WatchlistItem[]`. Because `deltaPct` is an optional field on `WatchlistItem`, TypeScript is satisfied without touching the hook or the response type interface in `use-watchlist.ts`.

---

## 6. Edge Cases

| Scenario | DB result | Rendered output |
|---|---|---|
| Item has only 1 snapshot (just added) | `previous_price = NULL`, `delta_pct = NULL` | No badge — `PriceCell` shows price only |
| Item has 0 snapshots | Not returned by query | `deltaMap.get(item.id)` returns `undefined` → `?? null` → no badge |
| Price unchanged between snapshots | `delta_pct = 0.0` | No badge — `PriceCell` guards on `deltaPct !== 0` |
| Previous price is 0 (division by zero) | `delta_pct = NULL` (SQLite returns NULL for division by zero) | No badge — safe |
| Item in `items` table not in `price_snapshots` | Not returned by query | `deltaMap.get()` → `undefined` → `null` → no badge |
| `deltaPct` is exactly `0.0` from rounding | Badge suppressed | `PriceCell` condition: `deltaPct !== 0` covers `0.0` |

SQLite's division-by-zero behavior: when `l2.price_cents = 0`, the expression evaluates to `NULL` (not an error and not `Infinity`) — confirmed behavior for integer division in SQLite 3.x. No additional guard needed in application code.

---

## 7. Bug Fix — `topPriceDrops` in `src/app/api/trends/route.ts`

### Current (broken) code

```ts
const topPriceDrops = [...allItems]
  .sort((a, b) => a.currentPrice - b.currentPrice)  // sorts by lowest absolute price
  .slice(0, 5)
```

This returns the 5 cheapest items, not the 5 items with the largest price drops.

### Fix

`topPriceDrops` requires actual delta data. Replace with:

```ts
// Build delta map (reuse getPriceDeltas() — same pattern as items route)
const deltaMap = new Map<string, number | null>(
  getPriceDeltas().map(d => [d.itemId, d.deltaPct])
)

const topPriceDrops = [...allItems]
  .filter(i => {
    const d = deltaMap.get(i.id)
    return d !== undefined && d !== null && d < 0
  })
  .sort((a, b) => (deltaMap.get(a.id)! - deltaMap.get(b.id)!))  // most negative first
  .slice(0, 5)
  .map(i => ({ ...i, deltaPct: deltaMap.get(i.id) ?? null }))
```

**Required import addition** in `src/app/api/trends/route.ts`:
```ts
import { getStats, getPortfolio, getPriceDeltas } from '@/lib/db/trends'
```

This fix is independent of the delta column work but shares the same `getPriceDeltas()` function. Do both in the same commit.

---

## 8. E2E Test Specs

File: `src/__tests__/delta-column.test.ts` (or place in existing test directory per project convention)

### Test 1 — Item with two snapshots shows delta badge

```ts
it('returns deltaPct for an item with two price snapshots', () => {
  // Arrange: insert item + two snapshots (price went from 1000 to 900 cents)
  itemsRepo.upsert({ id: 'test-1', title: 'Test Item', currentPrice: 900, ... })
  trendsRepo.insertSnapshot({ itemId: 'test-1', priceCents: 1000, ... })  // older
  trendsRepo.insertSnapshot({ itemId: 'test-1', priceCents: 900, ... })   // newer

  // Act
  const deltas = getPriceDeltas()

  // Assert
  const delta = deltas.find(d => d.itemId === 'test-1')
  expect(delta).toBeDefined()
  expect(delta!.deltaPct).toBe(-10.0)  // (900-1000)/1000 * 100 = -10.0
})
```

### Test 2 — Item with one snapshot returns null deltaPct

```ts
it('returns null deltaPct for an item with only one snapshot', () => {
  itemsRepo.upsert({ id: 'test-2', title: 'New Item', currentPrice: 500, ... })
  trendsRepo.insertSnapshot({ itemId: 'test-2', priceCents: 500, ... })

  const deltas = getPriceDeltas()
  const delta = deltas.find(d => d.itemId === 'test-2')

  expect(delta).toBeDefined()
  expect(delta!.deltaPct).toBeNull()
  expect(delta!.previousPrice).toBeNull()
})
```

### Test 3 — GET /api/items response includes deltaPct per item

```ts
it('GET /api/items includes deltaPct field on each returned item', async () => {
  // Arrange: item with two snapshots (price rose 5%)
  itemsRepo.upsert({ id: 'test-3', title: 'Rising Item', currentPrice: 1050, ... })
  trendsRepo.insertSnapshot({ itemId: 'test-3', priceCents: 1000, ... })
  trendsRepo.insertSnapshot({ itemId: 'test-3', priceCents: 1050, ... })

  // Act
  const res = await fetch('/api/items')
  const json = await res.json()
  const allItems = [...json.data.ranked, ...json.data.unranked]

  // Assert
  const item = allItems.find((i: WatchlistItem) => i.id === 'test-3')
  expect(item).toBeDefined()
  expect(item.deltaPct).toBe(5.0)
})
```

---

## 9. Effort Estimate

| Task | File | Est. |
|---|---|---|
| Add `PriceDelta` type + extend `WatchlistItem` | `src/types/index.ts` | 5 min |
| Add `getPriceDeltas()` + export in `trendsRepo` | `src/lib/db/trends.ts` | 10 min |
| Update `TrendsRepo` interface | `src/types/index.ts` | 2 min |
| Merge delta into items response | `src/app/api/items/route.ts` | 10 min |
| Wire `deltaPct` into delta cell | `src/components/watchlist/watchlist-row.tsx` | 5 min |
| Fix `topPriceDrops` bug | `src/app/api/trends/route.ts` | 10 min |
| Manual smoke test in browser | — | 5 min |
| Write + run unit tests (optional) | test file | 15 min |
| **Total** | | **~60 min** |

---

## 10. Change Summary

| File | Change type | What changes |
|---|---|---|
| `src/types/index.ts` | Extend | Add `PriceDelta` interface; add `deltaPct?: number \| null` to `WatchlistItem`; add `getPriceDeltas()` to `TrendsRepo` |
| `src/lib/db/trends.ts` | Add function | `getPriceDeltas()` CTE query; add to `trendsRepo` export object |
| `src/app/api/items/route.ts` | Modify | Import `getPriceDeltas`, build delta map, annotate items before sort |
| `src/app/api/trends/route.ts` | Bug fix | Import `getPriceDeltas`, replace `topPriceDrops` sort with actual delta sort |
| `src/components/watchlist/watchlist-row.tsx` | Modify | Delta cell: replace `<span>—</span>` with `<PriceCell deltaPct={item.deltaPct ?? null} />` |

No new files. No schema migrations. No new npm dependencies.
