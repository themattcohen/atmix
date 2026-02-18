# B2B FBAR Automator - Implementation Roadmap

**Generated:** 2026-02-16 | **Updated:** 2026-02-18
**Last updated:** 2026-02-18
**Status:** B2B deployed on Hetzner at 178.156.250.116 (accessible via sslip.io). Launch blockers complete.
**Source:** Opus planning agents with full codebase analysis + web research

---

## Executive Summary

After fixing 10 issues (2 critical, 4 major, 4 minor) in the B2B app, a comprehensive audit identified 8 remaining areas of work. Each was assigned a dedicated opus planning agent. After review, **only 2 items block launch** — a 2-line Docker bug fix and a simple deployment. Everything else is post-launch iteration.

**Current state:** Build passes (`tsc --noEmit` clean), 173 unit/integration tests pass, all 10 prior issues fixed and committed (d7c403e).

---

## Priority Matrix

| Priority | Issue | Category | Effort | Blocks Launch? | Status |
|----------|-------|----------|--------|----------------|--------|
| **LAUNCH** | Worker Docker Bug Fix | Operations | 10 min | **YES** | **DONE** (2026-02-17) |
| **LAUNCH** | Deploy to Hetzner VPS | Infrastructure | 1 day | **YES** | **DONE** (2026-02-18) — live at 178.156.250.116 |
| Post-launch | MFA Implementation | Security | 3-4 days | No (ship within first month) | Not started |
| Post-launch | Tax Software Integrations | Feature | 5-7 days | No | Not started |
| Post-launch | Integration Tests | Quality | 3-4 days | No | Not started |
| Future | 25+ Accounts Part V | Feature | 2-3 days | No (edge case) | Not started |
| Future | SOC 2 Certification | Compliance | 4-5 months | No (when enterprise customers arrive) | Not started |
| Future | Form 8938 Support | Feature | 5-7 days (Phase 1) | No (different form entirely) | Not started |

---

## LAUNCH BLOCKERS (COMPLETE)

### 1. Fix Worker Docker Bug (10 minutes) — DONE 2026-02-17

**What:** `docker-compose.prod.yml` had 2 lines wrong — worker container wouldn't start in production. Fixed and committed. Additionally, worker was missing the `frontend` network needed to reach the Anthropic API; that was also patched.

| Line | Was | Fixed To |
|------|-----|----------|
| 109 | `target: builder` | `target: worker` |
| 110 | `command: npx tsx src/workers/extract.ts` | Removed (Dockerfile CMD used) |
| Worker networks | Missing `frontend` | Added `frontend` network for Anthropic API access |

### 2. Deploy to Hetzner VPS (~1 day) — DONE 2026-02-18

**Decision: Hetzner CAX11 (ARM, 4GB RAM, ~$4/mo)**
- Live at: `178.156.250.116` (accessible via sslip.io)
- Run docker-compose.prod.yml directly
- Caddy for TLS + reverse proxy
- 3x cheaper than DigitalOcean for equivalent specs
- Handles hundreds of concurrent users, thousands of filings
- Bottleneck is Anthropic API latency (5-30s/doc), not the server

**Files updated:**
| File | Action |
|------|--------|
| `docker-compose.prod.yml` | FIXED - Worker target bug + frontend network |
| `Caddyfile.prod` | ADDED - Production Caddy config |
| `.env.unified.example` | ADDED - Unified env var reference |
| `claudedocs/DEPLOY-HETZNER-UNIFIED.md` | ADDED - Full deploy runbook |

---

## POST-LAUNCH: First Month

### Issue 1: MFA Implementation (ship within 30 days)

**Agent:** ae4e309 | **Status:** Plan complete

**Why not blocking:** App already has password auth with bcrypt-12, rate limiting, session management, CSRF protection. MFA adds defense-in-depth but isn't required for a small practice to start using the tool. Ship it before onboarding enterprise customers.

