# Design: E6 — Price Target Alerts

**Feature**: Per-item buy/sell price targets evaluated during sync with activity feed notifications
**Effort**: 5 hours core + 4 hours Web Push + 3 hours email (Resend)
**Status**: Ready for implementation
**Author**: Backend Architect
**Date**: 2026-02-21

---

## 1. Overview and Motivation

Users currently watch price movement through the activity feed (price_drop, price_increase events) but have no way to say "alert me when this item drops below $45." That requires manually checking the dashboard on every sync, which defeats the purpose of a monitor.

Price Target Alerts close this loop. A user sets a buy-below or sell-above threshold for any item. Every sync cycle evaluates open targets against the fresh price. When a threshold is crossed the system records a `target_triggered` event (visible immediately in the existing activity feed) and transitions the target to a `triggered` state. The user acknowledges the notification from the UI, which moves the target to `acknowledged` and stops it from re-firing on subsequent syncs.

**Why this feature matters architecturally:** The notification plumbing built here — event creation, target state machine, acknowledgement endpoint — is the exact same infrastructure needed by E3 (Saved Search alerts) and B3 (Prospect Pipeline stage change alerts). Those features will import and extend the patterns introduced here rather than invent their own.

---

## 2. State Machine

```
                 ┌─────────────────────────────────────────┐
                 │              price_targets               │
                 │                                         │
                 │  active ──[price crosses]──> triggered  │
                 │                                  │      │
                 │                         [user acks]     │
                 │                                  │      │
                 │                            acknowledged  │
                 └─────────────────────────────────────────┘
```

- **active**: Evaluated on every sync cycle against the item's current price.
- **triggered**: Price crossed the threshold on at least one sync. A `target_triggered` event was inserted. Not re-evaluated; waiting for user acknowledgement.
- **acknowledged**: User dismissed the alert. Never re-evaluated. Terminal state.

A target can also be explicitly deleted by the user at any point.

---

## 3. Database Migration

**File**: `src/lib/db/migrations/002_price_targets.sql`

```sql
CREATE TABLE price_targets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id               TEXT NOT NULL REFERENCES items(item_id),
  target_type           TEXT NOT NULL CHECK (target_type IN ('buy_below', 'sell_above')),
  target_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'triggered', 'acknowledged')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  triggered_at          TEXT,
  triggered_price_cents INTEGER,
  acknowledged_at       TEXT
);

CREATE INDEX idx_targets_item   ON price_targets(item_id);
CREATE INDEX idx_targets_status ON price_targets(status);
```

### Field notes

- `target_cents` is stored in USD cents (integer), consistent with `items.current_price` and all price columns in the schema.
- `triggered_at` and `triggered_price_cents` are NULL until the target fires. They record the first sync cycle that crossed the threshold — useful for display ("triggered at $42.00 on Feb 21").
- `acknowledged_at` is NULL until the user dismisses the alert.
- The CHECK constraints on `target_type` and `status` enforce the domain at the database layer, not just the application layer.
- The FK to `items(item_id)` is deliberately kept without ON DELETE CASCADE. If an item is marked Sold or Ended the targets remain in the database as a historical record. The sync integration skips evaluation for non-Active items, so stale targets cause no harm.

### Why a separate migration file

The migration runner in `src/lib/db/migrate.ts` reads all `.sql` files from the `migrations/` directory sorted lexicographically and applies unapplied ones inside a transaction. Dropping `002_price_targets.sql` there is all that is needed to deploy the schema — no code changes to `migrate.ts` required.

---

## 4. TypeScript Types

**Additions to `src/types/index.ts`**:

```typescript
// --- Price Target domain types ---

export type TargetType   = 'buy_below' | 'sell_above'
export type TargetStatus = 'active' | 'triggered' | 'acknowledged'

export interface PriceTarget {
  id:                   number
  itemId:               string
  targetType:           TargetType
  targetCents:          number
  status:               TargetStatus
  createdAt:            string        // ISO 8601
  triggeredAt:          string | null // ISO 8601, set when first triggered
  triggeredPriceCents:  number | null // price at moment of trigger
  acknowledgedAt:       string | null // ISO 8601, set when acknowledged
}

// Request body for POST /api/targets
export interface CreateTargetInput {
  itemId:      string
  targetType:  TargetType
  targetCents: number
}

// Request body for PATCH /api/targets/[targetId]
export interface UpdateTargetInput {
  action: 'acknowledge' | 'deactivate'
}

// Repository interface (contract for the data layer)
export interface TargetsRepo {
  getAll(filters?: { itemId?: string; status?: TargetStatus }): PriceTarget[]
  getById(id: number): PriceTarget | null
  getActiveForItem(itemId: string): PriceTarget[]
  create(input: CreateTargetInput): PriceTarget
  triggerTarget(id: number, triggeredPriceCents: number): void
  acknowledge(id: number): void
  deactivate(id: number): void
  remove(id: number): void
}
```

**Updated `EventType` union** (adds `target_triggered` to the existing union):

```typescript
export type EventType =
  | 'sold'
  | 'expired'
  | 'price_drop'
  | 'price_increase'
  | 'watcher_spike'
  | 'target_triggered'  // new
```

The `activity-feed.tsx` component uses `eventIcons` and `eventLabels` records keyed by `EventType`. Both must be extended with the new value (see Section 8).

---

## 5. Repository: `src/lib/db/targets.ts`

This file follows the same synchronous better-sqlite3 pattern as `items.ts`, `trends.ts`, and `events.ts`.

```typescript
import type { PriceTarget, TargetType, TargetStatus, CreateTargetInput, TargetsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

function rowToTarget(row: any): PriceTarget {
  return {
    id:                  row.id,
    itemId:              row.item_id,
    targetType:          row.target_type as TargetType,
    targetCents:         row.target_cents,
    status:              row.status as TargetStatus,
    createdAt:           row.created_at,
    triggeredAt:         row.triggered_at ?? null,
    triggeredPriceCents: row.triggered_price_cents ?? null,
    acknowledgedAt:      row.acknowledged_at ?? null,
  }
}

export function getAll(filters?: { itemId?: string; status?: TargetStatus }): PriceTarget[] {
  const db = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.itemId) {
    conditions.push('item_id = ?')
    params.push(filters.itemId)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  try {
    const rows = db.prepare(`SELECT * FROM price_targets ${where} ORDER BY created_at DESC`).all(...params)
    return (rows as any[]).map(rowToTarget)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get targets: ${err.message}`)
  }
}

