"""Tests for the Pricing Engine.

Tests cover:
- Data class serialization (to_dict/from_dict)
- ClientAnalysis complexity calculations
- Quote validation
- Tier recommendation logic
- Cleanup fee estimation
- Display formatting
- LLM integration (mocked)
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

from atmix.engine.pricing import (
    ALLSOLUTIONS_ADDONS,
    ALLSOLUTIONS_TIERS,
    AccountingBasis,
    AddOn,
    AddOnCategory,
    ClientAnalysis,
    ComplexityLevel,
    PricingEngine,
    PricingTier,
    Quote,
    _parse_llm_json,
    DEFAULT_CLEANUP_HOURLY_RATE,
    DEFAULT_SETUP_FEE,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = MagicMock()
    return client


@pytest.fixture
def pricing_engine(mock_llm_client):
    """Create a pricing engine with mock client."""
    return PricingEngine(mock_llm_client)


@pytest.fixture
def simple_analysis():
    """Create a simple business analysis."""
    return ClientAnalysis(
        monthly_transactions=100,
        bank_accounts=1,
        credit_cards=1,
        payment_processors=[],
        platforms=[],
        has_inventory=False,
        has_payroll=False,
        employee_count=0,
        contractor_count=0,
        needs_ar=False,
        needs_ap=False,
        needs_accrual=False,
        months_behind=0,
        estimated_cleanup_hours=0,
        complexity_notes=[],
        business_type="Service",
    )


@pytest.fixture
def complex_analysis():
    """Create a complex business analysis."""
    return ClientAnalysis(
        monthly_transactions=1500,
        bank_accounts=5,
        credit_cards=4,
        payment_processors=["Stripe", "PayPal"],
        platforms=["Shopify", "Amazon"],
        has_inventory=True,
        has_payroll=True,
        employee_count=15,
        contractor_count=8,
        needs_ar=True,
        needs_ap=True,
        needs_accrual=True,
        months_behind=6,
        estimated_cleanup_hours=40,
        complexity_notes=["Multi-channel e-commerce", "Complex revenue recognition"],
        business_type="E-commerce",
        annual_revenue_estimate=2000000,
        state_count=5,
    )


@pytest.fixture
def sample_quote():
    """Create a sample quote."""
    return Quote(
        recommended_tier="Professional",
        monthly_price=1500,
        price_rationale="Mid-tier pricing appropriate for growing e-commerce business",
        cleanup_fee=2600,
        setup_fee=250,
        included_services=[
            "Monthly transaction entry",
            "Bank reconciliation",
            "AR entries (up to 30/month)",
            "AP entries (up to 30/month)",
        ],
        recommended_addons=["Sales Tax", "1099 Processing"],
        addon_rationale="Multi-state e-commerce requires sales tax management",
        key_factors=["500+ monthly transactions", "AR/AP needs", "Multi-state presence"],
        assumptions=["Stable transaction volume", "Standard reconciliation complexity"],
        confidence=0.85,
    )


# =============================================================================
# Data Class Tests
# =============================================================================


class TestPricingTier:
    """Tests for PricingTier data class."""

    def test_to_dict(self):
        """Test tier serialization."""
        tier = ALLSOLUTIONS_TIERS[0]  # Essential
        data = tier.to_dict()

        assert data["name"] == "Essential"
        assert data["min_price"] == 750
        assert data["max_price"] == 1250
        assert data["accounting_basis"] == "Cash"
        assert data["max_accounts"] == 5
        assert isinstance(data["included_services"], list)

    def test_from_dict(self):
        """Test tier deserialization."""
        data = {
            "name": "Custom",
            "min_price": 500,
            "max_price": 1000,
            "accounting_basis": "Cash",
            "max_accounts": 3,
            "included_services": ["Service A"],
            "description": "Test tier",
            "max_ar_ap_entries": 10,
            "max_journal_entries": 5,
        }
        tier = PricingTier.from_dict(data)

        assert tier.name == "Custom"
        assert tier.min_price == 500
        assert tier.accounting_basis == AccountingBasis.CASH
        assert tier.max_ar_ap_entries == 10

    def test_roundtrip(self):
        """Test serialization roundtrip."""
        for tier in ALLSOLUTIONS_TIERS:
            data = tier.to_dict()
            restored = PricingTier.from_dict(data)
            assert restored.name == tier.name
            assert restored.min_price == tier.min_price
            assert restored.max_price == tier.max_price


class TestAddOn:
    """Tests for AddOn data class."""

    def test_to_dict(self):
        """Test add-on serialization."""
        addon = ALLSOLUTIONS_ADDONS[0]  # CFO Services
        data = addon.to_dict()

        assert data["name"] == "CFO Services"
        assert "description" in data
        assert "pricing_note" in data
        assert "category" in data

    def test_from_dict(self):
        """Test add-on deserialization."""
        data = {
            "name": "Test Service",
            "description": "Test description",
            "pricing_note": "$100/month",
            "category": "advisory",
            "triggers": ["test", "demo"],
        }
        addon = AddOn.from_dict(data)

        assert addon.name == "Test Service"
        assert addon.category == AddOnCategory.ADVISORY
        assert "test" in addon.triggers


class TestClientAnalysis:
    """Tests for ClientAnalysis data class."""

    def test_total_accounts(self, simple_analysis):
        """Test total accounts calculation."""
        assert simple_analysis.total_accounts == 2  # 1 bank + 1 credit card

    def test_complexity_level_low(self, simple_analysis):
        """Test low complexity detection."""
        assert simple_analysis.complexity_level == ComplexityLevel.LOW

    def test_complexity_level_high(self, complex_analysis):
        """Test high complexity detection."""
        assert complex_analysis.complexity_level in [
            ComplexityLevel.HIGH,
            ComplexityLevel.VERY_HIGH,
        ]

    def test_complexity_medium(self):
        """Test medium complexity detection."""
        analysis = ClientAnalysis(
            monthly_transactions=300,
            bank_accounts=3,
            credit_cards=2,
            platforms=["Shopify"],
            needs_ar=True,
        )
        assert analysis.complexity_level in [ComplexityLevel.MEDIUM, ComplexityLevel.HIGH]

    def test_to_dict(self, complex_analysis):
        """Test analysis serialization."""
        data = complex_analysis.to_dict()

        assert data["monthly_transactions"] == 1500
        assert data["has_inventory"] is True
        assert "Shopify" in data["platforms"]
        assert data["state_count"] == 5

    def test_from_dict(self):
        """Test analysis deserialization."""
        data = {
            "monthly_transactions": 500,
            "bank_accounts": 2,
            "credit_cards": 1,
            "has_inventory": True,
            "platforms": ["Amazon"],
            "business_type": "Retail",
        }
        analysis = ClientAnalysis.from_dict(data)

        assert analysis.monthly_transactions == 500
        assert analysis.has_inventory is True
        assert "Amazon" in analysis.platforms

    def test_default_values(self):
        """Test default values are set correctly."""
        analysis = ClientAnalysis()

        assert analysis.monthly_transactions == 0
        assert analysis.bank_accounts == 0
        assert analysis.has_inventory is False
        assert analysis.platforms == []
        assert analysis.state_count == 1


class TestQuote:
    """Tests for Quote data class."""

    def test_total_first_month(self, sample_quote):
        """Test first month total calculation."""
        expected = 1500 + 2600 + 250  # monthly + cleanup + setup
        assert sample_quote.total_first_month == expected

    def test_annual_cost(self, sample_quote):
        """Test annual cost calculation."""
        assert sample_quote.annual_cost == 1500 * 12

    def test_valid_until_default(self):
        """Test default validity period."""
        quote = Quote(
            recommended_tier="Essential",
            monthly_price=750,
            price_rationale="Test",
        )
        assert quote.valid_until is not None
        assert quote.valid_until > datetime.now()

    def test_to_dict(self, sample_quote):
        """Test quote serialization."""
        data = sample_quote.to_dict()

        assert data["recommended_tier"] == "Professional"
        assert data["monthly_price"] == 1500
        assert data["cleanup_fee"] == 2600
        assert len(data["included_services"]) == 4

    def test_from_dict(self):
        """Test quote deserialization."""
        data = {
            "recommended_tier": "Elite",
            "monthly_price": 3000,
            "price_rationale": "Complex business",
            "included_services": ["Full service"],
            "key_factors": ["High volume"],
            "confidence": 0.9,
        }
        quote = Quote.from_dict(data)

        assert quote.recommended_tier == "Elite"
        assert quote.monthly_price == 3000
        assert quote.confidence == 0.9


# =============================================================================
# JSON Parsing Tests
# =============================================================================


class TestJsonParsing:
    """Tests for LLM JSON parsing utilities."""

    def test_parse_clean_json(self):
        """Test parsing clean JSON."""
        content = '{"key": "value", "number": 42}'
        result = _parse_llm_json(content)

        assert result is not None
        assert result["key"] == "value"
        assert result["number"] == 42

    def test_parse_json_with_preamble(self):
        """Test parsing JSON with text before it."""
        content = 'Here is the analysis:\n\n{"result": "success"}'
        result = _parse_llm_json(content)

        assert result is not None
        assert result["result"] == "success"

    def test_parse_json_with_trailing_comma(self):
        """Test parsing JSON with trailing comma."""
        content = '{"items": ["a", "b",], "count": 2,}'
        result = _parse_llm_json(content)

        assert result is not None
        assert result["items"] == ["a", "b"]

    def test_parse_no_json(self):
        """Test parsing content without JSON."""
        content = "No JSON here, just text."
        result = _parse_llm_json(content)

        assert result is None

    def test_parse_truncated_json(self):
        """Test parsing truncated JSON (finds last complete object)."""
        content = '{"complete": true}{"incomplete": tr'
        result = _parse_llm_json(content)

        assert result is not None
        assert result["complete"] is True


# =============================================================================
# Pricing Engine Tests
# =============================================================================


class TestPricingEngine:
    """Tests for PricingEngine class."""

    def test_initialization(self, mock_llm_client):
        """Test engine initialization."""
        engine = PricingEngine(mock_llm_client)

        assert engine.llm_client == mock_llm_client
        assert engine.model == "claude-sonnet-4-20250514"
        assert len(engine.tiers) == 3
        assert len(engine.addons) > 0

    def test_initialization_custom_model(self, mock_llm_client):
        """Test engine with custom model."""
        engine = PricingEngine(mock_llm_client, model="claude-opus-4-20250514")

        assert engine.model == "claude-opus-4-20250514"

    def test_initialization_custom_tiers(self, mock_llm_client):
        """Test engine with custom tiers."""
        custom_tiers = [ALLSOLUTIONS_TIERS[0]]  # Just Essential
        engine = PricingEngine(mock_llm_client, tiers=custom_tiers)

        assert len(engine.tiers) == 1
        assert engine.tiers[0].name == "Essential"

    def test_get_tier_recommendation_simple(self, pricing_engine, simple_analysis):
        """Test tier recommendation for simple business."""
        tier = pricing_engine.get_tier_recommendation(simple_analysis)
        assert tier == "Essential"

    def test_get_tier_recommendation_complex(self, pricing_engine, complex_analysis):
        """Test tier recommendation for complex business."""
        tier = pricing_engine.get_tier_recommendation(complex_analysis)
        assert tier == "Elite"

    def test_get_tier_recommendation_professional(self, pricing_engine):
        """Test tier recommendation for professional-level business."""
        analysis = ClientAnalysis(
            monthly_transactions=400,
            bank_accounts=4,
            credit_cards=2,
            needs_ar=True,
            needs_ap=True,
        )
        tier = pricing_engine.get_tier_recommendation(analysis)
        assert tier == "Professional"

    def test_estimate_cleanup_fee_none(self, pricing_engine, simple_analysis):
        """Test no cleanup fee when current."""
        fee = pricing_engine.estimate_cleanup_fee(simple_analysis)
        assert fee is None

    def test_estimate_cleanup_fee_with_hours(self, pricing_engine, complex_analysis):
        """Test cleanup fee calculation with estimated hours."""
        fee = pricing_engine.estimate_cleanup_fee(complex_analysis)

        expected = complex_analysis.estimated_cleanup_hours * DEFAULT_CLEANUP_HOURLY_RATE
        assert fee == expected

    def test_estimate_cleanup_fee_auto_estimate(self, pricing_engine):
        """Test cleanup fee auto-estimation without hours."""
        analysis = ClientAnalysis(
            months_behind=3,
            estimated_cleanup_hours=0,  # Will be auto-estimated
        )
        fee = pricing_engine.estimate_cleanup_fee(analysis)

        assert fee is not None
        assert fee > 0

    def test_validate_quote_valid(self, pricing_engine, sample_quote):
        """Test validation of valid quote."""
        warnings = pricing_engine.validate_quote(sample_quote)
        assert len(warnings) == 0

    def test_validate_quote_invalid_tier(self, pricing_engine):
        """Test validation catches invalid tier."""
        quote = Quote(
            recommended_tier="InvalidTier",
            monthly_price=1000,
            price_rationale="Test",
        )
        warnings = pricing_engine.validate_quote(quote)
        assert any("Unknown tier" in w for w in warnings)

    def test_validate_quote_price_out_of_range(self, pricing_engine):
        """Test validation catches price outside tier range."""
        quote = Quote(
            recommended_tier="Essential",
            monthly_price=2000,  # Above Essential max of 1250
            price_rationale="Test",
            included_services=["Service"],
        )
        warnings = pricing_engine.validate_quote(quote)
        assert any("outside" in w.lower() for w in warnings)

    def test_validate_quote_low_confidence(self, pricing_engine):
        """Test validation warns on low confidence."""
        quote = Quote(
            recommended_tier="Essential",
            monthly_price=750,
            price_rationale="Test rationale here",
            included_services=["Service"],
            confidence=0.3,
        )
        warnings = pricing_engine.validate_quote(quote)
        assert any("confidence" in w.lower() for w in warnings)

    def test_reset_token_count(self, pricing_engine):
        """Test token counter reset."""
        pricing_engine.total_tokens = 1000
        old_count = pricing_engine.reset_token_count()

        assert old_count == 1000
        assert pricing_engine.total_tokens == 0

    def test_format_tiers(self, pricing_engine):
        """Test tier formatting for prompts."""
        formatted = pricing_engine._format_tiers()

        assert "ESSENTIAL" in formatted
        assert "PROFESSIONAL" in formatted
        assert "ELITE" in formatted
        assert "$750" in formatted
        assert "$5,000" in formatted

    def test_format_addons(self, pricing_engine):
        """Test add-on formatting for prompts."""
        formatted = pricing_engine._format_addons()

        assert "CFO Services" in formatted
        assert "Sales Tax" in formatted
        assert "1099 Processing" in formatted

    def test_format_samples(self, pricing_engine):
        """Test sample data formatting."""
        samples = {
            "bank.csv": "Date,Amount\n2024-01-01,100",
            "sales.csv": "Order,Total\nORD001,50",
        }
        formatted = pricing_engine._format_samples(samples)

        assert "bank.csv" in formatted
        assert "sales.csv" in formatted
        assert "Date,Amount" in formatted

    def test_format_samples_truncation(self, pricing_engine):
        """Test sample truncation for large files."""
        samples = {"large.csv": "x" * 5000}  # Exceeds 2000 char limit
        formatted = pricing_engine._format_samples(samples)

        assert "[truncated]" in formatted
        assert len(formatted) < 5000

    def test_format_context(self, pricing_engine):
        """Test context formatting."""
        context = {
            "business_type": "E-commerce",
            "annual_revenue": "$500,000",
        }
        formatted = pricing_engine._format_context(context)

        assert "Business Type" in formatted
        assert "E-commerce" in formatted

    def test_format_context_empty(self, pricing_engine):
        """Test empty context handling."""
        formatted = pricing_engine._format_context({})
        assert "No additional context" in formatted


class TestPricingEngineLLMIntegration:
    """Tests for PricingEngine LLM integration."""

    def test_analyze_prospect_success(self, mock_llm_client):
        """Test successful prospect analysis."""
        # Mock LLM response
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text=json.dumps(
                    {
                        "monthly_transactions": 300,
                        "bank_accounts": 2,
                        "credit_cards": 1,
                        "payment_processors": ["Stripe"],
                        "platforms": ["Shopify"],
                        "has_inventory": True,
                        "has_payroll": False,
                        "employee_count": 0,
                        "contractor_count": 2,
                        "needs_ar": True,
                        "needs_ap": False,
                        "needs_accrual": False,
                        "months_behind": 2,
                        "estimated_cleanup_hours": 8,
                        "complexity_notes": ["E-commerce complexity"],
                        "business_type": "Retail",
                    }
                )
            )
        ]
        mock_response.usage = MagicMock(input_tokens=100, output_tokens=200)
        mock_llm_client.messages.create.return_value = mock_response

        engine = PricingEngine(mock_llm_client)
        analysis = engine.analyze_prospect(
            data_files={"bank.csv": "Bank Statement"},
            data_samples={"bank.csv": "Date,Amount\n2024-01-01,100"},
            user_context={"business_type": "Retail"},
        )

        assert analysis.monthly_transactions == 300
        assert analysis.has_inventory is True
        assert "Shopify" in analysis.platforms
        assert engine.total_tokens == 300

    def test_analyze_prospect_llm_failure(self, mock_llm_client):
        """Test analysis with LLM failure."""
        mock_llm_client.messages.create.side_effect = Exception("API Error")

        engine = PricingEngine(mock_llm_client, max_retries=1)
        analysis = engine.analyze_prospect(
            data_files={},
            data_samples={},
            user_context={},
        )

        # Should return default analysis with error note
        assert len(analysis.complexity_notes) > 0

    def test_generate_quote_success(self, mock_llm_client, simple_analysis):
        """Test successful quote generation."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text=json.dumps(
                    {
                        "recommended_tier": "Essential",
                        "monthly_price": 850,
                        "price_rationale": "Simple service business with low transaction volume",
                        "cleanup_fee": None,
                        "setup_fee": 250,
                        "included_services": ["Monthly bookkeeping", "Reconciliation"],
                        "recommended_addons": [],
                        "addon_rationale": "",
                        "key_factors": ["Low complexity", "Few accounts"],
                        "assumptions": ["Stable volume"],
                        "confidence": 0.9,
                    }
                )
            )
        ]
        mock_response.usage = MagicMock(input_tokens=500, output_tokens=300)
        mock_llm_client.messages.create.return_value = mock_response

        engine = PricingEngine(mock_llm_client)
        quote = engine.generate_quote(simple_analysis, {})

        assert quote.recommended_tier == "Essential"
        assert quote.monthly_price == 850
        assert quote.confidence == 0.9

    def test_generate_quote_llm_failure(self, mock_llm_client, simple_analysis):
        """Test quote generation with LLM failure."""
        mock_llm_client.messages.create.side_effect = Exception("API Error")

        engine = PricingEngine(mock_llm_client, max_retries=1)
        quote = engine.generate_quote(simple_analysis, {})

        # Should return default quote
        assert quote.recommended_tier == "Essential"
        assert quote.monthly_price == 750
        assert quote.confidence == 0.3


