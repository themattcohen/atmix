"""Bank Statement Automator — CLI Entry Point."""
import argparse
import asyncio
import sys
from datetime import date

import config
from orchestrator.excel_reader import ExcelManager
from utils.logger import setup_logger, log


def get_target_month(today: date) -> date:
    """Previous calendar month as date(year, month, 1)."""
    if today.month == 1:
        return date(today.year - 1, 12, 1)
    return date(today.year, today.month - 1, 1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bank Statement Automator — download PDF statements automatically"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without launching browsers")
    parser.add_argument("--debug", action="store_true",
                        help="Save screenshots, verbose logging, slower delays")
    parser.add_argument("--account", type=str, default=None,
                        help="Process only this client name")
    parser.add_argument("--bank", type=str, default=None,
                        help="Process only this bank (used with --account)")
    parser.add_argument("--retry-only", action="store_true",
                        help="Only process items in the Retry Queue")
    parser.add_argument("--keep-screenshots", action="store_true",
                        help="Don't delete debug screenshots after run")
    parser.add_argument("--watch", action="store_true",
                        help="Pause after each AI call for operator review")
    parser.add_argument("--relearn", action="store_true",
                        help="Ignore existing playbooks, re-learn all bank flows")
    parser.add_argument("--setup-dialpad", action="store_true",
                        help="Open Dialpad browser for manual login, then save profile")
    return parser.parse_args()


def should_attempt(job, today, mgr) -> bool:
    """Check if this job should be attempted this run."""
    target = get_target_month(today)
    target_str = f"{target.year}-{target.month:02d}"

    if mgr.has_success(job.client_name, job.bank_name, job.account_last4, target_str):
        return False
    if today.day < job.statement_available_date:
        return False
    if job.tfa_target == "client":
        return False
    if job.status != "active":
        return False
    return True


def _get_retry_backoff_skips(mgr, today) -> set[tuple[str, str, str]]:
    """Return set of (client, bank, last4) tuples that have a pending retry
    whose next_retry_date has not yet arrived (backoff not elapsed)."""
    skips: set[tuple[str, str, str]] = set()
    for item in mgr.get_retry_queue():
        if item.next_retry_date > today:
            skips.add((item.client_name, item.bank_name, item.account_last4))
    return skips


def _filter_jobs(jobs, args, mgr, today):
    """Apply --account, --bank, --retry-only filters and retry backoff enforcement."""
    original_count = len(jobs)

    # --retry-only: replace job list with retry queue entries that are due
    if args.retry_only:
        retry_items = mgr.get_retry_queue()
        due_items = [r for r in retry_items if r.next_retry_date <= today]
        not_due = [r for r in retry_items if r.next_retry_date > today]

        if not_due:
            log.info(
                f"Retry queue: skipping {len(not_due)} entries not yet due "
                f"(next retry date in future)"
            )
            for r in not_due:
                log.debug(
                    f"  Backoff skip: {r.client_name}/{r.bank_name} "
                    f"#{r.account_last4} — next retry {r.next_retry_date}"
                )

        # Match retry entries back to full AccountJob objects
        retry_keys = {
            (r.client_name, r.bank_name, r.account_last4) for r in due_items
        }
        all_accounts = mgr.read_accounts()
        jobs = [
            j for j in all_accounts
            if (j.client_name, j.bank_name, j.account_last4) in retry_keys
            and j.status == "active"
        ]
        log.info(
            f"Retry-only mode: {len(retry_items)} pending retries, "
            f"{len(due_items)} due today, {len(jobs)} matched to active accounts"
        )
    else:
        # Normal run: skip jobs with pending retry whose backoff hasn't elapsed
        backoff_skips = _get_retry_backoff_skips(mgr, today)
        if backoff_skips:
            before = len(jobs)
            jobs = [
                j for j in jobs
                if (j.client_name, j.bank_name, j.account_last4) not in backoff_skips
            ]
            skipped = before - len(jobs)
            if skipped:
                log.info(
                    f"Retry backoff: skipping {skipped} jobs with future retry date"
                )

    # --account filter
    if args.account:
        needle = args.account.lower()
        before = len(jobs)
        jobs = [j for j in jobs if needle in j.client_name.lower()]
        log.info(
            f"Account filter '{args.account}': {before} -> {len(jobs)} jobs"
        )

    # --bank filter
    if args.bank:
        needle = args.bank.lower()
        before = len(jobs)
        jobs = [j for j in jobs if needle in j.bank_name.lower()]
        log.info(
            f"Bank filter '{args.bank}': {before} -> {len(jobs)} jobs"
        )

    if len(jobs) != original_count:
        log.info(f"After all filters: {original_count} -> {len(jobs)} jobs")

    return jobs


