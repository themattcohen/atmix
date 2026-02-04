"""Research engine for atmix v3.

Allows the LLM to research platforms, accounting practices, and
answer questions via web search when it lacks knowledge.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple

logger = logging.getLogger(__name__)


class ResearchCategory(Enum):
    """Categories of research queries."""

    PLATFORM = "platform"  # E-commerce, payment, sales platforms
    ACCOUNTING = "accounting"  # Accounting practices and standards
    TAX = "tax"  # Tax regulations and compliance
    INDUSTRY = "industry"  # Industry-specific practices
    GENERAL = "general"  # General business questions


class ResearchConfidence(Enum):
    """Confidence levels for research results."""

    HIGH = "high"  # Well-documented, multiple authoritative sources
    MEDIUM = "medium"  # Some authoritative sources, consistent information
    LOW = "low"  # Limited sources or conflicting information
    UNCERTAIN = "uncertain"  # Unable to verify or synthesize reliably


@dataclass
class Source:
    """A source from research."""

    title: str
    url: str
    snippet: str
    credibility: float = 0.5  # 0-1 score for source credibility

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "credibility": self.credibility,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Source":
        return cls(
            title=data.get("title", ""),
            url=data.get("url", ""),
            snippet=data.get("snippet", ""),
            credibility=data.get("credibility", 0.5),
        )


@dataclass
class ResearchResult:
    """Result of a research query."""

    query: str
    sources: List[Source] = field(default_factory=list)
    synthesis: str = ""  # LLM-synthesized answer
    confidence: float = 0.0  # 0-1 how confident in the answer
    confidence_level: ResearchConfidence = ResearchConfidence.UNCERTAIN
    category: ResearchCategory = ResearchCategory.GENERAL
    timestamp: datetime = field(default_factory=datetime.now)
    cached: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "sources": [s.to_dict() for s in self.sources],
            "synthesis": self.synthesis,
            "confidence": self.confidence,
            "confidence_level": self.confidence_level.value,
            "category": self.category.value,
            "timestamp": self.timestamp.isoformat(),
            "cached": self.cached,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ResearchResult":
        return cls(
            query=data.get("query", ""),
            sources=[Source.from_dict(s) for s in data.get("sources", [])],
            synthesis=data.get("synthesis", ""),
            confidence=data.get("confidence", 0.0),
            confidence_level=ResearchConfidence(
                data.get("confidence_level", "uncertain")
            ),
            category=ResearchCategory(data.get("category", "general")),
            timestamp=datetime.fromisoformat(data["timestamp"])
            if "timestamp" in data
            else datetime.now(),
            cached=data.get("cached", False),
            error=data.get("error"),
        )

    @property
    def is_valid(self) -> bool:
        """Check if the research result is valid and usable."""
        return (
            self.error is None
            and len(self.synthesis) > 0
            and self.confidence >= 0.3
        )


class LLMClientProtocol(Protocol):
    """Protocol for LLM client to allow dependency injection."""

    def messages_create(
        self,
        model: str,
        max_tokens: int,
        messages: List[Dict[str, str]],
    ) -> Any:
        """Create a message with the LLM."""
        ...


@dataclass
class CacheEntry:
    """Cache entry for research results."""

    result: ResearchResult
    expires_at: datetime


class ResearchCache:
    """In-memory cache for research results with TTL."""

    def __init__(self, default_ttl_hours: int = 24):
        self._cache: Dict[str, CacheEntry] = {}
        self._default_ttl = timedelta(hours=default_ttl_hours)

    def _make_key(self, query: str, category: Optional[ResearchCategory] = None) -> str:
        """Create a cache key from query and category."""
        normalized = query.lower().strip()
        if category:
            normalized = f"{category.value}:{normalized}"
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def get(
        self, query: str, category: Optional[ResearchCategory] = None
    ) -> Optional[ResearchResult]:
        """Get a cached result if valid."""
        key = self._make_key(query, category)
        entry = self._cache.get(key)

        if entry is None:
            return None

        if datetime.now() > entry.expires_at:
            del self._cache[key]
            return None

        result = entry.result
        result.cached = True
        return result

    def set(
        self,
        query: str,
        result: ResearchResult,
        category: Optional[ResearchCategory] = None,
        ttl: Optional[timedelta] = None,
    ) -> None:
        """Cache a research result."""
        key = self._make_key(query, category)
        expires_at = datetime.now() + (ttl or self._default_ttl)
        self._cache[key] = CacheEntry(result=result, expires_at=expires_at)

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def clear_expired(self) -> int:
        """Remove expired entries and return count removed."""
        now = datetime.now()
        expired_keys = [
            key for key, entry in self._cache.items() if now > entry.expires_at
        ]
        for key in expired_keys:
            del self._cache[key]
        return len(expired_keys)


class ResearchEngine:
    """LLM-driven research via web search.

    This engine allows the LLM to research platforms, accounting practices,
    and answer specific questions via web search when it lacks knowledge.
    It uses Claude's built-in web search capabilities for real-time research.

    Attributes:
        llm_client: The Anthropic client for LLM interactions.
        model: The model to use for research (default: claude-sonnet-4).
        max_retries: Maximum retries for failed requests.
        cache: In-memory cache for research results.
    """

    # Model configuration
    DEFAULT_MODEL = "claude-sonnet-4-20250514"
    MAX_TOKENS_QUERIES = 500
    MAX_TOKENS_RESEARCH = 4000
    MAX_TOKENS_DECISION = 150

    # Retry configuration
    DEFAULT_MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = 1.0
    RETRY_BACKOFF_MULTIPLIER = 2.0

    # Standard platform research questions
    PLATFORM_QUESTIONS = [
        "What accounting reports and exports does {platform} provide?",
        "How do {platform} transactions appear in bank statements?",
        "What fees does {platform} charge and how should they be recorded?",
        "What are common bookkeeping mistakes with {platform}?",
        "How should {platform} be reconciled to accounting software?",
        "What are the revenue recognition considerations for {platform}?",
    ]

    def __init__(
        self,
        llm_client: Any,
        model: Optional[str] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        cache_ttl_hours: int = 24,
    ):
        """Initialize the research engine.

        Args:
            llm_client: Anthropic client for LLM interactions.
            model: Model to use (default: claude-sonnet-4-20250514).
            max_retries: Maximum retry attempts for failed requests.
            cache_ttl_hours: Hours to cache research results.
        """
        self.llm_client = llm_client
        self.model = model or self.DEFAULT_MODEL
        self.max_retries = max_retries
        self._cache = ResearchCache(default_ttl_hours=cache_ttl_hours)

    def _call_llm(
        self,
        prompt: str,
        max_tokens: int,
        system: Optional[str] = None,
    ) -> Tuple[str, Optional[str]]:
        """Make an LLM API call with retry logic.

        Args:
            prompt: The user prompt.
            max_tokens: Maximum tokens for response.
            system: Optional system prompt.

        Returns:
            Tuple of (response_text, error_message).
        """
        messages = [{"role": "user", "content": prompt}]

        delay = self.RETRY_DELAY_SECONDS
        last_error = None

        for attempt in range(self.max_retries):
            try:
                kwargs = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "messages": messages,
                }
                if system:
                    kwargs["system"] = system

                response = self.llm_client.messages.create(**kwargs)
                return response.content[0].text.strip(), None

            except Exception as e:
                last_error = str(e)
                logger.warning(
                    f"LLM call failed (attempt {attempt + 1}/{self.max_retries}): {e}"
                )

                if attempt < self.max_retries - 1:
                    time.sleep(delay)
                    delay *= self.RETRY_BACKOFF_MULTIPLIER

        return "", f"LLM call failed after {self.max_retries} attempts: {last_error}"

    def _generate_search_queries(
        self,
        topic: str,
        questions: List[str],
        context: Optional[str] = None,
    ) -> List[str]:
        """Generate effective search queries for a topic.

        Args:
            topic: The main topic or platform.
            questions: Specific questions to answer.
            context: Optional additional context.

        Returns:
            List of search query strings.
        """
        questions_text = "\n".join(f"- {q}" for q in questions)
        context_text = f"\nContext: {context}" if context else ""

        prompt = f"""Generate 3-5 web search queries to find information about {topic} for accounting and bookkeeping purposes.

