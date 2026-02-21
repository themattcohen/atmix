# D2C Full Audit — All Phases (0-3, 5-7)

**Date**: 2026-02-19
**Scope**: Every source file and test file changed across Phases 0-7 (excluding Phase 4, not yet implemented)
**Method**: 5 parallel auditor agents (quality-engineer x3, security-engineer x2) each reviewing all source + test files for their phase

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 9 |
| HIGH | 28 |
| MEDIUM | 29 |
| LOW | 10 |
| Test Gaps | 47 |
| Test Quality Issues | 31 |

---

## CRITICAL FINDINGS (9)

### C1. MFA is never enforced at login (Phase 5)
**File**: `src/lib/auth.ts`
**Problem**: `mfaEnabled` and `mfaVerifiedAt` are stored on the user, but neither `authorize()`, the `jwt` callback, nor `middleware.ts` checks whether the user has MFA enabled. A user with `mfaEnabled: true` who logs in with their password gets a full session with no TOTP challenge. The entire MFA system is enrollment-only — it never actually gates access.
**Fix**: After successful password auth, return a partial session (`mfaPending: true`) and redirect to `/mfa-verify`. Block protected routes until TOTP is verified.
**Tests**: `mfa.test.ts` "MFA middleware guard" tests are stubs with `expect(true).toBe(true)`. E2E `mfa.spec.ts` flows are commented out.

