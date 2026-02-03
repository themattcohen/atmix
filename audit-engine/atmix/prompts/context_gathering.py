"""LLM prompts for context gathering and data gap analysis.

This module handles the interactive phase where we:
1. Ask the user key questions about their business BEFORE analysis
2. Identify expected data sources based on business type
3. Flag missing data that would improve the audit
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class BusinessContext:
    """User-provided context about the business being audited."""

    business_type: str = ""  # e.commerce, saas, professional_services, manufacturing, retail, etc.
    industry: str = ""  # More specific: outdoor_retail, legal_services, food_manufacturing

    # Systems & Platforms
    primary_sales_system: str = ""  # shopify, quickbooks_pos, salesforce, manual
    payment_processors: List[str] = field(default_factory=list)  # stripe, paypal, square
    accounting_system: str = ""  # quickbooks, xero, netsuite

    # Business Model
    revenue_model: str = ""  # product_sales, subscriptions, services, mixed
    has_inventory: bool = False
    has_recurring_revenue: bool = False

    # Data Availability
    available_data: List[str] = field(default_factory=list)
    missing_but_obtainable: List[str] = field(default_factory=list)
    not_available: List[str] = field(default_factory=list)

    # User-provided clarifications
    clarifications: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "business_type": self.business_type,
            "industry": self.industry,
            "primary_sales_system": self.primary_sales_system,
            "payment_processors": self.payment_processors,
            "accounting_system": self.accounting_system,
            "revenue_model": self.revenue_model,
            "has_inventory": self.has_inventory,
            "has_recurring_revenue": self.has_recurring_revenue,
            "available_data": self.available_data,
            "missing_but_obtainable": self.missing_but_obtainable,
            "not_available": self.not_available,
            "clarifications": self.clarifications,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BusinessContext":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class ContextQuestion:
    """A question to ask the user for context."""

    id: str
    question: str
    why_asking: str  # Brief explanation of why this matters
    question_type: str  # single_choice, multiple_choice, text, yes_no
    options: List[str] = field(default_factory=list)  # For choice questions
    default: Optional[str] = None
    priority: str = "important"  # blocking, important, helpful

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "question": self.question,
            "why_asking": self.why_asking,
            "question_type": self.question_type,
            "options": self.options,
            "default": self.default,
            "priority": self.priority,
        }


@dataclass
class DataGap:
    """A gap in the available data."""

    data_type: str  # e.g., "shopify_transactions", "bank_statements"
    description: str
    why_needed: str
    impact_without: str  # What analysis is limited without this
    obtainable: bool  # Can the user likely get this?
    priority: str  # blocking, high, medium, low

    def to_dict(self) -> dict:
        return {
            "data_type": self.data_type,
            "description": self.description,
            "why_needed": self.why_needed,
            "impact_without": self.impact_without,
            "obtainable": self.obtainable,
            "priority": self.priority,
        }


@dataclass
class ContextGatheringResult:
    """Result of the context gathering phase."""

    questions: List[ContextQuestion]
    initial_observations: List[str]  # What we noticed from the files
    business_type_guess: str
    confidence_in_guess: float

    def to_dict(self) -> dict:
        return {
            "questions": [q.to_dict() for q in self.questions],
            "initial_observations": self.initial_observations,
            "business_type_guess": self.business_type_guess,
            "confidence_in_guess": self.confidence_in_guess,
        }


@dataclass
class DataGapAnalysis:
    """Result of analyzing what data is missing."""

    gaps: List[DataGap]
    expected_for_business_type: List[str]
    available: List[str]
    recommendations: List[str]
    can_proceed: bool  # Are gaps blocking?
    proceed_with_caveats: List[str]  # Limitations if we proceed

    def to_dict(self) -> dict:
        return {
            "gaps": [g.to_dict() for g in self.gaps],
            "expected_for_business_type": self.expected_for_business_type,
            "available": self.available,
            "recommendations": self.recommendations,
            "can_proceed": self.can_proceed,
            "proceed_with_caveats": self.proceed_with_caveats,
        }


class ContextGatheringPrompts:
    """Prompts for gathering business context before analysis."""

    @staticmethod
    def create_initial_questions_prompt(
        file_list: List[str],
        file_samples: Dict[str, str],
        context_documents: str = "",
    ) -> str:
        """Create prompt to generate initial context questions.

        The LLM looks at available files and generates smart questions
        to understand the business before analysis begins.

        Args:
            file_list: List of available file names
            file_samples: Dict of filename -> CSV sample content
            context_documents: Pre-formatted text of context documents (PDFs, etc.)
        """
        files_section = "\n".join(f"- {f}" for f in file_list)

        samples_section = ""
        for filename, sample in list(file_samples.items())[:5]:
            samples_section += f"\n### {filename}\n```csv\n{sample[:2000]}\n```\n"

        # Add context documents section if provided
        context_section = ""
        if context_documents:
            context_section = f"""
{context_documents}

