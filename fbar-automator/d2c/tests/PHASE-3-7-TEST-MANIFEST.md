# Phase 3-7 Test Manifest

**Created:** 2026-02-19
**Purpose:** Pre-implementation test suite for D2C FBAR Phases 3-7
**Total new test files:** 22 (17 Vitest API + 5 Playwright E2E)

All tests reference task IDs from `claudedocs/d2c-implementation-plan-2026-02-19.md` and include `// IMPLEMENTATION NEEDED:` comments marking functions/routes that must be created during implementation.

---

## Phase 3: Infrastructure & Configuration (4 files)

| File | Task | Framework | Tests | What It Validates |
|------|------|-----------|-------|-------------------|
| `tests/api/sdtm-config.test.ts` | P3-2 | Vitest | 8 | SDTM startup validation: rejects missing SDTM_HOST_KEY in production mode |
| `tests/api/s3-presigned.test.ts` | P3-3 | Vitest | 6 | getPresignedUrl() expiry, ServerSideEncryption: AES256 on PutObject |
| `tests/api/schema-migration.test.ts` | P3-5/6 | Vitest | 11 | Statement FK, FilingYear index, UTM VarChar(200), fileName VarChar(255) |
| `tests/api/sentry-scrub.test.ts` | P3-9 | Vitest | 17 | beforeSend PII scrubbing (SSN, account numbers, nested exception data) |

**Subtotal:** 42 tests

---

## Phase 4: Filing Pipeline Core (3 files)

| File | Task | Framework | Tests | What It Validates |
|------|------|-----------|-------|-------------------|
| `tests/api/treasury.test.ts` | P4-1 | Vitest | 17 | getExchangeRate(), caching, API fallback, DB sync |
| `tests/api/fincen-xml.test.ts` | P4-2 | Vitest | 22 | XML generation: 1 acct, 25+ accts, joint, multi-currency, XSD validation |
| `tests/api/submission-cron.test.ts` | P4-3 | Vitest | 18 | Cron pickup, idempotent submit, acknowledgement polling, email notifications |

**Subtotal:** 57 tests
**Note:** Phase 4 is BLOCKED on B2B porting. Tests are designed ahead of implementation.

---

## Phase 5: Security Hardening (4 files)

| File | Task | Framework | Tests | What It Validates |
|------|------|-----------|-------|-------------------|
| `tests/api/csrf.test.ts` | P5-1 | Vitest | 18 | Narrowed CSRF exemption list, custom auth routes require header |
| `tests/api/mfa.test.ts` | P5-3 | Vitest | 22 | MFA setup, verify, disable, recovery codes, middleware redirect |
| `tests/e2e/mfa.spec.ts` | P5-3 | Playwright | 12 | MFA setup UI, login with MFA, recovery codes, disable flow |
| `tests/api/encryption-rotation.test.ts` | P5-4 | Vitest | 21 | Versioned decrypt, key rotation fallback, safeDecrypt hard-fail in sign route |

**Subtotal:** 73 tests

---

## Phase 6: CI/CD & Monitoring (2 files)

| File | Task | Framework | Tests | What It Validates |
|------|------|-----------|-------|-------------------|
| `tests/api/logger.test.ts` | P6-2 | Vitest | 32 | JSON output, PII scrubbing, trace ID propagation |
| `tests/api/rollback.test.ts` | P6-4 | Vitest | 24 | .last-deploy format, health check logic, image tag validation |

**Subtotal:** 56 tests

---

## Phase 7: Post-Launch (10 files)

| File | Task | Framework | Tests | What It Validates |
|------|------|-----------|-------|-------------------|
| `tests/api/form114a-signature.test.ts` | P7-1 | Vitest | 8 | Drawn signature in PDF, backward compat with typed |
| `tests/api/extraction-exceljs.test.ts` | P7-2 | Vitest | 6 | exceljs parity with old xlsx lib |
| `tests/e2e/blog.spec.ts` | P7-3 | Playwright | 6 | Blog index + post page loads, SEO metadata |
| `tests/api/welcome-email.test.ts` | P7-4 | Vitest | 6 | Signup triggers sendWelcomeEmail |
| `tests/e2e/wizard-happy-path.spec.ts` | P7-6 | Playwright | 4 | Full signup-to-payment wizard flow |
| `tests/e2e/threshold-keyboard.spec.ts` | P7-7 | Playwright | 10 | Arrow key radio navigation |
| `tests/e2e/a11y-color-contrast.spec.ts` | P7-9 | Playwright | 12+ | axe color-contrast on all pages |
| `tests/api/extraction-ownership.test.ts` | P7-11 | Vitest | 9 | Ownership type in prompt + mapper |
| `tests/api/email-retry.test.ts` | P7-12 | Vitest | 10 | Retry on transient failure, dead-letter on permanent |
| `tests/api/security-lowpri.test.ts` | P7-sec | Vitest | 7 | HSTS, token cleanup, health rate-limit, calendarYear cross-check, fileName sanitization |

**Subtotal:** ~78 tests

---

## Grand Total

