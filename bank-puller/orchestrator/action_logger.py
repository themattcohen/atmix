"""Action Logger — JSONL flight recorder for every step of a bank session."""
from __future__ import annotations

import json
from collections import defaultdict
from contextvars import ContextVar
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from config import LOGS_DIR


# ---------------------------------------------------------------------------
# Action record
# ---------------------------------------------------------------------------
@dataclass
class ActionRecord:
    """Single action in the flight recorder."""

    ts: str = ""
    window: int = 0
    client: str = ""
    bank: str = ""
    last4: str = ""
    type: str = ""  # ai_skill, click, type, navigate, screenshot, 2fa_trigger, 2fa_receive, state_detect, download, validate, playbook_hit, playbook_miss, session_start, session_end
    skill: str = ""
    description: str = ""
    confidence: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    coords: dict[str, int] | None = None
    page_state: str = ""
    duration_ms: int = 0
    success: bool = True
    mode: str = ""  # learn, replay
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Drop None coords for cleaner output
        if d["coords"] is None:
            del d["coords"]
        return d


# ---------------------------------------------------------------------------
# Shared context (module-level, avoids passing logger everywhere)
# ---------------------------------------------------------------------------
@dataclass
class _LogContext:
    logger: ActionLogger | None = None
    window: int = 0
    client: str = ""
    bank: str = ""
    last4: str = ""


_context_var: ContextVar[_LogContext] = ContextVar("_log_context", default=_LogContext())


def set_context(
    logger: ActionLogger,
    window_id: int = 0,
    client: str = "",
    bank: str = "",
    last4: str = "",
) -> None:
    """Set the shared logging context for the current asyncio Task."""
    ctx = _LogContext(logger=logger, window=window_id, client=client, bank=bank, last4=last4)
    _context_var.set(ctx)


def clear_context() -> None:
    """Clear the shared logging context."""
    _context_var.set(_LogContext())


def get_logger() -> ActionLogger | None:
    """Get the current ActionLogger from shared context."""
    return _context_var.get().logger


def log_action(
    *,
    type: str,
    skill: str = "",
    description: str = "",
    confidence: float = 0.0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    cost_usd: float = 0.0,
    coords: dict[str, int] | None = None,
    page_state: str = "",
    duration_ms: int = 0,
    success: bool = True,
    mode: str = "",
    note: str = "",
) -> None:
    """Convenience: emit an action record using the shared context."""
    ctx = _context_var.get()
    if ctx.logger is None:
        return  # No logger configured (e.g. dry-run)

    record = ActionRecord(
        ts=datetime.now().isoformat(timespec="milliseconds"),
        window=ctx.window,
        client=ctx.client,
        bank=ctx.bank,
        last4=ctx.last4,
        type=type,
        skill=skill,
        description=description,
        confidence=confidence,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=cost_usd,
        coords=coords,
        page_state=page_state,
        duration_ms=duration_ms,
        success=success,
        mode=mode,
        note=note,
    )
    ctx.logger.log(record)


# ---------------------------------------------------------------------------
# ActionLogger
# ---------------------------------------------------------------------------
class ActionLogger:
    """JSONL flight recorder for a single run."""

    def __init__(self, run_id: str | None = None):
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        self._path = LOGS_DIR / f"{self.run_id}.jsonl"
        self._path.parent.mkdir(parents=True, exist_ok=True)

        # In-memory counters for summary
        self._records: list[ActionRecord] = []
        self._calls_by_skill: dict[str, int] = defaultdict(int)
        self._cost_by_skill: dict[str, float] = defaultdict(float)
        self._time_by_bank: dict[str, int] = defaultdict(int)  # ms
        self._playbook_hits: int = 0
        self._playbook_misses: int = 0
        self._total_ai_calls: int = 0
        self._total_cost: float = 0.0

    def log(self, record: ActionRecord) -> None:
        """Append a record to the JSONL file and update counters.

        Synchronous write — safe for single-threaded asyncio.
        The asyncio lock is used only if called from async context.
        """
        self._records.append(record)

        # Update counters
        if record.type == "ai_skill":
            self._calls_by_skill[record.skill] += 1
            self._cost_by_skill[record.skill] += record.cost_usd
            self._total_ai_calls += 1
            self._total_cost += record.cost_usd

        if record.type == "playbook_hit":
            self._playbook_hits += 1
        elif record.type == "playbook_miss":
            self._playbook_misses += 1

        if record.bank:
            self._time_by_bank[record.bank] += record.duration_ms

        # Write to file
        line = json.dumps(record.to_dict(), default=str)
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def print_summary(self) -> None:
        """Print end-of-run summary table."""
        if not self._records:
            print("\nNo actions logged.")
            return

        print(f"\n{'=' * 60}")
        print(f"  ACTION LOG SUMMARY — Run {self.run_id}")
        print(f"  Log file: {self._path}")
        print(f"{'=' * 60}")

        # AI calls by skill
        if self._calls_by_skill:
            print(f"\n  AI Calls by Skill:")
            print(f"  {'Skill':<35} {'Calls':>6} {'Cost':>8}")
            print(f"  {'-'*35} {'-'*6} {'-'*8}")
            for skill in sorted(self._calls_by_skill, key=lambda s: -self._cost_by_skill[s]):
                calls = self._calls_by_skill[skill]
                cost = self._cost_by_skill[skill]
                print(f"  {skill:<35} {calls:>6} ${cost:>7.4f}")
            print(f"  {'-'*35} {'-'*6} {'-'*8}")
            print(f"  {'TOTAL':<35} {self._total_ai_calls:>6} ${self._total_cost:>7.4f}")

        # Time by bank
        if self._time_by_bank:
            print(f"\n  Time by Bank:")
            print(f"  {'Bank':<35} {'Duration':>10}")
            print(f"  {'-'*35} {'-'*10}")
            for bank in sorted(self._time_by_bank, key=lambda b: -self._time_by_bank[b]):
                ms = self._time_by_bank[bank]
                secs = ms / 1000
                print(f"  {bank:<35} {secs:>8.1f}s")

        # Playbook stats
        total_pb = self._playbook_hits + self._playbook_misses
        if total_pb > 0:
            hit_rate = self._playbook_hits / total_pb * 100
            est_saved = self._playbook_hits * 0.01  # rough: $0.01 per avoided AI call
            print(f"\n  Playbook Stats:")
            print(f"    Hits: {self._playbook_hits}  Misses: {self._playbook_misses}  Hit rate: {hit_rate:.0f}%")
            print(f"    Estimated savings: ~${est_saved:.2f}")

        # Total records
        type_counts = defaultdict(int)
        for r in self._records:
            type_counts[r.type] += 1
        print(f"\n  Action Types: {dict(type_counts)}")
        print(f"  Total records: {len(self._records)}")
        print(f"{'=' * 60}")
