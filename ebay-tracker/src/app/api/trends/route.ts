import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll } from '@/lib/db/items'
import { getStats, getPortfolio } from '@/lib/db/trends'
import type { WatchlistItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') ?? '7d'
    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7

    const stats = getStats()
    const portfolio = getPortfolio(days)

    // Derive movers and ending-soon from all active items
    const allItems = getAll({ status: 'Active' })

    const topPriceDrops = [...allItems]
      .sort((a, b) => a.currentPrice - b.currentPrice)
      .slice(0, 5)

    const topWatcherGains = [...allItems]
      .sort((a, b) => (b.watcherCount ?? 0) - (a.watcherCount ?? 0))
      .slice(0, 5)

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
