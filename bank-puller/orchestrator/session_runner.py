"""Session runner — state machine per browser window."""
from __future__ import annotations

import asyncio
import sys
import time
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from config import DOWNLOADS_DIR, TIMEOUTS
from orchestrator.excel_reader import AccountJob, ExcelManager, RunResult
from orchestrator.job_scheduler import WindowSchedule
from orchestrator.shutdown import GracefulShutdown
from orchestrator.tfa_interceptor import poll_dialpad_sms, get_totp_code, wait_for_push_approval
from orchestrator.action_logger import (
    ActionLogger, log_action, set_context, clear_context,
)
from orchestrator.playbook import (
    Playbook, PlaybookRecorder, PlaybookStep,
    load_playbook, save_playbook, is_fresh,
    try_step, discover_selector,
)
from ai_skills.base import AISkillResult, get_cost_summary, runner
from ai_skills.navigation import skill_classify_page, skill_find_element, skill_handle_obstacle
from ai_skills.discovery import skill_discover_login_url
from ai_skills.security import skill_match_security_question, skill_select_2fa_option
from ai_skills.statements import skill_find_statements_page, skill_select_statement
from ai_skills.validation import skill_validate_statement

from ai_skills.base import verified_click
from utils.browser_setup import (
    human_click,
    human_delay,
    human_type,
    wait_and_screenshot,
    monitor_new_pages,
)
from utils.file_manager import (
    clear_download_dir,
    find_downloaded_pdf,
    organize_statement,
    organize_combined_statement,
)
from utils.pdf_validator import is_valid_pdf, extract_pdf_text, detect_multi_account
from utils.logger import log

if TYPE_CHECKING:
    from patchright.async_api import BrowserContext, Page


def _get_target_month() -> str:
    """Return previous calendar month as 'yyyy-mm'."""
    today = date.today()
    if today.month == 1:
        return f"{today.year - 1}-12"
    return f"{today.year}-{today.month - 1:02d}"


# ---------------------------------------------------------------------------
# Watch mode controller
# ---------------------------------------------------------------------------
class WatchController:
    """Pauses after AI calls for operator review when --watch is set."""

    def __init__(self, enabled: bool = False):
        self.enabled = enabled

    async def pause(self, wid: int, bank: str, mode: str, skill: str, description: str,
                    confidence: float, cost: float, next_action: str) -> str:
        """Show status and wait for operator input. Returns 'continue', 'skip', or 'quit'."""
        if not self.enabled:
            return "continue"

        import sys
        if hasattr(sys.stdout, 'reconfigure'):
            try:
                sys.stdout.reconfigure(errors='replace')
            except Exception:
                pass

        mode_label = f"{mode.upper()} mode" + (" (no playbook)" if mode == "learn" else "")
        print(f"\n[W{wid}] {bank} -- {mode_label}")
        print(f"  [OK] {skill}: \"{description}\" conf={confidence:.2f} ${cost:.4f}")
        print(f"  -> {next_action}")
        print(f"  [Enter] continue | [s] skip this account | [q] abort run")

        # Read stdin in a thread to not block the event loop
        loop = asyncio.get_event_loop()
        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: input("  > ").strip().lower()),
                timeout=300,  # 5-minute timeout
            )
        except (asyncio.TimeoutError, EOFError):
            return "continue"

        if response == "s":
            return "skip"
        elif response == "q":
            return "quit"
        return "continue"


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
async def run_window(
    context: BrowserContext,
    schedule: WindowSchedule,
    mgr: ExcelManager,
    shutdown: GracefulShutdown,
    tfa_semaphore: asyncio.Semaphore,
    excel_write_lock: asyncio.Lock,
    dialpad_page: Page | None = None,
    action_logger: ActionLogger | None = None,
    watch_mode: bool = False,
    relearn: bool = False,
) -> None:
    """Run all jobs assigned to this browser window."""
    page = context.pages[0] if context.pages else await context.new_page()
    target_month = _get_target_month()
    watch = WatchController(enabled=watch_mode)

    # Group jobs by (bank, username) so we can batch multiple accounts per login
    by_login: dict[tuple[str, str], list[AccountJob]] = defaultdict(list)
    for job in schedule.jobs:
        by_login[(job.bank_name, job.username)].append(job)

    # Warn if the same bank appears with multiple usernames (data issue in clients.xlsx)
    banks_seen: dict[str, list[str]] = defaultdict(list)
    for (bank, user) in by_login:
        banks_seen[bank].append(user)
    for bank, users in banks_seen.items():
        if len(users) > 1:
            log.warning(
                f"[W{schedule.window_id}] Bank '{bank}' has {len(users)} distinct usernames — "
                f"this causes {len(users)} sequential login attempts. "
                f"If these share one login, consolidate in clients.xlsx. Usernames: {users}"
            )

    for (bank, _user), login_jobs in by_login.items():
        if shutdown.should_stop:
            for j in login_jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Interrupted by operator")
            break

        log.info(f"[W{schedule.window_id}] Starting {bank} ({len(login_jobs)} accounts)")

        # Use first job for login credentials (all share same bank+username)
        lead_job = login_jobs[0]

        # Set action logger context
        if action_logger:
            set_context(
                action_logger,
                window_id=schedule.window_id,
                client=lead_job.client_name,
                bank=bank,
                last4=lead_job.account_last4,
            )

        session_timeout = TIMEOUTS["session_total"] / 1000

        try:
            success = await asyncio.wait_for(
                _login_and_download(
                    page, login_jobs, target_month, schedule, mgr, excel_write_lock,
                    tfa_semaphore, dialpad_page, shutdown, watch, relearn, context,
                ),
                timeout=session_timeout,
            )
        except asyncio.TimeoutError:
            log.warning(f"[W{schedule.window_id}] Session timeout for {bank}")
            for j in login_jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Session timeout")
        except Exception as e:
            log.error(f"[W{schedule.window_id}] Unexpected error for {bank}: {e}")
            for j in login_jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", f"Error: {e}")

    clear_context()


