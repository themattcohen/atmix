"""
src/skills/navigation.py

Factory functions for browser navigation and observation skills.

Each public function returns an async callable bound to a JobConfig via closure.
The returned callable is registered directly on a BrowserUse Controller
by the build_skills factory in __init__.py.

None of these functions call controller.action() at module level.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from browser_use.agent.views import ActionResult
from browser_use.browser.session import BrowserSession

from ..models import JobConfig

logger = logging.getLogger("bank_puller.navigation")

# ---------------------------------------------------------------------------
# Public factory functions
# ---------------------------------------------------------------------------


def make_dismiss_modal(job: JobConfig) -> Callable:
    """Returns an async function that tries three strategies in order to
    close a blocking overlay:

      1. Click a close/dismiss button by visible text label
      2. Press the Escape key
      3. Click the backdrop area outside the modal

    Waits 0.8 seconds after a successful dismissal for animations to settle.

    Returns ActionResult with:
        extracted_content = "Modal dismissed"   on any strategy succeeding
        error             = "..."               if all strategies fail
    """

    async def dismiss_modal(browser: BrowserSession) -> ActionResult:
        """Try to close any blocking overlay (cookie consent, session warning, promo).
        Call this when a modal or popup is blocking your task."""

        # Strategy 1: click a labeled close/dismiss button
        if await _click_by_text(
            browser,
            [
                "Close",
                "Dismiss",
                "Got it",
                "Accept",
                "No thanks",
                "Accept All Cookies",
                "Accept all cookies",
                "I Accept",
                "OK",
                "Done",
                "Cancel",
                "Not now",
                "Skip",
                "X",
            ],
        ):
            await asyncio.sleep(0.8)
            logger.debug(
                "Modal dismissed via button text for %s / %s",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(extracted_content="Modal dismissed")

        # Strategy 2: Escape key
        if await _click_escape(browser):
            await asyncio.sleep(0.8)
            logger.debug(
                "Modal dismissed via Escape key for %s / %s",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(extracted_content="Modal dismissed")

        # Strategy 3: click the backdrop
        if await _click_overlay_backdrop(browser):
            await asyncio.sleep(0.8)
            logger.debug(
                "Modal dismissed via backdrop click for %s / %s",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(extracted_content="Modal dismissed")

        logger.warning(
            "Could not dismiss modal for %s / %s",
            job.account.client_name,
            job.account.bank_name,
        )
        return ActionResult(
            error="Could not find a way to dismiss the modal"
        )

    return dismiss_modal


def make_report_observation(job: JobConfig) -> Callable:
    """Returns an async function that logs an observation to:
      - The Python logger at WARNING level (always visible in console output)
      - A JSONL file at job.output_dir / "observations.log" (structured, for debugging)

    Returns ActionResult with:
        extracted_content = "Logged"
    """

    async def report_observation(observation: str) -> ActionResult:
        """Log an observation about the page state for debugging.
        Call this when something unexpected appears."""
        bank = job.account.bank_name
        client = job.account.client_name

        logger.warning(
            "[OBSERVATION] %s / %s: %s",
            client,
            bank,
            observation,
        )
        _append_observation_log(job, observation)
        return ActionResult(extracted_content="Logged")

    return report_observation


def make_get_account_info(job: JobConfig) -> Callable:
    """Returns an async function that returns identifying information about
    the current account so the agent can select the correct account when
    a bank shows multiple accounts on one dashboard.

    Returns ActionResult with a comma-joined string:
        "Account ending in XXXX, Client: Name[, Notes: ...]"
    """

    async def get_account_info() -> ActionResult:
        """Return the account last4, client name, and notes needed
        to select the correct account when a bank shows multiple accounts."""
        account = job.account
        parts = [
            f"Account ending in {account.account_last4}",
            f"Client: {account.client_name}",
        ]
        if account.notes:
            parts.append(f"Notes: {account.notes}")

        info = ", ".join(parts)
        logger.debug(
            "Account info requested: %s",
            info,
        )
        return ActionResult(extracted_content=info)

    return get_account_info


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _click_by_text(browser: BrowserSession, texts: list[str]) -> bool:
    """Try clicking any visible button or link matching one of the given
    text labels (case-insensitive, stripped).

    Tries exact text match first using a CSS :has-text approach, then
    falls back to evaluating all interactive elements for partial matches.

    Returns True if a click was attempted on a visible element, False otherwise.
    """
    try:
        page = await browser.get_current_page()

        for label in texts:
            # Build a broad set of selectors for this label
            escaped = label.replace("'", "\\'")
            selectors = [
                f"button:has-text('{escaped}')",
                f"[role='button']:has-text('{escaped}')",
                f"a:has-text('{escaped}')",
                f"[aria-label='{escaped}']",
                f"[title='{escaped}']",
            ]
            for selector in selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            await element.click()
                            return True
                except Exception:
                    continue

        # Fallback: evaluate all buttons/links in JS for a case-insensitive match
        lower_texts = [t.lower().strip() for t in texts]
        clicked = await page.evaluate(
            """
            (targetTexts) => {
                const interactive = Array.from(
                    document.querySelectorAll(
                        'button, [role="button"], a, [role="link"], input[type="button"], input[type="submit"]'
                    )
                );
                for (const el of interactive) {
                    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
                    if (targetTexts.some(t => text === t || text.includes(t))) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            el.click();
                            return true;
                        }
                    }
                }
                return false;
            }
            """,
            lower_texts,
        )
        return bool(clicked)

    except Exception as exc:
        logger.debug("_click_by_text failed: %s", exc)
        return False


async def _click_escape(browser: BrowserSession) -> bool:
    """Press the Escape key on the current page.

    Returns True if the keypress was sent without error, False on failure.
    Note: Escape does not guarantee the modal closes — the caller checks
    by trying other strategies if this one does not succeed.
    """
    try:
        page = await browser.get_current_page()
        await page.keyboard.press("Escape")
        return True
    except Exception as exc:
        logger.debug("_click_escape failed: %s", exc)
        return False


async def _click_overlay_backdrop(browser: BrowserSession) -> bool:
    """Click at a position outside any centered modal to trigger backdrop dismissal.

    Strategy: click at the top-left corner of the viewport (10px, 10px),
    which is typically outside any centered modal dialog but within the
    backdrop overlay on most bank sites. Also tries clicking the backdrop
    element directly if detectable via common CSS classes.

    Returns True if a click was sent, False on error.
    """
    try:
        page = await browser.get_current_page()

        # Try clicking a known backdrop/overlay element first
        backdrop_selectors = [
            "[class*='backdrop']",
            "[class*='overlay']",
            "[class*='modal-bg']",
            "[class*='modal-backdrop']",
            "[class*='dialog-overlay']",
            "[aria-modal='true'] ~ *",
        ]
        for selector in backdrop_selectors:
            try:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    if await element.is_visible():
                        await element.click(force=True)
                        return True
            except Exception:
                continue

        # Fallback: click a corner of the viewport
        viewport = page.viewport_size
        if viewport:
            # Click top-left area — outside most centered modals
            await page.mouse.click(10, 10)
            return True

        return False

    except Exception as exc:
        logger.debug("_click_overlay_backdrop failed: %s", exc)
        return False


def _append_observation_log(job: JobConfig, observation: str) -> None:
    """Append a structured JSON line to job.output_dir/observations.log.

    Each line is a self-contained JSON object with timestamp, run_id,
    bank, client, and the observation text. The file is created if it
    does not exist.

    Swallows all errors — observation logging must never block the agent.
    """
    try:
        job.output_dir.mkdir(parents=True, exist_ok=True)
        log_path: Path = job.output_dir / "observations.log"

        entry = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "run_id": job.run_id,
            "bank": job.account.bank_name,
            "client": job.account.client_name,
            "account_last4": job.account.account_last4,
            "observation": observation,
        }

        with log_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")

    except Exception as exc:
        # Never raise from a logging helper — swallow silently
        logger.debug("_append_observation_log failed (swallowed): %s", exc)
