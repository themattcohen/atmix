import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getHistoricalSummary } from '@/lib/db/rollups'

// ── GET /api/history/[itemId]/summary ───────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params

    const summary = getHistoricalSummary(itemId)
    if (!summary) {
      throw new AppError('NOT_FOUND', `No historical rollup data for item ${itemId}`, 404)
    }

    return routeOk(summary)
  } catch (err) {
    return routeError(err)
  }
}
