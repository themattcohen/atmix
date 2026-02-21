import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getRecent, getForItem } from '@/lib/db/events'
import type { EventType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const type = params.get('type') ?? 'all'
    const limit = parseInt(params.get('limit') ?? '50', 10) || 50
    const itemId = params.get('itemId') ?? undefined

    if (itemId) {
      const events = getForItem(itemId, limit)
      return routeOk(events)
    }

    const events = getRecent(limit, type === 'all' ? undefined : type as EventType)
    return routeOk(events)
  } catch (err) {
    return routeError(err)
  }
}
