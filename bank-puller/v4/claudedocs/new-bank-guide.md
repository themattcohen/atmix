# How to Build a New Bank Script

**Read this first** when starting work on a new bank (AmEx, Citi, etc.).

---

## Architecture Decision (RESOLVED)

**Use standalone CDP scripts. NOT BrowserUse Agent.**

PLAN.md and DESIGN.md describe a BrowserUse-based orchestrator architecture. That was the original plan, but it doesn't work in practice:
- BrowserUse Agent + Sonnet/Opus hits "compiled grammar too large" on real bank pages
- BrowserUse Agent + Haiku is unreliable (5+ retries per step)
- Direct CDP is deterministic, fast, and works with all page types

The working Chase implementation (`scripts/chase_login.py`) is a standalone Python script that drives Chrome via CDP websockets. **All new banks should follow this pattern.**

---

## Files to Read (in order)

1. **`claudedocs/session-state.md`** — Current project status, what's done, what's open
2. **`claudedocs/cdp-patterns.md`** — All proven CDP interaction patterns (copy-paste ready)
3. **`scripts/chase_login.py`** — Reference implementation (clone this for new banks)
4. **`scripts/dialpad_login.py`** — Dialpad pre-flight (must run before any bank with SMS 2FA)
5. **`claudedocs/chase-postmortem.md`** — Lessons learned from 34 Chase accounts
6. **`Bank Recordings And Instructions/`** — Check for a walkthrough file for the target bank

Do NOT read PLAN.md or DESIGN.md for implementation guidance — they describe the abandoned BrowserUse architecture.

---

## Step-by-Step: Building `scripts/{bank}_login.py`

### Step 0: Prerequisites
- Chrome running on CDP port 9300 (launched by `dialpad_login.py`)
- Dialpad logged in and on Compound Accounting > New tab
- Bank credentials (username + password)

### Step 1: Clone the Template
Copy `scripts/chase_login.py` and rename to `scripts/{bank}_login.py`. The structure stays the same:

```
CDPHelper class          — reuse as-is
create_new_tab()         — reuse as-is
cdp_connect_tab()        — reuse as-is

cmd_login()              — adapt: URL, field selectors, 2FA flow
cmd_next()               — adapt or remove depending on 2FA flow
cmd_2fa()                — adapt: code field selector, password re-entry (if any)
cmd_statements()         — adapt: how to navigate to statements page
cmd_download()           — adapt: account discovery, expand, download selectors
cmd_signout()            — adapt: signout button selector
```

### Step 2: Navigate to the Bank's Login Page (one step at a time)
1. Open a new tab, navigate to the bank's login URL
2. Take a screenshot, verify what you see
3. Find the username/password fields — check IDs, names, placeholders
4. Find the submit button — check by text match

**Do this step-by-step with the user.** Don't run the full flow until each step is verified via screenshot.

### Step 3: Handle 2FA
After login, check the URL to determine what happened:
- Dashboard URL → trusted device, skip 2FA
- 2FA URL → determine which flow (dropdown, radio buttons, shadow DOM)
- Login URL still → wrong credentials
- Unknown URL → screenshot and investigate

For each 2FA variant:
1. Screenshot the page
2. Find all interactive elements (use shadow DOM walker if needed)
3. Find the phone number selection mechanism
4. Check if 1992 is available — if not, STOP and report (never auto-select)
5. Select 1992, click Next/Submit
6. Read code from Dialpad tab
7. Enter code, submit

### Step 4: Navigate to Statements
Each bank has a different path to the statements/documents page. Common patterns:
- Nav tab (Chase: `data-testid` in shadow DOM)
- Sidebar link
- Hamburger menu (AmEx)
- Direct URL

**Always poll for the element before clicking** (shadow DOM may take time to render after login/2FA).

### Step 5: Multi-Account Download
1. Discover all accounts on the page (look for accordion/collapsible sections)
2. Expand ALL closed accounts first (scroll into view before each click)
3. For each account:
   - Check if download icon exists (some accounts have no statements)
   - Click download icon
   - Handle flyout menu if present (click "Save as PDF" inside `.dropdown.show`)
   - Handle direct download links (credit cards may have different pattern)
   - Wait for PDF to land in ~/Downloads
4. Generate download report (CSV)

### Step 6: Signout + Tab Close
1. Click signout by text match
2. Close the tab via `Target.closeTarget`
3. Tab close prevents accumulation across multiple accounts

---

## CDP Patterns Quick Reference

See `claudedocs/cdp-patterns.md` for full details. Key patterns:

### Text Input
```python
await cdp.evaluate('document.querySelector("#field-id").focus()')
await asyncio.sleep(0.3)
await cdp.send("Input.insertText", {"text": "value"})
```

### Mouse Click (ALWAYS use this)
```python
await cdp.mouse_click_element(
    'Array.from(document.querySelectorAll("button"))'
    '.find(e => e.textContent.trim() === "Target" && e.offsetParent !== null)'
)
```

### Shadow DOM Walker
```python
'(() => {'
'  function w(r,d) { if(d>5) return null;'
'    for(const e of r.querySelectorAll("*")) {'
'      if(e.shadowRoot) { const x=w(e.shadowRoot,d+1); if(x) return x; }'
'      if(e.textContent?.trim() === "TARGET" && e.children.length === 0) {'
'        const b=e.getBoundingClientRect();'
'        if(b.width>10) return Math.round(b.x+b.width/2)+","+Math.round(b.y+b.height/2);'
'      }'
'    }'
'    return null;'
'  }'
'  return w(document,0) || "0,0";'
'})()'
```

### Screenshot for Verification
```python
await cdp.screenshot("debug_{bank}_step{N}.png")
```

---

## Rules

1. **One step at a time.** Do step, screenshot, verify with user, then next step.
2. **Never use JS `.click()`** — CDP mouse events only (reCAPTCHA blocks JS clicks).
3. **Never auto-select a different phone number** — if 1992 isn't available, stop and report.
4. **Always screenshot on failure** — save to `profiles/debug_{bank}_{username}_{issue}.png`.
5. **Match elements by text content** — never trust `querySelector` alone when multiple elements share a class.
6. **`scrollIntoView({block: "center"})` before every click** — elements off-screen get zero coords.
7. **Poll for elements before clicking** — shadow DOM components render asynchronously after page transitions.
8. **Never use `input()`** — split into CLI subcommands so Claude Code can run each step.
9. **Close tabs after signout** — prevents accumulation.
10. **State file per bank** — `_{bank}_tab.json` stores tab_id, username, flow type.

---

## Checklist: Bank Complete

- [ ] Login works (credentials filled, submitted)
- [ ] 2FA handled (all observed variants detected and handled)
- [ ] Wrong credentials detected and reported
- [ ] Missing phone number detected and reported
- [ ] Trusted device (no 2FA) detected and handled
- [ ] Statements page reached
- [ ] All accounts discovered and listed
- [ ] All accounts expanded
- [ ] Download works for each account type (checking, savings, credit card)
- [ ] Accounts with no statements correctly skipped
- [ ] Download report CSV generated
- [ ] Signout works
- [ ] Tab closed after signout
- [ ] Tested with 3+ different accounts
- [ ] All failures have screenshots
- [ ] Script committed and pushed
- [ ] Walkthrough doc updated in claudedocs/
