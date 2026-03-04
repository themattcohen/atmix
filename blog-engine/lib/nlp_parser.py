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
                        "- Surfer shows each entity as: TERM CURRENT/MIN-MAX\n"
                        "- The number BEFORE the slash is current usage count — IGNORE it\n"
                        "- Numbers AFTER the slash are the target range: MIN-MAX\n"
                        "- Example: 'gross income 9/17-36' → term='gross income', targetMin=17, targetMax=36\n"
                        "- If only one number after slash (e.g., '5/1'), set targetMin=1, targetMax=1\n"
                        "- Some terms show arrows (↓ ↑) — ignore arrows\n"
                        "- Include ALL terms visible in the screenshot\n"
                        "- If the screenshot shows 'Headings' tab: heading terms always target 1 (appear at least once in a heading). Format is 'term N' or 'term N/1' where N is the current count — IGNORE current count. ALWAYS set targetMin=1, targetMax=1 for heading terms.\n"
                        "- Extract word count targets from metrics bar: 'X.XK - Y.YK' → convert K notation (4.9K = 4900)\n"
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
                "- Handle any format: tab-separated, dash-separated, table format, JSON, OCR text, etc.\n"
                "- Surfer format is typically: TERM CURRENT/MIN-MAX (e.g., 'gross income 9/17-36')\n"
                "- The number BEFORE the slash is current usage — IGNORE it for target ranges\n"
                "- Numbers AFTER the slash are targetMin-targetMax\n"
                "- If only one number after slash (e.g., '5/1'), set targetMin=1, targetMax=1\n"
                "- If a term shows just a range like '3-8', set targetMin=3, targetMax=8\n"
                "- If a term shows a single number N with no slash, set targetMin=N, targetMax=N\n"
                "- Arrows (↓ ↑) should be ignored\n"
                "- Extract word count targets if present: convert K notation (4.9K = 4900)\n"
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


