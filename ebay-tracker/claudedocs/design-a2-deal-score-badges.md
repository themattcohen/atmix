# Design: A2 — Deal Score Badges

> Created: 2026-02-21
> Status: READY FOR IMPLEMENTATION
> Depends on: A1 (Sold Comp Engine) — see dependency handling section
> Effort estimate: 5–6 hours
> Branch: feature/a2-deal-score-badges (branch from ebay-api-research)

---

## Overview

Every item in the watchlist shows a color-coded badge indicating whether the current asking price is a deal or not, relative to recent sold comps for the same item category and grade. This is the highest-impact visual feature: eBay structurally cannot build this because showing buyers when they're overpaying discourages bidding and harms seller revenue.

The badge must be immediately legible at a glance, require no user action to see, and update automatically on every sync. When insufficient comp data exists, the badge degrades gracefully to a neutral "Not Enough Data" state.

---

## 1. Deal Score Algorithm

### 1.1 Inputs from A1

The A1 Sold Comp Engine produces, for a given item, a `CompSummary` record containing:

```
compSummary.medianPriceCents     // median sold price across matching comps
compSummary.p25PriceCents        // 25th percentile (lower quartile)
compSummary.p75PriceCents        // 75th percentile (upper quartile)
compSummary.compCount            // number of sold comps matched
compSummary.grade                // PSA 10 | PSA 9 | raw | etc., or null
compSummary.dayWindow            // how many days of data (e.g., 30)
```

The FMV (Fair Market Value) used for scoring is `medianPriceCents`. IQR = `p75PriceCents - p25PriceCents`.

### 1.2 The Effective Cost

Before computing the score, calculate the buyer's all-in cost:

```
effectiveCostCents = currentPrice + shippingCost
```

This is the actual cash outlay. A $45 item with $12 shipping is effectively $57. Comps from A1 must also include shipping when available, so the comparison is apples-to-apples. If A1 comps do not normalize for shipping, this design uses current item shipping only — document this assumption when the A1 contract is finalized.

For auction items where the listing is still live: use `currentPrice` (current bid) as the basis, not `buyItNowPrice`. The score represents "if you won right now at this price, would it be a deal?" — see Section 12 (Edge Cases) for auction-specific handling.

### 1.3 Percent From FMV

```
percentFromFmv = ((effectiveCostCents - medianPriceCents) / medianPriceCents) * 100
```

- Negative value: item costs less than FMV — a potential deal
- Positive value: item costs more than FMV — potentially overpriced
- Zero: item is priced at exact median

### 1.4 Z-Score Calculation (Confidence Signal)

The z-score measures how many IQR units away from the median the effective cost is. Use IQR instead of standard deviation because comp price distributions are typically right-skewed (a few very high outlier sales inflate stddev).

```
iqr = p75PriceCents - p25PriceCents

// Avoid division by zero when all comps sold at same price:
if (iqr === 0) {
  zScore = 0   // all comps identical — price is at median
} else {
  zScore = (effectiveCostCents - medianPriceCents) / iqr
}
```

The z-score is used internally for confidence calibration, not displayed directly. An item priced at -2.5 IQR below median is an unusually strong deal; one at +0.2 IQR is barely above median. This nuance is reflected in the tooltip breakdown but not the badge tier.

### 1.5 Grade-Tier Awareness

Deal scores must only compare like-to-like grades. The A1 engine is expected to filter comps by grade before producing a `CompSummary`. The A2 layer enforces this contract:

- If `compSummary.grade` does not match `item.conditionName` (after normalization), treat as `compCount = 0` and show "Not Enough Data".
- Grade normalization: map `"PSA 10"`, `"PSA-10"`, `"Psa 10"` → `"PSA 10"` before comparing. A thin normalize function handles this.
- Items with `conditionName = null` are matched against comps with `grade = null` (raw/ungraded).

If A1 returns multiple `CompSummary` records (one per grade), pick the one whose `grade` matches the current item's `conditionName`. If none match exactly, show "Not Enough Data" rather than using a wrong-grade comp.

### 1.6 Confidence Thresholds

Minimum comp count required to show a scored badge: **5 comps**.

Below 5 comps, the data is too sparse to be reliable. Show "Not Enough Data" badge regardless of percentage.

Additionally, require that comps are recent:
- Default window: 90 days
- If A1 `compSummary.dayWindow` is provided and all comps are older than 90 days, show "Not Enough Data" (stale market data is worse than no data).

Confidence level is surfaced in the tooltip but does not affect the badge tier beyond the minimum threshold gate.

```typescript
// Confidence score (0.0 – 1.0) used in tooltip only
function computeConfidence(compCount: number, dayWindow: number): number {
  const countScore = Math.min(compCount / 20, 1.0)  // saturates at 20 comps
  const freshnessScore = Math.max(0, 1 - dayWindow / 90)
  return (countScore * 0.7) + (freshnessScore * 0.3)
}
```

---

## 2. Badge Tiers

Five tiers, assigned based on `percentFromFmv` and whether the confidence threshold is met.

### Tier Assignment Logic

```typescript
function assignTier(
  percentFromFmv: number,
  compCount: number,
  dayWindow: number
): DealScoreTier {
  if (compCount < 5 || dayWindow > 90) return 'no_data'

  if (percentFromFmv <= -20) return 'great_deal'
  if (percentFromFmv <= -5)  return 'good_deal'
  if (percentFromFmv <= 10)  return 'fair_price'
  if (percentFromFmv <= 25)  return 'overpriced'
  return 'way_overpriced'
}
```

### Tier Specifications

#### "Great Deal"
- Threshold: effectiveCost is 20% or more BELOW FMV (percentFromFmv <= -20)
- Color: `#10b981` (Tailwind emerald-500, matches `text-status-active` in this codebase)
- Background: `#10b981/20` (20% opacity)
- Label text: "Great Deal"
- Icon: downward arrow (unicode ↓ or SVG chevron-down)
- Use case: item priced at $40 when comps average $51+
- Tooltip phrasing: "Priced {N}% below recent sold comps — historically strong value"

#### "Good Deal"
- Threshold: effectiveCost is 5–20% BELOW FMV (-20 < percentFromFmv <= -5)
- Color: `#34d399` (emerald-400, lighter green)
- Background: `#34d399/15`
- Label text: "Good Deal"
- Icon: downward arrow
- Tooltip phrasing: "Priced {N}% below recent sold comps"

#### "Fair Price"
- Threshold: effectiveCost is within 10% above OR 5% below FMV (-5 < percentFromFmv <= 10)
- Color: `#f59e0b` (Tailwind amber-500, matches `text-urgency-caution` in this codebase)
- Background: `#f59e0b/20`
- Label text: "Fair"
- Icon: horizontal dash (—) or equals sign
- Tooltip phrasing: "Priced near recent sold comps (±{N}%)"

