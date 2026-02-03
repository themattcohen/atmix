"""Quality validation system for the LLM-first audit workflow.

Provides both automated checks and LLM-powered verification.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from rich.console import Console

console = Console()


@dataclass
class ValidationCheck:
    """A single validation check."""

    name: str
    passed: bool
    score: float
    details: str
    issues: List[str] = field(default_factory=list)
    is_critical: bool = False


@dataclass
class ValidationReport:
    """Complete validation report."""

    checks: List[ValidationCheck]
    contradictions: List[Dict[str, Any]]
    gaps: List[str]
    overall_passed: bool
    overall_score: float
    critical_issues: List[str]
    recommendations: List[str]

    def to_dict(self) -> dict:
        return {
            "checks": [
                {
                    "name": c.name,
                    "passed": c.passed,
                    "score": c.score,
                    "details": c.details,
                    "issues": c.issues,
                    "is_critical": c.is_critical,
                }
                for c in self.checks
            ],
            "contradictions": self.contradictions,
            "gaps": self.gaps,
            "overall_passed": self.overall_passed,
            "overall_score": self.overall_score,
            "critical_issues": self.critical_issues,
            "recommendations": self.recommendations,
        }


class QualityValidator:
    """Validates analysis output quality."""

    # Minimum thresholds
    MIN_FINDINGS = 10
    MIN_COVERAGE_SCORE = 0.6
    MIN_SOURCE_CITATION_RATE = 0.8
    CRITICAL_CHECK_THRESHOLD = 0.5

    # Required coverage areas
    REQUIRED_AREAS = ["profitability", "liquidity", "risk"]

    def __init__(self):
        self.checks: List[ValidationCheck] = []

    def validate(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
        completed_analyses: Optional[List[str]] = None,
        business_type: Optional[str] = None,
    ) -> ValidationReport:
        """Run all validation checks.

        Args:
            findings: The findings to validate
            available_data: List of available data files
            completed_analyses: List of analyses that were completed
            business_type: Type of business being audited

        Returns:
            Complete validation report
        """
        self.checks = []
        contradictions = []
        gaps = []
        critical_issues = []
        recommendations = []

        # Run all checks
        self._check_findings_count(findings)
        self._check_source_citations(findings)
        self._check_severity_distribution(findings)
        self._check_category_coverage(findings, available_data)
        self._check_pl_analysis(findings, available_data)
        self._check_balance_sheet_analysis(findings, available_data)
        self._check_cash_flow_analysis(findings, available_data)
        self._check_liquidity_metrics(findings)
        self._check_profitability_metrics(findings)
        self._check_finding_quality(findings)

        # Detect contradictions
        contradictions = self._detect_contradictions(findings)

        # Identify gaps
        gaps = self._identify_gaps(findings, available_data, completed_analyses)

        # Calculate overall
        critical_checks = [c for c in self.checks if c.is_critical]
        critical_passed = all(c.passed for c in critical_checks)

        total_score = sum(c.score for c in self.checks) / len(self.checks) if self.checks else 0
        all_passed = all(c.passed for c in self.checks)

        # Overall passes if critical checks pass and score is above threshold
        overall_passed = critical_passed and total_score >= self.MIN_COVERAGE_SCORE

        # Collect critical issues
        for c in self.checks:
            if c.is_critical and not c.passed:
                critical_issues.append(f"{c.name}: {c.details}")
            for issue in c.issues:
                if c.is_critical:
                    critical_issues.append(issue)

        # Generate recommendations
        recommendations = self._generate_recommendations()

        return ValidationReport(
            checks=self.checks,
            contradictions=contradictions,
            gaps=gaps,
            overall_passed=overall_passed,
            overall_score=total_score,
            critical_issues=critical_issues,
            recommendations=recommendations,
        )

    def _check_findings_count(self, findings: List[Dict[str, Any]]) -> None:
        """Check minimum findings count."""
        count = len(findings)
        passed = count >= self.MIN_FINDINGS
        score = min(count / self.MIN_FINDINGS, 1.0)

        self.checks.append(ValidationCheck(
            name="Minimum Findings Count",
            passed=passed,
            score=score,
            details=f"{count} findings (minimum: {self.MIN_FINDINGS})",
            issues=[] if passed else [f"Only {count} findings - need at least {self.MIN_FINDINGS}"],
            is_critical=True,
        ))

    def _check_source_citations(self, findings: List[Dict[str, Any]]) -> None:
        """Check that findings have source citations."""
        with_sources = 0
        without_sources = []

        for f in findings:
            has_source = any([
                f.get("source_citation"),
                f.get("source_file"),
                f.get("source_reference"),
                f.get("evidence"),
            ])
            if has_source:
                with_sources += 1
            else:
                without_sources.append(f.get("title", "Unknown")[:50])

        rate = with_sources / len(findings) if findings else 0
        passed = rate >= self.MIN_SOURCE_CITATION_RATE

        self.checks.append(ValidationCheck(
            name="Source Citations",
            passed=passed,
            score=rate,
            details=f"{with_sources}/{len(findings)} findings have sources ({rate:.0%})",
            issues=without_sources[:5] if not passed else [],
            is_critical=True,
        ))

    def _check_severity_distribution(self, findings: List[Dict[str, Any]]) -> None:
        """Check severity distribution is reasonable."""
        severity_counts = {}
        for f in findings:
            sev = f.get("severity", "unknown")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        # Check for reasonable distribution
        critical_high = severity_counts.get("critical", 0) + severity_counts.get("high", 0)
        total = len(findings)

        # Should have at least some higher severity findings
        has_high_severity = critical_high > 0

        # Shouldn't be all critical (suspicious)
        not_all_critical = severity_counts.get("critical", 0) < total * 0.5

        passed = has_high_severity and not_all_critical
        score = 1.0 if passed else 0.5

        issues = []
        if not has_high_severity:
            issues.append("No critical or high severity findings - may be missing important issues")
        if not not_all_critical:
            issues.append("Too many critical findings - check severity ratings")

        self.checks.append(ValidationCheck(
            name="Severity Distribution",
            passed=passed,
            score=score,
            details=str(severity_counts),
            issues=issues,
            is_critical=False,
        ))

    def _check_category_coverage(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> None:
        """Check category coverage."""
        categories = set()
        for f in findings:
            cat = f.get("category", "")
            if cat:
                categories.add(cat.lower())

        # Map categories to coverage areas
        area_mapping = {
            "profitability": ["revenue", "expense", "margin", "income", "profitability"],
            "liquidity": ["liquidity", "cash", "working_capital"],
            "risk": ["risk", "compliance", "data_quality"],
        }

        covered_areas = set()
        for area, keywords in area_mapping.items():
            for cat in categories:
                if any(kw in cat for kw in keywords):
                    covered_areas.add(area)
                    break

        coverage_rate = len(covered_areas) / len(self.REQUIRED_AREAS)
        missing = set(self.REQUIRED_AREAS) - covered_areas

        passed = coverage_rate >= 0.66  # At least 2 of 3

        self.checks.append(ValidationCheck(
            name="Coverage Areas",
            passed=passed,
            score=coverage_rate,
            details=f"Covered: {covered_areas}, Missing: {missing}",
            issues=[f"Missing coverage for: {area}" for area in missing] if missing else [],
            is_critical=True,
        ))

    def _check_pl_analysis(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> None:
        """Check P&L analysis if P&L data is present."""
        has_pl = any("pl" in d.lower() or "income" in d.lower() for d in available_data)

        if not has_pl:
            return  # Skip if no P&L data

        # Look for P&L-related findings
        pl_keywords = ["revenue", "income", "margin", "profit", "expense", "cogs"]
        has_pl_findings = any(
            any(kw in f.get("title", "").lower() or kw in f.get("category", "").lower() for kw in pl_keywords)
            for f in findings
        )

        self.checks.append(ValidationCheck(
            name="P&L Analysis",
            passed=has_pl_findings,
            score=1.0 if has_pl_findings else 0.0,
            details=f"P&L data present - {'analyzed' if has_pl_findings else 'NOT analyzed'}",
            issues=[] if has_pl_findings else ["P&L data available but not analyzed"],
            is_critical=True,
        ))

    def _check_balance_sheet_analysis(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> None:
        """Check balance sheet analysis if BS data is present."""
        has_bs = any("balance" in d.lower() for d in available_data)

        if not has_bs:
            return  # Skip if no balance sheet data

        # Look for BS-related findings
        bs_keywords = ["asset", "liability", "equity", "current ratio", "liquidity", "balance"]
        has_bs_findings = any(
            any(kw in f.get("title", "").lower() or kw in f.get("detail", "").lower() for kw in bs_keywords)
            for f in findings
        )

        self.checks.append(ValidationCheck(
            name="Balance Sheet Analysis",
            passed=has_bs_findings,
            score=1.0 if has_bs_findings else 0.0,
            details=f"Balance sheet data present - {'analyzed' if has_bs_findings else 'NOT analyzed'}",
            issues=[] if has_bs_findings else ["Balance sheet data available but not analyzed"],
            is_critical=True,
        ))

    def _check_cash_flow_analysis(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> None:
        """Check cash flow analysis if cash data is present."""
        has_cash = any(
            "cash" in d.lower() or "bank" in d.lower()
            for d in available_data
        )

        if not has_cash:
            return  # Skip if no cash data

        # Look for cash-related findings
        cash_keywords = ["cash", "runway", "burn", "flow", "liquidity"]
        has_cash_findings = any(
            any(kw in f.get("title", "").lower() or kw in f.get("detail", "").lower() for kw in cash_keywords)
            for f in findings
        )

        self.checks.append(ValidationCheck(
            name="Cash Flow Analysis",
            passed=has_cash_findings,
            score=1.0 if has_cash_findings else 0.0,
            details=f"Cash data present - {'analyzed' if has_cash_findings else 'NOT analyzed'}",
            issues=[] if has_cash_findings else ["Cash data available but not analyzed"],
            is_critical=False,
        ))

    def _check_liquidity_metrics(self, findings: List[Dict[str, Any]]) -> None:
        """Check for key liquidity metrics."""
        liquidity_metrics = ["current_ratio", "quick_ratio", "runway", "cash"]

        found_metrics = set()
        for f in findings:
            metrics = f.get("metrics", {})
            for m in liquidity_metrics:
                if m in metrics or m in f.get("title", "").lower():
                    found_metrics.add(m)

        # Also check in title/detail
        for f in findings:
            for m in liquidity_metrics:
                if m.replace("_", " ") in f.get("title", "").lower():
                    found_metrics.add(m)
                if m.replace("_", " ") in f.get("detail", "").lower():
                    found_metrics.add(m)

        coverage = len(found_metrics) / len(liquidity_metrics)
        passed = coverage >= 0.5  # At least half

        self.checks.append(ValidationCheck(
            name="Liquidity Metrics",
            passed=passed,
            score=coverage,
            details=f"Found: {found_metrics}",
            issues=[f"Missing: {set(liquidity_metrics) - found_metrics}"] if not passed else [],
            is_critical=False,
        ))

    def _check_profitability_metrics(self, findings: List[Dict[str, Any]]) -> None:
        """Check for key profitability metrics."""
        profitability_metrics = ["gross_margin", "net_margin", "revenue", "net_income"]

        found_metrics = set()
        for f in findings:
            metrics = f.get("metrics", {})
            for m in profitability_metrics:
                if m in metrics:
                    found_metrics.add(m)

            # Also check in title/detail
            for m in profitability_metrics:
                readable = m.replace("_", " ")
                if readable in f.get("title", "").lower() or readable in f.get("detail", "").lower():
                    found_metrics.add(m)

        coverage = len(found_metrics) / len(profitability_metrics)
        passed = coverage >= 0.5

        self.checks.append(ValidationCheck(
            name="Profitability Metrics",
            passed=passed,
            score=coverage,
            details=f"Found: {found_metrics}",
            issues=[f"Missing: {set(profitability_metrics) - found_metrics}"] if not passed else [],
            is_critical=False,
        ))

    def _check_finding_quality(self, findings: List[Dict[str, Any]]) -> None:
        """Check overall finding quality."""
        quality_issues = []

        # Check for empty details
        empty_details = sum(1 for f in findings if not f.get("detail", "").strip())
        if empty_details > 0:
            quality_issues.append(f"{empty_details} findings have empty details")

        # Check for very short details
        short_details = sum(1 for f in findings if len(f.get("detail", "")) < 50)
        if short_details > len(findings) * 0.3:
            quality_issues.append(f"{short_details} findings have very short details")

        # Check for missing business implications
        no_implications = sum(
            1 for f in findings
            if not f.get("business_implication") and "implication" not in f.get("detail", "").lower()
        )
        if no_implications > len(findings) * 0.5:
            quality_issues.append(f"{no_implications} findings lack business implications")

        passed = len(quality_issues) == 0
        score = 1.0 - (len(quality_issues) * 0.25)

        self.checks.append(ValidationCheck(
            name="Finding Quality",
            passed=passed,
            score=max(0, score),
            details=f"{len(quality_issues)} quality issues found",
            issues=quality_issues,
            is_critical=False,
        ))

    def _detect_contradictions(
        self,
        findings: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Detect contradictions between findings."""
        contradictions = []

        # Group findings by metric keys
        metric_sources: Dict[str, List[Tuple[Dict[str, Any], Any]]] = {}

        for f in findings:
            for key, value in f.get("metrics", {}).items():
                if value is None:
                    continue
                if key not in metric_sources:
                    metric_sources[key] = []
                metric_sources[key].append((f, value))

        # Check for conflicts
        for key, sources in metric_sources.items():
            if len(sources) < 2:
                continue

            for i, (f1, v1) in enumerate(sources):
                for f2, v2 in sources[i + 1:]:
                    if self._values_conflict(v1, v2):
                        contradictions.append({
                            "finding_a": f1.get("title", "Unknown"),
                            "finding_b": f2.get("title", "Unknown"),
                            "field_in_conflict": key,
                            "value_a": v1,
                            "value_b": v2,
                            "severity": "medium",
                        })

        return contradictions

    def _values_conflict(self, v1: Any, v2: Any) -> bool:
        """Check if two values conflict (differ by more than 5%)."""
        try:
            if isinstance(v1, (int, float)) and isinstance(v2, (int, float)):
                if v1 == 0 and v2 == 0:
                    return False
                if v1 == 0 or v2 == 0:
                    return True
                diff_pct = abs(v1 - v2) / max(abs(v1), abs(v2))
                return diff_pct > 0.05
            return str(v1) != str(v2)
        except Exception:
            return False

    def _identify_gaps(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
        completed_analyses: Optional[List[str]],
    ) -> List[str]:
        """Identify gaps in analysis."""
        gaps = []

        # Check for data that wasn't analyzed
        analyzed_files = set()
        for f in findings:
            if f.get("source_file"):
                analyzed_files.add(f["source_file"])
            for ev in f.get("evidence", []):
                if ":" in ev:
                    analyzed_files.add(ev.split(":")[0])

        for data_file in available_data:
            if not any(data_file.lower() in af.lower() for af in analyzed_files):
                gaps.append(f"Data file '{data_file}' may not have been analyzed")

        # Check for standard analyses
        categories = set(f.get("category", "").lower() for f in findings)

        if "vendor" not in categories and any("ap" in d.lower() or "vendor" in d.lower() for d in available_data):
            gaps.append("Vendor/AP analysis may be incomplete")

        if "ar" not in categories and any("ar" in d.lower() or "receivable" in d.lower() for d in available_data):
            gaps.append("AR/Receivables analysis may be incomplete")

        return gaps

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on checks."""
        recommendations = []

        for check in self.checks:
            if not check.passed:
                if check.name == "Minimum Findings Count":
                    recommendations.append("Run additional analysis passes to generate more findings")
                elif check.name == "Source Citations":
                    recommendations.append("Ensure all findings cite their data sources")
                elif check.name == "Coverage Areas":
                    recommendations.append("Expand analysis to cover profitability, liquidity, and risk areas")
                elif "Analysis" in check.name and not check.passed:
                    recommendations.append(f"Complete {check.name} using available data")

        return recommendations


class LLMValidator:
    """LLM-powered validation for deeper quality checks."""

    def __init__(self, client):
        """Initialize LLM validator.

        Args:
            client: Anthropic client for LLM calls
        """
        self.client = client
        self.model = "claude-sonnet-4-20250514"
        self.total_tokens = 0

    async def verify_findings_against_data(
        self,
        findings: List[Dict[str, Any]],
        data_samples: Dict[str, str],
    ) -> Dict[str, Any]:
        """Verify findings against raw data using LLM.

        Args:
            findings: Findings to verify
            data_samples: Samples of raw data

        Returns:
            Verification results
        """
        from ..prompts.validation import ValidationPrompts

        prompt = ValidationPrompts.create_cross_reference_prompt(
            findings=findings[:10],  # Limit for token efficiency
            raw_data_samples=data_samples,
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()
            if "{" in content:
                json_str = content[content.index("{"):content.rindex("}") + 1]
                return json.loads(json_str)
        except Exception as e:
            console.print(f"[yellow]LLM verification failed: {e}[/yellow]")

        return {"error": "Verification failed"}

    async def check_quality(
        self,
        findings: List[Dict[str, Any]],
        total_before_curation: int,
    ) -> Dict[str, Any]:
        """Run LLM quality checklist.

        Args:
            findings: The curated findings
            total_before_curation: Total findings before curation

        Returns:
            Quality check results
        """
        from ..prompts.validation import ValidationPrompts

        prompt = ValidationPrompts.create_quality_checklist_prompt(
            findings=findings,
            total_findings_before_curation=total_before_curation,
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()
            if "{" in content:
                json_str = content[content.index("{"):content.rindex("}") + 1]
                return json.loads(json_str)
        except Exception as e:
            console.print(f"[yellow]LLM quality check failed: {e}[/yellow]")

        return {"error": "Quality check failed"}
