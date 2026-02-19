# Gap #19: In-Memory Rate Limiter Resets on Restart

**Severity:** Low
**Effort:** M (1-4 hours)
**Depends on:** None

## Problem

The rate limiter in `middleware.ts` stores all counters in a module-level `Map` (line 9). Every time the Next.js process restarts — on deploy, on crash, or on any `docker compose up` — the map is cleared and all rate limit counters reset to zero.

A determined attacker who knows the app restarts (observable via response timing or public deploy notifications) can burst requests immediately after each restart. For auth-sensitive routes limited to 5 requests/minute (signup, forgot-password, reset-password), a restart bypasses the cooldown entirely.

This is an acceptable trade-off for a single-instance MVP with Caddy rate limiting at the edge providing a partial outer defense. The gap becomes more meaningful if: (a) the instance crashes/restarts frequently under load, (b) a multi-process or multi-instance deployment is adopted, or (c) the Caddy layer is removed.

## Current State

**`d2c/src/middleware.ts` lines 9-35:**

```ts
// Line 9 — module-level Map, cleared on every process restart
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= limit) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

// Periodic cleanup to prevent memory leak (every 60s)
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  });
}, 60_000);
```

**Usage (lines 93-111):**
- Auth routes: `rateLimit(`auth:${ip}`, 5, 60_000)` — 5 req/min per IP in production
- General API routes: `rateLimit(`api:${ip}`, 60, 60_000)` — 60 req/min per IP in production

**Existing mitigations:**
- Caddy is configured in `docker-compose.prod.yml` and provides edge-level rate limiting independent of the Node process. A restart of the Next.js container does not reset Caddy's counters.
- The `setInterval` cleanup on line 29 prevents unbounded memory growth in long-running processes, but this also runs in-process and is lost on restart.

**Infrastructure context:**
- Single-instance deployment on Hetzner VPS (1.9 GB RAM, no swap).
- No Redis is deployed — the project has no Redis container in `docker-compose.prod.yml` or `d2c/docker-compose.yml`.

## Implementation Plan

Two options are presented in order of preference.

---

### Option A: Redis-backed rate limiter (recommended if Redis is already added for another reason)

This option is only worth the operational cost if Redis is being added for another feature (e.g., session storage, job queues). Do not add Redis solely for rate limiting.

#### Step 1: Add Redis to `docker-compose.prod.yml`

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data

volumes:
  redis_data:
```

#### Step 2: Install `ioredis`

```bash
cd d2c
npm install ioredis
```

#### Step 3: Replace `rateLimit` function in `middleware.ts`

Next.js middleware runs in the Edge Runtime, which does NOT support Node.js modules including `ioredis`. Therefore, the rate limit check must be moved out of `middleware.ts` and into an API route handler or a Node.js runtime middleware wrapper.

**Revised approach:** Keep `middleware.ts` doing only the auth check and path routing. Move rate limiting to a shared utility `d2c/src/lib/rate-limit-redis.ts` called from each protected API route handler.

```ts
// d2c/src/lib/rate-limit-redis.ts
import Redis from "ioredis"

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  }
  return redis
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const r = getRedis()
  const redisKey = `rl:${key}`
  const windowSec = Math.ceil(windowMs / 1000)

  try {
    const current = await r.incr(redisKey)
    if (current === 1) {
      await r.expire(redisKey, windowSec)
    }
    return current <= limit
  } catch {
    // On Redis failure, fail open (allow the request) to avoid blocking all traffic
    console.error("[RateLimit] Redis error — failing open")
    return true
  }
}
```

Add `REDIS_URL=redis://redis:6379` to `.env.production`.

---

### Option B: Sliding window in Caddy (recommended — no new dependencies)

Caddy already sits in front of Next.js. Moving rate limiting entirely to Caddy eliminates the in-process gap with zero new dependencies and survives Next.js restarts unconditionally.

#### Step 1: Locate the Caddy configuration

The Caddy config lives in `docker-compose.prod.yml` (inline `Caddyfile` or bind-mounted file). Identify which routes need rate limiting.

#### Step 2: Add `rate_limit` directive to Caddyfile

Caddy's built-in `rate_limit` directive (available via the `caddy-ratelimit` plugin or native in Caddy v2.8+) can be configured per-path:

```caddyfile
@authSensitive {
  path /api/auth/signup /api/auth/forgot-password /api/auth/reset-password /api/auth/callback
}
rate_limit @authSensitive 5r/m

@generalApi {
  path /api/*
  not path /api/health /api/stripe/webhook
}
rate_limit @generalApi 60r/m
```

If the current Caddy image does not include the rate limit plugin, switch to `ghcr.io/mholt/caddy-ratelimit` or add a `caddy-builder` step to `docker-compose.prod.yml`.

#### Step 3: Simplify `middleware.ts`

Once Caddy is the authoritative rate limiter, remove the `rateLimitStore`, `rateLimit` function, and the `setInterval` cleanup from `middleware.ts` entirely (lines 6-35 and 96-111). This removes ~30 lines and eliminates the in-memory gap permanently.

