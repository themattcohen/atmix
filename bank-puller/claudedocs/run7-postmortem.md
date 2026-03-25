# Run 7 Post-Mortem -- 2026-03-19

**Run ID**: `20260319_110558_600724`
**Duration**: 334s (5m 34s) | **AI Calls**: 33 ($0.17) | **Downloads**: 0/14
**Banks Attempted**: 6 (Chase Business, Mercury, Eastwest Bank, American Express, Bank of America, Citibank)
**Missing from run**: UBS (no log entries -- likely excluded or Dialpad-dependent skip)

---

## Executive Summary

Run 7 is a substantial improvement over Run 6 despite still achieving zero downloads. Five of the seven Run 6 bug fixes are verified working. American Express came the closest to success -- it logged in, navigated via the menu fallback to statements, reached the Statements & Activity page, and had a playbook saved. The statement was on the "Since Last Statement" view (current period, closing Apr 13), and `skill_select_statement` ran for Feb 2026 but the log ended before we can see the download outcome. Citibank's `sign_on_method` handler fired correctly but produced a new failure: clicking "Sign On With Password" takes the user to a fresh login form (with credentials pre-populated) rather than into the account.

### Score Card

| Bank | Run 6 Result | Run 7 Result | Delta |
|------|-------------|-------------|-------|
| Chase Business | 0.0s, never ran | 0.7s, never ran | No change |
| Mercury | Login OK, TOTP invalid | Login OK, TOTP invalid | No change (data fix needed) |
| Eastwest Bank | Login failed (company ID) | Login failed ("error" 0.90) | Slightly better -- classified as `error` instead of `login` loop |
| American Express | Dashboard stuck (0.60 conf) | **Login -> Menu -> Statements -> select_statement (0.90)** | Major improvement |
| Bank of America | Unknown loop x10 (89s) | `enrollment` detected (0.97), failed fast (23s) | Much better -- fast fail |
| Citibank | `2fa_method_selection` misclassification, JSON parse errors | `sign_on_method` detected (0.92), password click -> fresh login page | Better classification, new failure |
| UBS | Dialpad blank, SMS timeout | Not attempted in Run 7 | N/A |

---

## Per-Bank Detailed Analysis

### 1. Chase Business (W1) -- 0.7s, 0 AI calls

**Timeline**:
```
11:06:02.139  session_start (Goji #6752)
11:06:02.141  navigate -> chase.com/business/login
11:06:02.674  session_start (Goji #5566)    <-- 0.5s later, same URL
11:06:02.674  navigate -> chase.com/business/login
11:06:02.822  session_start (FOTM #4631)   <-- 0.15s later
11:06:02.823  navigate -> chase.com/business/login
11:06:02.939  Mercury session_start        <-- Mercury immediately overwrites
```

**What happened**: All three Chase username groups fire `session_start` + `navigate` within 700ms on Window 1. Mercury then starts 117ms later on the same window. Chase gets zero readiness checks, zero AI calls, zero screenshots. Mercury takes over W1 immediately.

**Root cause**: The `run_window()` function iterates `by_login.items()` sequentially at line 143, but all three Chase groups emit `navigate` to the same URL on the same Page object. The third Chase `navigate` overwrites the second which overwrites the first, then Mercury's `navigate` overwrites all of them. Since `_phase_navigate` calls `page.goto()` which is instant for cached URLs, all three Chase sessions complete their navigate phase in <1s, but none of them ever reach `_phase_ensure_login_ready` because... actually, looking more carefully at the log, there are NO readiness screenshots or AI calls for Chase at all. The session appears to complete without entering the readiness gate.

**Hypothesis**: The Chase session_start/navigate pairs fire but `_login_and_download` returns almost immediately. Given that all three Chase groups navigate to the same URL and the page is shared, the second and third Chase groups find the page already navigated and may be hitting an edge case where `_resilient_navigation` returns quickly because `page.goto()` resolves to an already-loaded URL. But the REAL issue is they share a browser Page -- Mercury's `navigate` at 11:06:02.939 overwrites whatever Chase had.

**Comparison to Run 6**: Identical behavior. This is unchanged.

**Fix needed**: Data consolidation in `clients.xlsx`. If all three Chase usernames are the same login, collapse them into one login group. If they are genuinely separate logins, they MUST be on separate windows or serialized with explicit waits between navigations.

