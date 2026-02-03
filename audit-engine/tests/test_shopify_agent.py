"""Tests for Shopify platform agent."""

import tempfile
from pathlib import Path

import pandas as pd
import pytest

from atmix.agents.platforms.shopify import ShopifyAgent
from atmix.agents.base import AnalysisContext
from atmix.models.state import SessionState


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace."""
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        (workspace / "input").mkdir()
        (workspace / "cleaned").mkdir()
        (workspace / "derived").mkdir()
        (workspace / "output").mkdir()
        yield workspace


def create_session_state(workspace: Path) -> SessionState:
    """Helper to create a valid SessionState."""
    return SessionState(
        company_slug="test_company",
        workspace_path=str(workspace),
    )


@pytest.fixture
def sample_orders_df():
    """Create sample orders data."""
    return pd.DataFrame({
        "name": ["#1001", "#1002", "#1003", "#1004", "#1005"],
        "email": ["a@test.com", "b@test.com", "a@test.com", "c@test.com", "a@test.com"],
        "financial_status": ["paid", "paid", "refunded", "paid", "partially_refunded"],
        "created_at": [
            "2024-01-15 10:00:00",
            "2024-01-20 11:00:00",
            "2024-02-01 09:00:00",
            "2024-02-15 14:00:00",
            "2024-03-01 16:00:00",
        ],
        "total": ["100.00", "250.00", "75.00", "150.00", "200.00"],
        "lineitem_name": ["Product A", "Product B", "Product A", "Product C", "Product B"],
        "lineitem_price": ["100.00", "250.00", "75.00", "150.00", "200.00"],
        "lineitem_quantity": [1, 1, 1, 1, 1],
        "lineitem_sku": ["SKU-A", "SKU-B", "SKU-A", "SKU-C", "SKU-B"],
    })


@pytest.fixture
def sample_payouts_df():
    """Create sample payouts data."""
    return pd.DataFrame({
        "payout_date": ["2024-01-17", "2024-01-22", "2024-02-05", "2024-02-18"],
        "type": ["payout", "payout", "payout", "payout"],
        "amount": ["97.10", "242.75", "222.82", "145.35"],
        "fee": ["2.90", "7.25", "6.43", "4.35"],
        "net": ["97.10", "242.75", "222.82", "145.35"],
    })


class TestShopifyAgent:
    """Tests for ShopifyAgent."""

    def test_agent_attributes(self):
        """Test agent has correct attributes."""
        agent = ShopifyAgent()
        assert agent.name == "shopify"
        assert agent.required_inputs == []
        assert "Shopify" in agent.description

    def test_can_run_always_true(self, temp_workspace):
        """Test agent can always run (auto-detects files)."""
        agent = ShopifyAgent()
        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )
        assert agent.can_run(context) is True

    @pytest.mark.asyncio
    async def test_no_files_found(self, temp_workspace):
        """Test graceful handling when no Shopify files exist."""
        agent = ShopifyAgent()
        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        assert result.success
        assert result.confidence == 0.0
        assert len(result.gaps) > 0
        assert any("Shopify" in g.description for g in result.gaps)

    @pytest.mark.asyncio
    async def test_orders_analysis(self, temp_workspace, sample_orders_df):
        """Test orders file analysis."""
        agent = ShopifyAgent()

        # Save orders file
        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        assert result.success
        assert result.confidence > 0

        # Should have revenue findings
        revenue_findings = [f for f in result.findings if f.category == "revenue"]
        assert len(revenue_findings) > 0

        # Should find gross revenue
        gross_finding = next(
            (f for f in revenue_findings if "Gross Revenue" in f.title), None
        )
        assert gross_finding is not None
        assert gross_finding.metrics.get("gross_revenue", 0) > 0

    @pytest.mark.asyncio
    async def test_sku_analysis(self, temp_workspace, sample_orders_df):
        """Test SKU-level revenue analysis."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should have top product findings
        product_findings = [f for f in result.findings if "Top Product" in f.title]
        assert len(product_findings) > 0

        # Should have concentration analysis
        concentration = next(
            (f for f in result.findings if "Concentration" in f.title), None
        )
        assert concentration is not None

    @pytest.mark.asyncio
    async def test_customer_metrics(self, temp_workspace, sample_orders_df):
        """Test new vs returning customer analysis."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should have customer mix finding
        customer_findings = [f for f in result.findings if "Customer Mix" in f.title]
        assert len(customer_findings) > 0

        # a@test.com has 3 orders, so should detect returning customers
        customer_finding = customer_findings[0]
        assert customer_finding.metrics.get("returning_customers", 0) > 0

    @pytest.mark.asyncio
    async def test_refund_analysis(self, temp_workspace, sample_orders_df):
        """Test refund rate analysis."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should detect refunds
        refund_findings = [f for f in result.findings if "Refund" in f.title]
        assert len(refund_findings) > 0

    @pytest.mark.asyncio
    async def test_aov_analysis(self, temp_workspace, sample_orders_df):
        """Test Average Order Value analysis."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should have AOV finding
        aov_findings = [f for f in result.findings if "Average Order Value" in f.title]
        assert len(aov_findings) > 0

        aov = aov_findings[0].metrics.get("aov", 0)
        # Expected AOV: (100 + 250 + 75 + 150 + 200) / 5 = 155
        assert 150 < aov < 160

    @pytest.mark.asyncio
    async def test_payouts_analysis(self, temp_workspace, sample_payouts_df):
        """Test payouts file analysis."""
        agent = ShopifyAgent()

        payouts_file = temp_workspace / "input" / "shopify_payouts.csv"
        sample_payouts_df.to_csv(payouts_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        assert result.success
        assert result.confidence > 0

        # Should have payout findings
        payout_findings = [f for f in result.findings if "Payout" in f.title or "Fee" in f.title]
        assert len(payout_findings) > 0

    @pytest.mark.asyncio
    async def test_orders_payouts_reconciliation(
        self, temp_workspace, sample_orders_df, sample_payouts_df
    ):
        """Test reconciliation between orders and payouts."""
        agent = ShopifyAgent()

        # Save both files
        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        payouts_file = temp_workspace / "input" / "shopify_payouts.csv"
        sample_payouts_df.to_csv(payouts_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Higher confidence with both files
        assert result.confidence > 0.5

        # Should have reconciliation finding
        recon_findings = [f for f in result.findings if "Variance" in f.title]
        assert len(recon_findings) > 0

    @pytest.mark.asyncio
    async def test_file_pattern_detection(self, temp_workspace, sample_orders_df):
        """Test various Shopify file naming patterns are detected."""
        agent = ShopifyAgent()

        # Test alternative naming pattern
        orders_file = temp_workspace / "input" / "orders_export_2024.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should still detect and process the file
        assert result.success
        assert len(result.findings) > 1  # More than just "no data" finding

    @pytest.mark.asyncio
    async def test_questions_generated(self, temp_workspace, sample_orders_df):
        """Test that relevant questions are generated."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should generate questions about revenue recognition
        assert len(result.questions) > 0
        question_texts = [q.question for q in result.questions]
        assert any("revenue" in q.lower() for q in question_texts)

    @pytest.mark.asyncio
    async def test_derived_output_created(self, temp_workspace, sample_orders_df):
        """Test that derived output files are created."""
        agent = ShopifyAgent()

        orders_file = temp_workspace / "input" / "shopify_orders.csv"
        sample_orders_df.to_csv(orders_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should create monthly summary
        if result.outputs:
            summary_outputs = [o for o in result.outputs if "summary" in o]
            assert len(summary_outputs) > 0

    @pytest.mark.asyncio
    async def test_gl_cross_reference(self, temp_workspace, sample_payouts_df):
        """Test cross-reference with general ledger."""
        agent = ShopifyAgent()

        # Create payouts file
        payouts_file = temp_workspace / "input" / "shopify_payouts.csv"
        sample_payouts_df.to_csv(payouts_file, index=False)

        # Create GL file with Shopify entries
        gl_df = pd.DataFrame({
            "date": ["2024-01-17", "2024-01-22", "2024-02-05"],
            "memo": ["Shopify Payout", "Shopify Deposit", "Shopify Payment"],
            "amount": ["97.10", "242.75", "222.82"],
        })
        gl_file = temp_workspace / "cleaned" / "general_ledger.csv"
        gl_df.to_csv(gl_file, index=False)

        context = AnalysisContext(
            workspace=temp_workspace,
            session_state=create_session_state(temp_workspace),
        )

        result = await agent.analyze(context)

        # Should find GL cross-reference
        gl_findings = [f for f in result.findings if "GL" in f.title]
        assert len(gl_findings) > 0


class TestShopifyAgentHelpers:
    """Tests for ShopifyAgent helper methods."""

    def test_detect_column_mapping_orders(self):
        """Test column detection for orders."""
        agent = ShopifyAgent()

        df = pd.DataFrame({
            "Created_At": [],
            "Total": [],
            "Email": [],
        })

        mapping = agent._detect_column_mapping(df, "orders")

        assert mapping["date_col"] == "created_at"
        assert mapping["total_col"] == "total"
        assert len(mapping["issues"]) == 0

    def test_detect_column_mapping_missing(self):
        """Test column detection reports missing columns."""
        agent = ShopifyAgent()

        df = pd.DataFrame({
            "random_col": [],
            "other_col": [],
        })

        mapping = agent._detect_column_mapping(df, "orders")

        assert len(mapping["issues"]) > 0

    def test_calculate_confidence(self):
        """Test confidence calculation."""
        agent = ShopifyAgent()

        # Orders only
        conf1 = agent._calculate_confidence(
            has_orders=True, has_payouts=False, has_products=False, gaps=[]
        )
        assert conf1 == 0.4

        # Orders + Payouts
        conf2 = agent._calculate_confidence(
            has_orders=True, has_payouts=True, has_products=False, gaps=[]
        )
        assert abs(conf2 - 0.8) < 0.01  # 0.4 + 0.3 + 0.1 bonus

        # All data
        conf3 = agent._calculate_confidence(
            has_orders=True, has_payouts=True, has_products=True, gaps=[]
        )
        assert abs(conf3 - 0.9) < 0.01

        # With blocking gaps
        from atmix.models.findings import Gap
        gaps = [Gap(description="test", data_needed="test", blocking=True, source_agent="test")]
        conf4 = agent._calculate_confidence(
            has_orders=True, has_payouts=True, has_products=True, gaps=gaps
        )
        assert abs(conf4 - 0.8) < 0.01  # 0.9 - 0.1 for blocking gap
