#!/usr/bin/env python3
"""
Document Normalizer for Sara Sharp Knowledge Base.

Transforms raw extracted content from multiple sources into a unified document schema.
Generates deterministic IDs, calculates quality scores, and outputs normalized JSON files.

Usage:
    python normalizer.py --source youtube --input-dir data/raw/youtube --output-dir data/normalized/documents
    python normalizer.py --source all --input-dir data/raw --output-dir data/normalized/documents
    python normalizer.py --source blog --input-dir data/raw/blog --output-dir data/normalized/documents --dry-run

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("normalizer")

# Constants
EXTRACTOR_VERSION = "1.0.0"
VALID_SOURCES = frozenset({"youtube", "blog", "podcast", "book", "linkedin", "deal_academy", "media"})
SOURCE_TYPE_MAP = {
    "youtube": "video_transcript",
    "blog": "blog_article",
    "podcast": "podcast_episode",
    "book": "book_chapter",
    "linkedin": "linkedin_post",
    "deal_academy": "course_lesson",
    "media": "media_article",
}

# Quality score configuration
QUALITY_WEIGHTS = {
    "content_length": 0.20,
    "completeness": 0.25,
    "metadata_richness": 0.15,
    # Note: language_quality (0.20) and uniqueness (0.20) are handled by validator.py
    # For normalizer, we focus on the three core metrics specified
}

# Author detection patterns - each tuple is (pattern, group_number)
# Patterns are applied in order; first match wins
AUTHOR_PATTERNS = [
    # Explicit attribution: "by Sara Sharp", "written by John Smith"
    (r"(?:by|author|written by)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", 1),
    # Bio pattern: "Sara Sharp is a lawyer" - requires specific context words
    (r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is|was|has been)\s+(?:a|an|the)\s+(?:lawyer|author|writer|expert|consultant|advisor|founder|CEO|partner|specialist|professional)", 1),
    # Byline at start of line
    (r"(?:^|\n)([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n", 1),
]

# Words that should NOT be detected as author names
AUTHOR_BLACKLIST = frozenset({
    "no author", "the author", "an author", "this article", "no information",
    "more information", "for more", "learn more", "read more",
})


class NormalizationError(Exception):
    """Exception raised when normalization fails."""

    def __init__(self, message: str, source: str | None = None, file_path: str | None = None):
        super().__init__(message)
        self.source = source
        self.file_path = file_path


def generate_document_id(source: str, unique_content: str) -> str:
    """
    Generate a deterministic document ID using MD5 hash.

    The ID follows the format: {source}_{md5_hash[:12]}

    Args:
        source: Content source type (youtube, blog, podcast, etc.)
        unique_content: Unique identifier for the content (URL, video_id, etc.)

    Returns:
        Deterministic document ID string.

    Raises:
        ValueError: If source is not a valid source type.

    Examples:
        >>> generate_document_id("youtube", "dQw4w9WgXcQ")
        'youtube_a1b2c3d4e5f6'
        >>> generate_document_id("blog", "https://example.com/post")
        'blog_f6e5d4c3b2a1'
    """
    if source not in VALID_SOURCES:
        raise ValueError(f"Invalid source '{source}'. Must be one of: {', '.join(sorted(VALID_SOURCES))}")

    hash_input = f"{source}:{unique_content}".encode("utf-8")
    hash_value = hashlib.md5(hash_input).hexdigest()[:12]
    return f"{source}_{hash_value}"


def calculate_quality_score(document: dict[str, Any]) -> float:
    """
    Calculate document quality score based on content and metadata.

    Score components (must sum to 0.60 for this stage):
    - content_length (20%): Score based on word count
    - completeness (25%): Presence of optional fields
    - metadata_richness (15%): Amount of metadata populated

    The remaining 40% (language_quality and uniqueness) is calculated
    by the validator.py script in a later pipeline stage.

    Args:
        document: Normalized document dictionary.

    Returns:
        Quality score between 0.0 and 1.0 (partial score from normalizer).

    Examples:
        >>> doc = {"content": {"text": "Sample text " * 100}, "metadata": {"url": "...", "author": "..."}}
        >>> score = calculate_quality_score(doc)
        >>> 0.0 <= score <= 1.0
        True
    """
    scores: dict[str, float] = {}

    # Content length score (20%)
    text = document.get("content", {}).get("text", "")
    word_count = len(text.split()) if text else 0

    if word_count < 50:
        scores["content_length"] = 0.2
    elif word_count < 100:
        scores["content_length"] = 0.4
    elif word_count < 500:
        scores["content_length"] = 0.6
    elif word_count < 2000:
        scores["content_length"] = 0.85
    else:
        scores["content_length"] = 1.0

    # Completeness score (25%)
    content = document.get("content", {})
    metadata = document.get("metadata", {})

    optional_fields = [
        content.get("summary"),
        content.get("key_topics"),
        metadata.get("author"),
        metadata.get("published_date"),
        metadata.get("duration_seconds"),
    ]
    present_count = sum(1 for field in optional_fields if field)
    scores["completeness"] = present_count / len(optional_fields)

    # Metadata richness score (15%)
    metadata_fields = [
        metadata.get("url"),
        metadata.get("author"),
        metadata.get("published_date"),
        metadata.get("word_count"),
        metadata.get("language"),
        metadata.get("source_specific"),
    ]
    metadata_count = sum(1 for field in metadata_fields if field)
    scores["metadata_richness"] = metadata_count / len(metadata_fields)

    # Calculate weighted sum
    total = sum(scores[key] * QUALITY_WEIGHTS[key] for key in QUALITY_WEIGHTS)

    # Normalize to 0-1 scale (since we're only calculating 60% of total score)
    # Scale up to represent full potential score from available metrics
    normalized_total = total / sum(QUALITY_WEIGHTS.values())

    return round(normalized_total, 3)


def clean_text(text: str | None) -> str:
    """
    Clean and normalize text content.

    Operations performed:
    - Strip leading/trailing whitespace
    - Normalize Unicode characters
    - Remove excessive whitespace
    - Remove common boilerplate patterns
    - Fix encoding issues

    Args:
        text: Raw text content to clean.

    Returns:
        Cleaned and normalized text string.

    Examples:
        >>> clean_text("  Hello   World  ")
        'Hello World'
        >>> clean_text("Text\\n\\n\\n\\nMore text")
        'Text\\n\\nMore text'
    """
    if not text:
        return ""

    # Convert to string if needed
    text = str(text)

    # Normalize Unicode
    import unicodedata

    text = unicodedata.normalize("NFKC", text)

    # Strip leading/trailing whitespace
    text = text.strip()

    # Replace multiple spaces with single space
    text = re.sub(r"[ \t]+", " ", text)

    # Normalize newlines (max 2 consecutive)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove common boilerplate patterns
    boilerplate_patterns = [
        r"^\s*Cookie Policy.*?(?=\n\n|\Z)",
        r"^\s*Privacy Policy.*?(?=\n\n|\Z)",
        r"^\s*Terms of Use.*?(?=\n\n|\Z)",
        r"^\s*All rights reserved\.?\s*$",
        r"^\s*Copyright \d{4}.*?(?=\n\n|\Z)",
        r"Subscribe to our newsletter.*?(?=\n\n|\Z)",
    ]

    for pattern in boilerplate_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.MULTILINE)

    # Remove zero-width characters
    text = re.sub(r"[\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]", "", text)

    # Final strip
    text = text.strip()

    return text


def detect_author(content: str | None) -> str | None:
    """
    Detect author name from content using pattern matching.

    Searches for common author attribution patterns in text content.
    Returns None if no author can be reliably detected.

    Args:
        content: Text content to search for author information.

    Returns:
        Detected author name or None if not found.

    Examples:
        >>> detect_author("This article was written by Sara Sharp.")
        'Sara Sharp'
        >>> detect_author("No author information here.")
        None
    """
    if not content:
        return None

    content = str(content)

    for pattern, group in AUTHOR_PATTERNS:
        match = re.search(pattern, content)
        if match:
            author = match.group(group).strip()
            # Validate: should be 2-4 words, reasonable length
            words = author.split()
            if 2 <= len(words) <= 4 and 5 <= len(author) <= 60:
                # Check against blacklist
                if author.lower() not in AUTHOR_BLACKLIST:
                    return author

    return None


def parse_date(date_str: str | None) -> str | None:
    """
    Parse and normalize date string to ISO format (YYYY-MM-DD).

    Handles multiple common date formats.

    Args:
        date_str: Date string in various formats.

    Returns:
        ISO formatted date string or None if parsing fails.
    """
    if not date_str:
        return None

    date_str = str(date_str).strip()

    # Common date patterns
    date_patterns = [
        ("%Y-%m-%d", None),
        ("%Y/%m/%d", None),
        ("%d-%m-%Y", None),
        ("%d/%m/%Y", None),
        ("%B %d, %Y", None),
        ("%b %d, %Y", None),
        ("%d %B %Y", None),
        ("%d %b %Y", None),
        ("%Y%m%d", None),
    ]

    for fmt, _ in date_patterns:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try ISO format with time
    try:
        if "T" in date_str:
            parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return parsed.strftime("%Y-%m-%d")
    except ValueError:
        pass

    logger.warning(f"Could not parse date: {date_str}")
    return None


def create_base_document(
    source: str,
    source_type: str,
    title: str,
    text: str,
    raw_file_path: str | None = None,
) -> dict[str, Any]:
    """
    Create a base normalized document structure.

    Args:
        source: Content source type.
        source_type: Specific content type within source.
        title: Document title.
        text: Main text content.
        raw_file_path: Path to original raw file.

    Returns:
        Base document dictionary structure.
    """
    cleaned_text = clean_text(text)
    word_count = len(cleaned_text.split()) if cleaned_text else 0

    return {
        "id": "",  # To be set by caller
        "source": source,
        "source_type": source_type,
        "title": title,
        "content": {
            "text": cleaned_text,
            "summary": None,
            "key_topics": [],
        },
        "metadata": {
            "url": None,
            "author": None,
            "published_date": None,
            "duration_seconds": None,
            "word_count": word_count,
            "language": "en",
            "source_specific": {},
        },
        "extraction": {
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "extractor_version": EXTRACTOR_VERSION,
            "raw_file_path": raw_file_path,
            "quality_score": None,  # Set after document is complete
        },
        "rag": {
            "chunk_count": 0,
            "chunk_ids": [],
            "embedding_model": None,
            "last_embedded_at": None,
        },
    }


def normalize_youtube(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize YouTube video data to unified schema.

    Expected raw_data structure:
    {
        "video_id": str,
        "title": str,
        "content": str (transcript text),
        "upload_date": str,
        "duration_seconds": int,
        "channel_id": str (optional),
        "view_count": int (optional),
        "like_count": int (optional),
        "caption_type": str (optional, "auto" or "manual"),
        "caption_language": str (optional),
        "url": str (optional),
        "description": str (optional),
    }

    Args:
        raw_data: Raw YouTube data dictionary.

    Returns:
        Normalized document dictionary.

    Raises:
        NormalizationError: If required fields are missing.
    """
    # Validate required fields
    required = ["video_id", "title", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="youtube")

    video_id = raw_data["video_id"]
    title = raw_data["title"]
    content = raw_data["content"]

    # Generate document ID
    doc_id = generate_document_id("youtube", video_id)

    # Create base document
    doc = create_base_document(
        source="youtube",
        source_type="video_transcript",
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id

    # Set metadata
    doc["metadata"]["url"] = raw_data.get("url") or f"https://www.youtube.com/watch?v={video_id}"
    doc["metadata"]["published_date"] = parse_date(raw_data.get("upload_date"))
    doc["metadata"]["duration_seconds"] = raw_data.get("duration_seconds")

    # Try to detect author from description or use channel name
    author = detect_author(raw_data.get("description", ""))
    doc["metadata"]["author"] = author or raw_data.get("channel_name")

    # Source-specific metadata
    doc["metadata"]["source_specific"] = {
        "video_id": video_id,
        "channel_id": raw_data.get("channel_id"),
        "duration_seconds": raw_data.get("duration_seconds"),
        "view_count": raw_data.get("view_count"),
        "like_count": raw_data.get("like_count"),
        "caption_type": raw_data.get("caption_type", "auto"),
        "caption_language": raw_data.get("caption_language", "en"),
        "playlist_id": raw_data.get("playlist_id"),
        "playlist_position": raw_data.get("playlist_position"),
    }

    # Calculate quality score
    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_blog(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize blog article data to unified schema.

    Expected raw_data structure:
    {
        "url": str,
        "title": str,
        "content": str,
        "author": str (optional),
        "published_date": str (optional),
        "slug": str (optional),
        "category": str (optional),
        "tags": list[str] (optional),
        "excerpt": str (optional),
    }

    Args:
        raw_data: Raw blog data dictionary.

    Returns:
        Normalized document dictionary.

    Raises:
        NormalizationError: If required fields are missing.
    """
    # Validate required fields
    required = ["url", "title", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="blog")

    url = raw_data["url"]
    title = raw_data["title"]
    content = raw_data["content"]

    # Generate document ID from URL
    doc_id = generate_document_id("blog", url)

    # Create base document
    doc = create_base_document(
        source="blog",
        source_type="blog_article",
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id

    # Set metadata
    doc["metadata"]["url"] = url
    doc["metadata"]["published_date"] = parse_date(raw_data.get("published_date"))

    # Get author from raw data or detect from content
    author = raw_data.get("author") or detect_author(content)
    doc["metadata"]["author"] = author

    # Set summary from excerpt if available
    if raw_data.get("excerpt"):
        doc["content"]["summary"] = clean_text(raw_data["excerpt"])[:1000]

    # Set key topics from tags
    if raw_data.get("tags"):
        doc["content"]["key_topics"] = raw_data["tags"][:10]  # Limit to 10 topics

    # Source-specific metadata
    doc["metadata"]["source_specific"] = {
        "slug": raw_data.get("slug"),
        "category": raw_data.get("category"),
        "tags": raw_data.get("tags", []),
        "author_bio": raw_data.get("author_bio"),
        "related_articles": raw_data.get("related_articles", []),
    }

    # Calculate quality score
    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_podcast(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize podcast episode data to unified schema.

    Expected raw_data structure:
    {
        "episode_id": str,
        "title": str,
        "content": str (transcript),
        "audio_url": str (optional),
        "episode_number": int (optional),
        "season_number": int (optional),
        "podcast_name": str (optional),
        "published_date": str (optional),
        "duration_seconds": int (optional),
        "description": str (optional),
    }

    Args:
        raw_data: Raw podcast data dictionary.

    Returns:
        Normalized document dictionary.

    Raises:
        NormalizationError: If required fields are missing.
    """
    # Validate required fields
    required = ["episode_id", "title", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="podcast")

    episode_id = raw_data["episode_id"]
    title = raw_data["title"]
    content = raw_data["content"]

    # Generate document ID
    doc_id = generate_document_id("podcast", episode_id)

    # Create base document
    doc = create_base_document(
        source="podcast",
        source_type="podcast_episode",
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id

    # Set metadata
    doc["metadata"]["url"] = raw_data.get("audio_url") or raw_data.get("feed_url")
    doc["metadata"]["published_date"] = parse_date(raw_data.get("published_date"))
    doc["metadata"]["duration_seconds"] = raw_data.get("duration_seconds")

    # Detect author/host from description or content
    author = detect_author(raw_data.get("description", "") or content)
    doc["metadata"]["author"] = author or raw_data.get("host")

    # Set summary from description
    if raw_data.get("description"):
        doc["content"]["summary"] = clean_text(raw_data["description"])[:1000]

    # Source-specific metadata
    doc["metadata"]["source_specific"] = {
        "episode_id": episode_id,
        "episode_number": raw_data.get("episode_number"),
        "season_number": raw_data.get("season_number"),
        "podcast_name": raw_data.get("podcast_name"),
        "feed_url": raw_data.get("feed_url"),
        "audio_url": raw_data.get("audio_url"),
        "transcription_method": raw_data.get("transcription_method", "whisper-api"),
        "transcription_model": raw_data.get("transcription_model", "whisper-1"),
    }

    # Calculate quality score
    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_book(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize book chapter data to unified schema.

    Expected raw_data structure:
    {
        "chapter_number": int,
        "title": str,
        "content": str,
        "book_title": str (optional),
        "isbn": str (optional),
        "author": str (optional),
        "section": str (optional),
    }

    Args:
        raw_data: Raw book data dictionary.

    Returns:
        Normalized document dictionary.

    Raises:
        NormalizationError: If required fields are missing.
    """
    required = ["chapter_number", "title", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="book")

    chapter_number = raw_data["chapter_number"]
    title = raw_data["title"]
    content = raw_data["content"]
    book_title = raw_data.get("book_title", "Unknown")
    isbn = raw_data.get("isbn", "unknown")

    # Generate unique ID from book identifier and chapter
    unique_key = f"{isbn}_ch{chapter_number:02d}"
    doc_id = generate_document_id("book", unique_key)

    # Determine source type
    source_type = "book_section" if raw_data.get("section") else "book_chapter"

    doc = create_base_document(
        source="book",
        source_type=source_type,
        title=f"{book_title} - {title}",
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id
    doc["metadata"]["author"] = raw_data.get("author")

    doc["metadata"]["source_specific"] = {
        "chapter_number": chapter_number,
        "book_title": book_title,
        "isbn": isbn,
        "section": raw_data.get("section"),
    }

    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_linkedin(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize LinkedIn post data to unified schema.

    Expected raw_data structure:
    {
        "post_id": str,
        "content": str,
        "date": str,
        "author": str (optional),
        "engagement": dict (optional),
        "post_type": str (optional, "post" or "article"),
    }

    Args:
        raw_data: Raw LinkedIn data dictionary.

    Returns:
        Normalized document dictionary.
    """
    required = ["post_id", "content", "date"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="linkedin")

    post_id = raw_data["post_id"]
    content = raw_data["content"]

    doc_id = generate_document_id("linkedin", post_id)

    # Determine source type
    post_type = raw_data.get("post_type", "post")
    source_type = "linkedin_article" if post_type == "article" else "linkedin_post"

    # Generate title from content if not provided
    title = raw_data.get("title") or content[:100].split("\n")[0] + "..."

    doc = create_base_document(
        source="linkedin",
        source_type=source_type,
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id
    doc["metadata"]["published_date"] = parse_date(raw_data.get("date"))
    doc["metadata"]["author"] = raw_data.get("author")
    doc["metadata"]["url"] = raw_data.get("url")

    doc["metadata"]["source_specific"] = {
        "post_id": post_id,
        "post_type": post_type,
        "engagement": raw_data.get("engagement", {}),
    }

    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_deal_academy(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize Deal Academy course content to unified schema.

    Expected raw_data structure:
    {
        "course_id": str,
        "lesson_id": str,
        "content": str,
        "title": str (optional),
        "module": str (optional),
        "lesson_number": int (optional),
    }

    Args:
        raw_data: Raw Deal Academy data dictionary.

    Returns:
        Normalized document dictionary.
    """
    required = ["course_id", "lesson_id", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="deal_academy")

    course_id = raw_data["course_id"]
    lesson_id = raw_data["lesson_id"]
    content = raw_data["content"]

    unique_key = f"{course_id}_{lesson_id}"
    doc_id = generate_document_id("deal_academy", unique_key)

    # Determine if this is a module overview or lesson
    source_type = "course_module" if raw_data.get("is_module_overview") else "course_lesson"

    title = raw_data.get("title", f"Course {course_id} - Lesson {lesson_id}")

    doc = create_base_document(
        source="deal_academy",
        source_type=source_type,
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id
    doc["metadata"]["author"] = raw_data.get("instructor")

    doc["metadata"]["source_specific"] = {
        "course_id": course_id,
        "lesson_id": lesson_id,
        "module": raw_data.get("module"),
        "lesson_number": raw_data.get("lesson_number"),
        "duration_seconds": raw_data.get("duration_seconds"),
    }

    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


def normalize_media(raw_data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize media mention/article data to unified schema.

    Expected raw_data structure:
    {
        "url": str,
        "title": str,
        "content": str,
        "outlet": str (optional),
        "published_date": str (optional),
        "article_type": str (optional, "article" or "interview"),
    }

    Args:
        raw_data: Raw media data dictionary.

    Returns:
        Normalized document dictionary.
    """
    required = ["url", "title", "content"]
    missing = [f for f in required if not raw_data.get(f)]
    if missing:
        raise NormalizationError(f"Missing required fields: {', '.join(missing)}", source="media")

    url = raw_data["url"]
    title = raw_data["title"]
    content = raw_data["content"]

    doc_id = generate_document_id("media", url)

    # Determine source type
    article_type = raw_data.get("article_type", "article")
    source_type = "media_interview" if article_type == "interview" else "media_article"

    doc = create_base_document(
        source="media",
        source_type=source_type,
        title=title,
        text=content,
        raw_file_path=raw_data.get("raw_file_path"),
    )

    doc["id"] = doc_id
    doc["metadata"]["url"] = url
    doc["metadata"]["published_date"] = parse_date(raw_data.get("published_date"))
    doc["metadata"]["author"] = raw_data.get("author") or detect_author(content)

    doc["metadata"]["source_specific"] = {
        "outlet": raw_data.get("outlet"),
        "article_type": article_type,
        "section": raw_data.get("section"),
    }

    doc["extraction"]["quality_score"] = calculate_quality_score(doc)

    return doc


# Normalizer function registry
NORMALIZERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "youtube": normalize_youtube,
    "blog": normalize_blog,
    "podcast": normalize_podcast,
    "book": normalize_book,
    "linkedin": normalize_linkedin,
    "deal_academy": normalize_deal_academy,
    "media": normalize_media,
}


def discover_raw_files(input_dir: Path, source: str) -> list[Path]:
    """
    Discover raw JSON files for a given source.

    Args:
        input_dir: Input directory path.
        source: Source type to discover files for.

    Returns:
        List of file paths to process.
    """
    files: list[Path] = []

    # Source-specific discovery patterns
    source_patterns = {
        "youtube": ["captions/*.json", "metadata/*.json"],
        "blog": ["articles/*.json", "*.json"],
        "podcast": ["transcripts/*.json", "metadata/*.json"],
        "book": ["extracted/*.json"],
        "linkedin": ["processed/*.json", "exports/*.json"],
        "deal_academy": ["lessons/*.json", "courses/*.json"],
        "media": ["articles/*.json"],
    }

    patterns = source_patterns.get(source, ["*.json"])

    for pattern in patterns:
        discovered = list(input_dir.glob(pattern))
        files.extend(discovered)

    # Deduplicate and sort
    files = sorted(set(files))

    return files


def process_source(
    source: str,
    input_dir: Path,
    output_dir: Path,
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Process all raw files for a source and write normalized output.

    Args:
        source: Source type to process.
        input_dir: Input directory containing raw files.
        output_dir: Output directory for normalized files.
        dry_run: If True, don't write files, just validate.

    Returns:
        Processing statistics dictionary.
    """
    stats = {
        "source": source,
        "files_discovered": 0,
        "files_processed": 0,
        "files_skipped": 0,
        "files_failed": 0,
        "errors": [],
    }

    # Get normalizer function
    normalizer = NORMALIZERS.get(source)
    if not normalizer:
        logger.error(f"No normalizer found for source: {source}")
        stats["errors"].append(f"No normalizer for source: {source}")
        return stats

    # Discover files
    files = discover_raw_files(input_dir, source)
    stats["files_discovered"] = len(files)

    if not files:
        logger.warning(f"No raw files found for {source} in {input_dir}")
        return stats

    logger.info(f"Found {len(files)} files to process for {source}")

    # Ensure output directory exists
    if not dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    # Process each file
    for file_path in files:
        try:
            # Read raw data
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            # Add raw file path to data
            raw_data["raw_file_path"] = str(file_path)

            # Normalize
            normalized = normalizer(raw_data)

            # Write output
            if not dry_run:
                output_path = output_dir / f"{normalized['id']}.json"
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(normalized, f, indent=2, ensure_ascii=False)
                logger.debug(f"Wrote: {output_path}")

            stats["files_processed"] += 1

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            stats["files_failed"] += 1
            stats["errors"].append({"file": str(file_path), "error": f"JSON decode: {e}"})

        except NormalizationError as e:
            logger.error(f"Normalization error for {file_path}: {e}")
            stats["files_failed"] += 1
            stats["errors"].append({"file": str(file_path), "error": str(e)})

        except Exception as e:
            logger.exception(f"Unexpected error processing {file_path}: {e}")
            stats["files_failed"] += 1
            stats["errors"].append({"file": str(file_path), "error": str(e)})

    return stats


def main() -> int:
    """
    Main entry point for the normalizer CLI.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(
        description="Normalize raw extracted content to unified document schema.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python normalizer.py --source youtube --input-dir data/raw/youtube
  python normalizer.py --source all --input-dir data/raw --output-dir data/normalized/documents
  python normalizer.py --source blog --dry-run
        """,
    )

    parser.add_argument(
        "--source",
        type=str,
        required=True,
        choices=list(VALID_SOURCES) + ["all"],
        help="Source type to process (or 'all' for all sources)",
    )

    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/raw"),
        help="Input directory containing raw files (default: data/raw)",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/normalized/documents"),
        help="Output directory for normalized files (default: data/normalized/documents)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate without writing files",
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
    input_dir = args.input_dir.resolve()
    output_dir = args.output_dir.resolve()

    # Validate input directory exists
    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return 1

    # Determine sources to process
    if args.source == "all":
        sources = list(VALID_SOURCES)
    else:
        sources = [args.source]

    # Process each source
    all_stats: list[dict[str, Any]] = []
    total_processed = 0
    total_failed = 0

    for source in sources:
        # Determine source-specific input directory
        if args.source == "all":
            source_input_dir = input_dir / source
        else:
            source_input_dir = input_dir

        if not source_input_dir.exists():
            logger.warning(f"Skipping {source}: directory not found at {source_input_dir}")
            continue

        logger.info(f"Processing source: {source}")
        stats = process_source(
            source=source,
            input_dir=source_input_dir,
            output_dir=output_dir,
            dry_run=args.dry_run,
        )
        all_stats.append(stats)
        total_processed += stats["files_processed"]
        total_failed += stats["files_failed"]

    # Print summary
    if not args.quiet:
        print("\n" + "=" * 60)
        print("NORMALIZATION SUMMARY")
        print("=" * 60)

        for stats in all_stats:
            print(f"\n{stats['source'].upper()}:")
            print(f"  Discovered: {stats['files_discovered']}")
            print(f"  Processed:  {stats['files_processed']}")
            print(f"  Failed:     {stats['files_failed']}")

            if stats["errors"]:
                print("  Errors:")
                for err in stats["errors"][:5]:  # Show first 5 errors
                    print(f"    - {err}")
                if len(stats["errors"]) > 5:
                    print(f"    ... and {len(stats['errors']) - 5} more errors")

        print("\n" + "-" * 60)
        print(f"TOTAL PROCESSED: {total_processed}")
        print(f"TOTAL FAILED:    {total_failed}")

        if args.dry_run:
            print("\n(DRY RUN - no files written)")

    # Return appropriate exit code
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
