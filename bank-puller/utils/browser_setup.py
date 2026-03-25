"""Hardened browser setup with anti-detection via Patchright."""
import asyncio
import random
from patchright.async_api import async_playwright, BrowserContext, Page
from utils.logger import log
from config import (
    BROWSER_PROFILES_DIR, BROWSER_LOCALE,
    BROWSER_TIMEZONE, BROWSER_CHANNEL, HUMAN_TYPE_DELAY_MIN, HUMAN_TYPE_DELAY_MAX,
    HUMAN_CLICK_PAUSE_MIN, HUMAN_CLICK_PAUSE_MAX,
    HUMAN_ACTION_DELAY_MIN, HUMAN_ACTION_DELAY_MAX,
    DEBUG_SCREENSHOTS, DEBUG_SCREENSHOTS_DIR,
    SCREENSHOT_RESOLUTION,
)


async def launch_hardened_browser(profile_name: str, download_dir: str | None = None) -> BrowserContext:
    """Launch a persistent Chromium browser with anti-detection measures.

    Args:
        profile_name: Subdirectory under browser-profiles/ (e.g., "bank-1", "dialpad")
        download_dir: Optional download directory path. If provided, downloads go there.
    """
    profile_dir = str(BROWSER_PROFILES_DIR / profile_name)

    using_system_chrome = bool(BROWSER_CHANNEL)
    log.info(f"Browser: {'system Chrome (channel={BROWSER_CHANNEL})' if using_system_chrome else 'bundled Chromium'} via Patchright")

    pw = await async_playwright().start()

    launch_args = {
        "user_data_dir": profile_dir,
        "headless": False,  # NEVER headless -- triggers detection
        "viewport": SCREENSHOT_RESOLUTION,  # must match SCREENSHOT_RESOLUTION for AI coord scaling
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-first-run",
            "--no-default-browser-check",
            "--enable-do-not-track",
        ],
        "locale": BROWSER_LOCALE,
        "timezone_id": BROWSER_TIMEZONE,
        "ignore_https_errors": False,
        "extra_http_headers": {"DNT": "1"},
    }

    if using_system_chrome:
        launch_args["channel"] = BROWSER_CHANNEL

    if download_dir:
        launch_args["accept_downloads"] = True
        launch_args["downloads_path"] = download_dir

    context = await pw.chromium.launch_persistent_context(**launch_args)

    # Runtime DNT verification — Citi silently rejects login when DNT is off
    page = context.pages[0] if context.pages else await context.new_page()
    dnt_value = await page.evaluate("() => navigator.doNotTrack")
    if dnt_value != "1":
        log.warning(f"DNT not applied by launch args (got {dnt_value!r}), forcing via context headers")
        await context.set_extra_http_headers({"DNT": "1"})
    else:
        log.info(f"DNT verified: {dnt_value!r}")

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


def _is_blank_page(screenshot_bytes: bytes, uniformity_threshold: float = 0.95) -> bool:
    """Detect blank/empty pages: white pages, grey spinners, solid backgrounds.

    Catches both pure-white SPAs (Chase) and grey-spinner loading pages (Eastwest).
    Uses pixel uniformity — if >95% of pixels are within a narrow band, the page
    has no real content rendered yet.
    """
    from PIL import Image
    import io
    import statistics

    img = Image.open(io.BytesIO(screenshot_bytes)).convert("L")  # grayscale
    pixels = list(img.getdata())

    # Method 1: bright-white detection (original — catches blank white pages)
    bright = sum(1 for p in pixels if p > 240)
    if (bright / len(pixels)) >= uniformity_threshold:
        return True

    # Method 2: uniformity detection — catches solid grey, single-color backgrounds
    # If >95% of pixels are within ±10 of the median, the page is effectively blank
    median_val = statistics.median(pixels)
    uniform = sum(1 for p in pixels if abs(p - median_val) < 10)
    if (uniform / len(pixels)) >= uniformity_threshold:
        return True

    # Method 3: file-size heuristic — a complex page at 960x540 PNG > 15KB
    # A spinner on a solid background is typically <12KB
    if len(screenshot_bytes) < 12_000:
        return True

    return False


_debug_counter = 0

async def _wait_for_dom_stable(page: Page, poll_ms: int = 300, max_wait_ms: int = 8000) -> None:
    """Wait until the DOM stops mutating (SPA hydration complete).

    Injects a MutationObserver that flips a flag on any child-list / subtree change.
    We poll every `poll_ms` — if no mutations fired since last poll, the DOM is stable.
    """
    await page.evaluate("""() => {
        window.__domMutated = true;  // start as "changed" so first poll always waits
        if (window.__domObserver) window.__domObserver.disconnect();
        window.__domObserver = new MutationObserver(() => { window.__domMutated = true; });
        window.__domObserver.observe(document.body || document.documentElement, {
            childList: true, subtree: true, attributes: false
        });
    }""")

    elapsed = 0
    while elapsed < max_wait_ms:
        await page.wait_for_timeout(poll_ms)
        elapsed += poll_ms
        mutated = await page.evaluate("() => { const m = window.__domMutated; window.__domMutated = false; return m; }")
        if not mutated:
            break  # DOM was quiet for one poll interval

    # Clean up observer
    await page.evaluate("() => { if (window.__domObserver) { window.__domObserver.disconnect(); delete window.__domObserver; } }")


async def wait_and_screenshot(page: Page, reason: str = "", await_render: bool = False) -> bytes:
    """Wait for page to stabilize, then take screenshot.

    Returns PNG bytes of the visible viewport.
    """
    global _debug_counter

    # Wait for DOM content loaded (fast, always fires)
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=5000)
    except Exception:
        pass

    # Wait for network idle (may not fire for SPA with WebSockets)
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass  # Some pages never reach networkidle (analytics, websockets)

    # Wait for DOM to stabilize (SPA hydration)
    try:
        await _wait_for_dom_stable(page, poll_ms=300, max_wait_ms=5000)
    except Exception:
        await page.wait_for_timeout(500)  # Fallback to simple wait

    screenshot = await page.screenshot(type="png", full_page=False)

    # Always check for blank/spinner pages when await_render is requested
    if await_render:
        backoffs = [2000, 3000, 5000, 8000, 12000]  # progressive waits (ms)
        for wait_ms in backoffs:
            if not _is_blank_page(screenshot):
                break
            log.debug(f"Blank page detected, waiting {wait_ms}ms for render...")
            await page.wait_for_timeout(wait_ms)
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
