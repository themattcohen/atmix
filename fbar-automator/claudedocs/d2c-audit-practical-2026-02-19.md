# D2C Audit — Practical Pre-Launch Assessment

**Date**: 2026-02-19
**Context**: Pre-launch. Zero users. Zero production traffic. Single VPS.

The raw audit found 76 code findings + 78 test issues. Most are theoretical, paranoid, or things that only matter post-scale. Here's what actually matters.

---

## Tier 1: Actually Broken Right Now

These are real bugs or things actively causing problems.

| # | What | File | Why it matters | Effort |
|---|------|------|---------------|--------|
| 1 | CI lint step fails — no `.eslintrc.json`, no eslint packages | `.github/workflows/fbar-d2c-ci.yml` | Causing GitHub notification spam on every push | 5 min |
| 2 | `continue-on-error: true` on test step | `fbar-d2c-ci.yml:62` | CI is meaningless — tests can fail and it's green | 1 min |
| 3 | Build workflow races CI — no ordering | `fbar-d2c-build.yml` | Broken commit images can reach GHCR before tests finish | 15 min |
| 4 | rollback.sh parses IMAGE_TAG but never uses it | `scripts/rollback.sh:47` | Rollback is a no-op. Docker commands always pull `:latest` | 30 min |
| 5 | deploy.sh captures image tag AFTER pull (always "latest") | `scripts/deploy.sh:14` | Even with #4 fixed, rollback would deploy the same broken image | 30 min |
| 6 | d2c-migrate builds locally, d2c-app pulls from GHCR | `docker-compose.prod.yml` | Schema/app version can diverge after deploy | 5 min |

**Total: ~1.5 hours. Should be done first because CI is actively broken.**

---

## Tier 2: Real Bugs (fix before launch)

These are logic errors that would affect users in the actual product flow.

| # | What | File | Why it matters | Effort |
|---|------|------|---------------|--------|
| 7 | PUT /accounts update not scoped by userId | `accounts/[accountId]/route.ts:84` | TOCTOU race. Tiny window with UUIDs, but easy fix — use `updateMany` with userId | 10 min |
| 8 | POST /accounts returns stale maxValueUsd in response | `accounts/route.ts:119` | Client shows null maxValueUsd even for USD accounts | 10 min |
| 9 | isJointAccount hardcoded `false` for BOTH ownership | `extraction-mapper.ts:52` | Joint accounts stored incorrectly, UI won't prompt for joint owner | 5 min |
| 10 | Drawn signature silent fallback to text on error | `form114a.ts:92-104` | User thinks they signed, PDF has `[Digital signature on file]` placeholder | 15 min |
| 11 | addImage prepends `data:image/png;base64,` — double-encoding | `form114a.ts:93` | Browser canvas.toDataURL() already includes prefix → jsPDF rejects → silent fallback | 10 min |
| 12 | extraction-mapper crashes on null warnings/bank_address | `extraction-mapper.ts:35,49` | LLM returns unexpected null → TypeError → stuck extraction | 10 min |
| 13 | result.accounts.length no null guard | `extraction.ts:175` | LLM returns JSON without accounts key → TypeError → 500 | 5 min |
| 14 | ExcelJS buffer cast (`as unknown as ArrayBuffer`) | `extraction.ts:66` | Works at runtime but hides real type. Just remove the cast. | 2 min |
| 15 | sendEmailWithRetry exists but is never wired in | `email.ts` | Dead code. Welcome/reset emails have zero retry. Wire it or delete it. | 15 min |
| 16 | isPermanentError treats 429 as permanent | `email.ts:182` | Resend rate limit → email silently dropped instead of retried | 2 min |
| 17 | checkHealth timer leak on error path | `deploy.ts:59-71` | Missing `finally { clearTimeout(timeout) }` | 2 min |
| 18 | Logger PII scrub doesn't recurse nested objects | `logger.ts:44-48` | `{ user: { ssn: "123-45-6789" } }` leaks in logs | 15 min |
| 19 | Encryption fallback skips versioned ciphertext | `encryption.ts:71-86` | After key rotation, v1-encrypted data becomes undecryptable | 10 min |
| 20 | calendarYear not validated as integer | `filing/route.ts:62` | `calendarYear: "abc"` passes range check → Prisma 500 | 5 min |
| 21 | Statement.filingYear missing onDelete Cascade | `schema.prisma:226` | User deletion can fail with FK violation depending on Postgres constraint order | 5 min + migration |
| 22 | checkAcknowledgement stores bsaId: "undefined" (string) | `sdtm.ts:172` | `String(undefined)` → literal string "undefined" as FinCEN tracking ID | 5 min |
| 23 | ackDir derived by fragile string replace | `sdtm.ts:129` | Non-default SDTM_REMOTE_DIR → corrupt acknowledgement directory | 5 min |
| 24 | ownership_type case mismatch (prompt=UPPER, type=lower) | `prompts.ts` / `extraction.ts` | Works because mapper lowercases, but type system lies about runtime values | 10 min |
| 25 | Typed signature not length-limited in PDF | `form114a.ts:88` | 10,000-char name overflows signature region | 5 min |
| 26 | sanitizeFileName not exported, no max length | `upload/route.ts:10-19` | Untestable and no length cap | 10 min |

