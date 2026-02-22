# Design Doc: D2 — Historical Sales Archive

**Feature**: Price Archive with OHLC Rollups and Candlestick Chart
**Status**: D2a — Ready to implement (6 hrs). D2b — Schema designed, implementation blocked on A1.
**Date**: 2026-02-21
**Branch**: implement/d2-historical-archive

---

## 1. Context and Motivation

The `price_snapshots` table already accumulates one row per sync cycle per item. At the default 10-minute sync interval with 200 items, this produces approximately 28,800 rows per day. After one year that is roughly 10.5 million rows. SQLite with WAL mode (already configured in `client.ts`) handles this without issue — a single-table scan on an indexed INTEGER primary key at this volume completes in under 100ms on commodity hardware.

The problem is that the existing query in `trends.ts::getSnapshots()` fetches raw rows directly for chart rendering. Serving 100,000+ raw rows to a chart when the user asks for "all time" is wasteful. More importantly, eBay's sold listing history is only 90 days, but our local `price_snapshots` table accumulates forever. After 6 months we have price history eBay cannot provide. This is the core value proposition of D2.

OHLC (Open/High/Low/Close) rollups solve both problems: they compress 144 raw snapshots per day into a single row, support fast time-range queries across years, and enable a candlestick chart view that communicates price volatility in a way the existing area chart cannot.

---

## 2. Architecture Overview

```
price_snapshots (raw, ~10M rows/year)
       |
       | daily cron at 00:05 UTC
       v
price_rollups (daily OHLC, ~73K rows/year at 200 items)
       |
       | (computed from daily rows)
       v
price_rollups (weekly/monthly OHLC, ~10K rows/year)
       |
GET /api/history/:itemId
       |
use-history.ts (TanStack Query)
       |
OHLCChart component (Recharts ComposedChart)
```

The rollup service is a separate concern from `sync-service.ts`. Sync writes raw snapshots; the rollup cron computes aggregations from them. These never run in the same transaction.

---

## 3. Database Schema

### 3a. Migration File

**File**: `src/lib/db/migrations/002_price_rollups.sql`

This file follows the exact pattern of `001_initial.sql`. The migration runner in `migrate.ts` reads all `.sql` files in the migrations directory in alphabetical order. The `_migrations` table prevents re-application.

```sql
-- Migration 002: Price rollup tables for D2 Historical Archive feature
-- D2a: price_rollups — OHLC aggregations from price_snapshots
-- D2b: comp_rollups  — sold comp aggregations (populated by A1, schema defined now)

CREATE TABLE price_rollups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  period_type    TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start   TEXT NOT NULL,  -- ISO date string: 'YYYY-MM-DD' for day/week, 'YYYY-MM-01' for month
  open_cents     INTEGER NOT NULL,  -- price_cents of first snapshot in period
  high_cents     INTEGER NOT NULL,  -- max price_cents in period
  low_cents      INTEGER NOT NULL,  -- min price_cents in period
  close_cents    INTEGER NOT NULL,  -- price_cents of last snapshot in period
  avg_cents      INTEGER NOT NULL,  -- ROUND(AVG(price_cents))
  volume         INTEGER NOT NULL,  -- count of raw snapshots in period
  watcher_open   INTEGER,           -- watcher_count of first snapshot (nullable)
  watcher_close  INTEGER,           -- watcher_count of last snapshot (nullable)
  watcher_high   INTEGER,           -- max watcher_count in period (nullable)
  computed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, period_type, period_start)
);

-- Primary query pattern: item + period_type + date range
CREATE INDEX idx_rollups_item_period ON price_rollups(item_id, period_type, period_start);

-- For bulk backfill and recompute queries
CREATE INDEX idx_rollups_period_start ON price_rollups(period_type, period_start);

-- D2b: Sold comp rollups (schema only — implementation blocked on A1)
-- card_key is a normalized identifier for a card/item category (e.g., "1952-topps-mickey-mantle-psa9")
-- A1 will define how card_key is computed from sold comp data.
CREATE TABLE comp_rollups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_key     TEXT NOT NULL,
  period_type  TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start TEXT NOT NULL,
  median_cents INTEGER NOT NULL,
  mean_cents   INTEGER NOT NULL,
  low_cents    INTEGER NOT NULL,
  high_cents   INTEGER NOT NULL,
  sale_count   INTEGER NOT NULL,
  computed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (card_key, period_type, period_start)
);

CREATE INDEX idx_comp_rollups_key_period ON comp_rollups(card_key, period_type, period_start);
```

### 3b. Schema Design Decisions

**`period_start` as TEXT**: SQLite has no native DATE type. Using `TEXT` in `YYYY-MM-DD` format is consistent with how `price_snapshots.recorded_at` is stored and how `trends.ts` already queries it with `date(recorded_at)`. Lexicographic ordering on ISO dates is identical to chronological ordering, so `ORDER BY period_start ASC` works correctly without casting.

**`period_start` for weeks**: Use ISO week start (Monday). The period_start for the week of 2025-03-10 is `2025-03-10`. Compute via `date(recorded_at, 'weekday 1', '-6 days')` in SQLite to get the Monday of that week. This is deterministic and avoids ambiguity.

**`period_start` for months**: Always `YYYY-MM-01`. The month of March 2025 is `2025-03-01`.

**`UNIQUE (item_id, period_type, period_start)`**: The rollup cron uses `INSERT OR REPLACE` to overwrite stale rollups when recomputing. This constraint enforces exactly one rollup row per (item, period, date) combination.

**`ON DELETE CASCADE` on `item_id`**: If an item is removed from the database (not currently implemented but possible), its rollups clean up automatically.

**No `avg_cents` for weekly/monthly from raw**: Weekly and monthly rollups are computed from daily rollup rows (hierarchical), not from `price_snapshots`. This makes recomputation fast and avoids full table scans on the raw table.

**Watcher fields nullable**: Some items return `null` for `watcher_count` from the eBay API (not available for all listing types). The rollup preserves this with nullable columns. A period with zero non-null watcher snapshots stores `NULL` in all three watcher columns.

---

## 4. Rollup Computation SQL

### 4a. Daily OHLC from Raw Snapshots

This is the core aggregation. It runs once per day at 00:05 UTC, covering the previous calendar day.

```sql
-- Compute daily rollups for a specific date
-- :date = 'YYYY-MM-DD', :item_id = eBay item ID string
INSERT OR REPLACE INTO price_rollups (
  item_id, period_type, period_start,
  open_cents, high_cents, low_cents, close_cents, avg_cents,
  volume, watcher_open, watcher_close, watcher_high
)
SELECT
  item_id,
  'day'                         AS period_type,
  date(recorded_at)             AS period_start,
  FIRST_VALUE(price_cents) OVER w  AS open_cents,
  MAX(price_cents)              AS high_cents,
  MIN(price_cents)              AS low_cents,
  LAST_VALUE(price_cents)  OVER w  AS close_cents,
  CAST(ROUND(AVG(price_cents)) AS INTEGER) AS avg_cents,
  COUNT(*)                      AS volume,
  FIRST_VALUE(watcher_count) OVER w AS watcher_open,
  LAST_VALUE(watcher_count)  OVER w AS watcher_close,
  MAX(watcher_count)            AS watcher_high
FROM price_snapshots
WHERE date(recorded_at) = :date
  AND item_id = :item_id
  AND price_cents > 0
GROUP BY item_id, date(recorded_at)
WINDOW w AS (PARTITION BY item_id, date(recorded_at) ORDER BY recorded_at
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING);
```

**Note on SQLite window functions**: `FIRST_VALUE` and `LAST_VALUE` require SQLite 3.25+ (released 2018). better-sqlite3 ships its own SQLite build at 3.46+. This is safe.

**Practical implementation note**: SQLite does not support `FIRST_VALUE` and `LAST_VALUE` in the same query as GROUP BY aggregates. The actual TypeScript implementation in `rollups.ts` uses two separate queries: one for OHLC/volume via subqueries, one for watcher boundary values. See Section 6a for the TypeScript implementation that handles this correctly.

### 4b. Weekly Rollup from Daily Rows

```sql
-- Compute weekly rollups from existing daily rollups
-- :week_start = 'YYYY-MM-DD' (Monday of the target week)
-- :week_end   = 'YYYY-MM-DD' (Sunday of the target week, inclusive)
INSERT OR REPLACE INTO price_rollups (
  item_id, period_type, period_start,
  open_cents, high_cents, low_cents, close_cents, avg_cents,
  volume, watcher_open, watcher_close, watcher_high
)
SELECT
  item_id,
  'week'         AS period_type,
  :week_start    AS period_start,
  (SELECT open_cents  FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :week_start AND r2.period_start <= :week_end
   ORDER BY r2.period_start ASC  LIMIT 1)  AS open_cents,
  MAX(high_cents)                           AS high_cents,
  MIN(low_cents)                            AS low_cents,
  (SELECT close_cents FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :week_start AND r2.period_start <= :week_end
   ORDER BY r2.period_start DESC LIMIT 1)  AS close_cents,
  CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
  SUM(volume)    AS volume,
  (SELECT watcher_open  FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :week_start AND r2.period_start <= :week_end
   ORDER BY r2.period_start ASC  LIMIT 1)  AS watcher_open,
  (SELECT watcher_close FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :week_start AND r2.period_start <= :week_end
   ORDER BY r2.period_start DESC LIMIT 1)  AS watcher_close,
  MAX(watcher_high)                         AS watcher_high
FROM price_rollups r1
WHERE period_type = 'day'
  AND period_start >= :week_start
  AND period_start <= :week_end
GROUP BY item_id;
```

**Volume-weighted average**: `SUM(avg_cents * volume) / SUM(volume)` is more accurate than `AVG(avg_cents)` when some days have fewer snapshots (system downtime, new item added mid-week).

### 4c. Monthly Rollup from Daily Rows

Same pattern as weekly but the date range spans a full month. Use daily rows directly (not weekly) for accuracy.

```sql
-- :month_start = 'YYYY-MM-01', :month_end = last day of month
-- month_end computed in TypeScript: new Date(year, month, 0) gives last day
INSERT OR REPLACE INTO price_rollups (
  item_id, period_type, period_start,
  open_cents, high_cents, low_cents, close_cents, avg_cents,
  volume, watcher_open, watcher_close, watcher_high
)
SELECT
  item_id,
  'month'        AS period_type,
  :month_start   AS period_start,
  (SELECT open_cents  FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :month_start AND r2.period_start <= :month_end
   ORDER BY r2.period_start ASC  LIMIT 1)  AS open_cents,
  MAX(high_cents)                           AS high_cents,
  MIN(low_cents)                            AS low_cents,
  (SELECT close_cents FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :month_start AND r2.period_start <= :month_end
   ORDER BY r2.period_start DESC LIMIT 1)  AS close_cents,
  CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
  SUM(volume)    AS volume,
  (SELECT watcher_open  FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :month_start AND r2.period_start <= :month_end
   ORDER BY r2.period_start ASC  LIMIT 1)  AS watcher_open,
  (SELECT watcher_close FROM price_rollups r2
   WHERE r2.item_id = r1.item_id AND r2.period_type = 'day'
     AND r2.period_start >= :month_start AND r2.period_start <= :month_end
   ORDER BY r2.period_start DESC LIMIT 1)  AS watcher_close,
  MAX(watcher_high)                         AS watcher_high
FROM price_rollups r1
WHERE period_type = 'day'
  AND period_start >= :month_start
  AND period_start <= :month_end
GROUP BY item_id;
```

### 4d. Gap Handling (Item Not Synced for a Day)

If an item is not synced for a day (server downtime, eBay API failure), there will be no raw snapshot rows for that date, and the daily rollup will not exist. This is the correct behavior — do not carry forward the previous close. Gaps are visible in the chart as missing candles, which accurately represents "we don't know what the price was that day." Carrying forward invents data and would make the chart misleading.

