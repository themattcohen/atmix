from __future__ import annotations

from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TFAMethod(str, Enum):
    SMS  = "sms"
    TOTP = "totp"
    PUSH = "push"
    NONE = "none"


class Phase(str, Enum):
    LOGIN      = "login"
    POST_LOGIN = "post_login"
    NAV        = "nav"
    PREPARE    = "prepare"
    DOWNLOAD   = "download"
    VALIDATE   = "validate"


class PhaseStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED  = "failed"
    SKIPPED = "skipped"


class RunStatus(str, Enum):
    SUCCESS         = "success"
    PARTIAL         = "partial"
    FAILED          = "failed"
    ALREADY_EXISTS  = "already_exists"


# ---------------------------------------------------------------------------
# Input: one row from clients.xlsx
# ---------------------------------------------------------------------------

class BankAccount(BaseModel):
    """One row from clients.xlsx. All credentials are plain strings here;
    masking happens when building the BrowserUse Agent's sensitive_data dict."""

    # Identity
    client_name:    str   = Field(..., description="e.g. 'Bossi Sportswear'")
    bank_name:      str   = Field(..., description="e.g. 'chase', 'amex', 'citi'")
    account_last4:  str   = Field(..., description="Last 4 digits of account/card")

    # Credentials (stored as plain str; never passed to LLM directly)
    username:       str
    password:       str
    login_url:      str

    # 2FA
    tfa_method:     TFAMethod = TFAMethod.NONE
    tfa_detail:     Optional[str] = None
    # tfa_detail interpretation:
    #   sms  -> phone suffix (e.g. "1992")
    #   totp -> base32 secret (e.g. "JBSWY3DPEHPK3PXP")
    #   push -> None (wait for page transition)
    #   none -> None

    # Security questions: stored as list of {question: str, answer: str}
    security_questions: list[dict[str, str]] = Field(default_factory=list)

    # Free-text notes (e.g. "Company ID = 12345" for East West Bank)
    notes:          Optional[str] = None

    # Grouping key: accounts sharing login credentials are processed together
    # Derived property — do not set from Excel
    @property
    def login_key(self) -> str:
        """Unique key for a login session. Accounts sharing this key share one browser session."""
        return f"{self.bank_name}::{self.username}"

    class Config:
        frozen = True  # immutable after construction


# ---------------------------------------------------------------------------
# Job: the orchestrator's unit of work
# ---------------------------------------------------------------------------

class LoginGroup(BaseModel):
    """A group of BankAccounts that share the same login credentials.
    The orchestrator logs in once and processes all accounts in the group."""

    bank_name:  str
    username:   str
    password:   str           # plain; masked when building sensitive_data
    login_url:  str
    tfa_method: TFAMethod
    tfa_detail: Optional[str]
    accounts:   list[BankAccount]

    @property
    def login_key(self) -> str:
        return f"{self.bank_name}::{self.username}"


class JobConfig(BaseModel):
    """Complete runtime config for one account's download task.
    Passed by closure into skills so they can read account identifiers
    without taking them as LLM-controlled parameters."""

    account:        BankAccount
    target_month:   str                     # "2026-03" (yyyy-mm)
    output_dir:     Path                    # e.g. Path("output/2026-03")
    download_dir:   Path                    # Chrome's download directory
    profile_dir:    Path                    # Persistent browser profile path
    run_id:         str                     # Unique ID for this run (timestamp-based)

    class Config:
        arbitrary_types_allowed = True      # allow Path


# ---------------------------------------------------------------------------
# Phase and Run results
# ---------------------------------------------------------------------------

class PhaseResult(BaseModel):
    phase:          Phase
    status:         PhaseStatus
    started_at:     datetime
    finished_at:    Optional[datetime]  = None
    error:          Optional[str]       = None
    screenshot_path: Optional[str]     = None
    # Arbitrary metadata (e.g. "url_after": "https://chase.com/dashboard")
    metadata:       dict = Field(default_factory=dict)


class AccountResult(BaseModel):
    account:        BankAccount
    status:         RunStatus
    output_path:    Optional[Path]      = None
    phases:         list[PhaseResult]   = Field(default_factory=list)
    error:          Optional[str]       = None
    duration_sec:   Optional[float]     = None

    class Config:
        arbitrary_types_allowed = True


class RunReport(BaseModel):
    run_id:         str
    target_month:   str
    started_at:     datetime
    finished_at:    Optional[datetime]  = None
    results:        list[AccountResult] = Field(default_factory=list)

    # Computed helpers
    @property
    def success_count(self) -> int:
        return sum(1 for r in self.results if r.status == RunStatus.SUCCESS)

    @property
    def fail_count(self) -> int:
        return sum(1 for r in self.results if r.status == RunStatus.FAILED)

    @property
    def total_count(self) -> int:
        return len(self.results)


# ---------------------------------------------------------------------------
# Checkpoint: durable state saved after each phase
# ---------------------------------------------------------------------------

class PhaseCheckpoint(BaseModel):
    """Saved after each phase so a crashed run can resume."""

    run_id:         str
    login_key:      str                     # identifies the login group
    account_last4:  str                     # identifies the specific account
    phase:          Phase
    status:         PhaseStatus
    saved_at:       datetime = Field(default_factory=datetime.utcnow)
    output_path:    Optional[str] = None    # set after successful download


class RunCheckpoint(BaseModel):
    """The full checkpoint file for one run. One file per run_id."""

    run_id:         str
    target_month:   str
    started_at:     datetime
    phase_checkpoints: list[PhaseCheckpoint] = Field(default_factory=list)

    def get_phase_status(
        self,
        login_key: str,
        account_last4: str,
        phase: Phase,
    ) -> Optional[PhaseStatus]:
        for cp in self.phase_checkpoints:
            if (
                cp.login_key == login_key
                and cp.account_last4 == account_last4
                and cp.phase == phase
            ):
                return cp.status
        return None

    def is_phase_done(self, login_key: str, account_last4: str, phase: Phase) -> bool:
        return self.get_phase_status(login_key, account_last4, phase) == PhaseStatus.SUCCESS
