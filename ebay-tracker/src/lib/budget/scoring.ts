import type { ListingType, WatchlistItem } from '@/types'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ---------------------------------------------------------------------------
// 3.1 rankValue — Rank Priority (weight: 0.40)
// Exponential decay: rank 1 = 1.0, rank n ≈ 0.05, null = 0.0
// ---------------------------------------------------------------------------

export function rankValue(rank: number | null, totalItems: number): number {
  if (rank === null) return 0.0
  if (totalItems === 0) return 0.0
  if (totalItems === 1) return 1.0

  const lambda = 3.0
  const normalized = (rank - 1) / totalItems
  const score = Math.exp(-lambda * normalized)

  // Clamp out-of-bounds ranks (stale data guard) to 0.05 minimum
  return clamp(score, 0.05, 1.0)
}

// ---------------------------------------------------------------------------
// 3.2 urgencyScore — Time Urgency (weight: 0.20)
// Piecewise linear based on hours remaining until endTime
// ---------------------------------------------------------------------------

export function urgencyScore(endTime: string | null): number {
  if (endTime === null) return 0.10 // fixed price, no deadline

  let hoursLeft: number
  try {
    const ms = new Date(endTime).getTime() - Date.now()
    hoursLeft = ms / 3_600_000
  } catch {
    return 0.10 // malformed ISO string — treat as no deadline
  }

  if (hoursLeft <= 0) return 0.0    // already ended
  if (hoursLeft <= 2) return 1.0    // critical: ending within 2 hours
  if (hoursLeft <= 6) return 0.75   // urgent
  if (hoursLeft <= 24) return 0.50  // ending today
  if (hoursLeft <= 72) return 0.25  // ending this week
  if (hoursLeft <= 168) return 0.10 // ending within 7 days
  return 0.05                       // > 7 days out
}

// ---------------------------------------------------------------------------
// 3.3 confidenceScore — Buy Confidence (weight: 0.10)
// Reflects how predictable the final cost is
// ---------------------------------------------------------------------------

export function confidenceScore(listingType: ListingType, bidCount: number): number {
  const bids = bidCount ?? 0

  switch (listingType) {
    case 'FixedPrice':
      return 1.0
    case 'AuctionWithBIN':
      return 0.85
    case 'Auction':
      if (bids === 0) return 0.80
      if (bids <= 3) return 0.65
      if (bids <= 10) return 0.50
      return 0.35 // heavy bidding
    default:
      return 0.50 // unknown listing type
  }
}

// ---------------------------------------------------------------------------
// 3.4 competitionPenalty — Competition Pressure (weight: -0.10)
// Logarithmic scale: heavy watcher/bid activity signals price will rise
// ---------------------------------------------------------------------------

export function competitionPenalty(watcherCount: number | null, bidCount: number): number {
  const w = watcherCount ?? 0
  const b = bidCount ?? 0

  const signal =
    Math.log10(1 + w) * 0.6 +
    Math.log10(1 + b * 5) * 0.4

  // Divide by 3.0 so ~30 watchers + 0 bids ≈ 0.5 penalty
  return clamp(signal / 3.0, 0.0, 1.0)
}

// ---------------------------------------------------------------------------
// 3.5 priceOpportunity — Price Trend (weight: 0.20)
// Proxy for buying opportunity using BIN gap or auction dynamics
// ---------------------------------------------------------------------------

export function priceOpportunity(item: WatchlistItem): number {
  const binPrice = item.buyItNowPrice && item.buyItNowPrice > 0 ? item.buyItNowPrice : null

  if (item.listingType === 'AuctionWithBIN' && binPrice) {
    if (item.currentPrice > binPrice) return 0.0 // data anomaly
    const gap = (binPrice - item.currentPrice) / binPrice
    return clamp(gap, 0.0, 1.0)
  }

  if (item.listingType === 'FixedPrice') {
    return 0.50 // neutral — no price dynamics
  }

  // Plain Auction (no BIN): repurpose confidence inversely
  // Uncertain auctions with low bids may have upside
  const confScore = confidenceScore(item.listingType, item.bidCount ?? 0)
  const signal = 1.0 - confScore * 0.5
  return clamp(signal, 0.1, 0.9)
}
