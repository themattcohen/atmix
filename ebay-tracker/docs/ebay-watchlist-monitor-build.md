# eBay Watchlist Monitor — Build Doc

Personal tool to track, rank, and analyze eBay watchlist items. Syncs your eBay watchlist, detects when items sell or expire, tracks price and watcher trends, and presents everything in a ranked, sortable, draggable dark-theme table inspired by the Yahoo Fantasy Football draft UI.

---

## What It Does

1. **Syncs your eBay watchlist** every 10 minutes via the Trading API (GetMyeBayBuying)
2. **Detects sold/expired items** — when an item disappears from your watchlist, checks its status via Browse API and marks it accordingly
3. **Ranks items 1–N** with unique sequential priority numbers — reorder by dragging or typing a rank
4. **Tracks trends** — price history snapshots and watcher count velocity over time
5. **Detects events** — item sold, expired, price dropped, price increased, watcher spike
6. **Shows it all** in a dense, sortable, filterable table with a sidebar priority queue and activity feed

---

## Pre-Build: eBay Developer Setup

You must complete this before running the app.

### 1. Register at eBay Developer Program

- Go to https://developer.ebay.com/join (free, use your eBay account)
- Complete the registration

### 2. Create a Production Application

- Dashboard → Create Application
- Application Type: Production
- You'll receive three credentials:
  - **App ID** (also called Client ID)
  - **Cert ID** (also called Client Secret)
  - **Dev ID**

### 3. Configure OAuth Redirect URI (RuName)

- Go to your application → User Tokens tab
- Add a redirect URI: `http://localhost:3000/auth/callback`
- eBay calls this a "RuName" — note the generated RuName string

### 4. Obtain Refresh Token

Run the one-time auth script (built in Phase 1):

```bash
npx tsx scripts/ebay-auth.ts
```

This will:
1. Open your browser to eBay's consent screen
2. You authorize the app
3. eBay redirects back to localhost with an authorization code
4. The script exchanges the code for a refresh token
5. The refresh token is written to `.env`

### 5. Resulting `.env` File

```env
EBAY_CLIENT_ID=YourAppId-PRD-xxxxx
EBAY_CLIENT_SECRET=PRD-xxxxx-xxxxx
EBAY_DEV_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EBAY_REDIRECT_URI=YourAppName-PRD-xxxxx-xxxxxxxx
EBAY_REFRESH_TOKEN=v^1.1#i^1#r^1#...
EBAY_ENVIRONMENT=production
SYNC_INTERVAL_MINUTES=10
PORT=3000
DATABASE_PATH=./db/watchlist.db
```

**No username or password stored.** Refresh token lasts ~18 months. When it expires, rerun `scripts/ebay-auth.ts`.

---

## Research-Validated Architecture Decisions

These decisions were validated by deep research into eBay's API ecosystem as of February 2026.

| Decision | Rationale |
|----------|-----------|
| **Trading API (GetMyeBayBuying) for watchlist** | Confirmed: No REST replacement exists. Not on eBay's deprecation list. Only way to access personal watchlist. |
| **ebay-api@^9.4.3 npm package** | Actively maintained (v9.4.3 released Feb 2026). Handles both REST + Trading API. Built-in OAuth with auto-refresh. |
| **Custom server.ts entry point** | Next.js API routes have no stable init lifecycle for cron. Custom server owns the process: boots Next.js + node-cron in same event loop. |
| **SQLite with WAL mode** | Single-process architecture avoids lock contention. WAL allows concurrent reads during sync writes. Max 400 watchlist items — SQLite is plenty. |
| **better-sqlite3 with serverExternalPackages** | Native addon requires exclusion from Next.js webpack bundling. Must compile inside Docker (apk add python3 make g++). |
| **TanStack Query for server state** | Built-in optimistic mutation lifecycle (onMutate/onError/onSettled) — perfect for drag-and-drop rank updates. |
| **Zustand for UI state** | Lightweight store for filters, sidebar visibility, queue selection. No server representation needed. |
| **No Marketplace Insights API** | Inaccessible to individual developers. Sold comps comparison deferred to post-MVP. Sold DETECTION for your own items works via Browse API getItem. |
| **No Platform Notifications (MVP)** | Requires SOAP XML parsing + HTTPS endpoint. Complex for MVP. Polling every 10 min catches events within acceptable delay. |
| **OAuth refresh token only** | No username/password storage. Refresh token auto-generates 2-hour access tokens. 18-month lifetime. |

---