async def _login_and_download(
    page: Page,
    jobs: list[AccountJob],
    target_month: str,
    schedule: WindowSchedule,
    mgr: ExcelManager,
    excel_write_lock: asyncio.Lock,
    tfa_semaphore: asyncio.Semaphore,
    dialpad_page: Page | None,
    shutdown: GracefulShutdown,
    watch: WatchController,
    relearn: bool,
    context: BrowserContext,
) -> bool:
    """Core login → navigate → download flow, decomposed into phases."""
    lead = jobs[0]
    wid = schedule.window_id
    _session_start = time.time()

    # --- PLAYBOOK SETUP ---
    playbook = None if relearn else load_playbook(lead.bank_name)
    mode = "replay" if playbook and is_fresh(playbook) else "learn"
    recorder = PlaybookRecorder() if mode == "learn" else None

    log.info(f"[W{wid}] Mode: {mode}" + (f" (playbook v{playbook.version}, {playbook.success_count} successes)" if playbook and mode == "replay" else ""))
    log_action(type="session_start", mode=mode, note=f"bank={lead.bank_name}")

    # --- Phase 1: URL + Navigate ---
    ok = await _phase_navigate(page, lead, jobs, target_month, wid, mgr, excel_write_lock, recorder, start_time=_session_start)
    if not ok:
        return False

    # --- Phase 1.5: Readiness gate ---
    readiness = await _phase_ensure_login_ready(
        page, lead, jobs, target_month, wid, mgr, excel_write_lock,
        start_time=_session_start,
    )
    if readiness == "failed":
        return False

    if readiness == "ready":
        # --- Phase 2: Login (playbook-aware) ---
        ok = await _phase_login(page, lead, jobs, target_month, wid, mgr, excel_write_lock,
                                playbook, mode, recorder, watch, start_time=_session_start)
        if not ok:
            return False

        await human_delay(2.0, 4.0)  # Wait for login response

        # --- Phase 3: Post-login loop (always AI-driven) ---
        ok = await _phase_post_login(page, lead, jobs, target_month, wid, mgr, excel_write_lock,
                                     tfa_semaphore, dialpad_page, recorder, watch, start_time=_session_start)
        if not ok:
            return False

        # Update last_successful_login
        async with excel_write_lock:
            mgr.update_account_field(
                lead.client_name, lead.bank_name, lead.account_last4,
                "last_successful_login", date.today(),
            )

    # --- Phase 4: Navigate to statements (playbook-aware) ---
    ok = await _phase_statements_nav(page, lead, jobs, target_month, wid, mgr, excel_write_lock,
                                     playbook, mode, recorder, watch, start_time=_session_start)
    if not ok:
        return False

    # --- Phase 5: Download per account ---
    for idx, job in enumerate(jobs):
        if shutdown.should_stop:
            await _log_result(mgr, excel_write_lock, job, target_month, "skipped", "", "Interrupted", start_time=_session_start)
            continue

        # Navigation guard: verify we're still on the statements page between accounts
        if idx > 0:
            guard_screenshot = await wait_and_screenshot(page, f"w{wid}_nav_guard")
            guard_state = skill_classify_page(guard_screenshot)
            if guard_state.page_state not in ("statements", "documents", "statements_page"):
                log.warning(f"[W{wid}] Page drifted to '{guard_state.page_state}' — navigating back to statements")
                nav_result = skill_find_statements_page(guard_screenshot)
                if nav_result.target:
                    await human_click(page, nav_result.target["x"], nav_result.target["y"])
                    await human_delay(2.0, 4.0)
                else:
                    log.warning(f"[W{wid}] Could not find statements link — account #{job.account_last4} may fail")

        # Update context for this account
        log_action(type="session_start", note=f"downloading account #{job.account_last4}")

        await _phase_download(page, job, target_month, wid, schedule, mgr, excel_write_lock, context, all_jobs=jobs, start_time=_session_start)

    # --- Save playbook on success ---
    if recorder:
        pb = recorder.to_playbook(lead.bank_name)
        save_playbook(pb)
        log_action(type="playbook_hit", note="playbook created after successful learn")
    elif playbook and mode == "replay":
        # Update verification date and success count
        playbook.last_verified = date.today().isoformat()
        playbook.success_count += 1
        playbook.consecutive_failures = 0
        save_playbook(playbook)

    log_action(type="session_end", mode=mode)
    return True


# ---------------------------------------------------------------------------
# Phase 1: Navigate to login URL
# ---------------------------------------------------------------------------
async def _phase_navigate(
    page: Page, lead: AccountJob, jobs: list[AccountJob],
    target_month: str, wid: int,
    mgr: ExcelManager, excel_write_lock: asyncio.Lock,
    recorder: PlaybookRecorder | None,
    start_time: float | None = None,
) -> bool:
    """Discover and navigate to the bank login URL."""
    login_url = lead.login_url
    if not login_url:
        log.info(f"[W{wid}] Discovering login URL for {lead.bank_name}...")
        result = skill_discover_login_url(lead.bank_name)
        if result.action == "found" and result.text:
            login_url = result.text
            async with excel_write_lock:
                mgr.update_account_field(
                    lead.client_name, lead.bank_name, lead.account_last4,
                    "login_url", login_url,
                )
                mgr.update_account_field(
                    lead.client_name, lead.bank_name, lead.account_last4,
                    "url_verified_date", date.today(),
                )
        else:
            log.error(f"[W{wid}] Could not discover login URL for {lead.bank_name}")
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Login URL not found", start_time=start_time)
            return False

    if recorder:
        recorder.set_login_url(login_url)

    log.info(f"[W{wid}] Navigating to {lead.bank_name}...")
    log_action(type="navigate", description=login_url)
    ok = await _resilient_navigation(page, login_url)
    if not ok:
        for j in jobs:
            await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Navigation failed", start_time=start_time)
        return False

    await human_delay()
    return True


