import { routeOk, routeError } from '@/lib/errors'
import { countToday, countUnacknowledged } from '@/lib/db/signals'
import { getAll as getAllSourceHealth } from '@/lib/db/source-health'

export async function GET() {
  try {
    const stats = {
      countToday: countToday(),
      countUnacknowledged: countUnacknowledged(),
      sourceHealth: getAllSourceHealth(),
    }

    return routeOk(stats)
  } catch (err) {
    return routeError(err)
  }
}
