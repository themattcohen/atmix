# eBay Watchlist Monitor — Master Plan

> Created: 2026-02-21
> Status: RESEARCH COMPLETE — PENDING APPROVAL
> Base app: 69 source files, 21/21 E2E tests passing, Docker built, seeded 20 items
> Branch: ebay-api-research
> Last commit: 3d78c3e "feat(ebay-tracker): implement full watchlist monitor app"
> Vision: "Bloomberg Terminal for Cards" — personal sports card market intelligence platform

---

## Table of Contents

1. [Current State & Architecture](#1-current-state--architecture)
2. [Stubs & Placeholders Inventory](#2-stubs--placeholders-inventory)
3. [Pre-Expansion Fixes](#3-pre-expansion-fixes)
4. [1000-Item Seed Redesign](#4-1000-item-seed-redesign)
5. [Ranking System Scale-Up](#5-ranking-system-scale-up)
6. [Sold History Page Design](#6-sold-history-page-design)
7. [Bloomberg Terminal Vision — Top 10 Features](#7-bloomberg-terminal-vision--top-10-features)
8. [Critical Discovery: eBay Sold Data Problem](#8-critical-discovery-ebay-sold-data-problem)
9. [Feature Research Results](#9-feature-research-results)
10. [Revised Implementation Roadmap](#10-revised-implementation-roadmap)
11. [Full Business Panel Findings](#11-full-business-panel-findings)
12. [Research References](#12-research-references)

---

## 1. Current State & Architecture

### Stack
- **Framework**: Next.js 14 App Router + custom `server.ts` (boots Next.js + node-cron)
- **Database**: SQLite via better-sqlite3, WAL mode, `db/watchlist.db`
- **State**: TanStack Query v5 (server) + Zustand (UI)
- **Table**: TanStack Table v8 + dnd-kit v6 for drag-and-drop ranking
- **Charts**: Recharts (installed), custom SVG Sparkline (`src/components/ui/sparkline.tsx`)
- **Port**: 3005 (configured in config.ts, playwright.config.ts, docker-compose.yml)
- **Config**: `src/lib/config.ts` validates env with zod (EBAY_* vars optional in dev)
- **eBay SDK**: `ebay-api` v9.4.3 — Trading API (GetMyeBayBuying) + Browse API (getItem)

### Key Patterns
- API routes: `routeOk(data)` / `routeError(err)` from `src/lib/errors.ts`
- Response envelope: `{ data: T }` success, `{ error: { code, message } }` failure
- DB access: Synchronous better-sqlite3 calls in `src/lib/db/*.ts`
- Hooks: TanStack Query in `src/hooks/use-*.ts`
- Store: Zustand in `src/store/watchlist-store.ts` (filters, sidebar, queue)
- Types: All shared interfaces in `src/types/index.ts`
- Migrations: SQL files in `src/lib/db/migrations/`, auto-applied at boot

### Current DB Schema (001_initial.sql)
- `items` — item_id (PK), rank, title, current_price, shipping_cost, listing_type, condition, end_time, seller_id, watcher_count, bid_count, status, is_in_queue, notes, etc.
- `price_snapshots` — item_id (FK), price_cents, watcher_count, bid_count, recorded_at
- `events` — item_id (FK), event_type, old_value, new_value, detected_at

### E2E Test Patterns
- Mock data: `tests/e2e/helpers/mock-data.ts`
- Route interception: `page.route('**/api/items?*', ...)` + `page.route('**/api/items', ...)`
- Scoping: Use `page.locator('table')` to avoid sidebar/suggestion matches
- Error states: Must intercept ALL calls (TanStack Query retries 3x)

---

## 2. Stubs & Placeholders Inventory

### CRITICAL (4 issues — must fix before expansion)

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| S1 | `src/components/watchlist/watchlist-row.tsx` | 95-99 | Delta column always renders `—` | Wire up `getPriceDeltas()` query (see Phase 1) |
| S2 | `src/components/watchlist/watchlist-row.tsx` | 131-142 | Queue star button has no onClick handler | Add `toggleQueue(itemId)` call to Zustand store |
| S3 | `src/lib/ebay/client.ts` | 95-119 | `getItemStatus` double-prefixes item IDs (`v1|v1|...|0|0`) | Strip prefix before calling API |
| S4 | `src/app/api/items/route.ts` | 8-13 | `type` query param extracted but never passed to `getAll()` | Pass `type` filter to DB query |

### MEDIUM (7 issues)

| # | File | Line | Issue |
|---|------|------|-------|
| S5 | `src/components/watchlist/watchlist-row.tsx` | 105 | WatcherCell `trend`/`delta` props never passed |
| S6 | `src/components/watchlist/watchlist-row.tsx` | 91-93 | PriceCell `deltaPct` never computed |
| S7 | `src/lib/ebay/client.ts` | 107-109 | Sold detection via `OUT_OF_STOCK` misclassifies auctions |
| S8 | `src/lib/db/items.ts`, `trends.ts`, `events.ts` | various | Pervasive `any` types in DB layer |
| S9 | `src/app/api/trends/route.ts` | 18-21 | `topPriceDrops` sorts by cheapest price, not actual delta |
| S10 | `src/app/api/trends/route.ts` | 23-26 | `topWatcherGains` sorts by highest count, not gains |
| S11 | `src/components/watchlist/sync-button.tsx` | 19 | `lastSynced` is session-local state only |

### LOW (7 issues)

| # | File | Line | Issue |
|---|------|------|-------|
| S12 | `scripts/ebay-auth.ts` | 42-47 | `open` variable assigned but never used |
| S13 | `scripts/seed.ts` | 55 | All items use single placeholder image URL |
| S14 | Multiple files | — | `console.log/error` throughout instead of structured logger |
| S15 | `src/types/index.ts` | — | `Relisted` status defined but never assigned by sync logic |
| S16 | `src/components/detail/item-header.tsx` | 20-27 | Notes save has no error handling |
| S17 | `src/components/layout/activity-feed.tsx` | 67-70 | Raw cents displayed (should be formatted dollars) |
| S18 | `src/components/detail/item-events.tsx` | 61-64 | Raw cents displayed (should be formatted dollars) |

### Stub Identification Convention
All stubs use one of these patterns — search for them with:
```bash
grep -rn "—\|TODO\|STUB\|placeholder\|any\b" src/ --include="*.ts" --include="*.tsx"
```

---

## 3. Pre-Expansion Fixes

Before building new features, fix these stubs that would interfere with expansion work:

| Priority | Stubs | Effort | Why First |
|----------|-------|--------|-----------|
| P0 | S1, S5, S6, S9, S10 | 2 hrs | Delta/sparkline work builds on these |
| P0 | S2 | 0.5 hrs | Queue button is user-facing dead click |
| P0 | S3 | 0.5 hrs | Double-prefix breaks eBay API calls |
| P0 | S4 | 0.5 hrs | Listing type filter silently broken |
| P1 | S7 | 0.5 hrs | Sold detection affects data integrity |
| P1 | S17, S18 | 0.5 hrs | Raw cents in UI is embarrassing |
| P2 | S8 | 2 hrs | Type safety for DB layer (do alongside other DB work) |
| P2 | S11-S16 | 1.5 hrs | Polish items, batch together |

**Total pre-expansion fix effort: ~8 hours**

---

## 4. 1000-Item Seed Redesign

### Current State
- 20 items in `scripts/seed.ts`, mixed sports cards
- Single placeholder image URL for all items
- 10-15 price snapshots per item

### New Seed Design

**Distribution:**
- 1,000 total items: 200 ranked (1-200), 800 unranked
- Sport mix: Baseball 40%, Football 25%, Basketball 20%, Hockey 10%, Non-sport 5%
- Status: Active 60%, Sold 25%, Ended 15%
- Listing type: Auction 40%, BIN 45%, AuctionWithBIN 15%

**Price Buckets:**
| Range | % of Items | Count |
|-------|-----------|-------|
| $1-25 | 40% | 400 |
| $25-100 | 30% | 300 |
| $100-500 | 20% | 200 |
| $500-2000 | 7% | 70 |
| $2000+ | 3% | 30 |

**Player Pools (85 total):**
- Baseball (28): Trout, Ohtani, Acuña, Soto, Tatis Jr, Wander Franco, Gunnar Henderson, Jackson Holliday, etc.
- Football (20): Mahomes, Caleb Williams, Stroud, Herbert, Burrow, Lawrence, etc.
- Basketball (19): Wembanyama, Luka, Giannis, Curry, Edwards, etc.
- Hockey (8): McDavid, Bedard, Makar, Matthews, etc.
- Non-sport (10): Pokemon, Magic, Yu-Gi-Oh, Star Wars, Marvel, etc.

**20 Mandatory Specific Items** with real titles and realistic prices (Jordan rookie, Mantle, Trout, etc.)

**Title Generator:** `{year} {brand} {set} {player} {variation} {grade}` with per-sport brand/set pools

**Grade Distribution:** PSA 10 (15%), PSA 9 (20%), BGS 9.5 (10%), BGS 9 (10%), SGC 10 (5%), SGC 8 (5%), Raw (35%)

**Snapshot Patterns:**
- `auction_rising` — 5-8 bids, price escalates, watchers climb
- `fixed_stable` — BIN price constant, watchers slowly grow
- `fixed_dropped` — Price reduction events, watchers spike after drop
- `sold_completed` — Final price captured, 0 watchers/bids after sale
- `ended_flat` — No bids, auction ended unsold

**Total DB Rows:** ~16,450 (1,000 items + ~12,000 snapshots + ~3,000 events + ~450 misc)

### Pagination Design
- **Ranked items (200)**: All rendered for drag-and-drop (dnd-kit needs all items in DOM)
- **Unranked items (800)**: Paginated at 50/page via API `?offset=0&limit=50`
- **Split components**: `SortableWatchlistRow` (with `useSortable` hook) for ranked, `StaticWatchlistRow` (no DnD) for unranked — avoids 800 unnecessary `useSortable` hook calls

### Files to Modify
- `scripts/seed.ts` — Complete rewrite with new player pools, generators, distributions
- `src/app/api/items/route.ts` — Add `offset`/`limit` query params for unranked pagination
- `src/components/watchlist/watchlist-row.tsx` — Split into Sortable + Static variants
- `src/hooks/use-items.ts` — Add pagination support for unranked items

### Effort: ~4 hours

---

## 5. Ranking System Scale-Up

### Current State
- No hard limits in code: `min={1}`, no `max` on rank input
- `rank-cell.tsx:41` has `w-8` (32px) CSS — clips 3+ digit ranks
- `updateRank()` shift SQL is O(n) — fine for 1000 items
- `use-drag-rank.ts:47` — `newRank = newIndex + 1`, no ceiling

### Required Changes
| File | Change | Effort |
|------|--------|--------|
| `src/components/watchlist/rank-cell.tsx` | `w-8` → `w-12` (48px) for 4-digit support | 1 min |
| `src/app/api/rank/route.ts` | Add max validation: `newRank <= rankedCount + 1` | 5 min |

### No Schema Changes Needed
SQLite `UNIQUE(rank)` constraint + shift-insert pattern works at any scale. The O(n) shift-update for 200 ranked items is ~0.5ms — negligible.

**Effort: 10 minutes**

---

## 6. Sold History Page Design

### New Files (11)

| File | Purpose |
|------|---------|
| `src/lib/db/migrations/002_rank_at_sale.sql` | `ALTER TABLE items ADD COLUMN rank_at_sale INTEGER` |
| `src/lib/db/sold.ts` | All sold history queries |
| `src/app/api/sold/route.ts` | GET endpoint with filters |
| `src/hooks/use-sold.ts` | TanStack Query hook |
| `src/app/sold/page.tsx` | Page component |
| `src/components/sold/sold-summary-stats.tsx` | 6-card stats header |
| `src/components/sold/sales-timeline-chart.tsx` | Bar chart (Recharts) |
| `src/components/sold/price-histogram-chart.tsx` | Price distribution |
| `src/components/sold/watch-duration-scatter.tsx` | Scatter plot |
| `src/components/sold/sold-items-table.tsx` | Sortable table |
| `src/components/sold/sold-filter-bar.tsx` | Search + granularity toggle |

### Modified Files (4)

| File | Change |
|------|--------|
| `src/types/index.ts` | Add SoldItem, SoldStats, SalesTimelinePoint, etc. interfaces |
| `src/components/layout/top-bar.tsx` | Add "Sold History" nav link |
| `src/lib/db/items.ts` | Add `saveRankAtSale()` function |
| `src/lib/sync/sync-service.ts` | Call `saveRankAtSale()` before `freeRank()` |

### Key Design Decision
The `rank_at_sale` column is needed because `freeRank()` clears the rank when an item sells. Without capturing the rank at time of sale, sold history loses the "how high did I rank this?" signal.

### Summary Stats
1. Total revenue (sum of sold prices)
2. Items sold (count)
3. Average sale price
4. Average watch duration (days between first_seen_at and sold date)
5. Best sale (highest price)
6. Most-watched sold item (highest watcher count at sale)

### Effort: ~6 hours

---

## 7. Bloomberg Terminal Vision — Top 10 Features

Business panel analysis identified 42 features across 6 categories. After scoring by implementation feasibility (0.30), strategic impact (0.25), data availability (0.20), defensibility (0.15), and cost efficiency (0.10):

| Rank | ID | Feature | Panel Score | Research Feasibility | Effort | Key Insight |
|------|-----|---------|------------|---------------------|--------|-------------|
| 1 | A9 | AI Title Parser | 4.70 | 5/5 | 7.5 hrs | Foundational — enables all other intelligent features |
| 2 | A4 | Enhanced Sparklines | 3.80 | 5/5 | 6.5 hrs | Existing sparkline.tsx just needs wiring |
| 3 | F1 | Sentiment (MVP) | 3.80 | 5/5 | 3.25 hrs | Pure existing data — watcher heat index |
| 4 | E6 | Price Targets | 3.80 | 4/5 | 10 hrs | Piggybacks on sync cycle, no new APIs |
| 5 | C1 | Collection Inventory | 3.95 | 4/5 | 10.5 hrs | Separate table design, MVP = manual entry |
| 6 | E3 | Saved Search Monitor | 3.65 | 4/5 | 14 hrs | Browse API search already in SDK |
| 7 | A2 | Deal Score Badges | 4.15 | 3/5 | 5.5 hrs | BLOCKED — needs A1 for sold comp data |
| 8 | D2 | Historical Sales Archive | 4.15 | 3/5 | 12.5 hrs | BLOCKED — eBay Marketplace Insights API gated |
| 9 | B3 | Prospect Pipeline | 3.90 | 3/5 | 14 hrs | MLB StatsAPI free, but needs A9 for linking |
| 10 | A1 | Sold Comp Engine | 3.95 | 2.5/5 | 8.5-15 hrs | BLOCKED — sold data requires scraping or passive accumulation |

---

## 8. Critical Discovery: eBay Sold Data Problem

**The most important finding from wave 2 research:**

The eBay Finding API's `findCompletedItems` endpoint was **deprecated 2020-10-15 and fully decommissioned 2025-02-05**. The official replacement — the **Marketplace Insights API** — is classified as **"Limited Release"** and restricted to approved business partners (like Terapeak, which eBay owns). Individual developers cannot get access.

**This affects features A1, A2, and D2b.** These features depend on sold/completed listing data that is not available through official eBay APIs for independent developers.

### Options for Sold Comp Data (ranked by viability)

| # | Approach | Compliant | Data Quality | Cost | Risk |
|---|----------|-----------|-------------|------|------|
| 1 | **Passive accumulation** — capture final prices when your watchlist items sell | Yes | Limited (only your items) | Free | None |
| 2 | **Apply for Marketplace Insights API** — submit business justification to eBay | Yes | Full | Free | Low probability of approval |
| 3 | **Apify eBay scraper** — managed scraping service | Gray area | Good | ~$0.003/item | Service dependency |
| 4 | **Direct eBay web scraping** — like 130point.com does | No (ToS violation) | Excellent | Free | IP bans, HTML changes |
| 5 | **SportsCardsPro API** — catalog prices, not transaction data | Yes | Reference only | Paid sub | Not raw comps |

### Recommended Strategy
Build A1 with **passive accumulation first** (compliant, already partially coded). This establishes the storage schema and FMV calculation logic. The architecture supports plugging in any data source later. Start building the data moat from day one — even passive accumulation becomes valuable after 6 months of watching cards.

---

## 9. Feature Research Results

### A9 — AI Title Parser (RECOMMENDED FIRST BUILD)

**Feasibility: 5/5 | Effort: 7.5 hours | Dependencies: None**

Uses Claude Haiku 4.5 to extract structured data from eBay card titles:
- Player name, year, brand, set, parallel/variant
- Grade (PSA/BGS/SGC + number), serial numbering (/99, /25)
- Rookie indicator, autograph, patch/relic flags

**Cost:** ~$0.475 for 1,000 items via Batch API (50% discount). ~$0.001/item for new items via standard API.

**New package:** `@anthropic-ai/sdk`

**New table:** `card_metadata` — item_id (PK FK), player_name, year, brand, set_name, parallel, card_number, print_run, is_rookie, is_auto, is_patch, grader, grade, sport, team, raw_confidence, parsed_at

**New files (5):**
- `src/lib/ai/client.ts` — Anthropic client singleton
- `src/lib/ai/title-parser.ts` — Parsing logic + prompt + batch/single functions
- `src/lib/db/metadata.ts` — card_metadata CRUD
- `src/lib/db/migrations/002_card_metadata.sql`
- `src/app/api/metadata/route.ts` — GET/POST for triggering parse

**Why first:** A9 is foundational infrastructure. A1, A2, B3 all produce dramatically better results when card titles are parsed into structured fields. A comp search for "Gunnar Henderson PSA 10" is far more accurate than fuzzy title matching.

---

### A4 — Enhanced Sparklines

**Feasibility: 5/5 | Effort: 6.5 hours | Dependencies: None**

The codebase already has `src/components/ui/sparkline.tsx` — a 37-line custom SVG polyline component. It just needs:
1. Area fill (gradient under the line) for Bloomberg-style look
2. Color coding: green when trending down (good for buyer), red when up
3. Tooltip on hover
4. Batch snapshot query to avoid N+1 (one query for all items)

**Do NOT use Recharts for sparklines.** Recharts uses ResizeObserver per instance — 200 observers in a table causes overhead. The existing custom SVG approach is correct. Performance at 200 rows: ~5-10ms render, well under 16ms frame budget.

**Key change:** Add `getSnapshotSummaries(itemIds, days)` batch query to `src/lib/db/trends.ts`. Replace the `—` placeholder in `watchlist-row.tsx:95-99` with the Sparkline component.

---

### F1 MVP — Collector Sentiment (Watcher Heat Index)

**Feasibility: 5/5 | Effort: 3.25 hours | Dependencies: None**

The app already collects watcher_count on every sync. The MVP is pure computation over existing data:
- **Heat Index:** composite score of watcher_count + watcher_velocity + bid_count
- **Watcher velocity:** change in watcher_count per day (from price_snapshots)
- **Color coding:** red (hot/high demand), yellow (warm), gray (cold)

**No external APIs needed.** This is the highest-ROI quick win — 3.25 hours for a genuinely useful new signal.

**Optional future expansion:** Reddit integration (+7.75 hrs, requires OAuth pre-approval with 7-day wait). Twitter/X is NOT viable ($100+/month minimum). Bluesky community too small for sports cards.

---

### E6 — Price Target Automation

**Feasibility: 4/5 | Effort: 10 hours | Dependencies: None**

Users set buy/sell price targets per item. Targets evaluate during existing sync cycle — no new cron needed.

**State machine:** `active` → `triggered` → `acknowledged` (prevents re-firing)

**New table:** `price_targets` — item_id (FK), target_type ('buy_below'/'sell_above'), target_cents, is_active, triggered_at, triggered_price, acknowledged_at

**Notification:** Start with in-app events (uses existing events table + feed). Web Push (+4 hrs) and email via Resend (+3 hrs) are optional enhancements.

**Why build early:** E6 teaches the notification plumbing that E3 and B3 both need. The infrastructure is directly reusable.

---

### C1 — Collection Inventory

**Feasibility: 4/5 | Effort: 10.5 hrs MVP, 20 hrs full | Dependencies: None (A1 enhances it)**

Transforms the app from "watchlist tracker" to "watchlist + collection manager."

**Key design decision:** Separate `collection_items` table (not a status column on items). Reasons:
1. Cards bought at card shows have no eBay item_id
2. eBay listings expire/disappear, but your physical card persists forever
3. Clean separation of market intelligence vs. physical collection

**Workflow:** User clicks "Mark as Purchased" on watchlist item → modal asks for acquisition price + date → creates collection record linked to eBay item

**MVP includes:** Collection list page, add-to-collection modal, portfolio stats (invested/value/P&L), mark as sold

**Full vision adds:** Grading submission tracking (7-stage status machine), PSA cert lookup (free API), individual card detail page

**2 new tables:** `collection_items` (with optional FK to items), `grading_submissions`

---

### E3 — Saved Search Monitor

**Feasibility: 4/5 | Effort: 14 hours | Dependencies: None**

Replicates eBay's saved search + new listing alerts, but locally with your own notification preferences.

**API:** eBay Browse API `search` endpoint — already available through installed `ebay-api` SDK. `sort=newlyListed` enables efficient new-listing detection by stopping pagination once you hit an already-seen item.

**Rate limits:** 5,000 Browse API calls/day. 20 searches at 30-min polling uses ~19% of daily quota.

**New tables:** `saved_searches`, `saved_search_results` (with UNIQUE on search_id + ebay_item_id for dedup)

**Scheduling:** Per-search configurable `poll_interval_minutes`. Default 30 min. Stagger after main watchlist sync to avoid API contention.

---

### A2 — Deal Score Badges

**Feasibility: 3/5 | Effort: 5.5 hrs | BLOCKED — requires A1**

Inline badges: "Great Deal" / "Fair Price" / "Overpriced" / "Not Enough Data"

**Statistics:** Median price of sold comps (robust to outliers), IQR for price range, z-score for nuanced scoring. Separate by grade tier (PSA 10 comps shouldn't compare to raw cards).

**Cannot be built until A1 (Sold Comp Engine) provides comp data.** The scoring math and badge UI are trivial — the blocker is data supply.

---

### D2 — Historical Sales Archive

**Feasibility: 3/5 | Effort: 12.5 hrs | PARTIALLY BLOCKED**

**D2a (watchlist archive, 6 hrs):** NOT blocked. The `price_snapshots` table is already accumulating data every sync cycle. Add rollup computation (daily/weekly OHLC) + extend price chart for candlestick view. This is genuinely valuable — after 6 months you have price history eBay doesn't keep.

**D2b (sold comp archive, 6.5 hrs):** BLOCKED on A1. When A1 produces sold comp data, pipe it into a `sold_comps` table with rollup computation.

**SQLite at scale:** 200 items × 144 snapshots/day = 28,800 rows/day. After 1 year: ~10.5M rows. SQLite with WAL mode handles this fine — demonstrated at 100K+ TPS over billion-row tables.

---

### B3 — Prospect Pipeline Monitor

**Feasibility: 3/5 | Effort: 14 hours | Dependencies: A9 (soft)**

MLB StatsAPI (`statsapi.mlb.com/api/v1`) is free, no auth, stable since ~2019. Detects prospect call-ups and sends from the transaction wire.

**Key endpoints tested:**
- `/api/v1/transactions?startDate=...&endDate=...` — daily transactions
- Filter for `typeDesc` containing "Selected" or "Recalled"
- `/api/v1/people/{id}` — player detail with stats

**MLB only for v1.** NHL/NBA/NFL prospect pipelines are less well-defined in available APIs.

**The linking problem:** Connecting "Jackson Chourio called up" to your eBay watchlist items requires knowing which items are Chourio cards. This requires A9 (AI Title Parser) for reliable matching. Without A9, users must manually tag items with player names.

**Scheduling:** `0 */4 * * *` during March-October (baseball season). Off-season: disable or daily.

---

### A1 — Sold Comp Engine

**Feasibility: 2.5/5 | Effort: 8.5-15 hrs | PARTIALLY BLOCKED**

**Scenario A — Passive accumulation (8.5 hrs, compliant):**
When watchlist items reach "Sold" status, capture the final price as a comp. Builds a personal sold comps database over time, limited to items you personally watched. ~10-20 new comps/month from a 200-item watchlist.

**Scenario B — eBay scraping layer (+6.5 hrs, ToS risk):**
Scrape `ebay.com/sch/i.html?LH_Sold=1` like 130point.com does. Rate limit to 1 req/5-10 sec. For a personal tool, enforcement risk is low but non-zero.

**Build order:** A → A2 → B (passive first, then deal scores, then optional scraping enhancement)

---

## 10. Revised Implementation Roadmap

Based on research feasibility, dependencies, and build order optimization:

### Phase 0: Pre-Expansion Fixes (~8 hrs)
Fix all 18 stubs/placeholders. Prioritize S1-S4 (critical), then S5-S11 (medium).

### Phase 1: Quick Wins (~13 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| A4 Enhanced Sparklines | 6.5 hrs | Fills the "—" delta column, immediate visual impact |
| F1 Watcher Heat Index | 3.25 hrs | New insight from existing data, zero new deps |
| Sold History Page | 3 hrs | New nav tab, uses existing sold items data |

### Phase 2: Foundation (~12 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| A9 AI Title Parser | 7.5 hrs | Foundational — enables A1, A2, B3, collection metadata |
| 1000-Item Seed | 4 hrs | Realistic test data, pagination, split row components |

### Phase 3: Active Monitoring (~24 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| E6 Price Targets | 10 hrs | Teaches notification plumbing for E3/B3 |
| E3 Saved Search Monitor | 14 hrs | eBay listing alerts, highest automation value |

### Phase 4: Portfolio (~10.5 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| C1 Collection Inventory MVP | 10.5 hrs | Watchlist → collection pipeline, financial tracking |

### Phase 5: Market Intelligence (~14 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| A1 Sold Comp Engine (Scenario A) | 8.5 hrs | Passive comp accumulation + FMV calculation |
| A2 Deal Score Badges | 5.5 hrs | "Good Deal" / "Overpriced" inline badges |

### Phase 6: Sports Intelligence (~14 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| B3 Prospect Pipeline (MLB) | 14 hrs | Call-up alerts overlaid on watchlist |

### Phase 7: Data Expansion (~12.5 hrs)
| Feature | Effort | Value |
|---------|--------|-------|
| D2 Historical Sales Archive | 12.5 hrs | OHLC charts, comp archive, data moat |

### Summary

| Phase | Hours | Cumulative | What You Get |
|-------|-------|------------|--------------|
| 0 | 8 | 8 | Clean codebase, all stubs fixed |
| 1 | 13 | 21 | Sparklines, heat index, sold history — visual transformation |
| 2 | 12 | 33 | AI title parsing, 1000-item seed — intelligence foundation |
| 3 | 24 | 57 | Price targets + saved searches — automated monitoring |
| 4 | 10.5 | 67.5 | Collection inventory — "I own this card" tracking |
| 5 | 14 | 81.5 | Sold comps + deal scores — market pricing intelligence |
| 6 | 14 | 95.5 | Prospect pipeline — real-world event signals |
| 7 | 12.5 | 108 | Historical archive — data moat compounding daily |

**Total: ~108 hours across 8 phases**

Each phase ships independently and adds immediate value. Phase 0-1 transforms the existing app visually. Phase 2 lays the intelligence foundation. Phases 3-7 build the "Bloomberg Terminal for Cards" vision incrementally.

---

## 11. Full Business Panel Findings

The business panel (7 experts: Christensen, Porter, Kim/Mauborgne, Taleb, Godin, Meadows, Drucker) identified 42 features across 6 categories with a core defensibility thesis:

**eBay structurally CANNOT build buyer intelligence** — it conflicts with their seller-revenue model. Every feature that helps buyers make smarter purchasing decisions undermines eBay's auction psychology and ad revenue. This creates a permanent moat for independent buyer tools.

### All 42 Features (by category)

**A. Market Intelligence (10 features)**
A1 Sold Comp Engine, A2 Deal Score Badges, A3 Price Volatility Index, A4 Enhanced Sparklines, A5 Supply Flow Monitor, A6 Seller Intelligence, A7 Grade Premium Calculator, A8 Cross-Platform Arbitrage, A9 AI Title Parser, A10 Bid Sniper Integration

**B. News & Signals (5 features)**
B1 Player Performance Feed, B2 Injury Impact Alerts, B3 Prospect Pipeline Monitor, B4 Transaction Wire, B5 Award/Achievement Tracker

**C. Portfolio Management (8 features)**
C1 Collection Inventory, C2 Portfolio Analytics Dashboard, C3 Diversification Scoring, C4 Tax Lot Tracking, C5 Insurance Documentation, C6 Condition Tracking, C7 Watchlist-to-Collection Flow, C8 Sell Recommendation Engine

**D. Research Tools (5 features)**
D1 Card Population Reports, D2 Historical Sales Archive, D3 Seasonal Pattern Analysis, D4 Set Completion Tracker, D5 Rookie Card Index

**E. Automation (6 features)**
E1 Auto-Bid Rules, E2 Auto-Offer Bot, E3 Saved Search Monitor, E4 Restock Alerts, E5 Deal Pipeline, E6 Price Target Automation

**F. Community Intelligence (8 features)**
F1 Collector Sentiment Tracker, F2 Forum Trend Scanner, F3 YouTube Break Monitor, F4 Instagram Hype Tracker, F5 Discord Integration, F6 Market Consensus Score, F7 Whale Tracker, F8 Regional Market Differences

Full scoring matrix and expert analysis: `claudedocs/bloomberg-terminal-vision-2026-02-21.md` (1335 lines)

### Business Defensibility — Top Ideas eBay Will Never Build

| # | Feature | Why eBay Won't Copy |
|---|---------|---------------------|
| 1 | Sold Comp Badges | Discourages bidding ("this is overpriced") |
| 2 | Budget Optimizer | Portfolio thinking vs item-by-item (anti-impulse) |
| 3 | "Should I Wait?" | Anti-auction psychology |
| 4 | Seller Intelligence | Undermines seller trust |
| 5 | Player Intelligence | Requires sports data integration eBay won't build |
| 6 | Price Target Alerts | Encourages patience, reduces impulse buying |

---

## 12. Research References

### Documents in this repo
- `claudedocs/bloomberg-terminal-vision-2026-02-21.md` — Full business panel analysis (1335 lines, 42 features)
- `claudedocs/feature-expansion-plan-2026-02-21.md` — Previous session's plan (Delta, Budget, Player Intel)
- `docs/player-stats-news-research.md` — Sports API research (1097 lines)
- `docs/ebay-api-endpoints.md` — eBay API endpoint research
- `docs/ebay-watchlist-monitor-build.md` — Original build doc

### Key External Sources (from research agents)
- eBay Marketplace Insights API — Limited Release, gated to partners
- eBay Finding API `findCompletedItems` — decommissioned 2025-02-05
- eBay Browse API — 5,000 calls/day, search available, no sold data
- Anthropic Batch API — 100,000 requests/batch, 50% discount, 24hr max processing
- Claude Haiku 4.5 — $1.00/M input, $5.00/M output (standard)
- MLB StatsAPI — free, no auth, stable since 2019
- Reddit API — OAuth2 required, pre-approval needed (7-day), 100 RPM free tier
- Twitter/X API — NOT viable ($100+/month minimum, no free tier)
- PSA Public API — free with registration, cert lookup
- SQLite — handles 100K+ TPS over billion rows, WAL mode optimal

### Previous Plan Features (from feature-expansion-plan-2026-02-21.md)
The Delta Column, Budget Optimizer, and Player Intelligence Pipeline plans from the previous session are superseded by this master plan. The Delta Column work is absorbed into Phase 1 (A4 Sparklines). The Budget Optimizer (8 new files, client-side) remains valid but is not in the top 10 — can be added between Phase 2 and 3. The Player Intelligence Pipeline is partially covered by B3 (Prospect Pipeline) in Phase 6.

---

## Verification Checklist

After each phase:
1. `npm run build` succeeds
2. `npx tsc --noEmit` — zero TypeScript errors
3. All existing E2E tests pass (21/21 baseline)
4. New E2E tests added for new features
5. Docker build succeeds
6. No `any` types introduced in new code
7. All new files follow existing patterns (routeOk/routeError, repo pattern, TanStack Query hooks)

---

## Session Context (for future sessions)

This plan was generated through a 2-wave research process:

**Wave 1 (5 agents):**
1. Stubs/placeholders explorer → 18 issues (4 critical)
2. Ranking + seed analyzer → no hard limits, only CSS fix
3. Bloomberg Terminal business panel (opus) → 42 features, 1335-line doc
4. Sold History page designer → 11 new files, 4 modified
5. 1000-item seed + rank scale designer → full player pools, pagination

**Wave 2 (4 agents):**
1. Market Intelligence (A1, A2, A9) → eBay sold data is gated, A9 is foundational
2. Data & Visualization (D2, A4) → existing sparkline component, SQLite scales fine
3. Monitoring & Automation (B3, E3, E6) → E6 easiest, E3 well-scoped, B3 MLB-only
4. Portfolio & Community (C1, F1) → separate collection table, watcher heat for MVP
