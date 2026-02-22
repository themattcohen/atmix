import type {
  WatchlistItem,
  AuctionMode,
  ExcludedReason,
  ScoreBreakdown,
  ScoredItem,
  OptimizationResult,
} from '@/types'
import {
  rankValue,
  urgencyScore,
  confidenceScore,
  competitionPenalty,
  priceOpportunity,
} from './scoring'

// ---------------------------------------------------------------------------
// 4.2 estimatedCost — Mode-adjusted cost for budget allocation
// ---------------------------------------------------------------------------

export function estimatedCost(item: WatchlistItem, mode: AuctionMode): number {
  const multiplier =
    mode === 'conservative' ? 1.50
    : mode === 'aggressive' ? 1.10
    : 1.25 // moderate (default)

  const shipping = item.shippingCost ?? 0

  if (item.listingType === 'FixedPrice') {
    return item.currentPrice + shipping
  }

  if (item.listingType === 'AuctionWithBIN' && item.buyItNowPrice && item.buyItNowPrice > 0) {
    const bidEstimate = Math.round(item.currentPrice * multiplier) + shipping
    const binCost = item.buyItNowPrice + shipping
    return Math.min(bidEstimate, binCost)
  }

  // Plain Auction (no BIN)
  return Math.round(item.currentPrice * multiplier) + shipping
}

// ---------------------------------------------------------------------------
// Composite score computation
// Weights: 0.40 rank + 0.20 urgency + 0.10 confidence - 0.10 competition + 0.20 price
// ---------------------------------------------------------------------------

export function computeBreakdown(item: WatchlistItem, totalItems: number): ScoreBreakdown {
  const rv = rankValue(item.rank, totalItems)
  const us = urgencyScore(item.endTime)
  const cs = confidenceScore(item.listingType, item.bidCount ?? 0)
  const cp = competitionPenalty(item.watcherCount, item.bidCount ?? 0)
  const po = priceOpportunity(item)
  const total = 0.40 * rv + 0.20 * us + 0.10 * cs - 0.10 * cp + 0.20 * po

  return {
    rankValue: rv,
    urgencyScore: us,
    confidenceScore: cs,
    competitionPenalty: cp,
    priceOpportunity: po,
    total,
  }
}

export function computeScore(item: WatchlistItem, totalItems: number): number {
  return computeBreakdown(item, totalItems).total
}

// ---------------------------------------------------------------------------
// 5.2 Greedy allocation algorithm
// ---------------------------------------------------------------------------

// Items whose endTime is > 5 minutes in the past are treated as not-active
const STALE_END_GUARD_MS = 5 * 60 * 1000

export function optimizeBudget(
  items: WatchlistItem[],
  budgetCents: number,
  mode: AuctionMode
): OptimizationResult {
  const now = Date.now()

  // Build excluded list for non-active / non-ranked items first
  const nonCandidateExclusions: ScoredItem[] = []

  // Step 1: Filter candidates — only ranked + active items
  const candidates: WatchlistItem[] = []

  for (const item of items) {
    // Guard: ended items (endTime > 5min past, status still Active)
    const isStaleEnded =
      item.endTime !== null &&
      new Date(item.endTime).getTime() < now - STALE_END_GUARD_MS

    if (item.rank === null) {
      nonCandidateExclusions.push({
        item,
        score: 0,
        estimatedCost: estimatedCost(item, mode),
        breakdown: computeBreakdown(item, 1),
        included: false,
        excludedReason: 'unranked',
      })
    } else if (item.status !== 'Active' || isStaleEnded) {
      // not-active: treat as 'over_budget' sentinel (closest available type)
      // We use 'over_budget' as a stand-in for 'not-active' since the type only has 3 values
      nonCandidateExclusions.push({
        item,
        score: 0,
        estimatedCost: estimatedCost(item, mode),
        breakdown: computeBreakdown(item, 1),
        included: false,
        excludedReason: 'over_budget',
      })
    } else {
      candidates.push(item)
    }
  }

  // Step 2: Score all candidates
  const totalItems = candidates.length

  const scored: ScoredItem[] = candidates.map((item) => {
    const breakdown = computeBreakdown(item, totalItems)
    return {
      item,
      score: breakdown.total,
      estimatedCost: estimatedCost(item, mode),
      breakdown,
      included: false,
    }
  })

  // Pre-pass: exclude items with non-positive scores
  const excluded: ScoredItem[] = []
  const positiveScored: ScoredItem[] = []
  for (const s of scored) {
    if (s.score <= 0) {
      excluded.push({ ...s, included: false, excludedReason: 'negative_score' })
    } else {
      positiveScored.push(s)
    }
  }

  // Step 3: Sort by score desc, then cost asc (tie-break), then id asc (stable)
  positiveScored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.estimatedCost !== b.estimatedCost) return a.estimatedCost - b.estimatedCost
    return a.item.id.localeCompare(b.item.id)
  })

  // Step 4: Greedy allocation
  const picks: ScoredItem[] = []
  let remainingBudget = budgetCents

  for (const scoredItem of positiveScored) {
    if (scoredItem.estimatedCost <= remainingBudget) {
      picks.push({ ...scoredItem, included: true })
      remainingBudget -= scoredItem.estimatedCost
    } else {
      const reason: ExcludedReason =
        scoredItem.estimatedCost > budgetCents ? 'over_budget' : 'over_budget'
      // Note: types only support 'over_budget' | 'negative_score' | 'unranked'
      // We use 'over_budget' for both "over total budget" and "insufficient remaining"
      // The display layer differentiates them using the actual costs.
      excluded.push({ ...scoredItem, included: false, excludedReason: reason })
    }
  }

  const totalEstimated = budgetCents - remainingBudget
  const budgetUtilization = budgetCents > 0 ? totalEstimated / budgetCents : 0

  return {
    picks,
    excluded: [...excluded, ...nonCandidateExclusions],
    totalEstimated,
    budgetRemaining: remainingBudget,
    budgetUtilization,
  }
}
