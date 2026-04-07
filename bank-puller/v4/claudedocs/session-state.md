# Bank-Puller v4 — Session State & Pickup Guide

**Last updated**: 2026-04-07
**Status**: Chase + Wells Fargo workflows complete. Moving to next bank or open items.

---

## Chase — COMPLETE

### What Works
- Full login → 2FA → dashboard → statements → multi-account download → signout → tab close
- Standard 2FA flow (dropdown with TEXT ME / CALL ME)
- CAAS alternate 2FA flow (shadow DOM buttons + radio/dropdown phone selection)
- Trusted device detection (skip 2FA, go straight to statements)
- Multi-account download: expand all accordions, download from each (flyout for checking/savings, direct link for credit cards)
- Download report CSV saved to `output/{username}_chase_download_report_{timestamp}.csv`
- Wrong credentials detection (screenshot + skip)
- Missing phone number detection (screenshot + skip)
- Phone verification escalation detection (screenshot + report)
- Tab close after signout

### Scripts
- `scripts/dialpad_login.py` — 2-step: `login` then `2fa CODE`
- `scripts/chase_login.py` — 6-step: `login`, `next`, `2fa`, `statements`, `download`, `signout` (+ `retry` for dual TEXT ME numbers)

### Tested Accounts (34 total)

**Successful downloads:**
| Username | Accounts | PDFs |
|---|---|---|
| ascpaz11 | 5 | 5 |
| austinyupfcpa1 | 1 | 1 |
| ascaustinjsm2 | 4 | 2 (2 no statements) |
| ascaustinmemorang1 | 5 | 4 (1 no statements) |
| asckwh12 | 8 | 5 (3 no statements) |
| ascalf12 | 2 | 2 |
| ljmofcpa1 | 3 | 3 |
| ofcpaaustinlg1 | 3 | 3 |
| allsolutions25 | 8 | 7 (1 no statements) |
| AustinYu25 | 1 | 1 |
| ofcpaaustinpp1 | 6 | 6 |
| ascaustinpaz1 | 5 | 5 |
| ascaustinpers1 | 1 | 1 |
| ascaustinrhmc1 | 1 | 1 |
| ascaustinsta1 | 2 | 2 |
| ascaustinsilvr1 | 2 | 2 |
| ascaustinsk1 | 2 | 2 |
| ofcpaaustinvader1 | 1 | 1 |
| ofcpaaustinvescovi1 | 1 | 1 |
| ofcpaaustinvelum1 | 6 | 6 |
| ascmcllp1 | 2 | 2 |

**Correctly skipped/failed:**
| Username | Reason |
|---|---|
| austinyu2025 | 1992 not available (only 1993) |
| rhmcasc1 | Wrong credentials |
| 1f54b2n | Wrong credentials |
| ascaustinpom1 | Wrong credentials |
| ascaustinbarlas1 | Wrong credentials |
| pomhealth01 | Wrong credentials |
| drace487 | CAAS flow, no 1992 (only 5499+1296) |
| mcohen1980 | CAAS flow, code accepted but Chase requires phone verification |
| ascaustinvilage1 | No accounts to show (empty dashboard) |

### Known Chase 2FA Flows
1. **Standard** — URL contains `recognizeUser`. Custom dropdown with TEXT ME / CALL ME headers and `<li>` phone options.
2. **CAAS** — URL contains `caas/challenge`. Shadow DOM throughout. "Get a text" button → dropdown/radio phone selection → code entry (no password re-entry).
3. **Trusted device** — URL contains `dashboard` immediately after login. No 2FA needed.

