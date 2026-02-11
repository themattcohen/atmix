"""
Utility for building the consolidated `Flag Details` sheet.

Implements detailed row retrieval for every analysis phase.
"""
from collections import defaultdict
import pandas as pd

def build_flag_details(
    master_flag_list,
    gl_df: pd.DataFrame,
    ar_df: pd.DataFrame = None,
    monthly_financials: dict = None,
    cap: int = 100,
) -> pd.DataFrame:
    if ar_df is None:
        ar_df = pd.DataFrame()
    if monthly_financials is None:
        monthly_financials = {}

    # Prepare period column on gl_df if transaction_date exists
    if 'transaction_date' in gl_df.columns:
        gl_df['__period'] = pd.to_datetime(gl_df['transaction_date']).dt.to_period('M').astype(str)

    phase_buckets = defaultdict(list)

    for flag in master_flag_list:
        phase = flag.get('category', '')
        name = flag.get('flag', '')
        reason = flag.get('detail', '')
        period = flag.get('period', '')
        acct = flag.get('account_number', '')
        refs = flag.get('detail_ref') or []
        if not isinstance(refs, (list, set, tuple)):
            refs = [refs]
        rows = pd.DataFrame()

        # Collection & Cash Flow: AR aging
        if phase == 'Collection & Cash Flow' and 'receivables' in name.lower():
            thresh = 90 if '>90' in name else 60
            if 'days_outstanding' in ar_df.columns:
                rows = ar_df[ar_df['days_outstanding'] > thresh].head(cap)

        # DSO
        elif 'dso' in name.lower() or 'sales outstanding' in name.lower():
            val = monthly_financials.get(period, {})
            rows = pd.DataFrame([{ 'period': period, 'receivables': val.get('receivables'), 'revenue': val.get('revenue') }])

        # Transaction-level flags
        elif refs:
            rows = gl_df[gl_df['transaction_id'].isin(refs)].head(cap)

        # Revenue Quality
        elif phase == 'Revenue Quality':
            df = gl_df
            if acct:
                df = df[df['account_number'] == acct]
            if period and '__period' in df.columns:
                df = df[df['__period'] == period]
            rows = df.head(cap)

        # Client Risk
        elif phase == 'Client Risk':
            clients = flag.get('client_list') or flag.get('clients')
            if clients and 'client' in ar_df.columns:
                rows = ar_df[ar_df['client'].isin(clients)].head(cap)

        # Operational Risk
        elif phase == 'Operational Risk':
            df = gl_df[gl_df['account_number'].astype(str).str.match('[56]')]
            if period and '__period' in df.columns:
                df = df[df['__period'] == period]
            rows = df.head(cap)

        # Fallback: context row
        if rows is None or rows.empty:
            rows = pd.DataFrame([{ 'phase': phase, 'analysis_name': name, 'reason': reason, 'period': period, 'account_number': acct, 'amount': flag.get('amount','') }])

        # Prepend metadata if columns don't exist
        if 'reason' not in rows.columns:
            rows.insert(0, 'reason', reason)
        if 'analysis_name' not in rows.columns:
            rows.insert(0, 'analysis_name', name)
        if 'phase' not in rows.columns:
            rows.insert(0, 'phase', phase)

        # Cap note
        if len(rows) > cap:
            rows = rows.head(cap)
            rows['note'] = 'CAP_AT_100'

        phase_buckets[phase].append(rows)

    # Combine and dedupe
    all_frames = [pd.concat(fs, ignore_index=True) for fs in phase_buckets.values()]
    combined = pd.concat(all_frames, ignore_index=True) if all_frames else pd.DataFrame()
    combined = combined.loc[:, ~combined.columns.duplicated()]
    return combined