# ---------------------------------------------------------------------------
# Phase 1.5: Ensure page is login-ready
# ---------------------------------------------------------------------------
async def _phase_ensure_login_ready(
    page, lead, jobs,
    target_month: str, wid: int,
    mgr, excel_write_lock,
    start_time: float | None = None,
) -> str:
    """Wait for page to reach login-ready state. Handles loading, obstacles, popups.

    Returns: "ready", "already_logged_in", or "failed"
    """
    max_attempts = 8
    # Progressive waits: patient early (SPA hydration), faster later
    wait_secs = [3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 10.0, 10.0]

    for attempt in range(max_attempts):
        # Always use await_render — blank/spinner pages need progressive backoff
        screenshot = await wait_and_screenshot(
            page, f"w{wid}_ready_{attempt}", await_render=True
        )
        state = skill_classify_page(screenshot)
        page_state = state.page_state
        log.info(f"[W{wid}] Readiness {attempt+1}/{max_attempts}: "
                 f"{page_state} (conf={state.confidence:.2f})")

        if page_state == "login":
            return "ready"

        if page_state in ("dashboard", "statements"):
            log.info(f"[W{wid}] Already logged in via session cookie")
            return "already_logged_in"

        if page_state == "obstacle":
            log.info(f"[W{wid}] Obstacle detected, attempting dismissal")
            result = skill_handle_obstacle(screenshot)
            if result.action == "click" and result.target:
                await verified_click(page, result, screenshot)
            elif result.action == "press_escape":
                await page.keyboard.press("Escape")
            await human_delay(1.0, 2.0)
            continue

        if page_state == "loading":
            # Try a page reload on attempt 4 — SPA may be stuck
            if attempt == 4:
                log.info(f"[W{wid}] Still loading after 4 attempts, reloading page...")
                try:
                    await page.reload(timeout=15000, wait_until="domcontentloaded")
                except Exception:
                    pass
            wait = wait_secs[min(attempt, len(wait_secs) - 1)]
            await human_delay(wait, wait + 2.0)
            continue

        if page_state in ("locked", "error"):
            error_text = state.text or page_state
            log.error(f"[W{wid}] {lead.bank_name}: {error_text}")
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month,
                                  "failed", "", error_text, start_time=start_time)
            return "failed"

        # Unknown / low confidence — wait and retry with fresh screenshot
        log.info(f"[W{wid}] Page state '{page_state}' not login-ready, waiting...")
        wait = wait_secs[min(attempt, len(wait_secs) - 1)]
        await human_delay(wait, wait + 2.0)

    log.warning(f"[W{wid}] Readiness gate exhausted {max_attempts} attempts, trying login anyway")
    return "ready"


