"""Bank workflow registry.

load_workflow(bank_name) returns a fully instantiated workflow for the given
bank.  Bank name matching is case-insensitive and normalizes spaces to
underscores so that "American Express", "american_express", and "amex" all
resolve to the same AmexWorkflow.

Registering a new bank:
    1. Create src/banks/<name>.py with a class that extends BaseBankWorkflow.
    2. Import and register it in _register_all() below.
    3. Add any relevant aliases to _ALIASES.

Aliases:
    _ALIASES maps short or alternative names to the canonical registry key.
    The canonical key is always the fully expanded snake_case bank name.
"""

from __future__ import annotations

import logging

from .base import BaseBankWorkflow

logger = logging.getLogger("bank_puller.banks")

# ---------------------------------------------------------------------------
# Internal registry: canonical_key -> workflow class
# ---------------------------------------------------------------------------
_REGISTRY: dict[str, type[BaseBankWorkflow]] = {}

# ---------------------------------------------------------------------------
# Aliases: alternative names -> canonical key in _REGISTRY
# ---------------------------------------------------------------------------
_ALIASES: dict[str, str] = {
    # American Express
    "amex":              "american_express",
    "americanexpress":   "american_express",
    "american_express":  "american_express",
    # Chase / JPMorgan
    "chase":             "chase",
    "jpmorgan":          "chase",
    "jp_morgan":         "chase",
    # Citibank
    "citi":              "citi",
    "citibank":          "citi",
    "citigroup":         "citi",
    # Mercury
    "mercury":           "mercury",
    # Wells Fargo
    "wells_fargo":       "wells_fargo",
    "wellsfargo":        "wells_fargo",
    "wf":                "wells_fargo",
    # East West Bank
    "east_west":         "east_west",
    "eastwest":          "east_west",
    "east_west_bank":    "east_west",
    "ewb":               "east_west",
    # Bank of America
    "bofa":              "bofa",
    "bank_of_america":   "bofa",
    "bankofamerica":     "bofa",
    "boa":               "bofa",
    # UBS
    "ubs":               "ubs",
}


def _normalize(name: str) -> str:
    """Lowercase and replace spaces with underscores."""
    return name.strip().lower().replace(" ", "_")


def _register_all() -> None:
    """Import all bank modules and populate _REGISTRY.

    Called lazily on the first load_workflow() call so that importing
    this package does not trigger all bank module imports at startup.
    """
    if _REGISTRY:
        return  # already populated

    from .chase      import ChaseWorkflow
    from .amex       import AmexWorkflow
    from .citi       import CitiWorkflow
    from .mercury    import MercuryWorkflow
    from .wells_fargo import WellsFargoWorkflow
    from .east_west  import EastWestWorkflow
    from .bofa       import BofAWorkflow
    from .ubs        import UBSWorkflow

    _REGISTRY["chase"]            = ChaseWorkflow
    _REGISTRY["american_express"] = AmexWorkflow
    _REGISTRY["citi"]             = CitiWorkflow
    _REGISTRY["mercury"]          = MercuryWorkflow
    _REGISTRY["wells_fargo"]      = WellsFargoWorkflow
    _REGISTRY["east_west"]        = EastWestWorkflow
    _REGISTRY["bofa"]             = BofAWorkflow
    _REGISTRY["ubs"]              = UBSWorkflow

    logger.debug("Bank workflow registry populated: %s", sorted(_REGISTRY.keys()))


def load_workflow(bank_name: str) -> BaseBankWorkflow:
    """Return an instantiated workflow for the given bank name.

    Name matching:
        1. Normalize (lowercase + spaces -> underscores)
        2. Check _ALIASES for redirect to canonical key
        3. Look up canonical key in _REGISTRY

    Raises ValueError if no workflow is registered for the bank.

    Examples:
        load_workflow("chase")            -> ChaseWorkflow()
        load_workflow("American Express") -> AmexWorkflow()
        load_workflow("amex")             -> AmexWorkflow()
    """
    _register_all()

    normalized = _normalize(bank_name)
    # Resolve alias (or use normalized name as-is if it's already canonical)
    canonical = _ALIASES.get(normalized, normalized)

    if canonical not in _REGISTRY:
        raise ValueError(
            f"No workflow registered for bank '{bank_name}' "
            f"(normalized: '{normalized}', canonical: '{canonical}'). "
            f"Known banks and aliases: {sorted(set(_ALIASES.keys()) | set(_REGISTRY.keys()))}"
        )

    workflow_class = _REGISTRY[canonical]
    return workflow_class()


def list_supported_banks() -> list[str]:
    """Return a sorted list of all supported canonical bank names."""
    _register_all()
    return sorted(_REGISTRY.keys())