export function getById(id: number): PriceTarget | null {
  const db = getDb()
  try {
    const row = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(id)
    return row ? rowToTarget(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get target ${id}: ${err.message}`)
  }
}

export function getActiveForItem(itemId: string): PriceTarget[] {
  const db = getDb()
  try {
    const rows = db.prepare(
      `SELECT * FROM price_targets WHERE item_id = ? AND status = 'active'`
    ).all(itemId)
    return (rows as any[]).map(rowToTarget)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get active targets for item ${itemId}: ${err.message}`)
  }
}

export function create(input: CreateTargetInput): PriceTarget {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO price_targets (item_id, target_type, target_cents)
      VALUES (?, ?, ?)
    `).run(input.itemId, input.targetType, input.targetCents)

    const row = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(result.lastInsertRowid)
    return rowToTarget(row)
  } catch (err: any) {
    throw new DatabaseError(`Failed to create target: ${err.message}`)
  }
}

export function triggerTarget(id: number, triggeredPriceCents: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE price_targets
      SET status = 'triggered',
          triggered_at = datetime('now'),
          triggered_price_cents = ?
      WHERE id = ? AND status = 'active'
    `).run(triggeredPriceCents, id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to trigger target ${id}: ${err.message}`)
  }
}

export function acknowledge(id: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE price_targets
      SET status = 'acknowledged',
          acknowledged_at = datetime('now')
      WHERE id = ? AND status = 'triggered'
    `).run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to acknowledge target ${id}: ${err.message}`)
  }
}

export function deactivate(id: number): void {
  const db = getDb()
  try {
    // Can deactivate from any non-acknowledged state
    db.prepare(`
      UPDATE price_targets SET status = 'acknowledged', acknowledged_at = datetime('now')
      WHERE id = ? AND status != 'acknowledged'
    `).run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to deactivate target ${id}: ${err.message}`)
  }
}

