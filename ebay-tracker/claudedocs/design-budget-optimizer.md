# Budget Optimizer — Design Document

**Feature**: Budget Optimizer
**Location**: `/budget` page, `src/app/budget/`
**Author**: Claude Code (Frontend Architect)
**Date**: 2026-02-21
**Status**: Implementation-ready

---

## 1. Overview

The Budget Optimizer answers one question: **given a spending budget, which watchlist items should the user buy to maximize value?**

Items are scored using a composite function that weighs rank priority, time urgency, listing confidence, competition, and price trend. A greedy allocation algorithm then selects the highest-scoring affordable items until the budget is exhausted. Everything runs client-side — no API changes, no database changes.

### User Flow

```
User navigates to /budget
    |
    v
BudgetForm (budget input + auction mode selector)
    |
    v
User clicks "Optimize"
    |
    v
optimizer.ts:
  1. Fetch active items from useWatchlist (already cached by TanStack Query)
  2. Score each item (scoring.ts)
  3. Run greedy allocation
  4. Return: selected[], excluded[], totals
    |
    v
BudgetSummary (total cost, remaining budget, item counts)
BudgetResults (sorted table of picks + exclusion reasons)
ScoreBreakdown (per-item tooltip on score chip)
```

The results are **re-computed on every input change** (budget amount or auction mode). There is no submit button debounce needed because scoring is synchronous and fast (O(n log n) for sort, O(n) for greedy pass) — even 500 items runs in under 1 ms.

---

## 2. Scoring Function

### 2.1 Composite Score

```
score(item) =
  0.40 * rankValue(rank, totalItems)
+ 0.20 * urgencyScore(endTime)
+ 0.10 * confidenceScore(listingType, bidCount, watcherCount)
- 0.10 * competitionPenalty(watcherCount, bidCount)
+ 0.20 * priceOpportunity(snapshots)
```

All sub-scores are normalized to **[0.0, 1.0]** before weighting. The composite score is in **[0.0, 1.0]**.

### 2.2 Weight Rationale

| Weight | Sub-score | Rationale |
|--------|-----------|-----------|
| 0.40 | rankValue | Rank is the user's own explicit priority signal — the strongest available |
| 0.20 | priceOpportunity | Downward price trends = buying opportunity; high information content |
| 0.20 | urgencyScore | Time pressure is objective and directly actionable |
| 0.10 | confidenceScore | Listing type affects whether the "buy" cost estimate is reliable |
| -0.10 | competitionPenalty | Reduces score for items where winning is uncertain or price will spike |

---

## 3. Scoring Sub-Functions

### 3.1 rankValue — Rank Priority (weight: 0.40)

**Purpose**: Items ranked higher by the user deserve stronger consideration.

**Formula** (exponential decay):

```
rankValue(rank, totalItems) =
  rank === null  → 0.0   (unranked items get zero rank score)
  rank === 1     → 1.0
  otherwise      → exp(-λ * (rank - 1) / totalItems)
  where λ = 3.0  (decay constant — rank 1 = 1.0, rank ≈ totalItems = ~0.05)
```

**Worked example** (10 items):

| Rank | rankValue |
|------|-----------|
| 1    | 1.000 |
| 2    | 0.741 |
| 3    | 0.549 |
| 5    | 0.301 |
| 10   | 0.050 |
| null | 0.000 |

**Edge cases**:
- `totalItems === 0`: return 0.0 (guard against division by zero)
- `totalItems === 1`: rank 1 = 1.0 (only item)
- Rank out of bounds (rank > totalItems due to stale data): clamp to 0.05

**TypeScript signature**:
```ts
function rankValue(rank: number | null, totalItems: number): number
```

---

### 3.2 urgencyScore — Time Urgency (weight: 0.20)

**Purpose**: Items ending soon deserve higher scores. A fixed-price listing with no end time is low urgency.

**Formula** (piecewise linear with cutoffs):

```
hoursLeft = (endTime - now) / 3600000

urgencyScore(endTime) =
  endTime === null   → 0.10   (fixed price, no deadline)
  hoursLeft <= 0     → 0.0    (already ended — should be filtered, but guard anyway)
  hoursLeft <= 2     → 1.0    (critical: ending within 2 hours)
  hoursLeft <= 6     → 0.75   (urgent)
  hoursLeft <= 24    → 0.50   (ending today)
  hoursLeft <= 72    → 0.25   (ending this week)
  hoursLeft <= 168   → 0.10   (ending within 7 days)
  otherwise          → 0.05   (> 7 days out)
```

**Edge cases**:
- Negative hours (item ended during session): return 0.0; item should be filtered from candidates before scoring
- `endTime` is malformed ISO string: catch parse error, return 0.10 (treat as no deadline)

**TypeScript signature**:
```ts
function urgencyScore(endTime: string | null): number
```

---

### 3.3 confidenceScore — Buy Confidence (weight: 0.10)

**Purpose**: BIN listings have a known, guaranteed price. Auctions have uncertain final cost.

**Formula**:

```
confidenceScore(listingType, bidCount, watcherCount) =
  'FixedPrice'      → 1.0
  'AuctionWithBIN'  → 0.85   (BIN option exists, user can bypass auction)
  'Auction':
    bidCount === 0  → 0.80   (reserve likely not yet met; current price may be low)
    bidCount <= 3   → 0.65   (light competition)
    bidCount <= 10  → 0.50   (moderate competition)
    bidCount > 10   → 0.35   (heavy bidding — price will run up significantly)
```

Note: the competitionPenalty (next sub-function) handles the *reduction* from watchers/bids. This score captures the *predictability* of the final cost, not the price level itself.

**Edge cases**:
- `bidCount` is null or undefined: treat as 0
- Unknown listingType: default to 0.50

**TypeScript signature**:
```ts
function confidenceScore(listingType: ListingType, bidCount: number): number
```

---

### 3.4 competitionPenalty — Competition Pressure (weight: -0.10)

**Purpose**: Heavy watcher/bid activity suggests the item will attract more buyers, pushing the final price up and reducing the chance of winning.

**Formula** (logarithmic scale to avoid single outliers dominating):

```
rawPenalty(watcherCount, bidCount) =
  w = watcherCount ?? 0
  b = bidCount ?? 0
  signal = log10(1 + w) * 0.6 + log10(1 + b * 5) * 0.4
  // bids weighted 5x because each bid is a stronger signal than a watcher
  return clamp(signal / 3.0, 0.0, 1.0)
  // divides by 3.0 so signal of ~30 watchers + 0 bids ≈ 0.5 penalty

competitionPenalty = rawPenalty(watcherCount, bidCount)
```

**Worked examples**:

| Watchers | Bids | rawPenalty | Effect on score (-0.10 * penalty) |
|----------|------|------------|-----------------------------------|
| 0        | 0    | 0.000      | 0.000 |
| 5        | 0    | 0.232      | -0.023 |
| 20       | 2    | 0.476      | -0.048 |
| 50       | 8    | 0.666      | -0.067 |
| 200      | 25   | 1.000      | -0.100 |

