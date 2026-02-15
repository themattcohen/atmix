# Phase 7.5 Readiness Assessment — Full Findings

**Date**: 2026-02-15
**Session**: `191a599d-4a13-48fc-80f3-f020cdd402af`
**Agents**: 3 Opus audit agents (Frontend UX, Backend Security, Config/Deploy)

---

## Synthesized Verdict

### VERDICT: **NOT READY** — Need one more fix round before human testing

| Domain | Agent Verdict | Critical | High | Medium | Low |
|--------|--------------|----------|------|--------|-----|
| Frontend UX | NEEDS WORK | 0 | 6 | 7 | 6 |
| Backend Security | NEEDS WORK | 3 | 4 | 7 | 7 |
| Config/Deploy | READY (caveats) | 0 | 0 | 0 | 5 |

---

## Tier 1: Must Fix Before Human Testing (9 items)

### Security Critical

#### C1: Account numbers stored in plaintext (TINs are encrypted, accts are not)
- **Files**: `api/.../accounts/route.ts`, `prisma/schema.prisma` line 165
- **Severity**: CRITICAL
- **Source Agent**: Backend Security
- **Status**: DEFERRED

TINs (SSNs, ITINs, EINs) are correctly encrypted via `encrypt()` before storage, but foreign bank account numbers are stored as plaintext in the `foreign_accounts.account_number` column. Account numbers are masked in API responses (good), but a database breach would expose every account number in cleartext. For a financial PII application handling FBAR data, account numbers should receive the same encryption treatment as TINs.

```typescript
// Current (plaintext storage):
const account = await prisma.foreignAccount.create({
  data: {
    accountNumber: data.accountNumber,  // PLAINTEXT
    ...
  },
})

// Should be:
const account = await prisma.foreignAccount.create({
  data: {
    accountNumber: encrypt(data.accountNumber),  // ENCRYPTED
    ...
  },
})
```

All locations that read `accountNumber` for display would need `safeDecrypt()` before masking. The export modules (XML, CSV, PDF) that need the real account number would also need `safeDecrypt()`.

---

#### C2: Extracted account number returned unmasked in statement API
- **File**: `src/app/api/statements/[statementId]/route.ts` line 61
- **Severity**: CRITICAL
- **Source Agent**: Backend Security
- **Status**: FIXED

The `GET /api/statements/[statementId]` endpoint returns `extractedData.accountNumber` without masking. This is the LLM-extracted account number from the bank statement OCR. While it comes from a different table (`extracted_data`), it is still a full account number returned to the client.

```typescript
// Line 61 -- unmasked account number in response:
accountNumber: statement.extractedData.accountNumber,
```

---

#### C3: `spouseClientId` accepts any UUID — cross-tenant data link
- **Files**: `src/app/api/clients/route.ts` lines 36, 177-189; `src/app/api/clients/[clientId]/route.ts` lines 42, 214-215
- **Severity**: CRITICAL
- **Source Agent**: Backend Security
- **Status**: FIXED

Both `POST /api/clients` and `PUT /api/clients/[clientId]` accept a `spouseClientId` field validated only as a UUID. There is no check that the referenced spouse client belongs to the same `practiceId`. An attacker could reference a client from another practice, creating a cross-tenant data link. While the spouse relationship itself does not leak data directly, it creates a foreign key to another tenant's data that could be exploited through other queries or future features.

```typescript
// Current -- no tenant check on spouseClientId:
spouseClientId: data.spouseClientId ?? null,

// Should verify:
if (data.spouseClientId) {
  const spouse = await prisma.client.findFirst({
    where: { id: data.spouseClientId, practiceId },
  })
  if (!spouse) {
    return NextResponse.json({ error: "Spouse client not found." }, { status: 404 })
  }
}
```

---

### Workflow Breakers

#### H6: Review page passes encrypted account numbers to ReviewForm — auto-matching is broken
- **File**: `[filingYear]/review/page.tsx` lines 94-97
- **Severity**: HIGH
- **Source Agent**: Frontend UX
- **Status**: FALSE POSITIVE

