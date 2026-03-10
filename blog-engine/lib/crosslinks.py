"""Scrape blog index pages to discover articles for internal cross-linking."""

import json
import logging
import re
import string
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("blog-engine.crosslinks")

# Paths that are typically NOT articles
_SKIP_PATHS = {
    "/", "/about", "/contact", "/privacy", "/terms", "/login", "/signup",
    "/pricing", "/schedule", "/blog", "/blog/", "/category", "/tag",
    "/search", "/sitemap", "/feed", "/rss", "/author",
}

_SKIP_PATTERNS = re.compile(
    r"/(category|tag|author|page|wp-content|wp-admin|cdn-cgi|#)", re.IGNORECASE
)


def scrape_blog_index(blog_url: str, max_articles: int = 50) -> list[dict]:
    """Fetch a blog index page and extract article links + titles.

    Tries multiple strategies:
    1. Find <a> tags within article/post containers
    2. Find <a> tags with blog-like paths
    3. Find all internal links with substantial titles

    Returns list of {"url": str, "title": str, "path": str}.
    """
    logger.info("Scraping blog index: %s", blog_url)
    try:
        resp = requests.get(
            blog_url,
            timeout=15,
            headers={"User-Agent": "BlogEngine/1.0 (internal cross-linker)"},
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to fetch blog index %s: %s", blog_url, e)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    parsed_base = urlparse(blog_url)
    base_domain = parsed_base.netloc

    articles = []
    seen_paths = set()

    # Strategy 1: article/post containers
    containers = soup.select("article a[href], .post a[href], .blog-post a[href], .entry a[href]")
    if not containers:
        # Strategy 2: main content area links
        containers = soup.select("main a[href], .content a[href], #content a[href]")
    if not containers:
        # Strategy 3: all links (fallback)
        containers = soup.find_all("a", href=True)

    for a_tag in containers:
        href = a_tag.get("href", "").strip()
        if not href:
            continue

        # Resolve relative URLs
        full_url = urljoin(blog_url, href)
        parsed = urlparse(full_url)

        # Must be same domain
        if parsed.netloc != base_domain:
            continue

        path = parsed.path.rstrip("/")
        if not path:
            continue

        # Skip non-article paths
        if path.lower() in _SKIP_PATHS:
            continue
        if _SKIP_PATTERNS.search(path):
            continue

        # Deduplicate
        if path in seen_paths:
            continue
        seen_paths.add(path)

        # Extract title
        title = a_tag.get_text(strip=True)
        if not title or len(title) < 10:
            # Try to find a heading nearby
            heading = a_tag.find(["h1", "h2", "h3", "h4"])
            if heading:
                title = heading.get_text(strip=True)
        if not title or len(title) < 10:
            continue

        articles.append({
            "url": full_url,
            "title": title,
            "path": path,
        })

        if len(articles) >= max_articles:
            break

    logger.info("Found %d articles from %s", len(articles), blog_url)
    return articles


def fetch_article_summary(url: str, timeout: int = 10) -> str:
    """Fetch an article and extract first meaningful paragraph as summary."""
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "BlogEngine/1.0 (internal cross-linker)"},
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Failed to fetch article %s: %s", url, e)
        return ""

    soup = BeautifulSoup(resp.text, "html.parser")

    # Find content after h1
    h1 = soup.find("h1")
    start = h1 if h1 else soup.find("body")
    if not start:
        return ""

    # Look for first substantial paragraph after h1
    for p in start.find_all_next("p"):
        text = p.get_text(strip=True)
        if len(text) > 50:
            # Truncate to ~200 chars
            if len(text) > 200:
                text = text[:197] + "..."
            return text

    return ""


