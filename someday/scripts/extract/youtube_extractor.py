#!/usr/bin/env python3
"""
YouTube Channel Extractor
=========================
Extracts video metadata and auto-generated captions from YouTube channels using yt-dlp.

Features:
- Fetches video list with metadata (title, date, duration, view count)
- Downloads auto-generated captions (VTT/SRT format)
- Parses and cleans caption text (removes timestamps, deduplicates lines)
- Incremental extraction with state persistence
- Rate limiting to avoid throttling
- Comprehensive error handling with retry logic
- Progress reporting and logging

Output Structure:
- Raw captions: data/raw/youtube/captions/yt_{video_id}.vtt
- Metadata: data/raw/youtube/metadata/yt_{video_id}_meta.json
- Combined transcript JSON for normalization pipeline

Usage:
    python youtube_extractor.py --channel "@dealmakerseta" \\
                                --output-dir /path/to/data/raw/youtube \\
                                --state-file /path/to/data/state/youtube_state.json \\
                                --limit 10 \\
                                --skip-existing

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("youtube_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_RATE_LIMIT_DELAY = 2.0  # seconds between videos
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds between retries
CAPTION_LANGUAGES = ["en", "en-US", "en-GB"]  # Priority order for caption languages

# Caption cleaning patterns
CAPTION_MARKER_PATTERNS = [
    r"\[Music\]",
    r"\[Applause\]",
    r"\[Laughter\]",
    r"\[Cheering\]",
    r"\[Silence\]",
    r"\[Background noise\]",
    r"\[Inaudible\]",
    r"\[.*?\]",  # Catch-all for other bracketed markers
]

# VTT/SRT timestamp patterns
VTT_TIMESTAMP_PATTERN = r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*$"
SRT_TIMESTAMP_PATTERN = r"^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$"
VTT_HEADER_PATTERN = r"^WEBVTT.*$"
VTT_KIND_PATTERN = r"^Kind:\s*.*$"
VTT_LANGUAGE_PATTERN = r"^Language:\s*.*$"
SEQUENCE_NUMBER_PATTERN = r"^\d+$"


class VideoMetadata(TypedDict, total=False):
    """Type definition for video metadata."""

    video_id: str
    title: str
    description: str
    upload_date: str
    duration_seconds: int
    view_count: int
    like_count: int
    channel_id: str
    channel_name: str
    url: str
    thumbnail_url: str
    caption_available: bool
    caption_type: str
    caption_language: str


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_ids: list[str]
    failed_ids: list[str]
    pending_ids: list[str]
    no_captions_ids: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single video."""

    video_id: str
    success: bool
    has_captions: bool
    metadata_path: Path | None = None
    caption_path: Path | None = None
    transcript_path: Path | None = None
    error: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_discovered: int = 0
    processed: int = 0
    skipped: int = 0
    failed: int = 0
    no_captions: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class YouTubeExtractorError(Exception):
    """Base exception for YouTube extractor errors."""

    pass


class YtDlpNotFoundError(YouTubeExtractorError):
    """Raised when yt-dlp is not installed or not found."""

    pass


class ChannelFetchError(YouTubeExtractorError):
    """Raised when channel video list cannot be fetched."""

    pass


class CaptionFetchError(YouTubeExtractorError):
    """Raised when captions cannot be fetched."""

    pass


