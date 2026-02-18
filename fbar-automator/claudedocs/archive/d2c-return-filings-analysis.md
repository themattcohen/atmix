> **ARCHIVED 2026-02-18**: COMPLETED PLAN — All 18 decisions in this implementation plan were fully implemented on 2026-02-17. Feature is live. Moved from `claudedocs/d2c-return-filings-analysis.md` during cleanup.

---

# Pre-Populated Return Filings: Implementation Plan (Final)

**Date:** 2026-02-17
**Feature:** Pre-populated return filings for D2C FBAR app
**Status:** Plan finalized after 4-agent Opus analysis. Ready for implementation.

---

## Executive Summary

Four parallel Opus-level analyses (Architecture, Security, Performance, Test Strategy) reviewed the initial plan against the actual codebase. This document reflects the **corrected final plan** incorporating all findings. No architectural rework needed. Key amendments: maxValueLocal=0 (not null), advisory lock for race prevention, Vitest infrastructure from scratch, and N+1 fix in filing API included.

---

## Final Plan (18 Decisions)

Decisions marked with **(amended)** or **(new)** were changed or added based on the analysis.

| # | Decision | Category | Status |
|---|----------|----------|--------|
| 1 | Copy stable fields; set `maxValueLocal=0`; null `maxValueUsd`, `exchangeRate`, `exchangeRateSource` | Architecture | **(amended)** |
| 2 | Most recent prior year, dropdown override | Architecture | confirmed |
| 3 | Import all, delete unwanted | Architecture | confirmed |
| 4 | Import only when 0 accounts exist | Architecture | confirmed |
| 5 | Prisma `$transaction` with `pg_advisory_xact_lock` | Code Quality | **(amended)** |
| 6 | Copy raw ciphertext (no decrypt/re-encrypt) | Code Quality | confirmed |
| 7 | `POST /api/accounts/import` with Zod `.strict()` validation | Code Quality | **(amended)** |
| 8 | Extract ImportBanner component | Code Quality | confirmed |
| 9 | New `t14-return-filer.spec.ts` (file year `currentYear-2` then `currentYear-1`) | Tests | **(amended)** |
| 10 | Vitest integration tests (12 cases, up from 7) | Tests | **(amended)** |
| 11 | All 4 edge cases | Tests | confirmed |
| 12 | Full regression + defensive assertion | Tests | confirmed |
| 13 | Augment `GET /api/accounts` with conditional `priorYears` (only when 0 accounts) | Performance | **(amended)** |
| 14 | `createMany` + `findMany` + `has25PlusAccounts` update in transaction | Performance | **(amended)** |
| 15 | Create Vitest infrastructure (`vitest.config.ts`, `tests/setup.ts`, auth mocking) | Tests | **(new)** |
| 16 | Validate `sourceCalendarYear < targetCalendarYear`, Zod int 2010-2030 | Security | **(new)** |
| 17 | Fix pre-existing N+1 in `GET /api/filing` (groupBy replaces N count queries) | Performance | **(new)** |
| 18 | Client-side button disable on import click (defense in depth) | UX | **(new)** |

### Deferred (not in this PR)
- Import-once flag on FilingYear (add if abuse observed post-launch)
- Defense-in-depth on PUT/DELETE accounts (pre-existing, separate PR)
- Add userId as AAD to encryption (breaking change, future hardening)

---

## Findings by Severity

### CRITICAL

#### C1: Double-Import Race Condition (TOCTOU)

**Source:** Performance + Security analyses
**File:** New endpoint (POST /api/accounts/import)

The 0-account check and the createMany are not atomic under READ COMMITTED isolation. Two concurrent requests can both see 0 accounts and both proceed to insert, creating duplicate account sets.

**Fix:** Use PostgreSQL advisory lock inside the transaction:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(
    hashtext(${userId + ':import:' + targetCalendarYear})
  )`;
  const count = await tx.foreignAccount.count({
    where: { userId, calendarYear: targetCalendarYear },
  });
  if (count > 0) throw new Error("Accounts already exist");
  // ... proceed with createMany
});
```