#### "Overpriced"
- Threshold: effectiveCost is 10–25% ABOVE FMV (10 < percentFromFmv <= 25)
- Color: `#ef4444` (Tailwind red-500, matches `text-status-sold` in this codebase)
- Background: `#ef4444/20`
- Label text: "Overpriced"
- Icon: upward arrow (↑)
- Tooltip phrasing: "Priced {N}% above recent sold comps"

#### "Way Overpriced"
- Threshold: effectiveCost is more than 25% ABOVE FMV (percentFromFmv > 25)
- Color: `#dc2626` (red-600, darker red for emphasis)
- Background: `#dc2626/20`
- Label text: "Way Over"
- Icon: double upward arrow (⇑) or warning triangle
- Tooltip phrasing: "Priced {N}% above recent sold comps — significantly above market"

#### "Not Enough Data"
- Trigger: compCount < 5 OR dayWindow > 90 OR no A1 data at all
- Color: `#6b7280` (Tailwind gray-500)
- Background: `#6b7280/15`
- Label text: "No Data"
- Icon: question mark (?)
- Tooltip phrasing: "Fewer than 5 recent sold comps found — cannot determine fair value"
- Note: If A1 is not yet implemented (the dependency), every badge shows "No Data" with the tooltip "Sold comp data not available yet"

### Visual Summary

| Tier | percentFromFmv | Color | Bg opacity | Label |
|------|---------------|-------|-----------|-------|
| great_deal | <= -20% | #10b981 | /20 | "Great Deal" |
| good_deal | <= -5% | #34d399 | /15 | "Good Deal" |
| fair_price | <= +10% | #f59e0b | /20 | "Fair" |
| overpriced | <= +25% | #ef4444 | /20 | "Overpriced" |
| way_overpriced | > +25% | #dc2626 | /20 | "Way Over" |
| no_data | — | #6b7280 | /15 | "No Data" |

---

## 3. TypeScript Types

### 3.1 Additions to `src/types/index.ts`

Add after the existing `WatchlistEvent` interface:

```typescript
// === Deal Score Types (A2) ===

export type DealScoreTier =
  | 'great_deal'
  | 'good_deal'
  | 'fair_price'
  | 'overpriced'
  | 'way_overpriced'
  | 'no_data'

export interface DealScore {
  /** Raw percentage: ((effectiveCost - fmv) / fmv) * 100. Negative = below FMV. */
  percentFromFmv: number | null   // null when no comp data
  tier: DealScoreTier
  /** FMV = median of matched sold comps, in USD cents */
  fmv: number | null
  /** p25 of sold comps, in USD cents */
  fmvLow: number | null
  /** p75 of sold comps, in USD cents */
  fmvHigh: number | null
  /** Effective buyer cost: currentPrice + shippingCost, in USD cents */
  effectiveCostCents: number
  /** IQR-based z-score; negative means below median */
  zScore: number | null
  /** Number of matching sold comps used */
  compCount: number
  /** Age of the oldest comp used, in days */
  dayWindow: number
  /** 0.0–1.0 composite confidence signal */
  confidence: number
  /** Grade the comp matched against, e.g. "PSA 10" or null for raw */
  matchedGrade: string | null
}

// A1 contract: what the Sold Comp Engine returns per item
export interface CompSummary {
  itemId: string
  medianPriceCents: number
  p25PriceCents: number
  p75PriceCents: number
  compCount: number
  dayWindow: number
  grade: string | null
}
```

### 3.2 Add `dealScore` to `WatchlistItem`

Extend the `WatchlistItem` interface with an optional field:

```typescript
export interface WatchlistItem {
  // ... existing fields ...
  dealScore?: DealScore   // undefined when A1 not yet run for this item
}
```

This keeps the type backward-compatible. The items API enriches this field server-side.

---

## 4. New Files

### 4.1 `src/lib/comps/deal-scorer.ts`

Pure computation module. No I/O. Exports two functions.

**Purpose**: Given a `WatchlistItem` and an optional `CompSummary`, produce a `DealScore`.

**Exports**:
- `computeDealScore(item: WatchlistItem, comp: CompSummary | null): DealScore`
- `normalizeGrade(grade: string | null): string | null`

**Implementation sketch**:

```typescript
import type { WatchlistItem, CompSummary, DealScore, DealScoreTier } from '@/types'

const MIN_COMP_COUNT = 5
const MAX_DAY_WINDOW = 90

export function normalizeGrade(grade: string | null): string | null {
  if (!grade) return null
  // Normalize "PSA-10", "psa10", "Psa 10" → "PSA 10"
  const upper = grade.toUpperCase().replace(/[-_]/g, ' ').trim()
  const psaMatch = upper.match(/PSA\s*(\d+)/)
  if (psaMatch) return `PSA ${psaMatch[1]}`
  return upper
}

export function computeDealScore(
  item: WatchlistItem,
  comp: CompSummary | null
): DealScore {
  const effectiveCostCents = item.currentPrice + item.shippingCost

  if (!comp || comp.compCount < MIN_COMP_COUNT || comp.dayWindow > MAX_DAY_WINDOW) {
    return {
      tier: 'no_data',
      percentFromFmv: null,
      fmv: null,
      fmvLow: null,
      fmvHigh: null,
      effectiveCostCents,
      zScore: null,
      compCount: comp?.compCount ?? 0,
      dayWindow: comp?.dayWindow ?? 0,
      confidence: 0,
      matchedGrade: null,
    }
  }

  // Grade check
  const itemGrade = normalizeGrade(item.conditionName)
  const compGrade = normalizeGrade(comp.grade)
  if (itemGrade !== compGrade) {
    return {
      tier: 'no_data',
      percentFromFmv: null,
      fmv: comp.medianPriceCents,
      fmvLow: comp.p25PriceCents,
      fmvHigh: comp.p75PriceCents,
      effectiveCostCents,
      zScore: null,
      compCount: 0,          // grade mismatch = effectively zero usable comps
      dayWindow: comp.dayWindow,
      confidence: 0,
      matchedGrade: null,
    }
  }

  const { medianPriceCents, p25PriceCents, p75PriceCents, compCount, dayWindow } = comp
  const iqr = p75PriceCents - p25PriceCents
  const percentFromFmv = ((effectiveCostCents - medianPriceCents) / medianPriceCents) * 100
  const zScore = iqr === 0 ? 0 : (effectiveCostCents - medianPriceCents) / iqr
  const confidence = computeConfidence(compCount, dayWindow)
  const tier = assignTier(percentFromFmv, compCount, dayWindow)

  return {
    tier,
    percentFromFmv,
    fmv: medianPriceCents,
    fmvLow: p25PriceCents,
    fmvHigh: p75PriceCents,
    effectiveCostCents,
    zScore,
    compCount,
    dayWindow,
    confidence,
    matchedGrade: compGrade,
  }
}

function assignTier(pct: number, compCount: number, dayWindow: number): DealScoreTier {
  if (compCount < MIN_COMP_COUNT || dayWindow > MAX_DAY_WINDOW) return 'no_data'
  if (pct <= -20) return 'great_deal'
  if (pct <= -5)  return 'good_deal'
  if (pct <= 10)  return 'fair_price'
  if (pct <= 25)  return 'overpriced'
  return 'way_overpriced'
}

function computeConfidence(compCount: number, dayWindow: number): number {
  const countScore = Math.min(compCount / 20, 1.0)
  const freshnessScore = Math.max(0, 1 - dayWindow / 90)
  return (countScore * 0.7) + (freshnessScore * 0.3)
}
```

