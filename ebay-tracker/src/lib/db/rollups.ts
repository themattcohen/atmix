import type { PriceRollup, RollupPeriod, HistoricalSummary } from '@/types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

// ── Row mapper ──────────────────────────────────────────────────────────────

function rowToRollup(row: any): PriceRollup {
  return {
    id: row.id,
    itemId: row.item_id,
    period: row.period_type as RollupPeriod,
    periodStart: row.period_start,
    openCents: row.open_cents,
    highCents: row.high_cents,
    lowCents: row.low_cents,
    closeCents: row.close_cents,
    avgCents: row.avg_cents,
    volume: row.volume,
    watcherHigh: row.watcher_high,
    watcherLow: row.watcher_low,
    watcherClose: row.watcher_close,
  }
}

// ── Daily rollup computation ─────────────────────────────────────────────────

/**
 * Compute and upsert daily OHLC rollup for a specific item and date.
 * date format: 'YYYY-MM-DD'
 * Returns true if a rollup was written, false if no snapshots existed for that date.
 *
 * SQLite cannot reliably mix window functions with GROUP BY aggregates.
 * Boundary values (open/close, watcher_low/close) are resolved via subqueries.
 */
export function computeDailyRollup(itemId: string, date: string): boolean {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT
        MIN(price_cents)                             AS low_cents,
        MAX(price_cents)                             AS high_cents,
        CAST(ROUND(AVG(price_cents)) AS INTEGER)     AS avg_cents,
        COUNT(*)                                     AS volume,
        MAX(watcher_count)                           AS watcher_high,
        MIN(watcher_count)                           AS watcher_low,
        (SELECT price_cents FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at ASC  LIMIT 1)          AS open_cents,
        (SELECT price_cents FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at DESC LIMIT 1)          AS close_cents,
        (SELECT watcher_count FROM price_snapshots
         WHERE item_id = ? AND date(recorded_at) = ?
         ORDER BY recorded_at DESC LIMIT 1)          AS watcher_close
      FROM price_snapshots
      WHERE item_id = ? AND date(recorded_at) = ? AND price_cents > 0
    `).get(
      itemId, date,  // open subquery
      itemId, date,  // close subquery
      itemId, date,  // watcher_close subquery
      itemId, date   // main aggregate
    ) as any

    if (!row || row.volume === 0) return false

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_low, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'day', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      itemId, date,
      row.open_cents, row.high_cents, row.low_cents, row.close_cents, row.avg_cents,
      row.volume, row.watcher_low, row.watcher_close, row.watcher_high
    )
    return true
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute daily rollup for ${itemId} on ${date}: ${err.message}`)
  }
}

/**
 * Compute daily rollups for ALL items for a given date.
 * Used by the nightly cron job and the backfill script.
 */
export function computeDailyRollupsForDate(date: string): { processed: number; written: number } {
  const db = getDb()
  try {
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_snapshots
      WHERE date(recorded_at) = ? AND price_cents > 0
    `).all(date) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      if (computeDailyRollup(item_id, date)) written++
    }
    return { processed: items.length, written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute daily rollups for ${date}: ${err.message}`)
  }
}

// ── Weekly rollup computation ────────────────────────────────────────────────

/**
 * Compute weekly rollup aggregated from existing daily rollups.
 * weekStart: 'YYYY-MM-DD' — the Monday of the target week.
 * weekEnd:   'YYYY-MM-DD' — the Sunday of the target week.
 *
 * Satisfies RollupsRepo.computeWeeklyRollup(itemId, weekStart): boolean
 * The weekEnd is derived from weekStart (Monday + 6 days = Sunday).
 */
