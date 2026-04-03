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
    return await websockets.connect(tab["webSocketDebuggerUrl"])


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
    if "auth" not in (url or ""):
        print("  WARNING: May not be on 2FA page.")
        await cdp.screenshot("debug_chase_login_fail.png")
        await ws.close()
        return

    # Open 2FA dropdown: custom component #header-simplerAuth-dropdownoptions-styledselect
    print("Opening 2FA dropdown...")
    await cdp.mouse_click_element(
        'document.querySelector("#header-simplerAuth-dropdownoptions-styledselect")'
    )
    await asyncio.sleep(1)

    # Capture ALL matching phone numbers under TEXT ME before selecting one.
    # Some accounts have two numbers with the same last 4 digits.
    # We select the first match. If no SMS arrives within 4 min, the retry
    # logic (cmd_retry) selects the second match.
    #
    # Listbox: #ul-list-container-simplerAuth-dropdownoptions-styledselect
    # Options are <li> children. TEXT ME header comes before CALL ME header.
    # We only want matches BEFORE the CALL ME header.
    matching_count = await cdp.evaluate(
        'Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children)'
        f'.filter(li => li.textContent.trim() === "xxx-xxx-{phone_suffix}").length'
    )
    print(f"  Found {matching_count} phone number(s) matching xxx-xxx-{phone_suffix}")

    # Select the FIRST matching number (index 0)
    print(f"Selecting TEXT ME xxx-xxx-{phone_suffix} (first match)...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children)'
        f'.find(li => li.textContent.trim() === "xxx-xxx-{phone_suffix}")'
    )
    await asyncio.sleep(1)

    # Save match count for retry logic
    tab_state = json.loads(Path("_chase_tab.json").read_text())
    tab_state["phone_match_count"] = matching_count or 1
    tab_state["phone_suffix"] = phone_suffix
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
    match_count = tab_info.get("phone_match_count", 1)

    if match_count < 2:
        print(f"Only 1 phone number matches xxx-xxx-{phone_suffix}. No second number to try.")
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

    # Select the SECOND matching number (skip the first match)
    print(f"Selecting TEXT ME xxx-xxx-{phone_suffix} (SECOND match)...")
    await cdp.mouse_click_element(
        'Array.from(document.querySelector("#ul-list-container-simplerAuth-dropdownoptions-styledselect").children)'
        f'.filter(li => li.textContent.trim() === "xxx-xxx-{phone_suffix}")[1]'
    )
    await asyncio.sleep(1)

    await cdp.screenshot("debug_chase_sms_retry.png")
    print(f"\nSecond number selected. Run: python scripts/chase_login.py next")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 3: Enter 2FA code + re-enter password
# ---------------------------------------------------------------------------

async def cmd_2fa(code: str, password: str):
    """Enter 8-digit 2FA code and re-enter password."""
    print("=== Chase 2FA (Step 3) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
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


# ---------------------------------------------------------------------------
# Step 4: Navigate to Statements
# ---------------------------------------------------------------------------

async def cmd_statements():
    """Click Statements & documents tab (shadow DOM, found by data-testid)."""
    print("=== Chase: Statements (Step 4) ===\n")

    tab_info = json.loads(Path("_chase_tab.json").read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Chase uses shadow DOM web components (mds-navigation-bar-item).
    # Found by data-testid attribute — stable automation identifier.
    print("Clicking Statements & documents...")
    await cdp.mouse_click_element(
        'document.querySelector(\'[data-testid="statementsAndDocuments-navigation-bar-item"]\')'
    )
    await asyncio.sleep(5)

    await cdp.screenshot("debug_chase_statements.png")
    url = await cdp.evaluate("window.location.href")
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
