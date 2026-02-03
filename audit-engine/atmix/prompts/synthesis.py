"""LLM prompts for the synthesis phase - narrative generation and executive summaries."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SynthesizedReport:
    """Output from the synthesis phase."""

    executive_summary: str = ""
    key_insights: List[Dict[str, Any]] = field(default_factory=list)
    curated_findings: List[Dict[str, Any]] = field(default_factory=list)
    chart_configs: List[Dict[str, Any]] = field(default_factory=list)
    management_questions: List[Dict[str, Any]] = field(default_factory=list)
    document_requests: List[str] = field(default_factory=list)
    overall_assessment: str = ""
    risk_level: str = ""
    immediate_priorities: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "executive_summary": self.executive_summary,
            "key_insights": self.key_insights,
            "curated_findings": self.curated_findings,
            "chart_configs": self.chart_configs,
            "management_questions": self.management_questions,
            "document_requests": self.document_requests,
            "overall_assessment": self.overall_assessment,
            "risk_level": self.risk_level,
            "immediate_priorities": self.immediate_priorities,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SynthesizedReport":
        # Filter to only known fields to handle extra LLM output gracefully
        known_fields = {
            "executive_summary", "key_insights", "curated_findings",
            "chart_configs", "management_questions", "document_requests",
            "overall_assessment", "risk_level", "immediate_priorities"
        }
        filtered = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered)


class SynthesisPrompts:
    """Prompts for LLM-driven synthesis and narrative generation."""

    @staticmethod
    def create_curation_prompt(
        all_findings: List[Dict[str, Any]],
        company_name: str,
        business_context: str,
        target_count: int = 15,
    ) -> str:
        """Create prompt for curating and ranking findings.

        Args:
            all_findings: All findings from analysis phase
            company_name: Name of the company
            business_context: Context about the business
            target_count: Target number of curated findings (10-15)

        Returns:
            The curation prompt to send to the LLM
        """
        import json

        findings_json = json.dumps(all_findings, indent=2)

        return f"""You are a senior financial analyst preparing an executive report for {company_name}.

## Business Context

{business_context}

## All Findings from Analysis

```json
{findings_json}
```

## Your Task

Curate the most important findings for an executive audience. Select the top {target_count} findings that:
1. Are most material to the business
2. Require immediate attention or decision
3. Represent the most significant risks or opportunities
4. Have the strongest evidence and highest confidence

## Output Format

Respond with a JSON object:

```json
{{
  "curated_findings": [
    {{
      "rank": 1,
      "original_finding_id": "id from input if available",
      "title": "Finding title",
      "severity": "critical|high|medium|low|info",
      "category": "category",
      "executive_summary": "One sentence summary for executives (max 20 words)",
      "narrative": "2-3 sentences providing business context and implications",
      "source_citation": "Where this finding came from (file:reference)",
      "evidence_strength": "strong|medium|weak",
      "trend": "improving|declining|stable|null",
      "metrics": {{"key": "value"}},
      "recommended_action": "Specific action recommendation"
    }}
  ],
  "curation_rationale": "Brief explanation of curation criteria used"
}}
```

## Curation Guidelines

1. **Prioritize Severity**: Critical and high findings should generally rank higher
2. **Consider Evidence**: Findings with strong evidence are more valuable
3. **Business Impact**: Focus on findings that affect decisions
4. **Avoid Redundancy**: Don't include multiple findings saying the same thing
5. **Balance Coverage**: Ensure key areas (profitability, liquidity, risk) are represented

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_executive_narrative_prompt(
        company_name: str,
        analysis_period: str,
        metric_cards: List[Dict[str, Any]],
        curated_findings: List[Dict[str, Any]],
        business_context: str,
    ) -> str:
        """Create prompt for generating executive narrative.

        Args:
            company_name: Name of the company
            analysis_period: Time period of the analysis
            metric_cards: Key metrics for the dashboard
            curated_findings: Top curated findings
            business_context: Context about the business

        Returns:
            The executive narrative prompt
        """
        import json

        metrics_summary = "\n".join(
            f"- {m['title']}: {m['value']}" for m in metric_cards[:8]
        )

        findings_summary = "\n".join(
            f"- [{f['severity'].upper()}] {f['title']}: {f.get('executive_summary', f.get('detail', '')[:100])}"
            for f in curated_findings[:10]
        )

        return f"""You are writing an executive financial report for {company_name}.

## Business Context

{business_context}

## Analysis Period

{analysis_period}

## Key Metrics

{metrics_summary}

## Top Findings

{findings_summary}

## Your Task

Write a professional executive summary suitable for a board presentation.

## Output Format

Respond with a JSON object:

```json
{{
  "executive_summary": "2-3 paragraphs (150-250 words total). First paragraph: overall financial health assessment. Second paragraph: key areas of concern. Third paragraph (optional): opportunities or positive aspects.",
  "overall_assessment": "healthy|cautionary|concerning|critical",
  "key_insights": [
    {{
      "insight": "Key strategic insight",
      "implication": "What this means for the business",
      "priority": "high|medium|low"
    }}
  ],
  "immediate_priorities": [
    "First priority action",
    "Second priority action"
  ]
}}
```

## Writing Guidelines

1. **Professional Tone**: Suitable for board/investor presentation
2. **No Jargon**: Avoid accounting jargon where possible
3. **Specific Numbers**: Reference specific metrics and findings
4. **Balanced View**: Acknowledge both risks and strengths
5. **Actionable**: End with clear priorities

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_chart_generation_prompt(
        data_summary: Dict[str, Any],
        curated_findings: List[Dict[str, Any]],
        available_metrics: Dict[str, float],
    ) -> str:
        """Create prompt for generating Chart.js configurations.

        Args:
            data_summary: Summary of available data
            curated_findings: Curated findings for context
            available_metrics: Available metrics and their values

        Returns:
            The chart generation prompt
        """
        import json

        return f"""You are creating data visualizations for a financial audit report.

