#!/usr/bin/env python3
"""
Podcast RSS Feed Extractor
==========================
Extracts podcast episode metadata and audio from RSS feeds.

Features:
- Parses RSS feeds using feedparser library
- Extracts episode metadata (title, date, duration, description)
- Downloads audio files from RSS enclosures
- Supports yt-dlp for YouTube-hosted podcast audio
- Incremental extraction with state persistence
- Generates list of audio files ready for Whisper transcription
- Comprehensive error handling with retry logic

Output Structure:
- Audio files: data/raw/podcast/audio/pod_{episode_id}.mp3
- Metadata: data/raw/podcast/metadata/pod_{episode_id}_meta.json
- Transcripts: data/raw/podcast/transcripts/pod_{episode_id}.json

Usage:
    python podcast_extractor.py --feeds "feed1.xml,feed2.xml" \\
                                --output-dir /path/to/data/raw/podcast \\
                                --state-file /path/to/data/state/podcast_state.json \\
                                --download-audio \\
                                --skip-existing

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("podcast_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_RATE_LIMIT_DELAY = 1.0  # seconds between downloads
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds between retries
DEFAULT_DOWNLOAD_TIMEOUT = 600  # 10 minutes for large audio files
SUPPORTED_AUDIO_EXTENSIONS = frozenset({".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus"})
USER_AGENT = "PodcastExtractor/1.0 (Compatible; Python/3.11+)"


class EpisodeMetadata(TypedDict, total=False):
    """Type definition for podcast episode metadata."""

    episode_id: str
    title: str
    description: str
    summary: str
    published_date: str
    duration_seconds: int
    duration_formatted: str
    audio_url: str
    audio_type: str
    audio_size_bytes: int
    episode_number: int
    season_number: int
    podcast_name: str
    feed_url: str
    link: str
    image_url: str
    explicit: bool
    keywords: list[str]
    author: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_ids: list[str]
    failed_ids: list[str]
    pending_ids: list[str]
    needs_transcription: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single episode."""

    episode_id: str
    success: bool
    has_audio: bool
    metadata_path: Path | None = None
    audio_path: Path | None = None
    error: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_discovered: int = 0
    processed: int = 0
    skipped: int = 0
    failed: int = 0
    downloaded: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class PodcastExtractorError(Exception):
    """Base exception for podcast extractor errors."""

    pass


class FeedParseError(PodcastExtractorError):
    """Raised when RSS feed cannot be parsed."""

    pass


class AudioDownloadError(PodcastExtractorError):
    """Raised when audio download fails."""

    pass


class YtDlpNotFoundError(PodcastExtractorError):
    """Raised when yt-dlp is not installed for YouTube podcast sources."""

    pass


def check_feedparser_installed() -> None:
    """
    Check if feedparser library is installed.

    Raises:
        ImportError: If feedparser is not installed.
    """
    try:
        import feedparser  # noqa: F401
    except ImportError:
        raise ImportError(
            "feedparser not installed. Install it with: pip install feedparser"
        )


