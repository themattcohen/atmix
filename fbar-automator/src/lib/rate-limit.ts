// ---------------------------------------------------------------------------
// In-memory rate limiter with sliding window algorithm
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  upload: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  general: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
}

// In-memory store: Map<key, RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent memory leaks
// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach((key) => rateLimitStore.delete(key))
}, 5 * 60 * 1000)

export function checkRateLimit(
  ip: string,
  tier: string
): { allowed: boolean; retryAfter?: number } {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.general
  const key = `${tier}:${ip}`
  const now = Date.now()

  // Clean up if expired
  const existing = rateLimitStore.get(key)
  if (existing && existing.resetTime < now) {
    rateLimitStore.delete(key)
  }

  const entry = rateLimitStore.get(key)

  if (!entry) {
    // First request in this window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return { allowed: true }
  }

  if (entry.count < config.maxRequests) {
    // Within rate limit
    entry.count += 1
    return { allowed: true }
  }

  // Rate limit exceeded
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
  return { allowed: false, retryAfter }
}