export function remove(id: number): void {
  const db = getDb()
  try {
    db.prepare('DELETE FROM price_targets WHERE id = ?').run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to delete target ${id}: ${err.message}`)
  }
}

export const targetsRepo: TargetsRepo = {
  getAll,
  getById,
  getActiveForItem,
  create,
  triggerTarget,
  acknowledge,
  deactivate,
  remove,
}
```

### Design notes

- `triggerTarget` uses `WHERE status = 'active'` so a race condition during two simultaneous syncs (unlikely given the `syncing` flag in `sync-service.ts`, but possible in tests) cannot double-trigger a target.
- `deactivate` moves a target to `acknowledged` with an `acknowledged_at` timestamp. This reuses the terminal state rather than introducing a fourth state. The distinction between "acknowledged by user" and "deactivated by user" is a UX concept, not a data concept — both mean "stop evaluating".
- `create` immediately re-reads the inserted row via `lastInsertRowid` to return a fully populated `PriceTarget` including the DB-generated timestamps.

---

## 6. Sync Integration

### `src/lib/sync/target-evaluator.ts` (new file)

This module is responsible for the evaluation logic. It is isolated from `sync-service.ts` for the same reason `event-detector.ts` is isolated: testability and single responsibility.

```typescript
import { getActiveForItem, triggerTarget } from '../db/targets'
import { insert as insertEvent } from '../db/events'
import type { PriceTarget } from '../../types'

/**
 * Evaluate all active price targets for a single item against its current price.
 * Called once per item per sync cycle, after the item has been upserted.
 *
 * Targets are evaluated independently: multiple targets on the same item
 * can all trigger in the same sync cycle if the price crosses all thresholds.
 *
 * @param itemId          eBay item ID
 * @param currentPriceCents  Fresh price from the API, in USD cents
 */
export function evaluateTargets(itemId: string, currentPriceCents: number): void {
  const targets = getActiveForItem(itemId)
  if (targets.length === 0) return

  for (const target of targets) {
    if (shouldTrigger(target, currentPriceCents)) {
      triggerTarget(target.id, currentPriceCents)
      insertEvent({
        itemId,
        eventType: 'target_triggered',
        oldValue: String(target.targetCents),   // threshold
        newValue: String(currentPriceCents),     // actual price at trigger
      })
    }
  }
}

function shouldTrigger(target: PriceTarget, currentPriceCents: number): boolean {
  if (target.targetType === 'buy_below') {
    return currentPriceCents <= target.targetCents
  }
  if (target.targetType === 'sell_above') {
    return currentPriceCents >= target.targetCents
  }
  return false
}
```

**Trigger conditions:**
- `buy_below`: fires when `currentPriceCents <= target_cents`. At-target counts as triggered (user set "buy at $45 or less" — $45 qualifies).
- `sell_above`: fires when `currentPriceCents >= target_cents`. At-target counts as triggered by the same logic.

**Event payload convention:** `oldValue` carries the threshold (what the user set), `newValue` carries the actual price at the moment of trigger. This mirrors how `detectPriceChange` in `event-detector.ts` uses `oldValue`/`newValue` to store before/after prices, and lets `activity-feed.tsx` display "Target $45.00 — hit at $42.50" without joining back to `price_targets`.

### Changes to `src/lib/sync/sync-service.ts`

Add one import and one call per item in the existing step 3 loop. No structural changes.

```typescript
// Add to imports at top of file
import { evaluateTargets } from './target-evaluator'

// Inside the for (const apiItem of apiItems) loop,
// after insertSnapshot (the last operation currently in the loop):
evaluateTargets(apiItem.id, apiItem.currentPrice)
```

The full modified loop section:

```typescript
for (const apiItem of apiItems) {
  const existing = dbItemMap.get(apiItem.id)

  if (!existing) {
    upsert(apiItem)
    added++
  } else {
    upsert(apiItem)
    updated++

    if (existing.currentPrice !== apiItem.currentPrice) {
      detectPriceChange(existing.currentPrice, apiItem.currentPrice, apiItem.id)
    }

    if (existing.watcherCount != null && apiItem.watcherCount != null) {
      detectWatcherSpike(existing.watcherCount, apiItem.watcherCount, apiItem.id)
    }
  }

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
```

**Performance consideration:** `getActiveForItem` issues one SELECT per item in the sync loop. For a typical eBay watchlist of 20-50 items that is 20-50 synchronous SQLite reads — negligible given the dominant cost is the eBay API HTTP calls preceding this loop. If the watchlist grows very large (500+ items), a single batch query fetching all active targets at the start of sync and grouping by item_id in memory would be the right optimization, but it is not needed now.

---

## 7. API Endpoints

All routes follow the existing pattern: Next.js App Router, `routeOk` / `routeError` envelope, `AppError` for 4xx.

### `GET /api/targets`

**File**: `src/app/api/targets/route.ts`

Query parameters:
- `itemId` (optional) — filter to a specific item
- `status` (optional, default all) — `active` | `triggered` | `acknowledged`

```typescript
import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll } from '@/lib/db/targets'
import type { TargetStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const itemId = params.get('itemId') ?? undefined
    const status  = params.get('status')  as TargetStatus | null ?? undefined

    const targets = getAll({ itemId, status })
    return routeOk(targets)
  } catch (err) {
    return routeError(err)
  }
}
```

### `POST /api/targets`

**File**: `src/app/api/targets/route.ts` (same file, additional export)

Request body: `{ itemId: string; targetType: 'buy_below' | 'sell_above'; targetCents: number }`

Validation rules:
- `itemId` must be a non-empty string
- `targetType` must be exactly `'buy_below'` or `'sell_above'`
- `targetCents` must be a positive integer
- Item must exist in the `items` table (FK enforced by DB, caught as DatabaseError → 400)

```typescript
import { AppError } from '@/lib/errors'
import { create } from '@/lib/db/targets'
import { getById as getItemById } from '@/lib/db/items'
import type { CreateTargetInput } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<CreateTargetInput>

    if (!body.itemId || typeof body.itemId !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'itemId is required', 400)
    }
    if (body.targetType !== 'buy_below' && body.targetType !== 'sell_above') {
      throw new AppError('VALIDATION_ERROR', 'targetType must be buy_below or sell_above', 400)
    }
    if (!Number.isInteger(body.targetCents) || body.targetCents <= 0) {
      throw new AppError('VALIDATION_ERROR', 'targetCents must be a positive integer', 400)
    }

    // Verify item exists before creating target
    const item = getItemById(body.itemId)
    if (!item) {
      throw new AppError('NOT_FOUND', `Item ${body.itemId} not found`, 404)
    }

    const target = create({
      itemId:      body.itemId,
      targetType:  body.targetType,
      targetCents: body.targetCents,
    })
    return routeOk(target)
  } catch (err) {
    return routeError(err)
  }
}
```

### `PATCH /api/targets/[targetId]`

**File**: `src/app/api/targets/[targetId]/route.ts`

Request body: `{ action: 'acknowledge' | 'deactivate' }`

- `acknowledge`: only valid when target status is `triggered`
- `deactivate`: valid from `active` or `triggered`

```typescript
import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getById, acknowledge, deactivate } from '@/lib/db/targets'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const id = parseInt(params.targetId, 10)
    if (isNaN(id)) throw new AppError('VALIDATION_ERROR', 'targetId must be numeric', 400)

    const target = getById(id)
    if (!target) throw new AppError('NOT_FOUND', `Target ${id} not found`, 404)

    const body = await request.json() as { action?: string }

    if (body.action === 'acknowledge') {
      if (target.status !== 'triggered') {
        throw new AppError('INVALID_STATE', 'Only triggered targets can be acknowledged', 409)
      }
      acknowledge(id)
    } else if (body.action === 'deactivate') {
      if (target.status === 'acknowledged') {
        throw new AppError('INVALID_STATE', 'Target is already acknowledged', 409)
      }
      deactivate(id)
    } else {
      throw new AppError('VALIDATION_ERROR', 'action must be acknowledge or deactivate', 400)
    }

    return routeOk({ success: true })
  } catch (err) {
    return routeError(err)
  }
}
```

### `DELETE /api/targets/[targetId]`

**File**: `src/app/api/targets/[targetId]/route.ts` (same file, additional export)

```typescript
import { remove } from '@/lib/db/targets'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const id = parseInt(params.targetId, 10)
    if (isNaN(id)) throw new AppError('VALIDATION_ERROR', 'targetId must be numeric', 400)

    const target = getById(id)
    if (!target) throw new AppError('NOT_FOUND', `Target ${id} not found`, 404)

    remove(id)
    return routeOk({ success: true })
  } catch (err) {
    return routeError(err)
  }
}
```

---

## 8. UI Components

### 8.1 Target badge on item rows

**File**: `src/components/items/target-badge.tsx` (new)

A small inline badge that appears on item rows when at least one active target exists. Clicking it navigates to the item detail page's target section.

```
[ 🎯 2 ]   ← active targets count
[ 🔔 1 ]   ← triggered (pulsing orange dot)
```

Props:
```typescript
interface TargetBadgeProps {
  activeCount:    number
  triggeredCount: number
  onClick?:       () => void
}
```

Rendering logic:
- If `triggeredCount > 0`: render an orange/amber badge with a pulsing dot and the count. This draws immediate attention.
- Else if `activeCount > 0`: render a muted teal badge with the active count.
- If both are 0: render nothing (the component returns null).

The item row list component fetches targets via `GET /api/targets?itemId=X` or — more efficiently — via a single `GET /api/targets` call in a shared hook that groups targets by item_id client-side. See Section 8.4 for the hook.

### 8.2 Target form in item detail page

**File**: `src/components/items/target-form.tsx` (new)

Displayed in the item detail slide-out panel (or detail page, depending on current UI structure). Contains:

- **Buy Below** section: number input (displays in dollars, converts to cents before POST), "Set" button.
- **Sell Above** section: same structure.
- **Active targets list**: table showing existing targets with their status and a Delete/Deactivate button per row.
- **Triggered targets**: highlighted rows with an Acknowledge button.

State management: the component uses a local `useTargets(itemId)` hook (see 8.4). After any mutation it calls `refetch()` to update the list.

Input handling note: the form accepts dollars with two decimal places (e.g., "45.00") and converts via `Math.round(parseFloat(value) * 100)` before sending to the API. This keeps the UI natural while keeping the API in cents.

Validation in the form:
- Empty input or non-numeric input: disabled "Set" button.
- Value of zero or negative: error message "Enter a price greater than $0.00".
- Value equal to an existing active target of the same type: warning "You already have a target at this price."

### 8.3 Activity feed extension

**File**: `src/components/layout/activity-feed.tsx` (modified)

Add `target_triggered` to both record literals:

```typescript
const eventIcons: Record<EventType, string> = {
  sold:             '🔴',
  expired:          '⏰',
  price_drop:       '💰',
  price_increase:   '📈',
  watcher_spike:    '👀',
  target_triggered: '🎯',   // new
}

const eventLabels: Record<EventType, string> = {
  sold:             'Sold',
  expired:          'Expired',
  price_drop:       'Price drop',
  price_increase:   'Price increase',
  watcher_spike:    'Watcher spike',
  target_triggered: 'Target hit',   // new
}
```

The existing `oldValue → newValue` display in the feed renders as "4500 → 4250" which is unreadable. Extend the feed's value formatter to detect the `target_triggered` event type and format both values as dollar amounts:

```typescript
function formatEventValues(event: WatchlistEvent): string | null {
  if (!event.oldValue || !event.newValue) return null

  if (event.eventType === 'target_triggered') {
    const threshold = formatCents(parseInt(event.oldValue, 10))
    const actual    = formatCents(parseInt(event.newValue, 10))
    return `Target ${threshold} — hit at ${actual}`
  }

  // Default: display as cents diff for price events
  const oldCents = parseInt(event.oldValue, 10)
  const newCents = parseInt(event.newValue, 10)
  return `${formatCents(oldCents)} → ${formatCents(newCents)}`
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
```

If `formatCents` is already defined in `src/lib/utils.ts`, use the shared version rather than defining it locally.

### 8.4 Data hook

**File**: `src/hooks/use-targets.ts` (new)

```typescript
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PriceTarget, CreateTargetInput, UpdateTargetInput } from '@/types'

export function useTargets(itemId?: string) {
  const qc = useQueryClient()

  const query = useQuery<PriceTarget[]>({
    queryKey: ['targets', { itemId }],
    queryFn: async () => {
      const url = itemId
        ? `/api/targets?itemId=${encodeURIComponent(itemId)}`
        : '/api/targets'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch targets')
      return (await res.json()).data
    },
    refetchInterval: 30_000,
  })

  const create = useMutation({
    mutationFn: async (input: CreateTargetInput) => {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to create target')
      return (await res.json()).data as PriceTarget
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: UpdateTargetInput['action'] }) => {
      const res = await fetch(`/api/targets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed to update target')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete target')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  })

  return { ...query, create, update, remove }
}
```

The 30-second `refetchInterval` matches the existing `use-events.ts` pattern. If/when a sync completes and creates a triggered event, the next poll will show it automatically.

---

## 9. Edge Cases

### Multiple targets per item

Fully supported. The `getActiveForItem` query returns all active targets for the item. The `evaluateTargets` loop processes each independently. It is valid (and useful) to have both a buy_below and a sell_above target on the same item simultaneously — e.g., "alert me if it drops below $40 or spikes above $80."

If a user sets two `buy_below` targets at different thresholds (e.g., $50 and $40), both evaluate independently. When the price is $45, only the $50 target triggers. When the price drops to $38, the $40 target triggers separately on whatever sync first observes that price.

### Target already triggered

`triggerTarget` uses `WHERE status = 'active'` in its UPDATE. A target in `triggered` or `acknowledged` state is invisible to `getActiveForItem` (which filters `status = 'active'`) and is never passed to `shouldTrigger`. There is no re-triggering path.

### Item sold before target hit

When the sync loop reaches step 4 (disappeared items), `markStatus` sets the item to `Sold` or `Ended`. Targets for that item remain in `price_targets` in their current state (`active`, `triggered`, etc.). They are harmless: the item will never appear in a future API response, so `evaluateTargets` will never be called for it again. The targets serve as a historical record of what the user was trying to achieve.

Optionally (not in core scope), a cleanup query could flip all `active` targets for sold/ended items to a `cancelled` status. This would require a fourth status enum value and a UI affordance to display cancelled targets — that is a polish task for later.

### Price exactly equals target

Both `buy_below` and `sell_above` use inclusive comparisons (`<=` and `>=`). A target set at exactly the current price fires immediately on the next sync. This is the correct behavior: "buy below $45" should include $45.

If strict inequality is desired (price must be strictly less than or strictly greater than), the comparison operators change to `<` and `>`. This is a product decision, not an architectural one. The current design defaults to inclusive because "buy below $45" is colloquially understood as "buy at $45 or less."

### Target on an ended item

A user can create a target on an item that is currently `Active` and the item may later end without hitting the threshold. See "Item sold before target hit" above — targets remain inert. The target form in the UI should visually indicate when a target is attached to a non-Active item (e.g., a strikethrough or "Item ended" label). The API does not prevent creating a target on a non-Active item at the DB level, but the POST handler performs a `getItemById` check; if desired, a status check can be added:

```typescript
if (item.status !== 'Active') {
  throw new AppError('INVALID_STATE', 'Cannot set targets on non-active items', 409)
}
```

This is optional — there is a valid use case for setting a target on an item before it re-lists.

---

## 10. Notification Extensibility

The core design produces a `target_triggered` event in the existing `events` table. The activity feed displays it immediately. No new notification channel is required for the core feature to be useful.

The architecture is structured so additional channels plug in at a single point: after `triggerTarget()` and `insertEvent()` in `target-evaluator.ts`.

### Web Push (+4 hours)

Web Push requires:
1. A VAPID key pair (generated once via `web-push` npm package, stored in `.env`).
2. A `push_subscriptions` table: `(id, endpoint TEXT, p256dh TEXT, auth TEXT, created_at TEXT)`.
3. A `POST /api/push/subscribe` endpoint that stores the browser's subscription object.
4. A `<PushSubscribeButton>` component using `navigator.serviceWorker` and `PushManager.subscribe()`.
5. A service worker (`public/sw.js`) that handles `push` events and displays notifications.
6. In `target-evaluator.ts`, after the existing `insertEvent` call: `await sendPushNotifications(itemId, target, currentPriceCents)` — an async function that fetches subscriptions from the DB and calls `webpush.sendNotification()` for each.

The `evaluateTargets` function signature stays synchronous from `sync-service.ts`'s perspective; the push notification call is fire-and-forget (unhandled promise, or wrapped in a try/catch that logs failures). Sync reliability must not be coupled to push delivery reliability.

### Email via Resend (+3 hours)

Resend integration requires:
1. `RESEND_API_KEY` in `.env`.
2. A `notification_preferences` table (or column on a `users` table if multi-user support exists): `(id, email TEXT, enabled_events TEXT)` — a comma-delimited list or JSON array of event types the user wants emails for.
3. An email template for `target_triggered` (plain text + HTML with item title, threshold, and actual price).
4. In `target-evaluator.ts`, after `insertEvent`: `await sendEmailNotification(itemId, target, currentPriceCents)`.
5. A settings UI for the user to enter their email and toggle email notifications.

Since this is a single-user local app (no authentication layer), the simplest implementation stores the email in a `.env` variable (`ALERT_EMAIL`) and skips the preferences table entirely. The Resend call is a single `fetch` to `https://api.resend.com/emails`.

