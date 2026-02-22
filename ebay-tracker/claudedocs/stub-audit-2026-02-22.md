# Stub, Placeholder & Wiring Audit — 2026-02-22

Antagonistic code audit performed by 4 parallel research agents examining every file in the news signal pipeline, seed data, API routes, hooks, and UI components.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Unfixed — pipeline fundamentally broken for non-MLB |
| HIGH | 4 | Unfixed — missing UI mount, hardcoded values |
| MEDIUM | 6 | Unfixed — fragile parsers, placeholder data |
| LOW | 3 | Unfixed — dead exports, unused props |
| WIRING | 0 issues | All 20 API routes, 15 hooks, 5 scheduler jobs correctly connected |

---

## CRITICAL

### C1. Player Matcher — Fuse.js Scoring Bug
**File**: `src/lib/news/matching/player-matcher.ts:38`
**Bug**: `if (!result || result.score === undefined || result.score >= 0.3) return null`
**Problem**: Fuse.js uses **inverted scoring** — `0 = perfect match`, `1 = no match`. The threshold `>= 0.3` **rejects good matches** (score 0.05–0.29) and only accepts terrible ones (0.3+). This means the entire player matching pipeline silently discards almost every valid match.
**Fix**: Change to `result.score > 0.3` or better: `result.score <= 0.3` to accept good matches (low scores).

### C2. MLB-Only Pipeline — Roster Sync
**File**: `src/lib/news/matching/roster-sync.ts:21`
**Bug**: Hardcoded `https://statsapi.mlb.com/api/v1/sports/1/players?season=${year}` — only fetches MLB players.
**Impact**: The `player_roster` table will never contain NBA, NFL, or NHL players. Any non-baseball cards in the watchlist are invisible to the signal pipeline.
**Scope**: 47 of 200 seed items are non-baseball (19 basketball, 20 football, 8 hockey) — **23.5% of watchlist gets zero signals forever**.

### C3. MLB-Only Pipeline — News Sources
**Files**:
- `src/lib/news/sources/google-news-rss.ts:25` — queries `"MLB baseball player news"` and `"baseball prospect callup"`
- `src/lib/news/sources/rotowire-rss.ts` — fetches `rotowire.com/baseball/news.php`
- `src/lib/news/sources/mlb-transactions.ts` — fetches `statsapi.mlb.com/api/v1/transactions`
- `src/lib/news/scoring/event-classifier.ts:42-50` — keyword patterns like "sent down", "designated for assignment" are baseball-specific terminology

**Impact**: All 3 news sources and the event classifier are MLB-only. No NBA/NFL/NHL news will ever be ingested, classified, or scored.

---

## HIGH

### H1. Signal Toast Never Rendered
**File**: `src/components/signals/signal-toast.tsx` exists with full implementation
**Bug**: `SignalToastContainer` is never mounted in any layout, page, or component. The toast system polls `/api/signals` and renders floating notifications for high-impact signals (|score| >= 2), but the component is orphaned.
**Fix**: Add `<SignalToastContainer />` to `src/app/layout.tsx` or the main app shell.

### H2. Hardcoded Score Calculator Values
**File**: `src/lib/news/scoring/score-calculator.ts:3-23`
**Issue**: `BASE_SCORES` map has arbitrary integer values (`callup: 3`, `injury_major: -3`, `trade: 1`, etc.) that are not derived from the research data in the feasibility doc. The feasibility doc has a 28-row Master Impact Scoring Reference Table with sub-types (injury_minor vs injury_season, trade_up vs trade_down) that are not reflected here.
**Impact**: Signal scores are rough approximations, not calibrated to actual market impact data.

### H3. Circuit Breaker Arbitrary Thresholds
**File**: `src/lib/news/circuit-breaker.ts`
**Issue**: `MAX_FAILURES = 3`, `PAUSE_DURATION_MS = 30 * 60 * 1000` (30 min) are magic numbers with no tuning rationale. No alerting, no exponential backoff, no partial recovery.
**Impact**: A single flaky DNS resolution could pause a source for 30 minutes. No visibility into circuit breaker state from the UI.

### H4. Source Confidence Multipliers Arbitrary
**File**: `src/lib/news/scoring/score-calculator.ts`
**Issue**: Source confidence multipliers (MLB: 0.95, RotoWire: 0.85, Google News: 0.65) and composite confidence formula (40% source + 30% classification + 30% match) are invented values with no empirical basis.

---

## MEDIUM

### M1. Placeholder Seed Images
**File**: `src/lib/db/seed.ts` (lines ~437-443)
**Issue**: All 200 seed items use `https://placehold.co/` URLs for `imageUrl`. These are generic gray placeholder squares, not actual card images.
**Impact**: Visual-only — app works but looks obviously fake in the image column.

### M2. Synthetic eBay URLs in Seed Data
**File**: `src/lib/db/seed.ts`
**Issue**: All `ebayUrl` values are `https://www.ebay.com/itm/FAKE_ID_XXX` — not real eBay listing URLs.
**Impact**: "View on eBay" links go to 404 pages. Functional but misleading.

