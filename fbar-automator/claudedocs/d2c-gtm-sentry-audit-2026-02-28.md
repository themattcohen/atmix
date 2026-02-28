# Completeness Audit: GTM→gtag.js + Sentry CSP Deployment

**Date**: 2026-02-28
**Scope**: D2C FBAR (`fbar-automator/d2c/`)
**Verdict**: COMPLETE — No Gaps Found

All critical paths are correctly wired. No action needed.

---

## Background

After deploying the GTM→gtag.js swap (commit `cec5376`) and Sentry US-region CSP fix (commit `41d0027`), this audit verifies all references were updated across the codebase, infrastructure, and CI/CD pipeline.

### Related Commits
| Commit | Description |
|--------|-------------|
| `b1cd43a` | Wire Sentry, payment receipt email, GTM funnel events, Google Ads CSP |
| `cec5376` | Swap GTM container loader to gtag.js for Google Tag (GT-) IDs |
| `41d0027` | Add US-region Sentry ingest to CSP connect-src |

---

## Audit Results

### 1. GoogleTagManager Component — COMPLETE

- `src/components/analytics/GoogleTagManager.tsx` loads `gtag/js` (not `gtm.js`)
- No `<noscript><iframe>` (GTM-specific, correctly removed)
- No old GTM container loader references anywhere in codebase

### 2. dataLayer / pushDataLayer — COMPATIBLE

- `src/lib/gtm.ts` — `pushDataLayer()` pushes to `window.dataLayer` (works with gtag.js identically)
- `src/types/gtm.d.ts` — `window.dataLayer` type unchanged (correct)
- 7 funnel pages call `pushDataLayer()`: signup, personal, accounts, review, sign, payment, confirmation
- All events use GA4 naming conventions (snake_case)

### 3. Layout Integration — CORRECT

- `src/app/layout.tsx` line 72: `<GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ''} nonce={nonce} />`
- Falls back to empty string → component returns null → no analytics in CI/test (correct)

### 4. CSP Headers — FIXED

`src/middleware.ts` line 20 connect-src includes:
- `https://*.ingest.sentry.io` (generic fallback)
- `https://*.ingest.us.sentry.io` (US-region, required for our DSN)

Other CSP directives:
- script-src allows: `googletagmanager.com`, `google-analytics.com`, `googleadservices.com`
- img-src allows: GA, GTM, Google Ads, DoubleClick
- frame-src allows: GTM, DoubleClick

**Key learning**: `*.ingest.sentry.io` does NOT match `x.ingest.us.sentry.io` — both wildcards are required.

### 5. Environment Variables — ALL SET

| Variable | .env | .env.example | Dockerfile ARG | docker-compose.prod | GH Secret | VPS .env |
|----------|------|-------------|----------------|---------------------|-----------|----------|
| `NEXT_PUBLIC_GTM_ID` | GT-P3JRZMRX | GT-XXXXXXX | Yes | Yes | Yes | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | real DSN | real DSN | Yes | Yes | Yes | via Docker |
| `SENTRY_DSN` | real DSN | real DSN | — | Yes | — | via Docker |

### 6. Sentry SDK — COMPLETE

| File | Integration |
|------|------------|
| `sentry.client.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` |
| `sentry.server.config.ts` | `SENTRY_DSN` |
| `sentry.edge.config.ts` | `SENTRY_DSN` |
| `next.config.js` | `withSentryConfig()` wrapper |
| `src/app/error.tsx` | `Sentry.captureException(error)` |
| `src/app/global-error.tsx` | `Sentry.captureException(error)` |
| `src/lib/auth.ts` | `Sentry.setUser()` on login |
| `src/lib/sentry.ts` | PII scrubbing (SSN, IBAN, account numbers) |
| `src/instrumentation.ts` | Graceful warn if DSN missing |

### 7. CI/CD Pipeline — CORRECT

- `fbar-d2c-build.yml` passes `NEXT_PUBLIC_GTM_ID` + `NEXT_PUBLIC_SENTRY_DSN` as Docker build args
- `fbar-d2c-ci.yml` runs E2E tests (analytics vars intentionally absent — tests don't validate tracking)

### 8. Tests — ADEQUATE

| Test File | Coverage |
|-----------|----------|
| `tests/e2e/gtm-smoke.spec.ts` | Marketing pages render correctly |
| `tests/e2e/csp-nonce.spec.ts` | 4 tests: CSP header presence, nonce uniqueness, no duplication |
| `tests/api/sentry-scrub.test.ts` | 17 test suites for PII scrubbing |

---

## Non-Issues (Flagged During Audit, Not Actual Gaps)

| Finding | Why It's Fine |
|---------|---------------|
| `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` not in Docker/CI | For future server-side Measurement Protocol. GA4 tracking works client-side via gtag.js auto-linking. No code references them. |
| `SENTRY_ORG` / `SENTRY_PROJECT` not in Docker build args | Only used by Sentry CLI for source map uploads (disabled: `disableSourceMapUpload: true`). Read from `.env` at build time. |
| E2E tests don't verify dataLayer events | Marketing smoke tests validate page rendering. Analytics verified manually via Chrome DevTools in production. |
| CI has no analytics env vars | Correct — tests shouldn't depend on external analytics services. |

---

## Production Verification (Performed 2026-02-28)

| Check | Result |
|-------|--------|
| gtag.js loads (`GT-P3JRZMRX`) | 200 on all 14 pages tested |
| GA4 beacon fires (`G-W2KXELPKZE`) | 204 to `google-analytics.com/g/collect` |
| Sentry SDK loaded | v10.39.0, `__SENTRY__` global present |
| Sentry envelope sent | 200 to `o4510765183467520.ingest.us.sentry.io` |
| No CSP violations | Zero after CSP fix |
| Sentry dashboard | Test event `FBAR-DIRECT-1` captured |
| Google Tag detected | Google confirms tag found on fbardirect.com |

---

## Configuration Reference

- **Google Tag**: `GT-P3JRZMRX` (env var: `NEXT_PUBLIC_GTM_ID`)
- **GA4 Stream**: `G-W2KXELPKZE` (auto-linked via Google Tag config)
- **Sentry**: v10.39.0, DSN baked into Docker image at build time
- **Sentry Ingest**: `o4510765183467520.ingest.us.sentry.io` (US-region)
