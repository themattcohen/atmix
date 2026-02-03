"""Tests for the Research Engine."""

from __future__ import annotations

import pytest
from datetime import datetime, timedelta
from typing import List, Optional
from unittest.mock import MagicMock, patch
from dataclasses import dataclass

from atmix.engine.research import (
    ResearchEngine,
    ResearchResult,
    ResearchCategory,
    ResearchConfidence,
    ResearchCache,
    Source,
    CacheEntry,
)


# ============================================================================
# Fixtures
# ============================================================================


class MockLLMResponse:
    """Mock LLM response object."""

    def __init__(self, text: str):
        self.content = [MagicMock(text=text)]


class MockLLMClient:
    """Mock Anthropic client for testing."""

    def __init__(self, responses: Optional[List[str]] = None):
        self._responses = responses or []
        self._call_count = 0
        self.messages = MagicMock()
        self.messages.create = self._create_response

    def _create_response(self, **kwargs):
        if self._call_count < len(self._responses):
            response = self._responses[self._call_count]
            self._call_count += 1
            return MockLLMResponse(response)
        return MockLLMResponse("Default response")

    def set_responses(self, responses: List[str]):
        self._responses = responses
        self._call_count = 0


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    return MockLLMClient()


@pytest.fixture
def research_engine(mock_llm_client):
    """Create a research engine with mock client."""
    return ResearchEngine(mock_llm_client, cache_ttl_hours=1)


# ============================================================================
# Source Tests
# ============================================================================


class TestSource:
    """Tests for Source dataclass."""

    def test_source_creation(self):
        source = Source(
            title="Shopify Help",
            url="https://help.shopify.com",
            snippet="How to export transactions...",
            credibility=0.9,
        )
        assert source.title == "Shopify Help"
        assert source.url == "https://help.shopify.com"
        assert source.credibility == 0.9

    def test_source_default_credibility(self):
        source = Source(title="Test", url="http://test.com", snippet="test")
        assert source.credibility == 0.5

    def test_source_to_dict(self):
        source = Source(
            title="Test",
            url="http://test.com",
            snippet="snippet",
            credibility=0.8,
        )
        data = source.to_dict()
        assert data["title"] == "Test"
        assert data["url"] == "http://test.com"
        assert data["snippet"] == "snippet"
        assert data["credibility"] == 0.8

    def test_source_from_dict(self):
        data = {
            "title": "Test Source",
            "url": "http://example.com",
            "snippet": "Example snippet",
            "credibility": 0.7,
        }
        source = Source.from_dict(data)
        assert source.title == "Test Source"
        assert source.credibility == 0.7


# ============================================================================
# ResearchResult Tests
# ============================================================================


class TestResearchResult:
    """Tests for ResearchResult dataclass."""

    def test_result_creation(self):
        result = ResearchResult(
            query="Test query",
            synthesis="Test synthesis",
            confidence=0.8,
        )
        assert result.query == "Test query"
        assert result.synthesis == "Test synthesis"
        assert result.confidence == 0.8
        assert result.confidence_level == ResearchConfidence.UNCERTAIN
        assert result.category == ResearchCategory.GENERAL

    def test_result_is_valid_true(self):
        result = ResearchResult(
            query="Test",
            synthesis="Some synthesized content here",
            confidence=0.5,
        )
        assert result.is_valid is True

    def test_result_is_valid_false_low_confidence(self):
        result = ResearchResult(
            query="Test",
            synthesis="Some content",
            confidence=0.2,
        )
        assert result.is_valid is False

    def test_result_is_valid_false_empty_synthesis(self):
        result = ResearchResult(
            query="Test",
            synthesis="",
            confidence=0.8,
        )
        assert result.is_valid is False

    def test_result_is_valid_false_error(self):
        result = ResearchResult(
            query="Test",
            synthesis="Content",
            confidence=0.8,
            error="Some error occurred",
        )
        assert result.is_valid is False

    def test_result_to_dict(self):
        result = ResearchResult(
            query="Test query",
            sources=[Source(title="S1", url="http://s1.com", snippet="s1")],
            synthesis="Synthesized content",
            confidence=0.7,
            confidence_level=ResearchConfidence.MEDIUM,
            category=ResearchCategory.PLATFORM,
        )
        data = result.to_dict()
        assert data["query"] == "Test query"
        assert len(data["sources"]) == 1
        assert data["confidence_level"] == "medium"
        assert data["category"] == "platform"

    def test_result_from_dict(self):
        data = {
            "query": "Test",
            "sources": [{"title": "T", "url": "U", "snippet": "S", "credibility": 0.5}],
            "synthesis": "Synth",
            "confidence": 0.6,
            "confidence_level": "high",
            "category": "accounting",
            "timestamp": "2024-01-15T10:30:00",
            "cached": True,
            "error": None,
        }
        result = ResearchResult.from_dict(data)
        assert result.query == "Test"
        assert len(result.sources) == 1
        assert result.confidence_level == ResearchConfidence.HIGH
        assert result.category == ResearchCategory.ACCOUNTING
        assert result.cached is True


