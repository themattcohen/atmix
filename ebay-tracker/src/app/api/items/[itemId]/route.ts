import { NextRequest } from 'next/server'
import { routeOk, routeError, AppError } from '@/lib/errors'
import { getById, updateNotes, toggleQueue } from '@/lib/db/items'
import { getSnapshots } from '@/lib/db/trends'
import { getForItem } from '@/lib/db/events'

export async function GET(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params
    const item = getById(itemId)
    if (!item) {
      throw new AppError('NOT_FOUND', `Item ${itemId} not found`, 404)
    }

    const snapshots = getSnapshots(itemId, 90)
    const events = getForItem(itemId, 50)

    return routeOk({ item, snapshots, events })
  } catch (err) {
    return routeError(err)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params
    const body = await request.json() as { notes?: string; isInQueue?: boolean }

    if (typeof body.notes === 'string') {
      updateNotes(itemId, body.notes)
    }
    if (typeof body.isInQueue === 'boolean') {
      toggleQueue(itemId, body.isInQueue)
    }

    return routeOk({ success: true })
  } catch (err) {
    return routeError(err)
  }
}
