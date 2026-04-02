"""Orchestrator — the central coordinator for Bank Statement Automator v4.

Responsibilities:
  1. Dialpad pre-flight: log in to Dialpad once, keep the session alive so
     the get_sms_code skill can poll it during bank 2FA phases.
  2. For each LoginGroup: launch a browser, run login → post-login phases
     once, then nav → prepare (optional) → download → validate per account.
  3. Checkpoint after every phase so a crashed run can resume.
  4. Generate a summary report at the end.

Dialpad browser access:
    The get_sms_code skill needs the Dialpad page to poll for SMS codes.
    We store the live Dialpad BrowserUse Browser reference in a module-level
    slot (_dialpad_browser) and expose it via get_dialpad_browser().  The
    skills/tfa.py module imports this accessor when building the skill closure.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from browser_use import Agent, Browser
from browser_use.llm.litellm.chat import ChatLiteLLM

from .models import (
    AccountResult,
    BankAccount,
    JobConfig,
    LoginGroup,
    Phase,
    PhaseResult,
    PhaseStatus,
    RunReport,
    RunStatus,
)
from .checkpoint import CheckpointManager
from .excel_reader import read_accounts, group_by_login
from .browser.launcher import BrowserProcess, find_free_port
from .skills import build_skills
from .banks import load_workflow
from .banks.dialpad import (
    get_login_task as dialpad_login_task,
    get_tfa_prompt as dialpad_tfa_prompt,
    get_tfa_task as dialpad_tfa_task,
    get_inbox_task as dialpad_inbox_task,
    build_sensitive_data as dialpad_sensitive_data,
    LOGIN_URL as DIALPAD_LOGIN_URL,
)
from .config import Settings, MODEL_HAIKU, MODEL_SONNET
from .report import generate_report

logger = logging.getLogger("bank_puller.orchestrator")

# ---------------------------------------------------------------------------
# Module-level Dialpad browser reference
# ---------------------------------------------------------------------------

# The skills/tfa.py module uses this to poll the Dialpad inbox for SMS codes.
# Set by the orchestrator after the Dialpad pre-flight completes.
_dialpad_browser: Optional[Browser] = None


def get_dialpad_browser() -> Optional[Browser]:
    """Return the live Dialpad BrowserUse Browser, or None if not initialised."""
    return _dialpad_browser


def _set_dialpad_browser(browser: Optional[Browser]) -> None:
    global _dialpad_browser
    _dialpad_browser = browser


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class Orchestrator:
    """Drives the full batch run.

    Usage:
        orchestrator = Orchestrator(settings)
        report = await orchestrator.run_all(
            accounts_path=Path("clients.xlsx"),
            target_month="2026-03",
        )
    """

    def __init__(
        self,
        settings: Settings,
        bank_filter: Optional[str] = None,
        account_filter: Optional[str] = None,
    ) -> None:
        self.settings = settings
        self.bank_filter = bank_filter.lower() if bank_filter else None
        self.account_filter = account_filter
        self._run_id: str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        self._started_at: datetime = datetime.utcnow()

        # Dialpad browser lifecycle resources (populated during pre-flight)
        self._dialpad_proc: Optional[BrowserProcess] = None
        self._dialpad_bu_browser: Optional[Browser] = None

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run_all(
        self,
        accounts_path: Path,
        target_month: str,
        resume: bool = False,
    ) -> RunReport:
        """Main entry point.

        1. Read Excel.
        2. Optionally resume from checkpoint.
        3. Run Dialpad pre-flight.
        4. Process each LoginGroup.
        5. Tear down Dialpad session.
        6. Generate and return report.
        """
        accounts = read_accounts(accounts_path)

        # Apply CLI filters
        if self.bank_filter:
            accounts = [a for a in accounts if a.bank_name.lower() == self.bank_filter]
        if self.account_filter:
            accounts = [a for a in accounts if a.account_last4 == self.account_filter]

        if not accounts:
            logger.warning("No accounts match the given filters — nothing to do.")
            return RunReport(
                run_id=self._run_id,
                target_month=target_month,
                started_at=self._started_at,
                finished_at=datetime.utcnow(),
                results=[],
            )

        login_groups = group_by_login(accounts)

        # Checkpoint: resume from existing run or start fresh
        run_id = self._run_id
        if resume:
            existing = CheckpointManager.find_resume_checkpoint(
                target_month,
                checkpoint_dir=self.settings.checkpoint_dir,
            )
            if existing:
                logger.info("Resuming from checkpoint run_id=%s", existing)
                run_id = existing

        checkpoint = CheckpointManager(
            run_id=run_id,
            target_month=target_month,
            checkpoint_dir=self.settings.checkpoint_dir,
        )
        self._run_id = run_id

        results: list[AccountResult] = []

        # Dialpad pre-flight (only if any bank uses SMS 2FA)
        needs_dialpad = any(
            a.tfa_method.value == "sms" for group in login_groups for a in group.accounts
        )
        if needs_dialpad:
            try:
                await self._run_dialpad_preflight()
            except Exception as exc:
                logger.error("Dialpad pre-flight failed: %s", exc)
                logger.warning(
                    "Continuing without Dialpad — SMS 2FA will fall back to "
                    "request_human_input if codes cannot be retrieved."
                )

        try:
            for group in login_groups:
                group_results = await self._run_login_group(
                    group=group,
                    target_month=target_month,
                    checkpoint=checkpoint,
                )
                results.extend(group_results)
        finally:
            await self._teardown_dialpad()

        report = RunReport(
            run_id=self._run_id,
            target_month=target_month,
            started_at=self._started_at,
            finished_at=datetime.utcnow(),
            results=results,
        )

        generate_report(report, self.settings.output_dir / target_month)
        return report

    # ------------------------------------------------------------------
    # Dialpad pre-flight
    # ------------------------------------------------------------------

    async def _run_dialpad_preflight(self) -> None:
        """Log in to Dialpad and keep the session alive.

        Steps:
          1. Launch a dedicated Chromium process.
          2. Attach BrowserUse Browser to it.
          3. Run the LOGIN agent with Dialpad credentials from env.
          4. If Dialpad shows a 2FA prompt, ask the operator via CLI input().
          5. Navigate to the messages inbox.
        """
        email = self.settings.dialpad_email
        password = self.settings.dialpad_password

        if not email or not password:
            raise ValueError(
                "DIALPAD_EMAIL and DIALPAD_PASSWORD must be set in the environment "
                "to use Dialpad SMS interception."
            )

        cdp_port = find_free_port(
            start=self.settings.cdp_port_start,
            end=self.settings.cdp_port_start + 77,
        )
        profile_dir = self.settings.profiles_dir / "dialpad"
        profile_dir.mkdir(parents=True, exist_ok=True)

        self._dialpad_proc = BrowserProcess(
            cdp_port=cdp_port,
            profile_dir=profile_dir,
            headless=self.settings.headless,
        )

        logger.info("Starting Dialpad browser on CDP port %d ...", cdp_port)
        await self._dialpad_proc.start()

        self._dialpad_bu_browser = Browser(
            cdp_url=self._dialpad_proc.cdp_url,
            keep_alive=True,
        )

        # Make the browser accessible to the get_sms_code skill
        _set_dialpad_browser(self._dialpad_bu_browser)

        sensitive = dialpad_sensitive_data(email, password)
        haiku = ChatLiteLLM(model=MODEL_HAIKU)

        # Step 1: Login
        logger.info("Logging into Dialpad ...")
        login_agent = Agent(
            task=dialpad_login_task(),
            llm=haiku,
            browser=self._dialpad_bu_browser,
            max_steps=10,
            sensitive_data=sensitive,
        )
        await login_agent.run()

        # Step 2: 2FA (if Dialpad shows one — some profiles skip it after trust)
        page = await self._dialpad_bu_browser.get_current_page()
        current_url = page.url

        # Heuristic: if still on accounts/login, Dialpad wants a 2FA code
        if "login" in current_url.lower() or "verify" in current_url.lower():
            prompt_text = dialpad_tfa_prompt()
            print(f"\n{'='*60}")
            print(f"DIALPAD 2FA REQUIRED")
            print(f"{'='*60}")

            loop = asyncio.get_event_loop()
            code = await asyncio.wait_for(
                loop.run_in_executor(None, input, prompt_text),
                timeout=300,
            )
            code = code.strip()

            if code:
                tfa_agent = Agent(
                    task=dialpad_tfa_task(code),
                    llm=haiku,
                    browser=self._dialpad_bu_browser,
                    max_steps=8,
                )
                await tfa_agent.run()

        # Step 3: Navigate to inbox
        logger.info("Navigating Dialpad to messages inbox ...")
        inbox_agent = Agent(
            task=dialpad_inbox_task(),
            llm=haiku,
            browser=self._dialpad_bu_browser,
            max_steps=8,
        )
        await inbox_agent.run()

        logger.info("Dialpad pre-flight complete — inbox ready.")

    async def _teardown_dialpad(self) -> None:
        """Close the Dialpad browser session."""
        _set_dialpad_browser(None)

        self._dialpad_bu_browser = None

        if self._dialpad_proc is not None:
            await self._dialpad_proc.stop()
            self._dialpad_proc = None

    # ------------------------------------------------------------------
    # Login group processing
    # ------------------------------------------------------------------

    async def _run_login_group(
        self,
        group: LoginGroup,
        target_month: str,
        checkpoint: CheckpointManager,
    ) -> list[AccountResult]:
        """Run all phases for one login group (one shared browser session)."""
        workflow = load_workflow(group.bank_name)

        # API-based banks (Mercury) skip the browser entirely
        if workflow.is_api_based:
            return await self._run_api_group(group, target_month, checkpoint, workflow)

        output_dir = self.settings.output_dir / target_month
        profile_dir = (
            self.settings.profiles_dir
            / f"{group.bank_name}__{group.username}"
        )

        cdp_port = find_free_port(
            start=self.settings.cdp_port_start,
            end=self.settings.cdp_port_start + 77,
        )

        proxy = self.settings.proxy_url if workflow.requires_residential_proxy else None

        browser_proc = BrowserProcess(
            cdp_port=cdp_port,
            profile_dir=profile_dir,
            headless=self.settings.headless,
            proxy=proxy,
            download_dir=self.settings.download_dir,
        )

        account_results: list[AccountResult] = []

        try:
            logger.info(
                "Starting browser for %s (port %d, proxy=%s) ...",
                group.login_key, cdp_port, bool(proxy),
            )
            await browser_proc.start()

            bu_browser = Browser(
                cdp_url=browser_proc.cdp_url,
                keep_alive=True,
                allowed_domains=workflow.allowed_domains,
            )

            try:
                # Phase 1: LOGIN (shared — once per login group)
                shared_job = self._make_job_config(
                    group.accounts[0], target_month, output_dir, browser_proc
                )
                login_result = await self._run_phase(
                    phase=Phase.LOGIN,
                    task=workflow.get_login_task(group),
                    workflow=workflow,
                    bu_browser=bu_browser,
                    job=shared_job,
                    checkpoint=checkpoint,
                    login_key=group.login_key,
                    account_last4="shared",
                    max_retries=self.settings.max_retries_per_phase,
                )

                if login_result.status == PhaseStatus.FAILED:
                    logger.error(
                        "Login failed for %s: %s", group.login_key, login_result.error
                    )
                    for acct in group.accounts:
                        account_results.append(AccountResult(
                            account=acct,
                            status=RunStatus.FAILED,
                            error=f"Login failed: {login_result.error}",
                            phases=[login_result],
                        ))
                    return account_results

                # Phase 2: POST-LOGIN / 2FA (shared — once per login group)
                post_login_result = await self._run_phase(
                    phase=Phase.POST_LOGIN,
                    task=workflow.get_post_login_task(),
                    workflow=workflow,
                    bu_browser=bu_browser,
                    job=shared_job,
                    checkpoint=checkpoint,
                    login_key=group.login_key,
                    account_last4="shared",
                    max_retries=self.settings.max_retries_per_phase,
                )

                if post_login_result.status == PhaseStatus.FAILED:
                    logger.error(
                        "Post-login failed for %s: %s",
                        group.login_key, post_login_result.error,
                    )
                    for acct in group.accounts:
                        account_results.append(AccountResult(
                            account=acct,
                            status=RunStatus.FAILED,
                            error=f"Post-login/2FA failed: {post_login_result.error}",
                            phases=[login_result, post_login_result],
                        ))
                    return account_results

                # Phases 3-6: per account
                for account in group.accounts:
                    job = self._make_job_config(
                        account, target_month, output_dir, browser_proc
                    )
                    result = await self._run_account_phases(
                        account=account,
                        job=job,
                        workflow=workflow,
                        bu_browser=bu_browser,
                        checkpoint=checkpoint,
                        group_phases=[login_result, post_login_result],
                    )
                    account_results.append(result)

            finally:
                pass  # BrowserProcess.stop() handles Chrome termination

        except Exception as exc:
            logger.exception(
                "Unexpected error in login group %s", group.login_key
            )
            for acct in group.accounts:
                if not any(r.account == acct for r in account_results):
                    account_results.append(AccountResult(
                        account=acct,
                        status=RunStatus.FAILED,
                        error=f"Unexpected orchestrator error: {exc}",
                    ))

        finally:
            await browser_proc.stop()

        return account_results

    async def _run_api_group(
        self,
        group: LoginGroup,
        target_month: str,
        checkpoint: CheckpointManager,
        workflow: object,
    ) -> list[AccountResult]:
        """Handle API-based banks (e.g. Mercury) that bypass the browser."""
        output_dir = self.settings.output_dir / target_month
        results: list[AccountResult] = []

        for account in group.accounts:
            job = JobConfig(
                account=account,
                target_month=target_month,
                output_dir=output_dir,
                download_dir=self.settings.download_dir,
                profile_dir=self.settings.profiles_dir / f"{account.bank_name}__{account.username}",
                run_id=self._run_id,
            )

            # Skip if already downloaded (checked via checkpoint or file existence)
            from .skills.statements import _build_expected_filename
            expected = _build_expected_filename(job)
            if (output_dir / expected).exists():
                logger.info("API bank %s/%s already downloaded, skipping.", account.bank_name, account.account_last4)
                results.append(AccountResult(
                    account=account,
                    status=RunStatus.ALREADY_EXISTS,
                    output_path=output_dir / expected,
                    error="File already exists",
                ))
                continue

            try:
                logger.info(
                    "Running API workflow for %s / %s ...",
                    account.bank_name, account.account_last4,
                )
                output_dir.mkdir(parents=True, exist_ok=True)
                await workflow.run(job)

                # Confirm the file was actually written
                output_path = output_dir / expected
                if output_path.exists() and output_path.stat().st_size > 0:
                    checkpoint.save_phase(
                        account.login_key,
                        account.account_last4,
                        Phase.DOWNLOAD,
                        PhaseStatus.SUCCESS,
                        output_path=str(output_path),
                    )
                    results.append(AccountResult(
                        account=account,
                        status=RunStatus.SUCCESS,
                        output_path=output_path,
                    ))
                else:
                    raise RuntimeError(
                        f"API workflow completed but output file not found: {output_path}"
                    )

            except Exception as exc:
                logger.exception(
                    "API workflow failed for %s / %s",
                    account.bank_name, account.account_last4,
                )
                checkpoint.save_phase(
                    account.login_key,
                    account.account_last4,
                    Phase.DOWNLOAD,
                    PhaseStatus.FAILED,
                )
                results.append(AccountResult(
                    account=account,
                    status=RunStatus.FAILED,
                    error=str(exc),
                ))

        return results

    # ------------------------------------------------------------------
    # Per-account phases (NAV → PREPARE → DOWNLOAD → VALIDATE)
    # ------------------------------------------------------------------

    async def _run_account_phases(
        self,
        account: BankAccount,
        job: JobConfig,
        workflow: object,
        bu_browser: Browser,
        checkpoint: CheckpointManager,
        group_phases: list[PhaseResult],
    ) -> AccountResult:
        """Run NAV → PREPARE (optional) → DOWNLOAD → VALIDATE for one account."""
        all_phases: list[PhaseResult] = list(group_phases)
        start_time = datetime.utcnow()

        # NAV
        nav_result = await self._run_phase(
            phase=Phase.NAV,
            task=workflow.get_nav_task(),
            workflow=workflow,
            bu_browser=bu_browser,
            job=job,
            checkpoint=checkpoint,
            login_key=account.login_key,
            account_last4=account.account_last4,
            max_retries=self.settings.max_retries_per_phase,
        )
        all_phases.append(nav_result)

        if nav_result.status == PhaseStatus.FAILED:
            duration = (datetime.utcnow() - start_time).total_seconds()
            return AccountResult(
                account=account,
                status=RunStatus.FAILED,
                error=f"Navigation failed: {nav_result.error}",
                phases=all_phases,
                duration_sec=duration,
            )

        # PREPARE (only for banks that require card/account selection)
        if workflow.requires_prepare:
            prepare_result = await self._run_phase(
                phase=Phase.PREPARE,
                task=workflow.get_prepare_task(account),
                workflow=workflow,
                bu_browser=bu_browser,
                job=job,
                checkpoint=checkpoint,
                login_key=account.login_key,
                account_last4=account.account_last4,
                max_retries=self.settings.max_retries_per_phase,
            )
            all_phases.append(prepare_result)

            if prepare_result.status == PhaseStatus.FAILED:
                duration = (datetime.utcnow() - start_time).total_seconds()
                return AccountResult(
                    account=account,
                    status=RunStatus.FAILED,
                    error=f"Prepare (card selection) failed: {prepare_result.error}",
                    phases=all_phases,
                    duration_sec=duration,
                )

        # DOWNLOAD
        download_result = await self._run_phase(
            phase=Phase.DOWNLOAD,
            task=workflow.get_download_task(job.target_month),
            workflow=workflow,
            bu_browser=bu_browser,
            job=job,
            checkpoint=checkpoint,
            login_key=account.login_key,
            account_last4=account.account_last4,
            max_retries=self.settings.max_retries_per_phase,
        )
        all_phases.append(download_result)

        if download_result.status == PhaseStatus.FAILED:
            duration = (datetime.utcnow() - start_time).total_seconds()
            return AccountResult(
                account=account,
                status=RunStatus.FAILED,
                error=f"Download failed: {download_result.error}",
                phases=all_phases,
                duration_sec=duration,
            )

        # VALIDATE (pure Python — no Agent)
        output_path = self._validate_download(job)
        duration = (datetime.utcnow() - start_time).total_seconds()

        if output_path is not None:
            checkpoint.save_phase(
                account.login_key,
                account.account_last4,
                Phase.VALIDATE,
                PhaseStatus.SUCCESS,
                output_path=str(output_path),
            )
            return AccountResult(
                account=account,
                status=RunStatus.SUCCESS,
                output_path=output_path,
                phases=all_phases,
                duration_sec=duration,
            )

        # Validate failed
        checkpoint.save_phase(
            account.login_key,
            account.account_last4,
            Phase.VALIDATE,
            PhaseStatus.FAILED,
        )
        return AccountResult(
            account=account,
            status=RunStatus.FAILED,
            error="Validation failed — file missing, too small, or not a PDF",
            phases=all_phases,
            duration_sec=duration,
        )

    # ------------------------------------------------------------------
    # Single phase runner (with retry)
    # ------------------------------------------------------------------

    async def _run_phase(
        self,
        phase: Phase,
        task: str,
        workflow: object,
        bu_browser: Browser,
        job: JobConfig,
        checkpoint: CheckpointManager,
        login_key: str,
        account_last4: str,
        max_retries: int = 1,
    ) -> PhaseResult:
        """Run one automation phase with up to max_retries retry attempts.

        Skips immediately if checkpoint shows this phase already succeeded
        (resume-mode behaviour).

        Returns a PhaseResult with SUCCESS, FAILED, or SKIPPED status.
        """
        # Resume: skip phases already completed
        if checkpoint.is_done(login_key, account_last4, phase):
            logger.info(
                "Skipping %s / %s / %s (already done in checkpoint)",
                login_key, account_last4, phase.value,
            )
            return PhaseResult(
                phase=phase,
                status=PhaseStatus.SKIPPED,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow(),
            )

        result = PhaseResult(
            phase=phase,
            status=PhaseStatus.RUNNING,
            started_at=datetime.utcnow(),
        )

        llm = self._get_llm(phase)
        controller = build_skills(phase, job)

        for attempt in range(max_retries + 1):
            if attempt > 0:
                backoff = 2 ** (attempt - 1)   # 1s, 2s, 4s ...
                logger.info(
                    "Retrying %s / %s phase=%s in %ds (attempt %d/%d)",
                    login_key, account_last4, phase.value,
                    backoff, attempt + 1, max_retries + 1,
                )
                await asyncio.sleep(backoff)

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

                logger.info(
                    "Running phase %s for %s / %s (attempt %d)",
                    phase.value, login_key, account_last4, attempt + 1,
                )
                await agent.run()

                # Python-level verification
                ok, meta = await workflow.verify_phase(phase, bu_browser, job)

                if ok:
                    result.status = PhaseStatus.SUCCESS
                    result.finished_at = datetime.utcnow()
                    result.metadata = meta
                    checkpoint.save_phase(
                        login_key, account_last4, phase, PhaseStatus.SUCCESS
                    )
                    logger.info(
                        "Phase %s succeeded for %s / %s",
                        phase.value, login_key, account_last4,
                    )
                    return result

                # Verification failed — may retry
                err = meta.get("reason", "Phase verification returned False")
                logger.warning(
                    "Phase %s verification failed for %s / %s: %s",
                    phase.value, login_key, account_last4, err,
                )

                if attempt == max_retries:
                    result.status = PhaseStatus.FAILED
                    result.error = err
                    result.finished_at = datetime.utcnow()
                    result.metadata = meta
                    checkpoint.save_phase(
                        login_key, account_last4, phase, PhaseStatus.FAILED
                    )
                    return result

            except Exception as exc:
                logger.exception(
                    "Phase %s raised exception for %s / %s (attempt %d)",
                    phase.value, login_key, account_last4, attempt + 1,
                )
                if attempt == max_retries:
                    result.status = PhaseStatus.FAILED
                    result.error = str(exc)
                    result.finished_at = datetime.utcnow()
                    checkpoint.save_phase(
                        login_key, account_last4, phase, PhaseStatus.FAILED
                    )
                    return result

        # Unreachable (loop always returns inside), but satisfies type checker
        result.status = PhaseStatus.FAILED
        result.error = "Phase exhausted retries without returning"
        result.finished_at = datetime.utcnow()
        return result

    # ------------------------------------------------------------------
    # Validate download (pure Python — Phase 6)
    # ------------------------------------------------------------------

    def _validate_download(self, job: JobConfig) -> Optional[Path]:
        """Return the output path if the downloaded file is a valid PDF, else None."""
        from .skills.statements import _build_expected_filename

        expected = _build_expected_filename(job)
        target = job.output_dir / expected

        if not target.exists():
            logger.warning("Validate: expected file not found: %s", target)
            return None

        size = target.stat().st_size
        if size < 10_000:
            logger.warning("Validate: file too small (%d bytes): %s", size, target)
            return None

        if size > 50_000_000:
            logger.warning("Validate: file suspiciously large (%d bytes): %s", size, target)
            return None

        magic = target.read_bytes()[:4]
        if magic != b"%PDF":
            logger.warning(
                "Validate: not a PDF (magic=%r): %s", magic, target
            )
            return None

        logger.info("Validate: %s OK (%d KB)", target.name, size // 1024)
        return target

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_llm(self, phase: Phase) -> ChatLiteLLM:
        """Use Sonnet for 2FA (complex), Haiku for all other phases."""
        heavy_phases = {Phase.POST_LOGIN}
        model = MODEL_SONNET if phase in heavy_phases else MODEL_HAIKU
        return ChatLiteLLM(model=model)

    def _build_sensitive_data(self, job: JobConfig) -> dict[str, str]:
        """Build the BrowserUse sensitive_data dict.

        The x_ prefix is the convention used in all task strings so BrowserUse
        can mask real credential values — the LLM only ever sees the placeholder
        names x_username and x_password.

        bu_2fa_code is the special BrowserUse TOTP trigger key: when present,
        BrowserUse generates a live TOTP code from the stored secret whenever
        the agent needs it, without the LLM ever seeing the secret itself.
        """
        account = job.account
        data: dict[str, str] = {
            "x_username": account.username,
            "x_password": account.password,
        }
        if account.tfa_method.value == "totp" and account.tfa_detail:
            data["bu_2fa_code"] = account.tfa_detail
        return data

    def _make_job_config(
        self,
        account: BankAccount,
        target_month: str,
        output_dir: Path,
        browser_proc: BrowserProcess,
    ) -> JobConfig:
        return JobConfig(
            account=account,
            target_month=target_month,
            output_dir=output_dir,
            download_dir=self.settings.download_dir,
            profile_dir=(
                self.settings.profiles_dir
                / f"{account.bank_name}__{account.username}"
            ),
            run_id=self._run_id,
        )
