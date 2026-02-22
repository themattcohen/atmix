import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll } from '@/lib/db/items'
import { getStats, getPortfolio, getPriceDeltas, getHeatIndexBatch } from '@/lib/db/trends'
import type { WatchlistItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') ?? '7d'
    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7

    const stats = getStats()
    const portfolio = getPortfolio(days)

    // Derive movers and ending-soon from all active items
    const allItems = getAll({ status: 'Active' })

    // Build delta map — reuse getPriceDeltas() for accurate drop detection
    const deltaMap = new Map<string, number | null>(
      getPriceDeltas().map(d => [d.itemId, d.deltaPct])
    )

    const topPriceDrops = [...allItems]
      .filter(i => {
        const d = deltaMap.get(i.id)
        return d !== undefined && d !== null && d < 0
      })
      .sort((a, b) => (deltaMap.get(a.id)! - deltaMap.get(b.id)!))
      .slice(0, 5)
      .map(i => ({ ...i, deltaPct: deltaMap.get(i.id) ?? null }))

    // Fix S10: sort by actual watcher delta, not raw count
    const heatMap = getHeatIndexBatch(allItems.map(i => i.id))
    const topWatcherGains = [...allItems]
      .map((item) => ({ item, delta: heatMap.get(item.id)?.watcherDelta ?? 0 }))
      .sort((a, b) => b.delta - a.delta)
      .filter(({ delta }) => delta > 0)
      .slice(0, 5)
      .map(({ item }) => item)

    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const endingSoon = allItems
      .filter((i): i is WatchlistItem & { endTime: string } =>
        i.endTime !== null && new Date(i.endTime).getTime() - now < oneDayMs && new Date(i.endTime).getTime() > now
      )
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 10)

    return routeOk({ stats, portfolio, topPriceDrops, topWatcherGains, endingSoon })
  } catch (err) {
    return routeError(err)
  }
}
