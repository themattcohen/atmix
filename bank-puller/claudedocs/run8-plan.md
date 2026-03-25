# Run 8 Plan — Per-Bank Runbooks + Pair Programming Protocol

## Run 7 Scorecard (baseline)

| Metric | Run 6 | Run 7 | Delta |
|--------|-------|-------|-------|
| Duration | 637s | 337s | -47% |
| AI calls | 54 | 33 | -39% |
| Cost | $0.27 | $0.17 | -37% |
| Downloads | 0/14 | 0/12 | same |
| Furthest bank | AmEx dashboard (stuck) | AmEx statements page (statement unavailable) | +2 phases |

### Bug Fix Results

| Fix | Verified? |
|-----|-----------|
| Bug 1: sign_on_method (Citi) | YES — classified 0.92, handler clicked password button |
| Bug 2: Dialpad blank (UBS) | YES — caught instantly, saved 120s |
| Bug 3: enrollment (BofA) | YES — classified 0.97, failed in 1 iter vs 10 |
| Bug 4: menu fallback (AmEx) | YES — hamburger found, statements page reached |
| Bug 5: URL-change in verified_click | PARTIAL — AmEx benefited, Mercury still 70s of false negatives |
| Bug 6: empty JSON guard | Not triggered (no empty responses this run) |
| Bug 7: high-conf unknown early abort | Not triggered (enrollment caught it first) |

---

## Part 1: Per-Bank Runbooks

Each runbook documents the **exact flow** for one bank, what the agent needs to know, and where it gets stuck. These are designed for both automated runs AND pair programming sessions.

---

### RUNBOOK: American Express (WORKING — FIRST DOWNLOAD ACHIEVED)

**Status**: Full pipeline working ✅ — Login → Card switch → PDF Statements → Download → Validate → Rename
**Client**: Goji | **Account**: #22009 (5 digits) | **2FA**: None
**Typical run**: ~105s bank interaction, 20 AI calls, $0.11

#### Verified Flow (from 9 replay runs, March 19 2026)
```
1. Navigate to AmEx login page (playbook, 4/4 hits)
2. Fill #eliloUserID → "Next" → #eliloPassword → "Sign In"
3. → Dashboard (conf=0.99)
4. [Known waste] skill_find_statements_page fails 3x on closed menu (conf=0.60, ~15s wasted)
5. Click hamburger "Menu" button (top-left, ~404,28, conf=0.99)
6. Click "Statements & Activity" (~852,274, conf=0.95)
7. Dismiss "Welcome" modal via skill_handle_obstacle (conf=0.95)
8. Open card picker dropdown (~598,160, conf=0.90)
   - verified_click offset spray adds ~8s here (known, tolerated)
9. Scroll dropdown with mouse.wheel(0, 300), search for card #22009
   - Card is NOT in the first 6 visible cards
   - Typically found on scroll attempt 8 at (~550,638, conf=0.99)
   - 1-4 JSON parse timeouts per run (12-24s each, tolerated)
   - Max 12 scroll attempts configured
10. Click card #22009 via human_click (dropdown closes)
11. Click "Go to PDF Statements" (~1406,320, conf=0.95)
12. Dismiss any popup on PDF archive page (skill_handle_obstacle)
13. skill_select_statement finds target month's Download button (~1432,526)
    - Uses closing date to determine month (Jan 25 closing = January statement)
14. Click Download → "Select File Type" modal opens
    - "Billing Statement (PDF)" pre-selected
15. expect_download(10s) times out (modal, not direct download)
16. find_downloaded_pdf(30s) polls — no file (AJAX download)
17. skill_find_element finds blue "Download" button (~1054,748)
18. expect_download(30s) captures the AJAX download → saves PDF
19. Validate: account match, closing date month match, client name match
20. Organize: output/{yyyy-mm}/Goji__American Express #22009 {yyyy-mm}.pdf
```