def discover_and_save(
    blog_url: str,
    output_dir: Path,
    max_articles: int = 30,
    fetch_summaries: bool = True,
) -> list[dict]:
    """Full pipeline: scrape index -> fetch summaries -> save crosslinks.json.

    Args:
        blog_url: URL of the blog index page.
        output_dir: Directory to save crosslinks.json.
        max_articles: Maximum number of articles to discover.
        fetch_summaries: Whether to fetch article summaries (slower).

    Returns:
        List of article dicts with url, title, path, and optionally summary.
    """
    articles = scrape_blog_index(blog_url, max_articles=max_articles)

    if fetch_summaries:
        for article in articles:
            article["summary"] = fetch_article_summary(article["url"])

    # Save to output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    crosslinks_path = output_dir / "crosslinks.json"
    crosslinks_path.write_text(
        json.dumps(articles, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info("Saved %d crosslinks to %s", len(articles), crosslinks_path)

    return articles


# ======================================================================
# Sitemap-based discovery
# ======================================================================

_SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
_UA = {"User-Agent": "BlogEngine/1.0 (internal cross-linker)"}


def _title_from_slug(path: str) -> str:
    """Convert a URL path slug to a readable title.

    ``/blog/fbar-first-time-filer-guide`` → ``Fbar First Time Filer Guide``
    """
    slug = path.rstrip("/").rsplit("/", 1)[-1]
    return slug.replace("-", " ").replace("_", " ").title()


def scrape_sitemap(base_url: str, blog_path_prefix: str = "") -> list[dict]:
    """Fetch ``/sitemap.xml`` and extract blog article URLs.

    Handles both plain sitemaps and sitemap-index files.  Titles are
    derived from the URL slug (fast, no extra requests).

    Returns list of ``{"url": str, "title": str, "path": str}``.
    """
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    logger.info("Fetching sitemap: %s", sitemap_url)

    try:
        resp = requests.get(sitemap_url, timeout=15, headers=_UA)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Failed to fetch sitemap %s: %s", sitemap_url, e)
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        logger.warning("Failed to parse sitemap XML: %s", e)
        return []

    # Detect sitemap index vs plain sitemap
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    loc_urls: list[str] = []

    if tag == "sitemapindex":
        # Follow child sitemaps
        for sitemap_loc in root.findall(".//sm:sitemap/sm:loc", _SITEMAP_NS):
            child_url = (sitemap_loc.text or "").strip()
            if not child_url:
                continue
            try:
                child_resp = requests.get(child_url, timeout=15, headers=_UA)
                child_resp.raise_for_status()
                child_root = ET.fromstring(child_resp.text)
                for loc in child_root.findall(".//sm:url/sm:loc", _SITEMAP_NS):
                    if loc.text:
                        loc_urls.append(loc.text.strip())
            except Exception as e:
                logger.warning("Failed to fetch child sitemap %s: %s", child_url, e)
    else:
        for loc in root.findall(".//sm:url/sm:loc", _SITEMAP_NS):
            if loc.text:
                loc_urls.append(loc.text.strip())

    # Filter to blog paths and build article list
    articles: list[dict] = []
    seen: set[str] = set()

    for url in loc_urls:
        parsed = urlparse(url)
        path = parsed.path.rstrip("/")
        if not path:
            continue
        if path.lower() in _SKIP_PATHS:
            continue
        if _SKIP_PATTERNS.search(path):
            continue
        if blog_path_prefix and not path.startswith(blog_path_prefix):
            continue
        if path in seen:
            continue
        seen.add(path)

        articles.append({
            "url": url,
            "title": _title_from_slug(path),
            "path": path,
        })

    logger.info("Found %d articles from sitemap", len(articles))
    return articles


def scrape_all_titles(
    base_url: str,
    output_dir: Path,
    blog_path_prefix: str = "",
    max_fallback: int = 100,
) -> list[dict]:
    """Discover all blog article titles — sitemap first, index fallback.

    Saves results to ``crosslinks.json`` (backward-compatible format).
    """
    articles = scrape_sitemap(base_url, blog_path_prefix=blog_path_prefix)

    if not articles:
        logger.info("Sitemap empty or failed, falling back to blog index scrape")
        blog_url = base_url.rstrip("/")
        if blog_path_prefix:
            blog_url += blog_path_prefix
        articles = scrape_blog_index(blog_url, max_articles=max_fallback)

    # Save to output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    crosslinks_path = output_dir / "crosslinks.json"
    crosslinks_path.write_text(
        json.dumps(articles, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info("Saved %d articles to %s", len(articles), crosslinks_path)
    return articles


# ======================================================================
# Title similarity check
# ======================================================================


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation."""
    return text.lower().translate(str.maketrans("", "", string.punctuation)).strip()


def _word_set(text: str) -> set[str]:
    """Split normalized text into a set of words."""
    return set(_normalize(text).split())


def check_title_similarity(
    new_title: str,
    existing_articles: list[dict],
    threshold: float = 0.5,
) -> list[dict]:
    """Compare *new_title* against existing articles and return matches.

    Returns a list of ``{"title", "url", "similarity", "type"}`` dicts
    sorted by similarity descending, filtered to *threshold* minimum.
    """
    matches: list[dict] = []
    norm_new = _normalize(new_title)
    words_new = _word_set(new_title)

    if not words_new:
        return []

    for article in existing_articles:
        existing_title = article.get("title", "")
        if not existing_title:
            continue

        norm_existing = _normalize(existing_title)

        # Check 1: Exact match
        if norm_new == norm_existing:
            matches.append({
                "title": existing_title,
                "url": article.get("url", ""),
                "similarity": 1.0,
                "type": "exact",
            })
            continue

        # Check 2: Substring (new in existing or vice versa)
        if norm_new in norm_existing or norm_existing in norm_new:
            matches.append({
                "title": existing_title,
                "url": article.get("url", ""),
                "similarity": 0.9,
                "type": "substring",
            })
            continue

        # Check 3: Jaccard word overlap
        words_existing = _word_set(existing_title)
        if not words_existing:
            continue
        intersection = words_new & words_existing
        union = words_new | words_existing
        jaccard = len(intersection) / len(union)
        if jaccard >= threshold:
            matches.append({
                "title": existing_title,
                "url": article.get("url", ""),
                "similarity": round(jaccard, 2),
                "type": "overlap",
            })

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    return matches