def dry_run(args):
    """Read Excel, build queue, print summary. No browsers."""
    from orchestrator.playbook import load_playbook, is_fresh

    today = date.today()
    target = get_target_month(today)
    target_str = f"{target.year}-{target.month:02d}"

    with ExcelManager() as mgr:
        accounts = mgr.read_accounts()
        total = len(accounts)

        already_done = []
        skipped_client_2fa = []
        skipped_not_available = []
        skipped_inactive = []
        to_process = []
        stale_creds = []

        for job in accounts:
            if mgr.has_success(job.client_name, job.bank_name, job.account_last4, target_str):
                already_done.append(job)
            elif job.tfa_target == "client":
                skipped_client_2fa.append(job)
            elif today.day < job.statement_available_date:
                skipped_not_available.append(job)
            elif job.status != "active":
                skipped_inactive.append(job)
            else:
                to_process.append(job)
                if job.last_successful_login:
                    days = (today - job.last_successful_login).days
                    if days > config.STALE_CREDENTIAL_DAYS:
                        stale_creds.append((job, days))

    banks = set(j.bank_name for j in to_process)

    # Estimate costs with playbook awareness
    banks_with_playbook = set()
    banks_without_playbook = set()
    for b in banks:
        pb = load_playbook(b)
        if pb and is_fresh(pb):
            banks_with_playbook.add(b)
        else:
            banks_without_playbook.add(b)

    # Login steps saved by playbook: ~4-5 AI calls per bank login
    login_calls_saved = len(banks_with_playbook) * 4
    est_calls_full = len(to_process) * 5
    est_calls = max(1, est_calls_full - login_calls_saved)
    est_cost = est_calls * 0.015  # Blended avg: ~60% Haiku ($0.006) + ~40% Sonnet ($0.025)

    print(f"\nDRY RUN — no actions will be taken")
    print("=" * 50)
    print(f"Target month: {target_str}")
    print(f"Accounts in spreadsheet: {total}")
    print(f"Already downloaded: {len(already_done)}")
    print(f"Skipped (2FA=client): {len(skipped_client_2fa)}")
    print(f"Skipped (before available date): {len(skipped_not_available)}")
    print(f"Skipped (status!=active): {len(skipped_inactive)}")
    print("=" * 50)
    print(f"TO PROCESS: {len(to_process)} accounts across {len(banks)} banks")
    if banks_with_playbook:
        print(f"  Banks with playbook (replay): {', '.join(sorted(banks_with_playbook))}")
    if banks_without_playbook:
        print(f"  Banks without playbook (learn): {', '.join(sorted(banks_without_playbook))}")
    print(f"Estimated AI calls: ~{est_calls} (reduced from ~{est_calls_full} by playbooks)")
    print(f"Estimated cost: ~${est_cost:.2f}")
    print(f"Estimated time: ~{len(to_process) * 2} minutes (2 parallel windows)")

    if stale_creds:
        print(f"\nAccounts with stale credentials (>{config.STALE_CREDENTIAL_DAYS} days):")
        for job, days in stale_creds:
            print(f"  ! {job.client_name} / {job.bank_name} — last login: {job.last_successful_login} ({days}d ago)")

    if to_process:
        print(f"\nAccounts to process:")
        for job in to_process:
            print(f"  {job.client_name} / {job.bank_name} #{job.account_last4}")


async def setup_dialpad():
    """Open Dialpad browser window for manual login."""
    from utils.browser_setup import launch_hardened_browser

    print("Opening Dialpad browser window...")
    print("Log into Dialpad and navigate to the Messages view.")
    ctx = await launch_hardened_browser("dialpad")
    page = ctx.pages[0] if ctx.pages else await ctx.new_page()
    await page.goto("https://dialpad.com/app")

    input("\nPress Enter when you're logged in and ready. Profile will be saved.")
    print("Dialpad profile saved to browser-profiles/dialpad/")
    await ctx.close()


async def main_async(args):
    """Full async run with browser sessions."""
    from orchestrator.action_logger import ActionLogger
    from orchestrator.job_scheduler import build_schedule, run_schedule
    from orchestrator.shutdown import GracefulShutdown

    today = date.today()
    shutdown = GracefulShutdown()

    # Create action logger
    action_logger = ActionLogger()

    with ExcelManager() as mgr:
        accounts = mgr.read_accounts()

        if args.retry_only:
            # In retry-only mode, skip normal should_attempt filtering;
            # _filter_jobs builds the job list from the retry queue instead.
            jobs = list(accounts)
        else:
            jobs = [j for j in accounts if should_attempt(j, today, mgr)]

        jobs = _filter_jobs(jobs, args, mgr, today)

        if not jobs:
            log.info("No accounts to process this run.")
            return

        log.info(f"Processing {len(jobs)} accounts")
        schedule = build_schedule(jobs)
        await run_schedule(
            schedule, mgr, shutdown,
            action_logger=action_logger,
            watch_mode=args.watch,
            relearn=args.relearn,
        )

    action_logger.print_summary()


def main():
    args = parse_args()

    if args.debug:
        config.DEBUG_SCREENSHOTS = True
        setup_logger(debug=True)

    if args.setup_dialpad:
        asyncio.run(setup_dialpad())
        return

    if args.dry_run:
        dry_run(args)
        return

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
