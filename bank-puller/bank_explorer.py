"""Bank Explorer — generalized step-by-step bank login + discovery.

Interactive, bank-agnostic alternative to chase_manual_login.py.
Uses AI vision for all field/button discovery. Records playbook + profile.

Usage:
    python bank_explorer.py launch                           # Start browser
    python bank_explorer.py screenshot                       # Take screenshot
    python bank_explorer.py navigate URL                     # Go to URL
    python bank_explorer.py discover_login                   # AI finds login URL
    python bank_explorer.py fill_field "username"            # AI finds + fills field
    python bank_explorer.py fill_field "password"            # AI finds + fills field
    python bank_explorer.py click "Sign In button"           # AI finds + clicks element
    python bank_explorer.py enter_2fa CODE                   # Fill 2FA code
    python bank_explorer.py find_statements                  # Navigate to statements page
    python bank_explorer.py download LAST4 2026-02           # Download statement
    python bank_explorer.py save_profile                     # Print discovered profile + save

Arguments:
    --bank "Chase Business"    Bank name (required for most commands)
    --account LAST4            Account last digits
    --cdp-port PORT            CDP port (default: 9223)
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (
    CLIENTS_XLSX, DEBUG_SCREENSHOTS_DIR, DOWNLOADS_DIR, OUTPUT_DIR,
)
from orchestrator.bank_profiles import get_bank_profile, BANK_PROFILES

SCREENSHOT_DIR = DEBUG_SCREENSHOTS_DIR
_step_num = 0


def save_screenshot(png_bytes: bytes, label: str) -> Path:
    global _step_num
    _step_num += 1
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"explorer_{_step_num:02d}_{label}.png"
    path.write_bytes(png_bytes)
    print(f"  Screenshot saved: {path.name} ({len(png_bytes) // 1024}KB)")
    return path


def get_job(bank_name: str, account_last4: str = ""):
    """Load matching job from clients.xlsx."""
    from orchestrator.excel_reader import ExcelManager
    with ExcelManager(CLIENTS_XLSX) as mgr:
        accounts = mgr.read_accounts()
    bank_lower = bank_name.lower()
    jobs = [j for j in accounts if bank_lower in j.bank_name.lower()]
    if account_last4:
        jobs = [j for j in jobs if j.account_last4 == account_last4]
    if not jobs:
        print(f"ERROR: No matching account for bank='{bank_name}' last4='{account_last4}'")
        sys.exit(1)
    return jobs[0]


async def connect_to_browser(cdp_port: int):
    """Connect to already-running browser via CDP."""
    from patchright.async_api import async_playwright
    pw = await async_playwright().start()
    try:
        browser = await pw.chromium.connect_over_cdp(f"http://localhost:{cdp_port}")
    except Exception as e:
        print(f"ERROR: Cannot connect to browser on port {cdp_port}: {e}")
        print("Run 'python bank_explorer.py launch' first.")
        sys.exit(1)
    context = browser.contexts[0] if browser.contexts else await browser.new_context()
    page = context.pages[0] if context.pages else await context.new_page()
    return pw, browser, context, page


async def cmd_launch(args):
    """Launch a browser with CDP enabled."""
    from patchright.async_api import async_playwright
    from utils.browser_setup import get_browser_config
    pw = await async_playwright().start()
    config = get_browser_config()
    browser = await pw.chromium.launch_persistent_context(
        user_data_dir=str(Path.home() / ".bank-explorer-profile"),
        headless=False,
        args=[f"--remote-debugging-port={args.cdp_port}"] + config.get("args", []),
        viewport={"width": 1920, "height": 1080},
    )
    print(f"Browser launched on CDP port {args.cdp_port}")
    print("Press Ctrl+C to close.")
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        await browser.close()
        await pw.stop()


async def cmd_screenshot(args):
    """Take a screenshot of the current page."""
    pw, browser, context, page = await connect_to_browser(args.cdp_port)
    png = await page.screenshot(full_page=False)
    save_screenshot(png, "current")
    await pw.stop()


async def cmd_navigate(args):
    """Navigate to a URL."""
    pw, browser, context, page = await connect_to_browser(args.cdp_port)
    url = args.url
    print(f"Navigating to: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(2)
    png = await page.screenshot(full_page=False)
    save_screenshot(png, "after_navigate")
    await pw.stop()


async def cmd_discover_login(args):
    """Use AI to discover the login URL for this bank."""
    from ai_skills.discovery import skill_discover_login_url
    result = skill_discover_login_url(args.bank)
    print(f"Action: {result.action}, Confidence: {result.confidence:.2f}")
    print(f"URL: {result.text}")
    print(f"Reasoning: {result.reasoning}")
    if result.raw_response and result.raw_response.get("alternatives"):
        print(f"Alternatives: {result.raw_response['alternatives']}")

    if result.action == "found" and result.text:
        answer = input(f"\nNavigate to {result.text}? [Y/n] ").strip().lower()
        if answer in ("", "y", "yes"):
            pw, browser, context, page = await connect_to_browser(args.cdp_port)
            await page.goto(result.text, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            png = await page.screenshot(full_page=False)
            save_screenshot(png, "login_page")
            await pw.stop()


async def cmd_fill_field(args):
    """Use AI to find and fill a field (username, password, etc.)."""
    from ai_skills.navigation import skill_find_element
    from utils.browser_setup import human_click, human_type, wait_and_screenshot

    pw, browser, context, page = await connect_to_browser(args.cdp_port)
    screenshot = await wait_and_screenshot(page, "fill_field")
    save_screenshot(screenshot, f"before_fill_{args.field_name}")

    result = skill_find_element(screenshot, f"{args.field_name} input field")
    print(f"Found: action={result.action}, conf={result.confidence:.2f}, target={result.target}")

    if result.action in ("click", "type") and result.target:
        job = get_job(args.bank, args.account or "")
        # Determine value from field name
        field_lower = args.field_name.lower()
        if "user" in field_lower:
            value = job.username
        elif "pass" in field_lower:
            value = job.password
        else:
            value = input(f"Enter value for '{args.field_name}': ").strip()

        await human_click(page, result.target["x"], result.target["y"])
        await page.keyboard.press("Control+a")
        await human_type(page, value)
        print(f"Filled '{args.field_name}' field.")

        await asyncio.sleep(1)
        png = await page.screenshot(full_page=False)
        save_screenshot(png, f"after_fill_{args.field_name}")
    else:
        print("Could not find the field.")

    await pw.stop()


async def cmd_click(args):
    """Use AI to find and click an element."""
    from ai_skills.navigation import skill_find_element
    from ai_skills.base import verified_click
    from utils.browser_setup import wait_and_screenshot

    pw, browser, context, page = await connect_to_browser(args.cdp_port)
    screenshot = await wait_and_screenshot(page, "click_target")
    save_screenshot(screenshot, f"before_click")

    result = skill_find_element(screenshot, args.element_description)
    print(f"Found: action={result.action}, conf={result.confidence:.2f}, target={result.target}")

    if result.action == "click" and result.target:
        changed = await verified_click(page, result, screenshot)
        print(f"Clicked. Page changed: {changed}")
        await asyncio.sleep(2)
        png = await page.screenshot(full_page=False)
        save_screenshot(png, "after_click")
    else:
        print("Could not find the element.")

    await pw.stop()


async def cmd_enter_2fa(args):
    """Fill a 2FA code into the OTP input field."""
    from utils.browser_setup import wait_and_screenshot

    pw, browser, context, page = await connect_to_browser(args.cdp_port)
    code = args.code

    # Try iframe-aware OTP fill
    code_entered = False
    for frame in page.frames:
        otp_field = frame.locator(
            'input[type="text"], input[type="tel"], input[type="number"], '
            'input:not([type="password"]):not([type="hidden"])'
        )
        for i in range(await otp_field.count()):
            field = otp_field.nth(i)
            if await field.is_visible():
                placeholder = await field.get_attribute("placeholder") or ""
                name = await field.get_attribute("name") or ""
                aria = await field.get_attribute("aria-label") or ""
                combined = f"{placeholder} {name} {aria}".lower()
                if any(kw in combined for kw in ("code", "otp", "one-time", "verification")) or await field.input_value() == "":
                    await field.fill("")
                    await field.fill(code)
                    print(f"Filled 2FA code via iframe selector (name={name})")
                    code_entered = True
                    break
        if code_entered:
            break

    if not code_entered:
        from ai_skills.navigation import skill_find_element
        from utils.browser_setup import human_click, human_type
        screenshot = await wait_and_screenshot(page, "2fa_entry")
        result = skill_find_element(screenshot, "verification code input field or OTP input field")
        if result.target:
            await human_click(page, result.target["x"], result.target["y"])
            await page.keyboard.press("Control+a")
            await human_type(page, code)
            print("Filled 2FA code via AI vision.")
        else:
            print("Could not find 2FA code input field.")

    png = await page.screenshot(full_page=False)
    save_screenshot(png, "after_2fa")
    await pw.stop()


async def cmd_save_profile(args):
    """Print discovered bank quirks and offer to write playbook + profile entry."""
    profile = get_bank_profile(args.bank)
    print(f"\nCurrent profile for '{args.bank}':")
    for k, v in profile.items():
        print(f"  {k}: {v}")

    print(f"\nRegistered profiles: {list(BANK_PROFILES.keys())}")
    bank_lower = args.bank.lower()
    matched = [k for k in BANK_PROFILES if k in bank_lower]
    if matched:
        print(f"  Matched key: '{matched[0]}'")
    else:
        print(f"  No match — using defaults. Add a new key to BANK_PROFILES if needed.")


def main():
    parser = argparse.ArgumentParser(description="Bank Explorer — step-by-step bank login + discovery")
    parser.add_argument("--bank", default="", help="Bank name")
    parser.add_argument("--account", default="", help="Account last digits")
    parser.add_argument("--cdp-port", type=int, default=9223, help="CDP port (default: 9223)")

    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("launch", help="Launch browser")
    subparsers.add_parser("screenshot", help="Take screenshot")

    p_nav = subparsers.add_parser("navigate", help="Navigate to URL")
    p_nav.add_argument("url", help="URL to navigate to")

    subparsers.add_parser("discover_login", help="AI discovers login URL")

    p_fill = subparsers.add_parser("fill_field", help="AI finds + fills field")
    p_fill.add_argument("field_name", help="Field name (e.g. 'username', 'password')")

    p_click = subparsers.add_parser("click", help="AI finds + clicks element")
    p_click.add_argument("element_description", help="Description of element to click")

    p_2fa = subparsers.add_parser("enter_2fa", help="Fill 2FA code")
    p_2fa.add_argument("code", help="2FA code")

    subparsers.add_parser("save_profile", help="Print/save discovered profile")

    args = parser.parse_args()

    cmd_map = {
        "launch": cmd_launch,
        "screenshot": cmd_screenshot,
        "navigate": cmd_navigate,
        "discover_login": cmd_discover_login,
        "fill_field": cmd_fill_field,
        "click": cmd_click,
        "enter_2fa": cmd_enter_2fa,
        "save_profile": cmd_save_profile,
    }

    asyncio.run(cmd_map[args.command](args))


if __name__ == "__main__":
    main()
