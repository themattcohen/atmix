// === Domain Types ===

export type ListingType = 'Auction' | 'FixedPrice' | 'AuctionWithBIN'
export type ListingStatus = 'Active' | 'Sold' | 'Ended' | 'Relisted'
export type EventType = 'sold' | 'expired' | 'price_drop' | 'price_increase' | 'watcher_spike' | 'target_triggered'

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
  deltaPct?: number | null       // price change % since previous snapshot
  targetCounts?: { active: number; triggered: number } | null
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
  getPriceDeltas(): PriceDelta[]
  getSnapshotSummaries(itemIds: string[], days: number): Map<string, SparklineSummary>
  getHeatIndexBatch(itemIds: string[]): Map<string, HeatIndex>
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

// === Delta Column Types ===

export interface PriceDelta {
  itemId: string
  currentPrice: number
  previousPrice: number | null
  deltaPct: number | null
}

// === Sparkline Types (A4) ===

export interface SparklinePoint {
  date: string
  priceCents: number
}

export interface SparklineSummary {
  itemId: string
  points: SparklinePoint[]
  minCents: number
  maxCents: number
  startCents: number
  endCents: number
  changePercent: number
}

// === Heat Index Types (F1) ===

export type HeatTier = 'hot' | 'warm' | 'neutral' | 'cold'

export interface HeatIndex {
  itemId: string
  tier: HeatTier
  score: number
  watcherDelta: number | null
  watcherTrend: 'up' | 'down' | 'flat'
}

// === Budget Optimizer Types ===

export type AuctionMode = 'conservative' | 'moderate' | 'aggressive'
export type ExcludedReason = 'over_budget' | 'negative_score' | 'unranked'

export interface ScoreBreakdown {
  rankValue: number
  urgencyScore: number
  confidenceScore: number
  competitionPenalty: number
  priceOpportunity: number
  total: number
}

export interface ScoredItem {
  item: WatchlistItem
  estimatedCost: number
  score: number
  breakdown: ScoreBreakdown
  included: boolean
  excludedReason?: ExcludedReason
}

export interface OptimizationResult {
  picks: ScoredItem[]
  excluded: ScoredItem[]
  totalEstimated: number
  budgetRemaining: number
  budgetUtilization: number
}

// === Price Target Types (E6) ===

export type TargetType = 'buy_below' | 'sell_above'
export type TargetStatus = 'active' | 'triggered' | 'acknowledged' | 'deactivated'

export interface PriceTarget {
  id: number
  itemId: string
  targetType: TargetType
  targetCents: number
  status: TargetStatus
  triggeredPriceCents: number | null
  triggeredAt: string | null
  acknowledgedAt: string | null
  createdAt: string
}

export interface CreateTargetInput {
  itemId: string
  targetType: TargetType
  targetCents: number
}

export interface UpdateTargetInput {
  action: 'acknowledge' | 'deactivate'
}

export interface TargetsRepo {
  getAll(filters?: { status?: TargetStatus; itemId?: string }): PriceTarget[]
  getById(id: number): PriceTarget | null
  getActiveForItem(itemId: string): PriceTarget[]
  create(input: CreateTargetInput): PriceTarget
  triggerTarget(id: number, priceCents: number): void
  acknowledge(id: number): void
  deactivate(id: number): void
  remove(id: number): void
}

// === Historical Archive Types (D2) ===

export type RollupPeriod = 'day' | 'week' | 'month'

export interface PriceRollup {
  id: number
  itemId: string
  period: RollupPeriod
  periodStart: string
  openCents: number
  highCents: number
  lowCents: number
  closeCents: number
  avgCents: number
  volume: number
  watcherHigh: number | null
  watcherLow: number | null
  watcherClose: number | null
}

export interface OHLCDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  watcherHigh?: number | null
  watcherLow?: number | null
  watcherClose?: number | null
}

export interface HistoricalSummary {
  allTimeHigh: number
  allTimeLow: number
  avgPrice: number
  totalSnapshots: number
  oldestDate: string
  newestDate: string
  trend: 'up' | 'down' | 'flat'
}

export interface RollupsRepo {
  computeDailyRollup(itemId: string, date: string): boolean
  computeWeeklyRollup(itemId: string, weekStart: string): boolean
  computeMonthlyRollup(itemId: string, monthStart: string): boolean
  getRollups(itemId: string, period: RollupPeriod, from?: string, to?: string): PriceRollup[]
  getHistoricalSummary(itemId: string): HistoricalSummary | null
}

// === AI Title Parser Types (A9) ===

export type GradingCompany = 'PSA' | 'BGS' | 'SGC' | 'CGC' | 'HGA' | null

export interface CardMetadata {
  itemId: string
  playerName: string | null
  year: number | null
  brand: string | null
  setName: string | null
  cardNumber: string | null
  parallel: string | null
  isRookie: boolean
  gradingCompany: GradingCompany
  grade: string | null
  sport: string | null
  team: string | null
  parsedAt: string
  parseError: string | null
  titleHash: string
}

export interface ParsedTitle {
  playerName: string | null
  year: number | null
  brand: string | null
  setName: string | null
  cardNumber: string | null
  parallel: string | null
  isRookie: boolean
  gradingCompany: GradingCompany
  grade: string | null
  sport: string | null
  team: string | null
}

export interface TitleParseRequest {
  itemId: string
  force?: boolean
}

export interface TitleParseBatchRequest {
  itemIds?: string[]
  unparsedOnly?: boolean
}