# ============================================================================
# ResearchCache Tests
# ============================================================================


class TestResearchCache:
    """Tests for ResearchCache."""

    def test_cache_set_and_get(self):
        cache = ResearchCache(default_ttl_hours=1)
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)

        cache.set("test query", result)
        cached = cache.get("test query")

        assert cached is not None
        assert cached.synthesis == "content"
        assert cached.cached is True

    def test_cache_get_nonexistent(self):
        cache = ResearchCache()
        assert cache.get("nonexistent") is None

    def test_cache_with_category(self):
        cache = ResearchCache()
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)

        cache.set("shopify", result, ResearchCategory.PLATFORM)

        # Should find with same category
        assert cache.get("shopify", ResearchCategory.PLATFORM) is not None
        # Should not find with different category
        assert cache.get("shopify", ResearchCategory.ACCOUNTING) is None

    def test_cache_expiration(self):
        cache = ResearchCache(default_ttl_hours=1)
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)

        # Manually create an expired entry
        cache._cache["test_key"] = CacheEntry(
            result=result,
            expires_at=datetime.now() - timedelta(hours=1),
        )

        # Should return None for expired entry
        assert cache.get("test_key") is None

    def test_cache_clear(self):
        cache = ResearchCache()
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)
        cache.set("query1", result)
        cache.set("query2", result)

        cache.clear()

        assert cache.get("query1") is None
        assert cache.get("query2") is None

    def test_cache_clear_expired(self):
        cache = ResearchCache()
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)

        # Add valid entry
        cache.set("valid", result)

        # Add expired entry manually
        cache._cache["expired_key"] = CacheEntry(
            result=result,
            expires_at=datetime.now() - timedelta(hours=1),
        )

        cleared = cache.clear_expired()

        assert cleared == 1
        assert cache.get("valid") is not None

    def test_cache_key_normalization(self):
        cache = ResearchCache()
        result = ResearchResult(query="test", synthesis="content", confidence=0.8)

        cache.set("  SHOPIFY  ", result)

        # Should find with different casing and whitespace
        assert cache.get("shopify") is not None
        assert cache.get("  shopify  ") is not None


# ============================================================================
# ResearchEngine Tests
# ============================================================================


