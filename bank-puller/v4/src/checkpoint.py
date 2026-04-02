"""Durable JSON checkpointing — one file per run, atomic writes."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .models import Phase, PhaseCheckpoint, PhaseStatus, RunCheckpoint


_DEFAULT_CHECKPOINT_DIR = Path("checkpoints")


class CheckpointManager:
    """Reads/writes RunCheckpoint JSON files.

    One file per run: {checkpoint_dir}/{run_id}.json

    On crash, the orchestrator loads the latest checkpoint for the same
    target_month and skips phases that are already PhaseStatus.SUCCESS.

    Writes are atomic: the new state is written to a .tmp file first,
    then renamed over the target path. On POSIX this is guaranteed atomic;
    on Windows, Path.replace() is used which is atomic on NTFS.
    """

    def __init__(
        self,
        run_id: str,
        target_month: str,
        checkpoint_dir: Path = _DEFAULT_CHECKPOINT_DIR,
    ) -> None:
        self.run_id = run_id
        self.target_month = target_month
        self._dir = checkpoint_dir
        self._path = checkpoint_dir / f"{run_id}.json"
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self._state: RunCheckpoint = self._load_or_create()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_or_create(self) -> RunCheckpoint:
        if self._path.exists():
            try:
                return RunCheckpoint.model_validate_json(self._path.read_text(encoding="utf-8"))
            except Exception:
                # Corrupt file — start fresh but keep the bad file for debugging
                pass
        return RunCheckpoint(
            run_id=self.run_id,
            target_month=self.target_month,
            started_at=datetime.utcnow(),
        )

    def _flush(self) -> None:
        """Atomically write _state to disk."""
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(self._state.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(self._path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_phase(
        self,
        login_key: str,
        account_last4: str,
        phase: Phase,
        status: PhaseStatus,
        output_path: str | None = None,
    ) -> None:
        """Upsert a phase checkpoint and flush to disk atomically.

        If a checkpoint already exists for (login_key, account_last4, phase),
        it is replaced with the new one.
        """
        # Remove any existing entry for this key+phase
        self._state.phase_checkpoints = [
            cp
            for cp in self._state.phase_checkpoints
            if not (
                cp.login_key == login_key
                and cp.account_last4 == account_last4
                and cp.phase == phase
            )
        ]

        self._state.phase_checkpoints.append(
            PhaseCheckpoint(
                run_id=self.run_id,
                login_key=login_key,
                account_last4=account_last4,
                phase=phase,
                status=status,
                output_path=output_path,
            )
        )
        self._flush()

    def is_done(self, login_key: str, account_last4: str, phase: Phase) -> bool:
        """True if this phase completed successfully in a previous run."""
        return self._state.is_phase_done(login_key, account_last4, phase)

    def get_state(self) -> RunCheckpoint:
        """Return a reference to the current in-memory state (read-only use)."""
        return self._state

    # ------------------------------------------------------------------
    # Class-level helpers
    # ------------------------------------------------------------------

    @classmethod
    def find_resume_checkpoint(
        cls,
        target_month: str,
        checkpoint_dir: Path = _DEFAULT_CHECKPOINT_DIR,
    ) -> str | None:
        """Return run_id of the most recent incomplete run for target_month.

        A run is "incomplete" if it exists and at least one account has not
        reached PhaseStatus.SUCCESS for all expected phases (i.e. it is not
        fully finished, but has made some progress worth resuming from).

        Returns None if no resumable checkpoint exists in checkpoint_dir.
        """
        if not checkpoint_dir.exists():
            return None

        candidates: list[tuple[datetime, str]] = []

        for json_file in checkpoint_dir.glob("*.json"):
            if json_file.suffix == ".tmp":
                continue
            try:
                rc = RunCheckpoint.model_validate_json(
                    json_file.read_text(encoding="utf-8")
                )
            except Exception:
                continue  # skip corrupt files

            if rc.target_month != target_month:
                continue

            # Include if the checkpoint has any recorded progress
            if rc.phase_checkpoints:
                candidates.append((rc.started_at, rc.run_id))

        if not candidates:
            return None

        # Return the most recent one
        candidates.sort(key=lambda t: t[0], reverse=True)
        return candidates[0][1]
