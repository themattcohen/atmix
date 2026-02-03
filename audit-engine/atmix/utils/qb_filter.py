"""QuickBooks export filtering utilities.

QuickBooks exports contain structural rows that are NOT transaction data:
- Header rows (company name, date range, column titles)
- Subtotal rows ("Total for [Category]")
- Grand total rows ("TOTAL")
- Footer rows (generation timestamp)

This module provides utilities to filter these out before analysis.
"""

import re
from typing import Optional, List

import pandas as pd


# Patterns that indicate a QuickBooks structural row (not actual data)
QB_STRUCTURAL_PATTERNS = [
    r'^Total for\s+',           # Subtotal rows
    r'^TOTAL$',                  # Grand total row (case insensitive handled separately)
    r'^\s*$',                    # Empty rows
    r'^Accrual Basis',           # Footer timestamp rows
    r'^Cash Basis',              # Footer timestamp rows
    r'^\d{1,2}/\d{1,2}/\d{2,4}', # Date-only rows (often headers)
]

# Column names that often contain structural indicators
QB_LABEL_COLUMNS = [
    'vendor', 'name', 'account', 'distribution account',
    'unnamed: 0', '', 'description', 'memo'
]


def is_structural_row(value: str) -> bool:
    """Check if a cell value indicates a QuickBooks structural row.

    Args:
        value: The cell value to check (typically from first column)

    Returns:
        True if this appears to be a structural row (Total, header, etc.)
    """
    if pd.isna(value):
        return False

    value_str = str(value).strip()

    # Check for TOTAL (case insensitive)
    if value_str.upper() == 'TOTAL':
        return True

    # Check against patterns
    for pattern in QB_STRUCTURAL_PATTERNS:
        if re.match(pattern, value_str, re.IGNORECASE):
            return True

    return False


def filter_qb_structural_rows(
    df: pd.DataFrame,
    label_column: Optional[str] = None,
    additional_filters: Optional[List[str]] = None
) -> pd.DataFrame:
    """Filter out QuickBooks structural rows from a DataFrame.

    This removes:
    - Rows where the label column starts with "Total for"
    - Rows where the label column equals "TOTAL"
    - Footer/timestamp rows
    - Empty rows

    Args:
        df: The DataFrame to filter
        label_column: The column to check for structural patterns.
                     If None, tries to auto-detect from common column names.
        additional_filters: Extra patterns to filter (regex strings)

    Returns:
        Filtered DataFrame with structural rows removed
    """
    if df.empty:
        return df

    # Auto-detect label column if not specified
    if label_column is None:
        label_column = _find_label_column(df)

    if label_column is None or label_column not in df.columns:
        # Can't filter without a label column - return as-is
        return df

    # Create mask for rows to KEEP (not structural)
    mask = ~df[label_column].apply(lambda x: is_structural_row(x))

    # Apply additional filters if provided
    if additional_filters:
        for pattern in additional_filters:
            mask &= ~df[label_column].str.contains(pattern, case=False, na=False, regex=True)

    return df[mask].copy()


def _find_label_column(df: pd.DataFrame) -> Optional[str]:
    """Try to find the column containing row labels (vendor, account, etc.)."""
    columns_lower = {col.lower().strip(): col for col in df.columns}

    for candidate in QB_LABEL_COLUMNS:
        if candidate.lower() in columns_lower:
            return columns_lower[candidate.lower()]

    # If no match, use first column
    if len(df.columns) > 0:
        return df.columns[0]

    return None


def clean_vendor_name(name: str) -> Optional[str]:
    """Clean a vendor name, returning None if it's a structural value.

    Args:
        name: The vendor name to clean

    Returns:
        Cleaned name, or None if it's a structural row label
    """
    if pd.isna(name):
        return None

    name_str = str(name).strip()

    if is_structural_row(name_str):
        return None

    return name_str


def filter_expense_accounts(df: pd.DataFrame, account_column: str = 'account') -> pd.DataFrame:
    """Filter a P&L or expense DataFrame to remove subtotal rows.

    Specifically targets QuickBooks P&L export patterns.
    """
    if account_column not in df.columns:
        # Try to find it
        for col in df.columns:
            if 'account' in col.lower() or 'distribution' in col.lower():
                account_column = col
                break

    if account_column not in df.columns:
        return df

    # Filter patterns specific to P&L
    patterns_to_remove = [
        r'^Total for\s+',
        r'^Gross Profit$',
        r'^Net Income$',
        r'^Net Operating Income$',
        r'^Net Other Income$',
    ]

    mask = pd.Series([True] * len(df))
    for pattern in patterns_to_remove:
        mask &= ~df[account_column].str.contains(pattern, case=False, na=False, regex=True)

    return df[mask].copy()


def is_summary_account(account_name: str) -> bool:
    """Check if an account name is a summary/subtotal account.

    Args:
        account_name: The account name to check

    Returns:
        True if this is a summary row, not an actual account
    """
    if pd.isna(account_name):
        return False

    name = str(account_name).strip().lower()

    summary_indicators = [
        'total for',
        'total ',  # "Total Income", "Total Expenses", etc.
        'gross profit',
        'net income',
        'net operating income',
    ]

    for indicator in summary_indicators:
        if name.startswith(indicator):
            return True

    return name.upper() == 'TOTAL'


def get_actual_accounts(df: pd.DataFrame, account_column: str) -> List[str]:
    """Get list of actual account names (not summaries) from a DataFrame.

    Args:
        df: DataFrame with account data
        account_column: Column containing account names

    Returns:
        List of actual account names (not Total/Summary rows)
    """
    if account_column not in df.columns:
        return []

    accounts = df[account_column].dropna().unique()
    return [str(acc) for acc in accounts if not is_summary_account(acc)]
