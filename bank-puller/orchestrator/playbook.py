"""Bank Playbooks — workflow memory for replaying known bank navigation paths."""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from config import PLAYBOOKS_DIR, PLAYBOOK_MAX_AGE_DAYS
from utils.logger import log


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------
@dataclass
class PlaybookStep:
    """A single step in a bank navigation playbook."""

    name: str  # e.g. "find_username", "click_next"
    action: str  # "type", "click"
    description: str
    selector: str = ""  # CSS selector for Playwright
    coords: dict[str, int] | None = None  # {"x": 450, "y": 320}
    field: str = ""  # "username", "password" for type actions


@dataclass
class Playbook:
    """Complete navigation playbook for a bank."""

    bank_name: str
    version: int = 1
    created: str = ""
    last_verified: str = ""
    success_count: int = 0
    consecutive_failures: int = 0
    login_url: str = ""
    login_steps: list[PlaybookStep] = field(default_factory=list)
    post_login_sequence: list[str] = field(default_factory=list)
    statements_step: PlaybookStep | None = None


# ---------------------------------------------------------------------------
# Slug helper
# ---------------------------------------------------------------------------
def _bank_slug(bank_name: str) -> str:
    """Convert bank name to filesystem-safe slug."""
    slug = bank_name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


# ---------------------------------------------------------------------------
# Load / Save
# ---------------------------------------------------------------------------
def load_playbook(bank_name: str) -> Playbook | None:
    """Load a playbook for the given bank, or None if not found."""
    slug = _bank_slug(bank_name)
    path = PLAYBOOKS_DIR / f"{slug}.json"
    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        log.warning(f"Failed to load playbook {path}: {e}")
        return None

    # Parse login_steps
    login_steps = []
    for step_data in data.get("login_steps", []):
        login_steps.append(PlaybookStep(
            name=step_data.get("name", ""),
            action=step_data.get("action", ""),
            description=step_data.get("description", ""),
            selector=step_data.get("selector", ""),
            coords=step_data.get("coords"),
            field=step_data.get("field", ""),
        ))

    # Parse statements_step
    statements_step = None
    ss = data.get("statements_step")
    if ss:
        statements_step = PlaybookStep(
            name=ss.get("name", ""),
            action=ss.get("action", ""),
            description=ss.get("description", ""),
            selector=ss.get("selector", ""),
            coords=ss.get("coords"),
            field=ss.get("field", ""),
        )

    return Playbook(
        bank_name=data.get("bank_name", bank_name),
        version=data.get("version", 1),
        created=data.get("created", ""),
        last_verified=data.get("last_verified", ""),
        success_count=data.get("success_count", 0),
        consecutive_failures=data.get("consecutive_failures", 0),
        login_url=data.get("login_url", ""),
        login_steps=login_steps,
        post_login_sequence=data.get("post_login_sequence", []),
        statements_step=statements_step,
    )


def save_playbook(playbook: Playbook) -> None:
    """Save a playbook to disk."""
    PLAYBOOKS_DIR.mkdir(parents=True, exist_ok=True)
    slug = _bank_slug(playbook.bank_name)
    path = PLAYBOOKS_DIR / f"{slug}.json"

    data = {
        "bank_name": playbook.bank_name,
        "version": playbook.version,
        "created": playbook.created,
        "last_verified": playbook.last_verified,
        "success_count": playbook.success_count,
        "consecutive_failures": playbook.consecutive_failures,
        "login_url": playbook.login_url,
        "login_steps": [asdict(s) for s in playbook.login_steps],
        "post_login_sequence": playbook.post_login_sequence,
        "statements_step": asdict(playbook.statements_step) if playbook.statements_step else None,
    }

    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    log.info(f"Playbook saved: {path}")


def is_fresh(playbook: Playbook) -> bool:
    """Check if a playbook is within its max age and hasn't had too many failures."""
    if playbook.consecutive_failures >= 3:
        log.info(f"Playbook expired: {playbook.bank_name} ({playbook.consecutive_failures} consecutive failures)")
        return False

    if not playbook.last_verified:
        return False

    try:
        verified = date.fromisoformat(playbook.last_verified)
    except ValueError:
        return False

    age_days = (date.today() - verified).days
    if age_days > PLAYBOOK_MAX_AGE_DAYS:
        log.info(f"Playbook expired: {playbook.bank_name} (age: {age_days}d > {PLAYBOOK_MAX_AGE_DAYS}d)")
        return False

    return True