#### ORDER OF OPERATIONS (critical)
Card switch (step 8-10) MUST happen BEFORE PDF navigation (step 11).
If you go to PDF Statements first, it shows PDFs for the default card (55003).
Switching cards after that may reload the page or lose context.

#### Output
- Template: `{client}__{bank} #{last4} {year_month}.pdf`
- Path: `output/{yyyy-mm}/`
- Example: `output/2026-01/Goji__American Express #22009 2026-01.pdf`

#### Key Numbers
- statement_available_date: 26 (auto-learned from closing day 25)
- Card #22009 position: ~8th in dropdown (requires scrolling)
- Cards ahead of it: 55003, 53004, 52001, 42003, 71005, 65006, 63007, 22005, then 22009
- Download method: AJAX (requires expect_download, not filesystem poll)

#### Known Inefficiencies (not worth fixing yet)
- Redundant 2nd skill_classify_page on dashboard: ~8s, ~$0.008
- 3x failed skill_find_statements_page before hamburger fallback: ~15s, ~$0.014
- verified_click offset spray on card picker: ~8s
- 1-4 JSON parse timeouts during card search: ~12-24s each
- Total overhead per run: ~50-80s of waste, ~$0.03

#### Critical Constraints
- AmEx uses 5-digit card suffixes (not 4) — prompt says "all N digits must match"
- Card switch MUST happen BEFORE "Go to PDF Statements"
- "Billing Statement (PDF)" must be selected in the file type modal
- AJAX download requires expect_download(), not filesystem polling
- Closing date determines statement month (Jan 25 closing = January statement)
- detect_multi_account regex uses \d{4} — won't match 5-digit AmEx suffixes

#### Playbook saved
`playbooks/american-express.json` — login + menu nav to Statements & Activity

---

### RUNBOOK: Citibank

**Status**: ✅ DOWNLOAD WORKING — Login → Dashboard → Sidebar card click → View Statements → View All Statements → Download
**Client**: Bossi Sportswear | **Accounts**: #8035, #5394 | **2FA**: SMS via Dialpad
**Playbook**: `playbooks/citibank.json` (valid, selectors `#username`/`#password`, success_count=2)

