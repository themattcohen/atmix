import { routeOk, routeError, AppError } from '@/lib/errors'
import { isSyncing, runSync } from '@/lib/sync/sync-service'

export async function POST() {
  try {
    if (isSyncing()) {
      throw new AppError('SYNC_IN_PROGRESS', 'Sync already in progress', 409)
    }

    const result = await runSync()
    return routeOk(result)
  } catch (err) {
    return routeError(err)
  }
}