# ---------------------------------------------------------------------------
# Step execution: selector → coords → False cascade
# ---------------------------------------------------------------------------
async def try_step(page, step: PlaybookStep) -> bool:
    """Try to execute a playbook step. Returns True if successful.

    Cascade: selector → coords → False (caller should fall back to AI).
    """
    # 1. Try Playwright selector
    if step.selector:
        try:
            locator = page.locator(step.selector)
            if await locator.count() > 0:
                if step.action == "click":
                    await locator.first.click(timeout=5000)
                    return True
                elif step.action == "type":
                    # For type actions, we just need to click to focus the field
                    await locator.first.click(timeout=5000)
                    return True
        except Exception as e:
            log.debug(f"Playbook selector failed for '{step.name}': {e}")

    # 2. Try saved coordinates
    if step.coords and "x" in step.coords and "y" in step.coords:
        from utils.browser_setup import human_click, wait_and_screenshot, screenshots_identical

        screenshot_before = await wait_and_screenshot(page, f"pb_before_{step.name}")
        await human_click(page, step.coords["x"], step.coords["y"])

        await asyncio.sleep(1)

        screenshot_after = await wait_and_screenshot(page, f"pb_after_{step.name}")

        if not screenshots_identical(screenshot_before, screenshot_after):
            return True  # Page changed — coords worked

        # For type actions (input fields), page might not visually change on click
        if step.action == "type":
            return True  # Assume focus was gained

    return False


# ---------------------------------------------------------------------------
# Selector discovery
# ---------------------------------------------------------------------------
async def discover_selector(page, x: int, y: int) -> str | None:
    """After a successful click at (x,y), ask the browser what element is there."""
    try:
        selector = await page.evaluate("""(coords) => {
            const el = document.elementFromPoint(coords.x, coords.y);
            if (!el) return null;

            // Walk up to find interactive element
            let target = el;
            const interactive = ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'];
            while (target && !interactive.includes(target.tagName)) {
                target = target.parentElement;
            }
            if (!target) target = el;

            // Build selector: prefer id, then name, then role-based
            if (target.id) return '#' + CSS.escape(target.id);
            if (target.name) {
                return target.tagName.toLowerCase() + '[name="' + CSS.escape(target.name) + '"]';
            }
            const type = target.getAttribute('type');
            if (type) {
                return target.tagName.toLowerCase() + '[type="' + type + '"]';
            }
            const role = target.getAttribute('role');
            if (role) {
                return '[role="' + role + '"]';
            }
            const ariaLabel = target.getAttribute('aria-label');
            if (ariaLabel) {
                return '[aria-label="' + CSS.escape(ariaLabel) + '"]';
            }
            // href-based for links (strip query strings to avoid session token misses)
            const href = target.getAttribute('href');
            if (href && target.tagName === 'A') {
                const cleanHref = href.split('?')[0];
                const parts = cleanHref.split('/').filter(p => p);
                if (parts.length > 0) {
                    return 'a[href*="' + CSS.escape(parts[parts.length - 1]) + '"]';
                }
            }
            return null;
        }""", {"x": x, "y": y})
        return selector
    except Exception as e:
        log.debug(f"Selector discovery failed at ({x},{y}): {e}")
        return None


# ---------------------------------------------------------------------------
# PlaybookRecorder — accumulates steps during learn mode
# ---------------------------------------------------------------------------
class PlaybookRecorder:
    """Records steps during a learn-mode session, converts to Playbook on success."""

    def __init__(self):
        self._login_steps: list[PlaybookStep] = []
        self._post_login_states: list[str] = []
        self._statements_step: PlaybookStep | None = None
        self._login_url: str = ""

    def set_login_url(self, url: str) -> None:
        self._login_url = url

    def add_login_step(
        self,
        name: str,
        action: str,
        description: str,
        selector: str = "",
        coords: dict[str, int] | None = None,
        field: str = "",
    ) -> None:
        """Record a login step."""
        self._login_steps.append(PlaybookStep(
            name=name,
            action=action,
            description=description,
            selector=selector,
            coords=coords,
            field=field,
        ))

    def add_post_login_state(self, state: str) -> None:
        """Record a post-login page state observed."""
        if state not in self._post_login_states:
            self._post_login_states.append(state)

    def set_statements_step(
        self,
        name: str = "find_statements",
        action: str = "click",
        description: str = "",
        selector: str = "",
        coords: dict[str, int] | None = None,
    ) -> None:
        """Record the statements navigation step."""
        self._statements_step = PlaybookStep(
            name=name,
            action=action,
            description=description,
            selector=selector,
            coords=coords,
        )

    def to_playbook(self, bank_name: str) -> Playbook:
        """Convert recorded steps into a Playbook."""
        today = date.today().isoformat()
        return Playbook(
            bank_name=bank_name,
            version=1,
            created=today,
            last_verified=today,
            success_count=1,
            consecutive_failures=0,
            login_url=self._login_url,
            login_steps=list(self._login_steps),
            post_login_sequence=list(self._post_login_states),
            statements_step=self._statements_step,
        )
