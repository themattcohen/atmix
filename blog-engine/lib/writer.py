"""Claude API integration for research brief generation and article writing."""

import datetime
import json
import logging
import os
import time
from pathlib import Path

import anthropic

from lib.costs import calc_claude_cost

logger = logging.getLogger("blog-engine.writer")

ENGINE_ROOT = Path(__file__).resolve().parent.parent

# Load writer guide at module level
_writer_guide_path = ENGINE_ROOT / "writer-guide.md"
WRITER_GUIDE = _writer_guide_path.read_text(encoding="utf-8") if _writer_guide_path.exists() else ""

# Load anti-slop rules at module level
_anti_slop_path = ENGINE_ROOT / "anti-slop-rules.json"
ANTI_SLOP = json.loads(_anti_slop_path.read_text(encoding="utf-8")) if _anti_slop_path.exists() else {}

MODEL = "claude-sonnet-4-6"


def _get_client() -> anthropic.Anthropic:
    """Get Anthropic client. Reads ANTHROPIC_API_KEY from env."""
    return anthropic.Anthropic()


def _generate_with_continuation(
    client,
    system: str,
    user_msg: str,
    max_tokens: int = 16000,
    temperature: float = 0.4,
    max_continuations: int = 2,
    call_name: str = "generate",
) -> tuple[str, dict]:
    """Call Claude with automatic continuation if output is truncated.

    Makes the initial API call, then appends partial output and asks
    Claude to continue if ``stop_reason == "max_tokens"``.  Repeats
    up to *max_continuations* times and stitches the chunks together.

    Returns (full_text, aggregated_call_info).
    """
    messages = [{"role": "user", "content": user_msg}]
    chunks: list[str] = []
    total_input = 0
    total_output = 0
    total_cache_write = 0
    total_cache_read = 0
    total_cost = 0.0
    continuations = 0

    t0 = time.time()

    for attempt in range(1 + max_continuations):
        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=messages,
        )

        usage = response.usage
        ci = calc_claude_cost(MODEL, usage)
        total_input += ci["input_tokens"]
        total_output += ci["output_tokens"]
        total_cache_write += ci.get("cache_write_tokens", 0)
        total_cache_read += ci.get("cache_read_tokens", 0)
        total_cost += ci.get("cost_usd", 0.0)

        if not response.content or not response.content[0].text:
            if chunks:
                # Got partial output on a previous attempt; stop here
                break
            raise RuntimeError(f"{call_name}: Claude returned empty content")
        chunk_text = response.content[0].text
        chunks.append(chunk_text)

        if response.stop_reason != "max_tokens":
            break

        # Need continuation
        continuations += 1
        logger.warning(
            "[writer] %s — output truncated on attempt %d, continuing...",
            call_name, attempt + 1,
        )
        # Append partial as assistant turn, ask to continue
        messages.append({"role": "assistant", "content": chunk_text})
        messages.append({
            "role": "user",
            "content": "Continue writing from exactly where you left off. Do not repeat any content already written.",
        })

    latency = time.time() - t0
    full_text = "".join(chunks)
    truncated = (response.stop_reason == "max_tokens")

    call_info = {
        "model": MODEL,
        "input_tokens": total_input,
        "output_tokens": total_output,
        "cache_write_tokens": total_cache_write,
        "cache_read_tokens": total_cache_read,
        "cost_usd": round(total_cost, 6),
        "call_name": call_name,
        "latency_s": round(latency, 2),
        "continuations": continuations,
        "truncated": truncated,
    }

    if continuations:
        logger.info(
            "[writer] %s — %d continuation(s), truncated=%s, total_output=%d",
            call_name, continuations, truncated, total_output,
        )

    return full_text, call_info