At the API layer, the `GET /api/history/:itemId` response array will simply not contain a point for that date. The chart component handles sparse data naturally because each OHLC point is self-contained.

---

## 5. TypeScript Types

Add the following to `src/types/index.ts` in the existing file, after the `PortfolioDataPoint` interface:

```typescript
// === Historical Archive Types (D2) ===

export type RollupPeriod = 'day' | 'week' | 'month'

export interface PriceRollup {
  id: number
  itemId: string
  periodType: RollupPeriod
  periodStart: string        // ISO date 'YYYY-MM-DD'
  openCents: number
  highCents: number
  lowCents: number
  closeCents: number
  avgCents: number
  volume: number             // number of raw snapshots in this period
  watcherOpen: number | null
  watcherClose: number | null
  watcherHigh: number | null
  computedAt: string         // ISO datetime
}

// OHLCPoint is the chart-ready shape derived from PriceRollup
export interface OHLCPoint {
  date: string               // display date label (e.g., 'Mar 10' or 'Mar 10–16' for week)
  periodStart: string        // raw 'YYYY-MM-DD' for tooltip and keying
  open: number               // dollars (cents / 100)
  high: number
  low: number
  close: number
  avg: number
  volume: number
  watcherOpen: number | null
  watcherClose: number | null
  watcherHigh: number | null
  bullish: boolean           // close >= open (used for candle color)
}

export interface HistoricalQuery {
  itemId: string
  period: RollupPeriod
  from?: string              // ISO date, inclusive. Omit for oldest available.
  to?: string                // ISO date, inclusive. Omit for today.
}

export interface HistoricalSummary {
  itemId: string
  period: RollupPeriod
  dataPoints: number         // total OHLC points in response
  allTimeHigh: number        // cents
  allTimeLow: number         // cents
  fiftyTwoWeekHigh: number   // cents
  fiftyTwoWeekLow: number    // cents
  avgCents: number           // volume-weighted average over the range
  firstDate: string          // earliest period_start in DB
  latestClose: number        // most recent close_cents
  trend: 'up' | 'down' | 'flat'  // close vs open of full range, 2% threshold
}

// D2b (blocked on A1): comp_rollups types
export interface CompRollup {
  id: number
  cardKey: string
  periodType: RollupPeriod
  periodStart: string
  medianCents: number
  meanCents: number
  lowCents: number
  highCents: number
  saleCount: number
  computedAt: string
}
```

---

## 6. New Files

### 6a. `src/lib/db/rollups.ts`

This file follows the pattern of `trends.ts` exactly: synchronous better-sqlite3 prepared statements, `DatabaseError` for all caught errors, a typed repo object exported at the bottom.

```typescript
import type { PriceRollup, OHLCPoint, RollupPeriod, HistoricalQuery, HistoricalSummary } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

// ── Row mapper ─────────────────────────────────────────────────────────────

function rowToRollup(row: any): PriceRollup {
  return {
    id: row.id,
    itemId: row.item_id,
    periodType: row.period_type as RollupPeriod,
    periodStart: row.period_start,
    openCents: row.open_cents,
    highCents: row.high_cents,
    lowCents: row.low_cents,
    closeCents: row.close_cents,
    avgCents: row.avg_cents,
    volume: row.volume,
    watcherOpen: row.watcher_open,
    watcherClose: row.watcher_close,
    watcherHigh: row.watcher_high,
    computedAt: row.computed_at,
  }
}

// ── Daily rollup computation ───────────────────────────────────────────────

/**
 * Compute and upsert daily OHLC rollup for a specific item and date.
 * date format: 'YYYY-MM-DD'
 * Returns true if a rollup was written, false if no snapshots existed for that date.
 */
export function computeDailyRollup(itemId: string, date: string): boolean {
  const db = getDb()
  try {
    // SQLite cannot mix window functions with GROUP BY aggregates reliably.
    // Use two subqueries to get boundary values (first/last snapshot of the day).
    const row = db.prepare(`
      SELECT
        MIN(price_cents)                   AS low_cents,
        MAX(price_cents)                   AS high_cents,
        CAST(ROUND(AVG(price_cents)) AS INTEGER) AS avg_cents,
        COUNT(*)                           AS volume,
        MAX(watcher_count)                 AS watcher_high,
        (SELECT price_cents   FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at ASC  LIMIT 1) AS open_cents,
        (SELECT price_cents   FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at DESC LIMIT 1) AS close_cents,
        (SELECT watcher_count FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at ASC  LIMIT 1) AS watcher_open,
        (SELECT watcher_count FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at DESC LIMIT 1) AS watcher_close
      FROM price_snapshots
      WHERE item_id = ? AND date(recorded_at) = ? AND price_cents > 0
    `).get(
      itemId, date,  // open subquery
      itemId, date,  // close subquery
      itemId, date,  // watcher_open subquery
      itemId, date,  // watcher_close subquery
      itemId, date   // main aggregate
    ) as any

    if (!row || row.volume === 0) return false

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_open, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'day', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      itemId, date,
      row.open_cents, row.high_cents, row.low_cents, row.close_cents, row.avg_cents,
      row.volume, row.watcher_open, row.watcher_close, row.watcher_high
    )
    return true
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute daily rollup for ${itemId} on ${date}: ${err.message}`)
  }
}

/**
 * Compute daily rollups for ALL items for a given date (used by cron and backfill).
 */
export function computeDailyRollupsForDate(date: string): { processed: number; written: number } {
  const db = getDb()
  try {
    // Get distinct item_ids that have snapshots for this date
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_snapshots
      WHERE date(recorded_at) = ? AND price_cents > 0
    `).all(date) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      if (computeDailyRollup(item_id, date)) written++
    }
    return { processed: items.length, written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute daily rollups for ${date}: ${err.message}`)
  }
}

// ── Weekly rollup computation ──────────────────────────────────────────────

/**
 * Compute weekly rollup from existing daily rollups.
 * weekStart: 'YYYY-MM-DD' — the Monday of the target week.
 * weekEnd:   'YYYY-MM-DD' — the Sunday of the target week.
 */
export function computeWeeklyRollup(weekStart: string, weekEnd: string): { written: number } {
  const db = getDb()
  try {
    // Find all items with daily rollups in this week range
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_rollups
      WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
    `).all(weekStart, weekEnd) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      const agg = db.prepare(`
        SELECT
          SUM(volume) AS total_volume,
          MAX(high_cents) AS high_cents,
          MIN(low_cents) AS low_cents,
          MAX(watcher_high) AS watcher_high,
          CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
          (SELECT open_cents FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start ASC LIMIT 1) AS open_cents,
          (SELECT close_cents FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start DESC LIMIT 1) AS close_cents,
          (SELECT watcher_open FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start ASC LIMIT 1) AS watcher_open,
          (SELECT watcher_close FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start DESC LIMIT 1) AS watcher_close
        FROM price_rollups
        WHERE item_id = ? AND period_type = 'day'
          AND period_start >= ? AND period_start <= ?
      `).get(
        item_id, weekStart, weekEnd,  // open subquery
        item_id, weekStart, weekEnd,  // close subquery
        item_id, weekStart, weekEnd,  // watcher_open subquery
        item_id, weekStart, weekEnd,  // watcher_close subquery
        item_id, weekStart, weekEnd   // main aggregate
      ) as any

      if (!agg || !agg.total_volume) continue

      db.prepare(`
        INSERT OR REPLACE INTO price_rollups (
          item_id, period_type, period_start,
          open_cents, high_cents, low_cents, close_cents, avg_cents,
          volume, watcher_open, watcher_close, watcher_high, computed_at
        ) VALUES (?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        item_id, weekStart,
        agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
        agg.total_volume, agg.watcher_open, agg.watcher_close, agg.watcher_high
      )
      written++
    }
    return { written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute weekly rollup for week of ${weekStart}: ${err.message}`)
  }
}

// ── Monthly rollup computation ─────────────────────────────────────────────

/**
 * Compute monthly rollup from existing daily rollups.
 * monthStart: 'YYYY-MM-01'
 * monthEnd:   last day of month, e.g. 'YYYY-MM-31'
 */
export function computeMonthlyRollup(monthStart: string, monthEnd: string): { written: number } {
  const db = getDb()
  try {
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_rollups
      WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
    `).all(monthStart, monthEnd) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      const agg = db.prepare(`
        SELECT
          SUM(volume) AS total_volume,
          MAX(high_cents) AS high_cents,
          MIN(low_cents) AS low_cents,
          MAX(watcher_high) AS watcher_high,
          CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
          (SELECT open_cents FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start ASC LIMIT 1) AS open_cents,
          (SELECT close_cents FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start DESC LIMIT 1) AS close_cents,
          (SELECT watcher_open FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start ASC LIMIT 1) AS watcher_open,
          (SELECT watcher_close FROM price_rollups
           WHERE item_id = ? AND period_type = 'day'
             AND period_start >= ? AND period_start <= ?
           ORDER BY period_start DESC LIMIT 1) AS watcher_close
        FROM price_rollups
        WHERE item_id = ? AND period_type = 'day'
          AND period_start >= ? AND period_start <= ?
      `).get(
        item_id, monthStart, monthEnd,
        item_id, monthStart, monthEnd,
        item_id, monthStart, monthEnd,
        item_id, monthStart, monthEnd,
        item_id, monthStart, monthEnd
      ) as any

      if (!agg || !agg.total_volume) continue

      db.prepare(`
        INSERT OR REPLACE INTO price_rollups (
          item_id, period_type, period_start,
          open_cents, high_cents, low_cents, close_cents, avg_cents,
          volume, watcher_open, watcher_close, watcher_high, computed_at
        ) VALUES (?, 'month', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        item_id, monthStart,
        agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
        agg.total_volume, agg.watcher_open, agg.watcher_close, agg.watcher_high
      )
      written++
    }
    return { written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute monthly rollup for ${monthStart}: ${err.message}`)
  }
}

// ── Query functions ────────────────────────────────────────────────────────

export function getRollups(query: HistoricalQuery): PriceRollup[] {
  const db = getDb()
  try {
    const conditions: string[] = ['item_id = ?', 'period_type = ?']
    const params: any[] = [query.itemId, query.period]

    if (query.from) {
      conditions.push('period_start >= ?')
      params.push(query.from)
    }
    if (query.to) {
      conditions.push('period_start <= ?')
      params.push(query.to)
    }

    const rows = db.prepare(`
      SELECT * FROM price_rollups
      WHERE ${conditions.join(' AND ')}
      ORDER BY period_start ASC
    `).all(...params)

    return (rows as any[]).map(rowToRollup)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get rollups: ${err.message}`)
  }
}

export function getHistoricalSummary(itemId: string, period: RollupPeriod): HistoricalSummary | null {
  const db = getDb()
  try {
    const allTime = db.prepare(`
      SELECT
        COUNT(*) AS data_points,
        MAX(high_cents) AS all_time_high,
        MIN(low_cents) AS all_time_low,
        MIN(period_start) AS first_date,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents
      FROM price_rollups
      WHERE item_id = ? AND period_type = ?
    `).get(itemId, period) as any

    if (!allTime || allTime.data_points === 0) return null

    const fiftyTwo = db.prepare(`
      SELECT
        MAX(high_cents) AS high,
        MIN(low_cents)  AS low
      FROM price_rollups
      WHERE item_id = ? AND period_type = ?
        AND period_start >= date('now', '-52 weeks')
    `).get(itemId, period) as any

    const latest = db.prepare(`
      SELECT close_cents, open_cents FROM price_rollups
      WHERE item_id = ? AND period_type = ?
      ORDER BY period_start DESC LIMIT 1
    `).get(itemId, period) as any

    const earliest = db.prepare(`
      SELECT open_cents FROM price_rollups
      WHERE item_id = ? AND period_type = ?
      ORDER BY period_start ASC LIMIT 1
    `).get(itemId, period) as any

    const priceDiff = latest.close_cents - earliest.open_cents
    const threshold = earliest.open_cents * 0.02
    const trend: 'up' | 'down' | 'flat' =
      priceDiff > threshold ? 'up' : priceDiff < -threshold ? 'down' : 'flat'

    return {
      itemId,
      period,
      dataPoints: allTime.data_points,
      allTimeHigh: allTime.all_time_high,
      allTimeLow: allTime.all_time_low,
      fiftyTwoWeekHigh: fiftyTwo?.high ?? allTime.all_time_high,
      fiftyTwoWeekLow: fiftyTwo?.low ?? allTime.all_time_low,
      avgCents: allTime.avg_cents,
      firstDate: allTime.first_date,
      latestClose: latest.close_cents,
      trend,
    }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get historical summary for ${itemId}: ${err.message}`)
  }
}

