"""Dialpad pre-flight login via direct CDP.

Launches Patchright, logs into Dialpad, handles 2FA,
navigates to Compound Accounting > New tab. Keeps browser alive.

Usage (two steps — Claude Code runs both):
    python scripts/dialpad_login.py login     # Step 1: fill creds, submit, reach 2FA
    python scripts/dialpad_login.py 2fa CODE  # Step 2: enter code, navigate to inbox
"""

import asyncio
import json
import sys
from pathlib import Path

import websockets
import urllib.request

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from config import Settings

CDP_PORT = 9300
PROFILE_DIR = Path(__file__).resolve().parent.parent / "profiles" / "dialpad"


async def cdp_connect():
    """Connect to the page tab via CDP websocket."""
    pages = json.loads(
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json").read()
    )
    tab = next(p for p in pages if p["type"] == "page")
    return await websockets.connect(tab["webSocketDebuggerUrl"])


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

    async def mouse_click(self, selector_js):
        """Click an element by getting its center coords and dispatching mouse events."""
        expr = (
            f"(() => {{ const el = {selector_js}; if (!el) return '0,0'; "
            "const r = el.getBoundingClientRect(); "
            "return Math.round(r.x+r.width/2)+','+Math.round(r.y+r.height/2); })()"
        )
        coords = (await self.evaluate(expr) or "0,0").split(",")
        x, y = int(coords[0]), int(coords[1])
        if x == 0:
            return False
        await self.send(
            "Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y}
        )
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


def launch_browser_subprocess():
    """Launch Chrome as a raw subprocess so it survives Python exit.

    Uses the same flags as Patchright's launch_persistent_context but
    via subprocess.Popen so the browser stays alive between CLI steps.
    """
    import subprocess
    import shutil

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    profile = str(PROFILE_DIR.resolve())

    # Clean stale locks
    for lock in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
        p = PROFILE_DIR / lock
        if p.exists() or p.is_symlink():
            try:
                p.unlink()
            except OSError:
                pass

    # Find Chrome
    exe = shutil.which("chrome") or shutil.which("google-chrome")
    if not exe:
        for candidate in [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]:
            if Path(candidate).exists():
                exe = candidate
                break
    if not exe:
        raise RuntimeError("Chrome not found")

    args = [
        exe,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={profile}",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-infobars",
    ]

    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for CDP
    import time
    for _ in range(30):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
            return proc
        except Exception:
            pass

    raise RuntimeError(f"Chrome CDP not ready after 15s on port {CDP_PORT}")


