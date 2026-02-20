# Sprint 5: Expanded Design — Audit Fixes + Pre-Launch Polish

## Created: 2026-02-19 | Status: DESIGN ONLY (not yet implemented)

## Context

Sprints 1-4 are committed (`aaec670`). The `/sc:analyze` quality audit found additional issues beyond the original Sprint 5 scope. This document merges the original Sprint 5 items with newly discovered audit findings into one comprehensive sprint.

### Source Documents
- Original Sprint 5: `d2c-audit-fix-plan-2026-02-19.md` (items 32-37)
- Source code audit: 3 parallel analysis agents (quality, test, security)
- Code verified: all source files read fresh before design

---

## Triage Summary

| Category | Count | Action |
|----------|-------|--------|
| Real bugs / security gaps | 12 | FIX in this sprint |
| Test hygiene | 1 item (~25 test conversions) | FIX in this sprint |
| Still deferred | 2 | DEFER (too complex for pre-launch) |
| False positive (already fixed) | 1 | DROPPED |

**Dropped — Open Redirect (false positive):**
The login page (`(auth)/login/page.tsx:11-14`) already validates `callbackUrl`:
```typescript
const callbackUrl = (rawCallback.startsWith("/") && !rawCallback.startsWith("//"))
  ? rawCallback : "/threshold";
```
E2E tests in `auth.spec.ts:363-392` confirm external/protocol-relative redirects are blocked. Not a real issue.

**Still Deferred:**
- Item 32: MFA login enforcement — requires new `/mfa-verify` page, auth flow changes, session splitting. High complexity, high risk. Not needed pre-launch with zero users.
- Item 35: CSP nonce — requires per-request nonce generation in middleware, plumbing through all script tags, testing every page. Half-day effort minimum. `unsafe-inline` is acceptable for pre-launch MVP.

---

## All Items (14 active + 2 deferred)

### HIGH Severity

| # | What | File(s) | Current Code | Required Change |
|---|------|---------|-------------|-----------------|
| S5-3 | Sign route allows IN_PROGRESS | `filing/sign/route.ts:46` | `!["IN_PROGRESS", "REVIEWED"].includes(status)` | Change to `filingYear.status !== "REVIEWED"` — users must review data before signing |
| S5-5 | MFA secret stored in plaintext | `mfa/setup/route.ts:29`, `mfa/verify/route.ts:25`, `mfa/disable/route.ts:29,33` | `data: { mfaSecret: secret }` raw plaintext | Encrypt with `encrypt()` on store, `decrypt()` on read. Import from `@/lib/encryption`. |
| S5-8 | No TOTP brute-force protection | `mfa/verify/route.ts` | No rate limit on verify attempts | Add per-userId rate limit (5 attempts per 5 min). In-memory Map like middleware.ts pattern. |
| 33-A | MFA paths missing from rate limit | `middleware.ts:44-48` | `AUTH_RATE_LIMIT_PATHS` missing MFA routes | Add `/api/auth/mfa/verify` and `/api/auth/mfa/recovery` to the array |
| S5-1 | Blog XSS via dangerouslySetInnerHTML | `blog/[slug]/page.tsx:82`, `lib/blog.ts:37` | `<div dangerouslySetInnerHTML={{ __html: post.content }} />` where `post.content` is raw MDX text | Sanitize content before rendering. See detailed design below. |

### MEDIUM Severity

| # | What | File(s) | Current Code | Required Change |
|---|------|---------|-------------|-----------------|
| 33-B | MFA setup called twice creates duplicate state | `mfa/setup/route.ts:18-20` | Only checks `if (user.mfaEnabled)` | Add: `if (user.mfaSecret && !user.mfaEnabled) return 409` — setup already in progress |
| 33-C | Recovery code race condition | `mfa/recovery/route.ts:27-39` | `findFirst` then separate `update` — TOCTOU race | Replace with atomic `updateMany({where: {id: recoveryCode.id, used: false}, data: {used: true}})` + check `count === 0` |
| 34 | Sentry missing scrubPii on client+edge | `sentry.client.config.ts`, `sentry.edge.config.ts` | No `beforeSend` hook | Add `beforeSend: scrubPii` (import from `./src/lib/sentry`). Add `*.ingest.sentry.io` to CSP `connect-src` in `next.config.js`. |
| S5-4 | User PUT uses wrong validation schema | `user/route.ts:75` | `personalInfoSchema.safeParse(body)` | Change to `personalInfoUpdateSchema` — TIN should be optional on updates (user may update name without re-entering SSN) |
| S5-6 | Session maxAge 7 days too long | `auth.ts:63` | `maxAge: 7 * 24 * 60 * 60` (7 days) | Change to `24 * 60 * 60` (24 hours). Financial app with SSN/bank data should not hold sessions for a week. |
| 36 | No startup validation | No `instrumentation.ts` | Nothing | Create `src/instrumentation.ts` with Next.js `register()` hook. Validate required env vars, warn for optional ones. |

