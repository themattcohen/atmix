import { getEbayClient } from './auth'
import { withRetry } from '../errors'
import { EbayApiError } from '../errors'
import type { UpsertItemInput } from '../../types'

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
  const currentPrice = Math.round(
    parseFloat(raw.SellingStatus?.CurrentPrice?.Value || raw.BuyItNowPrice?.Value || '0') * 100
  )
  const buyItNowPrice = raw.BuyItNowPrice?.Value
    ? Math.round(parseFloat(raw.BuyItNowPrice.Value) * 100)
    : null
  const shippingCost = raw.ShippingDetails?.ShippingServiceCost?.Value
    ? Math.round(parseFloat(raw.ShippingDetails.ShippingServiceCost.Value) * 100)
    : 0

  let listingType: 'Auction' | 'FixedPrice' | 'AuctionWithBIN' = 'FixedPrice'
  const rawType = raw.ListingType
  if (rawType === 'Chinese' || rawType === 'Auction') {
    listingType = buyItNowPrice ? 'AuctionWithBIN' : 'Auction'
  } else if (rawType === 'FixedPriceItem' || rawType === 'StoresFixedPrice') {
    listingType = 'FixedPrice'
  }

  return {
    id: raw.ItemID,
    title: raw.Title || 'Unknown',
    currentPrice,
    buyItNowPrice,
    shippingCost,
    listingType,
    conditionName: raw.ConditionDisplayName || null,
    endTime: raw.ListingDetails?.EndTime || null,
    timeLeft: raw.TimeLeft || null,
    sellerId: raw.Seller?.UserID || null,
    sellerFeedback: raw.Seller?.FeedbackScore ? parseInt(raw.Seller.FeedbackScore, 10) : null,
    watcherCount: raw.WatchCount ? parseInt(raw.WatchCount, 10) : null,
    bidCount: raw.SellingStatus?.BidCount ? parseInt(raw.SellingStatus.BidCount, 10) : 0,
    imageUrl: raw.PictureDetails?.PictureURL?.[0] || raw.PictureDetails?.GalleryURL || null,
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

export async function getItemStatus(itemId: string): Promise<'active' | 'sold' | 'ended'> {
  return withRetry(async () => {
    try {
      const ebay = getEbayClient()
      const response = await ebay.buy.browse.getItem(`v1|${itemId}|0`)

      const status = response.itemEndDate
        ? new Date(response.itemEndDate) < new Date()
          ? 'ended'
          : 'active'
        : 'active'

      if (response.estimatedAvailabilities?.[0]?.availabilityThresholdType === 'OUT_OF_STOCK') {
        return 'sold'
      }

      return status
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return 'ended'
      }
      throw new EbayApiError(`Failed to check item status: ${err.message}`)
    }
  })
}
