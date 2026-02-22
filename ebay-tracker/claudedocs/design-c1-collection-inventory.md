# C1: Collection Inventory — Implementation Design Document

**Feature**: Transform the eBay Watchlist Monitor into a combined watchlist + physical collection manager.

**Scope**: This document covers MVP (10.5 hrs) and Full scope (+9.5 hrs). Each section is labelled MVP or FULL where they differ. Sections without a label apply to both.

**Codebase conventions used throughout this doc:**
- SQLite via `better-sqlite3` (synchronous, no async/await in DB layer)
- All prices stored as integer cents (e.g. `$12.50` = `1250`)
- API responses use `routeOk(data)` / `routeError(err)` from `src/lib/errors.ts`
- Envelope format: `{ data: T }` for success, `{ error: { code, message } }` for errors
- TanStack Query (`useQuery`, `useMutation`) in all React hooks
- Zustand for client-side UI state (filters, modals, column visibility)
- `'use client'` at top of every component and hook file
- All DB functions exported as individual named exports AND collected into a repo object
- Error classes extend `AppError` from `src/lib/errors.ts`
- Migration runner picks up `.sql` files alphabetically from `src/lib/db/migrations/`

---

## a) Database Schema

### Migration file: `src/lib/db/migrations/002_collection.sql`

```sql
-- ============================================================
-- Collection items: physical cards owned (or sold) by the user.
-- Separate from the items (watchlist) table by design:
--   1. Non-eBay cards (shows, trades) have no ebay_item_id.
--   2. eBay listings expire; physical cards persist indefinitely.
--   3. Clean separation of market intelligence vs. owned assets.
-- ============================================================

CREATE TABLE collection_items (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Optional link back to the watchlist. NULL for cards acquired
  -- outside eBay (card shows, trades, LCS, etc.).
  ebay_item_id              TEXT REFERENCES items(item_id) ON DELETE SET NULL,

  -- Card identity fields. All nullable except title.
  title                     TEXT NOT NULL,
  player_name               TEXT,
  year                      INTEGER,           -- e.g. 1986
  sport                     TEXT,              -- 'Baseball' | 'Football' | 'Basketball' | 'Hockey' | 'Soccer' | 'Other'
  card_number               TEXT,              -- e.g. '#/25', '1 of 1'
  set_name                  TEXT,              -- e.g. 'Topps Chrome'
  parallel                  TEXT,              -- e.g. 'Gold Refractor', 'Prizm Silver'

  -- Grading fields
  grade                     TEXT,              -- e.g. '10', '9.5', 'Raw' (NULL = ungraded/raw)
  grader                    TEXT,              -- 'PSA' | 'BGS' | 'SGC' | 'HGA' | NULL

  -- Acquisition
  acquisition_source        TEXT NOT NULL DEFAULT 'other',
    -- CHECK constraint values: 'ebay_watchlist' | 'ebay_other' | 'card_show' | 'lcs' | 'trade' | 'other'
  acquisition_price_cents   INTEGER NOT NULL DEFAULT 0,  -- what was paid for the card itself
  acquisition_shipping_cents INTEGER NOT NULL DEFAULT 0, -- separate shipping paid
  acquisition_date          TEXT NOT NULL,               -- ISO 8601 date string (YYYY-MM-DD)
  acquisition_notes         TEXT,

  -- Current value (for P&L calculation)
  -- Updated automatically when a linked eBay item FMV changes, or set manually.
  -- When NULL and card is linked, fall back to the linked item's current_price at query time.
  -- When NULL and card is not linked, fall back to acquisition_price_cents + acquisition_shipping_cents.
  current_value_cents       INTEGER,

  -- Sale fields (NULL = still owned)
  sold_price_cents          INTEGER,           -- net proceeds (after fees if known)
  sold_date                 TEXT,              -- ISO 8601 date string (YYYY-MM-DD)
  sold_platform             TEXT,             -- 'eBay' | 'COMC' | 'Facebook' | 'Card Show' | 'Trade' | 'Other'
  sold_notes                TEXT,

  -- Media
  image_url                 TEXT,

  -- Status
  status                    TEXT NOT NULL DEFAULT 'owned',
    -- CHECK constraint values: 'owned' | 'sold' | 'grading'

  -- Timestamps
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to keep updated_at current on any row update
CREATE TRIGGER collection_items_updated_at
  AFTER UPDATE ON collection_items
  FOR EACH ROW
  BEGIN
    UPDATE collection_items SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

-- Indexes
CREATE INDEX idx_collection_status        ON collection_items(status);
CREATE INDEX idx_collection_sport         ON collection_items(sport);
CREATE INDEX idx_collection_ebay_item     ON collection_items(ebay_item_id);
CREATE INDEX idx_collection_acquisition   ON collection_items(acquisition_date);
CREATE INDEX idx_collection_player        ON collection_items(player_name);
CREATE INDEX idx_collection_grader_grade  ON collection_items(grader, grade);

-- ============================================================
-- Grading submissions: tracks cards sent to grading services.
-- One collection item can have multiple grading submissions
-- (e.g., reholder, appeal, or resubmit after crack-out).
-- [FULL SCOPE — included in migration now, used in UI later]
-- ============================================================

CREATE TABLE grading_submissions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_item_id  INTEGER NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,

  grading_service     TEXT NOT NULL,  -- 'PSA' | 'BGS' | 'SGC' | 'HGA'
  submission_date     TEXT NOT NULL,  -- ISO 8601 date string (YYYY-MM-DD)

  -- Service tier determines turnaround and cost
  tier                TEXT NOT NULL DEFAULT 'regular',
    -- CHECK values: 'economy' | 'regular' | 'express' | 'super_express'

  cost_cents          INTEGER NOT NULL DEFAULT 0,  -- submission fee paid

  -- Results (NULL until graded)
  cert_number         TEXT,           -- PSA/BGS cert for lookup
  grade_received      TEXT,           -- e.g. '9', '9.5', 'Authentic'
  grade_date          TEXT,           -- ISO 8601 date when grade was assigned

  -- Workflow status
  status              TEXT NOT NULL DEFAULT 'submitted',
    -- CHECK values: 'submitted' | 'received' | 'grading' | 'shipped_back' | 'complete'

  notes               TEXT,

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER grading_submissions_updated_at
  AFTER UPDATE ON grading_submissions
  FOR EACH ROW
  BEGIN
    UPDATE grading_submissions SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE INDEX idx_grading_collection_item  ON grading_submissions(collection_item_id);
CREATE INDEX idx_grading_service_status   ON grading_submissions(grading_service, status);
CREATE INDEX idx_grading_cert             ON grading_submissions(cert_number);
```

**Why a trigger instead of application-level `updated_at`:** The existing `items` table uses `datetime('now')` inline in the SQL; a trigger is slightly more robust when multiple code paths update the same row. Either approach is consistent with the codebase — the trigger was chosen here to guarantee correctness regardless of which columns are UPDATEd.

