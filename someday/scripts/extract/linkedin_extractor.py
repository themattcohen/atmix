#!/usr/bin/env python3
"""
LinkedIn Data Export Extractor
==============================
Extracts posts from LinkedIn data exports (CSV or JSON format).

Features:
- Supports CSV format (primary) and JSON format (alternative)
- Auto-detects format based on file extension
- Extracts post content, dates, engagement metrics, and hashtags
- Generates unique post IDs from content hash if not available
- Parses various LinkedIn date formats
- Deduplicates against existing blog content (by URL or title similarity)
- Incremental extraction with state persistence
- Comprehensive error handling for edge cases

Output Structure:
- Individual posts: data/raw/linkedin/processed/li_{post_id}.json
- Combined export: data/raw/linkedin/processed/linkedin_all_posts.json

Usage:
    python linkedin_extractor.py --input /path/to/linkedin_posts.csv \\
                                 --output-dir /path/to/data/raw/linkedin/processed \\
                                 --state-file /path/to/data/state/linkedin_state.json \\
                                 --format csv

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, TypedDict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("linkedin_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
MIN_CONTENT_LENGTH = 10  # Minimum characters for a valid post
TITLE_SIMILARITY_THRESHOLD = 0.85  # For deduplication matching
HASHTAG_PATTERN = re.compile(r"#(\w+)", re.UNICODE)

# LinkedIn date format patterns (various formats found in exports)
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
]

# Known CSV column name mappings (LinkedIn exports vary)
COLUMN_MAPPINGS = {
    "content": ["Content", "content", "Post Content", "post_content", "Text", "text", "Body", "body", "ShareCommentary"],
    "date": ["Date", "date", "Posted Date", "posted_date", "Published Date", "published_date", "Created", "created", "PostedDate", "SharedDate"],
    "likes": ["Likes", "likes", "Reactions", "reactions", "Like Count", "like_count", "NumLikes"],
    "comments": ["Comments", "comments", "Comment Count", "comment_count", "NumComments"],
    "shares": ["Shares", "shares", "Reposts", "reposts", "Share Count", "share_count", "NumShares"],
    "post_type": ["Type", "type", "Post Type", "post_type", "Media Type", "media_type", "MediaType"],
    "url": ["URL", "url", "Post URL", "post_url", "Link", "link", "PostUrl"],
    "id": ["ID", "id", "Post ID", "post_id", "PostId"],
}


class PostMetadata(TypedDict, total=False):
    """Type definition for LinkedIn post metadata."""

    post_id: str
    content: str
    content_preview: str
    publication_date: str
    publication_timestamp: int | None
    likes: int
    comments: int
    shares: int
    post_type: str
    hashtags: list[str]
    url: str
    word_count: int
    character_count: int
    extracted_at: str
    extractor_version: str
    source_format: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_ids: list[str]
    failed_ids: list[str]
    pending_ids: list[str]
    duplicate_ids: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single post."""

    post_id: str
    success: bool
    post_path: Path | None = None
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


class LinkedInExtractorError(Exception):
    """Base exception for LinkedIn extractor errors."""

    pass


class FileFormatError(LinkedInExtractorError):
    """Raised when file format cannot be determined or is unsupported."""

    pass


class ParseError(LinkedInExtractorError):
    """Raised when parsing the export file fails."""

    pass


class EncodingError(LinkedInExtractorError):
    """Raised when encoding issues are encountered."""

    pass


def generate_post_id(content: str, date_str: str | None = None) -> str:
    """
    Generate a unique post ID from content hash.

    Args:
        content: Post content text.
        date_str: Optional date string for additional uniqueness.

    Returns:
        12-character hexadecimal hash ID.
    """
    hash_input = content.strip()
    if date_str:
        hash_input += f"|{date_str}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:12]


def parse_date(date_str: str | None) -> tuple[str | None, int | None]:
    """
    Parse various LinkedIn date formats.

    Args:
        date_str: Date string from LinkedIn export.

    Returns:
        Tuple of (ISO date string, Unix timestamp) or (None, None) if parsing fails.
    """
    if not date_str or not date_str.strip():
        return None, None

    date_str = date_str.strip()

    for pattern in DATE_PATTERNS:
        try:
            dt = datetime.strptime(date_str, pattern)
            # Add UTC timezone if not present
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%d"), int(dt.timestamp())
        except ValueError:
            continue

    # Try parsing as ISO format with various timezone formats
    try:
        # Handle timezone with colon (e.g., +00:00)
        if "+" in date_str or "Z" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d"), int(dt.timestamp())
    except ValueError:
        pass

    logger.warning(f"Could not parse date: {date_str}")
    return None, None


