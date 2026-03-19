# Bank-Puller: Comprehensive Guide

## What It Does

Bank-Puller is a Python CLI tool that automates downloading monthly bank statements from financial institution websites. It uses Playwright for browser automation, Claude AI (vision + text) for dynamic page navigation, and an Excel workbook as the master credential/config store.

**Who it's for:** Accounting firms and bookkeepers managing dozens of client bank accounts who need to pull prior-month PDF statements on a recurring basis.

## Architecture Overview

### 5-Phase State Machine

Each bank+username group runs through these phases sequentially:

| Phase | Name | Description |
|-------|------|-------------|
| 1 | **Navigate** | Discover/load login URL, open bank website |
| 2 | **Login** | Enter username/password using playbook cascade (selector → coords → AI) |
| 3 | **Post-Login** | Handle 2FA, security questions, popups, confirm dashboard reached |
| 4 | **Statements Nav** | Find and click the statements/documents page link |
| 5 | **Download** | Select target month, download PDF, validate, organize output |

### AI Vision System

- **Sonnet** (`claude-sonnet-4-6`) — complex tasks: element finding, obstacle handling, statement selection, security Q&A
- **Haiku** (`claude-haiku-4-5-20251001`) — simple tasks: page classification, 2FA code reading
- Screenshots compressed from 1920x1080 → 960x540 (~75% token savings)
- Confidence threshold: 0.7 minimum to accept AI result
- Max 2 retries per skill call

### Playbook System

Playbooks are per-bank JSON files (`playbooks/{bank-slug}.json`) that cache login flows to avoid repeated AI calls:

1. **Learn mode** (first run or stale): AI navigates, records CSS selectors + click coordinates
2. **Replay mode** (subsequent runs): Try selector → try coords → fall back to AI
3. **Expiry**: After 3 consecutive failures or 30 days, playbook re-learns
4. **Savings**: ~4 AI calls avoided per login replay (~$0.06 saved)

## Setup Checklist

### 1. API Key

Create `.env` in `bank-puller/`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Install Dependencies

```bash
cd bank-puller
pip install -r requirements.txt
playwright install chromium
```

### 3. Excel Workbook

Create `clients.xlsx` in `bank-puller/` with three sheets: **Accounts**, **Run Log**, **Retry Queue** (see Excel Workbook Structure below).

### 4. Dialpad Setup (if using SMS 2FA)

```bash
python run.py --setup-dialpad
```

Browser opens Dialpad — **check `operations@allsolutionsconsult.com` email for Dialpad's own verification code** and enter it. After login, the app auto-navigates to **Compound Accounting > New** messages tab. Press Enter to save the profile.

- **Phone number**: (720) 508-1992 (Compound Accounting department)
- **Auto-navigation**: On each run, the app navigates Dialpad to the correct inbox automatically (with AI fallback if selectors fail)
- **Sender auto-learn**: After first successful SMS poll, the sender ID is saved to `2fa_sender` in Excel
- **Re-authenticate**: Run `--setup-dialpad` when the health check warns the profile has expired

## CLI Reference