/**
 * Count raw snapshots older than cutoff — used by data retention reporting.
 */
export function countSnapshotsOlderThan(days: number): number {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM price_snapshots
      WHERE recorded_at < datetime('now', ?)
    `).get(`-${days} days`) as any
    return row.cnt
  } catch (err: any) {
    throw new DatabaseError(`Failed to count old snapshots: ${err.message}`)
  }
}

export const rollupsRepo = {
  computeDailyRollup,
  computeDailyRollupsForDate,
  computeWeeklyRollup,
  computeMonthlyRollup,
  getRollups,
  getHistoricalSummary,
  countSnapshotsOlderThan,
}
```

### 6b. `src/lib/archive/rollup-service.ts`

This file is the scheduling logic for rollup computation. It is called from `scheduler.ts` and from the backfill script. It does not import from `sync-service.ts` and has no dependency on eBay API.

```typescript
import { computeDailyRollupsForDate, computeWeeklyRollup, computeMonthlyRollup } from '../db/rollups'

/**
 * Returns 'YYYY-MM-DD' for the given Date object.
 */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the Monday of the ISO week containing the given date.
 */
function getWeekStart(d: Date): Date {
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day  // shift to Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Returns 'YYYY-MM-DD' for the last day of the given year/month (1-based).
 */
function getMonthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month, 0)  // day 0 of next month = last day of this month
  return toISODate(lastDay)
}

/**
 * Run daily rollup for yesterday. Called by cron at 00:05 UTC daily.
 * Also triggers weekly rollup if yesterday was a Sunday,
 * and monthly rollup if yesterday was the last day of the month.
 */
export async function runNightlyRollup(): Promise<void> {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setUTCDate(now.getUTCDate() - 1)
  const yesterdayStr = toISODate(yesterday)

  console.log(`[rollup] Starting nightly rollup for ${yesterdayStr}`)

  // Daily rollup — always
  const dailyResult = computeDailyRollupsForDate(yesterdayStr)
  console.log(`[rollup] Daily: ${dailyResult.written} rollups written for ${dailyResult.processed} items`)

  // Weekly rollup — if yesterday was a Sunday (end of ISO week)
  const dayOfWeek = yesterday.getUTCDay()  // 0=Sun
  if (dayOfWeek === 0) {
    const weekStart = getWeekStart(yesterday)
    const weekStartStr = toISODate(weekStart)
    const weekEndStr = yesterdayStr
    const weeklyResult = computeWeeklyRollup(weekStartStr, weekEndStr)
    console.log(`[rollup] Weekly: ${weeklyResult.written} rollups written for week ${weekStartStr}`)
  }

  // Monthly rollup — if yesterday was the last day of its month
  const year = yesterday.getUTCFullYear()
  const month = yesterday.getUTCMonth() + 1  // 1-based
  const lastOfMonth = getMonthEnd(year, month)
  if (yesterdayStr === lastOfMonth) {
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`
    const monthlyResult = computeMonthlyRollup(monthStartStr, lastOfMonth)
    console.log(`[rollup] Monthly: ${monthlyResult.written} rollups written for ${monthStartStr}`)
  }

  console.log(`[rollup] Nightly rollup complete`)
}

/**
 * Backfill all rollups from the beginning of price_snapshots history.
 * Run once after migration, or to repair after schema changes.
 *
 * This is SLOW for large datasets — run offline or in a one-off script.
 * At 200 items × 365 days, expect ~5 minutes for the full day pass.
 */
export async function backfillAllRollups(): Promise<void> {
  const { getDb } = await import('../db/client')
  const db = getDb()

  // Find date range of all snapshots
  const range = db.prepare(`
    SELECT
      date(MIN(recorded_at)) AS first_date,
      date(MAX(recorded_at)) AS last_date
    FROM price_snapshots
  `).get() as any

  if (!range?.first_date) {
    console.log('[backfill] No snapshots found — nothing to backfill')
    return
  }

  const start = new Date(range.first_date + 'T00:00:00Z')
  const end = new Date(range.last_date + 'T00:00:00Z')
  let current = new Date(start)

  console.log(`[backfill] Starting backfill from ${range.first_date} to ${range.last_date}`)
  let totalDays = 0
  let totalWritten = 0

  // Pass 1: daily rollups for every date in range
  while (current <= end) {
    const dateStr = toISODate(current)
    const result = computeDailyRollupsForDate(dateStr)
    totalWritten += result.written
    totalDays++
    if (totalDays % 30 === 0) {
      console.log(`[backfill] Daily pass: processed ${totalDays} days, ${totalWritten} rollups written`)
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }
  console.log(`[backfill] Daily pass complete: ${totalDays} days, ${totalWritten} rollups`)

  // Pass 2: weekly rollups for every complete week in range
  current = new Date(start)
  let totalWeeks = 0
  while (current <= end) {
    const weekStart = getWeekStart(current)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)  // Sunday
    if (weekEnd <= end) {
      const result = computeWeeklyRollup(toISODate(weekStart), toISODate(weekEnd))
      totalWeeks += result.written
    }
    current = new Date(weekEnd)
    current.setUTCDate(weekEnd.getUTCDate() + 1)  // advance to next Monday
  }
  console.log(`[backfill] Weekly pass complete: ${totalWeeks} rollups`)

  // Pass 3: monthly rollups for every complete month in range
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  let totalMonths = 0
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth() + 1

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = getMonthEnd(year, month)
    // Only rollup complete months (don't rollup the current in-progress month)
    if (monthEnd <= toISODate(end)) {
      const result = computeMonthlyRollup(monthStart, monthEnd)
      totalMonths += result.written
    }
    month++
    if (month > 12) { month = 1; year++ }
  }
  console.log(`[backfill] Monthly pass complete: ${totalMonths} rollups`)
  console.log('[backfill] Backfill complete')
}
```

### 6c. `src/app/api/history/[itemId]/route.ts`

Follows the exact pattern of `src/app/api/trends/route.ts`: parse query params, call repo, return `routeOk` or `routeError`.

```typescript
import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getRollups, getHistoricalSummary } from '@/lib/db/rollups'
import type { RollupPeriod, OHLCPoint } from '@/types'

// Label formatter for chart display
function formatDateLabel(periodStart: string, period: RollupPeriod): string {
  const d = new Date(periodStart + 'T00:00:00Z')
  if (period === 'day') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  if (period === 'week') {
    const end = new Date(d)
    end.setUTCDate(d.getUTCDate() + 6)
    const startLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    const endLabel = end.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
    return `${startLabel}–${endLabel}`
  }
  // month
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params
    const searchParams = request.nextUrl.searchParams

    const periodParam = searchParams.get('period') ?? 'day'
    if (!['day', 'week', 'month'].includes(periodParam)) {
      throw new AppError('INVALID_PARAM', 'period must be day, week, or month', 400)
    }
    const period = periodParam as RollupPeriod

    const from = searchParams.get('from') ?? undefined
    const to = searchParams.get('to') ?? undefined

    // Validate date format if provided
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (from && !dateRe.test(from)) {
      throw new AppError('INVALID_PARAM', 'from must be YYYY-MM-DD', 400)
    }
    if (to && !dateRe.test(to)) {
      throw new AppError('INVALID_PARAM', 'to must be YYYY-MM-DD', 400)
    }

    const rollups = getRollups({ itemId, period, from, to })

    const points: OHLCPoint[] = rollups.map(r => ({
      date: formatDateLabel(r.periodStart, period),
      periodStart: r.periodStart,
      open: r.openCents / 100,
      high: r.highCents / 100,
      low: r.lowCents / 100,
      close: r.closeCents / 100,
      avg: r.avgCents / 100,
      volume: r.volume,
      watcherOpen: r.watcherOpen,
      watcherClose: r.watcherClose,
      watcherHigh: r.watcherHigh,
      bullish: r.closeCents >= r.openCents,
    }))

    return routeOk(points)
  } catch (err) {
    return routeError(err)
  }
}
```

**Also create `src/app/api/history/[itemId]/summary/route.ts`:**

```typescript
import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getHistoricalSummary } from '@/lib/db/rollups'
import type { RollupPeriod } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params
    const periodParam = request.nextUrl.searchParams.get('period') ?? 'day'
    if (!['day', 'week', 'month'].includes(periodParam)) {
      throw new AppError('INVALID_PARAM', 'period must be day, week, or month', 400)
    }

    const summary = getHistoricalSummary(itemId, periodParam as RollupPeriod)
    if (!summary) {
      throw new AppError('NOT_FOUND', `No historical data for item ${itemId}`, 404)
    }

    return routeOk(summary)
  } catch (err) {
    return routeError(err)
  }
}
```

### 6d. `src/hooks/use-history.ts`

Follows the exact pattern of `use-item-detail.ts` and `use-trends.ts`.

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import type { OHLCPoint, HistoricalSummary, RollupPeriod } from '@/types'

interface UseHistoryParams {
  itemId: string
  period: RollupPeriod
  from?: string
  to?: string
}

export function useHistory({ itemId, period, from, to }: UseHistoryParams) {
  return useQuery<OHLCPoint[]>({
    queryKey: ['history', itemId, period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/history/${itemId}?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch history')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
    // Historical data doesn't change until the next nightly rollup.
    // Stale time of 1 hour avoids unnecessary re-fetches.
    staleTime: 60 * 60 * 1000,
  })
}

export function useHistorySummary(itemId: string, period: RollupPeriod = 'day') {
  return useQuery<HistoricalSummary>({
    queryKey: ['history-summary', itemId, period],
    queryFn: async () => {
      const res = await fetch(`/api/history/${itemId}/summary?period=${period}`)
      if (!res.ok) throw new Error('Failed to fetch history summary')
      const json = await res.json()
      return json.data
    },
    enabled: !!itemId,
    staleTime: 60 * 60 * 1000,
  })
}
```

### 6e. `src/components/detail/ohlc-chart.tsx`

Uses Recharts (already installed at `^2.0.0`). Recharts does not have a built-in candlestick chart, so we implement it using `ComposedChart` with a custom shape for the candle body + wick. This avoids adding a new dependency.

The chart renders:
- Candlestick bodies: green if `close >= open`, red if `close < open`
- Wicks: thin lines for high and low
- Watcher overlay on a secondary Y-axis (only shown if watcher data exists)
- Time range selector tabs (7d, 30d, 90d, 1y, all)
- Responsive via `ResponsiveContainer`

