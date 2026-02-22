import type { SourceName } from '../../types'
import {
  recordSuccess,
  recordFailure,
  openCircuit,
  closeCircuit,
} from '../db/source-health'

const FAILURE_THRESHOLD = 3
const PAUSE_MS = 30 * 60 * 1000 // 30 minutes

interface CircuitState {
  failures: number
  openUntil: number | null
}

const circuitMap = new Map<SourceName, CircuitState>()

function getState(source: SourceName): CircuitState {
  if (!circuitMap.has(source)) {
    circuitMap.set(source, { failures: 0, openUntil: null })
  }
  return circuitMap.get(source)!
}

export function isCircuitOpen(source: SourceName): boolean {
  const state = getState(source)

  if (state.openUntil !== null) {
    if (Date.now() < state.openUntil) {
      return true
    }
    // Auto-close: cooldown period has passed
    state.openUntil = null
    state.failures = 0
    closeCircuit(source)
  }

  return false
}

export function recordSourceSuccess(source: SourceName): void {
  const state = getState(source)
  state.failures = 0
  state.openUntil = null
  recordSuccess(source)
}

export function recordSourceFailure(source: SourceName, error = 'unknown error'): void {
  const state = getState(source)
  state.failures++
  recordFailure(source, error)

  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + PAUSE_MS
    const until = new Date(state.openUntil).toISOString()
    openCircuit(source, until)
    console.warn(
      `[CircuitBreaker] Circuit OPENED for source "${source}" until ${until} (${state.failures} consecutive failures)`,
    )
  }
}