```
python run.py [OPTIONS]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | False | Show plan without launching browsers |
| `--debug` | False | Save screenshots, verbose logging, slower delays |
| `--account NAME` | None | Process only this client (fuzzy match) |
| `--bank NAME` | None | Process only this bank (fuzzy match, combine with --account) |
| `--retry-only` | False | Only process items in Retry Queue |
| `--keep-screenshots` | False | Don't delete debug screenshots after run |
| `--watch` | False | Pause after each AI call for operator review |
| `--relearn` | False | Ignore existing playbooks, re-learn all bank flows |
| `--setup-dialpad` | False | Open Dialpad browser for manual login, save profile |

### Watch Mode Controls

When `--watch` is active, after each AI skill call:
- **Enter** — continue
- **s** — skip this account
- **q** — abort entire run
- Auto-continues after 5 minutes of no input

## Configuration Reference (config.py)

### Paths

| Setting | Value |
|---------|-------|
| `CLIENTS_XLSX` | `bank-puller/clients.xlsx` |
| `BROWSER_PROFILES_DIR` | `bank-puller/browser-profiles/` |
| `DOWNLOADS_DIR` | `bank-puller/downloads/` |
| `OUTPUT_DIR` | `bank-puller/output/` |
| `DEBUG_SCREENSHOTS_DIR` | `bank-puller/debug-screenshots/` |
| `LOGS_DIR` | `bank-puller/logs/` |
| `PLAYBOOKS_DIR` | `bank-puller/playbooks/` |

### AI Models

| Setting | Value | Usage |
|---------|-------|-------|
| `AI_MODEL` | `claude-sonnet-4-6` | Complex vision tasks (navigation, security, statements) |
| `AI_MODEL_FAST` | `claude-haiku-4-5-20251001` | Simple classification, 2FA code OCR |
| `AI_MAX_RETRIES` | 2 | Retries on low confidence or API error |
| `AI_CONFIDENCE_THRESHOLD` | 0.7 | Min confidence to accept result |

### Browser

| Setting | Value |
|---------|-------|
| `MAX_CONCURRENT_BANK_WINDOWS` | 2 |
| `SCREENSHOT_RESOLUTION` | 1920x1080 |
| `AI_SCREENSHOT_RESOLUTION` | 960x540 (downscaled for AI) |
| `BROWSER_LOCALE` | `en-US` |
| `BROWSER_TIMEZONE` | `America/Denver` |

### Timeouts

| Setting | Value |
|---------|-------|
| `page_navigation` | 30s |
| `element_search` | 10s |
| `2fa_code_wait` | 120s (2 min) |
| `push_2fa_wait` | 180s (3 min) |
| `pdf_download` | 30s |
| `session_total` | 480s (8 min per bank+username group) |
| `run_total` | 3600s (1 hour total) |

### Human-like Delays

| Setting | Min | Max |
|---------|-----|-----|
| Typing delay (ms between keystrokes) | 50 | 150 |
| Click pause (s after click) | 0.5 | 1.5 |
| Action delay (s between actions) | 1.0 | 3.0 |

### Retry Backoff

| Retry Count | Wait Days | Notes |
|-------------|-----------|-------|
| 1 | 0 (same day) | Immediate retry next run |
| 2 | 1 day | |
| 3 | 3 days | |
| 4+ | N/A | Marked "abandoned" |

### Other

| Setting | Value |
|---------|-------|
| `PLAYBOOK_MAX_AGE_DAYS` | 30 |
| `MEMORY_WARNING_THRESHOLD` | 85% (triggers concurrency reduction) |
| `MAX_SCREENSHOTS_IN_MEMORY` | 5 |
| `STALE_CREDENTIAL_DAYS` | 90 (warning threshold) |

## Excel Workbook Structure

### Sheet 1: Accounts

| Column | Field | Type | Notes |
|--------|-------|------|-------|
| A | client_name | str | Display name |
| B | file_safe_name | str | Auto-generated if blank (alphanumeric + space/hyphen/underscore) |
| C | bank_name | str | e.g., "Chase Business" |
| D | login_url | str | Bank login page URL (can be auto-discovered) |
| E | url_verified_date | date | yyyy-mm-dd |
| F | username | str | Bank login username |
| G | password | str | Bank login password (plaintext) |
| H | account_last4 | str | Last 4 digits, e.g., "7890" |
| I | statement_available_date | int | Day of month (1-31) when statement becomes available |
| J | 2fa | str | "y" or "n" |
| K | 2fa_target | str | "asc" (system handles) or "client" (skip) |
| L | 2fa_method | str | "email", "sms", "totp", "push" |
| M | 2fa_detail | str | Email address, "dialpad", TOTP base32 secret, or blank |
| N | 2fa_preference_order | str | Comma-separated last-4 phone digits: "1992,2212" |
| O | 2fa_sender | str | Auto-populated: SMS sender ID (e.g., "72166") |
| P-Y | sq1_keyword, sq1_answer ... sq5_keyword, sq5_answer | str | Up to 5 security Q&A pairs (keyword + answer) |
| Z | last_successful_login | date | yyyy-mm-dd, auto-updated |
| AA | status | str | "active", "locked", "password_expired", "disabled" |
| AB | notes | str | Free-text notes |

### Sheet 2: Run Log

| Column | Field | Type |
|--------|-------|------|
| A | timestamp | datetime |
| B | client_name | str |
| C | bank_name | str |
| D | account_last4 | str |
| E | target_month | str (yyyy-mm) |
| F | status | str: "success", "failed", "skipped" |
| G | filename | str: output PDF path |
| H | notes | str: error details |
| I | ai_calls_count | int |
| J | ai_cost_usd | float |
| K | duration_seconds | int |

### Sheet 3: Retry Queue

| Column | Field | Type |
|--------|-------|------|
| A | timestamp | datetime |
| B | client_name | str |
| C | bank_name | str |
| D | account_last4 | str |
| E | target_month | str (yyyy-mm) |
| F | failure_reason | str |
| G | retry_count | int |
| H | next_retry_date | date |
| I | status | str: "pending", "resolved", "abandoned" |

## 2FA Methods

| Method | tfa_method | tfa_detail | How It Works |
|--------|-----------|------------|--------------|
| **SMS via Dialpad** | `sms` | `dialpad` | Opens persistent Dialpad browser window, polls screenshots every 5s, AI extracts 6-8 digit code. Serialized via semaphore across windows. |
| **TOTP** | `totp` | Base32 secret | Generates code instantly via `pyotp.TOTP(secret).now()` |
| **Push** | `push` | (blank) | Waits for page change indicating mobile app approval. 3-min timeout, 5s poll interval, 90% screenshot similarity threshold. |
| **Email** | `email` | Email address | Stub — requires Gmail OAuth setup (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in .env). Not yet functional. |

**tfa_target values:**
- `asc` — system handles 2FA automatically
- `client` — account is skipped (requires manual human intervention)

**tfa_preference_order:** If the bank offers multiple phone numbers for SMS (e.g., "Send code to xxx-1992 or xxx-2212"), this comma-separated list sets which to choose first.

**tfa_sender:** Auto-learned after first successful SMS retrieval. Stored so future runs can filter messages by sender.

## Key Concepts

### Browser Profiles

Persistent Chromium profiles stored in `browser-profiles/`. Each bank window gets its own profile (`bank-1`, `bank-2`, etc.) that preserves cookies, localStorage, and session state across runs. The Dialpad window uses a dedicated `dialpad` profile.

### Anti-Detection

- Never runs headless (major detection vector)
- `playwright-stealth` patches applied
- `navigator.webdriver` overridden to `undefined`
- Human-like typing speeds (50-150ms between keys)
- Random delays between actions (1-3s)
- Automation-related flags disabled in Chromium launch args

### Multi-Account Batching

Multiple accounts at the same bank under the same login are grouped into a single session. Login happens once; the download phase loops through each account's last-4 digits to select the correct statement.

### Window Deconfliction

The job scheduler groups accounts by bank+username and assigns them to window slots (max 2 concurrent). The 2FA semaphore ensures only one window requests/reads a 2FA code at a time to prevent code collisions.

### Target Month

Always downloads the previous calendar month's statement. Example: running on March 18, 2026 → target = 2026-02.

### File Lock

`clients.xlsx.lock` prevents concurrent access. Stale locks (>1 hour) are auto-removed. Same-PID re-entry is allowed.

## Output Organization

```
output/
  2026-02/
    Acme_Corp__Chase Business #7890 2026-02.pdf
    Acme_Corp__Chase Business #3456 2026-02.pdf
    SomeClient__BankName #1234 2026-02.pdf
  2026-01/
    ...
