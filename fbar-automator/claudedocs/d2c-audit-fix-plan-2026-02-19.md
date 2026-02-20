# D2C Audit Fix Implementation Plan

## Created: 2026-02-19

## Context
A comprehensive audit of all D2C FBAR phases (0-3, 5-7) found 76 code findings + 78 test issues. After practical reassessment with pre-launch context (zero users, single VPS), these were triaged into:
- **Tier 1** (actually broken right now): 6 items — CI broken, deploy scripts no-ops
- **Tier 2** (real bugs, fix before launch): 20 items — logic errors in product flow
- **Tier 3** (should fix, not urgent): 16 items — incomplete features, minor hardening
- **Tier 4** (auditor paranoia): 12 items — dropped

Authoritative document: `d2c-audit-practical-2026-02-19.md`

## Implementation: 5 Sprints

### Sprint 1: CI + Deploy (~1.5 hours)
Items 1-8: ESLint setup, remove continue-on-error, gate build on CI, fix rollback/deploy scripts, fix migrate image, delete test stubs, fix rollback catch.

### Sprint 2: Logic Bugs (~3 hours)
Items 9-23: PUT accounts userId scoping, POST accounts stale maxValueUsd, isJointAccount BOTH, drawn signature validation, null guards, ExcelJS cast, calendarYear validation, recursive PII scrubbing, encryption dead variable, schema cascade, bsaId guard, ownership type casing, checkHealth finally, sanitizeFileName export, typed signature length.

### Sprint 3: Email + Deploy Helpers (~30 min)
Items 24-26: Wire sendEmailWithRetry, fix isPermanentError 429, RESEND_API_KEY guard.

### Sprint 4: Test Hardening (~2 hours)
Items 27-31: Tighten assertions, fix mock issues, new route tests, drawn signature tests, Sprint 2 regression tests.

### Sprint 5: Pre-Launch Polish (deferred)
Items 32-37: MFA login enforcement (DEFER), MFA rate limiting/setup/recovery fixes, Sentry scrubPii, CSP nonce (DEFER), startup validation, Excel row limit.

## Execution Order
Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5

## Total: 37 items, ~8 hours, parallel sonnet subagents per sprint
