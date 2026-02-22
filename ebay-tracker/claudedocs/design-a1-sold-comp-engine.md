# Design: A1 — Sold Comp Engine

**Feature**: Passive sold comp accumulation + FMV calculation
**Effort**: 8.5 hours (Scenario A — fully compliant)
**Status**: Ready for implementation
**Author**: Backend Architect
**Date**: 2026-02-21

---

## 1. Context and Constraints

### eBay API Situation

`findCompletedItems` (Shopping API) was decommissioned on 2025-02-05. The Marketplace Insights API that replaced it requires a formal application and approval process; it is not available to all developers. This eliminates the two common approaches to bulk historical comp fetching.

**Approach for this implementation**: Passive accumulation. As the sync cycle already detects when a watched item transitions to Sold, we capture that item's final price at the moment of detection. Over time this builds a personal sold comps database that grows organically. The architecture is explicitly designed so a scraper adapter or a future API source can be plugged in without touching the FMV calculation or storage logic.

### Integration Architecture Summary

```
sync-service.ts
  └── runSync()
        └── [status === 'Sold' detected]
              └── comp-collector.ts :: captureFromSoldItem(dbItem)
                    └── comps.ts :: insertComp(input)
                          └── sold_comps table

GET /api/comps?itemId=X      → comps.ts :: getByItemId()
GET /api/comps?cardKey=X     → comps.ts :: getByCardKey()
GET /api/comps/fmv?itemId=X  → fmv-calculator.ts :: calculateFmv()
                                └── comps.ts :: getByCardKey()

use-comps.ts                 → TanStack Query wrappers for above routes
```

---

## 2. Database Schema

### Migration File: `src/lib/db/migrations/003_sold_comps.sql`

Note: Migration 002 does not yet exist in the repository. Number this 003 as a forward-looking slot. If a migration 002 is added before this feature is implemented, renumber this file to 004 and update all references.

```sql
-- Migration 003: Sold Comps Engine
-- Adds sold_comps and fmv_cache tables.
-- safe to run multiple times (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS sold_comps (
  comp_id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Link to the watched item that sold (nullable: future sources may not
  -- have a corresponding watched item)
  item_id              TEXT REFERENCES items(item_id) ON DELETE SET NULL,

  -- Normalized card identifier for cross-listing comp matching.
  -- Format (with A9): "{sport}:{player}:{year}:{set}:{parallel}:{grade_tier}"
  -- Format (without A9): sha256 of normalized title prefix (see §6)
  card_key             TEXT NOT NULL,

  -- Prices stored as integer cents, matching the existing items convention.
  sale_price_cents     INTEGER NOT NULL,        -- final hammer/BIN price
  shipping_cents       INTEGER NOT NULL DEFAULT 0,

  -- ISO 8601 timestamp of when the sale was detected (or actual end_time
  -- from the item record if available).
  sale_date            TEXT NOT NULL,

  -- 'Auction' | 'FixedPrice' | 'AuctionWithBIN' — copied from items.listing_type
  listing_type         TEXT NOT NULL,

  -- Raw condition string from eBay (e.g. "Near Mint or Better", "Very Good")
  condition_raw        TEXT,

  -- Normalized grade tier for FMV bucketing (see §6 grade tier mapping)
  -- Values: 'raw_poor' | 'raw_vg' | 'raw_nm' | 'psa9' | 'psa10' |
  --         'bgs95' | 'bgs10' | 'sgc10' | 'other_graded' | 'unknown'
  grade_tier           TEXT NOT NULL DEFAULT 'unknown',

  -- Where this comp came from. Determines trust level.
  -- 'passive' = captured from our own watchlist sync (this feature)
  -- 'scrape'  = future scraper adapter
  -- 'api'     = future eBay Marketplace Insights API
  source               TEXT NOT NULL DEFAULT 'passive',

  seller_id            TEXT,

  -- Snapshot of engagement metrics at moment of sale detection.
  -- NULL if the item was no longer live when we checked.
  watcher_count_at_sale  INTEGER,
  bid_count_at_sale      INTEGER,

  -- Original item title (for display and debugging — never used in comp matching)
  title_snapshot       TEXT,

  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Primary lookup: all comps for a card key, newest first
CREATE INDEX IF NOT EXISTS idx_comps_card_key
  ON sold_comps(card_key, sale_date DESC);

-- FMV queries filtered by card_key + grade_tier
CREATE INDEX IF NOT EXISTS idx_comps_card_grade
  ON sold_comps(card_key, grade_tier, sale_date DESC);

-- Reverse lookup: which comps came from a specific watched item
CREATE INDEX IF NOT EXISTS idx_comps_item_id
  ON sold_comps(item_id);

-- Recency queries across all comps
CREATE INDEX IF NOT EXISTS idx_comps_sale_date
  ON sold_comps(sale_date DESC);

-- Deduplication guard: one comp per (item_id, sale_date) pair.
-- Prevents double-capture if a sync cycle runs twice before the DB write
-- completes. item_id is NULL for non-passive sources so this only fires
-- for passive comps.
CREATE UNIQUE INDEX IF NOT EXISTS idx_comps_dedup
  ON sold_comps(item_id, sale_date)
  WHERE item_id IS NOT NULL;

-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fmv_cache (
  cache_id             INTEGER PRIMARY KEY AUTOINCREMENT,

  -- The card key this FMV was computed for
  card_key             TEXT NOT NULL,

  -- Grade tier this FMV applies to.
  -- 'all' means cross-grade (only used when comp count per tier is < 3)
  grade_tier           TEXT NOT NULL DEFAULT 'all',

  -- Computed FMV statistics (all in cents)
  median_cents         INTEGER NOT NULL,
  mean_cents           INTEGER NOT NULL,
  low_cents            INTEGER NOT NULL,   -- 10th percentile
  high_cents           INTEGER NOT NULL,   -- 90th percentile
  q1_cents             INTEGER NOT NULL,
  q3_cents             INTEGER NOT NULL,
  iqr_cents            INTEGER NOT NULL,

  comp_count           INTEGER NOT NULL,

  -- 'low' | 'medium' | 'high'
  confidence           TEXT NOT NULL,

  -- ISO 8601 of when this cache entry was computed
  computed_at          TEXT NOT NULL DEFAULT (datetime('now')),

  -- How far back the oldest comp used was (days)
  oldest_comp_days     INTEGER NOT NULL
);

-- One cache row per (card_key, grade_tier) pair — replace on recompute
CREATE UNIQUE INDEX IF NOT EXISTS idx_fmv_card_grade
  ON fmv_cache(card_key, grade_tier);
```

---

## 3. TypeScript Types

Add to `src/types/index.ts`:

```typescript
// === Sold Comp Types ===

export type CompSource = 'passive' | 'scrape' | 'api'

export type GradeTier =
  | 'raw_poor'
  | 'raw_vg'
  | 'raw_nm'
  | 'psa9'
  | 'psa10'
  | 'bgs95'
  | 'bgs10'
  | 'sgc10'
  | 'other_graded'
  | 'unknown'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface SoldComp {
  compId: number
  itemId: string | null          // null if not from a watched item
  cardKey: string
  salePriceCents: number
  shippingCents: number
  saleDate: string               // ISO 8601
  listingType: ListingType
  conditionRaw: string | null
  gradeTier: GradeTier
  source: CompSource
  sellerId: string | null
  watcherCountAtSale: number | null
  bidCountAtSale: number | null
  titleSnapshot: string | null
  createdAt: string
}

export interface FairMarketValue {
  cardKey: string
  gradeTier: GradeTier | 'all'
  medianCents: number
  meanCents: number
  lowCents: number               // 10th percentile
  highCents: number              // 90th percentile
  q1Cents: number
  q3Cents: number
  iqrCents: number
  compCount: number
  confidence: ConfidenceLevel
  lastUpdated: string            // ISO 8601
  oldestCompDays: number
}

export interface CompQuery {
  itemId?: string
  cardKey?: string
  gradeTier?: GradeTier | 'all'
  source?: CompSource
  afterDate?: string             // ISO 8601 — filter to comps on or after this date
  limit?: number                 // default 50, max 200
  offset?: number
}

export interface InsertCompInput {
  itemId: string | null
  cardKey: string
  salePriceCents: number
  shippingCents: number
  saleDate: string
  listingType: ListingType
  conditionRaw: string | null
  gradeTier: GradeTier
  source: CompSource
  sellerId: string | null
  watcherCountAtSale: number | null
  bidCountAtSale: number | null
  titleSnapshot: string | null
}

// Repository contract
export interface CompsRepo {
  insert(input: InsertCompInput): number             // returns comp_id
  getByItemId(itemId: string, limit?: number): SoldComp[]
  getByCardKey(query: CompQuery): SoldComp[]
  getCount(cardKey: string, gradeTier?: GradeTier): number
  getFmvCache(cardKey: string, gradeTier: GradeTier | 'all'): FairMarketValue | null
  upsertFmvCache(fmv: FairMarketValue): void
  isDuplicate(itemId: string, saleDate: string): boolean
}
```

---

## 4. New Files

### 4.1 `src/lib/db/migrations/003_sold_comps.sql`

Full SQL listed in §2 above. No additional content.

---

### 4.2 `src/lib/db/comps.ts`

**Purpose**: All SQLite operations for sold_comps and fmv_cache. Follows the exact same pattern as `items.ts` and `trends.ts`.

```
Full path:  src/lib/db/comps.ts
```

**Exported functions**:

```typescript
import type { SoldComp, InsertCompInput, CompQuery, FairMarketValue, GradeTier, CompsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

// Map a SQLite row to a SoldComp object.
// Internal only — not exported.
function rowToComp(row: any): SoldComp

// Insert a single comp. Returns the new comp_id (rowid).
// Throws DatabaseError if a duplicate (item_id, sale_date) pair is detected.
// The caller (comp-collector.ts) should call isDuplicate() first, but the
// UNIQUE index on (item_id, sale_date) will also catch races.
export function insertComp(input: InsertCompInput): number

// Retrieve all comps for a specific watched item, newest first.
// Default limit: 50.
export function getByItemId(itemId: string, limit?: number): SoldComp[]

// Flexible query across sold_comps.
// Supports: cardKey, gradeTier, afterDate, limit, offset.
// Must supply at least one of: itemId or cardKey.
// Ordered by sale_date DESC.
export function getByCardKey(query: CompQuery): SoldComp[]

// Count comps for a card key, optionally filtered by grade tier.
// Used by fmv-calculator.ts to decide confidence level.
export function getCompCount(cardKey: string, gradeTier?: GradeTier): number

// Check if a comp for this (itemId, saleDate) already exists.
// Returns true if a duplicate would be inserted.
export function isDuplicate(itemId: string, saleDate: string): boolean

// Read the cached FMV for a (cardKey, gradeTier) pair.
// Returns null if no cache row exists or if it is older than maxAgeDays (default 1).
export function getFmvCache(
  cardKey: string,
  gradeTier: GradeTier | 'all',
  maxAgeDays?: number
): FairMarketValue | null

// Write (insert or replace) an FMV cache row.
export function upsertFmvCache(fmv: FairMarketValue): void

// Export the repo object for dependency injection in tests.
export const compsRepo: CompsRepo = {
  insert: insertComp,
  getByItemId,
  getByCardKey,
  getCount: getCompCount,
  getFmvCache,
  upsertFmvCache,
  isDuplicate,
}
```

**Key implementation notes**:

- `getByCardKey` builds a WHERE clause dynamically in the same style as `getAll()` in `items.ts`. Avoid building raw string concatenation with user input — use parameterized `?` placeholders.
- `upsertFmvCache` uses `INSERT OR REPLACE INTO fmv_cache` to atomically replace stale cache.
- `getFmvCache` computes staleness using `julianday('now') - julianday(computed_at) <= ?`.
- All functions wrap their DB calls in try/catch and rethrow as `DatabaseError`.
- `insertComp` uses `db.prepare(...).run(...).lastInsertRowid` to return the new ID.

---

### 4.3 `src/lib/comps/fmv-calculator.ts`

**Purpose**: Pure calculation logic. Takes an array of `SoldComp` and produces a `FairMarketValue`. Contains no database calls — all data is fetched by the caller. This separation makes unit testing straightforward.

```
Full path:  src/lib/comps/fmv-calculator.ts
```

**Exported functions**:

```typescript
import type { SoldComp, FairMarketValue, GradeTier, ConfidenceLevel } from '../../types'

// The primary entry point. Accepts raw comps and returns a complete FMV object.
// Applies recency weighting internally before computing statistics.
// gradeTier must match what was used to filter the comps passed in.
// Pass 'all' when comps are cross-grade (insufficient per-tier data).
export function calculateFmv(
  cardKey: string,
  gradeTier: GradeTier | 'all',
  comps: SoldComp[]
): FairMarketValue

// Compute the weighted median from an array of (value, weight) pairs.
// Used internally; exported for unit testing.
export function weightedMedian(pairs: Array<{ value: number; weight: number }>): number

// Compute recency weight for a comp. Returns a value in [0, 1].
// Formula: see §5 (FMV Algorithm).
export function recencyWeight(saleDateIso: string, nowMs?: number): number

// Compute confidence level from comp count.
// < 3  → 'low'
// 3–10 → 'medium'
// > 10 → 'high'
export function confidenceFromCount(count: number): ConfidenceLevel

// Return the p-th percentile of a sorted numeric array.
// Uses linear interpolation between adjacent values.
// p is in range [0, 1].
export function percentile(sorted: number[], p: number): number
```

---

### 4.4 `src/lib/comps/comp-collector.ts`

**Purpose**: Bridges the sync cycle and the comp storage layer. Contains the passive collection logic. This is the only file that knows about both `sync-service.ts`-level data and `comps.ts`.

```
Full path:  src/lib/comps/comp-collector.ts
```

**Exported functions**:

```typescript
import type { WatchlistItem } from '../../types'
import type { InsertCompInput } from '../../types'

// Called by sync-service.ts immediately after markStatus(dbItem.id, 'Sold').
// Captures the final state of the item as a sold comp.
// Silent on duplicate detection (logs a warning, does not throw).
// Throws DatabaseError only on unexpected DB failure.
export function captureFromSoldItem(dbItem: WatchlistItem): void

// Generate a card_key from a WatchlistItem.
// With A9 metadata (future): delegates to buildCardKeyFromMetadata().
// Without A9: uses buildCardKeyFromTitle().
// This is exported so tests can call it directly.
export function buildCardKey(item: WatchlistItem): string

// Build a card_key from structured card metadata.
// Format: "{sport}:{player}:{year}:{set}:{parallel}:{grade_tier}"
// All segments are lowercased and whitespace-stripped.
// Missing segments are replaced with the literal string 'unknown'.
// Future use — called when A9 metadata is available.
export function buildCardKeyFromMetadata(metadata: CardMetadata): string

// Build a card_key from a raw eBay listing title using heuristic normalization.
// Current implementation path (no A9). See §6 for full algorithm.
export function buildCardKeyFromTitle(title: string): string

// Infer grade tier from eBay condition string.
// See §6 for the full mapping table.
export function inferGradeTier(conditionRaw: string | null): GradeTier

// --- Types local to this module ---

interface CardMetadata {
  sport: string | null
  player: string | null
  year: string | null
  set: string | null
  parallel: string | null
  gradeTier: GradeTier
}
```

**Key implementation notes**:

- `captureFromSoldItem` must call `isDuplicate(dbItem.id, saleDate)` before calling `insertComp`. If true, log `[comp-collector] duplicate detected for item ${id}, skipping` and return without throwing.
- The `saleDate` to use is: `dbItem.endTime ?? new Date().toISOString()`. The `endTime` field on the item is the scheduled auction end time; it is the closest we have to the actual sale date. If `endTime` is null (e.g. a BIN listing that ended unexpectedly), fall back to the current timestamp.
- `captureFromSoldItem` wraps everything in a try/catch. Log errors but do not let a comp capture failure abort the sync cycle.

---

### 4.5 `src/app/api/comps/route.ts`

**Purpose**: List comps with flexible filtering. Follows the exact same handler style as `src/app/api/items/route.ts`.

```
Full path:  src/app/api/comps/route.ts
```

**Endpoints**:

```
GET /api/comps?itemId={id}
GET /api/comps?cardKey={key}&gradeTier={tier}&afterDate={iso}&limit={n}&offset={n}
```

**Handler signature**:

```typescript
export async function GET(request: NextRequest): Promise<Response>
```

**Request parameters** (all optional, at least one of `itemId` or `cardKey` required):

| Parameter   | Type   | Default | Notes                                        |
|-------------|--------|---------|----------------------------------------------|
| `itemId`    | string | —       | eBay item ID                                 |
| `cardKey`   | string | —       | Normalized card key                          |
| `gradeTier` | string | `'all'` | One of the GradeTier values, or 'all'        |
| `afterDate` | string | —       | ISO 8601 — exclude comps before this date    |
| `limit`     | number | `50`    | Max 200                                      |
| `offset`    | number | `0`     | Pagination offset                            |

**Validation rules**:

- If neither `itemId` nor `cardKey` is provided, return `400 MISSING_FILTER`.
- Clamp `limit` to range [1, 200].
- If `gradeTier` is provided and not a valid `GradeTier` value or `'all'`, return `400 INVALID_GRADE_TIER`.

**Success response** (wrapped in project envelope `{ data: ... }`):

```typescript
{
  comps: SoldComp[]
  total: number      // total count matching the filter (before limit/offset)
  limit: number
  offset: number
}
```

**Error response** follows `routeError()` — same as all other routes in the project.

---

### 4.6 `src/app/api/comps/[itemId]/route.ts`

**Purpose**: Convenience endpoint — comps + computed FMV for a specific watched item by its eBay ID. This handles the most common UI use case (item detail panel).

```
Full path:  src/app/api/comps/[itemId]/route.ts
```

**Endpoint**:

```
GET /api/comps/{itemId}
GET /api/comps/{itemId}?gradeTier={tier}&forceRefresh=true
```

**Handler signature**:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
): Promise<Response>
```

**Query parameters**:

| Parameter      | Type    | Default  | Notes                                               |
|----------------|---------|----------|-----------------------------------------------------|
| `gradeTier`    | string  | `'all'`  | Which grade tier to compute FMV for                 |
| `forceRefresh` | boolean | `false`  | Skip FMV cache; recompute from comps                |

**Behavior**:

1. Look up the item by `itemId` in the items table. Return `404 ITEM_NOT_FOUND` if absent.
2. Get the item's `card_key` by calling `buildCardKey(item)` from `comp-collector.ts`.
3. Fetch comps via `getByItemId(itemId)` for the item-specific list.
4. Attempt to read FMV from `getFmvCache(cardKey, gradeTier)`.
   - If cache miss or `forceRefresh=true`: call `calculateFmv(cardKey, gradeTier, comps)` then `upsertFmvCache(fmv)`.
5. Return both comps and FMV in a single response.

**Success response**:

```typescript
{
  item: WatchlistItem
  cardKey: string
  comps: SoldComp[]
  fmv: FairMarketValue | null    // null if compCount === 0
}
```

---

### 4.7 `src/hooks/use-comps.ts`

**Purpose**: TanStack Query hooks for the comps API. Pattern matches `use-trends.ts` and `use-watchlist.ts`.

```
Full path:  src/hooks/use-comps.ts
```

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import type { SoldComp, FairMarketValue, WatchlistItem, CompQuery } from '@/types'

// Response shapes matching the API
interface CompsListResponse {
  comps: SoldComp[]
  total: number
  limit: number
  offset: number
}

interface ItemCompsResponse {
  item: WatchlistItem
  cardKey: string
  comps: SoldComp[]
  fmv: FairMarketValue | null
}
```

**Exported hooks**:

```typescript
// List comps by itemId or cardKey.
// At least one of itemId or cardKey must be provided.
// Hook is disabled when neither is present.
export function useComps(query: CompQuery): UseQueryResult<CompsListResponse>

// Full detail: item + comps + FMV for a specific watched item.
// Hook is disabled when itemId is falsy.
export function useItemComps(
  itemId: string,
  options?: { gradeTier?: GradeTier | 'all'; forceRefresh?: boolean }
): UseQueryResult<ItemCompsResponse>
```

**Query key conventions**:

```typescript
// useComps:
queryKey: ['comps', query]

// useItemComps:
queryKey: ['item-comps', itemId, options?.gradeTier ?? 'all']
```

**Fetch behavior**:

- `useComps` fetches `GET /api/comps?{params}` and returns `json.data`.
- `useItemComps` fetches `GET /api/comps/${itemId}?{params}` and returns `json.data`.
- No `refetchInterval` on either hook — comp data is relatively static; the user can invalidate manually.

---

## 5. FMV Calculation Algorithm

### 5.1 Overview

The FMV calculation is pure arithmetic over an array of `SoldComp` records. It does not query the database. All inputs are pre-filtered to a single (cardKey, gradeTier) combination before being passed to `calculateFmv()`.

### 5.2 Recency Weighting