class TestQuoteFormatting:
    """Tests for quote display formatting."""

    def test_format_quote_display(self, pricing_engine, sample_quote, complex_analysis):
        """Test quote display formatting."""
        display = pricing_engine.format_quote_display(sample_quote, complex_analysis)

        assert "PRICING QUOTE" in display
        assert "Professional" in display
        assert "$1,500" in display
        assert "RATIONALE" in display
        assert "ONE-TIME FEES" in display
        assert "INCLUDED SERVICES" in display
        assert "KEY FACTORS" in display

    def test_format_quote_display_no_cleanup(self, pricing_engine, simple_analysis):
        """Test display without cleanup fee."""
        quote = Quote(
            recommended_tier="Essential",
            monthly_price=750,
            price_rationale="Simple business",
            included_services=["Bookkeeping"],
            key_factors=["Low volume"],
        )
        display = pricing_engine.format_quote_display(quote, simple_analysis)

        assert "ONE-TIME FEES" not in display or "N/A" in display

    def test_format_quote_display_with_addons(self, pricing_engine, sample_quote, complex_analysis):
        """Test display with add-ons."""
        display = pricing_engine.format_quote_display(sample_quote, complex_analysis)

        assert "RECOMMENDED ADD-ONS" in display
        assert "Sales Tax" in display


