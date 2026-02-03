"""LLM prompts for the validation phase - quality checks and verification."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ValidationResult:
    """Result from validation checks."""

    passed: bool
    checks: List[Dict[str, Any]]
    contradictions: List[Dict[str, Any]]
    gaps: List[str]
    recommendations: List[str]
    confidence: float

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "checks": self.checks,
            "contradictions": self.contradictions,
            "gaps": self.gaps,
            "recommendations": self.recommendations,
            "confidence": self.confidence,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ValidationResult":
        return cls(**data)


class ValidationPrompts:
    """Prompts for LLM-driven quality validation."""

    @staticmethod
    def create_cross_reference_prompt(
        findings: List[Dict[str, Any]],
        raw_data_samples: Dict[str, str],
    ) -> str:
        """Create prompt for cross-referencing findings against raw data.

        Args:
            findings: Findings to verify
            raw_data_samples: Samples of raw data for verification

        Returns:
            The cross-reference prompt
        """
        import json

        data_section = "\n\n".join(
            f"### {name}\n```csv\n{sample}\n```"
            for name, sample in raw_data_samples.items()
        )

        return f"""You are a senior auditor performing quality verification on financial analysis findings.

## Findings to Verify

```json
{json.dumps(findings, indent=2)}
```

## Raw Data for Verification

{data_section}

## Your Task

Verify each finding against the raw data. Check that:
1. The source citation is accurate
2. The raw value matches what's in the data
3. The calculation (if any) is correct
4. The conclusion is supported by the evidence

## Output Format

Respond with a JSON object:

```json
{{
  "verified_findings": [
    {{
      "finding_id": "id or title of finding",
      "verified": true,
      "verification_notes": "What was checked and confirmed",
      "data_match": true,
      "calculation_correct": true
    }}
  ],
  "failed_verifications": [
    {{
      "finding_id": "id or title of finding",
      "verified": false,
      "issue": "What's wrong with this finding",
      "expected_value": "What the data actually shows",
      "recommendation": "How to fix or reanalyze"
    }}
  ],
  "unverifiable_findings": [
    {{
      "finding_id": "id or title of finding",
      "reason": "Why this couldn't be verified from available data"
    }}
  ],
  "overall_verification_rate": 0.85,
  "verification_summary": "Summary of verification results"
}}
```

## Verification Guidelines

1. **Be Precise**: Check exact values, not approximations
2. **Note Calculations**: If finding involves math, verify the calculation
3. **Flag Discrepancies**: Any mismatch should be flagged
4. **Document Sources**: Note exactly where in the data you found verification

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_contradiction_detection_prompt(
        findings: List[Dict[str, Any]],
    ) -> str:
        """Create prompt for detecting contradictions between findings.

        Args:
            findings: All findings to check for contradictions

        Returns:
            The contradiction detection prompt
        """
        import json

        return f"""You are a senior auditor checking for contradictions in financial analysis findings.

## All Findings

```json
{json.dumps(findings, indent=2)}
```

## Your Task

Identify any contradictions or inconsistencies between findings. Look for:
1. Conflicting values for the same metric
2. Contradictory conclusions about the same topic
3. Findings that can't both be true
4. Inconsistent trends or assessments

## Output Format

Respond with a JSON object:

```json
{{
  "contradictions": [
    {{
      "finding_a": "Title or ID of first finding",
      "finding_b": "Title or ID of second finding",
      "field_in_conflict": "What specific value or conclusion conflicts",
      "value_a": "Value from finding A",
      "value_b": "Value from finding B",
      "severity": "high|medium|low",
      "resolution_suggestion": "How to resolve this contradiction"
    }}
  ],
  "potential_inconsistencies": [
    {{
      "findings_involved": ["Finding 1", "Finding 2"],
      "inconsistency": "Description of the inconsistency",
      "severity": "high|medium|low",
      "investigation_needed": "What needs to be checked"
    }}
  ],
  "has_critical_contradictions": false,
  "summary": "Overall assessment of finding consistency"
}}
```

## Contradiction Severity

- **High**: Conflicting values that materially affect conclusions
- **Medium**: Inconsistencies that should be resolved
- **Low**: Minor discrepancies that don't affect overall findings

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_gap_analysis_prompt(
        completed_analyses: List[str],
        curated_findings: List[Dict[str, Any]],
        available_data: List[str],
        business_type: str,
    ) -> str:
        """Create prompt for identifying gaps in analysis coverage.

        Args:
            completed_analyses: List of analyses that were completed
            curated_findings: The curated findings
            available_data: List of available data files
            business_type: Type of business being audited

        Returns:
            The gap analysis prompt
        """
        import json

        return f"""You are a senior auditor reviewing a financial audit for completeness.

## Business Type

{business_type}

## Analyses Completed

{chr(10).join(f"- {a}" for a in completed_analyses)}