**Edge cases**:
- Both null: penalty = 0.0 (no data = assume no competition)
- Watchers/bids exactly 0: penalty = 0.0

**TypeScript signature**:
```ts
function competitionPenalty(watcherCount: number | null, bidCount: number): number
```

---

### 3.5 priceOpportunity — Price Trend (weight: 0.20)

**Purpose**: Items with downward price trends represent buying opportunities (seller may be motivated). Items with rising prices are less attractive.

**Data source**: Client-side `snapshots` array from the item detail query. However, the budget page loads items from the watchlist endpoint (`/api/items`) which does NOT include snapshots. To avoid N+1 fetches, we compute this from a derived signal available in the watchlist response: the `deltaPct` field if present, or fall back to a neutral score.

**Design decision**: The watchlist API response includes items but not their full snapshot history. Two options:
1. Accept a neutral score (0.5) for all items — simple but loses information
2. Maintain a separate snapshot summary endpoint — requires API change (out of scope)

**Resolution**: Compute from `currentPrice` and `buyItNowPrice` as a proxy:
- If `currentPrice` has dropped (we can detect this through the `PriceCell` deltaPct if exposed), use it.
- Since deltaPct is not in the `WatchlistItem` type but the item object from the API may carry it (the API computes it for the price cell), we will expose it by computing a `deltaPct` from the watchlist API shape.

**Actual implementation approach** (no API change needed):
The `/api/items` response already returns `WatchlistItem[]`. The trends page uses a separate endpoint. For the budget optimizer, we compute `priceOpportunity` as:

```
priceOpportunity(item) =
  // Use buyItNowPrice vs currentPrice as a proxy:
  // For auctions: if BIN price exists and is close to current, little opportunity
  // If BIN price is much higher than current, opportunity exists (price hasn't run up)

  if item.buyItNowPrice && item.listingType === 'AuctionWithBIN':
    gap = (item.buyItNowPrice - item.currentPrice) / item.buyItNowPrice
    // gap close to 0 = bidding near BIN = late stage, less opportunity
    // gap close to 1 = bidding far below BIN = early stage, real opportunity
    return clamp(gap, 0.0, 1.0)

  if item.listingType === 'FixedPrice':
    // No price dynamics; score = 0.50 (neutral)
    return 0.50

  if item.listingType === 'Auction' (no BIN):
    // Rely on watcher/bid count as a proxy:
    // Few bids + low price = potential bargain
    signal = 1.0 - confidenceScore(item.listingType, item.bidCount) * 0.5
    // Repurpose confidence inversely: uncertain auctions may have upside
    return clamp(signal, 0.1, 0.9)

  return 0.50  // fallback
```

**Edge cases**:
- `buyItNowPrice` of 0: treat as null
- `currentPrice > buyItNowPrice` (data anomaly): return 0.0 (already past BIN — should not happen on active listings)
- All FixedPrice items: uniform 0.50 — total scores differentiated primarily by rank + urgency

**TypeScript signature**:
```ts
function priceOpportunity(item: WatchlistItem): number
```

---

## 4. Cost Estimation — Auction Modes

Auctions have unknown final prices. The user selects a **risk tolerance mode** that governs cost estimation for the greedy allocation.

### 4.1 Mode Definitions

| Mode | Multiplier | Description | Use case |
|------|-----------|-------------|----------|
| **Conservative** | 1.50x current + shipping | Assumes heavy bidding; safe over-estimate | Budget-sensitive buyers; competitive categories |
| **Moderate** | 1.25x current + shipping | Typical bidding increase; balanced estimate | Most users, most categories |
| **Aggressive** | 1.10x current + shipping | Assumes minimal additional bidding | Experienced buyers with category knowledge |

### 4.2 Formula

```
estimatedCost(item, mode) =
  if item.listingType === 'FixedPrice':
    return item.currentPrice + item.shippingCost

  if item.listingType === 'AuctionWithBIN':
    // User may choose BIN; use the lower of BIN cost or bid estimate
    bidEstimate = currentPrice * multiplier(mode) + shippingCost
    binCost = item.buyItNowPrice + item.shippingCost
    return min(bidEstimate, binCost)

  if item.listingType === 'Auction':
    return item.currentPrice * multiplier(mode) + item.shippingCost

multiplier(mode):
  'conservative' → 1.50
  'moderate'     → 1.25
  'aggressive'   → 1.10
```

### 4.3 Mode Change Behavior

Changing the auction mode instantly re-runs the optimizer and re-renders results. The budget amount is preserved. Results may change significantly when items are auctions near the budget boundary.

---

## 5. Greedy Allocation Algorithm

### 5.1 Why Greedy (Not Knapsack)

The 0-1 knapsack problem (select subset of indivisible items to maximize value within weight budget) is NP-complete. The optimal DP solution runs O(n * W) where W is the budget in cents — for a $1,000 budget and 100 items, that is 10 million operations plus memory. More importantly, the score function already reflects the user's explicit priority signal (rank), so the greedy solution produces the same result as optimal in most real-world watchlist distributions.

Greedy is also explainable: "Item A was selected because it had the highest score and fit the remaining budget" is a sentence any user can follow.

### 5.2 Algorithm (Pseudocode)

```
function optimizeBudget(
  items: WatchlistItem[],
  budgetCents: number,
  mode: AuctionMode
): OptimizationResult

  // Step 1: Filter candidates
  candidates = items.filter(item =>
    item.status === 'Active' &&
    item.rank !== null          // only ranked items are included
  )

  if candidates.length === 0:
    return { selected: [], excluded: [], reason: 'no-ranked-items' }

  // Step 2: Score all candidates
  totalItems = candidates.length
  scored = candidates.map(item => ({
    item,
    score: computeScore(item, totalItems),
    estimatedCost: estimatedCost(item, mode),
    breakdown: {
      rankValue: rankValue(item.rank, totalItems),
      urgencyScore: urgencyScore(item.endTime),
      confidenceScore: confidenceScore(item.listingType, item.bidCount),
      competitionPenalty: competitionPenalty(item.watcherCount, item.bidCount),
      priceOpportunity: priceOpportunity(item),
    }
  }))

  // Step 3: Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Step 4: Greedy allocation
  selected = []
  excluded = []
  remainingBudget = budgetCents

  for scoredItem of scored:
    if scoredItem.estimatedCost <= remainingBudget:
      selected.push(scoredItem)
      remainingBudget -= scoredItem.estimatedCost
    else:
      excluded.push({
        ...scoredItem,
        excludedReason: scoredItem.estimatedCost > budgetCents
          ? 'over-total-budget'   // too expensive even at full budget
          : 'insufficient-remaining'  // could not fit after higher-priority picks
      })

  // Step 5: Sort selected by score descending (already sorted), excluded by score
  return {
    selected,                             // sorted by score desc
    excluded,                             // sorted by score desc
    totalEstimatedCost: budgetCents - remainingBudget,
    remainingBudget,
    itemCount: selected.length,
    budgetUtilization: (budgetCents - remainingBudget) / budgetCents,
  }
```

### 5.3 Exclusion Reasons

