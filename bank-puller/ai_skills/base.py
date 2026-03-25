"""AI Skill Runner -- hardened wrapper for all Claude vision API calls."""
from __future__ import annotations

import asyncio
import base64
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import anthropic

from config import (
    ANTHROPIC_API_KEY, AI_MODEL, AI_MODEL_FAST, AI_MAX_RETRIES,
    AI_CONFIDENCE_THRESHOLD, AI_SCREENSHOT_RESOLUTION, SCREENSHOT_RESOLUTION,
)
from utils.logger import log


# ---------------------------------------------------------------------------
# Cost tracking (accumulated per run)
# ---------------------------------------------------------------------------
cost_tracker = {
    "input_tokens": 0,
    "output_tokens": 0,
    "calls": 0,
    "estimated_cost_usd": 0.0,
}

# Pricing per million tokens by model
_MODEL_PRICING = {
    AI_MODEL: {"input": 3.0, "output": 15.0},
    AI_MODEL_FAST: {"input": 0.80, "output": 4.0},
}
_DEFAULT_PRICING = {"input": 3.0, "output": 15.0}


def _update_cost(usage, model: str = AI_MODEL):
    """Update cost tracker from API response usage."""
    pricing = _MODEL_PRICING.get(model, _DEFAULT_PRICING)
    inp = getattr(usage, "input_tokens", 0)
    out = getattr(usage, "output_tokens", 0)
    cost_tracker["input_tokens"] += inp
    cost_tracker["output_tokens"] += out
    cost_tracker["calls"] += 1
    cost_tracker["estimated_cost_usd"] += (
        inp / 1_000_000 * pricing["input"]
        + out / 1_000_000 * pricing["output"]
    )


def get_cost_summary() -> dict:
    """Return a copy of the current cost tracker."""
    return dict(cost_tracker)


def reset_cost_tracker():
    """Reset cost tracker for a new run."""
    cost_tracker["input_tokens"] = 0
    cost_tracker["output_tokens"] = 0
    cost_tracker["calls"] = 0
    cost_tracker["estimated_cost_usd"] = 0.0


# ---------------------------------------------------------------------------
# AISkillResult
# ---------------------------------------------------------------------------
@dataclass
class AISkillResult:
    """Standardized result from any AI skill call."""
    action: str  # e.g., "click", "type", "found", "uncertain", "ai_failure"
    confidence: float = 0.0
    target: dict[str, Any] | None = None  # e.g., {"x": 450, "y": 320}
    text: str = ""  # extracted text, answer, code, etc.
    reasoning: str = ""
    raw_response: dict[str, Any] | None = None
    page_state: str = ""  # classified page state


# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


# ---------------------------------------------------------------------------
# Screenshot compression
# ---------------------------------------------------------------------------
def _compress_screenshot(screenshot: bytes) -> bytes:
    """Downscale screenshot for AI consumption (~75% token savings).

    Resizes from browser resolution (1920x1080) to AI_SCREENSHOT_RESOLUTION
    (default 960x540). Bank UIs have large enough elements that half-res works.
    """
    from PIL import Image
    import io

    img = Image.open(io.BytesIO(screenshot))
    target = (AI_SCREENSHOT_RESOLUTION["width"], AI_SCREENSHOT_RESOLUTION["height"])

    if img.size[0] <= target[0] and img.size[1] <= target[1]:
        return screenshot  # Already small enough

    img = img.resize(target, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Core API call
# ---------------------------------------------------------------------------
def call_vision_skill(
    system_prompt: str,
    user_prompt: str,
    screenshot: bytes,
    response_schema: dict[str, Any] | None = None,
    model: str = AI_MODEL,
) -> tuple[dict[str, Any], anthropic.types.Usage, str]:
    """Make a single Claude vision API call.

    Args:
        system_prompt: System prompt for the skill
        user_prompt: User instruction
        screenshot: PNG bytes of the page
        response_schema: Expected JSON schema keys for validation
        model: Model to use (AI_MODEL or AI_MODEL_FAST)

    Returns:
        Tuple of (parsed JSON response dict, usage stats, model used)
    """
    client = _get_client()

    compressed = _compress_screenshot(screenshot)
    img_b64 = base64.b64encode(compressed).decode("utf-8")

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": img_b64,
                    },
                },
                {
                    "type": "text",
                    "text": user_prompt,
                },
            ],
        }
    ]

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    # Extract text content
    text = ""
    for block in response.content:
        if hasattr(block, "text"):
            text += block.text

    # Parse JSON from response
    # Try to find JSON in the response (may be wrapped in ```json blocks)
    json_str = text.strip()
    if json_str.startswith("```"):
        # Remove markdown code block
        lines = json_str.split("\n")
        json_str = "\n".join(lines[1:])
        if json_str.endswith("```"):
            json_str = json_str[:-3].strip()

    if not json_str:
        raise json.JSONDecodeError("Empty response from AI", "", 0)

    parsed = json.loads(json_str)
    return parsed, response.usage, model