### Shared notification wrapper pattern

When both push and email are implemented, extract a shared `notify()` function in `src/lib/notifications/index.ts`:

```typescript
export async function notifyTargetTriggered(
  item: WatchlistItem,
  target: PriceTarget,
  currentPriceCents: number
): Promise<void> {
  await Promise.allSettled([
    sendPush(item, target, currentPriceCents),
    sendEmail(item, target, currentPriceCents),
  ])
  // Promise.allSettled ensures one channel failure does not block the other
}
```

`evaluateTargets` then imports and calls `notifyTargetTriggered` after the existing synchronous operations. Wrapping in `Promise.allSettled` prevents a push failure from blocking email delivery and vice versa. Errors are logged but not rethrown — sync completion must not depend on notification delivery.

---

## 11. Test Specs

**File**: `tests/e2e/price-targets.spec.ts`

All tests are written as Playwright test files — the only test runner in this project (`@playwright/test`). Tests 1-5 are pure Node.js unit tests with no browser or network; they use an inline `evaluateTargetsWithDb()` helper that mirrors `target-evaluator.ts` exactly but accepts an injected in-memory DB rather than calling the `getDb()` singleton. Tests 6-7 are API integration tests that use Playwright's `request` fixture against the live dev server.

**Runner**: `npx playwright test tests/e2e/price-targets.spec.ts`