export function computeWeeklyRollup(itemId: string, weekStart: string): boolean {
  const db = getDb()
  try {
    // Compute weekEnd from weekStart (Monday + 6 days)
    const weekEndRow = db.prepare(`SELECT date(?, '+6 days') AS week_end`).get(weekStart) as any
    const weekEnd: string = weekEndRow.week_end

    const agg = db.prepare(`
      SELECT
        SUM(volume)                                                          AS total_volume,
        MAX(high_cents)                                                      AS high_cents,
        MIN(low_cents)                                                       AS low_cents,
        MAX(watcher_high)                                                    AS watcher_high,
        MIN(watcher_low)                                                     AS watcher_low,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
        (SELECT open_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1)                                AS open_cents,
        (SELECT close_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1)                                AS close_cents,
        (SELECT watcher_close FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1)                                AS watcher_close
      FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
        AND period_start >= ? AND period_start <= ?
    `).get(
      itemId, weekStart, weekEnd,   // open subquery
      itemId, weekStart, weekEnd,   // close subquery
      itemId, weekStart, weekEnd,   // watcher_close subquery
      itemId, weekStart, weekEnd    // main aggregate
    ) as any

    if (!agg || !agg.total_volume) return false

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_low, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      itemId, weekStart,
      agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
      agg.total_volume, agg.watcher_low, agg.watcher_close, agg.watcher_high
    )
    return true
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute weekly rollup for ${itemId} week of ${weekStart}: ${err.message}`)
  }
}

/**
 * Compute weekly rollups for ALL items for a given week.
 * weekStart: Monday, weekEnd: Sunday.
 */
export function computeWeeklyRollupsForWeek(weekStart: string, weekEnd: string): { written: number } {
  const db = getDb()
  try {
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_rollups
      WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
    `).all(weekStart, weekEnd) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      if (computeWeeklyRollup(item_id, weekStart)) written++
    }
    return { written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute weekly rollups for week of ${weekStart}: ${err.message}`)
  }
}

// ── Monthly rollup computation ───────────────────────────────────────────────

/**
 * Compute monthly rollup aggregated from existing daily rollups.
 * monthStart: 'YYYY-MM-01'
 * monthEnd is derived from monthStart automatically.
 *
 * Satisfies RollupsRepo.computeMonthlyRollup(itemId, monthStart): boolean
 */
export function computeMonthlyRollup(itemId: string, monthStart: string): boolean {
  const db = getDb()
  try {
    // Compute month end via SQLite date arithmetic: start of next month minus 1 day
    const monthEndRow = db.prepare(
      `SELECT date(?, '+1 month', '-1 day') AS month_end`
    ).get(monthStart) as any
    const monthEnd: string = monthEndRow.month_end

    const agg = db.prepare(`
      SELECT
        SUM(volume)                                                          AS total_volume,
        MAX(high_cents)                                                      AS high_cents,
        MIN(low_cents)                                                       AS low_cents,
        MAX(watcher_high)                                                    AS watcher_high,
        MIN(watcher_low)                                                     AS watcher_low,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_cents,
        (SELECT open_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start ASC  LIMIT 1)                                AS open_cents,
        (SELECT close_cents FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1)                                AS close_cents,
        (SELECT watcher_close FROM price_rollups
         WHERE item_id = ? AND period_type = 'day'
           AND period_start >= ? AND period_start <= ?
         ORDER BY period_start DESC LIMIT 1)                                AS watcher_close
      FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
        AND period_start >= ? AND period_start <= ?
    `).get(
      itemId, monthStart, monthEnd,
      itemId, monthStart, monthEnd,
      itemId, monthStart, monthEnd,
      itemId, monthStart, monthEnd
    ) as any

    if (!agg || !agg.total_volume) return false

    db.prepare(`
      INSERT OR REPLACE INTO price_rollups (
        item_id, period_type, period_start,
        open_cents, high_cents, low_cents, close_cents, avg_cents,
        volume, watcher_low, watcher_close, watcher_high, computed_at
      ) VALUES (?, 'month', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      itemId, monthStart,
      agg.open_cents, agg.high_cents, agg.low_cents, agg.close_cents, agg.avg_cents,
      agg.total_volume, agg.watcher_low, agg.watcher_close, agg.watcher_high
    )
    return true
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute monthly rollup for ${itemId} month of ${monthStart}: ${err.message}`)
  }
}

/**
 * Compute monthly rollups for ALL items for a given month.
 */
export function computeMonthlyRollupsForMonth(monthStart: string, monthEnd: string): { written: number } {
  const db = getDb()
  try {
    const items = db.prepare(`
      SELECT DISTINCT item_id FROM price_rollups
      WHERE period_type = 'day' AND period_start >= ? AND period_start <= ?
    `).all(monthStart, monthEnd) as Array<{ item_id: string }>

    let written = 0
    for (const { item_id } of items) {
      if (computeMonthlyRollup(item_id, monthStart)) written++
    }
    return { written }
  } catch (err: any) {
    throw new DatabaseError(`Failed to compute monthly rollups for ${monthStart}: ${err.message}`)
  }
}

// ── Query functions ──────────────────────────────────────────────────────────

/**
 * Fetch rollup rows for a specific item, period type, and optional date range.
 * Results are ordered chronologically by period_start.
 */
export function getRollups(
  itemId: string,
  period: RollupPeriod,
  from?: string,
  to?: string
): PriceRollup[] {
  const db = getDb()
  try {
    const conditions: string[] = ['item_id = ?', 'period_type = ?']
    const params: any[] = [itemId, period]

    if (from) {
      conditions.push('period_start >= ?')
      params.push(from)
    }
    if (to) {
      conditions.push('period_start <= ?')
      params.push(to)
    }

    const rows = db.prepare(`
      SELECT * FROM price_rollups
      WHERE ${conditions.join(' AND ')}
      ORDER BY period_start ASC
    `).all(...params)

    return (rows as any[]).map(rowToRollup)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get rollups for ${itemId}: ${err.message}`)
  }
}