**Testing note**: This file is pure functions with no dependencies, ideal for unit tests. A developer can write jest/vitest tests against it without a browser or database.

---

### 4.2 `src/components/watchlist/deal-badge.tsx`

The badge pill that appears in the watchlist table cell.

**Props**:
```typescript
interface DealBadgeProps {
  dealScore: DealScore | undefined
  /** If true, render a skeleton placeholder. Default false. */
  loading?: boolean
}
```

**Design**:
- Dimensions: `px-2 py-0.5 text-[10px] font-medium leading-none rounded-full`
- Same sizing as existing `Badge` component with `size="sm"` variant
- Does NOT use the existing `Badge` component directly — it has its own style map because the deal tiers require custom hex colors not covered by the existing `BadgeVariant` type (`success | danger | warning | info | default`)
- Wraps itself in `DealTooltip` (see 4.3) so the tooltip is always co-located with the badge
- Has a subtle CSS animation when the tier changes (see Section 7 — Animation)

**Implementation sketch**:

```typescript
'use client'
import type { DealScore, DealScoreTier } from '@/types'
import { DealTooltip } from './deal-tooltip'

const TIER_CONFIG: Record<DealScoreTier, {
  label: string
  icon: string
  color: string
  bg: string
}> = {
  great_deal:    { label: 'Great Deal', icon: '↓', color: '#10b981', bg: 'rgba(16,185,129,0.2)' },
  good_deal:     { label: 'Good Deal',  icon: '↓', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  fair_price:    { label: 'Fair',       icon: '—', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' },
  overpriced:    { label: 'Overpriced', icon: '↑', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' },
  way_overpriced:{ label: 'Way Over',   icon: '⇑', color: '#dc2626', bg: 'rgba(220,38,38,0.2)' },
  no_data:       { label: 'No Data',    icon: '?', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
}

interface DealBadgeProps {
  dealScore?: DealScore
  loading?: boolean
}

export function DealBadge({ dealScore, loading }: DealBadgeProps) {
  if (loading) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
        style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}
        aria-label="Loading deal score"
      >
        ...
      </span>
    )
  }

  const score = dealScore ?? { tier: 'no_data' as DealScoreTier, compCount: 0, dayWindow: 0, confidence: 0 }
  const config = TIER_CONFIG[score.tier]

  const badge = (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none transition-colors deal-badge"
      style={{ background: config.bg, color: config.color }}
      data-tier={score.tier}
      data-testid="deal-badge"
      role="status"
      aria-label={`Deal score: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )

  return <DealTooltip dealScore={dealScore}>{badge}</DealTooltip>
}
```

**Accessibility**: The outer `span` has `role="status"` and `aria-label` with the human-readable tier. Screen readers announce "Deal score: Great Deal". The icon is `aria-hidden` to avoid redundant reading.

---

### 4.3 `src/components/watchlist/deal-tooltip.tsx`

Hover tooltip showing the full comp breakdown.

**Props**:
```typescript
interface DealTooltipProps {
  dealScore: DealScore | undefined
  children: React.ReactNode
}
```

**Design**:
- Extends the existing `Tooltip` component's positioning pattern (bottom-full, left-1/2, z-50) but with richer JSX content — the existing `Tooltip` only accepts a string `content` prop
- Tooltip panel: `min-w-[200px] max-w-[260px]`
- Background: `bg-raised border border-border rounded shadow-lg`
- Opens on `mouseenter`, closes on `mouseleave` (same as existing Tooltip)
- Also opens on `focus` for keyboard accessibility (hover-only tooltips fail WCAG 2.1 SC 1.4.13)

**Tooltip Content when tier is not `no_data`**:

```
FMV: $51.00  (based on 12 comps)
Range: $42.00 – $63.00
Your cost: $47.00 (incl. shipping)
↓ 7.8% below market median
Confidence: ███░░ 62%  (30-day window)
Grade: PSA 10
```

**Tooltip Content when tier is `no_data`**:

```
Not enough data
Fewer than 5 recent sold comps found.
Cannot determine fair value for this item.
```

**Tooltip Content when A1 not yet running** (compCount = 0, dayWindow = 0):

```
Sold comp data unavailable
The comp engine has not yet run for this item.
Scores will appear after the next sync.
```

**Implementation sketch**:

```typescript
'use client'
import { useState } from 'react'
import type { DealScore } from '@/types'

interface DealTooltipProps {
  dealScore: DealScore | undefined
  children: React.ReactNode
}

function formatCents(cents: number | null): string {
  if (cents === null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function confidenceBar(confidence: number): string {
  const filled = Math.round(confidence * 5)
  return '█'.repeat(filled) + '░'.repeat(5 - filled)
}

export function DealTooltip({ dealScore, children }: DealTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none"
          role="tooltip"
        >
          <span className="block min-w-[200px] max-w-[260px] bg-raised border border-border rounded shadow-lg p-2 text-[11px] text-text-primary">
            <TooltipContent dealScore={dealScore} />
          </span>
        </span>
      )}
    </span>
  )
}