### Schema and helpers (top of test file)

```typescript
/**
 * Price Target Alerts — Test Suite (E6)
 *
 * Tests 1-5: Unit tests for target-evaluator.ts logic.
 *   Run against an isolated better-sqlite3 in-memory DB. No browser or live
 *   server required. Each test builds its own schema, seeds data, calls
 *   evaluateTargets() directly, and asserts on the resulting DB state.
 *
 * Tests 6-7: API integration tests.
 *   Run against the live dev server (started by playwright webServer config).
 *   Use the `request` fixture to call POST /api/targets and PATCH /api/targets/[id].
 *   These tests depend on a real item existing in the application DB, which is
 *   seeded via the eBay sync seed script or a dedicated test seed route.
 *   If no seed item exists the tests are skipped with an explanatory message.
 *
 * File: tests/e2e/price-targets.spec.ts
 */

import { test, expect } from '@playwright/test'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Shared schema helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fully isolated in-memory SQLite database with the items, events,
 * and price_targets tables. Returns the db instance for direct use in tests.
 *
 * This mirrors the schema from:
 *   src/lib/db/migrations/001_initial.sql
 *   src/lib/db/migrations/002_price_targets.sql
 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  // 001_initial.sql — items table (minimal columns needed for FK + test seeds)
  db.exec(`
    CREATE TABLE items (
      item_id          TEXT PRIMARY KEY,
      rank             INTEGER UNIQUE,
      title            TEXT NOT NULL,
      current_price    INTEGER NOT NULL,
      buy_it_now_price INTEGER,
      shipping_cost    INTEGER DEFAULT 0,
      listing_type     TEXT NOT NULL,
      condition_name   TEXT,
      end_time         TEXT,
      time_left        TEXT,
      seller_id        TEXT,
      seller_feedback  INTEGER,
      watcher_count    INTEGER,
      bid_count        INTEGER DEFAULT 0,
      image_url        TEXT,
      listing_url      TEXT,
      status           TEXT DEFAULT 'Active',
      is_in_queue      INTEGER DEFAULT 0,
      notes            TEXT,
      first_seen_at    TEXT DEFAULT (datetime('now')),
      last_synced_at   TEXT DEFAULT (datetime('now')),
      removed_at       TEXT
    );

    CREATE TABLE events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     TEXT NOT NULL REFERENCES items(item_id),
      event_type  TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_events_item ON events(item_id, detected_at);
  `)

  // 002_price_targets.sql
  db.exec(`
    CREATE TABLE price_targets (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id               TEXT NOT NULL REFERENCES items(item_id),
      target_type           TEXT NOT NULL CHECK (target_type IN ('buy_below', 'sell_above')),
      target_cents          INTEGER NOT NULL,
      status                TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'triggered', 'acknowledged')),
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      triggered_at          TEXT,
      triggered_price_cents INTEGER,
      acknowledged_at       TEXT
    );

    CREATE INDEX idx_targets_item   ON price_targets(item_id);
    CREATE INDEX idx_targets_status ON price_targets(status);
  `)

  return db
}

/**
 * Inserts a minimal item row sufficient for FK satisfaction.
 */
function seedItem(db: Database.Database, itemId: string, currentPriceCents: number = 5000): void {
  db.prepare(`
    INSERT INTO items (item_id, title, current_price, listing_type, status)
    VALUES (?, ?, ?, 'FixedPrice', 'Active')
  `).run(itemId, `Test Item ${itemId}`, currentPriceCents)
}

/**
 * Inserts an active price target and returns its auto-assigned id.
 */
function seedActiveTarget(
  db: Database.Database,
  itemId: string,
  targetType: 'buy_below' | 'sell_above',
  targetCents: number,
): number {
  const result = db.prepare(`
    INSERT INTO price_targets (item_id, target_type, target_cents, status)
    VALUES (?, ?, ?, 'active')
  `).run(itemId, targetType, targetCents)
  return result.lastInsertRowid as number
}

/**
 * Inserts a price target already in 'triggered' status (pre-fired).
 */
function seedTriggeredTarget(
  db: Database.Database,
  itemId: string,
  targetType: 'buy_below' | 'sell_above',
  targetCents: number,
  triggeredPriceCents: number,
): number {
  const result = db.prepare(`
    INSERT INTO price_targets (
      item_id, target_type, target_cents, status,
      triggered_at, triggered_price_cents
    )
    VALUES (?, ?, ?, 'triggered', datetime('now'), ?)
  `).run(itemId, targetType, targetCents, triggeredPriceCents)
  return result.lastInsertRowid as number
}

// ---------------------------------------------------------------------------
// Inline evaluator — mirrors src/lib/sync/target-evaluator.ts exactly,
// but accepts a db instance instead of calling the global getDb() singleton.
// This allows unit tests to run without touching the application DB file.
// ---------------------------------------------------------------------------

interface PriceTarget {
  id: number
  itemId: string
  targetType: 'buy_below' | 'sell_above'
  targetCents: number
  status: 'active' | 'triggered' | 'acknowledged'
}

function shouldTrigger(target: PriceTarget, currentPriceCents: number): boolean {
  if (target.targetType === 'buy_below') {
    return currentPriceCents <= target.targetCents
  }
  if (target.targetType === 'sell_above') {
    return currentPriceCents >= target.targetCents
  }
  return false
}

function evaluateTargetsWithDb(
  db: Database.Database,
  itemId: string,
  currentPriceCents: number,
): void {
  // Mirrors getActiveForItem() — only 'active' targets are evaluated
  const rows = db.prepare(
    `SELECT * FROM price_targets WHERE item_id = ? AND status = 'active'`
  ).all(itemId) as any[]

  const targets: PriceTarget[] = rows.map(row => ({
    id:          row.id,
    itemId:      row.item_id,
    targetType:  row.target_type as 'buy_below' | 'sell_above',
    targetCents: row.target_cents,
    status:      row.status as 'active',
  }))

  if (targets.length === 0) return

  for (const target of targets) {
    if (shouldTrigger(target, currentPriceCents)) {
      // Mirrors triggerTarget() — WHERE status = 'active' prevents double-trigger
      db.prepare(`
        UPDATE price_targets
        SET status = 'triggered',
            triggered_at = datetime('now'),
            triggered_price_cents = ?
        WHERE id = ? AND status = 'active'
      `).run(currentPriceCents, target.id)

      // Mirrors insert() in events.ts
      db.prepare(`
        INSERT INTO events (item_id, event_type, old_value, new_value)
        VALUES (?, 'target_triggered', ?, ?)
      `).run(itemId, String(target.targetCents), String(currentPriceCents))
    }
  }
}
```

