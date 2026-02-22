import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { search, count } from '@/lib/db/roster'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const q = params.get('q') ?? ''

    if (!q || q.length < 2) {
      return routeOk({ players: [], count: count() })
    }

    const players = search(q)

    return routeOk({ players })
  } catch (err) {
    return routeError(err)
  }
}