# ---------------------------------------------------------------------------
# Phase 2: Login (playbook-aware)
# ---------------------------------------------------------------------------
async def _phase_login(
    page: Page, lead: AccountJob, jobs: list[AccountJob],
    target_month: str, wid: int,
    mgr: ExcelManager, excel_write_lock: asyncio.Lock,
    playbook: Playbook | None, mode: str,
    recorder: PlaybookRecorder | None,
    watch: WatchController,
    start_time: float | None = None,
) -> bool:
    """Enter username + password, with playbook replay or learn."""

    # --- NOTES-BASED PRE-LOGIN FIELDS (company ID, account ID, etc.) ---
    if lead.notes:
        import re
        extra_fields = re.findall(r'(\w[\w\s]*?)\s*[=:]\s*(.+?)(?:\n|$)', lead.notes, re.IGNORECASE)
        for field_name, field_value in extra_fields:
            field_name_lower = field_name.strip().lower()
            field_value = field_value.strip()
            if field_name_lower in ("company id", "company_id", "account id", "org id", "client id"):
                log.info(f"[W{wid}] Notes: filling '{field_name.strip()}' = '{field_value}'")
                screenshot = await wait_and_screenshot(page, f"w{wid}_extra_field_{field_name_lower}")
                result = skill_find_element(
                    screenshot,
                    f"{field_name.strip()} input field",
                    context=f"This bank requires a '{field_name.strip()}' field. The value to enter is: {field_value}",
                )
                if result.action in ("click", "type") and result.target:
                    await human_click(page, result.target["x"], result.target["y"])
                    await human_type(page, field_value)
                    await human_delay(0.5, 1.0)

    # --- USERNAME ---
    username_ok = False
    if mode == "replay" and playbook and playbook.login_steps:
        # Find the username step
        username_steps = [s for s in playbook.login_steps if s.field == "username"]
        if username_steps:
            step = username_steps[0]
            username_ok = await try_step(page, step)
            if username_ok:
                log_action(type="playbook_hit", description="username field", note=step.selector)
                await human_type(page, lead.username)
            else:
                log_action(type="playbook_miss", description="username field")
                if playbook:
                    playbook.consecutive_failures += 1
                    save_playbook(playbook)

    if not username_ok:
        # AI fallback with fresh-screenshot retry (await_render catches stuck SPAs)
        result = None
        for find_attempt in range(3):
            screenshot = await wait_and_screenshot(
                page, f"w{wid}_login_{find_attempt}", await_render=True
            )
            result = skill_find_element(screenshot, "username or user ID input field")
            if result.action in ("click", "type") and result.target:
                break
            if find_attempt < 2:
                log.info(f"[W{wid}] Username field not found (attempt {find_attempt+1}), "
                         f"retrying with fresh screenshot...")
                await human_delay(3.0, 5.0)

        if result and result.action in ("click", "type") and result.target:
            await human_click(page, result.target["x"], result.target["y"])
            await human_type(page, lead.username)

            # Record for playbook
            if recorder:
                selector = await discover_selector(page, result.target["x"], result.target["y"])
                recorder.add_login_step(
                    name="find_username", action="type",
                    description="username input field",
                    selector=selector or "",
                    coords={"x": result.target["x"], "y": result.target["y"]},
                    field="username",
                )

            decision = await watch.pause(wid, lead.bank_name, mode,
                                         "skill_find_element", "username input field",
                                         result.confidence, 0.01, "About to look for Next button")
            if decision == "quit":
                raise asyncio.CancelledError("Operator quit")
            if decision == "skip":
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Operator skipped", start_time=start_time)
                return False
        else:
            log.warning(f"[W{wid}] Could not find username field after 3 attempts")
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Username field not found", start_time=start_time)
            return False

    await human_delay(0.5, 1.0)

    # --- NEXT BUTTON (some banks split username/password) ---
    next_ok = False
    if mode == "replay" and playbook and playbook.login_steps:
        next_steps = [s for s in playbook.login_steps if s.name == "click_next"]
        if next_steps:
            step = next_steps[0]
            next_ok = await try_step(page, step)
            if next_ok:
                log_action(type="playbook_hit", description="Next button", note=step.selector)
                await human_delay()
            else:
                log_action(type="playbook_miss", description="Next button")
                if playbook:
                    playbook.consecutive_failures += 1
                    save_playbook(playbook)

    if not next_ok:
        screenshot2 = await wait_and_screenshot(page, f"w{wid}_after_username")
        next_btn = skill_find_element(screenshot2, "Next button or Continue button (NOT the password field)")
        if next_btn.action == "click" and next_btn.confidence > 0.7 and next_btn.target:
            await verified_click(page, next_btn, screenshot2)

            if recorder:
                selector = await discover_selector(page, next_btn.target["x"], next_btn.target["y"])
                recorder.add_login_step(
                    name="click_next", action="click",
                    description="Next button",
                    selector=selector or "",
                    coords={"x": next_btn.target["x"], "y": next_btn.target["y"]},
                )

            await human_delay()

    # --- PASSWORD ---
    password_ok = False
    if mode == "replay" and playbook and playbook.login_steps:
        pw_steps = [s for s in playbook.login_steps if s.field == "password"]
        if pw_steps:
            step = pw_steps[0]
            password_ok = await try_step(page, step)
            if password_ok:
                log_action(type="playbook_hit", description="password field", note=step.selector)
                await human_type(page, lead.password)
            else:
                log_action(type="playbook_miss", description="password field")
                if playbook:
                    playbook.consecutive_failures += 1
                    save_playbook(playbook)

    if not password_ok:
        screenshot = await wait_and_screenshot(page, f"w{wid}_password")
        pw_result = skill_find_element(screenshot, "password input field")
        if pw_result.action in ("click", "type") and pw_result.target:
            await human_click(page, pw_result.target["x"], pw_result.target["y"])
            await human_type(page, lead.password)

            if recorder:
                selector = await discover_selector(page, pw_result.target["x"], pw_result.target["y"])
                recorder.add_login_step(
                    name="find_password", action="type",
                    description="password input field",
                    selector=selector or "",
                    coords={"x": pw_result.target["x"], "y": pw_result.target["y"]},
                    field="password",
                )

            decision = await watch.pause(wid, lead.bank_name, mode,
                                         "skill_find_element", "password input field",
                                         pw_result.confidence, 0.01, "About to look for Submit button")
            if decision == "quit":
                raise asyncio.CancelledError("Operator quit")
            if decision == "skip":
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Operator skipped", start_time=start_time)
                return False
        else:
            page_state = skill_classify_page(screenshot)
            if page_state.page_state == "virtual_keyboard":
                ok = await _handle_virtual_keyboard(page, lead.password, wid)
                if not ok:
                    for j in jobs:
                        await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Virtual keyboard password entry failed", start_time=start_time)
                    return False
            else:
                log.warning(f"[W{wid}] Could not find password field")
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Password field not found", start_time=start_time)
                return False

    await human_delay(0.3, 0.7)

    # --- SUBMIT ---
    submit_ok = False
    if mode == "replay" and playbook and playbook.login_steps:
        submit_steps = [s for s in playbook.login_steps if s.name == "click_submit"]
        if submit_steps:
            step = submit_steps[0]
            submit_ok = await try_step(page, step)
            if submit_ok:
                log_action(type="playbook_hit", description="submit button", note=step.selector)
            else:
                log_action(type="playbook_miss", description="submit button")
                if playbook:
                    playbook.consecutive_failures += 1
                    save_playbook(playbook)

    if not submit_ok:
        screenshot3 = await wait_and_screenshot(page, f"w{wid}_before_submit")
        submit = skill_find_element(screenshot3, "Sign In button or Log In button or Submit button")
        if submit.action == "click" and submit.target:
            await verified_click(page, submit, screenshot3)

            if recorder:
                selector = await discover_selector(page, submit.target["x"], submit.target["y"])
                recorder.add_login_step(
                    name="click_submit", action="click",
                    description="Sign In button",
                    selector=selector or "",
                    coords={"x": submit.target["x"], "y": submit.target["y"]},
                )
        else:
            await page.keyboard.press("Enter")
            if recorder:
                recorder.add_login_step(
                    name="click_submit", action="click",
                    description="Submit via Enter key",
                )

        decision = await watch.pause(wid, lead.bank_name, mode,
                                     "skill_find_element", "submit button",
                                     submit.confidence if submit.target else 0.5, 0.01,
                                     "About to wait for login response")
        if decision == "quit":
            raise asyncio.CancelledError("Operator quit")
        if decision == "skip":
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Operator skipped", start_time=start_time)
            return False

    return True


