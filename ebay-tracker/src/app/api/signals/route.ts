import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getRecent } from '@/lib/db/signals'
import type { NewsEventType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const limit = Math.min(parseInt(params.get('limit') || '50', 10), 200)
    const offset = parseInt(params.get('offset') || '0', 10)
    const itemId = params.get('itemId') ?? undefined
    const eventType = (params.get('eventType') as NewsEventType) ?? undefined
    const minScoreParam = params.get('minScore')
    const minScore = minScoreParam != null ? parseInt(minScoreParam, 10) : undefined
    const acknowledgedParam = params.get('acknowledged')
    const acknowledged = acknowledgedParam != null ? acknowledgedParam === 'true' : undefined

    const signals = getRecent({ limit, offset, itemId, eventType, minScore, acknowledged })

    return routeOk({ signals, total: signals.length })
  } catch (err) {
    return routeError(err)
  }
}