The review page passes encrypted `accountNumber` values from Prisma directly to ReviewPageClient without calling `safeDecrypt`. The ReviewForm's automatic matching compares extracted plain-text numbers against encrypted ciphertext, guaranteeing no automatic matches. Users must always manually select accounts.

---

#### H1: Tab navigation hardcoded active state — wrong tab highlighted
- **Files**: `[filingYear]/page.tsx` line 142, `[filingYear]/export/page.tsx` line 154
- **Severity**: HIGH
- **Source Agent**: Frontend UX
- **Status**: FALSE POSITIVE

Overview page always highlights "Overview" tab; Export page always highlights "Export" tab. Navigating between tabs shows wrong active indicator. The `aria-current="page"` attribute is also hardcoded to the Overview tab, which is an accessibility issue for screen reader users.

---

#### H2: Upload and Review pages missing tab navigation entirely
- **Files**: `[filingYear]/upload/page.tsx`, `[filingYear]/review/page.tsx` (entire files)
- **Severity**: HIGH
- **Source Agent**: Frontend UX
- **Status**: FIXED

Users lose the tab bar when visiting Upload or Review, breaking the navigation pattern established by Overview and Export.

---

### Config Blockers

#### D1: README says password `demo123` — actual is `admin123`
- **File**: `README.md` line 152
- **Severity**: HIGH (blocking)
- **Source Agent**: Config/Deploy
- **Status**: FIXED

The README at line 152 says `Password: demo123` but the actual seed password is `admin123`. A human tester following the README will be locked out immediately.

---

#### D2: MinIO bucket `fbar-statements` not auto-created on fresh deploy
- **Source**: Docker/seed gap
- **Severity**: HIGH (blocking)
- **Source Agent**: Config/Deploy
- **Status**: FIXED (manually)

The `fbar-statements` bucket did not exist in MinIO. If someone starts fresh with `docker compose up`, the bucket is never auto-created. File uploads would fail with an S3 "NoSuchBucket" error. The seed script does not create the bucket, and there is no initialization hook.

---

#### D3: Filing workflow routes leak raw Error.message to client
- **Files**: `src/app/api/filing-years/[filingYearId]/submit/route.ts` lines 82-87, `approve/route.ts` lines 82-87, `filed/route.ts` lines 82-87
- **Severity**: HIGH
- **Source Agent**: Backend Security
- **Status**: FIXED

All three filing workflow routes catch `Error` instances and return `error.message` directly to the client with status 400. While the `approval.ts` service throws predictable business-logic messages, if Prisma or any other library throws an Error, its internal message (potentially containing SQL, table names, or constraint details) would be leaked.

```typescript
// Current pattern (all three routes):
if (error instanceof Error) {
  return NextResponse.json(
    { error: error.message },  // Could leak Prisma/DB internals
    { status: 400 }
  )
}
```

Fix: Maintain an explicit list of known business error message prefixes (e.g., "Cannot submit", "Cannot approve", "Cannot mark"), and only forward those. All others should get the generic message.

---

## Tier 2: Should Fix (nice for demo quality, not blocking)

### 1. No RBAC on destructive operations (any user can delete clients)
- **File**: `src/app/api/clients/[clientId]/route.ts` lines 264-318
- **Severity**: HIGH
- **Source Agent**: Backend Security

`DELETE /api/clients/[clientId]` performs a hard cascading delete (client + all accounts + all filing years + all statements + all extracted data) with no role check. Any authenticated user within the practice — including PREPARER-role users — can delete any client and all associated data. Given the financial compliance context, destructive operations should require ADMIN role.

The same issue applies to `DELETE /api/clients/[clientId]/accounts/[accountId]` and `DELETE /api/statements/[statementId]`.

Additionally, the frontend has no role-based UI gating for PREPARER role (Frontend UX M7) — a PREPARER user may see admin-only UI elements (settings admin sections, delete buttons) that fail on submission.

