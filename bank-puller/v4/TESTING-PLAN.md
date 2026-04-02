# Bank Statement Automator v4 — Safe Testing Plan

## Context

The v4 codebase is being written by 3 parallel agents. Before we touch ANY real bank account, we need to validate every layer of the system incrementally. One wrong login attempt can lock an account. Multiple failed attempts can trigger fraud alerts. We work through this ONE STEP AT A TIME, together.

---

## Testing Layers (in order — do NOT skip ahead)

### Layer 0: Code Validation (zero risk — no browser, no accounts)

**Goal**: Verify all code loads and the pieces connect.

1. `python -c "from src.models import *"` — all models import cleanly
2. `python -c "from src.config import Settings; s = Settings(); print(s.anthropic_api_key[:10])"` — .env loads
3. `python -c "from src.excel_reader import read_accounts"` — Excel reader imports
4. `python -c "from src.skills import build_skills"` — skill factory imports
5. `python -c "from src.banks import load_workflow; print(load_workflow('chase'))"` — bank registry works
6. `python -c "from src.checkpoint import CheckpointManager"` — checkpoint imports
7. Feed a test row into `read_accounts()` with a dummy Excel file (NOT clients.xlsx)
8. Call `build_skills(Phase.POST_LOGIN, dummy_job)` — verify it returns a Controller with the right action count
9. Fix any import errors, missing dependencies, type mismatches

**What can go wrong**: Nothing — no network, no browser, no credentials used.

---

### Layer 1: Browser Launch (low risk — no bank sites)

**Goal**: Verify Nodriver/Patchright launches and BrowserUse can connect via CDP.

1. Launch `BrowserProcess` on a free port — does Chrome open?
2. Connect `Browser(cdp_url=...)` — does BrowserUse attach?
3. Navigate to `https://example.com` — does the page load?
4. Create a BrowserUse `Agent` with a trivial task: "What text is on this page?"
5. Verify Claude Haiku can see the screenshot and respond
6. Test with `sensitive_data` — verify placeholder substitution works
7. Stop the browser — does it clean up?

**What can go wrong**: Nodriver not installed, Chrome not found, CDP port conflict. All fixable, zero account risk.

---

### Layer 2: Dialpad Login (our account — safe)

**Goal**: Verify Dialpad pre-flight login works. This is OUR account, not a client's.

1. Launch a Dialpad browser session
2. Navigate to Dialpad login page
3. BrowserUse fills email + password (from .env)
4. **YOU** provide the Dialpad 2FA code when prompted
5. Verify we land on the messages inbox
6. Verify the session stays alive
7. Test: can `get_sms_code` poll the Dialpad page for messages?

**What can go wrong**: Dialpad login fails — no client impact. Worst case: we re-login manually.

---

### Layer 3: Mercury API (zero browser risk)

**Goal**: Mercury has a REST API — no browser automation. Safest bank to test first.

1. Verify Mercury API key is set (may be in .env or in tfa_detail)
2. Make a test API call: list accounts
3. Make a test API call: list statements for one account
4. Download ONE statement PDF
5. Validate PDF, verify naming convention

**What can go wrong**: API auth failure. No browser, no login page, no lockout risk. Just a 401 error.

**Prerequisite**: Need to confirm Mercury API credentials are available. May need user input.

---

### Layer 4: First Bank Login — WATCHED (moderate risk)

**Goal**: Login to ONE bank with the user watching. Do NOT navigate to statements yet.

**Which bank first?** Choose the one with:
- Lowest lockout risk
- Most familiar from v1
- Trusted device profile may still be valid

**Decision**: Chase first (user confirmed). Most v1 experience, iframe quirk is a good stress test.

**Steps**:
1. User confirms which account to test and that it won't trigger alerts
2. Launch browser with persistent profile for that bank
3. Navigate to login URL — pause, let user see the page
4. BrowserUse Agent: login only (fill creds, click submit)
5. **STOP after login** — do NOT proceed to 2FA automatically
6. User verifies: did we reach the 2FA prompt? Or the dashboard?
7. If 2FA prompt: test the 2FA skill (get_sms_code from Dialpad, or TOTP)
8. User enters/confirms the 2FA code
9. Verify we reach the dashboard
10. **STOP** — do not navigate further. Close browser.
11. Relaunch browser — does the trusted device profile persist? (Login again, see if 2FA is skipped)

**What can go wrong**: 
- Bot detection → account flagged (mitigated by Nodriver stealth + residential proxy if needed)
- Wrong password → 1 failed attempt (we stop, don't retry)
- 2FA timeout → no harm, just didn't complete

**Safety rule**: MAX 1 login attempt. If it fails, we stop, diagnose, and discuss before trying again.

---

### Layer 5: First Statement Download — WATCHED

**Goal**: After successful login (Layer 4), navigate to statements and download ONE.

1. Login + 2FA (should work from Layer 4)
2. BrowserUse Agent: navigate to statements page — pause, user verifies
3. BrowserUse Agent: find target month's statement — pause, user verifies
4. BrowserUse Agent: click download
5. Verify PDF landed in download dir
6. Run save_downloaded_pdf + validate_pdf
7. Check output file: correct name, valid PDF

**What can go wrong**: Navigation fails (wrong button clicked) — no account risk, just need to fix the task string.

---

### Layer 6: Second Bank (different bank type)

**Goal**: Validate the system works for a bank with different quirks.

- If Layer 4-5 was Chase (iframe + SMS 2FA) → try AmEx or Citi next
- Same watched approach: login → 2FA → dashboard → statements → download
- One attempt, user watching

---

### Layer 7: Multi-Account Group

**Goal**: Test that the orchestrator correctly handles multiple accounts under one login.

1. Pick a login that has 2+ accounts (e.g., same Chase login, different cards)
2. Login once → download statements for both accounts
3. Verify correct card/account selection per account
4. Verify both PDFs are correct

---

### Layer 8: Full Batch (supervised)

**Goal**: Run all banks in sequence. User is present but doesn't need to intervene (except Dialpad 2FA).

1. `python run.py --month 2026-03`
2. Dialpad login (manual 2FA) → proceed
3. Each bank runs automatically
4. User watches the report at the end
5. Verify all PDFs

---

### Layer 9: Unattended (end goal)

**Goal**: Run monthly with zero human intervention (except Dialpad 2FA at the start).

Only after Layers 0-8 are proven.

---

## Safety Rules (enforced in code)

1. **MAX 1 login retry per bank per run** — if login fails, mark as FAILED and move on. Never retry login more than once.
2. **Checkpoint after every phase** — if anything crashes, we resume from last checkpoint, not from scratch.
3. **Never auto-retry 2FA** — if 2FA fails, stop and wait for human. Do NOT re-trigger SMS.
4. **Screenshot on every failure** — save to `debug_screenshots/` for diagnosis.
5. **Dry-run mode** — a `--dry-run` flag that does everything EXCEPT submit login credentials. Navigates to login page, identifies form fields, reports what it would do, and stops.

---

## How We Work Through This Together

For each layer:
1. I explain what we're about to do
2. You confirm it's safe to proceed
3. We run it
4. We review the result together
5. Fix any issues
6. Move to next layer only when current layer is solid

No rushing. No "let me just run all the banks real quick." One step at a time.
