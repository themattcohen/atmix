"""Pricing engine for ATMIX v3.

LLM-driven pricing recommendations based on AllSolutions Consulting tiers.
The LLM analyzes the client profile and recommends appropriate pricing.

This module provides:
- ClientAnalysis: Analysis of prospect bookkeeping needs
- Quote: Generated pricing quote with recommendations
- PricingEngine: Main orchestrator for quote generation

Example usage:
    >>> from atmix.engine.pricing import PricingEngine
    >>> engine = PricingEngine(llm_client)
    >>> analysis = engine.analyze_prospect(data_files, data_samples, user_context)
    >>> quote = engine.generate_quote(analysis, user_context)
    >>> print(engine.format_quote_display(quote, analysis))
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# Enums and Constants
# =============================================================================


class AccountingBasis(Enum):
    """Accounting basis methods."""

    CASH = "Cash"
    MODIFIED_ACCRUAL = "Modified Accrual"
    FULL_ACCRUAL = "Full Accrual"


class ComplexityLevel(Enum):
    """Business complexity levels for pricing."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class AddOnCategory(Enum):
    """Categories for add-on services."""

    ADVISORY = "advisory"
    CATCH_UP = "catch_up"
    OPERATIONAL = "operational"
    COMPLIANCE = "compliance"


# Hourly rates for cleanup work
CLEANUP_HOURLY_RATE_MIN = 50
CLEANUP_HOURLY_RATE_MAX = 75
DEFAULT_CLEANUP_HOURLY_RATE = 65

# Minimum setup fee for new clients
DEFAULT_SETUP_FEE = 250


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class PricingTier:
    """A pricing tier definition.

    Attributes:
        name: Tier name (Essential, Professional, Elite).
        min_price: Minimum monthly price for this tier.
        max_price: Maximum monthly price for this tier.
        accounting_basis: Accounting method used (Cash, Modified Accrual, Full Accrual).
        max_accounts: Maximum number of accounts supported.
        included_services: List of services included in this tier.
        description: Human-readable tier description.
        max_ar_ap_entries: Maximum AR/AP entries per month (0 if not included).
        max_journal_entries: Maximum journal entries per month (0 if unlimited).
    """

    name: str
    min_price: int
    max_price: int
    accounting_basis: AccountingBasis
    max_accounts: int
    included_services: List[str]
    description: str
    max_ar_ap_entries: int = 0
    max_journal_entries: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "min_price": self.min_price,
            "max_price": self.max_price,
            "accounting_basis": self.accounting_basis.value,
            "max_accounts": self.max_accounts,
            "included_services": self.included_services,
            "description": self.description,
            "max_ar_ap_entries": self.max_ar_ap_entries,
            "max_journal_entries": self.max_journal_entries,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PricingTier":
        """Create from dictionary representation."""
        return cls(
            name=data["name"],
            min_price=data["min_price"],
            max_price=data["max_price"],
            accounting_basis=AccountingBasis(data["accounting_basis"]),
            max_accounts=data["max_accounts"],
            included_services=data["included_services"],
            description=data["description"],
            max_ar_ap_entries=data.get("max_ar_ap_entries", 0),
            max_journal_entries=data.get("max_journal_entries", 0),
        )


@dataclass
class AddOn:
    """An add-on service.

    Attributes:
        name: Service name.
        description: Detailed description of the service.
        pricing_note: Pricing guidance (e.g., "Custom quote", "Starting at $X").
        category: Category of the add-on service.
        triggers: Keywords or conditions that suggest this add-on.
    """

    name: str
    description: str
    pricing_note: str
    category: AddOnCategory = AddOnCategory.OPERATIONAL
    triggers: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "description": self.description,
            "pricing_note": self.pricing_note,
            "category": self.category.value,
            "triggers": self.triggers,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AddOn":
        """Create from dictionary representation."""
        return cls(
            name=data["name"],
            description=data["description"],
            pricing_note=data["pricing_note"],
            category=AddOnCategory(data.get("category", "operational")),
            triggers=data.get("triggers", []),
        )