function TooltipContent({ dealScore }: { dealScore: DealScore | undefined }) {
  if (!dealScore || dealScore.tier === 'no_data') {
    const reason = !dealScore || (dealScore.compCount === 0 && dealScore.dayWindow === 0)
      ? 'Sold comp engine has not run for this item. Scores appear after next sync.'
      : 'Fewer than 5 recent sold comps found. Cannot determine fair value.'
    return (
      <span className="block space-y-1">
        <span className="block font-semibold text-text-secondary">Not enough data</span>
        <span className="block text-text-secondary">{reason}</span>
      </span>
    )
  }

  const { fmv, fmvLow, fmvHigh, effectiveCostCents, percentFromFmv, compCount, dayWindow, confidence, matchedGrade, zScore } = dealScore
  const direction = (percentFromFmv ?? 0) < 0 ? '↓' : '↑'
  const absPct = Math.abs(percentFromFmv ?? 0).toFixed(1)
  const sentiment = (percentFromFmv ?? 0) < 0 ? 'below' : 'above'

  return (
    <span className="block space-y-1">
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">FMV</span>
        <span className="font-mono font-medium">{formatCents(fmv)} <span className="text-text-secondary text-[10px]">({compCount} comps)</span></span>
      </span>
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">Range</span>
        <span className="font-mono">{formatCents(fmvLow)} – {formatCents(fmvHigh)}</span>
      </span>
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">Your cost</span>
        <span className="font-mono">{formatCents(effectiveCostCents)} <span className="text-text-secondary text-[10px]">(incl. shipping)</span></span>
      </span>
      <span className="block border-t border-border my-1" />
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">vs. market</span>
        <span className="font-mono">{direction} {absPct}% {sentiment}</span>
      </span>
      {matchedGrade && (
        <span className="block flex justify-between gap-4">
          <span className="text-text-secondary">Grade</span>
          <span>{matchedGrade}</span>
        </span>
      )}
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">Confidence</span>
        <span className="font-mono">{confidenceBar(confidence)} {Math.round(confidence * 100)}%</span>
      </span>
      <span className="block flex justify-between gap-4">
        <span className="text-text-secondary">Window</span>
        <span>{dayWindow}d</span>
      </span>
    </span>
  )
}
```

---

### 4.4 `src/hooks/use-deal-scores.ts`

TanStack Query hook that fetches deal scores for all visible items. Runs client-side after the watchlist items are loaded.

**Architecture decision: client-side computation preferred for v1.**

Server-side computation (embedding DealScore in the items API response) adds latency to every items fetch and couples the comp engine to the items route. Client-side is better because:
1. Deal scores are a UI enhancement — items load fast and badges populate asynchronously
2. The comp engine (A1) will have its own endpoint; the A2 hook can call it independently
3. TanStack Query handles caching and background refetching naturally
4. The table remains fully functional before scores arrive

Server-side merge is the right architecture once A1 is mature (v2 of this feature, post-launch).

**The hook calls a new endpoint** `GET /api/comps?itemIds=111,222,333` (see Section 6) and returns a map from itemId to DealScore.

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import type { DealScore, CompSummary, WatchlistItem } from '@/types'
import { computeDealScore } from '@/lib/comps/deal-scorer'

type DealScoreMap = Record<string, DealScore>

export function useDealScores(items: WatchlistItem[]): {
  scores: DealScoreMap
  isLoading: boolean
  isError: boolean
} {
  const itemIds = items.map((i) => i.id)

  const { data, isLoading, isError } = useQuery<Record<string, CompSummary | null>>({
    queryKey: ['deal-scores', itemIds.join(',')],
    queryFn: async () => {
      if (itemIds.length === 0) return {}
      const res = await fetch(`/api/comps?itemIds=${itemIds.join(',')}`)
      if (!res.ok) throw new Error('Failed to fetch comp data')
      const json = await res.json()
      return json.data  // { [itemId]: CompSummary | null }
    },
    enabled: itemIds.length > 0,
    // Refresh after each sync cycle (60s matches watchlist refetch interval)
    refetchInterval: 60_000,
    // Stale after 55s — ensures fresh data after sync
    staleTime: 55_000,
    // Don't block the watchlist table while scores load
    placeholderData: (prev) => prev,
  })

  const scores: DealScoreMap = {}
  if (data) {
    for (const item of items) {
      const comp = data[item.id] ?? null
      scores[item.id] = computeDealScore(item, comp)
    }
  }

  return { scores, isLoading, isError }
}
```

**Note**: The `enabled: itemIds.length > 0` guard prevents an empty fetch on first render. The `placeholderData` option keeps previous scores visible while revalidating, avoiding a flash of "No Data" badges on refetch.

---

## 5. UI Component Specification

### 5.1 Badge Dimensions and Typography

```
height:      ~18px (inline, dictated by text + padding)
padding:     px-2 py-0.5 (8px horizontal, 2px vertical)
font-size:   10px (text-[10px])
font-weight: 500 (medium)
line-height: none (leading-none)
border-radius: 9999px (rounded-full)
gap:         0.5 (gap-0.5) between icon and label text
```

This matches the existing `Badge` component's `size="sm"` dimensions exactly, ensuring visual consistency across the table row.

### 5.2 Badge Placement

The deal badge gets its own new column, not embedded inside the price cell.

**Rationale**: Embedding inside price-cell.tsx would make the price column significantly wider. The delta badge is already a second element inside the price cell. A third element (deal score) is too much for one cell. A dedicated column keeps each piece of information scannable independently.

**Column position**: Between "Price" and "Delta" in the table. Header label: "Deal".

The column key is `dealScore` in `visibleColumns`.

On mobile (viewport < 768px): the "Deal" column is hidden by default. The badge is visible on the detail page instead.

### 5.3 Column Header

```html
<th class="[10px uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left whitespace-nowrap]">
  Deal
</th>
```

### 5.4 Mobile Behavior

- Default `visibleColumns.dealScore = true` on desktop (>= 768px)
- Default `visibleColumns.dealScore = false` on mobile (< 768px)
- The column toggle (ColumnToggle component) includes "Deal" in the list so users can toggle it manually
- On mobile, the deal score appears on the item detail page instead (see Section 8)

### 5.5 Animation on Score Tier Change

When a deal score tier changes between renders (e.g., after a sync refreshes prices), flash the badge briefly to draw attention.

**Implementation**: Use a CSS keyframe animation triggered by a `data-tier` attribute change. Because React re-renders the component with a new `data-tier` when the tier changes, apply the animation on mount via a short-lived class.

```css
/* Add to globals.css */
@keyframes deal-badge-flash {
  0%   { opacity: 0.4; transform: scale(0.9); }
  50%  { opacity: 1;   transform: scale(1.05); }
  100% { opacity: 1;   transform: scale(1); }
}

.deal-badge-animate {
  animation: deal-badge-flash 400ms ease-out;
}
```

In the `DealBadge` component, track the previous tier using `useRef` and add the animation class when tier changes:

```typescript
const prevTierRef = useRef<DealScoreTier | undefined>(undefined)
const [animating, setAnimating] = useState(false)

useEffect(() => {
  if (prevTierRef.current !== undefined && prevTierRef.current !== score.tier) {
    setAnimating(true)
    const t = setTimeout(() => setAnimating(false), 400)
    return () => clearTimeout(t)
  }
  prevTierRef.current = score.tier
}, [score.tier])
```

Apply `deal-badge-animate` class when `animating` is true. On first mount (no previous tier), no animation fires.

---

## 6. API Changes

### 6.1 New Endpoint: `GET /api/comps`

**File**: `src/app/api/comps/route.ts` (new file)

**Purpose**: Returns comp summaries for a batch of item IDs. Called by `useDealScores` hook.

**Query params**:
- `itemIds`: comma-separated string of eBay item IDs (e.g., `?itemIds=111,222,333`)
- `days`: optional, default `90` — how many days of sold comps to look back

**Response shape**:
```typescript
// Success
{
  data: {
    [itemId: string]: CompSummary | null  // null = no comps found for this item
  }
}

// Error
{
  error: { code: string, message: string }
}
```

**Implementation**:

```typescript
// src/app/api/comps/route.ts
import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getCompSummaries } from '@/lib/comps/comp-repo'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const itemIdsParam = params.get('itemIds') ?? ''
    const days = parseInt(params.get('days') ?? '90', 10)

    const itemIds = itemIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (itemIds.length === 0) return routeOk({})
    if (itemIds.length > 100) {
      return routeError(new Error('Too many item IDs (max 100)'))
    }

    const summaries = getCompSummaries(itemIds, days)
    return routeOk(summaries)
  } catch (err) {
    return routeError(err)
  }
}
```