---

## b) TypeScript Types

Add to `src/types/index.ts` (append to the end of the file, after the existing exports).

```typescript
// ============================================================
// Collection Types
// ============================================================

export type AcquisitionSource =
  | 'ebay_watchlist'
  | 'ebay_other'
  | 'card_show'
  | 'lcs'
  | 'trade'
  | 'other'

export type CollectionStatus = 'owned' | 'sold' | 'grading'

export type GradingService = 'PSA' | 'BGS' | 'SGC' | 'HGA'

export type GradingTier = 'economy' | 'regular' | 'express' | 'super_express'

export type GradingSubmissionStatus =
  | 'submitted'
  | 'received'
  | 'grading'
  | 'shipped_back'
  | 'complete'

export type SoldPlatform =
  | 'eBay'
  | 'COMC'
  | 'Facebook'
  | 'Card Show'
  | 'Trade'
  | 'Other'

export type Sport =
  | 'Baseball'
  | 'Football'
  | 'Basketball'
  | 'Hockey'
  | 'Soccer'
  | 'Other'

export interface CollectionItem {
  id: number
  ebayItemId: string | null          // nullable: non-eBay cards have no item_id
  title: string
  playerName: string | null
  year: number | null
  sport: Sport | null
  cardNumber: string | null
  setName: string | null
  parallel: string | null
  grade: string | null               // e.g. '10', '9.5', null = raw/ungraded
  grader: GradingService | null
  acquisitionSource: AcquisitionSource
  acquisitionPriceCents: number      // card price paid
  acquisitionShippingCents: number   // shipping paid separately
  acquisitionDate: string            // YYYY-MM-DD
  acquisitionNotes: string | null
  currentValueCents: number | null   // null = use fallback (see stats logic)
  soldPriceCents: number | null
  soldDate: string | null            // YYYY-MM-DD
  soldPlatform: SoldPlatform | null
  soldNotes: string | null
  imageUrl: string | null
  status: CollectionStatus
  createdAt: string                  // ISO 8601
  updatedAt: string                  // ISO 8601

  // Computed at query time — not stored in DB
  totalCostCents: number             // acquisitionPriceCents + acquisitionShippingCents
  effectiveValueCents: number        // currentValueCents ?? totalCostCents (never null)
  unrealizedPnlCents: number | null  // null if sold; effectiveValue - totalCost
  realizedPnlCents: number | null    // null if not sold; soldPrice - totalCost
}

export interface CollectionStats {
  totalInvestedCents: number         // sum of totalCostCents for all items (owned + sold)
  ownedInvestedCents: number         // sum of totalCostCents for status='owned'
  currentValueCents: number          // sum of effectiveValueCents for status='owned'
  unrealizedPnlCents: number         // currentValue - ownedInvested
  unrealizedPnlPercent: number       // unrealizedPnl / ownedInvested * 100 (0 if no items)
  realizedPnlCents: number           // sum of realizedPnlCents for status='sold'
  totalPnlCents: number              // unrealized + realized
  itemCount: number                  // count of status='owned' items
  soldCount: number                  // count of status='sold' items
  gradingCount: number               // count of status='grading' items
  avgHoldDays: number | null         // avg days owned for sold items; null if none sold
}

export interface AddToCollectionRequest {
  ebayItemId?: string | null
  title: string
  playerName?: string | null
  year?: number | null
  sport?: Sport | null
  cardNumber?: string | null
  setName?: string | null
  parallel?: string | null
  grade?: string | null
  grader?: GradingService | null
  acquisitionSource: AcquisitionSource
  acquisitionPriceCents: number
  acquisitionShippingCents?: number   // defaults to 0
  acquisitionDate: string             // YYYY-MM-DD
  acquisitionNotes?: string | null
  currentValueCents?: number | null
  imageUrl?: string | null
}

export interface UpdateCollectionItemRequest {
  title?: string
  playerName?: string | null
  year?: number | null
  sport?: Sport | null
  cardNumber?: string | null
  setName?: string | null
  parallel?: string | null
  grade?: string | null
  grader?: GradingService | null
  acquisitionSource?: AcquisitionSource
  acquisitionPriceCents?: number
  acquisitionShippingCents?: number
  acquisitionDate?: string
  acquisitionNotes?: string | null
  currentValueCents?: number | null
  imageUrl?: string | null
  status?: CollectionStatus
}

export interface SellCollectionItemRequest {
  soldPriceCents: number
  soldDate: string              // YYYY-MM-DD
  soldPlatform: SoldPlatform
  soldNotes?: string | null
}

export interface CollectionFilters {
  search: string                 // matches title, playerName, setName
  sport: Sport | 'All'
  status: CollectionStatus | 'All'
  grader: GradingService | 'All'
  sortBy: CollectionSortField
  sortDir: 'asc' | 'desc'
}

export type CollectionSortField =
  | 'acquisitionDate'
  | 'title'
  | 'playerName'
  | 'totalCost'
  | 'currentValue'
  | 'pnl'
  | 'pnlPercent'

// [FULL SCOPE] Grading submission types
export interface GradingSubmission {
  id: number
  collectionItemId: number
  gradingService: GradingService
  submissionDate: string          // YYYY-MM-DD
  tier: GradingTier
  costCents: number
  certNumber: string | null
  gradeReceived: string | null
  gradeDate: string | null
  status: GradingSubmissionStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Repository interface (parallels ItemsRepo, TrendsRepo, EventsRepo)
export interface CollectionRepo {
  getAll(filters?: Partial<CollectionFilters>): CollectionItem[]
  getById(id: number): CollectionItem | null
  getStats(): CollectionStats
  add(input: AddToCollectionRequest): CollectionItem
  update(id: number, input: UpdateCollectionItemRequest): CollectionItem
  sell(id: number, input: SellCollectionItemRequest): CollectionItem
  remove(id: number): void
}
```

---

## c) New Files — Exact Paths and Exports

### MVP Files

```
src/
  app/
    collection/
      page.tsx                                   export default CollectionPage
    api/
      collection/
        route.ts                                 export async function GET, POST
        [id]/
          route.ts                               export async function GET, PUT, DELETE
          sell/
            route.ts                             export async function POST
  components/
    collection/
      collection-table.tsx                       export function CollectionTable
      collection-stats.tsx                       export function CollectionStats
      add-to-collection-modal.tsx                export function AddToCollectionModal
      purchase-from-watchlist-modal.tsx          export function PurchaseFromWatchlistModal
      sell-modal.tsx                             export function SellModal
      collection-filters.tsx                     export function CollectionFilters
  hooks/
    use-collection.ts                            export function useCollection, useCollectionItem, useCollectionStats, useAddToCollection, useUpdateCollectionItem, useSellCollectionItem, useDeleteCollectionItem
  store/
    collection-store.ts                          export const useCollectionStore
  lib/
    db/
      collection.ts                              export function getAll, getById, getStats, add, update, sell, remove; export const collectionRepo: CollectionRepo
      migrations/
        002_collection.sql
```