def extract_hashtags(content: str) -> list[str]:
    """
    Extract hashtags from post content.

    Args:
        content: Post content text.

    Returns:
        List of hashtags (without # prefix).
    """
    if not content:
        return []

    matches = HASHTAG_PATTERN.findall(content)
    # Remove duplicates while preserving order
    seen: set[str] = set()
    unique_hashtags: list[str] = []
    for tag in matches:
        tag_lower = tag.lower()
        if tag_lower not in seen:
            seen.add(tag_lower)
            unique_hashtags.append(tag)

    return unique_hashtags


def detect_post_type(content: str, explicit_type: str | None = None) -> str:
    """
    Detect or validate post type.

    Args:
        content: Post content text.
        explicit_type: Explicit type from export (if available).

    Returns:
        Post type string (text, image, video, article, poll, document).
    """
    if explicit_type:
        explicit_lower = explicit_type.lower().strip()
        type_mapping = {
            "text": "text",
            "image": "image",
            "photo": "image",
            "video": "video",
            "article": "article",
            "link": "article",
            "poll": "poll",
            "document": "document",
            "pdf": "document",
            "carousel": "image",
            "native_document": "document",
        }
        return type_mapping.get(explicit_lower, "text")

    # Infer from content if not explicit
    content_lower = content.lower() if content else ""

    # Check for common indicators (limited without actual media)
    if "[image]" in content_lower or "[photo]" in content_lower:
        return "image"
    if "[video]" in content_lower:
        return "video"
    if "http" in content_lower and ("article" in content_lower or "blog" in content_lower):
        return "article"

    return "text"


def get_column_value(
    row: dict[str, Any],
    column_type: str,
    default: Any = None,
) -> Any:
    """
    Get value from row using flexible column name mapping.

    Args:
        row: Dictionary row from CSV/JSON.
        column_type: Type of column (content, date, likes, etc.).
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
        # Handle string representations
        if isinstance(value, str):
            # Remove commas and whitespace
            value = value.replace(",", "").strip()
            if not value:
                return default
        return int(float(value))
    except (ValueError, TypeError):
        return default


def clean_content(content: str | None) -> str:
    """
    Clean and normalize post content.

    Args:
        content: Raw post content.

    Returns:
        Cleaned content string.
    """
    if not content:
        return ""

    # Handle bytes if necessary
    if isinstance(content, bytes):
        try:
            content = content.decode("utf-8")
        except UnicodeDecodeError:
            content = content.decode("utf-8", errors="replace")

    # Normalize whitespace
    content = re.sub(r"\r\n", "\n", content)
    content = re.sub(r"[\r\x0b\x0c]", "\n", content)

    # Remove zero-width characters
    content = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", content)

    # Normalize multiple newlines
    content = re.sub(r"\n{3,}", "\n\n", content)

    # Normalize multiple spaces
    content = re.sub(r" {2,}", " ", content)

    return content.strip()


def create_content_preview(content: str, max_length: int = 200) -> str:
    """
    Create a preview of the content.

    Args:
        content: Full post content.
        max_length: Maximum length of preview.

    Returns:
        Content preview string.
    """
    if not content:
        return ""

    # Get first line or up to max_length
    preview = content.split("\n")[0].strip()

    if len(preview) > max_length:
        preview = preview[: max_length - 3].rsplit(" ", 1)[0] + "..."

    return preview


def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity ratio between two texts.

    Args:
        text1: First text.
        text2: Second text.

    Returns:
        Similarity ratio (0.0 to 1.0).
    """
    if not text1 or not text2:
        return 0.0

    # Normalize for comparison
    text1_norm = re.sub(r"\s+", " ", text1.lower().strip())
    text2_norm = re.sub(r"\s+", " ", text2.lower().strip())

    return SequenceMatcher(None, text1_norm, text2_norm).ratio()


def load_existing_blog_content(blog_dir: Path) -> list[dict[str, str]]:
    """
    Load existing blog content for deduplication.

    Args:
        blog_dir: Directory containing blog article JSON files.

    Returns:
        List of dictionaries with title and url keys.
    """
    existing_content: list[dict[str, str]] = []

    if not blog_dir.exists():
        return existing_content

    articles_dir = blog_dir / "articles"
    if not articles_dir.exists():
        return existing_content

    for json_file in articles_dir.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                article = json.load(f)
                existing_content.append({
                    "title": article.get("title", ""),
                    "url": article.get("url", ""),
                    "content_preview": article.get("excerpt", "")[:200] if article.get("excerpt") else "",
                })
        except (json.JSONDecodeError, IOError) as e:
            logger.debug(f"Could not load blog article {json_file}: {e}")

    return existing_content


