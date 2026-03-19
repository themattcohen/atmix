"""AI security skills -- security question matching and 2FA option selection."""
from __future__ import annotations

from ai_skills.base import runner, AISkillResult


def skill_match_security_question(
    screenshot: bytes,
    qa_pairs: list[tuple[str, str]],
) -> AISkillResult:
    """Match a security question on screen to one of the known Q&A pairs.

    Args:
        screenshot: PNG bytes showing the security question
        qa_pairs: List of (keyword, answer) tuples from the spreadsheet.
                  Keywords are fuzzy -- e.g., "pet" matches "What was your first pet's name?"

    Returns AISkillResult with:
    - action: "answer" if matched, "uncertain" if not
    - text: the answer to type
    - target: coordinates of the answer input field
    """
    pairs_text = "\n".join(
        f"  Keyword: '{kw}' -> Answer: '{ans}'" for kw, ans in qa_pairs
    )

    system_prompt = """You are a security question matcher for bank websites. Read the security question displayed on screen, match it to one of the known keyword->answer pairs, and locate the answer input field.

You MUST respond with ONLY a JSON object:
- "action": "answer" if you matched a question, "uncertain" if no match
- "confidence": float 0.0-1.0
- "text": the answer to type (from the matched pair)
- "target": {"x": pixel_x, "y": pixel_y} center of the answer input field
- "reasoning": which keyword matched and why
- "question_text": the actual question text visible on screen"""

    user_prompt = f"""This bank page shows a security/challenge question. Match it to one of these known Q&A pairs:

{pairs_text}

The keywords are FUZZY -- for example:
- Keyword "pet" matches "What was your first pet's name?"
- Keyword "city" matches "In what city were you born?"
- Keyword "school" matches "What was the name of your elementary school?"
- Keyword "parents" matches "In what city did your parents meet?"

Find the question text on screen, match it to a keyword, and locate the answer input field.

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "text"],
        skill_name="skill_match_security_question",
        skill_description="match security Q&A",
    )


def skill_select_2fa_option(
    screenshot: bytes,
    preference_order: list[str],
) -> AISkillResult:
    """Select the preferred 2FA delivery option from a choice screen.

    Banks often show: "Send code to: ***1992 / ***2212 / email@..."
    This skill selects the option matching the first available preference.

    Args:
        screenshot: PNG bytes showing the 2FA method selection
        preference_order: Ordered list of last-4 digits of preferred phone numbers,
                         e.g., ["1992", "2212"]. First match wins.

    Returns AISkillResult with:
    - action: "click" to select the option
    - target: coordinates of the preferred option to click
    - text: which option was selected (e.g., "***1992")
    """
    prefs = ", ".join(preference_order) if preference_order else "any available"

    system_prompt = """You are a 2FA method selector for bank websites. The page shows options for receiving a verification code (phone numbers, email addresses). Select the preferred option based on the preference order given.

You MUST respond with ONLY a JSON object:
- "action": "click" if an option was found, "uncertain" if not
- "confidence": float 0.0-1.0
- "target": {"x": pixel_x, "y": pixel_y} center of the option to click
- "text": description of which option you selected (e.g., "Phone ending in 1992")
- "reasoning": why you chose this option
- "available_options": list of all options visible on screen"""

    user_prompt = f"""This bank page shows 2FA delivery options. Select the preferred one.

Preference order (first match wins): {prefs}

Match by the LAST 4 DIGITS of the phone number. For example, if preference is ["1992", "2212"] and the page shows:
- ***-***-1992  <- select this (first preference)
- ***-***-2212
- email@example.com

If none of the preferred numbers are shown, select the first phone/SMS option available.
If only email is available, select email.

Find the option and return its click coordinates.

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "target"],
        skill_name="skill_select_2fa_option",
        skill_description="select 2FA method",
    )
