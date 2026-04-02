"""UBS bank workflow.

UNTESTED — task strings are based on documented UI patterns and have not
been validated against live UBS sessions.

Key characteristics:
- Standard login with client username and password
- Proprietary UBS Access App for push-based 2FA — this cannot be automated.
  The agent is instructed to call request_human_input so the operator can
  approve the push notification on their UBS Access App.
- Statements typically accessed via "Documents" or "eDocuments" section
"""

from __future__ import annotations

from .base import BaseBankWorkflow
from ..models import LoginGroup


class UBSWorkflow(BaseBankWorkflow):
    # UNTESTED
    login_url = "https://onlineservices.ubs.com/clientWeb/pages/clientLogin.xhtml"
    allowed_domains = [
        "ubs.com",
        "onlineservices.ubs.com",
        "www.ubs.com",
    ]
    requires_prepare = False
    requires_residential_proxy = False

    max_steps_per_phase = {
        "login":      8,
        "post_login": 15,   # manual push approval can take time
        "nav":        8,
        "prepare":    6,
        "download":   10,
    }

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            # UNTESTED
            f"Navigate to {self.login_url} if not already there. "
            "Find the username or Client ID input field and type x_username into it. "
            "Find the password input field and type x_password into it. "
            "Click the Login or Sign In button. "
            "Wait for the page to transition — you may see a 2FA approval screen "
            "or the UBS banking dashboard."
        )

    def get_post_login_task(self) -> str:
        return (
            # UNTESTED
            "Look at the current page after signing in to UBS.\n"
            "\n"
            "UBS uses its proprietary UBS Access App for two-factor authentication. "
            "This requires manual approval on the operator's device.\n"
            "\n"
            "If you see 'Approve with UBS Access App', 'Check your UBS Access App', "
            "or any message indicating that approval is needed on a mobile device:\n"
            "  - Call request_human_input with the message: "
            "'Please approve the UBS Access App push notification on your device, "
            "then press Enter here to continue.'\n"
            "  - Wait for the human operator to confirm.\n"
            "\n"
            "If you see an SMS code input:\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code and click Submit.\n"
            "\n"
            "If you see a promotional overlay or consent dialog:\n"
            "  - Call dismiss_modal.\n"
            "\n"
            "If you see the UBS banking dashboard or account overview:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If anything unexpected appears:\n"
            "  - Call request_human_input describing what you see."
        )

    def get_nav_task(self) -> str:
        return (
            # UNTESTED
            "You are on the UBS banking dashboard. Navigate to the statements or documents page.\n"
            "\n"
            "Look for 'Documents', 'eDocuments', 'Statements', or 'Account Documents' "
            "in the navigation menu or sidebar. Click it.\n"
            "\n"
            "Wait for the list of available documents to load.\n"
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
            f"You are on the UBS documents page. "
            f"Download the account statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement or document entry for '{human_month}' and click its "
            "download link or PDF icon.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is genuine.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what documents are available."
        )
