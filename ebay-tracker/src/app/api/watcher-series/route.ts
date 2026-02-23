import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getWatcherSeries } from '@/lib/db/trends'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const idsParam = params.get('ids') ?? ''
    const days = Math.min(parseInt(params.get('days') ?? '14', 10), 90)

    const ids = idsParam.split(',').filter(Boolean)
    if (ids.length === 0) {
      return routeOk({})
    }

    const series = getWatcherSeries(ids, days)
    return Response.json(
      { data: Object.fromEntries(series) },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      }
    )
  } catch (err) {
    return routeError(err)
  }
}