| Reason key | Display text | When applied |
|------------|-------------|--------------|
| `over-total-budget` | "Costs more than your total budget" | estimatedCost > budgetCents |
| `insufficient-remaining` | "Didn't fit within remaining budget" | estimatedCost > remainingBudget but <= budgetCents |
| `unranked` | "Not ranked — rank items to include them" | rank === null |
| `not-active` | "No longer active" | status !== 'Active' |

### 5.4 Tie-Breaking

When two items have identical scores (rare, but possible with items sharing rank, listingType, and similar timing), sort by:
1. Score (descending)
2. estimatedCost (ascending — cheaper item preferred for equal score)
3. item.id (ascending — stable, deterministic)

---

## 6. File Specifications

### 6.1 `src/lib/budget/scoring.ts`

Pure functions, zero side effects, no React imports.

```ts
// Exports:
export function rankValue(rank: number | null, totalItems: number): number
export function urgencyScore(endTime: string | null): number
export function confidenceScore(listingType: ListingType, bidCount: number): number
export function competitionPenalty(watcherCount: number | null, bidCount: number): number
export function priceOpportunity(item: WatchlistItem): number

// Internal (not exported):
function clamp(value: number, min: number, max: number): number
```

All functions are pure and deterministic. They accept raw field values (not the full item object), except `priceOpportunity` which needs multiple fields.

---

### 6.2 `src/lib/budget/optimizer.ts`

Orchestrates scoring, cost estimation, and greedy allocation.

```ts
// Types:
export type AuctionMode = 'conservative' | 'moderate' | 'aggressive'

export interface ScoredItem {
  item: WatchlistItem
  score: number               // 0.0 – 1.0, composite
  estimatedCost: number       // cents, mode-adjusted
  breakdown: ScoreBreakdown
  excludedReason?: ExcludedReason
}

export interface ScoreBreakdown {
  rankValue: number           // 0.0 – 1.0
  urgencyScore: number        // 0.0 – 1.0
  confidenceScore: number     // 0.0 – 1.0
  competitionPenalty: number  // 0.0 – 1.0 (positive value; subtracted in composite)
  priceOpportunity: number    // 0.0 – 1.0
}

export type ExcludedReason =
  | 'over-total-budget'
  | 'insufficient-remaining'
  | 'unranked'
  | 'not-active'

export interface OptimizationResult {
  selected: ScoredItem[]
  excluded: ScoredItem[]
  totalEstimatedCost: number  // cents
  remainingBudget: number     // cents
  itemCount: number
  budgetUtilization: number   // 0.0 – 1.0
  candidateCount: number      // ranked + active items considered
}

// Exports:
export function estimatedCost(item: WatchlistItem, mode: AuctionMode): number
export function computeScore(item: WatchlistItem, totalItems: number): number
export function computeBreakdown(item: WatchlistItem, totalItems: number): ScoreBreakdown
export function optimizeBudget(
  items: WatchlistItem[],
  budgetCents: number,
  mode: AuctionMode
): OptimizationResult
```

---

### 6.3 `src/hooks/use-budget.ts`

Zustand store slice plus localStorage persistence. Returns derived optimization result reactively.

```ts
'use client'

// Store state shape:
interface BudgetStore {
  // Inputs
  budgetDollars: string           // string to allow partial input ('', '50', '1,000')
  auctionMode: AuctionMode

  // Derived (computed when inputs change)
  result: OptimizationResult | null

  // Actions
  setBudgetDollars: (value: string) => void
  setAuctionMode: (mode: AuctionMode) => void
  runOptimizer: (items: WatchlistItem[]) => void
}

// Persistence: budgetDollars + auctionMode persisted to localStorage under key
// 'ebay-budget-optimizer-v1' using Zustand persist middleware.
// result is NOT persisted (derived, re-computed on page load).

// Exports:
export const useBudgetStore: UseBoundStore<StoreApi<BudgetStore>>

// Convenience hook used by budget page:
export function useBudget()
```

`useBudget()` is a composite hook that:
1. Reads `budgetDollars` and `auctionMode` from the Zustand store
2. Calls `useWatchlist()` (TanStack Query, uses cached data — no new network request if watchlist was recently fetched)
3. Re-runs `optimizeBudget()` whenever `budgetDollars`, `auctionMode`, or watchlist data changes (via `useMemo`)
4. Returns `{ result, budgetDollars, setBudgetDollars, auctionMode, setAuctionMode, isLoading, isError }`

The optimization runs synchronously inside `useMemo` — no async needed.

```ts
export function useBudget() {
  const { budgetDollars, auctionMode, setBudgetDollars, setAuctionMode } = useBudgetStore()
  const { data, isLoading, isError } = useWatchlist()

  const result = useMemo(() => {
    const budgetCents = parseBudgetCents(budgetDollars)
    if (!data || budgetCents <= 0) return null
    const allItems = [...data.ranked, ...data.unranked]
    return optimizeBudget(allItems, budgetCents, auctionMode)
  }, [data, budgetDollars, auctionMode])

  return { result, budgetDollars, setBudgetDollars, auctionMode, setAuctionMode, isLoading, isError }
}

// parseBudgetCents: strips '$', ',', whitespace; returns integer cents or 0 on invalid
function parseBudgetCents(value: string): number
```

---

### 6.4 `src/app/budget/page.tsx`

Page-level component. Follows the same pattern as `trends/page.tsx`.

```ts
'use client'

// Imports: TopBar, BudgetForm, BudgetSummary, BudgetResults, useBudget
// No local state — all state lives in useBudget()

export default function BudgetPage()

// Layout:
// <TopBar />
// <div className="p-4 space-y-4" data-testid="budget-page">
//   <BudgetForm />
//   {result && <BudgetSummary result={result} />}
//   {result && <BudgetResults result={result} />}
//   {isLoading && <Skeleton ... />}
//   {isError && <ErrorState ... />}
// </div>
```

---

### 6.5 `src/components/budget/budget-form.tsx`

Budget amount input and auction mode selector.

```ts
'use client'

// Props: none (reads/writes from useBudgetStore directly)
export function BudgetForm()

// Renders:
// - Dollar input: type="text" (not number — allows formatting with commas)
//   placeholder="e.g. 500"
//   value={budgetDollars}
//   onChange → setBudgetDollars
//   Validation: show error message if input is not a valid positive number
//   (red border + "Enter a valid dollar amount" below input)
//
// - Auction mode radio group (3 options: Conservative / Moderate / Aggressive)
//   Each option shows: label + subtitle
//     Conservative: "1.5x current price — safe estimate"
//     Moderate:     "1.25x current price — typical outcome"
//     Aggressive:   "1.1x current price — minimal bidding"
//   Selected option: bg-accent/20 text-accent border-accent
//   Unselected: bg-surface text-text-secondary border-border
//
// - aria-label on the radio group: "Auction cost estimation mode"
// - Each radio: aria-label="${mode} mode — ${description}"

// Types:
interface BudgetFormProps {}   // (no external props — uses store)
```

---

### 6.6 `src/components/budget/budget-summary.tsx`