**Also:** Client-side button disable on click (defense in depth).

#### C2: userId Must Gate BOTH Source Query AND Target Insert

**Source:** Security analysis
**File:** New endpoint

The import endpoint takes `sourceCalendarYear` from the request body. If the source query omits `userId`, it could pull accounts from another user. The target insert must also set `userId` from the session, never from source rows.

**Fix:** Hardcode `userId: session.user.id` in both the source `findMany` WHERE and the target `createMany` data.

---

### HIGH

#### H1: maxValueLocal is NOT NULL — Cannot Set to Null

**Source:** Architecture analysis
**File:** `d2c/prisma/schema.prisma` line 47

The schema declares `maxValueLocal Decimal @db.Decimal(18, 2)` — required, no `?`, no `@default`. The plan says to null out financial values, but this field CANNOT be null.

**Fix:** Set `maxValueLocal` to `Decimal(0)` instead of null. The existing Zod `.positive()` constraint on the edit/create path prevents submitting with 0, acting as a natural "not yet entered" gate. `maxValueUsd`, `exchangeRate`, `exchangeRateSource` ARE nullable and can be set to null as planned.

**Plan Decision #1 Amended:** Copy stable fields. Set `maxValueLocal` to 0 (not null). Null out `maxValueUsd`, `exchangeRate`, `exchangeRateSource`.

#### H2: Delete-Reimport Abuse Vector

**Source:** Security analysis

A user can import → delete all → re-import indefinitely, creating unbounded DB rows over time. Each cycle creates N new rows with new CUIDs.

**Fix options (pick during implementation):**
- **Preferred:** Import-once flag on FilingYear (e.g., `importedFromYear Int?`). Once set, block re-import.
- **Alternative:** Per-user rate limit on import endpoint (3-5/hour).

#### H3: t14 E2E Test — Year Selection Trap

**Source:** Test strategy analysis

The threshold dropdown shows years `[currentYear-1, ..., currentYear-5]`. Filing year N then year N+1 requires careful year selection since N+1 might not be in the dropdown.

**Fix:** File year N = `currentYear - 2`, year N+1 = `currentYear - 1` (the default). Both are always available.

#### H4: Vitest Infrastructure Does Not Exist

**Source:** Test strategy analysis
**File:** No `vitest.config.ts` or `*.test.ts` files exist in `d2c/`

The 7+ planned Vitest integration tests require creating from scratch:
- `d2c/vitest.config.ts` with `@/*` path alias matching tsconfig
- `d2c/tests/setup.ts` with `ENCRYPTION_KEY` env var
- Auth mocking strategy (`vi.mock("@/lib/auth")`)
- Test database strategy (use dev DB, unique IDs per test)

#### H5: t14 Must Use Explicit Timeout (600s)

**Source:** Test strategy analysis