Each comp receives a weight based on its age relative to now. Recent comps contribute more strongly to statistics.

```
w(comp) = exp(-λ * age_in_days)
where λ = 0.03   (half-life ≈ 23 days; comps 90 days old weigh ~0.07)
```

The weight is clamped to a minimum of 0.01 to prevent very old comps from being discarded entirely, which would reduce the sample when count is already low.

```typescript
export function recencyWeight(saleDateIso: string, nowMs: number = Date.now()): number {
  const ageDays = (nowMs - new Date(saleDateIso).getTime()) / 86_400_000
  return Math.max(0.01, Math.exp(-0.03 * ageDays))
}
```

### 5.3 Weighted Median

Sort comps by `sale_price_cents`. Assign each comp its recency weight. Walk the sorted array accumulating weight until cumulative weight >= 50% of total weight. The value at that threshold is the weighted median.

```typescript
export function weightedMedian(pairs: Array<{ value: number; weight: number }>): number {
  const sorted = [...pairs].sort((a, b) => a.value - b.value)
  const totalWeight = sorted.reduce((s, p) => s + p.weight, 0)
  let cumulative = 0
  for (const pair of sorted) {
    cumulative += pair.weight
    if (cumulative >= totalWeight / 2) return pair.value
  }
  return sorted[sorted.length - 1].value  // fallback (unreachable with valid input)
}
```

### 5.4 Percentile (for Low/High/Q1/Q3)

Operates on the unweighted sorted prices because percentile boundaries are structural properties of the distribution. Linear interpolation is used between adjacent values.

```typescript
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new Error('Empty array')
  if (sorted.length === 1) return sorted[0]
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const frac = index - lower
  return Math.round(sorted[lower] * (1 - frac) + sorted[upper] * frac)
}
```

### 5.5 IQR

```
IQR = Q3 - Q1
Q1 = percentile(sorted, 0.25)
Q3 = percentile(sorted, 0.75)
```

IQR is stored as-is. The caller can use `Q1 - 1.5 * IQR` and `Q3 + 1.5 * IQR` as Tukey fences to identify outliers if desired.

### 5.6 Confidence

```typescript
export function confidenceFromCount(count: number): ConfidenceLevel {
  if (count >= 11) return 'high'
  if (count >= 3)  return 'medium'
  return 'low'
}
```

Low confidence means the FMV is directionally useful but should not be relied upon for precise decisions.

### 5.7 Complete `calculateFmv` Implementation Guide

```
function calculateFmv(cardKey, gradeTier, comps):
  if comps.length === 0:
    return null  (callers handle this)

  // 1. Build weighted pairs
  pairs = comps.map(c => ({
    value:  c.salePriceCents + c.shippingCents,  // all-in price
    weight: recencyWeight(c.saleDate)
  }))

  // 2. Weighted median
  median = weightedMedian(pairs)

  // 3. Weighted mean
  totalWeight = sum(pairs[i].weight)
  mean = round(sum(pairs[i].value * pairs[i].weight) / totalWeight)

  // 4. Unweighted sorted prices (for percentiles)
  sorted = sort(pairs.map(p => p.value))

  // 5. Percentiles
  low  = percentile(sorted, 0.10)
  high = percentile(sorted, 0.90)
  q1   = percentile(sorted, 0.25)
  q3   = percentile(sorted, 0.75)
  iqr  = q3 - q1

  // 6. Confidence
  confidence = confidenceFromCount(comps.length)

  // 7. Oldest comp age
  now = Date.now()
  oldestMs = min(comps.map(c => new Date(c.saleDate).getTime()))
  oldestCompDays = round((now - oldestMs) / 86_400_000)

  return FairMarketValue {
    cardKey, gradeTier,
    medianCents: median,
    meanCents:   mean,
    lowCents:    low,
    highCents:   high,
    q1Cents:     q1,
    q3Cents:     q3,
    iqrCents:    iqr,
    compCount:   comps.length,
    confidence,
    lastUpdated: new Date().toISOString(),
    oldestCompDays
  }
```

### 5.8 Grade Tier Separation (Critical)

FMV is **always** computed within a single grade tier. PSA 10 comps must never be averaged with raw cards. The separation happens before `calculateFmv` is called:

- The API route receives `gradeTier` as a query parameter.
- `getByCardKey({ cardKey, gradeTier })` filters in SQLite using `WHERE grade_tier = ?`.
- The special value `'all'` omits the grade_tier filter — only use this for display purposes or when per-tier comp count is below 3.
- When `compCount < 3` for the requested tier, the API returns the FMV with `confidence: 'low'` and adds a fallback FMV computed from `'all'` grades alongside it. The caller decides how to present this.

---

## 6. Card Key Generation

### 6.1 Design Principle

The card key is a normalized string that groups different eBay listings of the same card together. A good card key:

- Is the same for two listings of "2021 Panini Prizm Patrick Mahomes PSA 10" regardless of wording differences.
- Is different for "2021 Panini Prizm Patrick Mahomes PSA 9" vs PSA 10.
- Is stable — the same item always produces the same key.
- Does not need to be human-readable (it will be stored and compared, not displayed).

### 6.2 Path A: With A9 Metadata (Future)

When the A9 card recognition feature is available, it will provide structured metadata. In that case:

```
card_key = [sport, player, year, set, parallel, grade_tier]
           .map(s => (s ?? 'unknown').toLowerCase().trim().replace(/\s+/g, '_'))
           .join(':')
```

Example: `baseball:patrick_mahomes:2021:prizm:silver:psa10`

`buildCardKeyFromMetadata(metadata: CardMetadata): string` implements this. It is wired into `buildCardKey()` when metadata is available on the item.

### 6.3 Path B: Without A9 (Current Implementation)

With no structured metadata, we generate the key from the raw listing title using a sequence of normalization steps:

**Step 1 — Lowercase and strip punctuation**:
```
normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
```

**Step 2 — Collapse whitespace**:
```
normalized = normalized.replace(/\s+/g, ' ').trim()
```

**Step 3 — Extract grade signal**:
Scan for these patterns (in priority order). Stop at first match.

| Pattern (regex, case-insensitive already lowercased) | Grade Tier |
|------------------------------------------------------|------------|
| `\bpsa\s*10\b`                                       | `psa10`    |
| `\bpsa\s*9\b`                                        | `psa9`     |
| `\bbgs\s*10\b` or `\bbgs\s*black\b`                  | `bgs10`    |
| `\bbgs\s*9\.5\b`                                     | `bgs95`    |
| `\bsgc\s*10\b`                                       | `sgc10`    |
| `\bpsa\b` (without numeric)                          | `other_graded` |
| `\bbgs\b` (without numeric)                          | `other_graded` |
| `\bsgc\b` (without numeric)                          | `other_graded` |
| eBay condition contains "Graded"                     | `other_graded` |
| eBay condition contains "Near Mint or Better"        | `raw_nm`   |
| eBay condition contains "Very Good" or "VG"          | `raw_vg`   |
| eBay condition contains "Good" or "Poor"             | `raw_poor` |
| (no match)                                           | `unknown`  |

