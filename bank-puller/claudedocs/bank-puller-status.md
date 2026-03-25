# Bank-Puller Status — 2026-03-19

## What This Project Does

Automated bank statement downloader for bookkeeping. Logs into 7 bank portals via Patchright (anti-detection Playwright), navigates to statements using Claude vision AI, downloads PDFs, renames and organizes them. Python CLI, 100% local.

## Architecture (5-phase state machine per bank)

```
Phase 1: Navigate to login URL
Phase 2: Fill credentials (username/password, playbook-assisted)
Phase 3: Post-login handler (2FA, obstacles, enrollment, sign-on-method)
Phase 4: Navigate to statements page (hamburger menu fallback)
Phase 4.5: Prepare statements (dismiss modals, switch card, go to PDF archive) ← NEW
Phase 5: Download statement PDF for each account
```

Key files:
- `run.py` — CLI entry point
- `orchestrator/session_runner.py` — all 5 phases, state machine
- `orchestrator/job_scheduler.py` — parallel window scheduling, Dialpad health
- `orchestrator/tfa_interceptor.py` — SMS/TOTP/push 2FA handling
- `ai_skills/navigation.py` — page classifier (15 states), element finder, obstacle handler
- `ai_skills/base.py` — Claude API wrapper, verified_click, cost tracking
- `ai_skills/statements.py` — find statements page, select specific statement
- `config.py` — timeouts, AI models, retry policy
- `clients.xlsx` — account credentials, 2FA config, run log, retry queue

## Run History

| Run | Date | Downloads | AI Calls | Cost | Duration | Key Progress |
|-----|------|-----------|----------|------|----------|-------------|
| 6 | 03-19 | 0/14 | 54 | $0.27 | 637s | All 7 banks reached login, none past it |
| 7 | 03-19 | 0/12 | 33 | $0.17 | 337s | AmEx reached statements page. 5/7 bug fixes verified. |
| 7.1-7.3 | 03-19 | 0/1 | 7-15 | $0.05-0.07 | 98-242s | AmEx: reached PDF archive, card dropdown opened+scrolled |

## What's Been Done Today (Run 7 fixes — all implemented & verified)

1. **`sign_on_method` page state** — Citi QR page now classified correctly (0.92), handler clicks "Sign On With Password"
2. **Dialpad blank detection** — catches dead Dialpad browser instantly, prevents 120s SMS timeout waste
3. **`enrollment` page state** — BofA enrollment detected (0.97), fails fast in 1 iteration vs 10
4. **Hamburger menu fallback** — when statements link not visible on dashboard, clicks Menu → finds "Statements & Activity"
5. **URL-change in verified_click** — detects SPA navigation even when screenshots look identical
6. **Empty JSON guard** — prevents crash on empty Claude response, retries cleanly
7. **High-confidence unknown abort** — 3x unknown at >0.90 → abort early instead of looping
8. **Phase 4.5: Prepare Statements** — NEW phase that dismisses modals, clicks "Go to PDF Statements", opens card dropdown and scrolls to find target card

## Current State: Where Each Bank Is

### AmEx — 90% there, needs card picker scroll fix
- Login → Dashboard → Menu → Statements & Activity → Dismiss modal → Click "Go to PDF Statements" → **PDF archive page reached** with View/Download buttons for each month
- **February 2026 statement IS available** (closing date Feb 11, 2026)
- Card dropdown opens and scrolls, but AI returns empty JSON when trying to find card #22009 in scrolled dropdown
- Card #22009 is a **5-digit match** — dropdown shows `....22005` which is close but wrong. The card is likely 1-2 more scrolls down.
- **Remaining fix**: Make the dropdown card search match on all 5 digits of `account_last4`, and handle the AI's tendency to return empty responses for dropdown items

### Citibank — needs data fix (direct login URL)
- sign_on_method handler works, clicks "Sign On With Password"
- But Citi redirects to a fresh login form — system sees "login" page and fails
- **Fix**: Change `login_url` in clients.xlsx to the direct password login URL (skip QR page entirely). Discover this URL during a manual/pair-programming session.

