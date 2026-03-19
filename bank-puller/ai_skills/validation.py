"""AI skill — validate downloaded statement content."""
from __future__ import annotations
from ai_skills.base import runner, AISkillResult, _get_client, AI_MODEL, _update_cost
from utils.logger import log
import json


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
    import anthropic

    client = _get_client()

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
2. Is the statement period for {expected_month}?
3. Does the name/business on the statement roughly match "{expected_client}"?
4. Are there MULTIPLE accounts in this single PDF? (combined statement)

Respond with JSON only."""

    try:
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        _update_cost(response.usage)

        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text

        json_str = text.strip()
        if json_str.startswith("```"):
            lines = json_str.split("\n")
            json_str = "\n".join(lines[1:])
            if json_str.endswith("```"):
                json_str = json_str[:-3].strip()

        parsed = json.loads(json_str)

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
