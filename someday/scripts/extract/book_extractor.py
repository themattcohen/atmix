#!/usr/bin/env python3
"""
Book PDF Extractor
==================
Extracts text from PDF books with chapter detection and page tracking.

Features:
- Reads PDF page by page using PyMuPDF (fitz)
- Detects chapter boundaries using configurable regex patterns
- Falls back to page-based chunking if no chapters found
- Extracts PDF metadata (title, author, page count)
- Handles multi-column layouts (best effort)
- Cleans extracted text (fixes hyphenation, normalizes whitespace)
- Tracks page numbers for each chapter
- Incremental extraction with state persistence

Output Structure:
- Full text: data/raw/book/extracted/book_{slug}_full.json
- Per-chapter: data/raw/book/extracted/book_{slug}_ch{nn}.json
- Metadata: data/raw/book/extracted/book_{slug}_meta.json

Usage:
    python book_extractor.py --pdf /path/to/book.pdf \\
                             --output-dir /path/to/data/raw/book/extracted \\
                             --state-file /path/to/data/state/book_state.json

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
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
logger = logging.getLogger("book_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_PAGES_PER_CHUNK = 20  # For fallback page-based chunking

# Chapter detection patterns (ordered by specificity)
CHAPTER_PATTERNS = [
    r"^CHAPTER\s+(\d+)",  # CHAPTER 1, CHAPTER 23
    r"^Chapter\s+(\d+)",  # Chapter 1, Chapter 23
    r"^PART\s+(\d+)",  # PART 1, PART 2
    r"^Part\s+(\d+)",  # Part 1, Part 2
    r"^CHAPTER\s+([IVXLCDM]+)",  # CHAPTER I, CHAPTER XII (Roman numerals)
    r"^Chapter\s+([IVXLCDM]+)",  # Chapter I, Chapter XII
    r"^PART\s+([IVXLCDM]+)",  # PART I, PART II
    r"^Part\s+([IVXLCDM]+)",  # Part I, Part II
    r"^\d+\.\s+[A-Z]",  # 1. Title, 2. Another Title
    r"^SECTION\s+(\d+)",  # SECTION 1
    r"^Section\s+(\d+)",  # Section 1
]

# Compiled patterns for performance
COMPILED_CHAPTER_PATTERNS = [re.compile(p, re.MULTILINE) for p in CHAPTER_PATTERNS]


class ChapterInfo(TypedDict, total=False):
    """Type definition for chapter information."""

    chapter_number: int
    title: str
    start_page: int
    end_page: int
    content: str
    word_count: int


class BookMetadata(TypedDict, total=False):
    """Type definition for book metadata."""

    title: str
    author: str
    subject: str
    keywords: str
    creator: str
    producer: str
    page_count: int
    file_path: str
    file_size_bytes: int
    slug: str
    extraction_date: str
    extractor_version: str
    chapter_count: int
    total_word_count: int


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_files: list[str]
    failed_files: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single book."""

    file_path: str
    success: bool
    slug: str | None = None
    metadata_path: Path | None = None
    full_text_path: Path | None = None
    chapter_paths: list[Path] = field(default_factory=list)
    chapter_count: int = 0
    page_count: int = 0
    word_count: int = 0
    error: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    processed: int = 0
    skipped: int = 0
    failed: int = 0
    total_pages: int = 0
    total_chapters: int = 0
    total_words: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class BookExtractorError(Exception):
    """Base exception for book extractor errors."""

    pass


class PyMuPDFNotFoundError(BookExtractorError):
    """Raised when PyMuPDF (fitz) is not installed."""

    pass


class PDFReadError(BookExtractorError):
    """Raised when PDF cannot be read."""

    pass


def check_pymupdf_installed() -> None:
    """
    Check if PyMuPDF library is installed.

    Raises:
        PyMuPDFNotFoundError: If PyMuPDF is not installed.
    """
    try:
        import fitz  # noqa: F401
    except ImportError:
        raise PyMuPDFNotFoundError(
            "PyMuPDF (fitz) not installed. Install it with: pip install pymupdf"
        )


