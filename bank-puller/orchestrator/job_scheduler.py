"""Job scheduler — queue builder, bank deconfliction, parallel execution."""
from __future__ import annotations

import asyncio
import re
from collections import defaultdict
from datetime import date, datetime
from typing import TYPE_CHECKING

from config import (
    DIALPAD_DEPT_NAME,
    DOWNLOADS_DIR,
    MAX_CONCURRENT_BANK_WINDOWS,
    TIMEOUTS,
)
from orchestrator.excel_reader import AccountJob, ExcelManager, RunResult
from orchestrator.shutdown import GracefulShutdown
from ai_skills.navigation import skill_classify_page, skill_find_element
from utils.browser_setup import human_click, launch_hardened_browser, wait_and_screenshot
from utils.logger import log
from utils.resources import get_max_windows, log_resource_summary

if TYPE_CHECKING:
    from orchestrator.action_logger import ActionLogger
    from patchright.async_api import BrowserContext


# ---------------------------------------------------------------------------
# Concurrency primitives (module-level, shared across windows)
# ---------------------------------------------------------------------------
tfa_semaphore = asyncio.Semaphore(1)
excel_write_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Schedule dataclass
# ---------------------------------------------------------------------------
class WindowSchedule:
    """Jobs assigned to a single browser window."""

    def __init__(self, window_id: int, jobs: list[AccountJob]) -> None:
        self.window_id = window_id
        self.jobs = jobs
        self.download_dir = str(DOWNLOADS_DIR / f"window-{window_id}")


class RunSchedule:
    """Complete schedule for a run: list of WindowSchedules + Dialpad flag."""

    def __init__(self, windows: list[WindowSchedule], needs_dialpad: bool) -> None:
        self.windows = windows
        self.needs_dialpad = needs_dialpad


# ---------------------------------------------------------------------------
# Queue building
# ---------------------------------------------------------------------------
def build_schedule(jobs: list[AccountJob]) -> RunSchedule:
    """Assign jobs to windows with bank deconfliction.

    Rules:
    - Group by bank_name so one window handles all jobs for a given bank.
    - Round-robin banks across windows (never same bank in both windows).
    - Within a bank group, jobs are sequential (login → download all → logout).
    """
    max_windows = get_max_windows()

    # Group by bank
    by_bank: dict[str, list[AccountJob]] = defaultdict(list)
    for job in jobs:
        by_bank[job.bank_name].append(job)

    # Sort banks by job count (descending) for better load balancing
    bank_groups = sorted(by_bank.items(), key=lambda kv: -len(kv[1]))

    # Round-robin assign to windows
    window_jobs: list[list[AccountJob]] = [[] for _ in range(max_windows)]
    for i, (_bank, bank_jobs) in enumerate(bank_groups):
        target = i % max_windows
        window_jobs[target].extend(bank_jobs)

    # Check if any job needs SMS 2FA via Dialpad
    needs_dialpad = any(
        j.has_2fa and j.tfa_method == "sms" and (
            j.tfa_detail.lower() == "dialpad"
            or len(re.sub(r"\D", "", j.tfa_detail)) >= 10
        )
        for j in jobs
    )

    windows = []
    for wid in range(max_windows):
        if window_jobs[wid]:
            windows.append(WindowSchedule(window_id=wid + 1, jobs=window_jobs[wid]))

    return RunSchedule(windows=windows, needs_dialpad=needs_dialpad)