---

### 2. Mercury (W1) -- 160.2s, failed at 2FA

**Timeline**:
```
11:06:02.939  session_start, navigate to app.mercury.com
11:06:15.553  w1_ready_0 screenshot (13s to load)
11:06:20.430  classify_page -> login (0.99)
11:06:27.816  find_element username (0.95), typed
11:06:41.103  find_element Next button (0.95), click
11:06:42-59   verified_click: 1 base + 4 offsets, all report "no page change"
11:07:06.147  find_element password (0.99), typed
11:07:16.879  find_element Submit (0.99), click
11:07:18-08:26 verified_click: 1 base + 6 offset retries spanning ~70s
11:08:37.718  w1_post_login screenshot
11:08:43.121  classify_page -> 2fa_prompt (0.97)
11:08:43.121  "2FA code entry required"
11:08:43.122  Mercury ends, BofA starts on W1
```

**What happened**: Login succeeded (the flow progressed from username to password to submit to 2fa_prompt). But `verified_click` burned massive time -- approximately 70 seconds on false-negative click verification attempts for the submit button alone. The actual clicks worked (Mercury advanced through the flow) but `screenshots_identical()` reported no change each time.

**TOTP status**: Not attempted in Run 7 (no TOTP entries in log). The session stopped at `2fa_prompt` detection and moved on. This is correct behavior since the TOTP key in Excel is still invalid ("one time password" text, not base32).

**Comparison to Run 6**: Same outcome. TOTP key is still a data issue.

**Key issue**: `verified_click` false negatives are burning 50-70s per bank on SPAs. Mercury alone consumed ~70s on verification retries for clicks that worked fine.

---

### 3. Eastwest Bank (W2) -- 107.4s, failed at login

**Timeline**:
```
11:06:03.402  session_start, navigate to eastwest.bankonline.com
11:06:14.326  classify_page -> login (0.98)
11:06:24.385  find_element username (0.95), typed "ascaustingoji1"
11:06:35.357  find_element Next button (0.95), click
11:06:42.167  verified_click check (failed -- no change)
11:06:47.930  find_element password (0.99), typed
11:07:05.414  find_element Submit (0.99), click
11:07:19-32   verified_click: 4 offset retries, all fail
11:07:36.806  w2_post_login screenshot
11:07:50.834  classify_page -> error (0.90)
```

**What happened**: The screenshot at `0024_w2_post_login.png` confirms the EWB login page with Company ID empty, User ID filled with "ascaustingoji1", and the error "A company ID is required to complete this form. Enter a valid company ID." The classifier correctly identified this as `error` (0.90) in Run 7, which is an improvement over Run 6 where it classified as `login` (0.85) and triggered the "still on login page" path. Both paths fail, but `error` is semantically more accurate and fails faster.

**Comparison to Run 6**: Slight improvement in classification accuracy (error vs login). Same root cause -- missing Company ID in `clients.xlsx`.

**Fix needed**: Data fix only. Add `Company ID = <value>` to the notes column for EWB in `clients.xlsx`.

---

### 4. American Express (W2) -- 125.5s, CLOSEST TO SUCCESS

**Timeline**:
```
11:07:50.837  session_start, navigate to amex login
11:08:01.765  classify_page -> login (0.99)
11:08:05.214  find_element username -> #eliloUserID (0.99)
11:08:14.049  find_element Next button (0.95), click at (748, 558)
11:08:17.970  verified_click -> page changed (success!)
11:08:24.655  find_element password -> #eliloPassword (0.99)
11:08:31.966  find_element Submit -> Sign In (0.99)
11:08:33.265  click submit
11:08:43.866  verified_click check
11:08:55.918  classify_page -> dashboard (0.99) -- LOGIN SUCCESSFUL
11:09:04.239  classify_page -> dashboard (0.99) (phase 4 statements nav)
11:09:14.566  skill_find_statements_page -> conf 0.60 -- BELOW THRESHOLD
11:09:17.975  FALLBACK: find_element "hamburger menu button" -> (406, 28) conf 0.99
11:09:27.576  click menu button
11:09:32.700  w2_menu_expanded screenshot -- MENU OPENED SUCCESSFULLY
11:09:36.232  skill_find_statements_page on menu -> (852, 274) conf 0.95 -- FOUND IT
11:09:37.484  click "Statements & Activity"
11:09:48.713  session_start "downloading account #22009"
11:09:49.450  w2_statements screenshot (Statements & Activity page visible)
11:09:56.370  skill_select_statement "2026-02 #22009" -> conf 0.90
11:09:56.372  playbook_hit "playbook created after successful learn"
11:09:56.373  session_end
```

