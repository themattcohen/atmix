"""Chase Business — Manual Step-by-Step Login + Statement Download.

Step-based execution via CDP reconnection:
    python chase_manual_login.py launch     # Start browser (background)
    python chase_manual_login.py step2      # Fill username
    python chase_manual_login.py step3      # Fill password
    python chase_manual_login.py step4      # Click Sign In
    python chase_manual_login.py step5      # Handle 2FA dropdown
    python chase_manual_login.py step6 CODE # Enter 2FA code + password
    python chase_manual_login.py step7      # Submit verification
    python chase_manual_login.py screenshot # Take screenshot of current state
    python chase_manual_login.py step8      # Navigate to Statements & documents
    python chase_manual_login.py step9 LAST4  # Download statement for account
    python chase_manual_login.py step10 LAST4 # Rename + organize PDF
    python chase_manual_login.py save_playbook # Write chase-business.json

Screenshots saved to debug-screenshots/chase_manual_*.png
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import CLIENTS_XLSX, DEBUG_SCREENSHOTS_DIR, DOWNLOADS_DIR, OUTPUT_DIR

SCREENSHOT_DIR = DEBUG_SCREENSHOTS_DIR
CDP_PORT = 9223
CDP_URL = f"http://localhost:{CDP_PORT}"
_step_num = 0


def save_screenshot(png_bytes: bytes, label: str) -> Path:
    global _step_num
    _step_num += 1
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"chase_manual_{_step_num:02d}_{label}.png"
    path.write_bytes(png_bytes)
    print(f"  Screenshot saved: {path.name} ({len(png_bytes) // 1024}KB)")
    return path


def get_chase_job():
    """Load Chase ascaustingoji1 credentials from Excel."""
    from orchestrator.excel_reader import ExcelManager
    with ExcelManager(CLIENTS_XLSX) as mgr:
        accounts = mgr.read_accounts()
    jobs = [j for j in accounts if "chase" in j.bank_name.lower() and j.username == "ascaustingoji1"]
    if not jobs:
        print("ERROR: No Chase account with username 'ascaustingoji1' in clients.xlsx")
        sys.exit(1)
    return jobs[0]


async def connect_to_browser():
    """Connect to the already-running browser via CDP."""
    from patchright.async_api import async_playwright
    pw = await async_playwright().start()
    try:
        browser = await pw.chromium.connect_over_cdp(CDP_URL)
    except Exception as e:
        print(f"ERROR: Cannot connect to browser at {CDP_URL}: {e}")
        print("Did you run 'python chase_manual_login.py launch' first?")
        sys.exit(1)
    contexts = browser.contexts
    if not contexts:
        print("ERROR: No browser contexts found")
        sys.exit(1)
    ctx = contexts[0]
    page = ctx.pages[0] if ctx.pages else await ctx.new_page()
    return pw, browser, page


async def find_in_frames(page, selector: str):
    """Search all frames for a selector. Returns (frame, locator) or (None, None)."""
    for frame in page.frames:
        loc = frame.locator(selector).first
        try:
            if await loc.count() > 0 and await loc.is_visible():
                return frame, loc
        except Exception:
            continue
    return None, None


async def find_button_in_frames(page, name: str):
    """Search all frames for a button by role+name."""
    for frame in page.frames:
        loc = frame.get_by_role("button", name=name)
        try:
            if await loc.count() > 0:
                return frame, loc.first
        except Exception:
            continue
    return None, None


async def find_text_in_frames(page, text: str):
    """Search all frames for text."""
    for frame in page.frames:
        loc = frame.get_by_text(text)
        try:
            if await loc.count() > 0:
                return frame, loc.first
        except Exception:
            continue
    return None, None


async def take_stable_screenshot(page, reason=""):
    """Wait for page to stabilize then screenshot."""
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=5000)
    except Exception:
        pass
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    await asyncio.sleep(1)
    return await page.screenshot(type="png", full_page=False)


async def get_page_text(page):
    """Get text content from all frames."""
    best = ""
    for frame in page.frames:
        try:
            text = await frame.locator("body").text_content() or ""
            if len(text) > len(best):
                best = text
        except Exception:
            continue
    return best


# =========================================================================
# STEP: Launch browser
# =========================================================================
async def cmd_launch():
    """Launch Patchright browser with CDP port and navigate to Chase login."""
    from patchright.async_api import async_playwright
    from config import (
        BROWSER_PROFILES_DIR, BROWSER_LOCALE, BROWSER_TIMEZONE,
        BROWSER_CHANNEL, SCREENSHOT_RESOLUTION,
    )

    job = get_chase_job()
    print(f"Account: {job.client_name} / {job.bank_name} #{job.account_last4}")
    print(f"Username: {job.username}")
    print(f"2FA method: {job.tfa_method}")
    print()

    profile_dir = str(BROWSER_PROFILES_DIR / "bank-1")
    print(f"Launching browser with CDP on port {CDP_PORT}...")

    pw = await async_playwright().start()
    context = await pw.chromium.launch_persistent_context(
        user_data_dir=profile_dir,
        headless=False,
        viewport=SCREENSHOT_RESOLUTION,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-first-run",
            "--no-default-browser-check",
            "--enable-do-not-track",
            f"--remote-debugging-port={CDP_PORT}",
        ],
        locale=BROWSER_LOCALE,
        timezone_id=BROWSER_TIMEZONE,
        ignore_https_errors=False,
        extra_http_headers={"DNT": "1"},
        channel=BROWSER_CHANNEL if BROWSER_CHANNEL else None,
    )

    page = context.pages[0] if context.pages else await context.new_page()

    url = job.login_url or "https://www.chase.com/business/login"
    print(f"Navigating to {url} ...")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    shot = await take_stable_screenshot(page, "navigate")
    save_screenshot(shot, "01_navigate")

    print(f"\nBrowser launched and Chase login page loaded.")
    print(f"CDP endpoint: {CDP_URL}")
    print(f"Keeping browser alive... (Ctrl+C to kill)")
    print()

    # Keep alive
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("Shutting down browser...")
        await context.close()
        await pw.stop()


# =========================================================================
# STEP 2: Fill username
# =========================================================================
async def cmd_step2():
    job = get_chase_job()
    pw, browser, page = await connect_to_browser()

    print("STEP 2: Fill username")
    frame, loc = await find_in_frames(page, "#userId-input-field-input")
    if not loc:
        for sel in ["#userId", "input[name='userId']", "input[type='text']"]:
            frame, loc = await find_in_frames(page, sel)
            if loc:
                print(f"  Found via fallback: {sel}")
                break

    if not loc:
        print("  ERROR: Username field not found!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "error_no_username")
        return

    print(f"  Found in frame: {getattr(frame, 'url', 'main')[:60]}")
    await loc.fill(job.username)
    print(f"  Filled: {job.username}")
    await asyncio.sleep(1)

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "02_username_filled")
    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 3: Fill password
# =========================================================================
async def cmd_step3():
    job = get_chase_job()
    pw, browser, page = await connect_to_browser()

    print("STEP 3: Fill password")
    frame, loc = await find_in_frames(page, "#password-input-field-input")
    if not loc:
        for sel in ["#password", "input[name='password']", "input[type='password']"]:
            frame, loc = await find_in_frames(page, sel)
            if loc:
                print(f"  Found via fallback: {sel}")
                break

    if not loc:
        print("  ERROR: Password field not found!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "error_no_password")
        return

    print(f"  Found in frame: {getattr(frame, 'url', 'main')[:60]}")
    await loc.fill(job.password)
    print("  Filled: ****")
    await asyncio.sleep(1)

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "03_password_filled")
    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 4: Click Sign In
# =========================================================================
async def cmd_step4():
    pw, browser, page = await connect_to_browser()

    print("STEP 4: Click Sign In")
    print("  WARNING: This counts as a login attempt!")

    frame, btn = await find_button_in_frames(page, "Sign In")
    if not btn:
        frame, btn = await find_button_in_frames(page, "Sign in")
    if not btn:
        frame, btn = await find_button_in_frames(page, "Log In")

    if not btn:
        print("  ERROR: Sign In button not found!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "error_no_signin")
        return

    print(f"  Found button in frame: {getattr(frame, 'url', 'main')[:60]}")
    await btn.click(timeout=10000)
    print("  Clicked — waiting 10s for page transition...")
    await asyncio.sleep(10)

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "04_after_signin")

    page_text = await get_page_text(page)
    if "can't find that username" in page_text.lower() or "we don't recognize" in page_text.lower():
        print("\n  !!! CREDENTIALS STILL LOCKED !!!")
        print("  STOP — do NOT continue. Wait longer or reset credentials.")
    elif "choose" in page_text.lower() or "verify" in page_text.lower() or "code" in page_text.lower():
        print("  Looks like 2FA page — good!")
    else:
        print(f"  Page text (first 200): {page_text[:200]}")

    print(f"  URL: {page.url}")
    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 5: Handle 2FA dropdown (SMS path)
# =========================================================================
async def cmd_step5():
    job = get_chase_job()
    pw, browser, page = await connect_to_browser()

    print("STEP 5: Handle 2FA dropdown")

    # Find the Chase 2FA frame
    tfa_frame, already_have = await find_text_in_frames(page, "I already have a code")
    if not tfa_frame:
        print("  WARNING: 'I already have a code' not found — checking page anyway")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "05_no_2fa_text")
        # Try to find dropdown in any frame
        tfa_frame = page
    else:
        print(f"  2FA frame: {getattr(tfa_frame, 'url', 'main')[:80]}")

    # Try native <select> first
    native_select = tfa_frame.locator("select").first
    if await native_select.count():
        options = await native_select.locator("option").all_text_contents()
        print(f"  Native <select> options: {options}")
        for i, opt in enumerate(options):
            if "text" in opt.lower() or "sms" in opt.lower():
                await native_select.select_option(index=i)
                print(f"  Selected: '{opt}'")
                break
    else:
        # Custom dropdown
        choose_one = tfa_frame.get_by_text("Choose one")
        if await choose_one.count():
            print("  Clicking 'Choose one' dropdown...")
            await choose_one.first.click(timeout=5000)
            await asyncio.sleep(2)

            shot = await take_stable_screenshot(page)
            save_screenshot(shot, "05a_dropdown_open")

            # Scan options
            all_options = tfa_frame.locator(
                "[role='option'], li[class*='option'], [class*='dropdown'] li, [class*='select'] li"
            )
            opt_count = await all_options.count()
            print(f"  Found {opt_count} options:")

            in_text_section = False
            selected = False
            for i in range(opt_count):
                opt_text = (await all_options.nth(i).text_content() or "").strip()
                print(f"    [{i}] {opt_text}")
                if "text me" in opt_text.lower():
                    in_text_section = True
                    continue
                if "call me" in opt_text.lower() or "call us" in opt_text.lower():
                    in_text_section = False
                    continue
                if in_text_section and re.search(r'\d{3,4}', opt_text):
                    await all_options.nth(i).click(timeout=5000)
                    print(f"  => Clicked SMS option [{i}]: '{opt_text}'")
                    selected = True
                    break

            if not selected:
                for i in range(opt_count):
                    opt_text = (await all_options.nth(i).text_content() or "").strip()
                    if re.search(r'xxx.*\d{4}|\d{3}.*\d{4}', opt_text):
                        await all_options.nth(i).click(timeout=5000)
                        print(f"  => Fallback: clicked [{i}]: '{opt_text}'")
                        selected = True
                        break

            if not selected:
                print("  ERROR: No phone option found!")
                await browser.close()
                await pw.stop()
                return
        else:
            print("  ERROR: No 'Choose one' dropdown found!")
            shot = await take_stable_screenshot(page)
            save_screenshot(shot, "05_error_no_dropdown")
            await browser.close()
            await pw.stop()
            return

    await asyncio.sleep(1.5)
    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "05b_after_select")

    # Click Next to send SMS
    _, next_btn = await find_button_in_frames(page, "Next")
    if next_btn:
        await next_btn.click(timeout=5000)
        print("  Clicked Next — SMS should be sent")
        await asyncio.sleep(5)
    else:
        print("  WARNING: No Next button found")

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "05c_sms_sent")
    print("  DONE — check Dialpad for SMS code")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 6: Enter 2FA code + password
# =========================================================================
async def cmd_step6(code: str):
    job = get_chase_job()
    pw, browser, page = await connect_to_browser()

    print(f"STEP 6: Enter code '{code}' + password")

    # Find code input
    code_entered = False
    for frame in page.frames:
        for sel in ['input[name="identificationCode"]', 'input[type="tel"]',
                     'input[type="text"]:not([type="hidden"])']:
            loc = frame.locator(sel).first
            try:
                if await loc.count() > 0 and await loc.is_visible():
                    name_attr = await loc.get_attribute("name") or ""
                    placeholder = await loc.get_attribute("placeholder") or ""
                    combined = f"{name_attr} {placeholder}".lower()
                    if "password" in combined:
                        continue
                    await loc.fill("")
                    await loc.fill(code)
                    print(f"  Filled code in field: name='{name_attr}' placeholder='{placeholder}'")
                    code_entered = True
                    break
            except Exception:
                continue
        if code_entered:
            break

    if not code_entered:
        print("  ERROR: Code input field not found!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "06_error_no_code_field")
        await browser.close()
        await pw.stop()
        return

    # Password re-entry (Chase requires this)
    pw_entered = False
    for frame in page.frames:
        pw_field = frame.locator('input[type="password"]')
        try:
            if await pw_field.count() > 0:
                await pw_field.first.fill(job.password)
                print("  Filled password on verification page")
                pw_entered = True
                break
        except Exception:
            continue
    if not pw_entered:
        print("  NOTE: No password field found (may not be needed)")

    await asyncio.sleep(1)
    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "06_code_and_pw_filled")
    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 7: Submit verification
# =========================================================================
async def cmd_step7():
    pw, browser, page = await connect_to_browser()

    print("STEP 7: Submit verification code")

    _, btn = await find_button_in_frames(page, "Next")
    if not btn:
        _, btn = await find_button_in_frames(page, "Verify")
    if not btn:
        _, btn = await find_button_in_frames(page, "Submit")

    if not btn:
        print("  ERROR: No Next/Verify/Submit button found!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "07_error_no_button")
        await browser.close()
        await pw.stop()
        return

    await btn.click(timeout=10000)
    print("  Clicked — waiting 12s for page transition...")
    await asyncio.sleep(12)

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "07_after_verify")

    page_text = await get_page_text(page)
    url = page.url
    print(f"  URL: {url}")

    if "dashboard" in url.lower() or "account" in url.lower():
        print("\n  ===== CHASE LOGIN SUCCESS! =====")
    elif "verification" in page_text.lower() or "code" in page_text.lower():
        print("  WARNING: Still on verification — code may be rejected")
    else:
        print(f"  Page text (first 300): {page_text[:300]}")

    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# Take screenshot only
# =========================================================================
async def cmd_screenshot():
    pw, browser, page = await connect_to_browser()
    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "current_state")
    print(f"  URL: {page.url}")
    page_text = await get_page_text(page)
    print(f"  Page text (first 300): {page_text[:300]}")
    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 8: Navigate to Statements & documents
# =========================================================================
async def cmd_step8():
    pw, browser, page = await connect_to_browser()

    print("STEP 8: Navigate to Statements & documents")

    # Try clicking the "Statements & documents" tab in sub-nav
    clicked = False
    for text in ["Statements & documents", "Statements & Documents", "Statements"]:
        frame, loc = await find_text_in_frames(page, text)
        if loc:
            try:
                await loc.click(timeout=5000)
                print(f"  Clicked: '{text}'")
                clicked = True
                break
            except Exception as e:
                print(f"  Click failed for '{text}': {e}")

    if not clicked:
        # Fallback: try link selector patterns
        for sel in [
            'a:has-text("Statements")',
            '[data-testid*="statement"]',
            'a[href*="statement"]',
        ]:
            frame, loc = await find_in_frames(page, sel)
            if loc:
                try:
                    await loc.click(timeout=5000)
                    print(f"  Clicked via selector: {sel}")
                    clicked = True
                    break
                except Exception:
                    continue

    if not clicked:
        print("  ERROR: Could not find Statements link!")
        shot = await take_stable_screenshot(page)
        save_screenshot(shot, "08_error_no_statements")
        await browser.close()
        await pw.stop()
        return

    print("  Waiting for statements page to load...")
    await asyncio.sleep(5)

    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "08_statements_page")
    print(f"  URL: {page.url}")

    page_text = await get_page_text(page)
    print(f"  Page text (first 400): {page_text[:400]}")
    print("  DONE — review screenshot")

    await browser.close()
    await pw.stop()


# =========================================================================
# STEP 9: Download statement for a specific account (by last4)
# =========================================================================
async def cmd_step9(last4: str):
    pw, browser, page = await connect_to_browser()

    print(f"STEP 9: Download statement for account #{last4}")

    # Clear downloads dir first
    dl_dir = DOWNLOADS_DIR / "window-1"
    dl_dir.mkdir(parents=True, exist_ok=True)
    from utils.file_manager import clear_download_dir
    clear_download_dir(dl_dir)

    # Take a screenshot to see what we're working with
    shot = await take_stable_screenshot(page)
    save_screenshot(shot, f"09a_before_download_{last4}")

    page_text = await get_page_text(page)
    print(f"  Page text (first 600): {page_text[:600]}")
    print()

    # Strategy: Look for the target account section, then find its download link
    # Chase statements page typically shows account rows with download links

    # First, try to find any download/PDF links on the page
    found_download = False

    # Look for the account by last4 digits, then find nearby download link
    for frame in page.frames:
        try:
            # Find elements containing the last4
            acct_locs = frame.locator(f":text('{last4}')").all()
            acct_elements = await acct_locs if hasattr(acct_locs, '__await__') else acct_locs
            if not isinstance(acct_elements, list):
                acct_elements = await frame.locator(f":text('{last4}')").all()

            for acct_el in acct_elements:
                text = await acct_el.text_content() or ""
                print(f"  Found '{last4}' in: {text[:100]}")
        except Exception:
            continue

    # Try to find download links for the most recent statement (Feb 2026)
    # Chase may use PDF icons, "Download" text, or direct PDF links
    download_selectors = [
        f'a[href*="{last4}"][href*="pdf"]',
        f'a[href*="{last4}"][href*="download"]',
        'a[href*="pdf"]',
        'a:has-text("Download")',
        'a:has-text("PDF")',
        'button:has-text("Download")',
        '[aria-label*="Download"]',
        '[aria-label*="download"]',
        'a[href*="statement"]',
    ]

    for sel in download_selectors:
        for frame in page.frames:
            try:
                locs = await frame.locator(sel).all()
                if locs:
                    print(f"  Found {len(locs)} elements matching '{sel}':")
                    for i, loc in enumerate(locs[:5]):
                        href = await loc.get_attribute("href") or ""
                        text = (await loc.text_content() or "").strip()[:80]
                        print(f"    [{i}] text='{text}' href='{href[:80]}'")
            except Exception:
                continue

    print()
    print("  === Manual download mode ===")
    print("  If you see the right download link above, use 'step9click N' to click it.")
    print("  Otherwise, click the download link in the browser manually,")
    print("  then run 'step9wait' to detect the downloaded file.")
    print()
    print("  DONE — review screenshot and output above")

    await browser.close()
    await pw.stop()


async def cmd_step9click(index: str):
    """Click a specific download link by index (discovered in step9)."""
    pw, browser, page = await connect_to_browser()

    idx = int(index)
    print(f"STEP 9 (click): Clicking download link index {idx}")

    # Clear downloads dir
    dl_dir = DOWNLOADS_DIR / "window-1"
    dl_dir.mkdir(parents=True, exist_ok=True)
    from utils.file_manager import clear_download_dir
    clear_download_dir(dl_dir)

    # Collect all clickable download-like elements
    download_elements = []
    for frame in page.frames:
        for sel in ['a[href*="pdf"]', 'a:has-text("Download")', 'a:has-text("PDF")',
                    'button:has-text("Download")', '[aria-label*="Download"]',
                    'a[href*="statement"]', 'a[href*="download"]']:
            try:
                locs = await frame.locator(sel).all()
                for loc in locs:
                    download_elements.append((frame, loc, sel))
            except Exception:
                continue

    if idx >= len(download_elements):
        print(f"  ERROR: Index {idx} out of range (found {len(download_elements)} elements)")
        await browser.close()
        await pw.stop()
        return

    frame, loc, sel = download_elements[idx]
    text = (await loc.text_content() or "").strip()[:60]
    print(f"  Clicking: '{text}' (selector: {sel})")

    # Use expect_download to catch the file
    try:
        async with page.expect_download(timeout=30000) as dl_info:
            await loc.click(timeout=5000)
        download = await dl_info.value
        dest = dl_dir / download.suggested_filename
        await download.save_as(str(dest))
        print(f"  Downloaded: {dest.name} ({dest.stat().st_size // 1024}KB)")
    except Exception as e:
        print(f"  expect_download failed: {e}")
        print("  The file may have downloaded to the browser's default dir.")
        print("  Check the downloads/ folder or run 'step9wait'.")

    await asyncio.sleep(2)
    shot = await take_stable_screenshot(page)
    save_screenshot(shot, "09_after_download")

    await browser.close()
    await pw.stop()


async def cmd_step9wait(last4: str = ""):
    """Wait for a PDF to appear in the downloads dir (after manual click)."""
    from utils.file_manager import find_downloaded_pdf

    dl_dir = DOWNLOADS_DIR / "window-1"
    dl_dir.mkdir(parents=True, exist_ok=True)

    print(f"STEP 9 (wait): Watching {dl_dir} for PDF...")
    pdf = find_downloaded_pdf(dl_dir, timeout_seconds=60)
    if pdf:
        size_kb = pdf.stat().st_size // 1024
        print(f"  Found: {pdf.name} ({size_kb}KB)")
        # Basic PDF validation
        header = pdf.read_bytes()[:5]
        if header == b"%PDF-":
            print("  Valid PDF header confirmed")
        else:
            print(f"  WARNING: Not a valid PDF (header: {header})")
    else:
        print("  ERROR: No PDF found in 60 seconds")
        print(f"  Contents of {dl_dir}:")
        for f in dl_dir.iterdir():
            print(f"    {f.name} ({f.stat().st_size // 1024}KB)")


# =========================================================================
# STEP 10: Rename + organize downloaded PDF
# =========================================================================
async def cmd_step10(last4: str):
    from utils.file_manager import organize_statement, find_downloaded_pdf

    print(f"STEP 10: Rename + organize statement for #{last4}")

    dl_dir = DOWNLOADS_DIR / "window-1"
    pdf = find_downloaded_pdf(dl_dir, timeout_seconds=5)
    if not pdf:
        print(f"  ERROR: No PDF in {dl_dir}")
        print("  Run step9 first to download the statement.")
        return

    size_kb = pdf.stat().st_size // 1024
    print(f"  Source: {pdf.name} ({size_kb}KB)")

    # Validate PDF
    header = pdf.read_bytes()[:5]
    if header != b"%PDF-":
        print(f"  WARNING: Not a valid PDF (header: {header})")
        print("  Proceeding anyway...")

    job = get_chase_job()
    target_month = "2026-02"

    dest = organize_statement(
        source_path=pdf,
        client_name=job.client_name,
        bank_name="Chase Business",
        account_last4=last4,
        target_month=target_month,
    )

    print(f"  Organized: {dest}")
    print(f"  Relative: {dest.relative_to(OUTPUT_DIR.parent)}")
    print("  DONE")


# =========================================================================
# Save playbook
# =========================================================================
async def cmd_save_playbook():
    from orchestrator.playbook import Playbook, PlaybookStep, save_playbook

    print("Saving Chase Business playbook...")

    playbook = Playbook(
        bank_name="Chase Business",
        version=1,
        created="2026-03-23",
        last_verified="2026-03-23",
        success_count=1,
        consecutive_failures=0,
        login_url="https://secure.chase.com/web/auth/dashboard",
        login_steps=[
            PlaybookStep(
                name="find_username",
                action="type",
                description="username input field (iframe)",
                selector="#userId-input-field-input",
                field="username",
            ),
            PlaybookStep(
                name="find_password",
                action="type",
                description="password input field (iframe)",
                selector="#password-input-field-input",
                field="password",
            ),
            PlaybookStep(
                name="click_submit",
                action="click",
                description="Sign In button (iframe, get_by_role)",
                selector="",
            ),
        ],
        post_login_sequence=["2fa_selection", "2fa_code_entry", "dashboard"],
        statements_step=None,  # Will be updated after step8 discovery
    )

    save_playbook(playbook)
    print("  Playbook saved to playbooks/chase-business.json")
    print("  NOTE: statements_step is null — update after step8 discovery")


# =========================================================================
# Poll Dialpad for SMS
# =========================================================================
async def cmd_poll_dialpad():
    """Launch Dialpad browser and poll for SMS code."""
    from utils.browser_setup import launch_hardened_browser, wait_and_screenshot
    from orchestrator.tfa_interceptor import poll_dialpad_sms

    job = get_chase_job()
    print("Launching Dialpad browser...")
    ctx = await launch_hardened_browser("dialpad")
    dp_page = ctx.pages[0] if ctx.pages else await ctx.new_page()

    await dp_page.goto("https://dialpad.com/messages", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    shot = await take_stable_screenshot(dp_page)
    save_screenshot(shot, "dialpad_page")

    # Check if logged in
    dp_url = dp_page.url
    if "login" in dp_url.lower() or "auth" in dp_url.lower():
        print("  Dialpad needs login — check browser manually")
        print("  Keeping browser alive...")
        try:
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        return

    print("  Polling for SMS from Chase (120s timeout)...")
    result = await poll_dialpad_sms(dp_page, sender_hint=job.tfa_sender, timeout_s=120)
    if result:
        code, sender = result
        print(f"\n  SMS CODE: {code}")
        print(f"  Sender: {sender}")
    else:
        print("  No SMS code found within timeout")

    await ctx.close()


# =========================================================================
# Main dispatch
# =========================================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "launch":
        asyncio.run(cmd_launch())
    elif cmd == "step2":
        asyncio.run(cmd_step2())
    elif cmd == "step3":
        asyncio.run(cmd_step3())
    elif cmd == "step4":
        asyncio.run(cmd_step4())
    elif cmd == "step5":
        asyncio.run(cmd_step5())
    elif cmd == "step6":
        if len(sys.argv) < 3:
            print("Usage: python chase_manual_login.py step6 <2FA_CODE>")
            sys.exit(1)
        asyncio.run(cmd_step6(sys.argv[2]))
    elif cmd == "step7":
        asyncio.run(cmd_step7())
    elif cmd == "step8":
        asyncio.run(cmd_step8())
    elif cmd == "step9":
        if len(sys.argv) < 3:
            print("Usage: python chase_manual_login.py step9 <LAST4>")
            sys.exit(1)
        asyncio.run(cmd_step9(sys.argv[2]))
    elif cmd == "step9click":
        if len(sys.argv) < 3:
            print("Usage: python chase_manual_login.py step9click <INDEX>")
            sys.exit(1)
        asyncio.run(cmd_step9click(sys.argv[2]))
    elif cmd == "step9wait":
        last4 = sys.argv[2] if len(sys.argv) > 2 else ""
        asyncio.run(cmd_step9wait(last4))
    elif cmd == "step10":
        if len(sys.argv) < 3:
            print("Usage: python chase_manual_login.py step10 <LAST4>")
            sys.exit(1)
        asyncio.run(cmd_step10(sys.argv[2]))
    elif cmd == "save_playbook":
        asyncio.run(cmd_save_playbook())
    elif cmd == "screenshot":
        asyncio.run(cmd_screenshot())
    elif cmd == "dialpad":
        asyncio.run(cmd_poll_dialpad())
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
