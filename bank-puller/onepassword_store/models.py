"""Data models for 1Password credential hydration."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class HydratedCredentials:
    """Credential bundle fetched from a single 1Password item.

    Shape matches AccountJob's credential fields so the future plug-in
    in excel_reader.py is a direct mapping.
    """

    username: str
    password: str
    totp_secret: str | None = None  # raw base32 secret, or None if no OTP
    security_questions: list[tuple[str, str]] = field(default_factory=list)
