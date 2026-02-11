#!/usr/bin/env python3
"""
SK&S Law Blog Extractor
=======================
Extracts articles from the SK&S Law blog with incremental processing support.

Features:
- Scrapes blog index pages with pagination handling
- Extracts article metadata (title, author, date, tags)
- Cleans HTML content (removes nav, footer, scripts)
- Incremental extraction with state persistence
- Rate limiting to respect server resources
- Comprehensive error handling with retry logic
- Skips articles under 100 words

Output Structure:
- Raw articles: data/raw/blog/articles/blog_{url_slug}_{date}.json

Usage:
    python blog_extractor.py --url "https://www.skandslegal.com/sks-blog" \\
                             --output-dir /path/to/data/raw/blog \\
                             --state-file /path/to/data/state/blog_state.json \\
                             --skip-existing

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("blog_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_RATE_LIMIT_DELAY = 1.0  # seconds between requests
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds between retries
MIN_WORD_COUNT = 100  # minimum words for article to be processed
DEFAULT_TIMEOUT = 30  # seconds for HTTP requests

# User agent to identify the scraper
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Known authors for SK&S Law blog
KNOWN_AUTHORS = ["Sara Sharp", "Thomas Codevilla"]


class ArticleMetadata(TypedDict, total=False):
    """Type definition for article metadata."""

    url: str
    slug: str
    title: str
    author: str
    publication_date: str
    tags: list[str]
    word_count: int
    content: str
    excerpt: str
    extracted_at: str
    extractor_version: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_urls: list[str]
    failed_urls: list[str]
    skipped_urls: list[str]
    total_processed: int
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single article."""

    url: str
    success: bool
    article_path: Path | None = None
    word_count: int = 0
    error: str | None = None
    skipped_reason: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_discovered: int = 0
    processed: int = 0
    skipped_existing: int = 0
    skipped_short: int = 0
    failed: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class BlogExtractorError(Exception):
    """Base exception for blog extractor errors."""

    pass


class NetworkError(BlogExtractorError):
    """Raised when network requests fail."""

    pass


class ParseError(BlogExtractorError):
    """Raised when HTML parsing fails."""

    pass


