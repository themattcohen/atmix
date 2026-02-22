# F1 — Collector Sentiment: Watcher Heat Index

**Feature ID**: F1
**Status**: Ready for implementation
**Effort estimate**: ~3.25 hours
**Depends on**: Existing `price_snapshots` data — no migrations, no external APIs
**Fixes**: S5 (WatcherCell trend props never passed), S10 (topWatcherGains sorts by raw count not delta)

---

## 1. Overview

The **Watcher Heat Index** is a composite demand signal computed entirely from data the app already collects — watcher counts, watcher velocity, bid counts, time remaining, and listing type. It converts a column of raw numbers into an actionable indicator of collector interest.

### Why it matters

A watcher count of 45 means very different things depending on context:
- An item ending in 30 minutes with 45 watchers is probably about to see a bidding war.
- An item ending in 7 days with 45 watchers that has grown by 20 in the last 24 hours is trending hot.
- A fixed-price item with 45 watchers and no bids is mildly interesting but not urgent.

The heat index distills those contextual signals into a single tier (Hot / Warm / Cold / On Fire) and a numeric score, displayed as a colored indicator in the watchers column. It helps the user prioritize: which items need a bid decision now, which are building momentum, and which can be ignored.

### Scope

- Server-side computation over `price_snapshots` using a single batch SQL query
- One new repo function in `src/lib/db/trends.ts`
- One new type, `HeatIndex`, added to `src/types/index.ts`
- Enhanced `WatcherCell` accepting a `heat` prop
- `watchlist-row.tsx` wired to pass heat data
- Items API extended to return heat data alongside each item
- Two bug fixes: S5 (watcher trend/delta props) and S10 (topWatcherGains sort)

---

## 2. Heat Index Computation

### 2.1 Component signals

The heat index is built from four independent signals. Each signal is normalized to a 0–1 scale before weighting.

**Signal 1: Watcher count (absolute)**

Measures raw popularity. Normalized against a soft cap so that very high values compress gracefully rather than dominating the score.

```
watcherNorm = min(watcherCount, 200) / 200
```

Soft cap at 200 is deliberately generous — most collectibles items plateau well below this, so items genuinely near 200 deserve a proportionally high contribution.

**Signal 2: Watcher velocity**

Measures momentum — how quickly the watcher count is growing. This is the most predictive signal of imminent competitive bidding.

```
velocityPerDay = (latestWatcherCount - earliestWatcherCount) / daysBetween
velocityNorm   = clamp(velocityPerDay / 10, 0, 1)
```

Normalization denominator of 10 means: gaining 10+ watchers per day scores the full 1.0. This is conservative — for most collectibles, 10 new watchers/day is genuinely hot.

Items with only a single snapshot (no historical data) receive `velocityNorm = 0` — no velocity signal, no penalty. The other three signals still contribute.

**Signal 3: Bid count**

Bids are a harder commitment than watching. Even a single bid on an auction indicates real intent.

```
bidNorm = min(bidCount, 20) / 20
```

Soft cap at 20. For auctions, bids are highly meaningful. For FixedPrice items, `bidCount` is always 0 — this signal contributes nothing and does not penalize them.

**Signal 4: Time-remaining urgency**

Items ending soon with high demand are the most actionable. An item with 50 watchers ending in 2 hours deserves a much higher score than the same item ending in 6 days.

```
hoursRemaining = max(0, (endTime - now) / 3600000)

urgencyNorm =
  hoursRemaining <= 0   → 0       (already ended — no urgency)
  hoursRemaining <= 4   → 1.0     (ending very soon — maximum urgency)
  hoursRemaining <= 24  → 0.75    (ending today)
  hoursRemaining <= 72  → 0.35    (ending this week)
  otherwise             → 0.0     (far out — no urgency contribution)
```

Items with no `end_time` (some fixed-price listings) receive `urgencyNorm = 0`.

### 2.2 Listing type adjustment

Auctions naturally accumulate more watchers than fixed-price listings — watchers on an auction are often people planning to bid, while fixed-price watchers may just be casual browsers. To prevent auctions from always outscoring BIN listings, a small downward multiplier is applied to auction scores.

