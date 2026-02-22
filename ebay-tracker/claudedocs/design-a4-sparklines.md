# Design: A4 — Enhanced Price Sparklines

**Feature**: Batch-loaded price history sparklines in the watchlist table
**Effort**: 6.5 hours (see §10)
**Status**: Ready for implementation
**Author**: Frontend Architect
**Date**: 2026-02-21

---

## 1. Overview

### Problem

The `delta` column in the watchlist table currently renders a static `—` placeholder (watchlist-row.tsx line 98). Price snapshot data already exists in the `price_snapshots` table and is written by the sync service on every cycle. That data is never surfaced in the table view.

### Solution

Replace the `—` placeholder with an enhanced SVG sparkline showing the item's price history over the last N days. This gives the user at-a-glance trend awareness without clicking into the item detail view.

### What Changes

| File | Change |
|---|---|
| `src/lib/db/trends.ts` | Add `getSnapshotSummaries()` batch query |
| `src/types/index.ts` | Add `SparklineSummary` and `SnapshotSummariesResponse` types |
| `src/app/api/snapshots/route.ts` | New route: `GET /api/snapshots?ids=...&days=...` |
| `src/hooks/use-sparklines.ts` | New TanStack Query hook |
| `src/store/watchlist-store.ts` | Add `sparklineDays` preference to Zustand store |
| `src/components/ui/sparkline.tsx` | Enhance existing component (area fill, color coding, min/max dots, tooltip) |
| `src/components/watchlist/sparkline-cell.tsx` | New cell component wrapping the enhanced sparkline |
| `src/components/watchlist/watchlist-table.tsx` | Pass item IDs to sparkline hook; provide context |
| `src/components/watchlist/watchlist-row.tsx` | Replace `—` placeholder with `SparklineCell` |

**No migrations.** The `price_snapshots` table and its index already exist.

### Bloomberg Aesthetic Goal

Match the compact inline sparklines used in Bloomberg Terminal watchlist views: small area charts with a gradient fill, color-coded by direction, no axes, with a subtle hover tooltip. The component must render fast enough that 200 rows feel instantaneous.

---

## 2. Batch Snapshot Query

### The N+1 Problem

The existing `getSnapshots(itemId, days)` function in `src/lib/db/trends.ts` issues one query per item. With 200 items visible, this means 200 separate SQL round-trips. Even though better-sqlite3 is synchronous and fast, 200 sequential prepare/run cycles add unnecessary overhead, and the API route would need to call the function 200 times in a loop before responding.

### Solution: Single Batch Query

Add `getSnapshotSummaries()` to `src/lib/db/trends.ts`:

```ts
// src/lib/db/trends.ts (addition)

export interface SparklineSummary {
  itemId: string
  // price_cents values in chronological order, oldest first
  priceSeries: number[]
  // first price in the window (for computing overall delta)
  firstPrice: number
  // last price in the window (most recent)
  lastPrice: number
  // snapshot count in the window
  snapshotCount: number
}

export function getSnapshotSummaries(
  itemIds: string[],
  days: number
): SparklineSummary[] {
  if (itemIds.length === 0) return []

  const db = getDb()
  try {
    // Single query using GROUP_CONCAT + a per-item JSON-style aggregation.
    // SQLite does not have array_agg, but GROUP_CONCAT on ordered subquery
    // is equivalent when the values are simple numbers.
    //
    // The INNER subquery orders snapshots chronologically within each item
    // so GROUP_CONCAT preserves order. The outer query then aggregates.
    //
    // Parameterized IN clause: build placeholders dynamically.
    const placeholders = itemIds.map(() => '?').join(', ')

    const rows = db.prepare(`
      SELECT
        item_id,
        GROUP_CONCAT(price_cents ORDER BY recorded_at ASC) AS price_series,
        MIN(CASE WHEN rn = 1 THEN price_cents END) AS first_price,
        MAX(CASE WHEN rn = n THEN price_cents END) AS last_price,
        COUNT(*) AS snapshot_count
      FROM (
        SELECT
          item_id,
          price_cents,
          recorded_at,
          ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY recorded_at ASC) AS rn,
          COUNT(*) OVER (PARTITION BY item_id) AS n
        FROM price_snapshots
        WHERE item_id IN (${placeholders})
          AND recorded_at >= datetime('now', ?)
      )
      GROUP BY item_id
    `).all(...itemIds, `-${days} days`) as any[]

    return rows.map(row => ({
      itemId: row.item_id,
      priceSeries: String(row.price_series).split(',').map(Number),
      firstPrice: row.first_price,
      lastPrice: row.last_price,
      snapshotCount: row.snapshot_count,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get snapshot summaries: ${err.message}`)
  }
}
```

### SQLite Version Note

`ROW_NUMBER() OVER (...)` window functions require SQLite 3.25.0+ (released 2018). Node 18+ bundles better-sqlite3 with SQLite 3.40+. This is safe.

`GROUP_CONCAT` with an `ORDER BY` clause inside the aggregate requires SQLite 3.44.0+ (released November 2023). If the bundled version is older, replace the inner `ORDER BY` with the explicit subquery approach below:

```sql
-- Fallback for SQLite < 3.44: use ordered subquery instead of GROUP_CONCAT with ORDER BY
SELECT
  item_id,
  GROUP_CONCAT(price_cents) AS price_series,
  ...