# ---------------------------------------------------------------------------
# Phase 3: Post-login state detection (always AI-driven)
# ---------------------------------------------------------------------------
async def _phase_post_login(
    page: Page, lead: AccountJob, jobs: list[AccountJob],
    target_month: str, wid: int,
    mgr: ExcelManager, excel_write_lock: asyncio.Lock,
    tfa_semaphore: asyncio.Semaphore,
    dialpad_page: Page | None,
    recorder: PlaybookRecorder | None,
    watch: WatchController | None = None,
    start_time: float | None = None,
) -> bool:
    """Classify page state and handle obstacles, 2FA, security questions."""
    max_iterations = 10
    reached_terminal = False
    consecutive_stuck = 0
    for _ in range(max_iterations):
        screenshot = await wait_and_screenshot(page, f"w{wid}_post_login")
        state = skill_classify_page(screenshot)
        page_state = state.page_state
        log.info(f"[W{wid}] Page state: {page_state} (confidence: {state.confidence:.2f})")
        log_action(type="state_detect", page_state=page_state, confidence=state.confidence)

        if recorder:
            recorder.add_post_login_state(page_state)

        if watch:
            decision = await watch.pause(wid, lead.bank_name, "learn",
                                         "skill_classify_page", f"page state: {page_state}",
                                         state.confidence, 0.01, f"Handling state: {page_state}")
            if decision == "quit":
                raise asyncio.CancelledError("Operator quit")
            if decision == "skip":
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Operator skipped", start_time=start_time)
                return False

        if page_state in ("dashboard", "statements", "2fa_prompt", "2fa_method_selection",
                          "security_question"):
            consecutive_stuck = 0

        if page_state == "login":
            log.warning(f"[W{wid}] {lead.bank_name}: still on login page after submit — credentials may be wrong")
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Still on login page post-submit", start_time=start_time)
            return False

        elif page_state == "dashboard":
            reached_terminal = True
            break

        elif page_state == "statements":
            reached_terminal = True
            break

        elif page_state == "2fa_prompt":
            log_action(type="2fa_trigger", description="2FA code entry required")
            ok = await _handle_2fa_entry(
                page, lead, wid, tfa_semaphore, dialpad_page, mgr, excel_write_lock,
                watch_mode=watch.enabled if watch else False,
            )
            if not ok:
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "2FA failed", start_time=start_time)
                    mgr.add_to_retry_queue(j, "2FA code entry failed")
                return False
            await human_delay()

        elif page_state == "2fa_method_selection":
            log_action(type="2fa_trigger", description="2FA method selection")
            ok = await _handle_2fa_selection(
                page, lead, wid, tfa_semaphore, dialpad_page, mgr, excel_write_lock,
                watch_mode=watch.enabled if watch else False,
            )
            if not ok:
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "2FA selection failed", start_time=start_time)
                    mgr.add_to_retry_queue(j, "2FA method selection failed")
                return False
            await human_delay()

        elif page_state == "security_question":
            ok = await _handle_security_question(page, lead, wid)
            if not ok:
                for j in jobs:
                    await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Security question failed", start_time=start_time)
                return False
            await human_delay()

        elif page_state == "obstacle":
            consecutive_stuck += 1
            if consecutive_stuck >= 4:
                log.info(f"[W{wid}] Stuck on obstacle for {consecutive_stuck} iterations, trying Escape + reload")
                await page.keyboard.press("Escape")
                await human_delay(1.0, 2.0)
                await page.reload()
                await human_delay(3.0, 5.0)
                consecutive_stuck = 0
            else:
                result = skill_handle_obstacle(screenshot)
                if result.action == "click" and result.target:
                    await verified_click(page, result, screenshot)
                elif result.action == "press_escape":
                    await page.keyboard.press("Escape")
                await human_delay()

        elif page_state in ("locked", "error"):
            error_text = state.text or page_state
            log.error(f"[W{wid}] {lead.bank_name}: {error_text}")
            if page_state == "locked":
                async with excel_write_lock:
                    mgr.update_account_field(
                        lead.client_name, lead.bank_name, lead.account_last4,
                        "status", "locked",
                    )
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", error_text, start_time=start_time)
            return False

        elif page_state == "password_change":
            log.warning(f"[W{wid}] {lead.bank_name}: password change required")
            async with excel_write_lock:
                mgr.update_account_field(
                    lead.client_name, lead.bank_name, lead.account_last4,
                    "status", "password_expired",
                )
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Password change required", start_time=start_time)
            return False

        elif page_state == "loading":
            await human_delay(2.0, 4.0)

        else:
            consecutive_stuck += 1
            log.warning(f"[W{wid}] Unknown page state: {page_state} (stuck count: {consecutive_stuck})")
            if consecutive_stuck >= 4:
                log.info(f"[W{wid}] Stuck for {consecutive_stuck} iterations, trying Escape + reload")
                await page.keyboard.press("Escape")
                await human_delay(1.0, 2.0)
                await page.reload()
                await human_delay(3.0, 5.0)
                consecutive_stuck = 0
            else:
                await human_delay()

    if not reached_terminal:
        log.warning(f"[W{wid}] Failed to reach dashboard after {max_iterations} iterations")
        for j in jobs:
            await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", f"Post-login loop exhausted ({max_iterations} iterations)", start_time=start_time)
        return False
    return True