**Data source** (`src/lib/comps/comp-repo.ts` — new file, see Section 9 Modified Files):

When A1 is not yet built, `getCompSummaries` returns `{}` (empty object, all nulls) — the hook handles this gracefully by showing "No Data" badges.

When A1 is built, `getCompSummaries` queries the comps database table that A1 populates. This is the A1/A2 seam.

**Database table contract with A1** (A2 reads, A1 writes):

```sql
-- Table owned by A1, read by A2
CREATE TABLE IF NOT EXISTS comp_summaries (
  item_id           TEXT NOT NULL PRIMARY KEY,
  median_price_cents INTEGER NOT NULL,
  p25_price_cents   INTEGER NOT NULL,
  p75_price_cents   INTEGER NOT NULL,
  comp_count        INTEGER NOT NULL,
  day_window        INTEGER NOT NULL,
  grade             TEXT,           -- null = raw/ungraded
  computed_at       TEXT NOT NULL   -- ISO 8601 timestamp
);
```

The `getCompSummaries` function:
```typescript
// src/lib/comps/comp-repo.ts
import { db } from '@/lib/db/client'
import type { CompSummary } from '@/types'

export function getCompSummaries(
  itemIds: string[],
  _days: number
): Record<string, CompSummary | null> {
  // A1 stub: returns all nulls until A1 is implemented
  // TODO: Replace with real DB query when A1 builds comp_summaries table
  const result: Record<string, CompSummary | null> = {}
  for (const id of itemIds) {
    result[id] = null
  }
  return result

  // When A1 is ready, replace the above with:
  // const placeholders = itemIds.map(() => '?').join(',')
  // const rows = db.prepare(`
  //   SELECT item_id, median_price_cents, p25_price_cents, p75_price_cents,
  //          comp_count, day_window, grade
  //   FROM comp_summaries
  //   WHERE item_id IN (${placeholders})
  // `).all(...itemIds) as any[]
  // for (const id of itemIds) {
  //   const row = rows.find(r => r.item_id === id)
  //   result[id] = row ? { itemId: row.item_id, ... } : null
  // }
}
```

### 6.2 No changes to existing API routes

The items route (`/api/items`) is NOT modified. Deal scores are fetched separately. This is a deliberate decoupling decision.

---

## 7. Integration with Watchlist Table

### 7.1 Changes to `src/store/watchlist-store.ts`

Add `dealScore` to `visibleColumns` default state:

```typescript
visibleColumns: {
  rank: true,
  image: true,
  title: true,
  price: true,
  dealScore: true,   // new
  delta: true,
  watchers: true,
  bidCount: true,
  timeLeft: true,
  status: true,
  queue: true,
},
```

### 7.2 Changes to `src/components/watchlist/column-toggle.tsx`

Add `dealScore` to `columnLabels`:

```typescript
const columnLabels: Record<string, string> = {
  rank: 'Rank',
  image: 'Image',
  title: 'Title',
  price: 'Price',
  dealScore: 'Deal Score',   // new
  delta: 'Delta',
  watchers: 'Watchers',
  bidCount: 'Bids',
  timeLeft: 'Time Left',
  status: 'Status',
  queue: 'Queue',
}
```

### 7.3 Changes to `src/components/watchlist/watchlist-table.tsx`

Add the new column header between Price and Delta:

```typescript
{visibleColumns.dealScore && (
  <th className={headerClass}>Deal</th>
)}
```

The full header row becomes:
```
[drag] [#] [img] [Title] [Price] [Deal] [Delta] [Watchers] [Bids] [Time Left] [Status] [queue]
```

The `colSpan` on the "Unranked" separator row must be updated. Currently it counts `Object.values(visibleColumns).filter(Boolean).length + 1`. Since the new column is gated behind `visibleColumns.dealScore`, this expression stays correct automatically (it counts all true values including the new one).

### 7.4 Changes to `src/components/watchlist/watchlist-row.tsx`

The row component needs:
1. A `dealScores` prop (the map from `useDealScores`)
2. The new `<td>` for the deal badge

However, looking at the current architecture, `WatchlistRow` receives only `item: WatchlistItem`. The `useDealScores` hook returns a map keyed by item ID.

**Option A**: Pass `dealScores` map down from `WatchlistTable` → `WatchlistRow`. Cleaner prop flow.
**Option B**: Embed `dealScore?: DealScore` directly on `WatchlistItem` and pass it pre-enriched.
**Option C**: Call `useDealScores` at the table level and pass the individual score as a prop to each row.

**Decision: Option C.** Call `useDealScores` in `WatchlistTable` (not in `WatchlistRow`), and pass the resolved `DealScore | undefined` as a prop to each row. This keeps the hook call at the highest needed level and avoids N hook calls (one per row).

**Changes to `watchlist-table.tsx`**:

```typescript
// At top of WatchlistTable function body:
const allItems = useMemo(() => [...ranked, ...unranked], [ranked, unranked])
const { scores: dealScores, isLoading: scoresLoading } = useDealScores(allItems)

// Pass to each WatchlistRow:
<WatchlistRow
  key={item.id}
  item={item}
  dealScore={dealScores[item.id]}
  dealScoreLoading={scoresLoading}
/>
```

**Changes to `watchlist-row.tsx`**:

Add props:
```typescript
interface WatchlistRowProps {
  item: WatchlistItem
  dealScore?: DealScore
  dealScoreLoading?: boolean
}
```

Add the new `<td>` between price and delta:
```typescript
{/* Deal Score */}
{visibleColumns.dealScore && (
  <td className="px-2 py-1.5">
    <DealBadge dealScore={dealScore} loading={dealScoreLoading} />
  </td>
)}
```

Import `DealBadge` and `DealScore` type at the top of the file.

### 7.5 No changes to `price-cell.tsx`

The existing price cell is not modified. The delta badge inside it remains. Deal score is in its own column.

---

## 8. Detail Page Integration

### 8.1 `src/app/items/[itemId]/page.tsx`

The item detail page uses `useItemDetail(itemId)` which returns the item, snapshots, and events. Add a second query for comp data:

```typescript
// In ItemDetailPage, alongside useItemDetail:
import { useDealScores } from '@/hooks/use-deal-scores'

// Inside component:
const { scores: dealScores } = useDealScores(data ? [data.item] : [])
const dealScore = data ? dealScores[data.item.id] : undefined
```

Pass `dealScore` to the new `CompPanel` component (see 8.2).

The layout currently is:
```
<ItemHeader />
<ItemStatsGrid />
<PriceChart /> | <WatcherChart />
<ItemEvents />
```

New layout:
```
<ItemHeader />
<DealScorePanel dealScore={dealScore} />    ← NEW, full-width
<ItemStatsGrid />
<PriceChart /> | <WatcherChart />
<ItemEvents />
```

### 8.2 New File: `src/components/detail/deal-score-panel.tsx`

A full-width panel on the detail page that shows the deal score with a richer breakdown than the table tooltip.

**Props**:
```typescript
interface DealScorePanelProps {
  dealScore: DealScore | undefined
}
```

**Visual layout**:

```
┌──────────────────────────────────────────────────────┐
│  DEAL ANALYSIS                                        │
│                                                       │
│  [GREAT DEAL badge]  ↓ 22.4% below market median     │
│                                                       │
│  FMV: $51.00  (12 sold comps, last 30 days)          │
│  Range: $42 ────────●────────── $63                  │
│                  ↑ you're here ($40)                  │
│  Grade: PSA 10   Confidence: ███░░ 62%               │
│                                                       │
│  Why this score?                                      │
│  Based on 12 recently sold PSA 10 examples.           │
│  Your all-in cost of $40.00 is $11.00 below          │
│  the median sale price of $51.00.                     │
└──────────────────────────────────────────────────────┘
```

**Price range bar**: A simple horizontal bar (CSS, no Recharts) showing:
- Left endpoint: fmvLow formatted
- Right endpoint: fmvHigh formatted
- A dot (●) at the position representing effectiveCostCents relative to the fmvLow/fmvHigh range
- Color of the dot matches the tier color

Positioning math:
```typescript
const pct = clamp(
  ((effectiveCostCents - fmvLow) / (fmvHigh - fmvLow)) * 100,
  0,
  100
)
// dot left: `${pct}%`
```

Import `clamp` from `@/lib/utils` (already defined there).

**"Why this score?" section**: One paragraph in plain language, generated deterministically from the `DealScore` fields. No AI. Example templates:

- Great Deal: "Based on {compCount} recently sold {grade} examples. Your all-in cost of {effectiveCost} is {dollars} ({pct}%) below the median sale price of {fmv}."
- Overpriced: "Based on {compCount} recently sold {grade} examples. The asking price is {dollars} ({pct}%) above the market median of {fmv}. Consider watching for a price drop."
- No Data: "Not enough recent sold comparables were found to score this item. Check back after the next sync."

**Data-testid attributes**:
- `data-testid="deal-score-panel"` on the outer div
- `data-testid="deal-score-tier"` on the badge span
- `data-testid="deal-score-fmv"` on the FMV value
- `data-testid="deal-score-explanation"` on the paragraph

---

## 9. Complete List of Modified Files

### New Files (7)

| File | Purpose |
|------|---------|
| `src/lib/comps/deal-scorer.ts` | Pure scoring algorithm + grade normalization |
| `src/lib/comps/comp-repo.ts` | DB read layer for A1's comp_summaries table (stub until A1 ships) |
| `src/app/api/comps/route.ts` | GET endpoint for batch comp summaries |
| `src/components/watchlist/deal-badge.tsx` | Badge pill for table rows |
| `src/components/watchlist/deal-tooltip.tsx` | Hover/focus tooltip with breakdown |
| `src/hooks/use-deal-scores.ts` | TanStack Query hook, batch fetches comp data |
| `src/components/detail/deal-score-panel.tsx` | Full breakdown panel on detail page |

### Modified Files (7)

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `DealScoreTier`, `DealScore`, `CompSummary` types; add `dealScore?` to `WatchlistItem` |
| `src/store/watchlist-store.ts` | Add `dealScore: true` to `visibleColumns` default |
| `src/components/watchlist/column-toggle.tsx` | Add `'dealScore': 'Deal Score'` to `columnLabels` |
| `src/components/watchlist/watchlist-table.tsx` | Add column header; call `useDealScores`; pass score props to rows |
| `src/components/watchlist/watchlist-row.tsx` | Add `dealScore` + `dealScoreLoading` props; add deal badge `<td>` |
| `src/app/items/[itemId]/page.tsx` | Call `useDealScores`; render `DealScorePanel` |
| `src/app/globals.css` | Add `deal-badge-flash` keyframe animation |

### NOT Modified

- `src/components/watchlist/price-cell.tsx` — no changes
- `src/lib/errors.ts` — no changes
- `src/lib/db/*.ts` — no changes (A1 owns the DB schema for comps)
- `src/hooks/use-watchlist.ts` — no changes
- Any existing API routes — no changes

---

## 10. Test Plan

### 10.1 New Mock Data in `tests/e2e/helpers/mock-data.ts`

Add the following exports:

```typescript
import type { DealScore, CompSummary } from '../../../src/types'

// Comp summaries per scenario
export const mockCompSummaries = {
  greatDeal: {
    itemId: '111',
    medianPriceCents: 7000,    // $70 median
    p25PriceCents: 5500,
    p75PriceCents: 8500,
    compCount: 12,
    dayWindow: 30,
    grade: 'PSA 10',
  } satisfies CompSummary,

  goodDeal: {
    itemId: '222',
    medianPriceCents: 9000,    // $90 median; item costs $82.50
    p25PriceCents: 7500,
    p75PriceCents: 11000,
    compCount: 8,
    dayWindow: 45,
    grade: null,               // raw/ungraded
  } satisfies CompSummary,

  fairPrice: {
    itemId: '333',
    medianPriceCents: 1300,    // $13 median; item costs $12
    p25PriceCents: 1000,
    p75PriceCents: 1600,
    compCount: 6,
    dayWindow: 60,
    grade: 'PSA 10',
  } satisfies CompSummary,

  overpriced: {
    itemId: '444',             // sold item
    medianPriceCents: 12000,   // $120 median; item was $150
    p25PriceCents: 10000,
    p75PriceCents: 14000,
    compCount: 15,
    dayWindow: 30,
    grade: null,
  } satisfies CompSummary,

  notEnoughData: {
    itemId: '555',
    medianPriceCents: 3500,
    p25PriceCents: 2800,
    p75PriceCents: 4200,
    compCount: 2,              // < 5 threshold → no_data tier
    dayWindow: 25,
    grade: null,
  } satisfies CompSummary,
}

// Mock API response for /api/comps?itemIds=111,222,333,444,555
export const mockCompsResponse = {
  data: {
    '111': mockCompSummaries.greatDeal,
    '222': mockCompSummaries.goodDeal,
    '333': mockCompSummaries.fairPrice,
    '444': mockCompSummaries.overpriced,
    '555': mockCompSummaries.notEnoughData,
  },
}

// Scenario where A1 has not run yet (all nulls)
export const mockCompsEmptyResponse = {
  data: {
    '111': null,
    '222': null,
    '333': null,
    '444': null,
    '555': null,
  },
}
```

### 10.2 New E2E Test File: `tests/e2e/deal-badges.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockCompsResponse, mockCompsEmptyResponse, mockEventsResponse } from './helpers/mock-data'

function interceptAll(page, compsResponse = mockCompsResponse) {
  return Promise.all([
    page.route('**/api/items?*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/items', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events?*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/comps?*', (route) => route.fulfill({ json: compsResponse })),
  ])
}

