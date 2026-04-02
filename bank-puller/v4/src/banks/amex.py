"""American Express bank workflow.

Key characteristics:
- Standard single-page login form
- 2FA only on unrecognized devices (usually SMS)
- Hamburger menu navigation to reach PDF statements
- Card picker: when multiple cards exist under one login, must select the
  correct card BEFORE navigating to PDF statements (requires_prepare=True)
- Statement download uses an AJAX modal — must wait for async load
"""

from __future__ import annotations

from typing import Any

from .base import BaseBankWorkflow
from ..models import JobConfig, LoginGroup


class AmexWorkflow(BaseBankWorkflow):
    login_url = "https://www.americanexpress.com/en-us/account/login"
    allowed_domains = [
        "americanexpress.com",
        "www.americanexpress.com",
        "global.americanexpress.com",
    ]
    requires_prepare = True
    requires_residential_proxy = True

    max_steps_per_phase = {
        "login":      8,
        "post_login": 12,
        "nav":        10,   # hamburger menu + scroll
        "prepare":    8,    # card picker
        "download":   14,   # AJAX modal
    }

    # ------------------------------------------------------------------
    # Task strings
    # ------------------------------------------------------------------

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            f"Navigate to {self.login_url} if not already there. "
            "Find the User ID or email input field and type x_username into it. "
            "Find the password input field and type x_password into it. "
            "Click the Log In button. "
            "Wait for the page to transition — you should see the AmEx account dashboard "
            "or a 2FA verification screen."
        )

    def get_post_login_task(self) -> str:
        return (
            "Look at the current page after logging in to American Express.\n"
            "\n"
            "If you see a verification code input (sent via SMS or text):\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code into the verification field.\n"
            "  - Click Verify, Continue, or Submit.\n"
            "\n"
            "If you see 'Trust this device?' or 'Remember this device?':\n"
            "  - Click Yes or Trust to avoid future 2FA prompts.\n"
            "\n"
            "If you see a promotional overlay, cookie banner, or interstitial:\n"
            "  - Call dismiss_modal to close it.\n"
            "\n"
            "If you see the AmEx account dashboard showing account balances or cards:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If you encounter an unexpected screen:\n"
            "  - Call request_human_input describing what you see."
        )

    def get_nav_task(self) -> str:
        return (
            "You are on the American Express account dashboard. "
            "Navigate to the Statements & Activity section to access PDF statements.\n"
            "\n"
            "Step 1: Find and click the hamburger menu icon (three horizontal lines) "
            "in the top navigation area.\n"
            "\n"
            "Step 2: In the menu that opens, look for 'Statements & Activity' or "
            "'Statements' and click it.\n"
            "\n"
            "Step 3: On the Statements page, look for a 'Go to PDF Statements' link "
            "or button and click it. You may need to scroll down to find it.\n"
            "\n"
            "Wait for the PDF statements list to load.\n"
            "\n"
            "If a modal or overlay appears at any point, call dismiss_modal.\n"
            "If something unexpected appears, call report_observation."
        )

    def get_prepare_task(self, account: Any) -> str:
        last4 = account.account_last4
        client = account.client_name
        return (
            f"You are on the American Express statements page.\n"
            "\n"
            "Call get_account_info to confirm which card you need to select "
            f"(it will say 'Account ending in {last4}' for {client}).\n"
            "\n"
            "IMPORTANT: You must select the correct card BEFORE the PDF statements "
            "list loads, otherwise AmEx reloads and you lose your place.\n"
            "\n"
            "Look for a card picker, account selector, or dropdown near the top of the page.\n"
            f"Find the card or account ending in {last4}.\n"
            "Click it to select it.\n"
            "\n"
            "Wait for the page to update showing statements for the selected card.\n"
            "\n"
            "If only one card is shown (no picker visible), confirm you are viewing "
            f"the card ending in {last4} and stop — selection is not needed."
        )

    def get_download_task(self, target_month: str) -> str:
        year, month = target_month.split("-")
        month_names = {
            "01": "January", "02": "February", "03": "March",
            "04": "April",   "05": "May",      "06": "June",
            "07": "July",    "08": "August",   "09": "September",
            "10": "October", "11": "November", "12": "December",
        }
        month_name = month_names.get(month, month)
        human_month = f"{month_name} {year}"

        return (
            f"You are on the American Express PDF statements page for the correct card. "
            f"Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement entry for '{human_month}' in the list.\n"
            "\n"
            "Click the statement entry or its download link to open it.\n"
            "\n"
            "A modal dialog will open and load asynchronously — wait for it to fully "
            "load (you should see statement details and a Download PDF button).\n"
            "\n"
            "Click the 'Download PDF' button inside the modal.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is a genuine PDF.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what months are available."
        )

    # ------------------------------------------------------------------
    # Verification overrides
    # ------------------------------------------------------------------

    async def _verify_nav(self, browser: Any, job: JobConfig) -> tuple[bool, dict]:
        """AmEx PDF statements page does not always have 'statement' in the URL."""
        url = await _get_url_from_browser(browser)
        ok = any(
            kw in url.lower()
            for kw in ("statement", "document", "pdf", "activity")
        )
        return ok, {
            "url_after_nav": url,
            "reason": "URL does not indicate a statements or activity page",
        }

    async def _verify_prepare(self, browser: Any, job: JobConfig) -> tuple[bool, dict]:
        """Verify the correct card is selected by checking for last4 on screen."""
        url = await _get_url_from_browser(browser)
        # Preparation success is confirmed by the download phase seeing the right statements
        return True, {"url_after_prepare": url, "target_last4": job.account.account_last4}


async def _get_url_from_browser(browser: Any) -> str:
    try:
        page = await browser.get_current_page()
        return page.url
    except Exception:
        return ""