async def step_login(cdp: CDPHelper, settings: Settings):
    """Fill email + password and click Log in to Dialpad."""
    await cdp.send("Page.enable")
    await cdp.send(
        "Page.navigate", {"url": "https://dialpad.com/accounts/login/"}
    )
    await asyncio.sleep(6)

    # Fill email
    await cdp.evaluate('document.querySelector("input[type=email]").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": settings.dialpad_email})
    await asyncio.sleep(0.3)

    # Fill password
    await cdp.evaluate('document.querySelector("input[type=password]").focus()')
    await asyncio.sleep(0.3)
    await cdp.send("Input.insertText", {"text": settings.dialpad_password})
    await asyncio.sleep(0.3)

    # Click submit via mouse
    await cdp.mouse_click(
        'Array.from(document.querySelectorAll("button"))'
        '.find(b => b.textContent.includes("Log in to Dialpad"))'
    )
    print("Login submitted. Waiting for 2FA screen...")
    await asyncio.sleep(8)

    buttons = await cdp.evaluate(
        'Array.from(document.querySelectorAll("button"))'
        '.map(b => b.textContent.trim()).filter(t=>t).slice(0,5).join(", ")'
    )
    print(f"Buttons: {buttons}")

    if "Resend code" not in (buttons or ""):
        print("WARNING: Not on 2FA screen. Check browser.")
        return False
    return True


async def step_2fa(cdp: CDPHelper, code: str):
    """Enter 6-digit 2FA code and click Submit."""
    # Click first code input
    await cdp.mouse_click('document.querySelectorAll("input[type=text]")[0]')
    await asyncio.sleep(0.2)

    # Type digits one at a time (auto-advance fields)
    for digit in code:
        await cdp.send(
            "Input.dispatchKeyEvent", {"type": "keyDown", "key": digit, "text": digit}
        )
        await cdp.send(
            "Input.dispatchKeyEvent", {"type": "keyUp", "key": digit}
        )
        await asyncio.sleep(0.1)
    await asyncio.sleep(0.5)

    # Verify
    filled = await cdp.evaluate(
        'Array.from(document.querySelectorAll("input[type=text]")).map(i=>i.value).join("")'
    )
    print(f"Code filled: {filled}")

    # Mouse-click Submit
    await cdp.mouse_click(
        'Array.from(document.querySelectorAll("button"))'
        '.find(b=>b.textContent.trim()==="Submit")'
    )
    print("Submitted. Waiting for app to load...")
    await asyncio.sleep(5)


async def step_navigate_app(cdp: CDPHelper):
    """Navigate to /app, dismiss modal, click Compound Accounting > New."""
    await cdp.send("Page.navigate", {"url": "https://dialpad.com/app"})

    # Progressive backoff waiting for SPA
    for wait in [3, 5, 8, 12]:
        await asyncio.sleep(wait)
        body_len = await cdp.evaluate("document.body?.innerText?.length || 0")
        preboot = await cdp.evaluate(
            'document.querySelector(".preboot-modal")?.innerText?.substring(0, 40) || null'
        )
        print(f"  After {wait}s: bodyLen={body_len}, preboot={'yes' if preboot else 'no'}")
        if (body_len or 0) > 50:
            break

    # Hide preboot modal
    await cdp.evaluate(
        'document.querySelector(".preboot-modal") '
        '&& (document.querySelector(".preboot-modal").style.display = "none")'
    )

    # Click Compound Accounting — the <a class="dp-general-row__primary"> link
    print("Clicking Compound Accounting...")
    await cdp.mouse_click('document.querySelector("a.dp-general-row__primary")')
    await asyncio.sleep(3)

    # Click New tab — the [role=tab] element
    print("Clicking New tab...")
    await cdp.mouse_click(
        'Array.from(document.querySelectorAll("[role=tab]"))'
        '.find(e => e.textContent.trim() === "New")'
    )
    await asyncio.sleep(2)

    # Verify
    body = await cdp.evaluate("document.body?.innerText?.substring(0, 300)")
    url = await cdp.evaluate("window.location.href")
    print(f"URL: {url}")
    print(f"Content: {(body or '')[:200]}")


async def cmd_login():
    """Step 1: Launch browser, fill creds, submit. Stops at 2FA screen."""
    settings = Settings()
    if not settings.dialpad_email or not settings.dialpad_password:
        print("ERROR: DIALPAD_EMAIL and DIALPAD_PASSWORD must be set in .env")
        return

    print("=== Dialpad Login (Step 1) ===\n")
    print("Launching Chrome (subprocess — survives Python exit)...")
    proc = launch_browser_subprocess()
    print(f"Chrome PID={proc.pid} (CDP port {CDP_PORT})\n")

    ws = await cdp_connect()
    cdp = CDPHelper(ws)

    print("Logging in...")
    ok = await step_login(cdp, settings)
    await ws.close()

    if ok:
        print("\n2FA screen reached. Run: python scripts/dialpad_login.py 2fa CODE")
    else:
        print("\nLogin may have failed. Check browser.")


async def cmd_2fa(code: str):
    """Step 2: Enter 2FA code, navigate to /app, Compound Accounting, New tab."""
    print(f"=== Dialpad 2FA + Navigate (Step 2) ===\n")

    ws = await cdp_connect()
    cdp = CDPHelper(ws)

    print(f"Entering code {code}...")
    await step_2fa(cdp, code)

    print("Navigating to Dialpad app...")
    await step_navigate_app(cdp)

    await ws.close()
    print("\n=== Dialpad Ready ===")
    print(f"CDP port: {CDP_PORT}")
    print("Browser is alive. Connect via CDP for SMS polling.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python scripts/dialpad_login.py login       # Step 1: creds + submit")
        print("  python scripts/dialpad_login.py 2fa CODE    # Step 2: enter code + navigate")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "login":
        asyncio.run(cmd_login())
    elif cmd == "2fa":
        if len(sys.argv) < 3:
            print("ERROR: provide the 6-digit code: python scripts/dialpad_login.py 2fa 123456")
            sys.exit(1)
        asyncio.run(cmd_2fa(sys.argv[2]))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
