"""Dialpad pre-flight login workflow.

Dialpad is NOT a bank — it's the SMS intercept channel.  The orchestrator
runs this once at startup to establish a logged-in Dialpad session that
the get_sms_code skill can read from during bank 2FA phases.

This module supplies the task strings for the three Dialpad setup steps:
    1. LOGIN   — fill email + password, click Sign In
    2. 2FA     — prompt operator via CLI to enter Dialpad's own 2FA code
    3. INBOX   — navigate to the messages inbox and confirm it loaded

The orchestrator launches a dedicated BrowserProcess for Dialpad and keeps
it alive for the entire run.  It does NOT use BaseBankWorkflow because
Dialpad follows a different lifecycle than bank accounts.
"""

from __future__ import annotations

LOGIN_URL = "https://dialpad.com/accounts/login/"
INBOX_URL_FRAGMENT = "dialpad.com"


def get_login_task() -> str:
    """Task string: log in to Dialpad with email + password.

    Credentials come from the env vars DIALPAD_EMAIL and DIALPAD_PASSWORD,
    passed to the agent via sensitive_data so the LLM sees only the
    placeholder names x_dialpad_email and x_dialpad_password.
    """
    return (
        f"Navigate to {LOGIN_URL} if not already there. "
        "Find the email input field and type x_dialpad_email into it. "
        "Find the password input field and type x_dialpad_password into it. "
        "Click the Sign In or Log In button. "
        "Wait for the page to transition away from the login URL — "
        "you should see a Dialpad dashboard, inbox, or 2FA prompt. "
        "Do not close the browser or navigate away after signing in."
    )


def get_tfa_prompt() -> str:
    """Return the CLI prompt shown to the operator for Dialpad's own 2FA.

    Dialpad sends a one-time code to the operator's registered device.
    The orchestrator reads the code via input() and passes it back to the
    agent via the task string so it can type it into the 2FA field.
    """
    return "Enter the Dialpad 2FA verification code sent to your device: "


def get_tfa_task(code: str) -> str:
    """Task string: enter the operator-supplied 2FA code into Dialpad.

    The code is embedded directly (not via sensitive_data) because it is
    a one-time code entered by a human and has no masking requirement.
    """
    return (
        f"You should be on a Dialpad 2FA verification screen. "
        f"Find the verification code input field and type exactly: {code} "
        "Click the Verify, Submit, or Continue button. "
        "Wait for the page to transition to the Dialpad dashboard or inbox. "
        "If you are already on the dashboard (no 2FA prompt visible), "
        "confirm this and stop."
    )


def get_inbox_task() -> str:
    """Task string: navigate to the Dialpad messages inbox.

    After login (and optional 2FA), the agent navigates to the SMS/messages
    inbox so that subsequent get_sms_code skill calls can poll message content.
    """
    return (
        "You are now logged into Dialpad. "
        "Navigate to the Messages or Inbox section. "
        "Look for a 'Messages', 'SMS', or 'Texts' link in the left sidebar "
        "or top navigation and click it. "
        "Wait for the messages list to load — you should see a list of "
        "conversations or SMS threads. "
        "Once the inbox is visible, stop."
    )


def build_sensitive_data(dialpad_email: str, dialpad_password: str) -> dict[str, str]:
    """Return the sensitive_data dict for the Dialpad login agent."""
    return {
        "x_dialpad_email": dialpad_email,
        "x_dialpad_password": dialpad_password,
    }