### Test 1: buy_below target fires when price drops below threshold

```typescript
// T1: buy_below target fires when price drops below threshold
test('T1: buy_below target fires when price drops below threshold', () => {
  // Arrange
  const db = createTestDb()
  const ITEM_ID = 'ebay-item-001'
  seedItem(db, ITEM_ID, 5000)
  const targetId = seedActiveTarget(db, ITEM_ID, 'buy_below', 4500)

  // Act — price of 4499 is below the 4500 threshold
  evaluateTargetsWithDb(db, ITEM_ID, 4499)

  // Assert — target transitioned to triggered
  const target = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(targetId) as any
  expect(target.status).toBe('triggered')
  expect(target.triggered_price_cents).toBe(4499)
  expect(target.triggered_at).not.toBeNull()

  // Assert — exactly one target_triggered event was inserted for this item
  const events = db.prepare(
    `SELECT * FROM events WHERE item_id = ? AND event_type = 'target_triggered'`
  ).all(ITEM_ID) as any[]
  expect(events).toHaveLength(1)

  // Assert — event carries threshold in old_value, actual price in new_value
  expect(events[0].old_value).toBe('4500')
  expect(events[0].new_value).toBe('4499')

  db.close()
})
```

### Test 2: sell_above target fires when price rises above threshold

```typescript
// T2: sell_above target fires when price rises above threshold
test('T2: sell_above target fires when price rises above threshold', () => {
  // Arrange
  const db = createTestDb()
  const ITEM_ID = 'ebay-item-002'
  seedItem(db, ITEM_ID, 7000)
  const targetId = seedActiveTarget(db, ITEM_ID, 'sell_above', 8000)

  // Act — price of 8001 exceeds the 8000 threshold
  evaluateTargetsWithDb(db, ITEM_ID, 8001)

  // Assert — target transitioned to triggered
  const target = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(targetId) as any
  expect(target.status).toBe('triggered')
  expect(target.triggered_price_cents).toBe(8001)
  expect(target.triggered_at).not.toBeNull()

  // Assert — one target_triggered event created
  const events = db.prepare(
    `SELECT * FROM events WHERE item_id = ? AND event_type = 'target_triggered'`
  ).all(ITEM_ID) as any[]
  expect(events).toHaveLength(1)
  expect(events[0].old_value).toBe('8000')
  expect(events[0].new_value).toBe('8001')

  db.close()
})
```

### Test 3: target at exact threshold value fires (inclusive boundary)

```typescript
// T3: target at exact threshold value fires (inclusive boundary)
test('T3: target at exact threshold value fires (inclusive boundary)', () => {
  // Arrange
  const db = createTestDb()
  const ITEM_ID = 'ebay-item-003'
  seedItem(db, ITEM_ID, 5000)
  const targetId = seedActiveTarget(db, ITEM_ID, 'buy_below', 4500)

  // Act — price is exactly equal to the threshold (not strictly below)
  evaluateTargetsWithDb(db, ITEM_ID, 4500)

  // Assert — inclusive comparison: fires at threshold, not just below it
  const target = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(targetId) as any
  expect(target.status).toBe('triggered')
  expect(target.triggered_price_cents).toBe(4500)

  // Assert — event was inserted
  const events = db.prepare(
    `SELECT * FROM events WHERE item_id = ? AND event_type = 'target_triggered'`
  ).all(ITEM_ID) as any[]
  expect(events).toHaveLength(1)
  expect(events[0].old_value).toBe('4500')
  expect(events[0].new_value).toBe('4500')

  db.close()
})
```

### Test 4: triggered target does not re-fire on subsequent sync

