"""East West Bank workflow.

UNTESTED — task strings are based on the three-field login pattern documented
in clients.xlsx notes and have not been validated against live sessions.

Key characteristics:
- THREE-field login: Company ID, username, and password
- Company ID comes from the account's notes column (format: "Company ID = 12345")
- SMS or challenge-question 2FA
- Standard statement navigation once logged in

Notes column parsing:
    The orchestrator passes the raw notes string to the agent.  The agent reads
    the Company ID from the task string, which embeds the notes content directly.
    This is safe because Company IDs are not security secrets.
"""

from __future__ import annotations

import re

from .base import BaseBankWorkflow
from ..models import LoginGroup


def _extract_company_id(notes: str | None) -> str:
    """Parse Company ID from notes.

    Handles formats:
        'Company ID = 12345'
        'Company ID: 12345'
        'company_id = ABC123'
        'company_id: ABC123'
    """
    if not notes:
        return ""
    match = re.search(
        r"company[_\s]*id[_\s]*[=:]\s*(\w+)",
        notes,
        re.IGNORECASE,
    )
    return match.group(1).strip() if match else ""


class EastWestWorkflow(BaseBankWorkflow):
    # UNTESTED
    login_url = "https://www.eastwestbank.com/online-banking"
    allowed_domains = [
        "eastwestbank.com",
        "www.eastwestbank.com",
        "onlinebanking.eastwestbank.com",
    ]
    requires_prepare = False
    requires_residential_proxy = False

    max_steps_per_phase = {
        "login":      10,   # three-field login
        "post_login": 12,
        "nav":        8,
        "prepare":    6,
        "download":   10,
    }

    def get_login_task(self, group: LoginGroup) -> str:
        # Extract Company ID from notes of the first account in the group
        first_account = group.accounts[0] if group.accounts else None
        notes = first_account.notes if first_account else ""
        company_id = _extract_company_id(notes)

        company_id_instruction = (
            f"In the Company ID field, type: {company_id}"
            if company_id
            else "In the Company ID field, check the account notes for the Company ID value."
        )

        return (
            # UNTESTED
            f"Navigate to {self.login_url} if not already there. "
            "East West Bank uses a three-field login form.\n"
            "\n"
            f"Step 1 — Company ID: {company_id_instruction}\n"
            "\n"
            "Step 2 — Username: Find the username or User ID field "
            "and type x_username into it.\n"
            "\n"
            "Step 3 — Password: Find the password field "
            "and type x_password into it.\n"
            "\n"
            "Click the Sign In or Log In button. "
            "Wait for the page to transition to a dashboard or verification screen."
        )

    def get_post_login_task(self) -> str:
        return (
            # UNTESTED
            "Look at the current page after signing in to East West Bank.\n"
            "\n"
            "If you see an SMS verification code input:\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code and click Submit or Verify.\n"
            "\n"
            "If you see a security question:\n"
            "  - Read the exact question text.\n"
            "  - Call answer_security_question with the question.\n"
            "  - Type the answer and click Submit.\n"
            "\n"
            "If you see a promotional overlay or cookie consent:\n"
            "  - Call dismiss_modal.\n"
            "\n"
            "If you see the East West Bank account dashboard:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If anything unexpected appears:\n"
            "  - Call request_human_input describing what you see."
        )

    def get_nav_task(self) -> str:
        return (
            # UNTESTED
            "You are on the East West Bank dashboard. Navigate to the statements page.\n"
            "\n"
            "Look for 'Statements', 'Documents', or 'eStatements' in the navigation menu.\n"
            "Click it.\n"
            "\n"
            "Wait for the list of available statements to load.\n"
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
            f"You are on the East West Bank statements page. "
            f"Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement for '{human_month}' and click its download link or PDF icon.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is genuine.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what months are available."
        )
