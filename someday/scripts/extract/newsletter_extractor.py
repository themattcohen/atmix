#!/usr/bin/env python3
"""
GoHighLevel Newsletter Extractor
=================================
Extracts newsletters from GoHighLevel (GHL) platform exports or API.

Features:
- Multiple input methods: GHL API, CSV/JSON exports, HTML archives
- Extracts subject, send date, body content, links, campaign info
- Cleans HTML to readable text while preserving structure
- Duplicate detection via content hashing
- State tracking for incremental processing
- Handles various email export formats

Output Structure:
- Individual emails: data/raw/newsletter/emails/newsletter_{date}_{slug}.json
- Combined export: data/raw/newsletter/all_newsletters.json

Usage:
    # From export file
    python newsletter_extractor.py --input /path/to/export.csv \\
                                   --output-dir /path/to/data/raw/newsletter \\
                                   --state-file /path/to/data/state/newsletter_state.json

    # From GHL API (when credentials available)
    python newsletter_extractor.py --ghl-api \\
                                   --location-id YOUR_LOCATION_ID \\
                                   --output-dir /path/to/data/raw/newsletter

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urljoin, urlparse

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("newsletter_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
MIN_CONTENT_LENGTH = 50  # Minimum characters for valid newsletter
DEFAULT_TIMEOUT = 30  # seconds for HTTP requests
DEFAULT_RATE_LIMIT_DELAY = 1.0  # seconds between API requests
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0

# GHL API endpoints
GHL_API_BASE = "https://services.leadconnectorhq.com"
GHL_API_VERSION = "2021-07-28"

# Email date format patterns
DATE_PATTERNS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%Y/%m/%d",
    "%a, %d %b %Y %H:%M:%S %z",  # RFC 2822 format
    "%d %b %Y %H:%M:%S",
]

# Column name mappings for various export formats
COLUMN_MAPPINGS = {
    "subject": [
        "Subject", "subject", "Email Subject", "email_subject",
        "Title", "title", "Name", "name", "Campaign Name", "campaign_name"
    ],
    "body": [
        "Body", "body", "Content", "content", "HTML", "html",
        "Email Body", "email_body", "HTML Body", "html_body",
        "Text", "text", "Message", "message"
    ],
    "date": [
        "Date", "date", "Send Date", "send_date", "Sent Date", "sent_date",
        "Created", "created", "Created At", "created_at", "createdAt",
        "Scheduled", "scheduled", "scheduledAt", "Published", "published"
    ],
    "campaign": [
        "Campaign", "campaign", "Campaign ID", "campaign_id", "campaignId",
        "List", "list", "List Name", "list_name", "Audience", "audience"
    ],
    "status": [
        "Status", "status", "State", "state", "Email Status", "email_status"
    ],
    "id": [
        "ID", "id", "Email ID", "email_id", "emailId", "Message ID", "message_id"
    ],
    "opens": [
        "Opens", "opens", "Open Count", "open_count", "openCount", "Opened", "opened"
    ],
    "clicks": [
        "Clicks", "clicks", "Click Count", "click_count", "clickCount", "Clicked", "clicked"
    ],
    "recipients": [
        "Recipients", "recipients", "Recipient Count", "recipient_count",
        "Sent To", "sent_to", "Subscribers", "subscribers"
    ],
}


class NewsletterMetadata(TypedDict, total=False):
    """Type definition for newsletter metadata."""

    newsletter_id: str
    subject: str
    subject_slug: str
    body_html: str
    body_text: str
    body_preview: str
    send_date: str
    send_timestamp: int | None
    campaign_name: str
    campaign_id: str
    status: str
    links: list[dict[str, str]]
    opens: int
    clicks: int
    recipients: int
    word_count: int
    character_count: int
    extracted_at: str
    extractor_version: str
    source_format: str
    source_file: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_ids: list[str]
    failed_ids: list[str]
    content_hashes: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single newsletter."""

    newsletter_id: str
    success: bool
    newsletter_path: Path | None = None
    error: str | None = None
    skipped_reason: str | None = None
    is_duplicate: bool = False


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_discovered: int = 0
    processed: int = 0
    skipped_existing: int = 0
    skipped_empty: int = 0
    skipped_duplicate: int = 0
    failed: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class NewsletterExtractorError(Exception):
    """Base exception for newsletter extractor errors."""

    pass


