import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getByItemId, getByItemIds, getUnparsed, getStale } from '@/lib/db/metadata'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const itemId = params.get('itemId')
    const itemIdsParam = params.get('itemIds')
    const unparsed = params.get('unparsed')
    const stale = params.get('stale')
    const limit = params.get('limit') ? parseInt(params.get('limit')!, 10) : 100

    if (unparsed === '1') {
      const itemIds = getUnparsed(limit)
      return routeOk({ itemIds, count: itemIds.length })
    }

    if (stale === '1') {
      const itemIds = getStale(limit)
      return routeOk({ itemIds, count: itemIds.length })
    }

    if (itemIdsParam) {
      const ids = itemIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      const metadata = getByItemIds(ids)
      return routeOk(metadata)
    }

    if (itemId) {
      const metadata = getByItemId(itemId)
      return routeOk(metadata)
    }

    throw new AppError('INVALID_PARAMS', 'Provide itemId, itemIds, unparsed=1, or stale=1', 400)
  } catch (err) {
    return routeError(err)
  }
}
