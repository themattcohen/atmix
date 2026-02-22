import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getDetailed } from '@/lib/db/news'
import type { SourceName, NewsProcessedStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const rawLimit = parseInt(params.get('limit') || '50', 10)
    const rawOffset = parseInt(params.get('offset') || '0', 10)
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200))
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset)
    const source = (params.get('source') as SourceName) ?? undefined
    const status = (params.get('status') as NewsProcessedStatus) ?? undefined
    const playerSearch = params.get('player') ?? undefined

    const result = getDetailed({ limit, offset, source, status, playerSearch })

    return routeOk(result)
  } catch (err) {
    return routeError(err)
  }
}