**Summary:** TOTP-based MFA using `otpauth` package. Two-step login flow with `mfaPending` flag in JWT. Recovery codes hashed with SHA-256. Admin can reset user MFA.

**Key Decisions:**
- **Package:** `otpauth` (zero deps, TS-native, actively maintained) + `qrcode` for QR generation
- **Architecture:** `mfaPending` flag in JWT token, middleware enforces redirect to `/mfa-verify`
- **MFA verification:** Short-lived `mfa-verified` httpOnly cookie read by JWT callback (avoids DB polling)
- **Recovery codes:** 8 codes, XXXX-XXXX format, SHA-256 hashed, single-use

**Schema Changes:**
- Add `MfaRecoveryCode` model (id, userId, codeHash, used, usedAt, createdAt)
- Add `mfaVerifiedAt DateTime?` to User model
- Existing `mfaSecret`/`mfaEnabled` fields already present

**New Files (17 total):**
1. `src/lib/mfa.ts` - TOTP generation/verification, QR codes, recovery codes
2. `src/app/api/auth/mfa/setup/route.ts` - Initiate MFA setup
3. `src/app/api/auth/mfa/verify-setup/route.ts` - Complete setup with first TOTP
4. `src/app/api/auth/mfa/verify/route.ts` - Login MFA challenge
5. `src/app/api/auth/mfa/disable/route.ts` - Disable MFA (requires password + TOTP)
6. `src/app/api/auth/mfa/recovery-codes/route.ts` - Regenerate recovery codes
7. `src/app/api/settings/team/[userId]/mfa/route.ts` - Admin reset MFA
8. `src/app/(auth)/mfa-verify/page.tsx` - MFA challenge page during login
9. `src/app/(dashboard)/settings/mfa/page.tsx` - MFA settings server component
10. `src/app/(dashboard)/settings/mfa/MfaSettingsClient.tsx` - MFA enable/disable UI

**Modified Files:**
- `prisma/schema.prisma` - New model + field
- `src/lib/auth.ts` - mfaPending JWT flow, tokenVersion enforcement, login auditing
- `src/middleware.ts` - MFA enforcement redirect, `mfa` rate limit tier
- `src/app/(auth)/login/page.tsx` - MFA redirect after signIn
- `src/app/(dashboard)/settings/SettingsClient.tsx` - MFA section + admin reset button
- `src/app/(dashboard)/settings/page.tsx` - MFA link card
- `src/lib/rate-limit.ts` - Add `mfa` tier

### Issue 6: Tax Software Integrations (high user value)

**Agent:** a60307b | **Status:** Plan complete

**Why not blocking:** The app already exports CSV and PDF workpapers. This makes data entry into tax software faster, but preparers can work without it.

**Research Findings:**
| Platform | Import Path | Feasibility |
|----------|-------------|-------------|
| **Drake Tax** | None - manual entry only (FRGN screen) | N/A |
| **Lacerte** | SDK exists but requires local app access | Not viable for SaaS |
| **CCH Axcess** | Tax Transfer API (XML import) | Only if Form 114 is covered (unconfirmed) |

**Strategy:** Optimized copy-paste — Structured Summary View with Smart Clipboard (field-by-field copy + auto-advance). Platform-specific field ordering (Drake FRGN order vs generic FinCEN order).

**New Files:**
1. `src/lib/export/structured-summary.ts` - Platform field ordering
2. `src/lib/export/platform-validation.ts` - Per-platform validation
3. `src/app/.../export/structured-summary/page.tsx` - Server component
4. `src/app/.../export/structured-summary/StructuredSummaryClient.tsx` - Interactive UI
5. `src/app/api/export/[filingYearId]/structured-summary/route.ts` - JSON API

### Issue 3: Integration Tests (when shipping fast)

**Agent:** ade8901 | **Status:** Plan complete

**Why not blocking:** 173 tests already pass. More tests are insurance for when you're iterating quickly — not a prerequisite for anyone using the product.

