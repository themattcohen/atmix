import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getRollups } from '@/lib/db/rollups'
import type { RollupPeriod, OHLCDataPoint } from '@/types'

// ── Label formatter ──────────────────────────────────────────────────────────

function formatDateLabel(periodStart: string, period: RollupPeriod): string {
  const d = new Date(periodStart + 'T00:00:00Z')
  if (period === 'day') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  if (period === 'week') {
    const end = new Date(d)
    end.setUTCDate(d.getUTCDate() + 6)
    const startLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    const endLabel = end.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
    return `${startLabel}–${endLabel}`
  }
  // month
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── GET /api/history/[itemId] ────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params
    const searchParams = request.nextUrl.searchParams

    const periodParam = searchParams.get('period') ?? 'day'
    if (!['day', 'week', 'month'].includes(periodParam)) {
      throw new AppError('INVALID_PARAM', 'period must be day, week, or month', 400)
    }
    const period = periodParam as RollupPeriod

    const from = searchParams.get('from') ?? undefined
    const to   = searchParams.get('to')   ?? undefined

    // Validate date format if provided
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (from && !dateRe.test(from)) {
      throw new AppError('INVALID_PARAM', 'from must be YYYY-MM-DD', 400)
    }
    if (to && !dateRe.test(to)) {
      throw new AppError('INVALID_PARAM', 'to must be YYYY-MM-DD', 400)
    }

    const rollups = getRollups(itemId, period, from, to)

    const points: OHLCDataPoint[] = rollups.map(r => ({
      date: formatDateLabel(r.periodStart, period),
      open: r.openCents / 100,
      high: r.highCents / 100,
      low:  r.lowCents  / 100,
      close: r.closeCents / 100,
      volume: r.volume,
      watcherHigh:  r.watcherHigh,
      watcherLow:   r.watcherLow,
      watcherClose: r.watcherClose,
    }))

    // Returns empty array (not 404) when no rollups exist yet — client shows empty state
    return routeOk(points)
  } catch (err) {
    return routeError(err)
  }
}