### M3. Title Parser Fragility
**File**: `src/lib/news/matching/title-parser.ts:15`
**Issue**: Regex-based parser strips known brands (Topps, Bowman, Panini...) and card attributes (PSA, AUTO, RC...) then finds longest run of consecutive Title-Case words. This approach:
- Fails on names with lowercase particles ("de la Cruz", "van Meter")
- Fails on single-name players or nicknames
- Fails on titles with unusual formatting ("MIKE TROUT" all-caps)
- No unit tests for edge cases

### M4. RSS Feed URL Fragility
**Files**:
- `src/lib/news/sources/rotowire-rss.ts` — URL `rotowire.com/baseball/news.php?rss=1` is undocumented and may break or require auth
- `src/lib/news/sources/google-news-rss.ts` — Google News RSS is deprecated/unofficial, may be rate-limited or removed

**Impact**: Sources could silently fail. Circuit breaker would pause them, but no alerting mechanism exists.

### M5. No Signal Decay / Expiration Logic
**File**: `src/lib/news/index.ts`
**Issue**: `expires_at` column exists in `card_signals` table and the scheduler has a daily cleanup job, but `expires_at` is never set during signal creation. All signals persist indefinitely.
**Impact**: Stale signals (e.g., a 3-month-old callup) remain visible with no visual indication of staleness.

### M6. Seed Data Sport Distribution Mismatch
**File**: `src/lib/db/seed.ts`
**Issue**: Seed data includes cards for 4 sports (baseball, basketball, football, hockey) but the pipeline only supports baseball. Users see non-baseball cards in watchlist but they'll never get signals, creating a confusing asymmetry.

---

## LOW

### L1. Deprecated WatchlistRow Export
**File**: `src/components/watchlist/watchlist-row.tsx:184-185`
**Issue**: `export const WatchlistRow = SortableWatchlistRow` with `@deprecated` JSDoc. Dead export, no consumers.

### L2. TargetBadge onClick Prop Unused
**File**: `src/components/items/target-badge.tsx`
**Issue**: Component accepts an `onClick` prop that is never passed by any consumer.

### L3. Types Declare More Sports Than Pipeline Supports
**File**: `src/types/index.ts`
**Issue**: `NewsEventType` includes 13 event types and `RosterPlayer` has `sport: string` field supporting any sport, but the pipeline implementation only handles baseball. Types suggest multi-sport capability that doesn't exist.

---

## Wiring Status (All Clear)

### API Routes — 20/20 Connected
| Route | Method | Consumer |
|-------|--------|----------|
| `/api/items` | GET | `useWatchlist()` |
| `/api/items` | POST | `useAddItem()` |
| `/api/items/[itemId]` | GET | `useItemDetail()` |
| `/api/items/[itemId]` | PATCH | `useQueueToggle()`, `useUpdateItem()` |
| `/api/items/[itemId]` | DELETE | `useDeleteItem()` |
| `/api/trends` | GET | `useHeatIndex()` |
| `/api/events` | GET | `useEvents()` |
| `/api/snapshots` | GET | `useSparklines()` |
| `/api/snapshots/watchers` | GET | `useWatcherSeries()` |
| `/api/targets` | GET/POST | `useTargets()` |
| `/api/targets/[targetId]` | PATCH/DELETE | `useUpdateTarget()`, `useDeleteTarget()` |
| `/api/signals` | GET | `useSignals()` |
| `/api/signals/stats` | GET | `useSignalStats()` |
| `/api/signals/[signalId]` | PATCH | `useAcknowledgeSignal()` |
| `/api/roster` | GET | (admin/debug only) |
| `/api/rank` | POST | `useDragRank()` |

### Hooks — 15/15 Connected
All hooks in `src/hooks/` have matching API consumers and are imported by at least one component.

### Scheduler Jobs — 5/5 Connected
| Job | Schedule | Function |
|-----|----------|----------|
| eBay sync | `*/10 * * * *` | `syncItems()` |
| RotoWire | `2,12,22,32,42,52 * * * *` | `runSourceIngestion('rotowire_rss')` |
| MLB Transactions | `4,34 * * * *` | `runSourceIngestion('mlb_transactions')` |
| Google News | `8,38 * * * *` | `runSourceIngestion('google_news_rss')` |
| Signal cleanup | `0 3 * * *` | `deleteExpired()` |
| Roster sync | `0 2 * * 1` | `syncRoster()` |

---

## Recommended Fix Priority

### Immediate (before any signal pipeline testing)
1. **C1** — Fix Fuse.js scoring inversion (1-line fix, currently breaks ALL player matching)
2. **H1** — Mount `<SignalToastContainer />` in layout (1-line addition)

### Before launch
3. **H2** — Calibrate score values against feasibility doc research data
4. **M5** — Set `expires_at` during signal creation based on event type decay model
5. **M3** — Add unit tests for title parser edge cases

### Multi-sport expansion (separate feature)
6. **C2 + C3** — Add NBA, NFL, NHL sources, roster APIs, and sport-specific event classifiers
7. **M6** — Either remove non-baseball seed data or implement multi-sport support

### Nice-to-have
8. **H3 + H4** — Tune circuit breaker and confidence multipliers with real data
9. **M1 + M2** — Replace placeholder images and synthetic eBay URLs with real data
10. **M4** — Add RSS feed health monitoring and fallback sources