### C2. tokenVersion revocation is documented but not implemented (Phase 5)
**File**: `src/lib/auth.ts:63-75`
**Problem**: `tokenVersion` is written to JWT at login but never validated on subsequent requests. The comment says "token revocation is handled by bumping tokenVersion" but the `jwt` callback never reads it back from DB. Existing JWTs with old tokenVersion values continue working for the full 7-day maxAge after password change or MFA disable.
**Fix**: In the `jwt` callback, fetch user from DB and compare `token.tokenVersion` to `user.tokenVersion`. Return invalid token if they differ. (Requires moving auth off Edge runtime since Prisma isn't available there.)
**Tests**: No test exists. Needed: bump tokenVersion in DB, verify old JWT is rejected.

### C3. Recovery code race condition allows double-use (Phase 5)
**File**: `src/app/api/auth/mfa/recovery/route.ts:26-42`
**Problem**: `if (recoveryCode.used)` check and `update({ used: true })` are separate DB operations with no transaction. Two concurrent requests with the same code both pass the check before either write commits.
**Fix**: Replace `findFirst` + `update` with a single atomic `updateMany` using `where: { id: recoveryCode.id, used: false }` and check `count === 0`.
**Tests**: No concurrent test exists.

### C4. MFA setup destroys recovery codes on repeated calls (Phase 5)
**File**: `src/app/api/auth/mfa/setup/route.ts:33-38`
**Problem**: `setup` deletes all existing recovery codes and creates new ones every time it's called. If a user calls setup twice (browser refresh, double-click), the first set of codes is silently destroyed before they can be saved. No guard prevents re-calling setup while `mfaEnabled === false`.
**Fix**: If `mfaSecret` is already set and `mfaEnabled === false`, return error or regenerate atomically in a transaction.
**Tests**: No test covers calling setup twice while `mfaEnabled === false`.

### C5. rollback.sh is a no-op — IMAGE_TAG parsed but never used (Phase 6)
**File**: `scripts/rollback.sh:47`
**Problem**: IMAGE_TAG is correctly parsed from `.last-deploy` but never passed to docker commands. `docker compose pull` and `docker compose up` use the hardcoded `image: ghcr.io/themattcohen/fbar-d2c:latest` from docker-compose.prod.yml. "Rollback" always deploys current latest.
**Fix**: Make compose file tag-parameterizable (`${D2C_IMAGE_TAG:-latest}`), export the variable in rollback.sh before invoking docker compose. Add shell-level tag validation.
**Tests**: TypeScript tests pass because they test `parseLastDeploy`/`isValidImageTag` in isolation, not the shell script.

### C6. deploy.sh records post-pull tag (always "latest") instead of pre-pull state (Phase 6)
**File**: `scripts/deploy.sh:14`
**Problem**: `docker compose pull` runs BEFORE capturing the current image. After pull, `docker compose images` reports the tag from the compose file, which is always "latest". So `.last-deploy` always contains `IMAGE_TAG=latest`. Even with C5 fixed, rollback would still deploy the same broken image.
**Fix**: Capture current image digest BEFORE pulling. Write `.last-deploy` only AFTER health check passes.
**Tests**: No test covers deploy.sh ordering.

### C7. CI test failures are silently ignored (Phase 6)
**File**: `.github/workflows/fbar-d2c-ci.yml:62`
**Problem**: `continue-on-error: true` on the test step means broken tests produce green CI. Build workflow runs in parallel with no dependency on CI, so broken commits get GHCR images pushed.
**Fix**: Remove `continue-on-error: true`. Gate build workflow on CI passing.
**Tests**: Pipeline-level structural problem.

### C8. FinCEN XML is a stub (Phase 0-2, known blocker)
**File**: `src/lib/fincen-xml.ts:25`
**Problem**: `generateFincenXml` returns an HTML comment stub. The submission route's XML validation gate (length >= 100, contains `<BSAMessage`) will always reject it. This is a known Phase 4 blocker but tests mock it away, hiding the production reality.
**Fix**: Phase 4 implementation (BLOCKED on B2B integration).
**Tests**: All tests mock `generateFincenXml`, so they pass while production is broken.

### C9. PUT /api/accounts/[id] doesn't scope update by userId (Phase 0-2)
**File**: `src/app/api/accounts/[accountId]/route.ts:84`
**Problem**: Ownership check uses `findFirst` with userId, but the subsequent `update` uses only `where: { id: params.accountId }` without userId. TOCTOU race window between check and update.
**Fix**: Use `updateMany` with `where: { id: params.accountId, userId: session.user.id }` and check result count.
**Tests**: Tests verify ownership via 404 for wrong-user, but don't verify the update itself is scoped.

---

## HIGH FINDINGS (28)

### H1. No TOTP replay protection (Phase 5)
**File**: `src/lib/mfa.ts:25-37`
**Problem**: Same 6-digit TOTP accepted multiple times within 90-second window. No recently-used token cache.
**Fix**: Cache `(userId, token)` pairs for 90 seconds, reject reuse.

### H2. Recovery codes use unsalted SHA-256 (Phase 5)
**File**: `src/lib/mfa.ts:43-56`
**Problem**: Plain `sha256(code)` with no salt. If MfaRecoveryCode table is compromised, all codes exposed to precomputation attack.
**Fix**: Use bcrypt/scrypt with per-code salt, or HMAC with application secret.

### H3. ENCRYPTION_KEY_PREV fallback skipped for versioned ciphertext (Phase 5)
**File**: `src/lib/encryption.ts:71-86`
**Problem**: When `v1:`-prefixed ciphertext fails decryption with current key, it throws without trying ENCRYPTION_KEY_PREV. `isVersioned` variable is dead code.
**Fix**: Try fallback for both versioned and unversioned ciphertext.

### H4. Middleware path normalization bypass (Phase 5)
**File**: `src/middleware.ts:76`
**Problem**: Regex `/\/\.+\//g` doesn't handle trailing `..` without trailing slash, or `%2F`-encoded paths.
**Fix**: Rely on URL constructor normalization, remove misleading custom regex. Add explicit tests.

### H5. TOTP verify enables MFA without confirming recovery code save (Phase 5)
**File**: `src/app/api/auth/mfa/verify/route.ts`
**Problem**: Sets `mfaEnabled: true` immediately on valid TOTP, no confirmation user saved recovery codes.
**Fix**: Require user to confirm receipt (checkbox or re-entry of one code).

### H6. MFA routes not in strict rate limit (Phase 5)
**File**: `src/middleware.ts:119-133`
**Problem**: MFA verify/recovery get 60 req/min general limit instead of 5 req/min auth limit. Brute-force TOTP trivially possible.
**Fix**: Add `/api/auth/mfa/verify` and `/api/auth/mfa/recovery` to `AUTH_RATE_LIMIT_PATHS`.

### H7. mfaSecret stored in plaintext (Phase 5)
**File**: `src/lib/auth.ts` / `prisma/schema.prisma`
**Problem**: TOTP secret stored unencrypted. DB compromise exposes all users' TOTP secrets permanently.
**Fix**: Encrypt `mfaSecret` at rest using `encrypt()`/`decrypt()`.

### H8. Logger PII scrubbing doesn't recurse into nested objects (Phase 6)
**File**: `src/lib/logger.ts:44-48`
**Problem**: `scrubMeta` only processes top-level string values. Nested objects and arrays pass through unscrubbed. `{ user: { ssn: "123-45-6789" } }` leaks raw PII.
**Fix**: Make `scrubMeta` recursive for objects and arrays.

### H9. CI build runs in parallel with CI tests — no ordering (Phase 6)
**File**: `.github/workflows/fbar-d2c-build.yml`
**Problem**: Build+push and CI test workflows trigger independently on push to main. Broken commit images can reach GHCR before CI finishes.
**Fix**: Combine into single workflow with `needs: [ci]` on build job.

### H10. d2c-migrate builds locally while d2c-app pulls from GHCR (Phase 6)
**File**: `docker-compose.prod.yml:262-275`
**Problem**: Migration runs on locally-built image, app runs on GHCR image. Schema versions can diverge.
**Fix**: `d2c-migrate` should use same `image:` as `d2c-app`.

### H11. Sentry PII scrubbing missing from client and edge configs (Phase 3)
**File**: `sentry.client.config.ts`, `sentry.edge.config.ts`
**Problem**: `beforeSend: scrubPii` only wired in server config. Browser and middleware errors sent to Sentry without PII redaction.
**Fix**: Add `beforeSend` hook to both configs.

### H12. Sentry blocked by CSP (Phase 3)
**File**: `next.config.js:41`, `sentry.client.config.ts:4`
**Problem**: `connect-src` doesn't include `*.ingest.sentry.io`. All browser Sentry events silently dropped.
**Fix**: Add Sentry ingest endpoint to `connect-src`.

### H13. validateSdtmConfig() never called at startup (Phase 3)
**File**: `src/lib/sdtm.ts` (no `instrumentation.ts`)
**Problem**: Function exists and works but is never invoked. P3-2 is functionally incomplete — dead code.
**Fix**: Create `src/instrumentation.ts` with `register()` that calls `validateSdtmConfig()`.

### H14. checkAcknowledgement stores bsaId: "undefined" (string) (Phase 3)
**File**: `src/lib/sdtm.ts:172-173`
**Problem**: `String(undefined) === "undefined"` when all BSA ID fields are absent from ack XML.
**Fix**: Guard with `raw != null ? String(raw) : undefined`.

### H15. ackDir string replace is fragile (Phase 3)
**File**: `src/lib/sdtm.ts:129-131`
**Problem**: `.replace("/upload", "/download")` matches first occurrence anywhere in the string. Non-standard paths produce corrupt ack directories.
**Fix**: Use dedicated `SDTM_ACK_DIR` env var.

### H16. Statement.filingYear relation missing onDelete cascade (Phase 3)
**File**: `prisma/schema.prisma:226`
**Problem**: FK with no onDelete can cause cascade-delete failures when deleting a User.
**Fix**: Add `onDelete: Cascade` to the relation.

### H17. Drawn signature not validated before addImage (Phase 7)
**File**: `src/lib/form114a.ts:92-104`
**Problem**: Malformed/empty base64 silently falls back to placeholder text. Legally binding Form 114a gets generic stamp while user thinks they signed.
**Fix**: Validate base64 before addImage, throw on invalid so sign route returns 400.

### H18. addImage prepends data URI prefix — double-encoding risk (Phase 7)
**File**: `src/lib/form114a.ts:93`
**Problem**: Code prepends `data:image/png;base64,` but browser `canvas.toDataURL()` already returns full URI. Result: `data:image/png;base64,data:image/png;base64,...` — jsPDF rejects, silent fallback.
**Fix**: Strip any existing data URI prefix from signatureData.

### H19. isJointAccount hardcoded false even for BOTH ownership (Phase 7)
**File**: `src/lib/extraction-mapper.ts:52`
**Problem**: `isJointAccount: false` unconditionally, ignoring ownership_type "BOTH".
**Fix**: `isJointAccount: ownershipType === "BOTH"`.

### H20. Case mismatch between prompt schema and TypeScript type (Phase 7)
**File**: `src/lib/prompts.ts:41`, `src/types/extraction.ts:27`
**Problem**: Prompt tells LLM to return UPPERCASE; TypeScript type declares lowercase. Works only because mapper does `.toLowerCase()`.
**Fix**: Align casing consistently.

### H21. isPermanentError treats 429 as permanent (Phase 7)
**File**: `src/lib/email.ts:182-185`
**Problem**: HTTP 429 (rate limit) classified as permanent, so sendEmailWithRetry won't retry on Resend rate limits.
**Fix**: Exclude 429: `status >= 400 && status < 500 && status !== 429`.

### H22. unsafe-inline in production CSP script-src (Phase 7)
**File**: `next.config.js:23`
**Problem**: `'unsafe-inline'` defeats XSS protection in a financial/PII application.
**Fix**: Remove and use nonce-based approach.

### H23. ExcelJS load() has incorrect type cast (Phase 7)
**File**: `src/lib/extraction.ts:66`
**Problem**: `buffer as unknown as ArrayBuffer` bypasses TypeScript without converting. Works at runtime because Buffer is Uint8Array, but misleading and fragile.
**Fix**: Remove cast, use `await workbook.xlsx.load(buffer)`.

### H24. result.accounts.length accessed without null guard (Phase 7)
**File**: `src/lib/extraction.ts:175`
**Problem**: If LLM returns JSON without "accounts" key, TypeError at line 175. Creates stuck DB record.
**Fix**: Guard with `result.accounts?.length ?? 0`, validate accounts is array.

### H25. calendarYear not validated as integer (Phase 0-2)
**File**: `src/app/api/filing/route.ts:62`
**Problem**: `calendarYear: "abc"` passes range checks (NaN comparisons return false) and reaches Prisma.
**Fix**: Add `Number.isInteger(calendarYear)` check, or use Zod.

### H26. Stripe webhook metadata userId/filingYearId not cross-validated (Phase 0-2)
**File**: `src/app/api/stripe/webhook/route.ts:77`
**Problem**: Tampered metadata could update payment for wrong user's filing. Defense-in-depth gap.
**Fix**: After verifying filing, use filing's actual userId for payment update.

### H27. POST /api/accounts returns stale maxValueUsd (Phase 0-2)
**File**: `src/app/api/accounts/route.ts:119-132`
**Problem**: Response contains the pre-update account object where maxValueUsd is null.
**Fix**: Re-fetch account after maxValueUsd update, or compute before create.

### H28. Filing tier route has no Zod validation (Phase 0-2)
**File**: `src/app/api/filing/tier/route.ts`
**Problem**: `filingYearId: false` or `filingYearId: 0` passes `!filingYearId` check.
**Fix**: Add Zod schema with `z.string().min(1)`.

---

## MEDIUM FINDINGS (29)

### M1. MFA setup operations not in transaction (P5) — mfaSecret, deleteMany, createMany are 3 separate operations
### M2. Recovery codes only 40 bits entropy (P5) — NIST recommends 64+ bits
### M3. Rotation script processes batches individually (P5) — partial failure leaves mixed state
### M4. tinLast4 extraction overly complex (P5) — `slice(-4)` on short TIN, correct but fragile
### M5. setInterval in middleware leaks across serverless invocations (P5) — single-instance only
### M6. Middleware auth rate-limit blanket exclusion (P5) — `/api/auth/` routes skip general rate limit
### M7. sendEmailWithRetry exported but never wired (P7) — retry infrastructure disconnected from send functions
### M8. extraction-mapper warnings spread fails on undefined (P7) — `[...extracted.warnings]` crashes if null
### M9. extraction-mapper bank_address.country no null guard (P7) — TypeError if bank_address is null
### M10. Typed signature not length-limited (P7) — long text overflows PDF signature region
### M11. S3 key uses Date.now() not UUID (P7) — collision risk on concurrent sign calls
### M12. convertExcelToText no row count limit (P7) — malicious XLSX can OOM the 1.9GB VPS
### M13. Model name hardcoded (P7) — deprecation would silently break all extractions
### M14. signup fire-and-forget can 500 if RESEND_API_KEY missing (P7) — synchronous throw escapes .catch()
### M15. forgot-password email not wrapped in retry (P7) — transient failures silently drop reset emails
### M16. sanitizeFileName no max length and not exported (P7) — untestable, no length enforcement
### M17. deploy.sh overwrites .last-deploy before health check (P6) — previous rollback point lost
### M18. rollback.sh IMAGE_TAG not validated for shell injection (P6) — once C5 is fixed, becomes injection vector
### M19. checkHealth timer leak on error path (P6) — clearTimeout not in finally block
### M20. SDTM validateSdtmConfig doesn't check SDTM_HOST/USERNAME (P3) — non-sandbox can pass validation then fail at connect
### M21. SFTP sftp() callback has no timeout (P3) — can hang indefinitely after SSH ready
### M22. checkAcknowledgement swallows all SFTP errors as "pending" (P3) — can't distinguish error from waiting
### M23. Sentry regex /g flag shares state across calls (P3) — direct regex use corrupts lastIndex
### M24. Sentry IBAN regex only matches uppercase (P3) — mixed-case IBANs leak through
### M25. S3 client caches empty credentials at first call (P3) — env changes after init ignored
### M26. S3_SERVER_SIDE_ENCRYPTION not validated (P3) — invalid values forwarded to SDK
### M27. Prisma version skew between Dockerfile global and project (P3) — migration feature mismatch risk
### M28. forgot-password email not case-normalized consistently (P0-2) — signup may store mixed case
### M29. validateMagicBytes returns true for unknown MIME types (P0-2) — future types silently bypass

---

## LOW FINDINGS (10)

### L1. encrypt("") returns "" silently (P5) — empty indistinguishable from "never encrypted"
### L2. Sentry scrubPii doesn't cover event.extra (P3) — PII in extra transmitted unredacted
### L3. extractionStatus is plain String, no enum (P3) — any typo persists silently
### L4. sdtm.ts log message references wrong env var name (P0-2) — "SFTP_HOST_KEY" vs "SDTM_HOST_KEY"
### L5. payment page window.location.href no typeof guard (P0-2) — fragile with SSR
### L6. import route returns inconsistent shapes for empty case (P0-2)
### L7. Sentry connect-src missing from CSP (P7) — duplicate of H12
### L8. next.config.js read_only latent risk with Next.js (P6)
### L9. email backoff has no jitter (P7) — thundering herd on bulk failures
### L10. signup unique constraint detection uses string matching (P7) — fragile across Prisma versions

---

## TEST GAPS (47)

### Completely Untested Source Files/Functions
1. `src/app/api/accounts/import/route.ts` — zero test coverage (advisory lock, concurrent guard, validation)
2. `src/app/api/filing/tier/route.ts` — zero test coverage
3. `src/lib/sdtm.ts:checkAcknowledgement()` — zero test coverage
4. `src/lib/sdtm.ts:submitBatch()` production path — zero test coverage
5. `src/lib/s3.ts:downloadFile()` — zero test coverage
6. `src/lib/s3.ts:deleteFile()` — zero test coverage

### Critical Behavior Not Tested
7. tokenVersion revocation (C2)
8. MFA enforcement at login (C1)
9. MFA setup called twice (C4)
10. Recovery code concurrent redemption (C3)
11. TOTP replay (same token twice) (H1)
12. TOTP window drift boundary
13. Versioned ciphertext fallback to ENCRYPTION_KEY_PREV (H3)
14. Partial rotation script failure recovery
15. MFA routes rate limiting
16. hashRecoveryCode normalization (case, dashes)
17. MFA setup transaction atomicity

### Missing Validation Tests
18. POST /api/filing with non-integer calendarYear (H25)
19. filing/review with non-string filingYearId
20. filing/tier route — all paths untested (H28)
21. accounts/[id] GET single account by ID
22. SDTM submit: filing belonging to another user
23. Stripe webhook: missing STRIPE_WEBHOOK_SECRET env var
24. normalizeMimeType for xlsx with text/plain type

### Missing Response/State Tests
25. POST /api/accounts response body maxValueUsd staleness (H27)
26. DELETE account doesn't affect other accounts' maxValueUsd
27. sdtm/submit response submittedAt vs DB value mismatch
28. mixed-case email forgot-password lookup

### Phase 7 Gaps
29. Malformed/empty base64 drawn signature (H17)
30. Data URI double-encoding for drawn signature (H18)
31. isJointAccount when ownership_type is "both" (H19)
32. Null/undefined bank_address or missing country (M9)
33. Null warnings array in extraction mapper (M8)
34. LLM response with missing/null accounts array (H24)
35. sendEmailWithRetry never wired into send functions (M7)
36. 429 rate-limit classified as permanent error (H21)
37. signup when RESEND_API_KEY missing (synchronous throw) (M14)
38. sanitizeFileName max-length and actual behavior (M16)
39. No-extension file fallback in extraction

### Phase 6 Gaps
40. Logger PII in nested meta objects (H8)
41. Logger PII in array meta values
42. checkHealth timer cleanup on error (M19)
43. isValidImageTag with non-alphanumeric first char
44. Shell-level rollback verification
45. deploy.sh pre-pull state capture

### Phase 3 Gaps
46. S3 presigned URL uses public vs private client
47. CSP header values (no test anywhere)

---

## TEST QUALITY ISSUES (31)

### Always-Pass Stubs (highest priority — these create false confidence)
1. `mfa.test.ts:484-492` — MFA middleware guard: `expect(true).toBe(true)` x2
2. `mfa.spec.ts:93-256` — 7 of 11 E2E tests are `expect(true).toBe(true)` stubs
3. `security-lowpri.test.ts:75-104` — HSTS test always passes regardless of config
4. `security-lowpri.test.ts:259-305` — All 3 fileName sanitization tests are hollow placeholders
5. `security-lowpri.test.ts:328-341` — Rate limiting test: `expect(true).toBe(true)`
6. `rollback.test.ts:338-346` — catch block always passes: `expect(true).toBe(true)`

### Overly Permissive Assertions (pass when code is broken)
7. `security-lowpri.test.ts:213` — calendarYear cross-check accepts 201 as valid alongside 400
8. `extraction-ownership.test.ts:97-115` — SIGNATURE_AUTHORITY test accepts default FINANCIAL_INTEREST
9. `extraction-ownership.test.ts:117-131` — BOTH test same issue
10. `filing.test.ts:68-85` — Invalid JSON body accepts both 400 and 500
11. `extraction-exceljs.test.ts:80-94` — Empty spreadsheet only asserts `typeof result === "string"`

### Mock/Setup Issues
12. `webhook-guard.test.ts:87-88` — process.env.STRIPE_WEBHOOK_SECRET set globally, never cleaned up
13. `sdtm-submit.test.ts:96-98` — afterEach dynamic import to re-mock is fragile
14. `security-lowpri.test.ts:114` — vi.mock inside describe block may not hoist correctly
15. `form114a-signature.test.ts:58` — mock call count accumulates without beforeEach clear
16. `s3-presigned.test.ts:62-68` — restoreAllMocks in afterEach is no-op for module mocks

### Wrong Assertions
17. `accounts.test.ts:304` — Regex tests encryption format (implementation detail) not behavioral property
18. `sdtm-submit.test.ts:119` — Doesn't verify batchId in response matches batchId in DB
19. `s3-presigned.test.ts:166` — Bucket assertion only checks property exists, not correct value
20. `sentry-scrub.test.ts:128` — Only asserts not.toContain, never what replacement is
21. `encryption-rotation.test.ts:119` — v1: prefix assertion is commented out
22. `logger.test.ts:323-328` — Nested object test gives false confidence (no PII in test data)

### Fixture/Naming Issues
23. `mfa.test.ts:385` — Recovery code fixture "USED-CODE12" has non-hex chars
24. `encryption-rotation.test.ts:288-294` — Test name says "pre-P5-4 behavior" but behavior unchanged
25. `extraction-ownership.test.ts:51` — confidence field is scalar "high" not object (wrong shape)
26. `filing-review.test.ts:62-63` — Password "TestPassword1" may fail if schema tightens
27. `csrf.test.ts:252-257` — Path traversal test: URL constructor normalizes before middleware sees it

### Structural Issues
28. `logger.test.ts:33-38` — expect() inside helper obscures failure location
29. `schema-migration.test.ts:25-29` — afterAll only deletes User, no explicit Statement/FilingYear cleanup
30. `s3-presigned.test.ts` — afterEach restoreAllMocks misleading for module-level mocks
31. `sdtm-config.test.ts` — no test exercises isSandbox() through submitBatch() to verify sandbox flag honored

---

## RECOMMENDED FIX ORDER

### Batch 1: Stop the Bleeding (CI + Deploy)
1. **C7**: Remove `continue-on-error: true` from CI test step
2. **H9**: Gate build workflow on CI passing (combine into single workflow or use workflow_run)
3. Create `.eslintrc.json` + install eslint packages (fix GitHub Actions lint failure)
4. **C5 + C6**: Rewrite deploy.sh and rollback.sh (capture pre-pull state, use tag in docker commands, parameterize compose file)
5. **H10**: Fix d2c-migrate to use same image as d2c-app

### Batch 2: Security Critical
6. **C1 + C2**: Implement MFA login enforcement + tokenVersion validation
7. **C3**: Atomic recovery code redemption
8. **C4**: Prevent MFA setup double-call
9. **H1**: TOTP replay protection
10. **H6**: Add MFA routes to strict rate limit
11. **H7**: Encrypt mfaSecret at rest
12. **H2**: Salt recovery code hashes

### Batch 3: Data Integrity
13. **C9**: Scope PUT update by userId (TOCTOU fix)
14. **H3**: Fix encryption fallback for versioned ciphertext
15. **H25**: Validate calendarYear as integer
16. **H27**: Return fresh account data after maxValueUsd update
17. **H28**: Add Zod to tier route
18. **H16**: Add onDelete Cascade to Statement.filingYear

### Batch 4: PII/Compliance
19. **H8**: Make logger scrubMeta recursive
20. **H11**: Add scrubPii to Sentry client + edge configs
21. **H12**: Add Sentry ingest to CSP connect-src
22. **H22**: Remove unsafe-inline from production CSP
23. **H13**: Create instrumentation.ts for startup validation

### Batch 5: Phase 7 Fixes
24. **H17 + H18**: Validate drawn signature, handle data URI prefix
25. **H19**: Fix isJointAccount for BOTH ownership
26. **H20**: Align ownership_type casing
27. **H21**: Exclude 429 from permanent errors
28. **H23 + H24**: Fix ExcelJS cast, add accounts null guard
29. **M7**: Wire sendEmailWithRetry into actual send functions

### Batch 6: Test Fixes
30. Delete all `expect(true).toBe(true)` stubs — replace with `.skip` or `.todo`
31. Tighten overly permissive assertions
32. Fix mock/setup issues
33. Add missing test coverage for CRITICAL and HIGH findings
34. Export sanitizeFileName, write real tests

### Batch 7: Medium Priority
35. All remaining MEDIUM findings
36. All remaining test gaps
37. All remaining LOW findings