Three stat cards showing allocation summary. Matches `PortfolioStats` visual pattern.

```ts
'use client'

interface BudgetSummaryProps {
  result: OptimizationResult
}

export function BudgetSummary({ result }: BudgetSummaryProps)

// Renders 4 StatsCard instances (reuse existing StatsCard from trends/stats-card.tsx):
//   "Items Selected"     → result.itemCount
//   "Est. Total Cost"    → formatDollars(result.totalEstimatedCost)
//   "Remaining Budget"   → formatDollars(result.remainingBudget)
//   "Budget Used"        → `${(result.budgetUtilization * 100).toFixed(0)}%`
//
// Color signal on "Remaining Budget":
//   > 20% remaining → text-delta-drop (green)
//   5-20% remaining → text-urgency-caution (yellow)
//   < 5% remaining  → text-urgency-urgent (red)
//
// data-testid="budget-summary"
```

---

### 6.7 `src/components/budget/budget-results.tsx`

Two-section table: selected items (picks) and excluded items (why not).

```ts
'use client'

interface BudgetResultsProps {
  result: OptimizationResult
}

export function BudgetResults({ result }: BudgetResultsProps)

// Layout:
// Tab bar: "Picks (N)" | "Excluded (N)"
// Selected tab: accent underline (same as MoversTable tabs)
//
// PICKS TABLE columns:
//   Rank (#)          | 36px  | item.rank
//   Title             | flex  | item.title (truncated, links to /item/[itemId])
//   Est. Cost         | 80px  | formatDollars(estimatedCost)
//   Score             | 64px  | ScoreBreakdown chip (see below)
//   Type              | 72px  | StatusBadge variant (Auction=info, FixedPrice=success, AuctionWithBIN=default)
//   Time Left         | 80px  | CountdownCell (reuse existing)
//
// EXCLUDED TABLE columns:
//   Rank (#)          | 36px  | item.rank ?? '—'
//   Title             | flex  | item.title (grayed out)
//   Est. Cost         | 80px  | formatDollars(estimatedCost) (text-text-secondary)
//   Score             | 64px  | ScoreBreakdown chip (muted)
//   Reason            | 160px | Human-readable excludedReason
//
// Excluded rows: opacity-60 to visually de-emphasize
//
// Empty states:
//   No picks: "No items fit within your budget. Try increasing the budget or switching to Aggressive mode."
//   No excluded: "All ranked active items fit within your budget."
//
// data-testid="budget-results"
// data-testid="budget-picks-table"
// data-testid="budget-excluded-table"
```

---

### 6.8 `src/components/budget/score-breakdown.tsx`

Per-item score chip with tooltip showing sub-score breakdown.

```ts
'use client'

interface ScoreBreakdownProps {
  score: number           // 0.0 – 1.0 composite
  breakdown: ScoreBreakdown
  muted?: boolean         // true for excluded items
}

export function ScoreBreakdownChip({ score, breakdown, muted }: ScoreBreakdownProps)

// Renders:
// Small pill chip showing score as percentage: "87%"
// Chip background color by score range:
//   >= 0.75 → bg-status-active/20 text-status-active     (green)
//   >= 0.50 → bg-urgency-caution/20 text-urgency-caution  (yellow)
//   < 0.50  → bg-raised text-text-secondary               (neutral)
//
// On hover: Tooltip (extends existing Tooltip component) shows breakdown table:
//   "Rank priority:    87%   (×0.40)"
//   "Price opportunity: 72%  (×0.20)"
//   "Urgency:           65%  (×0.20)"
//   "Buy confidence:    85%  (×0.10)"
//   "Competition:      -12%  (×0.10)"
//   "─────────────────────────"
//   "Total score:       82%"
//
// Note: The existing Tooltip component only accepts string content.
// ScoreBreakdownChip extends it with a rich JSX tooltip using a local
// hover state pattern (same onMouseEnter/onMouseLeave as Tooltip).
// Do NOT modify the existing Tooltip component — implement hover inline.
//
// aria-label: "Score ${Math.round(score * 100)}%: rank ${pct}%, urgency ${pct}%, ..."
```

---

### 6.9 Modified: `src/components/layout/top-bar.tsx`

Add "Budget" nav link to the `navLinks` array.

```ts
// Before:
const navLinks = [
  { href: '/', label: 'Watchlist' },
  { href: '/trends', label: 'Trends' },
]

// After:
const navLinks = [
  { href: '/', label: 'Watchlist' },
  { href: '/trends', label: 'Trends' },
  { href: '/budget', label: 'Budget' },
]
```

This is the only change to this file. The active state styling is handled by the existing `pathname === link.href` check.

---

## 7. Zustand Store Design

### 7.1 Store Shape

```ts
// src/hooks/use-budget.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuctionMode } from '@/lib/budget/optimizer'

interface BudgetStore {
  budgetDollars: string
  auctionMode: AuctionMode
  setBudgetDollars: (value: string) => void
  setAuctionMode: (mode: AuctionMode) => void
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set) => ({
      budgetDollars: '',
      auctionMode: 'moderate',
      setBudgetDollars: (value) => set({ budgetDollars: value }),
      setAuctionMode: (mode) => set({ auctionMode: mode }),
    }),
    {
      name: 'ebay-budget-optimizer-v1',
      partialize: (state) => ({
        budgetDollars: state.budgetDollars,
        auctionMode: state.auctionMode,
      }),
    }
  )
)
```

### 7.2 Persistence Strategy

| Field | Persisted | Reason |
|-------|-----------|--------|
| `budgetDollars` | Yes | User's budget shouldn't reset on every visit |
| `auctionMode` | Yes | Mode preference is user preference |
| `result` | No | Derived from items + inputs; items may change between sessions |

Storage key `'ebay-budget-optimizer-v1'` — versioned to allow clean migration if store shape changes.

### 7.3 Why No `result` in Store

The optimization result is not stored in Zustand because it is a pure function of `(items, budgetDollars, auctionMode)`. Storing it would require manual invalidation on watchlist updates. Instead, `useBudget()` computes it via `useMemo` with `[data, budgetDollars, auctionMode]` as dependencies — React's reactivity system handles invalidation automatically.

---

## 8. UI Wireframe Description

### 8.1 Budget Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TopBar: [eBay Watchlist] [Watchlist] [Trends] [Budget] ... [Sync]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ BUDGET OPTIMIZER                                          │   │
│  │                                                           │   │
│  │  Budget:  [$_______________]                              │   │
│  │                                                           │   │
│  │  Auction cost estimate:                                   │   │
│  │  ┌───────────────┐ ┌──────────────┐ ┌────────────────┐  │   │
│  │  │ Conservative  │ │ ● Moderate   │ │  Aggressive    │  │   │
│  │  │ 1.5× current  │ │ 1.25× current│ │  1.1× current  │  │   │
│  │  └───────────────┘ └──────────────┘ └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐  │
│  │ Items: 4 │  │ Est: $342.50 │  │ Left: $157.50│  │Used:68%│  │
│  └──────────┘  └──────────────┘  └──────────────┘  └────────┘  │
│                                                                   │
│  [Picks (4)]  [Excluded (7)]                                     │
│  ─────────────────────────────────────────────────────────────  │
│  #  Title                        Est. Cost  Score  Type  Time   │
│  1  Vintage Gibson Les Paul...   $285.00    [87%]  BIN   2h 14m │
│  2  Fender Strat Neck 1972...    $ 45.00    [74%]  BIN   3d 2h  │
│  3  Kluson Tuners Set...         $  8.50    [61%]  BIN   5d     │
│  4  Guitar Strap Leather...      $  4.00    [55%]  Fixed  —     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Score Chip Tooltip (on hover)