```typescript
'use client'
import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import type { OHLCPoint, RollupPeriod } from '@/types'
import { useHistory } from '@/hooks/use-history'

// ── Time range presets ─────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all'

const RANGES: Array<{ label: string; value: TimeRange }> = [
  { label: '7D',  value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y',  value: '1y' },
  { label: 'All', value: 'all' },
]

function rangeToParams(range: TimeRange, period: RollupPeriod): { from?: string; to?: string } {
  if (range === 'all') return {}
  const now = new Date()
  const from = new Date(now)
  if (range === '7d')  from.setDate(now.getDate() - 7)
  if (range === '30d') from.setDate(now.getDate() - 30)
  if (range === '90d') from.setDate(now.getDate() - 90)
  if (range === '1y')  from.setFullYear(now.getFullYear() - 1)
  return { from: from.toISOString().slice(0, 10) }
}

// ── Custom candlestick shape ───────────────────────────────────────────────
// Recharts renders each data point's shape via a custom <rect> layer.
// We use a ComposedChart with a Bar that has renderCustomBarLabel replaced
// by a fully custom shape rendered via recharts customized props.

interface CandleProps {
  x?: number        // recharts injects these via xAxisMap
  y?: number
  width?: number
  height?: number
  payload?: OHLCPoint
  xAxis?: any
  yAxis?: any
}

function CandleShape(props: CandleProps) {
  const { x = 0, width = 0, payload } = props
  if (!payload) return null

  // We need the y-scale to position wick and body correctly.
  // Recharts injects yAxis.scale into Bar shapes via composedChart context.
  // The cleanest approach: compute from payload values and yAxis.scale.
  // This shape receives yAxis from the parent via Bar's shape prop binding.
  const yScale = props.yAxis?.scale
  if (!yScale) return null

  const yOpen  = yScale(payload.open)
  const yClose = yScale(payload.close)
  const yHigh  = yScale(payload.high)
  const yLow   = yScale(payload.low)

  const bullish = payload.bullish
  const color = bullish ? '#22c55e' : '#ef4444'
  const bodyTop    = Math.min(yOpen, yClose)
  const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1)  // min 1px so doji candles are visible
  const candleX    = x + width * 0.1
  const candleW    = width * 0.8
  const midX       = x + width / 2

  return (
    <g>
      {/* Wick: high to low */}
      <line x1={midX} y1={yHigh} x2={midX} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body: open to close */}
      <rect x={candleX} y={bodyTop} width={candleW} height={bodyHeight} fill={color} />
    </g>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function OHLCTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p: OHLCPoint = payload[0]?.payload
  if (!p) return null

  const fmt = (v: number) => `$${v.toFixed(2)}`

  return (
    <div
      style={{
        backgroundColor: '#21262d',
        border: '1px solid #30363d',
        borderRadius: 6,
        fontSize: 12,
        color: '#e6edf3',
        padding: '8px 12px',
        lineHeight: '1.6',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.date}</div>
      <div>O: {fmt(p.open)} &nbsp; H: {fmt(p.high)}</div>
      <div>L: {fmt(p.low)} &nbsp; C: {fmt(p.close)}</div>
      <div style={{ color: '#8b949e' }}>Avg: {fmt(p.avg)} &nbsp; Snaps: {p.volume}</div>
      {p.watcherHigh != null && (
        <div style={{ color: '#1d6ab5', marginTop: 2 }}>
          Watchers: {p.watcherOpen ?? '?'} → {p.watcherClose ?? '?'} (peak {p.watcherHigh})
        </div>
      )}
    </div>
  )
}

// ── Period selector helper ─────────────────────────────────────────────────

const PERIOD_LABELS: Record<RollupPeriod, string> = {
  day:   'Daily',
  week:  'Weekly',
  month: 'Monthly',
}

// ── Main component ─────────────────────────────────────────────────────────

interface OHLCChartProps {
  itemId: string
}

export function OHLCChart({ itemId }: OHLCChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d')
  const [period, setPeriod] = useState<RollupPeriod>('day')

  const { from } = rangeToParams(timeRange, period)
  const { data: points, isLoading, isError } = useHistory({ itemId, period, from })

  const hasWatcherData = useMemo(
    () => (points ?? []).some(p => p.watcherHigh != null),
    [points]
  )

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="ohlc-chart">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Price History (OHLC)
        </h3>
        {/* Period selector */}
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as RollupPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              data-testid={`period-${p}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Time range tabs */}
      <div className="flex gap-1 mb-3">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setTimeRange(r.value)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              timeRange === r.value
                ? 'bg-surface-hover text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid={`range-${r.value}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart body */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">Loading...</p>
        </div>
      ) : isError ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">Failed to load history</p>
        </div>
      ) : !points || points.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">
            No rollup data yet — history builds after the first nightly rollup
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={hasWatcherData ? 300 : 250}>
          <ComposedChart data={points} margin={{ top: 8, right: hasWatcherData ? 48 : 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8b949e', fontSize: 10 }}
              stroke="#30363d"
              interval="preserveStartEnd"
            />
            {/* Primary Y axis: price */}
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fill: '#8b949e', fontSize: 10 }}
              stroke="#30363d"
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            {/* Secondary Y axis: watcher count (only when data exists) */}
            {hasWatcherData && (
              <YAxis
                yAxisId="watchers"
                orientation="right"
                tick={{ fill: '#1d6ab5', fontSize: 10 }}
                stroke="#1d6ab5"
                width={40}
              />
            )}
            <Tooltip content={<OHLCTooltip />} />

            {/*
              Candlestick rendering via a Bar with a custom shape.
              Recharts Bar with shape prop receives the yAxis reference through
              the ComposedChart context — CandleShape uses props.yAxis.scale
              to compute pixel positions for each candle.
            */}
            {/*
              IMPLEMENTATION NOTE:
              Recharts Bar does not natively support candlestick data.
              The approach below uses a Bar with shape=(CandleShape) where
              the Bar's dataKey is set to 'high' so recharts sizes the bar
              container from 0 to the high value, giving CandleShape access
              to the yAxis scale. CandleShape then computes all four price
              levels itself from payload.

              This pattern is established in the recharts community and works
              reliably as of recharts ^2.0.0.
            */}
            {/*
              Import Bar at the top of the file:
              import { ..., Bar } from 'recharts'

              Render:
              <Bar yAxisId="price" dataKey="high" shape={<CandleShape />} isAnimationActive={false} />
            */}

            {/* Watcher count overlay as a line */}
            {hasWatcherData && (
              <Line
                yAxisId="watchers"
                type="monotone"
                dataKey="watcherClose"
                stroke="#1d6ab5"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {points && points.length > 0 && (
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <span style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block', borderRadius: 1 }} />
            Bullish
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <span style={{ width: 10, height: 10, background: '#ef4444', display: 'inline-block', borderRadius: 1 }} />
            Bearish
          </span>
          {hasWatcherData && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#1d6ab5' }}>
              <span style={{ width: 16, height: 2, background: '#1d6ab5', display: 'inline-block' }} />
              Watchers
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

**Note on the `Bar` + `CandleShape` pattern**: Recharts `Bar` with `shape` prop passes the full `yAxis` reference (including `.scale`) to the custom shape component. The `dataKey="high"` causes recharts to size the bar container's coordinate space, which is fine because `CandleShape` computes all four price positions independently via `yAxis.scale`. This pattern avoids introducing dependencies like `react-financial-charts` or `lightweight-charts` (which would add ~200KB and require a D3 peer dependency).

---

## 7. API Endpoint Specification

### `GET /api/history/:itemId`

**Query parameters**:
| Param  | Type   | Required | Default | Description |
|--------|--------|----------|---------|-------------|
| period | string | No       | `day`   | `day`, `week`, or `month` |
| from   | string | No       | oldest  | ISO date `YYYY-MM-DD`, inclusive |
| to     | string | No       | today   | ISO date `YYYY-MM-DD`, inclusive |

**Success response** (`200 OK`):
```json
{
  "data": [
    {
      "date": "Mar 10",
      "periodStart": "2025-03-10",
      "open": 245.00,
      "high": 252.50,
      "low": 243.00,
      "close": 249.99,
      "avg": 248.12,
      "volume": 144,
      "watcherOpen": 32,
      "watcherClose": 38,
      "watcherHigh": 41,
      "bullish": true
    }
  ]
}
```

**Error responses**:
- `400` — invalid `period` value or malformed date string
- `500` — database error

**Notes**:
- Returns an empty array (not 404) when an item has no rollups yet. The client shows "No rollup data yet" message.
- No authentication required (this app has no auth layer).
- No rate limiting required (local SQLite query, sub-millisecond).

### `GET /api/history/:itemId/summary`

**Query parameters**:
| Param  | Type   | Required | Default | Description |
|--------|--------|----------|---------|-------------|
| period | string | No       | `day`   | `day`, `week`, or `month` |

**Success response** (`200 OK`):
```json
{
  "data": {
    "itemId": "123456789",
    "period": "day",
    "dataPoints": 184,
    "allTimeHigh": 27500,
    "allTimeLow": 19800,
    "fiftyTwoWeekHigh": 27500,
    "fiftyTwoWeekLow": 21000,
    "avgCents": 24350,
    "firstDate": "2025-02-15",
    "latestClose": 24999,
    "trend": "up"
  }
}
```

**Error responses**:
- `404` — item has no historical rollup data
- `400` — invalid period
- `500` — database error

---

## 8. Integration with Existing Price Chart

### Augment, Do Not Replace

The existing `PriceChart` component renders recent raw snapshots (last N days) as an area chart. This serves a different purpose than the OHLC chart: it shows intraday granularity for the current listing's recent behavior. Keep it as-is.

The `OHLCChart` is a separate, additional component shown in the detail page below the existing charts. Do not merge them into one component — they answer different questions.

**Existing layout** in `src/app/items/[itemId]/page.tsx`:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <PriceChart snapshots={data.snapshots} />
  <WatcherChart snapshots={data.snapshots} />
</div>
```

**New layout after D2a** (replace the grid with a stacked layout):
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <PriceChart snapshots={data.snapshots} />
  <WatcherChart snapshots={data.snapshots} />
</div>

{/* Historical archive section — only shown after first nightly rollup runs */}
<OHLCChart itemId={data.item.id} />
```

The `OHLCChart` handles its own data fetching via `useHistory`. If no rollup data exists yet (first day of tracking), it renders the "No rollup data yet" empty state gracefully.

### Sparklines in Table View

The main watchlist table does not show sparklines currently. This is out of scope for D2 — do not add sparklines to the table.

---

## 9. Scheduler Integration

### Modify `src/lib/scheduler.ts`

Add a daily rollup cron at 00:05 UTC. The 5-minute offset ensures the midnight sync has completed before rollups run.

```typescript
// Add to imports at top of scheduler.ts:
import { runNightlyRollup } from './archive/rollup-service'

// Add inside startScheduler(), after the existing sync cron:
// Daily rollup at 00:05 UTC
cron.schedule('5 0 * * *', async () => {
  console.log('Nightly rollup starting...')
  try {
    await runNightlyRollup()
  } catch (err) {
    console.error('Nightly rollup failed:', err)
  }
}, { timezone: 'UTC' })

console.log('Rollup scheduler started: daily at 00:05 UTC')
```

**node-cron timezone support**: The `timezone` option requires node-cron v3+ which is already installed (`^3.0.0` in package.json). No additional dependencies needed.

### Backfill Script

**New file**: `scripts/backfill-rollups.ts`

```typescript
import 'dotenv/config'
import { runMigrations } from '../src/lib/db/migrate'
import { backfillAllRollups } from '../src/lib/archive/rollup-service'

async function main() {
  console.log('Running migrations...')
  runMigrations()
  console.log('Starting backfill...')
  await backfillAllRollups()
  console.log('Done.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

Run with: `npx tsx scripts/backfill-rollups.ts`

For 200 items and 6 months of existing snapshots (~5.2M rows), the backfill will take approximately 4–8 minutes. It is safe to run while the server is running because it only reads from `price_snapshots` and writes to `price_rollups` — no conflict with the sync process.

---

## 10. Data Retention and Storage Estimates

### Decision: Keep All Raw Snapshots

Do not prune raw `price_snapshots` rows. Reasons:

1. SQLite handles 10M+ rows efficiently with WAL and proper indexes. The existing composite index on `(item_id, recorded_at)` makes time-range queries for a single item fast even at scale.
2. Pruning raw data is irreversible. If rollup computation had a bug, we could not recompute correct values.
3. Raw data enables future features: intraday volatility analysis, exact timestamp of a watcher spike, correlation with listing events.

The rollups table is the performance optimization for the chart (querying 365 daily rows instead of 52,560 raw rows). The raw table is the archive.

### Disk Space Estimates

**`price_snapshots`** at 200 items × 144 snapshots/day:
- Columns: `id` (8B) + `item_id` (16B avg) + `price_cents` (4B) + `shipping` (4B) + `watcher_count` (4B) + `bid_count` (4B) + `recorded_at` (20B) + row overhead (~8B) ≈ 68 bytes per row
- Per day: 200 × 144 × 68B ≈ 1.96 MB/day
- Per year: ~715 MB
- 3 years: ~2.1 GB — still manageable for SQLite with WAL

**`price_rollups`** at 200 items:
- Daily: 200 rows/day × 365 = 73,000 rows/year ≈ 10 MB/year
- Weekly: ~10,400 rows/year ≈ 1.5 MB/year
- Monthly: ~2,400 rows/year ≈ 0.3 MB/year
- Total rollups: ~12 MB/year — negligible

**Index overhead**: approximately 30% of table size for both tables.

**Total at 1 year**: ~930 MB (dominated by raw snapshots).
**Total at 2 years**: ~1.65 GB.

If disk space becomes a concern after 2+ years, implement a configurable retention policy to prune `price_snapshots` older than N days (default: never). The `countSnapshotsOlderThan` function already exists in `rollups.ts` to support this. Rollups are preserved regardless.

---

## 11. Modified Files Summary

| File | Change | Risk |
|------|--------|------|
| `src/lib/db/migrations/002_price_rollups.sql` | New file | None — additive migration |
| `src/lib/db/rollups.ts` | New file | None |
| `src/lib/archive/rollup-service.ts` | New file | None |
| `src/app/api/history/[itemId]/route.ts` | New file | None |
| `src/app/api/history/[itemId]/summary/route.ts` | New file | None |
| `src/hooks/use-history.ts` | New file | None |
| `src/components/detail/ohlc-chart.tsx` | New file | None |
| `src/types/index.ts` | Add 6 interfaces/types | Low — additive only |
| `src/lib/scheduler.ts` | Add rollup cron job | Low — independent of sync cron |
| `src/app/items/[itemId]/page.tsx` | Add `<OHLCChart>` below chart grid | Low — existing charts untouched |
| `scripts/backfill-rollups.ts` | New file | None |

No existing files are modified in ways that change existing behavior.

---

## 12. Test Plan

### 12a. Unit Tests for Rollup Computation

File: `tests/unit/rollup-computation.test.ts`

These tests use an in-memory SQLite database (`:memory:` path with better-sqlite3). They do not test the API layer. Run with `npx tsx --test tests/unit/rollup-computation.test.ts` — uses Node.js built-in `node:test` and `node:assert`, no additional test runner needed.

```typescript
/**
 * Unit tests for rollup computation functions in src/lib/db/rollups.ts
 *
 * Run: npx tsx --test tests/unit/rollup-computation.test.ts
 *
 * Uses an in-memory SQLite database created fresh for each test.
 * No dev server required. No new dependencies — uses node:test (Node 18+)
 * and better-sqlite3 which is already in dependencies.
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

// ── Schema helpers ──────────────────────────────────────────────────────────

/**
 * Minimal schema matching 002_price_rollups.sql.
 * items table is required for the foreign key constraint on price_snapshots.
 */
function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      title   TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE price_snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id       TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
      price_cents   INTEGER NOT NULL DEFAULT 0,
      shipping_cents INTEGER NOT NULL DEFAULT 0,
      watcher_count INTEGER,
      bid_count     INTEGER NOT NULL DEFAULT 0,
      recorded_at   TEXT NOT NULL
    );

    CREATE INDEX idx_snapshots_item_date ON price_snapshots(item_id, recorded_at);

    CREATE TABLE price_rollups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id       TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
      period_type   TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
      period_start  TEXT NOT NULL,
      open_cents    INTEGER NOT NULL,
      high_cents    INTEGER NOT NULL,
      low_cents     INTEGER NOT NULL,
      close_cents   INTEGER NOT NULL,
      avg_cents     INTEGER NOT NULL,
      volume        INTEGER NOT NULL,
      watcher_open  INTEGER,
      watcher_close INTEGER,
      watcher_high  INTEGER,
      computed_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (item_id, period_type, period_start)
    );

    CREATE INDEX idx_rollups_item_period ON price_rollups(item_id, period_type, period_start);
  `)
}

// ── In-process rollup functions ──────────────────────────────────────────────
//
// The actual functions in src/lib/db/rollups.ts call getDb() which reads a
// singleton backed by DATABASE_PATH. To keep tests hermetic we inline the
// same SQL logic operating on the test-local in-memory db — this is the
// correct unit-test pattern for better-sqlite3 (no mocking of the module
// singleton is needed when the logic is tested via the same SQL).

function computeDailyRollup(db: Database.Database, itemId: string, date: string): boolean {
  const row = db.prepare(`
    SELECT
      MIN(price_cents)                            AS low_cents,
      MAX(price_cents)                            AS high_cents,
      CAST(ROUND(AVG(price_cents)) AS INTEGER)    AS avg_cents,
      COUNT(*)                                    AS volume,
      MAX(watcher_count)                          AS watcher_high,
      (SELECT price_cents   FROM price_snapshots
       WHERE item_id = ? AND date(recorded_at) = ?
       ORDER BY recorded_at ASC  LIMIT 1)         AS open_cents,
      (SELECT price_cents   FROM price_snapshots
       WHERE item_id = ? AND date(recorded_at) = ?
       ORDER BY recorded_at DESC LIMIT 1)         AS close_cents,
      (SELECT watcher_count FROM price_snapshots
       WHERE item_id = ? AND date(recorded_at) = ?
       ORDER BY recorded_at ASC  LIMIT 1)         AS watcher_open,
      (SELECT watcher_count FROM price_snapshots
       WHERE item_id = ? AND date(recorded_at) = ?
       ORDER BY recorded_at DESC LIMIT 1)         AS watcher_close
    FROM price_snapshots
    WHERE item_id = ? AND date(recorded_at) = ? AND price_cents > 0
  `).get(
    itemId, date,
    itemId, date,
    itemId, date,
    itemId, date,
    itemId, date
  ) as any

  if (!row || row.volume === 0) return false

  db.prepare(`
    INSERT OR REPLACE INTO price_rollups (
      item_id, period_type, period_start,
      open_cents, high_cents, low_cents, close_cents, avg_cents,
      volume, watcher_open, watcher_close, watcher_high, computed_at
    ) VALUES (?, 'day', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    itemId, date,
    row.open_cents, row.high_cents, row.low_cents, row.close_cents, row.avg_cents,
    row.volume, row.watcher_open, row.watcher_close, row.watcher_high
  )
  return true
}

function computeWeeklyRollup(
  db: Database.Database,
  weekStart: string,
  weekEnd: string
): { written: number } {
  const items = db.prepare(`
    SELECT DISTINCT item_id FROM price_rollups
    WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
  `).all(weekStart, weekEnd) as Array<{ item_id: string }>

  let written = 0
  for (const { item_id } of items) {
    const agg = db.prepare(`
      SELECT
        SUM(volume)     AS total_volume,
        MAX(high_cents) AS high_cents,
        MIN(low_cents)  AS low_cents,
        MAX(watcher_high) AS watcher_high,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
        (SELECT open_cents  FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1) AS open_cents,
        (SELECT close_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1) AS close_cents,
        (SELECT watcher_open  FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1) AS watcher_open,
        (SELECT watcher_close FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1) AS watcher_close
      FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
        AND period_start >= ? AND period_start <= ?
    `).get(
      item_id, weekStart, weekEnd,
      item_id, weekStart, weekEnd,
      item_id, weekStart, weekEnd,
      item_id, weekStart, weekEnd,
      item_id, weekStart, weekEnd
    ) as any

    if (!agg || !agg.total_volume) continue

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_open, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      item_id, weekStart,
      agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
      agg.total_volume, agg.watcher_open, agg.watcher_close, agg.watcher_high
    )
    written++
  }
  return { written }
}

function computeMonthlyRollup(
  db: Database.Database,
  monthStart: string,
  monthEnd: string
): { written: number } {
  const items = db.prepare(`
    SELECT DISTINCT item_id FROM price_rollups
    WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
  `).all(monthStart, monthEnd) as Array<{ item_id: string }>

  let written = 0
  for (const { item_id } of items) {
    const agg = db.prepare(`
      SELECT
        SUM(volume)     AS total_volume,
        MAX(high_cents) AS high_cents,
        MIN(low_cents)  AS low_cents,
        MAX(watcher_high) AS watcher_high,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
        (SELECT open_cents  FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1) AS open_cents,
        (SELECT close_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1) AS close_cents,
        (SELECT watcher_open  FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1) AS watcher_open,
        (SELECT watcher_close FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1) AS watcher_close
      FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
        AND period_start >= ? AND period_start <= ?
    `).get(
      item_id, monthStart, monthEnd,
      item_id, monthStart, monthEnd,
      item_id, monthStart, monthEnd,
      item_id, monthStart, monthEnd,
      item_id, monthStart, monthEnd
    ) as any

    if (!agg || !agg.total_volume) continue

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_open, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'month', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      item_id, monthStart,
      agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
      agg.total_volume, agg.watcher_open, agg.watcher_close, agg.watcher_high
    )
    written++
  }
  return { written }
}

