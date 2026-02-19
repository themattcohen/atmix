# Gap #7: Open Redirect via `callbackUrl`

**Severity:** High
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

After a successful login, `LoginForm` in `login/page.tsx` calls `router.push(callbackUrl)` where `callbackUrl` is taken directly from the `?callbackUrl=` query parameter with no validation. An attacker can craft a phishing URL such as:

```
https://fbardirect.com/login?callbackUrl=https://evil.com
```

When a user logs in via that link, Next.js `router.push` will navigate to the external domain. The user's browser address bar changes to `evil.com` immediately after authentication, making this an effective phishing vector — especially against users who received the link by email and trust the fbardirect.com origin.

The attack is low-effort and the impact is high: users arrive at the login page already in an authenticated context mindset, making them far more susceptible to a cloned credential-harvesting page.

Additionally, a value beginning with `//` (e.g. `//evil.com/path`) is treated as a protocol-relative URL by browsers and will also redirect off-site.

## Current State

**File:** `d2c/src/app/(auth)/login/page.tsx`

Line 11 reads the parameter:
```ts
const callbackUrl = searchParams.get("callbackUrl") || "/threshold";
```

Line 32 uses it without any validation:
```ts
router.push(callbackUrl);
```

**Middleware context:** `d2c/src/middleware.ts` lines 160-163 sets `callbackUrl` to the `normalizedPath` (already normalized) when redirecting unauthenticated users to login:
```ts
const loginUrl = new URL("/login", req.url);
loginUrl.searchParams.set("callbackUrl", normalizedPath);
return NextResponse.redirect(loginUrl);
```

The middleware itself only ever injects a path (no scheme, no host), so legitimate system-generated `callbackUrl` values are always relative paths. An attacker must manually craft the URL; no code produces an external URL. This means validating the parameter in the login component is sufficient — no middleware change is needed.

## Implementation Plan

### Step 1: Add a validation helper in the login component

In `d2c/src/app/(auth)/login/page.tsx`, replace the bare `searchParams.get(...)` assignment with a validated read. The rule is: the URL must start with `/` and must not start with `//` (which would be protocol-relative and redirect off-site).

Replace lines 11 with:

```ts
const rawCallbackUrl = searchParams.get("callbackUrl") || "/threshold";
// Validate: must be a relative path starting with "/" but not "//" (protocol-relative)
const callbackUrl =
  rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
    ? rawCallbackUrl
    : "/threshold";
```

No other change is needed. Line 32 (`router.push(callbackUrl)`) remains unchanged.

### Step 2: (Optional hardening) Extract to a shared utility

If other pages in the app ever read `callbackUrl` from params (e.g. a signup page that also accepts a callback), extract the validation to a shared location to avoid repeating the logic.

Create `d2c/src/lib/safe-redirect.ts`:
```ts
/**
 * Returns the callbackUrl only if it is a safe relative path.
 * Rejects external URLs, protocol-relative URLs (//evil.com), and empty strings.
 */
export function safeCbUrl(raw: string | null, fallback = "/threshold"): string {
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}
```

Then in `login/page.tsx`:
```ts
import { safeCbUrl } from "@/lib/safe-redirect";
// ...
const callbackUrl = safeCbUrl(searchParams.get("callbackUrl"));
```

Step 2 is optional for this immediate fix but recommended before adding additional auth flows.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/app/(auth)/login/page.tsx` | Replace line 11 with validated `callbackUrl` assignment (Step 1) |
| `d2c/src/lib/safe-redirect.ts` | Create shared `safeCbUrl` utility (Step 2, optional) |

## Environment / Config Changes

None. This is a pure code change with no environment variables, database migrations, or infrastructure changes required.

## Testing

### Manual verification (open redirect blocked)

1. Start the dev server: `npm run dev` in `d2c/`
2. Visit `http://localhost:3001/login?callbackUrl=https://evil.com` and log in
3. Expected: redirected to `/threshold`, not `evil.com`
4. Visit `http://localhost:3001/login?callbackUrl=//evil.com/path` and log in
5. Expected: redirected to `/threshold`, not `evil.com`

### Manual verification (legitimate callbackUrl preserved)

1. Visit a protected route while unauthenticated, e.g. `/dashboard`
2. Middleware redirects to `/login?callbackUrl=/dashboard`
3. Log in
4. Expected: redirected to `/dashboard` (not forced to `/threshold`)

### Unit test (if `safe-redirect.ts` utility is extracted)

```ts
import { safeCbUrl } from "@/lib/safe-redirect";

describe("safeCbUrl", () => {
  it("allows simple relative paths", () => {
    expect(safeCbUrl("/dashboard")).toBe("/dashboard");
  });
  it("allows nested relative paths", () => {
    expect(safeCbUrl("/accounts/123")).toBe("/accounts/123");
  });
  it("rejects external URLs", () => {
    expect(safeCbUrl("https://evil.com")).toBe("/threshold");
  });
  it("rejects protocol-relative URLs", () => {
    expect(safeCbUrl("//evil.com/path")).toBe("/threshold");
  });
  it("returns fallback on null", () => {
    expect(safeCbUrl(null)).toBe("/threshold");
  });
  it("returns custom fallback", () => {
    expect(safeCbUrl(null, "/login")).toBe("/login");
  });
});
```

### E2E test addition

Add a test case to `d2c/tests/e2e/antagonistic/t06-signup.spec.ts` or a new `t07-auth-security.spec.ts`:

```ts
test("login blocks open redirect via callbackUrl", async ({ page }) => {
  await page.goto("/login?callbackUrl=https://evil.com");
  await page.fill('[type=email]', testUser.email);
  await page.fill('[type=password]', testUser.password);
  await page.click('[type=submit]');
  await page.waitForURL(/\/threshold/);
  expect(page.url()).not.toContain("evil.com");
});
```

## Risks / Notes

- **Regression risk is near-zero.** The middleware only ever sets `callbackUrl` to a `normalizedPath` (a relative path beginning with `/` but never `//`), so all legitimate redirect flows will pass the new validation unchanged.
- **`/threshold` as fallback**: The default already in the code is `/threshold`. Keep that as the fallback in the fix to maintain existing behavior for users who navigate directly to `/login` without a `callbackUrl` param.
- **Fragment and query strings in callbackUrl**: Paths like `/dashboard?tab=accounts` start with `/` and are not `//`-prefixed, so they will pass the check. This is correct behavior.
- **NextAuth's own `callbackUrl`**: The `signIn("credentials", { redirect: false })` call does not use this query param; only `router.push(callbackUrl)` at line 32 does. There is no interaction with NextAuth's built-in callback URL handling here.
