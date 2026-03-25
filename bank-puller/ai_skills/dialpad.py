"""AI skill -- read 2FA codes from Dialpad messaging window."""
from __future__ import annotations

from ai_skills.base import runner, AISkillResult
from config import AI_MODEL


def skill_read_2fa_code(
    screenshot: bytes,
    sender_hint: str = "",
    skip_codes: set[str] | None = None,
) -> AISkillResult:
    """Read the most recent 2FA verification code from a Dialpad messages screenshot.

    Args:
        screenshot: PNG bytes of the Dialpad messaging window
        sender_hint: Optional known sender ID (e.g., "72166") to help identify
                     the right message
        skip_codes: Set of previously-used codes to ignore (stale messages)

    Returns AISkillResult with:
    - action: "found" if a code was extracted, "not_found" if no new code visible
    - text: the 2FA code (digits only)
    - reasoning: which message contained the code
    """
    sender_info = f"\nKnown sender ID/number: {sender_hint}" if sender_hint else ""
    # NOTE: skip_codes are filtered programmatically in tfa_interceptor.py.
    # Do NOT pass them to the AI — if the AI misreads a digit, it may
    # think the real code matches a skip code and self-censor to "not_found".

    system_prompt = """You are a 2FA code reader. Look at this messaging application (Dialpad) screenshot and extract the NEWEST verification/security code.

CRITICAL: Dialpad shows messages in chronological order — the NEWEST message is at the BOTTOM of the conversation. Old messages appear above. You MUST return the code from the LAST (bottom-most) message only.

You MUST respond with ONLY a JSON object:
- "action": "found" if you see a verification code, "not_found" if no code is visible
- "confidence": float 0.0-1.0
- "text": the verification code (DIGITS ONLY, no spaces or dashes)
- "reasoning": which message you read the code from — mention its position (e.g., "bottom-most message")
- "sender": the sender number/ID of the message containing the code
- "timestamp": any visible timestamp on the message (if readable)"""

    user_prompt = f"""Look at this Dialpad messaging window. Find the NEWEST (bottom-most) 2FA/verification code.

2FA codes are typically:
- 6-8 digit numbers
- Sent via SMS from banks, services, or short codes
- Contain words like "code", "verification", "OTP", "security", "pin"
- Example: "Your Chase verification code is 847291"
{sender_info}

IMPORTANT RULES:
1. The NEWEST message is at the BOTTOM of the conversation thread
2. If multiple codes are visible, return ONLY the code from the LAST (bottom-most) message
3. Ignore any codes from messages higher up in the conversation — they are OLD and expired

If no NEW verification code is visible, return action "not_found".

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "text"],
        skill_name="skill_read_2fa_code",
        skill_description="read 2FA code from Dialpad",
        model=AI_MODEL,
    )