---

### 2. Country field inconsistency (free-text vs dropdown)
- **Files**: `AccountsTable.tsx` lines 367-372, `AddAccountForm.tsx`, `ReviewForm.tsx`
- **Severity**: HIGH
- **Source Agent**: Frontend UX

AccountsTable edit mode and AddAccountForm use free-text input for country. ReviewForm uses a standardized `COUNTRY_CODES` dropdown. Data entered via free-text will not match the codes expected by FinCEN XML export, causing data mismatches and potentially invalid filings.

---

### 3. Non-atomic audit logging (mutation + audit log not in `$transaction`)
- **Files**: `src/app/api/clients/route.ts` POST, `src/app/api/clients/[clientId]/route.ts` PUT and DELETE
- **Severity**: MEDIUM
- **Source Agent**: Backend Security

Multiple routes perform the primary data mutation and the audit log creation as separate, non-transactional operations. If the audit log creation fails (network issue, constraint violation), the data mutation still commits but the audit trail has a gap. For SOC 2 compliance, the data mutation and audit log should be in a single `$transaction`.

```typescript
// Current pattern (non-atomic):
const client = await prisma.client.create({ ... })
await prisma.auditLog.create({ ... })  // If this fails, client is created but not logged

// Should be:
const [client] = await prisma.$transaction([
  prisma.client.create({ ... }),
  prisma.auditLog.create({ ... }),
])
```

The `approval.ts` service correctly uses transactions for this pattern — the API routes should follow the same approach.

---

### 4. Temp password returned in HTTP response (should email instead)
- **File**: `src/app/api/settings/team/route.ts` lines 171-179
- **Severity**: HIGH
- **Source Agent**: Backend Security

When creating a team member via `POST /api/settings/team`, the temporary password is returned in the JSON response body. If the response is logged by a proxy, CDN, or application monitoring tool, the password is captured in plaintext. The password should be delivered via email (the Resend API key is configured), not returned in the HTTP response.

```typescript
// Line 177 -- password in API response:
temporaryPassword,
```

---

### 5. Missing audit log for CSV exports
- **File**: `src/app/api/export/[filingYearId]/csv/route.ts`
- **Severity**: MEDIUM
- **Source Agent**: Backend Security

The XML export route correctly creates an audit log entry (`FBAR_XML_EXPORTED`), but the CSV export route has no audit logging at all. Given these exports contain full account numbers and financial data, all exports must be audit-logged for SOC 2 compliance. The PDF route does log (`WORKPAPER_PDF_EXPORTED`), so this is specifically a CSV gap.

---

### 6. TIN format not validated against TIN type
- **File**: `src/app/api/clients/route.ts` lines 15-16
- **Severity**: MEDIUM
- **Source Agent**: Backend Security

The Zod schema validates `tin` as `z.string().max(20)` and `tinType` as an enum, but there is no cross-validation. A user can submit `tinType: "SSN"` with `tin: "ABC"`, which would be encrypted and stored without complaint. SSNs must be 9 digits, ITINs must match 9XX-XX-XXXX format, EINs must be XX-XXXXXXX. Invalid TINs will cause FinCEN XML filing rejections.

---

### 7. In-memory rate limiter (won't scale across instances)
- **File**: `src/lib/rate-limit.ts`
- **Severity**: MEDIUM
- **Source Agent**: Backend Security

The rate limiter stores counters in a per-process `Map`. In any multi-instance deployment (horizontal scaling, multiple containers), each instance has its own counter, effectively multiplying the allowed rate by the number of instances. For a financial application, use Redis (already available) for shared rate limit state.

---

## Tier 3: Defer (PRD features not yet built)

### 1. Exchange rates settings page
- **Source Agent**: Frontend UX (H4)
- **PRD Reference**: Section 3.6

No exchange rates management page exists. No route `/settings/exchange-rates`, no page, no sidebar link. Exchange rate data exists in the database (24 records: 12 currencies x 2 years), but there is no UI for tax professionals to view or manage rates.