```typescript
// T4: triggered target does not re-fire on subsequent sync
test('T4: triggered target does not re-fire on subsequent sync', () => {
  // Arrange — start with a target already in 'triggered' state
  const db = createTestDb()
  const ITEM_ID = 'ebay-item-004'
  seedItem(db, ITEM_ID, 5000)

  // Seed one 'triggered' target (simulates a prior sync that already fired it)
  seedTriggeredTarget(db, ITEM_ID, 'buy_below', 4500, 4400)

  // Pre-condition: one event already exists from the first trigger
  db.prepare(`
    INSERT INTO events (item_id, event_type, old_value, new_value)
    VALUES (?, 'target_triggered', '4500', '4400')
  `).run(ITEM_ID)

  const eventsBefore = db.prepare(
    `SELECT COUNT(*) AS cnt FROM events WHERE item_id = ? AND event_type = 'target_triggered'`
  ).get(ITEM_ID) as any
  expect(eventsBefore.cnt).toBe(1)

  // Act — price is still below threshold; evaluator runs again
  evaluateTargetsWithDb(db, ITEM_ID, 4000)

  // Assert — no new events were created (triggered targets are invisible to evaluator)
  const eventsAfter = db.prepare(
    `SELECT COUNT(*) AS cnt FROM events WHERE item_id = ? AND event_type = 'target_triggered'`
  ).get(ITEM_ID) as any
  expect(eventsAfter.cnt).toBe(1)

  // Assert — target status is still 'triggered', not changed
  const target = db.prepare('SELECT * FROM price_targets WHERE item_id = ?').get(ITEM_ID) as any
  expect(target.status).toBe('triggered')

  db.close()
})
```

### Test 5: multiple active targets on one item, both fire independently

```typescript
// T5: multiple active targets on one item, both fire independently
test('T5: multiple active targets on one item, both fire independently', () => {
  // Arrange — two buy_below targets at different thresholds on the same item
  const db = createTestDb()
  const ITEM_ID = 'ebay-item-005'
  seedItem(db, ITEM_ID, 6000)
  const targetHighId = seedActiveTarget(db, ITEM_ID, 'buy_below', 5000) // fires at <= 5000
  const targetLowId  = seedActiveTarget(db, ITEM_ID, 'buy_below', 4000) // fires at <= 4000

  // Act — price of 3999 is below both thresholds
  evaluateTargetsWithDb(db, ITEM_ID, 3999)

  // Assert — both targets transitioned to triggered independently
  const targetHigh = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(targetHighId) as any
  const targetLow  = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(targetLowId) as any

  expect(targetHigh.status).toBe('triggered')
  expect(targetHigh.triggered_price_cents).toBe(3999)

  expect(targetLow.status).toBe('triggered')
  expect(targetLow.triggered_price_cents).toBe(3999)

  // Assert — two separate events, one per target
  const events = db.prepare(
    `SELECT * FROM events WHERE item_id = ? AND event_type = 'target_triggered' ORDER BY id ASC`
  ).all(ITEM_ID) as any[]
  expect(events).toHaveLength(2)

  // Each event references its own threshold in old_value
  const thresholds = events.map(e => e.old_value).sort()
  expect(thresholds).toEqual(['4000', '5000'])

  // Both events carry the same actual trigger price in new_value
  expect(events[0].new_value).toBe('3999')
  expect(events[1].new_value).toBe('3999')

  db.close()
})
```

### Test 6: API — POST /api/targets creates target and returns 200

```typescript
// T6: POST /api/targets creates target and returns 200
test('T6: POST /api/targets creates target and returns 200', async ({ request }) => {
  const itemId = await resolveSeededItemId(request)
  if (!itemId) {
    test.skip()
    return
  }

  // Act — create a buy_below target at $45.00 (4500 cents)
  const res = await request.post('/api/targets', {
    data: {
      itemId,
      targetType: 'buy_below',
      targetCents: 4500,
    },
  })

  // Assert — response status
  expect(res.status()).toBe(200)

  // Assert — response body shape and field values
  const body = await res.json()
  expect(body).toHaveProperty('data')

  const data = body.data
  expect(data.status).toBe('active')
  expect(data.targetCents).toBe(4500)
  expect(data.targetType).toBe('buy_below')
  expect(data.itemId).toBe(itemId)
  expect(typeof data.id).toBe('number')
  expect(data.triggeredAt).toBeNull()
  expect(data.triggeredPriceCents).toBeNull()
  expect(data.acknowledgedAt).toBeNull()

  // Cleanup — delete the created target so it does not interfere with other tests
  if (data.id) {
    await request.delete(`/api/targets/${data.id}`)
  }
})
```

Where `resolveSeededItemId` is defined as:

```typescript
/**
 * Resolve a seeded item ID from the live server's DB.
 * Probes GET /api/items to find any Active item already present.
 * Returns null if no item is found; calling test must call test.skip().
 */
async function resolveSeededItemId(
  request: import('@playwright/test').APIRequestContext
): Promise<string | null> {
  const res = await request.get('/api/items')
  if (!res.ok()) return null
  const body = await res.json()
  const ranked: any[]   = body?.data?.ranked   ?? []
  const unranked: any[] = body?.data?.unranked  ?? []
  const all = [...ranked, ...unranked]
  const active = all.find((item: any) => item.status === 'Active')
  return active?.id ?? null
}
```

### Test 7: API — PATCH /api/targets/[id] with action=acknowledge transitions to acknowledged

```typescript
// T7: PATCH /api/targets/[id] with action=deactivate transitions active → acknowledged
test('T7: PATCH /api/targets/[id] with action=acknowledge transitions to acknowledged', async ({ request }) => {
  const itemId = await resolveSeededItemId(request)
  if (!itemId) {
    test.skip()
    return
  }

  // Step 1: Create an active target with an unreachable price ($999)
  const createRes = await request.post('/api/targets', {
    data: {
      itemId,
      targetType: 'sell_above',
      targetCents: 99900, // $999 — unlikely to be triggered by sync during test run
    },
  })
  expect(createRes.status()).toBe(200)
  const createBody = await createRes.json()
  const targetId: number = createBody.data.id
  expect(typeof targetId).toBe('number')

  // Step 2: Patch with action=deactivate (valid from 'active'; transitions to 'acknowledged')
  // Note: action=acknowledge requires status='triggered'. action=deactivate works from 'active'
  // and results in the same terminal 'acknowledged' state — verifying the PATCH endpoint and
  // state machine. For the acknowledge-on-triggered path, see T7b.
  const patchRes = await request.patch(`/api/targets/${targetId}`, {
    data: { action: 'deactivate' },
  })
  expect(patchRes.status()).toBe(200)
  const patchBody = await patchRes.json()
  expect(patchBody.data.success).toBe(true)

  // Step 3: Verify the target is now in acknowledged state with acknowledged_at set
  const getRes = await request.get(`/api/targets?itemId=${encodeURIComponent(itemId)}`)
  expect(getRes.status()).toBe(200)
  const getBody = await getRes.json()
  const found = (getBody.data as any[]).find((t: any) => t.id === targetId)
  expect(found).toBeDefined()
  expect(found.status).toBe('acknowledged')
  expect(found.acknowledgedAt).not.toBeNull()
})

// T7b: PATCH action=acknowledge on a triggered target (requires a triggered target in DB)
test('T7b: PATCH action=acknowledge on triggered target transitions to acknowledged', async ({ request }) => {
  const itemId = await resolveSeededItemId(request)
  if (!itemId) {
    test.skip()
    return
  }

  // Check for any existing triggered targets on the item
  const existingRes = await request.get(
    `/api/targets?itemId=${encodeURIComponent(itemId)}&status=triggered`
  )
  const existingBody = await existingRes.json()
  const triggeredTargets: any[] = existingBody?.data ?? []

  if (triggeredTargets.length === 0) {
    // No triggered targets available — cannot exercise this path without a sync.
    // Run a sync with a buy_below target set above the current price to create one.
    test.skip()
    return
  }

  const triggeredTarget = triggeredTargets[0]
  const targetId: number = triggeredTarget.id

  // Act — acknowledge the triggered target
  const patchRes = await request.patch(`/api/targets/${targetId}`, {
    data: { action: 'acknowledge' },
  })
  expect(patchRes.status()).toBe(200)
  expect((await patchRes.json()).data.success).toBe(true)

  // Assert — target is now acknowledged with a timestamp
  const getRes  = await request.get(`/api/targets?itemId=${encodeURIComponent(itemId)}`)
  const getBody = await getRes.json()
  const found   = (getBody.data as any[]).find((t: any) => t.id === targetId)
  expect(found).toBeDefined()
  expect(found.status).toBe('acknowledged')
  expect(found.acknowledgedAt).not.toBeNull()
})
```