## Available Data Files

{chr(10).join(f"- {d}" for d in available_data)}

## Curated Findings

```json
{json.dumps(curated_findings, indent=2)}
```

## Your Task

Identify any gaps in the analysis coverage. Consider:
1. Standard audit areas that weren't covered
2. Data that was available but not analyzed
3. Business-type-specific analyses that are missing
4. Follow-up analyses suggested by findings but not performed

## Output Format

Respond with a JSON object:

```json
{{
  "coverage_assessment": {{
    "profitability": {{"covered": true, "confidence": 0.9}},
    "liquidity": {{"covered": true, "confidence": 0.8}},
    "efficiency": {{"covered": false, "reason": "No efficiency analysis performed"}},
    "risk": {{"covered": true, "confidence": 0.85}},
    "compliance": {{"covered": false, "reason": "reason"}},
    "strategic": {{"covered": true, "confidence": 0.7}}
  }},
  "missing_analyses": [
    {{
      "analysis": "Name of missing analysis",
      "importance": "high|medium|low",
      "available_data": ["data files that could support this"],
      "impact": "What we're missing by not doing this"
    }}
  ],
  "underexplored_areas": [
    {{
      "area": "Area that needs more depth",
      "current_coverage": "What was covered",
      "suggested_additional": "What else should be analyzed"
    }}
  ],
  "unused_data": [
    {{
      "file": "filename.csv",
      "potential_use": "What analysis this could support"
    }}
  ],
  "overall_coverage_score": 0.85,
  "critical_gaps": [
    "Gap that must be addressed before finalizing"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}}
```

## Coverage Guidelines

