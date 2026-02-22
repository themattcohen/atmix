# eBay Watchlist Monitor — Master Implementation Plan

**Date**: 2026-02-21
**Scope**: Tier 1 (4 features) + Tier 2 (3 features) + 1000-Seed Cards
**Constraint**: Research & planning only — no implementation until approved

---

## 1. Feature Inventory

| # | Feature | Design Doc | Effort | External Deps | Status |
|---|---------|-----------|--------|---------------|--------|
| 1 | Delta Column | `design-delta-column.md` | 1 hr | None | Design complete |
| 2 | A4 Enhanced Sparklines | `design-a4-sparklines.md` | 6.5 hrs | None | Design complete |
| 3 | D2a Price History Rollups | `design-d2-historical-archive.md` | 3-4 hrs | None | Design complete |
| 4 | Budget Optimizer | `design-budget-optimizer.md` | 4 hrs | None | Design complete |
| 5 | E6 Price Target Alerts | `design-e6-price-targets.md` | 4-6 hrs | None | Design complete |
| 6 | A9 AI Title Parser | `design-a9-title-parser.md` | 4-6 hrs | Anthropic API | Design complete |
| 7 | F1 Collector Sentiment | `design-f1-sentiment.md` | 3.5 hrs | None | Design complete |
| 8 | 1000-Item Seed Redesign | `design-1000-seed.md` | 4 hrs | None | Design complete |

**Total agent-hours**: ~33 hrs
**Total elapsed time** (with parallelism): ~17 hrs across 2 waves

---

## 2. File Conflict Analysis

These files are touched by multiple features. **Two agents must NEVER edit the same file.**

| Shared File | Features | Resolution |
|-------------|----------|------------|
| `src/types/index.ts` | ALL 8 features | **Pre-step**: Lead adds ALL types before any agent starts |
| `src/lib/db/trends.ts` | Delta, Sparklines, Heat Index | **Same agent** handles all three |
| `src/app/api/items/route.ts` | Delta, Sparklines, Heat Index, 1000-Seed | Same agent for first 3; Seed agent runs in Wave 2 |
| `src/app/api/trends/route.ts` | Delta, Heat Index | Same agent |
| `src/components/watchlist/watchlist-row.tsx` | Delta, Sparklines, Heat Index, 1000-Seed | Same agent for first 3; Seed renames it in Wave 2 |
| `src/components/watchlist/watchlist-table.tsx` | Sparklines, 1000-Seed | Sparklines agent in Wave 1; Seed in Wave 2 |
| `src/lib/sync/sync-service.ts` | E6, A9 | E6 in Wave 1; A9 in Wave 2 |
| `002_*.sql` migration collision | E6, D2, A9 | Renumber: E6=002, D2=003, A9=004 |

---

## 3. Migration Numbering Resolution

| Order | Migration File | Feature | Rationale |
|-------|---------------|---------|-----------|
| 002 | `002_price_targets.sql` | E6 Price Targets | Simplest schema, no FK deps on other new tables |
| 003 | `003_price_rollups.sql` | D2 Historical Archive | Independent of 002, processes existing snapshots |
| 004 | `004_card_metadata.sql` | A9 Title Parser | Benefits from E6/D2 being in place first |

---

## 4. Agent Team Design

### Pre-Step: Lead Agent (30 min)

**Owner**: Main session (coordinator)

**Tasks**:
1. Add ALL new TypeScript types to `src/types/index.ts` from all 8 design docs:
   - `PriceDelta`, `SparklineSummary`, `SnapshotSummariesResponse`
   - `HeatTier`, `HeatIndex`
   - `AuctionMode`, `ExcludedReason`, `ScoreBreakdown`, `ScoredItem`, `OptimizationResult`
   - `TargetType`, `TargetStatus`, `PriceTarget`, `CreateTargetInput`, `UpdateTargetInput`
   - `PriceRollup`, `RollupPeriod`, `OHLCDataPoint`
   - `GradingCompany`, `CardMetadata`, `ParsedTitle`, etc.
   - Extend `EventType` union with `'target_triggered'`
   - Extend `TrendsRepo` with new function signatures
2. Renumber migrations in design docs (002/003/004)
3. Verify `package.json` has all needed deps (Recharts, dnd-kit, better-sqlite3 — all present)
4. Add `@anthropic-ai/sdk` to package.json (needed by A9)

**Exclusive files**: `src/types/index.ts`, `package.json`

---

### Wave 1: Four Parallel Agents (~11 hrs elapsed, limited by Agent D)

