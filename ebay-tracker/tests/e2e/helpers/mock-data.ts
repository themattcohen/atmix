import type { WatchlistItem, WatchlistEvent, TrendStats, PortfolioDataPoint, PriceSnapshot } from '../../../src/types'

function makeItem(overrides: Partial<WatchlistItem> & { id: string; title: string }): WatchlistItem {
  return {
    rank: null,
    currentPrice: 5000,
    buyItNowPrice: null,
    shippingCost: 0,
    listingType: 'Auction',
    conditionName: 'Used',
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    timeLeft: 'P3D',
    sellerId: 'seller123',
    sellerFeedback: 100,
    watcherCount: 10,
    bidCount: 2,
    imageUrl: null,
    listingUrl: 'https://www.ebay.com/itm/test',
    status: 'Active',
    isInQueue: false,
    notes: null,
    firstSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSyncedAt: new Date().toISOString(),
    ...overrides,
  }
}

export const mockItems: WatchlistItem[] = [
  makeItem({ id: '111', title: 'Vintage Baseball Card 1952', rank: 1, currentPrice: 4500, watcherCount: 124, bidCount: 5 }),
  makeItem({ id: '222', title: '1986 Topps Football Set', rank: 2, currentPrice: 8250, watcherCount: 89, bidCount: 3, listingType: 'AuctionWithBIN', buyItNowPrice: 12000 }),
  makeItem({ id: '333', title: 'PSA 10 Rookie Card', rank: 3, currentPrice: 1200, watcherCount: 12, bidCount: 0, listingType: 'FixedPrice' }),
  makeItem({ id: '444', title: 'Rare Coin Collection', rank: 4, currentPrice: 15000, watcherCount: 45, bidCount: 8, status: 'Sold' }),
  makeItem({ id: '555', title: 'Antique Watch Omega', rank: null, currentPrice: 3200, watcherCount: 67, bidCount: 1, endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString() }),
]

export const mockRanked = mockItems.filter((i) => i.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
export const mockUnranked = mockItems.filter((i) => i.rank === null)

export const mockWatchlistResponse = {
  data: {
    ranked: mockRanked,
    unranked: mockUnranked,
    counts: { active: 4, sold: 1, ended: 0, total: 5 },
  },
}

export const mockEvents: WatchlistEvent[] = [
  { id: 1, itemId: '444', itemTitle: 'Rare Coin Collection', eventType: 'sold', oldValue: null, newValue: null, detectedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: 2, itemId: '111', itemTitle: 'Vintage Baseball Card 1952', eventType: 'price_drop', oldValue: '5000', newValue: '4500', detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 3, itemId: '555', itemTitle: 'Antique Watch Omega', eventType: 'watcher_spike', oldValue: '40', newValue: '67', detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
]

export const mockEventsResponse = { data: mockEvents }

export const mockTrendStats: TrendStats = {
  totalItems: 5,
  activeItems: 4,
  soldItems: 1,
  totalValueCents: 32150,
  avgWatchers: 67.4,
  endingSoon: 1,
}

export const mockPortfolio: PortfolioDataPoint[] = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
  totalValueCents: 30000 + Math.floor(Math.random() * 5000),
  itemCount: 5,
}))

export const mockTrendsResponse = {
  data: {
    stats: mockTrendStats,
    portfolio: mockPortfolio,
    topPriceDrops: [mockItems[0], mockItems[2]],
    topWatcherGains: [mockItems[4], mockItems[1]],
    endingSoon: [mockItems[4]],
  },
}

export const mockSnapshots: PriceSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  itemId: '111',
  priceCents: 5000 - i * 50,
  shippingCents: 0,
  watcherCount: 100 + i * 3,
  bidCount: i,
  recordedAt: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString(),
}))

export const mockItemDetailResponse = {
  data: {
    item: mockItems[0],
    snapshots: mockSnapshots,
    events: mockEvents.filter((e) => e.itemId === '111'),
  },
}