@dataclass
class ClientAnalysis:
    """Analysis of a prospect's bookkeeping needs.

    This captures the complexity factors and requirements discovered
    from analyzing the prospect's financial data and business context.

    Attributes:
        monthly_transactions: Estimated monthly transaction volume.
        bank_accounts: Number of bank accounts.
        credit_cards: Number of credit cards.
        payment_processors: List of payment processors (PayPal, Stripe, etc.).
        platforms: E-commerce platforms (Shopify, Amazon, etc.).
        has_inventory: Whether inventory tracking is needed.
        has_payroll: Whether payroll processing is involved.
        employee_count: Number of W-2 employees.
        contractor_count: Number of 1099 contractors.
        needs_ar: Whether accounts receivable management is needed.
        needs_ap: Whether accounts payable management is needed.
        needs_accrual: Whether accrual accounting is required.
        months_behind: How many months the books are behind.
        estimated_cleanup_hours: Estimated hours for catch-up bookkeeping.
        complexity_notes: Notes about complexity factors.
        business_type: Type of business (e-commerce, service, etc.).
        annual_revenue_estimate: Estimated annual revenue if known.
        state_count: Number of states with nexus (for sales tax).
    """

    monthly_transactions: int = 0
    bank_accounts: int = 0
    credit_cards: int = 0
    payment_processors: List[str] = field(default_factory=list)
    platforms: List[str] = field(default_factory=list)
    has_inventory: bool = False
    has_payroll: bool = False
    employee_count: int = 0
    contractor_count: int = 0
    needs_ar: bool = False
    needs_ap: bool = False
    needs_accrual: bool = False
    months_behind: int = 0
    estimated_cleanup_hours: int = 0
    complexity_notes: List[str] = field(default_factory=list)
    business_type: str = ""
    annual_revenue_estimate: Optional[int] = None
    state_count: int = 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "monthly_transactions": self.monthly_transactions,
            "bank_accounts": self.bank_accounts,
            "credit_cards": self.credit_cards,
            "payment_processors": self.payment_processors,
            "platforms": self.platforms,
            "has_inventory": self.has_inventory,
            "has_payroll": self.has_payroll,
            "employee_count": self.employee_count,
            "contractor_count": self.contractor_count,
            "needs_ar": self.needs_ar,
            "needs_ap": self.needs_ap,
            "needs_accrual": self.needs_accrual,
            "months_behind": self.months_behind,
            "estimated_cleanup_hours": self.estimated_cleanup_hours,
            "complexity_notes": self.complexity_notes,
            "business_type": self.business_type,
            "annual_revenue_estimate": self.annual_revenue_estimate,
            "state_count": self.state_count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClientAnalysis":
        """Create from dictionary representation."""
        return cls(
            monthly_transactions=data.get("monthly_transactions", 0),
            bank_accounts=data.get("bank_accounts", 0),
            credit_cards=data.get("credit_cards", 0),
            payment_processors=data.get("payment_processors", []),
            platforms=data.get("platforms", []),
            has_inventory=data.get("has_inventory", False),
            has_payroll=data.get("has_payroll", False),
            employee_count=data.get("employee_count", 0),
            contractor_count=data.get("contractor_count", 0),
            needs_ar=data.get("needs_ar", False),
            needs_ap=data.get("needs_ap", False),
            needs_accrual=data.get("needs_accrual", False),
            months_behind=data.get("months_behind", 0),
            estimated_cleanup_hours=data.get("estimated_cleanup_hours", 0),
            complexity_notes=data.get("complexity_notes", []),
            business_type=data.get("business_type", ""),
            annual_revenue_estimate=data.get("annual_revenue_estimate"),
            state_count=data.get("state_count", 1),
        )

    @property
    def total_accounts(self) -> int:
        """Total number of financial accounts."""
        return self.bank_accounts + self.credit_cards

    @property
    def complexity_level(self) -> ComplexityLevel:
        """Calculate overall complexity level."""
        score = 0

        # Transaction volume
        if self.monthly_transactions > 1000:
            score += 3
        elif self.monthly_transactions > 500:
            score += 2
        elif self.monthly_transactions > 200:
            score += 1

        # Account count
        if self.total_accounts > 10:
            score += 2
        elif self.total_accounts > 5:
            score += 1

        # Platforms and processors
        score += len(self.platforms)
        score += len(self.payment_processors) // 2

        # Features
        if self.has_inventory:
            score += 2
        if self.needs_accrual:
            score += 2
        if self.needs_ar:
            score += 1
        if self.needs_ap:
            score += 1
        if self.state_count > 1:
            score += self.state_count - 1

        if score >= 8:
            return ComplexityLevel.VERY_HIGH
        elif score >= 5:
            return ComplexityLevel.HIGH
        elif score >= 2:
            return ComplexityLevel.MEDIUM
        return ComplexityLevel.LOW


@dataclass
class Quote:
    """A generated pricing quote.

    Attributes:
        recommended_tier: Name of the recommended pricing tier.
        monthly_price: Recommended monthly price.
        price_rationale: Explanation for the pricing.
        cleanup_fee: One-time catch-up bookkeeping fee.
        setup_fee: One-time setup/onboarding fee.
        included_services: List of services included.
        recommended_addons: List of recommended add-on names.
        addon_rationale: Explanation for add-on recommendations.
        key_factors: Key factors driving the pricing.
        assumptions: Assumptions made in the quote.
        confidence: Confidence level in the quote (0-1).
        valid_until: Quote expiration date.
        notes: Additional notes or caveats.
    """

    recommended_tier: str
    monthly_price: int
    price_rationale: str

    # One-time fees
    cleanup_fee: Optional[int] = None
    setup_fee: Optional[int] = None

    # What's included
    included_services: List[str] = field(default_factory=list)

    # Recommended add-ons
    recommended_addons: List[str] = field(default_factory=list)
    addon_rationale: str = ""

    # Key factors
    key_factors: List[str] = field(default_factory=list)

    # Caveats
    assumptions: List[str] = field(default_factory=list)

    # Metadata
    confidence: float = 0.8
    valid_until: Optional[datetime] = None
    notes: str = ""

    def __post_init__(self):
        """Set default valid_until if not provided."""
        if self.valid_until is None:
            # Quotes valid for 30 days
            from datetime import timedelta

            self.valid_until = datetime.now() + timedelta(days=30)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "recommended_tier": self.recommended_tier,
            "monthly_price": self.monthly_price,
            "price_rationale": self.price_rationale,
            "cleanup_fee": self.cleanup_fee,
            "setup_fee": self.setup_fee,
            "included_services": self.included_services,
            "recommended_addons": self.recommended_addons,
            "addon_rationale": self.addon_rationale,
            "key_factors": self.key_factors,
            "assumptions": self.assumptions,
            "confidence": self.confidence,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Quote":
        """Create from dictionary representation."""
        valid_until = None
        if data.get("valid_until"):
            valid_until = datetime.fromisoformat(data["valid_until"])

        return cls(
            recommended_tier=data.get("recommended_tier", "Essential"),
            monthly_price=data.get("monthly_price", 750),
            price_rationale=data.get("price_rationale", ""),
            cleanup_fee=data.get("cleanup_fee"),
            setup_fee=data.get("setup_fee"),
            included_services=data.get("included_services", []),
            recommended_addons=data.get("recommended_addons", []),
            addon_rationale=data.get("addon_rationale", ""),
            key_factors=data.get("key_factors", []),
            assumptions=data.get("assumptions", []),
            confidence=data.get("confidence", 0.8),
            valid_until=valid_until,
            notes=data.get("notes", ""),
        )

    @property
    def total_first_month(self) -> int:
        """Calculate total cost for first month including one-time fees."""
        total = self.monthly_price
        if self.cleanup_fee:
            total += self.cleanup_fee
        if self.setup_fee:
            total += self.setup_fee
        return total

    @property
    def annual_cost(self) -> int:
        """Calculate annual recurring cost (excluding one-time fees)."""
        return self.monthly_price * 12