class TestProposalGeneration:
    """Tests for proposal document generation."""

    def test_generate_proposal_success(self, mock_llm_client, sample_quote, complex_analysis):
        """Test successful proposal generation."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text="""# Bookkeeping Services Proposal

## Executive Summary

We are pleased to present our comprehensive bookkeeping proposal...

## Investment

Monthly fee: $1,500
"""
            )
        ]
        mock_response.usage = MagicMock(input_tokens=800, output_tokens=500)
        mock_llm_client.messages.create.return_value = mock_response

        engine = PricingEngine(mock_llm_client)
        proposal = engine.generate_proposal_markdown(
            sample_quote, complex_analysis, "Acme Corp", "John Smith"
        )

        assert "Bookkeeping Services Proposal" in proposal
        assert "$1,500" in proposal

    def test_generate_proposal_fallback(self, mock_llm_client, sample_quote, complex_analysis):
        """Test fallback proposal on LLM failure."""
        mock_llm_client.messages.create.side_effect = Exception("API Error")

        engine = PricingEngine(mock_llm_client, max_retries=1)
        proposal = engine.generate_proposal_markdown(
            sample_quote, complex_analysis, "Acme Corp"
        )

        # Should return fallback proposal
        assert "Acme Corp" in proposal
        assert "Professional" in proposal
        assert "Next Steps" in proposal


# =============================================================================
# AllSolutions Tiers and Add-ons Tests
# =============================================================================


class TestAllSolutionsTiers:
    """Tests for AllSolutions tier definitions."""

    def test_tier_count(self):
        """Test correct number of tiers."""
        assert len(ALLSOLUTIONS_TIERS) == 3

    def test_tier_order(self):
        """Test tiers are in price order."""
        prices = [t.min_price for t in ALLSOLUTIONS_TIERS]
        assert prices == sorted(prices)

    def test_essential_tier(self):
        """Test Essential tier configuration."""
        essential = ALLSOLUTIONS_TIERS[0]

        assert essential.name == "Essential"
        assert essential.min_price == 750
        assert essential.max_price == 1250
        assert essential.accounting_basis == AccountingBasis.CASH
        assert essential.max_accounts == 5

    def test_professional_tier(self):
        """Test Professional tier configuration."""
        professional = ALLSOLUTIONS_TIERS[1]

        assert professional.name == "Professional"
        assert professional.min_price == 1250
        assert professional.max_price == 2000
        assert professional.accounting_basis == AccountingBasis.MODIFIED_ACCRUAL
        assert professional.max_ar_ap_entries == 30

    def test_elite_tier(self):
        """Test Elite tier configuration."""
        elite = ALLSOLUTIONS_TIERS[2]

        assert elite.name == "Elite"
        assert elite.min_price == 2000
        assert elite.max_price == 5000
        assert elite.accounting_basis == AccountingBasis.FULL_ACCRUAL
        assert elite.max_accounts == 999  # Unlimited

    def test_tier_price_ranges_dont_overlap(self):
        """Test tier price ranges are contiguous."""
        for i in range(len(ALLSOLUTIONS_TIERS) - 1):
            current = ALLSOLUTIONS_TIERS[i]
            next_tier = ALLSOLUTIONS_TIERS[i + 1]
            # Max of current should equal min of next (contiguous)
            assert current.max_price == next_tier.min_price


class TestAllSolutionsAddons:
    """Tests for AllSolutions add-on definitions."""

    def test_addon_count(self):
        """Test reasonable number of add-ons."""
        assert len(ALLSOLUTIONS_ADDONS) >= 5

    def test_addon_categories(self):
        """Test add-ons cover different categories."""
        categories = {a.category for a in ALLSOLUTIONS_ADDONS}
        assert AddOnCategory.ADVISORY in categories
        assert AddOnCategory.COMPLIANCE in categories

    def test_cfo_services_addon(self):
        """Test CFO Services add-on."""
        cfo = next(a for a in ALLSOLUTIONS_ADDONS if a.name == "CFO Services")

        assert cfo.category == AddOnCategory.ADVISORY
        assert "budget" in cfo.triggers or "kpi" in cfo.triggers

    def test_sales_tax_addon(self):
        """Test Sales Tax add-on."""
        sales_tax = next(a for a in ALLSOLUTIONS_ADDONS if a.name == "Sales Tax")

        assert sales_tax.category == AddOnCategory.COMPLIANCE
        assert "Avalara" in sales_tax.description

    def test_all_addons_have_pricing_note(self):
        """Test all add-ons have pricing information."""
        for addon in ALLSOLUTIONS_ADDONS:
            assert addon.pricing_note, f"{addon.name} missing pricing_note"


# =============================================================================
# Edge Cases
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_zero_values_analysis(self):
        """Test analysis with all zero values."""
        analysis = ClientAnalysis()
        assert analysis.total_accounts == 0
        assert analysis.complexity_level == ComplexityLevel.LOW

    def test_max_complexity(self):
        """Test maximum complexity analysis."""
        analysis = ClientAnalysis(
            monthly_transactions=5000,
            bank_accounts=20,
            credit_cards=10,
            platforms=["Shopify", "Amazon", "Etsy", "eBay"],
            payment_processors=["Stripe", "PayPal", "Square", "Affirm"],
            has_inventory=True,
            needs_accrual=True,
            needs_ar=True,
            needs_ap=True,
            state_count=50,
        )
        assert analysis.complexity_level == ComplexityLevel.VERY_HIGH

    def test_quote_without_optional_fields(self):
        """Test quote with minimal fields."""
        quote = Quote(
            recommended_tier="Essential",
            monthly_price=750,
            price_rationale="Basic",
        )
        assert quote.cleanup_fee is None
        assert quote.setup_fee is None
        assert quote.total_first_month == 750
        assert quote.valid_until is not None

    def test_empty_samples_formatting(self, pricing_engine):
        """Test formatting with empty samples."""
        formatted = pricing_engine._format_samples({})
        assert formatted == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