**Step 4 — Remove grade tokens from title string** (to avoid them polluting the key):
```
stripped = normalized
  .replace(/\bpsa\s*\d+(\.\d+)?\b/g, '')
  .replace(/\bbgs\s*\d+(\.\d+)?\b/g, '')
  .replace(/\bsgc\s*\d+(\.\d+)?\b/g, '')
  .replace(/\b(psa|bgs|sgc|graded|raw|gem|mint|near|very good|good|poor)\b/g, '')
```

**Step 5 — Extract year**:
```
yearMatch = stripped.match(/\b(19[5-9]\d|20[0-3]\d)\b/)
year = yearMatch ? yearMatch[1] : 'unknown'
```

**Step 6 — Remove year from stripped string** to leave primarily player and set tokens.

**Step 7 — Take the first 40 characters of remaining normalized string** as a prefix key. Trim trailing spaces.

**Step 8 — Build the key**:
```
card_key = `title:${year}:${gradeTier}:${prefix}`
           (no spaces; spaces in prefix replaced with underscores)
```

Example output: `title:2021:psa10:patrick_mahomes_prizm_silver`

**Limitations of the title-based key**: Two different listings of the same card may produce slightly different keys if the title wording differs substantially. This is acceptable for the passive accumulation phase. Imperfect matching means some comps are under-counted rather than incorrectly grouped — a conservative failure mode.

### 6.4 Grade Tier Inference from Condition Field

Used in `inferGradeTier(conditionRaw: string | null): GradeTier`:

| eBay `conditionName` value             | `grade_tier`    |
|----------------------------------------|-----------------|
| `"PSA 10"` (or any `PSA \d+`)         | `psa10` / `psa9` / `other_graded` |
| `"BGS 10"` / `"BGS Black Label"`      | `bgs10`         |
| `"BGS 9.5"`                           | `bgs95`         |
| `"SGC 10"`                            | `sgc10`         |
| `"Graded"`                            | `other_graded`  |
| `"Near Mint or Better"` / `"NM-MT"`   | `raw_nm`        |
| `"Excellent"` / `"Very Good-Excellent"`| `raw_vg`       |
| `"Very Good"` / `"Good"`             | `raw_vg`        |
| `"Poor"` / `"Fair"`                   | `raw_poor`      |
| null / anything else                  | `unknown`       |

The function should first check the title-based grade extraction (step 3 above), then fall back to condition string inference, and return the first confident match.

---

## 7. Passive Collection Logic

### 7.1 Where in the Sync Cycle

The capture point is inside `runSync()` in `src/lib/sync/sync-service.ts`, inside the "Detect sold/expired" loop (section 4 of the current code):

```typescript
// Current code (lines 77-81 of sync-service.ts):
if (status === 'sold') {
  markStatus(dbItem.id, 'Sold')
  freeRank(dbItem.id)
  insertEvent({ itemId: dbItem.id, eventType: 'sold' })
  sold++
}
```

**After this change**:
```typescript
if (status === 'sold') {
  markStatus(dbItem.id, 'Sold')
  freeRank(dbItem.id)
  insertEvent({ itemId: dbItem.id, eventType: 'sold' })
  captureFromSoldItem(dbItem)   // ADD THIS LINE
  sold++
}
```

Import to add at the top of `sync-service.ts`:
```typescript
import { captureFromSoldItem } from '../comps/comp-collector'
```

`captureFromSoldItem` handles its own errors internally — it will never throw out to `runSync()`.

### 7.2 Data Available at Capture Moment

At the moment `captureFromSoldItem(dbItem)` is called:

| Data field           | Availability                          |
|----------------------|---------------------------------------|
| `dbItem.id`          | Always present                        |
| `dbItem.title`       | Always present                        |
| `dbItem.currentPrice`| Present — last known price before removal from watchlist |
| `dbItem.shippingCost`| Present (may be 0)                    |
| `dbItem.listingType` | Present                               |
| `dbItem.conditionName`| Present if eBay provided it          |
| `dbItem.endTime`     | Present for auctions; null for some BIN |
| `dbItem.sellerId`    | Present if eBay provided it          |
| `dbItem.watcherCount`| Last known value — may be 1-2 syncs stale |
| `dbItem.bidCount`    | Last known value                      |

**Limitation**: `dbItem.currentPrice` is the last synced price, not necessarily the final hammer price. For BIN listings this is exact. For auctions, the final bid may have gone higher between the last sync and when the listing ended. This limitation is inherent to passive collection and is acceptable for Scenario A.

### 7.3 Item Disappeared vs. Item Sold

The existing sync service already makes this distinction via `getItemStatus(dbItem.id)` from the eBay client. The comp capture only fires when `status === 'sold'`. No changes needed to the disappearance detection logic.

### 7.4 De-duplication Strategy

**Within a single sync run**: `captureFromSoldItem` calls `isDuplicate(itemId, saleDate)` before inserting. If true, it logs and returns early. This guards against a sync run being restarted mid-cycle.

**Across sync runs**: The `UNIQUE INDEX idx_comps_dedup ON sold_comps(item_id, sale_date) WHERE item_id IS NOT NULL` provides a hard DB-level guarantee. If `insertComp` throws a UNIQUE constraint violation, `captureFromSoldItem` catches it, logs it as a duplicate, and returns without re-throwing.

**Relisted items**: eBay assigns a new `item_id` when an item is relisted. A relisted item that also sells will appear as a new passive comp with a different `item_id`. This is correct behavior — both sales are valid comps. If a seller relists the exact same card with a different item_id, you will get two separate comp records, which is the desired outcome.

---

## 8. API Endpoints

### 8.1 Response Envelope

All responses use the existing project envelope defined in `errors.ts`:

**Success**: `{ data: T }` returned by `routeOk(data)`
**Error**: `{ error: { code: string; message: string } }` returned by `routeError(err)`

### 8.2 GET /api/comps

**Purpose**: Flexible comp listing. Most useful for a card key search across all items.

**Route file**: `src/app/api/comps/route.ts`

```
GET /api/comps?itemId=123456789
GET /api/comps?cardKey=title:2021:psa10:patrick_mahomes_prizm_silver&gradeTier=psa10
GET /api/comps?cardKey=...&afterDate=2025-01-01T00:00:00Z&limit=20&offset=0
```

**Validation**:
- `itemId` XOR `cardKey` must be present. Error code: `MISSING_FILTER`, HTTP 400.
- `limit` defaults to 50, max 200. Out-of-range values are clamped, not rejected.
- Unknown `gradeTier` values return `INVALID_GRADE_TIER`, HTTP 400.

**Success response shape**:
```typescript
{
  data: {
    comps: SoldComp[]
    total: number    // total matching rows (pre-pagination)
    limit: number
    offset: number
  }
}
```

**Error codes**:
| Code               | HTTP | Condition                          |
|--------------------|------|------------------------------------|
| `MISSING_FILTER`   | 400  | Neither itemId nor cardKey present |
| `INVALID_GRADE_TIER` | 400 | Unknown gradeTier string          |
| `DATABASE_ERROR`   | 500  | SQLite error                       |

### 8.3 GET /api/comps/:itemId

**Purpose**: Single-item detail — returns comps + computed FMV in one call.