#### Critical: Do Not Track required
Citi silently rejects login when DNT is disabled — no error, just redirects back to the login/QR page in an infinite loop. The fix was adding `--enable-do-not-track` Chrome flag and `DNT: 1` HTTP header in `browser_setup.py`. **This must always be enabled** (it's now the default for all banks).

#### Flow (updated 2026-03-20)
```
1. Navigate to citi.com login (playbook: selectors #username/#password)
2. → QR "How to Scan" modal + "Scan This Code to Sign On" page (sign_on_method state)
3. Dismiss "How to Scan" overlay: click X button on modal
4. Click "Sign On With Password" link → redirects to username/password login form
5. AI fills username → password → clicks "Sign On"
6. → Dashboard (with DNT=1 verified at runtime)
7. Navigate to "View Statements" (sidebar link)
8. → Recent statement modal: shows ONLY the most recent statement inline
   - e.g., "MARCH STATEMENT, Billing Period 02/05/26-03/04/26"
   - Has "Select an Account" dropdown (card picker) inside the modal
   - NOTE: Dropdown card picker doesn't work on Citi; sidebar JS click is the workaround
9. Click "View All Statements" <BUTTON> at top of modal via el.click() JS
   (normal click doesn't trigger it — must use JS)
   → full statement archive
10. Select target month from archive list → download PDF
```

#### Statement month mapping (credit card billing cycles)
Citi uses billing period dates, NOT calendar months. The closing day determines the month:
- **#8035**: Billing cycle closes ~4th of month. "02/05/26-03/04/26" = **February** statement
- **#5394**: Billing cycle closes ~19th-20th of month. "02/20/26-03/19/26" = **March** statement
- January 2026 for #8035 = cycle ending ~01/04/2026
- January 2026 for #5394 = cycle ending ~01/19/2026

#### View All Statements fix (2026-03-20)
The "View Statements" page shows only the most recent statement inline. Historical months
require clicking "View All Statements" to expand the full archive. Code fix in
`session_runner.py:_phase_download()` — when `skill_select_statement` returns "not_available",
bot now looks for and clicks "View All Statements" before retrying.

#### QR / Sign-On Method page handling
Citi's login page defaults to a QR code sign-on with a "How to Scan" instructional overlay modal.
The agent handles this in two steps:
1. **Dismiss overlay**: Find and click the X button on the "How to Scan" modal
2. **Click password login**: Click "Sign On With Password" link (visible after overlay dismissed)

If DNT is NOT enabled, Citi silently redirects back to this QR page after credential submission
(infinite loop). The DNT fix in `browser_setup.py` verifies DNT=1 at runtime after browser launch.

#### Bugs fixed during pair programming (2026-03-19 + 2026-03-20)
1. **DNT header**: Citi blocks login without Do Not Track — added `--enable-do-not-track` + `DNT: 1` header
2. **DNT runtime verification** (2026-03-20): `launch_persistent_context` may not apply headers to persistent profiles. Now verified via `navigator.doNotTrack` after launch; forced via `set_extra_http_headers` if missing.
3. **Ctrl+A before typing**: Re-login after sign_on_method was double-typing credentials (appending to pre-filled fields)
4. **sign_on_method loop guard**: Limited retries to 2 to prevent infinite loop (sign_on_method → password → login → sign_on_method)
5. **Overlay dismiss before password click** (2026-03-20): "How to Scan" modal X button is now clicked first, then "Sign On With Password". Previous approach skipped X (didn't work at the time), but current Citi layout requires dismissing the overlay first.
6. **Force learn mode on re-login** (2026-03-20): After sign_on_method → login, credentials are re-entered in AI learn mode (not stale playbook coords)
7. **Playbook re-recorded** (2026-03-20): `playbooks/citibank.json` re-recorded with valid selectors (`#username`, `#password`), success_count=2.
8. **Cookie clearing** (2026-03-20): Stale citi.com cookies cleared before each login to prevent cached session state interference.

#### 2FA note
Citibank requires SMS 2FA. Dialpad must be working for this to succeed. UBS also needs Dialpad.

---

### RUNBOOK: Mercury

**Status**: Login OK → 2FA prompt → ❌ TOTP key invalid
**Client**: FOTM | **Accounts**: #5611, #5993 | **2FA**: TOTP

#### Flow
```
1. Navigate to app.mercury.com
2. Find username field → type email
3. Click "Next" button → password field appears
4. Type password → Click submit
5. → 2FA prompt (TOTP code entry)
6. ❌ TOTP generation fails: "Non-base32 digit found"
```

#### Fix: Data fix only (need real TOTP secret)
The `2fa_detail` field in clients.xlsx contains `"one time password"` (descriptive text) instead of the actual base32 TOTP secret (e.g., `JBSWY3DPEHPK3PXP`).

**To get the secret**: User must log into Mercury manually, go to security settings, set up a new authenticator app, and when shown the QR code, click "Can't scan? Show setup key" to get the base32 secret. Enter this in the `2fa_detail` column.

#### Pair programming prompts
- "Mercury is asking for a 2FA code. Can you check your authenticator app?"
- "We need the TOTP setup key (base32 string) from Mercury's security settings. Can you navigate there?"

#### Performance note
Mercury is an SPA — `verified_click` burns ~70s on false negatives. Even after the TOTP fix, the login phase will be slow unless we also cap verified_click retries.

---

### RUNBOOK: Eastwest Bank (EWB)

**Status**: Login form found → ❌ Company ID field empty
**Client**: Goji | **Accounts**: #8215, #8249 | **2FA**: Yes (method blank in Excel)

#### Flow
```
1. Navigate to eastwest.bankonline.com
2. Login page has THREE fields: Company ID, User ID, Password
3. Agent fills User ID and Password but NOT Company ID
4. Submit → Error: "A company ID is required"
```

#### Fix: Data fix (5min)
1. Add `Company ID = <value>` to the `notes` column in clients.xlsx for both EWB accounts
2. Also fix the blank `2fa_method` field — need to know if it's SMS, TOTP, or push

**To get the Company ID**: User must check with Goji or log in to EWB manually. The Company ID is typically a numeric code assigned by the bank.

#### Code consideration
The login phase needs to handle 3-field login forms. Currently `_phase_login` looks for username + password. It needs to also check the `notes` column for extra field values and handle Company ID/Organization ID fields.

Check if `skill_find_element` with context from notes already handles this. If not, add login field injection from notes.

#### Pair programming prompts
- "EWB has three login fields. What's the Company ID for this account?"
- "I filled in User ID and Password. The Company ID field is above — what value should I enter?"

---

### RUNBOOK: Bank of America

**Status**: Login → ❌ Enrollment page (not the dashboard)
**Client**: Bossi Sportswear | **Account**: #4408 | **2FA**: SMS via Dialpad

#### Flow
```
1. Navigate to bankofamerica.com/smallbusiness/
2. Find username → type → find password → type → submit
3. → Enrollment page: "Enroll in Online & Mobile Banking"
   Asks for Card/Account Number (last 6) + SSN/TIN
4. enrollment handler: fail fast with "manual setup required"
```

#### Root cause
This BofA account has never been enrolled in online banking, OR the credentials are for a different BofA portal. The login URL `bankofamerica.com/smallbusiness/` may be wrong.

#### Fix: Manual intervention required
1. User must log into BofA manually and complete the enrollment process
2. OR verify that the username/password are correct for the Small Business portal
3. Once enrolled, the login should go to dashboard instead of enrollment

#### Pair programming prompts
- "BofA is showing an enrollment form asking for last 6 digits of account number and SSN. Has this account been enrolled in online banking?"
- "Should I try a different login URL for BofA?"

---

### RUNBOOK: Chase Business

**Status**: ❌ 3 usernames race on same page, 0.0s processing
**Client**: Goji (2 usernames), FOTM (1 username) | **Accounts**: #6752, #0592, #5566, #8553, #4631 | **2FA**: SMS + TOTP (mixed)

#### Root cause
Three distinct usernames (`ascaustingoji1`, `ascaustingoji2`, `AustinYu25`) all fire `page.goto(chase.com/business/login)` within 700ms on Window 1. Mercury overwrites all of them 117ms later. No Chase account ever gets processed.

#### Fix: Data consolidation (10min)
Option A: If these usernames access different accounts, they need to be assigned to separate windows (currently all on W1).
Option B: If they share a login, collapse to one username in clients.xlsx.

#### Pair programming approach
- Run Chase separately: `python run.py --bank "Chase Business" --account "Goji" --debug --watch`
- Process one username at a time to understand the login flow
- Document which accounts are accessible from which username

---

### RUNBOOK: UBS

**Status**: ❌ Not attempted (Dialpad blank, SMS unavailable)
**Client**: FOTM | **Account**: #25482 | **2FA**: SMS ("Austin's phone")

#### Fix
1. Re-authenticate Dialpad: `python run.py --setup-dialpad`
2. Fix `2fa_detail` in clients.xlsx: change from "Austin's phone" to "dialpad"
3. Re-run

#### Pair programming prompts
- "UBS needs SMS 2FA. Is Dialpad logged in and showing messages?"
- "What phone number does UBS send 2FA codes to? Is it the Dialpad number?"

---

## Part 2: Pair Programming Protocol

### Concept
Instead of running the fully automated pipeline and debugging failures after the fact, we run **one bank at a time** with me driving the browser via `--watch` mode. Each time I encounter something unexpected, I pause, take a screenshot, and ask you what I'm looking at.

### Session Setup
```bash
# Terminal 1: Run single bank in watch mode
python run.py --bank "American Express" --account "Goji" --debug --keep-screenshots --watch

# The --watch flag pauses after every AI call with:
# [W2] Page state: dashboard (0.99) — Continue? [Enter/s/q]
# Enter = continue, s = skip this bank, q = quit
```

### My Role (Claude driving)
1. Launch the run with `--watch --debug` for one bank
2. After each AI call, check the screenshot
3. If the AI made the right call → press Enter to continue
4. If something looks wrong → pause, read the screenshot, ask you

### Your Role (human co-pilot)
1. Watch the browser window on screen
2. When I pause with a question, tell me what you see
3. Provide information the AI can't extract:
   - Which button to click
   - What field a value goes in
   - Whether a page is loading or stuck
   - Password/2FA code when needed

### Session Flow Per Bank
```
1. Pre-flight: Check clients.xlsx data is correct for this bank
2. Launch: python run.py --bank "X" --debug --watch
3. Login phase: AI fills credentials, I verify via screenshots
4. Post-login: I classify the page state, ask you if unsure
5. Navigation: Find statements page, ask you for guidance
6. Download: Select the right statement, verify the PDF
7. Document: Update this bank's runbook with what we learned
```

### Priority Order for Pair Programming Sessions

| Session | Bank | Why first | Time est |
|---------|------|-----------|----------|
| ~~1~~ | ~~**American Express**~~ | ✅ **DONE** — first download achieved run 140852, Mar 19 2026 | — |
| 2 | **Citibank** | Need to capture direct login URL + test 2FA flow. | 10-15 min |
| 3 | **Eastwest Bank** | Need Company ID + 2FA method. Quick if user has the data. | 5-10 min |
| 4 | **Mercury** | Need TOTP secret from security settings. | 10 min |
| 5 | **Chase Business** | Need to understand multi-username setup. | 15-20 min |
| 6 | **Bank of America** | Needs enrollment — may not be fixable remotely. | 10 min |
| 7 | **UBS** | Needs working Dialpad first. | 5-10 min |

### What We Learn → What We Code

After each pair programming session, we update:
1. **This runbook** — exact steps, selectors, URLs, field values
2. **clients.xlsx** — correct URLs, Company IDs, TOTP keys, notes
3. **Code fixes** — new handlers for bank-specific quirks
4. **Playbooks** — saved from successful `--watch` runs in learn mode

---

## Part 3: Code Fixes for Run 8

### Fix 1: Citi sign_on_method → re-login (HIGH)
**File**: `orchestrator/session_runner.py`
After sign_on_method clicks password and lands on `login`, don't fail. Instead:
- Detect that we came from `sign_on_method`
- Re-run `_phase_login` on the new form
- Track state with a `came_from_sign_on_method` flag

### Fix 2: AmEx PDF statements navigation (HIGH)
**File**: `orchestrator/session_runner.py`
After reaching "Statements & Activity" page:
- Dismiss any modal overlay (skill_handle_obstacle)
- Find and click "Go to PDF Statements" button
- Wait for PDF archive page to load
- Then run skill_select_statement

### Fix 3: Cap verified_click retries (MED)
**File**: `ai_skills/base.py`
- Reduce offset attempts from 4 to 2
- Add `page.wait_for_load_state("networkidle")` before screenshot comparison
- Total verified_click time budget: max 8s (currently 70s for Mercury)

### Fix 4: 3-field login support (MED)
**File**: `orchestrator/session_runner.py` `_phase_login`
- Parse `notes` column for `Company ID = <value>` pattern
- If found, use `skill_find_element` to find the Company ID field
- Fill it before username/password

---

## Expected Run 8 Outcomes

### After data fixes only (pair programming sessions 1-4)
| Bank | Expected |
|------|----------|
| AmEx | ✅ **DOWNLOAD WORKING** — verified run 140852 |
| Citibank | Direct URL → Login → Dashboard → 2FA (needs working Dialpad) |
| EWB | Login with Company ID → Dashboard (if 2FA method is known) |
| Mercury | Login → TOTP → Dashboard → Statements |
| BofA | Still blocked (enrollment) |
| Chase | Still blocked (multi-username) |
| UBS | Still blocked (Dialpad) |

### After data + code fixes
| Bank | Expected |
|------|----------|
| AmEx | ✅ **DOWNLOAD WORKING** — verified run 140852 |
| Citibank | Dashboard → Statements → Download (needs Dialpad for 2FA) |
| Mercury | Dashboard → Statements → Download |
| EWB | Dashboard → Statements → Download |

**Realistic target**: 1-2 actual PDF downloads on Run 8 (AmEx + Mercury most likely).

---

## Session 5: Chase Business Pair Programming (2026-03-20)

### Runs performed: 9 iterations

### Code fixes applied

| # | Fix | File | Lines |
|---|-----|------|-------|
| 1 | `--dry-run` now respects `--bank`/`--account` filters | `run.py` | `dry_run()` |
| 2 | Added `--no-backoff` flag to bypass retry backoff | `run.py` | `_filter_jobs()` |
| 3 | Chase 2FA dropdown handler (iframe-aware) | `session_runner.py` | `_try_chase_2fa_selection()` |
| 4 | Custom dropdown: click phone number, not "TEXT ME" label | `session_runner.py` | same function |
| 5 | 2FA code entry via iframe selector (`name=identificationCode`) | `session_runner.py` | `_wait_and_enter_2fa_code()` |
| 6 | Clear code field before filling (prevent accumulation) | `session_runner.py` | same function |
| 7 | Chase password re-entry on 2FA verification page | `session_runner.py` | same function |
| 8 | Submit button click via iframe selector (not AI coordinates) | `session_runner.py` | same function |
| 9 | Dialpad `--setup-dialpad` EOFError fallback for background runs | `run.py` | `setup_dialpad()` |

### Chase Business flow — verified working

```
Login page (iframe at secure.chase.com)
  ├─ Username: #userId-input-field-input (iframe-aware fill) ✅
  ├─ Password: #password-input-field-input (iframe-aware fill) ✅
  └─ Sign In button (AI-driven click) ✅
2FA method selection (iframe, custom dropdown)
  ├─ Detect: page.frames search for "I already have a code" text ✅
  ├─ Open dropdown: click "Choose one" ✅
  ├─ Select: click phone number row (skip TEXT ME/CALL ME labels) ✅
  └─ Click Next button ✅
SMS code via Dialpad
  ├─ SMS received from "JP Morgan Chase" ✅
  ├─ 7-digit code extracted ✅
  └─ Sender auto-learned ✅
2FA code entry (iframe)
  ├─ Code field: input[name=identificationCode] (clear + fill) ✅
  ├─ Password field: input[type=password] (fill) ✅
  └─ Next button: iframe get_by_role("button", name="Next") ✅
Dashboard → [NOT YET REACHED — code expired from repeated attempts]
```

### Remaining blockers

1. **Rate limit cooldown** — ascaustingoji1 needs time before next attempt (10+ failed 2FA submissions with stale code)
2. **2FA retry loop** — needs max-retry cap with fresh code request ("Let's try it again" link) instead of re-reading same stale code from Dialpad
3. **ascaustingoji2** — bad credentials ("We can't find that username and password") — needs password update in Excel
4. **TOTP accounts** (#5566/#8553) — should be auto-skipped until TOTP workflow built

### Session cost
- Total AI calls across 9 runs: ~150
- Total estimated cost: ~$0.50
- Total time: ~75 minutes
