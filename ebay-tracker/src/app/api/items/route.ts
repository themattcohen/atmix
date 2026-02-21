import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll } from '@/lib/db/items'
import type { ListingStatus, WatchlistItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const status = params.get('status') ?? 'Active'
    const sort = params.get('sort') ?? 'rank'
    const dir = params.get('dir') ?? 'asc'
    const search = params.get('search') ?? undefined

    const filters = status === 'All'
      ? { search }
      : { status: status as ListingStatus, search }

    const items = getAll(filters)

    // Separate ranked (rank !== null) from unranked (rank === null)
    const ranked = items.filter((i): i is WatchlistItem & { rank: number } => i.rank !== null)
    const unranked = items.filter((i) => i.rank === null)

    // Sort ranked by rank ascending by default
    ranked.sort((a, b) => {
      if (sort === 'rank') return dir === 'asc' ? a.rank - b.rank : b.rank - a.rank
      return sortBy(a, b, sort, dir)
    })

    // Sort unranked by endTime (soonest first)
    unranked.sort((a, b) => {
      if (sort !== 'rank') return sortBy(a, b, sort, dir)
      if (!a.endTime && !b.endTime) return 0
      if (!a.endTime) return 1
      if (!b.endTime) return -1
      return a.endTime.localeCompare(b.endTime)
    })

    // Counts by status (over the unfiltered set if filtering by status,
    // we count from the returned items since getAll already filtered)
    const allItems = status === 'All' ? items : getAll()
    const counts = {
      active: allItems.filter((i) => i.status === 'Active').length,
      sold: allItems.filter((i) => i.status === 'Sold').length,
      ended: allItems.filter((i) => i.status === 'Ended').length,
      total: allItems.length,
    }

    return routeOk({ ranked, unranked, counts })
  } catch (err) {
    return routeError(err)
  }
}

function sortBy(a: WatchlistItem, b: WatchlistItem, sort: string, dir: string): number {
  let cmp = 0
  switch (sort) {
    case 'price':
      cmp = a.currentPrice - b.currentPrice
      break
    case 'watchers':
      cmp = (a.watcherCount ?? 0) - (b.watcherCount ?? 0)
      break
    case 'end_time':
      if (!a.endTime && !b.endTime) cmp = 0
      else if (!a.endTime) cmp = 1
      else if (!b.endTime) cmp = -1
      else cmp = a.endTime.localeCompare(b.endTime)
      break
    default:
      cmp = 0
  }
  return dir === 'asc' ? cmp : -cmp
}
