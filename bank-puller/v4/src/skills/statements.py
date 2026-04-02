"""
src/skills/statements.py

Factory functions for statement download-related skills.

Each public function returns an async callable bound to a JobConfig via closure.
The returned callable is registered directly on a BrowserUse Controller
by the build_skills factory in __init__.py.

None of these functions call controller.action() at module level.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Callable

from browser_use.agent.views import ActionResult
from browser_use.browser.session import BrowserSession

from ..models import JobConfig

logger = logging.getLogger("bank_puller.statements")

# ---------------------------------------------------------------------------
# Public factory functions
# ---------------------------------------------------------------------------


def make_check_already_downloaded(job: JobConfig) -> Callable:
    """Returns an async function that checks whether this month's statement
    has already been saved to the output directory.

    Returns ActionResult with:
        extracted_content = "EXISTS: <full path>"   if found
        extracted_content = "NOT_FOUND"             if not found
    """

    async def check_already_downloaded() -> ActionResult:
        """Check the output directory for an existing file matching this account+month.
        Call this before attempting a download."""
        expected = _build_expected_filename(job)
        target = job.output_dir / expected

        if target.exists():
            logger.info(
                "Statement already downloaded: %s",
                target,
            )
            return ActionResult(extracted_content=f"EXISTS: {target}")

        logger.debug(
            "Statement not yet downloaded: %s",
            target,
        )
        return ActionResult(extracted_content="NOT_FOUND")

    return check_already_downloaded


def make_save_downloaded_pdf(job: JobConfig) -> Callable:
    """Returns an async function that:
      1. Finds the most recently modified file in job.download_dir
         that was written within the last 60 seconds (excludes .crdownload partials).
      2. Renames it to the canonical filename and moves it to job.output_dir.

    Returns ActionResult with:
        extracted_content = "<full destination path>"   on success
        error             = "..."                       if no recent file found
    """

    async def save_downloaded_pdf(browser: BrowserSession) -> ActionResult:
        """Move the most recently downloaded file to the output directory
        with naming: ClientName__BankName #xxxx yyyy-mm.pdf
        Call this after a PDF download completes."""
        recent = _find_recent_download(job.download_dir, max_age_seconds=60)
        if not recent:
            logger.warning(
                "No recent download found in %s for %s / %s",
                job.download_dir,
                job.account.client_name,
                job.account.bank_name,
            )
            return ActionResult(
                error=(
                    f"No recent download found in download directory ({job.download_dir}). "
                    "The file may still be downloading, or the download may have failed."
                )
            )

        dest_name = _build_expected_filename(job)
        job.output_dir.mkdir(parents=True, exist_ok=True)
        dest = job.output_dir / dest_name

        try:
            recent.rename(dest)
        except OSError as exc:
            logger.error(
                "Failed to move %s -> %s: %s",
                recent,
                dest,
                exc,
            )
            return ActionResult(
                error=f"Failed to move downloaded file to output directory: {exc}"
            )

        logger.info(
            "Statement saved: %s -> %s",
            recent.name,
            dest,
        )
        return ActionResult(extracted_content=str(dest))

    return save_downloaded_pdf


def make_validate_pdf(job: JobConfig) -> Callable:
    """Returns an async function that validates the saved output file is a
    real PDF (magic bytes check) and within an acceptable size range.

    Size range: 10 KB – 50 MB
    Magic bytes: first 4 bytes must equal b"%PDF"

    Returns ActionResult with:
        extracted_content = "VALID: <size>KB"   on success
        error             = "..."               on any validation failure
    """

    async def validate_pdf(browser: BrowserSession) -> ActionResult:
        """Check that the most recent download is an actual PDF, not an HTML error page.
        Call this after saving a statement."""
        expected = _build_expected_filename(job)
        target = job.output_dir / expected

        if not target.exists():
            logger.error(
                "Expected output file not found: %s",
                target,
            )
            return ActionResult(
                error=f"Expected output file not found: {target}"
            )

        file_size = target.stat().st_size

        if file_size < 10_000:  # < 10 KB
            logger.error(
                "File too small (%d bytes): %s",
                file_size,
                target,
            )
            return ActionResult(
                error=(
                    f"File too small ({file_size} bytes) — likely an error page, "
                    "not a real PDF statement."
                )
            )

        if file_size > 50_000_000:  # > 50 MB
            logger.error(
                "File too large (%d bytes): %s",
                file_size,
                target,
            )
            return ActionResult(
                error=(
                    f"File too large ({file_size} bytes) — suspicious, "
                    "expected bank statements to be under 50 MB."
                )
            )

        try:
            magic = target.read_bytes()[:4]
        except OSError as exc:
            logger.error("Could not read file bytes for validation: %s", exc)
            return ActionResult(error=f"Could not read file for validation: {exc}")

        if magic != b"%PDF":
            logger.error(
                "Not a PDF (magic=%r): %s",
                magic,
                target,
            )
            return ActionResult(
                error=(
                    f"Not a PDF (magic bytes: {magic!r}). "
                    "File may be an HTML error page or a corrupt download."
                )
            )

        size_kb = file_size // 1024
        logger.info(
            "PDF validated: %s (%d KB)",
            target.name,
            size_kb,
        )
        return ActionResult(extracted_content=f"VALID: {size_kb}KB")

    return validate_pdf


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_expected_filename(job: JobConfig) -> str:
    """Canonical filename: ClientName__BankName #xxxx yyyy-mm.pdf

    Rules:
    - client_name: spaces replaced with underscores, other characters preserved
    - bank_name:   title-cased
    - account_last4: stored as-is (4 digits)
    - target_month:  yyyy-mm

    Examples:
        Bossi Sportswear / citibank / 8035 / 2026-03
        -> "Bossi_Sportswear__Citibank #8035 2026-03.pdf"

        J&M Aircraft / chase / 1234 / 2026-03
        -> "J&M_Aircraft__Chase #1234 2026-03.pdf"
    """
    client = job.account.client_name.replace(" ", "_")
    bank = job.account.bank_name.title()
    last4 = job.account.account_last4
    month = job.target_month
    return f"{client}__{bank} #{last4} {month}.pdf"


def _find_recent_download(download_dir: Path, max_age_seconds: int = 60) -> Path | None:
    """Return the most recently modified file in download_dir that was
    modified within the last max_age_seconds seconds.

    Excludes:
    - .crdownload files (Chrome partial downloads still in progress)
    - .tmp files (temporary download artifacts)
    - Directories

    Returns None if no qualifying file is found.
    """
    if not download_dir.exists():
        logger.debug("Download directory does not exist: %s", download_dir)
        return None

    now = time.time()
    candidates = [
        f for f in download_dir.iterdir()
        if f.is_file()
        and not f.name.endswith(".crdownload")
        and not f.name.endswith(".tmp")
        and (now - f.stat().st_mtime) <= max_age_seconds
    ]

    if not candidates:
        return None

    return max(candidates, key=lambda f: f.stat().st_mtime)
