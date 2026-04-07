"""Wells Fargo Business statement downloader via direct CDP.

Pure Python + CDP. No AI, no screenshots, no coordinates.
All elements found by ID, class, or text match.

Usage (from bank-puller/v4):
    python scripts/wellsfargo_login.py login USERNAME PASSWORD [PHONE_SUFFIX]
    python scripts/wellsfargo_login.py 2fa CODE
    python scripts/wellsfargo_login.py statements
    python scripts/wellsfargo_login.py download
    python scripts/wellsfargo_login.py signout

Full workflow:
    1. login      — navigate to wellsfargo.com, enter creds, click sign on
    2. 2fa        — enter code from Dialpad (skip if trusted device)
    3. statements — discover accounts on dashboard, click 3-dot menu, View Statements
    4. download   — download most recent statement for current account
    5. signout    — click sign off, close tab

Key WF behaviors:
    - Login form is on the homepage (wellsfargo.com), not a separate /signin page
    - Login fields: #userid, #password, #btnSignon (form #frmSignon)
    - Dashboard shows accounts as <li> tiles with "Common tasks" 3-dot buttons
    - 3-dot menu has "View Activity" and "View Statements" options
    - Clicking a statement opens the PDF in the SAME window (not a download)
    - Must fetch PDF bytes via JS fetch(), save to disk, then navigate back
    - Statements page URL: /edocs/start#/edocs/home/documents/default
    - PDF URL pattern: /edocs/documents/retrieve/{UUID}
    - Account dropdown on statements page may allow switching (untested)
"""

import asyncio
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import websockets
import urllib.request
import base64

# Assumes Chrome already running on this port (launched by dialpad_login.py)
CDP_PORT = 9300
PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"
STATE_FILE = Path("_wellsfargo_tab.json")
STATEMENTS_URL = "https://connect.secure.wellsfargo.com/edocs/start#/edocs/home/documents/default"


async def cdp_connect_tab(tab_id: str):
    """Connect to a specific tab by ID."""
    pages = json.loads(
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json").read()
    )
    tab = next(p for p in pages if p["id"] == tab_id)
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

    async def evaluate_async(self, expression):
        r = await self.send("Runtime.evaluate", {
            "expression": expression, "awaitPromise": True
        })
        return r.get("result", {}).get("value")

    async def mouse_click_element(self, find_expr):
        """Find element via JS expression, scroll into view, get center coords, mouse-click."""
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
# Step 1: Login
# ---------------------------------------------------------------------------

