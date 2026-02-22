import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getAll, create } from '@/lib/db/targets'
import { getById as getItemById } from '@/lib/db/items'
import type { TargetStatus, CreateTargetInput } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const itemId = params.get('itemId') ?? undefined
    const status  = (params.get('status') as TargetStatus | null) ?? undefined

    const targets = getAll({ itemId, status })
    return routeOk(targets)
  } catch (err) {
    return routeError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<CreateTargetInput>

    if (!body.itemId || typeof body.itemId !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'itemId is required', 400)
    }
    if (body.targetType !== 'buy_below' && body.targetType !== 'sell_above') {
      throw new AppError('VALIDATION_ERROR', 'targetType must be buy_below or sell_above', 400)
    }
    if (!Number.isInteger(body.targetCents) || (body.targetCents as number) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'targetCents must be a positive integer', 400)
    }

    // Verify item exists before creating target
    const item = getItemById(body.itemId)
    if (!item) {
      throw new AppError('NOT_FOUND', `Item ${body.itemId} not found`, 404)
    }

    const target = create({
      itemId:      body.itemId,
      targetType:  body.targetType,
      targetCents: body.targetCents as number,
    })
    return routeOk(target)
  } catch (err) {
    return routeError(err)
  }
}
