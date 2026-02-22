import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getById } from '@/lib/db/items'
import { getByItemId, upsertMetadata, upsertError } from '@/lib/db/metadata'
import { parseSingle } from '@/lib/ai/title-parser'
import type { TitleParseRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: TitleParseRequest = await request.json()
    const { itemId, force = false } = body

    if (!itemId) {
      throw new AppError('INVALID_PARAMS', 'itemId is required', 400)
    }

    // If not forcing, return existing metadata if it exists without error
    if (!force) {
      const existing = getByItemId(itemId)
      if (existing && existing.parseError === null) {
        return routeOk(existing)
      }
    }

    // Fetch the item to get its title
    const item = getById(itemId)
    if (!item) {
      throw new AppError('NOT_FOUND', `Item ${itemId} not found`, 404)
    }

    // Parse via AI
    let parsed
    try {
      parsed = await parseSingle(itemId, item.title)
    } catch (err: any) {
      // Record the failure then re-throw so the client gets the error
      try {
        upsertError(itemId, item.title, err.message)
      } catch {
        // Ignore secondary DB errors
      }
      throw err
    }

    // Store successful parse
    upsertMetadata(itemId, item.title, parsed)

    // Return the stored metadata
    const stored = getByItemId(itemId)
    return routeOk(stored)
  } catch (err) {
    return routeError(err)
  }
}
