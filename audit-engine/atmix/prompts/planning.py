"""LLM prompts for the planning phase - where LLM determines what analyses to run."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .context_gathering import BusinessContext


@dataclass
class AnalysisPlan:
    """Output from the planning phase."""

    business_type: str
    business_description: str
    data_summary: Dict[str, Any]
    planned_analyses: List[Dict[str, Any]]
    investigation_questions: List[str]
    estimated_complexity: str  # simple, moderate, complex
    key_focus_areas: List[str]
    potential_red_flags: List[str]

    def to_dict(self) -> dict:
        return {
            "business_type": self.business_type,
            "business_description": self.business_description,
            "data_summary": self.data_summary,
            "planned_analyses": self.planned_analyses,
            "investigation_questions": self.investigation_questions,
            "estimated_complexity": self.estimated_complexity,
            "key_focus_areas": self.key_focus_areas,
            "potential_red_flags": self.potential_red_flags,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnalysisPlan":
        return cls(**data)


class PlanningPrompts:
    """Prompts for the planning phase where LLM analyzes data and creates analysis plan."""

    @staticmethod
    def create_planning_prompt(
        file_summaries: Dict[str, str],
        data_samples: Dict[str, str],
        business_context: Optional["BusinessContext"] = None,
        data_gaps: Optional[Any] = None,
    ) -> str:
        """Create the prompt for analysis planning.

        Args:
            file_summaries: Dict of filename -> description of file type
            data_samples: Dict of filename -> sample of first N rows as text
            business_context: Optional user-provided business context from context gathering
            data_gaps: Optional DataGapAnalysis identifying missing data

        Returns:
            The planning prompt to send to the LLM
        """
        files_section = "\n".join(
            f"- **{name}**: {desc}" for name, desc in file_summaries.items()
        )

        samples_section = "\n\n".join(
            f"### {name}\n```\n{sample}\n```" for name, sample in data_samples.items()
        )

        # Build business context section if provided
        context_section = ""
        if business_context:
            context_lines = [
                "\n## Business Context (from user interview)",
                "",
                f"**Business Type:** {business_context.business_type or 'Not specified'}",
                f"**Industry:** {business_context.industry or 'Not specified'}",
            ]

            if business_context.primary_sales_system:
                context_lines.append(f"**Primary Sales System:** {business_context.primary_sales_system}")

            if business_context.payment_processors:
                context_lines.append(f"**Payment Processors:** {', '.join(business_context.payment_processors)}")

            if business_context.revenue_model:
                context_lines.append(f"**Revenue Model:** {business_context.revenue_model}")

            context_lines.append(f"**Has Inventory:** {'Yes' if business_context.has_inventory else 'No'}")
            context_lines.append(f"**Has Recurring Revenue:** {'Yes' if business_context.has_recurring_revenue else 'No'}")

            if business_context.clarifications:
                context_lines.append("\n**User Clarifications:**")
                for q_id, answer in business_context.clarifications.items():
                    if answer and answer != "Not provided":
                        context_lines.append(f"- {q_id}: {answer}")

            context_section = "\n".join(context_lines)

        # Build data gaps section if provided
        gaps_section = ""
        if data_gaps:
            gaps_lines = [
                "\n## Known Data Gaps",
                "",
                "The following data is missing or incomplete. Account for these limitations in your analysis plan:",
                "",
            ]

            for gap in data_gaps.gaps:
                priority_icon = {"blocking": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(gap.priority, "⚪")
                gaps_lines.append(f"- {priority_icon} **{gap.description}**")
                gaps_lines.append(f"  - Impact: {gap.impact_without}")

            if data_gaps.proceed_with_caveats:
                gaps_lines.append("\n**Analysis Caveats:**")
                for caveat in data_gaps.proceed_with_caveats:
                    gaps_lines.append(f"- ⚠️ {caveat}")

            gaps_section = "\n".join(gaps_lines)

        # Build the prompt with context-aware instructions
        context_aware_instructions = ""
        if business_context:
            context_aware_instructions = """
IMPORTANT: The user has already provided business context through an interview process.
Use this context to inform your analysis plan. DO NOT contradict the user's stated business type
or make assumptions that conflict with what they've told us.

If the user indicated they use a specific sales platform (e.g., Shopify), and you see multiple
payment processors in the P&L (PayPal, Stripe, etc.), these are likely PAYMENT METHODS within
that platform, NOT separate sales channels. Plan your analysis accordingly.

Focus your analysis plan on what CAN be analyzed with the available data, while clearly noting
what CANNOT be analyzed due to missing data.
"""

        return f"""You are a senior financial analyst preparing to conduct a comprehensive financial audit.
{context_section}
{gaps_section}

## Available Data Files

{files_section}

## Data Samples

{samples_section}
{context_aware_instructions}
## Your Task

Based on this data and business context, create a comprehensive analysis plan. You must:

1. **Confirm Business Understanding**
   - Validate/refine the business type based on user input and data
   - Note any discrepancies between user context and data observations

2. **Assess Data Quality and Coverage**
   - What financial statements are present? (P&L, Balance Sheet, Cash Flow, GL, etc.)
   - What time period does the data cover?
   - What data IS missing that would improve the audit?

3. **Plan Specific Analyses**
   For each analysis, specify:
   - Analysis name
   - What files/data it requires
   - What questions it will answer
   - Why it's important for this specific business
   - What limitations exist due to missing data (if any)

4. **Identify Investigation Questions**
   - What specific questions should be investigated?
   - What potential red flags have you noticed in the data samples?
   - What areas need deeper scrutiny?

## Output Format

Respond with a JSON object in this exact structure:

