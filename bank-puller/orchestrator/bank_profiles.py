"""Bank profile registry — centralized per-bank quirks and behavior flags."""
from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Profile registry
# Keys are lowercase substrings matched against full bank name.
# Longer keys match first to prevent collisions (e.g. "chase business" before
# a hypothetical "chase" default).
# ---------------------------------------------------------------------------
BANK_PROFILES: dict[str, dict[str, Any]] = {
    "chase business": {
        "cookie_domain": ".chase.com",
        "login_in_iframe": True,
        "statements_nav_type": "accordion",
        "skip_obstacle_dismiss_on_statements": True,
        "skip_card_picker": True,
        "skip_pdf_archive_nav": True,
        "tfa_requires_password_reentry": True,
        "account_suffix_length": 4,
    },
    "american express": {
        "cookie_domain": ".americanexpress.com",
        "card_picker_type": "dropdown_scroll",
        "account_suffix_length": 5,
    },
    "citibank": {
        "cookie_domain": ".citi.com",
    },
}

# Default profile — returned for unknown banks
_DEFAULT_PROFILE: dict[str, Any] = {
    "cookie_domain": "",
    "login_in_iframe": False,
    "statements_nav_type": "standard",
    "skip_obstacle_dismiss_on_statements": False,
    "skip_card_picker": False,
    "skip_pdf_archive_nav": False,
    "tfa_requires_password_reentry": False,
    "account_suffix_length": 4,
    "card_picker_type": "standard",
}


def get_bank_profile(bank_name: str) -> dict[str, Any]:
    """Return the profile for *bank_name*, falling back to defaults.

    Matching: the longest key that is a substring of the lowercased bank name
    wins.  E.g. ``get_bank_profile("Chase Business Checking")`` matches
    ``"chase business"`` (not a hypothetical shorter ``"chase"`` key).
    """
    lower = bank_name.lower()
    best_key = ""
    for key in BANK_PROFILES:
        if key in lower and len(key) > len(best_key):
            best_key = key

    if best_key:
        merged = dict(_DEFAULT_PROFILE)
        merged.update(BANK_PROFILES[best_key])
        return merged

    return dict(_DEFAULT_PROFILE)
