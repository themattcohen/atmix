# Layer 2.1 — Dialpad Postmortem & Learnings for Future Steps

## What Worked (the final proven workflow)

### Dialpad Login Script: `v4/scripts/dialpad_login.py`

Two CLI commands, no interactive input:

```
python scripts/dialpad_login.py login       # Step 1
python scripts/dialpad_login.py 2fa CODE    # Step 2 (user provides code)
```

### Step 1: `login`
1. Launch Chrome as **raw subprocess** (not Patchright context — context kills Chrome on exit)
2. Chrome flags: `--remote-debugging-port`, `--user-data-dir`, `--disable-features=IsolateOrigins,site-per-process`, `--no-first-run`, `--no-default-browser-check`, `--disable-infobars`
3. Connect via CDP websocket to the page tab
4. Navigate to `https://dialpad.com/accounts/login/`
5. Focus email input, type via `Input.insertText`
6. Focus password input, type via `Input.insertText`
7. Click "Log in to Dialpad" button via **CDP mouse events** (not JS `.click()`)

### Step 2: `2fa CODE`
1. Reconnect to Chrome via CDP (browser stayed alive from step 1)
2. Click first code input field via CDP mouse events
3. Type 6 digits one at a time via `Input.dispatchKeyEvent` (auto-advance fields)
4. Click Submit via CDP mouse events
5. Wait 5s, navigate to `https://dialpad.com/app`
6. Wait for SPA to render (poll for "Compound Accounting" in body text, up to 30s)
7. Hide preboot modal (CSS display:none)
8. Dismiss Chrome popups (Block notifications, Never save password)
9. Wait 5s for SPA to stabilize
10. Click **Compound Accounting** in sidebar (find by text match, not querySelector — 31 elements share the same class)
11. Wait 3s, verify "(720) 508-1992" visible
12. Click **New** tab
13. Screenshot for verification

---

## What Didn't Work & Why

### BrowserUse Agent (abandoned for Dialpad login)
- **Sonnet/Opus**: "compiled grammar is too large" — hard Anthropic API limit on complex pages (250+ DOM elements). Not configurable, not patchable.
- **Haiku**: Output format errors on every step, eventually succeeds after 5+ retries. Too unreliable for a critical login flow.
- **Root cause**: BrowserUse v0.12 sends all interactive DOM elements as tool schemas with strict JSON constrained decoding. Complex real-world pages exceed the grammar limit.

### JS `.click()` for form submission
- Dialpad uses **reCAPTCHA Enterprise (invisible)**. JS `.click()` is intercepted and blocked.
- **Fix**: CDP `Input.dispatchMouseEvent` (mousePressed + mouseReleased) bypasses reCAPTCHA because it simulates OS-level clicks.

### `--disable-blink-features=AutomationControlled`
- Breaks Dialpad's WebSocket connections → blank page after login
- **Fix**: Don't use this flag for Dialpad. Use `stealth=False`.
- Note: banks MAY need this flag. Keep the `stealth` parameter on BrowserProcess.

### Staying on `/accounts/login/` after 2FA
- Dialpad SPA doesn't load on this URL. Shows "We're having trouble connecting."
- **Fix**: Navigate to `https://dialpad.com/app` after 2FA succeeds. This is the real SPA entry point (confirmed by v1 and rizzdev code).

### `--disable-features=IsolateOrigins,site-per-process`
- Required for CDP to work reliably (from v1 learnings). Without it, cross-origin WebSocket connections may fail.

### `querySelector` for sidebar elements
- `document.querySelector("a.dp-general-row__primary")` returns the FIRST of 31 matching elements (Inbox), not Compound Accounting.
- **Fix**: Always use `.find(e => e.textContent.trim() === "Compound Accounting")` to match by text.

### Patchright `launch_persistent_context`
- Kills Chrome when the Python process exits (context cleanup).
- **Fix**: Launch Chrome as `subprocess.Popen` so it survives between CLI steps.

### `input()` in scripts
- Claude Code Bash tool doesn't support interactive stdin.
- **Fix**: Split into CLI subcommands. Accept human-provided values as arguments: `script.py 2fa 123456`.

### Claiming success without visual verification
- Script output said "clicked" and "selected" while the UI showed nothing happened.
- **Fix**: Always take a CDP screenshot after critical clicks and verify visually before claiming success.

---

## Settings & Configuration (proven)

### Chrome flags for Dialpad (non-bank)
```
--remote-debugging-port={port}
--user-data-dir={profile_path}  (absolute path, must be unique)
--disable-features=IsolateOrigins,site-per-process
--no-first-run
--no-default-browser-check
--disable-infobars
```
NO `--disable-blink-features=AutomationControlled` (breaks WebSocket)

### Chrome flags for banks (stealth needed)
Same as above PLUS:
```
--disable-blink-features=AutomationControlled
```

### CDP interaction patterns
- **Text input**: `Runtime.evaluate` to focus element, then `Input.insertText`
- **Clicking**: Get element coords via `getBoundingClientRect()`, then `Input.dispatchMouseEvent` (mouseMoved → mousePressed → mouseReleased)
- **Never use JS `.click()`** — reCAPTCHA blocks it
- **Digit-by-digit typing**: `Input.dispatchKeyEvent` for each digit (Dialpad 2FA has 6 separate input fields that auto-advance)
- **Element selection**: Always match by text content, never assume `querySelector` returns the right element when multiple match

### LLM model for BrowserUse
- Haiku: only model that works with BrowserUse on real pages
- Sonnet/Opus: broken (grammar too large)
- For Dialpad login: don't use BrowserUse at all — direct CDP is more reliable

### Timing
- After navigating to `/app`: poll for "Compound Accounting" text every 2s (up to 30s)
- After SPA renders: wait 5s before clicking anything
- After clicking Compound Accounting: wait 3s
- After clicking New tab: wait 2s

---

## Applying These Learnings to Chase (Layer 4)

1. **Use direct CDP for predictable form interactions** (login, password, submit) — same pattern as Dialpad
2. **Use BrowserUse Agent (Haiku) only for unpredictable navigation** (finding statements, interpreting dynamic UIs)
3. **Always use CDP mouse events for clicks** — never JS `.click()`
4. **Take screenshots after every critical click** to verify before proceeding
5. **Banks NEED `stealth=True`** (--disable-blink-features) — unlike Dialpad
6. **Match elements by text content**, not class selectors alone
7. **Chrome as subprocess**, not Patchright context (survives between steps)
8. **Split interactive steps into CLI subcommands** — no `input()`
