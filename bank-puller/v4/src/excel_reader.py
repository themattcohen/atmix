"""Parse clients.xlsx into structured BankAccount / LoginGroup objects."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import openpyxl

from .models import BankAccount, LoginGroup, TFAMethod


# ---------------------------------------------------------------------------
# Column name -> model field mapping
# Normalised header (stripped, lowercased) is looked up here first.
# ---------------------------------------------------------------------------

COLUMN_MAP: dict[str, str] = {
    "client name":    "client_name",
    "client_name":    "client_name",
    "bank":           "bank_name",
    "bank name":      "bank_name",
    "bank_name":      "bank_name",
    "url":            "login_url",
    "login url":      "login_url",
    "login_url":      "login_url",
    "user":           "username",
    "username":       "username",
    "pass":           "password",
    "password":       "password",
    "last4":          "account_last4",
    "account_last4":  "account_last4",
    "2fa":            "tfa_method",
    "tfa_method":     "tfa_method",
    "2fa detail":     "tfa_detail",
    "tfa_detail":     "tfa_detail",
    "notes":          "notes",
    # Active/skip flag
    "active":         "active",
}

_REQUIRED_FIELDS = {
    "client_name",
    "bank_name",
    "login_url",
    "username",
    "password",
    "account_last4",
}


def _normalise_header(raw: str) -> str:
    """Strip whitespace and lowercase a column header."""
    return raw.strip().lower() if isinstance(raw, str) else ""


def _cell_str(value: object) -> str:
    """Convert a cell value to a stripped string, or '' if None/empty."""
    if value is None:
        return ""
    return str(value).strip()


def read_accounts(path: Path) -> list[BankAccount]:
    """Parse clients.xlsx and return one BankAccount per active row.

    Expected columns (case-insensitive, leading/trailing space stripped):
        client_name, bank_name, login_url, username, password,
        account_last4, tfa_method, tfa_detail, notes

    Optional columns (parsed if present):
        security_q1, security_a1, security_q2, security_a2, ...
        active  (rows where this column is "no" or "0" are skipped)

    Raises FileNotFoundError if path does not exist.
    Raises ValueError with row number if a required field cannot be resolved.
    """
    if not path.exists():
        raise FileNotFoundError(f"Accounts file not found: {path}")

    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    # Build header index: normalised_name -> column index
    raw_headers: tuple = rows[0]
    header_index: dict[str, int] = {}           # field_name -> col idx
    security_cols: dict[int, tuple[str, str]] = {}  # col_idx -> ("q"|"a", str(number))

    for col_idx, raw in enumerate(raw_headers):
        norm = _normalise_header(str(raw) if raw is not None else "")
        if not norm:
            continue

        # Check COLUMN_MAP first
        if norm in COLUMN_MAP:
            field = COLUMN_MAP[norm]
            header_index[field] = col_idx
            continue

        # Security question/answer columns: security_q1 / security_a1 etc.
        for prefix, kind in (("security_q", "q"), ("security_a", "a")):
            if norm.startswith(prefix):
                suffix = norm[len(prefix):]
                if suffix.isdigit():
                    security_cols[col_idx] = (kind, suffix)
                    break

    # Validate required columns are present
    missing = _REQUIRED_FIELDS - set(header_index.keys())
    if missing:
        raise ValueError(
            f"clients.xlsx is missing required columns: {sorted(missing)}\n"
            f"Found headers: {list(raw_headers)}"
        )

    # Determine which security question numbers appear
    # Build mapping: number -> {"q": col_idx, "a": col_idx}
    sec_pair_cols: dict[str, dict[str, int]] = defaultdict(dict)
    for col_idx, (kind, num) in security_cols.items():
        sec_pair_cols[num][kind] = col_idx

    accounts: list[BankAccount] = []

    for row_num, row in enumerate(rows[1:], start=2):

        def get_field(field_name: str) -> str:
            idx = header_index.get(field_name)
            if idx is None:
                return ""
            return _cell_str(row[idx])

        # Skip inactive rows
        active_val = get_field("active").lower()
        if active_val in ("no", "0", "false"):
            continue

        # Skip completely empty rows (all required fields blank)
        client_name = get_field("client_name")
        if not client_name:
            continue

        # Validate required fields
        field_values: dict[str, str] = {}
        for field in _REQUIRED_FIELDS:
            val = get_field(field)
            if not val:
                raise ValueError(
                    f"Row {row_num}: required field '{field}' is empty. "
                    f"client_name={client_name!r}"
                )
            field_values[field] = val

        # Optional fields
        tfa_method_raw = get_field("tfa_method").lower() or "none"
        try:
            tfa_method = TFAMethod(tfa_method_raw)
        except ValueError:
            tfa_method = TFAMethod.NONE

        tfa_detail_val = get_field("tfa_detail") or None
        notes_val = get_field("notes") or None

        # Collect security Q&A pairs
        security_questions: list[dict[str, str]] = []
        for num in sorted(sec_pair_cols.keys(), key=lambda x: int(x)):
            pair = sec_pair_cols[num]
            q_idx = pair.get("q")
            a_idx = pair.get("a")
            q_val = _cell_str(row[q_idx]) if q_idx is not None else ""
            a_val = _cell_str(row[a_idx]) if a_idx is not None else ""
            if q_val:
                security_questions.append({"question": q_val, "answer": a_val})

        account = BankAccount(
            client_name=field_values["client_name"],
            bank_name=field_values["bank_name"],
            account_last4=field_values["account_last4"],
            username=field_values["username"],
            password=field_values["password"],
            login_url=field_values["login_url"],
            tfa_method=tfa_method,
            tfa_detail=tfa_detail_val,
            security_questions=security_questions,
            notes=notes_val,
        )
        accounts.append(account)

    return accounts


def group_by_login(accounts: list[BankAccount]) -> list[LoginGroup]:
    """Group accounts that share the same (bank_name, username).

    Within a group, accounts are processed sequentially on one browser
    session. Returns list of LoginGroup preserving the original Excel
    row order (first occurrence of each login_key determines group order).
    """
    # Ordered dict preserving first-seen order
    groups: dict[str, LoginGroup] = {}

    for account in accounts:
        key = account.login_key
        if key not in groups:
            groups[key] = LoginGroup(
                bank_name=account.bank_name,
                username=account.username,
                password=account.password,
                login_url=account.login_url,
                tfa_method=account.tfa_method,
                tfa_detail=account.tfa_detail,
                accounts=[],
            )
        # LoginGroup.accounts is a list; append is fine since LoginGroup is not frozen
        groups[key].accounts.append(account)

    return list(groups.values())