def check_duplicate(
    post_content: str,
    existing_content: list[dict[str, str]],
    threshold: float = TITLE_SIMILARITY_THRESHOLD,
) -> tuple[bool, str | None]:
    """
    Check if post content is duplicate of existing blog content.

    Args:
        post_content: LinkedIn post content.
        existing_content: List of existing blog articles.
        threshold: Similarity threshold for duplicate detection.

    Returns:
        Tuple of (is_duplicate, matching_url or None).
    """
    if not post_content or not existing_content:
        return False, None

    post_preview = create_content_preview(post_content, 200)

    for article in existing_content:
        # Check title similarity
        if article.get("title"):
            title_sim = calculate_similarity(post_preview, article["title"])
            if title_sim >= threshold:
                return True, article.get("url")

        # Check content preview similarity
        if article.get("content_preview"):
            content_sim = calculate_similarity(post_preview, article["content_preview"])
            if content_sim >= threshold:
                return True, article.get("url")

    return False, None


def detect_file_format(input_path: Path, explicit_format: str | None = None) -> str:
    """
    Detect file format from extension or explicit format.

    Args:
        input_path: Path to input file.
        explicit_format: Explicitly specified format.

    Returns:
        Format string ('csv' or 'json').

    Raises:
        FileFormatError: If format cannot be determined.
    """
    if explicit_format:
        fmt = explicit_format.lower().strip()
        if fmt in ("csv", "json"):
            return fmt
        raise FileFormatError(f"Unsupported format: {explicit_format}. Use 'csv' or 'json'.")

    ext = input_path.suffix.lower()
    if ext == ".csv":
        return "csv"
    elif ext == ".json":
        return "json"
    else:
        raise FileFormatError(
            f"Cannot determine format from extension: {ext}. "
            "Use --format to specify 'csv' or 'json'."
        )


def read_csv_posts(input_path: Path) -> list[dict[str, Any]]:
    """
    Read posts from CSV file.

    Args:
        input_path: Path to CSV file.

    Returns:
        List of post dictionaries.

    Raises:
        ParseError: If CSV cannot be parsed.
        EncodingError: If encoding issues occur.
    """
    posts: list[dict[str, Any]] = []
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

    for encoding in encodings:
        try:
            with open(input_path, "r", encoding=encoding, newline="") as f:
                # Detect delimiter
                sample = f.read(4096)
                f.seek(0)

                # Try to detect delimiter
                sniffer = csv.Sniffer()
                try:
                    dialect = sniffer.sniff(sample, delimiters=",;\t|")
                except csv.Error:
                    dialect = csv.excel

                reader = csv.DictReader(f, dialect=dialect)

                for row in reader:
                    posts.append(dict(row))

                logger.info(f"Successfully read {len(posts)} rows from CSV using {encoding} encoding")
                return posts

        except UnicodeDecodeError:
            continue
        except csv.Error as e:
            raise ParseError(f"CSV parsing error: {e}")
        except Exception as e:
            raise ParseError(f"Error reading CSV: {e}")

    raise EncodingError(
        f"Could not read file with any supported encoding: {encodings}"
    )