## Available Data

```json
{json.dumps(data_summary, indent=2)}
```

## Available Metrics

```json
{json.dumps(available_metrics, indent=2)}
```

## Key Findings (for context)

```json
{json.dumps(curated_findings[:5], indent=2)}
```

## Your Task

Generate 3-4 Chart.js configurations that best visualize the key financial insights.

## Output Format

Respond with a JSON object:

```json
{{
  "charts": [
    {{
      "chart_type": "line|bar|doughnut|pie",
      "title": "Chart title",
      "labels": ["Label1", "Label2", ...],
      "datasets": [
        {{
          "label": "Dataset label",
          "data": [100, 200, 300],
          "backgroundColor": "rgba(59, 130, 246, 0.8)",
          "borderColor": "rgb(59, 130, 246)",
          "borderWidth": 1
        }}
      ],
      "options": {{
        "responsive": true,
        "plugins": {{
          "legend": {{"position": "bottom"}}
        }}
      }},
      "insight": "What this chart reveals"
    }}
  ]
}}
```

## Chart Guidelines

1. **Prioritize Clarity**: Each chart should tell one clear story
2. **Use Appropriate Types**:
   - Line charts for trends over time
   - Bar charts for comparisons
   - Doughnut/pie for composition
3. **Limit Data Points**: 6-12 points maximum for readability
4. **Professional Colors**: Use the palette below

## Color Palette

- Primary: rgb(59, 130, 246) - Blue
- Success: rgb(34, 197, 94) - Green
- Warning: rgb(249, 115, 22) - Orange
- Danger: rgb(239, 68, 68) - Red
- Neutral: rgb(107, 114, 128) - Gray

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_questions_prompt(
        all_questions: List[Dict[str, Any]],
        curated_findings: List[Dict[str, Any]],
        company_name: str,
    ) -> str:
        """Create prompt for prioritizing questions for management.

        Args:
            all_questions: All questions raised during analysis
            curated_findings: Curated findings for context
            company_name: Name of the company

        Returns:
            The questions prioritization prompt
        """
        import json

        return f"""You are preparing questions for management as part of a financial audit for {company_name}.

## Questions Raised During Analysis

```json
{json.dumps(all_questions, indent=2)}
```

## Key Findings (for context)

```json
{json.dumps(curated_findings[:10], indent=2)}
```

## Your Task

Prioritize and enhance the questions for management. Select the 10-15 most important questions.

## Output Format

Respond with a JSON object:

```json
{{
  "prioritized_questions": [
    {{
      "rank": 1,
      "question": "The question to ask management",
      "context": "Background context for why this question matters",
      "related_finding": "Which finding prompted this question",
      "priority": "blocking|important|nice_to_have",
      "why_important": "One sentence explaining importance",
      "suggested_approach": "How to get this answer (e.g., request documents, interview)"
    }}
  ],
  "document_requests": [
    {{
      "document": "Document type needed",
      "purpose": "Why this document is needed",
      "related_questions": [1, 2, 3]
    }}
  ]
}}
```

## Prioritization Guidelines

1. **Blocking Questions**: Must be answered to complete the audit
2. **Important Questions**: Significantly affect understanding
3. **Nice to Have**: Would provide additional context

Focus on questions that:
- Address the most critical findings
- Clarify unexplained anomalies
- Verify assumptions made during analysis

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_full_synthesis_prompt(
        company_name: str,
        analysis_period: str,
        all_findings: List[Dict[str, Any]],
        all_questions: List[Dict[str, Any]],
        data_summary: Dict[str, Any],
        business_context: str,
    ) -> str:
        """Create comprehensive synthesis prompt combining all synthesis tasks.

        This is the main synthesis prompt used when doing a single LLM call
        for the entire synthesis phase.

        Args:
            company_name: Name of the company
            analysis_period: Time period of analysis
            all_findings: All findings from analysis
            all_questions: All questions raised
            data_summary: Summary of data analyzed
            business_context: Context about the business

        Returns:
            The comprehensive synthesis prompt
        """
        import json

        return f"""You are a senior financial analyst completing the synthesis phase of a comprehensive financial audit for {company_name}.