def create_session() -> requests.Session:
    """
    Create a configured requests session.

    Returns:
        Configured requests Session object.
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
    )
    return session


def fetch_page(
    url: str,
    session: requests.Session,
    timeout: int = DEFAULT_TIMEOUT,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> str:
    """
    Fetch a page with retry logic.

    Args:
        url: URL to fetch.
        session: Requests session.
        timeout: Request timeout in seconds.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries in seconds.

    Returns:
        HTML content of the page.

    Raises:
        NetworkError: If the page cannot be fetched after retries.
    """
    last_error: Exception | None = None

    for attempt in range(retry_count):
        try:
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or "utf-8"
            return response.text
        except requests.RequestException as e:
            last_error = e
            if attempt < retry_count - 1:
                logger.warning(f"Retry {attempt + 1}/{retry_count} for {url}: {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch {url} after {retry_count} attempts: {e}")

    raise NetworkError(f"Failed to fetch {url}: {last_error}")


def extract_article_urls_from_index(
    html: str,
    base_url: str,
) -> list[str]:
    """
    Extract article URLs from a blog index page.

    Args:
        html: HTML content of the index page.
        base_url: Base URL for resolving relative links.

    Returns:
        List of absolute article URLs.
    """
    soup = BeautifulSoup(html, "html.parser")
    article_urls: list[str] = []

    # Look for article links in common patterns
    # Pattern 1: Links within blog post containers
    for link in soup.find_all("a", href=True):
        href = link["href"]

        # Skip non-article links
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue

        # Convert to absolute URL
        absolute_url = urljoin(base_url, href)
        parsed = urlparse(absolute_url)

        # Filter for blog article URLs (contain /sks-blog/ in path and are not the index)
        if "/sks-blog/" in parsed.path and parsed.path != "/sks-blog":
            # Skip pagination and category links
            if "/page/" in parsed.path or "/category/" in parsed.path:
                continue
            if "/tag/" in parsed.path:
                continue

            # Normalize URL (remove query params and fragments)
            normalized_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            normalized_url = normalized_url.rstrip("/")

            if normalized_url not in article_urls:
                article_urls.append(normalized_url)

    logger.debug(f"Found {len(article_urls)} article URLs on index page")
    return article_urls


def find_next_page_url(html: str, base_url: str) -> str | None:
    """
    Find the URL for the next page of articles.

    Args:
        html: HTML content of the current page.
        base_url: Base URL for resolving relative links.

    Returns:
        URL of the next page, or None if no more pages.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Look for "Load More" button or pagination links
    # Pattern 1: Load More button (common in Squarespace sites)
    load_more = soup.find("a", string=re.compile(r"load\s*more", re.IGNORECASE))
    if load_more and load_more.get("href"):
        return urljoin(base_url, load_more["href"])

    # Pattern 2: Numbered pagination
    pagination = soup.find("nav", class_=re.compile(r"pagination", re.IGNORECASE))
    if pagination:
        next_link = pagination.find("a", string=re.compile(r"next|>|>>", re.IGNORECASE))
        if next_link and next_link.get("href"):
            return urljoin(base_url, next_link["href"])

    # Pattern 3: Older posts link
    older = soup.find("a", string=re.compile(r"older|previous\s*posts", re.IGNORECASE))
    if older and older.get("href"):
        return urljoin(base_url, older["href"])

    # Pattern 4: Look for page number links
    current_page = None
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/page/" in href:
            match = re.search(r"/page/(\d+)", href)
            if match:
                page_num = int(match.group(1))
                if current_page is None or page_num > current_page:
                    current_page = page_num

    if current_page:
        # Try the next page
        next_page_url = re.sub(r"/page/\d+", f"/page/{current_page + 1}", base_url)
        if next_page_url != base_url:
            return next_page_url

    return None


def discover_all_articles(
    blog_url: str,
    session: requests.Session,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    max_pages: int = 50,
) -> list[str]:
    """
    Discover all article URLs by crawling index pages.

    Args:
        blog_url: Base blog URL.
        session: Requests session.
        rate_limit_delay: Delay between page requests.
        max_pages: Maximum number of index pages to crawl.

    Returns:
        List of all discovered article URLs.
    """
    all_urls: list[str] = []
    current_url: str | None = blog_url
    pages_crawled = 0

    while current_url and pages_crawled < max_pages:
        logger.info(f"Crawling index page {pages_crawled + 1}: {current_url}")

        try:
            html = fetch_page(current_url, session)
        except NetworkError as e:
            logger.error(f"Failed to fetch index page: {e}")
            break

        # Extract article URLs from this page
        page_urls = extract_article_urls_from_index(html, current_url)
        new_urls = [url for url in page_urls if url not in all_urls]

        if not new_urls:
            logger.info("No new articles found, stopping pagination")
            break

        all_urls.extend(new_urls)
        logger.info(f"Found {len(new_urls)} new articles (total: {len(all_urls)})")

        # Find next page
        current_url = find_next_page_url(html, current_url)
        pages_crawled += 1

        if current_url:
            time.sleep(rate_limit_delay)

    logger.info(f"Discovered {len(all_urls)} total articles across {pages_crawled} pages")
    return all_urls