test.describe('Deal Score Badges', () => {
  // TA01: Column header renders
  test('TA01: Deal column header is visible', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    await expect(page.getByRole('columnheader', { name: 'Deal' })).toBeVisible()
  })

  // TA02: Great Deal badge renders on matching item
  test('TA02: Great Deal badge shows for item 111 (22% below FMV)', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'Vintage Baseball Card 1952' })
    const badge = row.locator('[data-testid="deal-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText(/Great Deal/)
    await expect(badge).toHaveAttribute('data-tier', 'great_deal')
  })

  // TA03: Good Deal badge renders
  test('TA03: Good Deal badge shows for item 222 (8.3% below FMV)', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: '1986 Topps Football Set' })
    const badge = row.locator('[data-testid="deal-badge"]')
    await expect(badge).toHaveAttribute('data-tier', 'good_deal')
    await expect(badge).toHaveText(/Good Deal/)
  })

  // TA04: Fair badge renders
  test('TA04: Fair badge shows for item 333 (7.7% below FMV — within fair range)', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'PSA 10 Rookie Card' })
    const badge = row.locator('[data-testid="deal-badge"]')
    await expect(badge).toHaveAttribute('data-tier', 'fair_price')
    await expect(badge).toHaveText(/Fair/)
  })

  // TA05: Not Enough Data shows for item with < 5 comps
  test('TA05: No Data badge shows for item 555 (2 comps, below threshold)', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'Antique Watch Omega' })
    const badge = row.locator('[data-testid="deal-badge"]')
    await expect(badge).toHaveAttribute('data-tier', 'no_data')
    await expect(badge).toHaveText(/No Data/)
  })

  // TA06: All badges show No Data when A1 has not run
  test('TA06: all badges show No Data when comps API returns all nulls', async ({ page }) => {
    await interceptAll(page, mockCompsEmptyResponse)
    await page.goto('/')
    const badges = page.locator('[data-testid="deal-badge"]')
    const count = await badges.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-tier', 'no_data')
    }
  })

  // TA07: Tooltip appears on hover and shows FMV
  test('TA07: tooltip shows FMV on hover for Great Deal item', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'Vintage Baseball Card 1952' })
    await row.locator('[data-testid="deal-badge"]').hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await expect(page.getByRole('tooltip')).toContainText('$70.00')
  })

  // TA08: Tooltip shows correct comp count
  test('TA08: tooltip comp count matches mock data (12 comps)', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'Vintage Baseball Card 1952' })
    await row.locator('[data-testid="deal-badge"]').hover()
    await expect(page.getByRole('tooltip')).toContainText('12 comps')
  })

  // TA09: No Data tooltip explains the reason
  test('TA09: No Data tooltip explains insufficient comps', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    const row = page.locator('table tr').filter({ hasText: 'Antique Watch Omega' })
    await row.locator('[data-testid="deal-badge"]').hover()
    await expect(page.getByRole('tooltip')).toContainText('Not enough data')
  })

  // TA10: Column toggle hides Deal column
  test('TA10: column toggle can hide the Deal column', async ({ page }) => {
    await interceptAll(page)
    await page.goto('/')
    await expect(page.getByRole('columnheader', { name: 'Deal' })).toBeVisible()
    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByLabel('Deal Score').uncheck()
    await expect(page.getByRole('columnheader', { name: 'Deal' })).not.toBeVisible()
    const badges = page.locator('[data-testid="deal-badge"]')
    await expect(badges).toHaveCount(0)
  })

  // TA11: Detail page shows deal score panel
  test('TA11: deal score panel renders on item detail page', async ({ page }) => {
    await Promise.all([
      page.route('**/api/items/111', (route) => route.fulfill({
        json: { data: { item: mockWatchlistResponse.data.ranked[0], snapshots: [], events: [] } }
      })),
      page.route('**/api/comps?*', (route) => route.fulfill({ json: mockCompsResponse })),
    ])
    await page.goto('/items/111')
    await expect(page.locator('[data-testid="deal-score-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="deal-score-tier"]')).toHaveText(/Great Deal/)
    await expect(page.locator('[data-testid="deal-score-fmv"]')).toContainText('$70.00')
    await expect(page.locator('[data-testid="deal-score-explanation"]')).toBeVisible()
  })

  // TA12: Detail page shows No Data panel when A1 not yet run
  test('TA12: detail page shows no data state when comps unavailable', async ({ page }) => {
    await Promise.all([
      page.route('**/api/items/111', (route) => route.fulfill({
        json: { data: { item: mockWatchlistResponse.data.ranked[0], snapshots: [], events: [] } }
      })),
      page.route('**/api/comps?*', (route) => route.fulfill({ json: mockCompsEmptyResponse })),
    ])
    await page.goto('/items/111')
    await expect(page.locator('[data-testid="deal-score-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="deal-score-tier"]')).toHaveText(/No Data/)
  })
})
```

### 10.3 Unit Tests (Optional but Recommended)

The pure functions in `src/lib/comps/deal-scorer.ts` are ideal for unit tests. If a test runner is added (vitest or jest), write unit tests covering:

1. `normalizeGrade('PSA-10')` returns `'PSA 10'`
2. `normalizeGrade('psa 9')` returns `'PSA 9'`
3. `normalizeGrade(null)` returns `null`
4. `computeDealScore` with comp null → tier `no_data`
5. `computeDealScore` with compCount < 5 → tier `no_data`
6. `computeDealScore` with dayWindow > 90 → tier `no_data`
7. `computeDealScore` with grade mismatch → tier `no_data`
8. `computeDealScore` with -22% from FMV → tier `great_deal`
9. `computeDealScore` with -10% from FMV → tier `good_deal`
10. `computeDealScore` with 0% → tier `fair_price`
11. `computeDealScore` with +15% → tier `overpriced`
12. `computeDealScore` with +30% → tier `way_overpriced`
13. `computeDealScore` with iqr=0 → zScore=0, no crash

---

## 11. Edge Cases

### 11.1 Item Has No Comps at All

**Scenario**: A1 has never found any sold listings for this item's title keywords.

**Handling**: `comp-repo.ts` returns `null` for that itemId. `computeDealScore` receives `null` comp and returns `{ tier: 'no_data', compCount: 0, dayWindow: 0, ... }`. Badge shows "No Data". Tooltip says "Fewer than 5 recent sold comps found."

No crash. No empty state error in the UI.

### 11.2 Item Has Comps But All Are Different Grade

**Scenario**: Item is PSA 10, but A1 only found comps for PSA 9.

**Handling**: The grade check in `computeDealScore` compares `normalizeGrade(item.conditionName)` against `normalizeGrade(comp.grade)`. If they do not match, return `tier: 'no_data'` with `compCount: 0`. The tooltip says "Fewer than 5 recent sold comps found" (technically true for the matched grade).

If A1 returns multiple `CompSummary` records per item (one per grade), the hook must pass only the matching grade's summary to the scorer. The `useDealScores` hook and `comp-repo.ts` will need to handle a `CompSummary[]` return type in that case. This is a v2 concern — for now, A1 is expected to pre-filter by grade and return one summary per item.

### 11.3 Item Price is $0 or Missing (BIN with Offers, "Best Offer Only")

**Scenario**: eBay listings with "Best Offer Only" show `currentPrice = 0` (no asking price displayed).

**Handling**:
```typescript
if (item.currentPrice === 0) {
  return { tier: 'no_data', ... }
}
```

When effectiveCostCents is 0, all percentage calculations produce -100% (100% below FMV), which would wrongly show "Great Deal." Return `no_data` with tooltip "No fixed price — best offer listings cannot be scored."

### 11.4 Auction Item Still Live

**Scenario**: An auction with 3 days remaining shows `currentPrice = 4500` (current high bid). Should a "Great Deal" badge show?

**Handling**: Yes, compute the score based on current bid plus shipping. The badge represents "at this bid level right now, is this a deal?" — this is useful signal. If the item has bids and the auction is live, add a note to the tooltip: "Auction in progress — final price may differ."

Logic:
```typescript
const isLiveAuction = item.listingType === 'Auction' && item.endTime
  && new Date(item.endTime) > new Date()
  && item.bidCount > 0
