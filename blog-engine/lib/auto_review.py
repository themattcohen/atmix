"""Local article analysis against Surfer NLP targets (zero API cost)."""

import re


def analyze_article_against_targets(article_md: str, nlp_targets: dict, ai_facts: list[str] | None = None) -> dict:
    """Analyze an article against surfer-targets.json locally.

    Returns a dict with keys ready for ``build_surfer_feedback()``:
        score_overview: {wordCount: {current, targetMin, targetMax},
                         headings: {current, targetMin, targetMax}}
        entities_with_counts: [{term, current, targetMin, targetMax}, ...]
        heading_counts: [{term, current}, ...]   (1 if in any heading, else 0)
        ai_optimization: [{fact, covered}, ...]  (if ai_facts provided)
        word_count: int
        heading_count: int
    """
    body = _strip_frontmatter(article_md)

    # --- 1. Word count + heading count ---
    word_count = len(body.split())
    headings = re.findall(r"^#{2,3}\s+.+$", body, re.MULTILINE)
    heading_count = len(headings)

    targets = nlp_targets.get("targets", {})
    wc_target = targets.get("wordCount", {})
    hd_target = targets.get("headings", {})

    score_overview = {
        "wordCount": {
            "current": word_count,
            "targetMin": wc_target.get("min", 0),
            "targetMax": wc_target.get("max", 0),
        },
        "headings": {
            "current": heading_count,
            "targetMin": hd_target.get("min", 0),
            "targetMax": hd_target.get("max", 0),
        },
    }

    # --- 2. Entity term frequency counting ---
    terms_dict = nlp_targets.get("terms", {})
    entities_with_counts = []
    for bucket in ("high_priority", "medium_priority", "low_priority"):
        for entry in terms_dict.get(bucket, []):
            term = entry.get("term", "")
            if not term:
                continue
            count = _count_term(body, term)
            entities_with_counts.append({
                "term": term,
                "current": count,
                "targetMin": entry.get("targetMin", 0),
                "targetMax": entry.get("targetMax", 0),
            })

    # --- 3. Heading term presence ---
    heading_text = "\n".join(headings).lower()
    high_terms = terms_dict.get("high_priority", [])
    heading_counts = []
    for entry in high_terms:
        term = entry.get("term", "")
        if not term:
            continue
        present = 1 if term.lower() in heading_text else 0
        heading_counts.append({"term": term, "current": present})

    # --- 4. AI facts coverage ---
    ai_optimization = None
    if ai_facts:
        body_lower = body.lower()
        ai_optimization = [
            {"fact": fact, "covered": fact.lower() in body_lower}
            for fact in ai_facts
        ]

    result = {
        "score_overview": score_overview,
        "entities_with_counts": entities_with_counts,
        "heading_counts": heading_counts,
        "word_count": word_count,
        "heading_count": heading_count,
    }
    if ai_optimization is not None:
        result["ai_optimization"] = ai_optimization
    return result


def check_brief_completeness(brief: str) -> dict:
    """Check a research brief for expected sections.

    Returns a dict with keys:
        complete: bool — True if all 5 sections found with content
        sections_found: list[str]
        sections_missing: list[str]
        word_count: int
    """
    expected = [
        "Key Facts",
        "Competitor Gaps",
        "Unique Angles",
        "Authority Sources",
        "Recommended Article Structure",
    ]

    lines = brief.split("\n")
    found = []
    last_heading_line = -1

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("## "):
            heading_text = stripped[3:].strip()
            for section in expected:
                if section.lower() in heading_text.lower() and section not in found:
                    found.append(section)
                    last_heading_line = i
                    break

    missing = [s for s in expected if s not in found]

    # Check if the last section has content below its heading
    if last_heading_line >= 0 and not missing:
        content_after_last = "\n".join(lines[last_heading_line + 1:]).strip()
        if len(content_after_last.split()) < 10:
            # Last section is effectively empty — likely truncated
            truncated_section = found[-1]
            found.remove(truncated_section)
            missing.append(truncated_section)

    return {
        "complete": len(missing) == 0,
        "sections_found": found,
        "sections_missing": missing,
        "word_count": len(brief.split()),
    }


def _strip_frontmatter(md: str) -> str:
    """Remove YAML frontmatter (--- ... ---) from markdown."""
    if md.startswith("---"):
        end = md.find("---", 3)
        if end != -1:
            return md[end + 3:].strip()
    return md


def _count_term(text: str, term: str) -> int:
    """Count case-insensitive whole-word occurrences of term in text."""
    pattern = r"\b" + re.escape(term) + r"\b"
    return len(re.findall(pattern, text, re.IGNORECASE))