### Mercury — needs data fix (TOTP secret)
- Login works perfectly, reaches 2FA prompt
- `2fa_detail` in Excel contains "one time password" (text) instead of base32 TOTP secret
- **Fix**: User must get TOTP setup key from Mercury security settings

### Eastwest Bank — needs data fix (Company ID)
- 3-field login: Company ID + User ID + Password. Agent fills only User ID + Password.
- **Fix**: Add `Company ID = <value>` to notes column in clients.xlsx. May also need code to parse and fill the Company ID field.

### Bank of America — blocked (enrollment needed)
- Account not enrolled in online banking. Shows enrollment form.
- **Fix**: User must complete enrollment manually first.

### Chase Business — blocked (multi-username race)
- 3 usernames fire simultaneously on same browser page, Mercury overwrites all
- **Fix**: Consolidate usernames in clients.xlsx or assign to separate windows

### UBS — blocked (Dialpad profile needs re-auth)
- SMS 2FA requires working Dialpad. Profile shows blank page.
- **Fix**: Run `--setup-dialpad` to re-authenticate

## Key Files Modified Today

| File | Changes |
|------|---------|
| `ai_skills/navigation.py` | Added `sign_on_method` + `enrollment` page states with descriptions |
| `ai_skills/base.py` | URL-change detection in verified_click, empty JSON guard |
| `orchestrator/session_runner.py` | sign_on_method handler, enrollment handler, menu fallback, high-conf unknown abort, Phase 4.5 (prepare_statements with modal dismiss + PDF nav + card picker + scroll) |
| `orchestrator/job_scheduler.py` | Dialpad blank-page health check |
| `orchestrator/tfa_interceptor.py` | Early-out on blank Dialpad in SMS poll |

## Critical Constraints

### Patchright, NOT Playwright
This project uses **Patchright** (anti-detection Playwright fork) because bank websites detect and block standard Playwright. The browser automation API is identical to Playwright, but:
- **DO NOT use DOM selectors for bank page interaction** (e.g., `page.get_by_text()`, `page.locator()`, `page.query_selector()`) — these are detectable and may trigger bot protection
- **ALL bank page interaction must go through AI vision skills** — `skill_find_element()`, `skill_classify_page()`, etc.
- DOM selectors are OK for: Dialpad (not a bank), reading page URLs, keyboard events, mouse clicks at coordinates
- The `human_click()`, `human_type()`, `human_delay()` wrappers add randomized timing to avoid detection

### File Ownership — Concurrent Work
If multiple agents are working on bank-puller simultaneously:
- **Never edit the same file from two chat windows**
- AmEx fixes are in `orchestrator/session_runner.py` — if another agent needs to edit this file, coordinate first
- Safe for concurrent work: `clients.xlsx` data fixes, `claudedocs/`, new files in `ai_skills/`

## Next Steps (priority order)

1. **Fix AmEx card picker** — the AI returns empty JSON for dropdown items. Need to either: use DOM-based card selection (Playwright selectors instead of AI vision), or improve the AI prompt to handle dropdown items better. This is the last mile for the first successful download.
2. **Citibank direct URL** — pair-program or manual session to discover the password-only login URL
3. **Mercury TOTP** — user provides the base32 key
4. **EWB Company ID** — user provides the Company ID + we may need a 3-field login handler
5. **verified_click time waste** — cap offset retries at 2, add networkidle wait

## How to Run

```bash
cd bank-puller

# Dry run (see what would happen)
python run.py --dry-run

# Single bank
python run.py --bank "American Express" --account "Goji" --debug --keep-screenshots

# Full run
python run.py --debug --keep-screenshots

# Watch mode (pauses after each AI call for operator review)
python run.py --bank "American Express" --debug --watch

# Setup Dialpad (manual browser login)
python run.py --setup-dialpad
```

## Runbooks

Detailed per-bank runbooks with exact flows, screenshots, and pair-programming prompts are in:
- `claudedocs/run8-plan.md`

## Post-Mortems

- `claudedocs/run6-postmortem.md` — Run 6 analysis (in repo from earlier)
- `claudedocs/run7-postmortem.md` — Run 7 analysis (written by deep-research agent)
