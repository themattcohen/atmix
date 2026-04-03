# Bank-Puller v4 — Session State & Pickup Guide

**Last updated**: 2026-04-03
**Status**: Layer 4 (Chase login) in progress — credentials entered, awaiting Sign in click

---

## Where We Are

### Completed Layers
| Layer | Status | Key Outcome |
|-------|--------|-------------|
| 0 | DONE | All imports pass, .env loads, build_skills works |
| 1 | DONE | Chrome launches via CDP, BrowserUse Agent + Haiku works on example.com |
| 2 | DONE | Dialpad login script works end-to-end (see `scripts/dialpad_login.py`) |
| 2.1 | DONE | Postmortem documented (see `POSTMORTEM-LAYER2.md`) |
| 4 | IN PROGRESS | Chase: navigated to chase.com, credentials filled, paused before Sign in |

### Current Browser State
- Chrome running on **CDP port 9300** (launched as subprocess, survives Python exit)
- **Tab 1**: Dialpad — Compound Accounting > New tab (SMS ready)
- **Tab 2**: Chase — chase.com with AustinYu25 / password filled, not yet submitted
- Tab ID saved in `_chase_tab.json`

### What's Next
1. Click "Sign in" on Chase (Step 3 of walkthrough)
2. Handle 2FA: select SMS, get code from Dialpad, enter code + re-enter password
3. Navigate to Statements & Documents
4. Download latest statement

---

## Proven Workflows

### Dialpad Login (`scripts/dialpad_login.py`)
```bash
python scripts/dialpad_login.py login       # Fill creds, submit, reach 2FA
python scripts/dialpad_login.py 2fa CODE    # Enter code, nav to /app, click CA > New
```

Flow:
1. Launch Chrome subprocess (port 9300, stealth=False)
2. CDP: navigate to dialpad.com/accounts/login/
3. CDP: focus email input, Input.insertText
4. CDP: focus password input, Input.insertText
5. CDP: mouse-click "Log in to Dialpad" button
6. User provides 2FA code
7. CDP: type digits one-by-one into 6 separate fields
8. CDP: mouse-click Submit
9. CDP: navigate to dialpad.com/app
10. Wait for SPA (poll for "Compound Accounting" text, up to 30s)
11. Hide preboot modal (CSS display:none)
12. Dismiss Chrome popups (Block notifications, Never save password)
13. Wait 5s for stabilization
14. CDP: mouse-click Compound Accounting (find by text match in `a.dp-general-row__primary` elements)
15. Wait 3s, verify "(720) 508-1992" visible
16. CDP: mouse-click New tab
17. Screenshot for verification

### Chase Login (in progress — manual CDP steps)
```
1. Open new tab via Target.createTarget
2. Navigate to chase.com (NOT /business — login form is on main page)
3. Focus #userId-text-input-field, Input.insertText username
4. Focus #password-text-input-field, Input.insertText password
5. Screenshot to verify
6. Mouse-click Sign in button (find by text "Sign in")
7. [PENDING] Handle 2FA page
8. [PENDING] Navigate to Statements
9. [PENDING] Download PDF
```

---

## Critical CDP Patterns (proven)

### Text Input
```python
await cdp('Runtime.evaluate', {'expression': 'document.querySelector("#field-id").focus()'})
await asyncio.sleep(0.3)
await cdp('Input.insertText', {'text': 'value'})
```

### Mouse Click (ALWAYS use this, never JS .click())
```python
# 1. Find element coords by text match
r = await cdp('Runtime.evaluate', {'expression': '''
    (() => {
        const el = Array.from(document.querySelectorAll('button, a'))
            .find(e => e.textContent.trim().startsWith('Sign in') && e.offsetParent !== null);
        if (!el) return '0,0';
        const r = el.getBoundingClientRect();
        return Math.round(r.x + r.width/2) + ',' + Math.round(r.y + r.height/2);
    })()
'''})
coords = r.get('result', {}).get('value', '0,0').split(',')
x, y = int(coords[0]), int(coords[1])

# 2. Mouse events
await cdp('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})
await asyncio.sleep(0.05)
await cdp('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
await asyncio.sleep(0.03)
await cdp('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
```

