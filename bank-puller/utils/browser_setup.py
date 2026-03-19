"""Hardened Playwright browser setup with anti-detection."""
import asyncio
import random
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page
from playwright_stealth import stealth_async
from config import (
    BROWSER_PROFILES_DIR, SCREENSHOT_RESOLUTION, BROWSER_LOCALE,
    BROWSER_TIMEZONE, HUMAN_TYPE_DELAY_MIN, HUMAN_TYPE_DELAY_MAX,
    HUMAN_CLICK_PAUSE_MIN, HUMAN_CLICK_PAUSE_MAX,
    HUMAN_ACTION_DELAY_MIN, HUMAN_ACTION_DELAY_MAX,
    DEBUG_SCREENSHOTS, DEBUG_SCREENSHOTS_DIR,
)


async def launch_hardened_browser(profile_name: str, download_dir: str | None = None) -> BrowserContext:
    """Launch a persistent Chromium browser with anti-detection measures.

    Args:
        profile_name: Subdirectory under browser-profiles/ (e.g., "bank-1", "dialpad")
        download_dir: Optional download directory path. If provided, downloads go there.
    """
    profile_dir = str(BROWSER_PROFILES_DIR / profile_name)

    pw = await async_playwright().start()

    launch_args = {
        "user_data_dir": profile_dir,
        "headless": False,  # NEVER headless -- triggers detection
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-infobars",
            "--no-first-run",
            "--no-default-browser-check",
        ],
        "viewport": SCREENSHOT_RESOLUTION,
        "locale": BROWSER_LOCALE,
        "timezone_id": BROWSER_TIMEZONE,
        "ignore_https_errors": False,
    }

    if download_dir:
        launch_args["accept_downloads"] = True

    context = await pw.chromium.launch_persistent_context(**launch_args)

    # Apply stealth patches
    await stealth_async(context)

    # Override navigator.webdriver on all pages (main detection vector)
    webdriver_script = """
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        delete window.__playwright;
        delete window.__pw_manual;
    """
    for page in context.pages:
        await page.add_init_script(webdriver_script)
    context.on("page", lambda page: page.add_init_script(webdriver_script))

    return context


async def human_type(page: Page, text: str):
    """Type with human-like delays between keystrokes."""
    for char in text:
        delay = random.randint(HUMAN_TYPE_DELAY_MIN, HUMAN_TYPE_DELAY_MAX)
        await page.keyboard.type(char, delay=delay)
    await asyncio.sleep(random.uniform(0.3, 0.8))


async def human_click(page: Page, x: int, y: int):
    """Move mouse with slight randomness then click."""
    from orchestrator.action_logger import log_action

    jitter_x = x + random.randint(-3, 3)
    jitter_y = y + random.randint(-3, 3)
    await page.mouse.move(jitter_x, jitter_y)
    await asyncio.sleep(random.uniform(0.1, 0.3))
    await page.mouse.click(x, y)
    await asyncio.sleep(random.uniform(HUMAN_CLICK_PAUSE_MIN, HUMAN_CLICK_PAUSE_MAX))

    log_action(type="click", coords={"x": x, "y": y})


async def human_delay(min_s: float | None = None, max_s: float | None = None):
    """Random delay between actions to mimic human pace."""
    mn = min_s if min_s is not None else HUMAN_ACTION_DELAY_MIN
    mx = max_s if max_s is not None else HUMAN_ACTION_DELAY_MAX
    await asyncio.sleep(random.uniform(mn, mx))


_debug_counter = 0

async def wait_and_screenshot(page: Page, reason: str = "") -> bytes:
    """Wait for page to stabilize, then take screenshot.

    Returns PNG bytes of the visible viewport.
    """
    global _debug_counter

    # Wait for network idle
    try:
        await page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass  # Some pages never reach networkidle (analytics, websockets)

    # Wait for DOM to stabilize
    await page.wait_for_timeout(500)

    screenshot = await page.screenshot(type="png", full_page=False)

    # Save debug screenshot if enabled
    if DEBUG_SCREENSHOTS and reason:
        _debug_counter += 1
        debug_path = DEBUG_SCREENSHOTS_DIR / f"{_debug_counter:04d}_{reason}.png"
        debug_path.parent.mkdir(parents=True, exist_ok=True)
        debug_path.write_bytes(screenshot)

    from orchestrator.action_logger import log_action
    log_action(type="screenshot", description=reason)

    return screenshot


def screenshots_identical(img1: bytes, img2: bytes, threshold: float = 0.95) -> bool:
    """Compare two screenshots. Returns True if they are >threshold similar.

    Uses Pillow for pixel comparison. Fast enough for our use case.
    """
    from PIL import Image
    import io

    a = Image.open(io.BytesIO(img1)).convert("L")  # Grayscale
    b = Image.open(io.BytesIO(img2)).convert("L")

    if a.size != b.size:
        return False

    pixels_a = list(a.getdata())
    pixels_b = list(b.getdata())
    total = len(pixels_a)

    matching = sum(1 for pa, pb in zip(pixels_a, pixels_b) if abs(pa - pb) < 10)
    similarity = matching / total

    return similarity >= threshold


async def monitor_new_pages(context: BrowserContext) -> list[Page]:
    """Track all new pages/tabs opened by bank sites. Returns the list that gets appended to."""
    new_pages: list[Page] = []
    context.on("page", lambda page: new_pages.append(page))
    return new_pages