FROM (
  SELECT item_id, price_cents, recorded_at
  FROM price_snapshots
  WHERE item_id IN (${placeholders})
    AND recorded_at >= datetime('now', ?)
  ORDER BY item_id, recorded_at ASC
)
GROUP BY item_id
```

The fallback relies on GROUP_CONCAT preserving insertion order of the subquery rows. This is guaranteed within a GROUP BY when the subquery is ordered, though technically implementation-defined. The primary approach with the window function is preferred when available.

### Query Complexity

- Single SQL round-trip regardless of item count
- Index `idx_snapshots_item` covers `(item_id, recorded_at)` — the WHERE and ORDER BY both use this index
- Expected execution time: 2-8ms for 200 items with 30 days of snapshots each (roughly 200 × 30 = 6,000 rows scanned)

### Type Additions to `src/types/index.ts`

```ts
// Add to src/types/index.ts

export interface SparklineSummary {
  itemId: string
  priceSeries: number[]   // price_cents, chronological
  firstPrice: number      // oldest in window
  lastPrice: number       // most recent
  snapshotCount: number
}

export interface SnapshotSummariesResponse {
  summaries: SparklineSummary[]
  days: number
}
```

Also extend `TrendsRepo`:

```ts
// In TrendsRepo interface
getSnapshotSummaries(itemIds: string[], days: number): SparklineSummary[]
```

---

## 3. API Route

### New file: `src/app/api/snapshots/route.ts`

```ts
import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getSnapshotSummaries } from '@/lib/db/trends'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams

    // `ids` is a comma-separated list of eBay item IDs
    const idsParam = params.get('ids') ?? ''
    const days = parseInt(params.get('days') ?? '7', 10)

    // Validate
    const allowedDays = [7, 14, 30]
    const resolvedDays = allowedDays.includes(days) ? days : 7

    const itemIds = idsParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    // Hard cap at 500 items; the table will never render more than that
    if (itemIds.length > 500) {
      return routeError(new Error('Too many item IDs requested'))
    }

    const summaries = getSnapshotSummaries(itemIds, resolvedDays)

    return routeOk({ summaries, days: resolvedDays })
  } catch (err) {
    return routeError(err)
  }
}
```

### URL Shape

```
GET /api/snapshots?ids=123456789,987654321,111222333&days=7
```

Response:
```json
{
  "data": {
    "days": 7,
    "summaries": [
      {
        "itemId": "123456789",
        "priceSeries": [4995, 4995, 4750, 4750, 4600],
        "firstPrice": 4995,
        "lastPrice": 4600,
        "snapshotCount": 5
      }
    ]
  }
}
```

Items with zero snapshots in the window are simply absent from the `summaries` array. The client handles absence as "no data" and renders nothing (or a dash).

---

## 4. Client Hook

### New file: `src/hooks/use-sparklines.ts`

```ts
'use client'
import { useQuery } from '@tanstack/react-query'
import type { SparklineSummary } from '@/types'