// If isLiveAuction, add auctionNote to DealScore (optional string field)
```

Add `auctionNote?: string` to `DealScore` interface. The tooltip renders it if present.

For auctions with zero bids: the current price is typically the starting bid set by the seller. A very low starting bid relative to FMV shows "Great Deal" — which is accurate from a buyer perspective (this auction *could* be a great deal if you win at this price).

### 11.5 Item is Sold (Status: "Sold")

**Scenario**: A sold item still appears in the watchlist (status = "Sold" or "Ended"). Should we show a deal score?

**Handling**: Show the deal score based on what the item *sold for*. The `currentPrice` at the time of sale is the final transaction price. This is actually the most interesting signal: "This sold for 22% above FMV — demand for this item is hot."

The badge renders normally. Tooltip says "Item has sold. This was the final sale price."

No special casing required — the existing score logic handles it correctly.

### 11.6 Shipping Cost is Unknown

**Scenario**: `item.shippingCost = 0` could mean "free shipping" or "not specified."

**Handling**: The `WatchlistItem` type shows `shippingCost: number` (no nullable) with a default of `0`. Treat 0 as "free or unknown." The tooltip shows "Your cost: $X.XX (incl. shipping)" even when shipping is 0. This is acceptable ambiguity.

When A1 normalizes comp prices, it should also normalize for shipping when possible (comps fetched via eBay Browse API include shipping). If A1 cannot normalize comp shipping, document this in the `CompSummary` type with a `shippingIncluded: boolean` flag and reflect it in the tooltip.

### 11.7 A1 Not Yet Implemented

**Scenario**: This is the first implementation and A1 does not exist yet.

**Handling**: `comp-repo.ts` is a stub that returns all nulls. Every badge shows "No Data." The badge column is fully rendered; it just shows the gray "No Data" state. Zero crashes, zero undefined access errors. The system degrades completely gracefully.

The stub is clearly marked with a `// TODO: Replace with real DB query when A1 builds comp_summaries table` comment.