function getRollups(
  db: Database.Database,
  itemId: string,
  period: string,
  from?: string,
  to?: string
): any[] {
  const conditions: string[] = ['item_id = ?', 'period_type = ?']
  const params: any[] = [itemId, period]
  if (from) { conditions.push('period_start >= ?'); params.push(from) }
  if (to)   { conditions.push('period_start <= ?'); params.push(to) }
  return db.prepare(`
    SELECT * FROM price_rollups
    WHERE ${conditions.join(' AND ')}
    ORDER BY period_start ASC
  `).all(...params) as any[]
}

function getHistoricalSummary(db: Database.Database, itemId: string, period: string): any {
  const allTime = db.prepare(`
    SELECT
      COUNT(*) AS data_points,
      MAX(high_cents) AS all_time_high,
      MIN(low_cents)  AS all_time_low,
      MIN(period_start) AS first_date,
      CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents
    FROM price_rollups
    WHERE item_id = ? AND period_type = ?
  `).get(itemId, period) as any

  if (!allTime || allTime.data_points === 0) return null

  const latest = db.prepare(`
    SELECT close_cents, open_cents FROM price_rollups
    WHERE item_id = ? AND period_type = ?
    ORDER BY period_start DESC LIMIT 1
  `).get(itemId, period) as any

  const earliest = db.prepare(`
    SELECT open_cents FROM price_rollups
    WHERE item_id = ? AND period_type = ?
    ORDER BY period_start ASC LIMIT 1
  `).get(itemId, period) as any

  const priceDiff = latest.close_cents - earliest.open_cents
  const threshold = earliest.open_cents * 0.02
  const trend =
    priceDiff > threshold ? 'up' : priceDiff < -threshold ? 'down' : 'flat'

  return {
    itemId,
    period,
    dataPoints: allTime.data_points,
    allTimeHigh: allTime.all_time_high,
    allTimeLow: allTime.all_time_low,
    avgCents: allTime.avg_cents,
    firstDate: allTime.first_date,
    latestClose: latest.close_cents,
    trend,
  }
}