#### Agent A — Budget Optimizer
**Type**: `frontend-architect` (sonnet)
**Effort**: 4 hrs
**Design doc**: `design-budget-optimizer.md`

**Exclusive files** (NEW):
- `src/lib/budget/scoring.ts`
- `src/lib/budget/optimizer.ts`
- `src/hooks/use-budget.ts`
- `src/app/budget/page.tsx`
- `src/components/budget/budget-form.tsx`
- `src/components/budget/budget-results.tsx`
- `src/components/budget/budget-summary.tsx`
- `src/components/budget/score-breakdown.tsx`

**Exclusive files** (MODIFIED):
- `src/components/layout/top-bar.tsx` — add Budget nav link

**Zero conflicts with any other Wave 1 agent.**

---

#### Agent B — E6 Price Target Alerts
**Type**: `backend-architect` (sonnet)
**Effort**: 4-6 hrs
**Design doc**: `design-e6-price-targets.md`

**Exclusive files** (NEW):
- `src/lib/db/migrations/002_price_targets.sql`
- `src/lib/db/targets.ts`
- `src/lib/sync/target-evaluator.ts`
- `src/app/api/targets/route.ts`
- `src/app/api/targets/[targetId]/route.ts`
- `src/hooks/use-targets.ts`
- `src/components/items/target-badge.tsx`
- `src/components/items/target-form.tsx`
- E2E tests

**Exclusive files** (MODIFIED):
- `src/lib/sync/sync-service.ts` — add `evaluateTargets()` call after `insertSnapshot`
- `src/components/layout/activity-feed.tsx` — add `target_triggered` event rendering

**Zero conflicts with any other Wave 1 agent.**

---

#### Agent C — D2a Price History Rollups
**Type**: `backend-architect` (sonnet)
**Effort**: 3-4 hrs
**Design doc**: `design-d2-historical-archive.md` (D2a portion only — price rollups, NOT comp rollups)

**Exclusive files** (NEW):
- `src/lib/db/migrations/003_price_rollups.sql` (price_rollups table ONLY, skip comp_rollups)
- `src/lib/db/rollups.ts`
- `src/lib/archive/rollup-service.ts`
- `src/app/api/history/[itemId]/route.ts`
- `src/app/api/history/[itemId]/summary/route.ts`
- `src/hooks/use-history.ts`
- `src/components/detail/ohlc-chart.tsx`
- `scripts/backfill-rollups.ts`
- E2E tests

**Exclusive files** (MODIFIED):
- `src/lib/scheduler.ts` — add rollup cron job at 00:05 UTC
- `src/app/item/[itemId]/page.tsx` — add OHLC chart below existing charts

**Zero conflicts with any other Wave 1 agent.**

---

#### Agent D — Table Enhancements (Delta + Sparklines + Heat Index)
**Type**: `frontend-architect` (sonnet)
**Effort**: 11 hrs (1 + 6.5 + 3.5, sequential within agent)
**Design docs**: `design-delta-column.md` → `design-a4-sparklines.md` → `design-f1-sentiment.md`

**CRITICAL PATH** — this is the longest-running agent in Wave 1.

**Why one agent**: These three features all modify `trends.ts`, `items/route.ts`, `watchlist-row.tsx`, and `trends/route.ts`. Splitting them across agents would cause file conflicts.

**Implementation order within agent**:
1. **Delta Column** (1 hr): Add `getPriceDeltas()` to `trends.ts`, merge into `items/route.ts`, wire `deltaPct` to `PriceCell`. Fix `topPriceDrops` bug in `trends/route.ts`.
2. **A4 Sparklines** (6.5 hrs): Add `getSnapshotSummaries()` to `trends.ts`, create `/api/snapshots` route, enhance `sparkline.tsx`, create `sparkline-cell.tsx` + `use-sparklines.ts`, add sparkline days to Zustand store, integrate into `watchlist-row.tsx` and `watchlist-table.tsx`.
3. **F1 Heat Index** (3.5 hrs): Add `getHeatIndexBatch()` to `trends.ts`, merge heat data into `items/route.ts`, enhance `watcher-cell.tsx` with heat dot, fix S5 (dead props) and S10 (wrong sort). Fix `topWatcherGains` in `trends/route.ts`.

**Exclusive files** (NEW):
- `src/app/api/snapshots/route.ts`
- `src/hooks/use-sparklines.ts`
- `src/components/watchlist/sparkline-cell.tsx`
- E2E tests for all three features