IMPORTANT: The context documents above (especially QuickBooks health reports) contain
critical information about the business's accounting health, bank reconciliation status,
and potential issues. Use this information to inform your questions and observations.
"""

        return f"""You are a senior financial analyst about to conduct an audit. Before diving into analysis, you need to understand the business context.

## Available Files
{files_section}

## Sample Data (first rows)
{samples_section}
{context_section}
## Your Task

Based on the files and data samples, generate 3-5 focused questions to ask the user BEFORE analysis begins. These questions should help you:

1. **Understand the business model** - What do they sell? How do they make money?
2. **Identify systems and data sources** - What platforms/systems generated this data?
3. **Clarify ambiguities** - Anything in the data that could be interpreted multiple ways?
4. **Identify missing data** - What would you expect to see that's not here?

## Output Format

Return a JSON object:

```json
{{
  "initial_observations": [
    "Observation about what you see in the data",
    "Another observation"
  ],
  "business_type_guess": "e-commerce|saas|professional_services|manufacturing|retail|other",
  "confidence_in_guess": 0.7,
  "questions": [
    {{
      "id": "q1",
      "question": "The clear question to ask",
      "why_asking": "Brief explanation of why this matters for the audit",
      "question_type": "single_choice|multiple_choice|text|yes_no",
      "options": ["Option 1", "Option 2", "Option 3"],
      "priority": "blocking|important|helpful"
    }}
  ]
}}
```

## Guidelines

1. **Be specific** - Don't ask vague questions. Reference what you see in the data.
2. **Explain why** - Users are more likely to answer if they understand the importance.
3. **Limit to 3-5 questions** - More than that is overwhelming.
4. **Prioritize correctly** - "blocking" means we can't proceed without this answer.
5. **Make it easy** - Use choice questions when possible, with sensible options.

## Common Patterns to Watch For

- Multiple payment processors in P&L (PayPal, Stripe, etc.) - Are these separate channels or payment methods?
- E-commerce indicators (Shopify, Amazon, etc.) - Do we have transaction-level data?
- Inventory accounts - Is this a product business? Do we have COGS detail?
- Subscription/recurring patterns - Is this a SaaS or membership business?
- Professional services indicators - Is revenue project-based or hourly?

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_data_gap_prompt(
        business_context: BusinessContext,
        file_list: List[str],
        file_samples: Dict[str, str],
    ) -> str:
        """Create prompt to analyze what data is missing.

        After understanding the business type, identify what data
        we'd expect to have vs. what's actually available.
        """
        import json

        context_json = json.dumps(business_context.to_dict(), indent=2)
        files_section = "\n".join(f"- {f}" for f in file_list)

        return f"""You are a senior financial analyst preparing for an audit.

## Business Context (from user)

```json
{context_json}
```

## Available Files
{files_section}

## Your Task

Based on the business type and context, identify what data is MISSING that would be valuable for a thorough audit.

## Expected Data by Business Type

**E-commerce (Shopify, Amazon, etc.)**
- Transaction-level sales data (orders, line items)
- Fulfillment/shipping data
- Refunds and chargebacks
- Customer data (for concentration analysis)
- Platform fee breakdowns

**SaaS / Subscriptions**
- MRR/ARR breakdown
- Churn data
- Customer cohort data
- Usage metrics

**Professional Services**
- Project/engagement list
- Time and billing data
- Client list with revenue
- WIP (work in progress)

**Manufacturing / Product**
- Bill of materials
- Inventory aging
- Production costs
- Supplier invoices

**Retail**
- POS transaction data
- Inventory counts
- Shrinkage reports
- Foot traffic / conversion

## Output Format

Return a JSON object:

```json
{{
  "expected_for_business_type": [
    "Data type 1 typically available for this business",
    "Data type 2"
  ],
  "available": [
    "What we have from the file list"
  ],
  "gaps": [
    {{
      "data_type": "shopify_transactions",
      "description": "Transaction-level Shopify sales data",
      "why_needed": "To analyze sales by product, customer concentration, refund rates",
      "impact_without": "Revenue analysis limited to P&L totals, can't identify top products or customers",
      "obtainable": true,
      "priority": "high"
    }}
  ],
  "recommendations": [
    "Request Shopify export for transaction-level analysis",
    "Proceed with available data but note limitations"
  ],
  "can_proceed": true,
  "proceed_with_caveats": [
    "Revenue channel analysis will be limited to P&L categories",
    "Cannot verify sales channel vs payment processor distinction"
  ]
}}
```

## Guidelines

1. **Be practical** - Only flag gaps that would meaningfully improve the audit
2. **Consider obtainability** - Is this data the user can reasonably get?
3. **Prioritize correctly**:
   - "blocking" = Can't do a meaningful audit without this
   - "high" = Significantly limits analysis
   - "medium" = Would add value
   - "low" = Nice to have
4. **Be specific about impact** - What analysis is limited without this data?

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_clarification_prompt(
        business_context: BusinessContext,
        ambiguity: str,
        relevant_data: str,
    ) -> str:
        """Create a targeted clarification question during analysis.

        When the LLM encounters something ambiguous, generate a
        focused question for the user.
        """
        import json

        return f"""You are a senior financial analyst who encountered an ambiguity during audit analysis.

