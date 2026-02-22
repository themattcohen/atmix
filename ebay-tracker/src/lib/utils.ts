export function formatCents(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`
}

export function formatTimeLeft(endTime: string | null): string {
  if (!endTime) return 'N/A'

  const end = new Date(endTime).getTime()
  const now = Date.now()
  const diff = end - now

  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

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

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
