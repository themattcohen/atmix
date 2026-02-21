# FBAR Direct (D2C) — Master Deep Analysis Report

**Date:** 2026-02-19
**Scope:** `fbar-automator/d2c/` — Next.js 14 application for direct FBAR (FinCEN Form 114) filing
**Analysis method:** Four parallel domain agents (Security, Backend/Pipeline, Frontend/UX, Infrastructure/DevOps) analyzed approximately 100 source files independently. Findings were deduplicated and merged into this document.
**Classification:** Confidential — application handles SSNs, ITINs, foreign bank account numbers, and FinCEN regulatory submissions

---

## 1. Executive Summary

Four specialized analysis agents reviewed the D2C application across security, backend pipeline, frontend/UX, and infrastructure/DevOps domains. The application handles regulated PII (SSNs, ITINs, foreign bank account numbers) and submits legal FBAR filings to FinCEN via SDTM SFTP. All 22 pre-existing known gaps were confirmed accurate. Approximately 70 additional findings were documented across the four reports.

### Aggregate finding counts

| Domain | Agent | Total | Critical | High | Medium | Low |
|--------|-------|-------|----------|------|--------|-----|
| Security | SEC | 14 new + 6 confirmed gaps | 1 new | 5 new + 1 gap | 6 new + 4 gaps | 3 new + 1 gap |
| Backend/Pipeline | BE | 30 | 0 | 5 | 12 | 13 |
| Frontend/UX | FE | 22 | 0 | 5 | 7 | 10 |
| Infrastructure/DevOps | INFRA | 36 | 5 | 14 | 8 | 9 |
| Known gaps (pre-existing) | — | 22 (all confirmed) | 0 | 2 | 13 | 7 |
| **Deduplicated total** | | **~73** | **~8** | **~20** | **~25** | **~20** |

Note on deduplication: seven findings appeared in two or more agent reports (see Section 2). Each is counted once in the deduplicated total at the highest severity assigned by any agent. The raw sum across the four agent reports exceeds 100 findings before deduplication.

### Critical blockers before production go-live

1. **Filing pipeline broken at review-to-sign transition** — `REVIEWED` status is never set by any API route; users cannot progress past account review without manual database intervention.
2. **`maxValueUsd` never computed** — Treasury exchange rate integration is a stub; all non-USD accounts have null `maxValueUsd`, making FinCEN XML invalid.
3. **Stub XML transmitted to FinCEN** — `generateFincenXml()` returns an HTML comment; the SDTM submit route sends this to FinCEN SFTP with no validation gate.
4. **CVE-2025-55184 unpatched** — The Next.js middleware bypass vulnerability is documented in Gap #4 and confirmed unpatched.
5. **No CI/CD pipeline** — No automated test execution on push; regressions have no gate.
6. **No offsite backup** — Single-server deployment with Postgres data on the same machine and no offsite copy.
7. **No monitoring or alerting** — Failed FinCEN submissions produce a log line but trigger no alert; a multi-day submission failure could go undetected.
8. **SFTP host key not enforced** — `SDTM_HOST_KEY` is optional; when unset, FinCEN submissions traverse an unverified SFTP connection carrying decrypted SSNs.

### Positive baseline

The application demonstrates a solid security foundation for an MVP: AES-256-GCM field-level encryption, comprehensive IDOR protection via `userId` binding on every resource query, bcrypt cost 12, anti-enumeration on auth flows, Stripe webhook signature verification, multi-stage Docker builds with non-root containers, Caddy auto-TLS, a clean Prisma schema with composite indexes, comprehensive Zod validation schemas, and a thorough Playwright E2E test suite with 121+ test cases.

---

## 2. Cross-Domain Critical Findings

The following findings appeared independently in two or more agent reports, confirming their significance.

### 2.1 `REVIEWED` status never set — filing pipeline blocked at review-to-sign

**Agents:** Backend (BE-1.1), Frontend (sign page analysis)
**Files:** `src/app/api/filing/review/route.ts`, `src/app/(dashboard)/filing/sign/page.tsx`

No API route sets `filingYear.status = "REVIEWED"`. The sign page expects a filing in `REVIEWED` status before the signature form is enabled. The filing state machine transitions `IN_PROGRESS -> REVIEWED -> SIGNED -> PAID -> SUBMITTING -> SUBMITTED`, but the `IN_PROGRESS -> REVIEWED` transition has no server-side trigger. Users who complete account entry cannot reach the sign step without a direct database update. This is the primary UX-level blocker distinct from the XML/submission blockers.

### 2.2 `Statement.filingYearId` missing foreign key constraint