def generate_research_brief(keyword: str, config: dict, secondary_keywords: list[str] | None = None) -> str:
    """Generate a research brief for the given keyword using Claude."""
    client = _get_client()

    authority_domains = config.get("research", {}).get("authorityDomains", [])
    primary_sources = config.get("research", {}).get("primarySources", [])
    tone = config.get("content", {}).get("toneGuidance", "Professional, clear, authoritative")
    author = config.get("author", {})

    today = datetime.date.today().strftime("%B %d, %Y")

    system_prompt = (
        "You are an expert SEO research analyst. Your job is to create comprehensive "
        "research briefs that provide factual foundations for SEO articles.\n\n"
        f"Today's date is {today}. All dates, deadlines, and time-sensitive information "
        "MUST be current and accurate for the present year. Verify that any referenced "
        "dates (tax deadlines, filing periods, regulatory changes) reflect the current "
        "year, not prior years.\n\n"
        "Your research briefs must:\n"
        "1. Identify key facts with specific citations from authoritative sources\n"
        "2. Analyze what top-ranking competitors cover and identify content gaps\n"
        "3. Find unique angles that differentiate from existing content\n"
        "4. List specific authority sources to cite in the final article\n\n"
        "Be factual, specific, and cite real sources. No generic advice."
    )

    secondary_section = ""
    if secondary_keywords:
        secondary_section = f"""
## Secondary Keywords to Cover
{chr(10).join(f"- {k}" for k in secondary_keywords)}

Make sure the research brief addresses these secondary topics and finds
authority sources relevant to each one.
"""

    user_prompt = f"""Create a research brief for the keyword: "{keyword}"
{secondary_section}
## Authority Domains to Prioritize
{chr(10).join(f"- {d}" for d in authority_domains) if authority_domains else "- No specific domains configured"}

## Primary Sources to Reference
{chr(10).join(f"- {s}" for s in primary_sources) if primary_sources else "- No specific sources configured"}

## Author Context
- Name: {author.get('name', 'Not specified')}
- Credentials: {author.get('credentials', 'Not specified')}

## Tone
{tone}

## Output Format
Use this exact structure:

# Research Brief: {keyword}

## Key Facts with Citations
- [Fact] — Source: [URL or statute reference]
(Include at least 8-10 verified facts)

## Competitor Gaps
- [Gap]: What competitors miss about [specific topic]
(Analyze what top 5-10 SERP results cover and what they're missing)

## Unique Angles
- [Angle]: How we differentiate by [specific approach]
(Find 3-5 angles not well-covered by competitors)

## Authority Sources to Cite
- [Source description]: [URL]
(List 5-8 authoritative sources for the final article)

## Recommended Article Structure
- Suggested H2 headings based on SERP analysis
- Key topics each section should cover
"""

    brief, call_info = _generate_with_continuation(
        client, system_prompt, user_prompt,
        max_tokens=8192,
        temperature=0.3,
        max_continuations=1,
        call_name="generate_research_brief",
    )

    logger.info(
        "[writer] generate_research_brief — model=%s input=%d output=%d continuations=%d",
        MODEL, call_info["input_tokens"], call_info["output_tokens"],
        call_info.get("continuations", 0),
    )

    return (brief, call_info)