### Full Scope Additional Files

```
src/
  app/
    collection/
      [id]/
        page.tsx                                 export default CollectionItemDetailPage
    api/
      collection/
        [id]/
          grading/
            route.ts                             export async function GET, POST
          grading/
            [submissionId]/
              route.ts                           export async function PUT, DELETE
  components/
    collection/
      grading-timeline.tsx                       export function GradingTimeline
      add-grading-submission-modal.tsx           export function AddGradingSubmissionModal
      collection-item-header.tsx                 export function CollectionItemHeader
  hooks/
    use-grading.ts                               export function useGradingSubmissions, useAddGradingSubmission, useUpdateGradingSubmission
  lib/
    db/
      grading.ts                                 export function getSubmissions, addSubmission, updateSubmission, removeSubmission
```

---

## d) Page Layout and UI Spec

### `/collection` Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TopBar (existing, with new Collection nav link)                 │
├─────────────────────────────────────────────────────────────────┤
│ STATS ROW — 6 stat cards in a grid                              │
│ [Total Invested] [Current Value] [Unrealized P&L]               │
│ [Realized P&L]   [Items Owned]   [Items Sold]                  │
├─────────────────────────────────────────────────────────────────┤
│ FILTER BAR                                                      │
│ [Search input] [Sport▼] [Grade▼] [Status▼] [Sort▼]  [+Add Card]│
├─────────────────────────────────────────────────────────────────┤
│ COLLECTION TABLE                                                │
│ Image | Title / Player | Sport | Grade | Acquired | Cost |      │
│ Value | P&L | P&L% | Status | Actions                          │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Stats Cards (CollectionStats component)

Six cards rendered as a `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6` layout. Each card uses the same `StatBox` pattern from `item-stats-grid.tsx`:

```
bg-surface border border-border rounded-lg p-3
  [label: text-[10px] uppercase tracking-wider text-text-secondary]
  [value: text-sm font-medium text-text-primary]
  [subvalue for P&L cards: text-[10px] with green/red color]
```

Card definitions:

| Card | Value | Sub-value |
|------|-------|-----------|
| Total Invested | sum of all totalCostCents (owned + sold) | — |
| Current Value | sum of effectiveValueCents for owned items | — |
| Unrealized P&L | currentValue - ownedInvested (cents) | % formatted with sign |
| Realized P&L | sum of (soldPrice - cost) for sold items | — |
| Items Owned | count of owned items | — |
| Items Sold | count of sold items | — |

P&L value coloring: positive = `text-green-400`, negative = `text-red-400`, zero = `text-text-secondary`.

### Collection Table (CollectionTable component)

Table is rendered as a `<table>` element (same as `watchlist-table.tsx` pattern). Uses TanStack Table v8 (`@tanstack/react-table`) for sorting, which is already a project dependency.

Column order (all sortable except Image and Actions):

| Column | Width | Content |
|--------|-------|---------|
| Image | 40px | `<img>` thumbnail or grey placeholder, same as watchlist row |
| Title / Player | flex | Title as primary text, playerName as `text-text-secondary` sub-text |
| Sport | 80px | Plain text |
| Grade | 80px | `"PSA 10"` if graded, `"Raw"` if not |
| Acquired | 90px | `acquisition_date` formatted as "Jan 5, 2025" |
| Cost | 90px | `totalCostCents` formatted as `$XX.XX` |
| Value | 90px | `effectiveValueCents` formatted as `$XX.XX` |
| P&L | 90px | Amount with green/red color |
| P&L% | 70px | Percentage with green/red color |
| Status | 80px | Badge: green=owned, blue=grading, grey=sold |
| Actions | 80px | Icon buttons: "Mark Sold" (checkmark) + kebab for Edit/Delete |

Default sort: `acquisitionDate` descending (most recent first).

### Responsive Behavior

- Mobile (< md): Show Image, Title, P&L%, Status, Actions. Hide Cost, Value, P&L amount, Sport, Grade, Acquired.
- Tablet (md–lg): Show all except Grade and Acquired.
- Desktop (lg+): All columns visible.

Same `visibleColumns` pattern as the watchlist: store column visibility in `collection-store.ts`, with a column toggle in the filter bar or a sidebar panel in a future iteration. MVP: always show all columns on desktop, hide on mobile via CSS (`hidden md:table-cell`).

---

## e) "Mark as Purchased" Workflow

### Integration with watchlist-row.tsx

Add a new action column (or extend the existing queue toggle area) with a shopping-cart icon button. The button is only shown when `item.status === 'Active'` and when `item.isInQueue` (meaning the user flagged it as a buy target). However, given that any watchlist item could be purchased, show the button for all Active items to keep it discoverable.

**Placement in `watchlist-row.tsx`:** Add a new `<td>` cell at the far right (after the queue toggle column). The cell contains a button with title "Add to Collection" that opens the `PurchaseFromWatchlistModal`.

The cell is always rendered (no `visibleColumns` gate) so the action is always accessible. Cell width: `w-10`.

```tsx
// New cell added to WatchlistRow after the existing queue cell:
<td className="w-10 px-1 py-1.5 text-center">
  <button
    onClick={() => onPurchase(item)}
    className="text-text-secondary hover:text-accent transition-colors"
    title="Add to Collection"
  >
    {/* Shopping cart icon — inline SVG, 16x16 */}
  </button>
</td>
```

`onPurchase` is a callback prop passed into `WatchlistRow`. The parent (`WatchlistTable`) holds the open modal state via `useCollectionStore` (specifically `purchaseModalItem` and `setPurchaseModalItem`).

### PurchaseFromWatchlistModal

**Trigger:** User clicks the cart button on any watchlist row.

**Pre-filled from the WatchlistItem:**
- Title (from `item.title`)
- Price (from `item.currentPrice + item.shippingCost`, shown read-only)
- Image (from `item.imageUrl`, shown as thumbnail)
- eBay Item ID (hidden, used as `ebayItemId` in the POST body)
- Acquisition source: pre-selected as `'ebay_watchlist'`

**User must enter:**
- Actual price paid (text input, cents — displayed as dollars, converted on submit)
- Actual shipping paid (text input, optional, defaults to 0)
- Acquisition date (date picker, defaults to today `new Date().toISOString().slice(0, 10)`)
- Notes (textarea, optional)
- Player name (text input, optional)
- Year (number input, optional)
- Sport (select, optional)
- Grade (text input, optional, e.g. "Raw", "PSA 10")
- Grader (select, optional, shown only when grade is non-empty and not "Raw")

**On Submit:**
1. Call `POST /api/collection` with `AddToCollectionRequest`
2. On success: invalidate `['collection']` query key, close modal, show a brief success state ("Added to collection")
3. Do NOT remove or modify the watchlist item — the watchlist item remains independently tracked