```
  ┌──────────────────────────────────────┐
  │  Score Breakdown                      │
  │  ─────────────────────────────────── │
  │  Rank priority:      94%   ×0.40     │
  │  Price opportunity:  72%   ×0.20     │
  │  Urgency:            80%   ×0.20     │
  │  Buy confidence:    100%   ×0.10     │
  │  Competition:        -8%   ×0.10     │
  │  ─────────────────────────────────── │
  │  Total score:        87%             │
  └──────────────────────────────────────┘
```

### 8.3 Excluded Tab

```
  [Picks (4)]  [● Excluded (7)]
  ──────────────────────────────────────────────────────────────
  #   Title                       Est. Cost   Score   Reason
  ─   ─────────────────────────── ─────────── ─────── ──────────────────────────
  2   Burst 1959 ES-335 Reissue   $620.00     [52%]   Costs more than your total
                                                       budget
  5   Fender Jazzmaster Body...   $180.00     [48%]   Didn't fit after higher-
                                                       priority picks
  —   Ibanez Roadstar (used)      $230.00     [41%]   Costs more than your total
                                                       budget
  —   Gibson P-90 Pickup          $ 45.00     [28%]   Not ranked — rank items to
                                                       include them
```

### 8.4 Responsiveness

- **Mobile (< 640px)**: Title column only; Est. Cost, Score, Type, Time hidden. Show as stacked cards instead of table rows.
- **Tablet (640–1024px)**: All columns except Time Left.
- **Desktop (> 1024px)**: All columns.

Implementation: use `hidden sm:table-cell` Tailwind classes on cells. Mobile card layout uses flex column per row.

### 8.5 Auction Mode Selector

Three-option horizontal radio group. On mobile, stack vertically. Selected state uses `border-accent bg-accent/10`.

```
Mobile layout (< 640px):
┌──────────────────────────────┐
│ ● Conservative               │
│   1.5× current — safe        │
├──────────────────────────────┤
│   Moderate (selected)        │
│   1.25× current — typical    │
├──────────────────────────────┤
│   Aggressive                 │
│   1.1× current — minimal bid │
└──────────────────────────────┘
```

---

## 9. Edge Cases

### 9.1 No Ranked Items

```
result.candidateCount === 0

Display in place of results:
  EmptyState (reuse existing component):
    title: "No ranked items to optimize"
    description: "Rank items in your watchlist to include them in budget optimization.
                  Drag items to assign a rank, then come back here."
    link: "/" with label "Go to Watchlist"
```

### 9.2 Budget Too Low for Any Item

```
result.selected.length === 0 && result.excluded.length > 0

Display in BudgetSummary:
  Banner (inline, not a toast):
    "No items fit within $X. The cheapest ranked active item costs $Y.
     Try increasing your budget or switching to Aggressive mode."

Show the excluded table so user can see what they're missing.
```

### 9.3 All Items Are Auctions (No FixedPrice)

No special handling needed. The mode selector is visible and relevant. The "Conservative / Moderate / Aggressive" labels are always shown regardless of listing type mix. FixedPrice items simply return their actual price (no multiplier applied).

If all items are auctions and mode is Aggressive, a small info banner can note: "Aggressive mode assumes minimal additional bidding. Actual final prices may be higher."

### 9.4 Single Item in Watchlist

Works correctly. `rankValue` for the one item = 1.0 (rank 1 of 1). `totalItems = 1` handled correctly (no division by zero — exponential formula uses `(rank - 1) / totalItems = 0`, so exp(0) = 1.0).

### 9.5 Budget Exactly Equals Item Cost

```
estimatedCost === remainingBudget → item IS selected (<=  check, not <)
remainingBudget becomes 0
budgetUtilization = 1.0 (100%)
Display remaining as "$0.00" with green color (fully utilized, not "zero left")
```

### 9.6 Budget Input Validation

| Input | parseBudgetCents output | UI feedback |
|-------|------------------------|-------------|
| "" | 0 | No results shown; no error (initial state) |
| "abc" | 0 | Red border + "Enter a valid dollar amount" |
| "-50" | 0 | Red border + "Budget must be greater than zero" |
| "0" | 0 | Red border + "Budget must be greater than zero" |
| "500" | 50000 | Valid |
| "$500.00" | 50000 | Valid (strip $ and commas) |
| "1,500.50" | 150050 | Valid |
| "999999" | 99999900 | Valid (no upper cap) |

### 9.7 Watchlist Data Still Loading

Show Skeleton placeholders for the results area. BudgetForm is still rendered and interactive — inputs can be set while data loads.

### 9.8 Items With Null endTime (Fixed Price, No Deadline)

`urgencyScore(null)` returns 0.10. These items do not disappear after auctions close, so they are valid long-term picks. Their lower urgency score is intentional.

### 9.9 Item Ending Before User Can Act

If an item's `endTime` is in the past (item has ended but status is still `Active` due to stale sync), `urgencyScore` returns 0.0 and the item should ideally be filtered. Add a guard: items with `endTime` more than 5 minutes in the past are excluded with reason `not-active`, even if `status === 'Active'`.

---

## 10. Excluded Item Reasoning

The "why not" explanation should be user-friendly, not technical. Map `ExcludedReason` to display text:

| Reason | Column value | Tooltip (on hover) |
|--------|-------------|-------------------|
| `over-total-budget` | "Over budget" | "This item's estimated cost ($X) exceeds your total budget of $Y. Even at the start with full budget, it wouldn't fit." |
| `insufficient-remaining` | "Budget used up" | "Higher-priority items consumed the remaining budget before reaching this item. It would cost $X but only $Y remained." |
| `unranked` | "Not ranked" | "Unranked items are not included in optimization. Assign a rank on the watchlist page to include this item." |
| `not-active` | "Not active" | "This item is not currently active (status: $status) and cannot be purchased." |

The exclusion reason column on mobile collapses to an icon with a tooltip (info icon "i").

---

## 11. E2E Test Specifications

Test file: `tests/e2e/budget.spec.ts`

All tests use `page.route()` to intercept API calls with inline mock data, following the same pattern as the existing E2E test suite (`watchlist-table.spec.ts`, `trends.spec.ts`, etc.).

### Mock data used across all budget tests

The budget optimizer only reads ranked and active items. Prices are in cents throughout (matching `WatchlistItem`). The endTime values below are computed relative to `Date.now()` at test construction time — the tests set them to a fixed offset so urgency scores are deterministic.

