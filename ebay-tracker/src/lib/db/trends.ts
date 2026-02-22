import type { PriceSnapshot, TrendStats, PortfolioDataPoint, TrendsRepo, PriceDelta, SparklineSummary, SparklinePoint, HeatIndex, HeatTier } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function insertSnapshot(input: { itemId: string; priceCents: number; shippingCents: number; watcherCount: number | null; bidCount: number }): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT INTO price_snapshots (item_id, price_cents, shipping, watcher_count, bid_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.itemId, input.priceCents, input.shippingCents, input.watcherCount, input.bidCount)
  } catch (err: any) {
    throw new DatabaseError(`Failed to insert snapshot: ${err.message}`)
  }
}

export function getSnapshots(itemId: string, days: number): PriceSnapshot[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT * FROM price_snapshots
      WHERE item_id = ? AND recorded_at >= datetime('now', ?)
      ORDER BY recorded_at ASC
    `).all(itemId, `-${days} days`)

    return (rows as any[]).map(row => ({
      id: row.id,
      itemId: row.item_id,
      priceCents: row.price_cents,
      shippingCents: row.shipping,
      watcherCount: row.watcher_count,
      bidCount: row.bid_count,
      recordedAt: row.recorded_at,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get snapshots: ${err.message}`)
  }
}

export function getPriceDeltas(): PriceDelta[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      WITH latest AS (
        SELECT
          item_id,
          price_cents,
          ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY recorded_at DESC) AS rn
        FROM price_snapshots
      )
      SELECT
        l1.item_id,
        l1.price_cents  AS current_price,
        l2.price_cents  AS previous_price,
        ROUND(
          (l1.price_cents - l2.price_cents) * 100.0 / l2.price_cents,
          1
        ) AS delta_pct
      FROM latest l1
      LEFT JOIN latest l2
        ON l1.item_id = l2.item_id AND l2.rn = 2
      WHERE l1.rn = 1
    `).all() as any[]

    return rows.map(row => ({
      itemId: row.item_id,
      currentPrice: row.current_price,
      previousPrice: row.previous_price ?? null,
      deltaPct: row.delta_pct ?? null,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get price deltas: ${err.message}`)
  }
}

export function getSnapshotSummaries(
  itemIds: string[],
  days: number
): Map<string, SparklineSummary> {
  if (itemIds.length === 0) return new Map()

  const db = getDb()
  try {
    const placeholders = itemIds.map(() => '?').join(', ')

    const rows = db.prepare(`
      SELECT
        item_id,
        price_cents,
        recorded_at
      FROM price_snapshots
      WHERE item_id IN (${placeholders})
        AND recorded_at >= datetime('now', ?)
      ORDER BY item_id, recorded_at ASC
    `).all(...itemIds, `-${days} days`) as any[]

    // Group by itemId and build SparklineSummary for each
    const grouped = new Map<string, { date: string; priceCents: number }[]>()
    for (const row of rows) {
      const existing = grouped.get(row.item_id) ?? []
      existing.push({ date: row.recorded_at, priceCents: row.price_cents })
      grouped.set(row.item_id, existing)
    }

    const result = new Map<string, SparklineSummary>()
    for (const [itemId, points] of grouped.entries()) {
      if (points.length === 0) continue
      const prices = points.map(p => p.priceCents)
      const minCents = Math.min(...prices)
      const maxCents = Math.max(...prices)
      const startCents = prices[0]
      const endCents = prices[prices.length - 1]
      const changePercent = startCents > 0
        ? Math.round(((endCents - startCents) / startCents) * 1000) / 10
        : 0

      result.set(itemId, {
        itemId,
        points: points as SparklinePoint[],
        minCents,
        maxCents,
        startCents,
        endCents,
        changePercent,
      })
    }

    return result
  } catch (err: any) {
    throw new DatabaseError(`Failed to get snapshot summaries: ${err.message}`)
  }
}

// Heat index computation constants
const VELOCITY_WEIGHT      = 0.40
const COUNT_WEIGHT         = 0.30
const BID_WEIGHT           = 0.15
const URGENCY_WEIGHT       = 0.15
const COUNT_CAP            = 200
const BID_CAP              = 20
const VELOCITY_CAP_PER_DAY = 10
const TIER_HOT             = 65
const TIER_WARM            = 35
const TIER_COLD            = 0

function assignTier(score: number): HeatTier {
  if (score >= TIER_HOT)  return 'hot'
  if (score >= TIER_WARM) return 'warm'
  if (score > TIER_COLD)  return 'neutral'
  return 'cold'
}