# =============================================================================
# AllSolutions Tier and Add-on Definitions
# =============================================================================


ALLSOLUTIONS_TIERS: List[PricingTier] = [
    PricingTier(
        name="Essential",
        min_price=750,
        max_price=1250,
        accounting_basis=AccountingBasis.CASH,
        max_accounts=5,
        max_ar_ap_entries=0,
        max_journal_entries=0,
        included_services=[
            "Monthly transaction entry",
            "Bank reconciliation",
            "Credit card reconciliation",
            "Payroll integration (entries only)",
            "Monthly P&L and Balance Sheet",
            "Unlimited transactions",
            "Dedicated bookkeeper",
            "Email support",
        ],
        description="Cash basis bookkeeping for straightforward businesses with simple operations",
    ),
    PricingTier(
        name="Professional",
        min_price=1250,
        max_price=2000,
        accounting_basis=AccountingBasis.MODIFIED_ACCRUAL,
        max_accounts=10,
        max_ar_ap_entries=30,
        max_journal_entries=5,
        included_services=[
            "Everything in Essential",
            "Modified accrual basis accounting",
            "AR entries (up to 30/month)",
            "AP entries (up to 30/month)",
            "Up to 5 journal entries/month",
            "Quarterly financial review call",
            "Basic KPI tracking",
        ],
        description="For growing businesses with invoicing and billing needs requiring more sophisticated tracking",
    ),
    PricingTier(
        name="Elite",
        min_price=2000,
        max_price=5000,
        accounting_basis=AccountingBasis.FULL_ACCRUAL,
        max_accounts=999,  # Unlimited
        max_ar_ap_entries=999,  # Unlimited
        max_journal_entries=999,  # Unlimited
        included_services=[
            "Everything in Professional",
            "Full accrual basis accounting",
            "Unlimited accounts",
            "Full AR/AP management",
            "Revenue recognition",
            "Expense accruals",
            "Prepaid expense tracking",
            "Deferred revenue tracking",
            "Unlimited journal entries",
            "Monthly financial review call",
            "Custom reporting",
            "Priority support",
        ],
        description="Comprehensive service for complex businesses requiring full accrual accounting and advanced features",
    ),
]

ALLSOLUTIONS_ADDONS: List[AddOn] = [
    AddOn(
        name="CFO Services",
        description="Strategic financial guidance including budgeting, forecasting, cash flow management, and KPI development",
        pricing_note="Custom quote based on scope",
        category=AddOnCategory.ADVISORY,
        triggers=["forecasting", "budget", "kpi", "strategic", "growth planning", "investor"],
    ),
    AddOn(
        name="Catch-Up Bookkeeping",
        description="Bring books current from months or years behind. Discount available for 6+ months of work",
        pricing_note=f"${CLEANUP_HOURLY_RATE_MIN}-${CLEANUP_HOURLY_RATE_MAX}/hour",
        category=AddOnCategory.CATCH_UP,
        triggers=["behind", "catch up", "backlog", "historical"],
    ),
    AddOn(
        name="Back Office Support",
        description="Full AP/AR operational functions, bill pay, invoicing, collections, HR/payroll processing",
        pricing_note="Custom quote based on volume",
        category=AddOnCategory.OPERATIONAL,
        triggers=["bill pay", "collections", "hr", "full service", "outsource"],
    ),
    AddOn(
        name="Sales Tax",
        description="Avalara integration for automated sales tax calculation, collection, and remittance across multiple states",
        pricing_note="Custom quote based on state count and transaction volume",
        category=AddOnCategory.COMPLIANCE,
        triggers=["sales tax", "nexus", "avalara", "multi-state", "e-commerce tax"],
    ),
    AddOn(
        name="1099 Processing",
        description="Year-end 1099 preparation and filing for contractors",
        pricing_note="Per form pricing, bulk discounts available",
        category=AddOnCategory.COMPLIANCE,
        triggers=["1099", "contractor", "year-end", "tax forms"],
    ),
    AddOn(
        name="Inventory Management",
        description="Advanced inventory tracking, COGS calculations, and inventory valuation support",
        pricing_note="Starting at $250/month",
        category=AddOnCategory.OPERATIONAL,
        triggers=["inventory", "cogs", "stock", "warehouse", "product cost"],
    ),
    AddOn(
        name="Multi-Entity Consolidation",
        description="Financial consolidation for businesses with multiple legal entities",
        pricing_note="Custom quote based on entity count",
        category=AddOnCategory.ADVISORY,
        triggers=["multiple entities", "consolidation", "subsidiary", "holding company"],
    ),
]


# =============================================================================
# LLM Client Protocol
# =============================================================================


class LLMClientProtocol(Protocol):
    """Protocol for LLM client to allow dependency injection."""

    def messages_create(
        self,
        model: str,
        max_tokens: int,
        messages: List[Dict[str, str]],
    ) -> Any:
        """Create a message with the LLM."""
        ...


# =============================================================================
# JSON Parsing Utilities
# =============================================================================


