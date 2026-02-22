import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll, getUnrankedPage } from '@/lib/db/items'
import { getPriceDeltas, getHeatIndexBatch } from '@/lib/db/trends'
import { getTargetCountsByItem } from '@/lib/db/targets'
import type { ListingStatus, WatchlistItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params  = request.nextUrl.searchParams
    const status  = params.get('status') ?? 'Active'
    const sort    = params.get('sort')   ?? 'rank'
    const dir     = params.get('dir')    ?? 'asc'
    const search  = params.get('search') ?? undefined
    const type    = params.get('type')  ?? undefined
    const offset  = parseInt(params.get('offset') ?? '0', 10)
    const limit   = Math.min(parseInt(params.get('limit') ?? '50', 10), 100) // hard cap at 100

    const filters = status === 'All'
      ? { search, type }
      : { status: status as ListingStatus, search, type }

    // Ranked: always return all (needed for dnd-kit DOM requirement)
    const allFiltered = getAll(filters)

    const ranked = allFiltered
      .filter((i): i is WatchlistItem & { rank: number } => i.rank !== null)

    // Ranked always sorted by rank ASC (DnD position must match rank numbers)
    ranked.sort((a, b) => a.rank - b.rank)

    // Unranked: paginated with user sort
    const { items: unranked, total: unrankedTotal } = getUnrankedPage({
      offset,
      limit,
      status: status === 'All' ? undefined : status as ListingStatus,
      search,
      type,
      sort,
      dir,
    })

    // Build delta lookup map (one DB call, covers all returned items)
    const allReturnedIds = [...ranked.map(i => i.id), ...unranked.map(i => i.id)]
    const deltaMap = new Map<string, number | null>(
      getPriceDeltas().map(d => [d.itemId, d.deltaPct])
    )

    // Annotate ranked with deltaPct
    const annotatedRanked: WatchlistItem[] = ranked.map(item => ({
      ...item,
      deltaPct: deltaMap.get(item.id) ?? null,
    }))

    // Annotate unranked with deltaPct
    const annotatedUnranked: WatchlistItem[] = unranked.map(item => ({
      ...item,
      deltaPct: deltaMap.get(item.id) ?? null,
    }))

    // Status counts from full unfiltered set
    const allForCounts = status === 'All' ? allFiltered : getAll()
    const counts = {
      active: allForCounts.filter((i) => i.status === 'Active').length,
      sold:   allForCounts.filter((i) => i.status === 'Sold').length,
      ended:  allForCounts.filter((i) => i.status === 'Ended').length,
      total:  allForCounts.length,
    }

    // Compute heat index for all returned items
    const heatMap = getHeatIndexBatch(allReturnedIds)
    const heatIndex = Object.fromEntries(heatMap)

    // Merge target counts onto items
    const targetCountsMap = getTargetCountsByItem(allReturnedIds)
    const withTargets = (items: WatchlistItem[]) =>
      items.map(item => ({
        ...item,
        targetCounts: targetCountsMap.get(item.id) ?? null,
      }))

    return routeOk({ ranked: withTargets(annotatedRanked), unranked: withTargets(annotatedUnranked), unrankedTotal, counts, heatIndex })
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
