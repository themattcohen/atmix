#!/usr/bin/env python3
"""
Media Article Extractor
=======================
Extracts articles from news websites and media outlets with quote identification.

Features:
- Accepts URLs via command line or file input
- Extracts article metadata (title, author, publication date, outlet)
- Extracts full article text using newspaper3k with BeautifulSoup fallback
- Identifies and extracts quotes attributed to Sara Sharp
- Handles paywalls gracefully (skips with warning)
- Incremental extraction with state persistence
- Rate limiting to respect server resources
- Comprehensive error handling with retry logic

Output Structure:
- Individual articles: data/raw/media/articles/media_{outlet}_{date}_{slug}.json

Usage:
    python media_extractor.py --urls "url1,url2,url3" \\
                              --url-file /path/to/urls.txt \\
                              --output-dir /path/to/data/raw/media/articles \\
                              --state-file /path/to/data/state/media_state.json

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
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("media_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_RATE_LIMIT_DELAY = 2.0  # seconds between requests
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds between retries
DEFAULT_TIMEOUT = 30  # seconds for HTTP requests
MIN_WORD_COUNT = 50  # minimum words for article to be processed

# User agent to identify the scraper
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Target person for quote extraction
TARGET_PERSON = "Sara Sharp"
TARGET_PERSON_VARIANTS = [
    "Sara Sharp",
    "Sara K. Sharp",
    "Ms. Sharp",
    "Attorney Sharp",
    "Sharp",
]

# Paywall indicators
PAYWALL_INDICATORS = [
    "subscribe to continue",
    "subscription required",
    "paywall",
    "member-only",
    "premium content",
    "sign in to read",
    "create an account",
    "for subscribers only",
    "exclusive content",
    "unlock this article",
    "register to continue",
]


class ArticleMetadata(TypedDict, total=False):
    """Type definition for article metadata."""

    url: str
    slug: str
    title: str
    author: str
    publication_date: str
    outlet: str
    outlet_domain: str
    word_count: int
    content: str
    excerpt: str
    quotes: list[dict[str, str]]
    has_target_quotes: bool
    target_quotes: list[dict[str, str]]
    extracted_at: str
    extractor_version: str
    extraction_method: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_urls: list[str]
    failed_urls: list[str]
    skipped_urls: list[str]
    paywalled_urls: list[str]
    total_processed: int
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single article."""

    url: str
    success: bool
    article_path: Path | None = None
    word_count: int = 0
    has_target_quotes: bool = False
    quote_count: int = 0
    error: str | None = None
    skipped_reason: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_urls: int = 0
    processed: int = 0
    skipped_existing: int = 0
    skipped_short: int = 0
    skipped_paywall: int = 0
    failed: int = 0
    with_target_quotes: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class MediaExtractorError(Exception):
    """Base exception for media extractor errors."""

    pass


class NetworkError(MediaExtractorError):
    """Raised when network requests fail."""

    pass


class ParseError(MediaExtractorError):
    """Raised when HTML parsing fails."""

    pass


class PaywallError(MediaExtractorError):
    """Raised when article appears to be behind paywall."""

    pass