### LOW Severity

| # | What | File(s) | Current Code | Required Change |
|---|------|---------|-------------|-----------------|
| 37 | Excel extraction unbounded rows | `extraction.ts:69-77` | No row limit — 100K-row Excel sheet becomes a massive prompt | Add `MAX_EXCEL_ROWS = 5000` counter. If exceeded, truncate and append `[Truncated: X rows omitted]` |
| S5-7 | 25 test stubs report as passing | `submission-cron.test.ts` (18), `mfa.spec.ts` (7) | `expect(true).toBe(true)` | Convert all to `it.skip(...)` or `it.todo(...)` so they show as SKIPPED in CI, not PASSED |

---

## Detailed Designs

### S5-1: Blog XSS Sanitization

**Current state:** `blog.ts` reads `.mdx` files via `gray-matter`, returns raw content string. `blog/[slug]/page.tsx` renders it via `dangerouslySetInnerHTML`. Raw MDX can contain arbitrary HTML/JSX including `<script>` tags, `onclick` handlers, etc.

**Approach:** Sanitize at read time in `blog.ts` using a simple HTML sanitizer. Since the blog content is static (build-time SSG), performance is not a concern.

**Option chosen: sanitize-html** (most popular, ~15M weekly downloads, purpose-built for this exact use case)

```
npm install sanitize-html && npm install -D @types/sanitize-html
```

**Change in `lib/blog.ts:37`:**
```typescript
import sanitizeHtml from 'sanitize-html';

// In getBlogPost():
return { meta: { slug, ...data } as BlogPost, content: sanitizeHtml(content, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height'],
  },
  // Strip all scripts, event handlers, iframes, etc.
}) };
```

**No change needed in page.tsx** — the sanitized HTML is safe for `dangerouslySetInnerHTML`.

**Risk:** If blog posts use advanced MDX features (JSX components, imports), those will be stripped. Currently the blog just uses basic markdown/HTML, so this is fine. The comment in `page.tsx:81` says "MDX content will be rendered here in the future" — when proper MDX compilation is added, this sanitization should be revisited.

---

### S5-5: Encrypt MFA Secret at Rest

**Current state:** `mfaSecret` is stored as plaintext TOTP secret in the `User` table. The same encryption functions used for TIN (`encrypt`/`decrypt` from `lib/encryption.ts`) should be used.

**Changes:**

1. **mfa/setup/route.ts:29** — encrypt before storing:
```typescript
import { encrypt } from "@/lib/encryption";
// ...
data: { mfaSecret: encrypt(secret), mfaEnabled: false },
```

2. **mfa/verify/route.ts:25,29** — decrypt before verifying:
```typescript
import { decrypt } from "@/lib/encryption";
// ...
if (!user?.mfaSecret) { ... }
const decryptedSecret = decrypt(user.mfaSecret);
const isValid = verifyTotp(decryptedSecret, parsed.data.token);
```

3. **mfa/disable/route.ts:29,33** — same pattern:
```typescript
import { decrypt } from "@/lib/encryption";
// ...
const decryptedSecret = decrypt(user.mfaSecret);
const isValid = verifyTotp(decryptedSecret, parsed.data.token);
```

**No migration needed** — pre-launch, zero users. Any test fixtures with plaintext secrets will need to use encrypted values, or tests need to mock `decrypt`.

---

### S5-8: TOTP Per-User Rate Limit

**Current state:** `mfa/verify/route.ts` has zero rate limiting per user. An attacker with a stolen session token can brute-force 6-digit TOTP codes (10^6 possibilities, ~30s windows).

**Design:** Add a per-userId rate limit directly in the verify route (simpler than modifying middleware for user-scoped limits):

```typescript
const totpAttempts = new Map<string, { count: number; resetTime: number }>();

function checkTotpRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = totpAttempts.get(userId);
  if (!entry || now > entry.resetTime) {
    totpAttempts.set(userId, { count: 1, resetTime: now + 5 * 60_000 }); // 5 min window
    return true;
  }
  if (entry.count >= 5) return false; // max 5 attempts per 5 min
  entry.count++;
  return true;
}
```

Called before TOTP verification. Returns 429 if exceeded.

**Note:** This is in addition to item 33-A which adds IP-based rate limiting on MFA paths via middleware. This adds user-scoped protection.

---

### 33-C: Atomic Recovery Code

