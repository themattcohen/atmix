"""Cost calculation and tracking for blog-engine API calls."""

import logging

logger = logging.getLogger("blog-engine.costs")

# --- Pricing tables (per-token USD) ---

CLAUDE_PRICING = {
    "claude-sonnet-4-20250514": {
        "input": 3.00 / 1_000_000,
        "output": 15.00 / 1_000_000,
        "cache_write": 3.75 / 1_000_000,
        "cache_read": 0.30 / 1_000_000,
    },
    "claude-sonnet-4-6": {
        "input": 3.00 / 1_000_000,
        "output": 15.00 / 1_000_000,
        "cache_write": 3.75 / 1_000_000,
        "cache_read": 0.30 / 1_000_000,
    },
}

IMAGEN_PRICING = {
    "imagen-4.0-generate-001": {"per_image": 0.020},
}


def calc_claude_cost(model: str, usage) -> dict:
    """Calculate cost from an Anthropic response.usage object.

    Returns a partial call_info dict (caller adds call_name and latency_s).

    Claude call_info schema:
        call_name: str        # e.g. "generate_research_brief"
        model: str
        input_tokens: int
        output_tokens: int
        cache_write_tokens: int
        cache_read_tokens: int
        cost_usd: float
        latency_s: float
    """
    rates = CLAUDE_PRICING.get(model, CLAUDE_PRICING.get("claude-sonnet-4-20250514"))

    input_tokens = getattr(usage, "input_tokens", 0) or 0
    output_tokens = getattr(usage, "output_tokens", 0) or 0
    cache_write_tokens = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read_tokens = getattr(usage, "cache_read_input_tokens", 0) or 0

    cost = (
        input_tokens * rates["input"]
        + output_tokens * rates["output"]
        + cache_write_tokens * rates["cache_write"]
        + cache_read_tokens * rates["cache_read"]
    )

    return {
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_write_tokens": cache_write_tokens,
        "cache_read_tokens": cache_read_tokens,
        "cost_usd": round(cost, 6),
    }


def calc_imagen_cost(model: str, images_generated: int) -> dict:
    """Calculate cost for Imagen image generation.

    Imagen call_info schema:
        call_name: str        # "generate_hero_images"
        model: str
        images_requested: int
        images_generated: int
        cost_usd: float
        latency_s: float
    """
    rates = IMAGEN_PRICING.get(model, IMAGEN_PRICING.get("imagen-4.0-generate-001"))
    cost = images_generated * rates["per_image"]
    return {
        "model": model,
        "images_generated": images_generated,
        "cost_usd": round(cost, 6),
    }


def format_cost(info: dict) -> str:
    """Human-readable cost string.

    Claude: "1,234 in / 2,456 out · $0.042"
    Imagen: "3 images · $0.060"
    """
    if info is None:
        return ""
    if "input_tokens" in info:
        return (
            f"{info['input_tokens']:,} in / {info['output_tokens']:,} out "
            f"· ${info['cost_usd']:.3f}"
        )
    if "images_generated" in info:
        return f"{info['images_generated']} images · ${info['cost_usd']:.3f}"
    return f"${info.get('cost_usd', 0):.3f}"


def format_cost_short(info: dict) -> str:
    """Short cost string: '$0.04'"""
    if info is None:
        return "$0.00"
    return f"${info.get('cost_usd', 0):.2f}"


def sum_costs(cost_list: list) -> float:
    """Sum cost_usd from a list of call_info dicts, safely skipping None."""
    total = 0.0
    for item in cost_list or []:
        if item and isinstance(item, dict):
            total += item.get("cost_usd", 0)
    return round(total, 6)