The test runs two full filing cycles (~90-225 seconds). Default 30s timeout will fail. Must use `test.setTimeout(600_000)` and `test.describe.serial()` with shared Page instance (matching t13's pattern).

#### H6: has25PlusAccounts Flag Must Update After Import

**Source:** Performance + Architecture analyses
**File:** `d2c/prisma/schema.prisma` line 67

If imported accounts push the count to 25+, the flag on FilingYear must be updated inside the same transaction:

```typescript
if (newAccounts.length >= 25) {
  await tx.filingYear.updateMany({
    where: { userId, calendarYear: targetYear },
    data: { has25PlusAccounts: true },
  });
}
```

---

### MEDIUM

#### M1: Source Year Filing Validation

**Source:** Architecture analysis

Accounts can exist for a calendarYear without a corresponding FilingYear (no FK). The import endpoint should verify a FilingYear exists for the source year with a completed-enough status before allowing import. Prevents importing from an abandoned filing.

#### M2: Input Validation for sourceCalendarYear

**Source:** Security analysis

Create a dedicated Zod schema:
```typescript
const importSchema = z.object({
  sourceCalendarYear: z.number().int().min(2010).max(2030),
}).strict();
```
Also validate: `sourceCalendarYear < targetCalendarYear`.

#### M3: Conditional priorYears Query

**Source:** Performance analysis

Only run the GROUP BY for prior years when the current year has 0 accounts:
```typescript
let priorYears = [];
if (calendarYear && accounts.length === 0) {
  priorYears = await prisma.foreignAccount.groupBy({ ... });
}
```

#### M4: JSON Field Casting

**Source:** Architecture analysis
**File:** `d2c/src/app/api/accounts/route.ts` line 94

When copying `institutionAddress` (Json?) and `jointOwnerInfo` (String?), cast per existing pattern:
```typescript
institutionAddress: source.institutionAddress as Prisma.InputJsonValue ?? Prisma.DbNull
```

#### M5: Rate Limiting for Import Endpoint

**Source:** Security analysis

Add stricter per-user rate limit (3-5 imports/hour) vs. the general 60 req/min/IP.

#### M6: Import Response — Minimal Data

**Source:** Security analysis

Return only `{ success: true, importedCount: N, targetCalendarYear: Y }` or the same curated projection as GET /api/accounts (with accountNumberLast4, not raw ciphertext).

#### M7: Pre-Existing N+1 in GET /api/filing

**Source:** Performance analysis
**File:** `d2c/src/app/api/filing/route.ts` lines 23-44

`Promise.all(filings.map(f => prisma.foreignAccount.count(...)))` — N+1 pattern. Not introduced by this feature, but worth fixing alongside:
```typescript
const accountCounts = await prisma.foreignAccount.groupBy({
  by: ['calendarYear'],
  where: { userId },
  _count: { id: true },
});
```

#### M8: Transaction Isolation Level

**Source:** Security + Performance analyses

Use Serializable isolation OR advisory lock (recommended) to prevent the TOCTOU race. Advisory lock is preferred (see C1) as it doesn't affect other transactions.

---

### LOW

#### L1: Encryption Ciphertext Copy is Safe

**Source:** Architecture + Security analyses
**File:** `d2c/src/lib/encryption.ts` lines 17-24

Confirmed safe: global key, no per-row AAD, format is `iv_hex:authTag_hex:ciphertext_hex`. Plan Decision #6 is correct.

**Decision:** Copy raw ciphertext. Confirmed safe by both architecture and security analyses.

#### L2: Auto-Generated Fields Must Be Omitted

**Source:** Architecture analysis

`id` (CUID), `createdAt` (now), `updatedAt` (auto) must NOT be copied. Explicitly omit from the createMany data mapping.

#### L3: Orphaned Accounts Are Benign

**Source:** Architecture analysis

If a user imports then abandons the filing, accounts persist independently (no FK to FilingYear, cascade only on User delete). This is actually beneficial — accounts are there when the user returns.

#### L4: Pre-Existing Defense-in-Depth Gaps

**Source:** Security analysis (Findings 12-13)
- PUT /api/accounts/[accountId] uses `update()` without userId in WHERE (ownership checked via findFirst)
- DELETE /api/accounts/[accountId] uses `delete()` without userId in WHERE

Both should use `updateMany`/`deleteMany` with userId for defense-in-depth. Pre-existing, not blocking for this feature.

---

## Implementation Plan (Final)

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `d2c/src/app/api/accounts/import/route.ts` | Import endpoint with advisory lock, Zod validation |
| 2 | `d2c/src/components/ImportBanner.tsx` | Import UI component with year selector |
| 3 | `d2c/tests/e2e/antagonistic/t14-return-filer.spec.ts` | E2E test suite (serial, 600s timeout) |
| 4 | `d2c/vitest.config.ts` | Vitest config with `@/*` path aliases |
| 5 | `d2c/tests/setup.ts` | Test setup (ENCRYPTION_KEY, DATABASE_URL) |
| 6 | `d2c/tests/api/accounts-import.test.ts` | Integration tests (12 cases) |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 7 | `d2c/src/app/api/accounts/route.ts` | Augment GET with conditional `priorYears` (only when 0 accounts) |
| 8 | `d2c/src/app/api/filing/route.ts` | Fix N+1: replace N count queries with single `groupBy` |
| 9 | `d2c/src/app/(app)/accounts/page.tsx` | Integrate ImportBanner, disable-on-click |
| 10 | `d2c/tests/e2e/antagonistic/t11-accounts.spec.ts` | Defensive assertion: import banner absent for new users |

### Implementation Order

**Phase 1: Backend (files 1, 7, 8)**
1. Augment `GET /api/accounts` with conditional `priorYears` field
2. Create `POST /api/accounts/import` endpoint
3. Fix N+1 in `GET /api/filing`

**Phase 2: Frontend (files 2, 9)**
4. Create `ImportBanner` component
5. Wire into accounts page

**Phase 3: Test Infrastructure (files 4, 5)**
6. Create `vitest.config.ts` with `@/*` alias, node environment
7. Create `tests/setup.ts` with ENCRYPTION_KEY env var

**Phase 4: Tests (files 3, 6, 10)**
8. Vitest integration tests (12 cases)
9. E2E `t14-return-filer.spec.ts`
10. Defensive assertion in t11
11. Full regression run (111 existing + new tests)

### Key Implementation Details

#### Import Endpoint (`POST /api/accounts/import`)

```
Body: { sourceCalendarYear: number }

1. Auth check → session.user.id (401 if missing)
2. Zod .strict() validate: sourceCalendarYear int 2010-2030
3. Find active IN_PROGRESS filing for user → targetCalendarYear
   - WHERE: { userId: session.user.id, status: "IN_PROGRESS" }
   - 400 if no active filing
4. Validate sourceCalendarYear < targetCalendarYear (400 if not)
5. $transaction with advisory lock:
   a. pg_advisory_xact_lock(hashtext(userId + ':import:' + targetYear))
   b. Count target year accounts WHERE userId + calendarYear → must be 0 (409 if not)
   c. findMany source accounts WHERE { userId: session.user.id, calendarYear: source }
   d. Return 200 with { importedCount: 0 } if no source accounts
   e. Map source → target:
      - COPY: institutionName, accountNumber (raw ciphertext), accountType,
        ownershipType, countryCode, currencyCode, isJointAccount, jointOwnerInfo,
        institutionAddress (cast to Prisma.InputJsonValue)
      - SET: userId = session.user.id (NEVER from source), calendarYear = target
      - SET: maxValueLocal = new Prisma.Decimal(0)
      - SET NULL: maxValueUsd, exchangeRate, exchangeRateSource
      - OMIT: id, createdAt, updatedAt (auto-generated)
   f. createMany(mapped data)
   g. If count >= 25: updateMany FilingYear set has25PlusAccounts = true
   h. findMany new accounts for response
6. Return 201 with curated projection (accountNumberLast4, not ciphertext)
```

#### Augmented GET /api/accounts

```
Existing behavior unchanged. New addition:

After the existing findMany, IF calendarYear param is present AND accounts.length === 0:
  Run groupBy on ForeignAccount:
    by: ['calendarYear']
    where: { userId, calendarYear: { lt: requestedYear } }
    _count: { id: true }
    orderBy: { calendarYear: 'desc' }

Response shape: { data: AccountDisplay[], priorYears: { calendarYear: number, count: number }[] }
priorYears is empty array when not applicable (backward-compatible).
```

#### Fix N+1 in GET /api/filing

```
BEFORE (N+1):
  const filings = await prisma.filingYear.findMany({ where: { userId } })
  const data = await Promise.all(filings.map(f =>
    prisma.foreignAccount.count({ where: { userId, calendarYear: f.calendarYear } })
  ))

AFTER (2 queries):
  const [filings, accountCounts] = await Promise.all([
    prisma.filingYear.findMany({ where: { userId }, orderBy: { calendarYear: 'desc' } }),
    prisma.foreignAccount.groupBy({
      by: ['calendarYear'],
      where: { userId },
      _count: { id: true },
    }),
  ])
  const countMap = new Map(accountCounts.map(c => [c.calendarYear, c._count.id]))
  // Use countMap.get(f.calendarYear) ?? 0 when building response
```

#### ImportBanner Component

```
Props:
  priorYears: { calendarYear: number, count: number }[]
  onImport: (sourceCalendarYear: number) => Promise<void>

Behavior:
  - Only rendered when priorYears.length > 0 (parent gates on accounts.length === 0)
  - Default source year: priorYears[0].calendarYear (most recent)
  - If priorYears.length > 1: show dropdown selector
  - Display: "You filed last year with N accounts. Import them as a starting point?"
  - "Import from [year]" button — disables on click, shows loading state
  - "Start fresh" dismiss option
  - data-testid="import-banner" for E2E testing
```

#### E2E Test Structure

```
t14-return-filer.spec.ts

  T14-A: Return filer flow
    test.describe.serial() with shared Page, test.setTimeout(600_000)
    Email: t14-${Date.now()}-${random}@test.com via robustSignup

    1. setup: signup + complete year (currentYear-2) filing
       - robustSignup → /threshold
       - Select year currentYear-2 from dropdown
       - Answer Yes/Yes → /personal
       - Fill personal info (wait for networkidle + firstName value + 2s settle)
       - Add 2 accounts: one with institutionAddress, one isJointAccount=true
       - Continue to /review → verify data
       - Continue to /sign → sign (name match)
       - STOP here (no payment needed — accounts exist regardless of filing status)

    2. start new filing for year currentYear-1
       - Navigate to /dashboard → click "Start New Filing"
       - Threshold: year currentYear-1 (default), Yes/Yes
       - Personal: verify pre-populated, continue

    3. verify import banner visible on /accounts
       - Assert [data-testid="import-banner"] visible
       - Assert text contains "2 accounts" and year currentYear-2

    4. click import, verify accounts
       - Click import button
       - Assert 2 account cards appear
       - Assert institution names match year N
       - Assert maxValueLocal is 0 (blank/zero)
       - Assert countryCode, currencyCode carried over
       - Assert import banner no longer visible

    5. fill max values
       - Edit each account, set maxValueLocal > 0
       - Save

    6. continue through review
       - Click "Continue to Review"
       - Verify review page shows correct data for year currentYear-1

  T14-B: Edge cases
    test.describe.serial() with shared Page

    7. new user: no import banner
       - Fresh robustSignup → threshold → personal → /accounts
       - Assert [data-testid="import-banner"] NOT visible

    8. post-import editing
       - (Reuse T14-A state or new setup)
       - Edit imported account institution name → save → verify persisted

    9. post-import deletion
       - Delete one imported account → verify 1 remains
```

#### Vitest Integration Tests (12 cases)

```
tests/api/accounts-import.test.ts

Setup:
  - vi.mock("@/lib/auth") → returns { user: { id: testUserId } }
  - Create test user + source accounts + target filing via Prisma
  - Teardown: delete test user (cascade deletes accounts + filings)

Cases:
  1.  Happy path: 3 source accounts → 3 new accounts for target year
  2.  Encrypted integrity: decrypt(imported.accountNumber) === decrypt(source.accountNumber)
  3.  institutionAddress JSON preserved (deep equality)
  4.  Joint account fields preserved (isJointAccount + jointOwnerInfo)
  5.  No source accounts → 200 with { importedCount: 0 }
  6.  Target year already has accounts → 409
  7.  No active IN_PROGRESS filing → 400
  8.  Unauthenticated → 401
  9.  maxValueUsd = null on imported accounts
  10. exchangeRate = null, exchangeRateSource = null on imported accounts
  11. Duplicate import: second call → 409 (advisory lock + count check)
  12. Multi-year: user has 2023 + 2024 accounts, sourceYear=2024 → only 2024 copied
```

---

## Deferred Items (Not in This PR)

| Item | Reason | When |
|------|--------|------|
| Import-once flag on FilingYear | Advisory lock prevents races; rate limit covers abuse | Post-launch if abuse observed |
| Defense-in-depth on PUT/DELETE accounts | Pre-existing; ownership checked via findFirst | Separate PR |
| Add userId as AAD to encryption | Breaking change to existing data | Future hardening |
| Per-user rate limit on import endpoint | General 60 req/min covers MVP | Post-launch if abuse observed |
