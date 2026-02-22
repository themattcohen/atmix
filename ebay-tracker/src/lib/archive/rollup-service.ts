import {
  computeDailyRollupsForDate,
  computeWeeklyRollupsForWeek,
  computeMonthlyRollupsForMonth,
} from '../db/rollups'

// ── Date utilities ───────────────────────────────────────────────────────────

/**
 * Returns 'YYYY-MM-DD' for the given Date object using UTC.
 */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the Monday (UTC) of the ISO week containing the given date.
 */
function getWeekStart(d: Date): Date {
  const day = d.getUTCDay()          // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day  // shift back to Monday
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/**
 * Returns the last day of the month as 'YYYY-MM-DD'.
 * month is 1-based.
 */
function getMonthEnd(year: number, month: number): string {
  // day=0 of the following month is the last day of the current month
  const lastDay = new Date(Date.UTC(year, month, 0))
  return toISODate(lastDay)
}

// ── Nightly rollup runner ────────────────────────────────────────────────────

/**
 * Run rollup computation for yesterday.
 * Called by the cron scheduler at 00:05 UTC every day.
 *
 * - Always writes daily rollup for yesterday.
 * - Writes weekly rollup if yesterday was a Sunday (end of ISO week).
 * - Writes monthly rollup if yesterday was the last day of its month.
 */
export async function runNightlyRollup(): Promise<void> {
  const now = new Date()

  // Compute yesterday in UTC
  const yesterday = new Date(now)
  yesterday.setUTCDate(now.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)
  const yesterdayStr = toISODate(yesterday)

  console.log(`[rollup] Starting nightly rollup for ${yesterdayStr}`)

  // Daily rollup — always runs
  const dailyResult = computeDailyRollupsForDate(yesterdayStr)
  console.log(
    `[rollup] Daily: ${dailyResult.written} rollups written for ${dailyResult.processed} items`
  )

  // Weekly rollup — only when yesterday was a Sunday (day=0), end of ISO week
  const dayOfWeek = yesterday.getUTCDay()
  if (dayOfWeek === 0) {
    const weekStart = getWeekStart(yesterday)
    const weekStartStr = toISODate(weekStart)
    const weekEndStr = yesterdayStr   // yesterday is Sunday = week end
    const weeklyResult = computeWeeklyRollupsForWeek(weekStartStr, weekEndStr)
    console.log(
      `[rollup] Weekly: ${weeklyResult.written} rollups written for week ${weekStartStr}–${weekEndStr}`
    )
  }

  // Monthly rollup — only when yesterday was the last day of its month
  const year = yesterday.getUTCFullYear()
  const month = yesterday.getUTCMonth() + 1  // 1-based
  const lastOfMonth = getMonthEnd(year, month)
  if (yesterdayStr === lastOfMonth) {
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`
    const monthlyResult = computeMonthlyRollupsForMonth(monthStartStr, lastOfMonth)
    console.log(
      `[rollup] Monthly: ${monthlyResult.written} rollups written for ${monthStartStr}`
    )
  }

  console.log('[rollup] Nightly rollup complete')
}

// ── Backfill ─────────────────────────────────────────────────────────────────

/**
 * Backfill all rollups from the beginning of price_snapshots history to today.
 *
 * This is the one-time operation run after 003_price_rollups.sql migration,
 * or to repair rollups after a schema change.
 *
 * At 200 items × 365 days, the daily pass takes roughly 4–8 minutes.
 * Safe to run while the server is live — it only reads price_snapshots
 * and writes price_rollups; no conflict with the sync process.
 */
export async function backfillAllRollups(): Promise<void> {
  const { getDb } = await import('../db/client')
  const db = getDb()

  const range = db.prepare(`
    SELECT
      date(MIN(recorded_at)) AS first_date,
      date(MAX(recorded_at)) AS last_date
    FROM price_snapshots
  `).get() as any

  if (!range?.first_date) {
    console.log('[backfill] No snapshots found — nothing to backfill')
    return
  }

  console.log(`[backfill] Starting backfill: ${range.first_date} → ${range.last_date}`)

  const start = new Date(range.first_date + 'T00:00:00Z')
  const end = new Date(range.last_date + 'T00:00:00Z')

  // ── Pass 1: daily rollups for every date in range ─────────────────────────
  let current = new Date(start)
  let totalDays = 0
  let totalDailyWritten = 0

  while (current <= end) {
    const dateStr = toISODate(current)
    const result = computeDailyRollupsForDate(dateStr)
    totalDailyWritten += result.written
    totalDays++

    if (totalDays % 30 === 0) {
      console.log(
        `[backfill] Daily pass: ${totalDays} days processed, ${totalDailyWritten} rollups written`
      )
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }
  console.log(
    `[backfill] Daily pass complete: ${totalDays} days, ${totalDailyWritten} rollups`
  )

  // ── Pass 2: weekly rollups for every complete week in range ───────────────
  current = new Date(start)
  let totalWeeklyWritten = 0

  while (current <= end) {
    const weekStart = getWeekStart(current)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)  // Sunday

    // Only rollup complete weeks whose Sunday is within the data range
    if (weekEnd <= end) {
      const result = computeWeeklyRollupsForWeek(toISODate(weekStart), toISODate(weekEnd))
      totalWeeklyWritten += result.written
    }

    // Advance to the Monday after this week's Sunday
    current = new Date(weekEnd)
    current.setUTCDate(weekEnd.getUTCDate() + 1)
  }
  console.log(`[backfill] Weekly pass complete: ${totalWeeklyWritten} rollups`)

  // ── Pass 3: monthly rollups for every complete month in range ─────────────
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1  // 1-based
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth() + 1
  let totalMonthlyWritten = 0

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = getMonthEnd(year, month)

    // Only rollup complete months (month end must not exceed our snapshot range)
    if (monthEnd <= toISODate(end)) {
      const result = computeMonthlyRollupsForMonth(monthStart, monthEnd)
      totalMonthlyWritten += result.written
    }

    month++
    if (month > 12) { month = 1; year++ }
  }
  console.log(`[backfill] Monthly pass complete: ${totalMonthlyWritten} rollups`)
  console.log('[backfill] Backfill complete')
}
