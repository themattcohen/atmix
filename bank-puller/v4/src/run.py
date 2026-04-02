"""CLI entry point for Bank Statement Automator v4.

Usage:
    python -m src.run --month 2026-03
    python -m src.run --month 2026-03 --bank chase
    python -m src.run --month 2026-03 --account 8035 --resume
    python -m src.run --month 2026-03 --headless
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from .config import Settings
from .orchestrator import Orchestrator


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="bank-puller",
        description="Bank Statement Automator v4 — downloads monthly statements via BrowserUse",
    )
    parser.add_argument(
        "--month",
        required=True,
        metavar="YYYY-MM",
        help="Target month to download (e.g. 2026-03)",
    )
    parser.add_argument(
        "--bank",
        default=None,
        metavar="BANK_NAME",
        help="Filter to a single bank (matches bank_name column, case-insensitive)",
    )
    parser.add_argument(
        "--account",
        default=None,
        metavar="LAST4",
        help="Filter to accounts whose account_last4 matches this value",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from the most recent checkpoint for this month",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run the browser in headless mode (no visible window)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point. Returns exit code: 0 = success, 1 = some failures."""
    _configure_logging()
    args = _parse_args(argv)

    # Validate month format
    import re
    if not re.fullmatch(r"\d{4}-\d{2}", args.month):
        print(f"ERROR: --month must be in yyyy-mm format, got: {args.month!r}", file=sys.stderr)
        return 2

    # Load settings; headless flag from CLI overrides .env
    try:
        settings = Settings()
    except Exception as exc:
        print(f"ERROR: Failed to load settings: {exc}", file=sys.stderr)
        print("Make sure ANTHROPIC_API_KEY is set in the environment or bank-puller/.env", file=sys.stderr)
        return 2

    if args.headless:
        # Override the setting without mutating (Settings is a frozen pydantic model
        # in some versions — re-construct with the override)
        settings = settings.model_copy(update={"headless": True})

    orchestrator = Orchestrator(
        settings=settings,
        bank_filter=args.bank,
        account_filter=args.account,
    )

    report = asyncio.run(
        orchestrator.run_all(
            accounts_path=settings.accounts_path,
            target_month=args.month,
            resume=args.resume,
        )
    )

    print(f"\nRun complete: {report.success_count}/{report.total_count} succeeded")

    return 0 if report.fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
