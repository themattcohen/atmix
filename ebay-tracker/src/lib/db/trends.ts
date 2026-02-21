import type { PriceSnapshot, TrendStats, PortfolioDataPoint, TrendsRepo } from '../../types'
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
  getStats,
  getPortfolio,
}