```

**Filename format:** `{client}__{bank} #{last4} {year_month}.pdf`

Collision handling: appends `(1)`, `(2)`, etc. if filename already exists.

## Typical Workflows

### 1. Dry Run (see what would happen)
```bash
python run.py --dry-run
```
Shows: accounts to process, playbook status, estimated AI cost, target month.

### 2. Single Account Test
```bash
python run.py --account "Acme Corp" --bank "Chase" --debug --watch
```
Runs one account with screenshots saved and operator pause-after-each-step.

### 3. Full Batch
```bash
python run.py
```
Processes all active accounts with `tfa_target=asc`, 2 concurrent windows.

### 4. Retry Failed Downloads
```bash
python run.py --retry-only
```
Processes only pending items in the Retry Queue whose `next_retry_date <= today`.

### 5. Re-Learn a Bank's Login Flow
```bash
python run.py --account "Acme Corp" --bank "Chase" --relearn
```
Ignores existing playbook, re-learns the login flow via AI.

## AI Skills Reference

| # | Skill | Model | Input | Output |
|---|-------|-------|-------|--------|
| 1 | `skill_classify_page` | Haiku | Screenshot | Page state (dashboard, login, 2fa, error, etc.) |
| 2 | `skill_find_element` | Sonnet | Screenshot + element description | Click coordinates + confidence |
| 3 | `skill_handle_obstacle` | Sonnet | Screenshot | Action to dismiss popup/modal |
| 4 | `skill_match_security_question` | Sonnet | Screenshot + known Q&A pairs | Best matching answer |
| 5 | `skill_select_2fa_option` | Sonnet | Screenshot + preference order | 2FA option to select |
| 6 | `skill_find_statements_page` | Sonnet | Screenshot | Statements link coordinates |
| 7 | `skill_select_statement` | Sonnet | Screenshot + month + last4 | Statement link coordinates |
| 8 | `skill_validate_statement` | Sonnet | PDF text (no screenshot) | Correct account/month? |
| 9 | `skill_discover_login_url` | Sonnet | Bank name (text only) | Login URL |
| 10 | `skill_read_2fa_code` | Haiku | Dialpad screenshot | 6-8 digit code |

