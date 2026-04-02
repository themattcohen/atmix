"""Generate human-readable run summary to stdout and to a text file."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .models import AccountResult, RunReport, RunStatus


def generate_report(report: RunReport, output_dir: Path | None = None) -> str:
    """Write a human-readable summary to stdout and optionally to a file.

    The file is saved as {output_dir}/{report.run_id}_report.txt.
    Returns the full report string so callers can inspect or test it.

    Format example:
        === Bank Statement Run: 2026-03 ===
        Run ID:   20260402_143022
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
    lines: list[str] = []

    # Header
    lines.append(f"=== Bank Statement Run: {report.target_month} ===")
    lines.append(f"Run ID:   {report.run_id}")

    duration_str = _format_duration(report.started_at, report.finished_at)
    lines.append(f"Duration: {duration_str}")
    lines.append("")

    total = report.total_count

    # Group results by status
    successes  = [r for r in report.results if r.status == RunStatus.SUCCESS]
    failures   = [r for r in report.results if r.status == RunStatus.FAILED]
    skipped    = [r for r in report.results if r.status == RunStatus.ALREADY_EXISTS]
    other      = [
        r for r in report.results
        if r.status not in (RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.ALREADY_EXISTS)
    ]

    # SUCCESS block
    lines.append(f"SUCCESS ({len(successes)}/{total}):")
    if successes:
        for r in successes:
            label = _account_label(r)
            path_str = str(r.output_path) if r.output_path else ""
            lines.append(f"  {label:<45} {path_str}")
    else:
        lines.append("  (none)")
    lines.append("")

    # FAILED block
    lines.append(f"FAILED ({len(failures)}/{total}):")
    if failures:
        for r in failures:
            label = _account_label(r)
            err_str = r.error or ""
            lines.append(f"  {label:<45} {err_str}")
    else:
        lines.append("  (none)")
    lines.append("")

    # ALREADY EXISTS (skipped) block
    if skipped or other:
        skipped_all = skipped + other
        lines.append(f"SKIPPED ({len(skipped_all)}/{total}):")
        for r in skipped_all:
            label = _account_label(r)
            reason = r.error or "already exists"
            lines.append(f"  {label:<45} {reason}")
        lines.append("")

    # Footer
    lines.append(
        f"Total: {total}  |  "
        f"Success: {report.success_count}  |  "
        f"Failed: {report.fail_count}"
    )

    text = "\n".join(lines)
    print(text)

    # Persist to file if output_dir is given
    if output_dir is not None:
        output_dir.mkdir(parents=True, exist_ok=True)
        report_file = output_dir / f"{report.run_id}_report.txt"
        report_file.write_text(text, encoding="utf-8")

    return text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _account_label(result: AccountResult) -> str:
    """Return a short display label: ClientName__BankName #last4"""
    acct = result.account
    client = acct.client_name.replace(" ", "_")
    bank   = acct.bank_name.title()
    last4  = acct.account_last4
    return f"{client}__{bank} #{last4}"


def _format_duration(started_at: datetime, finished_at: datetime | None) -> str:
    """Format elapsed time as 'Xm Ys' or 'unknown' if finished_at is absent."""
    if finished_at is None:
        return "unknown (run did not finish)"
    delta = finished_at - started_at
    total_seconds = int(delta.total_seconds())
    minutes, seconds = divmod(abs(total_seconds), 60)
    return f"{minutes}m {seconds}s"
