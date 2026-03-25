"""Gap analysis: compare Surfer feedback screenshots against NLP targets."""


def build_surfer_feedback(
    score_overview: dict | None,
    entities_with_counts: list[dict] | None,
    heading_counts: list[dict] | None,
    surfer_targets: dict,
    ai_optimization: list[dict] | None = None,
) -> str:
    """Build structured feedback text from Surfer screenshot data.

    All parameters except surfer_targets are optional — partial screenshots
    produce partial analysis.

    Args:
        score_overview: Output of extract_score_overview() or None.
        entities_with_counts: Output of extract_entities_with_counts() or None.
        heading_counts: Output of extract_heading_counts() or None.
        surfer_targets: Loaded surfer-targets.json dict (required).

    Returns:
        Multi-line structured feedback string ready for rewrite_with_feedback().
    """
    lines: list[str] = []

    # 1. Score line
    if score_overview and "score" in score_overview:
        lines.append(f"Surfer Score: {score_overview['score']}/100 (Target: 90+)")
        lines.append("")

    # 2. Word count gap
    if score_overview and "wordCount" in score_overview:
        wc = score_overview["wordCount"]
        current_wc = wc.get("current", 0)
        # Prefer score_overview targets, fall back to surfer_targets
        targets_wc = surfer_targets.get("targets", {}).get("wordCount", {})
        target_min = wc.get("targetMin") or targets_wc.get("min", 0)
        target_max = wc.get("targetMax") or targets_wc.get("max", 0)

        lines.append("## Word Count")
        lines.append(f"Current: {current_wc:,} words. Target: {target_min:,}-{target_max:,}.")
        if current_wc < target_min:
            deficit = target_min - current_wc
            lines.append(f"ADD ~{deficit:,} words.")
        elif current_wc > target_max:
            excess = current_wc - target_max
            lines.append(f"TRIM ~{excess:,} words.")
        else:
            lines.append("Word count is ON TARGET.")
        lines.append("")

    # 3. Heading count gap
    if score_overview and "headings" in score_overview:
        hd = score_overview["headings"]
        current_hd = hd.get("current", 0)
        targets_hd = surfer_targets.get("targets", {}).get("headings", {})
        target_min = hd.get("targetMin") or targets_hd.get("min", 0)
        target_max = hd.get("targetMax") or targets_hd.get("max", 0)

        lines.append("## Headings")
        lines.append(f"Current: {current_hd} headings. Target: {target_min}-{target_max}.")
        if current_hd < target_min:
            lines.append(f"ADD {target_min - current_hd}+ headings.")
        lines.append("")

    # 4. Entity gap analysis
    if entities_with_counts:
        underused = []
        for ent in entities_with_counts:
            current = ent.get("current", 0)
            target_min = ent.get("targetMin", 0)
            if current < target_min:
                deficit = target_min - current
                priority = _classify_priority(ent["term"], surfer_targets)
                underused.append({
                    "term": ent["term"],
                    "current": current,
                    "targetMin": target_min,
                    "targetMax": ent.get("targetMax", target_min),
                    "deficit": deficit,
                    "priority": priority,
                })

        if underused:
            # Sort by priority bucket then deficit descending
            priority_order = {"high_priority": 0, "medium_priority": 1, "low_priority": 2, "unknown": 3}
            underused.sort(key=lambda x: (priority_order.get(x["priority"], 3), -x["deficit"]))

            lines.append("## Underused NLP Entities")
            current_priority = None
            for item in underused:
                if item["priority"] != current_priority:
                    current_priority = item["priority"]
                    label = current_priority.replace("_", " ").title()
                    lines.append(f"\n### {label}")
                lines.append(
                    f'- "{item["term"]}": current {item["current"]}, '
                    f'need {item["targetMin"]}-{item["targetMax"]}. '
                    f'ADD {item["deficit"]}+ uses.'
                )
            lines.append("")

    # 5. Missing heading terms
    if heading_counts:
        missing = [h for h in heading_counts if h.get("current", 0) == 0]
        if missing:
            lines.append("## Missing Heading Terms")
            for h in missing:
                lines.append(f'- "{h["term"]}": not in any heading. ADD to an H2 or H3.')
            lines.append("")

    # 6. AI facts gap
    if score_overview and "aiFacts" in score_overview:
        ai = score_overview["aiFacts"]
        covered = ai.get("covered", 0)
        total = ai.get("total", 0)
        if total > 0 and covered < total:
            lines.append("## AI Facts Coverage")
            lines.append(f"Current: {covered}/{total} facts. {total - covered} facts missing.")
            lines.append("")

    # 7. Entity coverage summary
    if score_overview and "entityCoverage" in score_overview:
        ec = score_overview["entityCoverage"]
        covered = ec.get("covered", 0)
        total = ec.get("total", 0)
        if total > 0 and covered < total:
            lines.append("## Entity Coverage")
            lines.append(f"Current: {covered}/{total} entities covered. {total - covered} missing.")
            lines.append("")

    # 8. AI optimization facts
    if ai_optimization:
        uncovered = [item for item in ai_optimization if not item.get("covered")]
        if uncovered:
            lines.append("## Missing AI Optimization Facts")
            for item in uncovered:
                lines.append(f'- {item["fact"]}')
            lines.append(f"\n{len(uncovered)} of {len(ai_optimization)} AI facts not covered. ADD these facts to the article.")
            lines.append("")

    if not lines:
        return "No gaps detected from screenshots. Review manually."

    return "\n".join(lines)


def _classify_priority(term: str, surfer_targets: dict) -> str:
    """Look up a term in surfer_targets priority buckets.

    Returns 'high_priority', 'medium_priority', 'low_priority', or 'unknown'.
    """
    terms = surfer_targets.get("terms", {})
    term_lower = term.lower().strip()
    for bucket in ("high_priority", "medium_priority", "low_priority"):
        for entry in terms.get(bucket, []):
            if entry.get("term", "").lower().strip() == term_lower:
                return bucket
    return "unknown"