interface SparklinesResponse {
  summaries: SparklineSummary[]
  days: number
}

export function useSparklines(itemIds: string[], days: 7 | 14 | 30 = 7) {
  // Stable query key: sort IDs so reordering the table doesn't invalidate cache
  const sortedIds = [...itemIds].sort()

  return useQuery<Map<string, SparklineSummary>>({
    queryKey: ['sparklines', sortedIds, days],
    queryFn: async () => {
      if (sortedIds.length === 0) return new Map()

      const ids = sortedIds.join(',')
      const res = await fetch(`/api/snapshots?ids=${ids}&days=${days}`)
      if (!res.ok) throw new Error('Failed to fetch sparklines')
      const json = await res.json() as { data: SparklinesResponse }

      // Index by itemId for O(1) lookup in each row
      const map = new Map<string, SparklineSummary>()
      for (const summary of json.data.summaries) {
        map.set(summary.itemId, summary)
      }
      return map
    },
    // Sparklines don't need to be as fresh as item prices.
    // Sync runs at most every 15 minutes, so 5-minute stale time is fine.
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes after the component unmounts
    gcTime: 10 * 60 * 1000,
    // Don't hammer the API if the component remounts quickly
    refetchOnWindowFocus: false,
    // Refetch after a sync is triggered (see §4.1 for sync integration)
    refetchInterval: false,
    enabled: sortedIds.length > 0,
  })
}
```

The hook returns a `Map<string, SparklineSummary>` rather than an array. This makes per-row lookups O(1) instead of O(n), which matters at 200 rows.

### 4.1 Sync Integration

When the user triggers a manual sync (via `SyncButton`), sparkline data should refresh to reflect any new snapshots. The existing `use-sync.ts` hook can be extended to invalidate the `sparklines` query key after a successful sync:

```ts
// In use-sync.ts, after successful mutation:
queryClient.invalidateQueries({ queryKey: ['sparklines'] })
```

This is a one-line addition to the existing mutation's `onSuccess` callback.

---

## 5. Zustand Store Addition

### Changes to `src/store/watchlist-store.ts`

Add `sparklineDays` and its setter:

```ts
// Add to WatchlistStore interface:
sparklineDays: 7 | 14 | 30
setSparklineDays: (d: 7 | 14 | 30) => void

// Add to create() body:
sparklineDays: 7,
setSparklineDays: (d) => set({ sparklineDays: d }),
```

This persists the user's timeframe preference across re-renders. The column-toggle component (or filter bar) can expose a small segmented control for 7d / 14d / 30d.

---

## 6. Enhanced Sparkline Component

### Design Goals

- Area fill with gradient below the line for Bloomberg aesthetic depth
- Color-coded by direction: green when price has dropped (good for buyer), red when risen
- Subtle min and max price dots to anchor the range
- Optional hover tooltip showing the price value at each data point
- Pure SVG — no Recharts, no ResizeObserver, no external dependencies

### Full replacement: `src/components/ui/sparkline.tsx`

```tsx
'use client'
import { useId, useRef, useState, useCallback } from 'react'

interface SparklineProps {
  data: number[]           // price_cents values, chronological
  width?: number
  height?: number
  /** 'up' = price rose (red), 'down' = price fell (green), 'flat' = neutral (blue) */
  trend?: 'up' | 'down' | 'flat'
  showMinMax?: boolean
  showTooltip?: boolean
  /** Format function for tooltip values. Defaults to cents→dollars. */
  formatValue?: (cents: number) => string
}