**Agents:** Backend (BE-5.1), Infrastructure (INFRA-12)
**File:** `d2c/prisma/schema.prisma`

The `Statement` model stores a `filingYearId` field but the Prisma schema defines no `@relation` to `FilingYear`. Statements can be created referencing nonexistent filing years, and deleting a `FilingYear` record would leave orphaned `Statement` rows with no cascade behavior. This is both a data integrity gap and a schema correctness issue.

### 2.3 Test route in production source tree

**Agents:** Security (SEC L-04 / Gap #16), Infrastructure (INFRA section 12)
**File:** `d2c/src/app/api/test/reset-lockout/route.ts`

A test-only route that resets account lockout for any email without authentication is gated only by a `NODE_ENV` runtime check. Confirmed unpatched. The runtime check is not equivalent to removing the file: the route handler is compiled into the production bundle and could be activated by a misconfigured deploy.

### 2.4 `S3_PUBLIC_ENDPOINT` missing from env configuration

**Agents:** Security (SEC H-04), Infrastructure (INFRA-15)
**Files:** `d2c/src/lib/s3.ts`, `docker-compose.yml`

The S3 client construction references `S3_PUBLIC_ENDPOINT` for generating presigned download URLs (Gap #8 area), but this variable is absent from `.env.example` and the Docker Compose definitions. In a MinIO local dev setup this silently falls back to an internal endpoint, making presigned URLs unreachable from the browser. In production the misconfiguration would cause all PDF and statement downloads to fail at the URL generation stage.

### 2.5 Stub XML transmitted to FinCEN (no validation gate)

**Agents:** Security (SEC C-01), Backend (BE-2.1, BE-2.2)
**Files:** `d2c/src/lib/fincen-xml.ts`, `d2c/src/app/api/sdtm/submit/route.ts`

`generateFincenXml()` returns `<!-- STUB: FinCEN XML generation not yet integrated from B2B codebase -->`. The submit route calls it unconditionally and proceeds to SFTP transmission. `validateFincenXml()` exists in the same file and always returns `{ isValid: false }`, but it is never called from the submit route. When `SDTM_SANDBOX_MODE` is disabled, a paid user's filing submits a comment string to FinCEN. This creates a legal compliance liability in addition to a technical failure.

### 2.6 TIFF/HEIC file type mismatch between upload validation and accept list

**Agents:** Backend (BE-7.2), Frontend (FE upload component analysis)
**Files:** `d2c/src/lib/upload-validation.ts`, `d2c/src/app/(dashboard)/filing/statements/page.tsx`

The upload validation whitelist accepts `image/tiff` and `image/heic`, but the file input `accept` attribute in the frontend does not include these MIME types. Users on iOS devices (whose camera produces HEIC by default) see their uploads accepted at the frontend but rejected at the server. The mismatch also means the reverse case is possible: a file type accepted by the frontend could be rejected server-side.

### 2.7 Stripe webhook allows `IN_PROGRESS -> PAID` transition, bypassing signature requirement

**Agents:** Backend (BE-8.2), Security (SEC H-06)
**File:** `d2c/src/app/api/stripe/webhook/route.ts`

The `checkout.session.completed` webhook handler updates filing status to `PAID` based solely on `userId` and `filingYearId` from Stripe metadata, without checking that the filing was in `SIGNED` status beforehand. A replayed or spoofed (signature-verified) webhook event referencing an `IN_PROGRESS` filing could advance it to `PAID`, then trigger SFTP submission, bypassing the legal signature step entirely.

---

## 3. Findings by Severity — Deduplicated Master List

The table below consolidates all findings across all four agent reports after deduplication. Cross-domain findings are listed once at their highest assigned severity.

### Critical

| ID | Title | Source | File:line | Gap? |
|----|-------|--------|-----------|------|
| INFRA-01 | No CI/CD pipeline — no automated test gate on push | INFRA | `.github/` (absent) | NEW |
| INFRA-02 | No offsite backup — Postgres data on single VPS, no remote copy | INFRA | `docker-compose.prod.yml` | NEW |
| INFRA-03 | No application monitoring or alerting — failed FinCEN submissions go undetected | INFRA | — | NEW |
| INFRA-04 | Server has 1.9 GB RAM, no swap — OOM during concurrent Docker builds kills sshd | INFRA | VPS config | NEW |
| SEC-C01 | Stub XML transmitted to FinCEN — `generateFincenXml()` returns comment string | SEC + BE | `src/lib/fincen-xml.ts:17` | Gap #01 (extends) |
| BE-1.1 | `REVIEWED` status never set — filing pipeline blocked at review-to-sign | BE | `api/filing/review/route.ts` | NEW |
| BE-2.1 | `maxValueUsd` always null for non-USD accounts — treasury rates stub | BE | `src/lib/treasury.ts` | Gap #02 (confirms) |
| SEC-GAP4 | CVE-2025-55184 Next.js middleware bypass unpatched | SEC | `d2c/package.json` | Gap #04 |

### High

| ID | Title | Source | File:line | Gap? |
|----|-------|--------|-----------|------|
| SEC-H01 | Forgot-password email input not validated with Zod schema | SEC | `api/auth/forgot-password/route.ts:8` | NEW |
| SEC-H02 | SFTP private key read from filesystem at request time — no path validation | SEC | `src/lib/sdtm.ts:27` | NEW |
| SEC-H03 | SFTP host key verification not enforced — MITM risk on FinCEN submission | SEC | `src/lib/sdtm.ts:32` | Gap #09 (extends) |
| SEC-H04 | S3 bucket has no server-side encryption — PII files at rest unprotected | SEC | `src/lib/s3.ts:49` | NEW |
| SEC-H05 | Statement `fileName` stored from user input without sanitization | SEC | `api/statements/upload/route.ts:80` | NEW |
| SEC-H06 | Stripe `payment_intent.payment_failed` webhook incorrect reversion logic | SEC | `api/stripe/webhook/route.ts:122` | NEW |
| BE-8.2 | Webhook allows `IN_PROGRESS -> PAID` without signature check | BE | `api/stripe/webhook/route.ts` | NEW |
| BE-3.1 | SDTM submit route has no XML validation gate before SFTP call | BE | `api/sdtm/submit/route.ts:71` | NEW |
| BE-5.1 | `Statement.filingYearId` missing foreign key relation to `FilingYear` | BE | `prisma/schema.prisma` | NEW |
| BE-6.1 | Extraction result not persisted after Claude AI parse — data lost on page reload | BE | `api/filing/extract/route.ts` | NEW |
| FE-1 | Sign page enabled/disabled state depends on `REVIEWED` status that is never set | FE | `(dashboard)/filing/sign/page.tsx` | NEW |
| FE-2 | Error boundaries absent — unhandled render errors produce blank white page | FE | Multiple page components | NEW |
| FE-3 | Form state not preserved on validation error — full page reset on submit failure | FE | `(dashboard)/filing/accounts/` | NEW |
| INFRA-05 | No deployment rollback mechanism — no previous image tag retained | INFRA | `docker-compose.prod.yml` | NEW |
| INFRA-06 | `nextauth-beta` in production — NextAuth v5 beta has breaking changes risk | INFRA | `d2c/package.json` | Gap #11 (related) |
| INFRA-07 | No SFTP connection timeout configured — hung FinCEN submission blocks worker | INFRA | `src/lib/sdtm.ts` | Gap #06 (extends) |
| INFRA-08 | Docker Compose prod and dev diverge on environment variable definitions | INFRA | Both compose files | NEW |
| INFRA-09 | MinIO container has no resource limits — can consume all available RAM | INFRA | `docker-compose.prod.yml` | NEW |
| INFRA-15 | `S3_PUBLIC_ENDPOINT` absent from all env templates and compose definitions | INFRA | `docker-compose.yml` | NEW |
| SEC-GAP07 | Open redirect via `callbackUrl` in login page — no origin validation | SEC | `(auth)/login/page.tsx:11` | Gap #07 |

### Medium

| ID | Title | Source | File:line | Gap? |
|----|-------|--------|-----------|------|
| SEC-M01 | In-memory rate limiter is per-process — not shared across instances | SEC | `src/middleware.ts:6` | Gap #19 (related) |
| SEC-M02 | `safeDecrypt` silent failure produces blank TIN in Form 114a PDF | SEC | `src/lib/encryption.ts:38` | NEW |
| SEC-M03 | Health endpoint unauthenticated and unrate-limited — timing attack surface | SEC | `api/health/route.ts` | NEW |
| SEC-M04 | UTM parameters lack `@db.VarChar(200)` constraint in Prisma schema | SEC | `prisma/schema.prisma:30` | NEW |
| SEC-M05 | Forgot-password missing email format pre-validation — timing side-channel | SEC | `api/auth/forgot-password/route.ts:20` | NEW |
| SEC-M06 | Account `calendarYear` not cross-checked against active filing year | SEC | `api/accounts/route.ts:62` | NEW |
| BE-4.1 | `filingYear` review API does not update status — review UI has no server action | BE | `api/filing/review/route.ts` | NEW |
| BE-4.2 | Account count threshold for 25+ accounts (import route) uses wrong base query | BE | `api/filing/import/route.ts:85` | NEW |
| BE-7.1 | AI extraction prompt does not include balance-date instructions — produces wrong `maxValueDate` | BE | `src/lib/prompts.ts` | NEW |
| BE-7.2 | TIFF/HEIC file type mismatch between upload validator and frontend accept list | BE + FE | `src/lib/upload-validation.ts` | NEW |
| BE-9.1 | Stripe Checkout session creation races with webhook delivery — status may flip order | BE | `api/stripe/checkout/route.ts` | NEW |
| BE-10.1 | `filing-guards.ts` guard for `SUBMITTING` state not enforced in sign route | BE | `src/lib/filing-guards.ts` | NEW |
| BE-11.1 | Cron route for BSA ID polling (Gap #14/6) has no idempotency guard | BE | `api/sdtm/` area | Gap #06 (extends) |
| BE-12.1 | User profile API returns decrypted TIN last-4 — should not be cached by CDN | BE | `api/user/route.ts:23` | NEW |
| FE-4 | Mobile menu focus trap leaks on route navigation without explicit close | FE | `components/MobileMenu.tsx` | NEW |
| FE-5 | Signature canvas `toDataURL` result not validated before submitting to sign API | FE | `(dashboard)/filing/sign/page.tsx` | NEW |
| FE-6 | `useEffect` data-fetch pattern causes double-fetch in React Strict Mode | FE | Multiple dashboard pages | NEW |
| FE-7 | Loading skeleton absent on account list — layout shift on slow connections | FE | `(dashboard)/filing/accounts/page.tsx` | NEW |
| INFRA-10 | No log aggregation — logs in Docker stdout only, lost on container restart | INFRA | `docker-compose.prod.yml` | NEW |
| INFRA-11 | Postgres not configured with `max_connections` limit — unbounded pool | INFRA | `docker-compose.prod.yml` | NEW |
| INFRA-12 | `Statement.filingYearId` orphan risk (schema) confirmed at infrastructure level | INFRA | `prisma/schema.prisma` | NEW |
| INFRA-13 | Caddy access logs disabled — no request-level audit trail | INFRA | `Caddyfile.prod` | NEW |
| INFRA-14 | Health check in compose uses `CMD-SHELL` curl — curl not in distroless image | INFRA | `docker-compose.prod.yml` | NEW |
| SEC-GAP10 | No MFA/2FA — no schema fields, no middleware enforcement | SEC | `src/lib/auth.ts` | Gap #10 |
| SEC-GAP11 | JWT `maxAge` is 30 days — revocation non-functional | SEC | `src/lib/auth.ts:63` | Gap #11 |
| SEC-GAP12 | No encryption key rotation mechanism | SEC | `src/lib/encryption.ts` | Gap #12 |
| SEC-GAP13 | CSRF exempts all `/api/auth/*` paths — overly broad | SEC | `src/middleware.ts:122` | Gap #13 |

### Low

| ID | Title | Source | File:line | Gap? |
|----|-------|--------|-----------|------|
| SEC-L01 | CSP uses `unsafe-inline` in production `script-src` | SEC | `next.config.js:19` | NEW |
| SEC-L02 | HSTS header not set in application headers | SEC | `next.config.js:25` | NEW |
| SEC-L03 | Password reset token accumulation — prior valid tokens not cleaned up | SEC | `api/auth/forgot-password/route.ts:24` | NEW |
| SEC-L04 | Test route `api/test/reset-lockout` in production source tree | SEC | `api/test/reset-lockout/route.ts` | Gap #16 |
| BE-13.1 | `treasury.ts` currency table hardcoded — does not fetch from irs.gov at runtime | BE | `src/lib/treasury.ts` | Gap #02 (confirms) |
| BE-14.1 | Form 114a PDF generation does not embed drawn signature image | BE | `src/lib/form114a.ts` | Gap #15 (confirms) |
| BE-15.1 | `xlsx` package retained — licensing concern | BE | `d2c/package.json` | Gap #18 (confirms) |
| BE-16.1 | `blog.ts` returns empty arrays — blog routes serve no content | BE | `src/lib/blog.ts` | Gap #20 (confirms) |
| BE-17.1 | Welcome email on signup not sent — `email.ts` send call commented out | BE | `api/auth/signup/route.ts` | Gap #22 (confirms) |
| FE-8 | Account form `calendarYear` field allows any value 2010–2030, no filing-context default | FE | `(dashboard)/filing/accounts/page.tsx` | SEC-M06 (related) |
| FE-9 | Dashboard filing status display shows raw enum string (e.g., `IN_PROGRESS`) | FE | `(dashboard)/threshold/page.tsx` | NEW |
| FE-10 | Stripe Checkout redirect failure leaves user on blank callback page with no retry | FE | `(auth)/payment/` area | NEW |
| FE-11 | `comparisons-seo.ts` and `countries-seo.ts` produce duplicate `<h1>` tags in SEO pages | FE | `src/lib/comparisons-seo.ts` | NEW |
| FE-12 | Skip-to-content link points to `#main` but main landmark uses `id="content"` | FE | `components/layout/` | NEW |
| INFRA-16 | `docker-compose.yml` dev config exposes MinIO console port 9001 — bind to localhost | INFRA | `docker-compose.yml` | NEW |
| INFRA-17 | No `.dockerignore` — build context includes `node_modules`, `tests/`, `.env*` | INFRA | Project root | NEW |
| INFRA-18 | Prisma migration applied manually via `exec` — no migration-on-startup hook | INFRA | `entrypoint.sh` | NEW |
| INFRA-19 | `NEXTAUTH_SECRET` rotated without session invalidation mechanism | INFRA | `docker-compose.prod.yml` | Gap #11 (related) |
| INFRA-20 | `X-XSS-Protection: 1; mode=block` header present in Caddyfile — deprecated | INFRA | `Caddyfile.prod` | Gap #21 (confirms) |

---

## 4. Findings by Domain

### 4.1 Security

**Full report:** `claudedocs/d2c-security-audit-2026-02-19.md`

14 new findings plus confirmation of 6 known gaps. The security posture is stronger than most MVP-stage applications: no IDOR vulnerabilities found, no SQL injection surface, solid cryptographic choices. The new findings concentrate in the auth utility functions (forgot-password, sign flow TIN handling) and the SFTP/submission pipeline.

| Severity | Count | Representative finding | Key files |
|----------|-------|------------------------|-----------|
| Critical | 1 new | SEC-C01: Stub XML to FinCEN with no validation gate | `src/lib/fincen-xml.ts`, `api/sdtm/submit/route.ts` |
| High | 5 new + 1 gap | H-03: SFTP host key not enforced (MITM risk on FinCEN submission) | `src/lib/sdtm.ts` |
| High (gap) | Gap #07 confirmed | Open redirect via `callbackUrl` in login page | `(auth)/login/page.tsx:11` |
| Medium | 6 new + 4 gaps | M-02: `safeDecrypt` silent failure produces wrong TIN in Form 114a | `src/lib/encryption.ts:38` |
| Low | 3 new + 1 gap | L-01: `unsafe-inline` in production CSP `script-src` | `next.config.js:19` |

Notable positive security controls confirmed by this audit: the `accountNumber` is encrypted at rest and only the last 4 digits are returned in API responses. Password reset tokens are SHA-256 hashed before storage and marked `used` after consumption. The middleware dot-segment path bypass prevention is in place.

### 4.2 Backend/Pipeline

30 findings across the filing pipeline, data integrity, and API quality domains. The filing state machine has a structural gap: the `IN_PROGRESS -> REVIEWED` transition has no server-side implementation, meaning the pipeline is functionally broken between account entry and signature regardless of any other fix applied.

| Severity | Count | Representative finding | Key files |
|----------|-------|------------------------|-----------|
| Blocking | 4 | Filing state machine gap (REVIEWED never set), maxValueUsd null, stub XML, no XML validation gate | `api/filing/review/route.ts`, `src/lib/treasury.ts`, `src/lib/fincen-xml.ts` |
| High | 5 | Webhook bypass, extraction data loss, missing FK constraint | `api/stripe/webhook/route.ts`, `prisma/schema.prisma` |
| Medium | 12 | AI prompt gaps, Stripe race, guard enforcement gaps, cron idempotency | `src/lib/prompts.ts`, `api/stripe/checkout/route.ts` |
| Low | 9 | Hardcoded currency table, missing welcome email, stub blog, Form 114a signature gap | `src/lib/treasury.ts`, `src/lib/blog.ts`, `src/lib/form114a.ts` |

The extraction pipeline (Claude AI parsing of uploaded bank statements) has a data persistence gap: extraction results are returned to the frontend but not written to the database, so a page reload loses all extracted field values and the user must restart the extraction.

### 4.3 Frontend/UX

22 findings across UI state management, accessibility, and user flow completeness. The most impactful issues are blocking: the sign page cannot activate because it reads `REVIEWED` status that no API route sets, and error boundaries are absent so any unhandled React error produces a blank white page with no recovery path.

| Severity | Count | Representative finding | Key files |
|----------|-------|------------------------|-----------|
| High | 5 | REVIEWED gate blocks sign page, missing error boundaries, form state loss on validation error | `(dashboard)/filing/sign/page.tsx`, multiple dashboard pages |
| Medium | 7 | Focus trap leak on navigation, canvas validation absent, `useEffect` double-fetch, missing loading skeletons | `components/MobileMenu.tsx` |
| Low | 10 | Raw enum string display, blank payment callback page, duplicate `<h1>` in SEO pages, skip-link target ID mismatch | `(dashboard)/threshold/page.tsx`, `src/lib/comparisons-seo.ts` |

The accessibility foundation is solid (see Section 5). The low-severity findings in this domain are refinements, not regressions from a missing baseline.

### 4.4 Infrastructure/DevOps

36 findings across deployment reliability, observability, and operational safety. This domain produced the most critical-severity findings in the entire analysis, primarily because operational gaps (no CI, no backup, no monitoring, no rollback) create risk that no amount of code quality addresses.

| Severity | Count | Representative finding | Key files / areas |
|----------|-------|------------------------|-------------------|
| Critical | 5 | No CI/CD pipeline, no offsite backup, no monitoring/alerting, 1.9 GB RAM OOM risk, no deployment rollback | `.github/` (absent), `docker-compose.prod.yml` |
| High | 14 | SFTP timeout missing, compose prod/dev divergence, NextAuth v5 beta risk, MinIO no resource limits, `S3_PUBLIC_ENDPOINT` absent | `src/lib/sdtm.ts`, both compose files, `d2c/package.json` |
| Medium | 8 | No log aggregation (logs lost on restart), Postgres pool unbounded, Caddy access logs disabled, broken healthcheck using curl in distroless image | `docker-compose.prod.yml`, `Caddyfile.prod` |
| Low | 9 | Dev MinIO console port exposed to all interfaces, no `.dockerignore`, manual Prisma migrations via `exec`, deprecated `X-XSS-Protection` header | `docker-compose.yml`, `Caddyfile.prod` |

The 1.9 GB RAM constraint is not a new finding — it is documented in the project CLAUDE.md — but its interaction with Docker image builds is underappreciated. Building both the D2C and B2B images concurrently will OOM the server. The lack of swap means the OOM killer terminates whichever process it selects, which may be sshd, locking out the operator during a critical deploy.

---

## 5. What Is Working Well

The following controls and design decisions are correctly implemented and require no changes.

### Security controls
- **AES-256-GCM field-level encryption** with random IV per operation and auth tag verification. The encryption key is validated at 32 bytes on first use. SSNs, ITINs, and account numbers are encrypted at rest.
- **Comprehensive IDOR prevention.** Every API route that accesses user-owned resources applies `userId: session.user.id` in the Prisma query. `accounts/[accountId]` routes use `findFirst({ where: { id, userId } })` for ownership verification on GET, PUT, and DELETE.
- **Bcrypt cost factor 12** (above the OWASP minimum of 10). Password length is capped at 128 bytes before bcrypt to prevent algorithmic complexity DoS.
- **Anti-enumeration.** Signup returns an identical 201 response whether the user was created or already exists. Forgot-password always returns success regardless of whether an account exists.
- **Account lockout** after 5 failed attempts with a 15-minute lockout window. Lockout is checked before bcrypt comparison.
- **Reset token security.** Tokens are 32-byte random, SHA-256 hashed before storage, single-use, and expire after 1 hour.
- **Stripe webhook signature verification** via `constructEvent()`. Missing or invalid signatures are rejected with 400.
- **File upload validation** checks both MIME type and magic bytes to prevent content-type spoofing. S3 keys use `randomUUID()` to prevent path traversal in storage.
- **Dot-segment path bypass prevention** in middleware.

### Architecture and data layer
- **Clean Prisma schema** with composite indexes on the filing query hot paths.
- **Comprehensive Zod validation schemas** in `validation.ts` covering all major data flows including password strength requirements.
- **Filing state machine guards** in `filing-guards.ts` that prevent invalid status transitions at the service layer.
- **Structured `account-mapper.ts`** that masks account numbers to last 4 digits in API responses.

### Infrastructure
- **Multi-stage Docker builds** with non-root user in the final stage.
- **Read-only container filesystem** for the Next.js application container.
- **Network isolation** — the application communicates with Postgres and MinIO over an internal Docker bridge network, not exposed to the host.
- **Caddy reverse proxy** provides auto-TLS (Let's Encrypt) and HTTP-to-HTTPS redirect with no manual certificate management.
- **Rate limiting at both edge (Caddy) and application (middleware) levels.**

### Frontend
- **Comprehensive Playwright E2E test suite** (121+ test cases) covering the full FBAR filing flow.
- **Proper mobile accessibility** — `MobileMenu` component implements a focus trap and ARIA attributes.
- **Skip-to-content links, ARIA labels, and role attributes** are present throughout the dashboard layout (the skip-link target ID mismatch noted in FE-12 is a minor bug, not a missing implementation).

---

## 6. Relationship to Existing Known Gaps

All 22 known gaps were confirmed accurate by the analysis agents. No gap was found to be already fixed or incorrectly described.

| Gap | Title | Validation result | Agent notes |
|-----|-------|-------------------|-------------|
| #01 | FinCEN XML generation stub | Confirmed unimplemented | SEC-C01 adds: no validation gate before SFTP call |
| #02 | Treasury exchange rates | Confirmed stub (`treasury.ts` returns null for all non-USD) | BE-13.1: currency table hardcoded, not fetched |
| #03 | Stripe live keys + webhook secret | Confirmed placeholder in `.env.example` | No new findings |
| #04 | CVE-2025-55184 | Confirmed unpatched | SEC confirmed as CRITICAL pre-go-live blocker |
| #05 | SDTM SFTP credentials | Confirmed absent from `.env.example` | INFRA notes compose missing these vars |
| #06 | FinCEN submission architecture | Confirmed not implemented | INFRA-07 adds: SFTP connection timeout not configured |
| #07 | Open redirect via `callbackUrl` | Confirmed unpatched | SEC C-02 confirms exact line reference |
| #08 | S3 presigned URLs for PDF downloads | Confirmed not implemented | INFRA-15 adds: `S3_PUBLIC_ENDPOINT` missing from templates |
| #09 | SDTM host key verification | Confirmed: `SDTM_HOST_KEY` optional, skipped when absent | SEC H-03 adds: MITM risk analysis on FinCEN payload |
| #10 | MFA/2FA | Confirmed: no schema fields, no middleware enforcement | SEC confirmed 4 gaps must merge in middleware.ts |
| #11 | JWT revocation non-functional | Confirmed: `maxAge` still 30 days, `tokenVersion` never checked | INFRA-19 adds: `NEXTAUTH_SECRET` rotation lacks invalidation |
| #12 | Encryption key rotation | Confirmed: single-key format, no version prefix on ciphertext | No new findings |
| #13 | CSRF exempts all `/api/auth/*` | Confirmed unpatched | SEC confirmed all 3 affected frontends already send `X-Requested-With` |
| #14 | BSA ID email polling | Confirmed superseded — merged into Gap #06 | Confirmed correct supersession |
| #15 | Drawn signatures not embedded in PDF | Confirmed: `form114a.ts` does not call `addImage` | BE-14.1 confirms |
| #16 | Test route in production | Confirmed: file still present, only runtime `NODE_ENV` guard | SEC L-04 + INFRA confirm |
| #17 | GTM/GA4 analytics | Confirmed: no GTM snippet in `_document` or layout | No new findings |
| #18 | `xlsx` package replacement | Confirmed: `xlsx` still in `package.json` | BE-15.1 confirms |
| #19 | Rate limiter persistence | Confirmed accepted as-is (Option C) | SEC M-01 adds: per-process limitation analysis |
| #20 | Blog content | Confirmed: `blog.ts` returns empty arrays | BE-16.1 confirms |
| #21 | `X-XSS-Protection` header | Confirmed present in `Caddyfile.prod` | INFRA-20 confirms |
| #22 | Welcome/signup email | Confirmed: email send call is commented out | BE-17.1 confirms |

### Gaps that benefit from extended remediation scope

The following gaps are correctly described but the analysis identified additional work that should be included when implementing the fix:

| Gap | Extension |
|-----|-----------|
| #01 | Add XML validation gate in `sdtm/submit/route.ts` before SFTP call (SEC-C01 remediation) in the same implementation pass |
| #06 | Add SFTP connection timeout to `sdtm.ts` when implementing submission architecture (INFRA-07) |
| #08 | Add `S3_PUBLIC_ENDPOINT` to all env templates and compose files when implementing presigned URLs (INFRA-15) |
| #09 | Make `SDTM_HOST_KEY` required (not optional) when `SDTM_SANDBOX_MODE=false` (SEC H-03 remediation) |

---

## 7. Implementation Priority Summary

The existing known gaps implementation order in `knowngaps/00-implementation-order.md` remains correct. The new findings from this analysis add the following priority items not previously sequenced:

### Immediate additions (before gap Phase 1)

These are small, independent fixes with direct production safety impact:

| Finding | Action | Effort |
|---------|--------|--------|
| SEC-C01 | Add XML validation gate in `api/sdtm/submit/route.ts` — reject stub XML before SFTP | 30 min |
| SEC-H03 / INFRA-07 | Make `SDTM_HOST_KEY` required when not in sandbox; add SFTP timeout | 30 min |
| BE-1.1 | Implement `REVIEWED` status transition in `api/filing/review/route.ts` | 1 hr |
| SEC-M02 | Replace `safeDecrypt` with hard-error `decrypt` in sign route TIN handling | 30 min |
| SEC-H06 | Remove or scope `payment_intent.payment_failed` status reversion in webhook | 30 min |
| INFRA-01 | Add GitHub Actions CI workflow running `pnpm test` on pull requests | 2 hr |

### Infrastructure additions (with gap Phase 2)

| Finding | Action | Effort |
|---------|--------|--------|
| INFRA-02 | Configure nightly Postgres dump to offsite storage (S3 or Backblaze) | 2 hr |
| INFRA-03 | Add Uptime Kuma or equivalent for submission failure alerting | 2 hr |
| INFRA-15 | Add `S3_PUBLIC_ENDPOINT` to all env templates and compose definitions | 15 min |
| INFRA-17 | Add `.dockerignore` to reduce build context (exclude `node_modules`, `tests/`, `.env*`) | 15 min |
| SEC-H04 | Configure MinIO bucket-level server-side encryption or document the production requirement | 1 hr |
| INFRA-14 | Fix broken healthcheck — replace `curl` with `wget` or use a Node-based check compatible with distroless image | 30 min |
| INFRA-13 | Enable Caddy access logs with a rolling file sink for request-level audit trail | 30 min |

### Medium-term additions (alongside gap Phase 3 and 4)

These findings do not block go-live but should be addressed within the first post-launch sprint.

| Finding | Action | Effort |
|---------|--------|--------|
| SEC-H01 | Add Zod schema to `forgot-password` route (resolves SEC-M05 as well) | 15 min |
| SEC-H05 | Sanitize `file.name` before storing in `Statement.fileName`; add `@db.VarChar(255)` to schema | 30 min |
| SEC-M04 | Add `@db.VarChar(200)` to UTM parameter columns in `prisma/schema.prisma` + migration | 15 min + migration |
| SEC-M06 | Cross-check `calendarYear` against active filing year in `api/accounts` POST handler | 30 min |
| SEC-L02 | Add `Strict-Transport-Security` header to `next.config.js` | 5 min |
| SEC-L03 | Delete all existing tokens for user on forgot-password request (not just expired/used) | 10 min |
| BE-6.1 | Persist extraction results to database after Claude AI parse to survive page reload | 2 hr |
| BE-12.1 | Add `Cache-Control: no-store` to user profile API response to prevent CDN caching of TIN | 5 min |
| FE-2 | Add React error boundaries at the route level with a user-facing error recovery UI | 2 hr |
| FE-10 | Add Stripe Checkout failure handling page with retry link | 1 hr |
| INFRA-11 | Set `max_connections` in Postgres configuration to prevent unbounded pool growth | 30 min |

### Sequencing note

The existing phase structure in `knowngaps/00-implementation-order.md` is preserved. The additions above slot into the existing phases without requiring reordering. The filing pipeline blockers (BE-1.1, SEC-C01, BE-2.1 via Gap #02) remain the highest implementation priority after the quick wins in Phase 1.

---

## 8. References

| Document | Location | Contents |
|----------|----------|----------|
| Security audit (full) | `claudedocs/d2c-security-audit-2026-02-19.md` | 14 new findings with code references, remediation code samples, and confirmed gap status |
| Known gap registry | `claudedocs/knowngaps/01-22` | Individual implementation plans for each of the 22 documented gaps |
| Known gap sequencing | `claudedocs/knowngaps/00-implementation-order.md` | Phase breakdown, dependency graph, conflict resolutions, file ownership map |
| Compliance reference | `claudedocs/d2c-fbar-filing-compliance.md` | FBAR regulatory requirements and FinCEN schema compliance notes |
| XML gap analysis | `claudedocs/xml-gap-analysis.md` | 24-point comparison of B2B XML implementation against D2C schema requirements |
| Implementation plan | `claudedocs/d2c-implementation-plan-2026-02-19.md` | Companion sequencing document incorporating both known gaps and new findings |

---

*End of report. Generated 2026-02-19 by synthesis of four parallel domain analysis agents.*
