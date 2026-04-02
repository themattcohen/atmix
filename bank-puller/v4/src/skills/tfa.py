"""
src/skills/tfa.py

Factory functions for 2FA/authentication skills.

Each public function returns an async callable bound to a JobConfig via closure.
The returned callable is registered directly on a BrowserUse Controller
by the build_skills factory in __init__.py.

None of these functions call controller.action() at module level.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Callable

import httpx
import pyotp
import rapidfuzz.fuzz as fuzz
import rapidfuzz.process as process
from browser_use.agent.views import ActionResult
from browser_use.browser.session import BrowserSession

from ..models import JobConfig, TFAMethod

logger = logging.getLogger("bank_puller.tfa")

# ---------------------------------------------------------------------------
# Public factory functions
# ---------------------------------------------------------------------------


def make_get_sms_code(job: JobConfig) -> Callable:
    """Returns an async function that polls the local Dialpad webhook sidecar
    for an SMS verification code, falling back to a suggestion to call
    request_human_input if the webhook server is unreachable or times out.

    Polling: GET http://localhost:8099/latest-code?bank=X&after=T
    Interval: 3 seconds
    Timeout:  90 seconds
    """

    async def get_sms_code(bank_name: str) -> ActionResult:
        """Poll Dialpad webhook/DOM for the latest SMS code.
        Call this when you see a verification code input field."""
        sent_after = time.time()
        deadline = sent_after + 90  # 90-second timeout

        while time.time() < deadline:
            code = await _poll_dialpad_webhook(bank_name, sent_after)
            if code:
                logger.info(
                    "SMS code retrieved for %s / %s",
                    job.account.client_name,
                    bank_name,
                )
                return ActionResult(extracted_content=code)
            await asyncio.sleep(3)

        logger.warning(
            "SMS code timeout for %s / %s after 90s",
            job.account.client_name,
            job.account.bank_name,
        )
        return ActionResult(
            error=(
                "No SMS code received within 90 seconds. "
                "The Dialpad webhook server may be unreachable, or no code was sent. "
                "Call request_human_input to ask the operator for the code."
            )
        )

    return get_sms_code


def make_generate_totp(job: JobConfig) -> Callable:
    """Returns an async function that generates a 6-digit TOTP code from
    the base32 secret stored in job.account.tfa_detail."""

    async def generate_totp(account_id: str) -> ActionResult:
        """Generate a 6-digit TOTP code from the stored secret.
        Call this when you see a TOTP/authenticator code input field."""
        secret = job.account.tfa_detail
        if not secret:
            logger.error(
                "No TOTP secret configured for %s / %s",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(
                error="No TOTP secret configured for this account"
            )

        try:
            code = pyotp.TOTP(secret).now()
        except Exception as exc:
            logger.error(
                "TOTP generation failed for %s: %s",
                job.account.client_name,
                exc,
            )
            return ActionResult(error=f"TOTP generation failed: {exc}")

        logger.debug(
            "TOTP code generated for %s / %s",
            job.account.client_name,
            job.account.bank_name,
        )
        return ActionResult(extracted_content=code)

    return generate_totp


def make_wait_for_push(job: JobConfig) -> Callable:
    """Returns an async function that polls for a page URL change or a
    recognizable dashboard element, signalling that the push was approved.

    Poll interval: 2 seconds
    Timeout:       120 seconds
    """

    async def wait_for_push(browser: BrowserSession) -> ActionResult:
        """Wait up to 2 minutes for push notification approval.
        Call this when the page says 'Waiting for approval' or similar."""
        deadline = asyncio.get_event_loop().time() + 120
        initial_url = await _get_current_url(browser)

        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(2)

            current_url = await _get_current_url(browser)
            if current_url != initial_url:
                logger.info(
                    "Push approved (URL changed) for %s / %s",
                    job.account.client_name,
                    job.account.bank_name,
                )
                return ActionResult(
                    extracted_content="Push approved — page transitioned"
                )

            if await _dashboard_element_visible(browser):
                logger.info(
                    "Push approved (dashboard visible) for %s / %s",
                    job.account.client_name,
                    job.account.bank_name,
                )
                return ActionResult(
                    extracted_content="Push approved — dashboard visible"
                )

        # Check for an SMS/code fallback option before giving up
        if await _sms_fallback_available(browser):
            logger.warning(
                "Push timeout for %s / %s — SMS fallback available",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(
                extracted_content="PUSH_TIMEOUT_FALLBACK_AVAILABLE"
            )

        logger.error(
            "Push notification not approved within 120s for %s / %s",
            job.account.client_name,
            job.account.bank_name,
        )
        return ActionResult(
            error="Push notification not approved within 120 seconds"
        )

    return wait_for_push


def make_answer_security_question(job: JobConfig) -> Callable:
    """Returns an async function that fuzzy-matches the on-screen security
    question text against the stored Q&A pairs using rapidfuzz.

    Scorer:    fuzz.token_sort_ratio (order-insensitive)
    Threshold: 75 (below this, falls back to request_human_input)
    """

    async def answer_security_question(question_text: str) -> ActionResult:
        """Fuzzy-match the security question against stored Q&A pairs.
        Call this when you see a security question. Pass the exact question text."""
        qa_pairs = job.account.security_questions
        if not qa_pairs:
            logger.warning(
                "No security questions configured for %s / %s",
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(
                error=(
                    "No security questions configured for this account. "
                    "Call request_human_input instead."
                )
            )

        questions = [q["question"] for q in qa_pairs]
        match = process.extractOne(
            question_text,
            questions,
            scorer=fuzz.token_sort_ratio,
        )

        if match and match[1] >= 75:
            matched_question = match[0]
            matched_score = match[1]
            answer = next(
                q["answer"] for q in qa_pairs if q["question"] == matched_question
            )
            logger.info(
                "Security question matched (score=%d) for %s / %s: %r -> %r",
                matched_score,
                job.account.client_name,
                job.account.bank_name,
                question_text[:60],
                matched_question[:60],
            )
            return ActionResult(extracted_content=answer)

        best_score = match[1] if match else 0
        logger.warning(
            "Security question not matched (best score=%d) for %s / %s: %r",
            best_score,
            job.account.client_name,
            job.account.bank_name,
            question_text[:80],
        )
        return ActionResult(
            error=(
                f"No security question match (best score {best_score}). "
                "Call request_human_input instead."
            )
        )

    return answer_security_question


def make_request_human_input(job: JobConfig) -> Callable:
    """Returns an async function that:
      1. Sends a Slack webhook notification (swallows errors if no webhook configured).
      2. Blocks on CLI input via run_in_executor so the event loop stays live.
      3. Times out after 5 minutes and returns an error ActionResult.
    """

    async def request_human_input(prompt: str) -> ActionResult:
        """Pause automation and notify the operator via Slack + CLI.
        Call this when you encounter an unrecognized 2FA prompt or are stuck."""
        bank = job.account.bank_name
        client = job.account.client_name
        full_prompt = f"MANUAL INPUT REQUIRED: {client} / {bank} — {prompt}"

        # Fire-and-forget Slack notification; swallow all errors
        await _send_slack_notification(full_prompt, job)

        # CLI prompt — blocking, run in thread pool to avoid blocking event loop
        print(f"\n{'=' * 60}")
        print(full_prompt)
        print(f"{'=' * 60}")

        loop = asyncio.get_event_loop()
        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(None, input, "Enter code/response: "),
                timeout=300,  # 5 minutes
            )
            logger.info(
                "Human input received for %s / %s",
                client,
                bank,
            )
            return ActionResult(extracted_content=response.strip())
        except asyncio.TimeoutError:
            logger.error(
                "Human input timed out (5 min) for %s / %s",
                client,
                bank,
            )
            return ActionResult(error="Human input timeout (5 minutes)")

    return request_human_input


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _poll_dialpad_webhook(bank_name: str, sent_after: float) -> str | None:
    """Check the local Dialpad webhook sidecar for a code newer than sent_after.

    The sidecar is a lightweight FastAPI app running on localhost:8099 that
    receives SMS webhooks pushed by Dialpad. This function calls:

        GET http://localhost:8099/latest-code?bank={bank_name}&after={sent_after}

    The server is expected to respond with JSON:
        {"code": "123456"}   -- when a code is available
        {"code": null}       -- when no code has arrived yet

    Returns the code string (digits only) or None on any error or no code.
    """
    url = f"http://localhost:8099/latest-code"
    params = {"bank": bank_name, "after": str(sent_after)}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            code = data.get("code")
            if code and isinstance(code, str) and code.strip():
                return code.strip()
            return None
    except httpx.ConnectError:
        # Sidecar not running — caller will eventually surface this via the
        # 90-second timeout and suggest request_human_input
        logger.debug("Dialpad webhook sidecar not reachable at localhost:8099")
        return None
    except httpx.HTTPStatusError as exc:
        logger.debug("Dialpad webhook sidecar returned HTTP %s", exc.response.status_code)
        return None
    except Exception as exc:
        logger.debug("Dialpad webhook poll error: %s", exc)
        return None


async def _get_current_url(browser: BrowserSession) -> str:
    """Return the current page URL from the active BrowserSession page."""
    try:
        page = await browser.get_current_page()
        return page.url
    except Exception as exc:
        logger.debug("Could not get current URL: %s", exc)
        return ""


async def _dashboard_element_visible(browser: BrowserSession) -> bool:
    """Return True if a recognizable post-login dashboard element is visible.

    Checks for common patterns across major bank portals:
    - Elements with role="main" or id="main-content"
    - Navigation elements typical of an authenticated session
    - Common dashboard text indicators
    """
    try:
        page = await browser.get_current_page()
        # Try a broad set of selectors that indicate a logged-in dashboard
        dashboard_selectors = [
            "[data-testid='dashboard']",
            "#dashboard",
            "#main-content",
            "[aria-label='Account summary']",
            "[aria-label='Accounts']",
            "nav[aria-label='Main navigation']",
            ".account-summary",
            ".account-list",
            "[class*='dashboard']",
            "[id*='dashboard']",
        ]
        for selector in dashboard_selectors:
            try:
                element = await page.query_selector(selector)
                if element and await element.is_visible():
                    return True
            except Exception:
                continue
        return False
    except Exception as exc:
        logger.debug("Dashboard visibility check failed: %s", exc)
        return False


async def _sms_fallback_available(browser: BrowserSession) -> bool:
    """Return True if the current page offers a 'send code via SMS' fallback option.

    Looks for common text patterns found on push-notification screens
    across major banks (Chase, BoA, Citi, Wells Fargo, etc.).
    """
    try:
        page = await browser.get_current_page()
        sms_fallback_texts = [
            "text me",
            "send a text",
            "get a code",
            "use a different method",
            "try another way",
            "text message",
            "sms code",
            "send code",
        ]
        page_text = await page.evaluate("() => document.body.innerText.toLowerCase()")
        return any(phrase in page_text for phrase in sms_fallback_texts)
    except Exception as exc:
        logger.debug("SMS fallback check failed: %s", exc)
        return False


async def _send_slack_notification(message: str, job: JobConfig) -> None:
    """Send a Slack webhook notification. Swallows all errors — operator
    may not have Slack configured, and we never want to block on this.

    The webhook URL is read from the SLACK_WEBHOOK_URL environment variable.
    If unset, the function returns immediately without sending anything.
    """
    import os

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not webhook_url:
        logger.debug("SLACK_WEBHOOK_URL not set; skipping Slack notification")
        return

    payload = {
        "text": message,
        "username": "Bank Puller",
        "icon_emoji": ":bank:",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code != 200:
                logger.debug(
                    "Slack webhook returned HTTP %s: %s",
                    resp.status_code,
                    resp.text[:200],
                )
    except Exception as exc:
        # Never raise — Slack notification is best-effort
        logger.debug("Slack notification failed (swallowed): %s", exc)