**Proposed:** 8 new test files, ~87 new tests covering gaps in consolidation (0%), upload validation (0%), PDF export (0%), and worker lifecycle (0%).

**CI/CD Pipeline** (`.github/workflows/test.yml`):
- Job 1: lint + typecheck (~30s)
- Job 2: vitest with coverage
- Job 3: Playwright E2E with Postgres + Redis GitHub services

---

## POST-LAUNCH: Future (build when needed)

### Issue 2: Worker Deployment Improvements

**Agent:** ae5b88a | **Status:** Plan complete

**What's left after the bug fix:** Heartbeat monitoring, stale job recovery, configurable concurrency, structured logging. All nice-to-have operational polish — the worker already processes jobs correctly.

**New Files (when ready):**
1. `src/workers/heartbeat.ts` (~90 lines) - Redis heartbeat with TTL, job counters
2. `src/workers/stale-job-recovery.ts` (~60 lines) - Reset stuck PROCESSING jobs to PENDING

### Issue 5: 25+ Accounts Consolidated Filing

**Agent:** a8921fb | **Status:** Plan complete

**Why not blocking:** Edge case. Most individual clients have 2-10 foreign accounts. The consolidated filing path is a corporate/entity feature. Almost no early user will hit this.

**Summary:** When a client has 25+ foreign accounts, FinCEN allows consolidated reporting — Part V Items 34-42 provide entity identity only, with no per-account detail. The existing `has25PlusAccounts` flag on `FilingYear` already supports this toggle.

**FinCEN XML Specification:**
- `ActivityPartyTypeCode 44` = Consolidated report account owner
- Part V Items 34-42: identity info only (name, TIN, address)
- When consolidated: Skip Part II/III, only report entity identity
- Record retention: maintain full details for 5 years

**Modified Files (5):**
- `src/lib/export/fbar-xml.ts` - Add consolidated XML generation path
- `src/app/.../[filingYear]/page.tsx` - Consolidated banner + toggle
- `src/app/.../review/ReviewPageClient.tsx` - Entity-only view
- `src/app/.../export/page.tsx` - Retention warning
- `src/types/fbar-xml.ts` - Add consolidated party types

### Issue 7: SOC 2 Certification Prep

**Agent:** ad8502f | **Status:** Plan complete

