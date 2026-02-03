"""Core data models for agent outputs."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class Finding:
    """A discovery or insight from analysis."""

    category: str  # revenue, expense, risk, compliance, opportunity, info
    severity: str  # critical, high, medium, low, info
    title: str
    detail: str
    evidence: List[str] = field(default_factory=list)  # file:line refs
    metrics: Dict[str, Any] = field(default_factory=dict)
    source_agent: str = ""
    id: str = field(default_factory=lambda: str(uuid4())[:8])
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "evidence": self.evidence,
            "metrics": self.metrics,
            "source_agent": self.source_agent,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Finding":
        data = data.copy()
        if "timestamp" in data and isinstance(data["timestamp"], str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)


@dataclass
class Gap:
    """Missing data or unresolved question blocking analysis."""

    description: str
    data_needed: str
    blocking: bool = False
    suggested_source: str = ""
    source_agent: str = ""
    resolved: bool = False
    resolution: str = ""
    id: str = field(default_factory=lambda: str(uuid4())[:8])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "data_needed": self.data_needed,
            "blocking": self.blocking,
            "suggested_source": self.suggested_source,
            "source_agent": self.source_agent,
            "resolved": self.resolved,
            "resolution": self.resolution,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Gap":
        return cls(**data)


@dataclass
class Question:
    """Question for the user, batched for later answering."""

    question: str
    context: str
    priority: str = "important"  # blocking, important, nice_to_have
    options: Optional[List[str]] = None
    source_agent: str = ""
    answered: bool = False
    answer: Optional[str] = None
    id: str = field(default_factory=lambda: str(uuid4())[:8])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "question": self.question,
            "context": self.context,
            "priority": self.priority,
            "options": self.options,
            "source_agent": self.source_agent,
            "answered": self.answered,
            "answer": self.answer,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Question":
        return cls(**data)


@dataclass
class AgentSuggestion:
    """Suggestion for another agent to run."""

    agent_type: str
    reason: str
    target: str = ""  # Specific focus area
    priority: str = "normal"  # high, normal, low
    source_agent: str = ""

    def to_dict(self) -> dict:
        return {
            "agent_type": self.agent_type,
            "reason": self.reason,
            "target": self.target,
            "priority": self.priority,
            "source_agent": self.source_agent,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentSuggestion":
        return cls(**data)


@dataclass
class AgentResult:
    """Standard output from any agent."""

    agent_name: str
    findings: List[Finding] = field(default_factory=list)
    gaps: List[Gap] = field(default_factory=list)
    questions: List[Question] = field(default_factory=list)
    suggested_agents: List[AgentSuggestion] = field(default_factory=list)
    confidence: float = 0.0
    outputs: List[str] = field(default_factory=list)  # Files created
    timestamp: datetime = field(default_factory=datetime.now)
    duration_seconds: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "agent_name": self.agent_name,
            "findings": [f.to_dict() for f in self.findings],
            "gaps": [g.to_dict() for g in self.gaps],
            "questions": [q.to_dict() for q in self.questions],
            "suggested_agents": [s.to_dict() for s in self.suggested_agents],
            "confidence": self.confidence,
            "outputs": self.outputs,
            "timestamp": self.timestamp.isoformat(),
            "duration_seconds": self.duration_seconds,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentResult":
        data = data.copy()
        data["findings"] = [Finding.from_dict(f) for f in data.get("findings", [])]
        data["gaps"] = [Gap.from_dict(g) for g in data.get("gaps", [])]
        data["questions"] = [Question.from_dict(q) for q in data.get("questions", [])]
        data["suggested_agents"] = [
            AgentSuggestion.from_dict(s) for s in data.get("suggested_agents", [])
        ]
        if "timestamp" in data and isinstance(data["timestamp"], str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)

    @property
    def success(self) -> bool:
        return self.error is None