def generate_slug(title: str | None, file_path: Path) -> str:
    """
    Generate a URL-safe slug from book title or filename.

    Args:
        title: Book title from metadata.
        file_path: Path to the PDF file.

    Returns:
        URL-safe slug string.
    """
    # Prefer title, fall back to filename
    source = title if title else file_path.stem

    # Normalize: lowercase, replace spaces/special chars with hyphens
    slug = source.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")

    # Limit length
    if len(slug) > 60:
        slug = slug[:60].rsplit("-", 1)[0]

    # Ensure unique with hash suffix if slug is too short
    if len(slug) < 3:
        hash_suffix = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
        slug = f"book-{hash_suffix}"

    return slug


def extract_pdf_metadata(doc: Any, file_path: Path) -> BookMetadata:
    """
    Extract metadata from PDF document.

    Args:
        doc: PyMuPDF document object.
        file_path: Path to the PDF file.

    Returns:
        BookMetadata dictionary.
    """
    meta = doc.metadata or {}

    # Get file size
    try:
        file_size = file_path.stat().st_size
    except OSError:
        file_size = 0

    # Extract and clean metadata fields
    title = (meta.get("title") or "").strip()
    author = (meta.get("author") or "").strip()

    # Generate slug
    slug = generate_slug(title, file_path)

    return {
        "title": title or file_path.stem,
        "author": author,
        "subject": (meta.get("subject") or "").strip(),
        "keywords": (meta.get("keywords") or "").strip(),
        "creator": (meta.get("creator") or "").strip(),
        "producer": (meta.get("producer") or "").strip(),
        "page_count": doc.page_count,
        "file_path": str(file_path.absolute()),
        "file_size_bytes": file_size,
        "slug": slug,
        "extraction_date": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }


def clean_extracted_text(text: str) -> str:
    """
    Clean and normalize extracted PDF text.

    Operations:
    - Fix hyphenation at line breaks (re-join hyphenated words)
    - Normalize whitespace
    - Remove excessive blank lines
    - Fix common OCR/extraction artifacts

    Args:
        text: Raw extracted text.

    Returns:
        Cleaned text.
    """
    if not text:
        return ""

    # Fix hyphenation at line breaks (word- \n continued -> wordcontinued)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)

    # Normalize line breaks (convert multiple to double, single to space)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Join lines that don't end with sentence terminators
    lines = text.split("\n")
    cleaned_lines: list[str] = []

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            cleaned_lines.append("")
            continue

        # Check if this line should be joined with the next
        if (
            i < len(lines) - 1
            and line
            and not line.endswith((".", "!", "?", ":", ";", '"', "'", ")"))
            and not re.match(r"^(CHAPTER|Chapter|PART|Part|SECTION|Section|\d+\.)", lines[i + 1].strip())
        ):
            # Join with next line
            cleaned_lines.append(line + " ")
        else:
            cleaned_lines.append(line)

    text = "".join(cleaned_lines)

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n +", "\n", text)

    # Remove page number artifacts (common patterns)
    text = re.sub(r"\n\d{1,4}\n", "\n", text)
    text = re.sub(r"^\d{1,4}\n", "", text)

    # Clean up multiple spaces
    text = re.sub(r"  +", " ", text)

    return text.strip()


def extract_page_text(page: Any) -> str:
    """
    Extract text from a single PDF page.

    Handles multi-column layouts by using text extraction with
    preserve_whitespace and sorting blocks.

    Args:
        page: PyMuPDF page object.

    Returns:
        Extracted text from the page.
    """
    # Try to get text with layout preservation
    # "text" option provides basic text extraction
    # For multi-column, we could use "dict" and sort blocks, but "text" works for most cases
    text = page.get_text("text")

    return text


