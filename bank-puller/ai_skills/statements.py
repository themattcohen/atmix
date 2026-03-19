"""AI skills — find statements page and select target statement."""
from __future__ import annotations
from ai_skills.base import runner, AISkillResult


def skill_find_statements_page(screenshot: bytes) -> AISkillResult:
    """Find the link/button to navigate to the statements/documents section.

    Returns AISkillResult with:
    - action: "click" if found, "not_found" if no statements link visible
    - target: coordinates of the statements/documents link
    """
    system_prompt = """You are a bank website navigator. Find the link or button that leads to account statements, documents, or document center.

You MUST respond with ONLY a JSON object:
- "action": "click" if you found a statements/documents link, "not_found" if not visible
- "confidence": float 0.0-1.0
- "target": {"x": pixel_x, "y": pixel_y} center of the link/button to click
- "reasoning": what text/element you identified
- "text": the visible text of the link/button"""

    user_prompt = """Find the link to bank statements or documents on this page.

Common labels: "Statements", "Documents", "Statements & Documents", "Account Documents",
"eStatements", "View Statements", "Document Center", "Paperless", "Tax Documents & Statements"

It may be in:
- Top navigation menu
- Sidebar menu
- Account dashboard quick links
- Under an "Accounts" or "Services" dropdown

Find it and return click coordinates.

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence", "target"],
        skill_name="skill_find_statements_page",
        skill_description="find statements nav link",
    )


def skill_select_statement(screenshot: bytes, target_month: str, account_last4: str = "") -> AISkillResult:
    """Select the correct statement for the target month from a list.

    Args:
        screenshot: PNG bytes of the statements page
        target_month: Target month as "YYYY-MM" (e.g., "2026-02")
        account_last4: Optional account last4 to help identify the right account

    Returns AISkillResult with:
    - action: "click" if found, "not_available" if target month not listed
    - target: coordinates of the statement to click/download
    - text: description of what was selected
    """
    system_prompt = """You are a bank statement selector. Find and select the correct monthly statement from the documents page.

You MUST respond with ONLY a JSON object:
- "action": "click" if the target statement is found, "not_available" if not listed yet
- "confidence": float 0.0-1.0
- "target": {"x": pixel_x, "y": pixel_y} center of the statement link/download button
- "reasoning": how you identified the correct statement
- "text": the visible label of the statement (e.g., "February 2026 Statement")
- "available_months": list of months you can see available (e.g., ["2026-02", "2026-01", "2025-12"])"""

    acct_hint = f"\nAccount ending in: {account_last4}" if account_last4 else ""

    user_prompt = f"""Find the statement for month: {target_month}{acct_hint}

Look for:
- Monthly statements listed by date (e.g., "February 2026", "02/2026", "Feb 26")
- PDF download links or view buttons next to the target month
- If there's an account selector dropdown, note which account is selected

The month format is YYYY-MM. Match "2026-02" to February 2026.

If the target month's statement is NOT in the list (hasn't been generated yet), return action "not_available" and list what months ARE available.

If you need to click a "Download" or "PDF" button next to the month, return those coordinates.

Respond with JSON only."""

    return runner.call(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        screenshot=screenshot,
        required_keys=["action", "confidence"],
        skill_name="skill_select_statement",
        skill_description=f"{target_month} #{account_last4}",
    )