def check_newspaper_installed() -> bool:
    """
    Check if newspaper3k library is installed.

    Returns:
        True if newspaper3k is available, False otherwise.
    """
    try:
        import newspaper  # noqa: F401
        return True
    except ImportError:
        return False


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
            "Upgrade-Insecure-Requests": "1",
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
        PaywallError: If the page appears to be paywalled.
    """
    last_error: Exception | None = None

    for attempt in range(retry_count):
        try:
            response = session.get(url, timeout=timeout, allow_redirects=True)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or "utf-8"
            html = response.text

            # Check for paywall indicators
            html_lower = html.lower()
            for indicator in PAYWALL_INDICATORS:
                if indicator in html_lower:
                    # Verify it's not just mentioned in passing
                    if html_lower.count(indicator) > 2 or len(html) < 5000:
                        raise PaywallError(f"Article appears to be behind paywall: {indicator}")

            return html

        except PaywallError:
            raise  # Don't retry paywall errors

        except requests.RequestException as e:
            last_error = e
            if attempt < retry_count - 1:
                # Check for specific status codes that shouldn't be retried
                if hasattr(e, "response") and e.response is not None:
                    if e.response.status_code in (401, 403, 404, 410, 451):
                        break
                logger.warning(f"Retry {attempt + 1}/{retry_count} for {url}: {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch {url} after {retry_count} attempts: {e}")

    raise NetworkError(f"Failed to fetch {url}: {last_error}")


def extract_outlet_from_url(url: str) -> tuple[str, str]:
    """
    Extract publication outlet name and domain from URL.

    Args:
        url: Article URL.

    Returns:
        Tuple of (outlet_name, domain).
    """
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # Remove www. prefix
    if domain.startswith("www."):
        domain = domain[4:]

    # Common outlet mappings
    outlet_mappings = {
        "nytimes.com": "New York Times",
        "wsj.com": "Wall Street Journal",
        "washingtonpost.com": "Washington Post",
        "reuters.com": "Reuters",
        "apnews.com": "Associated Press",
        "bloomberg.com": "Bloomberg",
        "forbes.com": "Forbes",
        "businessinsider.com": "Business Insider",
        "cnbc.com": "CNBC",
        "cnn.com": "CNN",
        "bbc.com": "BBC",
        "bbc.co.uk": "BBC",
        "theguardian.com": "The Guardian",
        "ft.com": "Financial Times",
        "economist.com": "The Economist",
        "law.com": "Law.com",
        "law360.com": "Law360",
        "legaltimes.com": "Legal Times",
        "abajournal.com": "ABA Journal",
        "nationallawjournal.com": "National Law Journal",
        "americanlawyer.com": "The American Lawyer",
    }

    # Check mappings
    for pattern, name in outlet_mappings.items():
        if pattern in domain:
            return name, domain

    # Generate name from domain
    parts = domain.split(".")
    if len(parts) >= 2:
        name = parts[-2].replace("-", " ").title()
    else:
        name = domain.replace("-", " ").title()

    return name, domain


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

    # Remove file extension
    if "." in slug:
        slug = slug.rsplit(".", 1)[0]

    # Clean up the slug
    slug = re.sub(r"[^a-zA-Z0-9-]", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-").lower()

    # Limit length
    if len(slug) > 60:
        slug = slug[:60].rsplit("-", 1)[0]

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
    for tag in element.find_all(
        ["script", "style", "nav", "footer", "aside", "header", "noscript", "iframe"]
    ):
        tag.decompose()

    # Remove hidden elements
    for tag in element.find_all(
        attrs={"style": re.compile(r"display:\s*none", re.IGNORECASE)}
    ):
        tag.decompose()

    # Remove ad containers
    for tag in element.find_all(class_=re.compile(r"ad[s-]|advertisement|promo", re.IGNORECASE)):
        tag.decompose()

    # Get text and normalize whitespace
    text = element.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def extract_with_newspaper(url: str, html: str) -> dict[str, Any] | None:
    """
    Extract article using newspaper3k library.

    Args:
        url: Article URL.
        html: HTML content.

    Returns:
        Extracted article data or None if extraction fails.
    """
    if not check_newspaper_installed():
        return None

    try:
        from newspaper import Article

        article = Article(url)
        article.set_html(html)
        article.parse()

        # Format date if available
        pub_date = None
        if article.publish_date:
            pub_date = article.publish_date.strftime("%Y-%m-%d")

        return {
            "title": article.title or "",
            "author": ", ".join(article.authors) if article.authors else "",
            "publication_date": pub_date,
            "content": article.text or "",
            "excerpt": article.meta_description or "",
        }

    except Exception as e:
        logger.debug(f"newspaper3k extraction failed: {e}")
        return None


def extract_title(soup: BeautifulSoup) -> str:
    """
    Extract article title from HTML.

    Args:
        soup: BeautifulSoup object.

    Returns:
        Article title.
    """
    # Pattern 1: h1 tag
    h1 = soup.find("h1")
    if h1:
        title = clean_html_text(h1)
        if title and len(title) > 10:
            return title

    # Pattern 2: og:title meta tag
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        return og_title["content"].strip()

    # Pattern 3: twitter:title meta tag
    twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
    if twitter_title and twitter_title.get("content"):
        return twitter_title["content"].strip()

    # Pattern 4: title tag (fallback)
    title_tag = soup.find("title")
    if title_tag:
        title = clean_html_text(title_tag)
        # Remove site name suffix patterns
        title = re.sub(r"\s*[|\-:]\s*[^|\-:]+$", "", title)
        return title

    return ""


def extract_author(soup: BeautifulSoup) -> str:
    """
    Extract author from article page.

    Args:
        soup: BeautifulSoup object.

    Returns:
        Author name or empty string.
    """
    # Pattern 1: Look for author in meta tags
    meta_author = soup.find("meta", attrs={"name": "author"})
    if meta_author and meta_author.get("content"):
        return meta_author["content"].strip()

    # Pattern 2: article:author meta tag
    article_author = soup.find("meta", property="article:author")
    if article_author and article_author.get("content"):
        return article_author["content"].strip()

    # Pattern 3: Look for author class/rel
    author_patterns = [
        ("a", {"rel": "author"}),
        ("span", {"class": re.compile(r"author|byline|writer", re.IGNORECASE)}),
        ("p", {"class": re.compile(r"author|byline", re.IGNORECASE)}),
        ("div", {"class": re.compile(r"author|byline", re.IGNORECASE)}),
    ]

    for tag, attrs in author_patterns:
        author_elem = soup.find(tag, attrs)
        if author_elem:
            text = clean_html_text(author_elem)
            # Clean up common prefixes
            text = re.sub(r"^(by|written by|author:?)\s*", "", text, flags=re.IGNORECASE)
            if text and len(text) < 100:  # Reasonable author name length
                return text

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
                elif isinstance(author, list) and author:
                    first_author = author[0]
                    if isinstance(first_author, dict):
                        return first_author.get("name", "")
                    elif isinstance(first_author, str):
                        return first_author
        except (json.JSONDecodeError, TypeError):
            continue

    return ""


def extract_date(soup: BeautifulSoup, url: str) -> str | None:
    """
    Extract publication date from article page.

    Args:
        soup: BeautifulSoup object.
        url: Article URL (for date extraction from URL).

    Returns:
        ISO date string or None.
    """
    # Pattern 1: time element with datetime attribute
    time_elem = soup.find("time", datetime=True)
    if time_elem:
        datetime_str = time_elem["datetime"]
        try:
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

    # Pattern 3: meta date
    meta_date = soup.find("meta", attrs={"name": "date"})
    if meta_date and meta_date.get("content"):
        try:
            dt = datetime.fromisoformat(meta_date["content"].replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern 4: Check structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                date_published = data.get("datePublished") or data.get("dateCreated")
                if date_published:
                    dt = datetime.fromisoformat(date_published.replace("Z", "+00:00"))
                    return dt.strftime("%Y-%m-%d")
        except (json.JSONDecodeError, TypeError, ValueError):
            continue

    # Pattern 5: Extract date from URL
    date_patterns = [
        r"/(\d{4})/(\d{1,2})/(\d{1,2})/",  # /2024/01/15/
        r"/(\d{4})-(\d{2})-(\d{2})/",  # /2024-01-15/
        r"[/-](\d{4})(\d{2})(\d{2})[/-]",  # /20240115/
    ]

    for pattern in date_patterns:
        match = re.search(pattern, url)
        if match:
            try:
                year, month, day = match.groups()
                date = datetime(int(year), int(month), int(day))
                return date.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


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
        ("div", {"class": re.compile(r"article-body|article-content|story-body", re.IGNORECASE)}),
        ("div", {"class": re.compile(r"post-content|entry-content|body-content", re.IGNORECASE)}),
        ("div", {"itemprop": "articleBody"}),
        ("div", {"class": re.compile(r"content|body", re.IGNORECASE)}),
        ("main", {}),
    ]

    for tag, attrs in content_selectors:
        container = soup.find(tag, attrs) if attrs else soup.find(tag)
        if container:
            content = clean_html_text(container)
            if len(content.split()) >= MIN_WORD_COUNT:
                break

    # Fallback: get body content minus nav/footer
    if not content or len(content.split()) < MIN_WORD_COUNT:
        body = soup.find("body")
        if body:
            body_copy = BeautifulSoup(str(body), "html.parser")
            for unwanted in body_copy.find_all(
                ["nav", "footer", "aside", "header", "script", "style"]
            ):
                unwanted.decompose()
            content = clean_html_text(body_copy)

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


def extract_quotes(content: str, target_person: str = TARGET_PERSON) -> tuple[list[dict], list[dict]]:
    """
    Extract quotes from article content, identifying those from target person.

    Args:
        content: Article text content.
        target_person: Name of person to identify quotes from.

    Returns:
        Tuple of (all_quotes, target_quotes).
    """
    all_quotes: list[dict[str, str]] = []
    target_quotes: list[dict[str, str]] = []

    # Quote patterns - matches text in quotes
    quote_patterns = [
        r'"([^"]{10,500})"',  # Double quotes
        r"'([^']{10,500})'",  # Single quotes
        r'"([^"]{10,500})"',  # Smart double quotes
        r"'([^']{10,500})'",  # Smart single quotes
    ]

    # Find all quoted text
    found_quotes: set[str] = set()
    for pattern in quote_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            quote_text = match.group(1).strip()
            if quote_text not in found_quotes:
                found_quotes.add(quote_text)

                # Get context around the quote
                start = max(0, match.start() - 100)
                end = min(len(content), match.end() + 100)
                context = content[start:end]

                # Try to identify speaker
                speaker = identify_quote_speaker(context, quote_text)

                quote_entry = {
                    "text": quote_text,
                    "speaker": speaker,
                    "context": context.strip(),
                }
                all_quotes.append(quote_entry)

                # Check if quote is from target person
                if is_target_person_quote(context, quote_text, target_person):
                    target_quotes.append(quote_entry)

    return all_quotes, target_quotes


def identify_quote_speaker(context: str, quote: str) -> str:
    """
    Attempt to identify the speaker of a quote from context.

    Args:
        context: Text around the quote.
        quote: The quote text.

    Returns:
        Identified speaker name or empty string.
    """
    # Look for attribution patterns
    attribution_patterns = [
        r"(?:said|says|stated|explained|noted|added|remarked|commented|wrote)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:said|says|stated|explained|noted|added|remarked|commented|wrote)",
        r"according to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+told",
    ]

    for pattern in attribution_patterns:
        match = re.search(pattern, context, re.IGNORECASE)
        if match:
            speaker = match.group(1).strip()
            # Filter out common non-name matches
            if speaker.lower() not in ["the", "a", "an", "this", "that", "he", "she", "they"]:
                return speaker

    return ""


def is_target_person_quote(context: str, quote: str, target_person: str) -> bool:
    """
    Check if a quote appears to be from the target person.

    Args:
        context: Text around the quote.
        quote: The quote text.
        target_person: Name to look for.

    Returns:
        True if quote appears to be from target person.
    """
    context_lower = context.lower()

    # Check for any variant of the target person's name
    for variant in TARGET_PERSON_VARIANTS:
        if variant.lower() in context_lower:
            # Check proximity - name should be within reasonable distance of quote
            name_pos = context_lower.find(variant.lower())
            quote_pos = context_lower.find(quote[:20].lower())

            if quote_pos != -1 and abs(name_pos - quote_pos) < 200:
                return True

    return False


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

    # Fetch page
    try:
        html = fetch_page(url, session)
    except PaywallError as e:
        result.error = str(e)
        result.skipped_reason = "paywall"
        return result
    except NetworkError as e:
        result.error = str(e)
        return result

    # Parse HTML
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        result.error = f"Failed to parse HTML: {e}"
        return result

    # Try newspaper3k first, then fall back to BeautifulSoup
    extraction_method = "beautifulsoup"
    newspaper_data = extract_with_newspaper(url, html)

    if newspaper_data and newspaper_data.get("content"):
        title = newspaper_data.get("title") or extract_title(soup)
        author = newspaper_data.get("author") or extract_author(soup)
        publication_date = newspaper_data.get("publication_date") or extract_date(soup, url)
        content = newspaper_data.get("content")
        excerpt = newspaper_data.get("excerpt") or extract_excerpt(soup, content)
        extraction_method = "newspaper3k"
    else:
        title = extract_title(soup)
        author = extract_author(soup)
        publication_date = extract_date(soup, url)
        content = extract_content(soup)
        excerpt = extract_excerpt(soup, content)

    # Validate extraction
    if not title:
        result.error = "Could not extract article title"
        return result

    word_count = len(content.split()) if content else 0
    result.word_count = word_count

    if word_count < MIN_WORD_COUNT:
        result.skipped_reason = f"Article too short ({word_count} words < {MIN_WORD_COUNT})"
        result.success = True  # Not a failure, just skipped
        return result

    # Extract outlet information
    outlet, outlet_domain = extract_outlet_from_url(url)

    # Extract quotes
    all_quotes, target_quotes = extract_quotes(content)
    result.has_target_quotes = len(target_quotes) > 0
    result.quote_count = len(target_quotes)

    # Build article metadata
    article: ArticleMetadata = {
        "url": url,
        "slug": extract_slug_from_url(url),
        "title": title,
        "author": author,
        "publication_date": publication_date or "",
        "outlet": outlet,
        "outlet_domain": outlet_domain,
        "word_count": word_count,
        "content": content,
        "excerpt": excerpt,
        "quotes": all_quotes[:20],  # Limit to 20 quotes
        "has_target_quotes": result.has_target_quotes,
        "target_quotes": target_quotes,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
        "extraction_method": extraction_method,
    }

    # Generate filename
    # Sanitize outlet name for filename
    outlet_safe = re.sub(r"[^a-zA-Z0-9]", "", outlet.lower())[:20]
    date_part = publication_date or "undated"
    slug = article["slug"][:40]
    filename = f"media_{outlet_safe}_{date_part}_{slug}.json"

    article_path = output_dir / filename

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


def load_urls_from_file(file_path: Path) -> list[str]:
    """
    Load URLs from a text file (one URL per line).

    Args:
        file_path: Path to URL file.

    Returns:
        List of URLs.
    """
    urls: list[str] = []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith("#"):
                    # Validate URL format
                    if line.startswith("http://") or line.startswith("https://"):
                        urls.append(line)
                    else:
                        logger.warning(f"Skipping invalid URL: {line}")
    except Exception as e:
        logger.error(f"Failed to read URL file {file_path}: {e}")

    return urls


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "media",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_urls": [],
        "failed_urls": [],
        "skipped_urls": [],
        "paywalled_urls": [],
        "total_processed": 0,
        "metadata": {
            "outlets_processed": [],
            "extraction_method": "newspaper3k+beautifulsoup",
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
            # Backward compatibility
            if "paywalled_urls" not in state:
                state["paywalled_urls"] = []
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
    urls: list[str],
    output_dir: Path,
    state_file: Path,
    skip_existing: bool = True,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the full extraction process.

    Args:
        urls: List of article URLs to process.
        output_dir: Output directory for articles.
        state_file: Path to state file.
        skip_existing: Skip already processed URLs.
        rate_limit_delay: Delay between requests in seconds.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()
    stats.total_urls = len(urls)

    # Create session
    session = create_session()

    # Load state
    state = load_state(state_file)

    # Check for newspaper3k availability
    if check_newspaper_installed():
        logger.info("newspaper3k available - using for primary extraction")
    else:
        logger.info("newspaper3k not available - using BeautifulSoup only")
        logger.info("Install newspaper3k for better extraction: pip install newspaper3k")

    # Filter URLs based on state
    processed_set = set(state["processed_urls"])
    skipped_set = set(state.get("skipped_urls", []))
    paywalled_set = set(state.get("paywalled_urls", []))

    urls_to_process: list[str] = []
    for url in urls:
        if skip_existing and url in processed_set:
            logger.debug(f"Skipping already processed: {url}")
            stats.skipped_existing += 1
            continue
        if skip_existing and url in skipped_set:
            logger.debug(f"Skipping (too short): {url}")
            stats.skipped_short += 1
            continue
        if skip_existing and url in paywalled_set:
            logger.debug(f"Skipping (paywalled): {url}")
            stats.skipped_paywall += 1
            continue
        urls_to_process.append(url)

    if not urls_to_process:
        logger.info("No new URLs to process")
        return stats

    logger.info(f"Processing {len(urls_to_process)} articles...")

    # Process each URL
    for i, url in enumerate(urls_to_process):
        logger.info(f"[{i + 1}/{len(urls_to_process)}] Processing: {url[:80]}...")

        result = extract_article(url, session, output_dir)
        stats.results.append(result)

        if result.success:
            if result.skipped_reason == "paywall":
                state["paywalled_urls"].append(url)
                stats.skipped_paywall += 1
                logger.warning(f"  Skipped (paywall): {result.error}")
            elif result.skipped_reason:
                # Article was too short
                state["skipped_urls"].append(url)
                stats.skipped_short += 1
                logger.info(f"  Skipped: {result.skipped_reason}")
            else:
                state["processed_urls"].append(url)
                stats.processed += 1

                # Track outlet
                outlet, _ = extract_outlet_from_url(url)
                if outlet not in state["metadata"].get("outlets_processed", []):
                    state["metadata"].setdefault("outlets_processed", []).append(outlet)

                quote_info = ""
                if result.has_target_quotes:
                    stats.with_target_quotes += 1
                    quote_info = f" [{result.quote_count} Sara Sharp quote(s)]"

                logger.info(
                    f"  Extracted: {result.word_count} words -> {result.article_path.name if result.article_path else 'N/A'}{quote_info}"
                )

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
    print("MEDIA EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total URLs provided:       {stats.total_urls}")
    print(f"Processed:                 {stats.processed}")
    print(f"With Sara Sharp quotes:    {stats.with_target_quotes}")
    print(f"Skipped (existing):        {stats.skipped_existing}")
    print(f"Skipped (too short):       {stats.skipped_short}")
    print(f"Skipped (paywall):         {stats.skipped_paywall}")
    print(f"Failed:                    {stats.failed}")

    if stats.with_target_quotes > 0:
        print(f"\n{stats.with_target_quotes} article(s) contain quotes from Sara Sharp.")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            url_display = err["url"][:50] + "..." if len(err["url"]) > 50 else err["url"]
            print(f"  [{url_display}] {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the media extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract articles from news websites and media outlets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python media_extractor.py --urls "https://example.com/article1,https://example.com/article2"
  python media_extractor.py --url-file /path/to/urls.txt
  python media_extractor.py --urls "url1,url2" --url-file more_urls.txt

Output Structure:
  {output-dir}/media_{outlet}_{date}_{slug}.json - Article JSON files

Each article JSON includes:
  - Full article text and metadata
  - Extracted quotes with speaker attribution
  - Sara Sharp quotes specifically identified
  - Publication outlet information

For best results, install newspaper3k: pip install newspaper3k
        """,
    )

    parser.add_argument(
        "--urls",
        type=str,
        default=None,
        help="Comma-separated list of article URLs",
    )

    parser.add_argument(
        "--url-file",
        type=Path,
        default=None,
        help="Path to file containing URLs (one per line)",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/media/articles"),
        help="Output directory for extracted articles (default: data/raw/media/articles)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/media_state.json"),
        help="State file for tracking processed URLs (default: data/state/media_state.json)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed URLs (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all URLs, ignoring state",
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

    # Collect URLs from all sources
    all_urls: list[str] = []

    if args.urls:
        manual_urls = [url.strip() for url in args.urls.split(",") if url.strip()]
        all_urls.extend(manual_urls)
        logger.info(f"Loaded {len(manual_urls)} URLs from command line")

    if args.url_file:
        file_path = args.url_file.resolve()
        if file_path.exists():
            file_urls = load_urls_from_file(file_path)
            all_urls.extend(file_urls)
            logger.info(f"Loaded {len(file_urls)} URLs from {file_path}")
        else:
            logger.error(f"URL file not found: {file_path}")
            return 1

    # Deduplicate URLs
    all_urls = list(dict.fromkeys(all_urls))

    if not all_urls:
        logger.error("No URLs provided. Use --urls or --url-file to specify articles.")
        return 1

    logger.info(f"Total unique URLs to process: {len(all_urls)}")

    # Resolve paths
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()

    # Run extraction
    try:
        stats = run_extraction(
            urls=all_urls,
            output_dir=output_dir,
            state_file=state_file,
            skip_existing=args.skip_existing,
            rate_limit_delay=args.rate_limit,
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