class FileFormatError(NewsletterExtractorError):
    """Raised when file format cannot be determined or is unsupported."""

    pass


class ParseError(NewsletterExtractorError):
    """Raised when parsing the export file fails."""

    pass


class APIError(NewsletterExtractorError):
    """Raised when GHL API requests fail."""

    pass


class EncodingError(NewsletterExtractorError):
    """Raised when encoding issues are encountered."""

    pass


def generate_newsletter_id(subject: str, date_str: str | None = None, content: str | None = None) -> str:
    """
    Generate a unique newsletter ID from content hash.

    Args:
        subject: Email subject line.
        date_str: Optional date string for additional uniqueness.
        content: Optional body content for hashing.

    Returns:
        12-character hexadecimal hash ID.
    """
    hash_input = subject.strip()
    if date_str:
        hash_input += f"|{date_str}"
    if content:
        hash_input += f"|{content[:500]}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:12]


def generate_content_hash(content: str) -> str:
    """
    Generate a hash of the content for duplicate detection.

    Args:
        content: Newsletter body content.

    Returns:
        32-character hexadecimal hash.
    """
    # Normalize whitespace for consistent hashing
    normalized = re.sub(r"\s+", " ", content.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


def parse_date(date_str: str | None) -> tuple[str | None, int | None]:
    """
    Parse various email date formats.

    Args:
        date_str: Date string from export.

    Returns:
        Tuple of (ISO date string, Unix timestamp) or (None, None) if parsing fails.
    """
    if not date_str or not date_str.strip():
        return None, None

    date_str = date_str.strip()

    for pattern in DATE_PATTERNS:
        try:
            dt = datetime.strptime(date_str, pattern)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%d"), int(dt.timestamp())
        except ValueError:
            continue

    # Try parsing as ISO format
    try:
        if "+" in date_str or "Z" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d"), int(dt.timestamp())
    except ValueError:
        pass

    logger.warning(f"Could not parse date: {date_str}")
    return None, None


def create_slug(text: str, max_length: int = 50) -> str:
    """
    Create a URL-safe slug from text.

    Args:
        text: Text to convert to slug.
        max_length: Maximum length of slug.

    Returns:
        URL-safe slug string.
    """
    if not text:
        return "untitled"

    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower())
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")

    if len(slug) > max_length:
        slug = slug[:max_length].rsplit("-", 1)[0]

    return slug or "untitled"


def html_to_text(html: str) -> str:
    """
    Convert HTML to clean readable text.

    Args:
        html: HTML content string.

    Returns:
        Cleaned plain text.
    """
    if not html:
        return ""

    if not HAS_BS4:
        # Fallback: basic regex-based cleaning
        text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        text = re.sub(r"&lt;", "<", text)
        text = re.sub(r"&gt;", ">", text)
        text = re.sub(r"&quot;", '"', text)
        text = re.sub(r"&#\d+;", "", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    soup = BeautifulSoup(html, "html.parser")

    # Remove unwanted elements
    for element in soup.find_all(["script", "style", "head", "meta", "link"]):
        element.decompose()

    # Handle line breaks
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # Handle paragraphs and divs
    for tag in soup.find_all(["p", "div", "tr", "li"]):
        tag.insert_after("\n")

    # Handle headers
    for i in range(1, 7):
        for tag in soup.find_all(f"h{i}"):
            tag.insert_before("\n\n")
            tag.insert_after("\n")

    # Get text
    text = soup.get_text(separator=" ")

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.strip() for line in text.split("\n"))

    return text.strip()