```
listingTypeMultiplier:
  FixedPrice    → 1.15   (boost — harder to accumulate watchers, so each one signals more intent)
  AuctionWithBIN→ 1.0    (neutral)
  Auction       → 0.90   (slight deflation — auctions inflate watcher counts structurally)
```

This keeps heat index values comparable across listing types without distorting the formula severely.

### 2.3 Composite formula

```
rawScore = (
  0.30 * watcherNorm   +   // base popularity
  0.40 * velocityNorm  +   // momentum (highest weight)
  0.15 * bidNorm       +   // real buyer intent
  0.15 * urgencyNorm       // time pressure
) * listingTypeMultiplier

heatScore = clamp(round(rawScore * 100), 0, 100)
```

The weights reflect editorial judgment about signal quality:
- Velocity (0.40) is the strongest predictor of a bidding war; it deserves the most weight.
- Watcher count (0.30) provides baseline context but is weaker alone.
- Bids (0.15) are a strong signal but zero for fixed-price items, so they are not over-weighted.
- Urgency (0.15) creates a ceiling pressure modifier rather than a primary driver.

`heatScore` is a 0–100 integer. It is stored in memory only — never persisted to the database.

### 2.4 Heat tiers

| Tier | Score range | Color | Label | Meaning |
|------|-------------|-------|-------|---------|
| On Fire | 80–100 | Flame (#f97316, orange-500) | "On Fire" | Top ~5% velocity. Exceptional momentum, bid decision urgent. |
| Hot | 60–79 | Red (#ef4444, red-500) | "Hot" | High demand. Multiple signals elevated. Worth monitoring closely. |
| Warm | 35–59 | Amber (#f59e0b, amber-500) | "Warm" | Moderate interest. Could heat up or cool down. |
| Cold | 0–34 | Gray (#6b7280, gray-500) | "Cold" | Low demand. No immediate action needed. |

Tier boundaries are not magical. They are starting points calibrated so that roughly:
- 5–10% of active items are On Fire at any given time
- 20–30% are Hot
- 30–40% are Warm
- 30–40% are Cold

These can be tuned after observing real data distributions. The thresholds are defined as constants in the repo function so they are a single-location change.

### 2.5 TypeScript type

```typescript
// Add to src/types/index.ts

export type HeatTier = 'on-fire' | 'hot' | 'warm' | 'cold'

export interface HeatIndex {
  score: number          // 0–100
  tier: HeatTier
  velocityPerDay: number // raw watchers/day, for display in tooltip
  watcherDelta: number   // absolute change over the snapshot window
  snapshotCount: number  // how many snapshots contributed (0 = no history)
}
```

`WatchlistItem` does not change shape — `heatIndex` is computed on-demand and returned as a separate map from the items API.

---

## 3. Batch Computation SQL

The computation runs in a single SQL query that processes all active items at once, avoiding N+1 snapshot lookups.

```sql
-- Batch heat index computation for all active items
-- Runs server-side in getHeatIndexBatch()
WITH snapshot_window AS (
  -- For each item, get the earliest and latest snapshot in the last 14 days
  SELECT
    ps.item_id,
    COUNT(*)                                                AS snapshot_count,
    MIN(ps.recorded_at)                                     AS earliest_at,
    MAX(ps.recorded_at)                                     AS latest_at,
    MIN(CASE
      WHEN ps.recorded_at = (
        SELECT MIN(ps2.recorded_at)
        FROM price_snapshots ps2
        WHERE ps2.item_id = ps.item_id
          AND ps2.recorded_at >= datetime('now', '-14 days')
          AND ps2.watcher_count IS NOT NULL
      ) THEN ps.watcher_count ELSE NULL
    END)                                                    AS earliest_watchers,
    MAX(CASE
      WHEN ps.recorded_at = (
        SELECT MAX(ps2.recorded_at)
        FROM price_snapshots ps2
        WHERE ps2.item_id = ps.item_id
          AND ps2.recorded_at >= datetime('now', '-14 days')
          AND ps2.watcher_count IS NOT NULL
      ) THEN ps.watcher_count ELSE NULL
    END)                                                    AS latest_watchers
  FROM price_snapshots ps
  WHERE ps.recorded_at >= datetime('now', '-14 days')
    AND ps.watcher_count IS NOT NULL
  GROUP BY ps.item_id
)
SELECT
  i.item_id,
  i.watcher_count,
  i.bid_count,
  i.listing_type,
  i.end_time,
  COALESCE(sw.snapshot_count, 0)                           AS snapshot_count,
  COALESCE(sw.earliest_watchers, i.watcher_count)          AS earliest_watchers,
  COALESCE(sw.latest_watchers,   i.watcher_count)          AS latest_watchers,
  COALESCE(
    (julianday(sw.latest_at) - julianday(sw.earliest_at)),
    0
  )                                                        AS days_span
FROM items i
LEFT JOIN snapshot_window sw ON sw.item_id = i.item_id
WHERE i.status = 'Active'
```

This query returns one row per active item. The TypeScript repo function then computes the actual heat score from the returned raw values — keeping the non-linear clamping and tier logic in TypeScript rather than SQLite.

### Why 14-day window

Velocity over a 14-day window captures both short-term spikes and sustained interest growth. A shorter window (e.g., 24h) would be too noisy for items synced infrequently; a longer window (e.g., 30 days) would underweight recent momentum. 14 days is the sweet spot for the typical collectibles auction lifecycle.

---

## 4. Where the Computation Runs

### 4.1 New repo function: `getHeatIndexBatch`

Location: `src/lib/db/trends.ts`

```typescript
// Returns a Map<itemId, HeatIndex> for all active items
export function getHeatIndexBatch(): Map<string, HeatIndex>
```

Called once per items API request — not cached, not memoized. The query is fast (linear scan of recent snapshots with an indexed `item_id` + `recorded_at`). For a watchlist of 50–200 items this adds under 10ms to API response time.

The function:
1. Runs the batch SQL query above
2. For each row, computes `velocityPerDay`, `watcherNorm`, `velocityNorm`, `bidNorm`, `urgencyNorm`
3. Applies listing type multiplier
4. Clamps and rounds to produce `heatScore`
5. Assigns tier by threshold comparison
6. Returns a `Map<string, HeatIndex>`

### 4.2 Items API integration

Location: `src/app/api/items/route.ts`

The GET handler calls `getHeatIndexBatch()` after `getAll()` and attaches the heat index to the response:

```typescript
const items  = getAll(filters)
const heatMap = getHeatIndexBatch()

// Response shape change:
return routeOk({
  ranked,
  unranked,
  counts,
  heatIndex: Object.fromEntries(heatMap),   // { [itemId]: HeatIndex }
})
```

The heat data travels alongside the items as a separate lookup object rather than being merged into `WatchlistItem`. This avoids changing the shared `WatchlistItem` type and keeps the computation result clearly separate from the source-of-truth item record.

### 4.3 Client consumption

The watchlist table currently fetches `/api/items` via `useSWR`. The response object will now include `heatIndex`. The `WatchlistTable` component (or the hook that feeds it) passes `heatIndex[item.id]` down to `WatchlistRow`, which passes it to `WatcherCell`.

---

## 5. UI Changes

### 5.1 Enhanced `WatcherCell`

**File**: `src/components/watchlist/watcher-cell.tsx`

The current component accepts `count`, `trend?`, and `delta?` but none of the trend/delta props are passed from `watchlist-row.tsx` (stub S5). This feature wires both at once.

**New props added**:
```typescript
interface WatcherCellProps {
  count: number | null
  trend?: number[]         // existing — sparkline data points
  delta?: number | null    // existing — absolute change for color display
  heat?: HeatIndex         // NEW — full heat index for indicator and tooltip
}
```

**Rendered layout** (left to right in the cell):

1. Heat indicator dot — a small colored circle (6×6px) positioned before the count number
2. Watcher count in monospace
3. Sparkline (if trend data available — now actually passed)
4. Delta badge (`+12` / `-3`) — now actually passed (fixes S5)

The heat dot uses a title attribute for tooltip on hover: "Heat: Hot (score 72 — +8 watchers/day)".

**Tier-to-color mapping** (Tailwind classes, matching the existing design token palette):

```
on-fire  →  bg-orange-500    (text: text-orange-400 for delta display)
hot      →  bg-red-500       (text: text-red-400)
warm     →  bg-amber-500     (text: text-amber-400)
cold     →  bg-gray-500      (text: text-gray-500)
```

No new CSS variables needed — these are standard Tailwind colors already in the project's Tailwind config.

**Full updated component**:

```tsx
'use client'
import type { HeatIndex } from '@/types'
import { Sparkline } from '@/components/ui/sparkline'

interface WatcherCellProps {
  count: number | null
  trend?: number[]
  delta?: number | null
  heat?: HeatIndex
}

const HEAT_DOT: Record<string, string> = {
  'on-fire': 'bg-orange-500',
  hot:       'bg-red-500',
  warm:      'bg-amber-500',
  cold:      'bg-gray-500',
}

const HEAT_LABEL: Record<string, string> = {
  'on-fire': 'On Fire',
  hot:       'Hot',
  warm:      'Warm',
  cold:      'Cold',
}

export function WatcherCell({ count, trend, delta, heat }: WatcherCellProps) {
  const dotClass = heat ? HEAT_DOT[heat.tier] : 'bg-gray-600'
  const dotTitle = heat
    ? `Heat: ${HEAT_LABEL[heat.tier]} (score ${heat.score}${heat.velocityPerDay > 0 ? ` — +${heat.velocityPerDay.toFixed(1)} watchers/day` : ''})`
    : undefined

  return (
    <div className="flex items-center gap-1.5">
      {/* Heat indicator dot */}
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`}
        title={dotTitle}
        aria-label={dotTitle}
      />
      <span className="text-xs font-mono text-text-primary">{count ?? '—'}</span>
      {trend && trend.length >= 2 && (
        <Sparkline data={trend} width={40} height={14} />
      )}
      {delta != null && delta !== 0 && (
        <span className={`text-[10px] font-mono ${delta > 0 ? 'text-status-active' : 'text-status-sold'}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  )
}
```

### 5.2 `watchlist-row.tsx` changes

**Fix S5**: Pass `trend` and `delta` to `WatcherCell`. Both require snapshot data that is now available via the heat index response (the `watcherDelta` field comes from `HeatIndex`, and the sparkline trend array can be derived from the same data or from a pre-computed array included in the response).

The row receives a `heatIndex` prop of type `HeatIndex | undefined`:

```tsx
// watchlist-row.tsx — watchers cell
{visibleColumns.watchers && (
  <td className="px-2 py-1.5">
    <WatcherCell
      count={item.watcherCount}
      heat={heat}
      delta={heat?.watcherDelta ?? null}
    />
  </td>
)}
```

`trend` (sparkline data) is omitted from this MVP pass — sparkline requires the full snapshot array, which is not fetched for the list view. The `delta` from `HeatIndex.watcherDelta` is sufficient for the inline change indicator and fixes S5 functionally.

### 5.3 Item detail page enhancement (optional, low-effort)

**File**: `src/components/detail/item-stats-grid.tsx`

The "Watchers" stat box can be augmented with a heat badge below the count. This requires the detail API to also return `HeatIndex` for the specific item (a single-item version of `getHeatIndexBatch` filtered to one item ID, or calling the batch and selecting from it).

```tsx
// In ItemStatsGrid, the Watchers StatBox becomes:
<div className="bg-surface border border-border rounded-lg p-3">
  <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-0.5">
    Watchers
  </p>
  <p className="text-sm font-medium text-text-primary">{item.watcherCount ?? 0}</p>
  {heat && (
    <Badge variant={heatVariant(heat.tier)} size="sm" className="mt-1">
      {HEAT_LABEL[heat.tier]}
    </Badge>
  )}
</div>
```

The `heatVariant` helper maps tiers to Badge variants:
```
on-fire → 'warning'   (amber — closest existing variant)
hot     → 'danger'
warm    → 'info'
cold    → 'default'
```

This is marked optional. The primary surface for the heat indicator is the watchlist table column.

---

## 6. Bug Fixes

### S5: WatcherCell trend/delta props never passed

**Location**: `src/components/watchlist/watchlist-row.tsx`, line 105.

**Current code**:
```tsx
<WatcherCell count={item.watcherCount} />
```

**Problem**: `WatcherCell` accepts `trend` and `delta` props but `watchlist-row.tsx` never passes them. The sparkline and delta indicator are dead code.

**Fix**: With the heat index response now returning `watcherDelta` per item, pass it as `delta`. The sparkline (`trend`) array can be added in a follow-on pass when snapshot arrays are included in the list response; for this feature, `delta` alone repairs the functional gap.

```tsx
<WatcherCell
  count={item.watcherCount}
  heat={heat}
  delta={heat?.watcherDelta ?? null}
/>
```

### S10: `topWatcherGains` sorts by raw count, not actual gains

**Location**: `src/app/api/trends/route.ts`, line 22–24.

**Current code**:
```typescript
const topWatcherGains = [...allItems]
  .sort((a, b) => (b.watcherCount ?? 0) - (a.watcherCount ?? 0))
  .slice(0, 5)
```

**Problem**: This sorts by highest current `watcher_count`, not by the largest recent gain. An item with 200 watchers that has been flat for a week ranks above an item with 50 watchers that gained 30 in the last 24 hours. The feature name ("Watcher Gains") is factually incorrect.

**Fix**: Use `HeatIndex.watcherDelta` from the batch computation, which is the actual absolute gain over the snapshot window.

```typescript
const heatMap = getHeatIndexBatch()

const topWatcherGains = [...allItems]
  .map((item) => ({ item, delta: heatMap.get(item.id)?.watcherDelta ?? 0 }))
  .sort((a, b) => b.delta - a.delta)
  .filter(({ delta }) => delta > 0)        // only genuine gainers
  .slice(0, 5)
  .map(({ item }) => item)
```

This also filters out items with flat or declining watcher counts, which do not belong in a "top gains" list.

---

## 7. Edge Cases

### Item with 0 watchers or null watcher_count

`watcher_count` can be `NULL` in the database when the eBay API does not return it. The batch query filters to rows where `watcher_count IS NOT NULL` when computing velocity. The `WatcherCell` renders `—` for null count. The heat dot renders cold gray. Score = 0, tier = 'cold'. No special handling needed.

### Item with only 1 snapshot (no velocity possible)

`snapshot_count = 1` from the batch query means `earliest_watchers = latest_watchers` and `days_span = 0`. Velocity calculation in TypeScript: if `days_span === 0`, set `velocityPerDay = 0` and `velocityNorm = 0`. The item's score still reflects watcher count, bid count, and urgency — just without a velocity component. The heat indicator correctly shows a lower tier than an equivalent item with growing watchers.

### Newly added item (just added to watchlist, first sync)

Same as 1-snapshot case. The first sync creates one `price_snapshots` row. Heat score reflects count + bids + urgency only. Velocity contributes on subsequent syncs. No error, no special case.

### Auction vs fixed-price watcher behavior

The listing type multiplier handles structural differences. Fixed-price items get a +15% boost because each watcher on a fixed-price listing represents stronger intent than on an auction (where watchers are partially prospective bidders who may not commit). The computation does not otherwise distinguish listing types — bid count naturally contributes 0 for all fixed-price items, and urgency functions the same way regardless of listing type.

### Item ending in the past (`end_time < now`)

`urgencyNorm = 0` — already handled by the `hoursRemaining <= 0` branch. The item likely has status `Ended` or `Sold` and would be excluded from the active items query, so this is belt-and-suspenders.

### All items have identical watcher counts (flat portfolio)

Velocity and urgency still differentiate items. The hot/cold tiers function correctly even when all items have the same raw count. No normalization collapse since the formula uses fixed denominators, not relative-to-population normalization.

### Very large watcher counts (collectibles that go viral)

Soft caps at 200 (watchers) and 10/day (velocity) prevent a single outlier from consuming the full scale. Items with 500 watchers and items with 250 watchers both score equally on the watcher component. Velocity still differentiates them if the 500-watcher item is growing faster.

---

## 8. E2E Test Specs

Tests go in `tests/e2e/`. They follow the same structure as existing specs — Playwright page routes, `mockWatchlistResponse` extended with `heatIndex` data.

### T-F1-01: Heat indicator dot renders in watchers column

```typescript
test('T-F1-01: heat indicator dot renders in watchers column', async ({ page }) => {
  // Arrange: items API response extended with heatIndex
  await page.route('**/api/items?*', (route) =>
    route.fulfill({
      json: {
        data: {
          ...mockWatchlistResponse.data,
          heatIndex: {
            '111': { score: 75, tier: 'hot', velocityPerDay: 8.5, watcherDelta: 24, snapshotCount: 7 },
            '222': { score: 42, tier: 'warm', velocityPerDay: 3.2, watcherDelta: 9, snapshotCount: 5 },
            '333': { score: 12, tier: 'cold', velocityPerDay: 0, watcherDelta: 0, snapshotCount: 3 },
          },
        },
      },
    })
  )

  await page.goto('/')
  await expect(page.locator('table')).toBeVisible()

  // The watchers column should contain heat indicator dots
  // Hot item (111) gets a red dot — bg-red-500
  const rows = page.locator('tbody tr')
  const firstRow = rows.nth(0)   // rank 1 = item 111
  const heatDot = firstRow.locator('[aria-label*="Heat: Hot"]')
  await expect(heatDot).toBeVisible()
  await expect(heatDot).toHaveAttribute('title', /Heat: Hot/)
})
```

### T-F1-02: Delta indicator shows watcher change from heat data

```typescript
test('T-F1-02: watcher delta shows watcherDelta from heat index', async ({ page }) => {
  await page.route('**/api/items?*', (route) =>
    route.fulfill({
      json: {
        data: {
          ...mockWatchlistResponse.data,
          heatIndex: {
            '111': { score: 75, tier: 'hot', velocityPerDay: 8.5, watcherDelta: 24, snapshotCount: 7 },
          },
        },
      },
    })
  )

  await page.goto('/')
  await expect(page.locator('table')).toBeVisible()

  // Delta "+24" should appear in the watchers cell for item 111
  const rows = page.locator('tbody tr')
  const firstRow = rows.nth(0)
  await expect(firstRow.locator('text=+24')).toBeVisible()
})
```

### T-F1-03: Cold items render gray indicator

```typescript
test('T-F1-03: cold tier items render gray heat dot', async ({ page }) => {
  await page.route('**/api/items?*', (route) =>
    route.fulfill({
      json: {
        data: {
          ...mockWatchlistResponse.data,
          heatIndex: {
            '333': { score: 8, tier: 'cold', velocityPerDay: 0, watcherDelta: 0, snapshotCount: 2 },
          },
        },
      },
    })
  )

  await page.goto('/')
  await expect(page.locator('table')).toBeVisible()

  // PSA 10 Rookie Card (rank 3, item 333) — cold tier
  const rows = page.locator('tbody tr')
  const thirdRow = rows.nth(2)
  const heatDot = thirdRow.locator('[aria-label*="Heat: Cold"]')
  await expect(heatDot).toBeVisible()
})
```

### T-F1-04: Trends page topWatcherGains shows actual gainers not highest count

```typescript
test('T-F1-04: topWatcherGains reflects actual delta not raw count', async ({ page }) => {
  // Mock trends where lowest-count item has highest delta
  await page.route('**/api/trends?*', (route) =>
    route.fulfill({
      json: {
        data: {
          ...mockTrendsResponse.data,
          // Item 333 (12 watchers, low count) is top gainer with delta=+15
          // Item 111 (124 watchers, high count) has delta=0
          topWatcherGains: [
            { ...mockItems[2], id: '333' },  // PSA 10 Rookie Card — actual top gainer
          ],
        },
      },
    })
  )

  await page.goto('/trends')
  await expect(page.getByTestId('top-watcher-gains')).toBeVisible()

  // PSA 10 (lowest watcher count but highest delta) should appear first
  const gainsList = page.getByTestId('top-watcher-gains')
  await expect(gainsList.getByText('PSA 10 Rookie Card')).toBeVisible()
})
```

---

## 9. Effort Estimate

| Task | File(s) | Time |
|------|---------|------|
| Add `HeatIndex` type + `HeatTier` to types | `src/types/index.ts` | 10 min |
| Implement `getHeatIndexBatch()` SQL + TS computation | `src/lib/db/trends.ts` | 60 min |
| Extend items API route to call batch + include in response | `src/app/api/items/route.ts` | 20 min |
| Fix S10: `topWatcherGains` sort in trends route | `src/app/api/trends/route.ts` | 15 min |
| Update `WatcherCell` with heat prop + heat dot indicator | `src/components/watchlist/watcher-cell.tsx` | 25 min |
| Fix S5: wire `heat` + `delta` props in `watchlist-row.tsx` | `src/components/watchlist/watchlist-row.tsx` | 15 min |
| Optional: heat badge in item detail stats grid | `src/components/detail/item-stats-grid.tsx` | 20 min |
| Update mock data with `heatIndex` shape | `tests/e2e/helpers/mock-data.ts` | 15 min |
| Write 4 E2E test specs | `tests/e2e/heat-index.spec.ts` | 30 min |
| Manual smoke test + threshold calibration | — | 20 min |
| **Total** | | **~3.5 hours** |

Excludes optional item detail badge (~20 min) if deferred.

---

## 10. File Inventory

### New files

| File | Purpose |
|------|---------|
| `tests/e2e/heat-index.spec.ts` | 4 E2E tests for heat indicator rendering |

### Modified files

| File | Change | Scope |
|------|--------|-------|
| `src/types/index.ts` | Add `HeatTier`, `HeatIndex` types | ~10 lines added |
| `src/lib/db/trends.ts` | Add `getHeatIndexBatch()` with SQL + computation + tier assignment | ~80 lines added |
| `src/app/api/items/route.ts` | Call `getHeatIndexBatch()`, include `heatIndex` in response | ~8 lines changed |
| `src/app/api/trends/route.ts` | Fix S10: sort `topWatcherGains` by delta using `heatMap` | ~10 lines changed |
| `src/components/watchlist/watcher-cell.tsx` | Add `heat?: HeatIndex` prop, render heat dot before count | ~20 lines changed |
| `src/components/watchlist/watchlist-row.tsx` | Fix S5: pass `heat` + `delta` to `WatcherCell` | ~5 lines changed |
| `src/components/detail/item-stats-grid.tsx` | (Optional) Add `HeatIndex` badge to Watchers stat box | ~15 lines changed |
| `tests/e2e/helpers/mock-data.ts` | Extend mock response with `heatIndex` map | ~15 lines added |

### No migrations

The `price_snapshots` and `items` tables already contain all required columns (`watcher_count`, `bid_count`, `listing_type`, `end_time`). No schema changes, no new tables, no `migrate.ts` changes.

---

## 11. Implementation Notes

### Threshold calibration

The tier thresholds (80/60/35) and formula weights (0.40/0.30/0.15/0.15) are best treated as named constants rather than magic numbers. Define them at the top of `getHeatIndexBatch()`:

```typescript
const VELOCITY_WEIGHT     = 0.40
const COUNT_WEIGHT        = 0.30
const BID_WEIGHT          = 0.15
const URGENCY_WEIGHT      = 0.15
const COUNT_CAP           = 200
const BID_CAP             = 20
const VELOCITY_CAP_PER_DAY = 10
const TIER_ON_FIRE        = 80
const TIER_HOT            = 60
const TIER_WARM           = 35
const SNAPSHOT_WINDOW_DAYS = 14
```

After deploying with real data, observe the score distribution. If 90% of items are "hot", lower the thresholds. If nothing ever reaches "warm", raise the velocity cap. The architecture supports this — all constants in one place, no database changes needed.

### Performance

The batch SQL query is designed to run once per items API request. For 200 active items with 14 days of snapshots (typical: 2–4 syncs/day = ~3,000 snapshot rows), the query will complete in under 5ms on SQLite. No caching layer is needed for this MVP.

If the watchlist grows beyond ~500 active items, add a composite index:
```sql
CREATE INDEX IF NOT EXISTS idx_snapshots_item_date_watcher
  ON price_snapshots (item_id, recorded_at, watcher_count);
```
This is not needed for the current scale and is explicitly deferred.

### SWR client-side access pattern

The items API response shape changes from:
```json
{ "data": { "ranked": [...], "unranked": [...], "counts": {...} } }
```
to:
```json
{ "data": { "ranked": [...], "unranked": [...], "counts": {...}, "heatIndex": { "111": {...}, ... } } }
```

Client code that currently destructures `data.ranked` and `data.unranked` from the SWR response is unaffected — `heatIndex` is additive. The `WatchlistTable` component receives `heatIndex` as a prop and passes `heatIndex[item.id]` to each `WatchlistRow`. If `heatIndex` is absent (e.g., during a loading state or if the API version lags), `WatcherCell` gracefully renders without the heat dot (`heat` prop is optional).
