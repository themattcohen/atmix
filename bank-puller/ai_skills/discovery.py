"""AI skill — discover bank login URLs via web search + verification."""
from __future__ import annotations

import json
import anthropic

from ai_skills.base import runner, AISkillResult, call_text_skill, _update_cost
from utils.logger import log


def skill_discover_login_url(bank_name: str) -> AISkillResult:
    """Discover the login URL for a given bank.

    Uses Claude (text-only, no screenshot) to generate the most likely login URL.
    The caller should then verify with HTTP HEAD and actual navigation.

    Returns AISkillResult with:
    - action: "found" or "uncertain"
    - text: the URL
    """
    system_prompt = """You are a bank login URL specialist. Given a bank name, return the most likely consumer/business online banking login URL.

You MUST respond with ONLY a JSON object:
- "action": "found" if you're confident, "uncertain" if not
- "confidence": float 0.0-1.0
- "text": the login URL (full https:// URL)
- "reasoning": why you chose this URL
- "alternatives": list of up to 3 alternative URLs if you're not sure"""

    user_prompt = f"""What is the online banking login URL for: {bank_name}

Important:
- Return the DIRECT login page URL, not the bank's homepage
- For major banks, use the well-known secure login subdomain
- Examples: Chase → https://secure.chase.com/web/auth/dashboard, BofA → https://www.bankofamerica.com/smallbusiness/online-banking/sign-in/
- For credit unions or small banks, provide your best guess
- Include https://

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
        log.warning(f"Login URL discovery failed for {bank_name}: {e}")
        return AISkillResult(
            action="ai_failure",
            confidence=0.0,
            reasoning=str(e),
        )