**Exclusive files** (MODIFIED):
- `src/lib/db/trends.ts` — 3 new functions added sequentially
- `src/app/api/items/route.ts` — delta map, then sparkline data, then heat index
- `src/app/api/trends/route.ts` — topPriceDrops fix, then topWatcherGains fix
- `src/components/watchlist/watchlist-row.tsx` — deltaPct prop, then sparkline cell, then heat prop
- `src/components/watchlist/watchlist-table.tsx` — sparkline hook + props
- `src/components/ui/sparkline.tsx` — full enhancement
- `src/components/watchlist/watcher-cell.tsx` — heat dot + S5 fix
- `src/store/watchlist-store.ts` — sparklineDays preference
- `src/hooks/use-sync.ts` — sparkline cache invalidation

---

### Wave 2: Two Parallel Agents (~6 hrs elapsed)

**Prerequisite**: Wave 1 fully complete. All Wave 1 file changes are committed.

#### Agent E — 1000-Item Seed Redesign
**Type**: `general-purpose` (sonnet)
**Effort**: 4 hrs
**Design doc**: `design-1000-seed.md`

**Exclusive files** (NEW):
- `src/components/watchlist/static-watchlist-row.tsx`
- E2E tests (seed integrity + pagination)

**Exclusive files** (MODIFIED):
- `scripts/seed.ts` — full rewrite
- `src/lib/db/items.ts` — add `getUnrankedPage(offset, limit)`
- `src/app/api/items/route.ts` — add offset/limit params, `unrankedTotal` in response
- `src/components/watchlist/watchlist-table.tsx` — split ranked/unranked rendering, Load More
- `src/components/watchlist/watchlist-row.tsx` → rename to `sortable-watchlist-row.tsx`

**No conflicts with Agent F** (different files entirely).

---

#### Agent F — A9 AI Title Parser
**Type**: `backend-architect` (sonnet)
**Effort**: 4-6 hrs
**Design doc**: `design-a9-title-parser.md`

**Exclusive files** (NEW):
- `src/lib/db/migrations/004_card_metadata.sql`
- `src/lib/ai/client.ts`
- `src/lib/ai/title-parser.ts`
- `src/lib/db/metadata.ts`
- `src/app/api/metadata/route.ts`
- `src/app/api/metadata/parse/route.ts`
- `src/app/api/metadata/parse-batch/route.ts`
- `src/app/api/metadata/batch/[batchId]/route.ts`
- `src/hooks/use-metadata.ts`
- E2E tests

**Exclusive files** (MODIFIED):
- `src/lib/sync/sync-service.ts` — add fire-and-forget `parseSingleAndStore()` call
- `src/lib/config.ts` — add `ANTHROPIC_API_KEY` config
- `src/lib/errors.ts` — add AI error subclasses

**No conflicts with Agent E** (different files entirely).

---

### Wave 3: Integration & Verification (Lead agent, 1-2 hrs)

1. Run full E2E test suite across all features
2. Verify seed script generates 1000 items correctly
3. Test feature interactions (e.g., sparklines + delta column + heat index all rendering in same row)
4. Test pagination with all table enhancements active
5. Verify no migration ordering issues
6. Fix any cross-feature integration issues

---

## 5. File Ownership Matrix

| File | Pre-step | Agent A | Agent B | Agent C | Agent D | Agent E | Agent F |
|------|----------|---------|---------|---------|---------|---------|---------|
| `types/index.ts` | WRITE | — | — | — | — | — | — |
| `package.json` | WRITE | — | — | — | — | — | — |
| `top-bar.tsx` | — | WRITE | — | — | — | — | — |
| `budget/*` (8 files) | — | WRITE | — | — | — | — | — |
| `sync-service.ts` | — | — | WRITE | — | — | — | WRITE* |
| `activity-feed.tsx` | — | — | WRITE | — | — | — | — |
| `targets/*` (8 files) | — | — | WRITE | — | — | — | — |
| `002_price_targets.sql` | — | — | WRITE | — | — | — | — |
| `scheduler.ts` | — | — | — | WRITE | — | — | — |
| `rollups.ts` | — | — | — | WRITE | — | — | — |
| `history/*` routes | — | — | — | WRITE | — | — | — |
| `ohlc-chart.tsx` | — | — | — | WRITE | — | — | — |
| `003_price_rollups.sql` | — | — | — | WRITE | — | — | — |
| `item/[itemId]/page.tsx` | — | — | — | WRITE | — | — | — |
| `trends.ts` | — | — | — | — | WRITE | — | — |
| `items/route.ts` | — | — | — | — | WRITE | WRITE* | — |
| `watchlist-row.tsx` | — | — | — | — | WRITE | WRITE* | — |
| `watchlist-table.tsx` | — | — | — | — | WRITE | WRITE* | — |
| `trends/route.ts` | — | — | — | — | WRITE | — | — |
| `sparkline.tsx` | — | — | — | — | WRITE | — | — |
| `watcher-cell.tsx` | — | — | — | — | WRITE | — | — |
| `watchlist-store.ts` | — | — | — | — | WRITE | — | — |
| `use-sync.ts` | — | — | — | — | WRITE | — | — |
| `snapshots/route.ts` | — | — | — | — | WRITE | — | — |
| `seed.ts` | — | — | — | — | — | WRITE | — |
| `items.ts` (db) | — | — | — | — | — | WRITE | — |
| `static-watchlist-row.tsx` | — | — | — | — | — | WRITE | — |
| `ai/*` (2 files) | — | — | — | — | — | — | WRITE |
| `metadata.ts` (db) | — | — | — | — | — | — | WRITE |
| `metadata/*` routes | — | — | — | — | — | — | WRITE |
| `004_card_metadata.sql` | — | — | — | — | — | — | WRITE |
| `config.ts` | — | — | — | — | — | — | WRITE |
| `errors.ts` | — | — | — | — | — | — | WRITE |