class TestResearchEngine:
    """Tests for ResearchEngine."""

    def test_engine_initialization(self, mock_llm_client):
        engine = ResearchEngine(mock_llm_client)
        assert engine.model == ResearchEngine.DEFAULT_MODEL
        assert engine.max_retries == ResearchEngine.DEFAULT_MAX_RETRIES

    def test_engine_custom_model(self, mock_llm_client):
        engine = ResearchEngine(mock_llm_client, model="claude-opus-4-20250514")
        assert engine.model == "claude-opus-4-20250514"

    def test_research_platform_basic(self, research_engine, mock_llm_client):
        # Set up mock responses
        mock_llm_client.set_responses([
            # Query generation response
            "Shopify accounting reports\nShopify bookkeeping guide\nShopify fees recording",
            # Research response
            """Shopify provides several key accounting features:

1. **Reports Available**
   - Sales reports with detailed breakdowns
   - Payout reports showing fees and net amounts
   - Tax reports by region

2. **Fee Structure**
   - Transaction fees (2.4% + 30c for Shopify Payments)
   - Subscription fees recorded monthly

3. **Reconciliation**
   - Match payouts to bank deposits
   - Account for timing differences

According to official Shopify documentation, the recommended approach is...""",
        ])

        result = research_engine.research_platform("Shopify")

        assert result.query == "Platform research: Shopify"
        assert result.category == ResearchCategory.PLATFORM
        assert result.error is None
        assert "Shopify" in result.synthesis
        assert len(result.synthesis) > 100

    def test_research_platform_caching(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Query 1\nQuery 2",
            "First research result for Shopify",
        ])

        # First call
        result1 = research_engine.research_platform("Shopify")
        assert result1.cached is False

        # Second call should use cache
        result2 = research_engine.research_platform("Shopify")
        assert result2.cached is True
        assert result2.synthesis == result1.synthesis

    def test_research_platform_custom_questions(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Custom query",
            "Custom research result",
        ])

        questions = ["How do I handle Shopify refunds?"]
        result = research_engine.research_platform("Shopify", questions=questions)

        assert result.error is None
        # Verify the result was generated (API was called)
        assert mock_llm_client._call_count >= 1
        assert len(result.synthesis) > 0

    def test_research_topic_basic(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Revenue recognition for SaaS follows ASC 606..."
        ])

        result = research_engine.research_topic(
            "Revenue recognition for SaaS subscriptions",
            context="Monthly subscription billing",
        )

        assert result.query == "Revenue recognition for SaaS subscriptions"
        assert result.error is None
        assert len(result.synthesis) > 0

    def test_research_topic_with_category(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses(["Accounting treatment..."])

        result = research_engine.research_topic(
            "Depreciation methods",
            category=ResearchCategory.ACCOUNTING,
        )

        assert result.category == ResearchCategory.ACCOUNTING

    def test_should_research_yes(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "DECISION: YES\nREASON: Platform-specific information requires current documentation."
        ])

        should, reason = research_engine.should_research(
            "What reports does Stripe provide for accounting?"
        )

        assert should is True
        assert "documentation" in reason.lower()

    def test_should_research_no(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "DECISION: NO\nREASON: This is standard accounting knowledge."
        ])

        should, reason = research_engine.should_research(
            "What is a balance sheet?",
            existing_knowledge="A balance sheet shows assets, liabilities, and equity.",
        )

        assert should is False

    def test_should_research_handles_error(self, research_engine, mock_llm_client):
        # Make the client raise an exception
        mock_llm_client.messages.create = MagicMock(
            side_effect=Exception("API Error")
        )

        should, reason = research_engine.should_research("Any question")

        # Should default to True on error
        assert should is True
        assert "unable to assess" in reason.lower()

    def test_get_platform_knowledge_caches(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Search queries",
            "Platform knowledge about Amazon",
        ])

        # First call
        knowledge1 = research_engine.get_platform_knowledge("Amazon")
        assert "Platform knowledge" in knowledge1

        # Reset mock to track new calls
        call_count = mock_llm_client._call_count

        # Second call should use cache
        knowledge2 = research_engine.get_platform_knowledge("Amazon")
        assert knowledge1 == knowledge2
        # No new API calls should have been made
        assert mock_llm_client._call_count == call_count

    def test_get_platform_knowledge_force_refresh(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Search queries",
            "Original knowledge",
            "Search queries",
            "Refreshed knowledge",
        ])

        # First call
        knowledge1 = research_engine.get_platform_knowledge("Amazon")

        # Force refresh
        knowledge2 = research_engine.get_platform_knowledge("Amazon", force_refresh=True)

        # Should have different results (new API call)
        assert knowledge2 == "Refreshed knowledge"

    def test_research_accounting_treatment(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses([
            "Stock-based compensation under GAAP..."
        ])

        result = research_engine.research_accounting_treatment(
            scenario="stock-based compensation",
            jurisdiction="US",
            standard="GAAP",
        )

        assert result.category == ResearchCategory.ACCOUNTING
        assert result.error is None

    def test_clear_cache(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses(["Query", "Result"])

        # Populate cache
        research_engine.research_platform("Test")

        # Clear cache
        research_engine.clear_cache()

        # Cache should be empty
        stats = research_engine.get_cache_stats()
        assert stats["entries"] == 0

    def test_get_cache_stats(self, research_engine, mock_llm_client):
        mock_llm_client.set_responses(["Q1", "R1", "Q2", "R2"])

        research_engine.research_platform("Platform1")
        research_engine.research_topic("Topic1")

        stats = research_engine.get_cache_stats()

        assert "entries" in stats
        assert "expired_cleared" in stats
        assert stats["entries"] >= 2


class TestResearchEngineRetry:
    """Tests for retry logic in ResearchEngine."""

    def test_retry_on_failure(self, mock_llm_client):
        engine = ResearchEngine(mock_llm_client, max_retries=3)

        # Make first two calls fail, third succeeds
        call_count = [0]
        original_create = mock_llm_client.messages.create

        def failing_create(**kwargs):
            call_count[0] += 1
            if call_count[0] < 3:
                raise Exception("Temporary failure")
            return MockLLMResponse("Success after retries")

        mock_llm_client.messages.create = failing_create

        response, error = engine._call_llm("test prompt", 100)

        assert error is None
        assert response == "Success after retries"
        assert call_count[0] == 3

    def test_retry_exhausted(self, mock_llm_client):
        engine = ResearchEngine(mock_llm_client, max_retries=2)

        mock_llm_client.messages.create = MagicMock(
            side_effect=Exception("Persistent failure")
        )

        response, error = engine._call_llm("test prompt", 100)

        assert response == ""
        assert error is not None
        assert "2 attempts" in error


class TestConfidenceAssessment:
    """Tests for confidence assessment logic."""

    def test_high_confidence_with_sources(self, research_engine):
        sources = [
            Source("Official Docs", "http://a.com", "content", 0.9),
            Source("Guide", "http://b.com", "content", 0.8),
            Source("Tutorial", "http://c.com", "content", 0.7),
        ]
        synthesis = """According to official documentation, the process involves...
        The official recommendation states that users should..."""

        confidence, level = research_engine._assess_confidence(synthesis, sources)

        assert confidence >= 0.5
        assert level in (ResearchConfidence.MEDIUM, ResearchConfidence.HIGH)

    def test_low_confidence_no_sources(self, research_engine):
        synthesis = "Some general information"

        confidence, level = research_engine._assess_confidence(synthesis, [])

        assert confidence <= 0.3
        assert level == ResearchConfidence.LOW

    def test_confidence_with_uncertainty_markers(self, research_engine):
        sources = [Source("Source", "http://a.com", "content", 0.5)]
        synthesis = """Unable to find specific information. May vary by situation.
        Please consult a professional."""

        confidence, level = research_engine._assess_confidence(synthesis, sources)

        # Should be lower due to uncertainty markers
        assert confidence < 0.6


# ============================================================================
# Integration Tests
# ============================================================================


class TestResearchEngineIntegration:
    """Integration tests that verify complete workflows."""

    def test_full_platform_research_workflow(self, mock_llm_client):
        """Test complete platform research flow."""
        mock_llm_client.set_responses([
            # Query generation
            "shopify accounting reports\nshopify fee structure",
            # Research synthesis
            """## Shopify Accounting Guide

### Reports Available
Shopify provides comprehensive reporting including:
- Sales reports by product, channel, date
- Payout reports with fee breakdowns
- Tax reports by jurisdiction

### Fee Structure
According to official Shopify documentation:
- Shopify Payments: 2.4% + 30c per transaction
- Third-party payments: Additional 0.5-2%
- Subscription fees: $29-$299/month

### Reconciliation Process
1. Download payout reports
2. Match to bank deposits
3. Record fees as expenses
4. Account for timing differences

Best practice is to reconcile weekly.""",
        ])

        engine = ResearchEngine(mock_llm_client)
        result = engine.research_platform("Shopify")

        # Verify result structure
        assert result.is_valid
        assert result.category == ResearchCategory.PLATFORM
        assert "Shopify" in result.query

        # Verify content quality
        assert "fee" in result.synthesis.lower()
        assert "report" in result.synthesis.lower()

        # Verify serialization
        data = result.to_dict()
        restored = ResearchResult.from_dict(data)
        assert restored.synthesis == result.synthesis

    def test_research_decision_workflow(self, mock_llm_client):
        """Test the should_research decision workflow."""
        mock_llm_client.set_responses([
            "DECISION: YES\nREASON: Need current platform documentation",
            "query1\nquery2",
            "Detailed research results about Stripe...",
        ])

        engine = ResearchEngine(mock_llm_client)

        # First check if research is needed
        should, reason = engine.should_research(
            "What export formats does Stripe support?"
        )

        if should:
            result = engine.research_platform("Stripe")
            assert result.is_valid
