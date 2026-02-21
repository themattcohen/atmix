# Known Gaps — Implementation Order

> Master sequencing document for the 22 known-gap remediation plans in this directory.
> Created from cross-gap quality analysis on 2026-02-19.

## Conflict Resolutions Applied

Five cross-gap conflicts were identified and resolved. The gap docs themselves have been amended with `⚠️ Cross-Gap Resolution` sections. Summary:

| # | Conflict | Resolution |
|---|----------|------------|
| 1 | Gap #6 + #14 duplicate `d2c-cron` service | Merged into Gap #6. Gap #14 marked superseded. |
| 2 | Gap #5 + #9 duplicate `SDTM_HOST_KEY` env var | Implement together in a single pass. |
| 3 | Gap #13 CSRF narrowing breaks Gap #10 MFA routes | Gap #10 docs updated: all MFA fetch calls must include `X-Requested-With` header. |
| 4 | Gap #10 MFA middleware missing API route coverage | Gap #10 docs updated: middleware returns 403 for API routes when `mfaPending`, not just page redirects. |
| 5 | Inconsistent cron auth headers (#6 vs #14) | Standardized on `Authorization: Bearer ${CRON_SECRET}` across all cron routes. |

## Coordination Requirements

### middleware.ts — 4 Gaps Must Merge (Gaps #10, #11, #13, #19)

All four gaps touching `d2c/src/middleware.ts` must be implemented in a **single coordinated pass**. Correct execution order within middleware:

1. Static file bypass (existing, unchanged)
2. Rate limiting (Gap #19 — keep as-is with Option C)
3. CSRF check (Gap #13 — narrow exemption list)
4. Auth passthrough for NextAuth/Stripe (existing, unchanged)
5. API auth check (existing, unchanged)
6. **Revocation check (Gap #11)** — must come before MFA
7. **MFA pending redirect (Gap #10)** — must come after revocation
8. Page auth / redirect to login (existing, unchanged)

### auth.ts — Gaps #10 + #11

Both modify `d2c/src/lib/auth.ts` but touch non-overlapping sections:
- Gap #11 Fix A: `maxAge: 30d` → `7d` (isolated line change)
- Gap #10: `authorize` callback (add `mfaPending`), `jwt` callback (pass through + cookie check), `session` callback (expose to client)

Apply Gap #11 first (simpler), then Gap #10.

### Filing Pipeline — Sequential Chain

```
Gap #02 (Treasury rates) → Gap #01 (XML generation) → Gap #06 (Submission architecture)
```

- Without treasury rates, `maxValueUsd` is null for non-USD accounts → XML invalid
- Without XML generation, `submitFiling()` produces stub XML → FinCEN rejects
- These three MUST be implemented in this exact order

## Phase Breakdown

### Phase 1: Quick Wins
Independent, small effort, no conflicts. Can be implemented in any order or in parallel.

| Gap | Effort | Description | Files |
|-----|--------|-------------|-------|
| #4  | S | Next.js CVE-2025-55184 version bump | `d2c/package.json` |
| #7  | S | Open redirect fix (login `callbackUrl` validation) | `d2c/src/app/(auth)/login/page.tsx` |
| #16 | S | Delete test route `/api/test/*`, update test helpers | `d2c/src/app/api/test/`, test files |
| #21 | S | Delete deprecated `X-XSS-Protection` header from Caddyfile | `Caddyfile.prod` |

**Estimated total: 1-2 hours**

### Phase 2: Infrastructure & Config
Mostly ops changes. Some code. Independent of each other unless noted.

| Gap | Effort | Description | Files |
|-----|--------|-------------|-------|
| #3  | S | Stripe live keys + webhook secret (ops only) | `.env`, `docker-compose.prod.yml` |
| #5 + #9 | S+S | SDTM SFTP credentials + host key verification (implement together) | `.env`, `docker-compose.prod.yml`, `d2c/src/lib/sdtm.ts` |
| #8  | M | S3 presigned URLs for PDF downloads | `d2c/src/lib/storage.ts`, `Caddyfile.prod`, env vars |
| #17 | M | GTM/GA4 analytics (Dockerfile ARG + compose) | `d2c/Dockerfile`, `docker-compose.prod.yml`, `.env` |

**Estimated total: 4-6 hours**

### Phase 3: Filing Pipeline
**MUST be sequential.** Each step depends on the previous.

| Order | Gap | Effort | Description | Depends On | Status |
|-------|-----|--------|-------------|------------|--------|
| 1st   | #2  | M | Treasury exchange rates (copy from B2B, adapt schema) | — | BLOCKED |
| ~~2nd~~ | ~~#1~~ | ~~L~~ | ~~FinCEN XML generation (port from B2B, 6 schema diffs)~~ | ~~Gap #2~~ | **DONE** (2026-02-21) |
| 3rd   | #6  | L | Submission architecture + cron (absorbs Gap #14) | ~~Gap #1~~ Gap #2 | BLOCKED on #2 |

**Estimated total: ~~12-20~~ 4-12 hours remaining (Gap #1 complete)**

### Phase 4: Security Hardening
Implement as **one coordinated middleware pass**. Internal order matters.

| Order | Gap | Effort | Description |
|-------|-----|--------|-------------|
| 1st   | #13 | S | CSRF exemption narrowing (change `isExempt` logic) |
| 2nd   | #11 | S | JWT maxAge 30d → 7d (Fix A only) |
| 3rd   | #10 | XL | MFA/2FA — largest single gap (schema + 8 new files + middleware + UI) |
| 4th   | #12 | L | Encryption key rotation mechanism |

Gap #19 (rate limiter) is already implemented with Option C — accept as-is, no changes needed.

**Estimated total: 16-28 hours**

### Phase 5: Low Priority / Post-Launch
No urgency. Implement when convenient.

| Gap | Effort | Description |
|-----|--------|-------------|
| #15 | M | Drawn signatures embedded in PDF (jsPDF `addImage`) |
| #18 | M | Replace `xlsx` package with `exceljs` (licensing) |
| #19 | S | Rate limiter — already acceptable (Option C), document decision |
| #20 | M | Blog content pages |
| #22 | S | Welcome/signup email via Resend |

**Estimated total: 8-12 hours**

## Dependency Graph

```
Phase 1 (independent):  #4  #7  #16  #21
                          |
Phase 2 (independent):  #3  #5+#9  #8  #17
                          |
Phase 3 (sequential):  #2 → #1 → #6 (absorbs #14)
                          |
Phase 4 (coordinated): #13 → #11 → #10 → #12
                          |
Phase 5 (independent):  #15  #18  #19  #20  #22
```

Phases 1 and 2 can run in parallel.
Phase 3 must complete before Phase 4 starts (no hard dependency, but recommended to avoid mid-pipeline security changes).
Phase 5 can start any time after Phase 1.

## File Ownership Map

Files touched by multiple gaps — must be coordinated:

| File | Gaps | Coordination |
|------|------|-------------|
| `d2c/src/middleware.ts` | #10, #11, #13, #19 | Single pass in Phase 4 |
| `d2c/src/lib/auth.ts` | #10, #11 | Gap #11 first, then #10 |
| `docker-compose.prod.yml` | #3, #5, #6, #8, #9, #14, #17 | No code conflicts — different sections |
| `.env.unified.example` | #3, #5, #8, #9, #17 | No conflicts — different env var sections |
| `Caddyfile.prod` | #8, #21 | No conflicts — different blocks |

## Superseded Gaps

| Gap | Status | Reason |
|-----|--------|--------|
| #14 | Merged into #6 | Duplicate cron service + polling logic |
| #19 | Accept as-is | Option C already implemented, no code changes needed |