def check_yt_dlp_installed() -> str:
    """
    Check if yt-dlp is installed and return its path.

    Returns:
        Path to yt-dlp executable.

    Raises:
        YtDlpNotFoundError: If yt-dlp is not found.
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

    raise YtDlpNotFoundError(
        "yt-dlp not found. Install it with: pip install yt-dlp or brew install yt-dlp"
    )


def run_yt_dlp(
    args: list[str],
    timeout: int = 300,
    yt_dlp_path: str | None = None,
) -> tuple[int, str, str]:
    """
    Run yt-dlp with the given arguments.

    Args:
        args: Command-line arguments for yt-dlp.
        timeout: Maximum execution time in seconds.
        yt_dlp_path: Path to yt-dlp executable.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    if yt_dlp_path is None:
        yt_dlp_path = check_yt_dlp_installed()

    cmd = [yt_dlp_path] + args
    logger.debug(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired as e:
        logger.warning(f"yt-dlp timed out after {timeout}s")
        return 1, "", f"Timeout after {timeout}s"
    except Exception as e:
        logger.error(f"Error running yt-dlp: {e}")
        return 1, "", str(e)


def fetch_channel_videos(
    channel: str,
    limit: int | None = None,
    yt_dlp_path: str | None = None,
) -> list[VideoMetadata]:
    """
    Fetch list of videos from a YouTube channel.

    Args:
        channel: Channel handle (e.g., "@dealmakerseta") or URL.
        limit: Maximum number of videos to fetch.
        yt_dlp_path: Path to yt-dlp executable.

    Returns:
        List of video metadata dictionaries.

    Raises:
        ChannelFetchError: If channel videos cannot be fetched.
    """
    # Build channel URL
    if channel.startswith("@"):
        channel_url = f"https://www.youtube.com/{channel}/videos"
    elif channel.startswith("http"):
        channel_url = channel
    else:
        channel_url = f"https://www.youtube.com/channel/{channel}/videos"

    args = [
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--ignore-errors",
        channel_url,
    ]

    if limit:
        args.extend(["--playlist-end", str(limit)])

    returncode, stdout, stderr = run_yt_dlp(args, timeout=120, yt_dlp_path=yt_dlp_path)

    if returncode != 0 and not stdout.strip():
        raise ChannelFetchError(f"Failed to fetch channel videos: {stderr}")

    videos: list[VideoMetadata] = []
    for line in stdout.strip().split("\n"):
        if not line.strip():
            continue
        try:
            data = json.loads(line)
            video: VideoMetadata = {
                "video_id": data.get("id", ""),
                "title": data.get("title", ""),
                "url": data.get("url") or f"https://www.youtube.com/watch?v={data.get('id', '')}",
                "duration_seconds": data.get("duration"),
                "view_count": data.get("view_count"),
                "upload_date": data.get("upload_date"),
                "channel_id": data.get("channel_id"),
                "channel_name": data.get("channel") or data.get("uploader"),
            }
            if video["video_id"]:
                videos.append(video)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse video entry: {e}")
            continue

    logger.info(f"Discovered {len(videos)} videos from channel")
    return videos


def fetch_video_metadata(
    video_id: str,
    yt_dlp_path: str | None = None,
) -> VideoMetadata:
    """
    Fetch detailed metadata for a single video.

    Args:
        video_id: YouTube video ID.
        yt_dlp_path: Path to yt-dlp executable.

    Returns:
        Video metadata dictionary.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    args = [
        "--dump-json",
        "--no-download",
        "--no-warnings",
        url,
    ]

    returncode, stdout, stderr = run_yt_dlp(args, timeout=60, yt_dlp_path=yt_dlp_path)

    if returncode != 0:
        logger.warning(f"Failed to fetch metadata for {video_id}: {stderr}")
        return {"video_id": video_id}

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse metadata JSON for {video_id}")
        return {"video_id": video_id}

    # Check for available captions
    subtitles = data.get("subtitles", {})
    automatic_captions = data.get("automatic_captions", {})

    caption_available = False
    caption_type = "none"
    caption_language = ""

    # Check for manual subtitles first
    for lang in CAPTION_LANGUAGES:
        if lang in subtitles:
            caption_available = True
            caption_type = "manual"
            caption_language = lang
            break

    # Fall back to auto-generated
    if not caption_available:
        for lang in CAPTION_LANGUAGES:
            if lang in automatic_captions:
                caption_available = True
                caption_type = "auto"
                caption_language = lang
                break

    return {
        "video_id": video_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "upload_date": data.get("upload_date"),
        "duration_seconds": data.get("duration"),
        "view_count": data.get("view_count"),
        "like_count": data.get("like_count"),
        "channel_id": data.get("channel_id"),
        "channel_name": data.get("channel") or data.get("uploader"),
        "url": data.get("webpage_url") or url,
        "thumbnail_url": data.get("thumbnail"),
        "caption_available": caption_available,
        "caption_type": caption_type,
        "caption_language": caption_language,
    }


def download_captions(
    video_id: str,
    output_dir: Path,
    yt_dlp_path: str | None = None,
) -> Path | None:
    """
    Download captions for a video.

    Args:
        video_id: YouTube video ID.
        output_dir: Directory to save captions.
        yt_dlp_path: Path to yt-dlp executable.

    Returns:
        Path to downloaded caption file, or None if no captions available.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    output_template = str(output_dir / f"yt_{video_id}")

    # Try auto-generated captions first (more common), then manual
    for sub_type in ["--write-auto-subs", "--write-subs"]:
        args = [
            sub_type,
            "--sub-lang", ",".join(CAPTION_LANGUAGES),
            "--sub-format", "vtt/srt/best",
            "--skip-download",
            "--no-warnings",
            "-o", output_template,
            url,
        ]

        returncode, stdout, stderr = run_yt_dlp(args, timeout=120, yt_dlp_path=yt_dlp_path)

        # Check for downloaded files
        for lang in CAPTION_LANGUAGES:
            for ext in [".vtt", ".srt"]:
                caption_path = Path(f"{output_template}.{lang}{ext}")
                if caption_path.exists():
                    logger.debug(f"Downloaded captions to {caption_path}")
                    return caption_path

    return None


def clean_caption_text(raw_text: str) -> str:
    """
    Clean and normalize caption text.

    Operations:
    - Remove VTT/SRT timestamps and headers
    - Remove sequence numbers
    - Deduplicate consecutive identical lines (auto-caption artifact)
    - Remove [Music], [Applause], and similar markers
    - Normalize whitespace

    Args:
        raw_text: Raw caption file content.

    Returns:
        Cleaned transcript text.
    """
    if not raw_text:
        return ""

    lines = raw_text.split("\n")
    cleaned_lines: list[str] = []
    prev_line = ""

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip VTT header and metadata lines
        if re.match(VTT_HEADER_PATTERN, line, re.IGNORECASE):
            continue
        if re.match(VTT_KIND_PATTERN, line, re.IGNORECASE):
            continue
        if re.match(VTT_LANGUAGE_PATTERN, line, re.IGNORECASE):
            continue

        # Skip timestamp lines
        if re.match(VTT_TIMESTAMP_PATTERN, line) or re.match(SRT_TIMESTAMP_PATTERN, line):
            continue

        # Skip sequence numbers
        if re.match(SEQUENCE_NUMBER_PATTERN, line):
            continue

        # Skip position/style tags (VTT format)
        if line.startswith("STYLE") or line.startswith("NOTE") or "::" in line:
            continue

        # Remove VTT cue settings (position, align, etc.)
        line = re.sub(r"<\d{2}:\d{2}:\d{2}\.\d{3}>", "", line)
        line = re.sub(r"</?c>", "", line)
        line = re.sub(r"<[^>]+>", "", line)  # Remove any remaining tags

        # Remove caption markers
        for pattern in CAPTION_MARKER_PATTERNS:
            line = re.sub(pattern, "", line, flags=re.IGNORECASE)

        # Clean up whitespace
        line = re.sub(r"\s+", " ", line).strip()

        # Skip if line became empty
        if not line:
            continue

        # Deduplicate consecutive identical lines (common in auto-captions)
        if line.lower() == prev_line.lower():
            continue

        cleaned_lines.append(line)
        prev_line = line

    # Join lines into paragraphs
    text = " ".join(cleaned_lines)

    # Final cleanup
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([.,!?;:])", r"\1", text)  # Fix punctuation spacing

    return text.strip()


def parse_caption_file(caption_path: Path) -> str:
    """
    Parse a caption file and extract cleaned text.

    Args:
        caption_path: Path to the caption file.

    Returns:
        Cleaned transcript text.
    """
    try:
        with open(caption_path, "r", encoding="utf-8") as f:
            raw_content = f.read()
    except Exception as e:
        logger.error(f"Failed to read caption file {caption_path}: {e}")
        return ""

    return clean_caption_text(raw_content)


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "youtube",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_ids": [],
        "failed_ids": [],
        "pending_ids": [],
        "no_captions_ids": [],
        "metadata": {
            "channel_id": None,
            "playlist_ids": [],
            "extraction_method": "yt-dlp",
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
            # Ensure no_captions_ids exists (for backward compatibility)
            if "no_captions_ids" not in state:
                state["no_captions_ids"] = []
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


def extract_video(
    video: VideoMetadata,
    output_dir: Path,
    yt_dlp_path: str | None = None,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> ExtractionResult:
    """
    Extract metadata and captions for a single video.

    Args:
        video: Basic video metadata.
        output_dir: Base output directory.
        yt_dlp_path: Path to yt-dlp executable.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries in seconds.

    Returns:
        ExtractionResult with paths and status.
    """
    video_id = video["video_id"]
    result = ExtractionResult(video_id=video_id, success=False, has_captions=False)

    # Create output directories
    captions_dir = output_dir / "captions"
    metadata_dir = output_dir / "metadata"
    transcripts_dir = output_dir / "transcripts"

    captions_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)
    transcripts_dir.mkdir(parents=True, exist_ok=True)

    # Fetch detailed metadata with retries
    for attempt in range(retry_count):
        try:
            detailed_meta = fetch_video_metadata(video_id, yt_dlp_path)
            break
        except Exception as e:
            if attempt < retry_count - 1:
                logger.warning(f"Retry {attempt + 1}/{retry_count} for metadata: {e}")
                time.sleep(retry_delay)
            else:
                result.error = f"Failed to fetch metadata: {e}"
                return result

    # Save metadata
    metadata_path = metadata_dir / f"yt_{video_id}_meta.json"
    try:
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(detailed_meta, f, indent=2, ensure_ascii=False)
        result.metadata_path = metadata_path
    except Exception as e:
        logger.error(f"Failed to save metadata for {video_id}: {e}")
        result.error = f"Failed to save metadata: {e}"
        return result

    # Check if captions are available
    if not detailed_meta.get("caption_available", False):
        logger.info(f"No captions available for {video_id} (logged for Whisper fallback)")
        result.success = True
        result.has_captions = False
        return result

    # Download captions with retries
    caption_path: Path | None = None
    for attempt in range(retry_count):
        try:
            caption_path = download_captions(video_id, captions_dir, yt_dlp_path)
            if caption_path:
                break
        except Exception as e:
            if attempt < retry_count - 1:
                logger.warning(f"Retry {attempt + 1}/{retry_count} for captions: {e}")
                time.sleep(retry_delay)

    if not caption_path or not caption_path.exists():
        logger.warning(f"Could not download captions for {video_id}")
        result.success = True
        result.has_captions = False
        return result

    result.caption_path = caption_path
    result.has_captions = True

    # Parse and clean captions
    transcript_text = parse_caption_file(caption_path)

    if not transcript_text:
        logger.warning(f"Empty transcript after cleaning for {video_id}")
        result.success = True
        return result

    # Create combined transcript JSON for normalization pipeline
    transcript_data = {
        "video_id": video_id,
        "title": detailed_meta.get("title", ""),
        "content": transcript_text,
        "upload_date": detailed_meta.get("upload_date"),
        "duration_seconds": detailed_meta.get("duration_seconds"),
        "view_count": detailed_meta.get("view_count"),
        "like_count": detailed_meta.get("like_count"),
        "channel_id": detailed_meta.get("channel_id"),
        "channel_name": detailed_meta.get("channel_name"),
        "url": detailed_meta.get("url"),
        "description": detailed_meta.get("description", ""),
        "caption_type": detailed_meta.get("caption_type", "auto"),
        "caption_language": detailed_meta.get("caption_language", "en"),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }

    transcript_path = transcripts_dir / f"yt_{video_id}.json"
    try:
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        result.transcript_path = transcript_path
    except Exception as e:
        logger.error(f"Failed to save transcript for {video_id}: {e}")
        result.error = f"Failed to save transcript: {e}"
        return result

    result.success = True
    return result


def run_extraction(
    channel: str,
    output_dir: Path,
    state_file: Path,
    limit: int | None = None,
    skip_existing: bool = True,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the full extraction process for a channel.

    Args:
        channel: Channel handle or URL.
        output_dir: Base output directory.
        state_file: Path to state file.
        limit: Maximum number of videos to process.
        skip_existing: Skip already processed videos.
        rate_limit_delay: Delay between videos in seconds.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Check yt-dlp installation
    try:
        yt_dlp_path = check_yt_dlp_installed()
        logger.info(f"Using yt-dlp at: {yt_dlp_path}")
    except YtDlpNotFoundError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    # Load state
    state = load_state(state_file)

    # Fetch channel videos
    try:
        videos = fetch_channel_videos(channel, limit, yt_dlp_path)
    except ChannelFetchError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    stats.total_discovered = len(videos)

    if not videos:
        logger.warning("No videos found for channel")
        return stats

    # Filter videos based on state
    processed_set = set(state["processed_ids"])
    failed_set = set(state["failed_ids"])
    no_captions_set = set(state.get("no_captions_ids", []))

    videos_to_process: list[VideoMetadata] = []
    for video in videos:
        video_id = video["video_id"]
        if skip_existing and video_id in processed_set:
            logger.debug(f"Skipping already processed: {video_id}")
            stats.skipped += 1
            continue
        if skip_existing and video_id in no_captions_set:
            logger.debug(f"Skipping (no captions): {video_id}")
            stats.skipped += 1
            continue
        videos_to_process.append(video)

    if not videos_to_process:
        logger.info("No new videos to process")
        return stats

    logger.info(f"Processing {len(videos_to_process)} videos...")

    # Process each video
    for i, video in enumerate(videos_to_process):
        video_id = video["video_id"]
        logger.info(f"[{i + 1}/{len(videos_to_process)}] Processing: {video_id} - {video.get('title', 'Unknown')[:50]}")

        result = extract_video(video, output_dir, yt_dlp_path)
        stats.results.append(result)

        if result.success:
            if result.has_captions:
                state["processed_ids"].append(video_id)
                stats.processed += 1
                logger.info(f"  Successfully extracted with captions")
            else:
                state["no_captions_ids"].append(video_id)
                stats.no_captions += 1
                logger.info(f"  No captions available (logged for Whisper fallback)")

            # Remove from failed if previously failed
            if video_id in state["failed_ids"]:
                state["failed_ids"].remove(video_id)
        else:
            if video_id not in state["failed_ids"]:
                state["failed_ids"].append(video_id)
            stats.failed += 1
            stats.errors.append({"video_id": video_id, "error": result.error or "Unknown error"})
            logger.error(f"  Failed: {result.error}")

        # Save state periodically
        if (i + 1) % 5 == 0:
            save_state(state, state_file)

        # Rate limiting
        if i < len(videos_to_process) - 1:
            time.sleep(rate_limit_delay)

    # Final state save
    save_state(state, state_file)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("YOUTUBE EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total discovered:    {stats.total_discovered}")
    print(f"Processed:           {stats.processed}")
    print(f"No captions:         {stats.no_captions}")
    print(f"Skipped (existing):  {stats.skipped}")
    print(f"Failed:              {stats.failed}")

    if stats.no_captions > 0:
        print(f"\nVideos without captions have been logged for Whisper fallback processing.")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            if "video_id" in err:
                print(f"  [{err['video_id']}] {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the YouTube extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract video metadata and captions from YouTube channels using yt-dlp.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python youtube_extractor.py --channel "@dealmakerseta" --limit 10
  python youtube_extractor.py --channel "@dealmakerseta" --output-dir ./data/raw/youtube
  python youtube_extractor.py --channel "UCxxxxxxxx" --skip-existing --verbose

Output Structure:
  {output-dir}/captions/yt_{video_id}.vtt     - Raw caption files
  {output-dir}/metadata/yt_{video_id}_meta.json - Video metadata
  {output-dir}/transcripts/yt_{video_id}.json  - Combined transcript for normalization

Videos without captions are logged in the state file for Whisper fallback processing.
        """,
    )

    parser.add_argument(
        "--channel",
        type=str,
        required=True,
        help="YouTube channel handle (e.g., @dealmakerseta) or channel URL",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/youtube"),
        help="Output directory for extracted content (default: data/raw/youtube)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/youtube_state.json"),
        help="State file for tracking processed videos (default: data/state/youtube_state.json)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of videos to process (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed videos (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all videos, ignoring state",
    )

    parser.add_argument(
        "--rate-limit",
        type=float,
        default=DEFAULT_RATE_LIMIT_DELAY,
        help=f"Delay between videos in seconds (default: {DEFAULT_RATE_LIMIT_DELAY})",
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
            channel=args.channel,
            output_dir=output_dir,
            state_file=state_file,
            limit=args.limit,
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
