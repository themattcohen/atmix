import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getRecent } from '@/lib/db/signals'
import type { NewsEventType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const rawLimit = parseInt(params.get('limit') || '100', 10)
    const rawOffset = parseInt(params.get('offset') || '0', 10)
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 100 : rawLimit, 200))
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset)
    const itemId = params.get('itemId') ?? undefined
    const eventType = (params.get('eventType') as NewsEventType) ?? undefined
    const minScoreParam = params.get('minScore')
    const minScore = minScoreParam != null ? parseInt(minScoreParam, 10) : undefined
    const acknowledgedParam = params.get('acknowledged')
    const acknowledged = acknowledgedParam != null ? acknowledgedParam === 'true' : undefined

    const { signals, total } = getRecent({ limit, offset, itemId, eventType, minScore, acknowledged })

    return routeOk({ signals, total })
  } catch (err) {
    return routeError(err)
  }
}