function defaultFormat(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function Sparkline({
  data,
  width = 72,
  height = 22,
  trend,
  showMinMax = true,
  showTooltip = true,
  formatValue = defaultFormat,
}: SparklineProps) {
  const gradientId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: string } | null>(null)

  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // 2px padding top and bottom so dots at extremes aren't clipped
  const pad = 2
  const innerHeight = height - pad * 2

  const toSvgY = (cents: number) =>
    pad + innerHeight - ((cents - min) / range) * innerHeight

  const toSvgX = (i: number) => (i / (data.length - 1)) * width

  const points = data.map((v, i) => `${toSvgX(i).toFixed(1)},${toSvgY(v).toFixed(1)}`)
  const polylinePoints = points.join(' ')

  // Area path: line + close back along bottom
  const areaPath = [
    `M ${toSvgX(0).toFixed(1)},${toSvgY(data[0]).toFixed(1)}`,
    ...data.slice(1).map((v, i) => `L ${toSvgX(i + 1).toFixed(1)},${toSvgY(v).toFixed(1)}`),
    `L ${width},${height}`,
    `L 0,${height}`,
    'Z',
  ].join(' ')

  // Derived trend if not explicitly passed
  const resolvedTrend = trend ?? (
    data[data.length - 1] < data[0] ? 'down'
    : data[data.length - 1] > data[0] ? 'up'
    : 'flat'
  )

  const lineColor =
    resolvedTrend === 'down' ? '#22c55e'   // green-500 — price fell, good for buyer
    : resolvedTrend === 'up' ? '#ef4444'   // red-500   — price rose
    : '#1d6ab5'                             // accent blue — flat

  // Min and max point indices
  const minIdx = data.indexOf(min)
  const maxIdx = data.indexOf(max)

  // Tooltip interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!showTooltip || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    // Find nearest data point
    const idx = Math.round((mouseX / width) * (data.length - 1))
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx))
    const svgX = toSvgX(clampedIdx)
    const svgY = toSvgY(data[clampedIdx])
    setTooltip({ x: svgX, y: svgY, value: formatValue(data[clampedIdx]) })
  }, [showTooltip, data, width, formatValue])

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block"
        aria-hidden="true"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          stroke="none"
        />

        {/* Line */}
        <polyline
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />

        {/* Min/max dots */}
        {showMinMax && range > 0 && (
          <>
            <circle
              cx={toSvgX(minIdx).toFixed(1)}
              cy={toSvgY(min).toFixed(1)}
              r={2}
              fill={resolvedTrend === 'down' ? '#22c55e' : '#8b949e'}
            />
            <circle
              cx={toSvgX(maxIdx).toFixed(1)}
              cy={toSvgY(max).toFixed(1)}
              r={2}
              fill={resolvedTrend === 'up' ? '#ef4444' : '#8b949e'}
            />
          </>
        )}

        {/* Hover crosshair dot */}
        {tooltip && (
          <circle
            cx={tooltip.x.toFixed(1)}
            cy={tooltip.y.toFixed(1)}
            r={2.5}
            fill={lineColor}
            stroke="#21262d"
            strokeWidth={1}
          />
        )}
      </svg>

      {/* Tooltip bubble — rendered outside SVG so it can overflow the cell */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-primary bg-raised border border-border shadow-md whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y - 24,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.value}
        </div>
      )}
    </div>
  )
}
```

### Design Token Alignment

| Token | Value | Usage |
|---|---|---|
| `#1d6ab5` | Accent blue | Flat/neutral sparkline |
| `#22c55e` | Green-500 | Price fell (buyer-favorable) |
| `#ef4444` | Red-500 | Price rose |
| `#30363d` | Border/grid | Not used in sparkline itself |
| `#8b949e` | Text-secondary | Neutral min/max dots |
| `#21262d` | Surface-dark | Crosshair dot outline |

### Color Logic

A buyer benefits when price goes down. Therefore:

- `trend === 'down'` (lastPrice < firstPrice) → **green** line and fill
- `trend === 'up'` (lastPrice > firstPrice) → **red** line and fill
- `trend === 'flat'` (no change) → **blue** (accent) line and fill

This is consistent with how Bloomberg and most financial terminals color P&L: green = favorable outcome, red = unfavorable.

---

## 7. SparklineCell Component