## Tech Stack

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Framework | Next.js (App Router) | 14.x | Single codebase: UI + API routes. Custom server for cron. |
| Database | SQLite via better-sqlite3 | 11.x | Zero config, fast, perfect for single-user tool. WAL mode. |
| eBay SDK | ebay-api | ^9.4.3 | Wraps REST + Trading API. Built-in OAuth. Actively maintained. |
| Server State | TanStack Query | v5 | Optimistic mutations, cache invalidation, background revalidation. |
| UI State | Zustand | ^4 | Minimal store for filters, sidebar, queue. |
| Table | TanStack Table | v8 | Sorting, filtering, column visibility, row model. |
| Drag & Drop | dnd-kit | ^6 | Accessible, performant vertical list reorder. |
| Charts | Recharts | ^2 | React-native charting. Line, area, bar, composed charts. |
| Styling | Tailwind CSS | ^3 | Dark theme. Fast to build. |
| Scheduler | node-cron | ^3 | In-process cron inside custom server.ts. |
| Testing | Playwright | ^1.40 | Browser E2E tests. 21 test cases. |
| Runtime | Node.js | 20 LTS | Stable, Docker-friendly. |
| Container | Docker | node:20-alpine | Multi-stage build. Native module compilation. |
| Deploy | Hetzner VPS | CX22 | 2 vCPU, 4GB RAM, 40GB disk. ~€4/month. |

No login/auth system. Single user. Runs as a containerized app on Hetzner.

---

## App Structure

```
ebay-tracker/
├── src/
│   ├── types/
│   │   └── index.ts                     # All shared TypeScript interfaces
│   │
│   ├── lib/
│   │   ├── config.ts                    # Env validation (zod schema)
│   │   ├── errors.ts                    # AppError hierarchy + route helpers
│   │   ├── utils.ts                     # Shared utilities
│   │   ├── db/
│   │   │   ├── client.ts               # SQLite connection singleton (WAL mode)
│   │   │   ├── migrate.ts              # Schema migration runner
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial.sql     # Initial schema DDL
│   │   │   ├── items.ts                # Items CRUD + rank operations
│   │   │   ├── trends.ts               # Price/watcher snapshot operations
│   │   │   └── events.ts               # Event log operations
│   │   ├── ebay/
│   │   │   ├── auth.ts                 # OAuth token management (auto-refresh)
│   │   │   └── client.ts              # eBay API wrapper (Trading + Browse)
│   │   ├── sync/
│   │   │   ├── sync-service.ts         # Watchlist sync engine (fetch → diff → upsert)
│   │   │   └── event-detector.ts       # Detects sold/expired/price change events
│   │   └── scheduler.ts                # node-cron setup (10-min sync cycle)
│   │
│   ├── server.ts                        # Custom server entry point (Next.js + cron)
│   │
│   ├── app/
│   │   ├── layout.tsx                   # Root layout (dark theme, providers)
│   │   ├── page.tsx                     # Main page: ranked watchlist table
│   │   ├── globals.css                  # Tailwind base + dark theme tokens
│   │   ├── providers.tsx                # TanStack Query provider
│   │   ├── trends/
│   │   │   └── page.tsx                # Portfolio trends dashboard
│   │   ├── items/
│   │   │   └── [itemId]/
│   │   │       └── page.tsx            # Item detail: charts + events
│   │   └── api/
│   │       ├── items/
│   │       │   ├── route.ts            # GET: all items (ranked + unranked)
│   │       │   └── [itemId]/
│   │       │       └── route.ts        # GET: single item, PATCH: update notes
│   │       ├── rank/
│   │       │   └── route.ts            # PATCH: update item rank
│   │       ├── sync/
│   │       │   └── route.ts            # POST: trigger manual sync
│   │       ├── trends/
│   │       │   └── route.ts            # GET: trend data + dashboard stats
│   │       └── events/
│   │           └── route.ts            # GET: event log
│   │
│   ├── store/
│   │   └── watchlist-store.ts           # Zustand: filters, sidebar, queue
│   │
│   ├── hooks/
│   │   ├── use-watchlist.ts             # TanStack Query: GET /api/items
│   │   ├── use-drag-rank.ts             # Optimistic rank mutation
│   │   ├── use-countdown.ts             # Client-side countdown timer
│   │   ├── use-events.ts               # TanStack Query: GET /api/events (polling)
│   │   ├── use-trends.ts               # TanStack Query: GET /api/trends
│   │   ├── use-item-detail.ts          # TanStack Query: GET /api/items/[id]
│   │   └── use-sync.ts                 # POST /api/sync + cache invalidation
│   │
│   └── components/
│       ├── ui/
│       │   ├── badge.tsx               # Colored status pill
│       │   ├── button.tsx              # Primary/secondary button
│       │   ├── skeleton.tsx            # Loading placeholder
│       │   ├── sparkline.tsx           # Mini inline trend chart
│       │   ├── tooltip.tsx             # Hover tooltip
│       │   └── error-boundary.tsx      # React error boundary
│       │
│       ├── layout/
│       │   ├── app-shell.tsx           # CSS Grid: main + sidebar
│       │   ├── top-bar.tsx             # Logo, nav tabs, sync status
│       │   ├── sidebar.tsx             # Collapsible sidebar container
│       │   ├── queue-panel.tsx         # Priority queue (top-N ranked items)
│       │   └── activity-feed.tsx       # Recent events feed
│       │
│       ├── watchlist/
│       │   ├── watchlist-table.tsx      # DndContext + TanStack Table orchestrator
│       │   ├── watchlist-row.tsx        # useSortable row with drag handle
│       │   ├── drag-handle.tsx          # Grip icon with dnd listeners
│       │   ├── rank-cell.tsx            # Editable rank number input
│       │   ├── countdown-cell.tsx       # Interval-driven auction timer
│       │   ├── price-cell.tsx           # Formatted price + delta badge
│       │   ├── status-badge.tsx         # Active/Sold/Expired/Relisted pill
│       │   ├── watcher-cell.tsx         # Count + delta + sparkline
│       │   ├── filter-bar.tsx           # Search + status/type dropdowns
│       │   ├── sync-button.tsx          # Manual sync trigger with loading
│       │   ├── column-toggle.tsx        # Column visibility popover
│       │   ├── empty-state.tsx          # Zero items illustration
│       │   └── error-state.tsx          # Error + retry button
│       │
│       ├── suggestions/
│       │   ├── suggestion-carousel.tsx  # Horizontal scroll of urgency cards
│       │   └── suggestion-card.tsx      # Single card (ending soon, price drop)
│       │
│       ├── trends/
│       │   ├── portfolio-stats.tsx      # Aggregate stat cards
│       │   ├── stats-card.tsx           # Single metric card
│       │   ├── portfolio-chart.tsx      # Portfolio value over time (Recharts)
│       │   └── movers-table.tsx         # Top price/watcher movers (TanStack)
│       │
│       └── detail/
│           ├── item-header.tsx          # Title, status, eBay link
│           ├── item-stats-grid.tsx      # Key metrics grid
│           ├── price-chart.tsx          # Price history area chart
│           ├── watcher-chart.tsx        # Watcher velocity bar+line chart
│           └── item-events.tsx          # Item-specific event timeline
│
├── tests/
│   └── e2e/
│       ├── watchlist-table.spec.ts      # T01-T08: render, sort, filter, search
│       ├── drag-reorder.spec.ts         # T09-T10: drag + manual rank
│       ├── item-detail.spec.ts          # T11-T12: navigation + charts
│       ├── trends.spec.ts              # T13: dashboard render
│       ├── sidebar.spec.ts             # T14, T20: events + mobile collapse
│       ├── sync.spec.ts                # T15: sync button
│       └── states.spec.ts              # T16-T19, T21: empty/error/timer/columns
│
├── scripts/
│   └── ebay-auth.ts                    # One-time OAuth setup script
│
├── db/
│   └── watchlist.db                    # SQLite database (gitignored)
│
├── docs/
│   ├── ebay-api-endpoints.md           # eBay API reference (existing)
│   └── ebay-watchlist-monitor-build.md # THIS DOCUMENT
│
├── playwright.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.server.json                 # Compiles server.ts → dist/server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── .gitignore
└── README.md
```