---

### 2. Batch approval ("Approve All")
- **Source Agent**: Frontend UX (H5)
- **PRD Reference**: Core feature set

PRD specifies an "Approve All" capability for the review workflow. Current implementation only supports per-account approval via ReviewForm, which is tedious for clients with many foreign accounts.

---

### 3. Notification system (bell icon is placeholder)
- **File**: `Header.tsx` lines 24-29
- **Source Agent**: Frontend UX (M1)

Bell icon button in Header with no onClick handler, no dropdown, no notifications system. Users will click it expecting functionality. Either implement or remove the icon.

---

### 4. Data retention settings
- **Source Agent**: Frontend UX (H4)
- **PRD Reference**: Mentioned in configurable settings

No data retention settings page or configuration exists. No route `/settings/data-retention`. PRD mentions configurable retention policies.

---

### 5. Password change endpoint
- **Source Agent**: Backend Security (L-7)

The team member creation flow (`POST /api/settings/team`) generates a temporary password, but there is no `PUT /api/auth/password` or `POST /api/auth/reset-password` endpoint. Users created by team invite cannot change their password, which means the temporary password (potentially seen by the admin) remains the permanent credential.

---

## Additional Findings by Agent (Not in Synthesized Tier List)

These findings were reported by individual agents but not explicitly categorized in the synthesized tier list. They are included here for completeness.

### Backend Security — Additional Items

#### No CSRF protection on state-mutating API routes (HIGH, H-4)
The application uses JWT session tokens in httpOnly cookies with `sameSite: "lax"`. While SameSite Lax prevents CSRF on POST requests from cross-origin navigations, it does NOT prevent CSRF from top-level navigations that trigger GET-based side effects. For a financial application, defense-in-depth demands a CSRF token.

#### Registration endpoint wide open with no invitation/approval flow (MEDIUM, M-1)
`POST /api/auth/register` allows anyone to create a new Practice + Admin user with no invitation code, email verification, or approval process. An attacker can create unlimited practices.

#### `getReviewSummary` returns unmasked account numbers (MEDIUM, M-2)
`src/lib/approval.ts` line 468 — The `getReviewSummary()` function returns raw (unencrypted, unmasked) `accountNumber` values from the `foreignAccount` table. This data flows into CSV and PDF exports.

#### Hard delete with no soft-delete option (MEDIUM, M-6)
`DELETE /api/clients/[clientId]` cascades to all foreign accounts, filing years, statements, and extracted data. There is no confirmation step, no soft-delete flag, and no recovery mechanism. Accidental deletion of a client with filed FBARs is catastrophic.

#### Delete query doesn't re-check practiceId (LOW, L-1)
`src/app/api/clients/[clientId]/route.ts` line 288 — The `prisma.client.delete()` call uses `where: { id: clientId }` without the `practiceId` constraint. While authorization was already checked, defense-in-depth says the delete query should also include the tenant filter.

#### `GET /api/statements/[statementId]` returns `processingError` field (LOW, L-2)
The `processingError` field may contain internal error messages from the LLM extraction worker, potentially including file paths, API error details, or stack trace fragments.