export interface BatchParseResult {
  batchId: string
  submitted: number
  status: 'submitted' | 'processing' | 'complete' | 'failed'
}

export interface MetadataRepo {
  getByItemId(itemId: string): CardMetadata | null
  upsert(itemId: string, parsed: ParsedTitle, titleHash: string): void
  getUnparsedItemIds(limit?: number): string[]
  getStaleItemIds(): string[]
}

// === News Signal Pipeline Types ===

export type NewsEventType =
  | 'callup'
  | 'injury_minor'
  | 'injury_season'
  | 'trade_up'
  | 'trade_down'
  | 'award'
  | 'breakout'
  | 'suspension'
  | 'optioned'
  | 'release'
  | 'return_injury'
  | 'contract'
  | 'retirement'

export type SourceName = 'mlb_transactions' | 'rotowire_rss' | 'google_news_rss' | 'espn_rss' | 'cbs_sports_rss' | 'rotoballer_rss'

export interface RosterPlayer {
  id: number
  fullName: string
  firstName: string
  lastName: string
  position: string | null
  team: string | null
  teamId: number | null
  active: boolean
  sport: string
  updatedAt: string
}

export interface CardPlayerMapping {
  itemId: string
  playerId: number
  playerName: string
  confidence: number
  mappedAt: string
}

export interface RawNewsItem {
  source: SourceName
  sourceId: string | null
  title: string
  body: string | null
  url: string | null
  publishedAt: string | null
}

export interface NewsItem {
  id: number
  source: SourceName
  sourceId: string | null
  contentHash: string
  title: string
  body: string | null
  url: string | null
  publishedAt: string | null
  fetchedAt: string
  processed: number
}

export interface PlayerMention {
  id: number
  newsItemId: number
  playerId: number
  confidence: number
}

export interface CardSignal {
  id: number
  newsItemId: number
  itemId: string
  playerId: number
  eventType: NewsEventType
  score: number
  confidence: number
  headline: string
  source: SourceName
  sourceUrl: string | null
  matchedKeyword: string | null
  acknowledged: boolean
  expiresAt: string | null
  createdAt: string
}

export interface SourceHealth {
  source: SourceName
  lastSuccessAt: string | null
  lastFailureAt: string | null
  consecutiveFailures: number
  circuitOpen: boolean
  circuitOpenUntil: string | null
  lastError: string | null
}

export interface SignalScore {
  score: number
  confidence: number
}

// === News Signal Repo Interfaces ===

export interface RosterRepo {
  upsertPlayers(players: Omit<RosterPlayer, 'updatedAt'>[]): void
  search(query: string): RosterPlayer[]
  getAll(): RosterPlayer[]
  count(): number
}

export interface CardMappingRepo {
  upsert(mapping: Omit<CardPlayerMapping, 'mappedAt'>): void
  getByItemId(itemId: string): CardPlayerMapping | null
  getByPlayerId(playerId: number): CardPlayerMapping[]
  getUnmapped(): { id: string; title: string }[]
}

export type NewsProcessedStatus = 'pending' | 'matched' | 'no_match' | 'ai_fallback'
export type NewsExtractionMethod = 'regex' | 'ai' | 'none'

export interface NewsItemMention {
  playerId: number
  playerName: string
  confidence: number
}

export interface NewsItemSignalSummary {
  eventType: NewsEventType
  score: number
}

export interface NewsItemSignalDetail {
  eventType: NewsEventType
  score: number
  confidence: number
  matchedKeyword: string | null
  itemId: string
  expiresAt: string | null
  acknowledged: boolean
  createdAt: string
}

export interface NewsItemDetail {
  id: number
  source: SourceName
  title: string
  body: string | null
  url: string | null
  publishedAt: string | null
  fetchedAt: string
  processedStatus: NewsProcessedStatus
  extractionMethod: NewsExtractionMethod
  mentions: NewsItemMention[]
  signals: NewsItemSignalDetail[]
}

export interface NewsDetailPage {
  items: NewsItemDetail[]
  total: number
}

export interface NewsDetailParams {
  limit?: number
  offset?: number
  source?: SourceName
  status?: NewsProcessedStatus
  playerSearch?: string
  sortBy?: 'fetched_at' | 'source' | 'status' | 'mentions' | 'signals'
  sortDir?: 'asc' | 'desc'
}

export interface NewsRepo {
  insertIfNew(item: RawNewsItem): { id: number; isNew: boolean }
  markProcessed(id: number, status: number): void
  insertMention(newsItemId: number, playerId: number, confidence: number): void
  getRecent(limit: number, source?: SourceName): NewsItem[]
  getDetailed(params: NewsDetailParams): NewsDetailPage
}

export interface SignalsRepo {
  insert(signal: Omit<CardSignal, 'id' | 'createdAt' | 'acknowledged'>): void
  getRecent(params: { limit: number; offset?: number; itemId?: string; eventType?: NewsEventType; minScore?: number; acknowledged?: boolean }): { signals: CardSignal[]; total: number }
  acknowledge(id: number): number
  countToday(): number
  countUnacknowledged(): number
  deleteExpired(): number
}

export interface SourceHealthRepo {
  recordSuccess(source: SourceName): void
  recordFailure(source: SourceName, error: string): void
  openCircuit(source: SourceName, until: string): void
  closeCircuit(source: SourceName): void
  get(source: SourceName): SourceHealth | null
  getAll(): SourceHealth[]
}