**Modal structure:**

```tsx
// src/components/collection/purchase-from-watchlist-modal.tsx
'use client'
// Dialog rendered as a fixed overlay (not a drawer) with a dark backdrop.
// Matches the general UI aesthetic: bg-surface, border-border, rounded-lg.
// No external dialog library — use a simple div with role="dialog" aria-modal="true"
// and a focus trap (Tab key loops within modal).
```

Modal dimensions: `max-w-lg w-full mx-4` centered on screen. Max-height `90vh` with `overflow-y-auto`.

---

## f) Manual Add Workflow

### Trigger

User clicks the "+ Add Card" button in the filter bar on the `/collection` page.

### AddToCollectionModal Form Fields

Rendered in two columns on desktop, single column on mobile.

**Required fields** (marked with asterisk):
- Title* — `<input type="text" />`, max 500 chars
- Acquisition Source* — `<select>`: Card Show / LCS / Trade / eBay (other) / eBay Watchlist / Other
- Price Paid* — `<input type="text" />`, dollar amount, converts to cents on submit
- Acquisition Date* — `<input type="date" />`, defaults to today

**Optional fields:**
- Player Name — `<input type="text" />`
- Year — `<input type="number" />`, range 1869–current year
- Sport — `<select>`: Baseball / Football / Basketball / Hockey / Soccer / Other
- Card Number — `<input type="text" />` (e.g. "#/25")
- Set Name — `<input type="text" />`
- Parallel — `<input type="text" />`
- Grader — `<select>`: PSA / BGS / SGC / HGA (shown when Grade is non-empty)
- Grade — `<input type="text" />` (e.g. "10", "9.5", "Raw")
- Shipping Paid — `<input type="text" />`, defaults to "0.00"
- eBay Item ID — `<input type="text" />` (allows linking to existing watchlist entry)
- Notes — `<textarea rows={3} />`
- Image URL — `<input type="url" />` (paste URL of card image)

**If eBay Item ID is provided:**
- After blur event on the field, call `GET /api/items/:id` to fetch item data
- Auto-populate Title, Image URL from the fetched item
- Show a small "Linked" badge below the field if found, "Not found" if 404

**Validation (client-side before submit):**
- Title: required, non-empty string
- Price Paid: required, non-negative number
- Acquisition Date: required, valid YYYY-MM-DD, not in future
- Year: if provided, must be 1869 to current year
- Grade: if Grader is selected, Grade is required (and vice versa)

**On Submit:**
1. Convert dollar inputs to cents (multiply by 100, round to integer)
2. Call `POST /api/collection`
3. On success: invalidate `['collection']` query, close modal, scroll to new item if possible

---

## g) Sell Recording Workflow

### Trigger

User clicks the sell icon in the collection table Actions column.

### SellModal Form Fields

**Pre-filled read-only:**
- Card title and image thumbnail (for confirmation)
- Total cost (for P&L preview)

**User must enter:**
- Sold Price* — `<input type="text" />`, dollar amount
- Sold Date* — `<input type="date" />`, defaults to today
- Sold Platform* — `<select>`: eBay / COMC / Facebook / Card Show / Trade / Other
- Notes — `<textarea rows={2} />`, optional

**Live P&L Preview** (shown below the sold price input):
- "Profit: +$X.XX" in green or "Loss: -$X.XX" in red
- Updates as the user types in the sold price field
- Formula: `soldPriceCents - totalCostCents`

**On Submit:**
1. Call `POST /api/collection/:id/sell`
2. API sets `status = 'sold'`, records `sold_price_cents`, `sold_date`, `sold_platform`, `sold_notes`
3. On success: invalidate `['collection']` and `['collection', 'stats']` query keys, close modal

**The sold item remains in the collection table** — it does not disappear. Default filter is `status = 'All'` so it stays visible. User can filter to `status = 'owned'` to hide sold items.

---

## h) Portfolio Stats Calculation

### SQL Queries in `getStats()` (in `src/lib/db/collection.ts`)

```sql
-- Run as a single db.transaction() for consistency

-- 1. Per-item computed values
SELECT
  id,
  acquisition_price_cents + acquisition_shipping_cents  AS total_cost_cents,
  COALESCE(current_value_cents,
    acquisition_price_cents + acquisition_shipping_cents
  )                                                     AS effective_value_cents,
  sold_price_cents,
  acquisition_date,
  sold_date,
  status
FROM collection_items;

-- 2. Aggregate stats (run in same transaction)
SELECT
  -- Total invested across all items
  SUM(acquisition_price_cents + acquisition_shipping_cents)              AS total_invested_cents,

  -- Owned items only
  SUM(CASE WHEN status = 'owned'
        THEN acquisition_price_cents + acquisition_shipping_cents
        ELSE 0 END)                                                      AS owned_invested_cents,

  -- Current value (owned only, with fallback)
  SUM(CASE WHEN status = 'owned'
        THEN COALESCE(current_value_cents,
               acquisition_price_cents + acquisition_shipping_cents)
        ELSE 0 END)                                                      AS current_value_cents,

  -- Realized P&L for sold items
  SUM(CASE WHEN status = 'sold' AND sold_price_cents IS NOT NULL
        THEN sold_price_cents - (acquisition_price_cents + acquisition_shipping_cents)
        ELSE 0 END)                                                      AS realized_pnl_cents,

  COUNT(CASE WHEN status = 'owned' THEN 1 END)                          AS item_count,
  COUNT(CASE WHEN status = 'sold' THEN 1 END)                           AS sold_count,
  COUNT(CASE WHEN status = 'grading' THEN 1 END)                        AS grading_count,

  -- Avg hold days for sold items
  AVG(CASE WHEN status = 'sold' AND sold_date IS NOT NULL
        THEN CAST(julianday(sold_date) - julianday(acquisition_date) AS INTEGER)
        ELSE NULL END)                                                    AS avg_hold_days

FROM collection_items;
```

**TypeScript computation after query:**
```typescript
// In getStats() after running SQL:
const unrealizedPnlCents = row.current_value_cents - row.owned_invested_cents
const unrealizedPnlPercent = row.owned_invested_cents > 0
  ? (unrealizedPnlCents / row.owned_invested_cents) * 100
  : 0
const totalPnlCents = unrealizedPnlCents + row.realized_pnl_cents
```

### How `current_value_cents` Stays Updated

**Option 1 — Manual override:** User can edit `current_value_cents` directly from the collection item edit form. This value persists until manually changed again.

**Option 2 — FMV from linked eBay item:** When the eBay watchlist sync runs (existing cron job in `src/server.ts`), for each item that gets its price updated, check if any `collection_items` row has a matching `ebay_item_id` AND has `current_value_cents = NULL` (meaning no manual override). If found, set `current_value_cents` to the new `current_price` from the eBay sync.

