#!/usr/bin/env python3
"""
Whisper Batch Transcription Script
===================================
Transcribes YouTube videos that lack captions using local Whisper model.

This script processes videos from the no_captions_ids list in the YouTube state file,
downloads audio using yt-dlp, transcribes with local Whisper, and updates state.

Features:
- Reads from youtube_state.json no_captions_ids list
- Downloads audio-only (mp3) using yt-dlp
- Transcribes using local Whisper (configurable model size)
- Saves transcripts to data/raw/youtube/transcripts/yt_{video_id}.json
- Updates state: moves from no_captions_ids to processed_ids
- Resume capability: skips already transcribed videos
- Cleans up audio files after transcription
- Progress reporting with time estimates
- Error handling with configurable retry logic

Usage:
    python whisper_batch.py --state-file /path/to/youtube_state.json \
                            --output-dir /path/to/transcripts \
                            --model base \
                            --limit 5

Model sizes (speed/accuracy tradeoff):
    - tiny:   Fastest, least accurate (~1GB VRAM)
    - base:   Good balance, recommended (~1GB VRAM)
    - small:  Better accuracy (~2GB VRAM)
    - medium: High accuracy (~5GB VRAM)
    - large:  Best accuracy, slowest (~10GB VRAM)

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

# Add binary paths for local installations
WHISPER_BIN_PATH = "/Users/matt/Library/Python/3.9/bin"
FFMPEG_BIN_PATH = str(Path.home() / "bin")  # ffmpeg installed here

for bin_path in [WHISPER_BIN_PATH, FFMPEG_BIN_PATH]:
    if bin_path not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{bin_path}:{os.environ.get('PATH', '')}"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("whisper_batch")

# Constants
SCRIPT_VERSION = "1.0.0"
DEFAULT_MODEL = "base"
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0
AUDIO_FORMAT = "mp3"
AUDIO_QUALITY = "5"  # 0=best, 9=worst; 5 is good balance for transcription


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
class TranscriptionResult:
    """Result of transcribing a single video."""

    video_id: str
    success: bool
    transcript_path: Path | None = None
    duration_seconds: float | None = None
    word_count: int | None = None
    error: str | None = None
    processing_time: float | None = None


@dataclass
class BatchStats:
    """Statistics for the batch transcription run."""

    total_queued: int = 0
    processed: int = 0
    skipped: int = 0
    failed: int = 0
    results: list[TranscriptionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)
    total_audio_duration: float = 0.0
    total_processing_time: float = 0.0


class WhisperBatchError(Exception):
    """Base exception for Whisper batch errors."""

    pass


class DependencyNotFoundError(WhisperBatchError):
    """Raised when a required dependency is not found."""

    pass


def check_dependencies() -> dict[str, str]:
    """
    Check that required dependencies are installed.

    Returns:
        Dictionary mapping tool names to their paths.

    Raises:
        DependencyNotFoundError: If a required dependency is missing.
    """
    dependencies = {}

    # Check yt-dlp
    yt_dlp_paths = [
        shutil.which("yt-dlp"),
        "/usr/local/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
        os.path.expanduser("~/.local/bin/yt-dlp"),
    ]

    for path in yt_dlp_paths:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            dependencies["yt-dlp"] = path
            break

    if "yt-dlp" not in dependencies:
        raise DependencyNotFoundError(
            "yt-dlp not found. Install with: pip install yt-dlp or brew install yt-dlp"
        )

    # Check whisper (Python module)
    try:
        import whisper

        dependencies["whisper"] = "python_module"
        logger.debug("Found whisper Python module")
    except ImportError:
        raise DependencyNotFoundError(
            "openai-whisper not found. Install with: pip install openai-whisper"
        )

    return dependencies


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.

    Raises:
        FileNotFoundError: If state file does not exist.
        json.JSONDecodeError: If state file is invalid JSON.
    """
    if not state_file.exists():
        raise FileNotFoundError(f"State file not found: {state_file}")

    with open(state_file, "r", encoding="utf-8") as f:
        state = json.load(f)

    # Ensure required keys exist
    required_keys = ["processed_ids", "failed_ids", "no_captions_ids"]
    for key in required_keys:
        if key not in state:
            state[key] = []

    return state


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


