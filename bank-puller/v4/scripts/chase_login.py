"""Chase Business statement downloader via direct CDP.

Pure Python + CDP. No AI, no screenshots, no coordinates.
All elements found by ID, data-testid, class, or text match.

Usage (from bank-puller/v4):
    python scripts/chase_login.py login USERNAME PASSWORD PHONE_SUFFIX
    python scripts/chase_login.py next
    python scripts/chase_login.py 2fa CODE PASSWORD
    python scripts/chase_login.py statements
    python scripts/chase_login.py download
    python scripts/chase_login.py signout

Full workflow:
    1. login    — navigate to chase.com, enter creds, click sign in, select SMS, stop
    2. next     — click Next to send SMS
    3. 2fa      — enter code + password from Dialpad, click Next → dashboard
    4. statements — click Statements & documents tab (shadow DOM, data-testid)
    5. download — click download icon on first row → PDF saves to Downloads
    6. signout  — click Sign out
"""

import asyncio
import json
import sys
from pathlib import Path

import websockets
import urllib.request
import base64

# Assumes Chrome already running on this port (launched by dialpad_login.py)
CDP_PORT = 9300
PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"


async def cdp_connect_tab(tab_id: str):
    """Connect to a specific tab by ID."""
    pages = json.loads(
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json").read()
    )
    tab = next(p for p in pages if p["id"] == tab_id)
    # max_size=10MB to handle large screenshots (chase.com login page exceeds 1MB default)
    return await websockets.connect(tab["webSocketDebuggerUrl"], max_size=10_000_000)


async def create_new_tab():
    """Create a new tab and return its ID."""
    ver = json.loads(
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version").read()
    )
    async with websockets.connect(ver["webSocketDebuggerUrl"]) as ws:
        msg_id = 1
        await ws.send(json.dumps({
            "id": msg_id, "method": "Target.createTarget", "params": {"url": "about:blank"}
        }))
        while True:
            r = json.loads(await ws.recv())
            if r.get("id") == msg_id:
                tab_id = r["result"]["targetId"]
                break
    await asyncio.sleep(1)
    return tab_id


class CDPHelper:
    def __init__(self, ws):
        self.ws = ws
        self.msg_id = 0

    async def send(self, method, params=None):
        self.msg_id += 1
        await self.ws.send(
            json.dumps({"id": self.msg_id, "method": method, "params": params or {}})
        )
        while True:
            r = json.loads(await self.ws.recv())
            if r.get("id") == self.msg_id:
                return r.get("result", {})

    async def evaluate(self, expression):
        r = await self.send("Runtime.evaluate", {"expression": expression})
        return r.get("result", {}).get("value")

    async def mouse_click_element(self, find_expr):
        """Find element via JS expression, scroll into view, get its center coords, mouse-click it.

        find_expr should be a JS expression that returns an Element or null.
        """
        # Scroll element into view first so it's within the viewport
        await self.evaluate(
            f"(() => {{ const el = {find_expr}; if (el) el.scrollIntoView({{block: 'center'}}); }})()"
        )
        await asyncio.sleep(0.3)

        coords_expr = (
            f"(() => {{ const el = {find_expr}; if (!el) return '0,0'; "
            "const r = el.getBoundingClientRect(); "
            "return Math.round(r.x+r.width/2)+','+Math.round(r.y+r.height/2); })()"
        )
        coords = (await self.evaluate(coords_expr) or "0,0").split(",")
        x, y = int(coords[0]), int(coords[1])
        if x == 0 and y == 0:
            return False
        await self.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        await asyncio.sleep(0.05)
        await self.send(
            "Input.dispatchMouseEvent",
            {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1},
        )
        await asyncio.sleep(0.03)
        await self.send(
            "Input.dispatchMouseEvent",
            {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1},
        )
        return True

    async def screenshot(self, filename):
        shot = await self.send("Page.captureScreenshot", {"format": "png"})
        if shot.get("data"):
            Path(PROFILES_DIR / filename).write_bytes(base64.b64decode(shot["data"]))
            print(f"  Screenshot: profiles/{filename}")


# ---------------------------------------------------------------------------
# Step 1: Login + select SMS 2FA
# ---------------------------------------------------------------------------