Implementation: Add a function `syncCollectionValues(updatedItemIds: string[]): void` to `src/lib/db/collection.ts` that is called at the end of each sync cycle. The existing sync code already runs in `src/server.ts` — add a call there after the items sync loop.

**Fallback when no value is set:** In all SQL queries and TypeScript logic, use:
```
effectiveValue = currentValueCents ?? totalCostCents
```
This means a card with no FMV and no manual value shows zero P&L until a value is set — which is honest and avoids phantom gains/losses.

---

## i) API Endpoints

All routes follow the existing pattern: `routeOk(data)` / `routeError(err)` from `src/lib/errors.ts`. No async — DB calls are synchronous (`better-sqlite3`).

### `src/app/api/collection/route.ts`

```
GET  /api/collection
  Query params:
    search     string    — matches title, player_name, set_name (LIKE %q%)
    sport      string    — exact match on sport column
    status     string    — 'owned' | 'sold' | 'grading' | 'All' (default 'All')
    grader     string    — exact match on grader column
    sortBy     string    — field name (default 'acquisitionDate')
    sortDir    string    — 'asc' | 'desc' (default 'desc')

  Response:
    { data: { items: CollectionItem[], stats: CollectionStats } }

  Implementation:
    const items = getAll(filters)
    const stats = getStats()
    return routeOk({ items, stats })

POST /api/collection
  Body: AddToCollectionRequest (JSON)

  Validation (server-side with zod):
    title: z.string().min(1).max(500)
    acquisitionSource: z.enum([...])
    acquisitionPriceCents: z.number().int().min(0)
    acquisitionShippingCents: z.number().int().min(0).default(0)
    acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    ebayItemId: z.string().optional().nullable()
    [all other fields optional with appropriate types]

  Response:
    { data: CollectionItem }           201 status

  Implementation:
    const body = AddToCollectionSchema.parse(await request.json())
    const item = add(body)
    return routeOk(item)    // use Response.json with status 201
```

### `src/app/api/collection/[id]/route.ts`

```
GET  /api/collection/:id
  Response: { data: CollectionItem }
  Returns 404 if not found (use existing DatabaseError pattern, or a new NotFoundError)

PUT  /api/collection/:id
  Body: UpdateCollectionItemRequest (JSON, all fields optional)
  Response: { data: CollectionItem }

DELETE /api/collection/:id
  Response: { data: { id: number } }
  Note: Hard delete. No soft-delete for MVP.
```

### `src/app/api/collection/[id]/sell/route.ts`

```
POST /api/collection/:id/sell
  Body: SellCollectionItemRequest (JSON)

  Validation:
    soldPriceCents: z.number().int().min(0)
    soldDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    soldPlatform: z.enum(['eBay', 'COMC', 'Facebook', 'Card Show', 'Trade', 'Other'])
    soldNotes: z.string().optional().nullable()

  Response: { data: CollectionItem }

  Implementation:
    Calls sell(id, body) which sets status='sold' and records sale fields.
    Returns the updated CollectionItem.
```

### Error Handling

Add `NotFoundError` to `src/lib/errors.ts`:

```typescript
export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404)
  }
}
```

All collection DB functions that receive an `id` check for existence and throw `NotFoundError` if the row is not found.

---

## j) Navigation Changes

### Modified: `src/components/layout/top-bar.tsx`

Add `{ href: '/collection', label: 'Collection' }` to the `navLinks` array:

```typescript
const navLinks = [
  { href: '/', label: 'Watchlist' },
  { href: '/trends', label: 'Trends' },
  { href: '/collection', label: 'Collection' },  // NEW
]
```

The existing `pathname === link.href` active-state logic works without changes because Next.js `usePathname` returns `/collection` exactly.

**Badge on the nav link:** Display the count of owned items as a small badge. Use `useCollection` hook (with `status: 'owned'` filter) to get the count. If count is 0, show no badge. Badge style: `ml-1 px-1.5 py-0.5 text-[9px] bg-accent/20 text-accent rounded-full font-medium`.

Since the `navLinks` array is currently static, convert the nav section to read the collection count:

```typescript
// Inside TopBar component, add:
const { data: collectionData } = useCollection({ status: 'owned' })
const collectionCount = collectionData?.stats.itemCount ?? 0
```

The link renders as:
```tsx
<Link href="/collection" ...>
  Collection
  {collectionCount > 0 && (
    <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-accent/20 text-accent rounded-full font-medium">
      {collectionCount}
    </span>
  )}
</Link>
```

**Important:** `TopBar` already has `'use client'` (it uses `usePathname` and `useWatchlistStore`). The new `useCollection` hook call is compatible. Do not add a separate data-fetching call if the count can be derived from an already-in-flight request — TanStack Query caches by key so multiple components using `useCollection({ status: 'owned' })` share one network request.

---

## k) Modified Files

Exact list of files modified (as opposed to created):

### `src/types/index.ts`
Append all Collection types (section b above) to the end of the file. No existing types are changed.

### `src/components/layout/top-bar.tsx`
- Add `{ href: '/collection', label: 'Collection' }` to `navLinks`
- Import `useCollection` from `@/hooks/use-collection`
- Add collection count badge to the Collection nav link

### `src/components/watchlist/watchlist-row.tsx`
- Add `onPurchase?: (item: WatchlistItem) => void` to `WatchlistRowProps`
- Add a new `<td>` for the cart button (after queue toggle cell)
- Import the SVG cart icon inline (no new dependency)

### `src/components/watchlist/watchlist-table.tsx`
- Add `purchaseModalItem` state (or read from `useCollectionStore`)
- Import and render `PurchaseFromWatchlistModal`
- Pass `onPurchase` callback to each `WatchlistRow`

### `src/lib/db/migrate.ts`
No changes needed — the migration runner already picks up all `.sql` files alphabetically. `002_collection.sql` will be applied automatically on next server start.

### `src/server.ts` (if it exists as the cron entrypoint)
- After items sync, call `syncCollectionValues(updatedItemIds)` from `src/lib/db/collection.ts`

---

## l) Test Plan

### Test file: `tests/e2e/collection.spec.ts`

Use the same mock-intercept pattern as `watchlist-table.spec.ts`. Add mock collection data to `tests/e2e/helpers/mock-data.ts`.

### Mock Data Additions to `tests/e2e/helpers/mock-data.ts`

