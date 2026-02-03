"""Base agent protocol and analysis context."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models.findings import AgentResult, Finding, Gap, Question, AgentSuggestion
from ..models.state import SessionState


@dataclass
class AnalysisContext:
    """Context provided to agents for analysis."""

    workspace: Path
    session_state: SessionState

    # Available data files
    input_files: Dict[str, str] = field(default_factory=dict)
    cleaned_files: Dict[str, str] = field(default_factory=dict)
    derived_files: Dict[str, str] = field(default_factory=dict)

    # Accumulated knowledge from other agents
    findings: List[Finding] = field(default_factory=list)
    gaps: List[Gap] = field(default_factory=list)

    def has_file_type(self, file_type: str) -> bool:
        """Check if a file type is available."""
        return (
            file_type in self.input_files
            or file_type in self.cleaned_files
            or file_type in self.derived_files
        )

    def get_file(self, file_type: str) -> Optional[Path]:
        """Get path to a file by type."""
        if file_type in self.cleaned_files:
            return Path(self.cleaned_files[file_type])
        if file_type in self.input_files:
            return Path(self.input_files[file_type])
        if file_type in self.derived_files:
            return Path(self.derived_files[file_type])
        return None

    def get_input_path(self) -> Path:
        return self.workspace / "input"

    def get_cleaned_path(self) -> Path:
        return self.workspace / "cleaned"

    def get_derived_path(self) -> Path:
        return self.workspace / "derived"

    def get_output_path(self) -> Path:
        return self.workspace / "output"


class BaseAgent(ABC):
    """Base class for all analysis agents."""

    name: str = "base_agent"
    description: str = "Base agent"
    required_inputs: List[str] = []

    def can_run(self, context: AnalysisContext) -> bool:
        """Check if agent has required inputs to run."""
        if not self.required_inputs:
            return True
        return all(context.has_file_type(req) for req in self.required_inputs)

    @abstractmethod
    async def analyze(self, context: AnalysisContext) -> AgentResult:
        """Run analysis and return results."""
        pass

    def create_result(
        self,
        findings: Optional[List[Finding]] = None,
        gaps: Optional[List[Gap]] = None,
        questions: Optional[List[Question]] = None,
        suggested_agents: Optional[List[AgentSuggestion]] = None,
        confidence: float = 0.5,
        outputs: Optional[List[str]] = None,
        error: Optional[str] = None,
    ) -> AgentResult:
        """Helper to create a result."""
        return AgentResult(
            agent_name=self.name,
            findings=findings or [],
            gaps=gaps or [],
            questions=questions or [],
            suggested_agents=suggested_agents or [],
            confidence=confidence,
            outputs=outputs or [],
            error=error,
        )

    def finding(
        self,
        category: str,
        severity: str,
        title: str,
        detail: str,
        evidence: Optional[List[str]] = None,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> Finding:
        """Helper to create a finding."""
        return Finding(
            category=category,
            severity=severity,
            title=title,
            detail=detail,
            evidence=evidence or [],
            metrics=metrics or {},
            source_agent=self.name,
        )

    def gap(
        self,
        description: str,
        data_needed: str,
        blocking: bool = False,
        suggested_source: str = "",
    ) -> Gap:
        """Helper to create a gap."""
        return Gap(
            description=description,
            data_needed=data_needed,
            blocking=blocking,
            suggested_source=suggested_source,
            source_agent=self.name,
        )

    def question(
        self,
        question: str,
        context: str,
        priority: str = "important",
        options: Optional[List[str]] = None,
    ) -> Question:
        """Helper to create a question."""
        return Question(
            question=question,
            context=context,
            priority=priority,
            options=options,
            source_agent=self.name,
        )

    def suggest(
        self,
        agent_type: str,
        reason: str,
        target: str = "",
        priority: str = "normal",
    ) -> AgentSuggestion:
        """Helper to suggest another agent."""
        return AgentSuggestion(
            agent_type=agent_type,
            reason=reason,
            target=target,
            priority=priority,
            source_agent=self.name,
        )