export function getHeatIndexBatch(itemIds: string[]): Map<string, HeatIndex> {
  if (itemIds.length === 0) return new Map()

  const db = getDb()
  try {
    const placeholders = itemIds.map(() => '?').join(', ')

    const rows = db.prepare(`
      WITH snapshot_window AS (
        SELECT
          ps.item_id,
          COUNT(*)                                                AS snapshot_count,
          MIN(ps.recorded_at)                                     AS earliest_at,
          MAX(ps.recorded_at)                                     AS latest_at,
          MIN(CASE
            WHEN ps.recorded_at = (
              SELECT MIN(ps2.recorded_at)
              FROM price_snapshots ps2
              WHERE ps2.item_id = ps.item_id
                AND ps2.recorded_at >= datetime('now', '-14 days')
                AND ps2.watcher_count IS NOT NULL
            ) THEN ps.watcher_count ELSE NULL
          END)                                                    AS earliest_watchers,
          MAX(CASE
            WHEN ps.recorded_at = (
              SELECT MAX(ps2.recorded_at)
              FROM price_snapshots ps2
              WHERE ps2.item_id = ps.item_id
                AND ps2.recorded_at >= datetime('now', '-14 days')
                AND ps2.watcher_count IS NOT NULL
            ) THEN ps.watcher_count ELSE NULL
          END)                                                    AS latest_watchers
        FROM price_snapshots ps
        WHERE ps.item_id IN (${placeholders})
          AND ps.recorded_at >= datetime('now', '-14 days')
          AND ps.watcher_count IS NOT NULL
        GROUP BY ps.item_id
      )
      SELECT
        i.item_id,
        i.watcher_count,
        i.bid_count,
        i.listing_type,
        i.end_time,
        COALESCE(sw.snapshot_count, 0)                           AS snapshot_count,
        COALESCE(sw.earliest_watchers, i.watcher_count)          AS earliest_watchers,
        COALESCE(sw.latest_watchers,   i.watcher_count)          AS latest_watchers,
        COALESCE(
          (julianday(sw.latest_at) - julianday(sw.earliest_at)),
          0
        )                                                        AS days_span
      FROM items i
      LEFT JOIN snapshot_window sw ON sw.item_id = i.item_id
      WHERE i.item_id IN (${placeholders})
    `).all(...itemIds, ...itemIds) as any[]

    const result = new Map<string, HeatIndex>()
    const now = Date.now()

    for (const row of rows) {
      const watcherCount  = row.watcher_count ?? 0
      const bidCount      = row.bid_count ?? 0
      const earliestW     = row.earliest_watchers ?? watcherCount
      const latestW       = row.latest_watchers   ?? watcherCount
      const daysSpan      = row.days_span         ?? 0

      // Signal 1: watcher count (absolute)
      const watcherNorm = Math.min(watcherCount, COUNT_CAP) / COUNT_CAP

      // Signal 2: watcher velocity
      const velocityPerDay = daysSpan > 0 ? (latestW - earliestW) / daysSpan : 0
      const velocityNorm   = Math.max(0, Math.min(velocityPerDay / VELOCITY_CAP_PER_DAY, 1))

      // Signal 3: bid count
      const bidNorm = Math.min(bidCount, BID_CAP) / BID_CAP

      // Signal 4: time-remaining urgency
      let urgencyNorm = 0
      if (row.end_time) {
        const hoursRemaining = Math.max(0, (new Date(row.end_time).getTime() - now) / 3_600_000)
        if (hoursRemaining > 0 && hoursRemaining <= 4)       urgencyNorm = 1.0
        else if (hoursRemaining <= 24)  urgencyNorm = 0.75
        else if (hoursRemaining <= 72)  urgencyNorm = 0.35
      }

      // Listing type multiplier
      let typeMultiplier = 1.0
      if (row.listing_type === 'FixedPrice')     typeMultiplier = 1.15
      else if (row.listing_type === 'Auction')   typeMultiplier = 0.90

      const rawScore = (
        COUNT_WEIGHT    * watcherNorm  +
        VELOCITY_WEIGHT * velocityNorm +
        BID_WEIGHT      * bidNorm      +
        URGENCY_WEIGHT  * urgencyNorm
      ) * typeMultiplier

      const score = Math.max(0, Math.min(100, Math.round(rawScore * 100)))
      const tier  = assignTier(score)

      // Watcher delta and trend
      const watcherDelta = latestW - earliestW
      const watcherTrend: 'up' | 'down' | 'flat' =
        watcherDelta > 0 ? 'up' : watcherDelta < 0 ? 'down' : 'flat'

      result.set(row.item_id, {
        itemId:       row.item_id,
        tier,
        score,
        watcherDelta,
        watcherTrend,
      })
    }

    return result
  } catch (err: any) {
    throw new DatabaseError(`Failed to get heat index batch: ${err.message}`)
  }
}

export function getStats(): TrendStats {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_items,
        SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) AS sold_items,
        SUM(CASE WHEN status = 'Active' THEN current_price ELSE 0 END) AS total_value_cents,
        AVG(CASE WHEN status = 'Active' THEN watcher_count ELSE NULL END) AS avg_watchers,
        SUM(CASE WHEN status = 'Active' AND end_time IS NOT NULL
          AND end_time <= datetime('now', '+1 day') AND end_time > datetime('now')
          THEN 1 ELSE 0 END) AS ending_soon
      FROM items
    `).get() as any

    return {
      totalItems: row.total_items || 0,
      activeItems: row.active_items || 0,
      soldItems: row.sold_items || 0,
      totalValueCents: row.total_value_cents || 0,
      avgWatchers: Math.round(row.avg_watchers || 0),
      endingSoon: row.ending_soon || 0,
    }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get stats: ${err.message}`)
  }
}

export function getPortfolio(days: number): PortfolioDataPoint[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT
        date(recorded_at) AS date,
        SUM(price_cents) AS total_value_cents,
        COUNT(DISTINCT item_id) AS item_count
      FROM price_snapshots
      WHERE recorded_at >= datetime('now', ?)
      GROUP BY date(recorded_at)
      ORDER BY date ASC
    `).all(`-${days} days`)

    return (rows as any[]).map(row => ({
      date: row.date,
      totalValueCents: row.total_value_cents,
      itemCount: row.item_count,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get portfolio: ${err.message}`)
  }
}

export const trendsRepo: TrendsRepo = {
  insertSnapshot,
  getSnapshots,
  getPriceDeltas,
  getSnapshotSummaries,
  getHeatIndexBatch,
  getStats,
  getPortfolio,
}
