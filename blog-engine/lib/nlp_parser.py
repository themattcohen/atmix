"""NLP term extraction from Surfer SEO screenshots or pasted text."""

import json
import logging
import time

import anthropic

from lib.costs import calc_claude_cost

logger = logging.getLogger("blog-engine.nlp_parser")

MODEL = "claude-sonnet-4-20250514"

def _get_client():
    return anthropic.Anthropic()


def extract_from_image(image_bytes: bytes, media_type: str = "image/png") -> dict:
    """Extract NLP terms from a Surfer SEO screenshot using Claude Vision.

    Args:
        image_bytes: Raw image bytes
        media_type: MIME type (image/png, image/jpeg, image/webp)

    Returns:
        Structured dict matching surfer-targets.json format
    """
    import base64
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    },
                },
                {
                    "type": "text",
                    "text": (
                        "Extract all NLP/SEO terms and their target usage ranges from this Surfer SEO screenshot.\n\n"
                        "Return ONLY valid JSON in this exact format (no markdown fences, no explanation):\n"
                        "{\n"
                        '  "terms": [\n'
                        '    {"term": "example term", "targetMin": 3, "targetMax": 8},\n'
                        "    ...\n"
                        "  ],\n"
                        '  "wordCount": {"min": 1500, "max": 2500},\n'
                        '  "headings": {"min": 5, "max": 12}\n'
                        "}\n\n"
                        "Rules:\n"
                        "- Include ALL terms visible in the screenshot\n"
                        "- If a term shows a single target number N, set targetMin=N and targetMax=N+2\n"
                        "- If word count or heading targets aren't visible, omit those fields\n"
                        "- Return raw JSON only, no markdown code fences"
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_from_image — model=%s input=%d output=%d cache_create=%d cache_read=%d",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_creation_input_tokens", 0),
        getattr(usage, "cache_read_input_tokens", 0),
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_from_image"
    call_info["latency_s"] = round(latency, 2)

    parsed_dict = _parse_response(response.content[0].text)
    return (parsed_dict, call_info)


def extract_from_text(pasted_text: str) -> dict:
    """Extract NLP terms from pasted text (various formats from Surfer).

    Args:
        pasted_text: Raw text pasted by user (tab-separated, dashes, table, etc.)

    Returns:
        Structured dict matching surfer-targets.json format
    """
    client = _get_client()

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": (
                "Parse these Surfer SEO NLP terms into structured JSON.\n\n"
                "Input text:\n"
                f"```\n{pasted_text}\n```\n\n"
                "Return ONLY valid JSON in this exact format (no markdown fences, no explanation):\n"
                "{\n"
                '  "terms": [\n'
                '    {"term": "example term", "targetMin": 3, "targetMax": 8},\n'
                "    ...\n"
                "  ],\n"
                '  "wordCount": {"min": 1500, "max": 2500},\n'
                '  "headings": {"min": 5, "max": 12}\n'
                "}\n\n"
                "Rules:\n"
                "- Handle any format: tab-separated, dash-separated, table format, JSON, etc.\n"
                "- If a term shows usage like '3-8', set targetMin=3, targetMax=8\n"
                "- If a term shows a single number N, set targetMin=N, targetMax=N+2\n"
                "- If word count or heading targets aren't visible, omit those fields\n"
                "- Return raw JSON only, no markdown code fences"
            ),
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_from_text — model=%s input=%d output=%d cache_create=%d cache_read=%d",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_creation_input_tokens", 0),
        getattr(usage, "cache_read_input_tokens", 0),
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_from_text"
    call_info["latency_s"] = round(latency, 2)

    parsed_dict = _parse_response(response.content[0].text)
    return (parsed_dict, call_info)


def _parse_response(text: str) -> dict:
    """Parse Claude's response into the surfer-targets.json structure."""
    # Strip markdown fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    raw = json.loads(text)

    # Build surfer-targets.json format with priority buckets
    terms = raw.get("terms", [])
    categorized = categorize_terms(terms)

    result = {"terms": categorized}

    # Add targets if present
    targets = {}
    if "wordCount" in raw:
        targets["wordCount"] = raw["wordCount"]
    if "headings" in raw:
        targets["headings"] = raw["headings"]
    if targets:
        result["targets"] = targets

    return result


def categorize_terms(terms: list[dict]) -> dict:
    """Categorize flat term list into priority buckets based on target ranges.

    High priority: targetMax >= 5
    Medium priority: targetMax >= 2
    Low priority: everything else
    """
    high, medium, low = [], [], []
    for t in terms:
        entry = {
            "term": t["term"],
            "targetMin": t.get("targetMin", 1),
            "targetMax": t.get("targetMax", 3),
        }
        if entry["targetMax"] >= 5:
            high.append(entry)
        elif entry["targetMax"] >= 2:
            medium.append(entry)
        else:
            low.append(entry)

    return {
        "high_priority": high,
        "medium_priority": medium,
        "low_priority": low,
    }


def to_surfer_targets_json(parsed: dict, word_count_min=None, word_count_max=None, headings_min=None, headings_max=None) -> dict:
    """Build the final surfer-targets.json structure with optional user overrides.

    Args:
        parsed: The dict (first element of the tuple) returned by
            extract_from_image() or extract_from_text()
        word_count_min/max: Optional user overrides for word count targets
        headings_min/max: Optional user overrides for heading targets

    Returns:
        Complete surfer-targets.json dict ready to save to disk
    """
    result = dict(parsed)

    if "targets" not in result:
        result["targets"] = {}

    if word_count_min is not None or word_count_max is not None:
        result["targets"]["wordCount"] = {
            "min": word_count_min or result["targets"].get("wordCount", {}).get("min", 1500),
            "max": word_count_max or result["targets"].get("wordCount", {}).get("max", 2500),
        }

    if headings_min is not None or headings_max is not None:
        result["targets"]["headings"] = {
            "min": headings_min or result["targets"].get("headings", {}).get("min", 5),
            "max": headings_max or result["targets"].get("headings", {}).get("max", 12),
        }

    return result