#### Missing Content-Security-Policy header (LOW, L-3)
`src/middleware.ts` — Sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`, but does not set `Content-Security-Policy`.

#### `safeDecrypt` silently returns ciphertext on failure (LOW, L-4)
`src/lib/encryption.ts` lines 87-97 — If decryption fails, `safeDecrypt` silently returns the raw ciphertext string instead of logging a warning and returning a sentinel value.

#### `x-forwarded-for` header trusted without validation (LOW, L-5)
`src/middleware.ts` lines 56-57 — An attacker can bypass rate limiting by spoofing the `X-Forwarded-For` header.

#### Prisma development query logging enabled (LOW, L-6)
`src/lib/db.ts` lines 13-16 — Full query logging in non-production may log sensitive data in WHERE clauses.

### Frontend UX — Additional Items

#### Dashboard client list missing PRD columns (MEDIUM, M3)
No "Assigned To" column, no per-client filing year column. No column sorting or filtering capability.

#### Dashboard home lacks client quick-filter (MEDIUM, M4)
Main dashboard shows stats and activity but no way to filter clients by filing status.

#### Sidebar navigation minimal (MEDIUM, M5)
Only 3 items (Dashboard, Clients, Settings). No link to exchange rates or reports.

#### No "empty dashboard" state (LOW, L1)
New practices with zero clients see stat cards all showing "0" with no onboarding guidance.

#### Filing status chart empty state (LOW, L2)
FilingStatusChart renders an empty bar when all counts are zero.

#### Date of birth field not masked in edit mode (LOW, L3)
Raw date input with no masking or validation beyond HTML5 date picker.

#### No confirmation on filing year creation (LOW, L4)
AddFilingYearForm submits and refreshes without explicit success feedback.

#### DocumentViewer zoom controls lack keyboard shortcuts (LOW, L5)
No Ctrl+/Ctrl- keyboard shortcuts for PDF zoom.

#### Upload polling has no visual countdown (LOW, L6)
UploadSection polls every 3s with a 5min timeout, but users see no indication of progress.

### Config/Deploy — Additional Items

#### ANTHROPIC_API_KEY is placeholder
`.env` has `sk-ant-your-key-here`. Any new statement uploads will queue but never extract. Existing 2 statements have already been extracted, so review/export workflows are testable with current data.

#### Extraction worker not running
Background extraction worker (`npm run worker` / `tsx src/workers/extract.ts`) is not started by the dev server or Docker Compose dev setup. Without it, uploaded statements sit in `PENDING` status forever.

#### Seed script creates minimal data
If the database is reset (`prisma migrate reset`), the seed only creates 1 admin user + exchange rates. No clients, accounts, or filing years to test against.

#### App Docker container not running
The `app` service is not in `docker compose ps`. The dev server runs natively via `npm run dev`.

---

## Backend Security — Full API Route Audit Matrix

| Route | Auth | Tenant Check | Input Validation | Error Handling | PII Masking |
|-------|------|-------------|-----------------|----------------|-------------|
| `GET /api/health` | N/A (public) | N/A | N/A | OK | N/A |
| `POST /api/auth/register` | N/A (public) | N/A | Zod | OK | N/A |
| `GET /api/clients` | OK | OK (`practiceId`) | Search param parsed | OK | TIN masked |
| `POST /api/clients` | OK | OK (`practiceId`) | Zod schema | OK | TIN masked |
| `GET /api/clients/[id]` | OK | OK (`findFirst + practiceId`) | N/A | OK | TIN masked, acct masked |
| `PUT /api/clients/[id]` | OK | OK (`getAuthorizedClient`) | Zod schema | OK | TIN masked |
| `DELETE /api/clients/[id]` | OK | OK (`getAuthorizedClient`) | N/A | OK | N/A |
| `GET /api/clients/[id]/accounts` | OK | OK (`getAuthorizedClient`) | N/A | OK | Acct masked |
| `POST /api/clients/[id]/accounts` | OK | OK (`getAuthorizedClient`) | Zod schema | OK | Acct masked |
| `GET /api/clients/.../accounts/[id]` | OK | OK (3-level chain) | N/A | OK | Acct masked |
| `PUT /api/clients/.../accounts/[id]` | OK | OK (3-level chain) | Zod schema | OK | Acct masked |
| `DELETE /api/clients/.../accounts/[id]` | OK | OK (3-level chain) | N/A | OK | N/A |
| `GET /api/clients/[id]/filing-years` | OK | OK (`getAuthorizedClient`) | N/A | OK | N/A |
| `POST /api/clients/[id]/filing-years` | OK | OK (`getAuthorizedClient`) | Zod schema | OK | N/A |
| `GET /api/exchange-rates` | OK | N/A (shared data) | Zod coerce | OK | N/A |
| `POST /api/exchange-rates` | OK + ADMIN | N/A (shared data) | Zod schema | OK | N/A |
| `GET /api/settings` | OK | OK (`session.practiceId`) | N/A | OK | EIN masked |
| `PUT /api/settings` | OK + ADMIN | OK (`session.practiceId`) | Zod schema | OK | EIN masked |
| `GET /api/settings/team` | OK | OK (`session.practiceId`) | N/A | OK | No PII |
| `POST /api/settings/team` | OK + ADMIN | OK (`session.practiceId`) | Zod schema | OK | **Temp password leaked** |
| `POST /api/accounts/[id]/review` | OK | OK (account+filing chain) | Zod + refine | OK | N/A |
| `GET /api/accounts/[id]/review` | OK | OK (account chain) | UUID regex | OK | N/A |
| `POST /api/statements/upload` | OK | OK (filing year chain) | File validation + magic bytes | OK | N/A |
| `GET /api/statements/[id]` | OK | OK (statement chain) | N/A | OK | **extractedData.accountNumber NOT masked** |
| `DELETE /api/statements/[id]` | OK | OK (statement chain) | N/A | OK | N/A |
| `GET /api/statements/[id]/status` | OK | OK (statement chain) | N/A | OK | N/A |
| `POST /api/statements/[id]/reprocess` | OK | OK (statement chain) | N/A | OK | N/A |
| `POST /api/filing-years/[id]/submit` | OK | OK (filing year chain) | UUID regex | **Leaks Error.message** | N/A |
| `POST /api/filing-years/[id]/approve` | OK | OK (filing year chain) | UUID regex | **Leaks Error.message** | N/A |
| `POST /api/filing-years/[id]/filed` | OK | OK (filing year chain) | UUID regex | **Leaks Error.message** | N/A |
| `GET /api/export/[id]/xml` | OK | OK (`getFilingYearWithFullData`) | N/A | OK | Unmasked (FinCEN req) |
| `GET /api/export/[id]/csv` | OK | OK (`getFilingYearWithFullData`) | Export type validated | OK | TIN masked, acct unmasked |
| `GET /api/export/[id]/pdf` | OK | OK (`getFilingYearWithFullData`) | N/A | OK | TIN masked, acct shown |

---

## Frontend UX — PRD Feature Coverage Matrix

| PRD Feature | Status | Notes |
|-------------|--------|-------|
| User Registration | IMPLEMENTED | Full form with validation, password requirements |
| User Login | IMPLEMENTED | Credentials-based, error handling, redirect support |
| Dashboard Overview | PARTIAL | Stats, chart, activity present. Missing filters, PRD columns |
| Client List | PARTIAL | Search and pagination work. Missing sort, filter, "Assigned To" |
| Create Client | IMPLEMENTED | Full form with TIN, DOB, address |
| Client Detail (view/edit/delete) | IMPLEMENTED | ClientInfoCard with 3 modes |
| Foreign Account CRUD | IMPLEMENTED | AccountsTable with inline edit/delete, AddAccountForm |
| Filing Year Management | IMPLEMENTED | AddFilingYearForm, overview page |
| Filing Lifecycle (status transitions) | IMPLEMENTED | FilingActions with role checks |
| Document Upload | IMPLEMENTED | DropZone, UploadSection with polling |
| Document Processing (AI extraction) | IMPLEMENTED | Server-side, triggered on upload |
| Review/Approval (side-by-side) | IMPLEMENTED | Split-pane viewer, per-account review |
| Batch Approval | NOT IMPLEMENTED | PRD specifies "Approve All" |
| Export -- CSV | IMPLEMENTED | Download buttons with blob handling |
| Export -- FinCEN XML | IMPLEMENTED | Status-gated, download flow |
| Export -- PDF Workpaper | IMPLEMENTED | Download flow |
| Settings -- Practice Info | IMPLEMENTED | Edit name, address, EIN |
| Settings -- API Config | IMPLEMENTED | Read-only display |
| Settings -- Team Management | IMPLEMENTED | Invite, role display, MFA status |
| Settings -- Exchange Rates | NOT IMPLEMENTED | PRD Section 3.6 |
| Settings -- Data Retention | NOT IMPLEMENTED | PRD mentions configurable retention |
| Settings -- Export Defaults | NOT IMPLEMENTED | PRD mentions configurable preferences |
| Settings -- Export All Data | PLACEHOLDER | Button exists but disabled |
| Audit Logging | IMPLEMENTED | Server-side, displayed in RecentActivity |
| Middleware Security Headers | IMPLEMENTED | CSP, X-Frame-Options, rate limiting |
| Field-level Encryption | IMPLEMENTED | TIN and account numbers encrypted |
| Notification System | NOT IMPLEMENTED | Bell icon placeholder only |

---

## Config/Deploy — Environment & Service Status

### Environment Variables

| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Set | `postgresql://fbar:fbar_local_dev@localhost:5432/fbar_automator` |
| `POSTGRES_USER` | Set | `fbar` |
| `POSTGRES_PASSWORD` | Set | `fbar_local_dev` |
| `POSTGRES_DB` | Set | `fbar_automator` |
| `NEXTAUTH_SECRET` | Set | Proper base64-encoded secret |
| `NEXTAUTH_URL` | Set | `http://localhost:3000` |
| `ANTHROPIC_API_KEY` | NOT SET | Placeholder `sk-ant-your-key-here` |
| `S3_ENDPOINT` | Set | `http://localhost:9000` |
| `S3_ACCESS_KEY` | Set | `minioadmin` |
| `S3_SECRET_KEY` | Set | `minioadmin` |
| `S3_BUCKET` | Set | `fbar-statements` |
| `S3_REGION` | Set | `us-east-1` |
| `REDIS_URL` | Set | `redis://localhost:6379` |
| `ENCRYPTION_KEY` | Set | 64-char hex string (proper AES-256) |

