import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getSnapshotSummaries } from '@/lib/db/trends'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams

    // `ids` is a comma-separated list of eBay item IDs
    const idsParam = params.get('ids') ?? ''
    const days = parseInt(params.get('days') ?? '7', 10)

    // Validate days — only allow 7, 14, 30
    const allowedDays = [7, 14, 30]
    const resolvedDays = allowedDays.includes(days) ? days : 7

    const itemIds = idsParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    // Hard cap at 500 items
    if (itemIds.length > 500) {
      return routeError(new Error('Too many item IDs requested'))
    }

    const summariesMap = getSnapshotSummaries(itemIds, resolvedDays)

    // Convert Map to array for JSON serialization
    const summaries = Array.from(summariesMap.values())

    return routeOk({ summaries, days: resolvedDays })
  } catch (err) {
    return routeError(err)
  }
}