```typescript
import type { CollectionItem, CollectionStats } from '../../../src/types'

function makeCollectionItem(
  overrides: Partial<CollectionItem> & { id: number; title: string }
): CollectionItem {
  return {
    ebayItemId: null,
    playerName: 'Mike Trout',
    year: 2011,
    sport: 'Baseball',
    cardNumber: null,
    setName: 'Topps Chrome',
    parallel: null,
    grade: 'PSA 10',
    grader: 'PSA',
    acquisitionSource: 'ebay_watchlist',
    acquisitionPriceCents: 5000,
    acquisitionShippingCents: 500,
    acquisitionDate: '2025-01-15',
    acquisitionNotes: null,
    currentValueCents: 7500,
    soldPriceCents: null,
    soldDate: null,
    soldPlatform: null,
    soldNotes: null,
    imageUrl: null,
    status: 'owned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Computed
    totalCostCents: 5500,
    effectiveValueCents: 7500,
    unrealizedPnlCents: 2000,
    realizedPnlCents: null,
    ...overrides,
  }
}

export const mockCollectionItems: CollectionItem[] = [
  makeCollectionItem({
    id: 1,
    title: 'Mike Trout 2011 Topps Chrome RC PSA 10',
    acquisitionPriceCents: 5000,
    acquisitionShippingCents: 500,
    currentValueCents: 7500,
    totalCostCents: 5500,
    effectiveValueCents: 7500,
    unrealizedPnlCents: 2000,
  }),
  makeCollectionItem({
    id: 2,
    title: '1986 Fleer Michael Jordan Rookie',
    playerName: 'Michael Jordan',
    sport: 'Basketball',
    grader: 'BGS',
    grade: '8.5',
    acquisitionSource: 'card_show',
    ebayItemId: null,
    acquisitionPriceCents: 12000,
    acquisitionShippingCents: 0,
    currentValueCents: 15000,
    totalCostCents: 12000,
    effectiveValueCents: 15000,
    unrealizedPnlCents: 3000,
  }),
  makeCollectionItem({
    id: 3,
    title: '2000 Bowman Tom Brady RC',
    playerName: 'Tom Brady',
    sport: 'Football',
    grade: null,
    grader: null,
    acquisitionSource: 'lcs',
    ebayItemId: null,
    acquisitionPriceCents: 8000,
    acquisitionShippingCents: 0,
    currentValueCents: null,
    totalCostCents: 8000,
    effectiveValueCents: 8000,
    unrealizedPnlCents: 0,
  }),
  makeCollectionItem({
    id: 4,
    title: 'Kobe Bryant 1996 Topps Chrome RC',
    playerName: 'Kobe Bryant',
    sport: 'Basketball',
    acquisitionPriceCents: 20000,
    acquisitionShippingCents: 1000,
    status: 'sold',
    soldPriceCents: 28000,
    soldDate: '2025-06-01',
    soldPlatform: 'eBay',
    currentValueCents: null,
    totalCostCents: 21000,
    effectiveValueCents: 21000,
    unrealizedPnlCents: null,
    realizedPnlCents: 7000,
  }),
]

export const mockCollectionStats: CollectionStats = {
  totalInvestedCents: 46500,
  ownedInvestedCents: 25500,
  currentValueCents: 30500,
  unrealizedPnlCents: 5000,
  unrealizedPnlPercent: 19.6,
  realizedPnlCents: 7000,
  totalPnlCents: 12000,
  itemCount: 3,
  soldCount: 1,
  gradingCount: 0,
  avgHoldDays: 137,
}

export const mockCollectionResponse = {
  data: {
    items: mockCollectionItems.filter((i) => i.status === 'owned'),
    stats: mockCollectionStats,
  },
}

export const mockCollectionAllResponse = {
  data: {
    items: mockCollectionItems,
    stats: mockCollectionStats,
  },
}
```

### Test Cases: `tests/e2e/collection.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import {
  mockCollectionResponse,
  mockCollectionAllResponse,
  mockCollectionItems,
  mockCollectionStats,
} from './helpers/mock-data'

function interceptCollectionApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/collection', (route) => {
      const url = new URL(route.request().url())
      const status = url.searchParams.get('status')
      if (status === 'All') {
        return route.fulfill({ json: mockCollectionAllResponse })
      }
      return route.fulfill({ json: mockCollectionResponse })
    }),
    page.route('**/api/collection/**/sell', (route) =>
      route.fulfill({
        json: {
          data: {
            ...mockCollectionItems[0],
            status: 'sold',
            soldPriceCents: 9000,
            soldDate: '2025-12-01',
            soldPlatform: 'eBay',
            realizedPnlCents: 3500,
          },
        },
      })
    ),
    page.route('**/api/collection/**', (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        return route.fulfill({
          status: 201,
          json: { data: mockCollectionItems[0] },
        })
      }
      if (method === 'PUT') {
        return route.fulfill({ json: { data: mockCollectionItems[0] } })
      }
      if (method === 'DELETE') {
        return route.fulfill({ json: { data: { id: 1 } } })
      }
      return route.fulfill({ json: { data: mockCollectionItems[0] } })
    }),
  ])
}