# ---------------------------------------------------------------------------
# Phase 4: Navigate to statements (playbook-aware)
# ---------------------------------------------------------------------------
async def _phase_statements_nav(
    page: Page, lead: AccountJob, jobs: list[AccountJob],
    target_month: str, wid: int,
    mgr: ExcelManager, excel_write_lock: asyncio.Lock,
    playbook: Playbook | None, mode: str,
    recorder: PlaybookRecorder | None,
    watch: WatchController,
    start_time: float | None = None,
) -> bool:
    """Navigate to the statements page."""
    screenshot = await wait_and_screenshot(page, f"w{wid}_dashboard")
    state = skill_classify_page(screenshot)

    if state.page_state == "statements":
        return True  # Already there

    # Try playbook first
    if mode == "replay" and playbook and playbook.statements_step:
        ok = await try_step(page, playbook.statements_step)
        if ok:
            log_action(type="playbook_hit", description="statements nav link", note=playbook.statements_step.selector)
            await human_delay(2.0, 4.0)
            return True
        else:
            log_action(type="playbook_miss", description="statements nav link")
            # Increment failure counter on playbook
            playbook.consecutive_failures += 1
            save_playbook(playbook)

    # AI fallback
    nav_result = skill_find_statements_page(screenshot)
    if nav_result.action == "click" and nav_result.target:
        await verified_click(page, nav_result, screenshot)

        if recorder:
            selector = await discover_selector(page, nav_result.target["x"], nav_result.target["y"])
            recorder.set_statements_step(
                description="Statements page link",
                selector=selector or "",
                coords={"x": nav_result.target["x"], "y": nav_result.target["y"]},
            )

        decision = await watch.pause(wid, lead.bank_name, mode,
                                     "skill_find_statements_page", "statements nav link",
                                     nav_result.confidence, 0.01, "Navigating to statements page")
        if decision == "quit":
            raise asyncio.CancelledError("Operator quit")
        if decision == "skip":
            for j in jobs:
                await _log_result(mgr, excel_write_lock, j, target_month, "skipped", "", "Operator skipped", start_time=start_time)
            return False

        await human_delay(2.0, 4.0)
        return True
    else:
        log.warning(f"[W{wid}] Could not find statements page link")
        for j in jobs:
            await _log_result(mgr, excel_write_lock, j, target_month, "failed", "", "Statements page not found", start_time=start_time)
        return False


# ---------------------------------------------------------------------------
# Phase 5: Download statement for one account
# ---------------------------------------------------------------------------
async def _phase_download(
    page: Page, job: AccountJob, target_month: str, wid: int,
    schedule: WindowSchedule, mgr: ExcelManager, excel_write_lock: asyncio.Lock,
    context: BrowserContext,
    all_jobs: list[AccountJob] | None = None,
    start_time: float | None = None,
) -> None:
    """Download and validate a single account's statement."""
    log.info(f"[W{wid}] Downloading statement for {job.client_name} #{job.account_last4}")
    clear_download_dir(schedule.download_dir)

    screenshot = await wait_and_screenshot(page, f"w{wid}_statements")
    sel_result = skill_select_statement(screenshot, target_month, job.account_last4)

    if sel_result.action == "not_available":
        log.info(f"[W{wid}] Statement not yet available for {target_month}")
        await _log_result(mgr, excel_write_lock, job, target_month, "failed", "", "Statement not yet available", start_time=start_time)
        async with excel_write_lock:
            mgr.add_to_retry_queue(job, "Statement not yet available")
        return

    if sel_result.action != "click" or not sel_result.target:
        log.warning(f"[W{wid}] Could not select statement")
        await _log_result(mgr, excel_write_lock, job, target_month, "failed", "", "Could not select statement", start_time=start_time)
        async with excel_write_lock:
            mgr.add_to_retry_queue(job, "Could not select statement")
        return

    # Auto-learn statement_available_date from closing day
    if sel_result.raw_response and job.statement_available_date <= 1:
        closing_day = sel_result.raw_response.get("statement_closing_day")
        if closing_day and isinstance(closing_day, int) and 1 <= closing_day <= 31:
            avail_day = min(closing_day + 1, 28)
            log.info(f"[W{wid}] Auto-learned statement_available_date={avail_day} for #{job.account_last4}")
            async with excel_write_lock:
                mgr.update_account_field(
                    job.client_name, job.bank_name, job.account_last4,
                    "statement_available_date", avail_day,
                )

    # Track new pages/tabs
    new_pages = await monitor_new_pages(context)

    # Click to download
    log_action(type="download", description=f"clicking statement for {target_month}")
    await verified_click(page, sel_result, screenshot)
    await human_delay(2.0, 5.0)

    # Check for new tab with PDF
    pdf_path = None
    if new_pages:
        for new_page in new_pages:
            await asyncio.sleep(2)
            try:
                url = new_page.url
                if url.lower().endswith('.pdf') or 'application/pdf' in (await new_page.evaluate("() => document.contentType") or ""):
                    # Save the PDF from the new tab
                    try:
                        response = await new_page.goto(url)
                        if response:
                            body = await response.body()
                            pdf_path = Path(schedule.download_dir) / f"statement_{job.account_last4}.pdf"
                            pdf_path.write_bytes(body)
                            await new_page.close()
                            break
                    except Exception as e:
                        log.warning(f"[W{wid}] Failed to capture PDF from new tab: {e}")
            except Exception:
                pass

    # Wait for download (fallback if new-tab capture didn't produce a file)
    if not pdf_path:
        pdf_path = find_downloaded_pdf(schedule.download_dir, timeout_seconds=30)

    if not pdf_path:
        screenshot = await wait_and_screenshot(page, f"w{wid}_download_btn")
        dl_btn = skill_find_element(screenshot, "Download PDF button or Save button")
        if dl_btn.action == "click" and dl_btn.target:
            await verified_click(page, dl_btn, screenshot)
            await human_delay(2.0, 4.0)
            pdf_path = find_downloaded_pdf(schedule.download_dir, timeout_seconds=30)

    if not pdf_path:
        log.warning(f"[W{wid}] Download failed — no PDF found")
        await _log_result(mgr, excel_write_lock, job, target_month, "failed", "", "Download timeout", start_time=start_time)
        async with excel_write_lock:
            mgr.add_to_retry_queue(job, "Download timeout")
        return

    # --- VALIDATE ---
    log_action(type="validate", description="checking PDF validity")
    if not is_valid_pdf(pdf_path):
        log.warning(f"[W{wid}] Invalid PDF: {pdf_path}")
        await _log_result(mgr, excel_write_lock, job, target_month, "failed", "", "Invalid PDF", start_time=start_time)
        async with excel_write_lock:
            mgr.add_to_retry_queue(job, "Invalid PDF downloaded")
        return

    pdf_text = extract_pdf_text(pdf_path)
    if pdf_text:
        validation = skill_validate_statement(
            pdf_text, job.client_name, job.account_last4, target_month,
        )
        if validation.action == "invalid":
            log.warning(f"[W{wid}] Wrong statement: {validation.reasoning}")
            await _log_result(
                mgr, excel_write_lock, job, target_month, "failed",
                str(pdf_path), f"Wrong statement: {validation.reasoning}",
                start_time=start_time,
            )
            return

        # Check for combined PDF
        accounts_found = validation.raw_response.get("accounts_found", []) if validation.raw_response else []
        multi = detect_multi_account(pdf_text)
        if len(multi) > 1:
            log.info(f"[W{wid}] Combined statement detected: accounts {multi}")
            paths = organize_combined_statement(
                pdf_path, job.file_safe_name, job.bank_name, multi, target_month,
            )
            search_jobs = all_jobs if all_jobs else [job]
            for i, last4 in enumerate(multi):
                matching_jobs = [j for j in search_jobs if j.account_last4 == last4]
                path_str = str(paths[i]) if i < len(paths) else str(paths[0])
                for mj in matching_jobs:
                    await _log_result(
                        mgr, excel_write_lock, mj, target_month, "success",
                        path_str, "Combined statement",
                        start_time=start_time,
                    )
            return

    # --- ORGANIZE ---
    final_path = organize_statement(
        pdf_path, job.file_safe_name, job.bank_name, job.account_last4, target_month,
    )
    await _log_result(
        mgr, excel_write_lock, job, target_month, "success", str(final_path), "",
        start_time=start_time,
    )
    log_action(type="download", description="statement saved", success=True)
    log.info(f"[W{wid}] Success: {job.client_name} #{job.account_last4}")