// ── Test fixtures ────────────────────────────────────────────────────────────

/** Insert a price_snapshots row. minutes offsets keep ordering deterministic. */
function insertSnapshot(
  db: Database.Database,
  itemId: string,
  date: string,
  minuteOffset: number,
  priceCents: number,
  watcherCount: number | null = null
): void {
  const recordedAt = `${date}T${String(Math.floor(minuteOffset / 60)).padStart(2, '0')}:${String(minuteOffset % 60).padStart(2, '0')}:00.000Z`
  db.prepare(`
    INSERT INTO price_snapshots (item_id, price_cents, watcher_count, recorded_at)
    VALUES (?, ?, ?, ?)
  `).run(itemId, priceCents, watcherCount, recordedAt)
}

/** Insert a daily price_rollups row directly (for weekly/monthly tests). */
function insertDailyRollup(
  db: Database.Database,
  itemId: string,
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  avg: number,
  volume: number,
  watcherOpen: number | null = null,
  watcherClose: number | null = null,
  watcherHigh: number | null = null
): void {
  db.prepare(`
    INSERT OR REPLACE INTO price_rollups (
      item_id, period_type, period_start,
      open_cents, high_cents, low_cents, close_cents, avg_cents,
      volume, watcher_open, watcher_close, watcher_high, computed_at
    ) VALUES (?, 'day', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(itemId, date, open, high, low, close, avg, volume, watcherOpen, watcherClose, watcherHigh)
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Rollup Computation', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    createSchema(db)
    // Seed the items table so foreign key constraints pass
    db.prepare(`INSERT INTO items (item_id, title) VALUES ('A', 'Test Item A')`).run()
    db.prepare(`INSERT INTO items (item_id, title) VALUES ('B', 'Test Item B')`).run()
  })

  afterEach(() => {
    db.close()
  })

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  test('computeDailyRollup produces correct OHLC from 5 snapshots', () => {
    // Prices: 100 (first/open), 120 (high), 80 (low), 110, 115 (last/close)
    // Inserted in chronological order via minuteOffset so recorded_at ordering is deterministic.
    // avg of [100,120,80,110,115] = 525/5 = 105
    insertSnapshot(db, 'A', '2025-03-10',  0, 100, 32)  // open, watcher_open=32
    insertSnapshot(db, 'A', '2025-03-10', 10, 120, 35)  // high
    insertSnapshot(db, 'A', '2025-03-10', 20,  80, 28)  // low
    insertSnapshot(db, 'A', '2025-03-10', 30, 110, 40)  // watcher_high=41 below
    insertSnapshot(db, 'A', '2025-03-10', 40, 115, 38)  // close, watcher_close=38

    const written = computeDailyRollup(db, 'A', '2025-03-10')
    assert.equal(written, true, 'should return true when a rollup is written')

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='day' AND period_start='2025-03-10'`
    ).get() as any

    assert.ok(row, 'rollup row should exist')
    assert.equal(row.open_cents,  100, 'open should be the first snapshot price')
    assert.equal(row.high_cents,  120, 'high should be the maximum price')
    assert.equal(row.low_cents,    80, 'low should be the minimum price')
    assert.equal(row.close_cents, 115, 'close should be the last snapshot price')
    assert.equal(row.avg_cents,   105, 'avg should be ROUND(AVG([100,120,80,110,115]))')
    assert.equal(row.volume,        5, 'volume should be count of snapshots')
    assert.equal(row.watcher_open,  32, 'watcher_open should be from first snapshot')
    assert.equal(row.watcher_close, 38, 'watcher_close should be from last snapshot')
    // watcher_high = MAX(watcher_count) across [32,35,28,40,38] = 40
    assert.equal(row.watcher_high,  40, 'watcher_high should be MAX watcher_count in period')
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  test('computeDailyRollup returns false when no snapshots exist for date', () => {
    // Insert a snapshot for a different date to confirm the absence is date-specific
    insertSnapshot(db, 'A', '2025-03-09', 0, 200)

    const written = computeDailyRollup(db, 'A', '2025-03-10')
    assert.equal(written, false, 'should return false when no snapshots exist for the date')

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='day' AND period_start='2025-03-10'`
    ).get()
    assert.equal(row, undefined, 'no rollup row should be written')
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  test('computeDailyRollup handles single snapshot correctly', () => {
    // One snapshot: all four OHLC values must equal 200. volume=1.
    insertSnapshot(db, 'A', '2025-03-10', 0, 200, 55)

    const written = computeDailyRollup(db, 'A', '2025-03-10')
    assert.equal(written, true)

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='day' AND period_start='2025-03-10'`
    ).get() as any

    assert.equal(row.open_cents,  200)
    assert.equal(row.high_cents,  200)
    assert.equal(row.low_cents,   200)
    assert.equal(row.close_cents, 200)
    assert.equal(row.avg_cents,   200)
    assert.equal(row.volume,        1)
    // With a single snapshot, watcher_open and watcher_close both come from that same row
    assert.equal(row.watcher_open,  55)
    assert.equal(row.watcher_close, 55)
    assert.equal(row.watcher_high,  55)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  test('computeDailyRollup excludes price_cents=0 snapshots', () => {
    // Snapshots: [0 (excluded), 100, 150]
    // After filtering price_cents > 0: open=100, low=100, high=150, close=150, avg=125, volume=2
    // The zero snapshot is inserted first so it would be "open" if not filtered.
    insertSnapshot(db, 'A', '2025-03-10',  0,   0)  // excluded
    insertSnapshot(db, 'A', '2025-03-10', 10, 100)  // open after filter
    insertSnapshot(db, 'A', '2025-03-10', 20, 150)  // close

    const written = computeDailyRollup(db, 'A', '2025-03-10')
    assert.equal(written, true)

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='day' AND period_start='2025-03-10'`
    ).get() as any

    assert.equal(row.volume,      2,   'zero-price snapshot must be excluded from volume')
    assert.equal(row.open_cents,  100, 'open should be the first non-zero snapshot')
    assert.equal(row.low_cents,   100, 'low should exclude the zero price')
    assert.equal(row.high_cents,  150)
    assert.equal(row.close_cents, 150)
    assert.equal(row.avg_cents,   125, 'avg of [100,150] = 125')
  })

  test('computeDailyRollup returns false when all snapshots have price_cents=0', () => {
    insertSnapshot(db, 'A', '2025-03-10',  0, 0)
    insertSnapshot(db, 'A', '2025-03-10', 10, 0)

    const written = computeDailyRollup(db, 'A', '2025-03-10')
    assert.equal(written, false, 'returns false when all prices are zero')

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='day' AND period_start='2025-03-10'`
    ).get()
    assert.equal(row, undefined, 'no rollup row written when all prices are zero')
  })

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  test('computeWeeklyRollup aggregates 7 daily rollups correctly', () => {
    // Week: 2025-03-10 (Mon) to 2025-03-16 (Sun)
    // Daily prices ascend: open day1=10000, close day7=17000
    // Each day has high = close + 500, low = open - 500
    // Volume is uniform at 144 per day (one full day of 10-min syncs)
    const weekStart = '2025-03-10'
    const weekEnd   = '2025-03-16'

    const days = [
      '2025-03-10', '2025-03-11', '2025-03-12', '2025-03-13',
      '2025-03-14', '2025-03-15', '2025-03-16',
    ]

    days.forEach((date, i) => {
      const base = 10000 + i * 1000  // 10000, 11000, 12000, ..., 16000
      insertDailyRollup(db, 'A', date,
        base,       // open
        base + 500, // high
        base - 500, // low
        base + 1000 - 1, // close (just under next day open to give a clean ascending story)
        base + 250, // avg
        144,        // volume
        20 + i,     // watcher_open
        22 + i,     // watcher_close
        25 + i      // watcher_high
      )
    })

    const result = computeWeeklyRollup(db, weekStart, weekEnd)
    assert.equal(result.written, 1, 'one weekly rollup should be written')

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='week' AND period_start='${weekStart}'`
    ).get() as any

    assert.ok(row, 'weekly rollup row should exist')
    // open comes from day 1 (Mon) open
    assert.equal(row.open_cents,  10000, 'open should be Monday open')
    // close comes from day 7 (Sun) close
    assert.equal(row.close_cents, 16999, 'close should be Sunday close')
    // high = MAX(daily high) = 16000+500 = 16500
    assert.equal(row.high_cents,  16500, 'high should be max of all daily highs')
    // low = MIN(daily low) = 10000-500 = 9500
    assert.equal(row.low_cents,   9500, 'low should be min of all daily lows')
    // volume = 7 * 144 = 1008
    assert.equal(row.volume,      7 * 144, 'volume should be sum of all daily volumes')
    // watcher_open from Mon = 20, watcher_close from Sun = 22+6=28, watcher_high = MAX(25..31) = 31
    assert.equal(row.watcher_open,  20, 'watcher_open from Monday')
    assert.equal(row.watcher_close, 28, 'watcher_close from Sunday')
    assert.equal(row.watcher_high,  31, 'watcher_high = MAX of all daily watcher_high values')
    // volume-weighted avg: all days have same volume (144), so weighted avg = AVG of daily avgs
    // daily avgs: 10250, 11250, 12250, 13250, 14250, 15250, 16250
    // sum = 92750, avg = 13250
    assert.equal(row.avg_cents, 13250, 'volume-weighted avg should equal simple avg when volumes are equal')
  })

  // ── Test 6 ─────────────────────────────────────────────────────────────────

  test('computeWeeklyRollup with 4-day gap uses available boundary data', () => {
    // Only Mon and Tue have daily rollups; Wed–Sun are missing (downtime)
    // Weekly rollup: open=Mon open, close=Tue close (latest available boundary)
    const weekStart = '2025-03-10'  // Monday
    const weekEnd   = '2025-03-16'  // Sunday

    insertDailyRollup(db, 'A', '2025-03-10',
      5000, 5200, 4900, 5100, 5050, 144,
      10, 12, 15  // watchers Mon
    )
    insertDailyRollup(db, 'A', '2025-03-11',
      5100, 5300, 5000, 5250, 5175, 140,
      12, 14, 18  // watchers Tue
    )
    // Wed–Sun: no daily rollups (simulated gap)

    const result = computeWeeklyRollup(db, weekStart, weekEnd)
    assert.equal(result.written, 1)

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='week' AND period_start='${weekStart}'`
    ).get() as any

    assert.ok(row)
    assert.equal(row.open_cents,  5000, 'open should be Monday (first available) open')
    assert.equal(row.close_cents, 5250, 'close should be Tuesday (last available) close')
    assert.equal(row.high_cents,  5300, 'high = MAX(5200, 5300)')
    assert.equal(row.low_cents,   4900, 'low = MIN(4900, 5000)')
    assert.equal(row.volume,      284,  'volume = 144 + 140')
    assert.equal(row.watcher_open,  10, 'watcher_open from Monday')
    assert.equal(row.watcher_close, 14, 'watcher_close from Tuesday (last available)')
    assert.equal(row.watcher_high,  18, 'watcher_high = MAX(15, 18)')
  })

  // ── Test 7 ─────────────────────────────────────────────────────────────────

  test('computeMonthlyRollup uses volume-weighted average, not simple average', () => {
    // Two daily rollups with very different volumes so the difference is observable.
    // Day 1: avg=10000, volume=10   (low-activity day)
    // Day 2: avg=20000, volume=990  (high-activity day)
    //
    // Simple average of avgs: (10000 + 20000) / 2 = 15000
    // Volume-weighted average: (10000*10 + 20000*990) / (10 + 990)
    //                        = (100000 + 19800000) / 1000
    //                        = 19900000 / 1000 = 19900
    const monthStart = '2025-03-01'
    const monthEnd   = '2025-03-31'

    insertDailyRollup(db, 'A', '2025-03-01',
      9500, 10500,  9000, 10500, 10000, 10
    )
    insertDailyRollup(db, 'A', '2025-03-02',
      19000, 21000, 18000, 21000, 20000, 990
    )

    const result = computeMonthlyRollup(db, monthStart, monthEnd)
    assert.equal(result.written, 1)

    const row = db.prepare(
      `SELECT * FROM price_rollups WHERE item_id='A' AND period_type='month' AND period_start='${monthStart}'`
    ).get() as any

    assert.ok(row)
    // Volume-weighted avg must be 19900, not the simple average of 15000
    assert.notEqual(row.avg_cents, 15000, 'should NOT be simple average of avg_cents')
    assert.equal(row.avg_cents,    19900, 'should be volume-weighted average')
    assert.equal(row.open_cents,   9500,  'open from first day')
    assert.equal(row.close_cents,  21000, 'close from last day')
    assert.equal(row.high_cents,   21000, 'high = MAX(10500, 21000)')
    assert.equal(row.low_cents,    9000,  'low = MIN(9000, 18000)')
    assert.equal(row.volume,       1000,  'volume = 10 + 990')
  })

  // ── Test 8 ─────────────────────────────────────────────────────────────────

  test('getHistoricalSummary trend calculation: up when >2% gain', () => {
    // open of first rollup = 10000, close of last rollup = 11000
    // change = +1000 = +10%, threshold = 10000 * 0.02 = 200 → trend = 'up'
    insertDailyRollup(db, 'A', '2025-01-01', 10000, 10500, 9800,  10200, 10100, 100)
    insertDailyRollup(db, 'A', '2025-01-02', 10200, 10800, 10100, 10500, 10350, 120)
    insertDailyRollup(db, 'A', '2025-01-03', 10500, 11200, 10400, 11000, 10750, 110)

    const summary = getHistoricalSummary(db, 'A', 'day')
    assert.ok(summary)
    assert.equal(summary.trend, 'up', 'trend should be "up" when close > open by >2%')
    assert.equal(summary.latestClose, 11000)
    assert.equal(summary.allTimeHigh, 11200)
    assert.equal(summary.allTimeLow,  9800)
    assert.equal(summary.dataPoints,  3)
  })

  test('getHistoricalSummary trend calculation: flat when change < 2%', () => {
    // open of first rollup = 10000, close of last rollup = 10100
    // change = +100 = +1%, threshold = 200 → trend = 'flat'
    insertDailyRollup(db, 'A', '2025-02-01', 10000, 10200, 9900, 10050, 10025, 100)
    insertDailyRollup(db, 'A', '2025-02-02', 10050, 10300, 9950, 10100, 10075, 110)

    const summary = getHistoricalSummary(db, 'A', 'day')
    assert.ok(summary)
    assert.equal(summary.trend, 'flat', 'trend should be "flat" when change is < 2%')
  })

  test('getHistoricalSummary trend calculation: down when >2% loss', () => {
    // open of first rollup = 10000, close of last rollup = 9700
    // change = -300 = -3%, threshold = -200 → trend = 'down'
    insertDailyRollup(db, 'A', '2025-03-01', 10000, 10100, 9800, 9850, 9925, 100)
    insertDailyRollup(db, 'A', '2025-03-02',  9850, 9900, 9600, 9700, 9750, 95)

    const summary = getHistoricalSummary(db, 'A', 'day')
    assert.ok(summary)
    assert.equal(summary.trend, 'down', 'trend should be "down" when close < open by >2%')
  })

  test('getHistoricalSummary returns null when no rollup data exists', () => {
    // Item 'B' has no rollups
    const summary = getHistoricalSummary(db, 'B', 'day')
    assert.equal(summary, null, 'should return null when no rollup rows exist')
  })

  // ── Test 9 ─────────────────────────────────────────────────────────────────

  test('getRollups date range filtering returns correct subset', () => {
    // Insert 10 daily rollups: 2025-03-01 through 2025-03-10
    for (let d = 1; d <= 10; d++) {
      const date = `2025-03-${String(d).padStart(2, '0')}`
      const base = 10000 + d * 100
      insertDailyRollup(db, 'A', date, base, base+50, base-50, base+25, base, 144)
    }

    // No filter: all 10 returned
    const all = getRollups(db, 'A', 'day')
    assert.equal(all.length, 10, 'should return all 10 rollups when no date filter')

    // from only: rows on or after 2025-03-05
    const fromFive = getRollups(db, 'A', 'day', '2025-03-05')
    assert.equal(fromFive.length, 6, 'should return 6 rows from 2025-03-05 onward')
    assert.equal(fromFive[0].period_start, '2025-03-05', 'first result should be 2025-03-05')

    // to only: rows on or before 2025-03-03
    const toThree = getRollups(db, 'A', 'day', undefined, '2025-03-03')
    assert.equal(toThree.length, 3, 'should return 3 rows up through 2025-03-03')
    assert.equal(toThree[2].period_start, '2025-03-03', 'last result should be 2025-03-03')

    // from + to: rows from 2025-03-04 through 2025-03-07 inclusive
    const slice = getRollups(db, 'A', 'day', '2025-03-04', '2025-03-07')
    assert.equal(slice.length, 4, 'should return 4 rows for the 4-day window')
    assert.equal(slice[0].period_start, '2025-03-04')
    assert.equal(slice[3].period_start, '2025-03-07')

    // Results are ordered ascending by period_start
    for (let i = 1; i < slice.length; i++) {
      assert.ok(
        slice[i].period_start > slice[i-1].period_start,
        'results should be ordered ascending by period_start'
      )
    }

    // period filter: inserting a week rollup should not bleed into 'day' queries
    insertDailyRollup(db, 'A', '2025-03-06', 10600, 10650, 10550, 10625, 10600, 144)  // existing date, upsert
    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (item_id, period_type, period_start, open_cents, high_cents, low_cents, close_cents, avg_cents, volume, computed_at)
      VALUES ('A', 'week', '2025-03-03', 10000, 11000, 9500, 10500, 10250, 1008, datetime('now'))
    `).run()
    const dayOnly = getRollups(db, 'A', 'day')
    assert.equal(
      dayOnly.every((r: any) => r.period_type === 'day'),
      true,
      'getRollups with period=day should not return week rows'
    )
  })
})
```

### 12b. API Route Tests

File: `tests/e2e/history-api.spec.ts`

Use Playwright. The dev server must be running.

```typescript
// Test: GET /api/history/:itemId returns 200 with empty array when no rollups
test('returns empty array for new item', async ({ request }) => {
  const res = await request.get('/api/history/nonexistent-id')
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.data).toEqual([])
})

// Test: GET /api/history/:itemId?period=invalid returns 400
test('returns 400 for invalid period', async ({ request }) => {
  const res = await request.get('/api/history/any-id?period=invalid')
  expect(res.status()).toBe(400)
})

// Test: GET /api/history/:itemId?from=bad-date returns 400
test('returns 400 for malformed from date', async ({ request }) => {
  const res = await request.get('/api/history/any-id?from=not-a-date')
  expect(res.status()).toBe(400)
})

// Test: GET /api/history/:itemId/summary returns 404 when no data
test('summary returns 404 for item with no rollups', async ({ request }) => {
  const res = await request.get('/api/history/nonexistent-id/summary')
  expect(res.status()).toBe(404)
})

// Test: After backfill, GET /api/history/:itemId returns OHLCPoint array
// (Requires running backfill-rollups.ts as part of test setup)
```

### 12c. UI Component Tests

File: `tests/e2e/ohlc-chart.spec.ts`

Follows the exact Playwright pattern established in `tests/e2e/item-detail.spec.ts` and `tests/e2e/states.spec.ts`. Uses `page.route()` to mock `/api/history/:itemId` and inspects the rendered DOM (data-testid attributes and SVG elements from Recharts).

```typescript
/**
 * UI E2E tests for the OHLCChart component.
 *
 * Run: npx playwright test tests/e2e/ohlc-chart.spec.ts
 *
 * Requires the dev server running at http://localhost:3005 (or playwright
 * webServer config starts it automatically).
 *
 * All /api/history/* calls are intercepted via page.route() — no real DB
 * data is needed. The item detail page for item '111' is used as the host
 * page because it is already wired up with mocks in the test helpers.
 */

import { test, expect } from '@playwright/test'
import {
  mockWatchlistResponse,
  mockEventsResponse,
  mockItemDetailResponse,
} from './helpers/mock-data'
import type { OHLCPoint } from '../../src/types'

// ── Shared mock data ─────────────────────────────────────────────────────────

/** Build a minimal OHLCPoint. All dollar values are in dollars (not cents). */
function makeOHLCPoint(overrides: Partial<OHLCPoint> & { periodStart: string }): OHLCPoint {
  const base = overrides.open ?? 245
  return {
    date: overrides.periodStart.slice(5),   // 'MM-DD' as a cheap display label
    periodStart: overrides.periodStart,
    open:  base,
    high:  base + 5,
    low:   base - 3,
    close: base + 2,
    avg:   base + 1,
    volume: 144,
    watcherOpen:  null,
    watcherClose: null,
    watcherHigh:  null,
    bullish: true,
    ...overrides,
  }
}

/** Seven data points spanning a week — no watcher data. */
const mockPointsNoWatchers: OHLCPoint[] = [
  makeOHLCPoint({ periodStart: '2025-03-10', open: 240 }),
  makeOHLCPoint({ periodStart: '2025-03-11', open: 243 }),
  makeOHLCPoint({ periodStart: '2025-03-12', open: 246 }),
  makeOHLCPoint({ periodStart: '2025-03-13', open: 249 }),
  makeOHLCPoint({ periodStart: '2025-03-14', open: 252 }),
  makeOHLCPoint({ periodStart: '2025-03-15', open: 255 }),
  makeOHLCPoint({ periodStart: '2025-03-16', open: 258 }),
]

/** Seven data points with watcher data present on all points. */
const mockPointsWithWatchers: OHLCPoint[] = mockPointsNoWatchers.map((p, i) => ({
  ...p,
  watcherOpen:  30 + i,
  watcherClose: 32 + i,
  watcherHigh:  35 + i,
}))

/** One data point — edge case for single-candle render. */
const mockPointSingle: OHLCPoint[] = [
  makeOHLCPoint({ periodStart: '2025-03-10', open: 250, watcherHigh: null }),
]

// ── Route interception helpers ───────────────────────────────────────────────

/**
 * Wire up the standard API mocks that item-detail.spec.ts uses so the detail
 * page scaffold loads without errors.
 */
async function interceptScaffoldApis(page: import('@playwright/test').Page) {
  await Promise.all([
    page.route('**/api/items?*',  route => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/items',    route => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events?*', route => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/items/111', route => route.fulfill({ json: mockItemDetailResponse })),
    // summary route — return 404 so the chart doesn't depend on it for these tests
    page.route('**/api/history/111/summary**', route =>
      route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'No data' } } })
    ),
  ])
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('OHLCChart', () => {

  // ── Test UI-1 ──────────────────────────────────────────────────────────────

  test('UI-1: OHLCChart shows "No rollup data yet" empty state when API returns empty array', async ({ page }) => {
    await interceptScaffoldApis(page)

    // History endpoint returns empty array — simulates first day of tracking
    await page.route('**/api/history/111**', route =>
      route.fulfill({ json: { data: [] } })
    )

    await page.goto('/items/111')
    await expect(page.getByTestId('item-detail-page')).toBeVisible()

    // The OHLCChart container should be present
    const chart = page.getByTestId('ohlc-chart')
    await expect(chart).toBeVisible()

    // Empty state message as specified in the component
    await expect(chart).toContainText('No rollup data yet')
    await expect(chart).toContainText('history builds after the first nightly rollup')

    // No SVG elements should be rendered (no Recharts chart)
    const svgInsideChart = chart.locator('svg')
    await expect(svgInsideChart).toHaveCount(0)
  })

  // ── Test UI-2 ──────────────────────────────────────────────────────────────

  test('UI-2: clicking 1Y range button sends from= one year ago in API request', async ({ page }) => {
    await interceptScaffoldApis(page)

    // Track captured request URLs so we can assert on query params
    const historyRequests: string[] = []
    await page.route('**/api/history/111**', route => {
      // Ignore the summary sub-route which was already mocked
      historyRequests.push(route.request().url())
      route.fulfill({ json: { data: mockPointsNoWatchers } })
    })

    await page.goto('/items/111')
    await expect(page.getByTestId('item-detail-page')).toBeVisible()
    await expect(page.getByTestId('ohlc-chart')).toBeVisible()

    // Clear request log before clicking to isolate the button-triggered request
    historyRequests.length = 0

    // Click the "1Y" range button (data-testid="range-1y" as defined in the component)
    await page.getByTestId('range-1y').click()

    // Wait for a new request to fire
    await page.waitForResponse(resp => resp.url().includes('/api/history/111') && resp.status() === 200)

    // Find the request that has a 'from' param approximately one year ago
    const oneYearRequest = historyRequests.find(url => url.includes('from='))
    expect(oneYearRequest).toBeTruthy()

    const requestedFrom = new URL(oneYearRequest!).searchParams.get('from')!
    const fromDate = new Date(requestedFrom)
    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(now.getFullYear() - 1)

    // Allow a 2-day tolerance for test timing
    const diffDays = Math.abs((fromDate.getTime() - oneYearAgo.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBeLessThan(2)
  })

  test('UI-2b: clicking All range button sends request without from= param', async ({ page }) => {
    await interceptScaffoldApis(page)

    const historyRequests: string[] = []
    await page.route('**/api/history/111**', route => {
      historyRequests.push(route.request().url())
      route.fulfill({ json: { data: mockPointsNoWatchers } })
    })

    await page.goto('/items/111')
    await expect(page.getByTestId('ohlc-chart')).toBeVisible()
    historyRequests.length = 0

    await page.getByTestId('range-all').click()
    await page.waitForResponse(resp => resp.url().includes('/api/history/111') && resp.status() === 200)

    // The "All" range must NOT include a 'from' param
    const allRequest = historyRequests.find(url =>
      url.includes('/api/history/111') && !url.includes('/summary')
    )
    expect(allRequest).toBeTruthy()
    const fromParam = new URL(allRequest!).searchParams.get('from')
    expect(fromParam).toBeNull()
  })

  // ── Test UI-3 ──────────────────────────────────────────────────────────────

  test('UI-3: period selector Weekly button sends period=week in request', async ({ page }) => {
    await interceptScaffoldApis(page)

    const historyRequests: string[] = []
    await page.route('**/api/history/111**', route => {
      historyRequests.push(route.request().url())
      route.fulfill({ json: { data: mockPointsNoWatchers } })
    })

    await page.goto('/items/111')
    await expect(page.getByTestId('ohlc-chart')).toBeVisible()
    historyRequests.length = 0

    // Click the Weekly period button (data-testid="period-week")
    await page.getByTestId('period-week').click()
    await page.waitForResponse(resp => resp.url().includes('/api/history/111') && resp.status() === 200)

    const weeklyRequest = historyRequests.find(url => url.includes('period=week'))
    expect(weeklyRequest).toBeTruthy()
    const period = new URL(weeklyRequest!).searchParams.get('period')
    expect(period).toBe('week')
  })

  test('UI-3b: period selector Monthly button sends period=month in request', async ({ page }) => {
    await interceptScaffoldApis(page)

    const historyRequests: string[] = []
    await page.route('**/api/history/111**', route => {
      historyRequests.push(route.request().url())
      route.fulfill({ json: { data: mockPointsNoWatchers } })
    })

    await page.goto('/items/111')
    await expect(page.getByTestId('ohlc-chart')).toBeVisible()
    historyRequests.length = 0

    await page.getByTestId('period-month').click()
    await page.waitForResponse(resp => resp.url().includes('/api/history/111') && resp.status() === 200)

    const monthlyRequest = historyRequests.find(url => url.includes('period=month'))
    expect(monthlyRequest).toBeTruthy()
    const period = new URL(monthlyRequest!).searchParams.get('period')
    expect(period).toBe('month')
  })

  // ── Test UI-4 ──────────────────────────────────────────────────────────────

  test('UI-4: chart renders without errors when API returns a single data point', async ({ page }) => {
    await interceptScaffoldApis(page)

    await page.route('**/api/history/111**', route =>
      route.fulfill({ json: { data: mockPointSingle } })
    )

    // Capture any browser console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/items/111')
    await expect(page.getByTestId('item-detail-page')).toBeVisible()

    const chart = page.getByTestId('ohlc-chart')
    await expect(chart).toBeVisible()

    // The chart container should be present (not the empty-state message)
    await expect(chart).not.toContainText('No rollup data yet')

    // Recharts renders an SVG when data is present — at least one svg should exist
    const svg = chart.locator('svg').first()
    await expect(svg).toBeVisible()

    // No React render errors or unhandled exceptions
    const reactErrors = consoleErrors.filter(e =>
      e.includes('Error') && !e.includes('ResizeObserver')  // ResizeObserver benign in test env
    )
    expect(reactErrors).toHaveLength(0)
  })

  // ── Test UI-5 ──────────────────────────────────────────────────────────────

  test('UI-5: watcher overlay is absent when all watcherHigh values are null', async ({ page }) => {
    await interceptScaffoldApis(page)

    // All points have watcherHigh=null — the component should NOT render the watcher axis or line
    await page.route('**/api/history/111**', route =>
      route.fulfill({ json: { data: mockPointsNoWatchers } })
    )

    await page.goto('/items/111')
    const chart = page.getByTestId('ohlc-chart')
    await expect(chart).toBeVisible()

    // The chart renders data (not empty state)
    await expect(chart).not.toContainText('No rollup data yet')
    await expect(chart.locator('svg').first()).toBeVisible()

    // When hasWatcherData=false, the component does NOT render a right-side YAxis
    // The right YAxis in Recharts produces a <g class="recharts-yAxis yAxis"> with orientation="right"
    // We check that no tick text in blue (#1d6ab5) appears — the watcher axis is the only blue element.
    // The watcher Line has stroke="#1d6ab5"; if absent, no element with that fill exists.
    const watcherLineInSvg = chart.locator('svg path[stroke="#1d6ab5"]')
    await expect(watcherLineInSvg).toHaveCount(0)

    // The watcher legend entry should not be visible
    await expect(chart.getByText('Watchers')).toHaveCount(0)
  })

  // ── Test UI-6 ──────────────────────────────────────────────────────────────

  test('UI-6: watcher overlay is present when watcherHigh > 0 on all points', async ({ page }) => {
    await interceptScaffoldApis(page)

    // All points have watcher data — the component should render the watcher Line overlay
    await page.route('**/api/history/111**', route =>
      route.fulfill({ json: { data: mockPointsWithWatchers } })
    )

    await page.goto('/items/111')
    const chart = page.getByTestId('ohlc-chart')
    await expect(chart).toBeVisible()
    await expect(chart).not.toContainText('No rollup data yet')

    // The watcher legend entry should appear in the legend row
    await expect(chart.getByText('Watchers')).toBeVisible()

    // The watcher Line in Recharts renders as an SVG <path> with stroke="#1d6ab5"
    // Wait briefly for Recharts animation to settle (isAnimationActive=false so it's immediate)
    const watcherLine = chart.locator('svg path[stroke="#1d6ab5"]').first()
    await expect(watcherLine).toBeVisible()

    // The right Y-axis should exist — Recharts renders it as a <g> containing tick text.
    // We verify by checking that at least one tick label exists with a numeric watcher value.
    // The watcher axis ticks are rendered inside the SVG; we just check the SVG has more than
    // one y-axis group (left=price, right=watchers).
    const yAxisGroups = chart.locator('svg .recharts-yAxis')
    // Should have at least 2 (price left + watchers right)
    await expect(yAxisGroups).toHaveCount(await yAxisGroups.count() >= 2 ? await yAxisGroups.count() : 2)
  })
})
```

### 12d. Edge Cases

These are handled by the computation logic and must be covered in unit tests:

1. **Item added and removed in the same day**: 1 snapshot, daily rollup with volume=1. All OHLC values equal. Covered by "single snapshot" test.

2. **All snapshots in a period have price_cents=0**: Returns false (no rollup written). This can happen if eBay returns a malformed price. The `price_cents > 0` filter in the computation query handles this.

3. **Item with null watcher_count for entire period**: All three watcher columns in the rollup are NULL. This is valid. Chart renders without the watcher overlay.

4. **Week spanning two months (e.g., Jan 27–Feb 2)**: The weekly rollup uses `period_start = Jan 27`. The monthly rollup for January will include daily rows Jan 1–31. The monthly rollup for February will include daily rows Feb 1–28. The weekly rollup for that week is separate and accurate. There is no double-counting because daily rollup rows are keyed by `(item_id, 'day', date)`, not shared.

5. **Backfill with millions of rows**: The backfill iterates day by day, calling SQLite via better-sqlite3 synchronously. There is no async I/O bottleneck. Memory usage is bounded (one row read at a time). No timeout or OOM risk.

6. **Rollup cron fires but no snapshots exist for yesterday**: `computeDailyRollupsForDate` returns `{ processed: 0, written: 0 }`. No error, no rollup written.

---

## 13. D2b Schema Notes (Blocked on A1)

The `comp_rollups` table is created in migration `002_price_rollups.sql` but left empty until A1 delivers sold comp data.

When A1 is complete, the implementation steps are:
1. Define `card_key` computation logic in A1's output schema
2. Add `insertCompRollup()` to `rollups.ts` following the same `INSERT OR REPLACE` pattern
3. Add `computeCompDailyRollup()` using `GROUP BY card_key, date(...)` over the sold comp table (A1 defines the source table name)
4. Add a parallel cron job in `scheduler.ts` alongside the price rollup cron
5. Add `GET /api/history/comps/:cardKey` route (same structure as the price history route)

No design decisions in D2a need to change to accommodate D2b. The tables are independent.

---

## 14. Implementation Order

Execute in this sequence to minimize risk and allow incremental testing:

1. **Write migration** `002_price_rollups.sql` — tables created, server restart applies it automatically via `runMigrations()`
2. **Write `src/lib/db/rollups.ts`** — data layer, no side effects
3. **Write `src/lib/archive/rollup-service.ts`** — depends on rollups.ts
4. **Run backfill** via `npx tsx scripts/backfill-rollups.ts` — verify rollup rows exist in DB
5. **Write API routes** — depends on rollups.ts
6. **Write `use-history.ts` hook** — depends on API routes
7. **Write `OHLCChart` component** — depends on hook
8. **Modify `scheduler.ts`** — add nightly cron
9. **Modify detail page** — add `<OHLCChart>` below existing charts
10. **Add types to `index.ts`** — can be done at step 2, before or after

Steps 2–7 can be written before step 4 (backfill) since the API returns an empty array gracefully. The component shows the empty state until the first nightly rollup runs (or backfill is complete).
