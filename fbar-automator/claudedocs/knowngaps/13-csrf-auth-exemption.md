# Gap #13: CSRF Exempts All `/api/auth/*`

**Severity:** Medium
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

The CSRF header check in `middleware.ts` uses a blanket exemption for every route under `/api/auth/`. This means `POST /api/auth/forgot-password` accepts state-changing requests from any origin without the `X-Requested-With` header. A cross-site POST to this endpoint triggers a password reset email to the targeted user's inbox.

The practical impact is limited by the 5 req/min rate limit on auth routes (line 93-98), but the exemption is broader than necessary. The only routes that genuinely need to be CSRF-exempt are those called directly by NextAuth's own server-side mechanisms — primarily the OAuth callback handler. Custom API routes under `/api/auth/` that are called from the browser (forgot-password, signup, reset-password) should be subject to the same CSRF check as all other API routes.

Cross-site password reset email spam is an annoyance-level attack: the attacker cannot read the reset link (it goes only to the user's inbox), cannot complete the reset without the link, and is rate-limited to 5 emails per minute per IP. However, it is a violation of the SameSite-first principle and leaves the door open if rate limiting is ever relaxed or bypassed.

## Current State

**File:** `d2c/src/middleware.ts`

Lines 119-128 — the CSRF check block:
```typescript
const method = request.method;
if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
  const isExempt =
    normalizedPath.startsWith("/api/auth/") ||      // <-- line 122: blanket exemption
    normalizedPath.startsWith("/api/stripe/webhook") ||
    normalizedPath === "/api/health";
  if (!isExempt && normalizedPath.startsWith("/api/") && !request.headers.get("x-requested-with")) {
    return NextResponse.json({ error: "Missing CSRF header" }, { status: 403 });
  }
}
```

The `/api/auth/` prefix exemption covers all of these routes:
- `/api/auth/callback` — NextAuth OAuth callback; **must** remain exempt (NextAuth calls it server-to-server)
- `/api/auth/signin` — NextAuth internal; **must** remain exempt
- `/api/auth/signout` — NextAuth internal; **must** remain exempt
- `/api/auth/session` — NextAuth GET; not a POST, so CSRF check doesn't apply anyway
- `/api/auth/csrf` — NextAuth GET; not a POST
- `/api/auth/forgot-password` — custom route; called from browser; **should not be exempt**
- `/api/auth/signup` — custom route; called from browser; **should not be exempt**
- `/api/auth/reset-password` — custom route; called from browser; **should not be exempt**

The forgot-password page at `d2c/src/app/(auth)/forgot-password/page.tsx` (line 18-22) already sends `X-Requested-With: XMLHttpRequest` in its fetch call, so removing the exemption for this route will not break the legitimate browser flow. The same pattern must be confirmed for signup and reset-password before removing their exemption.

**Rate limiting context (lines 40-98):** `AUTH_RATE_LIMIT_PATHS` already includes `/api/auth/forgot-password` and enforces 5 req/min per IP in production. This is the primary mitigation in place today.

## Implementation Plan

### Step 1: Narrow the CSRF exemption to NextAuth-internal paths only

Replace the blanket `/api/auth/` prefix with an explicit allowlist of the NextAuth-managed paths that legitimately require exemption. These are the paths NextAuth uses for its own OAuth and session machinery.

In `d2c/src/middleware.ts`, change the `isExempt` block (lines 121-124):

**Before:**
```typescript
const isExempt =
  normalizedPath.startsWith("/api/auth/") ||
  normalizedPath.startsWith("/api/stripe/webhook") ||
  normalizedPath === "/api/health";
```

**After:**
```typescript
// NextAuth internal routes that must remain CSRF-exempt:
// /api/auth/callback/* — OAuth provider callbacks (server-to-server, no browser headers)
// /api/auth/signin     — NextAuth sign-in page POST
// /api/auth/signout    — NextAuth sign-out POST
// Custom routes (/api/auth/forgot-password, /api/auth/signup, /api/auth/reset-password)
// are called from the browser and must carry X-Requested-With like all other API routes.
const NEXTAUTH_EXEMPT_PREFIXES = [
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
];
const isExempt =
  NEXTAUTH_EXEMPT_PREFIXES.some((p) => normalizedPath.startsWith(p)) ||
  normalizedPath.startsWith("/api/stripe/webhook") ||
  normalizedPath === "/api/health";
```

### Step 2: Verify all custom auth fetch calls send `X-Requested-With`

Before deploying, confirm that every browser-side fetch to a now-protected route already includes the header. This is required to avoid breaking the legitimate user flow.

**Already confirmed:**
- `d2c/src/app/(auth)/forgot-password/page.tsx:20` — `"X-Requested-With": "XMLHttpRequest"` is present

**Must verify (grep the source):**
- `d2c/src/app/(auth)/signup/page.tsx` — POST to `/api/auth/signup`
- `d2c/src/app/(auth)/reset-password/page.tsx` — POST to `/api/auth/reset-password`

If any fetch call is missing the header, add it before deploying the middleware change. The pattern to add is:
```typescript
headers: {
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",  // required by CSRF middleware
},
```

### Step 3: Update the auth route pass-through block to match

Lines 136-142 of `middleware.ts` also pass through `/api/auth/` without auth checks. This block controls session auth enforcement, not CSRF, and its exemption is correct (NextAuth routes must not require a session token). **Do not change this block** — the CSRF fix is isolated to the `isExempt` variable in the CSRF check section only.

```typescript
// This block is CORRECT and should NOT be changed:
if (
  normalizedPath.startsWith("/api/auth/") ||   // NextAuth session routes are public
  normalizedPath === "/api/stripe/webhook" ||
  normalizedPath === "/api/health"
) {
  return NextResponse.next();
}
```

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/middleware.ts` | Replace blanket `/api/auth/` CSRF exemption with explicit NextAuth-only allowlist (lines 121-124) |
| `d2c/src/app/(auth)/signup/page.tsx` | Add `X-Requested-With` header to fetch if missing |
| `d2c/src/app/(auth)/reset-password/page.tsx` | Add `X-Requested-With` header to fetch if missing |

## Environment / Config Changes

None. This is a pure code change with no env var, Docker, or infrastructure dependencies.

## Testing

**Manual verification (pre-deploy):**
1. From a browser, submit the forgot-password form — confirm the reset email is received (200 OK)
2. From a browser, submit the signup form — confirm account creation succeeds
3. From a browser, submit the reset-password form — confirm password update succeeds

**CSRF attack simulation (curl):**
```bash
# This should now return 403 instead of triggering an email
curl -s -X POST https://fbardirect.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@example.com"}' \
  | jq .

# Expected: {"error":"Missing CSRF header"}
# Before fix: {"message":"If an account exists..."}
```

**NextAuth callback must still work:**
```bash
# OAuth callback must NOT be blocked (it has no X-Requested-With header)
# Verify by completing a NextAuth OAuth flow end-to-end in staging
# The /api/auth/callback/* prefix must remain in the exempt list
```

**E2E tests:**
- Run `d2c/tests/e2e/antagonistic/t06-signup.spec.ts` — signup flow must pass
- Run the marketing test suite — no auth-related regressions

**Unit test (optional, for middleware logic):**
- Add a test asserting that `POST /api/auth/forgot-password` without `X-Requested-With` returns 403
- Add a test asserting that `POST /api/auth/callback/credentials` without `X-Requested-With` returns 200 (not blocked)

## Risks / Notes

- **NextAuth path enumeration:** The exempt prefix list (`/api/auth/callback`, `/api/auth/signin`, `/api/auth/signout`) covers all NextAuth POST routes used in the current credential + OAuth setup. If a new NextAuth provider is added that uses a different callback path, it must be added to `NEXTAUTH_EXEMPT_PREFIXES`. Review this list whenever NextAuth providers are added.
- **The auth pass-through block (lines 136-142) remains a blanket `/api/auth/` exemption** from session auth requirements. This is correct behavior — NextAuth's own routes must not require a session. The CSRF fix is orthogonal to this and does not touch session auth enforcement.
- **Rate limiting remains the primary mitigation** even after this fix. The CSRF fix is defense-in-depth. If the rate limiter is ever relaxed or moved to Redis with per-user rather than per-IP keys, revisit the security posture of the forgot-password endpoint more broadly.
- **No impact on existing sessions or cookies** — this middleware change only affects unauthenticated state-changing requests and takes effect immediately on the next deploy with no migration required.
- **Low deployment risk** — the legitimate forgot-password page already sends `X-Requested-With`, so no user-facing behavior changes as long as Step 2 verification confirms the same for signup and reset-password.
- **MFA routes (Gap #10):** When Gap #10 adds `/api/auth/mfa/*` routes, these are browser-called and should NOT be added to `NEXTAUTH_EXEMPT_PREFIXES`. They must require the `X-Requested-With` header like all other browser-called routes. Gap #10's implementation notes have been updated to ensure all MFA fetch calls include this header.
