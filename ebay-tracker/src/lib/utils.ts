export { formatCents, formatDollars, parseCents, formatTimeLeft, timeAgo } from './format'

export function parseIsoDuration(duration: string): number {
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const days = parseInt(match[1] || '0', 10)
  const hours = parseInt(match[2] || '0', 10)
  const minutes = parseInt(match[3] || '0', 10)
  const seconds = parseInt(match[4] || '0', 10)

  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}
