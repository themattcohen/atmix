import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { updateRank } from '@/lib/db/items'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { itemId: string; newRank: number }

    if (!body.itemId || typeof body.newRank !== 'number' || body.newRank < 1 || !Number.isInteger(body.newRank)) {
      throw new AppError('VALIDATION', 'itemId required and newRank must be a positive integer', 400)
    }

    const updated = updateRank(body.itemId, body.newRank)
    return routeOk({ updated })
  } catch (err) {
    return routeError(err)
  }
}