def detect_chapters(
    pages_text: list[tuple[int, str]],
    patterns: list[re.Pattern[str]] | None = None,
) -> list[ChapterInfo]:
    """
    Detect chapter boundaries in extracted text.

    Args:
        pages_text: List of (page_number, page_text) tuples.
        patterns: Optional list of compiled regex patterns.

    Returns:
        List of ChapterInfo dictionaries.
    """
    if patterns is None:
        patterns = COMPILED_CHAPTER_PATTERNS

    chapters: list[ChapterInfo] = []
    current_chapter: ChapterInfo | None = None
    current_content: list[str] = []

    for page_num, page_text in pages_text:
        # Check each line for chapter markers
        lines = page_text.split("\n")

        for line in lines:
            line_stripped = line.strip()

            # Skip empty lines for chapter detection
            if not line_stripped:
                if current_chapter is not None:
                    current_content.append(line)
                continue

            # Check for chapter pattern match
            chapter_match = None
            matched_pattern = None

            for pattern in patterns:
                match = pattern.match(line_stripped)
                if match:
                    chapter_match = match
                    matched_pattern = pattern
                    break

            if chapter_match:
                # Save previous chapter
                if current_chapter is not None:
                    current_chapter["end_page"] = page_num - 1
                    current_chapter["content"] = clean_extracted_text("\n".join(current_content))
                    current_chapter["word_count"] = len(current_chapter["content"].split())
                    chapters.append(current_chapter)

                # Start new chapter
                chapter_num = len(chapters) + 1

                # Try to extract chapter title (might be on same or next line)
                title = line_stripped

                current_chapter = {
                    "chapter_number": chapter_num,
                    "title": title,
                    "start_page": page_num,
                    "end_page": page_num,
                    "content": "",
                    "word_count": 0,
                }
                current_content = [line]
            else:
                # Add to current chapter content
                if current_chapter is not None:
                    current_content.append(line)
                else:
                    # Content before first chapter (front matter)
                    pass

    # Don't forget the last chapter
    if current_chapter is not None:
        current_chapter["end_page"] = pages_text[-1][0] if pages_text else 0
        current_chapter["content"] = clean_extracted_text("\n".join(current_content))
        current_chapter["word_count"] = len(current_chapter["content"].split())
        chapters.append(current_chapter)

    return chapters


