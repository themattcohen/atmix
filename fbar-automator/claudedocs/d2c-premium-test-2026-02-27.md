# D2C Premium AI Extraction Pathway — Test Report (2026-02-27)

## Test Scope
End-to-end verification of the Premium filing pathway: upload bank statements, AI extracts accounts via Claude, user reviews/edits, then sign → pay → Stripe checkout.

## Test Account
- Email: `test-mfa-migration@atmix.org`
- Filing Year: **2024** (separate from existing 2025 Basic filing)
- Tier: **PREMIUM** ($79)

## Sample Documents Used
- **Zip 1** (`documents.zip`): 12 monthly Chequing Statement-8030 PDFs (Jan–Dec 2025, Royal Bank of Canada)
- **Zip 2** (`documents (2).zip`): 12 monthly Savings Statement-0685 PDFs (Jan–Dec 2025, Royal Bank of Canada)
- One PDF from each zip uploaded for testing

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| ANTHROPIC_API_KEY configured | PASS | Key present in D2C container |
| Premium tier selection | PASS | PREMIUM selected, UI switched to upload mode |
| File type validation | PASS | Rejected .zip ("Unsupported file type"), accepted .pdf |
| S3 statement upload | PASS | 2 PDFs in MinIO (332 KB + 77 KB) |
| Claude AI extraction #1 (Chequing) | PASS | High confidence: RBC, acct 06550-5448030, CAD 5,314.57 |
| Claude AI extraction #2 (Savings) | PASS | High confidence: RBC, acct 06000-5230685, CAD 0.24 |
| Extraction warnings | PASS | Ownership type inferred, currency inferred, zero-balance noted |
| Editable extracted fields | PASS | All fields editable in review panel |
| Save extracted accounts | PASS | Both accounts saved to filing |
| Account accumulation | PASS | "Continue to Review (2 accounts)" after second upload |
| Review page — correct filing | PASS (after fix) | Calendar Year 2024, 2 accounts, $5,314.81 total |
| Sign Form 114a | PASS | PDF uploaded to S3 (5.8 KB) |
| Payment page — correct tier | PASS (after fix) | Premium Filing, $79.00 |
| Stripe checkout redirect | PASS | checkout.stripe.com, "$79.00", "Premium" label |

## S3 Bucket Contents (post-test)

```
fbar-direct/
├── d2c/{userId}/{filingYearId}/
│   ├── d206752c-...pdf   (332 KB — Chequing statement)
│   └── 85be9d14-...pdf   (77 KB — Savings statement)
├── form114a/{userId}/2024/
│   └── 1772220216463_form114a.pdf   (5.8 KB — 2024 Premium)
└── form114a/{userId}/2025/
    └── 1772218072339_form114a.pdf   (5.8 KB — 2025 Basic)
```

## Bugs Found & Fixed

### Bug 1: Review page picks wrong filing year (commit 919b18e)
- **Symptom**: `/review` showed 2025 Basic filing data (1 account, Test Bank London) instead of 2024 Premium filing (2 accounts, RBC)
- **Root cause**: `review/page.tsx` used `.find()` with `["IN_PROGRESS","REVIEWED","SIGNED","PAID"]`. API returns filings sorted by `calendarYear DESC`, so the 2025 SIGNED filing was always found first.
- **Fix**: Two-pass `.find()` — first look for IN_PROGRESS/REVIEWED (actively being worked on), then fall back to SIGNED/PAID.
- **Scope**: 5 wizard pages have similar `.find()` patterns (accounts, review, sign, payment, confirmation). Review was the worst because it included SIGNED in the active filter.

### Bug 2: Payment page picks wrong filing year (commit c7e4ab7)
- **Symptom**: `/payment` showed 2025 Basic filing ($59, 1 account) instead of 2024 Premium ($79, 2 accounts). Both filings were SIGNED, so priority-based `.find()` alone couldn't resolve the ambiguity.
- **Root cause**: `.find()` returned the first SIGNED filing from API (2025 due to calendarYear DESC sort).
- **Fix**: sessionStorage-based tracking. Review/sign pages store `activeFilingYearId` in sessionStorage when selecting/signing a filing. Payment page checks sessionStorage first, falls back to `.find()` for direct-access scenarios.

### Remaining: 3 pages with similar `.find()` patterns (lower severity)
- **Accounts page** (`["IN_PROGRESS","REVIEWED"]`): Less affected — skips SIGNED, so usually finds the right one
- **Sign page** (`REVIEWED || IN_PROGRESS`): Less affected — only matches pre-signed filings
- **Confirmation page** (`["PAID","SUBMITTING","SUBMITTED","ACCEPTED","REJECTED"]`): Only matches post-payment, unlikely to have multiple

## AI Extraction Quality Assessment

The Claude extraction correctly identified from bank statement PDFs:
- Institution name (Royal Bank of Canada)
- Account numbers (full format: 06550-5448030, 06000-5230685)
- Account type (Bank Account)
- Country (Canada)
- Currency (CAD — inferred from institution and country)
- Maximum balance values ($5,314.57 and $0.24)

Extraction warnings were appropriate and helpful:
- Ownership type couldn't be determined from document → correctly flagged
- Currency inferred rather than explicit → correctly flagged
- Zero-balance period detected → correctly flagged
- Balance = opening = closing → correctly noted

## CI/CD Pipeline
Both fixes went through the full pipeline:
1. `git push` → GitHub Actions "D2C FBAR CI" (lint, typecheck, unit tests, build, E2E)
2. On CI success → "D2C FBAR Build & Push" (Docker image → GHCR)
3. Manual `docker compose pull + up -d` on Hetzner VPS
