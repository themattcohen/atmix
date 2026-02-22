import { NextRequest } from 'next/server'
import { routeOk, routeError } from '@/lib/errors'
import { getAll as getAllItems } from '@/lib/db/items'
import { getByItemIds, getUnparsed } from '@/lib/db/metadata'
import { parseBatch } from '@/lib/ai/title-parser'
import type { TitleParseBatchRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: TitleParseBatchRequest = await request.json().catch(() => ({}))
    const { itemIds: requestedIds, unparsedOnly } = body

    // Resolve IDs: use provided list or fall back to all unparsed
    let candidateIds: string[]
    if (requestedIds && requestedIds.length > 0) {
      candidateIds = requestedIds
    } else {
      candidateIds = getUnparsed()
    }

    // If nothing to process, return early
    if (candidateIds.length === 0) {
      return routeOk({ batchId: null, submitted: 0, skipped: 0 })
    }

    // If unparsedOnly, filter out items that already have valid (non-error) metadata
    let targetIds: string[]
    if (unparsedOnly) {
      const existing = getByItemIds(candidateIds)
      const parsedSet = new Set(
        existing.filter(m => m.parseError === null).map(m => m.itemId)
      )
      targetIds = candidateIds.filter(id => !parsedSet.has(id))
    } else {
      targetIds = candidateIds
    }

    const skipped = candidateIds.length - targetIds.length

    if (targetIds.length === 0) {
      return routeOk({ batchId: null, submitted: 0, skipped })
    }

    // Fetch item records to get titles
    const allItems = getAllItems()
    const itemMap = new Map(allItems.map(item => [item.id, item]))

    const batchItems = targetIds
      .map(id => {
        const item = itemMap.get(id)
        return item ? { itemId: id, title: item.title } : null
      })
      .filter((x): x is { itemId: string; title: string } => x !== null)

    const submitted = batchItems.length
    const actualSkipped = skipped + (targetIds.length - submitted)

    if (submitted === 0) {
      return routeOk({ batchId: null, submitted: 0, skipped: actualSkipped })
    }

    const batchId = await parseBatch(batchItems)

    const result: Record<string, unknown> = { batchId, submitted, skipped: actualSkipped }

    // Cost warning for large batches
    if (submitted > 500) {
      const estimatedCost = (submitted * 0.000475).toFixed(2)
      result.warning = `Large batch: estimated cost $${estimatedCost}. Proceed by polling the batchId.`
    }

    return routeOk(result)
  } catch (err) {
    return routeError(err)
  }
}
