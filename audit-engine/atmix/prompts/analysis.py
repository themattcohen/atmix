"""LLM prompts for the analysis phase - where LLM performs actual data analysis."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AnalysisFinding:
    """A finding from LLM analysis."""

    title: str
    severity: str  # critical, high, medium, low, info
    category: str
    source_file: str
    source_reference: str  # e.g., "row 15" or "calculated from total_revenue / total_expenses"
    raw_value: Any
    detail: str
    business_implication: str
    confidence: str  # high, medium, low
    confidence_rationale: str
    follow_up_questions: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "severity": self.severity,
            "category": self.category,
            "source_file": self.source_file,
            "source_reference": self.source_reference,
            "raw_value": self.raw_value,
            "detail": self.detail,
            "business_implication": self.business_implication,
            "confidence": self.confidence,
            "confidence_rationale": self.confidence_rationale,
            "follow_up_questions": self.follow_up_questions,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnalysisFinding":
        return cls(**data)


@dataclass
class AnalysisResult:
    """Result from a single analysis."""

    analysis_name: str
    analysis_type: str
    findings: List[AnalysisFinding]
    summary: str
    data_quality_issues: List[str]
    suggested_follow_up: List[str]
    overall_confidence: float

    def to_dict(self) -> dict:
        return {
            "analysis_name": self.analysis_name,
            "analysis_type": self.analysis_type,
            "findings": [f.to_dict() for f in self.findings],
            "summary": self.summary,
            "data_quality_issues": self.data_quality_issues,
            "suggested_follow_up": self.suggested_follow_up,
            "overall_confidence": self.overall_confidence,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnalysisResult":
        data = data.copy()
        data["findings"] = [AnalysisFinding.from_dict(f) for f in data.get("findings", [])]
        return cls(**data)


class AnalysisPrompts:
    """Prompts for LLM-driven analysis of financial data."""

    @staticmethod
    def create_analysis_prompt(
        analysis_name: str,
        analysis_type: str,
        analysis_questions: List[str],
        data_content: Dict[str, str],
        prior_findings_summary: Optional[str] = None,
        business_context: Optional[str] = None,
    ) -> str:
        """Create prompt for a specific analysis.

        Args:
            analysis_name: Name of the analysis being performed
            analysis_type: Type of analysis (profitability, liquidity, etc.)
            analysis_questions: Specific questions this analysis should answer
            data_content: Dict of filename -> file content (CSV as text)
            prior_findings_summary: Summary of findings from prior analyses
            business_context: Context about the business type and operations

        Returns:
            The analysis prompt to send to the LLM
        """
        data_section = "\n\n".join(
            f"### {name}\n```csv\n{content}\n```" for name, content in data_content.items()
        )

        questions_section = "\n".join(f"- {q}" for q in analysis_questions)

        context_section = ""
        if business_context:
            context_section = f"""
## Business Context

{business_context}
"""

        prior_section = ""
        if prior_findings_summary:
            prior_section = f"""
## Prior Findings

The following findings have been identified in previous analyses:

{prior_findings_summary}

Consider how your analysis relates to or expands upon these findings.
"""

        return f"""You are a senior financial analyst performing a detailed {analysis_type} analysis as part of a comprehensive financial audit.

## Analysis: {analysis_name}
{context_section}
## Raw Data

{data_section}
{prior_section}
## Questions to Answer

{questions_section}

## Your Task

Analyze the provided data thoroughly. For each finding, you MUST provide:

1. **Source Citation**: Exact file and reference (row number, column, or calculation method)
2. **Raw Value**: The actual number or observation from the data
3. **Business Implication**: Why this matters for the business
4. **Confidence Level**: How confident you are in this finding and why

## Output Format

Respond with a JSON object in this exact structure:

```json
{{
  "analysis_name": "{analysis_name}",
  "analysis_type": "{analysis_type}",
  "findings": [
    {{
      "title": "Clear, specific finding title",
      "severity": "critical|high|medium|low|info",
      "category": "revenue|expense|margin|liquidity|efficiency|risk|compliance|data_quality|working_capital|ratio",
      "source_file": "filename.csv",
      "source_reference": "Row 15, Column 'Total Revenue' OR 'Calculated: revenue - expenses'",
      "raw_value": 12345.67,
      "detail": "Detailed explanation of the finding with specific numbers",
      "business_implication": "What this means for the business and why it matters",
      "confidence": "high|medium|low",
      "confidence_rationale": "Why you are confident (or not) in this finding",
      "follow_up_questions": [
        "Question that needs to be investigated based on this finding"
      ]
    }}
  ],
  "summary": "2-3 sentence summary of the overall analysis findings",
  "data_quality_issues": [
    "Any data quality issues observed during analysis"
  ],
  "suggested_follow_up": [
    "Specific analyses or investigations that should follow from these findings"
  ],
  "overall_confidence": 0.85
}}
```

## Analysis Guidelines

1. **Be Specific**: Use exact numbers from the data. Never approximate or round in findings.
2. **Cite Sources**: Every finding must reference specific cells, rows, or calculations.
3. **Think Critically**: Look for anomalies, trends, and relationships between data points.
4. **Consider Context**: Relate findings to the business type and industry norms.
5. **Prioritize**: Focus on material findings that would impact business decisions.

## Severity Guidelines

- **critical**: Immediate threat to business viability (e.g., negative cash, insolvency risk)
- **high**: Significant issue requiring urgent attention (e.g., major losses, compliance risk)
- **medium**: Important issue that should be addressed (e.g., declining margins, inefficiencies)
- **low**: Minor issue or opportunity for improvement
- **info**: Noteworthy observation without immediate concern

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def format_findings_for_display(result: AnalysisResult) -> str:
        """Format analysis result for user-friendly display.

        Args:
            result: The AnalysisResult to format

        Returns:
            Formatted string for terminal display
        """
        severity_icons = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
            "info": "🔵",
        }

        confidence_icons = {
            "high": "✓✓",
            "medium": "✓",
            "low": "?",
        }

        lines = [
            "─" * 60,
            f"Analysis: {result.analysis_name}",
            f"Type: {result.analysis_type}",
            f"Confidence: {result.overall_confidence:.0%}",
            "─" * 60,
        ]

        if result.findings:
            lines.append(f"\nFindings ({len(result.findings)}):")
            for i, f in enumerate(result.findings, 1):
                icon = severity_icons.get(f.severity, "⚪")
                conf = confidence_icons.get(f.confidence, "?")
                lines.append(f"\n{icon} [{conf}] {f.title}")
                lines.append(f"   Source: {f.source_file} - {f.source_reference}")
                lines.append(f"   Value: {f.raw_value}")
                lines.append(f"   {f.detail[:200]}...")
                lines.append(f"   → {f.business_implication[:150]}...")

        if result.data_quality_issues:
            lines.append("\n⚠️  Data Quality Issues:")
            for issue in result.data_quality_issues:
                lines.append(f"   • {issue}")

        lines.append(f"\nSummary: {result.summary}")

        return "\n".join(lines)
