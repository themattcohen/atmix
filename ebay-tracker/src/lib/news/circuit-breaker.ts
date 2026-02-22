import type { SourceName } from '../../types'
import {
  recordSuccess,
  recordFailure,
  openCircuit,
  closeCircuit,
  getAll,
} from '../db/source-health'

const FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD ?? '3', 10)
const PAUSE_MS = parseInt(process.env.CIRCUIT_PAUSE_MS ?? '1800000', 10) // default 30 minutes

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

function hydrateFromDb(): void {
  try {
    const rows = getAll()
    for (const row of rows) {
      const openUntil =
        row.circuitOpen && row.circuitOpenUntil
          ? new Date(row.circuitOpenUntil).getTime()
          : null

      circuitMap.set(row.source as SourceName, {
        failures: row.consecutiveFailures,
        openUntil,
      })

      const statusStr =
        openUntil !== null && Date.now() < openUntil
          ? `open until ${row.circuitOpenUntil}`
          : 'ok'
      console.log(`[CircuitBreaker] Hydrated: ${row.source}(${statusStr})`)
    }
  } catch (err) {
    // DB may not be ready at import time (e.g., during migrations); skip silently
    console.warn('[CircuitBreaker] Hydration skipped (DB not ready):', (err as Error).message)
  }
}

// Populate in-memory state from persisted DB records on module load
hydrateFromDb()

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