*Wave 2 agents — no conflict because Wave 1 is complete before Wave 2 starts.

---

## 6. Dependency Graph

```
PRE-STEP (types + migrations + deps)
    │
    ├──────────────────────────────────────────┐
    │              WAVE 1 (parallel)           │
    │                                          │
    ├─ Agent A: Budget Optimizer     (4 hrs)   │
    ├─ Agent B: E6 Price Targets     (5 hrs)   │
    ├─ Agent C: D2a Price Rollups    (4 hrs)   │
    └─ Agent D: Table Enhancements   (11 hrs)  │ ← CRITICAL PATH
                    │ Delta (1h)               │
                    │ Sparklines (6.5h)         │
                    │ Heat Index (3.5h)         │
    ───────────────────────────────────────────┘
                    │
                    │ commit + verify
                    │
    ├──────────────────────────┐
    │    WAVE 2 (parallel)     │
    │                          │
    ├─ Agent E: 1000-Seed (4h) │
    └─ Agent F: A9 Parser (5h) │ ← CRITICAL PATH
    ───────────────────────────┘
                    │
              WAVE 3: Integration (1-2 hrs)
```

**Total elapsed**: 0.5 + 11 + 5 + 1.5 = **~18 hours**
**Total agent-hours**: 0.5 + 4 + 5 + 4 + 11 + 4 + 5 + 1.5 = **~35 hours**
**Parallelism savings**: 35 → 18 hrs = **49% time reduction**

---

## 7. Agent Spawn Specifications

### Wave 1 Spawn Commands

```yaml
Agent A (Budget Optimizer):
  subagent_type: frontend-architect
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement the Budget Optimizer feature per design-budget-optimizer.md.
    Read the design doc first, then implement all 8 new files + top-bar.tsx nav link.
    Types are already added to types/index.ts — import from there.
    Run E2E tests when complete.

Agent B (E6 Price Targets):
  subagent_type: backend-architect
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement E6 Price Target Alerts per design-e6-price-targets.md.
    Read the design doc first. Migration is 002_price_targets.sql.
    Types are already added to types/index.ts — import from there.
    Run E2E tests when complete.

Agent C (D2a Price Rollups):
  subagent_type: backend-architect
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement D2a Price History Rollups per design-d2-historical-archive.md.
    ONLY implement D2a (price rollups). Skip D2b (comp rollups) entirely.
    Migration is 003_price_rollups.sql — create price_rollups table ONLY.
    Types are already added to types/index.ts — import from there.
    Run E2E tests when complete.

Agent D (Table Enhancements):
  subagent_type: frontend-architect
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement THREE features sequentially in this exact order:
    1. Delta Column (design-delta-column.md) — 1 hr
    2. A4 Enhanced Sparklines (design-a4-sparklines.md) — 6.5 hrs
    3. F1 Collector Sentiment Heat Index (design-f1-sentiment.md) — 3.5 hrs
    Read each design doc before implementing that feature.
    Types are already added to types/index.ts — import from there.
    You own: trends.ts, items/route.ts, watchlist-row.tsx, trends/route.ts,
             sparkline.tsx, watcher-cell.tsx, watchlist-table.tsx, watchlist-store.ts.
    Run E2E tests after each feature.
```

### Wave 2 Spawn Commands

