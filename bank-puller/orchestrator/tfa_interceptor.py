"""2FA interceptor — Dialpad browser, Gmail API, TOTP, push notification support."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import TYPE_CHECKING

import pyotp

from ai_skills.dialpad import skill_read_2fa_code
from utils.browser_setup import wait_and_screenshot, screenshots_identical
from utils.logger import log

if TYPE_CHECKING:
    from patchright.async_api import Page


async def get_totp_code(secret: str) -> str:
    """Generate a TOTP code immediately from a shared secret."""
    return pyotp.TOTP(secret).now()


async def poll_dialpad_sms(
    dialpad_page: Page,
    sender_hint: str = "",
    timeout_s: float = 120,
    poll_interval: float = 5,
    skip_codes: set[str] | None = None,
) -> tuple[str, str] | None:
    """Poll Dialpad messaging window for a new 2FA code.

    Args:
        dialpad_page: Playwright page for the Dialpad messages window.
        sender_hint: Known sender short-code (e.g. ``"72166"``).
        timeout_s: How long to poll before giving up.
        poll_interval: Seconds between screenshots.
        skip_codes: Set of previously-used codes to ignore (prevents re-reading stale messages).

    Returns:
        Tuple of ``(code, sender_id)`` on success, or ``None`` on timeout.
    """
    start = asyncio.get_event_loop().time()
    prev_screenshot: bytes | None = None
    codes_to_skip = skip_codes or set()

    # Take a baseline screenshot BEFORE polling starts.
    # We require the page to CHANGE from this baseline before reading a code,
    # which prevents reading old codes from previous runs.
    baseline_screenshot = await wait_and_screenshot(dialpad_page, "dialpad_baseline")

    first_check = True
    baseline_changed = False
    force_read_done = False
    while asyncio.get_event_loop().time() - start < timeout_s:
        screenshot = await wait_and_screenshot(dialpad_page, "dialpad_poll")

        # On first check, abort immediately if page is blank
        if first_check:
            first_check = False
            from utils.browser_setup import _is_blank_page
            if _is_blank_page(screenshot):
                log.warning("Dialpad page is blank — aborting SMS poll")
                return None

        # Check if the page has changed from the baseline (new SMS arrived)
        if not baseline_changed:
            elapsed = asyncio.get_event_loop().time() - start
            if screenshots_identical(baseline_screenshot, screenshot, threshold=0.99):
                # After 30s with no change, force one AI read in case the SMS
                # arrived before the baseline was captured
                if elapsed < 30:
                    log.debug("Dialpad unchanged from baseline, waiting...")
                    await asyncio.sleep(poll_interval)
                    continue
                elif not force_read_done:
                    log.info(
                        "Dialpad: 30s without change — forcing AI read "
                        "(SMS may have arrived before baseline)"
                    )
                    force_read_done = True
                    # Fall through to AI read below
                else:
                    await asyncio.sleep(poll_interval)
                    continue
            else:
                baseline_changed = True
                log.info("Dialpad page changed from baseline — new SMS likely arrived")

        # Skip AI call if the page hasn't changed since last poll
        if prev_screenshot is not None and screenshots_identical(prev_screenshot, screenshot, threshold=0.99):
            log.debug("Dialpad unchanged, skipping AI call")
            await asyncio.sleep(poll_interval)
            continue
        prev_screenshot = screenshot

        result = skill_read_2fa_code(screenshot, sender_hint, skip_codes=codes_to_skip)

        # Log raw AI response for debugging OCR misreads
        if result.raw_response:
            log.debug(f"Dialpad AI raw response: {result.raw_response}")

        if result.action == "found" and result.text:
            # Log pre- and post-extraction for debugging
            digits = re.sub(r"\D", "", result.text)
            safe_text = result.text.encode("ascii", errors="replace").decode("ascii")
            log.info(f"Dialpad AI returned text='{safe_text}' -> digits='{digits}' ({len(digits)} digits)")
            if 6 <= len(digits) <= 8:
                # Skip previously-used codes
                if digits in codes_to_skip:
                    log.debug(f"Skipping stale code {digits} (already used)")
                    await asyncio.sleep(poll_interval)
                    continue
                sender = result.raw_response.get("sender", "") if result.raw_response else ""
                log.info(f"SMS 2FA code received ({len(digits)} digits) from sender '{sender}'")
                return (digits, sender)
            safe_text = result.text.encode("ascii", errors="replace").decode("ascii")
            log.warning(f"Extracted text '{safe_text}' -> digits '{digits}' -- unexpected length, retrying")

        await asyncio.sleep(poll_interval)

    log.warning(f"Dialpad SMS poll timed out after {timeout_s}s")
    return None


async def poll_gmail_for_code(
    bank_domain: str,
    trigger_time: datetime | None = None,
    timeout_s: float = 120,
    poll_interval: float = 10,
) -> str | None:
    """Poll Gmail API for a 2FA email from the bank.

    Requires ``GOOGLE_CLIENT_ID`` / ``GOOGLE_CLIENT_SECRET`` in ``.env``
    and a valid OAuth token.  Returns ``None`` if Gmail is not configured.

    Args:
        bank_domain: Email domain to filter (e.g. ``"chase.com"``).
        trigger_time: Only consider messages after this timestamp.
        timeout_s: How long to poll.
        poll_interval: Seconds between API calls.
    """
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        log.warning("Gmail API dependencies not available — skipping email 2FA")
        return None

    # Placeholder — full implementation requires OAuth token management
    log.warning("Gmail 2FA polling not yet configured — code must be entered manually")
    return None


async def wait_for_push_approval(
    page: Page,
    timeout_s: float = 180,
    poll_interval: float = 5,
) -> bool:
    """Wait for a push 2FA approval by detecting page change.

    Args:
        page: The bank page waiting for approval.
        timeout_s: Max wait time (default 3 minutes).
        poll_interval: Seconds between checks.

    Returns:
        ``True`` if the page changed (approval detected), ``False`` on timeout.
    """
    from utils.browser_setup import screenshots_identical

    screenshot_before = await wait_and_screenshot(page, "push_wait_start")
    start = asyncio.get_event_loop().time()

    while asyncio.get_event_loop().time() - start < timeout_s:
        await asyncio.sleep(poll_interval)
        screenshot_now = await wait_and_screenshot(page, "push_wait_check")
        if not screenshots_identical(screenshot_before, screenshot_now, threshold=0.9):
            log.info("Push 2FA — page changed, approval detected")
            return True

    log.warning(f"Push 2FA approval timed out after {timeout_s}s")
    return False