def download_audio(
    video_id: str,
    output_dir: Path,
    yt_dlp_path: str,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> tuple[Path | None, dict[str, Any]]:
    """
    Download audio from a YouTube video.

    Args:
        video_id: YouTube video ID.
        output_dir: Directory to save audio file.
        yt_dlp_path: Path to yt-dlp executable.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries in seconds.

    Returns:
        Tuple of (audio_path, metadata_dict) or (None, {}) on failure.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    output_template = str(output_dir / f"yt_{video_id}.%(ext)s")

    # Get ffmpeg location (installed to ~/bin)
    ffmpeg_dir = Path.home() / "bin"

    args = [
        yt_dlp_path,
        "-x",  # Extract audio
        "--audio-format", AUDIO_FORMAT,
        "--audio-quality", AUDIO_QUALITY,
        "-o", output_template,
        "--no-playlist",
        "--no-warnings",
        "--print-json",  # Get metadata as JSON
        # Use android player client to bypass SABR restrictions
        "--extractor-args", "youtube:player_client=android",
    ]

    # Add ffmpeg location if available
    if ffmpeg_dir.exists() and (ffmpeg_dir / "ffmpeg").exists():
        args.extend(["--ffmpeg-location", str(ffmpeg_dir)])

    args.append(url)

    for attempt in range(retry_count):
        try:
            logger.debug(f"Download attempt {attempt + 1}/{retry_count}")
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode == 0:
                # Parse metadata from JSON output
                metadata = {}
                for line in result.stdout.strip().split("\n"):
                    try:
                        metadata = json.loads(line)
                        break
                    except json.JSONDecodeError:
                        continue

                # Find the downloaded audio file
                audio_path = output_dir / f"yt_{video_id}.{AUDIO_FORMAT}"
                if audio_path.exists():
                    return audio_path, metadata

                # Try to find with different extension
                for ext in ["mp3", "m4a", "webm", "opus"]:
                    alt_path = output_dir / f"yt_{video_id}.{ext}"
                    if alt_path.exists():
                        return alt_path, metadata

            logger.warning(
                f"Download failed (attempt {attempt + 1}): {result.stderr[:200]}"
            )

        except subprocess.TimeoutExpired:
            logger.warning(f"Download timed out (attempt {attempt + 1})")
        except Exception as e:
            logger.warning(f"Download error (attempt {attempt + 1}): {e}")

        if attempt < retry_count - 1:
            time.sleep(retry_delay)

    return None, {}


def transcribe_audio(
    audio_path: Path,
    model_name: str = DEFAULT_MODEL,
    whisper_model: Any = None,
) -> dict[str, Any]:
    """
    Transcribe audio file using local Whisper.

    Args:
        audio_path: Path to audio file.
        model_name: Whisper model size.
        whisper_model: Pre-loaded Whisper model (optional).

    Returns:
        Dictionary with transcription results.
    """
    import whisper

    if whisper_model is None:
        logger.info(f"Loading Whisper model: {model_name}")
        whisper_model = whisper.load_model(model_name)

    logger.debug(f"Transcribing: {audio_path}")
    result = whisper_model.transcribe(str(audio_path), verbose=False)

    return {
        "text": result["text"],
        "language": result["language"],
        "segments": [
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
            }
            for seg in result.get("segments", [])
        ],
    }


def process_video(
    video_id: str,
    output_dir: Path,
    temp_dir: Path,
    yt_dlp_path: str,
    whisper_model: Any,
    model_name: str,
    cleanup_audio: bool = True,
) -> TranscriptionResult:
    """
    Process a single video: download, transcribe, save.

    Args:
        video_id: YouTube video ID.
        output_dir: Directory to save transcript.
        temp_dir: Directory for temporary audio files.
        yt_dlp_path: Path to yt-dlp executable.
        whisper_model: Pre-loaded Whisper model.
        model_name: Name of the Whisper model.
        cleanup_audio: Whether to delete audio after transcription.

    Returns:
        TranscriptionResult with status and paths.
    """
    result = TranscriptionResult(video_id=video_id, success=False)
    start_time = time.time()

    # Download audio
    logger.info(f"  Downloading audio...")
    audio_path, metadata = download_audio(video_id, temp_dir, yt_dlp_path)

    if audio_path is None:
        result.error = "Failed to download audio"
        result.processing_time = time.time() - start_time
        return result

    try:
        # Transcribe
        logger.info(f"  Transcribing with Whisper ({model_name})...")
        transcription = transcribe_audio(audio_path, model_name, whisper_model)

        # Calculate duration from segments
        duration = 0.0
        if transcription.get("segments"):
            duration = transcription["segments"][-1].get("end", 0.0)
        result.duration_seconds = duration

        # Count words
        text = transcription.get("text", "")
        result.word_count = len(text.split())

        # Build transcript data structure matching youtube_extractor format
        transcript_data = {
            "video_id": video_id,
            "title": metadata.get("title", ""),
            "content": text.strip(),
            "upload_date": metadata.get("upload_date"),
            "duration_seconds": metadata.get("duration") or duration,
            "view_count": metadata.get("view_count"),
            "like_count": metadata.get("like_count"),
            "channel_id": metadata.get("channel_id"),
            "channel_name": metadata.get("channel") or metadata.get("uploader"),
            "url": metadata.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
            "description": metadata.get("description", ""),
            "caption_type": "whisper",
            "caption_language": transcription.get("language", "en"),
            "whisper_model": model_name,
            "segments": transcription.get("segments", []),
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "extractor_version": f"whisper_batch/{SCRIPT_VERSION}",
        }

        # Save transcript
        output_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = output_dir / f"yt_{video_id}.json"

        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)

        result.transcript_path = transcript_path
        result.success = True
        logger.info(f"  Saved transcript ({result.word_count} words, {duration:.1f}s)")

    except Exception as e:
        result.error = str(e)
        logger.error(f"  Transcription failed: {e}")

    finally:
        # Cleanup audio file
        if cleanup_audio and audio_path and audio_path.exists():
            try:
                audio_path.unlink()
                logger.debug(f"  Cleaned up audio file")
            except Exception as e:
                logger.warning(f"  Failed to cleanup audio: {e}")

        result.processing_time = time.time() - start_time

    return result


def run_batch(
    state_file: Path,
    output_dir: Path,
    model: str = DEFAULT_MODEL,
    limit: int | None = None,
    skip_existing: bool = True,
    cleanup_audio: bool = True,
    dry_run: bool = False,
) -> BatchStats:
    """
    Run batch transcription for all videos without captions.

    Args:
        state_file: Path to youtube_state.json.
        output_dir: Directory to save transcripts.
        model: Whisper model size.
        limit: Maximum number of videos to process.
        skip_existing: Skip already transcribed videos.
        cleanup_audio: Delete audio files after transcription.
        dry_run: Show what would be done without processing.

    Returns:
        BatchStats with results and statistics.
    """
    stats = BatchStats()

    # Check dependencies
    try:
        deps = check_dependencies()
        yt_dlp_path = deps["yt-dlp"]
        logger.info(f"Using yt-dlp at: {yt_dlp_path}")
    except DependencyNotFoundError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    # Load state
    try:
        state = load_state(state_file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Failed to load state: {e}")
        stats.errors.append({"error": str(e)})
        return stats

    # Get videos to process
    no_captions_ids = state.get("no_captions_ids", [])
    stats.total_queued = len(no_captions_ids)

    if not no_captions_ids:
        logger.info("No videos without captions to process")
        return stats

    # Check for existing transcripts
    videos_to_process = []
    for video_id in no_captions_ids:
        transcript_path = output_dir / f"yt_{video_id}.json"
        if skip_existing and transcript_path.exists():
            logger.debug(f"Skipping already transcribed: {video_id}")
            stats.skipped += 1
            # Move to processed_ids since transcript exists
            if video_id not in state["processed_ids"]:
                state["processed_ids"].append(video_id)
                state["no_captions_ids"].remove(video_id)
        else:
            videos_to_process.append(video_id)

    # Apply limit
    if limit and len(videos_to_process) > limit:
        videos_to_process = videos_to_process[:limit]

    if not videos_to_process:
        logger.info("No new videos to transcribe")
        if stats.skipped > 0:
            save_state(state, state_file)
        return stats

    logger.info(f"Will process {len(videos_to_process)} videos using Whisper {model}")

    if dry_run:
        logger.info("DRY RUN - No processing will be done")
        for vid in videos_to_process:
            print(f"  Would process: {vid}")
        return stats

    # Load Whisper model once
    import whisper

    logger.info(f"Loading Whisper model: {model}")
    whisper_model = whisper.load_model(model)

    # Create temp directory for audio
    with tempfile.TemporaryDirectory(prefix="whisper_batch_") as temp_dir:
        temp_path = Path(temp_dir)

        # Process each video
        for i, video_id in enumerate(videos_to_process):
            logger.info(f"[{i + 1}/{len(videos_to_process)}] Processing: {video_id}")

            result = process_video(
                video_id=video_id,
                output_dir=output_dir,
                temp_dir=temp_path,
                yt_dlp_path=yt_dlp_path,
                whisper_model=whisper_model,
                model_name=model,
                cleanup_audio=cleanup_audio,
            )

            stats.results.append(result)

            if result.success:
                stats.processed += 1
                if result.duration_seconds:
                    stats.total_audio_duration += result.duration_seconds
                if result.processing_time:
                    stats.total_processing_time += result.processing_time

                # Update state: move from no_captions_ids to processed_ids
                if video_id in state["no_captions_ids"]:
                    state["no_captions_ids"].remove(video_id)
                if video_id not in state["processed_ids"]:
                    state["processed_ids"].append(video_id)

            else:
                stats.failed += 1
                stats.errors.append({
                    "video_id": video_id,
                    "error": result.error or "Unknown error",
                })

            # Save state periodically
            if (i + 1) % 3 == 0:
                save_state(state, state_file)

            # Progress estimate
            if i < len(videos_to_process) - 1:
                elapsed = stats.total_processing_time
                avg_time = elapsed / (i + 1) if (i + 1) > 0 else 0
                remaining = len(videos_to_process) - (i + 1)
                eta_seconds = avg_time * remaining
                logger.info(
                    f"  Progress: {i + 1}/{len(videos_to_process)} "
                    f"(~{eta_seconds / 60:.1f} min remaining)"
                )

    # Final state save
    save_state(state, state_file)

    return stats


def print_summary(stats: BatchStats) -> None:
    """Print batch transcription summary."""
    print("\n" + "=" * 60)
    print("WHISPER BATCH TRANSCRIPTION SUMMARY")
    print("=" * 60)
    print(f"Total queued:        {stats.total_queued}")
    print(f"Processed:           {stats.processed}")
    print(f"Skipped (existing):  {stats.skipped}")
    print(f"Failed:              {stats.failed}")

    if stats.total_audio_duration > 0:
        print(f"\nTotal audio:         {stats.total_audio_duration / 60:.1f} minutes")
        print(f"Total processing:    {stats.total_processing_time / 60:.1f} minutes")
        if stats.processed > 0:
            ratio = stats.total_processing_time / stats.total_audio_duration
            print(f"Processing ratio:    {ratio:.1f}x realtime")

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
    """Main entry point for Whisper batch CLI."""
    parser = argparse.ArgumentParser(
        description="Batch transcribe YouTube videos without captions using Whisper.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process up to 5 videos with base model
  python whisper_batch.py --state-file data/state/youtube_state.json --limit 5

  # Use small model for better accuracy
  python whisper_batch.py --state-file data/state/youtube_state.json --model small

  # Dry run to see what would be processed
  python whisper_batch.py --state-file data/state/youtube_state.json --dry-run

Model Sizes (speed/accuracy tradeoff):
  tiny    Fastest, least accurate
  base    Good balance (recommended)
  small   Better accuracy
  medium  High accuracy
  large   Best accuracy, slowest
        """,
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        required=True,
        help="Path to youtube_state.json file",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory for transcripts (default: data/raw/youtube/transcripts relative to state file)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        choices=["tiny", "base", "small", "medium", "large"],
        help=f"Whisper model size (default: {DEFAULT_MODEL})",
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
        help="Skip already transcribed videos (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-transcribe all videos",
    )

    parser.add_argument(
        "--keep-audio",
        action="store_true",
        help="Keep audio files after transcription (default: delete)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without doing it",
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
    state_file = args.state_file.resolve()

    if args.output_dir:
        output_dir = args.output_dir.resolve()
    else:
        # Default: data/raw/youtube/transcripts relative to state file's data directory
        # state_file: .../data/state/youtube_state.json
        # output_dir: .../data/raw/youtube/transcripts
        data_dir = state_file.parent.parent
        output_dir = data_dir / "raw" / "youtube" / "transcripts"

    logger.info(f"State file: {state_file}")
    logger.info(f"Output dir: {output_dir}")

    # Run batch transcription
    try:
        stats = run_batch(
            state_file=state_file,
            output_dir=output_dir,
            model=args.model,
            limit=args.limit,
            skip_existing=args.skip_existing,
            cleanup_audio=not args.keep_audio,
            dry_run=args.dry_run,
        )
    except KeyboardInterrupt:
        logger.info("Transcription interrupted by user")
        return 130
    except Exception as e:
        logger.exception(f"Batch transcription failed: {e}")
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