async def cmd_login(username: str, password: str, phone_suffix: str = "1992"):
    """Navigate to chase.com, enter creds, click sign in, select TEXT ME, stop."""
    print("=== Chase Login (Step 1) ===\n")

    tab_id = await create_new_tab()
    print(f"New tab: {tab_id}")
    Path("_chase_tab.json").write_text(json.dumps({"tab_id": tab_id, "username": username}))

    ws = await cdp_connect_tab(tab_id)
    cdp = CDPHelper(ws)

    # Navigate to chase.com (login form on main page — no overlay needed)
    await cdp.send("Page.enable")
    print("Navigating to chase.com...")
    await cdp.send("Page.navigate", {"url": "https://www.chase.com"})
    await asyncio.sleep(8)

    # Enter username: #userId-text-input-field
    print("Entering username...")
    await cdp.evaluate('document.querySelector("#userId-text-input-field").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": username})
    await asyncio.sleep(0.3)

    # Enter password: #password-text-input-field
    print("Entering password...")
    await cdp.evaluate('document.querySelector("#password-text-input-field").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": password})
    await asyncio.sleep(0.3)

    # Click Sign in (find by text match — it's a <button>)
    print("Clicking Sign in...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("button"))'
        '.find(e => e.textContent.trim().startsWith("Sign in") && e.offsetParent !== null)'
    )
    await asyncio.sleep(8)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")

    # Branch 1: Wrong credentials
    if "logon/logon" in (url or ""):
        error_text = await cdp.evaluate(
            'document.body?.innerText?.replace(/[^\\x20-\\x7E]/g, "")?.substring(0, 200)'
        )
        print(f"  LOGIN FAILED: {error_text}")
        await cdp.screenshot(f"debug_chase_{username}_login_failed.png")
        print(f"  Screenshot saved. Skipping this account.")
        await ws.close()
        return

    # Branch 2: Trusted device — no 2FA needed, already on dashboard
    if "dashboard" in (url or ""):
        print("  No 2FA required (trusted device). Skip next + 2fa, go straight to statements.")
        await cdp.screenshot(f"debug_chase_{username}_no_2fa.png")
        await ws.close()
        return

    # Branch 3: CAAS alternate 2FA flow
    # URL contains "caas/challenge" — different UI with "Get a text" / "Get a call" buttons
    # and radio buttons for phone selection (all in shadow DOM)
    if "caas" in (url or ""):
        print("  CAAS 2FA flow detected.")

        # Step 1: Click "Get a text" — find in shadow DOM
        print("  Clicking 'Get a text'...")
        get_text_coords = await cdp.evaluate(
            '(() => {'
            '  function walkShadow(root, depth) {'
            '    if (depth > 5) return null;'
            '    for (const el of root.querySelectorAll("*")) {'
            '      if (el.shadowRoot) { const r = walkShadow(el.shadowRoot, depth+1); if (r) return r; }'
            '      if (el.tagName === "LI" && el.textContent.includes("Get a text")) {'
            '        const r = el.getBoundingClientRect();'
            '        if (r.width > 0) return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2);'
            '      }'
            '    }'
            '    return null;'
            '  }'
            '  return walkShadow(document, 0) || "0,0";'
            '})()'
        )
        coords = (get_text_coords or "0,0").split(",")
        gx, gy = int(coords[0]), int(coords[1])
        if gx == 0:
            print("  ERROR: Could not find 'Get a text' button.")
            await cdp.screenshot(f"debug_chase_{username}_caas_no_get_text.png")
            await ws.close()
            return

        await cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": gx, "y": gy})
        await asyncio.sleep(0.05)
        await cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": gx, "y": gy, "button": "left", "clickCount": 1})
        await asyncio.sleep(0.03)
        await cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": gx, "y": gy, "button": "left", "clickCount": 1})
        await asyncio.sleep(3)

        # Step 2: Find phone numbers in shadow DOM radio buttons
        phone_info = await cdp.evaluate(
            '(() => {'
            '  const phones = [];'
            '  function walkShadow(root, depth) {'
            '    if (depth > 5) return;'
            '    for (const el of root.querySelectorAll("*")) {'
            '      if (el.shadowRoot) walkShadow(el.shadowRoot, depth+1);'
            '      const t = el.textContent?.trim();'
            '      if (t && t.match(/^xxx-xxx-\\d{4}$/) && el.children.length === 0) phones.push(t);'
            '    }'
            '  }'
            '  walkShadow(document, 0);'
            '  return JSON.stringify(phones);'
            '})()'
        )
        caas_phones = json.loads(phone_info or "[]")
        print(f"  CAAS phone numbers available: {caas_phones}")

        # Step 3: Check for preferred phone suffix
        preferred = f"xxx-xxx-{phone_suffix}"
        if preferred not in caas_phones:
            available = ", ".join(caas_phones) if caas_phones else "none"
            print(f"  SKIPPED: {preferred} not available. Available: {available}")
            await cdp.screenshot(f"debug_chase_{username}_caas_no_1992.png")
            await ws.close()
            return

        # Step 4: Click the matching radio button
        print(f"  Selecting {preferred}...")
        radio_coords = await cdp.evaluate(
            '(() => {'
            '  function walkShadow(root, depth) {'
            '    if (depth > 5) return null;'
            '    for (const el of root.querySelectorAll("*")) {'
            '      if (el.shadowRoot) { const r = walkShadow(el.shadowRoot, depth+1); if (r) return r; }'
            f'      if (el.textContent?.trim() === "{preferred}" && el.children.length === 0) {{'
            '        const r = el.getBoundingClientRect();'
            '        if (r.width > 0) return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2);'
            '      }'
            '    }'
            '    return null;'
            '  }'
            '  return walkShadow(document, 0) || "0,0";'
            '})()'
        )
        coords = (radio_coords or "0,0").split(",")
        rx, ry = int(coords[0]), int(coords[1])
        if rx > 0:
            await cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": rx, "y": ry})
            await asyncio.sleep(0.05)
            await cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": rx, "y": ry, "button": "left", "clickCount": 1})
            await asyncio.sleep(0.03)
            await cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": rx, "y": ry, "button": "left", "clickCount": 1})
            await asyncio.sleep(1)

        # Step 5: Click Next
        print("  Clicking Next...")
        next_coords = await cdp.evaluate(
            '(() => {'
            '  function walkShadow(root, depth) {'
            '    if (depth > 5) return null;'
            '    for (const el of root.querySelectorAll("*")) {'
            '      if (el.shadowRoot) { const r = walkShadow(el.shadowRoot, depth+1); if (r) return r; }'
            '      if ((el.tagName === "BUTTON" || el.tagName === "MDS-BUTTON") && el.textContent?.trim() === "Next") {'
            '        const r = el.getBoundingClientRect();'
            '        if (r.width > 0) return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2);'
            '      }'
            '    }'
            '    return null;'
            '  }'
            '  return walkShadow(document, 0) || "0,0";'
            '})()'
        )
        coords = (next_coords or "0,0").split(",")
        nx, ny = int(coords[0]), int(coords[1])
        if nx > 0:
            await cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": nx, "y": ny})
            await asyncio.sleep(0.05)
            await cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": nx, "y": ny, "button": "left", "clickCount": 1})
            await asyncio.sleep(0.03)
            await cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": nx, "y": ny, "button": "left", "clickCount": 1})
            await asyncio.sleep(8)

        await cdp.screenshot("debug_chase_sms_selected.png")
        print(f"\n  CAAS SMS sent. Run: python scripts/chase_login.py 2fa CODE PASSWORD")
        # Save state — mark as CAAS flow for 2fa step
        tab_state = json.loads(Path("_chase_tab.json").read_text())
        tab_state["flow"] = "caas"
        tab_state["phone_suffix"] = phone_suffix
        Path("_chase_tab.json").write_text(json.dumps(tab_state))
        await ws.close()
        return

    # Branch 4: Standard 2FA page (recognizeUser)
    if "recognizeUser" not in (url or ""):
        print("  WARNING: Unexpected page after login.")
        await cdp.screenshot(f"debug_chase_{username}_unexpected.png")
        await ws.close()
        return

    # On standard 2FA page — open dropdown
    # Open 2FA dropdown: custom component #header-simplerAuth-dropdownoptions-styledselect
    print("Opening 2FA dropdown...")
    await cdp.mouse_click_element(
        'document.querySelector("#header-simplerAuth-dropdownoptions-styledselect")'
    )
    await asyncio.sleep(1)

    # Collect all TEXT ME phone numbers (between TEXT ME and CALL ME headers).
    # If the preferred suffix (e.g., 1992) is available, select it.
    # If not, select the first available TEXT ME number.
    text_me_info = await cdp.evaluate(
        '(() => {'
        '  const items = Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children);'
        '  let inTextMe = false;'
        '  const numbers = [];'
        '  for (const li of items) {'
        '    const t = li.textContent.trim();'
        '    if (t === "TEXT ME") { inTextMe = true; continue; }'
        '    if (t === "CALL ME") { inTextMe = false; continue; }'
        '    if (inTextMe && t.startsWith("xxx-xxx-")) numbers.push(t);'
        '  }'
        '  return JSON.stringify(numbers);'
        '})()'
    )
    text_me_numbers = json.loads(text_me_info or "[]")
    print(f"  TEXT ME numbers available: {text_me_numbers}")

    # Check if preferred number is available — if not, STOP (don't auto-select another)
    preferred = f"xxx-xxx-{phone_suffix}"
    if preferred not in text_me_numbers:
        available = ", ".join(text_me_numbers) if text_me_numbers else "none"
        print(f"  SKIPPED: {preferred} not available. Available TEXT ME numbers: {available}")
        await cdp.screenshot(f"debug_chase_{username}_no_1992.png")
        print(f"  Screenshot saved. Signing out and moving to next account.")
        # Close dropdown and sign out
        await cdp.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape"})
        await asyncio.sleep(1)
        await cdp.mouse_click_element(
            'Array.from(document.querySelectorAll("a, button"))'
            '.find(e => e.textContent.trim() === "Cancel" && e.offsetParent !== null)'
        )
        await asyncio.sleep(3)
        await ws.close()
        return
    selected_number = preferred

    # Count how many times the selected number appears under TEXT ME (for retry logic)
    text_me_count = text_me_numbers.count(selected_number)

    print(f"Selecting {selected_number} ({text_me_count} match(es) under TEXT ME)...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children)'
        f'.find(li => li.textContent.trim() === "{selected_number}")'
    )
    await asyncio.sleep(1)

    # Save state for retry logic
    tab_state = json.loads(Path("_chase_tab.json").read_text())
    tab_state["text_me_count"] = text_me_count or 1
    tab_state["phone_suffix"] = phone_suffix
    tab_state["selected_number"] = selected_number
    tab_state["text_me_numbers"] = text_me_numbers
    Path("_chase_tab.json").write_text(json.dumps(tab_state))

    await cdp.screenshot("debug_chase_sms_selected.png")
    print(f"\nSMS option selected. Run: python scripts/chase_login.py next")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 2: Click Next to send SMS
# ---------------------------------------------------------------------------

async def cmd_next():
    """Click Next to trigger SMS delivery."""
    print("=== Chase: Click Next ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    print("Clicking Next...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("button"))'
        '.find(e => e.textContent.trim() === "Next" && e.offsetParent !== null)'
    )
    await asyncio.sleep(8)

    await cdp.screenshot("debug_chase_after_next.png")
    url = await cdp.evaluate("window.location.href")
    print(f"URL: {url}")
    print("\nSMS sent. Check Dialpad, then run: python scripts/chase_login.py 2fa CODE PASSWORD")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 2b: Retry SMS with second phone number
# ---------------------------------------------------------------------------

async def cmd_retry():
    """If no SMS arrived within 4 min, click 'Let's try it again' and select
    the SECOND matching phone number. Some Chase accounts have two numbers
    with the same last 4 digits — the first may be inactive."""
    print("=== Chase: Retry SMS (Step 2b) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    phone_suffix = tab_info.get("phone_suffix", "1992")
    text_me_count = tab_info.get("text_me_count", 1)

    if text_me_count < 2:
        print(f"Only 1 TEXT ME number matches xxx-xxx-{phone_suffix}. No second TEXT number to try.")
        print("(The other 1992 is under CALL ME — that's normal.)")
        print("Check Dialpad or try a different delivery method.")
        return

    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Click "Let's try it again" link
    print("Clicking 'Let's try it again'...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("a, button"))'
        '.find(e => e.textContent.toLowerCase().includes("try it again") && e.offsetParent !== null)'
    )
    await asyncio.sleep(8)

    # Open dropdown
    print("Opening 2FA dropdown...")
    await cdp.mouse_click_element(
        'document.querySelector("#header-simplerAuth-dropdownoptions-styledselect")'
    )
    await asyncio.sleep(1)

    # Select the SECOND TEXT ME number (not CALL ME).
    # Walk the listbox: count only matches between TEXT ME and CALL ME headers.
    print(f"Selecting TEXT ME xxx-xxx-{phone_suffix} (SECOND match)...")
    await cdp.mouse_click_element(
        '(() => {'
        '  const items = Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children);'
        '  let inTextMe = false;'
        '  let count = 0;'
        '  for (const li of items) {'
        '    const t = li.textContent.trim();'
        '    if (t === "TEXT ME") { inTextMe = true; continue; }'
        '    if (t === "CALL ME") { inTextMe = false; continue; }'
        f'    if (inTextMe && t === "xxx-xxx-{phone_suffix}") {{'
        '      count++;'
        '      if (count === 2) return li;'
        '    }'
        '  }'
        '  return null;'
        '})()'
    )
    await asyncio.sleep(1)

    await cdp.screenshot("debug_chase_sms_retry.png")
    print(f"\nSecond number selected. Run: python scripts/chase_login.py next")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 3: Enter 2FA code + re-enter password
# ---------------------------------------------------------------------------

async def cmd_2fa(code: str, password: str):
    """Enter 2FA code. Detects standard vs CAAS flow from _chase_tab.json."""
    tab_info = json.loads(Path("_chase_tab.json").read_text())
    flow = tab_info.get("flow", "standard")

    if flow == "caas":
        await _cmd_2fa_caas(code, tab_info)
    else:
        await _cmd_2fa_standard(code, password, tab_info)


async def _cmd_2fa_standard(code: str, password: str, tab_info: dict):
    """Standard 2FA: code + password re-entry."""
    print("=== Chase 2FA — Standard (Step 3) ===\n")

    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Code field: #otpcode_input-input-field (type=number)
    print(f"Entering code {code}...")
    await cdp.evaluate('document.querySelector("#otpcode_input-input-field").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": code})
    await asyncio.sleep(0.3)

    # Password field: #password_input-input-field (type=password)
    print("Re-entering password...")
    await cdp.evaluate('document.querySelector("#password_input-input-field").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": password})
    await asyncio.sleep(0.3)

    # Click Next
    print("Clicking Next...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("button"))'
        '.find(e => e.textContent.trim() === "Next" && e.offsetParent !== null)'
    )
    await asyncio.sleep(10)

    await cdp.screenshot("debug_chase_after_2fa.png")
    url = await cdp.evaluate("window.location.href")
    print(f"URL: {url}")

    if "dashboard" in (url or ""):
        print("\nDashboard reached. Run: python scripts/chase_login.py statements")
    else:
        print("\nCheck browser — may need additional steps.")
    await ws.close()


async def _cmd_2fa_caas(code: str, tab_info: dict):
    """CAAS 2FA: code only (no password re-entry). All elements in shadow DOM."""
    print("=== Chase 2FA — CAAS (Step 3) ===\n")

    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Helper to evaluate JS
    async def evaluate(expr):
        r = await cdp.send("Runtime.evaluate", {"expression": expr})
        return r.get("result", {}).get("value")

    # Shadow DOM walker JS template
    WALK_SHADOW = (
        '(() => {{ function w(r,d) {{ if(d>5) return null; '
        'for(const e of r.querySelectorAll("*")) {{ '
        'if(e.shadowRoot){{ const x=w(e.shadowRoot,d+1); if(x) return x; }} '
        '{find_logic} '
        '}} return null; }} return w(document,0) || "0,0"; }})()'
    )

    # Focus the code input: #otpInput-input inside shadow DOM
    print(f"Entering code {code}...")
    focused = await evaluate(
        WALK_SHADOW.format(
            find_logic='if(e.tagName==="INPUT" && e.id==="otpInput-input") { e.focus(); return "focused"; }'
        )
    )
    if focused != "focused":
        print(f"  ERROR: Could not focus code input ({focused})")
        await cdp.screenshot("debug_chase_caas_2fa_fail.png")
        await ws.close()
        return

    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": code})
    await asyncio.sleep(0.5)

    # Click Next — find any element with text "Next" and width > 10
    print("Clicking Next...")
    next_coords = await evaluate(
        WALK_SHADOW.format(
            find_logic=(
                'if(e.textContent?.trim()==="Next" && e.children.length===0) '
                '{ const b=e.getBoundingClientRect(); '
                'if(b.width>10) return Math.round(b.x+b.width/2)+","+Math.round(b.y+b.height/2); }'
            )
        )
    )
    coords = (next_coords or "0,0").split(",")
    nx, ny = int(coords[0]), int(coords[1])
    print(f"  Next at ({nx}, {ny})")

    if nx > 0:
        await cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": nx, "y": ny})
        await asyncio.sleep(0.5)
        await cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": nx, "y": ny, "button": "left", "clickCount": 1})
        await asyncio.sleep(0.1)
        await cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": nx, "y": ny, "button": "left", "clickCount": 1})
    else:
        print("  ERROR: Could not find Next button")
        await cdp.screenshot("debug_chase_caas_2fa_no_next.png")
        await ws.close()
        return

    await asyncio.sleep(10)

    await cdp.screenshot("debug_chase_after_2fa.png")
    url = await evaluate("window.location.href")
    print(f"URL: {url}")

    if "dashboard" in (url or ""):
        print("\nDashboard reached. Run: python scripts/chase_login.py statements")
    elif "callUs" in (url or ""):
        print("\nCHASE REQUIRES PHONE VERIFICATION. Code was accepted but Chase")
        print("  escalated to phone call. This account needs manual handling.")
        await cdp.screenshot(f"debug_chase_{tab_info.get('username','unknown')}_needs_phone.png")
    else:
        print("\nCheck browser — may need additional steps.")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 4: Navigate to Statements
# ---------------------------------------------------------------------------

async def cmd_statements():
    """Click Statements & documents tab (shadow DOM, found by data-testid).

    After 2FA, the dashboard SPA may still be loading when this runs.
    The shadow DOM nav tabs take time to render. We poll for the element
    before clicking, with a 30s timeout.
    """
    print("=== Chase: Statements (Step 4) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Wait for the Statements tab to appear in DOM.
    # After 2FA, shadow DOM components may not be rendered yet.
    print("Waiting for Statements tab to render...")
    tab_found = False
    for attempt in range(15):
        exists = await cdp.evaluate(
            '!!document.querySelector(\'[data-testid="statementsAndDocuments-navigation-bar-item"]\')'
        )
        if exists:
            print(f"  Tab found after {(attempt + 1) * 2}s")
            tab_found = True
            break
        await asyncio.sleep(2)

    if not tab_found:
        print("  Statements tab not found after 30s. Skipping.")
        await cdp.screenshot("debug_chase_no_statements_tab.png")
        await ws.close()
        return

    # Click the tab
    print("Clicking Statements & documents...")
    await cdp.mouse_click_element(
        'document.querySelector(\'[data-testid="statementsAndDocuments-navigation-bar-item"]\')'
    )
    await asyncio.sleep(5)

    url = await cdp.evaluate("window.location.href")

    # Verify navigation — if URL didn't change, retry once
    if "documents" not in (url or ""):
        print(f"  URL didn't change ({url}). Retrying click...")
        await asyncio.sleep(3)
        await cdp.mouse_click_element(
            'document.querySelector(\'[data-testid="statementsAndDocuments-navigation-bar-item"]\')'
        )
        await asyncio.sleep(5)
        url = await cdp.evaluate("window.location.href")

    await cdp.screenshot("debug_chase_statements.png")
    print(f"URL: {url}")
    print("\nRun: python scripts/chase_login.py download")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 5: Download latest statement
# ---------------------------------------------------------------------------

async def cmd_download():
    """Download the latest statement for ALL accounts.

    Multi-account logic:
    1. Discover all account accordions on the statements page
    2. Expand any that are closed
    3. For each account with statements: click download icon → click "Save as PDF"
    4. Skip accounts with "no statements available"

    NOTE: Download location is currently the browser's default Downloads folder.
    This is a placeholder — will be updated to save to a configurable output dir.

    Download button structure (after all accordions are expanded):
    - Download icon: <i> with id "icon-accountsTable-{N}-row0-cell3-downloadDocumentDropdown-icon"
    - Clicking it opens a flyout with "Save as PDF" option
    - Must click "Save as PDF" to trigger the actual download
    """
    print("=== Chase: Download All Accounts (Step 5) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Step 1: Discover all accounts
    accounts_json = await cdp.evaluate(
        'JSON.stringify(Array.from(document.querySelectorAll("div.jpui.accordion.row")).map((div, i) => ({'
        '  i, name: div.querySelector("span.display")?.textContent?.trim(),'
        '  open: div.classList.contains("open")'
        '})))'
    )
    accounts = json.loads(accounts_json or "[]")
    print(f"Found {len(accounts)} account(s):")
    for acct in accounts:
        status = "open" if acct["open"] else "closed"
        print(f"  [{acct['i']}] {acct['name']} ({status})")

    # Step 2: Expand ALL closed accounts first (before trying to download)
    for acct in accounts:
        if not acct["open"]:
            print(f"\nExpanding {acct['name']}...")
            await cdp.mouse_click_element(
                f'document.querySelectorAll("div.jpui.accordion.row")[{acct["i"]}]'
                '.querySelector("button.button__header")'
            )
            await asyncio.sleep(2)

    # Wait for all expansions to settle
    print("\nAll accounts expanded. Waiting 3s for DOM to settle...")
    await asyncio.sleep(3)

    # Step 3: Download from each account
    for acct in accounts:
        idx = acct["i"]
        name = acct["name"]
        print(f"\n--- {name} ---")

        # Two download patterns exist on Chase:
        #
        # A) Checking/Savings: flyout dropdown
        #    Icon: icon-accountsTable-{N}-row0-cell3-downloadDocumentDropdown-icon
        #    Click icon → flyout with "Save as PDF" → click Save as PDF
        #
        # B) Credit cards: direct download link
        #    Link: accountsTable-{N}-row0-cell3-requestThisDocumentAnchor-download
        #    Click link → download starts immediately (no flyout)
        #
        # Try pattern A first, fall back to pattern B.

        flyout_icon_id = f"icon-accountsTable-{idx}-row0-cell3-downloadDocumentDropdown-icon"
        direct_link_id = f"accountsTable-{idx}-row0-cell3-requestThisDocumentAnchor-download"

        has_flyout = await cdp.evaluate(f'!!document.getElementById("{flyout_icon_id}")')
        has_direct = await cdp.evaluate(f'!!document.getElementById("{direct_link_id}")')

        if not has_flyout and not has_direct:
            print("  No statements available. Skipping.")
            acct["had_icon"] = False
            continue

        if has_flyout:
            # Pattern A: Flyout dropdown (checking/savings)
            print("  Clicking download icon (flyout)...")
            await cdp.mouse_click_element(f'document.getElementById("{flyout_icon_id}")')
            await asyncio.sleep(3)

            # Click "Save as PDF" inside the open flyout (.dropdown.show)
            pdf_coords = await cdp.evaluate(
                '(() => { const flyout = document.querySelector(".dropdown.show");'
                ' if (!flyout) return "0,0";'
                ' const link = flyout.querySelector("[id*=downloadPDFOption]");'
                ' if (!link) return "0,0";'
                ' const r = link.getBoundingClientRect();'
                ' return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2); })()'
            )
            coords = (pdf_coords or "0,0").split(",")
            px, py = int(coords[0]), int(coords[1])

            if px == 0:
                print(f"  WARNING: Flyout did not open for {name}.")
                continue

            print(f"  Clicking Save as PDF at ({px}, {py})...")
            await cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": px, "y": py})
            await asyncio.sleep(1)
            await cdp.send(
                "Input.dispatchMouseEvent",
                {"type": "mousePressed", "x": px, "y": py, "button": "left", "clickCount": 1},
            )
            await asyncio.sleep(0.1)
            await cdp.send(
                "Input.dispatchMouseEvent",
                {"type": "mouseReleased", "x": px, "y": py, "button": "left", "clickCount": 1},
            )
            await asyncio.sleep(5)

        else:
            # Pattern B: Direct download link (credit cards)
            print("  Clicking download link (direct)...")
            await cdp.mouse_click_element(f'document.getElementById("{direct_link_id}")')
            await asyncio.sleep(5)

        print(f"  Downloaded {name}.")

        # TODO: Verify PDF appeared in Downloads. If not:
        # 1. Refresh page (Page.reload)
        # 2. Re-click Statements & documents
        # 3. Re-expand all accounts
        # 4. Retry download for this account

    # Step 4: Report — check Downloads folder for each account, save CSV
    import csv
    import glob
    import os
    from datetime import datetime

    download_dir = str(Path.home() / "Downloads")
    recent_pdfs = sorted(
        glob.glob(os.path.join(download_dir, "*.pdf")),
        key=os.path.getmtime,
        reverse=True,
    )

    # Build report rows
    report_rows = []
    for acct in accounts:
        name = acct["name"]
        last4_match = name.split("...")[-1].rstrip(")") if "..." in name else ""

        matched_file = None
        for pdf in recent_pdfs:
            basename = os.path.basename(pdf)
            if last4_match and last4_match in basename:
                if os.path.getmtime(pdf) > asyncio.get_event_loop().time() - 600:
                    matched_file = basename
                    break

        if matched_file:
            status = "DOWNLOADED"
            reason = ""
        elif not acct.get("had_icon", True):
            status = "NO STATEMENTS"
            reason = "no download icon found"
        else:
            status = "MISSING"
            reason = "no PDF found in Downloads"

        report_rows.append({
            "account": name,
            "last4": last4_match,
            "status": status,
            "file": matched_file or "",
            "reason": reason,
        })

    # Print to stdout
    print("\n=== Download Report ===\n")
    print(f"{'Account':<35} {'Status':<15} {'File'}")
    print("-" * 90)
    for row in report_rows:
        detail = row["file"] if row["file"] else f"({row['reason']})"
        print(f"  {row['account']:<33} {row['status']:<15} {detail}")

    # Save CSV: output/{username}_chase_download_report_{timestamp}.csv
    tab_info = json.loads(Path("_chase_tab.json").read_text())
    username = tab_info.get("username", "unknown")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    csv_path = output_dir / f"{username}_chase_download_report_{timestamp}.csv"

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["account", "last4", "status", "file", "reason"])
        writer.writeheader()
        writer.writerows(report_rows)

    print(f"\nReport saved: {csv_path}")

    await cdp.screenshot("debug_chase_all_downloaded.png")
    print(f"Screenshot: profiles/debug_chase_all_downloaded.png")
    print("Run: python scripts/chase_login.py signout")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 6: Sign out
# ---------------------------------------------------------------------------

async def cmd_signout():
    """Click Sign out."""
    print("=== Chase: Sign Out (Step 6) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    print("Clicking Sign out...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("a, button"))'
        '.find(e => e.textContent.trim() === "Sign out" && e.offsetParent !== null)'
    )
    await asyncio.sleep(5)

    await cdp.screenshot("debug_chase_signout.png")
    url = await cdp.evaluate("window.location.href")
    print(f"URL: {url}")
    print("Signed out.")
    await ws.close()

    # Close the tab to keep browser clean for next account
    tab_id = tab_info["tab_id"]
    ver = json.loads(
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version").read()
    )
    async with websockets.connect(ver["webSocketDebuggerUrl"]) as browser_ws:
        await browser_ws.send(json.dumps({
            "id": 1, "method": "Target.closeTarget",
            "params": {"targetId": tab_id}
        }))
        await browser_ws.recv()
    print("Tab closed.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python scripts/chase_login.py login USERNAME PASSWORD [PHONE_SUFFIX]")
        print("  python scripts/chase_login.py next")
        print("  python scripts/chase_login.py retry          # if no SMS after 4 min, try 2nd number")
        print("  python scripts/chase_login.py 2fa CODE PASSWORD")
        print("  python scripts/chase_login.py statements")
        print("  python scripts/chase_login.py download        # downloads ALL accounts")
        print("  python scripts/chase_login.py signout")
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "login":
        if len(sys.argv) < 4:
            print("ERROR: python scripts/chase_login.py login USERNAME PASSWORD [PHONE_SUFFIX]")
            sys.exit(1)
        phone = sys.argv[4] if len(sys.argv) > 4 else "1992"
        asyncio.run(cmd_login(sys.argv[2], sys.argv[3], phone))

    elif cmd == "next":
        asyncio.run(cmd_next())

    elif cmd == "retry":
        asyncio.run(cmd_retry())

    elif cmd == "2fa":
        if len(sys.argv) < 4:
            print("ERROR: python scripts/chase_login.py 2fa CODE PASSWORD")
            sys.exit(1)
        asyncio.run(cmd_2fa(sys.argv[2], sys.argv[3]))

    elif cmd == "statements":
        asyncio.run(cmd_statements())

    elif cmd == "download":
        asyncio.run(cmd_download())

    elif cmd == "signout":
        asyncio.run(cmd_signout())

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