def check_yt_dlp_installed() -> str | None:
    """
    Check if yt-dlp is installed and return its path.

    Returns:
        Path to yt-dlp executable, or None if not found.
    """
    try:
        result = subprocess.run(
            ["which", "yt-dlp"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # Try common locations
    common_paths = [
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
        os.path.expanduser("~/.local/bin/yt-dlp"),
    ]

    for path in common_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return None


def generate_episode_id(feed_url: str, guid: str | None, title: str, pub_date: str | None) -> str:
    """
    Generate a deterministic episode ID from episode identifiers.

    Uses the episode GUID if available, otherwise generates from title and date.

    Args:
        feed_url: The RSS feed URL.
        guid: Episode GUID from the feed (may be None).
        title: Episode title.
        pub_date: Publication date string.

    Returns:
        A deterministic episode ID string.
    """
    if guid:
        # Use GUID if available (most reliable)
        hash_input = f"{feed_url}:{guid}"
    else:
        # Fallback to title + date
        hash_input = f"{feed_url}:{title}:{pub_date or ''}"

    hash_value = hashlib.md5(hash_input.encode("utf-8")).hexdigest()[:12]
    return f"pod_{hash_value}"


def parse_duration(duration_str: str | None) -> int | None:
    """
    Parse podcast duration string to seconds.

    Handles multiple formats:
    - HH:MM:SS
    - MM:SS
    - Seconds as integer
    - iTunes duration format

    Args:
        duration_str: Duration string from RSS feed.

    Returns:
        Duration in seconds, or None if parsing fails.
    """
    if not duration_str:
        return None

    duration_str = str(duration_str).strip()

    # Try integer seconds
    try:
        return int(duration_str)
    except ValueError:
        pass

    # Try HH:MM:SS or MM:SS format
    parts = duration_str.split(":")
    try:
        if len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
    except ValueError:
        pass

    # Try parsing as float
    try:
        return int(float(duration_str))
    except ValueError:
        pass

    logger.debug(f"Could not parse duration: {duration_str}")
    return None


def format_duration(seconds: int | None) -> str | None:
    """
    Format duration seconds to HH:MM:SS string.

    Args:
        seconds: Duration in seconds.

    Returns:
        Formatted duration string, or None if seconds is None.
    """
    if seconds is None:
        return None

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def parse_rfc2822_date(date_str: str | None) -> str | None:
    """
    Parse RFC 2822 date format used in RSS feeds.

    Args:
        date_str: Date string from RSS feed.

    Returns:
        ISO formatted date string, or None if parsing fails.
    """
    if not date_str:
        return None

    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        pass

    # Try ISO format
    try:
        if "T" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    logger.debug(f"Could not parse date: {date_str}")
    return None


def extract_audio_info(entry: dict[str, Any]) -> tuple[str | None, str | None, int | None]:
    """
    Extract audio URL, type, and size from RSS entry enclosures.

    Args:
        entry: Parsed RSS entry dictionary.

    Returns:
        Tuple of (audio_url, audio_type, audio_size_bytes).
    """
    audio_url = None
    audio_type = None
    audio_size = None

    # Check enclosures (standard RSS)
    enclosures = entry.get("enclosures", [])
    for enclosure in enclosures:
        enc_type = enclosure.get("type", "")
        enc_url = enclosure.get("href") or enclosure.get("url")

        if enc_type.startswith("audio/") or (enc_url and is_audio_url(enc_url)):
            audio_url = enc_url
            audio_type = enc_type
            try:
                audio_size = int(enclosure.get("length", 0))
            except (ValueError, TypeError):
                audio_size = None
            break

    # Fallback to media content
    if not audio_url:
        media_content = entry.get("media_content", [])
        for media in media_content:
            media_type = media.get("type", "")
            media_url = media.get("url")

            if media_type.startswith("audio/") or (media_url and is_audio_url(media_url)):
                audio_url = media_url
                audio_type = media_type
                break

    # Fallback to links
    if not audio_url:
        links = entry.get("links", [])
        for link in links:
            link_type = link.get("type", "")
            link_href = link.get("href")

            if link_type.startswith("audio/") or (link_href and is_audio_url(link_href)):
                audio_url = link_href
                audio_type = link_type
                break

    return audio_url, audio_type, audio_size


def is_audio_url(url: str) -> bool:
    """
    Check if a URL points to an audio file based on extension.

    Args:
        url: URL string to check.

    Returns:
        True if URL appears to be an audio file.
    """
    if not url:
        return False

    parsed = urlparse(url)
    path = parsed.path.lower()

    for ext in SUPPORTED_AUDIO_EXTENSIONS:
        if path.endswith(ext):
            return True

    return False


def is_youtube_url(url: str) -> bool:
    """
    Check if a URL is a YouTube URL.

    Args:
        url: URL string to check.

    Returns:
        True if URL is a YouTube URL.
    """
    if not url:
        return False

    youtube_domains = ["youtube.com", "youtu.be", "www.youtube.com"]
    parsed = urlparse(url)
    return any(domain in parsed.netloc for domain in youtube_domains)


def clean_html(text: str | None) -> str:
    """
    Remove HTML tags and clean text content.

    Args:
        text: HTML text to clean.

    Returns:
        Cleaned plain text.
    """
    if not text:
        return ""

    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Decode HTML entities
    import html
    text = html.unescape(text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def parse_feed(feed_url: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Parse an RSS feed and extract podcast metadata and episodes.

    Args:
        feed_url: URL of the RSS feed.

    Returns:
        Tuple of (podcast_metadata, list_of_episodes).

    Raises:
        FeedParseError: If feed cannot be fetched or parsed.
    """
    import feedparser

    logger.info(f"Fetching feed: {feed_url}")

    # Parse the feed
    try:
        feed = feedparser.parse(feed_url, agent=USER_AGENT)
    except Exception as e:
        raise FeedParseError(f"Failed to fetch feed: {e}")

    # Check for parse errors
    if feed.bozo and not feed.entries:
        raise FeedParseError(f"Feed parse error: {feed.bozo_exception}")

    # Extract podcast metadata
    podcast_meta = {
        "title": feed.feed.get("title", "Unknown Podcast"),
        "description": clean_html(feed.feed.get("description") or feed.feed.get("subtitle")),
        "link": feed.feed.get("link"),
        "language": feed.feed.get("language", "en"),
        "author": feed.feed.get("author") or feed.feed.get("itunes_author"),
        "image_url": None,
        "feed_url": feed_url,
        "last_build_date": feed.feed.get("updated") or feed.feed.get("published"),
    }

    # Extract podcast image
    if feed.feed.get("image"):
        podcast_meta["image_url"] = feed.feed.image.get("href") or feed.feed.image.get("url")
    elif feed.feed.get("itunes_image"):
        podcast_meta["image_url"] = feed.feed.itunes_image.get("href")

    # Process episodes
    episodes: list[dict[str, Any]] = []
    for entry in feed.entries:
        episode = parse_episode(entry, feed_url, podcast_meta["title"])
        if episode:
            episodes.append(episode)

    logger.info(f"Parsed {len(episodes)} episodes from feed")
    return podcast_meta, episodes


def parse_episode(entry: dict[str, Any], feed_url: str, podcast_name: str) -> dict[str, Any] | None:
    """
    Parse a single RSS entry into episode metadata.

    Args:
        entry: RSS entry dictionary from feedparser.
        feed_url: URL of the parent feed.
        podcast_name: Name of the podcast.

    Returns:
        Episode metadata dictionary, or None if entry is invalid.
    """
    # Get title (required)
    title = entry.get("title")
    if not title:
        logger.debug("Skipping entry without title")
        return None

    # Get GUID
    guid = entry.get("id") or entry.get("guid")

    # Get publication date
    pub_date_raw = entry.get("published") or entry.get("updated")
    pub_date = parse_rfc2822_date(pub_date_raw)

    # Generate episode ID
    episode_id = generate_episode_id(feed_url, guid, title, pub_date)

    # Extract audio information
    audio_url, audio_type, audio_size = extract_audio_info(entry)

    # Get duration
    duration_raw = (
        entry.get("itunes_duration")
        or entry.get("duration")
        or entry.get("content", [{}])[0].get("duration") if entry.get("content") else None
    )
    duration_seconds = parse_duration(duration_raw)

    # Get episode/season numbers
    episode_number = None
    season_number = None

    if entry.get("itunes_episode"):
        try:
            episode_number = int(entry.get("itunes_episode"))
        except (ValueError, TypeError):
            pass

    if entry.get("itunes_season"):
        try:
            season_number = int(entry.get("itunes_season"))
        except (ValueError, TypeError):
            pass

    # Get description
    description = clean_html(
        entry.get("content", [{}])[0].get("value")
        if entry.get("content")
        else entry.get("description")
    )
    summary = clean_html(entry.get("summary") or entry.get("itunes_summary"))

    # Get keywords
    keywords: list[str] = []
    if entry.get("tags"):
        keywords = [tag.get("term", "") for tag in entry.get("tags", []) if tag.get("term")]
    if entry.get("itunes_keywords"):
        keywords.extend(entry.get("itunes_keywords", "").split(","))
    keywords = [k.strip() for k in keywords if k.strip()]

    # Get explicit flag
    explicit = entry.get("itunes_explicit", "").lower() in ("yes", "true", "1", "explicit")

    # Get author
    author = entry.get("author") or entry.get("itunes_author")

    # Get episode image
    image_url = None
    if entry.get("image"):
        image_url = entry.image.get("href") or entry.image.get("url")
    elif entry.get("itunes_image"):
        image_url = entry.itunes_image.get("href")

    return {
        "episode_id": episode_id,
        "title": title,
        "description": description or summary or "",
        "summary": summary or "",
        "published_date": pub_date,
        "duration_seconds": duration_seconds,
        "duration_formatted": format_duration(duration_seconds),
        "audio_url": audio_url,
        "audio_type": audio_type,
        "audio_size_bytes": audio_size,
        "episode_number": episode_number,
        "season_number": season_number,
        "podcast_name": podcast_name,
        "feed_url": feed_url,
        "link": entry.get("link"),
        "image_url": image_url,
        "explicit": explicit,
        "keywords": keywords,
        "author": author,
        "guid": guid,
    }


def download_audio_direct(
    url: str,
    output_path: Path,
    timeout: int = DEFAULT_DOWNLOAD_TIMEOUT,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> Path | None:
    """
    Download audio file directly via HTTP.

    Args:
        url: Audio file URL.
        output_path: Path to save the downloaded file.
        timeout: Download timeout in seconds.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries in seconds.

    Returns:
        Path to downloaded file, or None if download fails.
    """
    for attempt in range(retry_count):
        try:
            logger.debug(f"Downloading: {url} (attempt {attempt + 1})")

            # Create request with proper headers
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "audio/*",
                },
            )

            # Download file
            with urllib.request.urlopen(request, timeout=timeout) as response:
                # Ensure parent directory exists
                output_path.parent.mkdir(parents=True, exist_ok=True)

                # Write to file
                with open(output_path, "wb") as f:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)

            # Verify file was written
            if output_path.exists() and output_path.stat().st_size > 0:
                logger.debug(f"Downloaded to: {output_path}")
                return output_path

            logger.warning(f"Download produced empty file: {output_path}")
            output_path.unlink(missing_ok=True)

        except urllib.error.HTTPError as e:
            logger.warning(f"HTTP error {e.code} downloading {url}: {e.reason}")
            if e.code in (403, 404, 410):
                # Don't retry on permanent errors
                return None

        except urllib.error.URLError as e:
            logger.warning(f"URL error downloading {url}: {e.reason}")

        except Exception as e:
            logger.warning(f"Error downloading {url}: {e}")

        if attempt < retry_count - 1:
            time.sleep(retry_delay)

    return None


def download_audio_ytdlp(
    url: str,
    output_dir: Path,
    episode_id: str,
    yt_dlp_path: str,
    timeout: int = DEFAULT_DOWNLOAD_TIMEOUT,
) -> Path | None:
    """
    Download audio using yt-dlp (for YouTube or complex sources).

    Args:
        url: Audio/video URL.
        output_dir: Directory to save the downloaded file.
        episode_id: Episode ID for naming.
        yt_dlp_path: Path to yt-dlp executable.
        timeout: Download timeout in seconds.

    Returns:
        Path to downloaded file, or None if download fails.
    """
    output_template = str(output_dir / f"{episode_id}.%(ext)s")

    args = [
        yt_dlp_path,
        "-x",  # Extract audio
        "--audio-format", "mp3",
        "--audio-quality", "0",  # Best quality
        "-o", output_template,
        "--no-playlist",
        "--no-warnings",
        url,
    ]

    logger.debug(f"Running yt-dlp: {' '.join(args)}")

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            logger.warning(f"yt-dlp error: {result.stderr}")
            return None

        # Find the downloaded file
        for ext in [".mp3", ".m4a", ".wav", ".opus", ".ogg"]:
            output_path = output_dir / f"{episode_id}{ext}"
            if output_path.exists():
                return output_path

        logger.warning("yt-dlp completed but no output file found")
        return None

    except subprocess.TimeoutExpired:
        logger.warning(f"yt-dlp timed out after {timeout}s")
        return None
    except Exception as e:
        logger.warning(f"yt-dlp error: {e}")
        return None


def download_episode_audio(
    episode: dict[str, Any],
    output_dir: Path,
    yt_dlp_path: str | None = None,
) -> Path | None:
    """
    Download audio for an episode, choosing the appropriate method.

    Args:
        episode: Episode metadata dictionary.
        output_dir: Directory to save audio files.
        yt_dlp_path: Path to yt-dlp executable (optional).

    Returns:
        Path to downloaded audio file, or None if download fails.
    """
    audio_url = episode.get("audio_url")
    episode_id = episode["episode_id"]

    if not audio_url:
        logger.warning(f"No audio URL for episode: {episode_id}")
        return None

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine download method
    if is_youtube_url(audio_url):
        if not yt_dlp_path:
            logger.warning(f"YouTube URL but yt-dlp not available: {audio_url}")
            return None
        return download_audio_ytdlp(audio_url, output_dir, episode_id, yt_dlp_path)

    # Direct download for regular audio URLs
    # Determine output extension from URL or content type
    parsed = urlparse(audio_url)
    path_ext = Path(parsed.path).suffix.lower()
    if path_ext in SUPPORTED_AUDIO_EXTENSIONS:
        ext = path_ext
    else:
        ext = ".mp3"  # Default to mp3

    output_path = output_dir / f"{episode_id}{ext}"

    return download_audio_direct(audio_url, output_path)


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "podcast",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_ids": [],
        "failed_ids": [],
        "pending_ids": [],
        "needs_transcription": [],
        "metadata": {
            "feed_urls": [],
            "podcast_names": [],
            "extraction_method": "rss_feed",
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
            # Ensure needs_transcription exists (for backward compatibility)
            if "needs_transcription" not in state:
                state["needs_transcription"] = []
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


def save_episode_metadata(
    episode: dict[str, Any],
    output_dir: Path,
    audio_path: Path | None = None,
) -> Path:
    """
    Save episode metadata to JSON file.

    Args:
        episode: Episode metadata dictionary.
        output_dir: Directory to save metadata files.
        audio_path: Path to downloaded audio file (if any).

    Returns:
        Path to saved metadata file.
    """
    metadata_dir = output_dir / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)

    # Add extraction metadata
    metadata = {
        **episode,
        "audio_file_path": str(audio_path) if audio_path else None,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }

    output_path = metadata_dir / f"{episode['episode_id']}_meta.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    logger.debug(f"Saved metadata to: {output_path}")
    return output_path


def generate_transcription_manifest(
    state: ExtractionState,
    output_dir: Path,
) -> Path:
    """
    Generate a manifest file of audio files needing transcription.

    Args:
        state: Current extraction state.
        output_dir: Output directory.

    Returns:
        Path to manifest file.
    """
    audio_dir = output_dir / "audio"
    manifest_path = output_dir / "transcription_manifest.json"

    audio_files: list[dict[str, Any]] = []

    for episode_id in state.get("needs_transcription", []):
        # Find audio file
        for ext in SUPPORTED_AUDIO_EXTENSIONS:
            audio_path = audio_dir / f"{episode_id}{ext}"
            if audio_path.exists():
                # Load metadata
                metadata_path = output_dir / "metadata" / f"{episode_id}_meta.json"
                metadata = {}
                if metadata_path.exists():
                    try:
                        with open(metadata_path, "r", encoding="utf-8") as f:
                            metadata = json.load(f)
                    except json.JSONDecodeError:
                        pass

                audio_files.append({
                    "episode_id": episode_id,
                    "audio_path": str(audio_path),
                    "metadata_path": str(metadata_path) if metadata_path.exists() else None,
                    "title": metadata.get("title", "Unknown"),
                    "duration_seconds": metadata.get("duration_seconds"),
                    "podcast_name": metadata.get("podcast_name"),
                })
                break

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_files": len(audio_files),
        "output_directory": str(output_dir / "transcripts"),
        "files": audio_files,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    logger.info(f"Generated transcription manifest: {manifest_path}")
    return manifest_path


def extract_episode(
    episode: dict[str, Any],
    output_dir: Path,
    download_audio: bool = True,
    yt_dlp_path: str | None = None,
) -> ExtractionResult:
    """
    Extract a single podcast episode.

    Args:
        episode: Episode metadata dictionary.
        output_dir: Base output directory.
        download_audio: Whether to download audio files.
        yt_dlp_path: Path to yt-dlp executable.

    Returns:
        ExtractionResult with paths and status.
    """
    episode_id = episode["episode_id"]
    result = ExtractionResult(episode_id=episode_id, success=False, has_audio=False)

    audio_path: Path | None = None

    # Download audio if requested
    if download_audio and episode.get("audio_url"):
        audio_dir = output_dir / "audio"
        audio_path = download_episode_audio(episode, audio_dir, yt_dlp_path)

        if audio_path:
            result.audio_path = audio_path
            result.has_audio = True
            logger.info(f"  Downloaded audio: {audio_path.name}")
        else:
            logger.warning(f"  Failed to download audio for {episode_id}")

    # Save metadata
    try:
        metadata_path = save_episode_metadata(episode, output_dir, audio_path)
        result.metadata_path = metadata_path
        result.success = True
    except Exception as e:
        result.error = f"Failed to save metadata: {e}"
        logger.error(result.error)

    return result


def run_extraction(
    feed_urls: list[str],
    output_dir: Path,
    state_file: Path,
    download_audio: bool = True,
    limit: int | None = None,
    skip_existing: bool = True,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the full extraction process for one or more podcast feeds.

    Args:
        feed_urls: List of RSS feed URLs.
        output_dir: Base output directory.
        state_file: Path to state file.
        download_audio: Whether to download audio files.
        limit: Maximum number of episodes to process per feed.
        skip_existing: Skip already processed episodes.
        rate_limit_delay: Delay between downloads in seconds.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Check dependencies
    check_feedparser_installed()
    yt_dlp_path = check_yt_dlp_installed()
    if yt_dlp_path:
        logger.info(f"yt-dlp available at: {yt_dlp_path}")
    else:
        logger.info("yt-dlp not found (YouTube sources will be skipped)")

    # Load state
    state = load_state(state_file)

    # Process each feed
    all_episodes: list[dict[str, Any]] = []

    for feed_url in feed_urls:
        try:
            podcast_meta, episodes = parse_feed(feed_url)

            # Update state metadata
            if feed_url not in state["metadata"].get("feed_urls", []):
                state["metadata"].setdefault("feed_urls", []).append(feed_url)
            if podcast_meta["title"] not in state["metadata"].get("podcast_names", []):
                state["metadata"].setdefault("podcast_names", []).append(podcast_meta["title"])

            all_episodes.extend(episodes)
            logger.info(f"Loaded {len(episodes)} episodes from: {podcast_meta['title']}")

        except FeedParseError as e:
            logger.error(f"Failed to parse feed {feed_url}: {e}")
            stats.errors.append({"feed_url": feed_url, "error": str(e)})
            continue

    stats.total_discovered = len(all_episodes)

    if not all_episodes:
        logger.warning("No episodes found in any feed")
        return stats

    # Filter episodes based on state
    processed_set = set(state["processed_ids"])
    failed_set = set(state["failed_ids"])

    episodes_to_process: list[dict[str, Any]] = []
    for episode in all_episodes:
        episode_id = episode["episode_id"]
        if skip_existing and episode_id in processed_set:
            logger.debug(f"Skipping already processed: {episode_id}")
            stats.skipped += 1
            continue
        episodes_to_process.append(episode)

    # Apply limit
    if limit and len(episodes_to_process) > limit:
        episodes_to_process = episodes_to_process[:limit]

    if not episodes_to_process:
        logger.info("No new episodes to process")
        return stats

    logger.info(f"Processing {len(episodes_to_process)} episodes...")

    # Process each episode
    for i, episode in enumerate(episodes_to_process):
        episode_id = episode["episode_id"]
        logger.info(
            f"[{i + 1}/{len(episodes_to_process)}] Processing: "
            f"{episode.get('title', 'Unknown')[:50]} ({episode_id})"
        )

        result = extract_episode(
            episode=episode,
            output_dir=output_dir,
            download_audio=download_audio,
            yt_dlp_path=yt_dlp_path,
        )
        stats.results.append(result)

        if result.success:
            state["processed_ids"].append(episode_id)
            stats.processed += 1

            if result.has_audio:
                stats.downloaded += 1
                # Mark for transcription
                if episode_id not in state["needs_transcription"]:
                    state["needs_transcription"].append(episode_id)

            # Remove from failed if previously failed
            if episode_id in state["failed_ids"]:
                state["failed_ids"].remove(episode_id)

            logger.info(f"  Successfully extracted (audio: {result.has_audio})")
        else:
            if episode_id not in state["failed_ids"]:
                state["failed_ids"].append(episode_id)
            stats.failed += 1
            stats.errors.append({"episode_id": episode_id, "error": result.error or "Unknown error"})
            logger.error(f"  Failed: {result.error}")

        # Save state periodically
        if (i + 1) % 5 == 0:
            save_state(state, state_file)

        # Rate limiting
        if i < len(episodes_to_process) - 1 and download_audio:
            time.sleep(rate_limit_delay)

    # Final state save
    save_state(state, state_file)

    # Generate transcription manifest
    if state.get("needs_transcription"):
        generate_transcription_manifest(state, output_dir)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("PODCAST EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total discovered:    {stats.total_discovered}")
    print(f"Processed:           {stats.processed}")
    print(f"Downloaded audio:    {stats.downloaded}")
    print(f"Skipped (existing):  {stats.skipped}")
    print(f"Failed:              {stats.failed}")

    if stats.downloaded > 0:
        print(f"\nAudio files are ready for transcription.")
        print("Run transcribe_audio.py --batch on the audio directory.")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            if "episode_id" in err:
                print(f"  [{err['episode_id']}] {err['error']}")
            elif "feed_url" in err:
                print(f"  [FEED] {err['feed_url']}: {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the podcast extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract podcast episode metadata and audio from RSS feeds.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python podcast_extractor.py --feeds "https://example.com/feed.xml"
  python podcast_extractor.py --feeds "feed1.xml,feed2.xml" --download-audio
  python podcast_extractor.py --feeds "feed.xml" --limit 10 --skip-existing

Output Structure:
  {output-dir}/audio/pod_{episode_id}.mp3     - Downloaded audio files
  {output-dir}/metadata/pod_{episode_id}_meta.json - Episode metadata
  {output-dir}/transcripts/pod_{episode_id}.json  - Transcripts (from transcribe_audio.py)
  {output-dir}/transcription_manifest.json    - List of files needing transcription

Integration with transcribe_audio.py:
  # After extraction, transcribe the downloaded audio:
  python docs/transcribe_audio.py --batch {output-dir}/audio --output {output-dir}/transcripts
        """,
    )

    parser.add_argument(
        "--feeds",
        type=str,
        required=True,
        help="Comma-separated list of RSS feed URLs",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/podcast"),
        help="Output directory for extracted content (default: data/raw/podcast)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/podcast_state.json"),
        help="State file for tracking processed episodes (default: data/state/podcast_state.json)",
    )

    parser.add_argument(
        "--download-audio",
        action="store_true",
        help="Download audio files (default: metadata only)",
    )

    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Skip audio download (metadata only)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of episodes to process per feed (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed episodes (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all episodes, ignoring state",
    )

    parser.add_argument(
        "--rate-limit",
        type=float,
        default=DEFAULT_RATE_LIMIT_DELAY,
        help=f"Delay between downloads in seconds (default: {DEFAULT_RATE_LIMIT_DELAY})",
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

    parser.add_argument(
        "--list-episodes",
        action="store_true",
        help="List episodes from feeds without processing",
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    elif args.quiet:
        logger.setLevel(logging.ERROR)

    # Parse feed URLs
    feed_urls = [url.strip() for url in args.feeds.split(",") if url.strip()]

    if not feed_urls:
        logger.error("No feed URLs provided")
        return 1

    # Resolve paths
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()

    # Handle list-episodes mode
    if args.list_episodes:
        check_feedparser_installed()
        for feed_url in feed_urls:
            try:
                podcast_meta, episodes = parse_feed(feed_url)
                print(f"\n{podcast_meta['title']} ({len(episodes)} episodes)")
                print("-" * 60)
                for ep in episodes[:20]:
                    duration = ep.get("duration_formatted", "??:??")
                    date = ep.get("published_date", "Unknown date")
                    has_audio = "Yes" if ep.get("audio_url") else "No"
                    print(f"  [{date}] {ep['title'][:50]} ({duration}) Audio: {has_audio}")
                if len(episodes) > 20:
                    print(f"  ... and {len(episodes) - 20} more episodes")
            except FeedParseError as e:
                print(f"\nError parsing {feed_url}: {e}")
        return 0

    # Determine download mode
    download_audio = args.download_audio and not args.no_download

    # Run extraction
    try:
        stats = run_extraction(
            feed_urls=feed_urls,
            output_dir=output_dir,
            state_file=state_file,
            download_audio=download_audio,
            limit=args.limit,
            skip_existing=args.skip_existing,
            rate_limit_delay=args.rate_limit,
            verbose=args.verbose,
        )
    except ImportError as e:
        logger.error(str(e))
        return 1
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
