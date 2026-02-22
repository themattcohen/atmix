import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getById, acknowledge, deactivate, remove } from '@/lib/db/targets'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const id = parseInt(params.targetId, 10)
    if (isNaN(id)) throw new AppError('VALIDATION_ERROR', 'targetId must be numeric', 400)

    const target = getById(id)
    if (!target) throw new AppError('NOT_FOUND', `Target ${id} not found`, 404)

    const body = await request.json() as { action?: string }

    if (body.action === 'acknowledge') {
      if (target.status !== 'triggered') {
        throw new AppError('INVALID_STATE', 'Only triggered targets can be acknowledged', 409)
      }
      acknowledge(id)
    } else if (body.action === 'deactivate') {
      if (target.status === 'acknowledged' || target.status === 'deactivated') {
        throw new AppError('INVALID_STATE', 'Target is already in a terminal state', 409)
      }
      deactivate(id)
    } else {
      throw new AppError('VALIDATION_ERROR', 'action must be acknowledge or deactivate', 400)
    }

    return routeOk({ success: true })
  } catch (err) {
    return routeError(err)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const id = parseInt(params.targetId, 10)
    if (isNaN(id)) throw new AppError('VALIDATION_ERROR', 'targetId must be numeric', 400)

    const target = getById(id)
    if (!target) throw new AppError('NOT_FOUND', `Target ${id} not found`, 404)

    remove(id)
    return routeOk({ success: true })
  } catch (err) {
    return routeError(err)
  }
}
