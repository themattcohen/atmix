"""OCR-based extraction from Surfer SEO screenshots using Tesseract + regex."""

import io
import logging
import re

from PIL import Image

try:
    import pytesseract
except ImportError:
    raise ImportError(
        "pytesseract is required for OCR extraction. "
        "Install it with: pip install pytesseract\n"
        "You also need the Tesseract binary: "
        "https://github.com/tesseract-ocr/tesseract#installing-tesseract"
    )

logger = logging.getLogger("blog-engine.ocr_parser")

# ---------------------------------------------------------------------------
# Stage 1: Tesseract OCR
# ---------------------------------------------------------------------------

def ocr_extract_text(image_bytes: bytes) -> str:
    """Run Tesseract OCR on an image and return raw text.

    Preprocesses with Pillow (grayscale + threshold) for better accuracy
    on Surfer SEO screenshots which have colored backgrounds.

    Args:
        image_bytes: Raw image bytes (PNG, JPEG, WebP).

    Returns:
        Raw OCR text output.
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Grayscale conversion
    gray = img.convert("L")

    # Binary threshold for high contrast (Surfer uses colored backgrounds)
    threshold = 180
    bw = gray.point(lambda px: 255 if px > threshold else 0, mode="1")

    text = pytesseract.image_to_string(bw, config="--psm 6")
    logger.info("[ocr_parser] Tesseract extracted %d chars", len(text))
    return text


# ---------------------------------------------------------------------------
# Stage 2: Regex parsing
# ---------------------------------------------------------------------------

# Entities tab: "gross income 9/17-36" or "term 5/1"
_RE_ENTITY = re.compile(
    r"([a-zA-Z][a-zA-Z ]+?)\s+(\d+)/(\d+)(?:-(\d+))?"
)

# Headings tab: "term 3" (single number, no slash)
_RE_HEADING = re.compile(
    r"([a-zA-Z][a-zA-Z ]+?)\s+(\d+)\s*$", re.MULTILINE
)

# Word count: "Words 2462 4.9K - 5.6K" or "4,900 - 5,600"
_RE_WORDS_K = re.compile(
    r"Words?\s+\d[\d,]*\s+([\d.]+)K\s*-\s*([\d.]+)K", re.IGNORECASE
)
_RE_WORDS_PLAIN = re.compile(
    r"Words?\s+\d[\d,]*\s+([\d,]+)\s*-\s*([\d,]+)", re.IGNORECASE
)

# Headings target: "Headings 28 13 - 23"
_RE_HEADINGS = re.compile(
    r"Headings?\s+\d+\s+(\d+)\s*-\s*(\d+)", re.IGNORECASE
)


def parse_surfer_entities(ocr_text: str) -> list[dict]:
    """Parse Surfer entity/heading text into term/min/max dicts.

    Handles three formats:
        - "gross income 9/17-36" -> targetMin=17, targetMax=36
        - "term 5/1"            -> targetMin=1,  targetMax=1
        - "term 3"              -> targetMin=3,  targetMax=3 (headings tab)

    Returns:
        List of {"term": str, "targetMin": int, "targetMax": int}.
    """
    results: list[dict] = []
    seen: set[str] = set()

    # Pass 1: entities with slash notation (current/min-max)
    for m in _RE_ENTITY.finditer(ocr_text):
        term = m.group(1).strip().lower()
        target_min = int(m.group(3))
        target_max = int(m.group(4)) if m.group(4) else target_min
        if term not in seen:
            seen.add(term)
            results.append({
                "term": term,
                "targetMin": target_min,
                "targetMax": target_max,
            })

    # Pass 2: headings tab — single number, no slash
    # The number is the CURRENT count, not the target. Heading targets are always 1.
    for m in _RE_HEADING.finditer(ocr_text):
        term = m.group(1).strip().lower()
        if term not in seen:
            seen.add(term)
            results.append({
                "term": term,
                "targetMin": 1,
                "targetMax": 1,
            })

    logger.info("[ocr_parser] Regex parsed %d entities", len(results))
    return results


def parse_surfer_targets(ocr_text: str) -> dict:
    """Extract word count and heading targets from OCR text.

    Looks for patterns like:
        - "Words 2462 4.9K - 5.6K"  -> {"wordCount": {"min": 4900, "max": 5600}}
        - "Headings 28 13 - 23"     -> {"headings": {"min": 13, "max": 23}}

    Returns:
        Dict with wordCount and/or headings sub-dicts, or empty dict.
    """
    targets: dict = {}

    # Word count — K notation first
    m = _RE_WORDS_K.search(ocr_text)
    if m:
        k_min = float(m.group(1))
        k_max = float(m.group(2))
        if k_max > 20.0:
            logger.warning(
                "[ocr_parser] K-notation value %.1fK (=%d) suspiciously high — possible OCR misread",
                k_max, int(k_max * 1000),
            )
        targets["wordCount"] = {
            "min": int(k_min * 1000),
            "max": int(k_max * 1000),
        }
    else:
        # Plain number notation (4,900 - 5,600)
        m = _RE_WORDS_PLAIN.search(ocr_text)
        if m:
            targets["wordCount"] = {
                "min": int(m.group(1).replace(",", "")),
                "max": int(m.group(2).replace(",", "")),
            }

    # Headings
    m = _RE_HEADINGS.search(ocr_text)
    if m:
        targets["headings"] = {
            "min": int(m.group(1)),
            "max": int(m.group(2)),
        }

    return targets


# ---------------------------------------------------------------------------
# Stage 3: Full pipeline (OCR -> regex -> Claude verification)
# ---------------------------------------------------------------------------

def extract_with_ocr(
    image_bytes: bytes,
    media_type: str = "image/png",
) -> tuple[dict, list[dict]]:
    """Full 3-stage extraction pipeline: Tesseract OCR -> regex -> Claude verify.

    Stage 1: Tesseract OCR extracts raw text (free).
    Stage 2: Regex parses structured terms + targets (free).
    Stage 3: Claude verifies by re-parsing the OCR text via extract_from_text().
             This catches OCR misreads and ensures valid JSON structure.

    Merge strategy: prefer Claude's structured output, supplement with
    regex-parsed targets if Claude missed them.

    Args:
        image_bytes: Raw image bytes.
        media_type:  MIME type (unused by Tesseract, kept for API symmetry).

    Returns:
        Tuple of (parsed_dict, [ocr_call_info, claude_call_info]).
    """
    # Stage 1 — Tesseract OCR (free)
    raw_text = ocr_extract_text(image_bytes)
    ocr_call_info = {
        "call_name": "tesseract_ocr",
        "cost_usd": 0,
        "method": "tesseract",
    }

    # Stage 2 — Regex extraction (free)
    regex_entities = parse_surfer_entities(raw_text)
    regex_targets = parse_surfer_targets(raw_text)
    logger.info(
        "[ocr_parser] Regex found %d entities, targets=%s",
        len(regex_entities),
        list(regex_targets.keys()),
    )

    # Stage 3 — Claude verification via nlp_parser.extract_from_text
    from lib.nlp_parser import extract_from_text

    claude_parsed, claude_call_info = extract_from_text(raw_text)

    # Merge: Claude output is primary, supplement with regex targets
    merged = dict(claude_parsed)

    if "targets" not in merged:
        merged["targets"] = {}

    # Fill in targets that Claude missed but regex found
    for key in ("wordCount", "headings"):
        if key not in merged["targets"] and key in regex_targets:
            merged["targets"][key] = regex_targets[key]
            logger.info("[ocr_parser] Supplemented %s from regex", key)

    return (merged, [ocr_call_info, claude_call_info])


# ---------------------------------------------------------------------------
# Stage 4: Sanity checks — deterministic accuracy guards
# ---------------------------------------------------------------------------

class SanityWarning:
    """A single accuracy warning from sanity_check_targets()."""

    def __init__(self, field: str, severity: str, message: str,
                 suggested_value: int | None = None,
                 suggested_field: str | None = None):
        self.field = field
        self.severity = severity  # "error" or "warning"
        self.message = message
        self.suggested_value = suggested_value
        self.suggested_field = suggested_field

    def to_dict(self) -> dict:
        d = {"field": self.field, "severity": self.severity, "message": self.message}
        if self.suggested_value is not None:
            d["suggested_value"] = self.suggested_value
        if self.suggested_field is not None:
            d["suggested_field"] = self.suggested_field
        return d


def _correct_k_notation(value: int, label: str) -> tuple[int | None, str | None]:
    """Attempt to correct a value that looks like a K-notation OCR misread.

    Example: OCR reads "7.6K" as 76000 (missed the decimal).
    76000 // 10 = 7600, which is in the plausible range -> suggest 7600.

    Returns:
        (corrected_value, explanation) or (None, None) if no correction applies.
    """
    if value <= 15000:
        return (None, None)
    candidate = value // 10
    if 600 <= candidate <= 15000:
        return (candidate, f"{label}: {value:,} likely OCR misread of K-notation -> {candidate:,}")
    return (None, None)


def sanity_check_targets(targets: dict, terms: dict | None = None) -> list[SanityWarning]:
    """Run deterministic sanity checks on extracted targets and terms.

    Args:
        targets: Dict with optional "wordCount" and "headings" sub-dicts.
        terms: Optional categorized terms dict (high_priority, medium_priority, low_priority).

    Returns:
        List of SanityWarning objects (empty if all checks pass).
    """
    warnings: list[SanityWarning] = []
    wc = targets.get("wordCount", {})
    hd = targets.get("headings", {})

    # --- Word count checks ---
    wc_max = wc.get("max")
    wc_min = wc.get("min")

    if wc_max is None and wc_min is None:
        warnings.append(SanityWarning("wordCount", "warning", "Word count targets missing — parse may have failed"))
    else:
        if wc_max is not None and wc_max > 20000:
            corrected, explanation = _correct_k_notation(wc_max, "wordCount.max")
            warnings.append(SanityWarning(
                "wordCount.max", "error",
                explanation or f"wordCount.max={wc_max:,} exceeds 20,000 — likely OCR misread",
                suggested_value=corrected,
                suggested_field="wordCount.max",
            ))
        if wc_min is not None and wc_min > 20000:
            corrected, explanation = _correct_k_notation(wc_min, "wordCount.min")
            warnings.append(SanityWarning(
                "wordCount.min", "error",
                explanation or f"wordCount.min={wc_min:,} exceeds 20,000 — likely OCR misread",
                suggested_value=corrected,
                suggested_field="wordCount.min",
            ))
        if wc_max is not None and wc_max < 200:
            warnings.append(SanityWarning("wordCount.max", "warning", f"wordCount.max={wc_max} suspiciously low"))
        if wc_min is not None and wc_max is not None and wc_min > wc_max:
            warnings.append(SanityWarning("wordCount", "error", f"wordCount min ({wc_min:,}) > max ({wc_max:,}) — inverted range"))

    # --- Headings checks ---
    hd_max = hd.get("max")
    hd_min = hd.get("min")

    if hd_max is None and hd_min is None:
        warnings.append(SanityWarning("headings", "warning", "Heading targets missing — parse may have failed"))
    else:
        if hd_max is not None and hd_max > 200:
            warnings.append(SanityWarning("headings.max", "error", f"headings.max={hd_max} exceeds 200 — likely OCR misread"))
        if hd_min is not None and hd_max is not None and hd_min > hd_max:
            warnings.append(SanityWarning("headings", "error", f"headings min ({hd_min}) > max ({hd_max}) — inverted range"))

    # --- Per-term checks ---
    if terms:
        for priority in ("high_priority", "medium_priority", "low_priority"):
            for t in terms.get(priority, []):
                if t.get("targetMax", 0) > 100:
                    warnings.append(SanityWarning(
                        f"term.{t['term']}", "warning",
                        f"Term '{t['term']}' targetMax={t['targetMax']} — OCR may have misread count as target",
                    ))

    return warnings