---

## Database Schema

All prices stored as **integers in USD cents** to avoid floating-point issues.

### `items` — Current watchlist state + ranking

```sql
CREATE TABLE items (
  item_id          TEXT PRIMARY KEY,
  rank             INTEGER UNIQUE,
  title            TEXT NOT NULL,
  current_price    INTEGER NOT NULL,            -- USD cents
  buy_it_now_price INTEGER,                     -- USD cents, NULL if no BIN
  shipping_cost    INTEGER DEFAULT 0,           -- USD cents
  listing_type     TEXT NOT NULL,               -- Auction, FixedPrice, AuctionWithBIN
  condition_name   TEXT,
  end_time         TEXT,                        -- ISO 8601 timestamp, NULL for BIN
  time_left        TEXT,                        -- ISO 8601 duration (from API)
  seller_id        TEXT,
  seller_feedback  INTEGER,
  watcher_count    INTEGER,
  bid_count        INTEGER DEFAULT 0,
  image_url        TEXT,
  listing_url      TEXT,
  status           TEXT DEFAULT 'Active',       -- Active, Sold, Ended, Relisted
  is_in_queue      INTEGER DEFAULT 0,           -- boolean: sidebar priority queue
  notes            TEXT,
  first_seen_at    TEXT DEFAULT (datetime('now')),
  last_synced_at   TEXT DEFAULT (datetime('now')),
  removed_at       TEXT
);

CREATE INDEX idx_items_rank ON items(rank);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_end_time ON items(end_time);
```

