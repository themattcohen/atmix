"""Tests for data models."""

import pytest
from datetime import datetime

from atmix.models.findings import Finding, Gap, Question, AgentResult
from atmix.models.state import SessionState, CheckpointData


class TestFinding:
    def test_create_finding(self):
        f = Finding(
            category="revenue",
            severity="high",
            title="Revenue Decline",
            detail="Revenue decreased by 10%",
        )
        assert f.category == "revenue"
        assert f.severity == "high"
        assert f.id is not None

    def test_finding_serialization(self):
        f = Finding(
            category="expense",
            severity="medium",
            title="High Shipping",
            detail="Shipping costs above benchmark",
            metrics={"shipping_pct": 18.5},
        )
        d = f.to_dict()
        f2 = Finding.from_dict(d)

        assert f2.category == f.category
        assert f2.title == f.title
        assert f2.metrics == f.metrics


class TestGap:
    def test_create_gap(self):
        g = Gap(
            description="Missing Shopify data",
            data_needed="Shopify orders export",
            blocking=True,
        )
        assert g.blocking is True
        assert g.resolved is False

    def test_gap_serialization(self):
        g = Gap(
            description="Test gap",
            data_needed="Test data",
        )
        d = g.to_dict()
        g2 = Gap.from_dict(d)
        assert g2.description == g.description


class TestAgentResult:
    def test_create_result(self):
        r = AgentResult(
            agent_name="test_agent",
            findings=[
                Finding(category="test", severity="info", title="Test", detail="Test finding"),
            ],
            confidence=0.8,
        )
        assert r.agent_name == "test_agent"
        assert len(r.findings) == 1
        assert r.success is True

    def test_result_with_error(self):
        r = AgentResult(
            agent_name="failed_agent",
            error="Something went wrong",
        )
        assert r.success is False


class TestSessionState:
    def test_create_session(self):
        s = SessionState(
            company_slug="test-company",
            workspace_path="/tmp/test",
        )
        assert s.current_phase == "init"
        assert s.iteration == 0
        assert s.confidence == 0.0

    def test_add_finding(self):
        s = SessionState(company_slug="test", workspace_path="/tmp")
        f = Finding(category="test", severity="info", title="Test", detail="Test")
        s.add_finding(f)
        assert len(s.findings) == 1

    def test_calculate_confidence(self):
        s = SessionState(company_slug="test", workspace_path="/tmp")

        # Empty session = 0 confidence
        assert s.calculate_confidence() == 0.0

        # Add findings
        for i in range(5):
            s.add_finding(Finding(category="test", severity="info", title=f"Test {i}", detail="Test"))

        conf = s.calculate_confidence()
        assert conf > 0

        # Add blocking gap - confidence should decrease or stay same
        s.add_gap(Gap(description="Blocking", data_needed="Data", blocking=True))
        conf_with_gap = s.calculate_confidence()
        assert conf_with_gap <= conf  # Blocking gap should not increase confidence

    def test_serialization(self):
        s = SessionState(
            company_slug="test-company",
            workspace_path="/tmp/test",
        )
        s.add_finding(Finding(category="test", severity="info", title="Test", detail="Test"))

        d = s.to_dict()
        s2 = SessionState.from_dict(d)

        assert s2.company_slug == s.company_slug
        assert len(s2.findings) == 1


class TestCheckpointData:
    def test_create_checkpoint(self):
        session = SessionState(company_slug="test", workspace_path="/tmp")
        cp = CheckpointData(
            checkpoint_id="cp_001",
            timestamp=datetime.now(),
            session_state=session.to_dict(),
            resume_point="analysis",
            resume_context={"iteration": 1},
        )
        assert cp.checkpoint_id == "cp_001"
        assert cp.resume_point == "analysis"

    def test_checkpoint_serialization(self):
        session = SessionState(company_slug="test", workspace_path="/tmp")
        cp = CheckpointData(
            checkpoint_id="cp_002",
            timestamp=datetime.now(),
            session_state=session.to_dict(),
            resume_point="intake",
            resume_context={},
        )
        d = cp.to_dict()
        cp2 = CheckpointData.from_dict(d)

        assert cp2.checkpoint_id == cp.checkpoint_id
        assert cp2.resume_point == cp.resume_point
