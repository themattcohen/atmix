# eBay Watchlist Monitor — Feature Expansion Plan

> Created: 2026-02-21
> Status: PENDING APPROVAL
> Base app: 69 source files, 21/21 E2E tests passing, Docker built, seeded 20 items
> Branch: ebay-api-research
> Last commit: 3d78c3e "feat(ebay-tracker): implement full watchlist monitor app"

## Context

The base app is complete (69 source files, 21/21 E2E tests passing, Docker built, seeded with 20 items). The user wants to add 3 major features: **Delta column**, **Budget optimizer tab**, and **Player intelligence pipeline**. A business defensibility analysis also identified opportunities. This plan covers all 3 features in implementation order.

---

## Feature 1: Delta Column (Price Change %)

**Problem**: The table has a "Delta" column but it shows nothing. Users need to see at-a-glance whether a price went up or down since last sync.

**Data confirmed available**: `price_snapshots` table already stores price + watcher on every sync cycle. Seed data has 10-15 snapshots per item.

### Implementation

**Files to modify (3):**
- `src/lib/db/items.ts` — Add `getPriceDeltas()` query joining last 2 snapshots per item
- `src/app/api/items/route.ts` — Merge delta data into response
- `src/components/watchlist/price-cell.tsx` — Render delta badge (green %, red %)

**SQL approach:**
```sql
-- Get previous price for each active item
WITH latest AS (
  SELECT item_id, price_cents,
    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY recorded_at DESC) as rn
  FROM price_snapshots
)
SELECT
  l1.item_id,
  l1.price_cents as current_price,
  l2.price_cents as previous_price,
  ROUND((l1.price_cents - l2.price_cents) * 100.0 / l2.price_cents, 1) as delta_pct
FROM latest l1
LEFT JOIN latest l2 ON l1.item_id = l2.item_id AND l2.rn = 2
WHERE l1.rn = 1
```

**UI**: Badge next to price — green `-5%` (good for buyer), red `+3%` (bad for buyer). No change = dash.

**Bug fix**: `src/lib/db/trends.ts` `getStats()` has `topPriceDrops` sorting by lowest price instead of actual delta. Fix while here.

**Effort**: ~1 hour. No new files, no new dependencies.

---

## Feature 2: Budget Optimizer Tab

**Problem**: User has a ranked watchlist and a budget. Which items should they actually buy to maximize value within budget? This is a variant of the knapsack problem.

