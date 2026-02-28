# Gap #11: JWT Revocation Non-Functional

> **STATUS: PARTIALLY COMPLETE (2026-02-28)**
> Fix A applied: JWT maxAge reduced from 30d to 8h (`d2c/src/lib/auth.ts`). Fix B (Redis blocklist for immediate revocation) and Fix C (tokenVersion re-check) are deferred — not critical for launch with the 8h window. The 8h maxAge was chosen over the original 7d plan as a stronger security posture for financial data.

**Severity:** Medium
**Effort:** S (< 1 hour) for maxAge reduction; M (1-4 hours) for Redis blocklist
**Depends on:** None (maxAge fix is standalone; blocklist optionally depends on Redis already in the stack)

## Problem

After a user changes their password or resets it via the forgot-password flow, their old sessions remain valid for up to 30 days. An attacker who obtained a JWT (via XSS, network intercept, or device theft) cannot be locked out by the legitimate user changing their password. The `tokenVersion` mechanism visible in the code was intended to solve this, but the comment at line 73-75 of `auth.ts` explicitly acknowledges it does not work.

For a financial application storing SSNs, foreign account numbers, and FBAR filings, a 30-day window of continued access after a credential change is an unacceptable security gap.

## Current State

**`d2c/src/lib/auth.ts` lines 63-76:**

```typescript
session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
// ...
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.tokenVersion = (user as any).tokenVersion;
    }
    // Note: We don't re-check tokenVersion on every request because the JWT
    // callback runs on Edge runtime (via middleware) where Prisma isn't available.
    // Token revocation is handled by bumping tokenVersion + short maxAge.
    return token;
  },
```

**`d2c/prisma/schema.prisma` line 26:**

```prisma
tokenVersion  Int  @default(0)
```

The `tokenVersion` field exists on the `User` model. The password reset flow presumably increments it. However, the JWT callback never reads `tokenVersion` from the database to compare against `token.tokenVersion`. The comment says revocation is handled by "short maxAge" — but the `maxAge` is 30 days, not short.

The design is contradictory: the code claims short maxAge handles revocation, but sets a 30-day maxAge. Neither mechanism actually works.

## Implementation Plan

There are two independent fixes. Fix A is a one-line change and should be applied immediately. Fix B (Redis blocklist) provides immediate revocation and is recommended if Redis is already available in the stack (it is — `d2c` uses BullMQ/Redis for the statement extraction worker).

### Fix A: Reduce maxAge to 7 days (minimal, immediate)

**File:** `d2c/src/lib/auth.ts`, line 63

Change:
```typescript
session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
```

To:
```typescript
session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
```

This reduces the post-compromise window from 30 days to 7 days. Combined with password change incrementing `tokenVersion`, the exposure window becomes "until the 7-day JWT expires" rather than "30 days."

This is a safe one-line change with no schema migration required. It takes effect immediately for all new JWTs minted after deployment. Existing 30-day tokens remain valid until they expire (no retroactive effect — that requires Fix B).

### Fix B: Redis blocklist for immediate revocation (recommended)

This fix provides true immediate revocation: when a user changes their password or resets it, their existing session tokens are invalidated within seconds.

The key insight is that the `jwt` callback runs on Edge runtime where Prisma is unavailable, but the `ioredis` client (already a dependency for BullMQ) works in the Node.js API routes. The solution is a two-layer approach:

1. At password change/reset time: write the user's `id` to a Redis set `revoked-users` with a TTL equal to `maxAge`.
2. In the NextAuth `jwt` callback: check Redis for the user's id. If present, return an empty/invalid token.

However, Redis is also not available in the Edge runtime. The workaround is to move the `jwt` callback check out of the Edge middleware and into a Node.js-runtime API route that validates tokens explicitly. Alternatively, use a short-lived Redis-backed signed cookie as a "session alive" signal checked on each request.

**Recommended approach — Node.js middleware with `runtime = "nodejs"`:**

#### Step B1: Create Redis revocation helper — `d2c/src/lib/token-revocation.ts` (new file)

```typescript
import { createClient } from "redis";

// Reuse existing Redis connection if available, otherwise lazy-init
let client: ReturnType<typeof createClient> | null = null;

function getRedis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.connect().catch(console.error);
  }
  return client;
}

const REVOCATION_KEY = (userId: string) => `revoked:${userId}`;
const TTL_SECONDS = 7 * 24 * 60 * 60; // match JWT maxAge

/** Mark all tokens for this user as revoked. Call after password change. */
export async function revokeUserSessions(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(REVOCATION_KEY(userId), "1", { EX: TTL_SECONDS });
}

/** Check if a user's sessions are revoked. Returns true if revoked. */
export async function isUserRevoked(userId: string): Promise<boolean> {
  const redis = getRedis();
  const val = await redis.get(REVOCATION_KEY(userId));
  return val === "1";
}
```

#### Step B2: Call `revokeUserSessions` in password change/reset routes

Find the password reset handler (likely `d2c/src/app/api/auth/reset-password/route.ts` or similar) and the account settings password change handler. After successfully updating `user.passwordHash` and incrementing `user.tokenVersion`, call:

```typescript
import { revokeUserSessions } from "@/lib/token-revocation";
// ...
await revokeUserSessions(user.id);
```

#### Step B3: Validate sessions in a Node.js API route

Since the Edge `jwt` callback cannot call Redis, add a server-side validation endpoint:

**`d2c/src/app/api/auth/session-check/route.ts`** (new file):
```typescript
export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { isUserRevoked } from "@/lib/token-revocation";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ valid: false }, { status: 401 });
  const revoked = await isUserRevoked(session.user.id);
  if (revoked) return NextResponse.json({ valid: false }, { status: 401 });
  return NextResponse.json({ valid: true });
}
```

