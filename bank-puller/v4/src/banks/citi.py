"""Citibank workflow.

Key characteristics:
- Two-step login: username on page 1, password on page 2 (after clicking Continue)
- May show a QR code page after login — dismiss it
- Statements accessed via sidebar navigation
- Older statements (>12 months) may show 'Request Statement' instead of download;
  if seen, report_observation and skip
- May use TOTP (Citi Authenticator app) for business accounts
"""

from __future__ import annotations

from typing import Any

from .base import BaseBankWorkflow
from ..models import JobConfig, LoginGroup


class CitiWorkflow(BaseBankWorkflow):
    login_url = "https://online.citi.com/US/login.do"
    allowed_domains = [
        "citi.com",
        "online.citi.com",
        "citibank.com",
        "www.citibank.com",
    ]
    requires_prepare = False
    requires_residential_proxy = True

    max_steps_per_phase = {
        "login":      10,   # two-step login
        "post_login": 12,
        "nav":        8,
        "prepare":    6,
        "download":   10,
    }

    # ------------------------------------------------------------------
    # Task strings
    # ------------------------------------------------------------------

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            f"Navigate to {self.login_url} if not already there.\n"
            "\n"
            "Citibank uses a two-step login process:\n"
            "\n"
            "Step 1 — Username:\n"
            "  Find the User ID or username input field.\n"
            "  Type x_username into it.\n"
            "  Click Continue, Next, or Sign On (whichever appears).\n"
            "  Wait for the page to load — it should now show a password field.\n"
            "\n"
            "Step 2 — Password:\n"
            "  Find the password input field.\n"
            "  Type x_password into it.\n"
            "  Click Sign On, Log In, or Submit.\n"
            "\n"
            "Wait for the page to transition to a dashboard, account overview, "
            "or a 2FA / verification screen."
        )

    def get_post_login_task(self) -> str:
        return (
            "Look at the current page after signing in to Citi.\n"
            "\n"
            "If you see a QR code page or 'Set up the Citi Mobile App' prompt:\n"
            "  - Look for a 'Skip', 'Not now', or 'Close' option and click it.\n"
            "  - If no skip option, call dismiss_modal.\n"
            "\n"
            "If you see a TOTP / authenticator code input:\n"
            "  - Call generate_totp to get the current code.\n"
            "  - Type the code into the input field.\n"
            "  - Click Verify or Submit.\n"
            "\n"
            "If you see an SMS verification code input:\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code and click Verify.\n"
            "\n"
            "If you see a security question:\n"
            "  - Read the exact question text.\n"
            "  - Call answer_security_question with the question.\n"
            "  - Type the answer and click Submit.\n"
            "\n"
            "If you see 'Trust this device?' or 'Remember this computer?':\n"
            "  - Click Yes or Trust.\n"
            "\n"
            "If you see a promotional overlay or cookie consent:\n"
            "  - Call dismiss_modal.\n"
            "\n"
            "If you see the Citi account dashboard showing account balances:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If anything unexpected appears:\n"
            "  - Call request_human_input describing the situation."
        )

    def get_nav_task(self) -> str:
        return (
            "You are on the Citi dashboard. Navigate to the statements page.\n"
            "\n"
            "Look in the left sidebar navigation for a link labeled "
            "'Statements', 'Documents', or 'Statements & Documents'.\n"
            "Click it.\n"
            "\n"
            "If a 'View All Statements' or 'See all statements' link appears, click it "
            "to expand the full statements list.\n"
            "\n"
            "Wait for the list of statements to load by month.\n"
            "\n"
            "If a modal appears, call dismiss_modal.\n"
            "If something unexpected appears, call report_observation."
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
            f"You are on the Citi statements page. Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement for '{human_month}' in the list.\n"
            "\n"
            "IMPORTANT: If the entry says 'Request Statement' instead of 'Download', "
            "this statement is not yet available. Call report_observation explaining this "
            "and stop — do not attempt a download.\n"
            "\n"
            "Click the download link, PDF icon, or 'Download' button for that month.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is genuine.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what months are available."
        )


async def _get_url_from_browser(browser: Any) -> str:
    try:
        page = await browser.get_current_page()
        return page.url
    except Exception:
        return ""