```ts
// tests/e2e/helpers/mock-data.ts additions (export from the existing file):

// Budget Test 1: 3 FixedPrice items, chosen so Moderate mode gives exact $170 selection
// Item A: $50.00, rank 1
// Item B: $120.00, rank 2  — $50 + $120 = $170 exactly
// Item C: $200.00, rank 3  — over total budget of $170
export const mockBudgetItems3: WatchlistItem[] = [
  makeItem({
    id: 'B1', title: 'Budget Item Alpha', rank: 1,
    currentPrice: 5000, shippingCost: 0, listingType: 'FixedPrice',
    endTime: null, buyItNowPrice: null, watcherCount: 0, bidCount: 0,
    status: 'Active',
  }),
  makeItem({
    id: 'B2', title: 'Budget Item Beta', rank: 2,
    currentPrice: 12000, shippingCost: 0, listingType: 'FixedPrice',
    endTime: null, buyItNowPrice: null, watcherCount: 0, bidCount: 0,
    status: 'Active',
  }),
  makeItem({
    id: 'B3', title: 'Budget Item Gamma', rank: 3,
    currentPrice: 20000, shippingCost: 0, listingType: 'FixedPrice',
    endTime: null, buyItNowPrice: null, watcherCount: 0, bidCount: 0,
    status: 'Active',
  }),
]

// Budget Test 2: 2 Auction items, no BIN, no shipping
// Item A: currentPrice $100, rank 1 — mode cost: Moderate=$125, Aggressive=$110, Conservative=$150
// Item B: currentPrice $80, rank 2  — mode cost: Moderate=$100, Aggressive=$88,  Conservative=$120
export const mockBudgetAuctionItems: WatchlistItem[] = [
  makeItem({
    id: 'A1', title: 'Auction Item Alpha', rank: 1,
    currentPrice: 10000, shippingCost: 0, listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null, watcherCount: 0, bidCount: 0, status: 'Active',
  }),
  makeItem({
    id: 'A2', title: 'Auction Item Beta', rank: 2,
    currentPrice: 8000, shippingCost: 0, listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null, watcherCount: 0, bidCount: 0, status: 'Active',
  }),
]

// Budget Test 3: 5 unranked items (rank === null), all active
export const mockBudgetUnrankedItems: WatchlistItem[] = [
  makeItem({ id: 'U1', title: 'Unranked Item One',   rank: null, currentPrice: 2000, status: 'Active' }),
  makeItem({ id: 'U2', title: 'Unranked Item Two',   rank: null, currentPrice: 3000, status: 'Active' }),
  makeItem({ id: 'U3', title: 'Unranked Item Three', rank: null, currentPrice: 1500, status: 'Active' }),
  makeItem({ id: 'U4', title: 'Unranked Item Four',  rank: null, currentPrice: 4500, status: 'Active' }),
  makeItem({ id: 'U5', title: 'Unranked Item Five',  rank: null, currentPrice: 800,  status: 'Active' }),
]

// Budget Test 4: 1 FixedPrice ranked item — tooltip shows deterministic sub-scores
export const mockBudgetSingleItem: WatchlistItem[] = [
  makeItem({
    id: 'S1', title: 'Score Tooltip Item', rank: 1,
    currentPrice: 4500, shippingCost: 0, listingType: 'FixedPrice',
    endTime: null, buyItNowPrice: null, watcherCount: 5, bidCount: 0,
    status: 'Active',
  }),
]

// Helpers to build watchlist API response shapes
export function makeBudgetResponse(ranked: WatchlistItem[], unranked: WatchlistItem[] = []) {
  return {
    data: {
      ranked,
      unranked,
      counts: {
        active: ranked.length + unranked.length,
        sold: 0,
        ended: 0,
        total: ranked.length + unranked.length,
      },
    },
  }
}
```

### Full Playwright test file