### Service Status

| Service | Status | Notes |
|---------|--------|-------|
| PostgreSQL | Running (healthy) | All 11 tables migrated |
| Redis | Running (healthy) | Responds to PING |
| MinIO (S3) | Running (healthy) | Console at :9001. Bucket was **missing** — created during audit |
| Next.js App (dev server) | Running | Health endpoint returns OK |
| Next.js App (Docker container) | NOT Running | Dev server runs natively |
| Extraction Worker | NOT Running | Must be started manually |

### Database State

| Entity | Count |
|--------|-------|
| Practices | 1 |
| Users | 2 |
| Clients | 1 |
| Foreign Accounts | 3 |
| Filing Years | 2 |
| Statements | 2 |
| Extracted Data | 2 |
| Reviewed Account Years | 2 |
| Exchange Rates | 24 |
| Audit Logs | 19 |

### Feature Dependency on API Key

| Feature | Works Without API Key |
|---------|----------------------|
| Login / Dashboard | Yes |
| Registration | Yes |
| Client CRUD | Yes |
| Account CRUD | Yes |
| Filing Year CRUD | Yes |
| Statement Upload | Yes (partial — upload succeeds, extraction fails) |
| AI Extraction | **NO** — requires valid ANTHROPIC_API_KEY + running worker |
| Review / Approve | Yes (uses existing extracted data) |
| CSV/XML/PDF Export | Yes |
| Settings / Team Mgmt | Yes |

---

## Backend Security — Encryption & PII Assessment

| Item | Status | Details |
|------|--------|---------|
| TIN encryption at rest | PASS | AES-256-GCM + scrypt KDF |
| EIN encryption at rest | PASS | Encrypted, masked to last 4 in responses |
| Account number encryption at rest | **FAIL** | Stored in plaintext |
| Account number masking in API | MOSTLY PASS | All endpoints mask except `GET /api/statements/[id]` |
| PII in logs | PASS | No TINs/passwords in console output |
| PII in exports | BY DESIGN | XML: unmasked TINs (FinCEN req). CSV/PDF: masked TINs, full account numbers (workpaper req) |