**Route file**: `src/app/api/comps/[itemId]/route.ts`

```
GET /api/comps/123456789
GET /api/comps/123456789?gradeTier=psa10
GET /api/comps/123456789?forceRefresh=true
```

**Behavior**:
1. Fetch item from DB. Return 404 if not found.
2. Compute `cardKey` via `buildCardKey(item)`.
3. Fetch comps via `getByItemId(itemId)`.
4. Check FMV cache (unless `forceRefresh=true`).
5. If cache miss or force refresh: `calculateFmv(cardKey, gradeTier, comps)` then `upsertFmvCache`.
6. If `comps.length === 0`, return `fmv: null`.

**Success response shape**:
```typescript
{
  data: {
    item: WatchlistItem
    cardKey: string
    comps: SoldComp[]
    fmv: FairMarketValue | null
  }
}
```

**Error codes**:
| Code               | HTTP | Condition                            |
|--------------------|------|--------------------------------------|
| `ITEM_NOT_FOUND`   | 404  | No item with this ID in the DB       |
| `INVALID_GRADE_TIER` | 400 | Unknown gradeTier string            |
| `DATABASE_ERROR`   | 500  | SQLite error                         |

### 8.4 GET /api/comps/fmv (Standalone FMV endpoint)

If a standalone FMV endpoint is needed (e.g., for a card key without an associated item), add this as an additional GET handler in `src/app/api/comps/route.ts` by checking for a `fmv=true` query parameter, or as a separate route file at `src/app/api/comps/fmv/route.ts`.

Minimal response:
```typescript
{
  data: {
    cardKey: string
    fmv: FairMarketValue | null
  }
}
```

This endpoint is lower priority and not required for the 8.5-hour Scenario A implementation. Implement after the main endpoints are working.

---

## 9. Integration with Sync Service

### 9.1 Exact Changes to `sync-service.ts`

**Line to add at the top** (import section):
```typescript
import { captureFromSoldItem } from '../comps/comp-collector'
```

**Section 4 of `runSync()` — after `insertEvent` for sold status**:

Current block (lines 77–81):
```typescript
if (status === 'sold') {
  markStatus(dbItem.id, 'Sold')
  freeRank(dbItem.id)
  insertEvent({ itemId: dbItem.id, eventType: 'sold' })
  sold++
}
```

Replacement block:
```typescript
if (status === 'sold') {
  markStatus(dbItem.id, 'Sold')
  freeRank(dbItem.id)
  insertEvent({ itemId: dbItem.id, eventType: 'sold' })
  captureFromSoldItem(dbItem)   // Passive comp capture
  sold++
}
```

No other changes to `sync-service.ts` are needed.

### 9.2 Step-by-Step Execution When Status Transitions to Sold

```
runSync() → [item not in API response]
  → getItemStatus(dbItem.id)         // eBay API call
  → status === 'sold'
  → markStatus(dbItem.id, 'Sold')    // writes items.status + items.removed_at
  → freeRank(dbItem.id)              // clears items.rank, resequences
  → insertEvent({ sold })            // writes to events table
  → captureFromSoldItem(dbItem):
      saleDate = dbItem.endTime ?? now.toISOString()
      isDuplicate(dbItem.id, saleDate)?  → if true: log + return
      cardKey = buildCardKey(dbItem)
      gradeTier = inferGradeTier(dbItem.conditionName)
      insertComp({
        itemId:             dbItem.id,
        cardKey,
        salePriceCents:     dbItem.currentPrice,
        shippingCents:      dbItem.shippingCost,
        saleDate,
        listingType:        dbItem.listingType,
        conditionRaw:       dbItem.conditionName,
        gradeTier,
        source:             'passive',
        sellerId:           dbItem.sellerId,
        watcherCountAtSale: dbItem.watcherCount,
        bidCountAtSale:     dbItem.bidCount,
        titleSnapshot:      dbItem.title,
      })
  → sold++
```

### 9.3 Watcher Count and Bid Count at Moment of Sale