## Cost Estimates

**Per API call (blended average):** ~$0.015 (60% Haiku / 40% Sonnet)

**Per account (no playbook):** ~5 AI calls = ~$0.075
**Per account (with playbook):** ~1-2 AI calls = ~$0.015-$0.03

**Typical batch (50 accounts, half with playbooks):**
- 25 new × 5 calls + 25 replay × 1.5 calls ≈ 163 calls
- Estimated cost: ~$2.45

**Cost tracking:** Logged per-call in JSONL action log, summarized at end of run.

## Logging

### JSONL Action Log

Each run produces `logs/{run_id}.jsonl` (run ID = `YYYYmmdd_HHMMSS_ffffff`). One JSON object per line with fields:

`ts`, `window`, `client`, `bank`, `last4`, `type`, `skill`, `description`, `confidence`, `tokens_in`, `tokens_out`, `cost_usd`, `coords`, `page_state`, `duration_ms`, `success`, `mode`, `note`

**Action types:** `ai_skill`, `click`, `type`, `navigate`, `screenshot`, `2fa_trigger`, `2fa_receive`, `state_detect`, `download`, `validate`, `playbook_hit`, `playbook_miss`, `session_start`, `session_end`

### Security

The logger sanitizes output:
- 6-8 digit numbers → `[CODE-REDACTED]`
- `password=...` → `password=[REDACTED]`
- `secret=...` → `secret=[REDACTED]`

## Limitations and Caveats

1. **Plaintext passwords** — Credentials are stored in `clients.xlsx` in plaintext. Protect this file accordingly.
2. **Detection risk** — Despite anti-detection measures, banks may flag automated access. Some institutions actively block Playwright/Chromium patterns.
3. **Email 2FA not functional** — Gmail OAuth integration is stubbed but not complete.
4. **Single machine** — Designed for local execution, not distributed/cloud deployment.
5. **PDF-only** — Expects downloadable PDF statements. Banks using in-browser viewers or CSVs require manual handling.
6. **No headless mode** — Always runs with a visible browser window (required for anti-detection).
7. **Windows-oriented** — Tested on Windows; paths use Windows conventions.
8. **Max 2 concurrent windows** — Higher concurrency increases detection risk and memory usage.
9. **Playbook fragility** — Bank UI redesigns break playbooks immediately; auto-expires after 3 failures.
10. **No scheduling** — Must be launched manually or via external scheduler (cron/Task Scheduler).

## Graceful Shutdown

- First **Ctrl+C**: Sets shutdown flag, current action completes, then stops cleanly
- Second **Ctrl+C**: Forces immediate exit (may lose in-progress state)
