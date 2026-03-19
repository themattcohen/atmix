"""AI skill -- read 2FA codes from Dialpad messaging window."""
from __future__ import annotations

from ai_skills.base import runner, AISkillResult
from config import AI_MODEL_FAST


def skill_read_2fa_code(screenshot: bytes, sender_hint: str = "") -> AISkillResult:
    """Read the most recent 2FA verification code from a Dialpad messages screenshot.

    Args:
        screenshot: PNG bytes of the Dialpad messaging window
        sender_hint: Optional known sender ID (e.g., "72166") to help identify
                     the right message

    Returns AISkillResult with:
    - action: "found" if a code was extracted, "not_found" if no new code visible
    - text: the 2FA code (digits only)
    - reasoning: which message contained the code
    """
    sender_info = f"\nKnown sender ID/number: {sender_hint}" if sender_hint else ""

    system_prompt = """You are a 2FA code reader. Look at this messaging application (Dialpad) screenshot and extract the most recent verification/security code.

You MUST respond with ONLY a JSON object:
- "action": "found" if you see a verification code, "not_found" if no code is visible
- "confidence": float 0.0-1.0
- "text": the verification code (DIGITS ONLY, no spaces or dashes)
- "reasoning": which message you read the code from
- "sender": the sender number/ID of the message containing the code
- "timestamp": any visible timestamp on the message (if readable)"""

    user_prompt = f"""Look at this Dialpad messaging window. Find the MOST RECENT 2FA/verification code.

2FA codes are typically:
- 6-8 digit numbers
- Sent via SMS from banks, services, or short codes
- Contain words like "code", "verification", "OTP", "security", "pin"
- Example: "Your Chase verification code is 847291"
{sender_info}

Look at the NEWEST messages first (usually at the bottom of the conversation).
Extract ONLY the numeric code, no other text.

If no verification code is visible in recent messages, return action "not_found".

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "text"],
        skill_name="skill_read_2fa_code",
        skill_description="read 2FA code from Dialpad",
        model=AI_MODEL_FAST,
    )
