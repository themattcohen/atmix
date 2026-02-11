"""Helpers for Chart-of-Accounts mapping and user overrides (ASCII)."""

import pandas as pd
import json
import os
from pathlib import Path

_STD_CSV = Path(__file__).resolve().parent.parent / "data" / "standard_coa.csv"
_OVR_JSON = Path(__file__).resolve().parent.parent / "config" / "account_mapping_override.json"

def load_standard_coa() -> pd.DataFrame:
    """Return DataFrame with standard Chart of Accounts."""
    return pd.read_csv(_STD_CSV, sep='\t')

def load_overrides() -> dict:
    """Load account mapping overrides from JSON file."""
    if _OVR_JSON.exists():
        with open(_OVR_JSON, 'r') as f:
            return json.load(f)['mappings']
    return {}

def save_overrides(mappings: dict) -> None:
    """Save account mapping overrides to JSON file."""
    with open(_OVR_JSON, 'w') as f:
        json.dump({'mappings': mappings}, f, indent=4)

def validate_all_accounts_mapped(df_gl, df_mapped):
    if 'standard_account' not in df_mapped.columns:
        raise Exception('Unmapped accounts found')

    """Ensure all GL accounts are mapped to standard categories."""
    unmapped = df_mapped[df_mapped["standard_account"].isna()]
    if not unmapped.empty:
        from datetime import datetime
        outdir = "output"
        os.makedirs(outdir, exist_ok=True)
        outfile = os.path.join(outdir, f"unmapped_accounts_{datetime.now():%Y%m%d_%H%M%S}.csv")
        unmapped.to_csv(outfile, index=False)
        raise Exception(
            f"🛑 Unmapped accounts found! Please open {outfile}, fill in 'user_mapped_category', "
            "save it as 'data/coa_user_overrides.csv', and rerun the app."
        )
    print("✅ All accounts successfully mapped.")