/**
 * Compute a summary of all-time historical stats for an item.
 * Returns null if no rollup data exists yet.
 *
 * Uses daily rollups for granularity — the most accurate representation
 * since daily rows are the base from which weekly/monthly are derived.
 */
export function getHistoricalSummary(itemId: string): HistoricalSummary | null {
  const db = getDb()
  try {
    const stats = db.prepare(`
      SELECT
        MAX(high_cents)  AS all_time_high,
        MIN(low_cents)   AS all_time_low,
        CAST(ROUND(SUM(CAST(avg_cents AS REAL) * volume) / SUM(volume)) AS INTEGER) AS avg_price,
        SUM(volume)      AS total_snapshots,
        MIN(period_start) AS oldest_date,
        MAX(period_start) AS newest_date
      FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
    `).get(itemId) as any

    if (!stats || stats.total_snapshots === null || stats.total_snapshots === 0) return null

    // Determine trend: compare first period's open to last period's close
    const earliest = db.prepare(`
      SELECT open_cents FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
      ORDER BY period_start ASC LIMIT 1
    `).get(itemId) as any

    const latest = db.prepare(`
      SELECT close_cents FROM price_rollups
      WHERE item_id = ? AND period_type = 'day'
      ORDER BY period_start DESC LIMIT 1
    `).get(itemId) as any

    const priceDiff = (latest?.close_cents ?? 0) - (earliest?.open_cents ?? 0)
    const threshold = (earliest?.open_cents ?? 0) * 0.02
    const trend: 'up' | 'down' | 'flat' =
      priceDiff > threshold ? 'up' : priceDiff < -threshold ? 'down' : 'flat'

    return {
      allTimeHigh: stats.all_time_high,
      allTimeLow: stats.all_time_low,
      avgPrice: stats.avg_price,
      totalSnapshots: stats.total_snapshots,
      oldestDate: stats.oldest_date,
      newestDate: stats.newest_date,
      trend,
    }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get historical summary for ${itemId}: ${err.message}`)
  }
}

/**
 * Count raw snapshots older than a given number of days.
 * Used for data retention reporting.
 */
export function countSnapshotsOlderThan(days: number): number {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM price_snapshots
      WHERE recorded_at < datetime('now', ?)
    `).get(`-${days} days`) as any
    return row.cnt
  } catch (err: any) {
    throw new DatabaseError(`Failed to count old snapshots: ${err.message}`)
  }
}

// ── Repo object (satisfies RollupsRepo contract) ─────────────────────────────

export const rollupsRepo = {
  computeDailyRollup,
  computeWeeklyRollup,
  computeMonthlyRollup,
  getRollups,
  getHistoricalSummary,
  // Extended helpers (not in RollupsRepo interface but used internally)
  computeDailyRollupsForDate,
  computeWeeklyRollupsForWeek,
  computeMonthlyRollupsForMonth,
  countSnapshotsOlderThan,
}
