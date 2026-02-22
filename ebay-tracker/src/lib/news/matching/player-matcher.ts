import Fuse, { type IFuseOptions } from 'fuse.js'
import type { RosterPlayer } from '../../../types'
import { getAll } from '../../db/roster'

const FUSE_OPTIONS: IFuseOptions<RosterPlayer> = {
  keys: ['fullName', 'lastName'],
  threshold: 0.3,
  includeScore: true,
  ignoreLocation: true,
}

const CONFIDENCE_THRESHOLD = 0.65
const CACHE_TTL_MS = 3_600_000 // 1 hour

let fuseIndex: Fuse<RosterPlayer> | null = null
let lastBuildTime = 0

function buildFuseIndex(): void {
  const now = Date.now()
  if (fuseIndex !== null && now - lastBuildTime <= CACHE_TTL_MS) return

  const players = getAll()
  fuseIndex = new Fuse(players, FUSE_OPTIONS)
  lastBuildTime = now
}

export function matchPlayerName(
  name: string,
): { player: RosterPlayer; confidence: number } | null {
  buildFuseIndex()

  if (!fuseIndex) return null

  const results = fuseIndex.search(name)
  if (results.length === 0) return null

  const best = results[0]
  const score = best.score ?? 1
  if (score > 0.4) return null

  const confidence = 1 - score
  if (confidence < CONFIDENCE_THRESHOLD) return null

  return { player: best.item, confidence }
}

export function invalidateFuseCache(): void {
  fuseIndex = null
}