**Current state (race condition):**
```typescript
// Step 1: find
const recoveryCode = await prisma.mfaRecoveryCode.findFirst({
  where: { userId, codeHash },
});
// Step 2: check
if (recoveryCode.used) return 400;
// Step 3: mark used — BUT another request could have used it between step 1 and 3
await prisma.mfaRecoveryCode.update({
  where: { id: recoveryCode.id },
  data: { used: true, usedAt: new Date() },
});
```

**Fix — single atomic operation:**
```typescript
const codeHash = hashRecoveryCode(parsed.data.code);
const result = await prisma.mfaRecoveryCode.updateMany({
  where: { userId: session.user.id, codeHash, used: false },
  data: { used: true, usedAt: new Date() },
});
if (result.count === 0) {
  return NextResponse.json({ error: "Invalid or already used recovery code" }, { status: 400 });
}
return NextResponse.json({ success: true });
```

No TOCTOU race — `updateMany` with `used: false` in the WHERE clause is atomic.

---

### 36: Startup Validation (instrumentation.ts)

**Create `src/instrumentation.ts`** — Next.js 14 `register()` hook runs once on server startup:

```typescript
export async function register() {
  // Required for core functionality
  const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[STARTUP] FATAL: Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Required for features (warn if missing)
  const featureVars = {
    'ANTHROPIC_API_KEY': 'Document extraction',
    'STRIPE_SECRET_KEY': 'Payment processing',
    'STRIPE_WEBHOOK_SECRET': 'Payment webhooks',
    'RESEND_API_KEY': 'Email sending',
    'ENCRYPTION_KEY': 'Data encryption',
  };
  for (const [key, feature] of Object.entries(featureVars)) {
    if (!process.env[key]) {
      console.warn(`[STARTUP] WARNING: ${key} not set — ${feature} will be disabled`);
    }
  }

  // Optional (informational)
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn('[STARTUP] INFO: Sentry DSN not configured — error tracking disabled');
  }

  // S3/MinIO configuration check
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY) {
    console.warn('[STARTUP] WARNING: S3/MinIO not configured — file uploads will fail');
  }

  console.log('[STARTUP] Configuration validated successfully');
}
```

---

### 34: Sentry scrubPii on Client + Edge

**sentry.client.config.ts** — add scrubPii:
```typescript
import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "./src/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    return scrubPii(event as unknown as Parameters<typeof scrubPii>[0]) as unknown as typeof event;
  },
});
```

**sentry.edge.config.ts** — same pattern:
```typescript
import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "./src/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    return scrubPii(event as unknown as Parameters<typeof scrubPii>[0]) as unknown as typeof event;
  },
});
```

**next.config.js CSP** — add Sentry ingest domain to `connect-src`:
```
connect-src 'self' https://www.google-analytics.com ... https://*.ingest.sentry.io;
```

**Risk:** The `import { scrubPii }` path in client/edge configs may need adjustment. The sentry configs are at project root, so `./src/lib/sentry` should resolve correctly (server config already uses this pattern successfully).

---

## Agent Assignment (4 parallel agents)

### Agent S5-A: MFA Hardening (items 33-A, 33-B, 33-C, S5-5, S5-8)

| File | Items | Change Summary |
|------|-------|----------------|
| `middleware.ts` | 33-A | Add 2 paths to `AUTH_RATE_LIMIT_PATHS` array |
| `mfa/setup/route.ts` | 33-B, S5-5 | Add double-call guard (409 if mfaSecret exists & !mfaEnabled). Encrypt secret before storing. |
| `mfa/recovery/route.ts` | 33-C | Replace findFirst+update with atomic updateMany. Remove `used` check (handled by WHERE clause). |
| `mfa/verify/route.ts` | S5-5, S5-8 | Decrypt mfaSecret before verifyTotp. Add per-userId rate limit (5/5min). |
| `mfa/disable/route.ts` | S5-5 | Decrypt mfaSecret before verifyTotp. |

**Tests to update:** `tests/api/mfa.test.ts` — mock `encrypt`/`decrypt` for MFA secret tests. Add test for 409 on double setup. Add test for TOTP rate limit.

### Agent S5-B: Sentry + Infrastructure (items 34, 36)

| File | Items | Change Summary |
|------|-------|----------------|
| `sentry.client.config.ts` | 34 | Add `import { scrubPii }` + `beforeSend` hook |
| `sentry.edge.config.ts` | 34 | Same as client |
| `next.config.js` | 34 | Add `https://*.ingest.sentry.io` to CSP `connect-src` |
| `src/instrumentation.ts` (NEW) | 36 | Create with `register()` function validating env vars |

**Tests:** `tests/api/sentry-scrub.test.ts` already covers scrubPii logic. Add test for `instrumentation.ts` register function (mock process.env, verify console output).

### Agent S5-C: Route Fixes + Session (items S5-3, S5-4, S5-6, 37)