## Business Context

{business_context}

## Analysis Period

{analysis_period}

## Data Analyzed

```json
{json.dumps(data_summary, indent=2)}
```

## All Findings from Analysis Phase

```json
{json.dumps(all_findings, indent=2)}
```

## Questions Raised During Analysis

```json
{json.dumps(all_questions, indent=2)}
```

## Your Task

Generate a complete synthesis of the audit findings for an executive report.

## Output Format

Respond with a JSON object:

```json
{{
  "executive_summary": "2-3 paragraphs (150-250 words). Professional tone suitable for board presentation.",

  "overall_assessment": "healthy|cautionary|concerning|critical",

  "risk_level": "low|moderate|elevated|high|critical",

  "key_insights": [
    {{
      "insight": "Key strategic insight",
      "implication": "Business implication",
      "priority": "high|medium|low"
    }}
  ],

  "curated_findings": [
    {{
      "rank": 1,
      "title": "Finding title",
      "severity": "critical|high|medium|low|info",
      "category": "category",
      "executive_summary": "One sentence for executives",
      "narrative": "2-3 sentences with business context",
      "source_citation": "source:reference",
      "evidence_strength": "strong|medium|weak",
      "trend": "improving|declining|stable|null",
      "metrics": {{}},
      "recommended_action": "Specific action"
    }}
  ],

  "chart_configs": [
    {{
      "chart_type": "line|bar|doughnut",
      "title": "Chart title",
      "labels": [],
      "datasets": [],
      "options": {{}},
      "insight": "What this shows"
    }}
  ],

  "management_questions": [
    {{
      "rank": 1,
      "question": "Question for management",
      "context": "Why this matters",
      "priority": "blocking|important|nice_to_have",
      "why_important": "Brief rationale"
    }}
  ],

  "document_requests": [
    "Document needed and purpose"
  ],

  "immediate_priorities": [
    "Priority action 1",
    "Priority action 2"
  ]
}}
```

## Guidelines

1. **Curate 10-15 findings** focusing on material, actionable items
2. **Write for executives** - clear, professional, specific
3. **Generate 3-4 charts** that visualize key insights
4. **Prioritize 10-15 questions** for management follow-up
5. **Be balanced** - acknowledge both risks and strengths
6. **Include source citations** for all findings

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def format_synthesis_for_display(synthesis: SynthesizedReport) -> str:
        """Format synthesis for user-friendly display.

        Args:
            synthesis: The SynthesizedReport to format

        Returns:
            Formatted string for terminal display
        """
        risk_colors = {
            "low": "🟢",
            "moderate": "🟡",
            "elevated": "🟠",
            "high": "🔴",
            "critical": "🔴🔴",
        }

        lines = [
            "=" * 60,
            "SYNTHESIS COMPLETE",
            "=" * 60,
            "",
            f"Overall Assessment: {synthesis.overall_assessment.upper()}",
            f"Risk Level: {risk_colors.get(synthesis.risk_level, '⚪')} {synthesis.risk_level.upper()}",
            "",
            "─" * 40,
            "EXECUTIVE SUMMARY",
            "─" * 40,
            "",
            synthesis.executive_summary,
            "",
        ]

        if synthesis.key_insights:
            lines.extend([
                "─" * 40,
                "KEY INSIGHTS",
                "─" * 40,
            ])
            for insight in synthesis.key_insights[:5]:
                priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(
                    insight.get("priority", "medium"), "⚪"
                )
                lines.append(f"\n{priority_icon} {insight.get('insight', '')}")
                lines.append(f"   → {insight.get('implication', '')}")

        lines.extend([
            "",
            "─" * 40,
            f"CURATED FINDINGS ({len(synthesis.curated_findings)})",
            "─" * 40,
        ])

        for finding in synthesis.curated_findings[:10]:
            severity_icon = {
                "critical": "🔴", "high": "🟠", "medium": "🟡",
                "low": "🟢", "info": "🔵"
            }.get(finding.get("severity", "info"), "⚪")
            lines.append(f"\n{finding.get('rank', '?')}. {severity_icon} {finding.get('title', '')}")
            if finding.get("executive_summary"):
                lines.append(f"   {finding['executive_summary']}")

        if synthesis.management_questions:
            lines.extend([
                "",
                "─" * 40,
                f"QUESTIONS FOR MANAGEMENT ({len(synthesis.management_questions)})",
                "─" * 40,
            ])
            for q in synthesis.management_questions[:5]:
                lines.append(f"\n{q.get('rank', '?')}. {q.get('question', '')}")
                lines.append(f"   Why: {q.get('why_important', '')}")

        if synthesis.document_requests:
            lines.extend([
                "",
                "─" * 40,
                "DOCUMENT REQUESTS",
                "─" * 40,
            ])
            for doc in synthesis.document_requests[:5]:
                lines.append(f"  • {doc}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