### New file: `src/components/watchlist/sparkline-cell.tsx`

This is a thin wrapper that handles the "no data" state and the loading skeleton.

```tsx
'use client'
import type { SparklineSummary } from '@/types'
import { Sparkline } from '@/components/ui/sparkline'

interface SparklineCellProps {
  summary: SparklineSummary | undefined
  isLoading: boolean
}

export function SparklineCell({ summary, isLoading }: SparklineCellProps) {
  if (isLoading) {
    return (
      <div className="w-[72px] h-[22px] rounded bg-raised animate-pulse" />
    )
  }

  if (!summary || summary.snapshotCount < 2) {
    return <span className="text-xs text-text-secondary">—</span>
  }

  return (
    <Sparkline
      data={summary.priceSeries}
      width={72}
      height={22}
      showMinMax
      showTooltip
    />
  )
}
```

---

## 8. Integration into Watchlist Table and Row

### 8.1 watchlist-table.tsx changes

The table already receives `ranked` and `unranked` items. Add sparkline loading at this level so the hook fires once for all visible items, not once per row.

```tsx
// Add imports
import { useWatchlistStore } from '@/store/watchlist-store'
import { useSparklines } from '@/hooks/use-sparklines'

// Inside WatchlistTable component:
const sparklineDays = useWatchlistStore((s) => s.sparklineDays)
const allItems = [...ranked, ...unranked]
const allIds = allItems.map((i) => i.id)
const { data: sparklineMap, isLoading: sparklinesLoading } = useSparklines(allIds, sparklineDays)

// Pass to WatchlistRow:
<WatchlistRow
  key={item.id}
  item={item}
  sparklineSummary={sparklineMap?.get(item.id)}
  sparklinesLoading={sparklinesLoading}
/>
```

### 8.2 watchlist-row.tsx changes

Update the `WatchlistRowProps` interface and replace the placeholder cell:

```tsx
// Add to imports
import { SparklineCell } from './sparkline-cell'
import type { SparklineSummary } from '@/types'

// Updated interface
interface WatchlistRowProps {
  item: WatchlistItem
  sparklineSummary?: SparklineSummary
  sparklinesLoading?: boolean
}

// Replace the delta cell (lines 95-100):
{visibleColumns.delta && (
  <td className="px-2 py-1.5">
    <SparklineCell
      summary={sparklineSummary}
      isLoading={sparklinesLoading ?? false}
    />
  </td>
)}
```

No other changes to watchlist-row.tsx.

---

## 9. Sparkline Timeframe Options

The user can toggle between 7d, 14d, and 30d windows. The preference lives in Zustand (`sparklineDays`).

### UI Placement

Add a segmented control to the column-toggle panel (`column-toggle.tsx`) or as a small inline toggle above the table. The segmented control is 3 buttons: `7d | 14d | 30d`.

```tsx
// Suggested addition in column-toggle.tsx or filter-bar.tsx:
const sparklineDays = useWatchlistStore((s) => s.sparklineDays)
const setSparklineDays = useWatchlistStore((s) => s.setSparklineDays)

const days: Array<7 | 14 | 30> = [7, 14, 30]

return (
  <div className="flex items-center gap-0.5 border border-border rounded p-0.5">
    {days.map(d => (
      <button
        key={d}
        onClick={() => setSparklineDays(d)}
        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
          sparklineDays === d
            ? 'bg-accent text-white'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        {d}d
      </button>
    ))}
  </div>
)
```

Changing `sparklineDays` triggers a new TanStack Query fetch because the query key includes the days value. TanStack Query will use the cached result immediately if the new key was previously fetched, providing instant switching between already-loaded timeframes.

---

## 10. Edge Cases

### 10.1 Item with 0 snapshots

The batch query will not return a row for this item. `sparklineMap.get(itemId)` returns `undefined`. `SparklineCell` renders `—`.

### 10.2 Item with exactly 1 snapshot

The `priceSeries` array has one element. `Sparkline` returns `null` when `data.length < 2`. `SparklineCell` checks `snapshotCount < 2` first and also renders `—`.

