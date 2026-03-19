"""AI navigation skills — page classification, element finding, obstacle handling."""
from __future__ import annotations
from ai_skills.base import runner, AISkillResult
from config import AI_MODEL_FAST


def skill_classify_page(screenshot: bytes, possible_states: list[str] | None = None) -> AISkillResult:
    """Classify what type of page is shown in the screenshot.

    Returns AISkillResult with page_state set to one of:
    dashboard, login, 2fa_prompt, 2fa_method_selection, security_question,
    virtual_keyboard, obstacle, locked, password_change, error, loading,
    statements, unknown
    """
    if possible_states is None:
        possible_states = [
            "dashboard", "login", "2fa_prompt", "2fa_method_selection",
            "security_question", "virtual_keyboard", "obstacle", "locked",
            "password_change", "error", "loading", "statements", "unknown"
        ]

    states_list = ", ".join(possible_states)

    system_prompt = """You are a bank website page classifier. Analyze the screenshot and determine what type of page is shown.

You MUST respond with ONLY a JSON object, no other text. The JSON must have these exact keys:
- "action": always "classify"
- "confidence": float 0.0-1.0 indicating your certainty
- "page_state": one of the allowed states
- "reasoning": brief explanation of why you chose this state
- "text": any important text visible on the page (error messages, prompts, etc.)"""

    user_prompt = f"""Classify this bank website page. What state is it in?

Allowed states: {states_list}

Key indicators:
- "login": Has username/password input fields
- "dashboard": Shows account balances, welcome message, account overview
- "2fa_prompt": Asking for a verification code (6-8 digits)
- "2fa_method_selection": Asking user to CHOOSE how to receive a code (phone, email, etc.)
- "security_question": Asking a security/challenge question (e.g., "What is your mother's maiden name?")
- "virtual_keyboard": Shows an on-screen keyboard for password entry
- "obstacle": Popup, modal, banner, cookie consent, terms acceptance, ad overlay
- "locked": Account is locked or frozen
- "password_change": Requiring password change/reset
- "error": Error message (login failed, session expired, etc.)
- "loading": Page is still loading (spinner, skeleton, blank content)
- "statements": Shows documents/statements page with downloadable items
- "unknown": Cannot determine

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "page_state"],
        skill_name="skill_classify_page",
        skill_description="classify page state",
        model=AI_MODEL_FAST,
    )


def skill_find_element(screenshot: bytes, element_description: str) -> AISkillResult:
    """Find a specific UI element in the screenshot and return its coordinates.

    Args:
        screenshot: PNG bytes of the page
        element_description: What to find, e.g., "username input field", "submit button"

    Returns AISkillResult with target = {"x": int, "y": int}
    """
    system_prompt = """You are a UI element locator for bank websites. Find the described element in the screenshot and return its CENTER coordinates (x, y).

You MUST respond with ONLY a JSON object, no other text:
- "action": "click" if it's a clickable element, "type" if it's an input field
- "confidence": float 0.0-1.0
- "target": {"x": pixel_x, "y": pixel_y} — CENTER of the element
- "reasoning": brief description of what you found and where"""

    user_prompt = f"""Find this element in the screenshot: {element_description}

Return the CENTER coordinates of the element as {{"x": pixel_x, "y": pixel_y}}.
The screenshot is 960x540 pixels. Give coordinates relative to the top-left corner.

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "target"],
        skill_name="skill_find_element",
        skill_description=element_description,
    )


def skill_handle_obstacle(screenshot: bytes) -> AISkillResult:
    """Identify and suggest how to dismiss a popup/banner/modal/overlay.

    Returns AISkillResult with:
    - action: "click" (to dismiss), "press_escape", "none" (no obstacle found)
    - target: coordinates of dismiss button/X/close if action is "click"
    """
    system_prompt = """You are a bank website obstacle handler. Identify popups, modals, banners, cookie consents, overlays, promotional dialogs, terms acceptance screens, and other obstacles that block interaction with the main page.

You MUST respond with ONLY a JSON object:
- "action": "click" (click a dismiss/close/accept button), "press_escape" (try Escape key), "none" (no obstacle detected)
- "confidence": float 0.0-1.0
- "target": {"x": pixel_x, "y": pixel_y} if action is "click" (center of close/dismiss button)
- "text": description of the obstacle
- "reasoning": why you chose this dismissal method"""

    user_prompt = """Look at this bank website screenshot. Is there an obstacle blocking interaction?

Obstacles include: popups, modals, cookie consent banners, promotional overlays, terms/conditions dialogs, security alerts, session warnings, chat widgets covering content.

If there IS an obstacle, find the button to dismiss it (X, Close, Accept, Dismiss, Got it, OK, Continue, Not Now, Skip, etc.) and return its coordinates.

If there is NO obstacle, return action "none".

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence"],
        skill_name="skill_handle_obstacle",
        skill_description="dismiss popup/modal",
    )
