# D2C FBAR Direct -- Comprehensive Implementation Plan

**Date:** 2026-02-19
**Scope:** All work required to bring `fbar-automator/d2c/` to production readiness
**Stack:** Next.js 14, NextAuth 5 beta, Prisma/Postgres, Stripe, S3/MinIO, Claude AI extraction, SDTM/SFTP for FinCEN submission
**Infrastructure:** Single Hetzner VPS (1.9 GB RAM, no swap currently), Caddy reverse proxy, Docker Compose
**Sources:** 22 existing known gaps (`claudedocs/knowngaps/01-22`), security audit (`d2c-security-audit-2026-02-19.md`), backend/frontend/infrastructure analysis

---

## Table of Contents

1. [Overview and Methodology](#overview-and-methodology)
2. [Phase 0: Emergency Fixes](#phase-0-emergency-fixes)
3. [Phase 1: Quick Wins](#phase-1-quick-wins)
4. [Phase 2: Filing Pipeline Fix](#phase-2-filing-pipeline-fix)
5. [Phase 3: Infrastructure and Configuration](#phase-3-infrastructure-and-configuration)
6. [Phase 4: Filing Pipeline Core](#phase-4-filing-pipeline-core)
7. [Phase 5: Security Hardening](#phase-5-security-hardening)
8. [Phase 6: CI/CD and Monitoring](#phase-6-cicd-and-monitoring)
9. [Phase 7: Low Priority / Post-Launch](#phase-7-low-priority--post-launch)
10. [Dependency Graph](#dependency-graph)
11. [File Ownership Map](#file-ownership-map)
12. [Agent Assignment Strategy](#agent-assignment-strategy)
13. [Effort Summary](#effort-summary)

---

## Overview and Methodology

This plan consolidates 56 tasks across 8 phases, covering:

- 22 previously documented known gaps (with detailed implementation docs in `claudedocs/knowngaps/01-22`)
- 18 new findings from the security audit (`d2c-security-audit-2026-02-19.md`)
- ~16 additional findings from backend, frontend, and infrastructure analysis

Every task specifies: what code changes are needed (file paths, modifications), order of operations (dependencies), which Claude Code agent type should execute it, estimated effort, and files touched for conflict detection.

**Key constraint:** The Hetzner VPS has only 1.9 GB RAM and no swap. Docker images must be built one at a time. All infrastructure tasks must account for this memory limitation.

**PARTIALLY BLOCKED: Phase 4 (Filing Pipeline Core).** P4-2 (FinCEN XML) is DONE (2026-02-21). P4-1 (Treasury rates) and P4-3 (submission architecture) remain blocked. Do NOT import anything from `src/` (B2B codebase) unless explicitly porting an approved module.

**MANDATORY: Testing Requirements for Every Task**

Every implementation agent MUST follow this testing protocol:

1. **Before starting:** Run the existing test suite (`npx playwright test` from `d2c/`) to establish baseline. Note any pre-existing failures.
2. **During implementation:** Write tests for the changes being made. Tests go in the appropriate location:
   - API route changes → `tests/api/<route-name>.test.ts` (new API test files as needed)
   - Frontend behavior changes → Add cases to existing E2E spec or create new spec in `tests/e2e/`
   - Accessibility changes → Add assertions to `tests/e2e/accessibility.spec.ts`
3. **After implementation:** Run the full test suite again. Fix any regressions introduced by the changes.
4. **Deliverable:** The task is NOT complete until tests pass. If a test cannot be written (e.g., VPS-only ops), document why in a comment.

**Known test dependencies to be aware of:**
- `auth.spec.ts` uses `resetLockout()` helper which calls `POST /api/test/reset-lockout` — P0-2 deletes this route, so the helper MUST be updated simultaneously (use direct Prisma call or new debug-only mechanism)
- `t12-review-sign.spec.ts` covers the full review→sign→payment flow — P2-1 changes this flow, so t12 MUST be updated
- `accessibility.spec.ts` has `role="alert"` check that currently only WARNS — P0-8 must convert this to a hard ASSERT
- All axe tests disable color-contrast — P7-5 and P7-9 will address this later

**Reference documents:**
- `claudedocs/knowngaps/00-implementation-order.md` -- Original sequencing for the 22 gaps
- `claudedocs/d2c-security-audit-2026-02-19.md` -- Security findings C-01 through L-04
- `claudedocs/d2c-fbar-filing-compliance.md` -- Regulatory requirements and FinCEN registration steps
- `claudedocs/knowngaps/01-22/` -- Individual gap implementation plans

---

## Phase 0: Emergency Fixes — DONE (6/8 tasks; P0-5 swap + P0-6 monitoring deferred)

**Total effort:** ~1.5 hours | **Wall clock:** ~30 min (full parallel)
All tasks are independent. Do these before any feature work.

| ID | Task | Agent | Effort | Files | Source |
|----|------|-------|--------|-------|--------|
| P0-1 | Bump Next.js 14.2.21 to 14.2.35 (CVE-2025-55184) | general-purpose | 15 min | `d2c/package.json`, `d2c/package-lock.json` | Gap #4 |
| P0-2 | Delete test route `/api/test/reset-lockout/` | general-purpose | 5 min | Delete `d2c/src/app/api/test/reset-lockout/route.ts`, update test helpers | Gap #16, L-04 |
| P0-3 | Delete deprecated X-XSS-Protection header | general-purpose | 5 min | `Caddyfile.prod` line 87 | Gap #21 |
| P0-4 | Fix open redirect in login callbackUrl | general-purpose | 30 min | `d2c/src/app/(auth)/login/page.tsx` | Gap #7, C-02 |
| P0-5 | Add 2 GB swap to VPS | Bash | 5 min | VPS-level: `fallocate`, `mkswap`, `swapon`, `/etc/fstab` | Infra |
| P0-6 | Add external uptime monitoring | Bash | 10 min | UptimeRobot free tier on `https://fbardirect.com/api/health` | Infra |
| P0-7 | Fix Stripe webhook status guard | general-purpose | 15 min | `d2c/src/app/api/stripe/webhook/route.ts:55-58` | BE |
| P0-8 | Add `role="alert"` to auth error divs | general-purpose | 15 min | `d2c/src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx` | FE a11y |

### Phase 0 Testing Requirements

Each agent MUST run `npx playwright test tests/e2e/auth.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/marketing.spec.ts` after completing their tasks.

| Task | Test Action Required |
|------|---------------------|
| P0-1 | Run `npm run build` to verify Next.js 14.2.35 compiles. Run full E2E suite to confirm no regressions. |
| P0-2 | **CRITICAL:** Update `tests/e2e/helpers/auth.ts` — the `resetLockout()` function calls the route being deleted. Replace with direct Prisma call via a new `scripts/reset-lockout.ts` CLI script, or replace with a seeded test user that never locks out. Then run `auth.spec.ts` — every login test depends on this helper. |
| P0-3 | No test needed (Caddyfile change, not testable from Playwright). |
| P0-4 | **Write new test** in `auth.spec.ts` under "Auth Redirects": test that `login?callbackUrl=https://evil.com` redirects to `/threshold` (not evil.com) after login. Test that `callbackUrl=//evil.com` is also blocked. Test that `callbackUrl=/dashboard` still works. |
| P0-5 | No test (VPS ops). |
| P0-6 | No test (external service). |
| P0-7 | **Write new test** in `tests/api/webhook-guard.test.ts`: mock a Stripe webhook event with `payment_status !== "paid"` and verify the filing status does NOT transition to PAID. Also test that `IN_PROGRESS` status is rejected (only `SIGNED` allowed). |
| P0-8 | **Update existing test** in `accessibility.spec.ts` "Error Messages Accessibility" section: convert the `console.warn` at line 221-226 to a hard `expect(isAnnounced).toBeTruthy()` assertion. The fix (adding `role="alert"`) must make this test pass. |

**P0-4 detail:** At line 11 where `callbackUrl` is extracted from `searchParams`, add validation:
```typescript
const rawCallback = searchParams.get("callbackUrl") || "/threshold";
const callbackUrl = (rawCallback.startsWith("/") && !rawCallback.startsWith("//"))
  ? rawCallback
  : "/threshold";
```
This blocks `callbackUrl=https://evil.com` and `callbackUrl=//evil.com` from redirecting to external sites after login.

**P0-7 detail:** Tighten the `checkout.session.completed` handler to only transition filing to PAID when `payment_status === "paid"`, not when `payment_status === "unpaid"` (payment methods that confirm asynchronously).

**P0-8 detail:** Add `role="alert"` and `aria-live="polite"` to error message containers in all three auth pages. This ensures screen readers announce validation errors when they appear.

---

## Phase 1: Quick Wins — DONE (committed in Sprints 2-4, 2026-02-19)

**Total effort:** ~5 hours | **Wall clock:** ~1 hour (6 parallel agent groups)
Small independent fixes. All parallelizable when grouped by file ownership.

| ID | Task | Agent | Effort | Files | Source |
|----|------|-------|--------|-------|--------|
| P1-1 | Add Zod validation to forgot-password route | general-purpose | 20 min | `d2c/src/app/api/auth/forgot-password/route.ts` | H-01, M-05 |
| P1-2 | Fix parseInt NaN guard on calendarYear param | general-purpose | 10 min | `d2c/src/app/api/accounts/route.ts:21` | BE-6.1 |
| P1-3 | Wrap `req.json()` in try/catch (3 routes) | general-purpose | 20 min | `filing/route.ts`, `filing/tier/route.ts`, `sdtm/submit/route.ts` | BE-6.2 |
| P1-4 | Add SFTP readyTimeout: 10000 | general-purpose | 10 min | `d2c/src/lib/sdtm.ts:20-46` | BE-4.3 |
| P1-5 | Fix SFTP readFileSync crash path + add status revert in outer catch | general-purpose | 30 min | `d2c/src/lib/sdtm.ts:28-30`, `sdtm/submit/route.ts:120` | BE-4.2, H-02 |
| P1-6 | Add XML validation gate before SFTP transmission | general-purpose | 30 min | `d2c/src/app/api/sdtm/submit/route.ts:71-77` | C-01, BE-2.1 |
| P1-7 | Delete landing-v2 dead code (9 files) | general-purpose | 5 min | Delete `d2c/src/components/landing-v2/` directory | FE-1 |
| P1-8 | Fix payment page infinite spinner on empty array | general-purpose | 20 min | `d2c/src/app/(app)/payment/page.tsx:94-104` | FE-5 |
| P1-9 | Fix payment page redirect for PAID/SUBMITTED/ACCEPTED to /confirmation | general-purpose | 20 min | `d2c/src/app/(app)/payment/page.tsx` | FE-12 |
| P1-10 | Fix has25PlusAccounts staleness (update on account create/delete) | general-purpose | 30 min | `accounts/route.ts`, `accounts/[accountId]/route.ts` | BE-5.5 |
| P1-11 | Add AMENDED-requires-ACCEPTED guard | general-purpose | 20 min | `d2c/src/app/api/filing/route.ts:74` | BE-1.3 |
| P1-12 | Remove dead payment_intent.payment_failed handler or fix logic | general-purpose | 15 min | `d2c/src/app/api/stripe/webhook/route.ts:145-155` | H-06, BE-6.5 |
| P1-13 | Fix GA4 client_id (remove server-side event or store _ga cookie) | general-purpose | 20 min | `d2c/src/app/api/stripe/webhook/route.ts:87` | BE-6.4 |
| P1-14 | Fix file type alignment (remove TIFF/HEIC from allowed or add conversion) | general-purpose | 30 min | `d2c/src/lib/upload-validation.ts`, `d2c/src/lib/extraction.ts` | BE-7.2 |

**P1-1 detail:** Add Zod schema matching the pattern used in other auth routes:
```typescript
const forgotPasswordSchema = z.object({ email: z.string().email().max(254) });
```
On parse failure, return the same anti-enumeration message (not a 400 error that reveals format requirements). This also resolves M-05 (timing side-channel from unvalidated email format reaching the DB).

**P1-5 detail:** Two changes required:
1. In `sdtm.ts`: Validate `SDTM_PRIVATE_KEY_PATH` at module load time (not per-request). Assert it is an absolute path. Alternatively, support `SDTM_PRIVATE_KEY` as a base64-encoded env var to eliminate filesystem reads entirely.
2. In `sdtm/submit/route.ts`: The outer catch block at line 120 does not revert the filing status from SUBMITTING back to PAID. Add status revert in the catch block to prevent filings from getting permanently stuck.

**P1-6 detail:** After `generateFincenXml()` but before `submitBatch()`, call `validateFincenXml()`:
```typescript
const xml = await generateFincenXml(filingYearId);
const validation = validateFincenXml(xml);
if (!validation.isValid) {
  // Revert SUBMITTING -> PAID and return 500
}
```
This prevents stub or malformed XML from being submitted to FinCEN. The validation function already exists in the codebase but is never called from the submit route.

**P1-10 detail:** After each POST (create) and DELETE (remove) in the accounts API, recompute:
```typescript
const accountCount = await prisma.foreignAccount.count({
  where: { userId: session.user.id, calendarYear },
});
await prisma.filingYear.updateMany({
  where: { userId: session.user.id, calendarYear, status: "IN_PROGRESS" },
  data: { has25PlusAccounts: accountCount >= 25 },
});
```

**P1-12 detail:** The `payment_intent.payment_failed` handler reverts PAID->SIGNED, but this state is impossible in normal Stripe Checkout flow (if payment failed, `checkout.session.completed` never fired, so the filing never reached PAID). Remove the filing status reversion entirely; keep only the Payment record update to mark the payment as FAILED. The `checkout.session.expired` handler already covers the session-timeout case.

**P1-13 recommendation:** Remove the server-side GA4 Measurement Protocol event from the webhook handler entirely. The webhook does not have access to the client's `_ga` cookie, and using `userId` as `client_id` creates a disconnected GA4 session. Rely on the client-side GA4 `purchase` event from the confirmation page instead.

### Phase 1 Testing Requirements

Each agent MUST run the relevant E2E specs after their changes. Run `npx playwright test` from `d2c/` for full suite, or target specific specs.

| Task | Test Action Required |
|------|---------------------|
| P1-1 | **Write new test** in `tests/api/forgot-password.test.ts`: test that malformed emails (no @, too long, empty) return the generic anti-enumeration response (not a 400 format error). Test that valid email still works. Run `auth.spec.ts` forgot-password tests to verify no regression. |
| P1-2 | **Write new test** in `tests/api/accounts.test.ts`: test `GET /api/accounts?calendarYear=abc` returns 400 (not 500). Test `calendarYear=2024` still works. |
| P1-3 | **Write new test** in `tests/api/filing.test.ts`: test `POST /api/filing` with invalid JSON body returns 400 (not 500). Same for `PATCH /api/filing/tier` and `POST /api/sdtm/submit`. |
| P1-4 | No E2E test possible (SFTP timeout). Add a code comment documenting the 10s timeout and why. |
| P1-5 | **Write new test** in `tests/api/sdtm-submit.test.ts`: test that when SFTP key file is missing, the submit route returns an error and reverts the filing from SUBMITTING to PAID (not stuck). |
| P1-6 | **Write new test** in `tests/api/sdtm-submit.test.ts`: test that `validateFincenXml()` is called before `submitBatch()`. When XML is invalid (current stub), verify the route returns 500 and reverts SUBMITTING→PAID. |
| P1-7 | Run `marketing.spec.ts` — landing page tests should still pass since v2 was never imported. |
| P1-8 | **Write new test** in `t13-payment-dashboard.spec.ts` or new file: test that navigating to `/payment` when no SIGNED filing exists shows the signing prompt (not an infinite spinner). |
| P1-9 | **Write new test**: test that navigating to `/payment` when filing is PAID/SUBMITTED/ACCEPTED redirects to `/confirmation`. |
| P1-10 | **Write new test** in `tests/api/accounts.test.ts`: create 25 accounts, verify `has25PlusAccounts` is true. Delete one, verify it's false. |
| P1-11 | **Write new test** in `tests/api/filing.test.ts`: test that creating an AMENDED filing when ORIGINAL is not ACCEPTED returns 400. |
| P1-12 | **Write new test** in `tests/api/webhook-guard.test.ts`: verify `payment_intent.payment_failed` does NOT revert filing status. |
| P1-13 | Run `gtm-smoke.spec.ts` if it exists and covers GA4. Otherwise document removal of server-side GA4 event. |
| P1-14 | **Write new test** in `tests/api/upload-validation.test.ts`: test that `.tiff` and `.bmp` files are rejected at upload time with a clear error (not accepted and failing later at extraction). Test that `.heic` files are handled consistently. |

### Phase 1 Agent Grouping

| Agent | Tasks | Files Owned |
|-------|-------|-------------|
| Agent A | P1-1 | `forgot-password/route.ts` |
| Agent B | P1-2, P1-10, P1-11 | `accounts/route.ts`, `accounts/[accountId]/route.ts`, `filing/route.ts` |
| Agent C | P1-3 (filing + tier), P1-4, P1-5, P1-6 | `sdtm.ts`, `sdtm/submit/route.ts`, `filing/tier/route.ts` |
| Agent D | P1-7, P1-8, P1-9 | `landing-v2/`, `payment/page.tsx` |
| Agent E | P1-12, P1-13 | `stripe/webhook/route.ts` (after P0-7) |
| Agent F | P1-14 | `upload-validation.ts`, `extraction.ts` |

---

## Phase 2: Filing Pipeline Fix — DONE (committed 2026-02-19)

**Total effort:** ~2 hours | **Wall clock:** ~2 hours (sequential)
The review-to-sign transition is broken. Must fix before Phase 4 pipeline work.

| ID | Task | Agent | Effort | Files | Source |
|----|------|-------|--------|-------|--------|
| P2-1 | Resolve REVIEWED status gap | general-purpose | 1 hr | `d2c/src/lib/filing-guards.ts:63`, new `d2c/src/app/api/filing/review/route.ts` | BE-1.1, BE-1.2 |
| P2-2 | Add maxValueUsd computation to accounts POST/PUT | general-purpose | 1 hr | `accounts/route.ts`, `accounts/[accountId]/route.ts`, `d2c/src/lib/treasury.ts` | BE-3.1 |

**P2-1 decision -- Option A (recommended):** Add `POST /api/filing/review` endpoint:
```typescript
// Transition IN_PROGRESS -> REVIEWED when user confirms review
const updated = await prisma.filingYear.updateMany({
  where: { id: filingYearId, userId: session.user.id, status: "IN_PROGRESS" },
  data: { status: "REVIEWED" },
});
```
The review page calls this when the user clicks "Continue to Sign." This creates an explicit audit trail of the user confirming they have reviewed their data before signing -- important for a compliance-sensitive application.

Option B (update `filing-guards.ts:63` to accept `IN_PROGRESS` alongside `REVIEWED`) is simpler but loses the review confirmation step. Not recommended.

**P2-2 detail:** When an account is created or updated with a `maxValue` in a foreign currency, compute `maxValueUsd`:
1. Call `getExchangeRate(currency, calendarYear)` from `treasury.ts`.
2. If rate exists: `maxValueUsd = maxValue * rate`.
3. If rate is null (stub): store `maxValueUsd = null` and log a warning.
This allows the account flow to work while treasury rates are stubbed. Phase 4 (P4-1) fills in real rates. The XML generator (P4-2) must guard against null `maxValueUsd`.

**Dependencies:** Must run after P1-2 and P1-10 complete (they modify the same account route files).

### Phase 2 Testing Requirements

| Task | Test Action Required |
|------|---------------------|
| P2-1 | **CRITICAL — Update existing test** `t12-review-sign.spec.ts`: The review→sign transition will now go through `POST /api/filing/review`. Update the test to verify: (1) clicking "Continue to Sign" on review page calls the new endpoint, (2) filing status transitions to REVIEWED, (3) sign page loads successfully after. **Write new API test** `tests/api/filing-review.test.ts`: test POST /api/filing/review transitions IN_PROGRESS→REVIEWED, rejects if already REVIEWED/SIGNED/PAID, rejects if no accounts exist. |
| P2-2 | **Write new test** in `tests/api/accounts.test.ts`: test that creating an account with a non-USD currency stores `maxValueUsd` (or null if treasury rates are stubbed). Test that updating `maxValueLocal` recomputes `maxValueUsd`. |

Run full E2E suite after both tasks: `npx playwright test` — especially `t12-review-sign.spec.ts` and `t13-payment-dashboard.spec.ts` which cover the wizard flow end-to-end.

---

## Phase 3: Infrastructure and Configuration — DONE (committed 2026-02-19)

**Total effort:** ~10 hours | **Wall clock:** ~4 hours (4 parallel groups)
Mostly ops changes. Maps to original Phase 2 plus new infrastructure findings.

| ID | Task | Agent | Effort | Files | Source |
|----|------|-------|--------|-------|--------|
| P3-1 | Stripe live keys + webhook secret | Bash/general-purpose | 1 hr | `.env`, `docker-compose.prod.yml` | Gap #3 |
| P3-2 | SDTM SFTP credentials + host key | general-purpose | 1 hr | `.env`, `docker-compose.prod.yml`, `d2c/src/lib/sdtm.ts` | Gap #5+#9, H-02, H-03 |
| P3-3 | S3 presigned URLs + server-side encryption | general-purpose | 2 hr | `d2c/src/lib/storage.ts`, `d2c/src/lib/s3.ts`, `Caddyfile.prod` | Gap #8, H-04 |
| P3-4 | GTM/GA4 analytics | general-purpose | 1 hr | `d2c/Dockerfile`, `docker-compose.prod.yml`, `.env` | Gap #17 |
| P3-5+P3-6 | Combined schema migration: Statement FK, FilingYear index, UTM VarChar, fileName VarChar | general-purpose | 30 min | `d2c/prisma/schema.prisma` | BE, M-04, H-05 |
| P3-7 | Set up offsite backup (rclone to Hetzner Object Storage) | Bash | 2 hr | VPS cron config | Infra |
| P3-8 | Add MinIO data backup to cron | Bash | 1 hr | VPS cron config | Infra |
| P3-9 | Add Sentry error tracking | general-purpose | 2 hr | `d2c/package.json`, new Sentry config files, `d2c/next.config.js` | Infra |

**P3-1 detail:** Generate Stripe production API keys from the Stripe Dashboard. Create production webhook endpoint at `https://fbardirect.com/api/stripe/webhook`. Update `.env` on VPS. Test with `stripe trigger checkout.session.completed`.

**P3-2 detail:** Make `SDTM_HOST_KEY` required when `SDTM_SANDBOX_MODE=false`:
```typescript
if (!isSandbox() && !process.env.SDTM_HOST_KEY) {
  throw new Error("SDTM_HOST_KEY is required when SDTM_SANDBOX_MODE is not true");
}
```
Add `SDTM_HOST_KEY=""` to `.env.example` with comment: `# Obtain via: ssh-keyscan sdtm.fincen.gov | base64`. Must run after P1-4/P1-5 (also modify `sdtm.ts`).

**P3-3 detail:** Two changes:
1. Implement `getPresignedUrl()` using S3 `GetObjectCommand` with presigned URL generation (15-minute expiry). Replace direct MinIO URLs in the download flow.
2. Add `ServerSideEncryption: "AES256"` to all `PutObjectCommand` calls in `s3.ts` (resolves H-04: PII files at rest not encrypted by storage layer).

**P3-5+P3-6 combined migration** adds in a single `prisma migrate dev` run:
- Statement->FilingYear FK relation (`filingYear FilingYear? @relation(...)`)
- `@@index([userId, status])` on FilingYear for common query patterns
- `@db.VarChar(200)` on 5 UTM columns (resolves M-04)
- `@db.VarChar(255)` on `Statement.fileName` (partial fix for H-05)

**P3-7 detail:** Install `rclone` on VPS, configure Hetzner Object Storage remote. Backup script dumps Postgres (`pg_dump`) nightly at 2:00 AM UTC. Verify restore works.

**P3-9 detail:** Install `@sentry/nextjs`. Configure `beforeSend` hook to scrub PII (SSNs, account numbers) from error reports before transmission. Add `SENTRY_DSN` to `.env`.

### Phase 3 Testing Requirements

| Task | Test Action Required |
|------|---------------------|
| P3-1 | No automated test (env config + Stripe dashboard). Manual verification: `stripe trigger checkout.session.completed` against live keys. Document the verification steps. |
| P3-2 | **Write new test** in `tests/api/sdtm-config.test.ts`: test that when `SDTM_SANDBOX_MODE=false` and `SDTM_HOST_KEY` is missing, the app throws at startup. Test that when both are set, SFTP config is valid. |
| P3-3 | **Write new test** in `tests/api/s3-presigned.test.ts`: test that `getPresignedUrl()` returns a URL with expiry. Test that `PutObjectCommand` includes `ServerSideEncryption`. Run E2E upload tests if they exist. |
| P3-4 | Run `gtm-smoke.spec.ts` to verify GTM loads correctly after wiring build args. |
| P3-5/6 | Run `npx prisma migrate dev --dry-run` to verify migration SQL. Run full E2E suite after migration to verify no schema-breaking changes. |
| P3-7 | No automated test (VPS cron). Document manual verification: run backup, verify file exists on Hetzner Object Storage, test restore to a scratch database. |
| P3-8 | No automated test (VPS cron). Document manual verification: run `mc mirror`, verify MinIO data is replicated. |
| P3-9 | **Write new test**: verify Sentry `beforeSend` strips SSN patterns and account numbers. Unit test the scrubbing function directly. Run `npm run build` to verify Sentry wraps config without errors. |

Run full E2E suite after all Phase 3 tasks: `npx playwright test`

---

## Phase 4: Filing Pipeline Core

**STATUS: PARTIALLY DONE — P4-2 completed 2026-02-21. P4-1 and P4-3 remain blocked.**

**Total effort:** ~12 hours remaining | **Wall clock:** ~12 hours (MUST be sequential)
Three blocking gaps for FinCEN submission. Maps to original Phase 3.

| Order | ID | Task | Agent | Effort | Files | Source | Status |
|-------|----|------|-------|--------|-------|--------|--------|
| 1st | P4-1 | Treasury exchange rates | backend-architect | 4 hr | `d2c/src/lib/treasury.ts`, possibly `d2c/prisma/schema.prisma` | Gap #2 | BLOCKED |
| ~~2nd~~ | ~~P4-2~~ | ~~FinCEN XML generation~~ | — | ~~8 hr~~ | `d2c/src/lib/fincen-xml.ts` | Gap #1 | **DONE** (2026-02-21) |
| 3rd | P4-3 | Submission architecture + cron | backend-architect | 8 hr | 7 files (see below) | Gap #6 (absorbs #14) | BLOCKED on P4-1 |

**P4-1:** Port from B2B `src/lib/treasury.ts`. Implement `getExchangeRate(currencyCode, calendarYear)` fetching from the US Treasury Department's Exchange Rates API. Add rate caching (in-memory with TTL or in a new Prisma model). Add startup validation that fetches rates for the most common filing year (current year minus one). Agent reads B2B source for reference.

**P4-2: COMPLETED (2026-02-21).** Ported from B2B `src/lib/export/fincen-xml.ts` with all D2C adaptations:
- Self-filed (`PreparerFilingSignatureIndicator: "Y"`, no party types 57/56)
- Transmitter config from `FINCEN_TRANSMITTER_*` env vars (not function params)
- Direct account query (`userId + calendarYear`, no `reviewedAccountYears`)
- `isJointAccount` (not `isJointlyOwned`), `institutionAddress` as Json field
- TIN types: SSN/ITIN only (both code "1")
- Throws on null `maxValueUsd` (no `isValueUnknown` flag)
- Submit route validation gate fixed: `<BSAMessage` → `<fc2:EFilingBatchXML`
- `sdtm-submit.test.ts` mock XML updated to match new root element
- 25 tests passing, 498 total suite, 0 failures, 0 lint errors

**P4-3 files touched:**
- New: `d2c/src/lib/fincen-submit.ts` (extract shared submission logic)
- New: `d2c/src/app/api/cron/submit-paid/route.ts` (retry stuck PAID filings)
- New: `d2c/src/app/api/cron/poll-submitted/route.ts` (poll FinCEN for acknowledgements)
- Modified: `d2c/src/app/api/sdtm/submit/route.ts` (simplify to call `submitFiling()`)
- Modified: `d2c/src/app/api/stripe/webhook/route.ts` (trigger submission after PAID)
- Modified: `d2c/src/app/(app)/confirmation/page.tsx` (status re-check before browser submission)
- Modified: `docker-compose.prod.yml` (add `d2c-cron` BusyBox service, 16 MB memory limit)

Full implementation plan with code samples in `claudedocs/knowngaps/06-fincen-submission-architecture.md`.

### Phase 4 Testing Requirements

When Phase 4 is unblocked:

| Task | Test Action Required |
|------|---------------------|
| P4-1 | **Write tests** in `tests/api/treasury.test.ts`: test `getExchangeRate()` returns correct rates for known currencies. Test caching behavior. Test fallback when Treasury API is unreachable. |
| ~~P4-2~~ | **DONE** (2026-02-21). 25 tests in `tests/api/fincen-xml.test.ts` — covers single account, 25+ batch, joint accounts, multi-currency, empty accounts, null maxValueUsd, transmitter/contact config, XML structure, filing types, validation. |
| P4-3 | **Write tests** in `tests/api/submission.test.ts`: test cron route picks up PAID filings. Test idempotent submission (calling twice doesn't double-submit). Test acknowledgement polling. Run full E2E suite including `t12` and `t13`. |

---

## Phase 5: Security Hardening — DONE (committed 2026-02-19; MFA enforcement deferred)

**Total effort:** ~26 hours | **Wall clock:** ~26 hours (sequential, single agent)
Maps to original Phase 4. Gaps #10, #11, #13 all touch `d2c/src/middleware.ts` -- MUST be a single coordinated pass by ONE security-engineer agent.

**Note (2026-02-21):** P5-1 (CSRF narrowing), P5-2 (JWT 24h maxAge), P5-3 (MFA enrollment/setup/verify/disable/recovery), P5-4 (encryption key rotation + safeDecrypt fix) are all DONE. MFA *login enforcement* (redirecting to `/mfa-verify` on login) was deferred — the infrastructure exists (`/mfa-verify` page, middleware gate, HMAC cookie) but is not wired into the login flow. 7 E2E test skips in `mfa.spec.ts` track this.

**Middleware execution order after all changes (updated 2026-02-28):**

1. Static file bypass (existing, unchanged)
2. Rate limiting (existing, Gap #19 accepted as-is)
3. CSRF check (P5-1 narrows exemption list)
4. Auth passthrough for NextAuth/Stripe (existing, unchanged)
5. API auth check (existing, unchanged)
6. **Email verification gate (NEW, 2026-02-28)** -- blocks unverified users from app routes
7. MFA pending redirect (P5-3) -- must come after email verification
8. Page auth / redirect to login (existing, unchanged)

**Note (2026-02-28):** Email verification gate added as part of Go-to-Market security sprint. JWT maxAge set to 8h (not 7d as originally planned). Revocation check (Fix B, Redis blocklist) deferred.

| Order | ID | Task | Agent | Effort | Files | Source |
|-------|----|------|-------|--------|-------|--------|
| 1st | P5-1 | CSRF exemption narrowing | security-engineer | 1 hr | `d2c/src/middleware.ts` | Gap #13 |
| 2nd | P5-2 | JWT maxAge 30d to 7d | security-engineer | 30 min | `d2c/src/lib/auth.ts` | Gap #11 |
| 3rd | P5-3 | MFA/2FA implementation | security-engineer | 16 hr | `middleware.ts`, `auth.ts`, `schema.prisma`, 8 new files | Gap #10 |
| 4th | P5-4 | Encryption key rotation | security-engineer | 8 hr | `d2c/src/lib/encryption.ts`, new migration script | Gap #12 |

**P5-1 detail:** Replace the blanket `/api/auth/` exemption at middleware line 122 with a specific allowlist:
```typescript
const csrfExemptPaths = [
  "/api/auth/callback/",  // NextAuth OAuth callbacks
  "/api/auth/session",     // NextAuth session endpoint
  "/api/auth/csrf",        // NextAuth CSRF token endpoint
  "/api/auth/providers",   // NextAuth providers list
  "/api/auth/signout",     // NextAuth signout
  "/api/stripe/webhook",   // Stripe (has own signature verification)
];
```
Custom auth routes (`/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/reset-password`) already send `X-Requested-With: XMLHttpRequest` (confirmed in signup line 49, forgot-password line 20, reset-password line 41) and will pass validation.

**P5-3 detail (largest single task):**
- **Schema changes:** Add `mfaEnabled Boolean @default(false)`, `mfaSecret String?`, `mfaVerifiedAt DateTime?` to User. Add `MfaRecoveryCode` model with `codeHash String`, `used Boolean`, `usedAt DateTime?`.
- **New library `mfa.ts`:** TOTP generation/verification using `otpauth` (RFC 6238), QR code generation using `qrcode`, recovery code generation (10 codes, SHA-256 hashed).
- **Auth changes:** `authorize` callback sets `mfaPending: true` in JWT when `user.mfaEnabled && !mfaVerifiedThisSession`. `jwt` callback passes flag through. `session` callback exposes to client.
- **Middleware:** After revocation check (step 6), check `mfaPending === true`. Page routes redirect to `/mfa-verify`. API routes return 403 JSON.
- **New pages:** `/mfa-verify` (TOTP challenge), `/settings/security` (setup UI with QR code and recovery codes).
- **New API routes:** `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`, `POST /api/auth/mfa/disable`, `POST /api/auth/mfa/recovery`.
- **Cross-gap requirement:** All MFA fetch calls must include `X-Requested-With: XMLHttpRequest` header to pass CSRF validation after P5-1 narrowing.
- Full plan with code samples in `claudedocs/knowngaps/10-mfa-2fa.md`.

**P5-4 detail:**
1. **Key versioning:** Prefix all new encrypted values with `v1:`. Decryption detects prefix to select the correct key.
2. **Multi-key support:** Read `ENCRYPTION_KEY` (current) and `ENCRYPTION_KEY_PREV` (previous). Decryption tries current key first, falls back to previous.
3. **Migration script:** `scripts/rotate-encryption-key.ts` re-encrypts all TINs and account numbers from old key to new key.
4. **Fix M-02 (safeDecrypt in sign flow):** In `filing/sign/route.ts:76`, replace `safeDecrypt(user.tin)` with `decrypt(user.tin)` wrapped in try/catch. Hard error on failure -- do not generate Form 114a with blank or incorrect TIN:
```typescript
let tinLast4 = "0000";
if (user.tin) {
  try {
    tinLast4 = decrypt(user.tin).slice(-4);
    if (!tinLast4 || tinLast4.length < 4) {
      return NextResponse.json({ error: "Unable to retrieve your TIN" }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: "Unable to process your TIN" }, { status: 500 });
  }
}
```

### Phase 5 Testing Requirements

The single security-engineer agent MUST run the full E2E suite after EACH task (not just at the end), because each task modifies shared middleware/auth files.

| Task | Test Action Required |
|------|---------------------|
| P5-1 | **Write new test** in `tests/api/csrf.test.ts`: test that `POST /api/auth/signup` without `X-Requested-With` header is rejected (CSRF). Test that NextAuth routes (`/api/auth/callback/`, `/api/auth/session`) still work without the header. Test that Stripe webhook still works. Run `auth.spec.ts` — all signup/login/forgot-password flows must still work. |
| P5-2 | Run `auth.spec.ts` — verify login still works with the reduced 7-day JWT maxAge. No new test needed unless session expiry behavior is testable in E2E. |
| P5-3 | **Write comprehensive tests** in `tests/e2e/mfa.spec.ts`: test MFA setup flow (QR code display, TOTP verification). Test login with MFA enabled (redirect to `/mfa-verify`). Test recovery code usage. Test MFA disable flow. Test that API routes return 403 when MFA is pending. Test that all new `/api/auth/mfa/*` routes include `X-Requested-With` header (CSRF compliance from P5-1). Run full E2E suite — all existing auth tests must still pass for non-MFA users. |
| P5-4 | **Write new test** in `tests/api/encryption.test.ts`: test that `decrypt()` handles versioned (`v1:`) and unversioned ciphertext. Test that `safeDecrypt` failure in sign route returns 422/500 (not silent empty string). Test key rotation script against test data. Run full E2E suite — all flows that display TIN last 4 or account numbers must still work. |

---

## Phase 6: CI/CD and Monitoring — DONE (committed 2026-02-19)

**Total effort:** ~12 hours | **Wall clock:** ~6 hours (2 parallel groups)
Can start anytime after Phase 0.

| ID | Task | Agent | Effort | Files |
|----|------|-------|--------|-------|
| P6-1 | GitHub Actions CI (lint + typecheck + build on push) | devops-architect | 2 hr | New `.github/workflows/fbar-ci.yml` |
| P6-2 | Add structured JSON logging | general-purpose | 4 hr | New `d2c/src/lib/logger.ts`, update all `console.log/error` calls |
| P6-3 | Build images in CI, push to GHCR | devops-architect | 4 hr | `.github/workflows/fbar-ci.yml`, `docker-compose.prod.yml` |
| P6-4 | Add automated rollback script | Bash | 2 hr | New `scripts/rollback.sh` on VPS |

**P6-1 detail:** Create workflow triggered on push to `main` and PRs, scoped to `fbar-automator/d2c/` path changes. Steps: `npm ci`, lint, typecheck (`npx tsc --noEmit`), unit tests, build (`npm run build`). Cache `node_modules` and `.next/cache`.

**P6-2 detail:** Create `d2c/src/lib/logger.ts`:
```typescript
export function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
```
Replace all `console.log/warn/error` calls throughout the codebase. Add trace ID from middleware (generate `crypto.randomUUID()` per request, pass via header). Ensure PII is never included in log metadata.

**P6-3 detail:** Build Docker images on GitHub Actions runners (7 GB RAM) instead of VPS (1.9 GB RAM). Push tagged images to GHCR. Update `docker-compose.prod.yml` to reference `ghcr.io/themattcohen/fbar-d2c:latest`. Deploy process simplifies to `docker compose pull && docker compose up -d` (no build step on VPS).

**P6-4 detail:** Create `scripts/rollback.sh` that stops current stack, reverts to previous Docker image tag (stored in `.last-deploy` file), starts with previous images, verifies health endpoint returns 200.

### Phase 6 Testing Requirements

| Task | Test Action Required |
|------|---------------------|
| P6-1 | The CI pipeline IS the test — verify it runs lint, typecheck, and build on a test push. Create a test PR to verify the workflow triggers correctly. |
| P6-2 | **Write new test** in `tests/api/logger.test.ts`: test that `log()` produces valid JSON. Test that PII patterns (SSN, account numbers) are NOT included in log output. Run full E2E suite to verify all `console.log` replacements don't break anything. |
| P6-3 | Verify that `docker compose pull && docker compose up -d` works with GHCR images. Manual verification on VPS. |
| P6-4 | **Write test**: run `scripts/rollback.sh` in a dry-run mode that verifies the `.last-deploy` file format and the health check logic. |

---

## Phase 7: Low Priority / Post-Launch — DONE (committed 2026-02-19)

**Total effort:** ~28 hours | **Wall clock:** ~6 hours (all independent, full parallel)
Can start anytime after Phase 1.

| ID | Task | Agent | Effort | Files | Source |
|----|------|-------|--------|-------|--------|
| P7-1 | Drawn signatures in PDF | general-purpose | 4 hr | `d2c/src/lib/form114a.ts` | Gap #15 |
| P7-2 | Replace xlsx with exceljs (licensing) | general-purpose | 4 hr | `d2c/src/lib/extraction.ts`, `d2c/package.json` | Gap #18 |
| P7-3 | Blog content pages | frontend-architect | 4 hr | New `d2c/src/app/(marketing)/blog/` | Gap #20 |
| P7-4 | Welcome/signup email | general-purpose | 2 hr | `d2c/src/lib/email.ts`, `signup/route.ts` | Gap #22 |
| P7-5 | Fix color contrast issues | frontend-architect | 2 hr | `d2c/src/app/globals.css`, components using `text-gray-400` | FE a11y |
| P7-6 | Add wizard happy-path E2E test | quality-engineer | 4 hr | New `d2c/tests/e2e/wizard-happy-path.spec.ts` | Quality |
| P7-7 | Fix threshold radio keyboard navigation | frontend-architect | 1 hr | `d2c/src/app/(app)/threshold/page.tsx` | FE a11y |
| P7-8 | Add Prisma query logging | general-purpose | 15 min | `d2c/src/lib/db.ts` | BE |
| P7-9 | Enable axe color contrast checks | quality-engineer | 2 hr | `d2c/tests/e2e/accessibility.spec.ts` | Quality |
| P7-10 | Add PgBouncer connection pooling | devops-architect | 4 hr | `docker-compose.prod.yml` | Infra |
| P7-11 | Add ownership type to extraction prompt | general-purpose | 1 hr | `d2c/src/lib/prompts.ts`, `extraction-mapper.ts` | BE |
| P7-12 | Add email retry/dead-letter mechanism | general-purpose | 2 hr | `d2c/src/lib/email.ts` | BE |

### Phase 7 Testing Requirements

| Task | Test Action Required |
|------|---------------------|
| P7-1 | **Write test**: generate Form 114a with drawn signature data, verify PDF contains signature image (not placeholder). Run `t15-form114a-download.spec.ts`. |
| P7-2 | **Write test** in `tests/api/extraction.test.ts`: test `.xlsx` processing with exceljs produces same output as old xlsx library. |
| P7-3 | Run `marketing.spec.ts` to verify blog pages load. **Write new test** for blog index and post pages. |
| P7-4 | **Write test**: verify signup triggers welcome email (mock Resend, assert `sendWelcomeEmail` called). |
| P7-5 | **Enable color-contrast** in `accessibility.spec.ts` (remove `.disableRules(["color-contrast"])`) for fixed pages. Fix all failures. |
| P7-6 | This task IS a test — write the wizard happy-path E2E spec. |
| P7-7 | **Write test** in `accessibility.spec.ts`: threshold radios respond to arrow keys (not just Tab). |
| P7-8 | No test needed (logging config). Verify `npm run build`. |
| P7-9 | This task IS a test — enable axe color-contrast and fix failures. |
| P7-10 | No E2E test (infra). Verify PgBouncer health check. |
| P7-11 | **Write test**: extraction prompt asks for ownership type, mapper handles it correctly. |
| P7-12 | **Write test**: email retry fires on transient failure, dead-letter logs permanent failures. |

### Additional Low-Priority Security Items

| Task | Effort | Files | Source |
|------|--------|-------|--------|
| Add HSTS header | 5 min | `d2c/next.config.js` | L-02 |
| Delete all reset tokens (not just expired) in forgot-password | 10 min | `forgot-password/route.ts` | L-03 |
| Rate-limit health endpoint | 15 min | `d2c/src/middleware.ts` | M-03 |
| Cross-check calendarYear against active filing | 30 min | `accounts/route.ts` | M-06 |
| Sanitize file.name before storing in Statement | 15 min | `statements/upload/route.ts` | H-05 |
| Nonce-based CSP (replace unsafe-inline) | 4-8 hr | `middleware.ts`, `next.config.js` | L-01 |

---

## Dependency Graph

```
Phase 0 (all parallel) -----------------------------------------------+
                                                                       |
Phase 1 (6 parallel groups; P1-E waits for P0-7) --------------------+
                                                                       |
Phase 2 (sequential; after P1-2, P1-10) -----------------------------+
                                                                       |
Phase 3 (4 parallel groups; P3-2 after P1-4/P1-5) -------------------+
                                                                       |
Phase 4 (sequential chain):                                            |
  P4-1 (Treasury) --> P4-2 (XML gen) --> P4-3 (Submission arch)       |
  Depends on: P2-2, P3-5+P3-6, P1-6                                   |
                                                                       |
Phase 5 (sequential, single agent):                                    |
  P5-1 (CSRF) --> P5-2 (JWT) --> P5-3 (MFA) --> P5-4 (Key rot)       |
  Depends on: P3-5+P3-6 schema. Recommended: after Phase 4            |
                                                                       |
Phase 6 (2 parallel groups) -- can start anytime after Phase 0 -------+
                                                                       |
Phase 7 (all independent) -- can start anytime after Phase 1 ---------+
```

**Cross-phase parallelism:**
- Phases 0-3 can overlap freely (respecting per-file dependencies noted above).
- Phase 4 starts after Phase 2 + Phase 3 schema migration.
- Phase 5 starts after Phase 3 schema migration. Recommended after Phase 4.
- Phase 6 is independent, starts after Phase 0.
- Phase 7 is independent, starts after Phase 1.

**Critical path (with Phase 4 blocked):** Phase 0 (30 min) -> Phase 1 (1 hr) -> Phase 2 (2 hr) -> Phase 3 (4 hr) -> Phase 5 (26 hr) = ~34 hours without Phase 4.

**Full critical path (when Phase 4 unblocked):** Phase 0 (30 min) -> Phase 1 (1 hr) -> Phase 2 (2 hr) -> Phase 3 schema (30 min) -> Phase 4 (12 hr, P4-2 done) -> Phase 5 (26 hr) = ~42 hours.

### External Dependencies (Non-Code)

These are blocking requirements that must be completed outside the codebase before full production launch. They can be pursued in parallel with all phases.

| Dependency | Blocking For | Lead Time | Action |
|------------|-------------|-----------|--------|
| BSA E-Filing registration | P4-2 (TCC for XML), P4-3 (SFTP credentials) | 1-2 weeks | Register at bsaefiling.fincen.gov/enroll |
| FinCEN TCC test submission (25-50 sample FBARs) | Production TCC | ~10 business days after submission | Requires working XML generator (P4-2) |
| Production TCC issuance | Live filing | After successful test validation | FinCEN issues TCC after test passes |
| SDTM SFTP setup | P3-2, P4-3 | Variable | Contact FinCEN help desk: 1-866-346-9478 |
| E&O insurance policy | Go-live | 1-4 weeks | $1M-$5M coverage recommended |
| Stripe live account approval | P3-1 | Already done or 1-3 days | Verify account is fully activated |
| Attorney review of ToS resubmission language | Go-live | 1-2 weeks | Focus on FinCEN rejection handling |

See `claudedocs/d2c-fbar-filing-compliance.md` for the full regulatory checklist.

---

## File Ownership Map

Files touched by multiple tasks -- requires sequencing to prevent conflicts.

| File | Tasks | Resolution |
|------|-------|------------|
| `d2c/src/middleware.ts` | P5-1, P5-2, P5-3 | Single agent, single pass in Phase 5 |
| `d2c/src/lib/auth.ts` | P5-2, P5-3 | Same agent as middleware; P5-2 first |
| `d2c/src/lib/sdtm.ts` | P1-4, P1-5, P3-2 | Combine P1-4+P1-5 (Phase 1 Agent C); P3-2 after Phase 1 |
| `d2c/src/app/api/sdtm/submit/route.ts` | P1-3, P1-5, P1-6, P4-3 | P1 Agent C handles all Phase 1 changes; P4-3 replaces route body in Phase 4 |
| `d2c/src/app/api/accounts/route.ts` | P1-2, P1-10, P2-2 | P1 Agent B first; P2-2 after Phase 1 |
| `d2c/src/app/api/accounts/[accountId]/route.ts` | P1-10, P2-2 | Same ordering as above |
| `d2c/src/app/api/stripe/webhook/route.ts` | P0-7, P1-12, P1-13, P4-3 | P0-7 first (Phase 0); P1-12+P1-13 (Phase 1 Agent E); P4-3 adds submission trigger (Phase 4) |
| `d2c/src/app/api/filing/route.ts` | P1-3, P1-11 | Same Phase 1 agent (Agent B); different sections |
| `d2c/src/lib/extraction.ts` | P1-14, P7-2 | P1-14 first (Phase 1); P7-2 later (Phase 7) |
| `d2c/src/lib/encryption.ts` | P5-4 | Single owner in Phase 5 |
| `d2c/prisma/schema.prisma` | P3-5+P3-6, P5-3 | P3-5+P3-6 migration first (Phase 3); P5-3 MFA migration later (Phase 5) |
| `docker-compose.prod.yml` | P3-1, P3-2, P3-4, P4-3, P7-10 | Different sections; stage deploys carefully |
| `Caddyfile.prod` | P0-3, P3-3 | P0-3 first (1-line delete, Phase 0); P3-3 after (proxy rules, Phase 3) |
| `d2c/src/app/(auth)/login/page.tsx` | P0-4, P0-8 | Same Phase 0 agent |
| `d2c/src/app/(app)/payment/page.tsx` | P1-8, P1-9 | Same Phase 1 agent (Agent D) |
| `d2c/src/app/(app)/confirmation/page.tsx` | P4-3 | Single owner in Phase 4 |
| `d2c/next.config.js` | P3-9 | Sentry wraps config. Phase 7 HSTS is separate, independent change |

---

## Agent Assignment Strategy

### Phase 0: 4 parallel agents

| Agent | Type | Tasks |
|-------|------|-------|
| 0-A | general-purpose | P0-1 (package.json), P0-2 (delete test route) |
| 0-B | general-purpose | P0-3 (Caddyfile), P0-4 (login page), P0-8 (auth error divs) |
| 0-C | general-purpose | P0-7 (webhook route) |
| 0-D | Bash | P0-5 (swap), P0-6 (uptime monitoring) |

### Phase 1: 6 parallel agents

| Agent | Type | Tasks |
|-------|------|-------|
| 1-A | general-purpose | P1-1 |
| 1-B | general-purpose | P1-2, P1-10, P1-11 |
| 1-C | general-purpose | P1-3 (filing/tier), P1-4, P1-5, P1-6 |
| 1-D | general-purpose | P1-7, P1-8, P1-9 |
| 1-E | general-purpose | P1-12, P1-13 (after P0-7 completes) |
| 1-F | general-purpose | P1-14 |

### Phase 2: 1 agent

| Agent | Type | Tasks |
|-------|------|-------|
| 2-A | general-purpose | P2-1, P2-2 (tightly coupled filing logic) |

### Phase 3: 4 agents

| Agent | Type | Tasks |
|-------|------|-------|
| 3-A | general-purpose | P3-1, P3-2, P3-5+P3-6 (env + schema) |
| 3-B | general-purpose | P3-4, P3-9 (GTM + Sentry) |
| 3-C | Bash | P3-7, P3-8 (VPS backup ops) |
| 3-D | general-purpose | P3-3 (S3 presigned URLs) |

### Phase 4: 1 agent, sequential

| Agent | Type | Tasks |
|-------|------|-------|
| 4-A | backend-architect | P4-1, P4-2, P4-3 |

Provide this agent B2B source files as context: `src/lib/treasury.ts` and `src/lib/export/fincen-xml.ts`.

### Phase 5: 1 agent, sequential

| Agent | Type | Tasks |
|-------|------|-------|
| 5-A | security-engineer | P5-1, P5-2, P5-3, P5-4 |

This is the most complex phase. The MFA implementation alone (P5-3) is XL effort: schema changes, 8 new files, middleware modifications, auth callback changes. Give this agent full context on the existing auth flow, middleware chain, and CSRF configuration.

### Phase 6: 2 agents

| Agent | Type | Tasks |
|-------|------|-------|
| 6-A | devops-architect | P6-1, P6-3 (CI/CD pipeline) |
| 6-B | general-purpose | P6-2, P6-4 (logging + rollback) |

### Phase 7: As needed, by specialization

- **frontend-architect:** P7-3, P7-5, P7-7
- **quality-engineer:** P7-6, P7-9
- **devops-architect:** P7-10
- **general-purpose:** P7-1, P7-2, P7-4, P7-8, P7-11, P7-12

---

## Orchestrator Monitoring Protocol

**MANDATORY for all phases with parallel agents (P0, P1, P3, P6, P7).**

The lead session (coordinator) MUST act as an orchestrator that monitors all spawned subagents. This prevents stuck agents from silently wasting time and budget.

### Cadence

- **Check-in interval:** Every 4 minutes after agents are spawned.
- **Method:** Read the output file of each background agent (`TaskOutput` with `block=false`, or `Read` on the agent's output file).
- **Trigger:** If an agent has produced no new output since the last check-in, it is considered **potentially stuck**.

### Detection Criteria

An agent is **stuck** if ANY of these are true after 4 minutes of no progress:
1. No new lines in its output file since last check
2. Repeated identical error messages (loop detection)
3. Waiting on user input that will never come (e.g., interactive prompt)
4. Exceeded 3x the estimated wall-clock time for its assigned tasks

### Corrective Actions (escalating)

| Step | Action | When |
|------|--------|------|
| 1 | **Nudge**: Send a message or resume the agent with a prompt like "Status check — are you blocked? Summarize progress and any blockers." | First detection (4 min) |
| 2 | **Redirect**: If the agent reports a blocker, provide the missing context or adjust its task scope. | After nudge response |
| 3 | **Kill & Respawn**: If the agent is unresponsive or looping after 2 consecutive check-ins (8 min), stop it and spawn a fresh agent with the same task + learnings from the failed attempt. | 8 min with no progress |
| 4 | **Absorb**: If respawn also fails, the coordinator takes over the task directly or reassigns to a different agent type. | After failed respawn |

### Orchestrator Checklist (per phase)

```
□ Record spawn time for each agent
□ Set 4-minute timer after all agents launched
□ At each check-in:
  □ Read each agent's output (non-blocking)
  □ Compare output length to previous check
  □ Log progress: agent name, lines produced, status (progressing/stuck/done)
  □ Take corrective action for any stuck agents
□ After all agents complete:
  □ Verify all expected output files exist
  □ Run validation (lint, typecheck, test list) on produced files
  □ Report summary: tasks completed, time taken, any issues
```

### Implementation Notes

- For **subagent** execution (not teams): use `run_in_background=true` on Task tool, then poll output files.
- For **team** execution: teammates auto-send idle notifications; the lead monitors via incoming messages.
- The 4-minute interval is a guideline — adjust down for fast phases (P0: check every 2 min) and up for slow phases (P4/P5: check every 6 min since they're sequential).
- Always log the check-in results so the user can see monitoring activity.

---

## Effort Summary

| Phase | Description | Tasks | Status | Remaining |
|-------|-------------|-------|--------|-----------|
| Phase 0 | Emergency Fixes | 8 | **DONE** (6/8; P0-5 swap + P0-6 monitoring deferred) | ~15 min |
| Phase 1 | Quick Wins | 14 | **DONE** | 0 |
| Phase 2 | Filing Pipeline Fix | 2 | **DONE** | 0 |
| Phase 3 | Infrastructure / Config | 9 | **DONE** | 0 |
| Phase 4 | Filing Pipeline Core | 3 | **PARTIAL** (P4-2 XML done; P4-1 + P4-3 blocked) | ~12 hr |
| Phase 5 | Security Hardening | 4 | **DONE** (MFA enforcement deferred) | 0 |
| Phase 6 | CI/CD / Monitoring | 4 | **DONE** | 0 |
| Phase 7 | Post-Launch | 12+ | **DONE** | 0 |
| **Total** | | **56+** | **~52 done, 2 blocked, 2 deferred** | **~12 hr** |

### Pre-Launch Minimum

For a working FinCEN submission pipeline (minimum viable go-live):

- ~~Phase 0 (emergency fixes): 30 min~~ **DONE**
- ~~Phase 1 (quick wins): 1 hr~~ **DONE**
- ~~Phase 2 (filing pipeline fix): 2 hr~~ **DONE**
- ~~Phase 3 subset (P3-1 Stripe + P3-2 SFTP + P3-5/P3-6 schema): 2 hr~~ **DONE**
- Phase 4 remaining (P4-1 Treasury + P4-3 submission): ~12 hr — **BLOCKED on B2B port**

**Remaining for functional filing: ~12 hours wall clock** (down from original ~25 hr estimate). Blocked on B2B Treasury rates port.

~~Phase 5 (security) should follow closely but is not blocking for an initial soft launch with known-user testing.~~ **DONE.** ~~Phase 6 (CI/CD) and Phase 7 are enhancements.~~ **DONE.**

### Key Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FinCEN TCC testing takes longer than 10 days | Delays go-live | Start BSA E-Filing registration immediately (external dependency, no code prerequisite). Begin P4-2 XML work in parallel. |
| P5-3 MFA scope creep (16 hr estimate) | Delays security hardening | Use the B2B roadmap's MFA design as a blueprint. Implement TOTP only (no SMS, no WebAuthn for V1). |
| Stripe webhook timeout during SFTP submission (P4-3) | Double-submission attempts | The atomic PAID->SUBMITTING lock prevents double-submission. If Stripe timeouts are observed, move `submitFiling()` to fire-and-forget pattern. Cron recovers within 5 minutes. |
| VPS OOM during Docker build (even with swap) | Build failure, potential sshd kill | P6-3 moves builds to GitHub Actions (7 GB RAM). Until P6-3 is done, build images one at a time on VPS. |
| Schema migration failures in production (P3-5+P3-6, P5-3) | Database downtime | Test migrations against a restored backup first. Use `prisma migrate deploy` (not `dev`) in production. Keep pg_dump backup from P3-7 as rollback. |
| Treasury API rate limiting or downtime (P4-1) | maxValueUsd computation fails | Cache rates aggressively (24-hour TTL minimum). Rates change annually, not daily. Seed historical rates for common currencies. |

---

## Appendix A: Known Gap to Phase Mapping

| Gap # | Title | Phase | Task(s) |
|-------|-------|-------|---------|
| 1 | FinCEN XML Generation | 4 | ~~P4-2~~ **DONE** (2026-02-21) |
| 2 | Treasury Exchange Rates | 4 | P4-1 |
| 3 | Stripe Live Keys | 3 | P3-1 |
| 4 | Next.js CVE-2025-55184 | 0 | P0-1 |
| 5 | SDTM SFTP Credentials | 3 | P3-2 |
| 6 | Submission Architecture | 4 | P4-3 |
| 7 | Open Redirect | 0 | P0-4 |
| 8 | S3 Presigned URLs | 3 | P3-3 |
| 9 | SDTM Host Key Verification | 3 | P3-2 |
| 10 | MFA / 2FA | 5 | P5-3 |
| 11 | JWT Revocation | 5 | P5-2 |
| 12 | Encryption Key Rotation | 5 | P5-4 |
| 13 | CSRF Auth Exemption | 5 | P5-1 |
| 14 | BSA-ID Email Polling | 4 | P4-3 (absorbed into Gap #6) |
| 15 | Drawn Signatures | 7 | P7-1 |
| 16 | Test Route Cleanup | 0 | P0-2 |
| 17 | GTM/GA4 Analytics | 3 | P3-4 |
| 18 | xlsx Package Replacement | 7 | P7-2 |
| 19 | Rate Limiter Persistence | -- | Accepted as-is (Option C) |
| 20 | Blog Content | 7 | P7-3 |
| 21 | X-XSS-Protection Header | 0 | P0-3 |
| 22 | Welcome/Signup Email | 7 | P7-4 |

## Appendix B: Security Audit Finding to Task Mapping

| Finding | Severity | Phase | Task(s) |
|---------|----------|-------|---------|
| C-01: Stub XML submitted to FinCEN | CRITICAL | 1 + 4 | P1-6 (gate), ~~P4-2~~ **DONE** (real XML + submit route gate fixed) |
| C-02 / Gap #07: Open redirect | HIGH | 0 | P0-4 |
| H-01: Forgot-password no Zod | HIGH | 1 | P1-1 |
| H-02: SFTP key path not validated | HIGH | 1 | P1-5 |
| H-03: SFTP host key not enforced | HIGH | 3 | P3-2 |
| H-04: S3 no server-side encryption | HIGH | 3 | P3-3 |
| H-05: Unsanitized filename | HIGH | 3 + 7 | P3-5+P3-6 (schema), upload route fix (P7) |
| H-06: payment_failed bad reversion | HIGH | 1 | P1-12 |
| M-01: In-memory rate limiter | MEDIUM | -- | Accepted for MVP; Redis at scale |
| M-02: safeDecrypt silent failure | MEDIUM | 5 | P5-4 |
| M-03: Health endpoint info disclosure | MEDIUM | 7 | Low priority |
| M-04: UTM params no DB constraint | MEDIUM | 3 | P3-5+P3-6 |
| M-05: Forgot-password timing | MEDIUM | 1 | P1-1 (resolved by same fix) |
| M-06: calendarYear not cross-checked | MEDIUM | 7 | Low priority |
| L-01: CSP unsafe-inline | LOW | 7 | Low priority |
| L-02: HSTS not set | LOW | 7 | 5-minute fix |
| L-03: Token accumulation | LOW | 7 | 10-minute fix |
| L-04 / Gap #16: Test route in prod | MEDIUM | 0 | P0-2 |

---

*This document is the authoritative implementation plan for the D2C FBAR Direct application. All work should reference this plan for sequencing, file ownership, and agent assignment. Updated: 2026-02-21 (Phases 0-3, 5-7 DONE; P4-2 FinCEN XML ported; E2E test suite T16-T28 added; frontend fixes F1-F6 applied. Remaining: P4-1 Treasury + P4-3 submission (~12 hr), P0-5 swap + P0-6 monitoring, MFA login enforcement wiring).*

---

## Post-Launch Additions

### Customer Support System (2026-02-28) — DONE (code), PENDING (manual infra)

AI-powered chat widget + contact form with email routing. Full documentation: [`d2c-support-system-2026-02-28.md`](./d2c-support-system-2026-02-28.md)

**Completed**:
- Floating chat widget (Claude Haiku 4.5, Vercel AI SDK v6, 19KB knowledge base)
- Contact form with Cloudflare Turnstile spam protection
- Contact page, nav links, sitemap updates, FAQ expansion (8 → 26 entries)
- Middleware CSP + auth exemptions for chat/contact endpoints

**Pending manual setup**:
- Cloudflare Turnstile widget creation + env vars (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
- Namecheap email forwarding (`support@fbardirect.com` → personal inbox)
- Docker rebuild + deploy (NEXT_PUBLIC_ vars baked at build time)
- Twilio toll-free number + voicemail TwiML Bin (~$2–3/mo) — CA Civil Code 1789.3 compliance + trust signal
- ForwardEmail.net Enhanced for reply-as `support@fbardirect.com` ($3/mo) — Gmail "Send mail as" integration
- Update contact page/footer/knowledge-base with phone number + UPS Store address
