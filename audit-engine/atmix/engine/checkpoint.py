"""Checkpoint system for crash recovery."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.state import CheckpointData, SessionState


class CheckpointManager:
    """Manages checkpoints for session recovery."""

    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.checkpoints_dir = workspace / "state" / "checkpoints"
        self.checkpoints_dir.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        session_state: SessionState,
        resume_point: str,
        resume_context: Optional[dict] = None,
    ) -> CheckpointData:
        """Save a checkpoint."""
        checkpoint_id = f"cp_{session_state.checkpoint_count + 1:03d}"
        timestamp = datetime.now()

        checkpoint = CheckpointData(
            checkpoint_id=checkpoint_id,
            timestamp=timestamp,
            session_state=session_state.to_dict(),
            resume_point=resume_point,
            resume_context=resume_context or {},
        )

        # Save to file
        checkpoint_file = self.checkpoints_dir / f"{checkpoint_id}.json"
        with open(checkpoint_file, "w") as f:
            json.dump(checkpoint.to_dict(), f, indent=2)

        # Update session state
        session_state.last_checkpoint_id = checkpoint_id
        session_state.checkpoint_count += 1

        return checkpoint

    def get_latest(self) -> Optional[CheckpointData]:
        """Get the most recent checkpoint."""
        checkpoints = sorted(self.checkpoints_dir.glob("cp_*.json"))
        if not checkpoints:
            return None

        latest = checkpoints[-1]
        with open(latest, "r") as f:
            data = json.load(f)

        return CheckpointData.from_dict(data)

    def load(self, checkpoint_id: str) -> Optional[CheckpointData]:
        """Load a specific checkpoint."""
        checkpoint_file = self.checkpoints_dir / f"{checkpoint_id}.json"
        if not checkpoint_file.exists():
            return None

        with open(checkpoint_file, "r") as f:
            data = json.load(f)

        return CheckpointData.from_dict(data)

    def restore_session(self, checkpoint: CheckpointData) -> SessionState:
        """Restore session state from checkpoint."""
        return SessionState.from_dict(checkpoint.session_state)

    def list_checkpoints(self) -> list[CheckpointData]:
        """List all checkpoints."""
        checkpoints = []
        for f in sorted(self.checkpoints_dir.glob("cp_*.json")):
            with open(f, "r") as fp:
                data = json.load(fp)
            checkpoints.append(CheckpointData.from_dict(data))
        return checkpoints

    def cleanup_old(self, keep: int = 10) -> int:
        """Remove old checkpoints, keeping the most recent N."""
        checkpoints = sorted(self.checkpoints_dir.glob("cp_*.json"))
        if len(checkpoints) <= keep:
            return 0

        to_remove = checkpoints[:-keep]
        for f in to_remove:
            f.unlink()

        return len(to_remove)
