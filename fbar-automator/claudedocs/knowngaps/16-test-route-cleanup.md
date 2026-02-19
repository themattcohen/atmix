# Gap #16: Test Route in Production Codebase

**Severity:** Medium
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

A test-only API route (`/api/test/reset-lockout`) exists in the production source tree. It resets a user's account lockout state by zeroing `failedLoginAttempts` and clearing `lockoutUntil` directly via Prisma — bypassing all authentication and authorization. The only guard is a runtime `NODE_ENV === "production"` check that returns a 404.

This approach has two deficiencies:

1. **Attack surface exists at the source level.** The route is compiled into the production Docker image. A misconfigured environment variable, a staging server with `NODE_ENV` accidentally unset, or a future code change that removes the guard would expose an unauthenticated endpoint capable of clearing account lockouts for any email address.

2. **It violates separation of test and production code.** Test helpers should never ship in the production bundle. The guard is a workaround, not a proper solution.

## Current State

**Route file:** `d2c/src/app/api/test/reset-lockout/route.ts` (17 lines total)

```ts
// lines 1-16
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {        // line 5 — runtime guard only
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email } = await req.json();
  await prisma.user.updateMany({
    where: { email },
    data: { failedLoginAttempts: 0, lockoutUntil: null },
  });

  return NextResponse.json({ ok: true });
}
```

**Callers (test code only):**

| File | Lines | Usage |
|---|---|---|
| `d2c/tests/e2e/helpers/auth.ts` | 144-152 | `resetLockout()` helper — POSTs to `/api/test/reset-lockout` |
| `d2c/tests/e2e/antagonistic/t07-login-logout.spec.ts` | 64, 231 | Calls the endpoint directly before login attempts to clear lockout state |

All callers are under `d2c/tests/` — no production application code calls this route.

## Implementation Plan

### Step 1: Delete the route file

Delete the entire directory `d2c/src/app/api/test/reset-lockout/` and its contents.

```
d2c/src/app/api/test/reset-lockout/route.ts  ← DELETE
```

If `d2c/src/app/api/test/` contains no other files after deletion, delete that directory too. Verify:

```bash
ls d2c/src/app/api/test/
```

If empty, `rmdir d2c/src/app/api/test/` as well.

### Step 2: Replace the HTTP call in the Playwright test helper with a direct Prisma reset

The `resetLockout()` function in `d2c/tests/e2e/helpers/auth.ts` (lines 144-152) must be rewritten to reset lockout state without going through the HTTP API. In E2E test environments, this is best done via a direct database call or a test-scoped Prisma client.

**New implementation for `resetLockout()` in `d2c/tests/e2e/helpers/auth.ts`:**

```ts
import { PrismaClient } from "@prisma/client";

const testPrisma = new PrismaClient();

/**
 * Reset lockout state for a test user directly via Prisma.
 * No HTTP route required — test-only utility.
 */
export async function resetLockout(
  _request: import("@playwright/test").APIRequestContext,  // kept for signature compat
  email = "debug@example.com"
) {
  await testPrisma.user.updateMany({
    where: { email },
    data: { failedLoginAttempts: 0, lockoutUntil: null },
  });
}
```

The `_request` parameter is kept to avoid changing all call sites in `t07-login-logout.spec.ts`, but it is unused. Alternatively, remove the parameter and update all call sites (three locations) to drop the argument — this is the cleaner option.

**Call sites in `t07-login-logout.spec.ts` (lines 64 and 231):** These call `page.request.post(...)` directly rather than using the `resetLockout()` helper. Replace both with `await resetLockout(email)` (importing the updated helper) so that all lockout resets go through one place.

Before (lines 64-67):
```ts
await page.request.post("http://localhost:3001/api/test/reset-lockout", {
  headers: { "x-requested-with": "playwright" },
  data: { email: "debug@example.com" },
});
```

After:
```ts
await resetLockout("debug@example.com");
```

Apply the same replacement at line 231.

### Step 3: Ensure the Prisma client connects to the correct test database

The direct Prisma call in the test helper will use `DATABASE_URL` from the environment. Verify that Playwright's test environment (`.env.test` or Playwright config's `env` block) sets `DATABASE_URL` pointing to the local test Postgres instance — the same one the D2C app uses in tests. No change should be required if this is already configured, but confirm before running tests.

### Step 4: Run the antagonistic test suite to verify

```bash
export PATH="/private/tmp/node-v22.13.1-darwin-x64/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd d2c
npx playwright test tests/e2e/antagonistic/t07-login-logout.spec.ts --workers=1
```

All login/lockout tests should pass without the HTTP route.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/app/api/test/reset-lockout/route.ts` | Delete entirely |
| `d2c/src/app/api/test/` (directory) | Delete if empty after above |
| `d2c/tests/e2e/helpers/auth.ts` | Replace HTTP POST in `resetLockout()` with direct Prisma call |
| `d2c/tests/e2e/antagonistic/t07-login-logout.spec.ts` | Replace two inline `page.request.post(...)` calls with `resetLockout()` helper call |

## Environment / Config Changes

None. No `.env`, `docker-compose`, or infrastructure changes are required. The Prisma client in the test helper picks up `DATABASE_URL` from the existing test environment.

## Testing

1. **Verify route is gone from the build:** After deletion, `npx next build` (with dummy env vars as per B2B pattern) should complete without errors — there is no 404-by-convention for deleted Next.js routes.

2. **Confirm route returns 404 in dev:** Start the dev server and confirm `POST http://localhost:3001/api/test/reset-lockout` returns a 404 (Next.js default for unknown routes).

3. **Run the full antagonistic login/lockout test file:**
   ```bash
   npx playwright test tests/e2e/antagonistic/t07-login-logout.spec.ts --workers=1
   ```
   All tests should pass via the direct Prisma reset path.

4. **Run the full E2E suite to check for regressions:**
   ```bash
   npx playwright test --workers=1
   ```
   121/121 tests should still pass.

## Risks / Notes

- **Signature change to `resetLockout()`:** The current signature accepts an `APIRequestContext` as the first argument. If the parameter is removed, all three call sites must be updated. Keeping the parameter as `_request` (unused) avoids touching call sites but leaves a confusing dead parameter. Prefer removing it cleanly and updating all call sites — it is a small, contained change.

- **Prisma client in test process:** Instantiating `new PrismaClient()` inside the test helper is fine for E2E tests. If connection pool exhaustion becomes an issue under parallel test workers, make the client a module-level singleton (already shown in the pseudocode above).

- **No other test routes detected:** `d2c/src/app/api/test/` contains only `reset-lockout/route.ts`. If future test routes are added, they must follow this same pattern — live in test helpers, not in the production source tree.

- **Docker image size:** Removing the file marginally reduces the production image, which matters slightly on the 1.9 GB RAM Hetzner server.