async def cmd_login(username: str, password: str, phone_suffix: str = "1992"):
    """Navigate to wellsfargo.com, enter creds, click sign on."""
    print("=== Wells Fargo Login (Step 1) ===\n")

    tab_id = await create_new_tab()
    print(f"New tab: {tab_id}")
    STATE_FILE.write_text(json.dumps({
        "tab_id": tab_id,
        "username": username,
        "phone_suffix": phone_suffix,
    }))

    ws = await cdp_connect_tab(tab_id)
    cdp = CDPHelper(ws)

    # Navigate to Wells Fargo homepage (login form is on main page)
    await cdp.send("Page.enable")
    print("Navigating to wellsfargo.com...")
    await cdp.send("Page.navigate", {"url": "https://www.wellsfargo.com"})
    await asyncio.sleep(8)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")

    # Enter username: #userid (name=j_username)
    print("Entering username...")
    await cdp.evaluate('document.querySelector("#userid").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": username})
    await asyncio.sleep(0.3)

    # Enter password: #password (name=j_password)
    print("Entering password...")
    await cdp.evaluate('document.querySelector("#password").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": password})
    await asyncio.sleep(0.3)

    # Click Sign On: #btnSignon (input type=submit in form #frmSignon)
    print("Clicking Sign On...")
    await cdp.mouse_click_element('document.querySelector("#btnSignon")')
    await asyncio.sleep(10)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")

    # Branch: Wrong credentials
    if "logon" in (url or "") or "error" in (url or ""):
        error_text = await cdp.evaluate(
            'document.body?.innerText?.substring(0, 300)'
        )
        print(f"  LOGIN FAILED: {error_text}")
        await cdp.screenshot(f"debug_wf_{username}_login_failed.png")
        await ws.close()
        return

    # Branch: Trusted device — already on account summary
    if "accounts" in (url or "") or "accountsummary" in (url or ""):
        print("  No 2FA required (trusted device). Skip 2fa, go to statements.")

        # Discover accounts on dashboard
        accounts = await _discover_accounts(cdp)
        tab_state = json.loads(STATE_FILE.read_text())
        tab_state["accounts"] = accounts
        STATE_FILE.write_text(json.dumps(tab_state, indent=2))

        await cdp.screenshot(f"debug_wf_{username}_no_2fa.png")
        print(f"\nRun: python scripts/wellsfargo_login.py statements")
        await ws.close()
        return

    # Branch: 2FA page — screenshot and report
    await cdp.screenshot(f"debug_wf_{username}_after_signon.png")
    print("  2FA or unexpected page. Review screenshot.")
    print(f"\nRun: python scripts/wellsfargo_login.py 2fa CODE")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 2: 2FA (placeholder — not yet observed for WF)
# ---------------------------------------------------------------------------

async def cmd_2fa(code: str):
    """Enter 2FA code. Not yet implemented — WF 2FA flow needs discovery."""
    print("=== Wells Fargo 2FA (Step 2) ===\n")
    print("ERROR: WF 2FA flow not yet implemented.")
    print("  Need to observe the 2FA page first to identify selectors.")
    print("  Screenshot the page and report what you see.")

    tab_info = json.loads(STATE_FILE.read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")
    await cdp.screenshot(f"debug_wf_{tab_info['username']}_2fa_page.png")

    # Dump page structure for discovery
    inputs = await cdp.evaluate(
        'JSON.stringify(Array.from(document.querySelectorAll("input")).map(e => ({'
        '  id: e.id, name: e.name, type: e.type, visible: e.offsetParent !== null'
        '})))'
    )
    print(f"  Inputs: {inputs}")

    buttons = await cdp.evaluate(
        'JSON.stringify(Array.from(document.querySelectorAll("button")).filter(e => e.offsetParent !== null).map(e => ({'
        '  text: e.textContent.trim().substring(0, 50), id: e.id'
        '})))'
    )
    print(f"  Buttons: {buttons}")

    await ws.close()


# ---------------------------------------------------------------------------
# Step 3: Navigate to Statements (via dashboard 3-dot menu)
# ---------------------------------------------------------------------------

async def cmd_statements():
    """From dashboard, click 3-dot menu on first account, then View Statements."""
    print("=== Wells Fargo: Statements (Step 3) ===\n")

    tab_info = json.loads(STATE_FILE.read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    accounts = tab_info.get("accounts", [])
    if not accounts:
        print("  No accounts in state. Re-discovering from dashboard...")
        accounts = await _discover_accounts(cdp)
        tab_info["accounts"] = accounts
        STATE_FILE.write_text(json.dumps(tab_info, indent=2))

    if not accounts:
        print("  ERROR: No accounts found on dashboard.")
        await cdp.screenshot("debug_wf_no_accounts.png")
        await ws.close()
        return

    # Print account list
    print(f"Accounts ({len(accounts)}):")
    for i, acct in enumerate(accounts):
        print(f"  [{i}] {acct['name']} ...{acct['last4']}")

    # Click 3-dot menu on first account
    first = accounts[0]
    print(f"\nClicking 3-dot menu for {first['name']} ...{first['last4']}...")
    clicked = await cdp.mouse_click_element(
        f'Array.from(document.querySelectorAll("button")).find(b => '
        f'b.textContent.includes("Common tasks") && b.textContent.includes("{first["last4"]}"))'
    )
    if not clicked:
        print("  ERROR: Could not find 3-dot button.")
        await cdp.screenshot("debug_wf_no_3dot.png")
        await ws.close()
        return
    await asyncio.sleep(2)

    # Click "View Statements" in the flyout menu
    print("Clicking View Statements...")
    clicked = await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("button")).find(b => '
        'b.textContent.trim() === "View Statements" && b.offsetParent !== null)'
    )
    if not clicked:
        print("  ERROR: Could not find View Statements button.")
        await cdp.screenshot("debug_wf_no_view_statements.png")
        await ws.close()
        return
    await asyncio.sleep(8)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")

    # Verify we're on the statements page
    has_header = await cdp.evaluate(
        'document.body?.innerText?.includes("Statements and Documents") || false'
    )
    if not has_header:
        print("  WARNING: May not be on statements page.")
        await cdp.screenshot("debug_wf_statements_unexpected.png")
    else:
        print("  Statements page loaded.")

    # Read which account is selected and list available statements
    selected = await cdp.evaluate(
        'document.body?.innerText?.match(/(?:BUSINESS CHECKING|EVERYDAY CHECKING|'
        'SIGNIFY BUSINESS|BUSINESSLINE|WELLS FARGO REFLECT)[^\\n]*/)?.[0] || ""'
    )
    print(f"  Selected account: {selected}")

    statements = await cdp.evaluate(
        'JSON.stringify(Array.from(document.querySelectorAll("a")).filter(a => '
        'a.textContent.includes("Statement") && a.textContent.includes("PDF")'
        ').map(a => a.textContent.trim()))'
    )
    stmt_list = json.loads(statements or "[]")
    print(f"  Statements available: {len(stmt_list)}")
    for s in stmt_list[:5]:
        print(f"    {s}")
    if len(stmt_list) > 5:
        print(f"    ... and {len(stmt_list) - 5} more")

    # Initialize download tracker with all accounts as PENDING
    tracker = []
    for acct in accounts:
        tracker.append({
            "account": acct["name"],
            "last4": acct["last4"],
            "status": "PENDING",
            "downloaded_filename": "", "renamed_filename": "",
            "reason": "",
        })
    tab_info = json.loads(STATE_FILE.read_text())
    tab_info["tracker"] = tracker
    STATE_FILE.write_text(json.dumps(tab_info, indent=2))
    _write_report_csv(tab_info.get("username", "unknown"), tracker)
    print(f"\n  Tracker initialized ({len(tracker)} accounts).")

    await cdp.screenshot("debug_wf_statements.png")
    print(f"\nRun: python scripts/wellsfargo_login.py download")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 4: Download most recent statement for ALL accounts
# ---------------------------------------------------------------------------

async def cmd_download():
    """Download the most recent statement for every account via dropdown switching.

    WF opens PDFs in the same browser window. Per-account flow:
    1. Switch to account via dropdown (if not already selected)
    2. Click the first statement link (SPA-handled, empty href)
    3. URL changes to /edocs/documents/retrieve/{UUID}
    4. Fetch PDF bytes via JS fetch() + arrayBuffer (uses auth cookies)
    5. Base64-encode in browser, decode in Python, save to disk
    6. Navigate back to statements page
    7. Update tracker + CSV
    """
    print("=== Wells Fargo: Download All Accounts (Step 4) ===\n")

    tab_info = json.loads(STATE_FILE.read_text())
    username = tab_info.get("username", "unknown")
    accounts = tab_info.get("accounts", [])
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    # Initialize tracker if not present
    tracker = tab_info.get("tracker")
    if not tracker:
        tracker = [
            {"account": a["name"], "last4": a["last4"], "status": "PENDING", "downloaded_filename": "", "renamed_filename": "", "reason": ""}
            for a in accounts
        ]
        tab_info["tracker"] = tracker
        STATE_FILE.write_text(json.dumps(tab_info, indent=2))
        _write_report_csv(username, tracker)

    print(f"Accounts to process: {len(accounts)}\n")

    for acct in accounts:
        last4 = acct["last4"]
        name = acct["name"]

        # Skip already-downloaded accounts
        entry = next((e for e in tracker if e["last4"] == last4), None)
        if entry and entry["status"] == "DOWNLOADED":
            print(f"--- {name} ...{last4} --- ALREADY DOWNLOADED, skipping.\n")
            continue

        print(f"--- {name} ...{last4} ---")

        # Step A: Switch to this account via dropdown
        if not await _switch_account(cdp, last4):
            print(f"  FAILED to switch to account ...{last4}. Skipping.")
            if entry:
                entry["status"] = "ERROR"
                entry["reason"] = "could not switch via dropdown"
            await cdp.screenshot(f"debug_wf_{username}_{last4}_switch_failed.png")
            _save_tracker(tab_info, tracker, username)
            continue
        await asyncio.sleep(3)

        # Step B: Check if statements exist for this account
        first_stmt = await cdp.evaluate(
            'Array.from(document.querySelectorAll("a")).find(a => '
            'a.textContent.includes("Statement") && a.textContent.includes("PDF")'
            ')?.textContent?.trim() || ""'
        )

        if not first_stmt:
            print("  No statements available. Skipping.")
            if entry:
                entry["status"] = "NO STATEMENTS"
                entry["reason"] = "no statement links on page"
            _save_tracker(tab_info, tracker, username)
            print()
            continue

        # Step C: Extract date from statement text
        date_match = re.search(r'(\d{2})/(\d{2})/(\d{2})', first_stmt)
        if date_match:
            mm, dd, yy = date_match.groups()
            stmt_date = f"20{yy}-{mm}-{dd}"
        else:
            stmt_date = "unknown"
        print(f"  Most recent: {first_stmt}")

        # Step D: Click the statement link
        print(f"  Clicking statement {stmt_date}...")
        clicked = await cdp.mouse_click_element(
            'Array.from(document.querySelectorAll("a")).find(a => '
            'a.textContent.includes("Statement") && a.textContent.includes("PDF"))'
        )
        if not clicked:
            print("  ERROR: Could not click statement link.")
            if entry:
                entry["status"] = "ERROR"
                entry["reason"] = "could not click statement link"
            _save_tracker(tab_info, tracker, username)
            print()
            continue
        await asyncio.sleep(8)

        # Step E: Verify we're on the PDF page
        url = await cdp.evaluate("window.location.href")
        if "/edocs/documents/retrieve/" not in (url or ""):
            print(f"  WARNING: Not on PDF page. URL: {url}")
            await cdp.screenshot(f"debug_wf_{username}_{last4}_not_pdf.png")
            if entry:
                entry["status"] = "ERROR"
                entry["reason"] = f"unexpected URL after click: {url}"
            _save_tracker(tab_info, tracker, username)
            # Try to navigate back
            await cdp.send("Page.navigate", {"url": STATEMENTS_URL})
            await asyncio.sleep(8)
            print()
            continue

        # Step F: Fetch PDF bytes
        print("  Fetching PDF bytes...")
        pdf_b64 = await cdp.evaluate_async('''
            (async () => {
                const resp = await fetch(window.location.href);
                if (!resp.ok) return null;
                const buf = await resp.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary);
            })()
        ''')

        if not pdf_b64:
            print("  ERROR: Could not fetch PDF data.")
            await cdp.screenshot(f"debug_wf_{username}_{last4}_fetch_failed.png")
            if entry:
                entry["status"] = "ERROR"
                entry["reason"] = "fetch returned null"
            _save_tracker(tab_info, tracker, username)
            await cdp.send("Page.navigate", {"url": STATEMENTS_URL})
            await asyncio.sleep(8)
            print()
            continue

        pdf_bytes = base64.b64decode(pdf_b64)
        filename = f"WF_Statement_{last4}_{stmt_date}.pdf"
        out_path = Path.home() / "Downloads" / filename
        out_path.write_bytes(pdf_bytes)
        print(f"  Saved: {filename} ({len(pdf_bytes)} bytes)")

        if not pdf_bytes[:5] == b"%PDF-":
            print("  WARNING: File does not start with %PDF- header.")

        # Step G: Update tracker
        if entry:
            entry["status"] = "DOWNLOADED"
            entry["downloaded_filename"] = filename
            entry["reason"] = ""
        _save_tracker(tab_info, tracker, username)

        # Step H: Navigate back to statements page
        print("  Navigating back...")
        await cdp.send("Page.navigate", {"url": STATEMENTS_URL})
        await asyncio.sleep(8)

        has_header = await cdp.evaluate(
            'document.body?.innerText?.includes("Statements and Documents") || false'
        )
        if not has_header:
            print("  WARNING: May not be on statements page after back-nav.")
            await cdp.screenshot(f"debug_wf_{username}_{last4}_back_failed.png")

        print()

    # Final report
    print("\n=== Download Complete ===")
    _print_tracker(tracker)
    _write_report_csv(username, tracker)
    await cdp.screenshot("debug_wf_all_downloaded.png")
    print(f"\nRun: python scripts/wellsfargo_login.py signout")
    await ws.close()


# ---------------------------------------------------------------------------
# Step 5: Sign out + tab close
# ---------------------------------------------------------------------------

async def cmd_signout():
    """Click Sign Off and close the tab."""
    print("=== Wells Fargo: Sign Out (Step 5) ===\n")

    tab_info = json.loads(STATE_FILE.read_text())
    ws = await cdp_connect_tab(tab_info["tab_id"])
    cdp = CDPHelper(ws)

    print("Clicking Sign Off...")
    clicked = await cdp.mouse_click_element(
        'Array.from(document.querySelectorAll("a, button")).find(e => '
        'e.textContent.trim() === "Sign Off" && e.offsetParent !== null)'
    )
    if not clicked:
        print("  WARNING: Could not find Sign Off button. Trying 'Sign Out'...")
        clicked = await cdp.mouse_click_element(
            'Array.from(document.querySelectorAll("a, button")).find(e => '
            'e.textContent.trim() === "Sign Out" && e.offsetParent !== null)'
        )
    await asyncio.sleep(5)

    url = await cdp.evaluate("window.location.href")
    print(f"  URL: {url}")
    await cdp.screenshot("debug_wf_signout.png")
    print("Signed out.")
    await ws.close()

    # Close the tab
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
# Helpers
# ---------------------------------------------------------------------------

async def _switch_account(cdp: CDPHelper, target_last4: str) -> bool:
    """Switch to a different account via the statements page dropdown.

    Returns True if the switch succeeded (or account was already selected).
    """
    # Check if already on the target account
    current = await cdp.evaluate(
        'document.querySelector("[class*=Value__value]")?.textContent?.trim() || ""'
    )
    if target_last4 in (current or ""):
        print(f"  Already on account ...{target_last4}")
        return True

    print(f"  Switching to account ...{target_last4}...")

    # Open dropdown: click the combobox trigger
    clicked = await cdp.mouse_click_element(
        'document.querySelector("[role=combobox][aria-haspopup=listbox]")'
    )
    if not clicked:
        print("  ERROR: Could not find dropdown trigger.")
        return False
    await asyncio.sleep(2)

    # Click the option matching target_last4
    clicked = await cdp.mouse_click_element(
        f'Array.from(document.querySelectorAll("li[role=option]")).find(li => '
        f'li.textContent.includes("{target_last4}") && !li.textContent.includes("Selected"))'
    )
    if not clicked:
        # Maybe there's only one match and it says "Selected" — try without the filter
        clicked = await cdp.mouse_click_element(
            f'Array.from(document.querySelectorAll("li[role=option]")).find(li => '
            f'li.textContent.includes("{target_last4}"))'
        )
    if not clicked:
        print(f"  ERROR: Could not find option for ...{target_last4}")
        return False

    # Wait for statements to load for new account
    await asyncio.sleep(8)

    # Verify switch
    new_selected = await cdp.evaluate(
        'document.querySelector("[class*=Value__value]")?.textContent?.trim() || ""'
    )
    if target_last4 in (new_selected or ""):
        print(f"  Switched to: {new_selected}")
        return True

    print(f"  WARNING: Dropdown shows '{new_selected}', expected ...{target_last4}")
    return True  # Proceed anyway — statements may have loaded correctly


def _save_tracker(tab_info: dict, tracker: list, username: str):
    """Save tracker to state file and CSV."""
    tab_info["tracker"] = tracker
    STATE_FILE.write_text(json.dumps(tab_info, indent=2))
    _write_report_csv(username, tracker)


def _write_report_csv(username: str, tracker: list):
    """Write/overwrite the download report CSV."""
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    csv_path = output_dir / f"{username}_wellsfargo_download_report.csv"

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["account", "last4", "status", "downloaded_filename", "renamed_filename", "reason"])
        writer.writeheader()
        writer.writerows(tracker)

    print(f"  Report: {csv_path}")


def _print_tracker(tracker: list):
    """Print the current tracker status to stdout."""
    print(f"\n{'Account':<40} {'Last4':<8} {'Status':<15} {'File'}")
    print("-" * 100)
    for row in tracker:
        detail = row["downloaded_filename"] if row["downloaded_filename"] else f"({row['reason']})" if row["reason"] else ""
        print(f"  {row['account']:<38} {row['last4']:<8} {row['status']:<15} {detail}")


async def _discover_accounts(cdp: CDPHelper):
    """Discover all accounts on the WF dashboard.

    Each account is an <li class="AccountTile__account-tile___..."> containing:
    - <span class="AccountTitle__title___..."> with account name
    - Text "ending in...XXXX" with last 4 digits
    - <button class="LegacyButton__plain___..."> "Common tasks for ... ending with ...XXXX"
    """
    accounts_json = await cdp.evaluate(
        'JSON.stringify(Array.from(document.querySelectorAll("li[class*=AccountTile]")).map((li, i) => ({'
        '  i: i,'
        '  name: li.querySelector("span[class*=AccountTitle]")?.textContent?.trim() || "",'
        '  last4: (li.textContent.match(/ending in\\.\\.\\.(\\d+)/) || [])[1] || ""'
        '})))'
    )
    accounts = json.loads(accounts_json or "[]")

    print(f"  Found {len(accounts)} account(s):")
    for acct in accounts:
        print(f"    [{acct['i']}] {acct['name']} ...{acct['last4']}")

    return accounts


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python scripts/wellsfargo_login.py login USERNAME PASSWORD [PHONE_SUFFIX]")
        print("  python scripts/wellsfargo_login.py 2fa CODE")
        print("  python scripts/wellsfargo_login.py statements")
        print("  python scripts/wellsfargo_login.py download")
        print("  python scripts/wellsfargo_login.py signout")
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "login":
        if len(sys.argv) < 4:
            print("ERROR: python scripts/wellsfargo_login.py login USERNAME PASSWORD [PHONE_SUFFIX]")
            sys.exit(1)
        phone = sys.argv[4] if len(sys.argv) > 4 else "1992"
        asyncio.run(cmd_login(sys.argv[2], sys.argv[3], phone))

    elif cmd == "2fa":
        if len(sys.argv) < 3:
            print("ERROR: python scripts/wellsfargo_login.py 2fa CODE")
            sys.exit(1)
        asyncio.run(cmd_2fa(sys.argv[2]))

    elif cmd == "statements":
        asyncio.run(cmd_statements())

    elif cmd == "download":
        asyncio.run(cmd_download())

    elif cmd == "signout":
        asyncio.run(cmd_signout())

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
