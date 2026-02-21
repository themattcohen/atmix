// === Domain Types ===

export type ListingType = 'Auction' | 'FixedPrice' | 'AuctionWithBIN'
export type ListingStatus = 'Active' | 'Sold' | 'Ended' | 'Relisted'
export type EventType = 'sold' | 'expired' | 'price_drop' | 'price_increase' | 'watcher_spike'

export interface WatchlistItem {
  id: string                    // eBay item ID (string, not numeric)
  title: string
  rank: number | null           // 1-based priority, NULL = unranked
  currentPrice: number          // USD cents (integer)
  buyItNowPrice: number | null
  shippingCost: number          // USD cents
  listingType: ListingType
  conditionName: string | null
  endTime: string | null        // ISO 8601 timestamp
  timeLeft: string | null       // ISO 8601 duration
  sellerId: string | null
  sellerFeedback: number | null
  watcherCount: number | null
  bidCount: number
  imageUrl: string | null
  listingUrl: string | null
  status: ListingStatus
  isInQueue: boolean
  notes: string | null
  firstSeenAt: string           // ISO 8601
  lastSyncedAt: string          // ISO 8601
}

export interface PriceSnapshot {
  id: number
  itemId: string
  priceCents: number
  shippingCents: number
  watcherCount: number | null
  bidCount: number
  recordedAt: string
}

export interface WatchlistEvent {
  id: number
  itemId: string
  itemTitle?: string            // joined from items table for display
  eventType: EventType
  oldValue: string | null
  newValue: string | null
  detectedAt: string
}

// === API Types ===

export interface ApiSuccess<T> { data: T }
export interface ApiError { error: { code: string; message: string } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface RankUpdateRequest {
  itemId: string
  newRank: number
}

export interface SyncResult {
  added: number
  updated: number
  sold: number
  expired: number
  durationMs: number
}

export interface TrendStats {
  totalItems: number
  activeItems: number
  soldItems: number
  totalValueCents: number
  avgWatchers: number
  endingSoon: number            // items ending within 24h
}

export interface PortfolioDataPoint {
  date: string
  totalValueCents: number
  itemCount: number
}

// === Repository Interfaces (contracts between data layer and API routes) ===

export interface ItemsRepo {
  getAll(filters?: { status?: ListingStatus; search?: string }): WatchlistItem[]
  getById(id: string): WatchlistItem | null
  upsert(item: UpsertItemInput): void
  updateRank(id: string, newRank: number): WatchlistItem[]  // returns all affected
  updateNotes(id: string, notes: string): void
  toggleQueue(id: string, inQueue: boolean): void
  markStatus(id: string, status: ListingStatus): void
  freeRank(id: string): void
}

export interface TrendsRepo {
  insertSnapshot(input: { itemId: string; priceCents: number; shippingCents: number; watcherCount: number | null; bidCount: number }): void
  getSnapshots(itemId: string, days: number): PriceSnapshot[]
  getStats(): TrendStats
  getPortfolio(days: number): PortfolioDataPoint[]
}

export interface EventsRepo {
  insert(input: { itemId: string; eventType: EventType; oldValue?: string; newValue?: string }): void
  getRecent(limit: number, type?: EventType): WatchlistEvent[]
  getForItem(itemId: string, limit: number): WatchlistEvent[]
}

export interface UpsertItemInput {
  id: string
  title: string
  currentPrice: number
  buyItNowPrice?: number | null
  shippingCost?: number
  listingType: ListingType
  conditionName?: string | null
  endTime?: string | null
  timeLeft?: string | null
  sellerId?: string | null
  sellerFeedback?: number | null
  watcherCount?: number | null
  bidCount?: number
  imageUrl?: string | null
  listingUrl?: string | null
  status: ListingStatus
}