def _parse_llm_json(content: str) -> Optional[Dict[str, Any]]:
    """Parse JSON from LLM output with error recovery.

    Handles common LLM JSON issues like:
    - Trailing commas
    - Unescaped newlines in strings
    - Truncated responses
    - Extra text before/after JSON

    Args:
        content: Raw LLM response text.

    Returns:
        Parsed JSON dict or None if parsing fails.
    """
    if "{" not in content:
        return None

    # Extract JSON from between first { and last }
    try:
        start = content.index("{")
        end = content.rindex("}") + 1
        json_str = content[start:end]
    except ValueError:
        return None

    # Try direct parsing first
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Fix common issues
    fixed = json_str

    # Remove trailing commas before } or ]
    fixed = re.sub(r",\s*}", "}", fixed)
    fixed = re.sub(r",\s*]", "]", fixed)

    # Try again
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Try to fix truncated JSON by finding last complete object/array
    depth = 0
    last_valid_end = 0
    for i, char in enumerate(fixed):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                last_valid_end = i + 1

    if last_valid_end > 0:
        try:
            return json.loads(fixed[:last_valid_end])
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse LLM JSON response")
    return None


# =============================================================================
# Pricing Engine
# =============================================================================


class PricingEngine:
    """LLM-driven pricing recommendations for bookkeeping services.

    This engine analyzes prospect data and generates pricing quotes
    based on AllSolutions Consulting tiers. It uses LLM intelligence
    to understand business complexity and recommend appropriate pricing.

    Attributes:
        llm_client: Anthropic client for LLM interactions.
        tiers: Available pricing tiers.
        addons: Available add-on services.
        model: LLM model to use for analysis.
        max_retries: Maximum retries for failed LLM calls.
        total_tokens: Running total of tokens used.

    Example:
        >>> import anthropic
        >>> client = anthropic.Anthropic()
        >>> engine = PricingEngine(client)
        >>> analysis = engine.analyze_prospect(
        ...     data_files={"bank.csv": "Bank Statement"},
        ...     data_samples={"bank.csv": "Date,Description,Amount\\n..."},
        ...     user_context={"business_type": "E-commerce"},
        ... )
        >>> quote = engine.generate_quote(analysis, {"business_type": "E-commerce"})
        >>> print(quote.monthly_price)
    """

    # Model configuration
    DEFAULT_MODEL = "claude-sonnet-4-20250514"
    MAX_TOKENS_ANALYSIS = 2000
    MAX_TOKENS_QUOTE = 2000
    MAX_TOKENS_PROPOSAL = 3000

    # Retry configuration
    DEFAULT_MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = 1.0
    RETRY_BACKOFF_MULTIPLIER = 2.0

    def __init__(
        self,
        llm_client: Any,
        model: Optional[str] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        tiers: Optional[List[PricingTier]] = None,
        addons: Optional[List[AddOn]] = None,
    ):
        """Initialize the pricing engine.

        Args:
            llm_client: Anthropic client for LLM interactions.
            model: LLM model to use (default: claude-sonnet-4-20250514).
            max_retries: Maximum retry attempts for failed requests.
            tiers: Custom pricing tiers (default: AllSolutions tiers).
            addons: Custom add-on services (default: AllSolutions add-ons).
        """
        self.llm_client = llm_client
        self.model = model or self.DEFAULT_MODEL
        self.max_retries = max_retries
        self.tiers = tiers or ALLSOLUTIONS_TIERS
        self.addons = addons or ALLSOLUTIONS_ADDONS
        self.total_tokens = 0

    def _call_llm(
        self,
        prompt: str,
        max_tokens: int,
        system: Optional[str] = None,
    ) -> Tuple[str, Optional[str]]:
        """Make an LLM API call with retry logic.

        Args:
            prompt: The user prompt.
            max_tokens: Maximum tokens for response.
            system: Optional system prompt.

        Returns:
            Tuple of (response_text, error_message).
        """
        messages = [{"role": "user", "content": prompt}]

        delay = self.RETRY_DELAY_SECONDS
        last_error = None

        for attempt in range(self.max_retries):
            try:
                kwargs: Dict[str, Any] = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "messages": messages,
                }
                if system:
                    kwargs["system"] = system

                response = self.llm_client.messages.create(**kwargs)
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
                return response.content[0].text.strip(), None

            except Exception as e:
                last_error = str(e)
                logger.warning(
                    f"LLM call failed (attempt {attempt + 1}/{self.max_retries}): {e}"
                )

                if attempt < self.max_retries - 1:
                    time.sleep(delay)
                    delay *= self.RETRY_BACKOFF_MULTIPLIER

        return "", f"LLM call failed after {self.max_retries} attempts: {last_error}"

    def analyze_prospect(
        self,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
        user_context: Dict[str, Any],
    ) -> ClientAnalysis:
        """Analyze prospect data to determine their bookkeeping needs.

        Uses LLM to examine available financial data and business context
        to determine complexity factors, volume, and requirements.

        Args:
            data_files: Dict mapping filename to file type description.
            data_samples: Dict mapping filename to sample data content.
            user_context: Additional context provided by the user about their business.

        Returns:
            ClientAnalysis with detected needs and complexity factors.

        Raises:
            RuntimeError: If LLM analysis fails after all retries.
        """
        prompt = self._build_analysis_prompt(data_files, data_samples, user_context)

        system_prompt = """You are an expert bookkeeper analyzing a prospective client's financial data.
Your goal is to accurately assess their bookkeeping needs and complexity.
Be thorough but realistic in your estimates. When uncertain, provide conservative estimates.
Always output valid JSON exactly matching the requested format."""

        response, error = self._call_llm(
            prompt, self.MAX_TOKENS_ANALYSIS, system=system_prompt
        )

        if error:
            logger.error(f"Prospect analysis failed: {error}")
            return ClientAnalysis(
                complexity_notes=[f"Analysis error: {error}"],
            )

        result_data = _parse_llm_json(response)

        if result_data:
            analysis = ClientAnalysis.from_dict(result_data)

            # CRITICAL: Override LLM inference with explicit user context
            # User context is authoritative over data patterns
            if user_context.get("has_inventory") is False:
                analysis.has_inventory = False
                if "User explicitly stated no physical inventory" not in analysis.complexity_notes:
                    analysis.complexity_notes.append(
                        "User explicitly stated no physical inventory (COGS may be misclassified)"
                    )

            # Trust user on business type
            if user_context.get("business_type"):
                analysis.business_type = user_context["business_type"]

            return analysis

        logger.warning("Could not parse analysis response, returning defaults")
        return ClientAnalysis(
            complexity_notes=["Could not parse LLM analysis response"],
        )

    def _build_analysis_prompt(
        self,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
        user_context: Dict[str, Any],
    ) -> str:
        """Build the LLM prompt for prospect analysis.

        Args:
            data_files: Available data files.
            data_samples: Sample data from files.
            user_context: User-provided business context.

        Returns:
            Formatted prompt string.
        """
        files_section = "\n".join(f"- {name}: {desc}" for name, desc in data_files.items())
        samples_section = self._format_samples(data_samples)
        context_section = self._format_context(user_context)

        return f"""Analyze this prospect's financial data to determine their bookkeeping needs.

AVAILABLE FILES:
{files_section}

DATA SAMPLES:
{samples_section}

CLIENT CONTEXT (trust this over inferences from data):
{context_section}

CRITICAL: The client context above is AUTHORITATIVE and overrides data patterns. If the client says:
- "does NOT sell physical goods" → has_inventory = false, even if you see COGS in the data
  (COGS for content creators is often misclassified production costs, not physical inventory)
- "online content creator" → this is NOT e-commerce, they sell digital products
  Content creators may have COGS for: video production, course hosting, royalties - NOT physical inventory
- "Amazon is a payment processor" → verify this is income, not just an Amazon credit card for expenses

If has_inventory is explicitly false in the context, set it to false regardless of COGS presence.
Content creators, course sellers, and digital product businesses do NOT need inventory management.

Analyze and determine:
1. Monthly transaction volume (count transactions in samples, extrapolate to monthly)
2. Number of bank accounts and credit cards visible
3. Payment processors used for INCOME (PayPal deposits, Stripe payouts, Square deposits, etc.)
   - IMPORTANT: Only list processors where you see DEPOSITS/INCOME, not credit cards used for expenses
4. E-commerce/sales platforms - ONLY if you see REVENUE from them
   - An "Amazon Business Card" used for expenses is NOT an Amazon sales platform
   - Look for actual deposits/income from platforms, not just the name appearing
5. Whether they have inventory (ONLY if selling physical products - content creators do NOT need inventory)
   - Digital products, courses, subscriptions = NO inventory
   - Physical goods being shipped = inventory needed
6. Payroll situation (employees visible in data, contractor payments)
7. AR/AP needs (do they invoice customers? have recurring bills?)
8. Accrual needs (prepaid expenses, deferred revenue, subscriptions?)
9. How far behind their books are (look at date ranges)
10. Overall complexity factors and notes

CRITICAL: Distinguish between:
- Credit cards used for EXPENSES (Amazon Business Card, Chase Sapphire, etc.) = just expense accounts
- Payment processors receiving INCOME (PayPal deposits, Stripe payouts) = revenue channels

Output ONLY valid JSON matching this exact structure:
{{
    "monthly_transactions": 0,
    "bank_accounts": 0,
    "credit_cards": 0,
    "payment_processors": [],
    "platforms": [],
    "has_inventory": false,
    "has_payroll": false,
    "employee_count": 0,
    "contractor_count": 0,
    "needs_ar": false,
    "needs_ap": false,
    "needs_accrual": false,
    "months_behind": 0,
    "estimated_cleanup_hours": 0,
    "complexity_notes": [],
    "business_type": "",
    "annual_revenue_estimate": null,
    "state_count": 1
}}"""

    def generate_quote(
        self,
        analysis: ClientAnalysis,
        user_context: Dict[str, Any],
    ) -> Quote:
        """Generate a pricing quote based on prospect analysis.

        Uses LLM to determine appropriate tier and pricing within the tier range
        based on the prospect's specific needs and complexity factors.

        Args:
            analysis: ClientAnalysis from analyze_prospect().
            user_context: Additional context from user interactions.

        Returns:
            Quote with recommended pricing and services.

        Raises:
            RuntimeError: If quote generation fails after all retries.
        """
        prompt = self._build_quote_prompt(analysis, user_context)

        system_prompt = """You are a pricing specialist for a bookkeeping firm.
Your goal is to recommend fair, accurate pricing that reflects the client's actual needs.
Price within the tier ranges provided. Consider all complexity factors.
Always output valid JSON exactly matching the requested format."""

        response, error = self._call_llm(
            prompt, self.MAX_TOKENS_QUOTE, system=system_prompt
        )

        if error:
            logger.error(f"Quote generation failed: {error}")
            return Quote(
                recommended_tier="Essential",
                monthly_price=750,
                price_rationale=f"Quote generation error: {error}",
                included_services=["Basic bookkeeping"],
                key_factors=["Unable to analyze - using base pricing"],
                assumptions=["Manual review needed"],
                confidence=0.3,
            )

        result_data = _parse_llm_json(response)

        if result_data:
            return Quote.from_dict(result_data)

        logger.warning("Could not parse quote response, returning defaults")
        return Quote(
            recommended_tier="Essential",
            monthly_price=750,
            price_rationale="Could not generate detailed quote - using base tier pricing",
            included_services=self.tiers[0].included_services,
            key_factors=["Analysis incomplete"],
            assumptions=["Manual review recommended"],
            confidence=0.3,
        )

    def _build_quote_prompt(
        self,
        analysis: ClientAnalysis,
        user_context: Dict[str, Any],
    ) -> str:
        """Build the LLM prompt for quote generation.

        Args:
            analysis: Client analysis results.
            user_context: Additional user context.

        Returns:
            Formatted prompt string.
        """
        tiers_text = self._format_tiers()
        addons_text = self._format_addons()
        context_section = self._format_context(user_context)

        return f"""You are pricing bookkeeping services for a new client.

PRICING TIERS AVAILABLE:
{tiers_text}

AVAILABLE ADD-ONS:
{addons_text}

CLIENT ANALYSIS:
- Business type: {analysis.business_type or 'Not specified'}
- Monthly transactions: {analysis.monthly_transactions}
- Bank accounts: {analysis.bank_accounts}
- Credit cards: {analysis.credit_cards}
- Total accounts: {analysis.total_accounts}
- Payment processors: {', '.join(analysis.payment_processors) or 'None identified'}
- E-commerce platforms: {', '.join(analysis.platforms) or 'None identified'}
- Has inventory: {analysis.has_inventory} (if false, do NOT recommend Inventory Management add-on)
- Business type: {analysis.business_type} (content creators/digital products = NO inventory needs)
- Has payroll: {analysis.has_payroll} ({analysis.employee_count} employees, {analysis.contractor_count} contractors)
- Needs AR: {analysis.needs_ar}
- Needs AP: {analysis.needs_ap}
- Needs accrual accounting: {analysis.needs_accrual}
- Months behind: {analysis.months_behind}
- Estimated cleanup hours: {analysis.estimated_cleanup_hours}
- State count (for tax): {analysis.state_count}
- Complexity level: {analysis.complexity_level.value}
- Complexity notes:
{chr(10).join(f"  - {note}" for note in analysis.complexity_notes) or '  None'}

ADDITIONAL CLIENT CONTEXT:
{context_section}

Generate a pricing quote following these guidelines:
1. Select the appropriate tier based on their actual needs
2. Set a specific monthly price WITHIN the tier range (consider complexity factors)
3. Calculate cleanup fee if months_behind > 0 (estimated_cleanup_hours * ${DEFAULT_CLEANUP_HOURLY_RATE}/hr)
4. Include setup fee of ${DEFAULT_SETUP_FEE} for new clients
5. Recommend add-ons ONLY if they genuinely match the business:
   - Inventory Management: ONLY for physical product sellers, NOT content creators or digital products
   - Sales Tax: ONLY if they have multi-state physical product sales
   - 1099 Processing: ONLY if they have contractors
6. List key factors that drove the pricing decision
7. Note any assumptions made

IMPORTANT: Do NOT recommend Inventory Management for:
- Content creators
- Digital product sellers
- Course/subscription businesses
- Service providers

Output ONLY valid JSON matching this exact structure:
{{
    "recommended_tier": "Essential|Professional|Elite",
    "monthly_price": 0,
    "price_rationale": "Detailed explanation of tier selection and pricing within tier",
    "cleanup_fee": null,
    "setup_fee": {DEFAULT_SETUP_FEE},
    "included_services": ["list of included services from the tier"],
    "recommended_addons": ["addon names if applicable"],
    "addon_rationale": "Why these add-ons are recommended",
    "key_factors": ["factors that drove the pricing decision"],
    "assumptions": ["assumptions we're making about their business"],
    "confidence": 0.8,
    "notes": "Any additional notes or caveats"
}}"""

    def format_quote_display(self, quote: Quote, analysis: ClientAnalysis) -> str:
        """Format a quote for CLI/terminal display.

        Creates a human-readable, nicely formatted representation
        of the quote suitable for terminal output.

        Args:
            quote: The generated quote.
            analysis: Client analysis for additional context.

        Returns:
            Formatted string for display.
        """
        lines = [
            "=" * 60,
            "PRICING QUOTE",
            "=" * 60,
            "",
            f"Recommended Tier: {quote.recommended_tier}",
            f"Monthly Fee: ${quote.monthly_price:,}/month",
            f"Annual Cost: ${quote.annual_cost:,}/year",
            "",
        ]

        # Rationale
        lines.extend([
            "-" * 40,
            "RATIONALE",
            "-" * 40,
            quote.price_rationale,
            "",
        ])

        # One-time fees
        if quote.cleanup_fee or quote.setup_fee:
            lines.extend([
                "-" * 40,
                "ONE-TIME FEES",
                "-" * 40,
            ])
            if quote.cleanup_fee:
                lines.append(f"  Catch-up bookkeeping: ${quote.cleanup_fee:,}")
                if analysis.months_behind:
                    lines.append(f"    ({analysis.months_behind} months behind, ~{analysis.estimated_cleanup_hours} hours)")
            if quote.setup_fee:
                lines.append(f"  Setup fee: ${quote.setup_fee:,}")
            lines.append(f"\n  Total First Month: ${quote.total_first_month:,}")
            lines.append("")

        # Included services
        lines.extend([
            "-" * 40,
            "INCLUDED SERVICES",
            "-" * 40,
        ])
        for service in quote.included_services:
            lines.append(f"  [x] {service}")
        lines.append("")

        # Recommended add-ons
        if quote.recommended_addons:
            lines.extend([
                "-" * 40,
                "RECOMMENDED ADD-ONS",
                "-" * 40,
            ])
            for addon_name in quote.recommended_addons:
                addon = next((a for a in self.addons if a.name == addon_name), None)
                if addon:
                    lines.append(f"  + {addon.name} ({addon.pricing_note})")
                    lines.append(f"    {addon.description}")
                else:
                    lines.append(f"  + {addon_name}")
            lines.append(f"\n  {quote.addon_rationale}")
            lines.append("")

        # Key factors
        lines.extend([
            "-" * 40,
            "KEY FACTORS",
            "-" * 40,
        ])
        for factor in quote.key_factors:
            lines.append(f"  * {factor}")
        lines.append("")

        # Assumptions
        if quote.assumptions:
            lines.extend([
                "-" * 40,
                "ASSUMPTIONS",
                "-" * 40,
            ])
            for assumption in quote.assumptions:
                lines.append(f"  - {assumption}")
            lines.append("")

        # Footer
        lines.extend([
            "-" * 40,
            f"Confidence: {quote.confidence:.0%}",
            f"Valid Until: {quote.valid_until.strftime('%Y-%m-%d') if quote.valid_until else 'N/A'}",
            "=" * 60,
        ])

        return "\n".join(lines)

    def generate_proposal_markdown(
        self,
        quote: Quote,
        analysis: ClientAnalysis,
        company_name: str,
        contact_name: Optional[str] = None,
    ) -> str:
        """Generate a professional markdown proposal document.

        Creates a client-facing proposal document that can be converted
        to PDF or shared directly.

        Args:
            quote: The generated quote.
            analysis: Client analysis.
            company_name: Name of the prospect company.
            contact_name: Optional contact person name.

        Returns:
            Markdown proposal content.
        """
        prompt = self._build_proposal_prompt(quote, analysis, company_name, contact_name)

        system_prompt = """You are a professional business writer creating a bookkeeping services proposal.
Write in a warm but professional tone. Focus on value delivered, not just features.
Use markdown formatting for headings, bullet points, and emphasis.
Make it client-focused and persuasive while remaining honest and accurate."""

        response, error = self._call_llm(
            prompt, self.MAX_TOKENS_PROPOSAL, system=system_prompt
        )

        if error:
            logger.error(f"Proposal generation failed: {error}")
            return self._generate_fallback_proposal(quote, analysis, company_name)

        return response

    def _build_proposal_prompt(
        self,
        quote: Quote,
        analysis: ClientAnalysis,
        company_name: str,
        contact_name: Optional[str] = None,
    ) -> str:
        """Build the LLM prompt for proposal generation.

        Args:
            quote: The generated quote.
            analysis: Client analysis.
            company_name: Prospect company name.
            contact_name: Optional contact name.

        Returns:
            Formatted prompt string.
        """
        cleanup_text = f"${quote.cleanup_fee:,}" if quote.cleanup_fee else "N/A"
        months_text = f"{analysis.months_behind} months behind" if analysis.months_behind else "Current"

        return f"""Generate a professional bookkeeping services proposal in markdown format.

CLIENT: {company_name}
{f"CONTACT: {contact_name}" if contact_name else ""}

QUOTE DETAILS:
- Tier: {quote.recommended_tier}
- Monthly fee: ${quote.monthly_price:,}
- Setup fee: ${quote.setup_fee:,} if quote.setup_fee else "Waived"
- Cleanup fee: {cleanup_text}
- Annual value: ${quote.annual_cost:,}

INCLUDED SERVICES:
{chr(10).join(f"- {s}" for s in quote.included_services)}

{f"RECOMMENDED ADD-ONS: {', '.join(quote.recommended_addons)}" if quote.recommended_addons else ""}

KEY FACTORS DRIVING PRICING:
{chr(10).join(f"- {f}" for f in quote.key_factors)}

CLIENT PROFILE:
- Business type: {analysis.business_type or 'Not specified'}
- ~{analysis.monthly_transactions} transactions/month
- {analysis.bank_accounts} bank accounts, {analysis.credit_cards} credit cards
- Platforms: {', '.join(analysis.platforms) if analysis.platforms else 'Standard'}
- Status: {months_text}
- Complexity: {analysis.complexity_level.value}

Write a professional proposal including:
1. Executive summary (2-3 sentences about what we'll do for them)
2. Understanding of their needs (show we understand their business)
3. Proposed services (what's included, focus on benefits)
4. Investment breakdown (pricing presented positively)
5. Why AllSolutions (brief value proposition)
6. Next steps (clear call to action)

Make it warm but professional. Focus on value and partnership, not just price.
Use proper markdown formatting with headers (##), bullet points, and emphasis."""

    def _generate_fallback_proposal(
        self,
        quote: Quote,
        analysis: ClientAnalysis,
        company_name: str,
    ) -> str:
        """Generate a basic proposal when LLM fails.

        Args:
            quote: The generated quote.
            analysis: Client analysis.
            company_name: Company name.

        Returns:
            Basic markdown proposal.
        """
        services = "\n".join(f"- {s}" for s in quote.included_services)
        factors = "\n".join(f"- {f}" for f in quote.key_factors)

        return f"""# Bookkeeping Services Proposal

**Prepared for:** {company_name}
**Date:** {datetime.now().strftime('%B %d, %Y')}

## Executive Summary

We're pleased to present our bookkeeping services proposal tailored to your business needs.

## Recommended Service Package

**{quote.recommended_tier} Tier**

### Monthly Investment: ${quote.monthly_price:,}/month

### Included Services

{services}

## Pricing Factors

{factors}

## One-Time Fees

- Setup Fee: ${quote.setup_fee:,} if quote.setup_fee else "Waived"
{f"- Catch-Up Bookkeeping: ${quote.cleanup_fee:,}" if quote.cleanup_fee else ""}

## Next Steps

1. Review this proposal
2. Schedule a call to discuss any questions
3. Sign engagement letter to begin

---

*This proposal is valid for 30 days.*
"""

    def _format_tiers(self) -> str:
        """Format tier definitions for LLM prompts.

        Returns:
            Formatted tier descriptions.
        """
        lines = []
        for tier in self.tiers:
            lines.append(f"\n{tier.name.upper()} (${tier.min_price:,}-${tier.max_price:,}/month)")
            lines.append(f"  Accounting basis: {tier.accounting_basis.value}")
            lines.append(f"  Max accounts: {tier.max_accounts if tier.max_accounts < 999 else 'Unlimited'}")
            if tier.max_ar_ap_entries:
                entries = tier.max_ar_ap_entries if tier.max_ar_ap_entries < 999 else "Unlimited"
                lines.append(f"  AR/AP entries: Up to {entries}/month")
            if tier.max_journal_entries:
                je = tier.max_journal_entries if tier.max_journal_entries < 999 else "Unlimited"
                lines.append(f"  Journal entries: Up to {je}/month")
            lines.append("  Includes:")
            for service in tier.included_services:
                lines.append(f"    - {service}")
        return "\n".join(lines)

    def _format_addons(self) -> str:
        """Format add-on definitions for LLM prompts.

        Returns:
            Formatted add-on descriptions.
        """
        lines = []
        for addon in self.addons:
            lines.append(f"- {addon.name}: {addon.description} ({addon.pricing_note})")
        return "\n".join(lines)

    def _format_samples(self, samples: Dict[str, str]) -> str:
        """Format data samples for LLM prompts.

        Args:
            samples: Dict of filename to sample content.

        Returns:
            Formatted samples section.
        """
        lines = []
        max_sample_length = 2000

        for name, sample in samples.items():
            lines.append(f"\n=== {name} ===")
            if len(sample) > max_sample_length:
                lines.append(sample[:max_sample_length] + "\n... [truncated]")
            else:
                lines.append(sample)
        return "\n".join(lines)

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format user context for LLM prompts.

        Args:
            context: Dict of context key-value pairs.

        Returns:
            Formatted context section.
        """
        if not context:
            return "No additional context provided."

        lines = []
        for key, value in context.items():
            # Format key nicely
            formatted_key = key.replace("_", " ").title()
            lines.append(f"- {formatted_key}: {value}")
        return "\n".join(lines)

    def get_tier_recommendation(self, analysis: ClientAnalysis) -> str:
        """Get a quick tier recommendation without full quote generation.

        Uses simple rules-based logic for fast tier selection.

        Args:
            analysis: Client analysis.

        Returns:
            Recommended tier name.
        """
        # Elite tier triggers
        if any([
            analysis.needs_accrual,
            analysis.total_accounts > 10,
            analysis.monthly_transactions > 1000,
            analysis.complexity_level == ComplexityLevel.VERY_HIGH,
        ]):
            return "Elite"

        # Professional tier triggers
        if any([
            analysis.needs_ar or analysis.needs_ap,
            analysis.total_accounts > 5,
            analysis.monthly_transactions > 500,
            analysis.complexity_level == ComplexityLevel.HIGH,
            len(analysis.platforms) > 1,
        ]):
            return "Professional"

        return "Essential"

    def estimate_cleanup_fee(self, analysis: ClientAnalysis) -> Optional[int]:
        """Estimate cleanup fee based on analysis.

        Args:
            analysis: Client analysis with months_behind and estimated_cleanup_hours.

        Returns:
            Estimated cleanup fee or None if not needed.
        """
        if analysis.months_behind == 0:
            return None

        hours = analysis.estimated_cleanup_hours
        if hours == 0:
            # Estimate based on months behind and complexity
            base_hours = analysis.months_behind * 4  # 4 hours per month baseline
            complexity_multiplier = {
                ComplexityLevel.LOW: 1.0,
                ComplexityLevel.MEDIUM: 1.5,
                ComplexityLevel.HIGH: 2.0,
                ComplexityLevel.VERY_HIGH: 2.5,
            }
            hours = int(base_hours * complexity_multiplier[analysis.complexity_level])

        return hours * DEFAULT_CLEANUP_HOURLY_RATE

    def validate_quote(self, quote: Quote) -> List[str]:
        """Validate a quote for common issues.

        Args:
            quote: Quote to validate.

        Returns:
            List of validation warnings (empty if valid).
        """
        warnings = []

        # Check tier exists
        tier_names = [t.name for t in self.tiers]
        if quote.recommended_tier not in tier_names:
            warnings.append(f"Unknown tier: {quote.recommended_tier}")
            return warnings

        # Check price is within tier range
        tier = next(t for t in self.tiers if t.name == quote.recommended_tier)
        if not (tier.min_price <= quote.monthly_price <= tier.max_price):
            warnings.append(
                f"Price ${quote.monthly_price} outside {quote.recommended_tier} range "
                f"(${tier.min_price}-${tier.max_price})"
            )

        # Check for missing services
        if not quote.included_services:
            warnings.append("No included services listed")

        # Check for missing rationale
        if not quote.price_rationale or len(quote.price_rationale) < 20:
            warnings.append("Missing or insufficient price rationale")

        # Check confidence
        if quote.confidence < 0.5:
            warnings.append(f"Low confidence quote ({quote.confidence:.0%})")

        # Check add-ons exist
        addon_names = [a.name for a in self.addons]
        for addon in quote.recommended_addons:
            if addon not in addon_names:
                warnings.append(f"Unknown add-on: {addon}")

        return warnings

    def reset_token_count(self) -> int:
        """Reset token counter and return previous count.

        Returns:
            Token count before reset.
        """
        count = self.total_tokens
        self.total_tokens = 0
        return count