---

## 12. Implementation Order

Recommended sequence for a developer building this feature:

1. **Types** — Add to `src/types/index.ts` first. TypeScript will immediately flag missing implementations.
2. **deal-scorer.ts** — Pure functions, no dependencies. Can be written and manually tested in isolation.
3. **comp-repo.ts stub** — Write the stub that returns all nulls. Keeps things working end-to-end from day one.
4. **API route** — `src/app/api/comps/route.ts`. Test with curl: `curl 'http://localhost:3005/api/comps?itemIds=111,222'`
5. **use-deal-scores.ts** — Hook wiring the API call. Test by adding `console.log(scores)` in the table temporarily.
6. **deal-tooltip.tsx** — Build tooltip first so the badge can wrap it immediately.
7. **deal-badge.tsx** — Badge pill wrapping the tooltip.
8. **Store + column-toggle** — Add `dealScore` to visibleColumns and columnLabels.
9. **watchlist-table.tsx** — Add column header, useDealScores call, pass props.
10. **watchlist-row.tsx** — Add props, add `<td>` cell.
11. **globals.css** — Add keyframe animation.
12. **deal-score-panel.tsx** — Detail page panel.
13. **item detail page** — Wire in useDealScores + DealScorePanel.
14. **mock-data.ts additions** — Add comp mock data.
15. **deal-badges.spec.ts** — Write and run E2E tests.
16. **Verify**: All 21 existing E2E tests still pass. New 12 E2E tests pass.

---

## 13. Accessibility Checklist

- Badge `role="status"` with `aria-label="Deal score: {tier label}"` — screen readers announce badge content
- Icon spans have `aria-hidden="true"` — icons are decorative, not read aloud
- Tooltip opens on `focus` in addition to `mouseenter` — keyboard users can access breakdown
- `role="tooltip"` on the tooltip container — announces correctly to screen readers
- Color alone is never the only signal — label text always accompanies color
- Meets WCAG 2.1 SC 1.4.3 (contrast): all tier colors are at or above 3:1 contrast on their respective background colors
- "Not Enough Data" gray (#6b7280 on rgba gray bg) — verify contrast ratio ≥ 3:1 against `bg-raised` surface color in the app's dark theme

---

## 14. Performance Considerations

- `useDealScores` fires one fetch for all items combined (`?itemIds=111,222,...`) — not N fetches per row
- `comp-repo.ts` queries with `WHERE item_id IN (...)` — single SQL query for all IDs
- Scores are cached by TanStack Query for 55 seconds — refetched in sync with the watchlist 60s interval
- `placeholderData: (prev) => prev` prevents badge flash-to-gray on background refetch
- The 400ms CSS animation is hardware-accelerated (transform + opacity only — no layout changes)
- `DealBadge` and `DealTooltip` do not cause additional network requests — they render from props

Maximum payload size: 100 items (enforced server-side) × ~150 bytes per CompSummary = ~15 KB. Well within acceptable range.

---

## 15. A1/A2 Integration Seam Summary

The clean boundary between A1 and A2 is the `comp_summaries` SQLite table and the `CompSummary` TypeScript type.

**A1 owns**: Writing to `comp_summaries`. The schema is specified in Section 6.1. A1 is responsible for querying eBay sold comps, computing medians and percentiles, grouping by grade, and writing rows.

**A2 owns**: Reading from `comp_summaries` via `comp-repo.ts`. Computing `DealScore` from the data. Rendering badges and tooltips.

**Neither side** knows about the other's internal implementation. A1 can evolve its fetching logic without touching any A2 files. A2 can change its scoring algorithm without touching any A1 files. The `CompSummary` interface is the contract — changes to it require both sides to update.

Until A1 ships: A2 runs in its fully degraded "No Data" state. Zero blocking dependency.
