"""Session state and checkpoint models."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .findings import Finding, Gap, Question, AgentSuggestion


@dataclass
class PhaseRecord:
    """Record of a completed phase."""

    phase: str
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    result: str  # success, partial, failed

    def to_dict(self) -> dict:
        return {
            "phase": self.phase,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_seconds": self.duration_seconds,
            "result": self.result,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PhaseRecord":
        data = data.copy()
        data["started_at"] = datetime.fromisoformat(data["started_at"])
        data["completed_at"] = datetime.fromisoformat(data["completed_at"])
        return cls(**data)


@dataclass
class SessionState:
    """Complete state of an audit session."""

    company_slug: str
    workspace_path: str
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Phase tracking
    current_phase: str = "init"  # init, intake, integrity, analysis, synthesis, complete
    phase_history: List[PhaseRecord] = field(default_factory=list)

    # Agent tracking
    agents_completed: List[str] = field(default_factory=list)
    agents_pending: List[str] = field(default_factory=list)
    agents_failed: List[str] = field(default_factory=list)
    agent_results: Dict[str, dict] = field(default_factory=dict)  # agent_name -> result

    # Accumulated data
    findings: List[Finding] = field(default_factory=list)
    gaps: List[Gap] = field(default_factory=list)
    questions: List[Question] = field(default_factory=list)
    suggested_agents: List[AgentSuggestion] = field(default_factory=list)

    # File inventory
    input_files: Dict[str, str] = field(default_factory=dict)  # type -> path
    cleaned_files: Dict[str, str] = field(default_factory=dict)
    derived_files: Dict[str, str] = field(default_factory=dict)

    # Control
    iteration: int = 0
    confidence: float = 0.0
    analysis_complete: bool = False

    # Integrity gate results
    books_reliable: Optional[bool] = None
    accounting_basis: Optional[str] = None  # cash, accrual, unknown
    entity_structure: Optional[str] = None

    # Checkpoint tracking
    last_checkpoint_id: str = ""
    checkpoint_count: int = 0

    def to_dict(self) -> dict:
        return {
            "company_slug": self.company_slug,
            "workspace_path": self.workspace_path,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "current_phase": self.current_phase,
            "phase_history": [p.to_dict() for p in self.phase_history],
            "agents_completed": self.agents_completed,
            "agents_pending": self.agents_pending,
            "agents_failed": self.agents_failed,
            "agent_results": self.agent_results,
            "findings": [f.to_dict() for f in self.findings],
            "gaps": [g.to_dict() for g in self.gaps],
            "questions": [q.to_dict() for q in self.questions],
            "suggested_agents": [s.to_dict() for s in self.suggested_agents],
            "input_files": self.input_files,
            "cleaned_files": self.cleaned_files,
            "derived_files": self.derived_files,
            "iteration": self.iteration,
            "confidence": self.confidence,
            "analysis_complete": self.analysis_complete,
            "books_reliable": self.books_reliable,
            "accounting_basis": self.accounting_basis,
            "entity_structure": self.entity_structure,
            "last_checkpoint_id": self.last_checkpoint_id,
            "checkpoint_count": self.checkpoint_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SessionState":
        data = data.copy()
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        data["phase_history"] = [
            PhaseRecord.from_dict(p) for p in data.get("phase_history", [])
        ]
        data["findings"] = [Finding.from_dict(f) for f in data.get("findings", [])]
        data["gaps"] = [Gap.from_dict(g) for g in data.get("gaps", [])]
        data["questions"] = [Question.from_dict(q) for q in data.get("questions", [])]
        data["suggested_agents"] = [
            AgentSuggestion.from_dict(s) for s in data.get("suggested_agents", [])
        ]
        return cls(**data)

    def add_finding(self, finding: Finding) -> None:
        self.findings.append(finding)
        self.updated_at = datetime.now()

    def add_gap(self, gap: Gap) -> None:
        self.gaps.append(gap)
        self.updated_at = datetime.now()

    def add_question(self, question: Question) -> None:
        self.questions.append(question)
        self.updated_at = datetime.now()

    def suggest_agent(self, suggestion: AgentSuggestion) -> None:
        # Avoid duplicates
        existing = {s.agent_type for s in self.suggested_agents}
        if suggestion.agent_type not in existing:
            self.suggested_agents.append(suggestion)
            self.updated_at = datetime.now()

    def mark_agent_complete(self, agent_name: str, result: dict) -> None:
        if agent_name in self.agents_pending:
            self.agents_pending.remove(agent_name)
        if agent_name not in self.agents_completed:
            self.agents_completed.append(agent_name)
        self.agent_results[agent_name] = result
        self.updated_at = datetime.now()

    def mark_agent_failed(self, agent_name: str, error: str) -> None:
        if agent_name in self.agents_pending:
            self.agents_pending.remove(agent_name)
        if agent_name not in self.agents_failed:
            self.agents_failed.append(agent_name)
        self.agent_results[agent_name] = {"error": error}
        self.updated_at = datetime.now()

    def unresolved_gaps(self) -> List[Gap]:
        return [g for g in self.gaps if not g.resolved]

    def blocking_gaps(self) -> List[Gap]:
        return [g for g in self.gaps if g.blocking and not g.resolved]

    def unanswered_questions(self) -> List[Question]:
        return [q for q in self.questions if not q.answered]

    def calculate_confidence(self) -> float:
        """Calculate overall analysis confidence."""
        if not self.findings:
            return 0.0

        # Factors that reduce confidence
        unresolved = len(self.unresolved_gaps())
        blocking = len(self.blocking_gaps())
        unanswered = len(self.unanswered_questions())

        # Start at 1.0, reduce based on issues
        confidence = 1.0
        confidence -= blocking * 0.15  # Blocking gaps hurt most
        confidence -= unresolved * 0.05  # Regular gaps
        confidence -= unanswered * 0.02  # Unanswered questions

        # Boost from findings
        confidence = min(confidence, 0.5 + len(self.findings) * 0.02)

        return max(0.0, min(1.0, confidence))


@dataclass
class CheckpointData:
    """Snapshot of session state for crash recovery."""

    checkpoint_id: str
    timestamp: datetime
    session_state: dict  # Serialized SessionState
    resume_point: str  # Phase to resume from
    resume_context: dict  # Additional context for resumption

    def to_dict(self) -> dict:
        return {
            "checkpoint_id": self.checkpoint_id,
            "timestamp": self.timestamp.isoformat(),
            "session_state": self.session_state,
            "resume_point": self.resume_point,
            "resume_context": self.resume_context,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CheckpointData":
        data = data.copy()
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)