def write_article(
    keyword: str,
    config: dict,
    research_brief: str,
    nlp_targets: dict,
    additional_instructions: str = "",
    secondary_keywords: list[str] | None = None,
    slug: str = "",
) -> str:
    """Write a full SEO article using Claude."""
    client = _get_client()

    # Build NLP targets section
    nlp_section = _format_nlp_targets_for_prompt(nlp_targets)

    # Load crosslinks for internal linking
    crosslinks_section = ""
    if slug:
        from lib import pipeline
        crosslinks_path = pipeline.get_output_dir(slug) / "crosslinks.json"
        if crosslinks_path.exists():
            try:
                crosslinks = json.loads(crosslinks_path.read_text(encoding="utf-8"))
                crosslinks_section = _format_crosslinks_for_prompt(crosslinks)
            except (json.JSONDecodeError, OSError):
                pass
    # Fall back to config crosslinks if no crosslinks.json
    if not crosslinks_section:
        config_crosslinks = config.get("content", {}).get("crosslinks", [])
        link_base = config.get("content", {}).get("internalLinkBase", "")
        if config_crosslinks and link_base:
            formatted = [{"url": link_base + cl["path"], "title": cl["title"]} for cl in config_crosslinks]
            crosslinks_section = _format_crosslinks_for_prompt(formatted)

    # Build config context
    disclaimers = ""
    if config.get("validation", {}).get("requireDisclaimers"):
        top = config.get("content", {}).get("disclaimerTop", "")
        bottom = config.get("content", {}).get("disclaimerBottom", "")
        disclaimers = f"\n## Required Disclaimers\nTop (after H1): {top}\nBottom (last paragraph): {bottom}"

    protected_words = config.get("content", {}).get("protectedWords", [])
    protected_section = ""
    if protected_words:
        protected_section = f"\n## Protected Words (never modify these)\n{', '.join(protected_words)}"

    banned_list = "\n".join(f"- {p}" for p in ANTI_SLOP.get("bannedPhrases", []))

    today = datetime.date.today().strftime("%B %d, %Y")
    current_year = datetime.date.today().year

    system_prompt = f"""You are an expert SEO article writer. Follow the writer guide EXACTLY.

Today's date is {today}. All dates, deadlines, and time-sensitive information MUST be
accurate for {current_year}. Double-check that any referenced dates (tax deadlines,
filing periods, regulatory changes, estimated tax due dates) are current, not from prior years.

{WRITER_GUIDE}

## Banned Phrases (HARD FAIL if found)
{banned_list}
{disclaimers}
{protected_section}

## Niche Config
- Author: {config.get('author', {}).get('name', 'Author')}, {config.get('author', {}).get('credentials', '')}
- Tone: {config.get('content', {}).get('toneGuidance', 'Professional, clear, authoritative')}
- Surfer Score Target: {config.get('seo', {}).get('surferScoreTarget', 90)}
"""

    secondary_section = ""
    if secondary_keywords:
        secondary_section = f"""
## Secondary Keywords (MUST incorporate naturally)
{chr(10).join(f"- {k}" for k in secondary_keywords)}

These secondary keywords must appear naturally in the article. Use them
in H2/H3 headings, topic sentences, and FAQ answers where appropriate.
Do NOT force them — integrate them into the content organically.
"""

    user_prompt = f"""Write a complete SEO article for the keyword: "{keyword}"

## Research Brief
{research_brief}

{nlp_section}
{crosslinks_section}
{secondary_section}
{f"## Additional Instructions{chr(10)}{additional_instructions}" if additional_instructions else ""}

Output ONLY the MDX article content. Start with the --- frontmatter delimiter. Follow the writer guide structure exactly."""

    article, call_info = _generate_with_continuation(
        client, system_prompt, user_prompt,
        temperature=0.4, call_name="write_article",
    )

    logger.info(
        "[writer] write_article — model=%s input=%d output=%d continuations=%d",
        MODEL, call_info["input_tokens"], call_info["output_tokens"],
        call_info.get("continuations", 0),
    )

    return (article, call_info)



def rewrite_with_feedback(article: str, feedback: str, nlp_targets: dict | None, config: dict, keyword: str = "", slug: str = "") -> str:
    """Rewrite an article incorporating user feedback while maintaining NLP targets.

    Args:
        article: Current article MDX content
        feedback: User feedback text (Surfer score report, missing terms, general notes)
        nlp_targets: NLP target dict (surfer-targets.json format), or None
        config: Niche config dict
        keyword: Primary keyword for context

    Returns:
        Rewritten article MDX string
    """
    client = _get_client()

    nlp_section = ""
    if nlp_targets:
        nlp_section = _format_nlp_targets_for_prompt(nlp_targets)

    # Load crosslinks for internal linking
    crosslinks_section = ""
    if slug:
        from lib import pipeline
        crosslinks_path = pipeline.get_output_dir(slug) / "crosslinks.json"
        if crosslinks_path.exists():
            try:
                crosslinks = json.loads(crosslinks_path.read_text(encoding="utf-8"))
                crosslinks_section = _format_crosslinks_for_prompt(crosslinks)
            except (json.JSONDecodeError, OSError):
                pass
    # Fall back to config crosslinks if no crosslinks.json
    if not crosslinks_section:
        config_crosslinks = config.get("content", {}).get("crosslinks", [])
        link_base = config.get("content", {}).get("internalLinkBase", "")
        if config_crosslinks and link_base:
            formatted = [{"url": link_base + cl["path"], "title": cl["title"]} for cl in config_crosslinks]
            crosslinks_section = _format_crosslinks_for_prompt(formatted)

    today = datetime.date.today().strftime("%B %d, %Y")
    current_year = datetime.date.today().year

    system = (
        f"Today's date is {today}. All dates, deadlines, and time-sensitive information "
        f"MUST be accurate for {current_year}. Verify any referenced dates are current.\n\n"
        f"{WRITER_GUIDE}\n\n"
        f"## Banned Phrases\n{json.dumps(ANTI_SLOP, indent=2)}\n\n"
        f"## Niche Configuration\n{json.dumps(config.get('content', {}), indent=2)}\n\n"
        "You are rewriting an existing article based on user feedback. "
        "Maintain the article's structure, tone, and quality while incorporating the feedback. "
        "Return the COMPLETE rewritten article in MDX format with frontmatter."
    )

    user_msg = (
        f"## Current Article\n\n{article}\n\n"
        f"## User Feedback\n\n{feedback}\n\n"
    )

    if nlp_section:
        user_msg += f"## NLP Targets (maintain these term frequencies)\n\n{nlp_section}\n\n"

    if crosslinks_section:
        user_msg += f"## Internal Cross-Links (maintain or improve)\n\n{crosslinks_section}\n\n"

    if keyword:
        user_msg += f"## Primary Keyword: {keyword}\n\n"

    user_msg += (
        "Rewrite the article incorporating the feedback above. "
        "Return the COMPLETE article — do not summarize or truncate. "
        "Keep the frontmatter intact, updating only if the feedback requires it."
    )

    rewritten, call_info = _generate_with_continuation(
        client, system, user_msg,
        temperature=0.3, call_name="rewrite_with_feedback",
    )

    logger.info(
        "[writer] rewrite_with_feedback — model=%s input=%d output=%d continuations=%d",
        MODEL, call_info["input_tokens"], call_info["output_tokens"],
        call_info.get("continuations", 0),
    )

    return (rewritten, call_info)