**Algorithm**: Tiered Greedy with multi-factor scoring (not full knapsack — items aren't divisible, but greedy is fast and explainable)

### Scoring Function

```
score(item) =
  0.40 * rankValue(rank, totalItems)     // exponential decay: higher rank = more valuable
+ 0.20 * urgencyScore(endTime)           // ending soon = higher urgency
+ 0.10 * confidenceScore(listingType)    // BIN=1.0, Auction=0.5-0.8 based on bid activity
- 0.10 * competitionPenalty(watchers, bids)
+ 0.20 * priceOpportunity(deltaHistory)  // items trending down = buying opportunity
```

### Auction Handling

Three modes for auction cost estimation:
- **Conservative**: current_price * 1.5 + shipping
- **Moderate**: current_price * 1.25 + shipping
- **Aggressive**: current_price * 1.1 + shipping

### Algorithm Flow

1. User enters budget (USD), selects auction mode
2. Score all active ranked items
3. Sort by score descending
4. Greedy allocation: add items while budget allows
5. Display: included items, total cost, remaining budget, excluded items with "why not"

### New Files (8)

| File | Purpose |
|------|---------|
| `src/app/budget/page.tsx` | Budget page with input + results |
| `src/components/budget/budget-form.tsx` | Budget input + auction mode selector |
| `src/components/budget/budget-results.tsx` | Optimized picks table |
| `src/components/budget/budget-summary.tsx` | Total cost, remaining, items in/out |
| `src/components/budget/score-breakdown.tsx` | Per-item score tooltip |
| `src/lib/budget/optimizer.ts` | Core scoring + greedy allocation |
| `src/lib/budget/scoring.ts` | Individual scoring functions |
| `src/hooks/use-budget.ts` | Zustand slice + localStorage persistence |

### Modified Files (1)
- `src/components/layout/top-bar.tsx` — Add "Budget" nav link

**No database changes.** Pure client-side computation using existing watchlist + snapshot data.

**Effort**: ~4 hours. All client-side, no API changes.

---

## Feature 3: Player Intelligence Pipeline

**Problem**: Sports card values are driven by real-world events (trades, injuries, breakout games, prospect call-ups). The user needs these signals overlaid on their watchlist to inform buy/sell timing — like stock market news for cards.

### Data Sources (all FREE)

| Source | API | Auth | Data |
|--------|-----|------|------|
| MLB StatsAPI | `statsapi.mlb.com/api/v1` | None | Stats, rosters, transactions, MiLB |
| NHL Web API | `api-web.nhle.com/v1` | None | Stats, game logs, rosters |
| ESPN Hidden API | `site.api.espn.com/apis/site/v2` | None | NFL, NBA, all sports news |
| RotoWire RSS | RSS feeds | None | 250+ player notes/day |
| eBay Browse API | Already have | OAuth | Sold comps for own items |

### AI Integration

- **Title parsing**: Claude Haiku 4.5 extracts player name + year + attributes from eBay titles → ~$0.02/month (batch, 400 items max)
- **Daily summaries**: Claude Haiku 4.5 generates 2-3 sentence intelligence briefs per player with notable activity → ~$1.50/month
- **Total AI cost**: ~$1.56/month

### New Database Tables (5)

```sql
-- Link items to players (many-to-many)
CREATE TABLE player_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(item_id),
  player_id TEXT NOT NULL,
  sport TEXT NOT NULL,           -- mlb, nfl, nba, nhl
  confidence REAL DEFAULT 1.0,
  parsed_year TEXT,
  parsed_attributes TEXT,       -- JSON: {rookie: true, auto: true, psa10: true}
  created_at TEXT DEFAULT (datetime('now'))
);

-- Player master data
CREATE TABLE players (
  player_id TEXT PRIMARY KEY,   -- sport:apiId (e.g., "mlb:682829")
  sport TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  status TEXT,                  -- active, injured, minors, retired
  external_ids TEXT,            -- JSON: {mlb: 682829, espn: 4567}
  last_updated TEXT
);

-- Player news/events
CREATE TABLE player_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(player_id),
  source TEXT NOT NULL,         -- rotowire, espn, mlb_transactions
  headline TEXT NOT NULL,
  summary TEXT,
  news_type TEXT,               -- injury, trade, callup, breakout, general
  impact_score INTEGER,         -- -3 to +3 (AI-assessed impact on card value)
  published_at TEXT,
  fetched_at TEXT DEFAULT (datetime('now'))
);

-- Player stat snapshots (daily)
CREATE TABLE player_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(player_id),
  stat_type TEXT NOT NULL,      -- season, game_log, career
  season TEXT,
  stats_json TEXT NOT NULL,     -- Full stats object
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- AI-generated intelligence briefs
CREATE TABLE player_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(player_id),
  brief TEXT NOT NULL,          -- 2-3 sentence AI summary
  signals TEXT,                 -- JSON: [{type: "breakout", impact: 2}]
  generated_at TEXT DEFAULT (datetime('now'))
);
```

### Implementation Phases

**Phase A — Title Parsing + Player Linking** (~2 hrs)
- `src/lib/intelligence/title-parser.ts` — Claude Haiku batch parse item titles → player names
- `src/lib/intelligence/player-resolver.ts` — Name → player ID via MLB/ESPN APIs
- `src/lib/db/players.ts` — Player CRUD
- `src/lib/db/player-links.ts` — Item-player link CRUD
- Migration: `002_player_intelligence.sql`

**Phase B — Stats + News Fetching** (~3 hrs)
- `src/lib/intelligence/stats-fetcher.ts` — MLB StatsAPI + NHL Web API + ESPN
- `src/lib/intelligence/news-fetcher.ts` — RotoWire RSS + ESPN news
- `src/lib/intelligence/scheduler.ts` — Cron jobs: stats every 6hrs, news every 30min
- Wire into `src/server.ts` alongside existing sync scheduler

**Phase C — AI Summaries** (~2 hrs)
- `src/lib/intelligence/brief-generator.ts` — Claude Haiku daily summary per active player
- `src/lib/db/player-briefs.ts` — Brief storage/retrieval

**Phase D — UI Integration** (~3 hrs)
- `src/components/watchlist/player-intel-cell.tsx` — Inline player badge in table row
- `src/components/detail/player-intel-panel.tsx` — Full player intelligence on detail page
- `src/app/api/players/route.ts` — GET player data + news + briefs
- `src/app/api/players/[playerId]/route.ts` — Single player detail
- Modify `src/components/watchlist/watchlist-row.tsx` — Add player intel column

**Effort**: ~10 hours total across 4 phases. Can be built incrementally.

---

## Build Order

```
1. Delta Column      (~1 hr)  — 3 files modified, immediate value
2. Budget Optimizer   (~4 hrs) — 8 new files, 1 modified, all client-side
3. Player Intel A+B   (~5 hrs) — Backend: parsing, linking, fetching
4. Player Intel C+D   (~5 hrs) — AI briefs + UI integration
```

Delta first (smallest, highest ROI). Budget second (self-contained). Player intel last (most complex, can ship phases A+B independently).

---

## Business Defensibility Notes

From the business panel analysis — eBay structurally CANNOT build buyer intelligence (conflicts with their seller-revenue model). Features that exploit this gap:

1. **Sold Comp Badges** (future) — Show "Good Deal" / "Overpriced" badges based on recent sold data via Browse API. eBay won't do this because it discourages bidding.
2. **"Should I Wait?" Indicator** (future) — Predict whether price will drop based on supply/demand signals. Anti-marketplace by design.
3. **Budget Optimizer** (this plan) — Portfolio-level buying strategy. eBay only thinks item-by-item.
4. **Player Intelligence** (this plan) — Real-world signals overlaid on card values. eBay has no sports data integration.

These features are **defensible weekend builds** — each takes a few hours but creates a tool eBay would never build because it undermines their auction psychology.

### Full Business Panel Findings (8 Ranked Ideas)

| # | Feature | Effort | Impact | Why eBay Won't Copy |
|---|---------|--------|--------|---------------------|
| 1 | Sold Comp Badges | 6-8 hrs | HIGH | Discourages bidding |
| 2 | Budget Optimizer / Draft Board | 3-4 hrs | HIGH | Portfolio thinking vs item-by-item |
| 3 | "Should I Wait?" Indicator | 5-6 hrs | HIGH | Anti-auction psychology |
| 4 | Seller Intelligence Panel | 4-5 hrs | MED | Undermines seller trust |
| 5 | Collection Checklist Engine | 8-10 hrs | MED | Collector-specific, niche |
| 6 | Cross-Platform Price Check | 8-10 hrs | MED | Multi-platform = anti-eBay |
| 7 | PSA Pop Report Context | 6-8 hrs | MED | Requires external data |
| 8 | Shareable Comp Check Links | 4-5 hrs | LOW | Commoditizes pricing |

---

## Research References

- **Player stats/news research**: `docs/player-stats-news-research.md` (1097 lines, full API details)
- **eBay API research**: `docs/ebay-api-endpoints.md` (existing)
- **Build doc**: `docs/ebay-watchlist-monitor-build.md` (existing)

---

## Verification

1. **Delta**: After implementation, verify delta % shows in table by checking price_snapshots data. Run existing E2E tests (21/21 should still pass). Add T22 test for delta badge visibility.
2. **Budget**: Navigate to `/budget`, enter $500, verify scored items appear. Add T23 test for budget page render + optimization results.
3. **Player Intel**: After Phase A, verify title parsing links items to players. After Phase D, verify player badges show in table rows. Add T24-T25 tests.
4. **All**: `npm run build` succeeds. Docker build succeeds. No TypeScript errors.

---

## Session Context (for future sessions)

### Current App Architecture
- **Framework**: Next.js 14 App Router + custom `server.ts` (boots Next.js + node-cron)
- **Database**: SQLite via better-sqlite3, WAL mode, `db/watchlist.db`
- **State**: TanStack Query (server) + Zustand (UI)
- **Table**: TanStack Table v8 + dnd-kit for drag-and-drop
- **Charts**: Recharts
- **Port**: 3005 (configured in config.ts, playwright.config.ts, docker-compose.yml)
- **Config**: `src/lib/config.ts` validates env with zod (EBAY_* vars optional in dev)

### Key Patterns
- API routes: `routeOk(data)` / `routeError(err)` from `src/lib/errors.ts`
- Response envelope: `{ data: T }` success, `{ error: { code, message } }` failure
- DB access: Synchronous better-sqlite3 calls in `src/lib/db/*.ts`
- Hooks: TanStack Query in `src/hooks/use-*.ts`
- Store: Zustand in `src/store/watchlist-store.ts` (filters, sidebar, queue)
- Types: All shared interfaces in `src/types/index.ts`

### E2E Test Patterns
- Mock data: `tests/e2e/helpers/mock-data.ts`
- Route interception: `page.route('**/api/items?*', ...)` + `page.route('**/api/items', ...)`
- Scoping: Use `page.locator('table')` to avoid sidebar/suggestion matches
- Error states: Must intercept ALL calls (TanStack Query retries 3x)
- Mobile sidebar: sidebarOpen defaults true, backdrop click at `{x: 20, y: 300}`
