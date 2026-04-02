"""Wells Fargo bank workflow.

UNTESTED — task strings are based on documented UI patterns but have not
been validated against live Wells Fargo sessions.

Key characteristics:
- Standard single-page login with username and password
- SMS or push 2FA
- Statements triggered via XHR / JavaScript calls (not plain anchor links)
- May require scrolling to find download icon
"""

from __future__ import annotations

from .base import BaseBankWorkflow
from ..models import LoginGroup


class WellsFargoWorkflow(BaseBankWorkflow):
    # UNTESTED
    login_url = "https://connect.secure.wellsfargo.com/auth/login/present"
    allowed_domains = [
        "wellsfargo.com",
        "connect.secure.wellsfargo.com",
        "www.wellsfargo.com",
    ]
    requires_prepare = False
    requires_residential_proxy = True

    max_steps_per_phase = {
        "login":      8,
        "post_login": 12,
        "nav":        10,
        "prepare":    6,
        "download":   12,
    }

    def get_login_task(self, group: LoginGroup) -> str:
        return (
            # UNTESTED
            f"Navigate to {self.login_url} if not already there. "
            "Find the username input field and type x_username into it. "
            "Find the password input field and type x_password into it. "
            "Click the Sign On button. "
            "Wait for the page to transition to a dashboard or 2FA screen."
        )

    def get_post_login_task(self) -> str:
        return (
            # UNTESTED
            "Look at the current page after signing in to Wells Fargo.\n"
            "\n"
            "If you see an SMS verification code input:\n"
            "  - Call get_sms_code to retrieve the code from Dialpad.\n"
            "  - Type the code and click Submit or Verify.\n"
            "\n"
            "If you see a push notification prompt:\n"
            "  - Call wait_for_push and wait for the page to transition.\n"
            "\n"
            "If you see 'Trust this device?' or 'Don't ask again on this device?':\n"
            "  - Click Yes or the confirmation option.\n"
            "\n"
            "If you see a promotional overlay or survey:\n"
            "  - Call dismiss_modal.\n"
            "\n"
            "If you see the Wells Fargo account summary / dashboard:\n"
            "  - You are done. Stop.\n"
            "\n"
            "If anything unexpected appears:\n"
            "  - Call request_human_input describing what you see."
        )

    def get_nav_task(self) -> str:
        return (
            # UNTESTED
            "You are on the Wells Fargo dashboard. Navigate to the statements page.\n"
            "\n"
            "Look in the top navigation or account menu for 'Statements & Documents' "
            "or 'Statements'. Click it.\n"
            "\n"
            "If a submenu appears, click the 'Statements' or 'Account Statements' option.\n"
            "\n"
            "Wait for the statements list to load.\n"
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
            f"You are on the Wells Fargo statements page. "
            f"Download the statement for {human_month}.\n"
            "\n"
            "First, call check_already_downloaded. If it returns 'EXISTS', stop.\n"
            "\n"
            f"Find the statement entry for '{human_month}' in the list.\n"
            "\n"
            "Note: Wells Fargo statements may be triggered via JavaScript — the download "
            "icon or button may not be a standard <a> link. Click whatever download "
            "control is visible for that month.\n"
            "\n"
            "Wait for the download to complete.\n"
            "\n"
            "Call save_downloaded_pdf to rename and move the file.\n"
            "Call validate_pdf to confirm the file is genuine.\n"
            "\n"
            "If no statement for that month is visible, call report_observation "
            "describing what months are available."
        )
