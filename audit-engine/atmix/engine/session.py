"""Session management for workspace isolation."""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.state import SessionState


class Session:
    """Manages a single audit session within a workspace."""

    def __init__(self, state: SessionState, workspace: Path):
        self.state = state
        self.workspace = workspace
        self._state_file = workspace / "state" / "session.json"

    @classmethod
    def create(cls, workspace: Path, company_slug: str) -> "Session":
        """Create a new session in the workspace."""
        # Ensure directories exist
        (workspace / "input").mkdir(parents=True, exist_ok=True)
        (workspace / "cleaned").mkdir(parents=True, exist_ok=True)
        (workspace / "derived").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)
        (workspace / "state").mkdir(parents=True, exist_ok=True)
        (workspace / "state" / "checkpoints").mkdir(parents=True, exist_ok=True)

        state = SessionState(
            company_slug=company_slug,
            workspace_path=str(workspace),
        )

        session = cls(state, workspace)
        session.save()
        return session

    @classmethod
    def load(cls, workspace: Path) -> Optional["Session"]:
        """Load existing session from workspace."""
        state_file = workspace / "state" / "session.json"
        if not state_file.exists():
            return None

        with open(state_file, "r") as f:
            data = json.load(f)

        state = SessionState.from_dict(data)
        return cls(state, workspace)

    @classmethod
    def load_or_create(cls, workspace: Path, company_slug: Optional[str] = None) -> "Session":
        """Load existing session or create new one."""
        existing = cls.load(workspace)
        if existing:
            return existing

        if company_slug is None:
            company_slug = workspace.name

        return cls.create(workspace, company_slug)

    def save(self) -> None:
        """Save session state to disk."""
        self.state.updated_at = datetime.now()
        self._state_file.parent.mkdir(parents=True, exist_ok=True)

        with open(self._state_file, "w") as f:
            json.dump(self.state.to_dict(), f, indent=2)

    def save_findings(self) -> None:
        """Save findings to separate file for easy access."""
        findings_file = self.workspace / "state" / "findings.json"
        with open(findings_file, "w") as f:
            json.dump([f.to_dict() for f in self.state.findings], f, indent=2)

    def save_gaps(self) -> None:
        """Save gaps to separate file."""
        gaps_file = self.workspace / "state" / "gaps.json"
        with open(gaps_file, "w") as f:
            json.dump([g.to_dict() for g in self.state.gaps], f, indent=2)

    def save_questions(self) -> None:
        """Save questions to separate file."""
        questions_file = self.workspace / "state" / "questions.json"
        with open(questions_file, "w") as f:
            json.dump([q.to_dict() for q in self.state.questions], f, indent=2)

    def phase_complete(self, phase: str) -> bool:
        """Check if a phase has been completed."""
        return any(p.phase == phase for p in self.state.phase_history)

    def set_phase(self, phase: str) -> None:
        """Set current phase."""
        self.state.current_phase = phase
        self.save()

    def complete_phase(self, phase: str, result: str = "success") -> None:
        """Mark a phase as complete."""
        from ..models.state import PhaseRecord

        # Find when phase started (from current_phase or estimate)
        started_at = self.state.updated_at
        completed_at = datetime.now()

        record = PhaseRecord(
            phase=phase,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=(completed_at - started_at).total_seconds(),
            result=result,
        )
        self.state.phase_history.append(record)
        self.save()

    def get_input_path(self) -> Path:
        return self.workspace / "input"

    def get_cleaned_path(self) -> Path:
        return self.workspace / "cleaned"

    def get_derived_path(self) -> Path:
        return self.workspace / "derived"

    def get_output_path(self) -> Path:
        return self.workspace / "output"

    def discover_files(self) -> dict[str, list[Path]]:
        """Discover and categorize input files."""
        input_path = self.get_input_path()
        if not input_path.exists():
            return {}

        files_by_type: dict[str, list[Path]] = {
            "excel": [],
            "csv": [],
            "pdf": [],
            "unknown": [],
        }

        for f in input_path.iterdir():
            if f.is_file():
                suffix = f.suffix.lower()
                if suffix in (".xlsx", ".xls"):
                    files_by_type["excel"].append(f)
                elif suffix == ".csv":
                    files_by_type["csv"].append(f)
                elif suffix == ".pdf":
                    files_by_type["pdf"].append(f)
                else:
                    files_by_type["unknown"].append(f)

        return files_by_type