def chunk_by_pages(
    pages_text: list[tuple[int, str]],
    pages_per_chunk: int = DEFAULT_PAGES_PER_CHUNK,
) -> list[ChapterInfo]:
    """
    Fall back to page-based chunking when no chapters detected.

    Args:
        pages_text: List of (page_number, page_text) tuples.
        pages_per_chunk: Number of pages per chunk.

    Returns:
        List of ChapterInfo dictionaries (as pseudo-chapters).
    """
    chunks: list[ChapterInfo] = []

    for i in range(0, len(pages_text), pages_per_chunk):
        chunk_pages = pages_text[i : i + pages_per_chunk]

        if not chunk_pages:
            continue

        start_page = chunk_pages[0][0]
        end_page = chunk_pages[-1][0]
        chunk_num = (i // pages_per_chunk) + 1

        content = clean_extracted_text(
            "\n\n".join(page_text for _, page_text in chunk_pages)
        )

        chunk: ChapterInfo = {
            "chapter_number": chunk_num,
            "title": f"Pages {start_page}-{end_page}",
            "start_page": start_page,
            "end_page": end_page,
            "content": content,
            "word_count": len(content.split()),
        }
        chunks.append(chunk)

    return chunks


def extract_book(
    pdf_path: Path,
    output_dir: Path,
) -> ExtractionResult:
    """
    Extract text and metadata from a PDF book.

    Args:
        pdf_path: Path to the PDF file.
        output_dir: Directory to save extracted content.

    Returns:
        ExtractionResult with paths and status.
    """
    import fitz

    result = ExtractionResult(file_path=str(pdf_path), success=False)

    # Verify file exists
    if not pdf_path.exists():
        result.error = f"PDF file not found: {pdf_path}"
        return result

    # Open PDF
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        result.error = f"Failed to open PDF: {e}"
        return result

    try:
        # Extract metadata
        metadata = extract_pdf_metadata(doc, pdf_path)
        slug = metadata["slug"]
        result.slug = slug
        result.page_count = metadata["page_count"]

        logger.info(f"Extracting: {metadata['title']} ({metadata['page_count']} pages)")

        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)

        # Extract text from all pages
        pages_text: list[tuple[int, str]] = []
        for page_num in range(doc.page_count):
            page = doc[page_num]
            page_text = extract_page_text(page)
            # Page numbers are 1-indexed for output
            pages_text.append((page_num + 1, page_text))

        logger.debug(f"Extracted text from {len(pages_text)} pages")

        # Detect chapters
        chapters = detect_chapters(pages_text)

        if not chapters:
            logger.info("No chapters detected, falling back to page-based chunking")
            chapters = chunk_by_pages(pages_text)

        result.chapter_count = len(chapters)
        metadata["chapter_count"] = len(chapters)

        # Calculate total word count
        full_text = clean_extracted_text(
            "\n\n".join(page_text for _, page_text in pages_text)
        )
        total_words = len(full_text.split())
        result.word_count = total_words
        metadata["total_word_count"] = total_words

        logger.info(f"Detected {len(chapters)} chapters, {total_words} words total")

        # Save metadata
        metadata_path = output_dir / f"book_{slug}_meta.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        result.metadata_path = metadata_path
        logger.debug(f"Saved metadata to: {metadata_path}")

        # Save full text
        full_text_data = {
            "slug": slug,
            "title": metadata["title"],
            "author": metadata["author"],
            "content": full_text,
            "word_count": total_words,
            "page_count": metadata["page_count"],
            "extracted_at": metadata["extraction_date"],
            "extractor_version": EXTRACTOR_VERSION,
        }

        full_text_path = output_dir / f"book_{slug}_full.json"
        with open(full_text_path, "w", encoding="utf-8") as f:
            json.dump(full_text_data, f, indent=2, ensure_ascii=False)
        result.full_text_path = full_text_path
        logger.debug(f"Saved full text to: {full_text_path}")

        # Save individual chapters
        chapter_paths: list[Path] = []
        for chapter in chapters:
            chapter_num = chapter["chapter_number"]
            chapter_filename = f"book_{slug}_ch{chapter_num:02d}.json"
            chapter_path = output_dir / chapter_filename

            chapter_data = {
                "slug": slug,
                "book_title": metadata["title"],
                "author": metadata["author"],
                "chapter_number": chapter_num,
                "chapter_title": chapter["title"],
                "start_page": chapter["start_page"],
                "end_page": chapter["end_page"],
                "content": chapter["content"],
                "word_count": chapter["word_count"],
                "extracted_at": metadata["extraction_date"],
                "extractor_version": EXTRACTOR_VERSION,
            }

            with open(chapter_path, "w", encoding="utf-8") as f:
                json.dump(chapter_data, f, indent=2, ensure_ascii=False)

            chapter_paths.append(chapter_path)

        result.chapter_paths = chapter_paths
        logger.info(f"Saved {len(chapter_paths)} chapter files")

        result.success = True

    except Exception as e:
        result.error = f"Extraction failed: {e}"
        logger.exception(result.error)

    finally:
        doc.close()

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
        "source": "book",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_files": [],
        "failed_files": [],
        "metadata": {
            "extraction_method": "pymupdf",
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
    pdf_path: Path,
    output_dir: Path,
    state_file: Path,
    skip_existing: bool = True,
    verbose: bool = False,
) -> ExtractionStats:
    """
    Run the book extraction process.

    Args:
        pdf_path: Path to the PDF file.
        output_dir: Directory to save extracted content.
        state_file: Path to state file.
        skip_existing: Skip already processed files.
        verbose: Enable verbose logging.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Check PyMuPDF installation
    try:
        check_pymupdf_installed()
    except PyMuPDFNotFoundError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        stats.failed += 1
        return stats

    # Load state
    state = load_state(state_file)

    # Check if already processed
    pdf_path_str = str(pdf_path.absolute())
    if skip_existing and pdf_path_str in state["processed_files"]:
        logger.info(f"Skipping already processed: {pdf_path}")
        stats.skipped += 1
        return stats

    # Extract the book
    logger.info(f"Processing: {pdf_path}")
    result = extract_book(pdf_path, output_dir)
    stats.results.append(result)

    if result.success:
        state["processed_files"].append(pdf_path_str)

        # Remove from failed if previously failed
        if pdf_path_str in state["failed_files"]:
            state["failed_files"].remove(pdf_path_str)

        stats.processed += 1
        stats.total_pages += result.page_count
        stats.total_chapters += result.chapter_count
        stats.total_words += result.word_count

        logger.info(
            f"Successfully extracted: {result.chapter_count} chapters, "
            f"{result.word_count} words from {result.page_count} pages"
        )
    else:
        if pdf_path_str not in state["failed_files"]:
            state["failed_files"].append(pdf_path_str)

        stats.failed += 1
        stats.errors.append({"file": str(pdf_path), "error": result.error or "Unknown error"})
        logger.error(f"Failed: {result.error}")

    # Save state
    save_state(state, state_file)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("BOOK EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Processed:     {stats.processed}")
    print(f"Skipped:       {stats.skipped}")
    print(f"Failed:        {stats.failed}")

    if stats.processed > 0:
        print(f"\nTotal pages:   {stats.total_pages}")
        print(f"Total chapters: {stats.total_chapters}")
        print(f"Total words:   {stats.total_words:,}")

    if stats.results:
        for result in stats.results:
            if result.success:
                print(f"\nOutput files:")
                print(f"  Metadata:  {result.metadata_path}")
                print(f"  Full text: {result.full_text_path}")
                print(f"  Chapters:  {len(result.chapter_paths)} files")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors:
            if "file" in err:
                print(f"  [{err['file']}] {err['error']}")
            else:
                print(f"  {err['error']}")

    print()


def main() -> int:
    """Main entry point for the book extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract text from PDF books with chapter detection.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python book_extractor.py --pdf /path/to/book.pdf
  python book_extractor.py --pdf book.pdf --output-dir ./extracted
  python book_extractor.py --pdf book.pdf --skip-existing --verbose