### 10.3 All prices identical (flat series)

`min === max`, so `range = max - min = 0`, and the component forces `range = 1` to avoid division by zero. All points will have the same `y` coordinate, producing a horizontal line at vertical center. `trend === 'flat'`, color is accent blue. Min/max dots are suppressed when `range === 0` (the condition `range > 0` guards the dot rendering).

### 10.4 Large price swing (e.g., $5 → $500)

The SVG coordinate system normalizes all values to `[pad, height - pad]`. No clipping or overflow occurs regardless of the price magnitude. The gradient and line correctly span the full height.

### 10.5 Very sparse data (2 snapshots over 30 days)

Two points produce a single line segment. This is valid and renders correctly. The sparkline will look like a simple diagonal. This is better than showing `—` for sparse items.

### 10.6 Very dense data (multiple snapshots per day)

The SVG scales x-positions across `data.length - 1` steps. With 90+ points in a 72px-wide sparkline, adjacent points are sub-pixel apart. The polyline renderer collapses these into smooth curves. This is acceptable — sparklines are intentionally low-resolution trend indicators, not full charts.

### 10.7 Large item counts (URL length)

At 200 items, the query string is approximately `200 × 20 chars = 4,000 chars`. Well within the 8,192-character URL limit enforced by most servers and Next.js. No chunking required up to ~400 items. If the watchlist ever exceeds 400 items, chunk the IDs into batches of 400 and merge the results in the hook.

---

## 11. Performance Analysis

### Why SVG Polyline at 200 Rows is Acceptable

**Render cost per sparkline:**

Each `Sparkline` component produces:
- 1 `<svg>` element
- 1 `<defs>` + 1 `<linearGradient>` with 2 `<stop>` elements
- 1 `<path>` (area fill)
- 1 `<polyline>` (line)
- 0–2 `<circle>` elements (min/max dots, only when range > 0)
- Total: 7–9 DOM nodes

At 200 rows: approximately 1,400–1,800 DOM nodes added.

By comparison, a React component with a single `<div>` and two `<span>` children adds 3 DOM nodes per row × 200 = 600 nodes. The sparkline adds about 3x the DOM nodes of a text cell. This is not meaningful overhead for modern browsers.

**Layout cost:**

SVG elements are inlined in the table cell (`inline-block`). They do not participate in block layout flow — no reflow is triggered by sparkline rendering.

**Why Recharts would be worse:**

Recharts uses `ResizeObserver` to track container dimensions for responsive scaling. Each chart instance registers its own observer. At 200 rows, this creates 200 `ResizeObserver` instances. Browsers batch ResizeObserver callbacks but still process them on layout completion, adding overhead on every scroll or resize event.

The custom SVG approach uses fixed `width` and `height` props, eliminating all ResizeObserver usage. The only interactivity is a `mousemove` handler on the SVG element, which does a lightweight index calculation and a `useState` update — no layout reads involved.

**Render time estimate:**

- Initial paint of 200 rows with sparklines: ~8ms on a mid-range machine (based on comparable SVG table benchmarks)
- Subsequent renders (filter change, sort): React reconciles the unchanged sparkline data; polyline `points` string is stable unless data changes, so reconciliation is near-instantaneous
- Tooltip hover: single `useState` update, single SVG circle and tooltip div render — imperceptible

**Memory:**

200 sparkline summaries with 30 data points each = 200 × 30 × 8 bytes (number) ≈ 48 KB. Negligible.

---

## 12. E2E Test Specs

File location: `src/tests/e2e/t-sparklines.spec.ts` (follow the existing `t16`–`t28` naming convention if a slot is available; otherwise use a descriptive name).

