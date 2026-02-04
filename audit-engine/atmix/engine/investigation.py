"""Investigation engine for atmix v3.

Enables iterative analysis where the LLM can ask follow-up questions,
request documents, and refine findings based on new information.

This module provides:
- InvestigationEngine: Main orchestrator for LLM-driven investigation
- Data classes for questions, document requests, and investigation plans
- Formatting utilities for CLI display
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple

logger = logging.getLogger(__name__)


class InvestigationPriority(Enum):
    """Priority levels for investigation items.

    BLOCKING: Analysis cannot proceed meaningfully without this information.
    HIGH: Significantly impacts the accuracy or completeness of findings.
    MEDIUM: Would improve confidence in existing findings.
    LOW: Nice to have, marginal improvement to analysis.
    """

    BLOCKING = "blocking"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

    @classmethod
    def from_string(cls, value: str) -> "InvestigationPriority":
        """Parse priority from string, defaulting to MEDIUM for unknown values."""
        try:
            return cls(value.lower())
        except ValueError:
            logger.warning(f"Unknown priority value '{value}', defaulting to MEDIUM")
            return cls.MEDIUM

    @property
    def icon(self) -> str:
        """Return a visual indicator for CLI display."""
        icons = {
            self.BLOCKING: "\u274c",  # Red X
            self.HIGH: "\U0001F7E0",  # Orange circle
            self.MEDIUM: "\U0001F7E1",  # Yellow circle
            self.LOW: "\U0001F7E2",  # Green circle
        }
        return icons.get(self, "\u2022")  # Bullet fallback

    def __lt__(self, other: "InvestigationPriority") -> bool:
        """Enable sorting by priority (blocking first)."""
        order = [self.BLOCKING, self.HIGH, self.MEDIUM, self.LOW]
        return order.index(self) < order.index(other)


@dataclass
class Question:
    """A question to ask the user during investigation.

    Attributes:
        question: The question text to present to the user.
        why_asking: Explanation of why this information is needed.
        related_finding: Title of the finding this question relates to.
        priority: How important the answer is for analysis quality.
        options: Optional list of suggested answers (multiple choice).
    """

    question: str
    why_asking: str
    related_finding: Optional[str] = None
    priority: InvestigationPriority = InvestigationPriority.MEDIUM
    options: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "question": self.question,
            "why_asking": self.why_asking,
            "related_finding": self.related_finding,
            "priority": self.priority.value,
            "options": self.options,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Question":
        """Create from dictionary."""
        return cls(
            question=data.get("question", ""),
            why_asking=data.get("why_asking", ""),
            related_finding=data.get("related_finding"),
            priority=InvestigationPriority.from_string(data.get("priority", "medium")),
            options=data.get("options"),
        )


@dataclass
class DocumentRequest:
    """A request for a specific document from the user.

    Attributes:
        document_name: Short name/identifier for the document.
        description: What the document contains.
        why_needed: How this document would improve the analysis.
        how_to_get: Instructions for the user on obtaining the document.
        priority: How important this document is for analysis quality.
        related_finding: Title of the finding this request relates to.
    """

    document_name: str
    description: str
    why_needed: str
    how_to_get: str
    priority: InvestigationPriority = InvestigationPriority.MEDIUM
    related_finding: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "document_name": self.document_name,
            "description": self.description,
            "why_needed": self.why_needed,
            "how_to_get": self.how_to_get,
            "priority": self.priority.value,
            "related_finding": self.related_finding,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentRequest":
        """Create from dictionary."""
        return cls(
            document_name=data.get("document_name", ""),
            description=data.get("description", ""),
            why_needed=data.get("why_needed", ""),
            how_to_get=data.get("how_to_get", ""),
            priority=InvestigationPriority.from_string(data.get("priority", "medium")),
            related_finding=data.get("related_finding"),
        )


@dataclass
class AdditionalAnalysis:
    """An additional analysis that could be performed.

    Attributes:
        name: Short name for the analysis.
        description: What the analysis would examine.
        why_needed: How this would improve audit quality.
        data_required: List of data sources needed (files or requested docs).
        priority: How important this analysis is.
    """

    name: str
    description: str
    why_needed: str
    data_required: List[str] = field(default_factory=list)
    priority: InvestigationPriority = InvestigationPriority.MEDIUM

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "why_needed": self.why_needed,
            "data_required": self.data_required,
            "priority": self.priority.value,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AdditionalAnalysis":
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            why_needed=data.get("why_needed", ""),
            data_required=data.get("data_required", []),
            priority=InvestigationPriority.from_string(data.get("priority", "medium")),
        )


@dataclass
class InvestigationPlan:
    """Complete plan for investigating findings.

    Contains all questions, document requests, and additional analyses
    identified by the LLM as potentially valuable for improving the audit.

    Attributes:
        questions: Questions to ask the user.
        document_requests: Documents that would help the analysis.
        additional_analyses: Further analyses that could be performed.
        summary: Brief overall summary of investigation needs.
    """

    questions: List[Question] = field(default_factory=list)
    document_requests: List[DocumentRequest] = field(default_factory=list)
    additional_analyses: List[AdditionalAnalysis] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "questions": [q.to_dict() for q in self.questions],
            "document_requests": [d.to_dict() for d in self.document_requests],
            "additional_analyses": [a.to_dict() for a in self.additional_analyses],
            "summary": self.summary,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InvestigationPlan":
        """Create from dictionary."""
        return cls(
            questions=[Question.from_dict(q) for q in data.get("questions", [])],
            document_requests=[
                DocumentRequest.from_dict(d) for d in data.get("document_requests", [])
            ],
            additional_analyses=[
                AdditionalAnalysis.from_dict(a) for a in data.get("additional_analyses", [])
            ],
            summary=data.get("summary", ""),
        )

    @property
    def is_empty(self) -> bool:
        """Check if the plan has no investigation items."""
        return not (self.questions or self.document_requests or self.additional_analyses)

    @property
    def has_blocking_items(self) -> bool:
        """Check if any items are blocking priority."""
        blocking_questions = any(
            q.priority == InvestigationPriority.BLOCKING for q in self.questions
        )
        blocking_docs = any(
            d.priority == InvestigationPriority.BLOCKING for d in self.document_requests
        )
        blocking_analyses = any(
            a.priority == InvestigationPriority.BLOCKING for a in self.additional_analyses
        )
        return blocking_questions or blocking_docs or blocking_analyses

    def get_sorted_questions(self) -> List[Question]:
        """Get questions sorted by priority (most important first)."""
        return sorted(self.questions, key=lambda q: q.priority)

    def get_sorted_document_requests(self) -> List[DocumentRequest]:
        """Get document requests sorted by priority (most important first)."""
        return sorted(self.document_requests, key=lambda d: d.priority)


@dataclass
class InvestigationResult:
    """Result after incorporating new information from investigation.

    Attributes:
        original_findings: The findings before investigation.
        updated_findings: Findings after incorporating new information.
        new_findings: Newly discovered findings from additional information.
        resolved_questions: Questions that are now answered.
        remaining_questions: Questions still outstanding.
        confidence_improvements: Map of finding titles to new confidence scores.
    """

    original_findings: List[Dict[str, Any]]
    updated_findings: List[Dict[str, Any]]
    new_findings: List[Dict[str, Any]] = field(default_factory=list)
    resolved_questions: List[str] = field(default_factory=list)
    remaining_questions: List[str] = field(default_factory=list)
    confidence_improvements: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "original_findings": self.original_findings,
            "updated_findings": self.updated_findings,
            "new_findings": self.new_findings,
            "resolved_questions": self.resolved_questions,
            "remaining_questions": self.remaining_questions,
            "confidence_improvements": self.confidence_improvements,
        }

    @property
    def findings_changed(self) -> bool:
        """Check if any findings were modified."""
        return len(self.original_findings) != len(self.updated_findings) or \
               bool(self.new_findings) or bool(self.confidence_improvements)

    @property
    def total_findings(self) -> int:
        """Total number of findings after investigation."""
        return len(self.updated_findings) + len(self.new_findings)


class LLMClient(Protocol):
    """Protocol defining the expected interface for an LLM client."""

    def messages_create(
        self,
        model: str,
        max_tokens: int,
        messages: List[Dict[str, str]],
    ) -> Any:
        """Create a message completion."""
        ...


class InvestigationEngine:
    """LLM-driven investigation engine for iterative analysis refinement.

    This engine allows the LLM to:
    1. Analyze findings and identify what needs further investigation
    2. Generate targeted questions for the user
    3. Request specific documents that would help
    4. Refine findings based on new information

    Example usage:
        engine = InvestigationEngine(llm_client)

        # Analyze what needs investigation
        plan = engine.analyze_investigation_needs(
            findings=findings,
            business_context=context,
            available_data=["file1.csv", "file2.xlsx"],
        )

        # Display to user and collect responses
        print(engine.format_investigation_gate(plan))

        # After user provides answers/documents, refine findings
        result = engine.refine_findings(
            original_findings=findings,
            question_answers={"Q1": "Answer 1"},
            new_documents={"doc.pdf": "content..."},
            business_context=context,
        )
    """

    # Model to use for investigation analysis
    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    # Maximum tokens for LLM responses
    MAX_TOKENS = 4000

    # Maximum characters for document content in prompts
    MAX_DOC_CHARS = 5000

    def __init__(self, llm_client: Any, model: Optional[str] = None):
        """Initialize the investigation engine.

        Args:
            llm_client: Anthropic client instance for LLM calls.
            model: Model identifier to use. Defaults to DEFAULT_MODEL.
        """
        self.llm_client = llm_client
        self.model = model or self.DEFAULT_MODEL

    def analyze_investigation_needs(
        self,
        findings: List[Dict[str, Any]],
        business_context: Dict[str, Any],
        available_data: List[str],
    ) -> InvestigationPlan:
        """Analyze findings and decide what needs investigation.

        Uses the LLM to examine current findings and business context to identify:
        - Questions that would clarify or verify findings
        - Documents that would provide additional evidence
        - Additional analyses that could be performed

        Args:
            findings: Current audit findings as dictionaries.
            business_context: Business context provided by user.
            available_data: List of available data file names.

        Returns:
            InvestigationPlan containing questions, document requests, and analyses.
        """
        if not findings:
            logger.info("No findings to investigate")
            return InvestigationPlan(summary="No findings to investigate")

        prompt = self._build_investigation_prompt(
            findings=findings,
            business_context=business_context,
            available_data=available_data,
        )

        try:
            response = self.llm_client.messages.create(
                model=self.model,
                max_tokens=self.MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text.strip()
            return self._parse_investigation_plan(content)

        except Exception as e:
            logger.error(f"Investigation analysis failed: {e}")
            return InvestigationPlan(summary=f"Investigation analysis failed: {e}")

    def refine_findings(
        self,
        original_findings: List[Dict[str, Any]],
        question_answers: Dict[str, str],
        new_documents: Dict[str, str],
        business_context: Dict[str, Any],
    ) -> InvestigationResult:
        """Refine findings based on new information from the user.

        Incorporates user answers to questions and newly provided documents
        to update, confirm, or modify existing findings.

        Args:
            original_findings: The initial findings before investigation.
            question_answers: Map of question text to user's answer.
            new_documents: Map of document name to document content.
            business_context: Updated business context.

        Returns:
            InvestigationResult with updated and new findings.
        """
        if not original_findings:
            return InvestigationResult(
                original_findings=[],
                updated_findings=[],
            )

        # If no new information provided, return unchanged
        if not question_answers and not new_documents:
            logger.info("No new information provided, findings unchanged")
            return InvestigationResult(
                original_findings=original_findings,
                updated_findings=original_findings,
            )

        prompt = self._build_refinement_prompt(
            original_findings=original_findings,
            question_answers=question_answers,
            new_documents=new_documents,
            business_context=business_context,
        )

        try:
            response = self.llm_client.messages.create(
                model=self.model,
                max_tokens=self.MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text.strip()
            return self._parse_investigation_result(content, original_findings)

        except Exception as e:
            logger.error(f"Finding refinement failed: {e}")
            return InvestigationResult(
                original_findings=original_findings,
                updated_findings=original_findings,
                remaining_questions=[str(e)],
            )

    def format_investigation_gate(self, plan: InvestigationPlan) -> str:
        """Format investigation plan for CLI display.

        Produces a formatted string suitable for terminal output that presents
        the investigation plan in a clear, actionable format.

        Args:
            plan: The investigation plan to format.

        Returns:
            Formatted string for display.
        """
        lines = [
            "=" * 60,
            "INVESTIGATION RECOMMENDED",
            "=" * 60,
            "",
        ]

        if plan.summary:
            lines.append(plan.summary)
            lines.append("")

        # Questions section
        if plan.questions:
            lines.append("\u2500" * 40)
            lines.append("QUESTIONS FOR CLIENT")
            lines.append("\u2500" * 40)

            for i, q in enumerate(plan.get_sorted_questions(), 1):
                lines.append(f"\n{q.priority.icon} {i}. {q.question}")
                lines.append(f"   Why: {q.why_asking}")
                if q.related_finding:
                    lines.append(f"   Related to: {q.related_finding}")
                if q.options:
                    for opt in q.options:
                        lines.append(f"   \u2022 {opt}")

        # Document requests section
        if plan.document_requests:
            lines.append("")
            lines.append("\u2500" * 40)
            lines.append("DOCUMENT REQUESTS")
            lines.append("\u2500" * 40)

            for i, d in enumerate(plan.get_sorted_document_requests(), 1):
                lines.append(f"\n{d.priority.icon} {i}. {d.document_name}")
                lines.append(f"   {d.description}")
                lines.append(f"   Why: {d.why_needed}")
                lines.append(f"   How to get: {d.how_to_get}")
                if d.related_finding:
                    lines.append(f"   Related to: {d.related_finding}")

        # Additional analyses section
        if plan.additional_analyses:
            lines.append("")
            lines.append("\u2500" * 40)
            lines.append("ADDITIONAL ANALYSES POSSIBLE")
            lines.append("\u2500" * 40)

            for i, a in enumerate(plan.additional_analyses, 1):
                lines.append(f"\n{a.priority.icon} {i}. {a.name}")
                lines.append(f"   {a.description}")
                lines.append(f"   Why: {a.why_needed}")
                if a.data_required:
                    lines.append(f"   Requires: {', '.join(a.data_required)}")

        # Summary footer
        lines.append("")
        lines.append("=" * 60)

        # Add blocking warning if applicable
        if plan.has_blocking_items:
            lines.insert(4, "\u26a0\ufe0f  BLOCKING ITEMS: Some items are required for accurate analysis")
            lines.insert(5, "")

        return "\n".join(lines)

    def format_investigation_result(self, result: InvestigationResult) -> str:
        """Format investigation result for CLI display.

        Args:
            result: The investigation result to format.

        Returns:
            Formatted string for display.
        """
        lines = [
            "=" * 60,
            "INVESTIGATION COMPLETE",
            "=" * 60,
            "",
        ]

        # Summary statistics
        lines.append(f"Original findings: {len(result.original_findings)}")
        lines.append(f"Updated findings: {len(result.updated_findings)}")
        lines.append(f"New findings: {len(result.new_findings)}")
        lines.append("")

        # Confidence improvements
        if result.confidence_improvements:
            lines.append("\u2500" * 40)
            lines.append("CONFIDENCE IMPROVEMENTS")
            lines.append("\u2500" * 40)
            for title, confidence in result.confidence_improvements.items():
                lines.append(f"  \u2022 {title}: {confidence:.0%}")
            lines.append("")

        # New findings
        if result.new_findings:
            lines.append("\u2500" * 40)
            lines.append("NEW FINDINGS DISCOVERED")
            lines.append("\u2500" * 40)
            for f in result.new_findings:
                severity = f.get("severity", "info").upper()
                title = f.get("title", "Unknown")
                lines.append(f"  [{severity}] {title}")
            lines.append("")

        # Resolved questions
        if result.resolved_questions:
            lines.append("\u2500" * 40)
            lines.append("QUESTIONS RESOLVED")
            lines.append("\u2500" * 40)
            for q in result.resolved_questions:
                lines.append(f"  \u2713 {q}")
            lines.append("")

        # Remaining questions
        if result.remaining_questions:
            lines.append("\u2500" * 40)
            lines.append("QUESTIONS REMAINING")
            lines.append("\u2500" * 40)
            for q in result.remaining_questions:
                lines.append(f"  \u2022 {q}")
            lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)

    # =========================================================================
    # Private helper methods
    # =========================================================================

    def _build_investigation_prompt(
        self,
        findings: List[Dict[str, Any]],
        business_context: Dict[str, Any],
        available_data: List[str],
    ) -> str:
        """Build the prompt for investigation needs analysis."""
        findings_text = self._format_findings_for_prompt(findings)
        context_text = self._format_context_for_prompt(business_context)
        data_list = "\n".join(f"- {f}" for f in available_data)

        return f'''You are a senior CPA conducting due diligence for a potential business acquisition.
Before trusting any numbers, you must verify the foundational assumptions underlying this data.

FINDINGS:
{findings_text}

BUSINESS CONTEXT (what the client told us):
{context_text}

AVAILABLE DATA:
{data_list}

Your investigation has TWO phases:

PHASE 1: FOUNDATIONAL ASSUMPTIONS
Before analyzing specific findings, identify assumptions about this data that could
invalidate your entire analysis if wrong. Consider:
- Accounting method (cash vs accrual basis) - this changes how to interpret AR, AP, revenue timing
- Reporting period and cutoff dates
- Entity scope (consolidated vs single entity)
- Data completeness (is this everything, or a subset?)
- Chart of accounts consistency

These are BLOCKING questions - you cannot trust findings without confirming the foundation.

PHASE 2: FINDING-SPECIFIC INVESTIGATION
Then review findings and identify what needs clarification or verification.

Identify:

1. QUESTIONS FOR THE CLIENT
   - FIRST: What foundational assumptions need verification?
   - THEN: What clarifications would help verify or refine specific findings?
   - Focus on questions where the answer materially affects the analysis
   - Do NOT assume you can infer accounting method from data patterns - ASK explicitly

2. DOCUMENT REQUESTS
   - What additional documents would help verify findings?
   - Be specific about what document and why it helps
   - Include practical instructions for how to get the document
   - Consider what's realistic for a small/medium business to provide

3. ADDITIONAL ANALYSES
   - What other analyses should we run with current data?
   - What analyses could we run if we got the requested documents?

For each item, explain WHY it would help and rate priority:
- BLOCKING: Cannot complete meaningful audit without this
- HIGH: Significantly impacts findings accuracy
- MEDIUM: Would improve confidence
- LOW: Nice to have, marginal improvement

Output valid JSON only (no markdown, no explanation outside JSON):
{{
    "questions": [
        {{
            "question": "Clear, specific question text",
            "why_asking": "How the answer will improve the analysis",
            "related_finding": "Title of related finding or null",
            "priority": "blocking|high|medium|low",
            "options": ["option1", "option2"] or null
        }}
    ],
    "document_requests": [
        {{
            "document_name": "Short document identifier",
            "description": "What the document contains",
            "why_needed": "How it improves the analysis",
            "how_to_get": "Practical instructions for the user",
            "priority": "blocking|high|medium|low",
            "related_finding": "Title or null"
        }}
    ],
    "additional_analyses": [
        {{
            "name": "Analysis name",
            "description": "What it would examine",
            "why_needed": "How it improves audit quality",
            "data_required": ["file1.csv", "Requested Document X"],
            "priority": "blocking|high|medium|low"
        }}
    ],
    "summary": "One-paragraph summary of the most important investigation needs"
}}'''

    def _build_refinement_prompt(
        self,
        original_findings: List[Dict[str, Any]],
        question_answers: Dict[str, str],
        new_documents: Dict[str, str],
        business_context: Dict[str, Any],
    ) -> str:
        """Build the prompt for findings refinement."""
        findings_text = self._format_findings_for_prompt(original_findings)
        qa_text = self._format_qa_for_prompt(question_answers)
        docs_text = self._format_documents_for_prompt(new_documents)
        context_text = self._format_context_for_prompt(business_context)

        return f'''You previously generated audit findings. Now you have additional information.
Review and update the findings based on the new information.

ORIGINAL FINDINGS:
{findings_text}

NEW INFORMATION FROM CLIENT:
{qa_text}

NEW DOCUMENTS PROVIDED:
{docs_text}

UPDATED BUSINESS CONTEXT:
{context_text}

For each original finding:
1. Does the new information confirm, refute, or modify it?
2. Should the severity change based on new evidence?
3. Should the confidence change?
4. Are there new details to add to the finding?

Also identify any NEW findings based on the additional information that weren't apparent before.

Output valid JSON only (no markdown, no explanation outside JSON):
{{
    "updated_findings": [
        {{
            "original_title": "Title of original finding being updated",
            "updated_title": "New title if changed, or same as original",
            "changes": "Description of what changed and why",
            "new_severity": "critical|high|medium|low|info",
            "new_confidence": 0.0-1.0,
            "additional_details": "New details to add, or empty string"
        }}
    ],
    "new_findings": [
        {{
            "title": "Finding title",
            "severity": "critical|high|medium|low|info",
            "description": "Detailed description",
            "source": "Based on: [what new information revealed this]",
            "confidence": 0.0-1.0
        }}
    ],
    "resolved_questions": ["List of questions that are now answered"],
    "remaining_questions": ["List of questions still outstanding or new questions"]
}}'''

    def _format_findings_for_prompt(self, findings: List[Dict[str, Any]]) -> str:
        """Format findings list for inclusion in prompts."""
        if not findings:
            return "No findings yet."

        lines = []
        for f in findings:
            severity = f.get("severity", "info").upper()
            title = f.get("title", "Unknown")
            lines.append(f"- [{severity}] {title}")

            description = f.get("description", f.get("detail", ""))
            if description:
                # Truncate long descriptions
                desc_preview = description[:300]
                if len(description) > 300:
                    desc_preview += "..."
                lines.append(f"  {desc_preview}")

            confidence = f.get("confidence")
            if confidence is not None:
                # Handle both numeric (0.0-1.0) and string ("high", "medium", "low") confidence values
                if isinstance(confidence, (int, float)):
                    lines.append(f"  Confidence: {confidence:.0%}")
                else:
                    lines.append(f"  Confidence: {confidence}")

        return "\n".join(lines)

    def _format_context_for_prompt(self, context: Dict[str, Any]) -> str:
        """Format business context for inclusion in prompts."""
        if not context:
            return "No business context provided."

        lines = []
        for key, value in context.items():
            if value is not None:
                lines.append(f"- {key}: {value}")

        return "\n".join(lines) if lines else "No business context provided."

    def _format_qa_for_prompt(self, qa: Dict[str, str]) -> str:
        """Format question-answer pairs for inclusion in prompts."""
        if not qa:
            return "No answers provided."

        lines = []
        for question, answer in qa.items():
            lines.append(f"Q: {question}")
            lines.append(f"A: {answer}")
            lines.append("")

        return "\n".join(lines)

    def _format_documents_for_prompt(self, docs: Dict[str, str]) -> str:
        """Format document contents for inclusion in prompts."""
        if not docs:
            return "No new documents provided."

        lines = []
        for name, content in docs.items():
            lines.append(f"=== {name} ===")
            # Truncate if too long
            if len(content) > self.MAX_DOC_CHARS:
                lines.append(content[:self.MAX_DOC_CHARS])
                lines.append(f"\n... [truncated, {len(content) - self.MAX_DOC_CHARS} more characters]")
            else:
                lines.append(content)
            lines.append("")

        return "\n".join(lines)

    def _parse_investigation_plan(self, content: str) -> InvestigationPlan:
        """Parse LLM response into InvestigationPlan."""
        data = self._extract_json(content)

        if data is None:
            logger.warning("Could not parse investigation plan JSON")
            return InvestigationPlan(summary="Could not parse investigation plan from LLM response")

        try:
            questions = []
            for q in data.get("questions", []):
                try:
                    questions.append(Question.from_dict(q))
                except Exception as e:
                    logger.warning(f"Failed to parse question: {e}")

            document_requests = []
            for d in data.get("document_requests", []):
                try:
                    document_requests.append(DocumentRequest.from_dict(d))
                except Exception as e:
                    logger.warning(f"Failed to parse document request: {e}")

            additional_analyses = []
            for a in data.get("additional_analyses", []):
                try:
                    additional_analyses.append(AdditionalAnalysis.from_dict(a))
                except Exception as e:
                    logger.warning(f"Failed to parse additional analysis: {e}")

            return InvestigationPlan(
                questions=questions,
                document_requests=document_requests,
                additional_analyses=additional_analyses,
                summary=data.get("summary", ""),
            )

        except Exception as e:
            logger.error(f"Failed to construct InvestigationPlan: {e}")
            return InvestigationPlan(summary=f"Parse error: {e}")

    def _parse_investigation_result(
        self,
        content: str,
        original_findings: List[Dict[str, Any]],
    ) -> InvestigationResult:
        """Parse LLM response into InvestigationResult."""
        data = self._extract_json(content)

        if data is None:
            logger.warning("Could not parse investigation result JSON")
            return InvestigationResult(
                original_findings=original_findings,
                updated_findings=original_findings,
            )

        try:
            # Build map of original findings by title for lookup
            original_by_title = {
                f.get("title", ""): f for f in original_findings
            }

            # Process updated findings
            updated_findings = []
            confidence_improvements = {}
            processed_titles = set()

            for update in data.get("updated_findings", []):
                original_title = update.get("original_title", "")
                original = original_by_title.get(original_title)

                if original:
                    # Create updated finding
                    updated = dict(original)
                    updated["title"] = update.get("updated_title", original.get("title"))
                    updated["severity"] = update.get("new_severity", original.get("severity"))

                    new_confidence = update.get("new_confidence")
                    if new_confidence is not None:
                        updated["confidence"] = new_confidence
                        confidence_improvements[updated["title"]] = new_confidence

                    updated["investigation_notes"] = update.get("changes", "")

                    additional_details = update.get("additional_details")
                    if additional_details:
                        existing_desc = updated.get("description", updated.get("detail", ""))
                        updated["description"] = (
                            f"{existing_desc}\n\nAdditional details from investigation: "
                            f"{additional_details}"
                        )

                    updated_findings.append(updated)
                    processed_titles.add(original_title)

            # Add unchanged findings
            for f in original_findings:
                title = f.get("title", "")
                if title not in processed_titles:
                    updated_findings.append(f)

            # Process new findings
            new_findings = data.get("new_findings", [])

            return InvestigationResult(
                original_findings=original_findings,
                updated_findings=updated_findings,
                new_findings=new_findings,
                resolved_questions=data.get("resolved_questions", []),
                remaining_questions=data.get("remaining_questions", []),
                confidence_improvements=confidence_improvements,
            )

        except Exception as e:
            logger.error(f"Failed to construct InvestigationResult: {e}")
            return InvestigationResult(
                original_findings=original_findings,
                updated_findings=original_findings,
                remaining_questions=[str(e)],
            )

    def _extract_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON from LLM response.

        Handles common LLM JSON issues:
        - Extra text before/after JSON
        - Trailing commas
        - Unbalanced braces (truncated responses)
        """
        if "{" not in content:
            return None

        # Find JSON boundaries
        try:
            start = content.index("{")
            end = content.rindex("}") + 1
            json_str = content[start:end]
        except ValueError:
            return None

        # Try direct parsing first
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Fix common issues
        fixed = json_str

        # Remove trailing commas before } or ]
        fixed = re.sub(r',\s*}', '}', fixed)
        fixed = re.sub(r',\s*]', ']', fixed)

        # Try again
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

        # Try to find last balanced brace position
        depth = 0
        last_valid_end = 0
        for i, char in enumerate(fixed):
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    last_valid_end = i + 1

        if last_valid_end > 0:
            try:
                return json.loads(fixed[:last_valid_end])
            except json.JSONDecodeError:
                pass

        logger.warning("All JSON parsing attempts failed")
        return None