```yaml
Agent E (1000-Seed):
  subagent_type: general-purpose
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement 1000-Item Seed Redesign per design-1000-seed.md.
    Read the design doc first. Previous wave already modified watchlist-row.tsx,
    watchlist-table.tsx, and items/route.ts — read current state before editing.
    Rename watchlist-row.tsx → sortable-watchlist-row.tsx.
    Create static-watchlist-row.tsx for unranked items.
    Add pagination to items/route.ts (offset/limit params).
    Run seed script and verify 1000 items + ~16K total rows.

Agent F (A9 Title Parser):
  subagent_type: backend-architect
  model: sonnet
  mode: bypassPermissions
  prompt: |
    Implement A9 AI Title Parser per design-a9-title-parser.md.
    Read the design doc first. Migration is 004_card_metadata.sql.
    Previous wave already modified sync-service.ts — read current state first.
    Types are already added to types/index.ts — import from there.
    ANTHROPIC_API_KEY may not be set — feature must gracefully disable.
    Run E2E tests when complete.
```

---

## 8. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Agent D takes >11 hrs (critical path) | Medium | Delays Wave 2 | Could split Sparklines into sub-tasks if stuck |
| Migration ordering issues at runtime | Low | DB corruption | Pre-step verifies migration runner order |
| Sparkline performance at 200 rows | Low | UI jank | Design specifies SVG-only (no Recharts/ResizeObserver) |
| 1000-seed pagination breaks dnd-kit | Medium | Drag ranking fails | Design splits SortableRow vs StaticRow |
| A9 Anthropic API rate limits | Low | Parse failures | Fire-and-forget pattern; batch API for bulk |
| Wave 2 agents read stale file state | Medium | Merge conflicts | Agents must READ files before editing |

---

## 9. Deferred Features (NOT in this plan)

| Feature | Why Deferred | When to Revisit |
|---------|-------------|-----------------|
| A1 Sold Comp Engine | No sold data API available; passive accumulation too thin | After 4-6 months of passive data collection |
| A2 Deal Score Badges | 100% dependent on A1 data | When A1 has meaningful comp volume |
| D2b Comp Rollups | Blocked on A1 | When A1 ships |
| C1 Collection Inventory | Good feature but Tier 3 priority | After Tier 1+2 complete |
| Sold History page | No dedicated page yet; D2a provides the data layer | After D2a proves value |
| Passive sold capture hook | 2-hr add-on to capture prices when watched items sell | Add to Agent B (E6) or as a quick follow-up |

### Recommended Quick Add: Passive Sold Capture Hook

While A1 is deferred, the **data capture hook** should be added now (~2 hrs). During every sync cycle, when an item transitions to `status === 'sold'`, record the final price to a `sold_prices` table. This starts the data moat immediately at near-zero cost.

**Recommendation**: Add this to Agent B's scope (E6 Price Targets) since Agent B already owns `sync-service.ts`. Create a simple `sold_prices` table in `002_price_targets.sql` alongside the targets table.

---

## 10. Success Criteria

After all waves complete:

- [ ] Delta column shows green/red % badges for all items with 2+ snapshots
- [ ] Sparklines render in every row with 7d/14d/30d toggle
- [ ] Heat index dots appear in watcher column (red/yellow/gray)
- [ ] Budget page accessible via nav, produces optimized picks
- [ ] Price targets can be set, trigger during sync, show in activity feed
- [ ] D2a rollup cron runs daily, OHLC chart renders on item detail page
- [ ] 1000-seed script generates correct distributions
- [ ] Pagination works for unranked items (Load More)
- [ ] A9 parses titles on new item sync (when API key present)
- [ ] All E2E tests pass
- [ ] No file conflicts, no migration errors

---

## 11. Design Documents Reference

All design docs live in `ebay-tracker/claudedocs/`:

| Doc | Lines | Feature |
|-----|-------|---------|
| `design-delta-column.md` | ~200 | Delta Column |
| `design-a4-sparklines.md` | ~400 | Enhanced Sparklines |
| `design-budget-optimizer.md` | ~1200 | Budget Optimizer |
| `design-e6-price-targets.md` | ~1030 | Price Target Alerts |
| `design-f1-sentiment.md` | ~350 | Collector Sentiment |
| `design-1000-seed.md` | ~700 | 1000-Item Seed |
| `design-a9-title-parser.md` | ~500 | AI Title Parser |
| `design-d2-historical-archive.md` | ~1730 | Historical Archive (D2a+D2b) |
| `design-a1-sold-comp-engine.md` | ~600 | Sold Comp Engine (DEFERRED) |
| `design-a2-deal-score-badges.md` | ~500 | Deal Score Badges (DEFERRED) |
| `design-c1-collection-inventory.md` | ~1420 | Collection Inventory (DEFERRED) |
