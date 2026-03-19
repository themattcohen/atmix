"""Sanitized logger -- never logs credentials or 2FA codes."""
import logging
import re
import sys
from datetime import datetime


class SanitizedFormatter(logging.Formatter):
    """Formatter that redacts sensitive patterns."""

    SENSITIVE_PATTERNS = [
        (re.compile(r'\b\d{6,8}\b'), '[CODE-REDACTED]'),  # 2FA codes
        (re.compile(r'password["\s:=]+\S+', re.IGNORECASE), 'password=[REDACTED]'),
        (re.compile(r'secret["\s:=]+\S+', re.IGNORECASE), 'secret=[REDACTED]'),
    ]

    def format(self, record):
        msg = super().format(record)
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            msg = pattern.sub(replacement, msg)
        return msg


def setup_logger(name: str = "bank-puller", debug: bool = False) -> logging.Logger:
    """Create a sanitized logger.

    Args:
        name: Logger name
        debug: If True, set DEBUG level. Otherwise INFO.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Don't add handlers if already configured
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG if debug else logging.INFO)

    formatter = SanitizedFormatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


# Module-level default logger
log = setup_logger()
