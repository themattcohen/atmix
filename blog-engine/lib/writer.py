"""Claude API integration for research brief generation and article writing."""

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

MODEL = "claude-sonnet-4-20250514"


def _get_client() -> anthropic.Anthropic:
    """Get Anthropic client. Reads ANTHROPIC_API_KEY from env."""
    return anthropic.Anthropic()


def generate_research_brief(keyword: str, config: dict, secondary_keywords: list[str] | None = None) -> str:
    """Generate a research brief for the given keyword using Claude."""
    client = _get_client()

    authority_domains = config.get("research", {}).get("authorityDomains", [])
    primary_sources = config.get("research", {}).get("primarySources", [])
    tone = config.get("content", {}).get("toneGuidance", "Professional, clear, authoritative")
    author = config.get("author", {})

    system_prompt = (
        "You are an expert SEO research analyst. Your job is to create comprehensive "
        "research briefs that provide factual foundations for SEO articles.\n\n"
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

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        temperature=0.3,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[writer] generate_research_brief — model=%s input=%d output=%d cache_create=%d cache_read=%d",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_creation_input_tokens", 0),
        getattr(usage, "cache_read_input_tokens", 0),
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "generate_research_brief"
    call_info["latency_s"] = round(latency, 2)

    brief = response.content[0].text
    return (brief, call_info)


def write_article(
    keyword: str,
    config: dict,
    research_brief: str,
    nlp_targets: dict,
    additional_instructions: str = "",
    secondary_keywords: list[str] | None = None,
) -> str:
    """Write a full SEO article using Claude."""
    client = _get_client()

    # Build NLP targets section
    nlp_section = _format_nlp_targets_for_prompt(nlp_targets)

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

    system_prompt = f"""You are an expert SEO article writer. Follow the writer guide EXACTLY.

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
{secondary_section}
{f"## Additional Instructions{chr(10)}{additional_instructions}" if additional_instructions else ""}

Output ONLY the MDX article content. Start with the --- frontmatter delimiter. Follow the writer guide structure exactly."""

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        temperature=0.4,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[writer] write_article — model=%s input=%d output=%d cache_create=%d cache_read=%d",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_creation_input_tokens", 0),
        getattr(usage, "cache_read_input_tokens", 0),
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "write_article"
    call_info["latency_s"] = round(latency, 2)

    article = response.content[0].text
    return (article, call_info)



def rewrite_with_feedback(article: str, feedback: str, nlp_targets: dict | None, config: dict, keyword: str = "") -> str:
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

    system = (
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

    if keyword:
        user_msg += f"## Primary Keyword: {keyword}\n\n"

    user_msg += (
        "Rewrite the article incorporating the feedback above. "
        "Return the COMPLETE article — do not summarize or truncate. "
        "Keep the frontmatter intact, updating only if the feedback requires it."
    )

    t0 = time.time()
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        temperature=0.3,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )
    latency = time.time() - t0

    usage = response.usage
    logger.info(
        "[writer] rewrite_with_feedback — model=%s input=%d output=%d cache_create=%d cache_read=%d",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_creation_input_tokens", 0),
        getattr(usage, "cache_read_input_tokens", 0),
    )

    call_info = calc_claude_cost(MODEL, response.usage)
    call_info["call_name"] = "rewrite_with_feedback"
    call_info["latency_s"] = round(latency, 2)

    rewritten = response.content[0].text
    return (rewritten, call_info)


def _format_nlp_targets_for_prompt(nlp_targets: dict) -> str:
    """Format NLP targets dict into a readable prompt section."""
    lines = ["## NLP Term Targets (from Surfer SEO)", ""]

    if "terms" in nlp_targets:
        terms = nlp_targets["terms"]
        if isinstance(terms, dict):
            for priority in ["high_priority", "medium_priority", "low_priority"]:
                if priority in terms and terms[priority]:
                    lines.append(f"### {priority.replace('_', ' ').title()}")
                    for t in terms[priority]:
                        lines.append(
                            f"- **{t['term']}**: target {t.get('targetMin', '?')}-{t.get('targetMax', '?')}"
                        )
                    lines.append("")
        elif isinstance(terms, list):
            for t in terms:
                lines.append(
                    f"- **{t['term']}**: target {t.get('target', '?')}, current {t.get('current', 0)}"
                )
            lines.append("")

    if "targets" in nlp_targets:
        targets = nlp_targets["targets"]
        if "wordCount" in targets:
            wc = targets["wordCount"]
            lines.append(f"**Word count target**: {wc.get('min', '?')}-{wc.get('max', '?')} words")
        if "headings" in targets:
            hd = targets["headings"]
            lines.append(f"**Heading count target**: {hd.get('min', '?')}-{hd.get('max', '?')} headings")

    return "\n".join(lines)