Questions to answer:
{questions_text}
{context_text}

Return ONLY the search queries, one per line. Make queries specific and actionable.
Focus on official documentation, accounting guides, and professional resources."""

        response, error = self._call_llm(prompt, self.MAX_TOKENS_QUERIES)

        if error:
            logger.warning(f"Failed to generate queries: {error}")
            # Fall back to simple query generation
            return [f"{topic} accounting guide", f"{topic} bookkeeping best practices"]

        queries = [q.strip() for q in response.split("\n") if q.strip()]
        return queries[:5]  # Limit to 5 queries

    def _assess_confidence(self, synthesis: str, sources: List[Source]) -> Tuple[float, ResearchConfidence]:
        """Assess confidence in a research result.

        Args:
            synthesis: The synthesized answer.
            sources: List of sources used.

        Returns:
            Tuple of (confidence_score, confidence_level).
        """
        # Base confidence from source count and credibility
        if not sources:
            return 0.3, ResearchConfidence.LOW

        source_score = min(len(sources) / 5.0, 1.0) * 0.3
        avg_credibility = sum(s.credibility for s in sources) / len(sources)
        credibility_score = avg_credibility * 0.4

        # Content quality indicators
        content_score = 0.0
        synthesis_lower = synthesis.lower()

        # Positive indicators
        if "official documentation" in synthesis_lower:
            content_score += 0.1
        if any(term in synthesis_lower for term in ["according to", "states that", "recommends"]):
            content_score += 0.1
        if len(synthesis) > 500:  # Substantial content
            content_score += 0.1

        # Negative indicators
        if "unable to find" in synthesis_lower or "no information" in synthesis_lower:
            content_score -= 0.2
        if "may vary" in synthesis_lower or "consult" in synthesis_lower:
            content_score -= 0.05

        total = max(0.0, min(1.0, source_score + credibility_score + content_score))

        # Map to confidence level
        if total >= 0.7:
            level = ResearchConfidence.HIGH
        elif total >= 0.5:
            level = ResearchConfidence.MEDIUM
        elif total >= 0.3:
            level = ResearchConfidence.LOW
        else:
            level = ResearchConfidence.UNCERTAIN

        return total, level

    def research_platform(
        self,
        platform: str,
        questions: Optional[List[str]] = None,
        context: Optional[str] = None,
        skip_cache: bool = False,
    ) -> ResearchResult:
        """Research a specific platform to answer accounting questions.

        Args:
            platform: Platform name (e.g., "Shopify", "Amazon Seller Central").
            questions: Specific questions to answer (uses defaults if None).
            context: Optional context about the business.
            skip_cache: If True, bypass cache and force fresh research.

        Returns:
            ResearchResult with synthesized knowledge.
        """
        # Check cache first (unless skip_cache is True)
        cache_key = f"platform:{platform.lower()}"
        if not skip_cache:
            cached = self._cache.get(cache_key, ResearchCategory.PLATFORM)
            if cached:
                logger.info(f"Using cached research for platform: {platform}")
                return cached

        # Use default questions if none provided
        if questions is None:
            questions = [q.format(platform=platform) for q in self.PLATFORM_QUESTIONS]

        # Generate search queries
        search_queries = self._generate_search_queries(platform, questions, context)

        # Build research prompt
        questions_text = "\n".join(f"- {q}" for q in questions)
        queries_text = "\n".join(f"- {q}" for q in search_queries)

        research_prompt = f"""Research {platform} for accounting and bookkeeping purposes.