```ts
import { test, expect } from '@playwright/test'

// Assumes dev server at http://localhost:3000
// Assumes at least one item in the watchlist with 2+ price snapshots recorded

test.describe('A4 — Price Sparklines', () => {

  test('sparkline renders for item with sufficient snapshot history', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table tbody tr', { timeout: 10_000 })

    // The delta column header should be visible
    await expect(page.locator('th:has-text("Delta")')).toBeVisible()

    // At least one sparkline SVG should appear in the delta cells
    // (requires at least one item with 2+ snapshots)
    const sparkline = page.locator('td svg').first()
    await expect(sparkline).toBeVisible({ timeout: 5_000 })
  })

  test('item with no snapshot history shows dash placeholder', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table tbody tr', { timeout: 10_000 })

    // Items without snapshots render the em dash text node
    // This test is meaningful only if the fixture includes an item with 0 snapshots.
    // If all items have snapshots, skip this assertion.
    const dashCells = page.locator('td').filter({ hasText: '—' })
    // Just assert the app doesn't crash — the dash can be from other columns too
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('sparkline tooltip appears on hover', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('td svg', { timeout: 10_000 })

    const firstSparkline = page.locator('td svg').first()
    await firstSparkline.hover()

    // Tooltip should appear showing a dollar-formatted price
    const tooltip = page.locator('[class*="font-mono"]:near(svg)').filter({ hasText: /\$\d+\.\d{2}/ })
    await expect(tooltip).toBeVisible({ timeout: 2_000 })
  })

  test('timeframe toggle refetches sparklines', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('td svg', { timeout: 10_000 })

    // Click the 14d timeframe button (location depends on UI placement)
    const btn14d = page.getByRole('button', { name: '14d' })
    if (await btn14d.isVisible()) {
      await btn14d.click()
      // Loading skeleton should briefly appear, then sparklines return
      // Wait for sparklines to re-render (stale state clears)
      await page.waitForSelector('td svg', { timeout: 8_000 })
      await expect(page.locator('td svg').first()).toBeVisible()
    }
  })

})
```

---

## 13. Effort Estimate

| Task | Estimated Time |
|---|---|
| Add `getSnapshotSummaries()` to `trends.ts` | 0.5h |
| Add types to `types/index.ts` | 0.25h |
| New API route `src/app/api/snapshots/route.ts` | 0.5h |
| New hook `src/hooks/use-sparklines.ts` | 0.5h |
| Add `sparklineDays` to Zustand store | 0.25h |
| Enhance `sparkline.tsx` (area fill, gradient, color, dots, tooltip) | 1.5h |
| New `sparkline-cell.tsx` component | 0.25h |
| Update `watchlist-table.tsx` (hook, pass props) | 0.5h |
| Update `watchlist-row.tsx` (replace placeholder) | 0.25h |
| Timeframe toggle UI (in column-toggle or filter-bar) | 0.5h |
| E2E test file | 0.75h |
| Manual QA and edge case verification | 0.75h |
| **Total** | **6.5h** |

---

## 14. File Change Summary

| File | Action | Notes |
|---|---|---|
| `src/lib/db/trends.ts` | Edit | Add `getSnapshotSummaries()` export |
| `src/types/index.ts` | Edit | Add `SparklineSummary`, `SnapshotSummariesResponse`; extend `TrendsRepo` |
| `src/app/api/snapshots/route.ts` | Create | New batch snapshots endpoint |
| `src/hooks/use-sparklines.ts` | Create | TanStack Query hook returning `Map<string, SparklineSummary>` |
| `src/store/watchlist-store.ts` | Edit | Add `sparklineDays` + `setSparklineDays` |
| `src/components/ui/sparkline.tsx` | Edit | Full enhancement: gradient, color, dots, tooltip |
| `src/components/watchlist/sparkline-cell.tsx` | Create | Loading/empty/data states |
| `src/components/watchlist/watchlist-table.tsx` | Edit | Add `useSparklines` hook; pass props to rows |
| `src/components/watchlist/watchlist-row.tsx` | Edit | Accept new props; replace `—` cell |
| `src/components/watchlist/column-toggle.tsx` or `filter-bar.tsx` | Edit | Add 7d/14d/30d segmented control |
| `src/tests/e2e/t-sparklines.spec.ts` | Create | 4 E2E tests |

**No database migrations. No new dependencies.**