### `price_snapshots` — Price + watcher snapshots per sync

```sql
CREATE TABLE price_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       TEXT NOT NULL REFERENCES items(item_id),
  price_cents   INTEGER NOT NULL,
  shipping      INTEGER DEFAULT 0,
  watcher_count INTEGER,
  bid_count     INTEGER DEFAULT 0,
  recorded_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_snapshots_item ON price_snapshots(item_id, recorded_at);
```

### `events` — Sold, expired, price change log

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(item_id),
  event_type  TEXT NOT NULL,                    -- sold, expired, price_drop, price_increase, watcher_spike
  old_value   TEXT,
  new_value   TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_item ON events(item_id, detected_at);
CREATE INDEX idx_events_type ON events(event_type, detected_at);
```

### Pragmas (set on connection open)

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
```

---

## Ranking System

### Rules

1. Every active item gets a unique integer rank: `1, 2, 3, ... N`
2. No duplicates, no gaps in the active set
3. New items from sync arrive as **unranked** (`rank = NULL`) — shown in an "Unranked" section below the ranked table, sorted by end_time
4. User assigns rank by:
   - **Dragging** the row → rank updates to new position, neighbors shift
   - **Typing a number** in the rank cell → item moves to that position, everything else shifts
5. When a ranked item is sold/expired → its rank is freed, all ranks above shift down to fill the gap
6. Unranked items sort by `end_time` (soonest ending first)

### Reorder Algorithm

All rank operations run inside a single SQLite transaction.

```
SET_RANK(item, newRank):
  oldRank = item.currentRank

  if oldRank == NULL:
    -- Inserting unranked item into ranked list
    UPDATE items SET rank = rank + 1 WHERE rank >= newRank AND rank IS NOT NULL
    UPDATE items SET rank = newRank WHERE item_id = item.id

  else if newRank < oldRank:
    -- Moving up (e.g., rank 5 → rank 2)
    UPDATE items SET rank = rank + 1 WHERE rank >= newRank AND rank < oldRank
    UPDATE items SET rank = newRank WHERE item_id = item.id

  else if newRank > oldRank:
    -- Moving down (e.g., rank 2 → rank 5)
    UPDATE items SET rank = rank - 1 WHERE rank > oldRank AND rank <= newRank
    UPDATE items SET rank = newRank WHERE item_id = item.id
```

### Optimistic UI Updates

Drag-and-drop uses TanStack Query's optimistic mutation lifecycle:
1. **onMutate**: Cancel in-flight queries, snapshot current data, reorder locally
2. **onError**: Roll back to snapshot
3. **onSettled**: Revalidate from server (source of truth)

---

## Sync Logic

### Every 10 minutes (via node-cron in server.ts):

```
1. FETCH WATCHLIST
   Call GetMyeBayBuying with WatchList.Include = true
   Paginate through all pages (EntriesPerPage=200, max 400 items)
   NOTE: Known eBay bug — some responses return only 10 items regardless
         of EntriesPerPage. Verify TotalNumberOfEntries vs actual count.

2. DIFF AGAINST LOCAL DB
   For each item in API response:
     if item_id NOT in DB → INSERT as new (unranked, status=Active)
     if item_id IN DB → UPDATE price, watchers, time_left, bid_count, end_time
       if price changed → INSERT snapshot, CREATE event (price_drop or price_increase)
       if watcher count changed significantly → INSERT snapshot
         if spike detected (>20% increase in one cycle) → CREATE watcher_spike event

3. DETECT SOLD/EXPIRED
   For each item in DB (status=Active) NOT in API response:
     → Item left watchlist. Determine why:
     Call Browse API getItem(item_id) to check listing status
       if sold → status=Sold, CREATE event, FREE rank
       if ended → status=Ended, CREATE event, FREE rank
       if still active → user manually removed, mark removed_at

4. RECORD SNAPSHOT
   For all active items: INSERT price_snapshot with current price + watchers
```

### Sync Concurrency Guard

The scheduler holds a `syncing` boolean flag. If a sync is already in progress when the next cron tick fires, it skips. The manual sync API route (`POST /api/sync`) checks the same flag and returns 409 Conflict if busy.

---

## Custom Server Architecture

Next.js API routes are serverless-style — they have no stable initialization lifecycle for background tasks. The solution is a custom server entry point that owns the Node.js process.

```
Docker container runs: node dist/server.js
  ├── next() — handles all HTTP requests
  └── startScheduler() — node-cron, same event loop
                          writes to same SQLite DB
                          no lock contention (single writer)
```

### server.ts (pseudocode)

