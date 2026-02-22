import { getEbayClient } from './auth'
import { withRetry } from '../errors'
import { EbayApiError } from '../errors'
import type { UpsertItemInput } from '../../types'

/** Result returned by getItemStatus — status plus any speculatively captured Browse API fields */
export interface ItemStatusResult {
  status: 'active' | 'sold' | 'ended'
  /** watchCount from Browse API — undefined until eBay App Check is approved */
  watchCount: number | null
}

const BROWSE_BATCH_SIZE = 20
const BROWSE_BATCH_THROTTLE_MS = 200

interface EbayWatchlistResponse {
  WatchList?: {
    ItemArray?: {
      Item?: any[]
    }
    PaginationResult?: {
      TotalNumberOfEntries: string
      TotalNumberOfPages: string
    }
  }
}

function normalizeItem(raw: any): UpsertItemInput {
  // Bug 1: SDK returns lowercase .value, not .Value
  const priceVal = raw.SellingStatus?.CurrentPrice?.value
    ?? raw.SellingStatus?.CurrentPrice?.Value
    ?? raw.BuyItNowPrice?.value
    ?? raw.BuyItNowPrice?.Value
    ?? 0
  const currentPrice = Math.round(parseFloat(String(priceVal)) * 100)

  // Bug 3: Same casing fix for BuyItNowPrice
  const binVal = raw.BuyItNowPrice?.value ?? raw.BuyItNowPrice?.Value ?? null
  const buyItNowPrice = binVal != null ? Math.round(parseFloat(String(binVal)) * 100) : null

  // Bug 2: Shipping nested under ShippingServiceOptions + lowercase .value
  const shipVal = raw.ShippingDetails?.ShippingServiceOptions?.ShippingServiceCost?.value
    ?? raw.ShippingDetails?.ShippingServiceOptions?.ShippingServiceCost?.Value
    ?? raw.ShippingDetails?.ShippingServiceCost?.value
    ?? raw.ShippingDetails?.ShippingServiceCost?.Value
    ?? 0
  const shippingCost = Math.round(parseFloat(String(shipVal)) * 100)

  // Bug 4: PictureURL may be string or array
  const picUrls = raw.PictureDetails?.PictureURL
  const imageUrl = (Array.isArray(picUrls) ? picUrls[0] : picUrls)
    || raw.PictureDetails?.GalleryURL || null

  // Bug 5: ItemID may be number, ensure string
  const id = String(raw.ItemID)

  let listingType: 'Auction' | 'FixedPrice' | 'AuctionWithBIN' = 'FixedPrice'
  const rawType = raw.ListingType
  if (rawType === 'Chinese' || rawType === 'Auction') {
    listingType = buyItNowPrice ? 'AuctionWithBIN' : 'Auction'
  } else if (rawType === 'FixedPriceItem' || rawType === 'StoresFixedPrice') {
    listingType = 'FixedPrice'
  }

  return {
    id,
    title: raw.Title || 'Unknown',
    currentPrice,
    buyItNowPrice,
    shippingCost,
    listingType,
    conditionName: raw.ConditionDisplayName || null,
    endTime: raw.ListingDetails?.EndTime || null,
    timeLeft: raw.TimeLeft || null,
    sellerId: raw.Seller?.UserID || null,
    sellerFeedback: raw.Seller?.FeedbackScore ? parseInt(String(raw.Seller.FeedbackScore), 10) : null,
    watcherCount: raw.WatchCount ? parseInt(String(raw.WatchCount), 10) : null,
    bidCount: raw.SellingStatus?.BidCount ? parseInt(String(raw.SellingStatus.BidCount), 10) : 0,
    imageUrl,
    listingUrl: raw.ListingDetails?.ViewItemURL || null,
    status: 'Active',
  }
}

export async function fetchWatchlist(): Promise<UpsertItemInput[]> {
  return withRetry(async () => {
    const ebay = getEbayClient()
    const items: UpsertItemInput[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const response: EbayWatchlistResponse = await ebay.trading.GetMyeBayBuying({
        WatchList: {
          Include: true,
          Pagination: {
            EntriesPerPage: 200,
            PageNumber: page,
          },
        },
        DetailLevel: 'ReturnAll',
      })

      const watchList = response.WatchList
      if (!watchList?.ItemArray?.Item) break

      const rawItems = Array.isArray(watchList.ItemArray.Item)
        ? watchList.ItemArray.Item
        : [watchList.ItemArray.Item]

      for (const raw of rawItems) {
        items.push(normalizeItem(raw))
      }

      totalPages = parseInt(watchList.PaginationResult?.TotalNumberOfPages || '1', 10)
      page++
    }

    return items
  })
}

export async function getItemStatus(itemId: string): Promise<ItemStatusResult> {
  return withRetry(async () => {
    try {
      const ebay = getEbayClient()
      const response = await ebay.buy.browse.getItem(`v1|${itemId}|0`)

      const status: 'active' | 'sold' | 'ended' = response.itemEndDate
        ? new Date(response.itemEndDate) < new Date()
          ? 'ended'
          : 'active'
        : 'active'

      if (response.estimatedAvailabilities?.[0]?.availabilityThresholdType === 'OUT_OF_STOCK') {
        return { status: 'sold', watchCount: response.watchCount ?? null }
      }

      // Speculatively capture watchCount — will be undefined until eBay App Check is approved
      const watchCount: number | null = response.watchCount ?? null

      return { status, watchCount }
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return { status: 'ended', watchCount: null }
      }
      throw new EbayApiError(`Failed to check item status: ${err.message}`)
    }
  })
}

/**
 * Batch-fetches watchCount for up to N legacy eBay item IDs using the Browse API
 * getItems endpoint (max 20 per call). Designed for a cron job that refreshes
 * watcher counts for ranked items without triggering a full watchlist sync.
 *
 * Returns a Map<itemId, watchCount>. Items where watchCount is unavailable
 * (e.g. Browse API App Check not yet approved) are omitted from the map.
 */
export async function fetchWatchCounts(itemIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (itemIds.length === 0) return result

  const ebay = getEbayClient()

  for (let i = 0; i < itemIds.length; i += BROWSE_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BROWSE_BATCH_SIZE)
    const itemFilter = batch.map(id => `v1|${id}|0`).join(',')

    try {
      const response = await ebay.buy.browse.getItems({ item_ids: itemFilter })
      const items: any[] = response.items ?? []

      for (const item of items) {
        const rawId = item.itemId as string | undefined
        // itemId from Browse API is in the form "v1|<legacyId>|0"
        const legacyId = rawId?.split('|')[1] ?? rawId
        if (!legacyId) continue

        const watchCount = item.watchCount ?? null
        if (watchCount != null) {
          result.set(legacyId, watchCount)
        }
      }
    } catch (err: any) {
      console.error(`[fetchWatchCounts] Batch ${Math.floor(i / BROWSE_BATCH_SIZE) + 1} failed (items ${i}–${i + batch.length - 1}): ${err.message}`)
      // Continue to next batch rather than aborting all
    }

    // Throttle between batches to avoid hammering the API
    if (i + BROWSE_BATCH_SIZE < itemIds.length) {
      await new Promise(resolve => setTimeout(resolve, BROWSE_BATCH_THROTTLE_MS))
    }
  }

  return result
}
