"""Tests for engine components."""

import pytest
import tempfile
from pathlib import Path

from atmix.engine.session import Session
from atmix.engine.checkpoint import CheckpointManager


class TestSession:
    def test_create_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            session = Session.create(workspace, "test-company")

            assert session.state.company_slug == "test-company"
            assert (workspace / "input").exists()
            assert (workspace / "cleaned").exists()
            assert (workspace / "output").exists()
            assert (workspace / "state").exists()

    def test_load_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"

            # Create
            session1 = Session.create(workspace, "test-company")
            session1.state.current_phase = "analysis"
            session1.save()

            # Load
            session2 = Session.load(workspace)
            assert session2 is not None
            assert session2.state.current_phase == "analysis"

    def test_load_or_create(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"

            # First call creates
            session1 = Session.load_or_create(workspace, "test-company")
            assert session1.state.current_phase == "init"

            session1.state.current_phase = "intake"
            session1.save()

            # Second call loads
            session2 = Session.load_or_create(workspace)
            assert session2.state.current_phase == "intake"

    def test_phase_complete(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            session = Session.create(workspace, "test-company")

            assert not session.phase_complete("intake")

            session.complete_phase("intake", "success")
            assert session.phase_complete("intake")


class TestCheckpointManager:
    def test_save_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            workspace.mkdir(parents=True)

            session = Session.create(workspace, "test-company")
            cp_mgr = CheckpointManager(workspace)

            cp = cp_mgr.save(session.state, "test_point", {"key": "value"})

            assert cp.checkpoint_id == "cp_001"
            assert cp.resume_point == "test_point"
            assert cp.resume_context["key"] == "value"

    def test_get_latest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            workspace.mkdir(parents=True)

            session = Session.create(workspace, "test-company")
            cp_mgr = CheckpointManager(workspace)

            # No checkpoints yet
            assert cp_mgr.get_latest() is None

            # Create checkpoints
            cp_mgr.save(session.state, "point1")
            session.state.checkpoint_count = 1
            cp_mgr.save(session.state, "point2")

            latest = cp_mgr.get_latest()
            assert latest is not None
            assert latest.resume_point == "point2"

    def test_restore_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            workspace.mkdir(parents=True)

            session = Session.create(workspace, "test-company")
            session.state.current_phase = "analysis"
            session.state.iteration = 5

            cp_mgr = CheckpointManager(workspace)
            cp = cp_mgr.save(session.state, "mid_analysis")

            # Restore
            restored = cp_mgr.restore_session(cp)
            assert restored.current_phase == "analysis"
            assert restored.iteration == 5

    def test_cleanup_old(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "test-company"
            workspace.mkdir(parents=True)

            session = Session.create(workspace, "test-company")
            cp_mgr = CheckpointManager(workspace)

            # Create 15 checkpoints
            for i in range(15):
                session.state.checkpoint_count = i
                cp_mgr.save(session.state, f"point_{i}")

            # Should have 15
            assert len(cp_mgr.list_checkpoints()) == 15

            # Cleanup, keep 10
            removed = cp_mgr.cleanup_old(keep=10)
            assert removed == 5
            assert len(cp_mgr.list_checkpoints()) == 10
