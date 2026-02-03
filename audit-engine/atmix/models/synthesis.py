"""Synthesis data models for AI-enhanced analysis output."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class ChartData:
    """Chart.js configuration data for visualizations."""

    chart_type: str  # line, bar, pie, doughnut
    title: str
    labels: List[str] = field(default_factory=list)
    datasets: List[Dict[str, Any]] = field(default_factory=list)
    options: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "chart_type": self.chart_type,
            "title": self.title,
            "labels": self.labels,
            "datasets": self.datasets,
            "options": self.options,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChartData":
        return cls(**data)


@dataclass
class MetricCard:
    """Dashboard metric card data."""

    title: str
    value: str  # Formatted value for display
    raw_value: Optional[float] = None
    change: Optional[str] = None  # e.g., "+12%" or "-$5,000"
    change_direction: Optional[str] = None  # positive, negative, neutral
    icon: Optional[str] = None  # icon identifier
    category: str = "general"  # financial, operational, risk

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "value": self.value,
            "raw_value": self.raw_value,
            "change": self.change,
            "change_direction": self.change_direction,
            "icon": self.icon,
            "category": self.category,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MetricCard":
        return cls(**data)


@dataclass
class Contradiction:
    """Tracks detected conflicts between findings and their resolutions."""

    finding_a_id: str
    finding_a_value: Any
    finding_a_source: str
    finding_b_id: str
    finding_b_value: Any
    finding_b_source: str
    field_name: str
    resolved: bool = False
    resolution: Optional[str] = None
    resolved_value: Optional[Any] = None
    keep_finding_id: Optional[str] = None
    rationale: Optional[str] = None
    id: str = field(default_factory=lambda: str(uuid4())[:8])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "finding_a_id": self.finding_a_id,
            "finding_a_value": self.finding_a_value,
            "finding_a_source": self.finding_a_source,
            "finding_b_id": self.finding_b_id,
            "finding_b_value": self.finding_b_value,
            "finding_b_source": self.finding_b_source,
            "field_name": self.field_name,
            "resolved": self.resolved,
            "resolution": self.resolution,
            "resolved_value": self.resolved_value,
            "keep_finding_id": self.keep_finding_id,
            "rationale": self.rationale,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Contradiction":
        return cls(**data)


@dataclass
class SynthesizedFinding:
    """Enhanced finding with narrative context, confidence, and chart data."""

    # Original finding reference
    original_finding_id: str
    category: str
    severity: str
    title: str
    detail: str

    # Enhanced attributes
    narrative: str = ""  # LLM-generated business context
    executive_summary: str = ""  # 1-sentence summary for executives
    trend: Optional[str] = None  # improving, declining, stable
    confidence_score: float = 0.0  # 0.0 - 1.0

    # Source attribution
    source_agents: List[str] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)
    evidence_strength: str = "medium"  # weak, medium, strong

    # Metrics and visualization
    metrics: Dict[str, Any] = field(default_factory=dict)
    chart_data: Optional[ChartData] = None

    # Ranking
    importance_score: float = 0.0  # Combined severity + category + confidence
    rank: int = 0

    id: str = field(default_factory=lambda: str(uuid4())[:8])
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "original_finding_id": self.original_finding_id,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "narrative": self.narrative,
            "executive_summary": self.executive_summary,
            "trend": self.trend,
            "confidence_score": self.confidence_score,
            "source_agents": self.source_agents,
            "source_files": self.source_files,
            "evidence_strength": self.evidence_strength,
            "metrics": self.metrics,
            "chart_data": self.chart_data.to_dict() if self.chart_data else None,
            "importance_score": self.importance_score,
            "rank": self.rank,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SynthesizedFinding":
        data = data.copy()
        if "chart_data" in data and data["chart_data"]:
            data["chart_data"] = ChartData.from_dict(data["chart_data"])
        if "timestamp" in data and isinstance(data["timestamp"], str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)


@dataclass
class PrioritizedQuestion:
    """AI-ranked question with rationale and blocking context."""

    original_question_id: str
    question: str
    context: str
    original_priority: str  # blocking, important, nice_to_have

    # AI-enhanced attributes
    priority_score: float = 0.0  # 0.0 - 1.0
    why_important: str = ""  # LLM-generated rationale
    blocking_findings: List[str] = field(default_factory=list)  # Finding IDs that depend on this answer
    suggested_answer_approach: str = ""  # How to get the answer

    # Ranking
    rank: int = 0

    id: str = field(default_factory=lambda: str(uuid4())[:8])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "original_question_id": self.original_question_id,
            "question": self.question,
            "context": self.context,
            "original_priority": self.original_priority,
            "priority_score": self.priority_score,
            "why_important": self.why_important,
            "blocking_findings": self.blocking_findings,
            "suggested_answer_approach": self.suggested_answer_approach,
            "rank": self.rank,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PrioritizedQuestion":
        return cls(**data)


@dataclass
class SynthesisOutput:
    """Complete synthesis result container."""

    company_name: str
    analysis_date: datetime = field(default_factory=datetime.now)

    # Executive narrative
    executive_narrative: str = ""  # 1-2 paragraph professional summary

    # Curated findings (10-15 most important)
    curated_findings: List[SynthesizedFinding] = field(default_factory=list)

    # All synthesized findings (full set)
    all_findings: List[SynthesizedFinding] = field(default_factory=list)

    # Contradictions detected and resolved
    contradictions: List[Contradiction] = field(default_factory=list)

    # Dashboard components
    metric_cards: List[MetricCard] = field(default_factory=list)
    charts: List[ChartData] = field(default_factory=list)

    # Prioritized questions
    prioritized_questions: List[PrioritizedQuestion] = field(default_factory=list)

    # Metadata
    total_findings_analyzed: int = 0
    total_agents_contributed: int = 0
    synthesis_confidence: float = 0.0
    synthesis_duration_seconds: float = 0.0
    llm_tokens_used: int = 0

    # Errors/warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "company_name": self.company_name,
            "analysis_date": self.analysis_date.isoformat(),
            "executive_narrative": self.executive_narrative,
            "curated_findings": [f.to_dict() for f in self.curated_findings],
            "all_findings": [f.to_dict() for f in self.all_findings],
            "contradictions": [c.to_dict() for c in self.contradictions],
            "metric_cards": [m.to_dict() for m in self.metric_cards],
            "charts": [c.to_dict() for c in self.charts],
            "prioritized_questions": [q.to_dict() for q in self.prioritized_questions],
            "total_findings_analyzed": self.total_findings_analyzed,
            "total_agents_contributed": self.total_agents_contributed,
            "synthesis_confidence": self.synthesis_confidence,
            "synthesis_duration_seconds": self.synthesis_duration_seconds,
            "llm_tokens_used": self.llm_tokens_used,
            "errors": self.errors,
            "warnings": self.warnings,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SynthesisOutput":
        data = data.copy()
        if "analysis_date" in data and isinstance(data["analysis_date"], str):
            data["analysis_date"] = datetime.fromisoformat(data["analysis_date"])
        data["curated_findings"] = [
            SynthesizedFinding.from_dict(f) for f in data.get("curated_findings", [])
        ]
        data["all_findings"] = [
            SynthesizedFinding.from_dict(f) for f in data.get("all_findings", [])
        ]
        data["contradictions"] = [
            Contradiction.from_dict(c) for c in data.get("contradictions", [])
        ]
        data["metric_cards"] = [
            MetricCard.from_dict(m) for m in data.get("metric_cards", [])
        ]
        data["charts"] = [
            ChartData.from_dict(c) for c in data.get("charts", [])
        ]
        data["prioritized_questions"] = [
            PrioritizedQuestion.from_dict(q) for q in data.get("prioritized_questions", [])
        ]
        return cls(**data)
