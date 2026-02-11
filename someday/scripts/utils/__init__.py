"""
Utility modules for GHL-Baserow sync operations.

This package provides:
- deduplication: Contact, opportunity, and newsletter deduplication utilities
- sync_state: State persistence for sync operations
- rate_limiter: Rate limiting and circuit breaker patterns
- logging_config: Structured logging configuration
"""

from .deduplication import (
    ContactDeduplicator,
    NewsletterDeduplicator,
    OpportunityDeduplicator,
    fetch_baserow_contacts,
    fetch_baserow_deals,
    normalize_email,
    normalize_name,
    normalize_phone,
)
from .logging_config import (
    LOG_DIR,
    OperationLogger,
    SyncLogger,
    setup_logging,
)
from .rate_limiter import (
    CircuitBreaker,
    CircuitOpenError,
    RateLimiter,
    RetryWithBackoff,
    rate_limited,
    with_circuit_breaker,
    with_retry,
)
from .sync_state import SyncState

__all__ = [
    # Deduplication
    "normalize_email",
    "normalize_phone",
    "normalize_name",
    "ContactDeduplicator",
    "OpportunityDeduplicator",
    "NewsletterDeduplicator",
    "fetch_baserow_contacts",
    "fetch_baserow_deals",
    # State management
    "SyncState",
    # Rate limiting
    "RateLimiter",
    "CircuitBreaker",
    "CircuitOpenError",
    "RetryWithBackoff",
    "rate_limited",
    "with_circuit_breaker",
    "with_retry",
    # Logging
    "setup_logging",
    "SyncLogger",
    "OperationLogger",
    "LOG_DIR",
]