# ---------------------------------------------------------------------------
# Helper: 2FA handling
# ---------------------------------------------------------------------------
async def _handle_2fa_selection(
    page: Page,
    job: AccountJob,
    wid: int,
    tfa_semaphore: asyncio.Semaphore,
    dialpad_page: Page | None,
    mgr: ExcelManager,
    excel_write_lock: asyncio.Lock,
    watch_mode: bool = False,
) -> bool:
    """Select 2FA method and then handle code entry."""
    async with tfa_semaphore:
        screenshot = await wait_and_screenshot(page, f"w{wid}_2fa_select")
        result = skill_select_2fa_option(screenshot, job.tfa_preference_order)
        if result.action == "click" and result.target:
            await verified_click(page, result, screenshot)
            await human_delay(2.0, 4.0)
            return await _wait_and_enter_2fa_code(page, job, wid, dialpad_page, mgr, excel_write_lock, watch_mode=watch_mode)
        else:
            log.warning(f"[W{wid}] Could not select 2FA option")
            return False


async def _handle_2fa_entry(
    page: Page,
    job: AccountJob,
    wid: int,
    tfa_semaphore: asyncio.Semaphore,
    dialpad_page: Page | None,
    mgr: ExcelManager,
    excel_write_lock: asyncio.Lock,
    watch_mode: bool = False,
) -> bool:
    """Handle 2FA code entry (code already triggered)."""
    async with tfa_semaphore:
        return await _wait_and_enter_2fa_code(page, job, wid, dialpad_page, mgr, excel_write_lock, watch_mode=watch_mode)


async def _wait_and_enter_2fa_code(
    page: Page,
    job: AccountJob,
    wid: int,
    dialpad_page: Page | None,
    mgr: ExcelManager,
    excel_write_lock: asyncio.Lock,
    watch_mode: bool = False,
) -> bool:
    """Wait for 2FA code to arrive, then enter it."""
    code: str | None = None

    if job.tfa_method == "totp":
        try:
            code = await get_totp_code(job.tfa_detail)
            log.info(f"[W{wid}] TOTP code generated")
            log_action(type="2fa_receive", description="TOTP generated")
        except Exception as e:
            log.error(f"[W{wid}] TOTP generation failed for {job.bank_name}: {e} — check 2fa_detail in Excel")
            return False

    elif job.tfa_method == "sms":
        sms_result = await poll_dialpad_sms(dialpad_page, sender_hint=job.tfa_sender)
        if sms_result:
            code, sender = sms_result
            log_action(type="2fa_receive", description=f"SMS code received from Dialpad (sender={sender})")
            # Auto-learn sender ID for future runs
            if sender and not job.tfa_sender:
                log.info(f"[W{wid}] Auto-learned SMS sender ID: {sender}")
                async with excel_write_lock:
                    mgr.update_account_field(
                        job.client_name, job.bank_name, job.account_last4,
                        "2fa_sender", sender,
                    )

    elif job.tfa_method == "email":
        code = await _poll_email_for_code(job, wid, watch_mode=watch_mode)

    elif job.tfa_method == "push":
        log.info(f"[W{wid}] Push 2FA — waiting for approval (3 min timeout)...")
        approved = await wait_for_push_approval(page, timeout_s=TIMEOUTS["push_2fa_wait"] / 1000)
        if approved:
            log_action(type="2fa_receive", description="Push 2FA approved")
        return approved

    if not code:
        log.warning(f"[W{wid}] No 2FA code received")
        return False

    # Find the code input field and enter it
    screenshot = await wait_and_screenshot(page, f"w{wid}_2fa_entry")
    code_field = skill_find_element(screenshot, "verification code input field or OTP input field")
    if code_field.target:
        await human_click(page, code_field.target["x"], code_field.target["y"])
        await human_type(page, code)
        await human_delay(0.3, 0.7)

        screenshot2 = await wait_and_screenshot(page, f"w{wid}_2fa_submit")
        submit = skill_find_element(screenshot2, "Verify button or Submit button or Continue button")
        if submit.target:
            await verified_click(page, submit, screenshot2)
        else:
            await page.keyboard.press("Enter")
        await human_delay(2.0, 4.0)

        return True
    else:
        log.warning(f"[W{wid}] Could not find 2FA code input field")
        return False