```ts
// tests/e2e/budget.spec.ts

import { test, expect } from '@playwright/test'
import type { WatchlistItem } from '../../src/types'
import { mockEventsResponse } from './helpers/mock-data'

// ---------------------------------------------------------------------------
// Inline factory — mirrors makeItem() from helpers/mock-data.ts so this file
// is self-contained for the budget-specific mock shapes.
// ---------------------------------------------------------------------------
function makeItem(overrides: Partial<WatchlistItem> & { id: string; title: string }): WatchlistItem {
  return {
    rank: null,
    currentPrice: 5000,
    buyItNowPrice: null,
    shippingCost: 0,
    listingType: 'Auction',
    conditionName: 'Used',
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    timeLeft: 'P3D',
    sellerId: 'seller123',
    sellerFeedback: 100,
    watcherCount: 0,
    bidCount: 0,
    imageUrl: null,
    listingUrl: 'https://www.ebay.com/itm/test',
    status: 'Active',
    isInQueue: false,
    notes: null,
    firstSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSyncedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeWatchlistResponse(ranked: WatchlistItem[], unranked: WatchlistItem[] = []) {
  return {
    data: {
      ranked,
      unranked,
      counts: {
        active: ranked.length + unranked.length,
        sold: 0,
        ended: 0,
        total: ranked.length + unranked.length,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Shared API interceptor — routes both exact and query-string variants of
// /api/items. Mirrors the interceptApis() pattern from watchlist-table.spec.ts.
// ---------------------------------------------------------------------------
function interceptBudgetApis(
  page: import('@playwright/test').Page,
  watchlistResponse: ReturnType<typeof makeWatchlistResponse>
) {
  return Promise.all([
    page.route('**/api/items?*', (route) =>
      route.fulfill({ json: watchlistResponse })
    ),
    page.route('**/api/items', (route) =>
      route.fulfill({ json: watchlistResponse })
    ),
    page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    ),
  ])
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Test 1 — 3 FixedPrice ranked items (no mode multiplier applies to FixedPrice)
// $50 + $120 = $170 fits exactly; $200 is over-budget.
const budget3Items: WatchlistItem[] = [
  makeItem({
    id: 'B1',
    title: 'Budget Item Alpha',
    rank: 1,
    currentPrice: 5000,   // $50.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
  makeItem({
    id: 'B2',
    title: 'Budget Item Beta',
    rank: 2,
    currentPrice: 12000,  // $120.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
  makeItem({
    id: 'B3',
    title: 'Budget Item Gamma',
    rank: 3,
    currentPrice: 20000,  // $200.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
]

// Test 2 — 2 Auction items, no BIN, no shipping.
// Mode cost table (currentPrice * multiplier):
//   Moderate    (1.25x): A=$125, B=$100  → budget $130: A selected, B excluded (only $5 left)
//   Aggressive  (1.10x): A=$110, B=$88   → budget $130: A selected, B excluded (only $20 left)
//   Conservative(1.50x): A=$150, B=$120  → budget $130: A over-budget, B selected
const budgetAuctionItems: WatchlistItem[] = [
  makeItem({
    id: 'A1',
    title: 'Auction Item Alpha',
    rank: 1,
    currentPrice: 10000,  // $100.00
    shippingCost: 0,
    listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null,
    watcherCount: 0,
    bidCount: 0,
    status: 'Active',
  }),
  makeItem({
    id: 'A2',
    title: 'Auction Item Beta',
    rank: 2,
    currentPrice: 8000,   // $80.00
    shippingCost: 0,
    listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null,
    watcherCount: 0,
    bidCount: 0,
    status: 'Active',
  }),
]

// Test 3 — 5 unranked items only (rank === null).
const budgetUnrankedItems: WatchlistItem[] = [
  makeItem({ id: 'U1', title: 'Unranked Item One',   rank: null, currentPrice: 2000, status: 'Active' }),
  makeItem({ id: 'U2', title: 'Unranked Item Two',   rank: null, currentPrice: 3000, status: 'Active' }),
  makeItem({ id: 'U3', title: 'Unranked Item Three', rank: null, currentPrice: 1500, status: 'Active' }),
  makeItem({ id: 'U4', title: 'Unranked Item Four',  rank: null, currentPrice: 4500, status: 'Active' }),
  makeItem({ id: 'U5', title: 'Unranked Item Five',  rank: null, currentPrice: 800,  status: 'Active' }),
]

// Test 4 — 1 ranked FixedPrice item. Sub-scores are deterministic:
//   rank=1/1 → rankValue=1.0, FixedPrice → confidenceScore=1.0,
//   endTime=null → urgencyScore=0.10, watcherCount=5/bidCount=0 → competitionPenalty≈0.23,
//   FixedPrice → priceOpportunity=0.50
const budgetSingleItem: WatchlistItem[] = [
  makeItem({
    id: 'S1',
    title: 'Score Tooltip Item',
    rank: 1,
    currentPrice: 4500,   // $45.00 — well under any $500 test budget
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    buyItNowPrice: null,
    watcherCount: 5,
    bidCount: 0,
    status: 'Active',
  }),
]

// Test 5 — persistence test re-uses budget3Items as a realistic watchlist.

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Budget Optimizer', () => {
  // -------------------------------------------------------------------------
  // T29: Basic Optimization
  // 3 FixedPrice items, $170 budget, Moderate mode.
  // Items 1 ($50) and 2 ($120) are selected — sum = $170 exactly.
  // Item 3 ($200) is excluded with "over-total-budget" reason.
  // -------------------------------------------------------------------------
  test('T29: basic optimization selects items that fit budget and excludes over-budget item', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budget3Items))

    // Clear any persisted state from a previous test run
    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Moderate is the default mode — no explicit click needed.
    // Enter $170 budget.
    await page.getByLabel(/Budget/i).fill('170')

    // Wait for picks table to appear with selected items
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()

    // Items 1 and 2 should appear in picks
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Budget Item Alpha' })
    ).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Budget Item Beta' })
    ).toBeVisible()

    // Item 3 should appear in excluded tab
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(page.getByTestId('budget-excluded-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Budget Item Gamma' })
    ).toBeVisible()

    // Excluded reason for over-budget item
    await expect(
      page.getByTestId('budget-excluded-table').getByText('Over budget')
    ).toBeVisible()

    // BudgetSummary stat cards
    const summary = page.getByTestId('budget-summary')
    await expect(summary).toBeVisible()

    // 2 items selected
    await expect(summary.getByText('2')).toBeVisible()

    // Est. total $170.00
    await expect(summary.getByText('$170.00')).toBeVisible()

    // Remaining $0.00
    await expect(summary.getByText('$0.00')).toBeVisible()

    // Budget used 100%
    await expect(summary.getByText('100%')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // T30: Mode Change Recalculates Results
  // 2 Auction items, $130 budget.
  // Moderate / Aggressive → Item A selected, Item B excluded.
  // Conservative → Item A over-budget, Item B selected (result flips).
  // -------------------------------------------------------------------------
  test('T30: switching auction mode recalculates picks without page navigation', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budgetAuctionItems))

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $130 budget
    await page.getByLabel(/Budget/i).fill('130')

    // --- Moderate (default) ---
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // Item B should be in excluded
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Auction Item Beta' })
    ).toBeVisible()

    // --- Aggressive mode ---
    await page.getByRole('radio', { name: /Aggressive/i }).click()

    // Results update in place — picks tab shows item A (same selection)
    await page.getByRole('tab', { name: /Picks/i }).click()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // --- Conservative mode — result flips ---
    await page.getByRole('radio', { name: /Conservative/i }).click()

    // Item A now exceeds the $130 budget (est. cost = $150) → excluded
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(page.getByTestId('budget-excluded-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // Exclusion reason: over total budget
    await expect(
      page.getByTestId('budget-excluded-table').getByText('Over budget')
    ).toBeVisible()

    // Item B is now the pick (est. cost = $120 ≤ $130)
    await page.getByRole('tab', { name: /Picks/i }).click()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Beta' })
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // T31: No Ranked Items Shows Empty State
  // Watchlist has 5 unranked items. Any budget entered shows empty state.
  // -------------------------------------------------------------------------
  test('T31: no ranked items shows empty state and link to watchlist', async ({ page }) => {
    await interceptBudgetApis(
      page,
      makeWatchlistResponse([], budgetUnrankedItems)
    )

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter a budget to trigger optimizer
    await page.getByLabel(/Budget/i).fill('500')

    // No picks or excluded tables rendered
    await expect(page.getByTestId('budget-picks-table')).not.toBeVisible()
    await expect(page.getByTestId('budget-excluded-table')).not.toBeVisible()

    // Empty state with expected title
    await expect(page.getByText('No ranked items to optimize')).toBeVisible()

    // "Go to Watchlist" link navigates to /
    const watchlistLink = page.getByRole('link', { name: 'Go to Watchlist' })
    await expect(watchlistLink).toBeVisible()
    await watchlistLink.click()
    await expect(page).toHaveURL('/')
  })

  // -------------------------------------------------------------------------
  // T32: Score Breakdown Tooltip
  // 1 ranked FixedPrice item fits in budget. Hovering the score chip shows
  // all five sub-score rows and a total score row.
  // -------------------------------------------------------------------------
  test('T32: hovering score chip shows sub-score breakdown tooltip', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budgetSingleItem))

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $500 — the $45 item fits easily
    await page.getByLabel(/Budget/i).fill('500')

    // Wait for picks table
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Score Tooltip Item' })
    ).toBeVisible()

    // Locate the score chip in the picks table.
    // ScoreBreakdownChip renders a chip with aria-label="Score N%: ..."
    const scoreChip = page.getByTestId('budget-picks-table').locator('[aria-label^="Score"]').first()
    await expect(scoreChip).toBeVisible()

    // Hover to trigger tooltip
    await scoreChip.hover()

    // Tooltip should contain all five sub-score labels
    await expect(page.getByText('Rank priority')).toBeVisible()
    await expect(page.getByText('Price opportunity')).toBeVisible()
    await expect(page.getByText('Urgency')).toBeVisible()
    await expect(page.getByText('Buy confidence')).toBeVisible()
    await expect(page.getByText('Competition')).toBeVisible()

    // Total score row must also be visible
    await expect(page.getByText('Total score')).toBeVisible()

    // Extract the total score percentage from the chip aria-label and verify
    // it matches what is shown in the tooltip's "Total score" row.
    const chipLabel = await scoreChip.getAttribute('aria-label')
    // aria-label format: "Score 72%: rank 100%, urgency 10%, ..."
    const chipPctMatch = chipLabel?.match(/Score\s+(\d+)%/)
    expect(chipPctMatch).not.toBeNull()
    const chipPct = chipPctMatch![1]

    // The tooltip's total score line should contain the same percentage
    const totalScoreLine = page.locator('text=Total score').locator('..')
    await expect(totalScoreLine).toContainText(chipPct)
  })

  // -------------------------------------------------------------------------
  // T33: Budget Persistence Across Navigation
  // Enter $500 + Conservative mode on /budget, navigate to /, navigate back.
  // Zustand persist middleware (localStorage) should restore both values.
  // -------------------------------------------------------------------------
  test('T33: budget amount and auction mode persist across navigation', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budget3Items))

    // Start from a clean slate
    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $500 budget
    const budgetInput = page.getByLabel(/Budget/i)
    await budgetInput.fill('500')
    await expect(budgetInput).toHaveValue('500')

    // Select Conservative mode
    await page.getByRole('radio', { name: /Conservative/i }).click()
    await expect(page.getByRole('radio', { name: /Conservative/i })).toBeChecked()

    // Navigate away to the watchlist page
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page).toHaveURL('/')

    // Navigate back to /budget
    await page.getByRole('link', { name: 'Budget' }).click()
    await expect(page).toHaveURL('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Budget input should be restored
    await expect(page.getByLabel(/Budget/i)).toHaveValue('500')

    // Conservative mode should still be selected
    await expect(page.getByRole('radio', { name: /Conservative/i })).toBeChecked()

    // Results should be re-rendered (optimizer ran on restored state)
    await expect(page.getByTestId('budget-summary')).toBeVisible()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
  })
})
```