For a {business_type} business, ensure coverage of:
- Revenue and profitability analysis
- Cash flow and liquidity assessment
- Balance sheet analysis
- Expense and cost analysis
- Risk identification
- Compliance review (if applicable)

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def create_quality_checklist_prompt(
        findings: List[Dict[str, Any]],
        total_findings_before_curation: int,
    ) -> str:
        """Create prompt for running quality checklist on findings.

        Args:
            findings: The curated findings
            total_findings_before_curation: Total findings before curation

        Returns:
            The quality checklist prompt
        """
        import json

        return f"""You are a quality assurance auditor reviewing the output of a financial audit.

## Curated Findings ({len(findings)} from {total_findings_before_curation} total)

```json
{json.dumps(findings, indent=2)}
```

## Quality Checklist

Evaluate the findings against these criteria:

1. **Source Citations**: Does every finding cite its data source?
2. **Evidence Quality**: Are findings supported by data, not assumptions?
3. **Severity Appropriateness**: Are severity levels justified?
4. **Business Relevance**: Do findings have clear business implications?
5. **Actionability**: Do findings lead to specific actions?
6. **Coverage**: Are key financial areas represented?
7. **Consistency**: Are findings internally consistent?
8. **Clarity**: Are findings clearly written and understandable?

## Output Format

Respond with a JSON object:

```json
{{
  "quality_checks": [
    {{
      "check": "Source Citations",
      "passed": true,
      "score": 0.95,
      "issues": ["Any issues found"]
    }},
    {{
      "check": "Evidence Quality",
      "passed": true,
      "score": 0.90,
      "issues": []
    }},
    {{
      "check": "Severity Appropriateness",
      "passed": true,
      "score": 0.85,
      "issues": ["Finding X may be over-rated"]
    }},
    {{
      "check": "Business Relevance",
      "passed": true,
      "score": 0.95,
      "issues": []
    }},
    {{
      "check": "Actionability",
      "passed": true,
      "score": 0.80,
      "issues": ["Some findings lack clear next steps"]
    }},
    {{
      "check": "Coverage",
      "passed": true,
      "score": 0.90,
      "issues": []
    }},
    {{
      "check": "Consistency",
      "passed": true,
      "score": 0.95,
      "issues": []
    }},
    {{
      "check": "Clarity",
      "passed": true,
      "score": 0.90,
      "issues": []
    }}
  ],
  "overall_quality_score": 0.90,
  "passed": true,
  "critical_issues": [],
  "recommendations": [
    "Suggestion to improve quality"
  ],
  "ready_for_approval": true,
  "summary": "Overall quality assessment"
}}
```

## Quality Thresholds

- **Minimum for approval**: 0.70 overall score
- **Critical checks**: Source Citations, Evidence Quality, Consistency
- **Warning threshold**: Any check below 0.60

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def run_automated_checks(
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> Dict[str, Any]:
        """Run automated (non-LLM) quality checks.

        Args:
            findings: The findings to check
            available_data: List of available data files

        Returns:
            Dict with check results
        """
        checks = []

        # Check: Minimum findings count
        min_findings = 10
        findings_count_check = {
            "check": "Minimum Findings Count",
            "passed": len(findings) >= min_findings,
            "score": min(len(findings) / min_findings, 1.0),
            "details": f"{len(findings)} findings (minimum: {min_findings})",
        }
        checks.append(findings_count_check)

        # Check: All findings have source citations
        findings_with_sources = sum(
            1 for f in findings
            if f.get("source_citation") or f.get("source_file") or f.get("source_reference")
        )
        source_check = {
            "check": "Source Citations Present",
            "passed": findings_with_sources == len(findings),
            "score": findings_with_sources / len(findings) if findings else 0,
            "details": f"{findings_with_sources}/{len(findings)} findings have sources",
        }
        checks.append(source_check)

        # Check: Severity distribution
        severity_counts = {}
        for f in findings:
            sev = f.get("severity", "unknown")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        has_critical_or_high = severity_counts.get("critical", 0) + severity_counts.get("high", 0) > 0
        severity_check = {
            "check": "Severity Distribution",
            "passed": True,  # Always passes, just informational
            "score": 1.0,
            "details": str(severity_counts),
        }
        checks.append(severity_check)

        # Check: Category coverage
        categories = set(f.get("category", "unknown") for f in findings)
        required_categories = {"revenue", "expense", "risk", "liquidity"}
        covered = required_categories.intersection(categories)
        coverage_check = {
            "check": "Category Coverage",
            "passed": len(covered) >= 2,
            "score": len(covered) / len(required_categories),
            "details": f"Covered: {covered}, Required: {required_categories}",
        }
        checks.append(coverage_check)

        # Check: P&L analysis if P&L data present
        has_pl = any("pl" in d.lower() for d in available_data)
        has_pl_findings = any(
            "revenue" in f.get("category", "") or "margin" in f.get("category", "") or "income" in f.get("title", "").lower()
            for f in findings
        )
        if has_pl:
            pl_check = {
                "check": "P&L Analysis",
                "passed": has_pl_findings,
                "score": 1.0 if has_pl_findings else 0.0,
                "details": "P&L data present" + (" - analyzed" if has_pl_findings else " - NOT analyzed"),
            }
            checks.append(pl_check)

        # Check: Balance sheet analysis if BS data present
        has_bs = any("balance" in d.lower() for d in available_data)
        has_bs_findings = any(
            "liquidity" in f.get("category", "") or "asset" in f.get("title", "").lower() or "equity" in f.get("title", "").lower()
            for f in findings
        )
        if has_bs:
            bs_check = {
                "check": "Balance Sheet Analysis",
                "passed": has_bs_findings,
                "score": 1.0 if has_bs_findings else 0.0,
                "details": "Balance sheet data present" + (" - analyzed" if has_bs_findings else " - NOT analyzed"),
            }
            checks.append(bs_check)

        # Calculate overall
        passed_checks = sum(1 for c in checks if c["passed"])
        overall_passed = passed_checks >= len(checks) * 0.7

        return {
            "checks": checks,
            "passed_count": passed_checks,
            "total_count": len(checks),
            "overall_passed": overall_passed,
            "overall_score": passed_checks / len(checks) if checks else 0,
        }

    @staticmethod
    def format_validation_for_display(validation: ValidationResult) -> str:
        """Format validation results for user-friendly display.

        Args:
            validation: The ValidationResult to format

        Returns:
            Formatted string for terminal display
        """
        lines = [
            "=" * 60,
            "QUALITY VALIDATION",
            "=" * 60,
            "",
            f"Overall: {'✅ PASSED' if validation.passed else '❌ FAILED'}",
            f"Confidence: {validation.confidence:.0%}",
            "",
            "─" * 40,
            "CHECKS",
            "─" * 40,
        ]

        for check in validation.checks:
            status = "✅" if check.get("passed", False) else "❌"
            score = check.get("score", 0)
            lines.append(f"{status} {check['check']}: {score:.0%}")
            if check.get("issues"):
                for issue in check["issues"][:2]:
                    lines.append(f"   ⚠️  {issue}")

        if validation.contradictions:
            lines.extend([
                "",
                "─" * 40,
                f"CONTRADICTIONS ({len(validation.contradictions)})",
                "─" * 40,
            ])
            for c in validation.contradictions[:5]:
                lines.append(f"⚡ {c.get('finding_a', '?')} vs {c.get('finding_b', '?')}")
                lines.append(f"   {c.get('field_in_conflict', 'Unknown field')}")

        if validation.gaps:
            lines.extend([
                "",
                "─" * 40,
                f"GAPS ({len(validation.gaps)})",
                "─" * 40,
            ])
            for gap in validation.gaps[:5]:
                lines.append(f"  ⚠️  {gap}")

        if validation.recommendations:
            lines.extend([
                "",
                "─" * 40,
                "RECOMMENDATIONS",
                "─" * 40,
            ])
            for rec in validation.recommendations[:5]:
                lines.append(f"  → {rec}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