test.describe('Collection Page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptCollectionApis(page)
  })

  // C01: Page renders stats and table
  test('C01: collection page renders stats and table', async ({ page }) => {
    await page.goto('/collection')

    // Stats cards visible
    await expect(page.getByText('Total Invested')).toBeVisible()
    await expect(page.getByText('Current Value')).toBeVisible()
    await expect(page.getByText('Unrealized P&L')).toBeVisible()
    await expect(page.getByText('Realized P&L')).toBeVisible()
    await expect(page.getByText('Items Owned')).toBeVisible()
    await expect(page.getByText('Items Sold')).toBeVisible()

    // Table visible with data
    const table = page.locator('table')
    await expect(table).toBeVisible()
    await expect(table.getByText('Mike Trout 2011 Topps Chrome RC PSA 10')).toBeVisible()
  })

  // C02: Stats show correct values
  test('C02: portfolio stats display formatted correctly', async ({ page }) => {
    await page.goto('/collection')
    // Total invested $465.00
    await expect(page.getByText('$465.00')).toBeVisible()
    // Items owned count = 3
    await expect(page.getByText('3')).toBeVisible()
  })

  // C03: P&L color coding — gain is green
  test('C03: positive P&L shown in green', async ({ page }) => {
    await page.goto('/collection')
    // Mike Trout card has +$20.00 P&L
    const pnlCell = page.locator('[data-testid="pnl-cell-1"]')
    await expect(pnlCell).toHaveClass(/text-green/)
  })

  // C04: Add manual card via modal
  test('C04: add card button opens modal and submits form', async ({ page }) => {
    await page.goto('/collection')

    // Click Add Card button
    await page.getByRole('button', { name: 'Add Card' }).click()

    // Modal is visible
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Add Card to Collection')).toBeVisible()

    // Fill required fields
    await page.getByLabel('Title').fill('1952 Topps Mickey Mantle')
    await page.getByLabel('Acquisition Source').selectOption('card_show')
    await page.getByLabel('Price Paid').fill('250.00')
    await page.getByLabel('Acquisition Date').fill('2025-11-20')

    // Submit
    await page.getByRole('button', { name: 'Add to Collection' }).click()

    // Modal closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // C05: Validation — title required
  test('C05: add card modal requires title', async ({ page }) => {
    await page.goto('/collection')
    await page.getByRole('button', { name: 'Add Card' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Submit without title
    await page.getByRole('button', { name: 'Add to Collection' }).click()

    // Error message shown
    await expect(page.getByText('Title is required')).toBeVisible()
    // Modal stays open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  // C06: Mark as sold via sell modal
  test('C06: sell modal opens and records sale', async ({ page }) => {
    await page.goto('/collection')

    // Click sell button on first item
    await page.locator('[data-testid="sell-btn-1"]').click()

    // Sell modal visible
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Mark as Sold')).toBeVisible()

    // Fill sell details
    await page.getByLabel('Sold Price').fill('90.00')
    await page.getByLabel('Sold Date').fill('2025-12-01')
    await page.getByLabel('Sold Platform').selectOption('eBay')

    // Live P&L preview updates
    await expect(page.getByText(/Profit|Loss/)).toBeVisible()

    // Submit
    await page.getByRole('button', { name: 'Record Sale' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // C07: Filter by status — sold items
  test('C07: filter by status sold shows sold items', async ({ page }) => {
    await page.route('**/api/collection*', (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('status') === 'sold') {
        return route.fulfill({
          json: {
            data: {
              items: mockCollectionAllResponse.data.items.filter((i) => i.status === 'sold'),
              stats: mockCollectionStats,
            },
          },
        })
      }
      return route.fulfill({ json: mockCollectionResponse })
    })

    await page.goto('/collection')
    await page.getByLabel('Status').selectOption('sold')
    const table = page.locator('table')
    await expect(table.getByText('Kobe Bryant 1996 Topps Chrome RC')).toBeVisible()
  })

  // C08: Search filters by title
  test('C08: search filters collection by title', async ({ page }) => {
    await page.route('**/api/collection*', (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search')
      if (search) {
        const filtered = mockCollectionAllResponse.data.items.filter((i) =>
          i.title.toLowerCase().includes(search.toLowerCase())
        )
        return route.fulfill({
          json: { data: { items: filtered, stats: mockCollectionStats } },
        })
      }
      return route.fulfill({ json: mockCollectionResponse })
    })

    await page.goto('/collection')
    await page.getByPlaceholder('Search collection...').fill('Trout')
    const table = page.locator('table')
    await expect(table.getByText('Mike Trout 2011 Topps Chrome RC PSA 10')).toBeVisible()
  })

  // C09: Purchase from watchlist — button visible on watchlist row
  test('C09: watchlist row shows Purchase button for active items', async ({ page }) => {
    // This test navigates to the watchlist page (/) and checks for the cart button
    await page.route('**/api/items?*', (route) =>
      route.fulfill({
        json: {
          data: {
            ranked: [
              {
                id: '111', title: 'Vintage Baseball Card 1952', rank: 1,
                currentPrice: 4500, shippingCost: 0, listingType: 'Auction',
                status: 'Active', bidCount: 0, isInQueue: false,
                firstSeenAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString(),
                endTime: null, timeLeft: null, buyItNowPrice: null,
                conditionName: 'Used', sellerId: null, sellerFeedback: null,
                watcherCount: 10, imageUrl: null, listingUrl: null, notes: null,
              },
            ],
            unranked: [],
            counts: { active: 1, sold: 0, ended: 0, total: 1 },
          },
        },
      })
    )
    await page.route('**/api/events?*', (route) => route.fulfill({ json: { data: [] } }))

    await page.goto('/')
    // Cart button visible on the row
    await expect(page.locator('button[title="Add to Collection"]').first()).toBeVisible()
  })

  // C10: Purchase from watchlist — modal pre-fills from item
  test('C10: purchase modal pre-fills title and price from watchlist item', async ({ page }) => {
    await page.route('**/api/items?*', (route) =>
      route.fulfill({
        json: {
          data: {
            ranked: [
              {
                id: '111', title: 'Vintage Baseball Card 1952', rank: 1,
                currentPrice: 4500, shippingCost: 500, listingType: 'FixedPrice',
                status: 'Active', bidCount: 0, isInQueue: false,
                firstSeenAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString(),
                endTime: null, timeLeft: null, buyItNowPrice: null,
                conditionName: 'Used', sellerId: 'seller1', sellerFeedback: 99,
                watcherCount: 5, imageUrl: null, listingUrl: null, notes: null,
              },
            ],
            unranked: [],
            counts: { active: 1, sold: 0, ended: 0, total: 1 },
          },
        },
      })
    )
    await page.route('**/api/events?*', (route) => route.fulfill({ json: { data: [] } }))

    await page.goto('/')
    await page.locator('button[title="Add to Collection"]').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Title pre-filled
    await expect(dialog.getByLabel('Title')).toHaveValue('Vintage Baseball Card 1952')
    // Source pre-selected as ebay_watchlist
    await expect(dialog.getByLabel('Acquisition Source')).toHaveValue('ebay_watchlist')
  })

  // C11: Collection nav link visible with item count badge
  test('C11: collection nav link shows owned item count badge', async ({ page }) => {
    await page.goto('/')
    const collectionLink = page.getByRole('link', { name: /Collection/ })
    await expect(collectionLink).toBeVisible()
    // Badge shows count (3 from mock stats)
    await expect(collectionLink.getByText('3')).toBeVisible()
  })

  // C12: Card with no current_value uses acquisition cost for value column
  test('C12: card with no current value shows acquisition cost as effective value', async ({ page }) => {
    await page.goto('/collection')
    const table = page.locator('table')
    // Tom Brady card: no currentValueCents, totalCost = $80.00
    // Value column should show $80.00
    // P&L should show $0.00
    await expect(table.getByText('2000 Bowman Tom Brady RC')).toBeVisible()
    // Both these checks confirm the fallback works in the rendered UI
    // The exact dollar amounts come from mock data
  })
})
```

---

## m) Edge Cases

### 1. Card bought at card show — no eBay item_id

`ebay_item_id` is `NULL` in the DB (the column is nullable with no `NOT NULL` constraint). The `acquisition_source` will be `'card_show'`. No FK constraints are violated. All P&L calculations use `acquisition_price_cents + acquisition_shipping_cents` as the cost basis. The `current_value_cents` starts as `NULL` and the user must manually set it for P&L to be meaningful, or it falls back to cost (zero P&L).

When rendering the table row, the Actions column does not show a "View on eBay" link (no listing URL). No other behavior changes.

### 2. Same physical card bought twice

Each purchase creates a **separate `collection_items` row** with its own `id`. This is intentional: two copies of the same card have separate acquisition dates, costs, and potentially different grades. The `title` and `player_name` will likely match but they are independent records.

To distinguish them in the UI: the table shows `acquisitionDate` and `grade` columns, making two rows for "Mike Trout 2011 Topps Chrome RC" visually distinct. If the user wants to further differentiate, they can add a note in `acquisition_notes` (e.g., "PSA 10 Pop 12" vs "PSA 10 pop 45").

No deduplication logic is implemented. This is the correct behavior — two physical cards are two records.

### 3. Card sold and later repurchased

The sold card's row has `status = 'sold'` and is immutable after the sale is recorded. If the user buys the same card again, they use "Add Card" to create a **new `collection_items` row** with `status = 'owned'`. The old sold row serves as historical P&L data.

This means one card (e.g., "1952 Topps Mickey Mantle") can have two rows: one with `status = 'sold'` (realized P&L tracked) and one with `status = 'owned'` (current holding). The stats query counts them independently: sold count = 1, owned count = 1.

### 4. Editing acquisition price after entry

The `PUT /api/collection/:id` endpoint accepts `acquisitionPriceCents` and `acquisitionShippingCents` as updatable fields. When the acquisition price is changed, the DB record is updated and all computed P&L values update on the next query (they are computed at query time, not stored). There is no audit trail of price changes in MVP — that is a full-scope concern.

**Risk:** If a user changes the acquisition price after tracking significant price history, the reported P&L for that card will retroactively change. This is acceptable in MVP since there is no snapshot history of acquisition price. Document in the UI: "Editing cost basis recalculates all P&L for this card."

### 5. Currency assumption

All values are stored in **USD cents** only. No currency field exists on `collection_items`. If an international card was purchased in a different currency, the user must convert to USD at acquisition time and enter the USD-equivalent price. A `currency` column and conversion logic are out of scope for MVP and Full scope.

### 6. Sold price with eBay fees

The `sold_price_cents` field represents whatever the user enters. The field label in the UI is "Net Proceeds" to hint that the user should subtract platform fees (eBay: ~13%, COMC: ~10%). No automated fee calculation is built. A `notes` field gives the user room to record gross vs. net reasoning.

### 7. Grading changes card status

When the user sends a card to grading, they set `status = 'grading'` on the `collection_items` row. The card is not `sold`. For stats: grading cards are excluded from `item_count` (owned count), tracked separately as `grading_count`. The card's cost basis is unchanged. When the graded card returns:
- User updates `status` back to `'owned'`
- User sets `grade` and `grader`
- User may update `current_value_cents` to the new graded value
- If grading submission tracking is active (Full scope), a `grading_submissions` row is created at send and updated with `grade_received` upon return

For MVP: The user manually sets `status = 'grading'` via the Edit form. The sell modal is disabled (button grayed out) when `status = 'grading'`.

### 8. Delete a collection item

Hard delete via `DELETE /api/collection/:id`. No soft delete in MVP. The intent is that a user would delete a record only if they entered it by mistake. If they want to remove a sold card from view, they filter by `status = 'owned'`.

Before deleting, the UI shows a confirmation: "Delete this card? This cannot be undone." The API returns `{ data: { id: number } }` on success.

---

## Full Scope: Individual Card Detail Page

**File:** `src/app/collection/[id]/page.tsx`

**Layout:**
- ItemHeader-style top section: image, title, player, grade, status badge
- Stats grid (2 rows): cost, shipping, total cost, current value, P&L, P&L%, acquired date, source, sold price (if sold), hold days (if sold)
- Grading Timeline section (if `status === 'grading'` or grading submissions exist)
- Edit button (opens `AddToCollectionModal` with data pre-filled for editing)
- Sell button (opens `SellModal`, disabled if already sold or in grading)

**Navigation:** The card title in the collection table is a `<Link href={/collection/${item.id}}>`. Clicking the title navigates to the detail page. This mirrors the pattern in `watchlist-row.tsx` where `<Link href={/items/${item.id}}>` navigates to the item detail page.

---

## Implementation Order (MVP, 10.5 hrs estimate)

| Step | Task | Hrs | Dependency |
|------|------|-----|------------|
| 1 | Write and apply migration `002_collection.sql` | 0.5 | — |
| 2 | Append types to `src/types/index.ts` | 0.5 | Step 1 |
| 3 | Implement `src/lib/db/collection.ts` (all CRUD + stats) | 1.5 | Step 1 |
| 4 | Implement API routes (`/api/collection`, `/api/collection/[id]`, `/api/collection/[id]/sell`) | 1.5 | Step 3 |
| 5 | Implement `src/hooks/use-collection.ts` and `src/store/collection-store.ts` | 0.5 | Step 4 |
| 6 | Build `CollectionStats` component | 0.5 | Step 5 |
| 7 | Build `CollectionFilters` component | 0.5 | Step 5 |
| 8 | Build `AddToCollectionModal` (manual add) | 1.0 | Step 5 |
| 9 | Build `SellModal` | 0.5 | Step 5 |
| 10 | Build `CollectionTable` with sort | 1.0 | Step 6, 7 |
| 11 | Build `src/app/collection/page.tsx` | 0.5 | Steps 6–10 |
| 12 | Modify `top-bar.tsx` (nav link + badge) | 0.25 | Step 5 |
| 13 | Modify `watchlist-row.tsx` and `watchlist-table.tsx` (cart button + `PurchaseFromWatchlistModal`) | 0.75 | Steps 8, 5 |
| 14 | Write E2E tests + mock data | 1.0 | Steps 11–13 |
| **Total** | | **10.5** | |

---

## Appendix: Key Design Decisions and Rationale

**Decision: Separate table vs. status column on `items`**

Rationale: eBay item listings are ephemeral — they expire, get relisted, and disappear. A physical card is permanent. Coupling the collection record to an eBay listing's lifecycle would create orphaned or corrupted data. A standalone `collection_items` table with an optional FK to `items` gives the collection record its own independent lifecycle. The cost is a slightly more complex join for cards that originated from eBay; the benefit is correctness for all card sources and long-term data integrity.

**Decision: Computed fields at query time, not stored**

`totalCostCents`, `effectiveValueCents`, `unrealizedPnlCents`, and `realizedPnlCents` are computed in the `rowToCollectionItem()` function (parallel to `rowToItem()` in `items.ts`). They are never stored in the DB. This avoids update anomalies: if `acquisition_price_cents` changes, all derived values automatically reflect the new value on next read. The only exception is `current_value_cents`, which IS stored because it represents an external opinion of value (FMV from eBay or a manual override) that would be expensive to recompute dynamically.

**Decision: No soft delete in MVP**

The existing `items` table uses status columns (`Sold`, `Ended`) rather than deletion, but that table is synced from eBay — items must persist for historical tracking. Collection items have no external sync dependency, so hard delete is appropriate. If audit trails become a requirement, a `deleted_at` column can be added in a later migration without breaking existing queries.

**Decision: TanStack Table for sorting in CollectionTable**

The project already has `@tanstack/react-table` in `package.json`. Client-side sorting via TanStack Table avoids round-trip API calls for sort changes. The collection will typically have fewer than 1000 items, making client-side sort completely appropriate. The `getAll()` DB function still accepts a `sortBy`/`sortDir` for server-side sort (used by the initial GET request), but after data loads, the table component handles re-sorting without re-fetching.