### Key Selectors (verified)
| Element | Selector |
|---|---|
| Username | `#userId-text-input-field` |
| Password | `#password-text-input-field` |
| Sign in button | `<button>` by text "Sign in" |
| 2FA dropdown trigger | `#header-simplerAuth-dropdownoptions-styledselect` |
| 2FA listbox | `#ul-list-container-simplerAuth-dropdownoptions-styledselect` |
| OTP code (standard) | `#otpcode_input-input-field` |
| Password re-entry (standard) | `#password_input-input-field` |
| OTP code (CAAS) | `#otpInput-input` (shadow DOM) |
| Statements tab | `[data-testid="statementsAndDocuments-navigation-bar-item"]` |
| Download flyout icon | `icon-accountsTable-{N}-row0-cell3-downloadDocumentDropdown-icon` |
| Save as PDF (in flyout) | `.dropdown.show [id*=downloadPDFOption]` |
| Direct download (credit cards) | `accountsTable-{N}-row0-cell3-requestThisDocumentAnchor-download` |

---

## Wells Fargo — COMPLETE

### What Works
- Full login → dashboard → 3-dot menu → View Statements → multi-account download → signout → tab close
- Trusted device detection (no 2FA observed yet)
- Account discovery from dashboard tiles (`li[class*=AccountTile]`)
- Account dropdown switching on statements page (`WFSearchableDropdown`, `li[role=option]`)
- PDF download via in-browser fetch (WF opens PDFs in same window, not as downloads)
- Download tracker CSV with per-account status updates
- Wrong credentials detection (placeholder — not yet tested)

### Scripts
- `scripts/wellsfargo_login.py` — 5-step: `login`, `2fa` (placeholder), `statements`, `download`, `signout`

### Tested Accounts (1 user, 6 accounts)

**Successful downloads (austincanopi1):**
| Account | Last4 | Statement Date | Size |
|---|---|---|---|
| BUSINESS CHECKING | 1157 | 2026-03-31 | 118K |
| BUSINESS CHECKING | 7276 | 2026-03-31 | 102K |
| EVERYDAY CHECKING | 4710 | 2026-03-06 | 117K |
| SIGNIFY BUSINESS ESSENTIAL CARD | 6942 | 2025-11-10 | 343K |
| BUSINESSLINE LINE OF CREDIT | 5578 | 2026-04-06 | 137K |
| WELLS FARGO REFLECT VISA CARD | 3431 | 2025-10-08 | 1.0M |

