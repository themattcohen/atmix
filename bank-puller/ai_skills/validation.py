"""AI skill — validate downloaded statement content."""
from __future__ import annotations

import json
import anthropic

from ai_skills.base import runner, AISkillResult, call_text_skill, _update_cost
from utils.logger import log


def skill_validate_statement(
    pdf_text: str,
    expected_client: str,
    expected_last4: str,
    expected_month: str,
) -> AISkillResult:
    """Validate that PDF text content matches the expected statement.

    Uses Claude text (not vision) to analyze extracted PDF text.

    Args:
        pdf_text: Extracted text from the PDF (via pdfplumber)
        expected_client: Expected client/business name
        expected_last4: Expected account last 4 digits
        expected_month: Expected month as "YYYY-MM"

    Returns AISkillResult with:
    - action: "valid" if matches, "invalid" if wrong statement, "uncertain" if can't tell
    - text: explanation of what was found
    - raw_response may contain: accounts_found (list of last4s found in PDF)
    """
    # Truncate PDF text to avoid huge API calls
    max_chars = 3000
    truncated = pdf_text[:max_chars] if len(pdf_text) > max_chars else pdf_text

    system_prompt = """You are a bank statement validator. Analyze extracted PDF text and determine if it matches the expected account statement.

You MUST respond with ONLY a JSON object:
- "action": "valid" if the statement matches, "invalid" if it's the wrong statement, "uncertain" if you can't determine
- "confidence": float 0.0-1.0
- "reasoning": explanation of your determination
- "text": what account/date/client info you found in the document
- "accounts_found": list of account last-4 digits found in the PDF
- "statement_period": the statement period found (e.g., "February 1 - February 28, 2026")
- "is_combined": true if PDF contains multiple accounts, false otherwise"""

    user_prompt = f"""Validate this bank statement PDF text.

Expected:
- Client/Business: {expected_client}
- Account ending in: {expected_last4}
- Statement month: {expected_month}

PDF text (first {max_chars} chars):
---
{truncated}
---

Check:
1. Does the account number ending match "{expected_last4}"?
2. Is the statement for {expected_month}? IMPORTANT: For credit card statements, the CLOSING DATE determines the month — a statement closing on Jan 25, 2026 IS a January 2026 statement even if the billing activity covers December. Match on closing date, NOT activity period dates.
3. Does the name/business on the statement roughly match "{expected_client}"? IMPORTANT: The account number match (check #1) is the DEFINITIVE identifier. If the account number matches, mark the statement as VALID even if the name doesn't match perfectly. Personal names on business accounts are common for credit cards (e.g., "Alex Bossi" for "Bossi Sportswear"). Note name mismatches in your reasoning but do NOT mark as invalid solely due to name mismatch when the account number is correct.
4. Are there MULTIPLE accounts in this single PDF? (combined statement)

Respond with JSON only."""

    try:
        parsed, usage, _model = call_text_skill(system_prompt, user_prompt)
        _update_cost(usage)

        return AISkillResult(
            action=parsed.get("action", "uncertain"),
            confidence=float(parsed.get("confidence", 0)),
            text=parsed.get("text", ""),
            reasoning=parsed.get("reasoning", ""),
            raw_response=parsed,
        )

    except (json.JSONDecodeError, anthropic.APIError) as e:
        log.warning(f"Statement validation failed: {e}")
        return AISkillResult(
            action="uncertain",
            confidence=0.0,
            reasoning=str(e),
        )
