"""Chase bank workflow.

Key characteristics:
- Login form lives inside a cross-origin iframe — agent must switch into it
- 2FA via SMS or push notification (always required on first run per profile;
  skipped after trusting the device)
- Statements accessed via "Statements & Documents" accordion in left nav
- Download triggers a confirmation dialog before PDF download begins
- Multiple accounts under one login are handled per-account in nav/prepare
"""

from __future__ import annotations

from typing import Any

from .base import BaseBankWorkflow
from ..models import JobConfig, LoginGroup


class ChaseWorkflow(BaseBankWorkflow):
    login_url = "https://secure.chase.com/web/auth/dashboard"
    allowed_domains = [
        "chase.com",
        "secure.chase.com",
        "jpmorgan.com",
    ]
    requires_prepare = False
    requires_residential_proxy = True

    max_steps_per_phase = {
        "login":      10,   # iframe adds steps
        "post_login": 15,   # 2FA + trust-device flow
        "nav":        10,   # accordion nav
        "prepare":    6,
        "download":   12,   # confirmation dialog
    }

    # ------------------------------------------------------------------
    # Task strings
    # ------------------------------------------------------------------

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            f"Navigate to https://secure.chase.com/web/auth/dashboard if not already there. "
            "The login form is inside an embedded iframe — you must switch into the iframe "
            "before interacting with any form elements. "
            "Inside the iframe, find the username or User ID input field and type x_username. "
            "Find the password input field and type x_password. "
            "Click the Sign In button. "
            "Wait for the page to transition — you should see a Chase dashboard, "
            "account overview, or a 2FA / verification screen. "
            "Do not interact with any 'Remember me' checkbox at this stage."
        )

    def get_post_login_task(self) -> str:
        return (
            "Look at the current page after signing in to Chase. "
            "\n"
            "If you see a verification code input (SMS or text code):\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code into the verification input field.\n"
            "  - Click Verify, Next, or Submit.\n"
            "\n"
            "If you see 'We sent a notification to your device' or similar push approval:\n"
            "  - Call wait_for_push and wait for the page to transition automatically.\n"
            "\n"
            "If you see 'Trust this device?' or 'Remember this device?':\n"
            "  - Click Yes, Trust, or Remember. This prevents 2FA prompts next month.\n"
            "\n"
            "If you see a security question:\n"
            "  - Read the exact question text.\n"
            "  - Call answer_security_question with the question text.\n"
            "  - Type the returned answer and click Submit or Continue.\n"
            "\n"
            "If you see a promotional modal, survey, or 'What's new' overlay:\n"
            "  - Call dismiss_modal to close it.\n"
            "\n"
            "If you see the Chase account dashboard or account list:\n"
            "  - You are done with this phase. Stop.\n"
            "\n"
            "If you encounter anything unexpected:\n"
            "  - Call request_human_input with a description of what you see."
        )

    def get_nav_task(self) -> str:
        return (
            "You are on the Chase dashboard. Navigate to the bank statements page.\n"
            "\n"
            "Look in the left sidebar or account navigation for a link labeled "
            "'Statements & Documents', 'Statements', or 'Documents'.\n"
            "Click it.\n"
            "\n"
            "If an accordion or dropdown expands, look for 'Account Statements' "
            "or 'PDF Statements' and click that option.\n"
            "\n"
            "If a modal appears, call dismiss_modal.\n"
            "\n"
            "Wait for the statements list to load — you should see a list of "
            "months with download links or PDF icons.\n"
            "\n"
            "If something unexpected appears, call report_observation with what you see."
        )

    def get_download_task(self, target_month: str) -> str:
        # Parse yyyy-mm to a human-readable format for the LLM
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
            f"You are on the Chase statements page. Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop immediately — "
            "the file is already saved.\n"
            "\n"
            f"Look through the list of available statements for '{human_month}' or "
            f"'{month}/{year}' or '{target_month}'.\n"
            "\n"
            "If the statement is inside an accordion, click the month row to expand it.\n"
            "\n"
            "Click the PDF download link, download icon, or 'Download' button for that month.\n"
            "\n"
            "If a confirmation dialog appears, click 'Download PDF' or 'Confirm'.\n"
            "\n"
            "Wait for the download to complete (the browser's download bar should show "
            "the file as complete, or a 'Download successful' message appears).\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file to the output directory.\n"
            "Call validate_pdf to confirm the saved file is a genuine PDF.\n"
            "\n"
            "If no statement is available for that month, call report_observation "
            "explaining what months are visible."
        )

    # ------------------------------------------------------------------
    # Verification overrides
    # ------------------------------------------------------------------

    async def _verify_nav(self, browser: Any, job: JobConfig) -> tuple[bool, dict]:
        url = await _get_url_from_browser(browser)
        # Chase statements pages contain 'statements' or 'documents' in the path,
        # but may also use hash-based navigation — be permissive
        ok = any(kw in url.lower() for kw in ("statement", "document", "account"))
        return ok, {
            "url_after_nav": url,
            "reason": "URL does not indicate a statements or account page",
        }


async def _get_url_from_browser(browser: Any) -> str:
    try:
        page = await browser.get_current_page()
        return page.url
    except Exception:
        return ""