def extract_ai_facts(image_bytes: bytes, media_type: str = "image/png") -> tuple[list[str], dict]:
    """Extract AI Search optimization facts from Surfer screenshot.

    These are the facts shown in Surfer's 'Optimize for AI Search' panel
    (e.g., '27/31 facts covered').

    Returns:
        Tuple of (list of fact strings, call_info dict)
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
                        "Extract ALL facts from the 'Optimize for AI Search' section of this Surfer SEO screenshot.\n\n"
                        "Return ONLY a JSON array of fact strings (no markdown fences, no explanation):\n"
                        '["fact one", "fact two", ...]\n\n'
                        "Rules:\n"
                        "- Include every fact listed, whether checked/covered or not\n"
                        "- Each fact should be the complete text as shown\n"
                        "- Maintain the original order\n"
                        "- Return raw JSON array only, no markdown code fences"
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_ai_facts — model=%s input=%d output=%d",
        MODEL, usage.input_tokens, usage.output_tokens,
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_ai_facts"
    call_info["latency_s"] = round(latency, 2)

    # Parse JSON array
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    facts = json.loads(text)
    return (facts, call_info)


def verify_extraction_with_image(
    image_bytes: bytes,
    media_type: str,
    extracted: dict,
    slot_label: str = "Keywords & Targets",
) -> tuple[list[str], dict]:
    """AI verification: compare extracted values against the original screenshot.

    Sends the original image + summary of extracted values to Claude, asking it
    to flag any discrepancies (especially numeric values and K-notation).

    Args:
        image_bytes: Original screenshot bytes.
        media_type: MIME type of the image.
        extracted: Dict with "targets" and "terms" from extraction.
        slot_label: Human label for the input slot (for logging).

    Returns:
        Tuple of (issues: list[str], call_info: dict).
        Empty list if no issues found.
    """
    import base64
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Build a summary of what was extracted
    targets = extracted.get("targets", {})
    wc = targets.get("wordCount", {})
    hd = targets.get("headings", {})
    terms = extracted.get("terms", {})
    sample_terms = []
    for priority in ("high_priority", "medium_priority", "low_priority"):
        for t in terms.get(priority, [])[:5]:
            sample_terms.append(f"  {t['term']}: {t.get('targetMin', 0)}-{t.get('targetMax', 0)}")

    summary = (
        f"Word count: {wc.get('min', 'N/A')} - {wc.get('max', 'N/A')}\n"
        f"Headings: {hd.get('min', 'N/A')} - {hd.get('max', 'N/A')}\n"
        f"Sample terms (first 10):\n" + "\n".join(sample_terms[:10])
    )

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
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
                        "You are verifying an automated extraction from this Surfer SEO screenshot.\n\n"
                        "Here is what was extracted:\n"
                        f"```\n{summary}\n```\n\n"
                        "Compare these extracted values against what you see in the screenshot.\n"
                        "Focus on:\n"
                        "1. Word count targets — does the screenshot show the same range? Watch for K-notation misreads (e.g., '7.6K' misread as 76000)\n"
                        "2. Heading count targets — do they match?\n"
                        "3. Any obviously wrong term target numbers\n\n"
                        "Return ONLY a JSON object (no markdown fences):\n"
                        '{"issues": ["issue 1 description", "issue 2 description", ...], "ok": true/false}\n\n'
                        'If everything matches, return: {"issues": [], "ok": true}\n'
                        "Be specific about what you see vs what was extracted."
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] verify_extraction_with_image — model=%s input=%d output=%d latency=%.1fs",
        MODEL, usage.input_tokens, usage.output_tokens, latency,
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "verify_extraction_with_image"
    call_info["latency_s"] = round(latency, 2)

    # Parse response
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        result = json.loads(text)
        issues = result.get("issues", [])
    except (json.JSONDecodeError, KeyError):
        logger.warning("[nlp_parser] verify_extraction_with_image — failed to parse response: %s", text[:200])
        issues = [f"Verification response unparseable: {text[:200]}"]

    return (issues, call_info)


def extract_score_overview(image_bytes: bytes, media_type: str = "image/png") -> tuple[dict, dict]:
    """Extract score and metrics from the Surfer overview/metrics bar screenshot.

    Returns:
        Tuple of (overview dict, call_info dict).
        Overview keys: score, wordCount, headings, paragraphs, entityCoverage, aiFacts.
    """
    import base64
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
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
                        "Extract ALL numeric metrics from this Surfer SEO dashboard/metrics bar screenshot.\n\n"
                        "Return ONLY valid JSON (no markdown fences, no explanation):\n"
                        "{\n"
                        '  "score": 75,\n'
                        '  "wordCount": {"current": 4476, "targetMin": 8300, "targetMax": 9500},\n'
                        '  "headings": {"current": 39, "targetMin": 49, "targetMax": 176},\n'
                        '  "paragraphs": {"current": 118, "targetMin": 191},\n'
                        '  "entityCoverage": {"covered": 60, "total": 81},\n'
                        '  "aiFacts": {"covered": 20, "total": 45}\n'
                        "}\n\n"
                        "Rules:\n"
                        "- The overall content score is usually a large number (0-100)\n"
                        "- Convert K-notation: 8.3K = 8300, 9.5K = 9500\n"
                        "- Word count shows current vs target range (e.g., '4,476 / 8.3K - 9.5K')\n"
                        "- Headings shows current vs target range\n"
                        "- Paragraphs shows current vs target\n"
                        "- Entity/NLP coverage shows X/Y covered\n"
                        "- AI facts shows X/Y covered\n"
                        "- Only include fields that are visible in the screenshot\n"
                        "- Return raw JSON only, no markdown code fences"
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_score_overview — model=%s input=%d output=%d",
        MODEL, usage.input_tokens, usage.output_tokens,
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_score_overview"
    call_info["latency_s"] = round(latency, 2)

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    overview = json.loads(text)
    return (overview, call_info)


def extract_entities_with_counts(image_bytes: bytes, media_type: str = "image/png") -> tuple[list[dict], dict]:
    """Extract NLP entities with CURRENT counts from Surfer entities panel screenshot.

    Unlike extract_from_image() which ignores current counts, this function
    INCLUDES them for gap analysis.

    Returns:
        Tuple of (list of entity dicts, call_info dict).
        Each entity: {"term": str, "current": int, "targetMin": int, "targetMax": int}
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
                        "Extract ALL NLP/SEO entities from this Surfer SEO entities panel screenshot.\n\n"
                        "Return ONLY a JSON array (no markdown fences, no explanation):\n"
                        "[\n"
                        '  {"term": "onlyfans taxes", "current": 20, "targetMin": 27, "targetMax": 58},\n'
                        "  ...\n"
                        "]\n\n"
                        "Rules:\n"
                        "- Surfer shows each entity as: TERM CURRENT/MIN-MAX\n"
                        "- The number BEFORE the slash is the CURRENT usage count — INCLUDE it\n"
                        "- Numbers AFTER the slash are the target range: MIN-MAX\n"
                        "- Example: 'gross income 9/17-36' → term='gross income', current=9, targetMin=17, targetMax=36\n"
                        "- If only one number after slash (e.g., '5/1'), set targetMin=1, targetMax=1\n"
                        "- Some terms show arrows (↓ ↑) — ignore arrows\n"
                        "- Green checkmarks mean the term is satisfied — still include it with counts\n"
                        "- Include ALL terms visible in the screenshot\n"
                        "- Return raw JSON array only, no markdown code fences"
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_entities_with_counts — model=%s input=%d output=%d",
        MODEL, usage.input_tokens, usage.output_tokens,
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_entities_with_counts"
    call_info["latency_s"] = round(latency, 2)

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    entities = json.loads(text)
    return (entities, call_info)


def extract_heading_counts(image_bytes: bytes, media_type: str = "image/png") -> tuple[list[dict], dict]:
    """Extract heading terms with current counts from Surfer headings panel screenshot.

    Returns:
        Tuple of (list of heading dicts, call_info dict).
        Each heading: {"term": str, "current": int}
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
                        "Extract ALL heading terms from this Surfer SEO headings panel screenshot.\n\n"
                        "Return ONLY a JSON array (no markdown fences, no explanation):\n"
                        "[\n"
                        '  {"term": "onlyfans creators", "current": 2},\n'
                        '  {"term": "tax deductions", "current": 0},\n'
                        "  ...\n"
                        "]\n\n"
                        "Rules:\n"
                        "- Surfer heading terms show: 'term N' or 'term N/1' where N is the current count\n"
                        "- The number before the slash is how many times the term appears in headings\n"
                        "- The number after the slash (always 1) is the target — IGNORE it, just extract current\n"
                        "- A count of 0 means the term is not in any heading yet\n"
                        "- Green checkmarks mean the term is present — still include with count\n"
                        "- Red/orange/uncolored means the term is missing — include with current=0\n"
                        "- Include ALL heading terms visible in the screenshot\n"
                        "- Return raw JSON array only, no markdown code fences"
                    ),
                },
            ],
        }],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[nlp_parser] extract_heading_counts — model=%s input=%d output=%d",
        MODEL, usage.input_tokens, usage.output_tokens,
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "extract_heading_counts"
    call_info["latency_s"] = round(latency, 2)

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    headings = json.loads(text)
    return (headings, call_info)