def call_text_skill(
    system_prompt: str,
    user_prompt: str,
    model: str = AI_MODEL,
) -> tuple[dict[str, Any], Any, str]:
    """Text-only Claude API call (no screenshot). Same return contract as call_vision_skill.

    Returns:
        Tuple of (parsed JSON response dict, usage stats, model used)
    """
    client = _get_client()

    response = client.messages.create(
        model=model,
        max_tokens=512,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    # Extract text content
    text = ""
    for block in response.content:
        if hasattr(block, "text"):
            text += block.text

    # Parse JSON from response (may be wrapped in ```json blocks)
    json_str = text.strip()
    if json_str.startswith("```"):
        lines = json_str.split("\n")
        json_str = "\n".join(lines[1:])
        if json_str.endswith("```"):
            json_str = json_str[:-3].strip()

    if not json_str:
        raise json.JSONDecodeError("Empty response from AI", "", 0)

    parsed = json.loads(json_str)
    return parsed, response.usage, model


def validate_schema(result: dict, required_keys: list[str]) -> bool:
    """Check that result dict contains all required keys."""
    return all(k in result for k in required_keys)


# ---------------------------------------------------------------------------
# AISkillRunner -- hardened wrapper with retries
# ---------------------------------------------------------------------------
class AISkillRunner:
    """Wraps AI skill calls with retry logic, confidence gating, and cost tracking."""

    def __init__(
        self,
        max_retries: int = AI_MAX_RETRIES,
        confidence_threshold: float = AI_CONFIDENCE_THRESHOLD,
    ):
        self.max_retries = max_retries
        self.confidence_threshold = confidence_threshold

    def call(
        self,
        system_prompt: str,
        user_prompt: str,
        screenshot: bytes,
        required_keys: list[str] | None = None,
        skill_name: str = "",
        skill_description: str = "",
        model: str = AI_MODEL,
    ) -> AISkillResult:
        """Execute an AI skill with retries, validation, and confidence gating.

        Args:
            system_prompt: System prompt defining the skill
            user_prompt: The specific instruction
            screenshot: PNG bytes
            required_keys: JSON keys that must be present in the response.
                          Always requires "action" and "confidence".
            skill_name: Name for action logging (e.g. "skill_find_element")
            skill_description: Description for action logging
            model: Model to use (AI_MODEL for complex tasks, AI_MODEL_FAST for simple ones)

        Returns:
            AISkillResult with the parsed response
        """
        from orchestrator.action_logger import log_action

        if required_keys is None:
            required_keys = ["action", "confidence"]
        else:
            # Always require these
            for k in ["action", "confidence"]:
                if k not in required_keys:
                    required_keys.append(k)

        # Snapshot cost before call for delta calculation
        cost_before = cost_tracker["estimated_cost_usd"]
        tokens_in_before = cost_tracker["input_tokens"]
        tokens_out_before = cost_tracker["output_tokens"]
        t_start = time.time()

        for attempt in range(self.max_retries + 1):
            try:
                parsed, usage, used_model = call_vision_skill(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    screenshot=screenshot,
                    model=model,
                )
                _update_cost(usage, used_model)

                # Validate schema
                if not validate_schema(parsed, required_keys):
                    missing = [k for k in required_keys if k not in parsed]
                    log.warning(
                        f"AI response missing keys {missing} (attempt {attempt + 1})"
                    )
                    if attempt < self.max_retries:
                        continue
                    result = AISkillResult(
                        action="ai_failure",
                        confidence=0.0,
                        reasoning=f"Missing keys: {missing}",
                        raw_response=parsed,
                    )
                    self._emit_action_log(
                        log_action, skill_name, skill_description, result,
                        t_start, cost_before, tokens_in_before, tokens_out_before,
                        success=False,
                    )
                    return result

                confidence = float(parsed.get("confidence", 0))

                # Confidence gate
                if confidence < self.confidence_threshold:
                    log.warning(
                        f"Low confidence {confidence:.2f} (attempt {attempt + 1})"
                    )
                    if attempt < self.max_retries:
                        continue
                    result = AISkillResult(
                        action="uncertain",
                        confidence=confidence,
                        reasoning=parsed.get("reasoning", "Low confidence"),
                        raw_response=parsed,
                    )
                    self._emit_action_log(
                        log_action, skill_name, skill_description, result,
                        t_start, cost_before, tokens_in_before, tokens_out_before,
                        success=False,
                    )
                    return result

                # Scale coordinates from AI resolution back to browser resolution
                target = parsed.get("target")
                if target and "x" in target and "y" in target:
                    scale_x = SCREENSHOT_RESOLUTION["width"] / AI_SCREENSHOT_RESOLUTION["width"]
                    scale_y = SCREENSHOT_RESOLUTION["height"] / AI_SCREENSHOT_RESOLUTION["height"]
                    target = {
                        "x": int(target["x"] * scale_x),
                        "y": int(target["y"] * scale_y),
                    }

                # Success
                result = AISkillResult(
                    action=parsed.get("action", "unknown"),
                    confidence=confidence,
                    target=target,
                    text=parsed.get("text", ""),
                    reasoning=parsed.get("reasoning", ""),
                    raw_response=parsed,
                    page_state=parsed.get("page_state", ""),
                )
                self._emit_action_log(
                    log_action, skill_name, skill_description, result,
                    t_start, cost_before, tokens_in_before, tokens_out_before,
                    success=True,
                )
                return result

            except json.JSONDecodeError as e:
                log.warning(f"JSON parse error (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries:
                    continue

            except anthropic.RateLimitError:
                wait = 2 ** attempt
                log.warning(f"Rate limited, waiting {wait}s")
                time.sleep(wait)
                continue

            except anthropic.InternalServerError:
                log.warning(f"API server error (attempt {attempt + 1})")
                time.sleep(5)
                continue

            except anthropic.APIConnectionError:
                log.warning(f"API connection error (attempt {attempt + 1})")
                time.sleep(5)
                continue

        result = AISkillResult(
            action="ai_failure",
            confidence=0.0,
            reasoning="Max retries exceeded",
        )
        self._emit_action_log(
            log_action, skill_name, skill_description, result,
            t_start, cost_before, tokens_in_before, tokens_out_before,
            success=False,
        )
        return result

    @staticmethod
    def _emit_action_log(
        log_action: Callable,
        skill_name: str,
        skill_description: str,
        result: AISkillResult,
        t_start: float,
        cost_before: float,
        tokens_in_before: int,
        tokens_out_before: int,
        success: bool,
    ) -> None:
        """Emit an ai_skill action log record."""
        duration_ms = int((time.time() - t_start) * 1000)
        cost_delta = cost_tracker["estimated_cost_usd"] - cost_before
        tokens_in_delta = cost_tracker["input_tokens"] - tokens_in_before
        tokens_out_delta = cost_tracker["output_tokens"] - tokens_out_before

        coords = None
        if result.target and "x" in result.target and "y" in result.target:
            coords = {"x": result.target["x"], "y": result.target["y"]}

        log_action(
            type="ai_skill",
            skill=skill_name,
            description=skill_description,
            confidence=result.confidence,
            tokens_in=tokens_in_delta,
            tokens_out=tokens_out_delta,
            cost_usd=cost_delta,
            coords=coords,
            page_state=result.page_state,
            duration_ms=duration_ms,
            success=success,
        )


# ---------------------------------------------------------------------------
# Verified click -- post-click verification
# ---------------------------------------------------------------------------
async def verified_click(page, ai_result: AISkillResult, screenshot_before: bytes) -> bool:
    """Click at AI-suggested coordinates and verify the page changed.

    If the initial click doesn't change the page, tries offset clicks.

    Args:
        page: Playwright Page object
        ai_result: AI result with target coordinates
        screenshot_before: Screenshot taken before the click

    Returns:
        True if the click had an effect, False if page didn't change.
    """
    from utils.browser_setup import human_click, wait_and_screenshot, screenshots_identical

    if not ai_result.target or "x" not in ai_result.target or "y" not in ai_result.target:
        log.warning("verified_click: no target coordinates in AI result")
        return False

    x, y = ai_result.target["x"], ai_result.target["y"]
    url_before = page.url  # Capture URL before click

    # Initial click
    await human_click(page, x, y)
    await asyncio.sleep(2)  # Was 1s — increased for SPAs
    screenshot_after = await wait_and_screenshot(page, "verify_click")

    if not screenshots_identical(screenshot_before, screenshot_after):
        return True  # Click worked

    # URL change = click worked even if screenshots look similar
    if page.url != url_before:
        return True

    # Try offset clicks (also check URL)
    offsets = [(0, -10), (0, 10), (-10, 0), (10, 0)]
    for dx, dy in offsets:
        await human_click(page, x + dx, y + dy)
        await asyncio.sleep(0.5)
        screenshot_retry = await wait_and_screenshot(page, "verify_click_offset")
        if not screenshots_identical(screenshot_before, screenshot_retry):
            return True  # Offset click worked
        if page.url != url_before:
            return True

    log.warning(f"verified_click: no page change after clicking ({x}, {y}) + offsets")
    return False


# Module-level runner instance
runner = AISkillRunner()