`dbItem` at this point contains the last values synced by the most recent sync cycle for this item. The item has left the API response (it's been sold), so we cannot query eBay for fresher data. `watcher_count_at_sale` and `bid_count_at_sale` therefore represent the state 1 sync cycle before the sale was detected. This is acceptable for Scenario A.

Document this limitation in the FMV display UI with a tooltip: "Engagement data captured at last sync before sale."

---

## 10. Future Data Source Interface

### 10.1 Abstract Interface

Define this in `src/lib/comps/comp-source.ts`:

```typescript
import type { InsertCompInput } from '../../types'

// Any data source that can produce sold comps must implement this interface.
// The passive collector, a future scraper, and a future API adapter all
// implement CompDataSource.
export interface CompDataSource {
  // Human-readable name for logging and attribution.
  readonly sourceName: string

  // Fetch recent sold comps for a given search query.
  // Returns an array of InsertCompInput ready to be written to the DB.
  // Implementations must set `source` on each item appropriately.
  // Returns empty array if no comps are found (never throws for empty results).
  fetchComps(query: CompSourceQuery): Promise<InsertCompInput[]>
}

export interface CompSourceQuery {
  // Free-text search — what to search for
  searchTerms: string

  // Narrow to comps sold in the last N days
  maxAgeDays?: number

  // Maximum number of comps to return
  limit?: number
}
```

### 10.2 Passive Collector as a Source Implementation

`comp-collector.ts` implements `CompDataSource` in a degenerate sense — it is event-driven (called by the sync cycle) rather than pull-based (queried on demand). It does not implement `fetchComps()` because it has no way to query historical data. It is still compliant with the interface contract by providing a `sourceName` and capturing comps as they naturally occur.

For symmetry, add the following to `comp-collector.ts`:

```typescript
export const passiveSource: Pick<CompDataSource, 'sourceName'> = {
  sourceName: 'passive',
}
```

### 10.3 Future Scraper Adapter

A future `src/lib/comps/sources/scraper-source.ts` would:

```typescript
import type { CompDataSource, CompSourceQuery } from '../comp-source'

export class ScraperSource implements CompDataSource {
  readonly sourceName = 'scrape'

  async fetchComps(query: CompSourceQuery): Promise<InsertCompInput[]> {
    // Uses Playwright or HTTP fetch to scrape eBay sold listings.
    // ToS risk — only activate if user opts in and accepts risk.
    throw new Error('Not implemented')
  }
}
```

### 10.4 Future API Adapter

A future `src/lib/comps/sources/marketplace-insights-source.ts` would:

```typescript
import type { CompDataSource, CompSourceQuery } from '../comp-source'

export class MarketplaceInsightsSource implements CompDataSource {
  readonly sourceName = 'api'

  async fetchComps(query: CompSourceQuery): Promise<InsertCompInput[]> {
    // Uses eBay Marketplace Insights API once access is granted.
    throw new Error('Not implemented — requires approved API access')
  }
}
```

### 10.5 Comp Ingestion Pipeline (Future)

When a pull-based source is plugged in, add a `ingestFromSource(source: CompDataSource, query: CompSourceQuery): Promise<number>` function to `comp-collector.ts`. It calls `source.fetchComps(query)`, deduplicates, and bulk-inserts via `insertComp`. Returns the number of newly inserted comps.

---

## 11. Modified Files

### 11.1 `src/lib/sync/sync-service.ts`

**Changes**:
- Add import: `import { captureFromSoldItem } from '../comps/comp-collector'`
- Add one line in the sold-detection block: `captureFromSoldItem(dbItem)`
- No other changes.

### 11.2 `src/types/index.ts`

**Changes**: Add all types defined in §3 above to the end of the file under a `// === Sold Comp Types ===` comment block.

Specifically add:
- `CompSource` type alias
- `GradeTier` type alias
- `ConfidenceLevel` type alias
- `SoldComp` interface
- `FairMarketValue` interface
- `CompQuery` type
- `InsertCompInput` interface
- `CompsRepo` interface

Do not modify any existing types.

---

## 12. Test Plan

### 12.1 Test File Location

```
src/tests/comps/fmv-calculator.test.ts    (unit tests — pure functions)
src/tests/comps/comp-collector.test.ts    (unit tests — with DB mock)
tests/e2e/comps-api.spec.ts               (Playwright E2E tests)
```

### 12.2 Mock Sold Comp Data

```typescript
// Use in all tests

const mockComps: SoldComp[] = [
  {
    compId: 1, itemId: '111111111', cardKey: 'title:2021:psa10:mahomes_prizm',
    salePriceCents: 18500, shippingCents: 500, saleDate: '2026-01-15T12:00:00Z',
    listingType: 'Auction', conditionRaw: 'PSA 10', gradeTier: 'psa10',
    source: 'passive', sellerId: 'seller_a', watcherCountAtSale: 12,
    bidCountAtSale: 8, titleSnapshot: '2021 Panini Prizm Mahomes PSA 10',
    createdAt: '2026-01-15T13:00:00Z',
  },
  {
    compId: 2, itemId: '222222222', cardKey: 'title:2021:psa10:mahomes_prizm',
    salePriceCents: 20000, shippingCents: 0, saleDate: '2026-01-20T18:00:00Z',
    listingType: 'FixedPrice', conditionRaw: 'PSA 10', gradeTier: 'psa10',
    source: 'passive', sellerId: 'seller_b', watcherCountAtSale: 5,
    bidCountAtSale: 0, titleSnapshot: '2021 Prizm Patrick Mahomes PSA 10 Gem Mint',
    createdAt: '2026-01-20T19:00:00Z',
  },
  {
    compId: 3, itemId: '333333333', cardKey: 'title:2021:psa10:mahomes_prizm',
    salePriceCents: 16000, shippingCents: 300, saleDate: '2025-12-01T08:00:00Z',
    listingType: 'Auction', conditionRaw: 'PSA 10', gradeTier: 'psa10',
    source: 'passive', sellerId: 'seller_c', watcherCountAtSale: 20,
    bidCountAtSale: 15, titleSnapshot: '2021 Panini Prizm Mahomes Silver PSA 10',
    createdAt: '2025-12-01T09:00:00Z',
  },
]
```

### 12.3 FMV Calculation Test Cases

All-in prices: 19000, 20000, 16300.

**Test: recencyWeight**

| Input saleDate (relative to now=2026-02-21) | Expected weight (approx) |
|---------------------------------------------|--------------------------|
| 1 day ago                                   | 0.970 (±0.005)           |
| 23 days ago (half-life)                      | 0.500 (±0.02)            |
| 90 days ago                                 | 0.069 → clamped to 0.069 |
| 365 days ago                                | 0.01 (clamped minimum)   |

**Test: weightedMedian**

```
pairs = [
  { value: 16300, weight: 0.069 },   // oldest — 82 days ago
  { value: 19000, weight: 0.851 },   // 37 days ago
  { value: 20000, weight: 0.935 },   // 32 days ago
]
totalWeight = 1.855
50% threshold = 0.9275

Sorted by value: 16300 (w=0.069), 19000 (w=0.851), 20000 (w=0.935)
Cumulative:
  16300: 0.069 — below 0.9275
  19000: 0.920 — above 0.9275 → median = 19000

Expected: weightedMedian(pairs) === 19000
```

**Test: percentile**

```
sorted = [16300, 19000, 20000]

percentile(sorted, 0.10) === 16300 + 0.2 * (19000 - 16300) = 16840  (approx)
percentile(sorted, 0.25) === 16300 + 0.5 * (19000 - 16300) = 17650  (approx)
percentile(sorted, 0.75) === 19000 + 0.5 * (20000 - 19000) = 19500  (approx)
percentile(sorted, 0.90) === 19000 + 0.8 * (20000 - 19000) = 19800  (approx)
```

**Test: calculateFmv with 3 comps (medium confidence)**

```
Input: mockComps (3 items, all grade_tier psa10)
Expected:
  confidence:  'medium'
  compCount:   3
  medianCents: 19000   (weighted median as computed above)
  lowCents:    ~16840  (10th percentile)
  highCents:   ~19800  (90th percentile)
  iqrCents:    ~1850   (q3 - q1)
```

**Test: calculateFmv with 0 comps**

```
Input: []
Expected: function returns null OR caller handles undefined
(choose one behavior and test it explicitly)
```

**Test: confidence levels**

```
confidenceFromCount(0)  === 'low'
confidenceFromCount(2)  === 'low'
confidenceFromCount(3)  === 'medium'
confidenceFromCount(10) === 'medium'
confidenceFromCount(11) === 'high'
confidenceFromCount(100) === 'high'
```

### 12.4 Grade Tier Inference Test Cases

```typescript
inferGradeTier('PSA 10')                      // → 'psa10'
inferGradeTier('PSA 9')                       // → 'psa9'
inferGradeTier('BGS 10')                      // → 'bgs10'
inferGradeTier('BGS 9.5')                     // → 'bgs95'
inferGradeTier('SGC 10')                      // → 'sgc10'
inferGradeTier('Graded')                      // → 'other_graded'
inferGradeTier('Near Mint or Better')         // → 'raw_nm'
inferGradeTier('Very Good-Excellent')         // → 'raw_vg'
inferGradeTier('Poor')                        // → 'raw_poor'
inferGradeTier(null)                          // → 'unknown'
inferGradeTier('Ungraded')                   // → 'unknown'
```

### 12.5 Card Key Generation Test Cases

```typescript
buildCardKeyFromTitle('2021 Panini Prizm Patrick Mahomes PSA 10 Silver')
// → 'title:2021:psa10:panini_prizm_patrick_mahomes_silver'

buildCardKeyFromTitle('Patrick Mahomes 2021 Prizm PSA 10 #15 Gem Mint')
// → 'title:2021:psa10:patrick_mahomes_prizm_15'

buildCardKeyFromTitle('2019 Topps Update Rookie Mike Trout Raw NM')
// → 'title:2019:raw_nm:topps_update_rookie_mike_trout'

buildCardKeyFromTitle('Jordan PSA 9 1986 Fleer')
// → 'title:1986:psa9:jordan_fleer'
```

### 12.6 E2E Test Spec

File: `tests/e2e/comps-api.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

// Assumes the dev server is running with seeded comp data.
// Seed: insert 3 passive comps via the DB directly before these tests.

test.describe('Sold Comp API', () => {

  test('GET /api/comps returns 400 without itemId or cardKey', async ({ request }) => {
    const res = await request.get('/api/comps')
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FILTER')
  })

  test('GET /api/comps?itemId returns comps for a known item', async ({ request }) => {
    const res = await request.get('/api/comps?itemId=111111111')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.comps).toHaveLength(1)
    expect(json.data.comps[0].salePriceCents).toBe(18500)
    expect(json.data.comps[0].source).toBe('passive')
  })

  test('GET /api/comps?cardKey returns all comps for a card key', async ({ request }) => {
    const key = encodeURIComponent('title:2021:psa10:mahomes_prizm')
    const res = await request.get(`/api/comps?cardKey=${key}`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.comps.length).toBeGreaterThanOrEqual(3)
    expect(json.data.total).toBeGreaterThanOrEqual(3)
  })

  test('GET /api/comps/:itemId returns item + comps + fmv', async ({ request }) => {
    const res = await request.get('/api/comps/111111111')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.item).toBeDefined()
    expect(json.data.cardKey).toBeTruthy()
    expect(json.data.comps).toBeDefined()
    // FMV may be null if only 1 comp exists for this item (that's ok)
  })

  test('GET /api/comps/:itemId returns 404 for unknown item', async ({ request }) => {
    const res = await request.get('/api/comps/000000000')
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('ITEM_NOT_FOUND')
  })

  test('FMV confidence is medium when 3-10 comps exist', async ({ request }) => {
    const key = encodeURIComponent('title:2021:psa10:mahomes_prizm')
    const res = await request.get(`/api/comps/111111111?forceRefresh=true`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    if (json.data.fmv) {
      expect(['low', 'medium', 'high']).toContain(json.data.fmv.confidence)
      expect(json.data.fmv.compCount).toBeGreaterThanOrEqual(1)
    }
  })

})
```

---

## 13. Error Handling

### 13.1 Item Sold but Price Data Missing

`dbItem.currentPrice` is typed as `number` (not nullable) in the `WatchlistItem` interface, so it will always be present. However, if somehow it is 0 or negative (defensive programming):

- In `captureFromSoldItem`: if `salePriceCents <= 0`, log `[comp-collector] sale price missing or zero for item ${id}, skipping comp capture` and return early without inserting. Do not throw.

### 13.2 Duplicate Comp Detection

Two layers of protection:

1. **Application layer**: `isDuplicate(itemId, saleDate)` called in `captureFromSoldItem` before `insertComp`. If true → log + return. No error thrown.

2. **Database layer**: `UNIQUE INDEX idx_comps_dedup ON sold_comps(item_id, sale_date) WHERE item_id IS NOT NULL`. If `insertComp` receives a duplicate that slipped past layer 1 (race condition in a future multi-process setup), better-sqlite3 will throw a `SqliteError` with code `SQLITE_CONSTRAINT_UNIQUE`. Catch specifically this error code in `insertComp`:

```typescript
} catch (err: any) {
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw new DatabaseError(`Duplicate comp: item ${input.itemId} sold at ${input.saleDate}`)
  }
  throw new DatabaseError(`Failed to insert comp: ${err.message}`)
}
```

`captureFromSoldItem` catches `DatabaseError` and checks the message for "Duplicate comp" — log as warning, not error.

### 13.3 FMV with Insufficient Data

If `comps.length === 0`:
- `calculateFmv` returns `null`.
- The API route (`/api/comps/:itemId`) returns `fmv: null` in the response body.
- The hook (`useItemComps`) propagates `fmv: null` to the UI.
- The UI should display "No comps available yet — FMV will appear as comps accumulate."

If `comps.length < 3` (low confidence):
- FMV is computed and returned.
- `confidence` field is `'low'`.
- The UI should display the FMV with a visual indicator (e.g., a warning badge) and the label "Low confidence (fewer than 3 comps)".

### 13.4 DB Migration Failure

The migration must be run before the application starts. If the migration has not been applied and `sold_comps` does not exist, `insertComp` will throw a `DatabaseError` with message "no such table: sold_comps". This will surface in the sync log as an error. The sync cycle itself will continue (because `captureFromSoldItem` swallows errors). Add the migration to the startup sequence alongside the initial migration.

The existing `getDb()` function in `client.ts` does not currently run migrations automatically. Check whether there is a migration runner script. If not, add a check in `captureFromSoldItem`: catch the "no such table" error specifically and log a clear message:

```
[comp-collector] ERROR: sold_comps table missing. Run migration 003_sold_comps.sql before using the comp engine.
```

---

## 14. Implementation Sequence

Implement in this order to keep the application functional at each step:

1. Write `src/lib/db/migrations/003_sold_comps.sql` and run it against the database.
2. Add new types to `src/types/index.ts`.
3. Write `src/lib/db/comps.ts` (DB layer).
4. Write `src/lib/comps/fmv-calculator.ts` (pure calculation).
5. Write `src/lib/comps/comp-collector.ts` (passive capture).
6. Modify `src/lib/sync/sync-service.ts` (add `captureFromSoldItem` call).
7. Write `src/app/api/comps/route.ts`.
8. Write `src/app/api/comps/[itemId]/route.ts`.
9. Write `src/hooks/use-comps.ts`.
10. Write unit tests in `src/tests/comps/`.
11. Write E2E tests in `tests/e2e/comps-api.spec.ts`.
12. Write `src/lib/comps/comp-source.ts` (abstract interface for future sources).

Steps 1–6 are the core — they make passive capture functional. Steps 7–9 expose it to the UI. Steps 10–12 validate correctness and lay groundwork for Scenario B.

---

## 15. File Manifest

| Status   | Path                                                        | Purpose                            |
|----------|-------------------------------------------------------------|------------------------------------|
| NEW      | `src/lib/db/migrations/003_sold_comps.sql`                  | Schema migration                   |
| NEW      | `src/lib/db/comps.ts`                                       | DB CRUD for sold_comps, fmv_cache  |
| NEW      | `src/lib/comps/fmv-calculator.ts`                           | Pure FMV statistics                |
| NEW      | `src/lib/comps/comp-collector.ts`                           | Passive comp capture logic         |
| NEW      | `src/lib/comps/comp-source.ts`                              | Abstract source interface          |
| NEW      | `src/app/api/comps/route.ts`                                | GET /api/comps                     |
| NEW      | `src/app/api/comps/[itemId]/route.ts`                       | GET /api/comps/:itemId             |
| NEW      | `src/hooks/use-comps.ts`                                    | TanStack Query hooks               |
| NEW      | `src/tests/comps/fmv-calculator.test.ts`                    | Unit tests — FMV math              |
| NEW      | `src/tests/comps/comp-collector.test.ts`                    | Unit tests — capture logic         |
| NEW      | `tests/e2e/comps-api.spec.ts`                               | E2E API tests                      |
| MODIFIED | `src/types/index.ts`                                        | Add comp types                     |
| MODIFIED | `src/lib/sync/sync-service.ts`                              | Add captureFromSoldItem call       |
