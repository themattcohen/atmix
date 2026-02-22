import type { SourceName } from '../../types'

const locks = new Map<SourceName, boolean>()

export function acquireLock(source: SourceName): boolean {
  if (locks.get(source) === true) {
    return false
  }
  locks.set(source, true)
  return true
}

export function releaseLock(source: SourceName): void {
  locks.set(source, false)
}