**Why not blocking:** SOC 2 is for when enterprise customers require it. 4-5 month timeline, $25K-55K cost. Build the technical controls incrementally (MFA is the biggest one, and it's already planned).

**Gap Analysis:** 5 MET, 10 PARTIAL, 17 GAP across 9 Trust Service Criteria categories. 8 security policies needed. 9 technical controls prioritized.

### Issue 8: Form 8938 / FATCA Support

**Agent:** a0cc45d | **Status:** Plan complete
**Full plan:** `claudedocs/form-8938-implementation-plan.md` (700+ lines, 14 sections)

**Why not blocking:** Form 8938 is a completely different form (IRS, not FinCEN). The product is "FBAR Automator" — 8938 is a future expansion. ~80% of account data reusable from FBAR, but it needs new schema, new UI, new export formats.

**Implementation Phases:**
| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | Part V — Financial Accounts only | ~30 files, 2,500-3,500 LOC |
| 2 | Part VI — Other Foreign Assets | ~15 files, 1,500-2,000 LOC |
| 3 | IRS MeF XML export | TBD |

---

## Schema Changes Across All Issues

Multiple issues require Prisma schema changes. These should be consolidated into minimal migrations:

### Migration 1 (MFA + Access Review) — post-launch month 1
```prisma
// User model additions
mfaVerifiedAt       DateTime? @map("mfa_verified_at")
lastLoginAt         DateTime? @map("last_login_at")
isActive            Boolean   @default(true) @map("is_active")
deactivatedAt       DateTime? @map("deactivated_at")
mustChangePassword  Boolean   @default(false) @map("must_change_password")
recoveryCodes       MfaRecoveryCode[]

// New model
model MfaRecoveryCode { ... }
```

### Migration 2 (Data Purge) — when SOC 2 work begins
```prisma
// Client model addition
archivedAt DateTime? @map("archived_at")
```

### Migration 3 (Form 8938) — when 8938 feature is built
```prisma
// New enums
enum FilingStatusType { SINGLE, MARRIED_FILING_JOINTLY, MARRIED_FILING_SEPARATELY, HEAD_OF_HOUSEHOLD, QUALIFYING_WIDOW }
enum ResidencyStatus { US_RESIDENT, LIVING_ABROAD }
enum Form8938AssetCategory { DEPOSIT_ACCOUNT, CUSTODIAL_ACCOUNT, EQUITY_INTEREST, DEBT_INSTRUMENT, DERIVATIVE, TRUST_INTEREST, PENSION, OTHER }

// Client additions
filingStatus    FilingStatusType?
residencyStatus ResidencyStatus?

// ReviewedAccountYear additions
yearEndValueLocal Decimal? @db.Decimal(18, 2)
yearEndValueUsd   Decimal? @db.Decimal(18, 2)

// New models
model Form8938Filing { ... }  // per-client, per-year, status, aggregate values
model Form8938Asset { ... }   // per-asset, linked to ForeignAccount for accounts
```
See `claudedocs/form-8938-implementation-plan.md` for full schema.

---

## Cross-Cutting Concerns

### Files Touched by Multiple Issues
These require careful sequencing to avoid conflicts:

| File | Issues | Resolution |
|------|--------|------------|
| `prisma/schema.prisma` | 1, 7, 8 | Three staged migrations (MFA+Access, Purge, Form 8938) |
| `src/lib/auth.ts` | 1, 7 | MFA first, then access review additions |
| `src/middleware.ts` | 1 | MFA only - already updated for prior fixes |
| `src/app/api/health/route.ts` | 2, 4, 7 | Progressive enhancement (worker -> DB/S3 -> monitoring) |
| `package.json` | 1, 4, 7 | Add all deps in one pass |
| `.env.example` | 2, 4 | Consolidate all new env vars |
| `docker-compose.prod.yml` | 2, 4 | Worker fix first, then production enhancements |

### Shared Infrastructure (build incrementally)
- **Structured logging** (pino) - needed by Issues 2, 4, 7
- **Redis-backed rate limiting** - needed by Issues 1, 4 (current in-memory is fine for single-server)
- **Enhanced health checks** - needed by Issues 2, 4, 7

---

## Agent Output Locations

Full agent transcripts for reference:

| Issue | Agent ID | Output File |
|-------|----------|-------------|
| MFA | ae4e309 | `/private/tmp/claude-501/-Users-matt-atmix/tasks/ae4e309.output` |
| Worker | ae5b88a | `/private/tmp/claude-501/-Users-matt-atmix/tasks/ae5b88a.output` |
| Tests | ade8901 | `/private/tmp/claude-501/-Users-matt-atmix/tasks/ade8901.output` |
| Prod Deploy | a354950 | `/private/tmp/claude-501/-Users-matt-atmix/tasks/a354950.output` |
| 25+ Accounts | a8921fb | `/private/tmp/claude-501/-Users-matt-atmix/tasks/a8921fb.output` |
| Tax Software | a60307b | `/private/tmp/claude-501/-Users-matt-atmix/tasks/a60307b.output` |
| SOC 2 | ad8502f | `/private/tmp/claude-501/-Users-matt-atmix/tasks/ad8502f.output` |
| Form 8938 | a0cc45d | `/private/tmp/claude-501/-Users-matt-atmix/tasks/a0cc45d.output` |

---

## Detailed Plan Documents

- **Form 8938:** `fbar-automator/claudedocs/form-8938-implementation-plan.md` (700+ lines, full schema, API routes, UI pages, phased file breakdown)
- **Production Deploy (AWS):** Agent a354950 output (preserved for when scale demands it)