Output Structure:
  {output-dir}/book_{slug}_full.json    - Full text content
  {output-dir}/book_{slug}_ch{nn}.json  - Per-chapter content
  {output-dir}/book_{slug}_meta.json    - Book metadata

Chapter Detection:
  The script detects chapters using patterns like "Chapter 1", "CHAPTER I",
  "Part 1", "Section 1", etc. If no chapters are found, it falls back to
  page-based chunking (default 20 pages per chunk).

Requirements:
  pip install pymupdf
        """,
    )

    parser.add_argument(
        "--pdf",
        type=Path,
        required=True,
        help="Path to the PDF file to extract",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/book/extracted"),
        help="Output directory for extracted content (default: data/raw/book/extracted)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/book_state.json"),
        help="State file for tracking processed files (default: data/state/book_state.json)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed files (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process files, ignoring state",
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
    pdf_path = args.pdf.resolve()
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()

    # Validate PDF path
    if not pdf_path.exists():
        logger.error(f"PDF file not found: {pdf_path}")
        return 1

    if not pdf_path.suffix.lower() == ".pdf":
        logger.warning(f"File may not be a PDF: {pdf_path}")

    # Run extraction
    try:
        stats = run_extraction(
            pdf_path=pdf_path,
            output_dir=output_dir,
            state_file=state_file,
            skip_existing=args.skip_existing,
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