async def _navigate_dialpad_to_messages(page) -> None:
    """Navigate Dialpad to the Compound Accounting > New messages tab.

    Uses text selectors first, falls back to AI vision if selectors fail.
    Non-fatal: logs warnings but doesn't abort the run.
    """
    # Step 1: Click the department name in the sidebar
    try:
        dept = page.get_by_text(DIALPAD_DEPT_NAME).first
        await dept.click(timeout=5000)
        log.info(f"Dialpad: clicked '{DIALPAD_DEPT_NAME}'")
        await asyncio.sleep(1)
    except Exception:
        log.warning(f"Dialpad: selector for '{DIALPAD_DEPT_NAME}' failed, trying AI fallback")
        try:
            screenshot = await wait_and_screenshot(page, "dialpad_nav_dept")
            result = skill_find_element(screenshot, f"sidebar item or menu item labeled '{DIALPAD_DEPT_NAME}'")
            if result.target:
                await human_click(page, result.target["x"], result.target["y"])
                await asyncio.sleep(1)
            else:
                log.warning("Dialpad: AI could not find department — manual navigation may be needed")
                return
        except Exception as e:
            log.warning(f"Dialpad: AI fallback for department failed: {e}")
            return

    # Step 2: Click the "New" tab
    try:
        new_tab = page.get_by_role("tab", name="New")
        await new_tab.click(timeout=5000)
        log.info("Dialpad: clicked 'New' tab")
    except Exception:
        log.warning("Dialpad: selector for 'New' tab failed, trying AI fallback")
        try:
            screenshot = await wait_and_screenshot(page, "dialpad_nav_new")
            result = skill_find_element(screenshot, "tab labeled 'New' for new/unread messages")
            if result.target:
                await human_click(page, result.target["x"], result.target["y"])
            else:
                log.warning("Dialpad: AI could not find 'New' tab — manual navigation may be needed")
        except Exception as e:
            log.warning(f"Dialpad: AI fallback for 'New' tab failed: {e}")


# ---------------------------------------------------------------------------
# Run execution
# ---------------------------------------------------------------------------
async def run_schedule(
    schedule: RunSchedule,
    mgr: ExcelManager,
    shutdown: GracefulShutdown,
    action_logger: ActionLogger | None = None,
    watch_mode: bool = False,
    relearn: bool = False,
) -> None:
    """Execute the full schedule: launch browsers, run windows in parallel."""
    from orchestrator.session_runner import run_window

    log_resource_summary()

    start_time = datetime.now()
    run_timeout = TIMEOUTS["run_total"] / 1000  # convert ms → s

    # Launch Dialpad window if needed
    dialpad_context: BrowserContext | None = None
    if schedule.needs_dialpad:
        log.info("Launching Dialpad browser window...")
        dialpad_context = await launch_hardened_browser("dialpad")
        dialpad_page = dialpad_context.pages[0] if dialpad_context.pages else await dialpad_context.new_page()
        log.info("Dialpad window ready — ensure it's logged in to messages view.")

        # Health check: verify Dialpad is authenticated
        screenshot = await wait_and_screenshot(dialpad_page, "dialpad_health_check")
        health = skill_classify_page(screenshot)
        if health.page_state in ("login", "login_page", "auth"):
            log.warning(
                "Dialpad browser shows login page — SMS 2FA codes will NOT be available. "
                "Run with --setup-dialpad first to authenticate."
            )
        else:
            await _navigate_dialpad_to_messages(dialpad_page)
    else:
        dialpad_page = None

    # Launch bank windows and run in parallel
    tasks = []
    contexts: list[BrowserContext] = []

    for ws in schedule.windows:
        log.info(
            f"Window {ws.window_id}: {len(ws.jobs)} accounts "
            f"({', '.join(set(j.bank_name for j in ws.jobs))})"
        )
        ctx = await launch_hardened_browser(
            f"bank-{ws.window_id}",
            download_dir=ws.download_dir,
        )
        contexts.append(ctx)

        task = asyncio.create_task(
            run_window(
                context=ctx,
                schedule=ws,
                mgr=mgr,
                shutdown=shutdown,
                tfa_semaphore=tfa_semaphore,
                excel_write_lock=excel_write_lock,
                dialpad_page=dialpad_page,
                action_logger=action_logger,
                watch_mode=watch_mode,
                relearn=relearn,
            )
        )
        tasks.append(task)

    # Wait for all windows to finish (or run timeout)
    try:
        await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=run_timeout,
        )
    except asyncio.TimeoutError:
        log.warning("Run timeout reached — stopping all windows.")
        for t in tasks:
            t.cancel()

    # Summary
    elapsed = (datetime.now() - start_time).total_seconds()
    from ai_skills.base import get_cost_summary

    cost = get_cost_summary()
    log.info(
        f"Run complete — {elapsed:.0f}s elapsed, "
        f"{cost['calls']} AI calls, ${cost['estimated_cost_usd']:.2f} estimated cost"
    )

    # Close browsers
    for ctx in contexts:
        try:
            await ctx.close()
        except Exception:
            pass
    if dialpad_context:
        try:
            await dialpad_context.close()
        except Exception:
            pass