---

## 12. Effort Estimate

### Core (5 hours)

| Task | Hours |
|------|-------|
| Migration `002_price_targets.sql` | 0.25 |
| TypeScript types (`src/types/index.ts`) | 0.25 |
| `src/lib/db/targets.ts` repo | 0.75 |
| `src/lib/sync/target-evaluator.ts` | 0.50 |
| `sync-service.ts` integration (2-line change) | 0.25 |
| API routes (`/api/targets`, `/api/targets/[id]`) | 0.75 |
| `src/hooks/use-targets.ts` | 0.50 |
| `target-badge.tsx` | 0.50 |
| `target-form.tsx` | 0.75 |
| `activity-feed.tsx` extension | 0.25 |
| Unit tests (target-evaluator, 5 scenarios) | 0.50 |
| **Total core** | **5.25** |

### Web Push extension (+4 hours)

| Task | Hours |
|------|-------|
| VAPID key setup + `push_subscriptions` migration | 0.50 |
| `POST /api/push/subscribe` endpoint | 0.50 |
| Service worker (`public/sw.js`) | 1.00 |
| `<PushSubscribeButton>` component | 0.50 |
| `sendPushNotifications()` in notification module | 1.00 |
| Integration into `target-evaluator.ts` | 0.25 |
| Testing + HTTPS dev setup | 0.25 |
| **Total push** | **4.00** |

### Email via Resend extension (+3 hours)

| Task | Hours |
|------|-------|
| Resend account + API key in `.env` | 0.25 |
| Email HTML/text template | 0.75 |
| `sendEmailNotification()` in notification module | 0.75 |
| Integration into `target-evaluator.ts` | 0.25 |
| Settings UI (email input + toggle) | 0.75 |
| Test with Resend sandbox | 0.25 |
| **Total email** | **3.00** |

---

## 13. File Inventory

### New files

| File | Purpose |
|------|---------|
| `src/lib/db/migrations/002_price_targets.sql` | Schema migration: `price_targets` table + indexes |
| `src/lib/db/targets.ts` | Repository: all CRUD + state transition operations for targets |
| `src/lib/sync/target-evaluator.ts` | Sync hook: evaluates active targets against fresh price, creates events |
| `src/app/api/targets/route.ts` | `GET /api/targets` and `POST /api/targets` |
| `src/app/api/targets/[targetId]/route.ts` | `PATCH` and `DELETE /api/targets/[targetId]` |
| `src/hooks/use-targets.ts` | React Query hook for all target operations |
| `src/components/items/target-badge.tsx` | Inline badge showing active/triggered target counts on item rows |
| `src/components/items/target-form.tsx` | Form + list for managing targets within item detail view |
| `src/lib/sync/__tests__/target-evaluator.test.ts` | Unit tests for evaluation logic |

### Modified files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `TargetType`, `TargetStatus`, `PriceTarget`, `CreateTargetInput`, `UpdateTargetInput`, `TargetsRepo`; extend `EventType` union with `'target_triggered'` |
| `src/lib/sync/sync-service.ts` | Import `evaluateTargets`; call `evaluateTargets(apiItem.id, apiItem.currentPrice)` after `insertSnapshot` in the main item loop |
| `src/components/layout/activity-feed.tsx` | Extend `eventIcons` and `eventLabels` with `target_triggered`; add `formatEventValues` helper for dollar-formatted display |

### Future files (push + email extensions, not in core scope)

| File | Purpose |
|------|---------|
| `src/lib/db/migrations/003_push_subscriptions.sql` | Schema for Web Push subscription storage |
| `src/lib/notifications/index.ts` | Shared `notifyTargetTriggered()` dispatcher |
| `src/lib/notifications/push.ts` | `sendPushNotifications()` using `web-push` |
| `src/lib/notifications/email.ts` | `sendEmailNotification()` using Resend API |
| `src/app/api/push/subscribe/route.ts` | Browser subscription registration endpoint |
| `src/components/settings/push-subscribe-button.tsx` | Browser push opt-in button |
| `public/sw.js` | Service worker handling push events |

---

## 14. Implementation Order

Execute in this sequence to keep the application in a working state at every step.

1. Add migration file `002_price_targets.sql` and restart the dev server to apply it.
2. Add types to `src/types/index.ts`.
3. Implement `src/lib/db/targets.ts`.
4. Implement `src/lib/sync/target-evaluator.ts` and write tests.
5. Integrate `evaluateTargets` into `sync-service.ts` (two-line change).
6. Implement API routes (`/api/targets` and `/api/targets/[targetId]`).
7. Implement `use-targets.ts` hook.
8. Implement `target-form.tsx` and add to item detail view.
9. Implement `target-badge.tsx` and add to item row.
10. Extend `activity-feed.tsx` with the new event type and value formatter.
11. Manual smoke test: set a buy_below target, manually trigger sync, verify event appears in feed.