async def _poll_email_for_code(job: AccountJob, wid: int, timeout_s: float = 120, watch_mode: bool = False) -> str | None:
    """Prompt operator for email 2FA code in watch mode, or fail gracefully."""
    if watch_mode:
        log.info(f"[W{wid}] Email 2FA required for {job.bank_name}. Check email for code from {job.tfa_detail}")
        loop = asyncio.get_event_loop()
        code = await loop.run_in_executor(None, input, f"[W{wid}] Enter 2FA code from email: ")
        code = code.strip()
        return code if code else None
    else:
        log.error(f"[W{wid}] Email 2FA required for {job.bank_name} but --watch not enabled. Use --watch for manual code entry.")
        return None


# ---------------------------------------------------------------------------
# Helper: security questions
# ---------------------------------------------------------------------------
async def _handle_security_question(page: Page, job: AccountJob, wid: int) -> bool:
    """Answer a security question using the spreadsheet Q&A pairs."""
    if not job.security_questions:
        log.warning(f"[W{wid}] Security question asked but no Q&A pairs configured")
        return False

    screenshot = await wait_and_screenshot(page, f"w{wid}_secq")
    result = skill_match_security_question(screenshot, job.security_questions)

    if result.action == "answer" and result.text and result.target:
        await human_click(page, result.target["x"], result.target["y"])
        await human_type(page, result.text)
        await human_delay(0.3, 0.7)

        screenshot2 = await wait_and_screenshot(page, f"w{wid}_secq_submit")
        submit = skill_find_element(screenshot2, "Submit button or Continue button or Next button")
        if submit.target:
            await verified_click(page, submit, screenshot2)
        else:
            await page.keyboard.press("Enter")
        await human_delay(2.0, 3.0)
        return True

    log.warning(f"[W{wid}] Could not match security question")
    return False


# ---------------------------------------------------------------------------
# Helper: virtual keyboard
# ---------------------------------------------------------------------------
async def _handle_virtual_keyboard(page: Page, password: str, wid: int) -> bool:
    """Handle on-screen keyboard password entry. Returns False if any character is missing."""
    # Pass 1: verify all characters can be found before clicking any
    char_targets: list[dict] = []
    missing_chars: list[str] = []
    for char in password:
        screenshot = await wait_and_screenshot(page, f"w{wid}_vkb_{char}")
        result = skill_find_element(screenshot, f"virtual keyboard button for character '{char}'")
        if result.target:
            char_targets.append(result.target)
        else:
            missing_chars.append(char)
            char_targets.append({})  # placeholder to keep index alignment

    if missing_chars:
        log.error(f"[W{wid}] Virtual keyboard missing {len(missing_chars)} character(s) — aborting password entry")
        return False

    # Pass 2: click each character now that we know all are available
    for i, char in enumerate(password):
        # Re-screenshot each time since keyboard state may change after clicks
        screenshot = await wait_and_screenshot(page, f"w{wid}_vkb_click_{char}")
        result = skill_find_element(screenshot, f"virtual keyboard button for character '{char}'")
        if result.target:
            await human_click(page, result.target["x"], result.target["y"])
            await human_delay(0.3, 0.6)
        else:
            log.error(f"[W{wid}] Virtual keyboard button for '{char}' disappeared during entry — aborting")
            return False

    return True


# ---------------------------------------------------------------------------
# Helper: resilient navigation
# ---------------------------------------------------------------------------
async def _resilient_navigation(page: Page, url: str, max_retries: int = 3) -> bool:
    """Navigate with retries and error handling."""
    for attempt in range(max_retries):
        try:
            response = await page.goto(
                url,
                timeout=TIMEOUTS["page_navigation"],
                wait_until="domcontentloaded",
            )
            if response and response.status < 400:
                return True
            if response and response.status >= 500:
                log.warning(f"Server error {response.status}, retrying...")
                await asyncio.sleep(5 * (attempt + 1))
                continue
            return False  # 4xx = real error
        except Exception as e:
            log.warning(f"Navigation error (attempt {attempt + 1}): {e}")
            await asyncio.sleep(5)
    return False


# ---------------------------------------------------------------------------
# Helper: log result to Excel
# ---------------------------------------------------------------------------
async def _log_result(
    mgr: ExcelManager,
    excel_write_lock: asyncio.Lock,
    job: AccountJob,
    target_month: str,
    status: str,
    filename: str,
    notes: str,
    start_time: float | None = None,
) -> None:
    """Thread-safe result logging to Excel."""
    cost = get_cost_summary()
    result = RunResult(
        timestamp=datetime.now(),
        client_name=job.client_name,
        bank_name=job.bank_name,
        account_last4=job.account_last4,
        target_month=target_month,
        status=status,
        filename=filename,
        notes=notes,
        ai_calls_count=cost["calls"],
        ai_cost_usd=cost["estimated_cost_usd"],
        duration_seconds=int(time.time() - start_time) if start_time else 0,
    )
    async with excel_write_lock:
        mgr.log_result(result)