```typescript
import next from 'next'
import { createServer } from 'http'
import { parse } from 'url'
import { runMigrations } from './lib/db/migrate'
import { startScheduler } from './lib/scheduler'
import { validateConfig } from './lib/config'

async function main() {
  const config = validateConfig()       // throws if env vars missing
  runMigrations()                        // create tables if needed

  const app = next({ dev: config.NODE_ENV !== 'production' })
  await app.prepare()
  const handle = app.getRequestHandler()

  startScheduler(config)                 // register cron job

  createServer((req, res) => {
    handle(req, res, parse(req.url!, true))
  }).listen(config.PORT)

  process.on('SIGTERM', () => process.exit(0))
}

main()
```

### Build scripts (package.json)

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "next build && tsc -p tsconfig.server.json",
    "start": "node dist/server.js",
    "ebay:auth": "tsx scripts/ebay-auth.ts",
    "test:e2e": "playwright test"
  }
}
```

Two tsconfig files:
- `tsconfig.json` — Next.js App Router compilation
- `tsconfig.server.json` — Compiles `src/server.ts` + `src/lib/**` to `dist/`

---

## API Routes

### GET /api/items

Returns ranked + unranked watchlist items.

```
Query params:
  status    = Active | Sold | Ended | All (default: Active)
  sort      = rank | price | watchers | end_time (default: rank)
  dir       = asc | desc (default: asc)
  search    = text filter on title

Response: {
  data: {
    ranked: WatchlistItem[],       // items with rank, sorted by rank
    unranked: WatchlistItem[],     // rank=null, sorted by end_time
    counts: { active, sold, ended, total }
  }
}
```

### PATCH /api/rank

Update an item's rank (from drag-and-drop or manual input).

```
Body: { itemId: string, newRank: number }
Response: { data: { updated: WatchlistItem[] } }   // all items whose rank changed
```

### POST /api/sync

Trigger immediate watchlist sync (bypasses cron schedule).

```
Response: { data: { added, updated, sold, expired, duration_ms } }
409 Conflict if sync already in progress
```

### GET /api/items/[itemId]

Single item detail with recent snapshots.

```
Response: { data: { item: WatchlistItem, snapshots: PriceSnapshot[], events: Event[] } }
```

### PATCH /api/items/[itemId]

Update notes or queue status.

```
Body: { notes?: string, isInQueue?: boolean }
```

### GET /api/trends

Aggregate trend data for the portfolio dashboard.

```
Query: range = 7d | 30d | 90d

Response: { data: {
  stats: { totalItems, activeItems, soldItems, totalValue, avgWatchers, endingSoon },
  portfolio: { date, totalValue, itemCount }[],   // time series
  topPriceDrops: WatchlistItem[],
  topWatcherGains: WatchlistItem[],
  endingSoon: WatchlistItem[]
}}
```

### GET /api/events

Event log.

```
Query: type = sold | expired | price_drop | price_increase | watcher_spike | all
       limit = number (default 50)
       itemId = string (optional, filter to one item)

Response: { data: Event[] }
```

All routes use a consistent error envelope:
```typescript
// Success: { data: T }
// Error:   { error: { code: string, message: string } }
```

---

## UI Design (Yahoo Fantasy Draft Inspired)

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP BAR  [Logo]  [Watchlist] [Trends]            [Sync ↻] [⏱]  │
├──────────────────────────────────────────────────────────────────┤
│  SUGGESTIONS  [Ending Soon] [Price Drop] [Watcher Spike]  < >    │
├────────────────────────────────────────────┬─────────────────────┤
│  FILTER BAR                                │                     │
│  [🔍 Search________] [Status▼] [Type▼]    │  SIDEBAR             │
│  [Columns▼]                                │  ┌───────────────┐  │
├────────────────────────────────────────────┤  │ MY QUEUE (5)  │  │
│  TABLE                                     │  │ 1. Item A  $45│  │
│  ⠿ # │ Image │ Title    │ Price │ Δ  │ W  │  │ 2. Item B  $82│  │
│  ──┼──┼───────┼──────────┼───────┼────┼────│  │ 3. Item C  $12│  │
│  ⠿ 1 │ [img] │ Vintage..│ $45.00│ -5%│ 124│  └───────────────┘  │
│  ⠿ 2 │ [img] │ 1986 Top.│ $82.50│ +2%│  89│  ┌───────────────┐  │
│  ⠿ 3 │ [img] │ PSA 10...│ $12.00│  — │  12│  │ ACTIVITY      │  │
│  ...                                       │  │ 🔴 Item X sold│  │
│                                            │  │ 💰 Price drop  │  │
│  ─── UNRANKED ─────────────────────────────│  │ 👀 Watcher +20│  │
│    — │ [img] │ New item  │ $5.00 │  — │   3│  └───────────────┘  │
└────────────────────────────────────────────┴─────────────────────┘
```

### Dark Theme Color Palette

```
Background:     #0d1117 (deepest)
Surface:        #161b22 (cards, panels, table)
Raised:         #21262d (dropdowns, tooltips, hover)
Border:         #30363d
Text Primary:   #e6edf3
Text Secondary: #8b949e
Accent Blue:    #1d6ab5 (primary actions)

Status Colors:
  Active:       #22c55e (green)
  Sold:         #ef4444 (red)
  Ended:        #6b7280 (gray)
  Relisted:     #3b82f6 (blue)

Countdown Urgency:
  > 24 hours:   #22c55e (green, normal)
  1–24 hours:   #eab308 (yellow, caution)
  < 1 hour:     #ef4444 (red, urgent)
  < 5 minutes:  #ef4444 + pulse animation

Price Delta:
  Drop (good):  #22c55e (green — good for buyer)
  Rise (bad):   #ef4444 (red — bad for buyer)
```

### Key Interactions

| Action | Behavior |
|--------|----------|
| **Drag row** | Grip handle on left. Restricted to vertical axis. Optimistic rank update → API → revalidate. |
| **Type rank** | Click rank cell → input appears. Enter to confirm, Escape to cancel. |
| **Click title** | Navigate to `/items/[itemId]` detail page |
| **Sort column** | Click header. Toggles asc → desc → none. |
| **Filter status** | Dropdown: All / Active / Sold / Ended. Filters table rows. |
| **Filter type** | Dropdown: All / Auction / Buy It Now. |
| **Search** | Debounced (300ms) title search. Clear button. |
| **Sync button** | Shows spinner + disabled state during sync. Updates "Last synced: X ago". |
| **Countdown** | Client-side 1-second interval. Color changes by urgency. Pulses at < 5 min. |
| **Sidebar toggle** | Mobile: hamburger reveals/hides sidebar as overlay. Desktop: always visible. |
| **Queue toggle** | Star/bookmark icon on each row. Toggles isInQueue. Queue panel shows top items. |

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 768px (mobile) | Single column. Sidebar hidden (overlay on toggle). 1 suggestion card visible. |
| 768–1023px (tablet) | Table 60% + sidebar 40%. Drag disabled (touch). 2 suggestion cards. |
| ≥ 1024px (desktop) | Table `1fr` + sidebar 320px fixed. Full drag-and-drop. 4 suggestion cards. |

---

## Shared Type Contracts

All agents code against these interfaces. Defined once in `src/types/index.ts`, never duplicated.

```typescript
// === Domain Types ===

export type ListingType = 'Auction' | 'FixedPrice' | 'AuctionWithBIN'
export type ListingStatus = 'Active' | 'Sold' | 'Ended' | 'Relisted'
export type EventType = 'sold' | 'expired' | 'price_drop' | 'price_increase' | 'watcher_spike'

export interface WatchlistItem {
  id: string                    // eBay item ID (string, not numeric)
  title: string
  rank: number | null           // 1-based priority, NULL = unranked
  currentPrice: number          // USD cents (integer)
  buyItNowPrice: number | null
  shippingCost: number          // USD cents
  listingType: ListingType
  conditionName: string | null
  endTime: string | null        // ISO 8601 timestamp
  timeLeft: string | null       // ISO 8601 duration
  sellerId: string | null
  sellerFeedback: number | null
  watcherCount: number | null
  bidCount: number
  imageUrl: string | null
  listingUrl: string | null
  status: ListingStatus
  isInQueue: boolean
  notes: string | null
  firstSeenAt: string           // ISO 8601
  lastSyncedAt: string          // ISO 8601
}

export interface PriceSnapshot {
  id: number
  itemId: string
  priceCents: number
  shippingCents: number
  watcherCount: number | null
  bidCount: number
  recordedAt: string
}

export interface WatchlistEvent {
  id: number
  itemId: string
  itemTitle?: string            // joined from items table for display
  eventType: EventType
  oldValue: string | null
  newValue: string | null
  detectedAt: string
}

// === API Types ===

export interface ApiSuccess<T> { data: T }
export interface ApiError { error: { code: string; message: string } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface RankUpdateRequest {
  itemId: string
  newRank: number
}

export interface SyncResult {
  added: number
  updated: number
  sold: number
  expired: number
  durationMs: number
}

export interface TrendStats {
  totalItems: number
  activeItems: number
  soldItems: number
  totalValueCents: number
  avgWatchers: number
  endingSoon: number            // items ending within 24h
}

export interface PortfolioDataPoint {
  date: string
  totalValueCents: number
  itemCount: number
}

// === Repository Interfaces (contracts between data layer and API routes) ===

export interface ItemsRepo {
  getAll(filters?: { status?: ListingStatus; search?: string }): WatchlistItem[]
  getById(id: string): WatchlistItem | null
  upsert(item: UpsertItemInput): void
  updateRank(id: string, newRank: number): WatchlistItem[]  // returns all affected
  updateNotes(id: string, notes: string): void
  toggleQueue(id: string, inQueue: boolean): void
  markStatus(id: string, status: ListingStatus): void
  freeRank(id: string): void
}

export interface TrendsRepo {
  insertSnapshot(input: { itemId: string; priceCents: number; shippingCents: number; watcherCount: number | null; bidCount: number }): void
  getSnapshots(itemId: string, days: number): PriceSnapshot[]
  getStats(): TrendStats
  getPortfolio(days: number): PortfolioDataPoint[]
}

export interface EventsRepo {
  insert(input: { itemId: string; eventType: EventType; oldValue?: string; newValue?: string }): void
  getRecent(limit: number, type?: EventType): WatchlistEvent[]
  getForItem(itemId: string, limit: number): WatchlistEvent[]
}

export interface UpsertItemInput {
  id: string
  title: string
  currentPrice: number
  buyItNowPrice?: number | null
  shippingCost?: number
  listingType: ListingType
  conditionName?: string | null
  endTime?: string | null
  timeLeft?: string | null
  sellerId?: string | null
  sellerFeedback?: number | null
  watcherCount?: number | null
  bidCount?: number
  imageUrl?: string | null
  listingUrl?: string | null
  status: ListingStatus
}
```

---

## Error Handling Architecture

```typescript
// src/lib/errors.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 500
  ) { super(message) }
}

export class EbayApiError extends AppError {
  constructor(message: string, public readonly retryable = true) {
    super('EBAY_API_ERROR', message, 502)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super('DATABASE_ERROR', message, 500)
  }
}

// Route handler helpers — every API route uses these
export function routeOk<T>(data: T): Response {
  return Response.json({ data }, { status: 200 })
}

export function routeError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.httpStatus }
    )
  }
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

// Retry utility for eBay API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (err) {
      lastErr = err
      if (attempt < maxAttempts)
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
    }
  }
  throw lastErr
}
```

---

## next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for better-sqlite3 native addon
  serverExternalPackages: ['better-sqlite3'],

  // eBay image CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ebayimg.com' },
      { protocol: 'https', hostname: '*.ebayimg.com' },
    ],
  },

  // Exclude native modules from client bundles
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3']
    }
    return config
  },
}

module.exports = nextConfig
```

---

## Docker Setup

### Dockerfile

```dockerfile
FROM node:20-alpine AS base
# Required for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# better-sqlite3 needs native bindings at runtime
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

RUN mkdir -p /data
ENV DATABASE_PATH=/data/watchlist.db

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    container_name: ebay-watchlist
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - watchlist-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/items"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  watchlist-data:
    driver: local
```

### Hetzner Deployment

1. Provision CX22 (2 vCPU, 4GB RAM, ~€4/mo), Ubuntu 24.04
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Clone repo, create `.env`, run `docker compose up -d --build`
4. Optional: Caddy reverse proxy for HTTPS on a custom domain

---

## Team Build Plan (5 Agents, 4 Phases)

### Agent File Ownership (ZERO overlap)

| Agent | Role | Phase | Files Owned | Count |
|-------|------|-------|-------------|-------|
| **A** | Foundation | 1 (solo) | types, config, errors, utils, db client/schema/stubs, eBay auth/client, build config, Docker, auth script | ~20 |
| **B** | Data Layer | 2 (parallel) | db implementations (replaces A's stubs), sync service, event detector, scheduler, server.ts | 8 |
| **C** | API Routes | 2 (parallel) | All 6 API route handlers | 6 |
| **D** | UI Components | 2 (parallel) | All React components, hooks, store, providers, styles | ~25 |
| **E** | Pages + Tests | 3 (after B+C+D) | 3 pages, trend/detail components, all Playwright tests | ~14 |

### Phase 1 — Foundation (Agent A, solo)

**Must complete before anything else.** Agent A delivers:

- `package.json` with all dependencies installed
- `tsconfig.json` + `tsconfig.server.json`
- `next.config.js` with better-sqlite3 config
- `tailwind.config.ts` with dark theme palette
- `src/types/index.ts` with all shared interfaces
- `src/lib/config.ts` — zod env validation
- `src/lib/errors.ts` — AppError + route helpers
- `src/lib/utils.ts` — shared utilities
- `src/lib/db/client.ts` — SQLite connection (WAL mode)
- `src/lib/db/migrate.ts` + `migrations/001_initial.sql`
- `src/lib/db/items.ts` — **STUB** (correct signatures, throws NotImplementedError)
- `src/lib/db/trends.ts` — **STUB**
- `src/lib/db/events.ts` — **STUB**
- `src/lib/ebay/auth.ts` — OAuth token management
- `src/lib/ebay/client.ts` — eBay API wrapper
- `scripts/ebay-auth.ts` — One-time OAuth setup
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`, `.gitignore`

**Completion gate:** `npm run dev` boots without errors. SQLite schema created. TypeScript compiles.

### Phase 2 — Parallel Build (Agents B + C + D, simultaneously)

Three agents work at the same time. Zero file conflicts because each owns disjoint files.

**Agent B (Data Layer):**
- Replaces A's stubs in `items.ts`, `trends.ts`, `events.ts` with real SQLite implementations
- `src/lib/sync/sync-service.ts` — watchlist sync engine
- `src/lib/sync/event-detector.ts` — sold/expired/price change detection
- `src/lib/scheduler.ts` — node-cron setup
- `src/server.ts` — custom server entry point

**Agent C (API Routes):**
- All 6 route handlers in `src/app/api/`
- Thin wrappers: import from `src/lib/db/*`, call functions, wrap in `routeOk`/`routeError`
- No business logic in routes

**Agent D (UI Components):**
- `src/app/globals.css` — Tailwind dark theme
- `src/app/providers.tsx` — TanStack Query provider
- `src/store/watchlist-store.ts` — Zustand
- All hooks in `src/hooks/`
- All components in `src/components/` (ui, layout, watchlist, suggestions)

**Completion gate:** Each agent's files compile with `tsc --noEmit`. No import errors.

### Phase 3 — Assembly + Tests (Agent E)

Depends on ALL of Phase 2.

- `src/app/layout.tsx` — Root layout wiring providers
- `src/app/page.tsx` — Main page composing D's components
- `src/app/trends/page.tsx` — Trends dashboard
- `src/app/items/[itemId]/page.tsx` — Item detail
- Trend/detail components: PriceChart, WatcherChart, etc.
- All 7 Playwright test files (21 test cases)
- `playwright.config.ts`

**Completion gate:** All 3 pages render. 21/21 Playwright tests pass.

### Phase 4 — Integration (Lead)

- `docker compose build && docker compose up`
- E2E suite passes inside Docker
- Manual sync triggers and watchlist populates
- Fix any integration issues

### Dependency Graph

```
Phase 1:  [A: Foundation] ──────────────────────────────
               │
Phase 2:  ┌────┼──────────┬───────────────┐
          │    │           │               │
       [B: Data]    [C: Routes]     [D: UI Components]
          │    │           │               │
          └────┼──────────┴───────────────┘
               │
Phase 3:  [E: Pages + Tests] ───────────────────────────
               │
Phase 4:  [Integration] ───────────────────────────────
```

---

## E2E Test Plan (21 Tests)

| # | File | Test | What It Validates |
|---|------|------|-------------------|
| T01 | watchlist-table | Table renders with data rows | Core render, columns present |
| T02 | watchlist-table | Sort by price asc/desc | Column sort toggle |
| T03 | watchlist-table | Sort by watchers | Multi-column sort |
| T04 | watchlist-table | Filter by status: Sold | Status dropdown filter |
| T05 | watchlist-table | Filter by status: Active + countdown visible | Filter + timer |
| T06 | watchlist-table | Filter by listing type: Auction | Type dropdown filter |
| T07 | watchlist-table | Search filters rows by title | Debounced search |
| T08 | watchlist-table | Clear search restores all rows | Search reset |
| T09 | drag-reorder | Drag row from rank 3→1 | Drag-and-drop reorder |
| T10 | drag-reorder | Manual rank input reorders | Type-to-rank |
| T11 | item-detail | Click title navigates to detail | Navigation |
| T12 | item-detail | Detail page renders charts | Charts render |
| T13 | trends | Trends page renders stats + charts | Dashboard |
| T14 | sidebar | Event feed displays items | Activity feed |
| T15 | sync | Sync button shows loading + refreshes data | Manual sync |
| T16 | states | Empty state when no items | Empty state |
| T17 | states | Empty state with active filter | Filtered empty |
| T18 | states | Error state with retry button | Error recovery |
| T19 | states | Countdown timer decrements over time | Timer accuracy |
| T20 | sidebar | Sidebar collapses on mobile | Responsive |
| T21 | states | Column visibility toggle hides column | Column toggle |

---

## Verification Plan

1. **Phase 1 gate**: `npm run dev` boots, SQLite created, `tsc --noEmit` passes
2. **Phase 2 gate**: Each agent's files compile, API routes return data, components render
3. **Phase 3 gate**: All pages render with real data flow, 21/21 Playwright tests pass
4. **Phase 4 gate**: Docker build succeeds, app runs in container, manual sync works, E2E passes in Docker