**Total: ~3 hours. Straightforward fixes, mostly one-liners or small refactors.**

---

## Tier 3: Should Fix (but won't bite you pre-launch)

These are real but the impact is low given zero users and a single VPS.

| # | What | Notes |
|---|------|-------|
| 27 | MFA not enforced at login | MFA is an incomplete feature, not a breach. No users have enabled MFA. Finish before marketing MFA as a feature. |
| 28 | tokenVersion not validated in JWT callback | By design — Edge runtime can't run Prisma. The 7-day maxAge IS the revocation. The comment in auth.ts explains this. Not a bug. |
| 29 | MFA setup destroys codes on double-call | UX bug. Add a guard for `mfaEnabled === false && mfaSecret exists`. |
| 30 | MFA routes not in strict rate limit | Add to AUTH_RATE_LIMIT_PATHS. One-liner. |
| 31 | Recovery code race condition | Requires two simultaneous requests with the same code. Upgrade to atomic updateMany for correctness, but this is not urgent. |
| 32 | validateSdtmConfig never called at startup | SDTM isn't configured yet (sandbox mode). Create instrumentation.ts before going live with SFTP. |
| 33 | Sentry client/edge configs missing scrubPii | Sentry config files are still untracked. Wire scrubPii into all three configs when you set up Sentry properly. |
| 34 | Sentry blocked by CSP connect-src | Same — add ingest endpoint when Sentry is actually configured. |
| 35 | unsafe-inline in CSP script-src | Common Next.js trade-off. Nonce-based CSP is a half-day project. Do it, but not blocking. |
| 36 | S3 client caches empty credentials | Env vars are set at container start. Not a runtime issue. Add startup validation alongside #32. |
| 37 | S3_SERVER_SIDE_ENCRYPTION not validated | Cast is fine if you control the .env file (you do). |
| 38 | Prisma version skew in Dockerfile | Pin global to match project, or just use local binary. |
| 39 | signup fire-and-forget can 500 if RESEND_API_KEY missing | Wrap in double try-catch. Only matters if env is misconfigured. |
| 40 | forgot-password email case normalization | Signup does lowercase. Consistent enough. |
| 41 | convertExcelToText no row count limit | Upload route has a file size limit. Add a 5000-row cap as defense-in-depth. |
| 42 | sdtm.ts wrong env var name in log message | Typo. "SFTP_HOST_KEY" should be "SDTM_HOST_KEY". |

---

## Tier 4: Not Real Issues (auditor paranoia)

These were flagged but aren't actual problems. Dropping them.

| What | Why it's fine |
|------|--------------|
| TOTP replay within 90-second window | Requires intercepting a valid TOTP mid-flight. Not a realistic threat. |
| Recovery codes use unsalted SHA-256 | If attacker has DB access, they don't need recovery codes — they have everything. |
| mfaSecret stored in plaintext | Same — DB compromise = game over regardless. |
| TOTP verify without recovery code save confirmation | UX preference, not security. |
| Advisory lock hash collision | 2^32 collision probability for concurrent imports. Not a thing. |
| setInterval leaks across serverless invocations | You're on a single VPS, not serverless. |
| Sentry regex /g flag state corruption | Nothing calls the regex directly. scrubString uses .replace() which resets lastIndex. |
| Stripe webhook metadata cross-validation | Requires valid webhook signature (webhook secret). If they have that, it's already over. |
| Filing tier route no Zod | Manual check works. `filingYearId: false` from a browser? No. |
| encrypt("") returns "" | By design. |
| payment page window.location.href no typeof guard | `"use client"` component. Won't SSR. |
| Hardcoded model name | Intentional. You pin model versions for consistent extraction. |

---

## Test Issues — What Actually Needs Fixing