def _format_nlp_targets_for_prompt(nlp_targets: dict) -> str:
    """Format NLP targets with mandatory enforcement language."""
    lines = [
        "## NLP Term Targets — MANDATORY (from Surfer SEO)",
        "",
        "You MUST incorporate these terms at the specified frequencies.",
        "High priority terms are NON-NEGOTIABLE — hit every single one.",
        "Medium priority: hit at least 70%. Low priority: best effort.",
        "",
    ]
    if "terms" in nlp_targets:
        terms = nlp_targets["terms"]
        if isinstance(terms, dict):
            for priority in ["high_priority", "medium_priority", "low_priority"]:
                if priority in terms and terms[priority]:
                    label = priority.replace("_", " ").title()
                    enforcement = {
                        "high_priority": "MUST hit ALL — non-negotiable",
                        "medium_priority": "Hit >=70% of these",
                        "low_priority": "Best effort — include where natural",
                    }[priority]
                    lines.append(f"### {label} ({enforcement})")
                    for t in terms[priority]:
                        tmin = t.get('targetMin', '?')
                        tmax = t.get('targetMax', '?')
                        lines.append(f"- **{t['term']}**: USE {tmin}-{tmax} times")
                    lines.append("")
        elif isinstance(terms, list):
            # Legacy flat list format
            for t in terms:
                lines.append(f"- **{t['term']}**: target {t.get('target', '?')}, current {t.get('current', 0)}")
            lines.append("")

    if "targets" in nlp_targets:
        targets = nlp_targets["targets"]
        lines.append("### Content Dimensions — MUST HIT")
        if "wordCount" in targets:
            wc = targets["wordCount"]
            lines.append(f"- **Word count**: {wc.get('min', '?')}-{wc.get('max', '?')} words (MANDATORY range)")
        if "headings" in targets:
            hd = targets["headings"]
            lines.append(f"- **Heading count**: {hd.get('min', '?')}-{hd.get('max', '?')} headings (MANDATORY range)")

    return "\n".join(lines)


def _format_crosslinks_for_prompt(crosslinks: list[dict]) -> str:
    """Format crosslinks for inclusion in the writing prompt."""
    lines = [
        "## Available Articles for Internal Cross-Linking",
        "",
        "Link to 4-5 of these articles using natural anchor text.",
        "Each link should appear in a contextually relevant paragraph.",
        "",
        "LINKING RULES:",
        "- Weave each link into an EXISTING sentence as natural anchor text.",
        "- NEVER list links together (no 'see also', 'read more', 'related articles' patterns).",
        "- NEVER write 'see this article and this article' or similar listing patterns.",
        "- NEVER cluster 2+ links in the same sentence or adjacent sentences.",
        "- Each link must feel like a natural part of the paragraph's argument or explanation.",
        "- Good: 'If you hold accounts in Canada, [RRSP and TFSA reporting rules](url) differ from standard accounts.'",
        "- Bad: 'For more information, see our guide on [topic](url) and our article about [topic](url).'",
        "",
    ]
    for cl in crosslinks:
        title = cl.get("title", cl.get("url", ""))
        url = cl.get("url", "")
        lines.append(f"- [{title}]({url})")
        if cl.get("summary"):
            lines.append(f"  Topic: {cl['summary']}")
    return "\n".join(lines)
