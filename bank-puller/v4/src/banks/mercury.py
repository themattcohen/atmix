"""Mercury bank workflow — REST API based.

Mercury exposes a documented REST API for account and transaction data.
Unlike browser-based banks, Mercury requires no browser session.  The
orchestrator detects is_api_based=True and calls workflow.run(job) directly.

Authentication:
    Mercury uses API tokens (Bearer token).  The token is stored in the
    account's tfa_detail field (re-used as a convenient slot; no TOTP here).
    Alternatively it can be stored in the notes field as "api_key=<token>".

Statements:
    Mercury's API exposes /account/{id}/statements which returns a list of
    statement objects with a download_url property.  We fetch the list,
    find the one matching target_month, download the PDF, and save it.

Rate limits:
    Mercury's API has conservative rate limits.  We add a short sleep between
    requests to avoid 429s.
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any

from .base import APIBankWorkflow
from ..models import JobConfig

logger = logging.getLogger("bank_puller.mercury")

MERCURY_API_BASE = "https://backend.mercury.com/api/v1"


def _extract_api_key(account: Any) -> str | None:
    """Extract the Mercury API key from tfa_detail or notes.

    Checks tfa_detail first (bare token string), then parses notes for
    'api_key=<value>' or 'token=<value>' patterns.
    """
    if account.tfa_detail:
        return account.tfa_detail.strip()

    if account.notes:
        match = re.search(
            r"(?:api[_\s]?key|token)\s*[=:]\s*(\S+)",
            account.notes,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

    return None


class MercuryWorkflow(APIBankWorkflow):
    login_url = "https://backend.mercury.com/api/v1"
    allowed_domains = ["mercury.com", "backend.mercury.com"]
    is_api_based = True

    async def run(self, job: JobConfig) -> None:
        """Download the target month's statement via Mercury REST API.

        Raises RuntimeError on any unrecoverable error so the orchestrator
        can record a FAILED result for this account.
        """
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError(
                "httpx is required for Mercury API calls. "
                "Install it with: pip install httpx"
            ) from exc

        api_key = _extract_api_key(job.account)
        if not api_key:
            raise RuntimeError(
                f"No Mercury API key found for account {job.account.account_last4}. "
                "Set the key in the tfa_detail column or notes column (api_key=<token>)."
            )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(
            headers=headers,
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            account_id = await self._find_account_id(client, job)
            statement = await self._find_statement(client, account_id, job.target_month)
            await self._download_statement(client, statement, job)

        logger.info(
            "Mercury: saved statement for %s / %s (%s)",
            job.account.client_name,
            job.account.account_last4,
            job.target_month,
        )

    async def _find_account_id(self, client: Any, job: JobConfig) -> str:
        """Return the Mercury account ID matching job.account.account_last4."""
        response = await client.get(f"{MERCURY_API_BASE}/accounts")
        _raise_for_status(response, "listing Mercury accounts")

        data = response.json()
        accounts = data.get("accounts", [])

        last4 = job.account.account_last4
        for acct in accounts:
            # Mercury returns accountNumber as a full account number
            account_number = str(acct.get("accountNumber", ""))
            routing = str(acct.get("routingNumber", ""))
            if account_number.endswith(last4) or routing.endswith(last4):
                return acct["id"]

        # Fallback: if only one account, use it regardless of last4
        if len(accounts) == 1:
            logger.warning(
                "Mercury: could not match last4 %s, using the only account found: %s",
                last4,
                accounts[0].get("id"),
            )
            return accounts[0]["id"]

        raise RuntimeError(
            f"Mercury: no account found ending in {last4}. "
            f"Found {len(accounts)} accounts: "
            + ", ".join(str(a.get("accountNumber", "?")) for a in accounts)
        )

    async def _find_statement(
        self, client: Any, account_id: str, target_month: str
    ) -> dict:
        """Return the statement object for target_month (yyyy-mm)."""
        await asyncio.sleep(0.5)  # be gentle with rate limits

        response = await client.get(
            f"{MERCURY_API_BASE}/account/{account_id}/statements"
        )
        _raise_for_status(response, "listing Mercury statements")

        data = response.json()
        statements = data.get("statements", [])

        year, month = target_month.split("-")

        for stmt in statements:
            # Mercury statement dates are ISO 8601: "2026-03-01" or "2026-03"
            stmt_date = stmt.get("startDate") or stmt.get("date") or ""
            if stmt_date.startswith(target_month):
                return stmt
            # Also check by year+month from separate fields
            if str(stmt.get("year", "")) == year and str(stmt.get("month", "")).zfill(2) == month:
                return stmt

        raise RuntimeError(
            f"Mercury: no statement found for {target_month} in account {account_id}. "
            f"Available: {[s.get('startDate') or s.get('date') for s in statements]}"
        )

    async def _download_statement(
        self, client: Any, statement: dict, job: JobConfig
    ) -> None:
        """Download the PDF from statement.downloadUrl and save it."""
        await asyncio.sleep(0.5)

        download_url = statement.get("downloadUrl") or statement.get("pdfUrl")
        if not download_url:
            raise RuntimeError(
                f"Mercury: statement object has no downloadUrl: {statement}"
            )

        response = await client.get(download_url)
        _raise_for_status(response, f"downloading Mercury statement from {download_url}")

        content = response.content

        # Validate it is actually a PDF
        if not content.startswith(b"%PDF"):
            raise RuntimeError(
                f"Mercury: downloaded file is not a PDF "
                f"(first 4 bytes: {content[:4]!r})"
            )

        if len(content) < 10_000:
            raise RuntimeError(
                f"Mercury: downloaded file is suspiciously small ({len(content)} bytes)"
            )

        # Build output filename using the same convention as other banks
        client_name = job.account.client_name.replace(" ", "_")
        bank_name = job.account.bank_name.title()
        last4 = job.account.account_last4
        month = job.target_month
        filename = f"{client_name}__{bank_name} #{last4} {month}.pdf"

        job.output_dir.mkdir(parents=True, exist_ok=True)
        dest = job.output_dir / filename
        dest.write_bytes(content)

        logger.info("Mercury: saved %s (%d bytes)", dest, len(content))


def _raise_for_status(response: Any, context: str) -> None:
    """Raise RuntimeError with context if the response is not 2xx."""
    if response.status_code >= 400:
        raise RuntimeError(
            f"Mercury API error while {context}: "
            f"HTTP {response.status_code} — {response.text[:500]}"
        )