### Delete these (always-pass stubs that lie about coverage)
| Test | Problem | Fix |
|------|---------|-----|
| `mfa.test.ts:484-492` | `expect(true).toBe(true)` x2 | `test.todo()` or delete |
| `mfa.spec.ts` 7 of 11 tests | `expect(true).toBe(true)` stubs | `test.todo()` |
| `security-lowpri.test.ts` HSTS, fileName, rate limit | All placeholders | `test.todo()` or write real tests |
| `rollback.test.ts:338-346` | Catch block always passes | Use `expect.assertions(1)` |

### Tighten these (pass when code is broken)
| Test | Problem | Fix |
|------|---------|-----|
| `extraction-ownership.test.ts:97-131` | Accepts default value as correct | Tighten to exact `.toBe()` |
| `security-lowpri.test.ts:213` | Accepts 201 alongside 400 | Tighten after implementation |
| `filing.test.ts:68-85` | Accepts 400 or 500 for bad JSON | Should be exactly 400 |
| `extraction-exceljs.test.ts:80-94` | Only checks `typeof === "string"` | Assert expected content |

### Fix these (mock/setup issues)
| Test | Problem | Fix |
|------|---------|-----|
| `webhook-guard.test.ts:87` | Env var leak between suites | Save/restore in afterAll |
| `form114a-signature.test.ts:58` | Mock count accumulates | Add `beforeEach(() => vi.clearAllMocks())` |
| `encryption-rotation.test.ts:119` | v1: prefix assertion commented out | Uncomment it |

### Write these (real gaps)
| Gap | Why it matters |
|-----|---------------|
| `accounts/import/route.ts` | Zero coverage on a write-heavy route |
| `filing/tier/route.ts` | Zero coverage |
| Drawn signature with malformed base64 | Core signing flow |
| isJointAccount for BOTH ownership | Logic bug needs regression test |
| Logger nested PII scrubbing | Once fixed, needs regression test |
| calendarYear non-integer input | Once fixed, needs regression test |

---

## Recommended Fix Plan

### Sprint 1: CI + Deploy (~2 hours)
Fix the stuff that's actively broken on GitHub.

1. Create `.eslintrc.json`, install eslint + eslint-config-next
2. Remove `continue-on-error: true` from test step
3. Combine CI + build into single workflow OR add `workflow_run` dependency
4. Rewrite deploy.sh: capture pre-pull state, write .last-deploy after health check
5. Rewrite rollback.sh: use IMAGE_TAG in docker commands, validate tag
6. Parameterize docker-compose.prod.yml image tag (`${D2C_IMAGE_TAG:-latest}`)
7. Fix d2c-migrate to use same image as d2c-app
8. Delete all `expect(true).toBe(true)` test stubs → `test.todo()`

### Sprint 2: Logic Bugs (~3 hours)
Fix the actual bugs before any user touches the product.

9. PUT accounts: `updateMany` with userId
10. POST accounts: re-fetch after maxValueUsd update
11. isJointAccount: derive from ownership_type
12. form114a: validate base64, strip data URI prefix, throw on invalid
13. extraction-mapper: null guards on warnings, bank_address
14. extraction.ts: accounts null guard, remove ExcelJS cast
15. calendarYear integer validation
16. Logger: recursive PII scrubbing
17. Encryption: fallback for versioned ciphertext
18. Schema: onDelete Cascade on Statement.filingYear (+ migration)
19. checkAcknowledgement: guard bsaId, fix ackDir derivation
20. Ownership type casing alignment
21. checkHealth: add `finally` block
22. sanitizeFileName: extract, export, add max length
23. Typed signature length limit in PDF

### Sprint 3: Email + Deploy Helpers (~1 hour)
24. Wire sendEmailWithRetry into actual send functions OR delete it
25. Fix isPermanentError to exclude 429
26. signup fire-and-forget: wrap in safe async IIFE

### Sprint 4: Test Hardening (~2 hours)
27. Tighten overly permissive assertions
28. Fix mock/setup issues
29. Write tests for import route, tier route
30. Write tests for drawn signature malformed input
31. Write regression tests for all Sprint 2 fixes

### Sprint 5: Pre-Launch Polish (when ready)
32. Complete MFA login enforcement (if marketing MFA)
33. MFA rate limiting, setup double-call guard, atomic recovery
34. Sentry: wire scrubPii into all configs, add to CSP
35. CSP: remove unsafe-inline (nonce approach)
36. instrumentation.ts for startup validation
37. Row count limit on Excel parsing