## Business Context
```json
{json.dumps(business_context.to_dict(), indent=2)}
```

## The Ambiguity
{ambiguity}

## Relevant Data
```
{relevant_data[:3000]}
```

## Your Task

Generate ONE focused clarification question to resolve this ambiguity.

## Output Format

Return a JSON object:

```json
{{
  "question": "The specific question to ask",
  "why_asking": "Why this matters for the analysis",
  "options": ["Option 1", "Option 2", "Other (please specify)"],
  "default_assumption": "What we'll assume if user doesn't answer",
  "impact_of_wrong_assumption": "What could go wrong if we assume incorrectly"
}}
```

Keep it simple and focused. One question, clear options.

IMPORTANT: Your response must be valid JSON."""

    @staticmethod
    def format_questions_for_display(result: ContextGatheringResult) -> str:
        """Format context questions for terminal display."""
        lines = [
            "=" * 60,
            "BUSINESS CONTEXT QUESTIONS",
            "=" * 60,
            "",
            "Before we begin the audit, we need to understand your business better.",
            "",
        ]

        if result.initial_observations:
            lines.append("What we observed from your files:")
            for obs in result.initial_observations:
                lines.append(f"  • {obs}")
            lines.append("")

        if result.business_type_guess:
            confidence_pct = int(result.confidence_in_guess * 100)
            lines.append(f"Initial assessment: This appears to be a {result.business_type_guess} business ({confidence_pct}% confidence)")
            lines.append("")

        lines.append("─" * 40)
        lines.append("Please answer the following questions:")
        lines.append("─" * 40)

        for i, q in enumerate(result.questions, 1):
            priority_icon = {"blocking": "🔴", "important": "🟡", "helpful": "🟢"}.get(q.priority, "⚪")
            lines.append(f"\n{priority_icon} Question {i}: {q.question}")
            lines.append(f"   Why: {q.why_asking}")

            if q.options:
                lines.append("   Options:")
                for opt in q.options:
                    lines.append(f"     • {opt}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    @staticmethod
    def format_gaps_for_display(analysis: DataGapAnalysis) -> str:
        """Format data gap analysis for terminal display."""
        lines = [
            "=" * 60,
            "DATA GAP ANALYSIS",
            "=" * 60,
            "",
        ]

        if analysis.available:
            lines.append("✓ Data Available:")
            for item in analysis.available:
                lines.append(f"  • {item}")
            lines.append("")

        if analysis.gaps:
            lines.append("⚠ Missing Data:")
            for gap in analysis.gaps:
                priority_icon = {"blocking": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(gap.priority, "⚪")
                lines.append(f"\n  {priority_icon} {gap.description}")
                lines.append(f"     Why needed: {gap.why_needed}")
                lines.append(f"     Impact: {gap.impact_without}")
                if gap.obtainable:
                    lines.append(f"     → User can likely provide this")

        if analysis.recommendations:
            lines.append("\n" + "─" * 40)
            lines.append("Recommendations:")
            for rec in analysis.recommendations:
                lines.append(f"  → {rec}")

        if analysis.proceed_with_caveats:
            lines.append("\n" + "─" * 40)
            lines.append("If proceeding with available data:")
            for caveat in analysis.proceed_with_caveats:
                lines.append(f"  ⚠ {caveat}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