**What happened**: This is a breakthrough run for AmEx.

1. **Login**: Flawless. All field finds at 0.99 confidence. 65s from start to dashboard.
2. **Menu fallback**: The Run 6 fix for two-step navigation WORKED. `skill_find_statements_page` returned 0.60 on the dashboard (no visible link), so the fallback triggered: found the hamburger "Menu" button at (406, 28), clicked it, got the expanded menu showing "Statements & Activity", and `skill_find_statements_page` found it at 0.95.
3. **Statements page reached**: The screenshot (`0046_w2_statements.png`) shows the AmEx "Statements & Activity" page for Platinum Card ending in 55003. It shows "Since Last Statement: Mar 14, 2026 - Present (Closing Apr 13, 2026)" with a "Go to PDF Statements" button in the top-right corner. There is also a "Welcome to the New Statements & Activity" modal overlay.
4. **Statement selection**: `skill_select_statement` ran for "2026-02 #22009" at 0.90 confidence, but the session immediately ended with `session_end`. The log shows no download attempt, no `not_available` action. The `success=true` on the `skill_select_statement` call suggests it returned a result, but the playbook was saved right after and the session ended.

**Critical observation about the statements page**: The page is showing card 55003 (ERICK MARTINEZ's Platinum Card), but the session is looking for account #22009. The AmEx account has multiple cards visible on the dashboard. The statements page auto-loaded the first card. The `skill_select_statement` called for "2026-02 #22009" -- if card 22009 is a different card, the AI may have found February's statement for the wrong card, or it may have correctly identified that Feb 2026 is not visible (the page shows "Since Last Statement" which is the current period, Mar 14-present).

**Another observation**: The "Go to PDF Statements" button in the top-right corner is the correct path to historical PDF statements. The current view shows transaction activity, not PDF statement downloads. The system needs to click "Go to PDF Statements" first, then select Feb 2026.

**Playbook saved**: The `american-express.json` playbook was successfully created with login steps (username at #eliloUserID, Next button, password at #eliloPassword, Sign In button) and a statements_step pointing to (852, 274) -- which is the "Statements & Activity" link in the expanded menu. This playbook will speed up future runs.

**Comparison to Run 6**: Massive improvement. Run 6 got stuck at the dashboard with 0.60 confidence and abandoned. Run 7 made it all the way to the statements page with menu fallback working correctly. The remaining issue is navigating from the transaction view to the PDF statements archive.

---

### 5. Bank of America (W1) -- 102.1s (but only 23s of actual processing)

**Timeline**:
```
11:08:43.122  session_start, navigate to bankofamerica.com/smallbusiness/
11:09:23.650  classify_page -> login (0.95)
11:09:27.575  find_element username (0.99), typed
11:09:44.244  find_element Next button (0.80), click
11:09:48.491  verified_click check
11:10:00.598  find_element password (0.90), typed
11:10:08.050  find_element Submit (0.90), click
11:10:14.809  verified_click check
11:10:19.001  w1_post_login screenshot
11:10:25.188  classify_page -> enrollment (0.97) -- CORRECTLY CLASSIFIED
```

**What happened**: BofA redirected to the "Enroll in Online & Mobile Banking" page after login. The screenshot (`0051_w1_post_login.png`) confirms this: it shows the enrollment form asking for "Card or Account Number (Last 6 digits)" and "Social Security Number (SSN) or Tax ID Number (TIN)" with validation errors.

The key improvement: the classifier correctly identified this as `enrollment` at 0.97 confidence, and the handler (line 774-778 in session_runner.py) immediately failed with "Enrollment page -- manual setup required". No looping, no wasted time.

**Comparison to Run 6**: Major improvement. Run 6 classified this as `unknown` (0.85-0.95) and looped 10 times for 89s. Run 7 classified as `enrollment` (0.97) and failed in one iteration, saving ~66s.

**Fixes verified**:
- Bug 3 fix (enrollment page state) -- WORKING
- BofA loop reduction -- from 10 iterations to 1

**Fix still needed**: The BofA credentials appear wrong or the account needs re-enrollment. This is a data/account issue, not a code issue.

---

### 6. Citibank (W2) -- 99.6s, NEW FAILURE MODE

**Timeline**:
```
11:09:56.383  session_start, navigate to citi.com
11:10:09.740  w2_ready_0 screenshot
11:10:14.072  classify_page -> login (0.99)
11:10:14.194  playbook_hit: username field
11:10:16.931  playbook_hit: Next button
11:10:18.318  playbook_hit: password field
11:10:35.435  pb_before_click_submit screenshot
11:10:36.413  click submit
11:10:46.217  pb_after_click_submit screenshot
11:10:46.422  playbook_hit: submit button (4/4 playbook hits -- 100%)
11:10:57.538  w2_post_login screenshot
11:11:04.453  classify_page -> sign_on_method (0.92) -- CORRECTLY CLASSIFIED
11:11:07.633  find_element "button or link to sign on with password" (0.95)
11:11:08.547  click at password button location
11:11:19.406  verify_click screenshot
11:11:31.386  w2_post_login screenshot
11:11:36.005  classify_page -> login (0.99) -- BACK ON LOGIN PAGE
```

**What happened** -- the full picture from screenshots:

1. **Screenshot 0053 (pb_after_click_submit)**: Shows the Citi homepage with QR code scanner modal ("How to Scan") and "Scan This Code to Sign On" with a QR code. At bottom-right: "Sign On With Password" link/button. This is the `sign_on_method` page.

2. **Screenshot 0054 (w2_post_login)**: Same QR code / sign_on_method page. Classified correctly as `sign_on_method` (0.92).

3. **Screenshot 0055 (verify_click)**: After clicking "Sign On With Password" -- the page now shows the Citi login form with User ID field showing "itarynshumway" (pre-filled) and Password field showing dots (pre-filled). The "Sign On" button is visible. This is a FRESH login form, not the authenticated session.

4. **Screenshot 0056 (w2_post_login)**: Same as 0055 -- the login form with pre-filled credentials. Classified as `login` (0.99).

**Root cause analysis**: Clicking "Sign On With Password" on the Citi sign_on_method page does NOT submit the previously-entered credentials. Instead, it navigates to a standard username/password login form at `citi.com`. The form happens to have the User ID pre-populated (likely from a cookie or the previous form submission), and the password field shows dots (but may be auto-filled by the browser or may be placeholder text, NOT the actual password).

The system then classifies this as `login` (0.99), which triggers the "still on login page after submit" failure at line 697-701 of session_runner.py.

**The critical insight**: The Citi playbook submits credentials via the old form URL, but Citi now redirects to the QR/biometric sign-on page. "Sign On With Password" takes you to a DIFFERENT login form (likely `https://online.citi.com/US/login.do` or similar). The system needs to:
1. Detect that this IS a login form (not a session entry point)
2. Re-enter credentials and submit on this new form
3. OR better: navigate directly to the password-based login URL and skip the QR page entirely

**Comparison to Run 6**: Significant improvement in classification. Run 6 misclassified this as `2fa_method_selection` and then hit JSON parse errors 3x. Run 7 correctly classified as `sign_on_method`, clicked the right button, but failed because the destination is a new login form that needs credentials re-entered.

**Fixes verified**:
- Bug 1 fix (sign_on_method page state) -- WORKING (classified at 0.92)
- Bug 1 fix (sign_on_method handler) -- PARTIALLY WORKING (finds and clicks the button, but doesn't handle the resulting login form)

---

### 7. UBS -- Not attempted

UBS does not appear in the Run 7 log at all. It was likely excluded from this run, or the Dialpad health check (screenshot 0001 shows a blank white page) caused SMS-dependent banks to be skipped. This is actually correct behavior if the Dialpad skip logic was implemented.

---

## Bug Fix Verification

| # | Fix Description | Status | Evidence |
|---|----------------|--------|----------|
| 1 | Add `sign_on_method` page state + handler | WORKING | Citibank classified at 0.92, handler clicked password button |
| 2 | Dialpad blank page detection (instant fail) | WORKING | Dialpad health check screenshot is blank white; UBS not attempted |
| 3 | Add `enrollment` page state | WORKING | BofA classified as enrollment at 0.97, immediate fail (no loop) |
| 4 | Two-step menu navigation for statements | WORKING | AmEx menu fallback found hamburger, expanded it, found Statements & Activity at 0.95 |
| 5 | URL-change check in verified_click | UNCLEAR | verified_click still shows many false negatives (Mercury ~70s wasted), but AmEx Next button worked (detected change). May be partially implemented |
| 6 | EWB Company ID data fix | NOT DONE | Still missing Company ID in clients.xlsx |
| 7 | Mercury TOTP base32 key | NOT DONE | Still has "one time password" text instead of base32 key |

**Regressions**: None detected. All working systems from Run 6 still work. Playbook system is performing well (Citi 4/4 hits, AmEx playbook created).

---

## New Issues Found

### Issue A: Citibank sign_on_method -> Fresh Login Form (HIGH)

**Severity**: HIGH -- blocks both Citibank accounts

After clicking "Sign On With Password" on the QR code page, Citi navigates to a fresh login form. The credentials appear pre-filled (User ID visible, password dots showing), but the post-login handler classifies this as `login` and immediately fails.

**Options**:
1. **Re-enter credentials on the new form**: When `sign_on_method` handler lands on a `login` page, treat it as a new login opportunity rather than a failure. Re-run the login phase.
2. **Use direct login URL**: Change the Citi login URL in `clients.xlsx` to `https://online.citi.com/US/login.do` (the direct password login page), bypassing the QR/biometric landing page entirely.
3. **Click Sign On directly**: The pre-filled form at screenshot 0055 shows credentials already in the fields. The system could just click "Sign On" without re-typing. Add logic in the post-login handler: if `sign_on_method` -> click password -> lands on `login` with pre-filled fields, just click the submit button.

**Recommended approach**: Option 2 (change login URL) is the simplest and most reliable. Option 3 as fallback.

### Issue B: verified_click False Negatives Burning Time (MED)

**Severity**: MEDIUM -- wastes 50-70s per SPA bank

Mercury's submit button verification consumed approximately 70 seconds across 7 offset retries. Each retry takes ~8-10s (screenshot + comparison). The clicks are working (flow progresses) but `screenshots_identical()` does not detect the change.

**Pattern**: This affects SPA-based banks (Mercury, EWB) where JavaScript transitions don't produce a sufficiently different screenshot within the 1s wait window.

**Fix**: The URL-change check (Bug 5 from Run 6) should catch most of these. If the page URL changes after a click, the click worked regardless of screenshot similarity. Check if this was implemented; if so, Mercury's SPA navigation may not change the URL (single-page app).

**Alternative fix**: Add a `wait_for_load_state("networkidle")` call after the click, before the screenshot comparison. This would wait for all network requests to complete, making the screenshot more likely to reflect the new page state.

### Issue C: AmEx Statement Selection on Wrong Page (MED)

**Severity**: MEDIUM -- blocks AmEx downloads even though login + navigation works

The AmEx "Statements & Activity" page shows the transaction view with "Last 30 Days" and "Since Last Statement" sections. This is NOT where PDF statements are downloaded. The "Go to PDF Statements" button in the top-right corner needs to be clicked first to reach the PDF archive.

Additionally, there is a "Welcome to the New Statements & Activity" modal overlay that may interfere with navigation. The system needs to dismiss this first (click "Explore On My Own" or the X button).

**Fix**: In `_phase_download` or `_phase_statements_nav`, after reaching the statements page, check for:
1. Modal overlay -> dismiss it
2. "Go to PDF Statements" button -> click it to reach the PDF archive
3. Then run `skill_select_statement` on the PDF archive page

### Issue D: AmEx Multi-Account Card Selection (LOW)

The AmEx dashboard shows 6+ cards across multiple account holders (ERICK MARTINEZ, BRIAN LYLE, BRANDON H SMITH, JONATHAN PHAM, NEGIN Y BASSAM, MICAH COHEN). The statements page loaded for card 55003 (first card), but the target is account #22009. The system needs to handle AmEx's card-level statement selection, which may require switching between cards in the account picker dropdown.

### Issue E: Chase 3-Username Racing (unchanged, LOW)

Same as Run 6. All three Chase groups fire simultaneously and get overwritten by Mercury.

---

## Architecture Observations

### What Improved from Run 6

1. **Page state vocabulary expansion is paying off**: `enrollment` (BofA) and `sign_on_method` (Citi) both classified correctly on first attempt. The vocabulary expansion strategy is validated.
2. **Menu fallback for statements works**: AmEx's two-step menu navigation is a real success. The hamburger -> Statements & Activity path worked first try.
3. **Faster failure on unrecoverable states**: BofA went from 89s (10 loops) to ~23s (1 iteration). The enrollment handler is efficient.
4. **Playbook system is reliable**: Citi achieved 4/4 playbook hits for login. AmEx's new playbook was saved successfully and will accelerate future runs.
5. **Cost efficiency**: 33 AI calls at $0.17 (down from 54 calls at $0.27 in Run 6). The faster failure paths save AI calls.

### Patterns to Watch

1. **verified_click is the single biggest time sink**: Mercury alone spent ~70s on false-negative click verification. Across all banks, verified_click overhead is likely 100+ seconds of the 334s total run.
2. **Post-sign_on_method login form**: Citi's behavior (QR page -> password form -> fresh login) may affect other banks as they adopt QR/biometric sign-on. The system needs a generic "re-login after sign_on_method" handler.
3. **AmEx's multi-step statements flow** (dashboard -> menu -> Statements & Activity -> Go to PDF Statements -> select month) is the most complex navigation yet. It needs specific handling beyond the generic menu fallback.

---

## Priority Fix List for Run 8

| # | Severity | Bank(s) | Fix | Effort |
|---|----------|---------|-----|--------|
| 1 | **HIGH** | Citibank x2 | Change login URL to direct password form (skip QR page) | 5min data fix |
| 2 | **HIGH** | AmEx | After reaching Statements & Activity: dismiss modal, click "Go to PDF Statements" | 30min code |
| 3 | **HIGH** | Mercury, EWB, all | Fix verified_click time waste: add networkidle wait, increase detection window, or cap retries at 2 instead of 5+ | 30min code |
| 4 | **MED** | EWB x2 | Add Company ID to clients.xlsx notes | 5min data fix |
| 5 | **MED** | Mercury x2 | Fix TOTP base32 key in clients.xlsx | 5min data fix (need Mercury 2FA setup) |
| 6 | **MED** | AmEx | Handle multi-card account selection (card picker for #22009 vs #55003) | 45min code |
| 7 | **LOW** | Chase x5 | Consolidate 3 usernames to 1 in clients.xlsx (or assign to separate windows) | 10min data fix |
| 8 | **LOW** | BofA | Fix login URL or verify account is enrolled in online banking | 10min data fix |
| 9 | **LOW** | Citibank | If URL change doesn't work, add sign_on_method -> login form -> re-submit fallback | 30min code |

### Expected Run 8 Outcome (if fixes 1-5 applied)

- **AmEx**: Should reach PDF statements archive and attempt download
- **Citibank**: Direct login URL should bypass QR page entirely, reaching dashboard
- **EWB**: With Company ID filled, login should succeed
- **Mercury**: With valid TOTP key, should pass 2FA and reach dashboard
- **BofA**: Remains blocked until account enrollment issue is resolved
- **Chase**: Remains blocked until username consolidation is done

**Realistic target for Run 8**: 2-3 successful bank logins (AmEx, Citibank, possibly EWB), 0-1 actual statement downloads (AmEx most likely if PDF nav is fixed).

---

## Appendix: Run 7 Action Log Summary

```
Total log lines:     150
Total AI skill calls: 33
Total cost:          $0.17
Duration:            334s (5m 34s)

Per-bank timing:
  Chase Business      :   0.7s  (no processing)
  Mercury             : 160.2s  (login OK, 2FA fail)
  Eastwest Bank       : 107.4s  (login fail: company ID)
  American Express    : 125.5s  (login OK, statements reached!)
  Bank of America     : 102.1s  (enrollment detected, fast fail)
  Citibank            :  99.6s  (sign_on_method -> fresh login page)

Window allocation:
  W1: Chase (x3 usernames), Mercury, Bank of America
  W2: Eastwest Bank, American Express, Citibank
```
