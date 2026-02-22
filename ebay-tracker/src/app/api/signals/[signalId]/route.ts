import { NextRequest } from 'next/server'
import { routeOk, routeError, NotFoundError } from '@/lib/errors'
import { acknowledge } from '@/lib/db/signals'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  try {
    const signalId = parseInt(params.signalId, 10)
    if (isNaN(signalId)) {
      throw new NotFoundError('Invalid signal ID')
    }

    const body = await request.json()

    if (body.acknowledged === true) {
      acknowledge(signalId)
    }

    return routeOk({ id: signalId, acknowledged: true })
  } catch (err) {
    return routeError(err)
  }
}