Keep the CSRF check (lines 118-128) and auth checks (lines 130-166) in middleware as-is — those are not rate limiting concerns.

---

### Option C: Accept the gap (current default — no action)

Document the accepted risk:
- Caddy provides the primary rate limiting layer; it is restart-independent.
- The Next.js in-process rate limiter is a defense-in-depth secondary layer that resets on restart.
- At single-instance MVP scale, the window of exposure per restart is at most 60 seconds (one rate limit window).
- No action required until Caddy is removed, multi-instance deployment is adopted, or abuse is observed.

**If choosing Option C**, add a code comment at line 9 of `middleware.ts` to document this explicitly:

```ts
// In-memory rate limiter — resets on restart. Primary rate limiting is via Caddy at the edge.
// See claudedocs/knowngaps/19-rate-limiter-persistence.md for upgrade path.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
```

## Files to Modify

**Option A (Redis):**

| File | Change |
|---|---|
| `d2c/src/lib/rate-limit-redis.ts` | New file — Redis-backed `rateLimit()` utility |
| `d2c/src/middleware.ts` | Remove in-process `rateLimitStore` and `rateLimit` (lines 6-35, 96-111) |
| API route handlers that need rate limiting | Import and `await rateLimit(...)` at the top of each handler |
| `docker-compose.prod.yml` | Add `redis` service + `redis_data` volume |
| `d2c/.env.production` (or equivalent) | Add `REDIS_URL=redis://redis:6379` |

**Option B (Caddy):**

| File | Change |
|---|---|
| `docker-compose.prod.yml` | Add `rate_limit` directives to Caddyfile block; possibly switch Caddy image |
| `d2c/src/middleware.ts` | Remove lines 6-35 (store + function + setInterval) and lines 96-111 (call sites) |

**Option C (document and accept):**

| File | Change |
|---|---|
| `d2c/src/middleware.ts` | Update comment on line 9 to document accepted risk |

## Environment / Config Changes

**Option A:** Add `REDIS_URL` to production environment. Add `redis` service to `docker-compose.prod.yml`. Note the 1.9 GB RAM constraint — `redis:7-alpine` with `--maxmemory 64mb` uses approximately 70-80 MB RSS, which is acceptable.

**Option B:** May require switching the Caddy Docker image if the rate limit plugin is not included in the current image. Verify the current image tag in `docker-compose.prod.yml` before proceeding.

**Option C:** No environment or config changes.

## Testing

**Option A:**
1. Start Redis locally: `docker run -p 6379:6379 redis:7-alpine`.
2. Set `REDIS_URL=redis://localhost:6379` in `.env.local`.
3. Run `npm run dev` and hammer an auth route with `curl` in a loop: `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/auth/signup; done`. Expect HTTP 429 after request 5.
4. Restart the dev server. Repeat the curl loop. Confirm the counter persists (i.e., requests 1-5 after restart still respect the limit set before restart).
5. Run full E2E suite: `npm run test:e2e` — confirm no regressions in auth flows.

**Option B:**
1. Deploy to staging/prod with updated Caddyfile.
2. Use `curl` from an external IP to hit auth routes 6+ times in a minute.
3. Confirm Caddy returns 429 (not the Next.js app) — check by inspecting response headers for `X-Caddy-Rate-Limit` or similar.
4. Restart the Next.js container only (`docker restart d2c`). Confirm rate limit still applies (Caddy state persists).

**Option C:**
1. Verify the code comment is accurate.
2. No functional testing required.

## Risks / Notes

- **Edge Runtime constraint:** Next.js `middleware.ts` runs in the Edge Runtime (V8 isolates, not Node.js). This means `ioredis`, `net`, and any TCP-based library cannot be imported directly in `middleware.ts`. Option A requires restructuring the rate limiting to run in Node.js route handlers, not middleware. This is a meaningful refactor (~1-2 hours additional effort beyond Option B).
- **Fail-open vs fail-closed:** The Redis option above fails open on Redis unavailability (allows the request). This is intentional — a Redis outage should not take down the entire app. The trade-off is that rate limiting is temporarily suspended during Redis downtime.
- **Caddy in-memory too:** Caddy also stores rate limit state in memory (no persistent volume for rate limits). A Caddy container restart would reset Caddy's counters as well. However, Caddy restarts are far less frequent than Next.js app restarts, and the Docker `restart: unless-stopped` policy means Caddy only restarts on explicit deploy, not on app crashes.
- **Single window:** Because the rate limit window is 60 seconds and the auth limit is 5 req/min, the worst-case exposure from a restart is: an attacker gets up to 5 additional attempts within the current window. For credential stuffing, this is a modest additional risk — not an emergency.
- **Multi-instance future:** If horizontal scaling is ever added (multiple Next.js containers behind Caddy), the in-memory approach breaks entirely regardless of restarts. That transition point is the clearest trigger to implement Option A or B.