### Screenshot for Verification
```python
import base64
shot = await cdp('Page.captureScreenshot', {'format': 'png'})
Path('profiles/debug_stepN.png').write_bytes(base64.b64decode(shot['data']))
```

### Digit-by-Digit Typing (for 2FA code fields)
```python
for digit in '123456':
    await cdp('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': digit, 'text': digit})
    await cdp('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': digit})
    await asyncio.sleep(0.1)
```

### New Tab in Existing Chrome
```python
ver = json.loads(urllib.request.urlopen('http://127.0.0.1:9300/json/version').read())
async with websockets.connect(ver['webSocketDebuggerUrl']) as ws:
    result = await cdp('Target.createTarget', {'url': 'about:blank'})
    tab_id = result['targetId']
```

### Reconnect to Existing Tab
```python
pages = json.loads(urllib.request.urlopen('http://127.0.0.1:9300/json').read())
tab = next(p for p in pages if p['id'] == tab_id)
async with websockets.connect(tab['webSocketDebuggerUrl']) as ws:
    # ... use cdp() helper
```

---

## Chrome Configuration

### Dialpad (stealth=False)
```
--remote-debugging-port=9300
--user-data-dir={absolute_path}/profiles/dialpad
--disable-features=IsolateOrigins,site-per-process
--no-first-run
--no-default-browser-check
--disable-infobars
```

### Banks (stealth=True) — NOT YET TESTED
Same as above PLUS:
```
--disable-blink-features=AutomationControlled
```
Note: We're currently running Dialpad+Chase in the SAME Chrome instance (stealth=False). Chase hasn't blocked us yet. If it does, we'll need separate instances.

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| BrowserUse Agent | Haiku only (Sonnet/Opus grammar limit) | Hard API limitation |
| Form filling | Direct CDP (not BrowserUse) | More reliable for known forms |
| Clicking | CDP mouse events (not JS .click()) | reCAPTCHA blocks JS clicks |
| Element finding | Text content match (not querySelector alone) | Multiple elements share classes |
| Browser lifecycle | subprocess.Popen (not Patchright context) | Survives Python exit |
| Interactive input | CLI subcommands (not input()) | Claude Code can't do stdin |
| Chase URL | chase.com (not /business) | Login form on main page |
| Verification | CDP screenshot after every click | Never trust script output alone |

---

## Credentials (from .env + user)

| Service | Username | Source |
|---------|----------|--------|
| Dialpad | operations@allsolutionsconsult.com | .env DIALPAD_EMAIL |
| Chase | AustinYu25 | User provided |

Passwords in .env (Dialpad) and user-provided (Chase). Never log passwords.

---

## File Inventory

### Scripts
- `scripts/dialpad_login.py` — 2-step Dialpad login (proven, committed)

### Documentation
- `PLAN.md` — Architecture plan
- `DESIGN.md` — Technical design (Pydantic models, interfaces)
- `TESTING-PLAN.md` — 9-layer testing strategy
- `POSTMORTEM-LAYER2.md` — Dialpad learnings
- `claudedocs/session-state.md` — THIS FILE

### Research
- `research/01-browseruse-fundamentals.md`
- `research/02-agent-patterns.md`
- `research/03-claude-api-and-sdk.md`
- `research/04-2fa-automation.md`
- `research/05-bank-portals.md`

### Source
- `src/` — Full v4 codebase (models, config, orchestrator, skills, banks, browser launcher)
- Key: `src/browser/launcher.py` has BrowserProcess with stealth flag and lock cleanup

### State Files (gitignored)
- `_chase_tab.json` — Current Chase tab ID
- `_dialpad_cdp.json` — Dialpad Chrome PID/port
- `profiles/` — Browser profiles (persistent cookies)
