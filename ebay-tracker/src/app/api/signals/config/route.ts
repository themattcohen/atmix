import { routeOk, routeError } from '@/lib/errors'
import { SIGNAL_CONFIG, SOURCE_CONFIG, SCORING_FORMULA } from '@/lib/news/signal-config'

export async function GET() {
  try {
    return routeOk({ signalConfig: SIGNAL_CONFIG, sourceConfig: SOURCE_CONFIG, scoringFormula: SCORING_FORMULA })
  } catch (err) {
    return routeError(err)
  }
}