def extract_date_from_url(url: str) -> str | None:
    """
    Extract publication date from URL pattern.

    Args:
        url: Article URL.

    Returns:
        ISO date string or None if not found.
    """
    # Pattern: /sks-blog/2024/12/13/article-slug
    match = re.search(r"/sks-blog/(\d{4})/(\d{1,2})/(\d{1,2})/", url)
    if match:
        year, month, day = match.groups()
        try:
            date = datetime(int(year), int(month), int(day))
            return date.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: /sks-blog/2024/4/23/article-slug (single digit month/day)
    match = re.search(r"/sks-blog/(\d{4})/(\d+)/(\d+)/", url)
    if match:
        year, month, day = match.groups()
        try:
            date = datetime(int(year), int(month), int(day))
            return date.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def extract_slug_from_url(url: str) -> str:
    """
    Extract a URL-safe slug from the article URL.

    Args:
        url: Article URL.

    Returns:
        URL slug suitable for filenames.
    """
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")

    # Get the last path segment
    slug = path.split("/")[-1]

    # Clean up the slug
    slug = re.sub(r"[^a-zA-Z0-9-]", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-").lower()

    # Limit length
    if len(slug) > 80:
        slug = slug[:80].rsplit("-", 1)[0]

    return slug or hashlib.md5(url.encode()).hexdigest()[:12]


def clean_html_text(element: Tag | NavigableString | None) -> str:
    """
    Clean HTML text content.

    Args:
        element: BeautifulSoup element.

    Returns:
        Cleaned text content.
    """
    if element is None:
        return ""

    if isinstance(element, NavigableString):
        return str(element).strip()

    # Remove unwanted elements
    for tag in element.find_all(["script", "style", "nav", "footer", "aside", "header"]):
        tag.decompose()

    # Remove hidden elements
    for tag in element.find_all(attrs={"style": re.compile(r"display:\s*none", re.IGNORECASE)}):
        tag.decompose()

    # Get text and normalize whitespace
    text = element.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def extract_author(soup: BeautifulSoup, html: str) -> str:
    """
    Extract author from article page.

    Args:
        soup: BeautifulSoup object.
        html: Raw HTML content.

    Returns:
        Author name or empty string.
    """
    # Pattern 1: Look for author in meta tags
    meta_author = soup.find("meta", attrs={"name": "author"})
    if meta_author and meta_author.get("content"):
        return meta_author["content"].strip()

    # Pattern 2: Look for author class
    author_elem = soup.find(class_=re.compile(r"author|byline|writer", re.IGNORECASE))
    if author_elem:
        text = clean_html_text(author_elem)
        # Clean up common prefixes
        text = re.sub(r"^(by|written by|author:?)\s*", "", text, flags=re.IGNORECASE)
        if text:
            return text

    # Pattern 3: Look for "By Author Name" pattern in content
    for known_author in KNOWN_AUTHORS:
        if known_author.lower() in html.lower():
            return known_author

    # Pattern 4: Check structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                author = data.get("author", {})
                if isinstance(author, dict):
                    name = author.get("name")
                    if name:
                        return name
                elif isinstance(author, str):
                    return author
        except (json.JSONDecodeError, TypeError):
            continue

    return ""


def extract_tags(soup: BeautifulSoup) -> list[str]:
    """
    Extract tags/categories from article page.

    Args:
        soup: BeautifulSoup object.

    Returns:
        List of tag strings.
    """
    tags: list[str] = []

    # Pattern 1: Look for tag links
    tag_container = soup.find(class_=re.compile(r"tags?|categories?", re.IGNORECASE))
    if tag_container:
        for link in tag_container.find_all("a"):
            tag_text = link.get_text(strip=True)
            if tag_text and tag_text not in tags:
                tags.append(tag_text)

    # Pattern 2: Look for meta keywords
    meta_keywords = soup.find("meta", attrs={"name": "keywords"})
    if meta_keywords and meta_keywords.get("content"):
        keywords = meta_keywords["content"].split(",")
        for kw in keywords:
            kw = kw.strip()
            if kw and kw not in tags:
                tags.append(kw)

    # Pattern 3: Check structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                article_tags = data.get("keywords", [])
                if isinstance(article_tags, list):
                    for tag in article_tags:
                        if tag and tag not in tags:
                            tags.append(tag)
        except (json.JSONDecodeError, TypeError):
            continue

    return tags


def extract_title(soup: BeautifulSoup) -> str:
    """
    Extract article title.

    Args:
        soup: BeautifulSoup object.

    Returns:
        Article title.
    """
    # Pattern 1: h1 tag
    h1 = soup.find("h1")
    if h1:
        title = clean_html_text(h1)
        if title:
            return title

    # Pattern 2: og:title meta tag
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        return og_title["content"].strip()

    # Pattern 3: title tag (fallback)
    title_tag = soup.find("title")
    if title_tag:
        title = clean_html_text(title_tag)
        # Remove site name suffix
        title = re.sub(r"\s*[|\-]\s*SK&S.*$", "", title, flags=re.IGNORECASE)
        return title

    return ""


def extract_content(soup: BeautifulSoup) -> str:
    """
    Extract main article content.

    Args:
        soup: BeautifulSoup object.

    Returns:
        Cleaned article body text.
    """
    content = ""

    # Pattern 1: Look for article or main content container
    content_selectors = [
        ("article", {}),
        ("div", {"class": re.compile(r"post-content|entry-content|article-content|blog-content", re.IGNORECASE)}),
        ("div", {"class": re.compile(r"content|body", re.IGNORECASE)}),
        ("main", {}),
    ]

    for tag, attrs in content_selectors:
        container = soup.find(tag, attrs) if attrs else soup.find(tag)
        if container:
            content = clean_html_text(container)
            if len(content.split()) >= MIN_WORD_COUNT // 2:
                break

    # Fallback: get body content minus nav/footer
    if not content or len(content.split()) < MIN_WORD_COUNT // 2:
        body = soup.find("body")
        if body:
            # Remove navigation and footer elements
            for unwanted in body.find_all(["nav", "footer", "aside", "header"]):
                unwanted.decompose()
            content = clean_html_text(body)

    return content


def extract_excerpt(soup: BeautifulSoup, content: str) -> str:
    """
    Extract article excerpt/summary.

    Args:
        soup: BeautifulSoup object.
        content: Full article content.

    Returns:
        Article excerpt.
    """
    # Pattern 1: meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        return meta_desc["content"].strip()

    # Pattern 2: og:description
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        return og_desc["content"].strip()

    # Pattern 3: First paragraph of content
    if content:
        sentences = re.split(r"[.!?]+", content)
        excerpt_sentences = []
        word_count = 0
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                excerpt_sentences.append(sentence)
                word_count += len(sentence.split())
                if word_count >= 50:
                    break
        if excerpt_sentences:
            return ". ".join(excerpt_sentences) + "."

    return ""


def extract_date_from_page(soup: BeautifulSoup) -> str | None:
    """
    Extract publication date from page content.

    Args:
        soup: BeautifulSoup object.

    Returns:
        ISO date string or None.
    """
    # Pattern 1: time element with datetime attribute
    time_elem = soup.find("time", datetime=True)
    if time_elem:
        datetime_str = time_elem["datetime"]
        try:
            # Try parsing ISO format
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern 2: meta article:published_time
    meta_pub = soup.find("meta", property="article:published_time")
    if meta_pub and meta_pub.get("content"):
        try:
            dt = datetime.fromisoformat(meta_pub["content"].replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern 3: Look for date pattern in page content
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                date_published = data.get("datePublished")
                if date_published:
                    dt = datetime.fromisoformat(date_published.replace("Z", "+00:00"))
                    return dt.strftime("%Y-%m-%d")
        except (json.JSONDecodeError, TypeError, ValueError):
            continue

    return None


def extract_article(
    url: str,
    session: requests.Session,
    output_dir: Path,
) -> ExtractionResult:
    """
    Extract and save a single article.

    Args:
        url: Article URL.
        session: Requests session.
        output_dir: Output directory for articles.

    Returns:
        ExtractionResult with status and paths.
    """
    result = ExtractionResult(url=url, success=False)

    try:
        html = fetch_page(url, session)
    except NetworkError as e:
        result.error = str(e)
        return result

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        result.error = f"Failed to parse HTML: {e}"
        return result

    # Extract article data
    title = extract_title(soup)
    if not title:
        result.error = "Could not extract article title"
        return result

    content = extract_content(soup)
    word_count = len(content.split())
    result.word_count = word_count

    if word_count < MIN_WORD_COUNT:
        result.skipped_reason = f"Article too short ({word_count} words < {MIN_WORD_COUNT})"
        result.success = True  # Not a failure, just skipped
        return result

    # Extract date from URL first, then page
    publication_date = extract_date_from_url(url)
    if not publication_date:
        publication_date = extract_date_from_page(soup)

    # Build article metadata
    article: ArticleMetadata = {
        "url": url,
        "slug": extract_slug_from_url(url),
        "title": title,
        "author": extract_author(soup, html),
        "publication_date": publication_date or "",
        "tags": extract_tags(soup),
        "word_count": word_count,
        "content": content,
        "excerpt": extract_excerpt(soup, content),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }

    # Generate filename
    date_part = publication_date or "undated"
    filename = f"blog_{article['slug']}_{date_part}.json"
    article_path = output_dir / "articles" / filename

    # Ensure directory exists
    article_path.parent.mkdir(parents=True, exist_ok=True)

    # Save article
    try:
        with open(article_path, "w", encoding="utf-8") as f:
            json.dump(article, f, indent=2, ensure_ascii=False)
        result.article_path = article_path
        result.success = True
    except Exception as e:
        result.error = f"Failed to save article: {e}"

    return result


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "blog",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_urls": [],
        "failed_urls": [],
        "skipped_urls": [],
        "total_processed": 0,
        "metadata": {
            "blog_url": None,
            "extraction_method": "requests+beautifulsoup",
        },
    }

    if not state_file.exists():
        return default_state

    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            # Ensure all required keys exist
            for key in default_state:
                if key not in state:
                    state[key] = default_state[key]
            # Backward compatibility: migrate old format
            if "skipped_urls" not in state:
                state["skipped_urls"] = []
            if "failed_urls" not in state:
                state["failed_urls"] = []
            return state
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to load state file, using defaults: {e}")
        return default_state


def save_state(state: ExtractionState, state_file: Path) -> None:
    """
    Save extraction state to file.

    Args:
        state: Extraction state dictionary.
        state_file: Path to state file.
    """
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["total_processed"] = len(state["processed_urls"])

    # Ensure parent directory exists
    state_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        logger.debug(f"Saved state to {state_file}")
    except Exception as e:
        logger.error(f"Failed to save state: {e}")


def run_extraction(
    blog_url: str,
    output_dir: Path,
    state_file: Path,
    skip_existing: bool = True,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    max_articles: int | None = None,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the full extraction process.

    Args:
        blog_url: Base blog URL.
        output_dir: Base output directory.
        state_file: Path to state file.
        skip_existing: Skip already processed URLs.
        rate_limit_delay: Delay between requests in seconds.
        max_articles: Maximum number of articles to process.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Create session
    session = create_session()

    # Load state
    state = load_state(state_file)
    state["metadata"]["blog_url"] = blog_url

    # Discover all article URLs
    logger.info(f"Discovering articles from {blog_url}")
    try:
        all_urls = discover_all_articles(blog_url, session, rate_limit_delay)
    except Exception as e:
        logger.error(f"Failed to discover articles: {e}")
        stats.errors.append({"error": str(e)})
        return stats

    stats.total_discovered = len(all_urls)

    if not all_urls:
        logger.warning("No articles found")
        return stats

    # Filter URLs based on state
    processed_set = set(state["processed_urls"])
    skipped_set = set(state.get("skipped_urls", []))

    urls_to_process: list[str] = []
    for url in all_urls:
        if skip_existing and url in processed_set:
            logger.debug(f"Skipping already processed: {url}")
            stats.skipped_existing += 1
            continue
        if skip_existing and url in skipped_set:
            logger.debug(f"Skipping (too short): {url}")
            stats.skipped_short += 1
            continue
        urls_to_process.append(url)

    # Apply max_articles limit
    if max_articles and len(urls_to_process) > max_articles:
        urls_to_process = urls_to_process[:max_articles]

    if not urls_to_process:
        logger.info("No new articles to process")
        return stats

    logger.info(f"Processing {len(urls_to_process)} articles...")

    # Process each article
    for i, url in enumerate(urls_to_process):
        logger.info(f"[{i + 1}/{len(urls_to_process)}] Processing: {url}")

        result = extract_article(url, session, output_dir)
        stats.results.append(result)

        if result.success:
            if result.skipped_reason:
                # Article was too short
                state["skipped_urls"].append(url)
                stats.skipped_short += 1
                logger.info(f"  Skipped: {result.skipped_reason}")
            else:
                state["processed_urls"].append(url)
                stats.processed += 1
                logger.info(f"  Extracted: {result.word_count} words -> {result.article_path}")

            # Remove from failed if previously failed
            if url in state["failed_urls"]:
                state["failed_urls"].remove(url)
        else:
            if url not in state["failed_urls"]:
                state["failed_urls"].append(url)
            stats.failed += 1
            stats.errors.append({"url": url, "error": result.error or "Unknown error"})
            logger.error(f"  Failed: {result.error}")

        # Save state periodically
        if (i + 1) % 5 == 0:
            save_state(state, state_file)

        # Rate limiting
        if i < len(urls_to_process) - 1:
            time.sleep(rate_limit_delay)

    # Final state save
    save_state(state, state_file)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("BLOG EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total discovered:      {stats.total_discovered}")
    print(f"Processed:             {stats.processed}")
    print(f"Skipped (existing):    {stats.skipped_existing}")
    print(f"Skipped (too short):   {stats.skipped_short}")
    print(f"Failed:                {stats.failed}")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            if "url" in err:
                print(f"  [{err['url'][:50]}...] {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the blog extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract articles from SK&S Law blog using requests and BeautifulSoup.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python blog_extractor.py --url "https://www.skandslegal.com/sks-blog"
  python blog_extractor.py --url "https://www.skandslegal.com/sks-blog" --limit 10
  python blog_extractor.py --url "https://www.skandslegal.com/sks-blog" --skip-existing

Output Structure:
  {output-dir}/articles/blog_{slug}_{date}.json - Article JSON files

Articles with fewer than 100 words are skipped and logged in the state file.
        """,
    )

    parser.add_argument(
        "--url",
        type=str,
        default="https://www.skandslegal.com/sks-blog",
        help="Blog URL to scrape (default: https://www.skandslegal.com/sks-blog)",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/blog"),
        help="Output directory for extracted content (default: data/raw/blog)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/blog_state.json"),
        help="State file for tracking processed URLs (default: data/state/blog_state.json)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of articles to process (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed articles (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all articles, ignoring state",
    )

    parser.add_argument(
        "--rate-limit",
        type=float,
        default=DEFAULT_RATE_LIMIT_DELAY,
        help=f"Delay between requests in seconds (default: {DEFAULT_RATE_LIMIT_DELAY})",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress non-error output",
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    elif args.quiet:
        logger.setLevel(logging.ERROR)

    # Resolve paths
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()

    # Run extraction
    try:
        stats = run_extraction(
            blog_url=args.url,
            output_dir=output_dir,
            state_file=state_file,
            skip_existing=args.skip_existing,
            rate_limit_delay=args.rate_limit,
            max_articles=args.limit,
            verbose=args.verbose,
        )
    except KeyboardInterrupt:
        logger.info("Extraction interrupted by user")
        return 130
    except Exception as e:
        logger.exception(f"Extraction failed: {e}")
        return 1

    # Print summary
    if not args.quiet:
        print_summary(stats)

    # Return exit code based on results
    if stats.failed > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
