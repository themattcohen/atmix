"""Base class for all bank workflows.

Every bank module defines a subclass of BaseBankWorkflow that supplies
natural-language task strings for each automation phase, and optionally
overrides the Python-level verify_phase() hooks.

APIBankWorkflow is a mixin for banks that skip browser automation entirely
and call a REST API directly (currently Mercury).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from ..models import JobConfig, LoginGroup, Phase

logger = logging.getLogger("bank_puller.workflow")


# ---------------------------------------------------------------------------
# URL helper — extracted here so both base and subclasses can use it
# ---------------------------------------------------------------------------

async def _get_current_url(browser: Any) -> str:
    """Return the current page URL from a BrowserUse Browser instance.

    BrowserUse's Browser exposes the current page via browser.get_current_page()
    which returns a playwright Page object with a .url property.
    """
    try:
        page = await browser.get_current_page()
        return page.url
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Base workflow
# ---------------------------------------------------------------------------

class BaseBankWorkflow(ABC):
    """Interface that every bank workflow must implement.

    The orchestrator calls get_*_task() to obtain natural-language strings
    passed as the `task` parameter to BrowserUse Agents.  It calls
    verify_phase() after each agent run to confirm success at the Python level.

    Class attributes declared here must be set (or overridden) by subclasses.
    """

    # --- Required class-level config ---
    login_url: str
    allowed_domains: list[str]

    # --- Optional class-level config with defaults ---
    requires_prepare: bool = False
    requires_residential_proxy: bool = False
    is_api_based: bool = False

    # Per-phase max step budgets.  Subclasses may override individual values.
    max_steps_per_phase: dict[str, int] = {
        "login":      8,
        "post_login": 12,
        "nav":        8,
        "prepare":    6,
        "download":   10,
    }

    # --- Task string generators ---

    @abstractmethod
    def get_login_task(self, group: LoginGroup) -> str:
        """Return the BrowserUse task string for the LOGIN phase.

        The string must reference credentials as x_username and x_password
        so BrowserUse's sensitive_data substitution masks the real values.
        """
        ...

    @abstractmethod
    def get_post_login_task(self) -> str:
        """Return the task string for handling post-login state.

        This covers: 2FA prompts (SMS / TOTP / push), security questions,
        "trust this device" confirmations, promotional modals, and reaching
        the main dashboard.
        """
        ...

    @abstractmethod
    def get_nav_task(self) -> str:
        """Return the task string for navigating from the dashboard to statements."""
        ...

    def get_prepare_task(self, account: Any) -> str:
        """Return the task string for account/card selection.

        Only called when requires_prepare is True. Subclasses that set
        requires_prepare=True must override this method.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} sets requires_prepare=True "
            "but does not override get_prepare_task(). "
            "Either override the method or set requires_prepare=False."
        )

    @abstractmethod
    def get_download_task(self, target_month: str) -> str:
        """Return the task string for downloading the target month's statement PDF.

        target_month is a yyyy-mm string (e.g. '2026-03').
        """
        ...

    # --- Phase verification (Python-level assertions) ---

    async def verify_phase(
        self,
        phase: Phase,
        browser: Any,
        job: JobConfig,
    ) -> tuple[bool, dict[str, Any]]:
        """Confirm a phase succeeded using Python-level browser state checks.

        Returns (success: bool, metadata: dict).  metadata is stored in
        PhaseResult.metadata for debugging.

        Default implementations use URL pattern matching.  Bank subclasses
        may override individual _verify_*() methods for stricter checks.
        """
        if phase == Phase.LOGIN:
            return await self._verify_login(browser, job)
        if phase == Phase.POST_LOGIN:
            return await self._verify_post_login(browser, job)
        if phase == Phase.NAV:
            return await self._verify_nav(browser, job)
        if phase == Phase.PREPARE:
            return await self._verify_prepare(browser, job)
        if phase == Phase.DOWNLOAD:
            return await self._verify_download(browser, job)
        # Phase.VALIDATE is handled entirely by the orchestrator's Python code
        return True, {}

    async def _verify_login(
        self, browser: Any, job: JobConfig
    ) -> tuple[bool, dict]:
        """Confirm the browser navigated away from the login page."""
        url = await _get_current_url(browser)
        not_login = self.login_url not in url
        return not_login, {"url_after_login": url, "reason": "Still on login page"}

    async def _verify_post_login(
        self, browser: Any, job: JobConfig
    ) -> tuple[bool, dict]:
        """Confirm we reached the post-login state (dashboard or similar).

        Default is permissive — just capture the URL.  Subclasses may add
        specific URL or DOM checks.
        """
        url = await _get_current_url(browser)
        # We trust the agent reached the dashboard; subclasses add stricter checks
        return True, {"url_after_post_login": url}

    async def _verify_nav(
        self, browser: Any, job: JobConfig
    ) -> tuple[bool, dict]:
        """Confirm the page URL contains 'statement' or 'document'."""
        url = await _get_current_url(browser)
        ok = any(kw in url.lower() for kw in ("statement", "document"))
        return ok, {
            "url_after_nav": url,
            "reason": "URL does not contain 'statement' or 'document'",
        }

    async def _verify_prepare(
        self, browser: Any, job: JobConfig
    ) -> tuple[bool, dict]:
        """Default prepare verification — always passes.

        Subclasses with strict card-selection requirements should override
        to check that the correct account last4 appears on screen.
        """
        url = await _get_current_url(browser)
        return True, {"url_after_prepare": url}

    async def _verify_download(
        self, browser: Any, job: JobConfig
    ) -> tuple[bool, dict]:
        """Confirm the expected output file exists and is non-empty."""
        from ..skills.statements import _build_expected_filename

        expected = _build_expected_filename(job)
        path = job.output_dir / expected
        ok = path.exists() and path.stat().st_size > 0
        return ok, {
            "expected_file": str(path),
            "reason": "Output file missing or empty",
        }


# ---------------------------------------------------------------------------
# API-based workflow mixin
# ---------------------------------------------------------------------------

class APIBankWorkflow(BaseBankWorkflow):
    """Mixin for banks that bypass browser automation and call a REST API.

    Subclasses must implement run(job) and may leave the browser-phase
    task methods as stubs — the orchestrator will call run() instead
    when is_api_based is True.
    """

    is_api_based: bool = True

    # Stubs so the class is concrete w.r.t. abstractmethods.
    # These are never called by the orchestrator for API-based banks.

    def get_login_task(self, group: LoginGroup) -> str:
        return "(API-based — no browser login)"

    def get_post_login_task(self) -> str:
        return "(API-based — no post-login)"

    def get_nav_task(self) -> str:
        return "(API-based — no navigation)"

    def get_download_task(self, target_month: str) -> str:
        return f"(API-based — download {target_month} via REST)"

    async def run(self, job: JobConfig) -> None:
        """Execute the full download via REST API.

        Subclasses must override this.  The orchestrator calls this instead
        of the individual phase methods when is_api_based is True.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement run(job)"
        )