def read_json_posts(input_path: Path) -> list[dict[str, Any]]:
    """
    Read posts from JSON file.

    Args:
        input_path: Path to JSON file.

    Returns:
        List of post dictionaries.

    Raises:
        ParseError: If JSON cannot be parsed.
    """
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ParseError(f"JSON parsing error: {e}")
    except UnicodeDecodeError:
        # Try with different encoding
        try:
            with open(input_path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
        except Exception as e:
            raise ParseError(f"Error reading JSON: {e}")

    # Handle various JSON structures
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        # LinkedIn exports may wrap posts in a key
        possible_keys = ["posts", "shares", "activity", "data", "items", "entries"]
        for key in possible_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        # If it's a single post, wrap it
        return [data]

    raise ParseError("Unexpected JSON structure: expected list or object with posts array")


def process_post(
    raw_post: dict[str, Any],
    source_format: str,
    existing_content: list[dict[str, str]] | None = None,
    check_duplicates: bool = True,
) -> tuple[PostMetadata | None, str | None]:
    """
    Process a single raw post into metadata.

    Args:
        raw_post: Raw post dictionary from CSV/JSON.
        source_format: Source file format.
        existing_content: Existing blog content for deduplication.
        check_duplicates: Whether to check for duplicates.

    Returns:
        Tuple of (PostMetadata or None, skip_reason or None).
    """
    # Extract content
    content = get_column_value(raw_post, "content", "")
    content = clean_content(content)

    if not content or len(content) < MIN_CONTENT_LENGTH:
        return None, f"Empty or too short ({len(content)} chars < {MIN_CONTENT_LENGTH})"

    # Extract date
    date_str = get_column_value(raw_post, "date")
    pub_date, pub_timestamp = parse_date(date_str)

    # Generate or extract post ID
    post_id = get_column_value(raw_post, "id")
    if not post_id:
        post_id = generate_post_id(content, date_str)
    else:
        post_id = str(post_id).strip()

    # Check for duplicates against blog content
    if check_duplicates and existing_content:
        is_dup, dup_url = check_duplicate(content, existing_content)
        if is_dup:
            return None, f"Duplicate of blog content: {dup_url}"

    # Extract metrics
    likes = safe_int(get_column_value(raw_post, "likes"))
    comments = safe_int(get_column_value(raw_post, "comments"))
    shares = safe_int(get_column_value(raw_post, "shares"))

    # Extract post type
    explicit_type = get_column_value(raw_post, "post_type")
    post_type = detect_post_type(content, explicit_type)

    # Extract URL
    url = get_column_value(raw_post, "url", "")

    # Extract hashtags
    hashtags = extract_hashtags(content)

    # Build metadata
    metadata: PostMetadata = {
        "post_id": post_id,
        "content": content,
        "content_preview": create_content_preview(content),
        "publication_date": pub_date or "",
        "publication_timestamp": pub_timestamp,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "post_type": post_type,
        "hashtags": hashtags,
        "url": url,
        "word_count": len(content.split()),
        "character_count": len(content),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
        "source_format": source_format,
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
        "source": "linkedin",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_ids": [],
        "failed_ids": [],
        "pending_ids": [],
        "duplicate_ids": [],
        "metadata": {
            "export_path": None,
            "profile_url": None,
            "extraction_method": "manual_export",
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
            # Ensure duplicate_ids exists (for backward compatibility)
            if "duplicate_ids" not in state:
                state["duplicate_ids"] = []
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

    # Ensure parent directory exists
    state_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        logger.debug(f"Saved state to {state_file}")
    except Exception as e:
        logger.error(f"Failed to save state: {e}")


def run_extraction(
    input_path: Path,
    output_dir: Path,
    state_file: Path,
    file_format: str | None = None,
    skip_existing: bool = True,
    check_duplicates: bool = True,
    blog_dir: Path | None = None,
    max_posts: int | None = None,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the full extraction process.

    Args:
        input_path: Path to LinkedIn export file.
        output_dir: Output directory for processed posts.
        state_file: Path to state file.
        file_format: Explicit file format ('csv' or 'json').
        skip_existing: Skip already processed post IDs.
        check_duplicates: Check for duplicates against blog content.
        blog_dir: Directory containing blog articles for deduplication.
        max_posts: Maximum number of posts to process.
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

    # Read posts
    try:
        if fmt == "csv":
            raw_posts = read_csv_posts(input_path)
        else:
            raw_posts = read_json_posts(input_path)
    except (ParseError, EncodingError) as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    stats.total_discovered = len(raw_posts)
    logger.info(f"Discovered {stats.total_discovered} posts in export")

    if not raw_posts:
        logger.warning("No posts found in export file")
        return stats

    # Load state
    state = load_state(state_file)
    state["metadata"]["export_path"] = str(input_path)

    # Load existing blog content for deduplication
    existing_content: list[dict[str, str]] = []
    if check_duplicates and blog_dir:
        existing_content = load_existing_blog_content(blog_dir)
        logger.info(f"Loaded {len(existing_content)} existing blog articles for deduplication")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Process posts
    processed_set = set(state["processed_ids"])
    duplicate_set = set(state.get("duplicate_ids", []))
    all_posts: list[PostMetadata] = []
    posts_to_process = raw_posts[:max_posts] if max_posts else raw_posts

    for i, raw_post in enumerate(posts_to_process):
        # Process the post
        metadata, skip_reason = process_post(
            raw_post, fmt, existing_content, check_duplicates
        )

        if skip_reason:
            if "Duplicate" in skip_reason:
                stats.skipped_duplicate += 1
                result = ExtractionResult(
                    post_id="unknown",
                    success=True,
                    skipped_reason=skip_reason,
                    is_duplicate=True,
                )
            else:
                stats.skipped_empty += 1
                result = ExtractionResult(
                    post_id="unknown",
                    success=True,
                    skipped_reason=skip_reason,
                )
            stats.results.append(result)
            if verbose:
                logger.debug(f"Skipped post {i + 1}: {skip_reason}")
            continue

        if metadata is None:
            continue

        post_id = metadata["post_id"]

        # Check if already processed
        if skip_existing and post_id in processed_set:
            stats.skipped_existing += 1
            if verbose:
                logger.debug(f"Skipping already processed: {post_id}")
            continue

        if skip_existing and post_id in duplicate_set:
            stats.skipped_duplicate += 1
            if verbose:
                logger.debug(f"Skipping known duplicate: {post_id}")
            continue

        # Save individual post
        post_path = output_dir / f"li_{post_id}.json"
        try:
            with open(post_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            result = ExtractionResult(
                post_id=post_id,
                success=True,
                post_path=post_path,
            )
            state["processed_ids"].append(post_id)
            all_posts.append(metadata)
            stats.processed += 1

            logger.info(
                f"[{i + 1}/{len(posts_to_process)}] Processed: {post_id} "
                f"({metadata['word_count']} words, {metadata['likes']} likes)"
            )

        except Exception as e:
            result = ExtractionResult(
                post_id=post_id,
                success=False,
                error=str(e),
            )
            if post_id not in state["failed_ids"]:
                state["failed_ids"].append(post_id)
            stats.failed += 1
            stats.errors.append({"post_id": post_id, "error": str(e)})
            logger.error(f"Failed to save post {post_id}: {e}")

        stats.results.append(result)

        # Save state periodically
        if (i + 1) % 10 == 0:
            save_state(state, state_file)

    # Save combined export
    if all_posts:
        combined_path = output_dir / "linkedin_all_posts.json"
        try:
            with open(combined_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "total_posts": len(all_posts),
                        "extracted_at": datetime.now(timezone.utc).isoformat(),
                        "extractor_version": EXTRACTOR_VERSION,
                        "source_file": str(input_path),
                        "posts": all_posts,
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


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("LINKEDIN EXTRACTION SUMMARY")
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
            if "post_id" in err:
                print(f"  [{err['post_id']}] {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the LinkedIn extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract posts from LinkedIn data exports (CSV or JSON format).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python linkedin_extractor.py --input linkedin_posts.csv
  python linkedin_extractor.py --input linkedin_export.json --format json
  python linkedin_extractor.py --input posts.csv --output-dir ./data/raw/linkedin/processed
  python linkedin_extractor.py --input posts.csv --no-check-duplicates --limit 100

Output Structure:
  {output-dir}/li_{post_id}.json              - Individual post files
  {output-dir}/linkedin_all_posts.json        - Combined export

The extractor handles various LinkedIn export formats and date patterns.
Posts shorter than 10 characters are skipped.
        """,
    )

    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        required=True,
        help="Path to LinkedIn export file (CSV or JSON)",
    )

    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=Path("data/raw/linkedin/processed"),
        help="Output directory for processed posts (default: data/raw/linkedin/processed)",
    )

    parser.add_argument(
        "--state-file",
        "-s",
        type=Path,
        default=Path("data/state/linkedin_state.json"),
        help="State file for tracking processed posts (default: data/state/linkedin_state.json)",
    )

    parser.add_argument(
        "--format",
        "-f",
        type=str,
        choices=["csv", "json"],
        default=None,
        help="Input file format (auto-detected if not specified)",
    )

    parser.add_argument(
        "--blog-dir",
        type=Path,
        default=Path("data/raw/blog"),
        help="Blog directory for deduplication (default: data/raw/blog)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of posts to process (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed posts (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all posts, ignoring state",
    )

    parser.add_argument(
        "--check-duplicates",
        action="store_true",
        default=True,
        help="Check for duplicates against blog content (default: True)",
    )

    parser.add_argument(
        "--no-check-duplicates",
        action="store_false",
        dest="check_duplicates",
        help="Skip duplicate checking",
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
    input_path = args.input.resolve()
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()
    blog_dir = args.blog_dir.resolve() if args.check_duplicates else None

    # Run extraction
    try:
        stats = run_extraction(
            input_path=input_path,
            output_dir=output_dir,
            state_file=state_file,
            file_format=args.format,
            skip_existing=args.skip_existing,
            check_duplicates=args.check_duplicates,
            blog_dir=blog_dir,
            max_posts=args.limit,
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
