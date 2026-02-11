"""Central exception types for the analyzer pipeline."""

class UnmappedAccountsError(RuntimeError):
    """Raised when GL contains accounts not mapped to the standard CoA."""
    pass