QUESTIONS TO ANSWER:
{questions_text}

SUGGESTED SEARCH QUERIES:
{queries_text}

Search the web to find authoritative answers to these questions. Focus on:
1. Official {platform} documentation and help articles
2. Professional accounting guides and best practices
3. Common issues and their solutions
4. Fee structures and recording methods
5. Reconciliation procedures and tips

Provide a comprehensive, actionable summary. Include:
- Specific steps and procedures where applicable
- Common pitfalls and how to avoid them
- References to official documentation when available

Be specific and practical. Avoid generic advice."""

        system_prompt = """You are a research assistant specializing in accounting and bookkeeping.
Your goal is to find accurate, actionable information from authoritative sources.
Always cite your sources and distinguish between official documentation and community advice.
If information is uncertain or varies, clearly state the caveats."""

        response, error = self._call_llm(
            research_prompt,
            self.MAX_TOKENS_RESEARCH,
            system=system_prompt,
        )

        if error:
            return ResearchResult(
                query=f"Platform research: {platform}",
                category=ResearchCategory.PLATFORM,
                error=error,
            )

        # Note: In production, sources would be populated from actual web search results.
        # This implementation relies on Claude's built-in knowledge and web capabilities.
        sources: List[Source] = []

        confidence, confidence_level = self._assess_confidence(response, sources)

        result = ResearchResult(
            query=f"Platform research: {platform}",
            sources=sources,
            synthesis=response,
            confidence=confidence,
            confidence_level=confidence_level,
            category=ResearchCategory.PLATFORM,
        )

        # Cache the result
        self._cache.set(cache_key, result, ResearchCategory.PLATFORM)

        return result

    def research_topic(
        self,
        topic: str,
        context: Optional[str] = None,
        category: ResearchCategory = ResearchCategory.GENERAL,
    ) -> ResearchResult:
        """Research a specific topic or question.

        Args:
            topic: The topic or question to research.
            context: Optional context about why we need this info.
            category: Category of research for caching.

        Returns:
            ResearchResult with answer.
        """
        # Check cache
        cached = self._cache.get(topic, category)
        if cached:
            logger.info(f"Using cached research for topic: {topic}")
            return cached

        context_section = f"\nCONTEXT: {context}" if context else ""

        prompt = f"""Research this topic and provide a comprehensive answer:

TOPIC: {topic}
{context_section}

Search the web for current, accurate information. Focus on:
1. Authoritative sources (official documentation, professional standards)
2. Practical, actionable guidance
3. Common issues and best practices
4. Any recent changes or updates

Provide specific details, not generalizations.
Clearly indicate the source of key information.
If information is uncertain or conflicting, explain the different perspectives."""

        system_prompt = """You are a research assistant specializing in business and accounting topics.
Provide accurate, well-sourced information with practical applications.
Distinguish between established practices and newer approaches.
Always note when professional consultation may be advisable."""

        response, error = self._call_llm(
            prompt,
            self.MAX_TOKENS_RESEARCH,
            system=system_prompt,
        )

        if error:
            return ResearchResult(
                query=topic,
                category=category,
                error=error,
            )

        sources: List[Source] = []
        confidence, confidence_level = self._assess_confidence(response, sources)

        result = ResearchResult(
            query=topic,
            sources=sources,
            synthesis=response,
            confidence=confidence,
            confidence_level=confidence_level,
            category=category,
        )

        # Cache the result
        self._cache.set(topic, result, category)

        return result

    def should_research(
        self,
        question: str,
        existing_knowledge: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """Decide if research is needed to answer a question.

        This helps the system decide when to trigger web research vs.
        use existing knowledge.

        Args:
            question: The question that needs answering.
            existing_knowledge: What we already know.

        Returns:
            Tuple of (should_research, reason).
        """
        knowledge_section = (
            f"\nEXISTING KNOWLEDGE:\n{existing_knowledge}" if existing_knowledge else ""
        )

        prompt = f"""Decide if web research is needed to answer this question accurately.

QUESTION: {question}
{knowledge_section}

Consider:
- Is this about specific platform features, reports, or integrations?
- Does it require current/up-to-date information?
- Is there risk of outdated knowledge causing errors?
- Could incorrect information lead to compliance issues?
- Is the existing knowledge sufficient and recent?

Reply with EXACTLY this format:
DECISION: YES or NO
REASON: Brief explanation (one sentence)"""

        response, error = self._call_llm(prompt, self.MAX_TOKENS_DECISION)

        if error:
            # Default to researching on error
            return True, f"Unable to assess - defaulting to research: {error}"

        response_upper = response.upper()

        # Parse the decision
        should_research = "DECISION: YES" in response_upper or response_upper.startswith("YES")

        # Extract reason
        reason = "Research recommended for accuracy"
        if "REASON:" in response.upper():
            reason_start = response.upper().index("REASON:") + 7
            reason = response[reason_start:].strip()
        elif not should_research:
            reason = "Existing knowledge is sufficient"

        return should_research, reason

    def get_platform_knowledge(
        self,
        platform: str,
        force_refresh: bool = False,
    ) -> str:
        """Get or research knowledge about a platform.

        This is a convenience method that first checks cache,
        then researches if needed.

        Args:
            platform: Platform name.
            force_refresh: If True, bypass cache and research fresh.

        Returns:
            Synthesized knowledge about the platform.
        """
        if not force_refresh:
            cache_key = f"platform:{platform.lower()}"
            cached = self._cache.get(cache_key, ResearchCategory.PLATFORM)
            if cached and cached.is_valid:
                return cached.synthesis

        result = self.research_platform(platform, skip_cache=force_refresh)

        if result.error:
            logger.error(f"Failed to research platform {platform}: {result.error}")
            return f"Unable to research {platform}: {result.error}"

        return result.synthesis

    def research_accounting_treatment(
        self,
        scenario: str,
        jurisdiction: str = "US",
        standard: str = "GAAP",
    ) -> ResearchResult:
        """Research proper accounting treatment for a scenario.

        Args:
            scenario: The accounting scenario or transaction type.
            jurisdiction: Tax/regulatory jurisdiction (default: US).
            standard: Accounting standard (default: GAAP).

        Returns:
            ResearchResult with accounting guidance.
        """
        topic = f"Accounting treatment for {scenario} under {standard} ({jurisdiction})"
        context = f"""This is for a business operating in {jurisdiction}.
We need to understand:
- Proper account classification
- Recognition timing
- Disclosure requirements
- Common pitfalls"""

        return self.research_topic(topic, context, ResearchCategory.ACCOUNTING)

    def clear_cache(self) -> None:
        """Clear all cached research results."""
        self._cache.clear()
        logger.info("Research cache cleared")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache statistics.
        """
        expired = self._cache.clear_expired()
        return {
            "entries": len(self._cache._cache),
            "expired_cleared": expired,
        }