def extract_links(html: str, base_url: str | None = None) -> list[dict[str, str]]:
    """
    Extract links from HTML content.

    Args:
        html: HTML content string.
        base_url: Base URL for resolving relative links.

    Returns:
        List of dictionaries with 'url' and 'text' keys.
    """
    if not html:
        return []

    links: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    if HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue
            if href.startswith("mailto:") or href.startswith("tel:"):
                continue

            # Resolve relative URLs
            if base_url and not href.startswith(("http://", "https://")):
                href = urljoin(base_url, href)

            # Normalize URL
            href = href.rstrip("/")

            if href not in seen_urls:
                seen_urls.add(href)
                link_text = anchor.get_text(strip=True) or ""
                links.append({"url": href, "text": link_text[:200]})
    else:
        # Fallback: regex-based link extraction
        pattern = r'href=["\']([^"\']+)["\']'
        for match in re.finditer(pattern, html, re.IGNORECASE):
            href = match.group(1)
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue
            if href.startswith("mailto:") or href.startswith("tel:"):
                continue

            if base_url and not href.startswith(("http://", "https://")):
                href = urljoin(base_url, href)

            href = href.rstrip("/")

            if href not in seen_urls:
                seen_urls.add(href)
                links.append({"url": href, "text": ""})

    return links


def get_column_value(row: dict[str, Any], column_type: str, default: Any = None) -> Any:
    """
    Get value from row using flexible column name mapping.

    Args:
        row: Dictionary row from CSV/JSON.
        column_type: Type of column (subject, body, date, etc.).
        default: Default value if column not found.

    Returns:
        Column value or default.
    """
    possible_names = COLUMN_MAPPINGS.get(column_type, [])
    for name in possible_names:
        if name in row:
            value = row[name]
            if value is not None and str(value).strip():
                return value
    return default


def safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to integer.

    Args:
        value: Value to convert.
        default: Default if conversion fails.

    Returns:
        Integer value.
    """
    if value is None:
        return default
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
            if not value:
                return default
        return int(float(value))
    except (ValueError, TypeError):
        return default


def detect_file_format(input_path: Path, explicit_format: str | None = None) -> str:
    """
    Detect file format from extension or explicit format.

    Args:
        input_path: Path to input file.
        explicit_format: Explicitly specified format.

    Returns:
        Format string ('csv', 'json', or 'html').

    Raises:
        FileFormatError: If format cannot be determined.
    """
    if explicit_format:
        fmt = explicit_format.lower().strip()
        if fmt in ("csv", "json", "html", "htm", "mhtml"):
            return "html" if fmt in ("html", "htm", "mhtml") else fmt
        raise FileFormatError(f"Unsupported format: {explicit_format}. Use 'csv', 'json', or 'html'.")

    ext = input_path.suffix.lower()
    if ext == ".csv":
        return "csv"
    elif ext == ".json":
        return "json"
    elif ext in (".html", ".htm", ".mhtml"):
        return "html"
    else:
        raise FileFormatError(
            f"Cannot determine format from extension: {ext}. "
            "Use --format to specify 'csv', 'json', or 'html'."
        )


def read_csv_newsletters(input_path: Path) -> list[dict[str, Any]]:
    """
    Read newsletters from CSV file.

    Args:
        input_path: Path to CSV file.

    Returns:
        List of newsletter dictionaries.

    Raises:
        ParseError: If CSV cannot be parsed.
        EncodingError: If encoding issues occur.
    """
    newsletters: list[dict[str, Any]] = []
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

    for encoding in encodings:
        try:
            with open(input_path, "r", encoding=encoding, newline="") as f:
                # Detect delimiter
                sample = f.read(4096)
                f.seek(0)

                sniffer = csv.Sniffer()
                try:
                    dialect = sniffer.sniff(sample, delimiters=",;\t|")
                except csv.Error:
                    dialect = csv.excel

                reader = csv.DictReader(f, dialect=dialect)

                for row in reader:
                    newsletters.append(dict(row))

                logger.info(f"Successfully read {len(newsletters)} rows from CSV using {encoding} encoding")
                return newsletters

        except UnicodeDecodeError:
            continue
        except csv.Error as e:
            raise ParseError(f"CSV parsing error: {e}")
        except Exception as e:
            raise ParseError(f"Error reading CSV: {e}")

    raise EncodingError(f"Could not read file with any supported encoding: {encodings}")


def read_json_newsletters(input_path: Path) -> list[dict[str, Any]]:
    """
    Read newsletters from JSON file.

    Args:
        input_path: Path to JSON file.

    Returns:
        List of newsletter dictionaries.

    Raises:
        ParseError: If JSON cannot be parsed.
    """
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ParseError(f"JSON parsing error: {e}")
    except UnicodeDecodeError:
        try:
            with open(input_path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
        except Exception as e:
            raise ParseError(f"Error reading JSON: {e}")

    # Handle various JSON structures
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        # GHL and other exports may wrap emails in various keys
        possible_keys = [
            "emails", "newsletters", "campaigns", "messages",
            "data", "items", "entries", "results"
        ]
        for key in possible_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        # If it's a single email, wrap it
        return [data]

    raise ParseError("Unexpected JSON structure: expected list or object with emails array")


def read_html_newsletters(input_path: Path) -> list[dict[str, Any]]:
    """
    Read newsletter from HTML archive file.

    Args:
        input_path: Path to HTML file.

    Returns:
        List containing single newsletter dictionary.

    Raises:
        ParseError: If HTML cannot be parsed.
    """
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            html_content = f.read()
    except UnicodeDecodeError:
        try:
            with open(input_path, "r", encoding="latin-1") as f:
                html_content = f.read()
        except Exception as e:
            raise ParseError(f"Error reading HTML file: {e}")

    # Extract title from HTML
    subject = ""
    if HAS_BS4:
        soup = BeautifulSoup(html_content, "html.parser")
        title_tag = soup.find("title")
        if title_tag:
            subject = title_tag.get_text(strip=True)
        if not subject:
            h1_tag = soup.find("h1")
            if h1_tag:
                subject = h1_tag.get_text(strip=True)
    else:
        match = re.search(r"<title[^>]*>([^<]+)</title>", html_content, re.IGNORECASE)
        if match:
            subject = match.group(1).strip()

    if not subject:
        subject = input_path.stem

    # Use file modification time as fallback date
    mtime = input_path.stat().st_mtime
    date_str = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    return [{
        "subject": subject,
        "body": html_content,
        "date": date_str,
        "source_file": str(input_path),
    }]


def create_ghl_session(api_key: str) -> requests.Session:
    """
    Create a configured requests session for GHL API.

    Args:
        api_key: GoHighLevel API key.

    Returns:
        Configured requests Session object.
    """
    if not HAS_REQUESTS:
        raise ImportError("requests library required for API access. Install with: pip install requests")

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {api_key}",
        "Version": GHL_API_VERSION,
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    return session


def fetch_ghl_emails(
    session: requests.Session,
    location_id: str,
    limit: int | None = None,
    timeout: int = DEFAULT_TIMEOUT,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> list[dict[str, Any]]:
    """
    Fetch emails from GHL API.

    Args:
        session: Configured requests session.
        location_id: GHL location ID.
        limit: Maximum number of emails to fetch.
        timeout: Request timeout in seconds.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries.

    Returns:
        List of email dictionaries.

    Raises:
        APIError: If API requests fail.
    """
    all_emails: list[dict[str, Any]] = []
    offset = 0
    page_size = 100

    while True:
        url = f"{GHL_API_BASE}/emails/"
        params = {
            "locationId": location_id,
            "limit": page_size,
            "offset": offset,
        }

        last_error: Exception | None = None
        for attempt in range(retry_count):
            try:
                response = session.get(url, params=params, timeout=timeout)
                response.raise_for_status()
                data = response.json()

                emails = data.get("emails", [])
                all_emails.extend(emails)

                logger.info(f"Fetched {len(emails)} emails (total: {len(all_emails)})")

                if len(emails) < page_size:
                    # No more pages
                    return all_emails[:limit] if limit else all_emails

                if limit and len(all_emails) >= limit:
                    return all_emails[:limit]

                offset += page_size
                time.sleep(DEFAULT_RATE_LIMIT_DELAY)
                break

            except requests.RequestException as e:
                last_error = e
                if attempt < retry_count - 1:
                    logger.warning(f"Retry {attempt + 1}/{retry_count} for GHL API: {e}")
                    time.sleep(retry_delay)
                else:
                    raise APIError(f"GHL API request failed: {last_error}")

    return all_emails


def process_newsletter(
    raw_email: dict[str, Any],
    source_format: str,
    source_file: str,
    existing_hashes: set[str],
    check_duplicates: bool = True,
) -> tuple[NewsletterMetadata | None, str | None]:
    """
    Process a single raw email into newsletter metadata.

    Args:
        raw_email: Raw email dictionary from export.
        source_format: Source file format.
        source_file: Source file path.
        existing_hashes: Set of existing content hashes for deduplication.
        check_duplicates: Whether to check for duplicates.

    Returns:
        Tuple of (NewsletterMetadata or None, skip_reason or None).
    """
    # Extract subject
    subject = get_column_value(raw_email, "subject", "")
    if isinstance(subject, str):
        subject = subject.strip()

    # Extract body
    body_html = get_column_value(raw_email, "body", "")
    if isinstance(body_html, str):
        body_html = body_html.strip()

    if not body_html and not subject:
        return None, "No subject or body content"

    # Convert HTML to text
    body_text = html_to_text(body_html)

    if len(body_text) < MIN_CONTENT_LENGTH:
        return None, f"Content too short ({len(body_text)} chars < {MIN_CONTENT_LENGTH})"

    # Check for duplicates
    if check_duplicates and body_text:
        content_hash = generate_content_hash(body_text)
        if content_hash in existing_hashes:
            return None, "Duplicate content detected"

    # Extract date
    date_str = get_column_value(raw_email, "date")
    send_date, send_timestamp = parse_date(date_str)

    # Generate or extract newsletter ID
    newsletter_id = get_column_value(raw_email, "id")
    if not newsletter_id:
        newsletter_id = generate_newsletter_id(subject, date_str, body_text)
    else:
        newsletter_id = str(newsletter_id).strip()

    # Extract campaign info
    campaign_name = get_column_value(raw_email, "campaign", "")
    if isinstance(campaign_name, str):
        campaign_name = campaign_name.strip()

    campaign_id = raw_email.get("campaignId", "") or raw_email.get("campaign_id", "")

    # Extract status
    status = get_column_value(raw_email, "status", "sent")
    if isinstance(status, str):
        status = status.strip().lower()

    # Extract metrics
    opens = safe_int(get_column_value(raw_email, "opens"))
    clicks = safe_int(get_column_value(raw_email, "clicks"))
    recipients = safe_int(get_column_value(raw_email, "recipients"))

    # Extract links
    links = extract_links(body_html)

    # Create preview
    preview = body_text[:300].rsplit(" ", 1)[0] + "..." if len(body_text) > 300 else body_text

    # Build metadata
    metadata: NewsletterMetadata = {
        "newsletter_id": newsletter_id,
        "subject": subject,
        "subject_slug": create_slug(subject),
        "body_html": body_html,
        "body_text": body_text,
        "body_preview": preview,
        "send_date": send_date or "",
        "send_timestamp": send_timestamp,
        "campaign_name": campaign_name,
        "campaign_id": campaign_id,
        "status": status,
        "links": links,
        "opens": opens,
        "clicks": clicks,
        "recipients": recipients,
        "word_count": len(body_text.split()),
        "character_count": len(body_text),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
        "source_format": source_format,
        "source_file": source_file,
    }

    return metadata, None


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "newsletter",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_ids": [],
        "failed_ids": [],
        "content_hashes": [],
        "metadata": {
            "extraction_method": None,
            "source_path": None,
            "location_id": None,
        },
    }

    if not state_file.exists():
        return default_state

    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            for key in default_state:
                if key not in state:
                    state[key] = default_state[key]
            if "content_hashes" not in state:
                state["content_hashes"] = []
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

    state_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        logger.debug(f"Saved state to {state_file}")
    except Exception as e:
        logger.error(f"Failed to save state: {e}")


def run_file_extraction(
    input_path: Path,
    output_dir: Path,
    state_file: Path,
    file_format: str | None = None,
    skip_existing: bool = True,
    check_duplicates: bool = True,
    max_newsletters: int | None = None,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run extraction from an export file.

    Args:
        input_path: Path to export file.
        output_dir: Output directory for processed newsletters.
        state_file: Path to state file.
        file_format: Explicit file format.
        skip_existing: Skip already processed newsletters.
        check_duplicates: Check for duplicate content.
        max_newsletters: Maximum number of newsletters to process.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Validate input file
    if not input_path.exists():
        logger.error(f"Input file not found: {input_path}")
        stats.errors.append({"error": f"Input file not found: {input_path}"})
        return stats

    # Detect format
    try:
        fmt = detect_file_format(input_path, file_format)
    except FileFormatError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    logger.info(f"Reading {fmt.upper()} file: {input_path}")

    # Read newsletters
    try:
        if fmt == "csv":
            raw_newsletters = read_csv_newsletters(input_path)
        elif fmt == "json":
            raw_newsletters = read_json_newsletters(input_path)
        else:  # html
            raw_newsletters = read_html_newsletters(input_path)
    except (ParseError, EncodingError) as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    stats.total_discovered = len(raw_newsletters)
    logger.info(f"Discovered {stats.total_discovered} newsletters in export")

    if not raw_newsletters:
        logger.warning("No newsletters found in export file")
        return stats

    # Load state
    state = load_state(state_file)
    state["metadata"]["extraction_method"] = "file_import"
    state["metadata"]["source_path"] = str(input_path)

    # Create output directories
    emails_dir = output_dir / "emails"
    emails_dir.mkdir(parents=True, exist_ok=True)

    # Process newsletters
    processed_set = set(state["processed_ids"])
    existing_hashes = set(state.get("content_hashes", []))
    all_newsletters: list[NewsletterMetadata] = []
    newsletters_to_process = raw_newsletters[:max_newsletters] if max_newsletters else raw_newsletters

    for i, raw_newsletter in enumerate(newsletters_to_process):
        # Process the newsletter
        metadata, skip_reason = process_newsletter(
            raw_newsletter, fmt, str(input_path), existing_hashes, check_duplicates
        )

        if skip_reason:
            if "Duplicate" in skip_reason:
                stats.skipped_duplicate += 1
                result = ExtractionResult(
                    newsletter_id="unknown",
                    success=True,
                    skipped_reason=skip_reason,
                    is_duplicate=True,
                )
            else:
                stats.skipped_empty += 1
                result = ExtractionResult(
                    newsletter_id="unknown",
                    success=True,
                    skipped_reason=skip_reason,
                )
            stats.results.append(result)
            if verbose:
                logger.debug(f"Skipped newsletter {i + 1}: {skip_reason}")
            continue

        if metadata is None:
            continue

        newsletter_id = metadata["newsletter_id"]

        # Check if already processed
        if skip_existing and newsletter_id in processed_set:
            stats.skipped_existing += 1
            if verbose:
                logger.debug(f"Skipping already processed: {newsletter_id}")
            continue

        # Generate filename
        date_part = metadata["send_date"] or "undated"
        slug = metadata["subject_slug"]
        filename = f"newsletter_{date_part}_{slug}.json"
        newsletter_path = emails_dir / filename

        # Save individual newsletter
        try:
            with open(newsletter_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            result = ExtractionResult(
                newsletter_id=newsletter_id,
                success=True,
                newsletter_path=newsletter_path,
            )
            state["processed_ids"].append(newsletter_id)

            # Add content hash for duplicate detection
            if metadata["body_text"]:
                content_hash = generate_content_hash(metadata["body_text"])
                if content_hash not in existing_hashes:
                    existing_hashes.add(content_hash)
                    state["content_hashes"].append(content_hash)

            all_newsletters.append(metadata)
            stats.processed += 1

            logger.info(
                f"[{i + 1}/{len(newsletters_to_process)}] Processed: {metadata['subject'][:50]}... "
                f"({metadata['word_count']} words)"
            )

        except Exception as e:
            result = ExtractionResult(
                newsletter_id=newsletter_id,
                success=False,
                error=str(e),
            )
            if newsletter_id not in state["failed_ids"]:
                state["failed_ids"].append(newsletter_id)
            stats.failed += 1
            stats.errors.append({"newsletter_id": newsletter_id, "error": str(e)})
            logger.error(f"Failed to save newsletter {newsletter_id}: {e}")

        stats.results.append(result)

        # Save state periodically
        if (i + 1) % 10 == 0:
            save_state(state, state_file)

    # Save combined export
    if all_newsletters:
        combined_path = output_dir / "all_newsletters.json"
        try:
            with open(combined_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "total_newsletters": len(all_newsletters),
                        "extracted_at": datetime.now(timezone.utc).isoformat(),
                        "extractor_version": EXTRACTOR_VERSION,
                        "source_file": str(input_path),
                        "newsletters": all_newsletters,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
            logger.info(f"Saved combined export to {combined_path}")
        except Exception as e:
            logger.error(f"Failed to save combined export: {e}")
            stats.errors.append({"error": f"Failed to save combined export: {e}"})

    # Final state save
    save_state(state, state_file)

    return stats


def run_api_extraction(
    location_id: str,
    output_dir: Path,
    state_file: Path,
    api_key: str | None = None,
    skip_existing: bool = True,
    check_duplicates: bool = True,
    max_newsletters: int | None = None,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run extraction from GHL API.

    Args:
        location_id: GHL location ID.
        output_dir: Output directory for processed newsletters.
        state_file: Path to state file.
        api_key: GHL API key (defaults to GHL_API_KEY env var).
        skip_existing: Skip already processed newsletters.
        check_duplicates: Check for duplicate content.
        max_newsletters: Maximum number of newsletters to process.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    if not HAS_REQUESTS:
        logger.error("requests library required for API access. Install with: pip install requests")
        stats.errors.append({"error": "requests library not installed"})
        return stats

    # Get API key
    api_key = api_key or os.environ.get("GHL_API_KEY")
    if not api_key:
        logger.error("GHL API key required. Set GHL_API_KEY environment variable or use --api-key")
        stats.errors.append({"error": "GHL API key not provided"})
        return stats

    logger.info(f"Fetching newsletters from GHL API for location: {location_id}")

    # Create session and fetch emails
    try:
        session = create_ghl_session(api_key)
        raw_newsletters = fetch_ghl_emails(session, location_id, limit=max_newsletters)
    except (APIError, ImportError) as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    stats.total_discovered = len(raw_newsletters)
    logger.info(f"Fetched {stats.total_discovered} newsletters from API")

    if not raw_newsletters:
        logger.warning("No newsletters found via API")
        return stats

    # Load state
    state = load_state(state_file)
    state["metadata"]["extraction_method"] = "ghl_api"
    state["metadata"]["location_id"] = location_id

    # Create output directories
    emails_dir = output_dir / "emails"
    emails_dir.mkdir(parents=True, exist_ok=True)

    # Process newsletters
    processed_set = set(state["processed_ids"])
    existing_hashes = set(state.get("content_hashes", []))
    all_newsletters: list[NewsletterMetadata] = []

    for i, raw_newsletter in enumerate(raw_newsletters):
        # Process the newsletter
        metadata, skip_reason = process_newsletter(
            raw_newsletter, "api", f"ghl:{location_id}", existing_hashes, check_duplicates
        )

        if skip_reason:
            if "Duplicate" in skip_reason:
                stats.skipped_duplicate += 1
            else:
                stats.skipped_empty += 1
            if verbose:
                logger.debug(f"Skipped newsletter {i + 1}: {skip_reason}")
            continue

        if metadata is None:
            continue

        newsletter_id = metadata["newsletter_id"]

        if skip_existing and newsletter_id in processed_set:
            stats.skipped_existing += 1
            continue

        # Generate filename
        date_part = metadata["send_date"] or "undated"
        slug = metadata["subject_slug"]
        filename = f"newsletter_{date_part}_{slug}.json"
        newsletter_path = emails_dir / filename

        try:
            with open(newsletter_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            state["processed_ids"].append(newsletter_id)

            if metadata["body_text"]:
                content_hash = generate_content_hash(metadata["body_text"])
                if content_hash not in existing_hashes:
                    existing_hashes.add(content_hash)
                    state["content_hashes"].append(content_hash)

            all_newsletters.append(metadata)
            stats.processed += 1

            logger.info(
                f"[{i + 1}/{len(raw_newsletters)}] Processed: {metadata['subject'][:50]}... "
                f"({metadata['word_count']} words)"
            )

        except Exception as e:
            if newsletter_id not in state["failed_ids"]:
                state["failed_ids"].append(newsletter_id)
            stats.failed += 1
            stats.errors.append({"newsletter_id": newsletter_id, "error": str(e)})
            logger.error(f"Failed to save newsletter {newsletter_id}: {e}")

        if (i + 1) % 10 == 0:
            save_state(state, state_file)

    # Save combined export
    if all_newsletters:
        combined_path = output_dir / "all_newsletters.json"
        try:
            with open(combined_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "total_newsletters": len(all_newsletters),
                        "extracted_at": datetime.now(timezone.utc).isoformat(),
                        "extractor_version": EXTRACTOR_VERSION,
                        "source": f"ghl_api:{location_id}",
                        "newsletters": all_newsletters,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
            logger.info(f"Saved combined export to {combined_path}")
        except Exception as e:
            logger.error(f"Failed to save combined export: {e}")

    save_state(state, state_file)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("NEWSLETTER EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total discovered:      {stats.total_discovered}")
    print(f"Processed:             {stats.processed}")
    print(f"Skipped (existing):    {stats.skipped_existing}")
    print(f"Skipped (empty/short): {stats.skipped_empty}")
    print(f"Skipped (duplicate):   {stats.skipped_duplicate}")
    print(f"Failed:                {stats.failed}")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            if "newsletter_id" in err:
                print(f"  [{err['newsletter_id']}] {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the newsletter extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract newsletters from GoHighLevel exports or API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # From export file
  python newsletter_extractor.py --input newsletters.csv
  python newsletter_extractor.py --input emails.json --format json
  python newsletter_extractor.py --input archive.html --format html

  # From GHL API
  python newsletter_extractor.py --ghl-api --location-id YOUR_LOCATION_ID
  python newsletter_extractor.py --ghl-api --location-id YOUR_LOCATION_ID --api-key YOUR_KEY

Output Structure:
  {output-dir}/emails/newsletter_{date}_{slug}.json  - Individual newsletter files
  {output-dir}/all_newsletters.json                  - Combined export

Environment Variables:
  GHL_API_KEY - GoHighLevel API key for API access
        """,
    )

    # Input source group
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--input", "-i",
        type=Path,
        help="Path to newsletter export file (CSV, JSON, or HTML)",
    )
    input_group.add_argument(
        "--ghl-api",
        action="store_true",
        help="Fetch newsletters from GHL API (requires --location-id)",
    )

    parser.add_argument(
        "--location-id",
        type=str,
        help="GHL location ID (required with --ghl-api)",
    )

    parser.add_argument(
        "--api-key",
        type=str,
        help="GHL API key (defaults to GHL_API_KEY env var)",
    )

    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=Path("data/raw/newsletter"),
        help="Output directory for processed newsletters (default: data/raw/newsletter)",
    )

    parser.add_argument(
        "--state-file", "-s",
        type=Path,
        default=Path("data/state/newsletter_state.json"),
        help="State file for tracking processed newsletters (default: data/state/newsletter_state.json)",
    )

    parser.add_argument(
        "--format", "-f",
        type=str,
        choices=["csv", "json", "html"],
        default=None,
        help="Input file format (auto-detected if not specified)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of newsletters to process (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed newsletters (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all newsletters, ignoring state",
    )

    parser.add_argument(
        "--check-duplicates",
        action="store_true",
        default=True,
        help="Check for duplicate content (default: True)",
    )

    parser.add_argument(
        "--no-check-duplicates",
        action="store_false",
        dest="check_duplicates",
        help="Skip duplicate checking",
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress non-error output",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.ghl_api and not args.location_id:
        parser.error("--location-id is required when using --ghl-api")

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
        if args.ghl_api:
            stats = run_api_extraction(
                location_id=args.location_id,
                output_dir=output_dir,
                state_file=state_file,
                api_key=args.api_key,
                skip_existing=args.skip_existing,
                check_duplicates=args.check_duplicates,
                max_newsletters=args.limit,
                verbose=args.verbose,
            )
        else:
            input_path = args.input.resolve()
            stats = run_file_extraction(
                input_path=input_path,
                output_dir=output_dir,
                state_file=state_file,
                file_format=args.format,
                skip_existing=args.skip_existing,
                check_duplicates=args.check_duplicates,
                max_newsletters=args.limit,
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