| File | Items | Change Summary |
|------|-------|----------------|
| `filing/sign/route.ts` | S5-3 | Line 46: change `["IN_PROGRESS", "REVIEWED"].includes(...)` to `filingYear.status !== "REVIEWED"` |
| `user/route.ts` | S5-4 | Line 75: change `personalInfoSchema` to `personalInfoUpdateSchema` |
| `auth.ts` | S5-6 | Line 63: change `7 * 24 * 60 * 60` to `24 * 60 * 60` |
| `extraction.ts` | 37 | Add `MAX_EXCEL_ROWS = 5000` constant. Add row counter in `convertExcelToText`. Truncate with message if exceeded. |

**Tests:** Update `filing-review.test.ts` or add sign-specific tests for REVIEWED-only guard. Test extraction row limit in `extraction-exceljs.test.ts`.

### Agent S5-D: Blog XSS + Test Cleanup (items S5-1, S5-7)

| File | Items | Change Summary |
|------|-------|----------------|
| `src/lib/blog.ts` | S5-1 | `npm install sanitize-html @types/sanitize-html`. Sanitize content in `getBlogPost()` before returning. |
| `src/app/(marketing)/blog/[slug]/page.tsx` | S5-1 | No code change needed (sanitization at read time). Add comment noting content is pre-sanitized. |
| `tests/api/submission-cron.test.ts` | S5-7 | Convert all 18 `expect(true).toBe(true)` to `it.skip("reason")` |
| `tests/e2e/mfa.spec.ts` | S5-7 | Convert all 7 `expect(true).toBe(true)` to `test.skip("reason")` (Playwright syntax) |

**Dependencies:** `npm install sanitize-html` + `npm install -D @types/sanitize-html` in `d2c/`.

---

## File Ownership Verification (ZERO OVERLAP)

```
S5-A: middleware.ts, mfa/setup/route.ts, mfa/recovery/route.ts, mfa/verify/route.ts, mfa/disable/route.ts
S5-B: sentry.client.config.ts, sentry.edge.config.ts, next.config.js, src/instrumentation.ts
S5-C: filing/sign/route.ts, user/route.ts, auth.ts, extraction.ts
S5-D: lib/blog.ts, blog/[slug]/page.tsx, submission-cron.test.ts, mfa.spec.ts
```

No file appears in more than one agent. VERIFIED.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| S5-5: Encrypting mfaSecret changes storage format | Pre-launch = zero users. No migration needed. Tests must mock or use encrypted values. |
| S5-1: sanitize-html strips MDX features | Blog only uses basic HTML currently. Comment in code: "revisit when proper MDX compilation is added". |
| S5-6: Session maxAge 24h logs out active users | Pre-launch = zero users. No impact. |
| 34: scrubPii import path from root-level sentry configs | Server config already uses `./src/lib/sentry` successfully. Same pattern. |
| 33-C: Removing findFirst changes error message | Old: separate "Invalid" vs "Already used". New: single "Invalid or already used". Acceptable. |
| S5-8: In-memory rate limit not shared across workers | Single-instance VPS deployment. One worker process. Fine for MVP. |

---

## Verification Checklist (post-sprint)

1. `cd d2c && npx vitest run` — all tests pass, no `expect(true).toBe(true)` remaining
2. `npx tsc --noEmit` — zero type errors in source files
3. `grep -r "expect(true)" tests/` — returns 0 results
4. Manual: confirm `sentry.client.config.ts` and `sentry.edge.config.ts` both import scrubPii
5. Manual: confirm `middleware.ts` AUTH_RATE_LIMIT_PATHS includes MFA verify + recovery
6. Manual: confirm `filing/sign/route.ts` only allows REVIEWED status

---

## Execution

4 parallel sonnet subagents, strict file ownership. Each agent:
1. Reads current file(s)
2. Makes the specified changes
3. Updates/creates relevant tests
4. Runs `npx vitest run` on affected test files
5. Reports completion

Estimated total: ~2 hours with 4 parallel agents.

---

## Items NOT in Sprint 5 (deferred to post-launch)

| # | What | Why Deferred |
|---|------|-------------|
| 32 | MFA login enforcement | Requires new page, auth flow changes, session splitting. ~8 hours effort. Not needed with zero users. |
| 35 | CSP nonce (replace unsafe-inline) | Requires per-request nonce generation, plumbing through all script tags. ~4 hours. Low risk with current CSP. |
| — | Unit tests for stripe/checkout, stripe/verify-session, user routes | These routes are exercised by E2E tests. Unit tests are nice-to-have, not blocking. |
| — | submission-cron route implementation (Phase 4) | BLOCKED on B2B architecture decisions. Cannot implement until Phase 4 is unblocked. |