---

## 12. Effort Estimate

Total: ~4 hours

| Task | File(s) | Effort |
|------|---------|--------|
| Scoring functions + unit tests | `scoring.ts` | 35 min |
| Optimizer + types | `optimizer.ts` | 30 min |
| Zustand store + useBudget hook | `use-budget.ts` | 25 min |
| Budget page | `budget/page.tsx` | 10 min |
| BudgetForm (input + mode selector) | `budget-form.tsx` | 30 min |
| BudgetSummary (stat cards) | `budget-summary.tsx` | 20 min |
| BudgetResults (two-tab table) | `budget-results.tsx` | 40 min |
| ScoreBreakdownChip (chip + tooltip) | `score-breakdown.tsx` | 25 min |
| TopBar nav link | `top-bar.tsx` | 5 min |
| E2E tests | `budget.e2e.test.ts` | 30 min |
| **Total** | | **~4 hr** |

### Parallel execution opportunity

`scoring.ts` and `optimizer.ts` have no UI dependencies — they can be written and unit-tested before any React work begins. The Zustand store can be written in parallel with the page/component files. The component files are all independent of each other (no shared local state).

---

## 13. Types to Add

Add to `src/types/index.ts`:

```ts
// Budget optimizer types
export type AuctionMode = 'conservative' | 'moderate' | 'aggressive'

export type ExcludedReason =
  | 'over-total-budget'
  | 'insufficient-remaining'
  | 'unranked'
  | 'not-active'

export interface ScoreBreakdown {
  rankValue: number
  urgencyScore: number
  confidenceScore: number
  competitionPenalty: number
  priceOpportunity: number
}

export interface ScoredItem {
  item: WatchlistItem
  score: number
  estimatedCost: number
  breakdown: ScoreBreakdown
  excludedReason?: ExcludedReason
}

export interface OptimizationResult {
  selected: ScoredItem[]
  excluded: ScoredItem[]
  totalEstimatedCost: number
  remainingBudget: number
  itemCount: number
  budgetUtilization: number
  candidateCount: number
}
```

Alternatively, define these in `src/lib/budget/optimizer.ts` and import into hooks/components from there. Either is acceptable; keeping domain types in `src/types/index.ts` is consistent with the existing pattern.

---

## 14. Accessibility Requirements

- Budget input: `<label>` with `htmlFor`, `aria-describedby` pointing to error message
- Auction mode radio group: `role="radiogroup"` with `aria-label="Auction cost estimation mode"`
- Each radio option: `role="radio"` with `aria-checked` and `aria-label`
- Results table: `<table>` with `<thead>`, `<th scope="col">` for all columns
- Score chip tooltip: `aria-label` with full breakdown text (same content as visual tooltip)
- Tab bar: `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls`
- Empty state: `role="status"` so screen readers announce the change
- Excluded reason column: `title` attribute on truncated text for full text on hover

---

## 15. Non-Goals (Explicitly Excluded)

| Feature | Why excluded |
|---------|-------------|
| Full 0-1 Knapsack solver | O(n*W) complexity, not meaningfully better for typical watchlist sizes, and harder to explain |
| Per-item price history fetch | Requires N API calls on page load; breaks no-API-change constraint |
| Saved optimizer sessions | Would require DB schema change; out of scope |
| "Buy now" deep link with pre-filled price | eBay affiliate API change; out of scope |
| Multi-currency support | All prices already in USD cents from eBay API |
| Sharing/exporting results | Nice-to-have for a future iteration |
| Fractional items / partial quantities | eBay listings are single-quantity (watchlist context) |

---

## 16. Implementation Notes

### `parseBudgetCents` Implementation

```ts
function parseBudgetCents(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars) || dollars <= 0) return 0
  return Math.round(dollars * 100)
}
```

### Exponential Decay Constant (λ = 3.0)

λ = 3.0 was chosen so that at rank = totalItems (the worst rank), the score is approximately:
```
exp(-3.0 * (n-1) / n) ≈ exp(-3.0) ≈ 0.05
```
This gives a 20× range between rank 1 (1.0) and last rank (~0.05), which feels meaningful without making low-ranked items invisible.

If users prefer a sharper cutoff (rank 5 of 10 = essentially excluded), increase λ to 5.0. If they prefer a flatter curve (rank doesn't matter as much), decrease to 1.5.

### AuctionWithBIN Cost Estimation

For `AuctionWithBIN`, the user can buy immediately at BIN price instead of bidding. The optimizer takes the **minimum** of bid estimate and BIN cost. This represents the actual decision the user faces: if bidding would exceed BIN, a rational buyer would just click BIN.

```ts
if (item.listingType === 'AuctionWithBIN' && item.buyItNowPrice) {
  const bidEstimate = item.currentPrice * multiplier + item.shippingCost
  const binCost = item.buyItNowPrice + item.shippingCost
  return Math.min(bidEstimate, binCost)
}
```

### No Debounce on Budget Input

Budget input changes re-trigger `useMemo` synchronously. With 500 items and scoring at ~0.001ms/item, total time is ~0.5ms — well within the 16ms frame budget. No debounce is needed. If profiling ever shows jank, add a 150ms debounce using a local `useState` for the displayed value and a separate debounced value feeding `useMemo`.
