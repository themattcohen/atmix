// NOTE: In-memory rate limiter. Works for single-instance deployments.
// For multi-instance, migrate to Redis. IMPORTANT: Next.js middleware runs
// in Edge Runtime — ioredis requires Node.js runtime and won't work here.
// Options for production: (a) @upstash/redis (Edge-compatible),
// (b) move rate limiting to API route handlers (Node.js runtime),
// (c) keep in-memory for single-instance. Current choice: (c).
// ---------------------------------------------------------------------------
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

const RATE_LIMIT_MULTIPLIER = process.env.RATE_LIMIT_MULTIPLIER
  ? parseInt(process.env.RATE_LIMIT_MULTIPLIER, 10)
  : 1

const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  auth: {
    maxRequests: 5 * RATE_LIMIT_MULTIPLIER,
    windowMs: 60 * 1000, // 1 minute
  },
  upload: {
    maxRequests: 30 * RATE_LIMIT_MULTIPLIER,
    windowMs: 60 * 1000, // 1 minute — 30/min safe: auth-gated, Caddy still caps per-second abuse
  },
  general: {
    maxRequests: 60 * RATE_LIMIT_MULTIPLIER,
    windowMs: 60 * 1000, // 1 minute
  },
  status: {
    maxRequests: 300 * RATE_LIMIT_MULTIPLIER,
    windowMs: 60_000, // 1 minute — generous for batch polling (12 files × 20 polls/min = 240)
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