```json
{{
  "business_type": "retail/service/manufacturing/etc",
  "business_description": "Brief description of the business based on data AND user context",
  "data_summary": {{
    "statements_present": ["P&L", "Balance Sheet", "etc"],
    "time_period": "e.g., Jan 2024 - Dec 2024",
    "data_quality_notes": ["Any quality issues observed"],
    "missing_data_impact": ["What analysis is limited by missing data"]
  }},
  "planned_analyses": [
    {{
      "name": "Analysis name",
      "type": "profitability/liquidity/efficiency/risk/compliance/strategic",
      "required_data": ["file1.csv", "file2.csv"],
      "questions_to_answer": [
        "Question 1 this analysis will answer",
        "Question 2 this analysis will answer"
      ],
      "priority": "high/medium/low",
      "rationale": "Why this analysis is important for this business",
      "limitations": "What can't be analyzed due to missing data (optional)"
    }}
  ],
  "investigation_questions": [
    "Specific question requiring investigation",
    "Another specific question"
  ],
  "estimated_complexity": "simple/moderate/complex",
  "key_focus_areas": [
    "Area 1 requiring special attention",
    "Area 2 requiring special attention"
  ],
  "potential_red_flags": [
    "Observed issue 1 that needs investigation",
    "Observed issue 2 that needs investigation"
  ]
}}
```

Be thorough but focused. Prioritize analyses that will reveal the most about the business's financial health and any risks or opportunities.

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_plan_refinement_prompt(
        current_plan: Dict[str, Any],
        user_feedback: str,
        additional_requirements: List[str]
    ) -> str:
        """Create prompt to refine the analysis plan based on user feedback.

        Args:
            current_plan: The current analysis plan as a dict
            user_feedback: User's feedback or modification requests
            additional_requirements: Additional analyses requested by user

        Returns:
            The refinement prompt to send to the LLM
        """
        import json

        additional_section = ""
        if additional_requirements:
            additional_section = "\n## Additional Analyses Requested\n" + "\n".join(
                f"- {req}" for req in additional_requirements
            )

        return f"""You are refining a financial audit analysis plan based on user feedback.

## Current Plan

```json
{json.dumps(current_plan, indent=2)}
```

## User Feedback

{user_feedback}
{additional_section}

## Your Task

Refine the analysis plan to incorporate the user's feedback and any additional requirements.
Maintain the same JSON structure as the original plan.

IMPORTANT:
- Keep all analyses that weren't explicitly removed
- Add any new analyses requested
- Adjust priorities if the feedback suggests different focus areas
- Update investigation questions based on feedback

Respond with the complete updated JSON plan (same structure as input)."""

    @staticmethod
    def get_analysis_type_descriptions() -> Dict[str, str]:
        """Return descriptions of each analysis type for user display."""
        return {
            "profitability": "Revenue, margins, cost structure, income trends",
            "liquidity": "Cash position, working capital, ability to meet short-term obligations",
            "efficiency": "Asset turnover, operational efficiency, resource utilization",
            "risk": "Financial risks, compliance issues, operational vulnerabilities",
            "compliance": "Tax obligations, regulatory requirements, reporting accuracy",
            "strategic": "Competitive position, growth opportunities, long-term sustainability",
            "integrity": "Data quality, reconciliation, accuracy of books",
        }

    @staticmethod
    def format_plan_for_display(plan: AnalysisPlan) -> str:
        """Format the analysis plan for user-friendly display.

        Args:
            plan: The AnalysisPlan to format

        Returns:
            Formatted string for terminal display
        """
        lines = [
            "=" * 60,
            "ANALYSIS PLAN",
            "=" * 60,
            "",
            f"Business Type: {plan.business_type}",
            f"Description: {plan.business_description}",
            f"Complexity: {plan.estimated_complexity}",
            "",
            "─" * 40,
            "DATA SUMMARY",
            "─" * 40,
        ]

        if "statements_present" in plan.data_summary:
            lines.append(f"Statements: {', '.join(plan.data_summary['statements_present'])}")
        if "time_period" in plan.data_summary:
            lines.append(f"Time Period: {plan.data_summary['time_period']}")

        lines.extend([
            "",
            "─" * 40,
            f"PLANNED ANALYSES ({len(plan.planned_analyses)})",
            "─" * 40,
        ])

        for i, analysis in enumerate(plan.planned_analyses, 1):
            priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(
                analysis.get("priority", "medium"), "⚪"
            )
            lines.append(f"\n{i}. {priority_icon} {analysis['name']} [{analysis.get('type', 'general')}]")
            lines.append(f"   Data: {', '.join(analysis.get('required_data', []))}")
            lines.append(f"   Rationale: {analysis.get('rationale', 'N/A')}")
            if analysis.get("questions_to_answer"):
                lines.append("   Questions:")
                for q in analysis["questions_to_answer"][:3]:
                    lines.append(f"     • {q}")

        if plan.key_focus_areas:
            lines.extend([
                "",
                "─" * 40,
                "KEY FOCUS AREAS",
                "─" * 40,
            ])
            for area in plan.key_focus_areas:
                lines.append(f"  • {area}")

        if plan.potential_red_flags:
            lines.extend([
                "",
                "─" * 40,
                "⚠️  POTENTIAL RED FLAGS",
                "─" * 40,
            ])
            for flag in plan.potential_red_flags:
                lines.append(f"  ⚠️  {flag}")

        if plan.investigation_questions:
            lines.extend([
                "",
                "─" * 40,
                "INVESTIGATION QUESTIONS",
                "─" * 40,
            ])
            for q in plan.investigation_questions[:10]:
                lines.append(f"  ? {q}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
