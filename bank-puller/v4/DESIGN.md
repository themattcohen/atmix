# Bank Statement Automator v4 — Technical Design

**Status**: Approved for implementation
**Depends on**: PLAN.md (architecture decisions), research/ (BrowserUse API surface, agent patterns)

---

## Table of Contents

1. [Pydantic Models and Data Classes](#1-pydantic-models-and-data-classes)
2. [Module Interfaces](#2-module-interfaces)
3. [Data Flow](#3-data-flow)
4. [Class Hierarchy](#4-class-hierarchy)
5. [Skill Registration Pattern](#5-skill-registration-pattern)
6. [Error Handling Strategy](#6-error-handling-strategy)
7. [Module Dependency Graph](#7-module-dependency-graph)
8. [File-by-File Implementation Notes](#8-file-by-file-implementation-notes)

---

## 1. Pydantic Models and Data Classes

All shared data structures. Define these in `src/models.py` so every module imports from a single source.

```python
# src/models.py

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, SecretStr


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

    def get_phase_status(self, login_key: str, account_last4: str, phase: Phase) -> Optional[PhaseStatus]:
        for cp in self.phase_checkpoints:
            if cp.login_key == login_key and cp.account_last4 == account_last4 and cp.phase == phase:
                return cp.status
        return None

    def is_phase_done(self, login_key: str, account_last4: str, phase: Phase) -> bool:
        return self.get_phase_status(login_key, account_last4, phase) == PhaseStatus.SUCCESS
```

---

## 2. Module Interfaces

### 2.1 `src/excel_reader.py`

Reads `clients.xlsx` and returns structured `BankAccount` objects. No I/O beyond this file.

```python
# src/excel_reader.py

from pathlib import Path
from .models import BankAccount, TFAMethod


def read_accounts(path: Path) -> list[BankAccount]:
    """Parse clients.xlsx and return one BankAccount per row.

    Expected columns (case-insensitive, leading/trailing space stripped):
        client_name, bank_name, login_url, username, password,
        account_last4, tfa_method, tfa_detail, notes

    Optional columns (parsed if present):
        security_q1, security_a1, security_q2, security_a2, ...

    Rows where 'active' column is explicitly "no" or "0" are skipped.
    Raises ValueError with row number if a required column is missing.
    """
    ...


def group_by_login(accounts: list[BankAccount]) -> list[LoginGroup]:
    """Group accounts that share the same login credentials.

    Accounts are grouped by (bank_name, username). Within a group they
    are processed sequentially on one browser session.

    Returns list of LoginGroup, preserving original Excel row order
    for the primary account in each group.
    """
    ...


# --- Column mapping ---
# The Excel may use human-readable headers. This dict maps them to model fields.
COLUMN_MAP: dict[str, str] = {
    "client name":    "client_name",
    "client_name":    "client_name",
    "bank":           "bank_name",
    "bank name":      "bank_name",
    "bank_name":      "bank_name",
    "url":            "login_url",
    "login url":      "login_url",
    "login_url":      "login_url",
    "user":           "username",
    "username":       "username",
    "pass":           "password",
    "password":       "password",
    "last4":          "account_last4",
    "account_last4":  "account_last4",
    "2fa":            "tfa_method",
    "tfa_method":     "tfa_method",
    "2fa detail":     "tfa_detail",
    "tfa_detail":     "tfa_detail",
    "notes":          "notes",
}
```

### 2.2 `src/checkpoint.py`

Durable JSON state. Saved after every phase. Used to resume from crashes.

```python
# src/checkpoint.py

import json
from pathlib import Path
from datetime import datetime
from .models import RunCheckpoint, PhaseCheckpoint, Phase, PhaseStatus


CHECKPOINT_DIR = Path("checkpoints")


class CheckpointManager:
    """Reads/writes RunCheckpoint JSON files.

    One file per run: checkpoints/{run_id}.json
    On crash, the orchestrator loads the latest checkpoint for the same
    target_month and skips phases that are already PhaseStatus.SUCCESS.
    """

    def __init__(self, run_id: str, target_month: str) -> None:
        self.run_id = run_id
        self.target_month = target_month
        self._path = CHECKPOINT_DIR / f"{run_id}.json"
        CHECKPOINT_DIR.mkdir(exist_ok=True)
        self._state: RunCheckpoint = self._load_or_create()

    def _load_or_create(self) -> RunCheckpoint:
        if self._path.exists():
            return RunCheckpoint.model_validate_json(self._path.read_text())
        return RunCheckpoint(
            run_id=self.run_id,
            target_month=self.target_month,
            started_at=datetime.utcnow(),
        )

    def save_phase(
        self,
        login_key: str,
        account_last4: str,
        phase: Phase,
        status: PhaseStatus,
        output_path: str | None = None,
    ) -> None:
        """Upsert a phase checkpoint and flush to disk atomically."""
        # Remove existing entry for same key+phase if any
        self._state.phase_checkpoints = [
            cp for cp in self._state.phase_checkpoints
            if not (cp.login_key == login_key
                    and cp.account_last4 == account_last4
                    and cp.phase == phase)
        ]
        self._state.phase_checkpoints.append(PhaseCheckpoint(
            run_id=self.run_id,
            login_key=login_key,
            account_last4=account_last4,
            phase=phase,
            status=status,
            output_path=output_path,
        ))
        # Atomic write via temp file
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(self._state.model_dump_json(indent=2))
        tmp.replace(self._path)

    def is_done(self, login_key: str, account_last4: str, phase: Phase) -> bool:
        """True if this phase completed successfully in a previous run."""
        return self._state.is_phase_done(login_key, account_last4, phase)

    @classmethod
    def find_resume_checkpoint(cls, target_month: str) -> str | None:
        """Return run_id of the most recent incomplete run for target_month,
        or None if no resumable checkpoint exists."""
        ...
```

### 2.3 `src/browser/launcher.py`

Launches the stealth browser (Nodriver/Patchright) on a CDP port and returns the port.

```python
# src/browser/launcher.py

import asyncio
import subprocess
from pathlib import Path


class BrowserProcess:
    """Manages the lifecycle of a stealth Chromium process."""

    def __init__(self, cdp_port: int, profile_dir: Path, headless: bool = False) -> None:
        self.cdp_port = cdp_port
        self.profile_dir = profile_dir
        self.headless = headless
        self._proc: subprocess.Popen | None = None

    async def start(self) -> None:
        """Launch Patchright/Nodriver on self.cdp_port with self.profile_dir.

        Tries Patchright first (better stealth), falls back to Nodriver.
        Waits until the CDP endpoint is accepting connections before returning.
        Raises RuntimeError if the process fails to start within 10 seconds.
        """
        ...

    async def stop(self) -> None:
        """Terminate the browser process and wait for it to exit."""
        if self._proc:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None

    @property
    def cdp_url(self) -> str:
        return f"http://localhost:{self.cdp_port}"


def find_free_port(start: int = 9222, end: int = 9299) -> int:
    """Return the first available TCP port in [start, end).

    Raises RuntimeError if no port is free in the range.
    Used to allocate a CDP port before launching BrowserProcess.
    """
    ...


def build_chrome_args(
    cdp_port: int,
    profile_dir: Path,
    headless: bool,
    proxy: str | None = None,
) -> list[str]:
    """Return the full argv list for launching Chrome with CDP enabled.

    Key flags:
      --remote-debugging-port={cdp_port}
      --user-data-dir={profile_dir}          # persistent trusted-device cookies
      --no-first-run
      --disable-blink-features=AutomationControlled
      --disable-infobars
    """
    ...
```

### 2.4 `src/skills/__init__.py` — The `build_skills` factory

```python
# src/skills/__init__.py

from browser_use import Controller
from .models import JobConfig, Phase


def build_skills(phase: Phase, job: JobConfig) -> Controller:
    """Return a Controller pre-loaded with only the custom actions
    appropriate for the given phase.

    Phase -> registered skills:
        LOGIN:      (none — only BrowserUse built-ins needed)
        POST_LOGIN: get_sms_code, generate_totp, wait_for_push,
                    answer_security_question, request_human_input,
                    dismiss_modal
        NAV:        dismiss_modal, report_observation
        PREPARE:    get_account_info, dismiss_modal
        DOWNLOAD:   check_already_downloaded, save_downloaded_pdf,
                    validate_pdf, report_observation, dismiss_modal
        VALIDATE:   (none — pure Python, no Agent)

    The job parameter is captured by closure inside each skill function,
    so skills can read account identifiers, paths, and credentials
    without receiving them as LLM-controlled parameters.

    This function is the ONLY place skills are registered. No skill
    file calls controller.action() at module level.
    """
    controller = Controller()
    _register_phase_skills(controller, phase, job)
    return controller


def _register_phase_skills(
    controller: Controller,
    phase: Phase,
    job: JobConfig,
) -> None:
    from .tfa import (
        make_get_sms_code,
        make_generate_totp,
        make_wait_for_push,
        make_answer_security_question,
        make_request_human_input,
    )
    from .statements import (
        make_check_already_downloaded,
        make_save_downloaded_pdf,
        make_validate_pdf,
    )
    from .navigation import (
        make_dismiss_modal,
        make_report_observation,
        make_get_account_info,
    )

    # Each make_*() returns a closure bound to `job`, which is then
    # registered on the controller via controller.action(description)(fn).

    if phase == Phase.POST_LOGIN:
        controller.action("Get SMS verification code from Dialpad")(
            make_get_sms_code(job))
        controller.action("Generate TOTP verification code")(
            make_generate_totp(job))
        controller.action("Wait for push notification approval")(
            make_wait_for_push(job))
        controller.action("Answer the security question shown on the page")(
            make_answer_security_question(job))
        controller.action("Request human operator to provide a code or take action")(
            make_request_human_input(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    elif phase == Phase.NAV:
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))
        controller.action("Report what you observe on the current page")(
            make_report_observation(job))

    elif phase == Phase.PREPARE:
        controller.action("Get account details for multi-account navigation")(
            make_get_account_info(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    elif phase == Phase.DOWNLOAD:
        controller.action("Check if this month's statement has already been downloaded")(
            make_check_already_downloaded(job))
        controller.action("Save the downloaded PDF statement with correct filename")(
            make_save_downloaded_pdf(job))
        controller.action("Verify the downloaded file is a valid PDF")(
            make_validate_pdf(job))
        controller.action("Report what you observe on the current page")(
            make_report_observation(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    # Phase.LOGIN and Phase.VALIDATE: no custom actions registered
```

### 2.5 `src/skills/tfa.py`

Each skill is a factory function returning an async callable bound to the current `JobConfig`.

```python
# src/skills/tfa.py

import asyncio
import re
import time
from typing import Callable, Awaitable

import pyotp
import rapidfuzz.fuzz as fuzz
import rapidfuzz.process as process
from browser_use import ActionResult, BrowserContext

from ..models import JobConfig, TFAMethod


# ---------------------------------------------------------------------------
# Factory functions — return closures bound to job
# ---------------------------------------------------------------------------

def make_get_sms_code(job: JobConfig) -> Callable:
    """Returns an async function registered as a @controller.action."""

    async def get_sms_code(bank_name: str) -> ActionResult:
        """Poll Dialpad webhook/DOM for the latest SMS code.
        Call this when you see a verification code input field."""
        sent_after = time.time()
        deadline = sent_after + 90  # 90-second timeout

        while time.time() < deadline:
            code = await _poll_dialpad_webhook(bank_name, sent_after)
            if code:
                return ActionResult(extracted_content=code)
            await asyncio.sleep(3)

        return ActionResult(error="No SMS code received within 90 seconds")

    return get_sms_code


async def _poll_dialpad_webhook(bank_name: str, sent_after: float) -> str | None:
    """Check the local Dialpad webhook server for a code newer than sent_after.

    The Dialpad webhook server (a lightweight FastAPI app) runs as a
    sidecar and receives SMS webhooks pushed by Dialpad. This function
    hits GET /latest-code?bank={bank_name}&after={sent_after}.

    Falls back to DOM polling if the webhook server is not running.
    Returns a 6-digit code string or None.
    """
    ...


def make_generate_totp(job: JobConfig) -> Callable:
    async def generate_totp(account_id: str) -> ActionResult:
        """Generate a 6-digit TOTP code from the stored secret.
        Call this when you see a TOTP/authenticator code input field."""
        secret = job.account.tfa_detail
        if not secret:
            return ActionResult(error="No TOTP secret configured for this account")
        code = pyotp.TOTP(secret).now()
        return ActionResult(extracted_content=code)

    return generate_totp


def make_wait_for_push(job: JobConfig) -> Callable:
    async def wait_for_push(browser: BrowserContext) -> ActionResult:
        """Wait up to 2 minutes for push notification approval.
        Call this when the page says 'Waiting for approval' or similar."""
        deadline = asyncio.get_event_loop().time() + 120
        initial_url = await _get_current_url(browser)

        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(2)
            current_url = await _get_current_url(browser)
            if current_url != initial_url:
                return ActionResult(extracted_content="Push approved — page transitioned")
            # Also check for dashboard element appearing
            if await _dashboard_element_visible(browser):
                return ActionResult(extracted_content="Push approved — dashboard visible")

        # Check for fallback option
        if await _sms_fallback_available(browser):
            return ActionResult(extracted_content="PUSH_TIMEOUT_FALLBACK_AVAILABLE")

        return ActionResult(error="Push notification not approved within 120 seconds")

    return wait_for_push


def make_answer_security_question(job: JobConfig) -> Callable:
    async def answer_security_question(question_text: str) -> ActionResult:
        """Fuzzy-match the security question against stored Q&A pairs.
        Call this when you see a security question. Pass the exact question text."""
        qa_pairs = job.account.security_questions
        if not qa_pairs:
            return ActionResult(error="No security questions configured for this account")

        questions = [q["question"] for q in qa_pairs]
        match = process.extractOne(
            question_text,
            questions,
            scorer=fuzz.token_sort_ratio,
        )

        if match and match[1] >= 75:
            matched_question = match[0]
            answer = next(
                q["answer"] for q in qa_pairs if q["question"] == matched_question
            )
            return ActionResult(extracted_content=answer)

        return ActionResult(
            error=f"No security question match (best score {match[1] if match else 0}). "
                  "Call request_human_input instead."
        )

    return answer_security_question


def make_request_human_input(job: JobConfig) -> Callable:
    async def request_human_input(prompt: str) -> ActionResult:
        """Pause automation and notify the operator via Slack + CLI.
        Call this when you encounter an unrecognized 2FA prompt or are stuck."""
        bank = job.account.bank_name
        client = job.account.client_name
        full_prompt = f"MANUAL INPUT REQUIRED: {client} / {bank} — {prompt}"

        # Notify (non-blocking failures OK — human may not have Slack)
        await _send_slack_notification(full_prompt, job)

        # CLI prompt in executor (blocking I/O)
        print(f"\n{'='*60}")
        print(full_prompt)
        print(f"{'='*60}")
        loop = asyncio.get_event_loop()
        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(None, input, "Enter code/response: "),
                timeout=300,  # 5 minutes
            )
            return ActionResult(extracted_content=response.strip())
        except asyncio.TimeoutError:
            return ActionResult(error="Human input timeout (5 minutes)")

    return request_human_input


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_current_url(browser: BrowserContext) -> str: ...
async def _dashboard_element_visible(browser: BrowserContext) -> bool: ...
async def _sms_fallback_available(browser: BrowserContext) -> bool: ...
async def _send_slack_notification(message: str, job: JobConfig) -> None: ...
```

### 2.6 `src/skills/statements.py`

```python
# src/skills/statements.py

import time
from pathlib import Path
from typing import Callable

from browser_use import ActionResult, BrowserContext

from ..models import JobConfig


def make_check_already_downloaded(job: JobConfig) -> Callable:
    async def check_already_downloaded() -> ActionResult:
        """Check the output directory for an existing file matching this account+month.
        Call this before attempting a download."""
        expected = _build_expected_filename(job)
        target = job.output_dir / expected
        if target.exists():
            return ActionResult(extracted_content=f"EXISTS: {target}")
        return ActionResult(extracted_content="NOT_FOUND")

    return check_already_downloaded


def make_save_downloaded_pdf(job: JobConfig) -> Callable:
    async def save_downloaded_pdf(browser: BrowserContext) -> ActionResult:
        """Move the most recently downloaded file to the output directory
        with naming: ClientName__BankName #xxxx yyyy-mm.pdf
        Call this after a PDF download completes."""
        recent = _find_recent_download(job.download_dir, max_age_seconds=60)
        if not recent:
            return ActionResult(error="No recent download found in download directory")

        dest_name = _build_expected_filename(job)
        job.output_dir.mkdir(parents=True, exist_ok=True)
        dest = job.output_dir / dest_name
        recent.rename(dest)
        return ActionResult(extracted_content=str(dest))

    return save_downloaded_pdf


def make_validate_pdf(job: JobConfig) -> Callable:
    async def validate_pdf(browser: BrowserContext) -> ActionResult:
        """Check that the most recent download is an actual PDF, not an HTML error page.
        Call this after saving a statement."""
        # Find the most recently saved file in output_dir matching our naming pattern
        expected = _build_expected_filename(job)
        target = job.output_dir / expected

        if not target.exists():
            return ActionResult(error=f"Expected output file not found: {target}")

        file_size = target.stat().st_size
        if file_size < 10_000:  # < 10 KB
            return ActionResult(error=f"File too small ({file_size} bytes) — likely an error page")
        if file_size > 50_000_000:  # > 50 MB
            return ActionResult(error=f"File too large ({file_size} bytes) — suspicious")

        magic = target.read_bytes()[:4]
        if magic != b"%PDF":
            return ActionResult(
                error=f"Not a PDF (magic bytes: {magic!r}). File may be an HTML error page."
            )

        return ActionResult(extracted_content=f"VALID: {file_size // 1024}KB")

    return validate_pdf


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_expected_filename(job: JobConfig) -> str:
    """Standard naming convention: ClientName__BankName #xxxx yyyy-mm.pdf

    Example: Bossi_Sportswear__Citibank #8035 2026-03.pdf

    Rules:
    - client_name: spaces -> underscores, strip special chars
    - bank_name: title-cased, spaces preserved (matches display name)
    - account_last4: 4 digits
    - target_month: yyyy-mm
    """
    client = job.account.client_name.replace(" ", "_")
    bank   = job.account.bank_name.title()
    last4  = job.account.account_last4
    month  = job.target_month
    return f"{client}__{bank} #{last4} {month}.pdf"


def _find_recent_download(download_dir: Path, max_age_seconds: int = 60) -> Path | None:
    """Return the most recently modified file in download_dir
    that was modified within the last max_age_seconds seconds.
    Returns None if no such file exists."""
    now = time.time()
    candidates = [
        f for f in download_dir.iterdir()
        if f.is_file()
        and not f.name.endswith(".crdownload")    # Chrome partial download
        and (now - f.stat().st_mtime) <= max_age_seconds
    ]
    return max(candidates, key=lambda f: f.stat().st_mtime, default=None)
```

### 2.7 `src/skills/navigation.py`

```python
# src/skills/navigation.py

import asyncio
from typing import Callable

from browser_use import ActionResult, BrowserContext

from ..models import JobConfig


def make_dismiss_modal(job: JobConfig) -> Callable:
    async def dismiss_modal(browser: BrowserContext) -> ActionResult:
        """Try to close any blocking overlay (cookie consent, session warning, promo).
        Call this when a modal or popup is blocking your task."""
        # Ordered list of strategies: try each until one succeeds
        strategies = [
            _click_by_text(browser, ["Close", "Dismiss", "Got it",
                                     "Accept", "No thanks", "Accept All Cookies"]),
            _click_escape(browser),
            _click_overlay_backdrop(browser),
        ]
        for strategy in strategies:
            result = await strategy
            if result:
                await asyncio.sleep(0.8)  # animation settle
                return ActionResult(extracted_content="Modal dismissed")

        return ActionResult(error="Could not find a way to dismiss the modal")

    return dismiss_modal


def make_report_observation(job: JobConfig) -> Callable:
    async def report_observation(observation: str) -> ActionResult:
        """Log an observation about the page state for debugging.
        Call this when something unexpected appears."""
        import logging
        logger = logging.getLogger("bank_puller")
        bank   = job.account.bank_name
        client = job.account.client_name
        logger.warning("[OBSERVATION] %s / %s: %s", client, bank, observation)
        # Save to structured run log as well
        _append_observation_log(job, observation)
        return ActionResult(extracted_content="Logged")

    return report_observation


def make_get_account_info(job: JobConfig) -> Callable:
    async def get_account_info() -> ActionResult:
        """Return the account last4, client name, and notes needed
        to select the correct account when a bank shows multiple accounts."""
        account = job.account
        parts = [
            f"Account ending in {account.account_last4}",
            f"Client: {account.client_name}",
        ]
        if account.notes:
            parts.append(f"Notes: {account.notes}")
        return ActionResult(extracted_content=", ".join(parts))

    return get_account_info


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _click_by_text(browser: BrowserContext, texts: list[str]) -> bool:
    """Try clicking any button matching one of the given text labels.
    Returns True if a click succeeded."""
    ...

async def _click_escape(browser: BrowserContext) -> bool:
    """Send Escape keypress."""
    ...

async def _click_overlay_backdrop(browser: BrowserContext) -> bool:
    """Click at a position outside any centered modal."""
    ...

def _append_observation_log(job: JobConfig, observation: str) -> None:
    """Append structured log entry to logs/{run_id}.jsonl"""
    ...
```

### 2.8 `src/orchestrator.py`

The central coordinator. Reads the job queue, manages browser lifecycle, calls workflows phase by phase.

```python
# src/orchestrator.py

import asyncio
import logging
from datetime import datetime
from pathlib import Path

from browser_use import Agent, Browser
from langchain_anthropic import ChatAnthropic

from .models import (
    AccountResult, JobConfig, LoginGroup, Phase, PhaseResult,
    PhaseStatus, RunReport, RunStatus,
)
from .checkpoint import CheckpointManager
from .excel_reader import read_accounts, group_by_login
from .browser.launcher import BrowserProcess, find_free_port
from .skills import build_skills
from .banks import load_workflow
from .config import Settings
from .report import generate_report


logger = logging.getLogger("bank_puller.orchestrator")


class Orchestrator:
    """Drives the full batch run.

    Usage:
        orchestrator = Orchestrator(settings)
        report = await orchestrator.run_all(
            accounts_path=Path("clients.xlsx"),
            target_month="2026-03",
        )
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._run_id: str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    async def run_all(
        self,
        accounts_path: Path,
        target_month: str,
        resume: bool = True,
    ) -> RunReport:
        """Main entry point. Reads Excel, builds login groups, runs each."""
        accounts = read_accounts(accounts_path)
        login_groups = group_by_login(accounts)
        checkpoint = CheckpointManager(self._run_id, target_month)
        results: list[AccountResult] = []

        for group in login_groups:
            group_results = await self._run_login_group(
                group, target_month, checkpoint
            )
            results.extend(group_results)

        report = RunReport(
            run_id=self._run_id,
            target_month=target_month,
            started_at=datetime.utcnow(),
            results=results,
        )
        generate_report(report, self.settings.output_dir)
        return report

    async def _run_login_group(
        self,
        group: LoginGroup,
        target_month: str,
        checkpoint: CheckpointManager,
    ) -> list[AccountResult]:
        """Run all phases for one login group (one browser session)."""
        workflow = load_workflow(group.bank_name)
        output_dir = self.settings.output_dir / target_month
        profile_dir = self.settings.profiles_dir / f"{group.bank_name}__{group.username}"

        cdp_port = find_free_port()
        browser_proc = BrowserProcess(
            cdp_port=cdp_port,
            profile_dir=profile_dir,
            headless=self.settings.headless,
        )

        account_results: list[AccountResult] = []

        try:
            await browser_proc.start()
            bu_browser = Browser(
                cdp_url=browser_proc.cdp_url,
                keep_alive=True,
                allowed_domains=workflow.allowed_domains,
            )

            # --- Phase 1: LOGIN (once per group) ---
            login_result = await self._run_phase(
                phase=Phase.LOGIN,
                task=workflow.get_login_task(group),
                workflow=workflow,
                bu_browser=bu_browser,
                job=self._make_job_config(group.accounts[0], target_month, output_dir, browser_proc),
                checkpoint=checkpoint,
                login_key=group.login_key,
                account_last4="shared",   # login is shared across all accounts in group
            )
            if login_result.status == PhaseStatus.FAILED:
                # Login failure aborts the entire group
                for acct in group.accounts:
                    account_results.append(AccountResult(
                        account=acct,
                        status=RunStatus.FAILED,
                        error=f"Login failed: {login_result.error}",
                        phases=[login_result],
                    ))
                return account_results

            # --- Phase 2: POST-LOGIN / 2FA (once per group) ---
            post_login_result = await self._run_phase(
                phase=Phase.POST_LOGIN,
                task=workflow.get_post_login_task(),
                workflow=workflow,
                bu_browser=bu_browser,
                job=self._make_job_config(group.accounts[0], target_month, output_dir, browser_proc),
                checkpoint=checkpoint,
                login_key=group.login_key,
                account_last4="shared",
            )
            if post_login_result.status == PhaseStatus.FAILED:
                for acct in group.accounts:
                    account_results.append(AccountResult(
                        account=acct,
                        status=RunStatus.FAILED,
                        error=f"Post-login/2FA failed: {post_login_result.error}",
                        phases=[login_result, post_login_result],
                    ))
                return account_results

            # --- Phases 3-5: Per-account ---
            for account in group.accounts:
                job = self._make_job_config(account, target_month, output_dir, browser_proc)
                result = await self._run_account_phases(
                    account=account,
                    job=job,
                    workflow=workflow,
                    bu_browser=bu_browser,
                    checkpoint=checkpoint,
                    group_phases=[login_result, post_login_result],
                )
                account_results.append(result)

        except Exception as exc:
            logger.exception("Unexpected error in login group %s", group.login_key)
            for acct in group.accounts:
                account_results.append(AccountResult(
                    account=acct,
                    status=RunStatus.FAILED,
                    error=f"Unexpected orchestrator error: {exc}",
                ))

        finally:
            try:
                await bu_browser.close()
            except Exception:
                pass
            await browser_proc.stop()

        return account_results

    async def _run_account_phases(
        self,
        account,
        job: JobConfig,
        workflow,
        bu_browser: Browser,
        checkpoint: CheckpointManager,
        group_phases: list[PhaseResult],
    ) -> AccountResult:
        """Run NAV -> PREPARE (optional) -> DOWNLOAD -> VALIDATE for one account."""
        all_phases = list(group_phases)

        # NAV
        nav = await self._run_phase(
            phase=Phase.NAV,
            task=workflow.get_nav_task(),
            workflow=workflow,
            bu_browser=bu_browser,
            job=job,
            checkpoint=checkpoint,
            login_key=account.login_key,
            account_last4=account.account_last4,
        )
        all_phases.append(nav)
        if nav.status == PhaseStatus.FAILED:
            return AccountResult(account=account, status=RunStatus.FAILED,
                                 error=nav.error, phases=all_phases)

        # PREPARE (optional — only if workflow declares it needed)
        if workflow.requires_prepare:
            prep = await self._run_phase(
                phase=Phase.PREPARE,
                task=workflow.get_prepare_task(account),
                workflow=workflow,
                bu_browser=bu_browser,
                job=job,
                checkpoint=checkpoint,
                login_key=account.login_key,
                account_last4=account.account_last4,
            )
            all_phases.append(prep)
            if prep.status == PhaseStatus.FAILED:
                return AccountResult(account=account, status=RunStatus.FAILED,
                                     error=prep.error, phases=all_phases)

        # DOWNLOAD
        dl = await self._run_phase(
            phase=Phase.DOWNLOAD,
            task=workflow.get_download_task(job.target_month),
            workflow=workflow,
            bu_browser=bu_browser,
            job=job,
            checkpoint=checkpoint,
            login_key=account.login_key,
            account_last4=account.account_last4,
        )
        all_phases.append(dl)
        if dl.status == PhaseStatus.FAILED:
            return AccountResult(account=account, status=RunStatus.FAILED,
                                 error=dl.error, phases=all_phases)

        # VALIDATE (pure Python — no Agent)
        output_path = await self._validate_download(job)
        if output_path:
            checkpoint.save_phase(
                account.login_key, account.account_last4, Phase.VALIDATE, PhaseStatus.SUCCESS,
                output_path=str(output_path)
            )
            return AccountResult(
                account=account,
                status=RunStatus.SUCCESS,
                output_path=output_path,
                phases=all_phases,
            )
        else:
            return AccountResult(
                account=account,
                status=RunStatus.FAILED,
                error="Validation failed — file missing or not a valid PDF",
                phases=all_phases,
            )

    async def _run_phase(
        self,
        phase: Phase,
        task: str,
        workflow,
        bu_browser: Browser,
        job: JobConfig,
        checkpoint: CheckpointManager,
        login_key: str,
        account_last4: str,
        max_retries: int = 1,
    ) -> PhaseResult:
        """Run one phase with retry logic. Returns a PhaseResult."""
        # Skip if already done (resume mode)
        if checkpoint.is_done(login_key, account_last4, phase):
            logger.info("Skipping %s/%s phase=%s (already done)", login_key, account_last4, phase)
            return PhaseResult(
                phase=phase,
                status=PhaseStatus.SKIPPED,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow(),
            )

        result = PhaseResult(phase=phase, status=PhaseStatus.RUNNING, started_at=datetime.utcnow())
        llm = self._get_llm(phase)
        controller = build_skills(phase, job)

        for attempt in range(max_retries + 1):
            try:
                agent = Agent(
                    task=task,
                    llm=llm,
                    browser=bu_browser,
                    controller=controller,
                    max_steps=workflow.max_steps_per_phase.get(phase.value, 10),
                    sensitive_data=self._build_sensitive_data(job),
                    use_vision="auto",
                )
                await agent.run()

                # Python-level success verification
                ok, meta = await workflow.verify_phase(phase, bu_browser, job)
                if ok:
                    result.status = PhaseStatus.SUCCESS
                    result.finished_at = datetime.utcnow()
                    result.metadata = meta
                    checkpoint.save_phase(login_key, account_last4, phase, PhaseStatus.SUCCESS)
                    return result
                else:
                    err = f"Phase verification failed: {meta.get('reason', 'unknown')}"
                    logger.warning("Phase %s attempt %d/%d failed: %s", phase, attempt + 1, max_retries + 1, err)
                    if attempt == max_retries:
                        result.status = PhaseStatus.FAILED
                        result.error = err
                        result.finished_at = datetime.utcnow()
                        checkpoint.save_phase(login_key, account_last4, phase, PhaseStatus.FAILED)
                        return result
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s backoff

            except Exception as exc:
                logger.exception("Phase %s attempt %d/%d raised exception", phase, attempt + 1, max_retries + 1)
                if attempt == max_retries:
                    result.status = PhaseStatus.FAILED
                    result.error = str(exc)
                    result.finished_at = datetime.utcnow()
                    checkpoint.save_phase(login_key, account_last4, phase, PhaseStatus.FAILED)
                    return result
                await asyncio.sleep(2 ** attempt)

        # Unreachable
        result.status = PhaseStatus.FAILED
        return result

    async def _validate_download(self, job: JobConfig) -> Path | None:
        """Pure-Python Phase 6. Returns output path or None on failure."""
        from .skills.statements import _build_expected_filename
        expected = _build_expected_filename(job)
        target = job.output_dir / expected
        if not target.exists():
            return None
        if target.stat().st_size < 10_000:
            return None
        if target.read_bytes()[:4] != b"%PDF":
            return None
        return target

    def _get_llm(self, phase: Phase):
        """Use Haiku for normal phases, Sonnet for error-prone phases."""
        from .config import MODEL_HAIKU, MODEL_SONNET
        heavy_phases = {Phase.POST_LOGIN}  # 2FA is complex; use Sonnet
        model = MODEL_SONNET if phase in heavy_phases else MODEL_HAIKU
        return ChatAnthropic(model=model, api_key=self.settings.anthropic_api_key)

    def _build_sensitive_data(self, job: JobConfig) -> dict[str, str]:
        """Build the BrowserUse sensitive_data dict.

        Keys use the x_ prefix convention so the LLM task string can
        reference them by placeholder name.

        The 'bu_2fa_code' suffix triggers BrowserUse's built-in TOTP
        generation when tfa_method is TOTP.
        """
        account = job.account
        data = {
            "x_username": account.username,
            "x_password": account.password,
        }
        if account.tfa_method == "totp" and account.tfa_detail:
            data["bu_2fa_code"] = account.tfa_detail
        return data

    def _make_job_config(
        self,
        account,
        target_month: str,
        output_dir: Path,
        browser_proc: BrowserProcess,
    ) -> JobConfig:
        return JobConfig(
            account=account,
            target_month=target_month,
            output_dir=output_dir,
            download_dir=self.settings.download_dir,
            profile_dir=self.settings.profiles_dir / f"{account.bank_name}__{account.username}",
            run_id=self._run_id,
        )
```

### 2.9 `src/banks/base.py`

```python
# src/banks/base.py

from abc import ABC, abstractmethod
from typing import Any

from browser_use import Browser

from ..models import JobConfig, LoginGroup, Phase


class BaseBankWorkflow(ABC):
    """Every bank implements this interface.

    The orchestrator calls get_*_task() methods to build the natural-language
    task string passed to each BrowserUse Agent. It calls verify_phase() after
    each Agent run to confirm success using Python-level assertions.

    Class attributes are declared here as typed slots; subclasses must set them.
    """

    # --- Class-level config (must be set by subclass) ---
    login_url:              str
    allowed_domains:        list[str]
    requires_prepare:       bool = False
    requires_residential_proxy: bool = False

    # Per-phase step budget. Login should be tight (6-8). Post-login looser (12).
    max_steps_per_phase: dict[str, int] = {
        "login":      8,
        "post_login": 12,
        "nav":        8,
        "prepare":    6,
        "download":   10,
    }

    # --- Task string generators (what Python tells the LLM to do) ---

    @abstractmethod
    def get_login_task(self, group: LoginGroup) -> str:
        """Return BrowserUse task string for the login phase.

        Must reference x_username and x_password by those exact placeholder
        names so BrowserUse's sensitive_data masking substitutes real values.
        """
        ...

    @abstractmethod
    def get_post_login_task(self) -> str:
        """Return task string for handling post-login state (2FA, modals, dashboard)."""
        ...

    @abstractmethod
    def get_nav_task(self) -> str:
        """Return task string for navigating from dashboard to statements page."""
        ...

    def get_prepare_task(self, account) -> str:
        """Return task string for account/card selection.

        Only called if requires_prepare is True. Default raises NotImplementedError
        so a subclass that sets requires_prepare=True must override this.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} sets requires_prepare=True "
            "but does not override get_prepare_task()"
        )

    @abstractmethod
    def get_download_task(self, target_month: str) -> str:
        """Return task string for downloading the target month's statement PDF.

        target_month is 'yyyy-mm' string (e.g. '2026-03').
        """
        ...

    # --- Success verification (Python-level assertions) ---

    async def verify_phase(
        self,
        phase: Phase,
        browser: Browser,
        job: JobConfig,
    ) -> tuple[bool, dict[str, Any]]:
        """Confirm a phase succeeded using Python browser assertions.

        Returns (success: bool, metadata: dict).
        metadata is logged and stored in PhaseResult.metadata.

        Default implementations use URL pattern matching. Subclasses may
        override specific phases for more precise checks.
        """
        if phase == Phase.LOGIN:
            return await self._verify_login(browser, job)
        if phase == Phase.POST_LOGIN:
            return await self._verify_post_login(browser, job)
        if phase == Phase.NAV:
            return await self._verify_nav(browser, job)
        if phase == Phase.PREPARE:
            return await self._verify_prepare(browser, job)
        if phase == Phase.DOWNLOAD:
            return await self._verify_download(browser, job)
        return True, {}

    async def _verify_login(self, browser, job) -> tuple[bool, dict]:
        """Default: confirm URL is no longer the login page."""
        url = await _get_url(browser)
        not_login = self.login_url not in url
        return not_login, {"url_after_login": url}

    async def _verify_post_login(self, browser, job) -> tuple[bool, dict]:
        """Default: confirm dashboard URL pattern is matched."""
        url = await _get_url(browser)
        return True, {"url_after_post_login": url}  # Subclasses can be stricter

    async def _verify_nav(self, browser, job) -> tuple[bool, dict]:
        """Default: URL contains 'statement' or 'document'."""
        url = await _get_url(browser)
        ok = any(kw in url.lower() for kw in ["statement", "document"])
        return ok, {"url_after_nav": url, "reason": "URL does not contain 'statement' or 'document'"}

    async def _verify_prepare(self, browser, job) -> tuple[bool, dict]:
        """Default: always succeeds (subclass overrides for card-specific checks)."""
        return True, {}

    async def _verify_download(self, browser, job) -> tuple[bool, dict]:
        """Default: check output file exists."""
        from ..skills.statements import _build_expected_filename
        expected = _build_expected_filename(job)
        path = job.output_dir / expected
        ok = path.exists() and path.stat().st_size > 0
        return ok, {"expected_file": str(path), "reason": "Output file missing or empty"}


async def _get_url(browser) -> str:
    """Extract current page URL from the BrowserUse Browser instance."""
    ...
```

### 2.10 `src/banks/__init__.py` — Registry

```python
# src/banks/__init__.py

from .base import BaseBankWorkflow

# Registry of all known banks. Key must match the bank_name column in clients.xlsx
# (case-insensitive, spaces normalized to underscores).
_REGISTRY: dict[str, type[BaseBankWorkflow]] = {}


def register_workflow(name: str):
    """Class decorator for registering a workflow in the global registry."""
    def decorator(cls: type[BaseBankWorkflow]) -> type[BaseBankWorkflow]:
        _REGISTRY[name.lower().replace(" ", "_")] = cls
        return cls
    return decorator


def load_workflow(bank_name: str) -> BaseBankWorkflow:
    """Return an instantiated workflow for the given bank name.

    bank_name is normalized: lowercased, spaces to underscores.
    Example: "American Express" -> "american_express"

    Raises ValueError if no workflow is registered for the bank.
    """
    # Trigger all workflow registrations via import
    from . import chase, amex, citi, mercury, wells_fargo, east_west, bofa, ubs  # noqa: F401

    key = bank_name.lower().replace(" ", "_")
    if key not in _REGISTRY:
        raise ValueError(
            f"No workflow registered for bank '{bank_name}'. "
            f"Known banks: {sorted(_REGISTRY.keys())}"
        )
    return _REGISTRY[key]()
```

### 2.11 `src/config.py`

```python
# src/config.py

from pathlib import Path
from pydantic_settings import BaseSettings


MODEL_HAIKU  = "claude-haiku-4-5"
MODEL_SONNET = "claude-sonnet-4-6"


class Settings(BaseSettings):
    """Loaded from environment variables and/or .env file."""

    anthropic_api_key:  str

    # Paths
    accounts_path:  Path = Path("clients.xlsx")
    output_dir:     Path = Path("output")
    profiles_dir:   Path = Path("profiles")
    download_dir:   Path = Path("downloads")
    checkpoint_dir: Path = Path("checkpoints")

    # Browser
    headless:   bool = False
    cdp_port_start: int = 9222

    # Optional integrations
    slack_webhook_url:  str | None = None
    dialpad_webhook_url: str | None = None  # local sidecar

    # Residential proxy (Chase/AmEx/BofA)
    proxy_url:  str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```

### 2.12 `src/run.py` — CLI entry point

```python
# src/run.py

import asyncio
import argparse
from pathlib import Path

from .config import Settings
from .orchestrator import Orchestrator


def main() -> None:
    parser = argparse.ArgumentParser(description="Bank Statement Automator v4")
    parser.add_argument("--month",  required=True, help="Target month: yyyy-mm (e.g. 2026-03)")
    parser.add_argument("--bank",   default=None,  help="Run only this bank (e.g. chase)")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--dry-run", action="store_true", help="Skip downloads, validate config only")
    args = parser.parse_args()

    settings = Settings()
    orchestrator = Orchestrator(settings)

    report = asyncio.run(orchestrator.run_all(
        accounts_path=settings.accounts_path,
        target_month=args.month,
        resume=args.resume,
    ))

    print(f"\nRun complete: {report.success_count}/{report.total_count} succeeded")


if __name__ == "__main__":
    main()
```

### 2.13 `src/report.py`

```python
# src/report.py

from pathlib import Path
from .models import RunReport, RunStatus


def generate_report(report: RunReport, output_dir: Path) -> None:
    """Write a human-readable summary to stdout and to output_dir/{run_id}_report.txt.

    Format:
        === Bank Statement Run: 2026-03 ===
        Run ID: 20260402_143022
        Duration: 42m 17s

        SUCCESS (12/15):
          Bossi_Sportswear__Citibank #8035   output/2026-03/...
          ...

        FAILED (2/15):
          SomeClient__Chase #4421            login failed: ...
          ...

        SKIPPED (1/15):
          OtherClient__Mercury #9917         already exists
    """
    ...
```

---

## 3. Data Flow

### 3.1 Account config: Excel -> Orchestrator -> Agent

```
clients.xlsx
    │
    ▼ excel_reader.read_accounts()
list[BankAccount]              # one per row; immutable Pydantic objects
    │
    ▼ excel_reader.group_by_login()
list[LoginGroup]               # grouped by (bank_name, username)
    │
    ▼ Orchestrator._run_login_group()
JobConfig                      # constructed per-account, holds paths + account ref
    │
    ├──► workflow.get_login_task(group) -> str
    │       # task string references 'x_username' / 'x_password' by placeholder
    │
    └──► Orchestrator._build_sensitive_data(job) -> dict[str, str]
             # {"x_username": "realuser", "x_password": "realpass"}
             # passed to Agent(sensitive_data=...) — never reaches LLM
```

### 3.2 Credentials and sensitive_data masking

```
BankAccount.username / .password
    │
    ▼ Orchestrator._build_sensitive_data()
{"x_username": "realuser", "x_password": "realpass",
 "bu_2fa_code": "TOTP_SECRET"}   # optional
    │
    ▼ Agent(sensitive_data=...)
    │
    ├── LLM sees task: "type x_username into the field"
    │       LLM never sees "realuser"
    │
    └── BrowserUse substitutes at execution time:
        browser.type("realuser")  # actual value typed into page
```

TOTP secrets follow the same pattern: the `bu_2fa_code` key is the special BrowserUse
signal that triggers automatic TOTP generation from the stored base32 secret, so the
LLM only ever sees the placeholder `bu_2fa_code` as a string reference.

Security questions and SMS codes are handled by custom `@controller.action` skills which
read from `JobConfig` directly (not via sensitive_data), since they're retrieved at
runtime during agent execution, not injected upfront.

### 3.3 Downloaded file flow

```
Chrome download directory  (e.g. downloads/)
    │   └── statement_raw.pdf   (or arbitrary bank-given filename)
    │
    ▼ save_downloaded_pdf skill (called by agent after download completes)
    │   1. _find_recent_download(download_dir, max_age=60s)
    │   2. _build_expected_filename(job)
    │        -> "Bossi_Sportswear__Citibank #8035 2026-03.pdf"
    │   3. file.rename(output_dir / expected_name)
    │
output/2026-03/Bossi_Sportswear__Citibank #8035 2026-03.pdf
    │
    ▼ validate_pdf skill (called immediately after save)
    │   1. Check file exists
    │   2. Check size 10KB - 50MB
    │   3. Check first 4 bytes == b"%PDF"
    │
    ▼ Orchestrator._validate_download() (pure Python, Phase.VALIDATE)
    │   Same checks as validate_pdf, run again independently
    │   Returns Path on success, None on failure
    │
AccountResult.output_path = Path("output/2026-03/...")
```

The double-validation (once by skill in the agent loop, once by Python in Phase.VALIDATE)
is intentional: the skill call is a fast in-loop check so the agent can retry if the download
is bad; the orchestrator's Python check is the authoritative gate before marking success.

### 3.4 Checkpoint state flow

```
Orchestrator._run_phase()
    │
    ├── CHECK: checkpoint.is_done(login_key, last4, phase)
    │       If True -> return PhaseResult(status=SKIPPED) immediately
    │
    ├── [Agent runs...]
    │
    ├── workflow.verify_phase() -> (ok, meta)
    │
    ├── If ok:
    │       checkpoint.save_phase(login_key, last4, phase, SUCCESS)
    │       -> atomic write to checkpoints/{run_id}.json
    │
    └── If not ok after max_retries:
            checkpoint.save_phase(login_key, last4, phase, FAILED)
            -> stored so operator can inspect which phase failed

On next run with --resume:
    CheckpointManager.find_resume_checkpoint(target_month)
    -> returns run_id of latest incomplete run
    -> orchestrator re-uses that run_id
    -> is_done() returns True for already-completed phases -> skipped
```

---

## 4. Class Hierarchy

### 4.1 Bank workflows

```
BaseBankWorkflow  (src/banks/base.py)
    Abstract methods: get_login_task, get_post_login_task,
                      get_nav_task, get_download_task
    Default implementations: verify_phase (URL-based)
    │
    ├── ChaseWorkflow       (banks/chase.py)   requires_residential_proxy=True
    │       Overrides: get_login_task (iframe), verify_post_login (dashboard URL)
    │
    ├── AmexWorkflow        (banks/amex.py)    requires_prepare=True
    │       Overrides: get_nav_task (hamburger menu), get_prepare_task (card picker)
    │
    ├── CitiWorkflow        (banks/citi.py)
    │       Overrides: get_login_task (two-step)
    │
    ├── MercuryWorkflow     (banks/mercury.py) API-based — overrides run() entirely
    │       Does NOT use BrowserUse. Calls MercuryAPIClient directly.
    │
    ├── WellsFargoWorkflow  (banks/wells_fargo.py)
    ├── EastWestWorkflow    (banks/east_west.py)
    ├── BofAWorkflow        (banks/bofa.py)    requires_residential_proxy=True
    └── UBSWorkflow         (banks/ubs.py)     tfa=push, request_human_input path
```

Note on `MercuryWorkflow`: because Mercury uses a REST API, it overrides the orchestrator
integration point differently. The cleanest approach is for `MercuryWorkflow` to implement
a `run(job: JobConfig) -> AccountResult` method, and for the orchestrator to check
`isinstance(workflow, APIBankWorkflow)` and call `workflow.run(job)` instead of the
phase-by-phase loop. This keeps the interface clean without forcing Mercury into the
browser-phase model.

```python
class APIBankWorkflow(BaseBankWorkflow):
    """Mixin for banks with REST API access. Orchestrator calls run() directly."""

    async def run(self, job: JobConfig) -> AccountResult:
        raise NotImplementedError


class MercuryWorkflow(APIBankWorkflow):
    async def run(self, job: JobConfig) -> AccountResult:
        client = MercuryAPIClient(api_key=job.account.tfa_detail)
        # tfa_detail holds the Mercury API key for API-based banks
        ...
```

### 4.2 Orchestrator relationship to BrowserUse Agent

```
Orchestrator
    │
    │  For each LoginGroup:
    ├── BrowserProcess.start()          # launches Patchright on port 9222
    │
    ├── Browser(cdp_url=...)            # BrowserUse connects via CDP
    │
    │  For each Phase in [LOGIN, POST_LOGIN, NAV, PREPARE, DOWNLOAD]:
    │   │
    │   ├── build_skills(phase, job)    # returns Controller with phase skills
    │   │
    │   ├── Agent(                      # new instance per phase
    │   │       task=workflow.get_*_task(),
    │   │       llm=ChatAnthropic(...),
    │   │       browser=bu_browser,     # same Browser object throughout group
    │   │       controller=controller,  # phase-specific skills
    │   │       max_steps=...,
    │   │       sensitive_data=...,
    │   │   )
    │   │
    │   ├── await agent.run()           # BrowserUse agent loop
    │   │
    │   └── workflow.verify_phase()     # Python asserts success
    │
    └── BrowserProcess.stop()
```

Key invariant: the `Browser` object is created once per LoginGroup and reused across all
phases. This preserves session cookies between phases (login state carries into nav,
nav state carries into download). A new `Agent` is created per phase so each phase gets
a fresh LLM context window and a restricted controller.

---

## 5. Skill Registration Pattern

### 5.1 Factory-closure approach

Skills do NOT use module-level `@controller.action` decorators. Instead, each skill is
a factory function that returns a closure bound to the current `JobConfig`. This design:

- Avoids global state (no shared controller instance)
- Ensures each phase gets a fresh controller with only relevant skills
- Allows skills to access job-specific data (paths, account details) without
  receiving them as LLM-controlled parameters
- Makes testing straightforward: call the factory with a mock `JobConfig`

```python
# Pattern for every skill

# WRONG — module-level registration creates global shared state:
controller = Controller()

@controller.action("Save the downloaded PDF")
async def save_downloaded_pdf(browser: BrowserContext) -> ActionResult:
    # Cannot access job config here — no closure
    ...


# RIGHT — factory returns closure bound to job:
def make_save_downloaded_pdf(job: JobConfig) -> Callable:
    async def save_downloaded_pdf(browser: BrowserContext) -> ActionResult:
        # job is in scope via closure
        recent = _find_recent_download(job.download_dir)
        ...
    return save_downloaded_pdf


# Registration in build_skills():
controller.action("Save the downloaded PDF statement with correct filename")(
    make_save_downloaded_pdf(job)
)
```

### 5.2 How BrowserUse invokes custom actions

BrowserUse's `Controller` stores a dict of `{description: callable}`. When the LLM
returns an action name matching a description, BrowserUse:

1. Calls the callable with any parameters the LLM provided as keyword arguments
2. If the function signature includes `browser: BrowserContext`, BrowserUse injects it
3. Returns the `ActionResult` to the agent loop

The LLM sees only the action's docstring description — not the Python function name or
signature. The description must be precise enough that the LLM knows exactly when to
call it.

### 5.3 Thread/async safety

All skill functions are `async def`. Because the orchestrator is a single-process
asyncio program (serial execution), there is no concurrent access to shared state.
The skills are stateless closures — they read from `job` (immutable Pydantic model)
and write only to the filesystem (`output_dir`, `download_dir`) or the log. No skill
holds mutable state between invocations.

The only potential concurrency hazard is `_find_recent_download()`, which scans the
download directory. This is safe as long as only one account is active at a time
(which is guaranteed by the serial orchestrator design documented in PLAN.md).

If parallelism is added later (multiple CDP ports, concurrent groups), each concurrent
group must use a separate `download_dir` to prevent the `_find_recent_download`
function from picking up files from a different account's download.

---

## 6. Error Handling Strategy

### 6.1 Failure taxonomy

```
Level 1: Transient failure
    Cause:  Network timeout, element not ready, DOM not yet loaded
    Signal: TimeoutError, ElementNotFoundError
    Action: Retry (exponential backoff: 1s, 2s, 4s) up to max_retries=1
    Max retries per phase: 1 (so 2 total attempts)

Level 2: State surprise
    Cause:  Unexpected modal, new promo page, session expired mid-run
    Signal: verify_phase() returns (False, {reason: ...})
    Action: Retry with a new Agent instance (fresh context)

Level 3: Skill failure
    Cause:  get_sms_code timeout, TOTP secret missing, security Q no match
    Signal: ActionResult(error=...)
    Action: Agent sees error in history, may call request_human_input as fallback

Level 4: Phase abort
    Cause:  max_retries exhausted, or agent hit max_steps without completing
    Signal: PhaseResult(status=FAILED, error=...)
    Action:
      - If phase == LOGIN or POST_LOGIN: abort entire LoginGroup (all accounts fail)
      - If phase == NAV, PREPARE, DOWNLOAD: fail this account, continue to next

Level 5: Login group abort
    Cause:  LOGIN or POST_LOGIN phase failed at Level 4
    Action: All accounts in the group get AccountResult(status=FAILED)
            Move on to next LoginGroup

Level 6: Unhandled exception
    Cause:  BrowserUse internal error, CDP connection lost, OS error
    Signal: Exception propagates out of _run_phase()
    Action: Caught in _run_login_group() try/except; entire group marked FAILED
            Browser and CDP process are cleaned up in finally block
```

### 6.2 Per-phase retry configuration

```python
# Retries are declared per phase, not per bank.
# All banks use the same retry counts — bank-specific issues are handled
# by increasing max_steps, not retries.

PHASE_RETRIES: dict[Phase, int] = {
    Phase.LOGIN:      1,    # 2 total attempts — login is idempotent (navigate back)
    Phase.POST_LOGIN: 1,    # 2FA may time out; retry once
    Phase.NAV:        1,
    Phase.PREPARE:    1,
    Phase.DOWNLOAD:   2,    # Downloads can fail transiently; 3 total attempts
    Phase.VALIDATE:   0,    # Pure Python — no retry (just fails fast)
}
```

### 6.3 What triggers retry vs skip vs abort

```
Condition                               Action
─────────────────────────────────────────────────────────────────
Agent raised exception (transient)      Retry (up to max_retries)
verify_phase() returned False           Retry (up to max_retries)
ActionResult(error=...) from skill      Agent loop continues (agent decides)
Agent hit max_steps                     verify_phase() will fail -> retry
max_retries exhausted                   Mark phase FAILED
Phase.LOGIN FAILED                      Abort LoginGroup (all accounts fail)
Phase.POST_LOGIN FAILED                 Abort LoginGroup
Phase.NAV FAILED                        Fail this account, next account continues
Phase.PREPARE FAILED                    Fail this account, next account continues
Phase.DOWNLOAD FAILED (3 attempts)      Fail this account, next account continues
Phase.VALIDATE FAILED                   Fail this account (download may be corrupt)
checkpoint.is_done() == True            Skip phase (resume mode)
```

### 6.4 Skill-level fallback chain

Within the POST_LOGIN phase, the agent task string instructs the LLM to follow this
fallback chain. The skills themselves return `ActionResult(error=...)` on failure,
which the agent sees in its history and uses to choose the next action.

```
2FA needed:
    Try generate_totp (if TOTP configured)
        -> Success: enter code
        -> Failure (no secret): try get_sms_code
    Try get_sms_code (if SMS configured)
        -> Success: enter code
        -> Failure (timeout): try wait_for_push
    Try wait_for_push
        -> Success: page transitions automatically
        -> Failure: call request_human_input
    request_human_input
        -> Human provides code: enter it
        -> Timeout (5 min): PhaseResult(FAILED)

Security question:
    answer_security_question(question_text)
        -> Match >= 75%: return answer
        -> No match: call request_human_input
    request_human_input
        -> Human provides answer: enter it
```

### 6.5 BrowserUse agent failures bubbling up

BrowserUse's `agent.run()` raises an exception if:
- `max_steps` is reached without the agent calling `done()` with success
- An action raises an unhandled exception inside the agent loop

Both cases are caught in `Orchestrator._run_phase()` and treated as level-1 failures
(retry up to `max_retries` times). The exception message is recorded in
`PhaseResult.error` for debugging.

BrowserUse's built-in `ActionLoopDetector` (5+ identical steps triggers a "nudge")
helps prevent the agent from spinning. The combination of `max_steps` (hard cap) and
`ActionLoopDetector` (soft nudge) means infinite loops are impossible.

---

## 7. Module Dependency Graph

```
run.py
  └── orchestrator.py
        ├── config.py
        ├── models.py
        ├── excel_reader.py
        │     └── models.py
        ├── checkpoint.py
        │     └── models.py
        ├── browser/launcher.py
        ├── skills/__init__.py  [build_skills]
        │     ├── models.py
        │     ├── skills/tfa.py
        │     ├── skills/statements.py
        │     └── skills/navigation.py
        ├── banks/__init__.py   [load_workflow]
        │     ├── banks/base.py
        │     │     └── models.py
        │     ├── banks/chase.py
        │     ├── banks/amex.py
        │     ├── banks/citi.py
        │     ├── banks/mercury.py
        │     │     └── mercury_api/client.py
        │     ├── banks/wells_fargo.py
        │     ├── banks/east_west.py
        │     ├── banks/bofa.py
        │     └── banks/ubs.py
        └── report.py
              └── models.py
```

Rules enforced by this graph:
- `models.py` has no project imports (pure Pydantic)
- `skills/*` do NOT import from `banks/*` (and vice versa)
- `banks/base.py` does NOT import from `skills/`
  (the orchestrator wires them together; banks define tasks, skills implement them)
- `orchestrator.py` is the only module that imports both `banks/` and `skills/`

---

## 8. File-by-File Implementation Notes

### `src/banks/chase.py`

```python
from .base import BaseBankWorkflow
from . import register_workflow


@register_workflow("chase")
class ChaseWorkflow(BaseBankWorkflow):
    login_url = "https://secure.chase.com/web/auth/dashboard"
    allowed_domains = ["*.chase.com"]
    requires_residential_proxy = True
    max_steps_per_phase = {
        "login":      8,    # iframe adds 2 extra steps
        "post_login": 12,   # 2FA always required
        "nav":        6,
        "prepare":    5,
        "download":   10,   # accordion + confirm dialog
    }

    def get_login_task(self, group) -> str:
        return (
            "You are on the Chase login page. "
            "The login form is inside a cross-origin iframe — switch into it first. "
            "Find the username field and type x_username. "
            "Find the password field and type x_password. "
            "Click the Sign In button. "
            "Wait for the page to change."
        )

    def get_post_login_task(self) -> str:
        return (
            "After login, Chase will likely show a verification prompt. "
            "If you see a code input field, call get_sms_code to retrieve the SMS code, "
            "type it in, and click Verify. "
            "If you see a push notification message, call wait_for_push. "
            "If you see 'Trust this device?', click Yes. "
            "If you see the main dashboard with account balances, you are done."
        )

    def get_nav_task(self) -> str:
        return (
            "From the Chase dashboard, find the 'Statements & Documents' link. "
            "It may be in the left navigation panel, under the account dropdown, "
            "or in a collapsed accordion labeled with the account name. "
            "Click it and wait for the statements list to load."
        )

    def get_download_task(self, target_month: str) -> str:
        return (
            f"First call check_already_downloaded. "
            f"If NOT_FOUND, find the statement for {target_month}. "
            f"The statements may be in an accordion — click to expand if needed. "
            f"Click the PDF download link or icon for that month. "
            f"If a confirmation dialog appears, click Download or Confirm. "
            f"After the download completes, call save_downloaded_pdf, then validate_pdf."
        )

    async def _verify_post_login(self, browser, job):
        url = await _get_url(browser)
        # Chase dashboard URLs contain 'dashboard' or 'activity'
        ok = any(kw in url for kw in ["dashboard", "activity", "accounts"])
        return ok, {"url": url, "reason": "Expected Chase dashboard URL"}
```

### `src/banks/mercury.py`

```python
from .base import APIBankWorkflow
from . import register_workflow
from ..mercury_api.client import MercuryAPIClient
from ..models import AccountResult, RunStatus, JobConfig


@register_workflow("mercury")
class MercuryWorkflow(APIBankWorkflow):
    login_url = ""          # not used
    allowed_domains = []    # not used

    async def run(self, job: JobConfig) -> AccountResult:
        api_key = job.account.tfa_detail   # Mercury API key stored in tfa_detail
        if not api_key:
            return AccountResult(
                account=job.account,
                status=RunStatus.FAILED,
                error="Mercury API key missing (set tfa_detail column)",
            )

        client = MercuryAPIClient(api_key=api_key)
        try:
            statements = await client.list_statements(account_id=job.account.account_last4)
            target = next(
                (s for s in statements if s.period == job.target_month), None
            )
            if not target:
                return AccountResult(
                    account=job.account,
                    status=RunStatus.FAILED,
                    error=f"Statement for {job.target_month} not found in Mercury API",
                )

            pdf_bytes = await client.download_statement(statement_id=target.id)
            job.output_dir.mkdir(parents=True, exist_ok=True)
            from ..skills.statements import _build_expected_filename
            dest = job.output_dir / _build_expected_filename(job)
            dest.write_bytes(pdf_bytes)

            return AccountResult(
                account=job.account,
                status=RunStatus.SUCCESS,
                output_path=dest,
            )
        except Exception as exc:
            return AccountResult(
                account=job.account,
                status=RunStatus.FAILED,
                error=f"Mercury API error: {exc}",
            )
```

### `src/mercury_api/client.py`

```python
# src/mercury_api/client.py

import httpx
from pydantic import BaseModel


class StatementSummary(BaseModel):
    id:     str
    period: str     # "yyyy-mm"
    url:    str


class MercuryAPIClient:
    BASE = "https://api.mercury.com/api/v1"

    def __init__(self, api_key: str) -> None:
        self._headers = {"Authorization": f"Bearer {api_key}"}

    async def list_statements(self, account_id: str) -> list[StatementSummary]:
        """GET /account/{account_id}/statements
        Returns list of StatementSummary ordered newest first."""
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE}/account/{account_id}/statements",
                headers=self._headers,
                timeout=30,
            )
            r.raise_for_status()
            return [StatementSummary(**s) for s in r.json()["statements"]]

    async def download_statement(self, statement_id: str) -> bytes:
        """GET /statement/{statement_id}/pdf — returns raw PDF bytes."""
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE}/statement/{statement_id}/pdf",
                headers=self._headers,
                timeout=60,
            )
            r.raise_for_status()
            return r.content
```

### `src/excel_reader.py` — Column parsing detail

The Excel file may have human-typed headers with inconsistent casing and spacing. The
reader normalizes headers before mapping, so "Client Name", "client name", and
"client_name" all resolve correctly. Security Q&A pairs are parsed from columns named
`security_q1 / security_a1`, `security_q2 / security_a2`, etc., up to however many are
present in the file. Missing pairs are silently skipped (not all accounts have security
questions).

### `src/checkpoint.py` — Resume logic

`find_resume_checkpoint(target_month)` scans all files in `checkpoints/` that contain
`target_month` in their content (via JSON parse), looks for runs where not all accounts
have `PhaseStatus.SUCCESS` on `Phase.VALIDATE`, and returns the `run_id` of the most
recent such run. If multiple incomplete checkpoints exist for the same month, the newest
one is used. If all phases are already SUCCESS for all accounts, returns `None`
(nothing to resume).

---

## Summary: Key Design Decisions

| Decision | Design |
|---|---|
| Skill access to JobConfig | Closure (factory returns bound async fn) — no global state |
| Controller instance | One per phase per account — never reused |
| sensitive_data | Built in Orchestrator._build_sensitive_data(); never passed through skill layer |
| TOTP via BrowserUse built-in | bu_2fa_code key in sensitive_data — LLM never sees secret |
| Per-phase agent instance | New Agent per phase — fresh LLM context, no cross-phase leakage |
| Browser session reuse | One Browser object per LoginGroup — session cookies preserved |
| verify_phase | Python-only URL/file assertions — LLM never declares its own success |
| Mercury | APIBankWorkflow subclass — bypasses entire browser/phase pipeline |
| Checkpoint atomicity | Write to .tmp then rename — no partial writes |
| Download validation | Double-check: once in DOWNLOAD phase (skill), once in VALIDATE (Python) |
| Error isolation | Phase failure -> account failure; LOGIN/POST_LOGIN failure -> group failure |
| Skill concurrency | Serial by design — safe; if parallelised later, separate download_dir per group |
