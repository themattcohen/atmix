import { NextRequest } from 'next/server'
import { routeOk, routeError, NotFoundError, ValidationError } from '@/lib/errors'
import { acknowledge } from '@/lib/db/signals'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  try {
    const signalId = parseInt(params.signalId, 10)
    if (isNaN(signalId) || signalId < 1) {
      throw new ValidationError('signalId must be a positive integer')
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return routeError(new ValidationError('Invalid JSON body'))
    }

    if (body.acknowledged !== true) {
      return routeError(new ValidationError('body.acknowledged must be true'))
    }

    const changes = acknowledge(signalId)
    if (changes === 0) {
      return routeError(new NotFoundError('Signal not found'))
    }

    return routeOk({ id: signalId, acknowledged: true })
  } catch (err) {
    return routeError(err)
  }
}