| Category | Files | Approx Tests |
|----------|-------|-------------|
| Phase 3 | 4 | 42 |
| Phase 4 | 3 | 57 |
| Phase 5 | 4 | 73 |
| Phase 6 | 2 | 56 |
| Phase 7 | 10 | 78 |
| **Total** | **23** | **~306** |

*Note: 22 new files + this manifest = 23 total new files.*

---

## Orchestrator Monitoring Protocol

When executing implementation phases that use these tests, the **coordinator/lead agent** must monitor all spawned subagents to prevent stuck work.

### Rules

1. **Check-in every 4 minutes** after spawning agents (2 min for fast phases, 6 min for sequential phases).
2. **Detection:** An agent is stuck if it produces no new output for 4+ minutes, emits repeated errors, or exceeds 3x its estimated time.
3. **Escalation path:**
   - **4 min stuck** → Nudge: "Status check — are you blocked?"
   - **8 min stuck** → Kill & respawn with same task + context from failed attempt
   - **Respawn fails** → Coordinator absorbs the task or reassigns to different agent type
4. **After all agents complete:** Verify all expected test files exist, run `npx vitest list` or `npx tsc --noEmit` to catch syntax errors, report summary.

### Per-Phase Agent Counts (for test writing)

| Phase | Agents | Check Interval | Expected Duration |
|-------|--------|----------------|-------------------|
| Phase 3 | 1 subagent | 4 min | ~10 min |
| Phase 4 | 1 subagent | 4 min | ~10 min |
| Phase 5 | 1 subagent | 4 min | ~12 min |
| Phase 6 | 1 subagent | 4 min | ~8 min |
| Phase 7 | 1 subagent | 4 min | ~15 min |

### Per-Phase Agent Counts (for implementation)

| Phase | Agents | Check Interval | Expected Duration |
|-------|--------|----------------|-------------------|
| Phase 3 | 4 parallel | 4 min | ~4 hr |
| Phase 4 | 1 sequential | 6 min | ~20 hr (BLOCKED) |
| Phase 5 | 1 sequential | 6 min | ~26 hr |
| Phase 6 | 2 parallel | 4 min | ~6 hr |
| Phase 7 | Many parallel | 4 min | ~6 hr |

Full protocol details: `claudedocs/d2c-implementation-plan-2026-02-19.md` → "Orchestrator Monitoring Protocol" section.

---

## Tasks NOT Covered by Tests (by design)

| Task | Reason |
|------|--------|
| P3-1 (Stripe live keys) | Manual verification only (Stripe dashboard) |
| P3-4 (GTM/GA4) | Covered by existing `gtm-smoke.spec.ts` |
| P3-7/8 (VPS backups) | Manual VPS ops |
| P5-2 (JWT maxAge) | Covered by existing `auth.spec.ts` runs |
| P6-1 (CI pipeline) | CI pipeline IS the test |
| P6-3 (GHCR images) | Manual GHCR verification |
| P7-5 (Color contrast fixes) | Covered by P7-9 axe enablement |
| P7-8 (Prisma query logging) | No test (logging config change) |
| P7-10 (PgBouncer) | No test (infrastructure) |

---

## Implementation Dependencies

Each test file documents its dependencies via `// IMPLEMENTATION NEEDED:` comments. Key new files that must be created:

| New Source File | Phase | Test File |
|----------------|-------|-----------|
| `src/lib/sentry.ts` (scrubPii) | P3-9 | sentry-scrub.test.ts |
| `src/lib/treasury.ts` (replace stub) | P4-1 | treasury.test.ts |
| `src/lib/fincen-xml.ts` (replace stub) | P4-2 | fincen-xml.test.ts |
| `src/app/api/cron/submit-paid/route.ts` | P4-3 | submission-cron.test.ts |
| `src/app/api/cron/poll-submitted/route.ts` | P4-3 | submission-cron.test.ts |
| `src/lib/fincen-submit.ts` | P4-3 | submission-cron.test.ts |
| `src/lib/mfa.ts` | P5-3 | mfa.test.ts, mfa.spec.ts |
| `src/app/api/auth/mfa/setup/route.ts` | P5-3 | mfa.test.ts |
| `src/app/api/auth/mfa/verify/route.ts` | P5-3 | mfa.test.ts |
| `src/app/api/auth/mfa/disable/route.ts` | P5-3 | mfa.test.ts |
| `src/app/api/auth/mfa/recovery/route.ts` | P5-3 | mfa.test.ts |
| `src/app/(app)/mfa-verify/page.tsx` | P5-3 | mfa.spec.ts |
| `src/app/(app)/settings/security/page.tsx` | P5-3 | mfa.spec.ts |
| `src/lib/logger.ts` | P6-2 | logger.test.ts |
| `src/lib/deploy.ts` | P6-4 | rollback.test.ts |
| `src/lib/email.ts` (sendWelcomeEmail) | P7-4 | welcome-email.test.ts |
| `src/lib/email.ts` (sendEmailWithRetry) | P7-12 | email-retry.test.ts |
| `src/app/(marketing)/blog/` | P7-3 | blog.spec.ts |
