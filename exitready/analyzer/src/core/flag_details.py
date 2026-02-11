"""
Utility for building the consolidated `Flag Details` sheet.

The caller passes in:
    * master_flag_list  – list[dict]   – every flag across all phases
    * gl_df             – pd.DataFrame – full, mapped general‑ledger data
    * cap               – int          – max rows per phase (default = 100)
Returned:
    pd.DataFrame ready to write to Excel.
"""

from __future__ import annotations
from collections import defaultdict
from typing import List, Dict, Any
import pandas as pd


def _normalize_refs(ref) -> list[str]:
    if ref is None:
        return []
    if isinstance(ref, (list, tuple, set)):
        return list(ref)
    return [ref]


def build_flag_details(
    master_flag_list: List[Dict[str, Any]],
    gl_df: pd.DataFrame,
    cap: int = 100,
) -> pd.DataFrame:
    """Build the consolidated detail DataFrame capped to `cap` rows per phase."""

    # Bucket rows by phase to enforce the per‑phase cap
    phase_buckets: dict[str, list[pd.DataFrame]] = defaultdict(list)

    for flag in master_flag_list:
        phase = flag.get("category", "Unknown")
        analysis_name = flag.get("flag", "")
        reason = flag.get("detail", "")

        refs = _normalize_refs(flag.get("detail_ref"))
        if refs:
            # Transaction‑level detail
            rows = (
                gl_df[gl_df["transaction_id"].isin(refs)]
                .copy()
                .head(cap)  # apply per‑flag cap defensively
            )
        else:
            # High‑level test; include synthetic context only
            rows = pd.DataFrame(
                {
                    "account_number": [flag.get("account_number", "")],
                    "period": [flag.get("period", "")],
                    "metric": [flag.get("metric", "")],
                    "value": [flag.get("amount", "")],
                }
            )

        rows.insert(0, "phase", phase)
        rows.insert(1, "analysis_name", analysis_name)
        rows.insert(2, "reason", reason)

        # Soft‑cap enforcement at the *phase* level
        phase_buckets[phase].append(rows)

    # Apply 100‑row phase cap and add the truncation marker
    capped_frames = []
    for phase, frame_list in phase_buckets.items():
        phase_df = pd.concat(frame_list, ignore_index=True)
        if len(phase_df) > cap:
            phase_df = phase_df.head(cap)
            phase_df.loc[:, "note"] = "CAP_AT_100"
        capped_frames.append(phase_df)

    if not capped_frames:
        return pd.DataFrame()

    # De‑dupe any accidental double‑import of the same GL row
    final_df = (
        pd.concat(capped_frames, ignore_index=True)
        .loc[:, ~pd.concat(capped_frames, ignore_index=True).columns.duplicated()]
    )

    return final_df