#### Step B4: Check revocation in middleware (hybrid approach)

Since the `jwt` callback is Edge-only and cannot use Redis, enforce revocation at the middleware level using a Node.js API preflight call, or alternatively switch the entire middleware to `runtime = "nodejs"`.

**Simpler alternative:** In `d2c/src/middleware.ts`, after extracting the token, set `runtime = "nodejs"` and call `isUserRevoked` directly:

```typescript
// d2c/src/middleware.ts
export const runtime = "nodejs";  // change from default Edge

import { isUserRevoked } from "@/lib/token-revocation";
// ...
// After auth token check:
if (token?.id) {
  const revoked = await isUserRevoked(token.id as string);
  if (revoked) {
    // Clear session cookie and redirect to login
    const response = NextResponse.redirect(new URL("/login?reason=session-expired", request.url));
    response.cookies.delete("authjs.session-token");
    return response;
  }
}
```

Note: Switching middleware to Node.js runtime has a cold-start cost but eliminates the Edge Redis constraint entirely.

### Fix C: tokenVersion re-check in Node.js routes (alternative to Redis, no new infra)

If Redis is not available or the Node.js middleware approach is not desired, `tokenVersion` can be checked in individual API route handlers (which already run in Node.js runtime and have Prisma access). This adds one DB query per authenticated API call:

```typescript
// In a shared auth helper used by API routes:
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getValidatedSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Re-check tokenVersion — only possible in Node.js runtime
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tokenVersion: true },
  });

  if (!user) return null;
  // tokenVersion in token was set at login; if it changed, session is stale
  // Note: session.user does not expose tokenVersion — would need to add it
  // This approach requires passing tokenVersion through to session object

  return session;
}
```

This approach is incomplete without passing `tokenVersion` through the `session` callback, which requires a small auth.ts change. It also adds a DB round-trip on every API call. The Redis blocklist (Fix B) is preferable.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/auth.ts` | Line 63: change `maxAge` from `30 * 24 * 60 * 60` to `7 * 24 * 60 * 60` (Fix A) |
| `d2c/src/middleware.ts` | Add `isUserRevoked` check; optionally set `runtime = "nodejs"` (Fix B) |
| `d2c/src/app/api/auth/reset-password/route.ts` | Call `revokeUserSessions(userId)` after password update (Fix B) |
| `d2c/src/app/api/auth/change-password/route.ts` (or equivalent) | Call `revokeUserSessions(userId)` after password update (Fix B) |

## Files to Create

| File | Purpose |
|---|---|
| `d2c/src/lib/token-revocation.ts` | Redis blocklist helpers `revokeUserSessions` / `isUserRevoked` (Fix B) |
| `d2c/src/app/api/auth/session-check/route.ts` | Optional Node.js session validation endpoint (Fix B) |

## Environment / Config Changes

- **Fix A only:** No environment changes.
- **Fix B:** Requires `REDIS_URL` in `.env` — this should already exist if BullMQ is used for statement extraction. Confirm it is set in `d2c/.env` and in `docker-compose.prod.yml` for the D2C service.

## Testing

**Fix A — manual:**
1. Log in, note the session cookie expiry in browser devtools
2. After deploying, verify new logins produce a cookie with 7-day expiry (not 30-day)

**Fix B — unit tests** for `d2c/src/lib/token-revocation.ts`:
- `revokeUserSessions("user-1")` sets a Redis key with correct TTL
- `isUserRevoked("user-1")` returns `true` after `revokeUserSessions` called
- `isUserRevoked("user-2")` returns `false` for unrevoked user
- After TTL expires (use `redis.expire(key, 0)` in test), `isUserRevoked` returns `false`

**Fix B — integration / E2E:**
1. Login with user A, capture the session cookie
2. Trigger password reset or password change for user A
3. Make an authenticated API request with the old session cookie — expect 401 or redirect to `/login`
4. Confirm the `revoked:userId` key exists in Redis (verify via `redis-cli GET revoked:userId`)

**Regression test:**
- Normal login flow still works after Fix B (revocation key not present for new logins)
- Session persists correctly across page navigations within the 7-day window

## Risks / Notes

- **Existing sessions:** Fix A reduces the window for new tokens only. Users already holding 30-day tokens will continue to have them until expiry. Fix B handles existing sessions immediately by writing to Redis.
- **Redis availability:** If the Redis server is down, `isUserRevoked` will throw. The helper should catch errors and default to `false` (fail open) to avoid locking out all users on Redis downtime. Log the error for alerting.
- **maxAge vs cookie expiry:** NextAuth's `maxAge` controls both the JWT `exp` claim and the cookie `Max-Age`. Reducing to 7 days means users are logged out after 7 days of inactivity (or 7 days from login, depending on `updateAge` config). This is a UX trade-off worth communicating. Consider setting `updateAge: 24 * 60 * 60` (refresh JWT every 24 hours) so active users aren't logged out after exactly 7 calendar days.
- **Middleware runtime change:** Changing `middleware.ts` to `runtime = "nodejs"` may increase cold start time on serverless deployments. On the current Docker/Node.js deployment (not serverless), this has no impact.
- **`tokenVersion` is currently unused:** The field exists in the schema and is included in the JWT token, but is never validated. Fix A reduces exposure; Fix B eliminates it. Fix C (tokenVersion re-check) would make the existing field functional but requires the most code change across API routes. Fix B is the cleanest solution.
- **Password reset token already increments tokenVersion:** Verify the reset-password route increments `tokenVersion` in its `prisma.user.update` call. If it does not, add it alongside the `revokeUserSessions` call.