### Key Selectors (verified)
| Element | Selector |
|---|---|
| Username | `#userid` (name=j_username) |
| Password | `#password` (name=j_password) |
| Sign On button | `#btnSignon` (input type=submit in form #frmSignon) |
| Login URL | `https://www.wellsfargo.com` (form on homepage, NOT /signin/) |
| Dashboard account tiles | `li[class*=AccountTile]` |
| Account name | `span[class*=AccountTitle]` |
| 3-dot menu button | `button` with text "Common tasks for ... ending with ...{last4}" |
| View Statements button | `button` with text "View Statements" |
| Account dropdown trigger | `div[role=combobox][aria-haspopup=listbox]` |
| Account dropdown options | `li[role=option]` in `ul[role=listbox]` |
| Statement links | `a[class*=WFLink]` with text "Statement MM/DD/YY (size, PDF)" |
| Statements page URL | `/edocs/start#/edocs/home/documents/default` |
| PDF URL pattern | `/edocs/documents/retrieve/{UUID}` |

### Key WF Behaviors
1. Login form is on the homepage, not a separate sign-in page
2. Dashboard uses React components with CSS module classes (AccountTile, AccountHeader, etc.)
3. 3-dot menu opens a flyout with "View Activity" and "View Statements"
4. Statements page has a searchable dropdown to switch between accounts (no need to go back to dashboard)
5. Statement links are SPA-handled (empty href) — clicking opens PDF in same window
6. PDF download requires: click link → wait for PDF URL → fetch via JS → save bytes → navigate back
7. Dropdown container has max-height 300px with 330px content — last option may need scrollIntoView
8. 2FA flow has NOT been observed yet (all tests used trusted device)

---

## OPEN ITEMS

### 1. Central Passwords Sheet
Currently credentials are passed as CLI arguments. Need to:
- Connect to `clients.xlsx` for username/password lookup
- Map each account to its bank, client name, phone suffix, 2FA method
- The orchestrator reads the sheet and drives the scripts

### 2. File Renaming
`src/pdf_manager.py` exists but is not wired into the Chase workflow yet. Need to:
- After all downloads complete, run `rename_batch()` to rename PDFs
- Convention: `ClientName__BankName #xxxx yyyy-mm.pdf` → `output/{yyyy-mm}/`
- Client name from `clients.xlsx` lookup by username + bank
- Account number (last4/5) extracted from PDF content or filename
- Renaming happens at END of full run, not per-download

### 3. Statement Period Detection
Currently the script downloads the topmost (most recent) statement for each account. Need to:
- Orchestrator passes target period (e.g., "2026-03") to the download step
- For each account, check if the target period's statement exists in the table
- If the statement for the target period is not yet available (e.g., it's early in the month and the bank hasn't posted it), log: "Statement for {period} not yet available for {account}. Most recent: {date}"
- Do NOT download a statement from a different period as a substitute
- Include period availability status in the download report CSV (new column: `period_match`)
- The orchestrator decides the target period — the script should not guess

### 4. Next Banks
Chase and Wells Fargo are done. Next banks to implement:
- American Express (different login, card picker, AJAX download)
- Citibank (two-step login)
- Mercury (REST API, no browser)
- Others from the PRD

---

## Architecture Note (IMPORTANT)

**PLAN.md and DESIGN.md describe a BrowserUse Agent architecture. That was abandoned.**

The working code uses **standalone CDP scripts** (e.g., `scripts/chase_login.py`). BrowserUse was abandoned because:
- Sonnet/Opus hit "compiled grammar too large" on real bank pages (hard API limit)
- Haiku worked but was unreliable (5+ retries per step)
- Direct CDP is deterministic, fast, and works with all page types

**New banks should follow the CDP standalone script pattern**, NOT the BrowserUse orchestrator described in PLAN.md/DESIGN.md. See `claudedocs/new-bank-guide.md` for step-by-step instructions.

The `src/` directory (models, config, orchestrator, skills, banks) was built for the BrowserUse architecture. It is not currently used by the working scripts. It may be refactored later to work with the CDP approach, but for now, the scripts in `scripts/` are the source of truth.

---

## Architecture Decisions (locked in)

| Decision | Choice |
|---|---|
| Browser automation | Direct CDP (not BrowserUse Agent) |
| Clicking | CDP mouse events (not JS .click()) |
| Element finding | Text match / data-testid / ID (not querySelector alone) |
| Shadow DOM | Walk shadow roots recursively |
| Browser lifecycle | Chrome subprocess (survives Python exit) |
| Interactive input | CLI subcommands (no input()) |
| Dialpad | Separate persistent session on same Chrome |
| Statements nav | Poll for data-testid element (up to 30s) before clicking |
| Download verification | Scan ~/Downloads for matching PDFs by last4 |
| Failure handling | Screenshot + report + skip (never auto-fallback) |

---

## File Inventory

### Scripts (working)
- `scripts/dialpad_login.py` — Dialpad login (2-step CLI)
- `scripts/chase_login.py` — Chase full workflow (6-step CLI)

### Source
- `src/pdf_manager.py` — Shared PDF rename/validate module (not yet wired in)
- `src/` — Full v4 codebase (models, config, orchestrator, skills, banks, browser launcher)

### Documentation
- `claudedocs/session-state.md` — THIS FILE
- `claudedocs/chase-walkthrough.md` — Chase step-by-step with verified selectors
- `claudedocs/cdp-patterns.md` — All proven CDP interaction patterns
- `PLAN.md`, `DESIGN.md`, `TESTING-PLAN.md`, `POSTMORTEM-LAYER2.md`
- `research/*.md` — 5 research documents

### Output
- `output/*.csv` — Download report CSVs per account
- PDFs in `~/Downloads/` (not yet renamed/moved)
