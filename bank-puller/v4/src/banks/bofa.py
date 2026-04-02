"""Bank of America workflow.

UNTESTED — task strings are based on documented UI patterns and have not
been validated against live Bank of America sessions.

Key characteristics:
- Standard single-page login
- SMS or push 2FA; BioCatch behavioral monitoring is active — avoid
  rapid or mechanical-looking interactions (use_vision should help)
- Statements accessed via "Statements & Documents" in the account menu
- May require account selection if multiple accounts exist
"""

from __future__ import annotations

from .base import BaseBankWorkflow
from ..models import LoginGroup


class BofAWorkflow(BaseBankWorkflow):
    # UNTESTED
    login_url = "https://www.bankofamerica.com/login/"
    allowed_domains = [
        "bankofamerica.com",
        "www.bankofamerica.com",
        "secure.bankofamerica.com",
        "signin.bankofamerica.com",
    ]
    requires_prepare = False
    requires_residential_proxy = True

    max_steps_per_phase = {
        "login":      8,
        "post_login": 14,
        "nav":        10,
        "prepare":    6,
        "download":   10,
    }

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            # UNTESTED
            f"Navigate to {self.login_url} if not already there. "
            "Find the Online ID or username field and type x_username into it. "
            "Find the Passcode or password field and type x_password into it. "
            "Click the Sign In button. "
            "Wait for the page to transition to a dashboard or verification screen."
        )

    def get_post_login_task(self) -> str:
        return (
            # UNTESTED
            "Look at the current page after signing in to Bank of America.\n"
            "\n"
            "If you see an SMS code input:\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code and click Submit or Next.\n"
            "\n"
            "If you see a push notification prompt ('We sent a notification'):\n"
            "  - Call wait_for_push and wait for the page to transition.\n"
            "\n"
            "If you see 'Don't ask for a code on this computer':\n"
            "  - Select or click that option to suppress future 2FA prompts.\n"
            "\n"
            "If you see a security question:\n"
            "  - Call answer_security_question with the exact question text.\n"
            "  - Type the answer and click Continue.\n"
            "\n"
            "If you see a promotional overlay or cookie consent:\n"
            "  - Call dismiss_modal.\n"
            "\n"
            "If you see the BofA account overview / dashboard:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If anything unexpected appears:\n"
            "  - Call request_human_input describing the situation."
        )

    def get_nav_task(self) -> str:
        return (
            # UNTESTED
            "You are on the Bank of America dashboard. Navigate to the statements page.\n"
            "\n"
            "Click on the relevant account to open its details, then look for "
            "'Statements & Documents' or 'View Statements' in the account menu or tabs.\n"
            "Click it.\n"
            "\n"
            "Wait for the list of statements to load.\n"
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
            # UNTESTED
            f"You are on the Bank of America statements page. "
            f"Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement for '{human_month}' in the list and click its "
            "download link or PDF icon.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is genuine.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what months are available."
        )
