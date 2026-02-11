#!/usr/bin/env python3
"""
Word Document Book Extractor
============================
Extracts text from Word documents (.docx) with section detection.

Designed for Sara Sharp's "Here's the Deal" book about small business M&A.

Usage:
    python docx_book_extractor.py --docx /path/to/book.docx --output-dir data/raw/book/extracted

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("docx_book_extractor")

EXTRACTOR_VERSION = "1.0.0"

# Major section patterns to detect chapter/section boundaries
# These must be very specific to avoid matching TOC entries
SECTION_PATTERNS = [
    # Match "Intro" only when followed by substantial content (next para starts with "Whether")
    r"^Intro\s*$",
    # Match section titles that appear in the body (not TOC)
    r"^the Golden Era of Buying and Selling Small Businesses$",
    r"^Why Small Business M&A Is Broken$",
    r"^Letter of Intent: Rewriting the Rules and Negotiation Focus$",
    r"^Appendix$",
    r"^How to Spot a Deal-Killer Attorney Before It's Too Late$",
]

# Compiled patterns - use exact match, not prefix match
COMPILED_SECTION_PATTERNS = [re.compile(p) for p in SECTION_PATTERNS]

# Minimum content words to consider a section valid (filters out TOC entries)
MIN_SECTION_WORDS = 200


def generate_slug(title: str) -> str:
    """Generate URL-safe slug from title."""
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    if len(slug) > 60:
        slug = slug[:60].rsplit("-", 1)[0]
    return slug or "book"


def clean_text(text: str) -> str:
    """Clean and normalize extracted text."""
    if not text:
        return ""

    # Remove zero-width characters
    text = re.sub(r"[\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]", "", text)

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def detect_section_start(para_text: str) -> bool:
    """Check if paragraph marks the start of a major section."""
    text = para_text.strip()
    if not text:
        return False

    for pattern in COMPILED_SECTION_PATTERNS:
        if pattern.match(text):
            return True
    return False


def extract_docx(docx_path: Path) -> tuple[list[dict[str, Any]], str]:
    """
    Extract text from Word document and split into sections.

    Returns:
        Tuple of (list of section dicts, full text)
    """
    try:
        from docx import Document
    except ImportError:
        logger.error("python-docx not installed. Run: pip install python-docx")
        sys.exit(1)

    doc = Document(docx_path)

    # Collect all paragraphs
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text
        if text:  # Include non-empty paragraphs
            paragraphs.append(text)

    # Full text for reference
    full_text = "\n".join(paragraphs)
    full_text = clean_text(full_text)

    # Strategy: Find where actual body content starts
    # The TOC is typically short lines, body content has longer paragraphs
    # Look for "Intro" followed by substantial content

    # Find the body start - look for "Intro" that's followed by real content
    body_start_idx = 0
    for i, para in enumerate(paragraphs):
        para_stripped = para.strip()

        # Look for "Intro" that's a standalone paragraph
        if para_stripped == "Intro":
            # Check if next paragraph looks like body content (starts with real text)
            if i + 1 < len(paragraphs):
                next_para = paragraphs[i + 1].strip()
                if next_para.startswith("Whether you're"):
                    body_start_idx = i
                    logger.debug(f"Found body start at paragraph {i}")
                    break

    # Extract sections from body content
    sections = []
    current_section = None
    current_content = []

    for i, para in enumerate(paragraphs[body_start_idx:], start=body_start_idx):
        para_stripped = para.strip()

        if not para_stripped:
            if current_section:
                current_content.append("")  # Preserve paragraph breaks
            continue

        # Check for section boundary
        is_section_header = detect_section_start(para_stripped)

        if is_section_header:
            # Save previous section if it has enough content
            if current_section and current_content:
                section_text = "\n\n".join(current_content)
                word_count = len(section_text.split())
                if word_count >= MIN_SECTION_WORDS:
                    sections.append({
                        "title": current_section,
                        "content": clean_text(section_text),
                    })
                    logger.debug(f"Saved section: {current_section[:50]}... ({word_count} words)")
                else:
                    logger.debug(f"Skipping short section: {current_section[:50]}... ({word_count} words)")

            current_section = para_stripped
            current_content = []
            continue

        # Add to current section
        if current_section:
            current_content.append(para)

    # Save last section
    if current_section and current_content:
        section_text = "\n\n".join(current_content)
        word_count = len(section_text.split())
        if word_count >= MIN_SECTION_WORDS:
            sections.append({
                "title": current_section,
                "content": clean_text(section_text),
            })

    # If no sections detected, treat entire body as one section
    if not sections:
        logger.warning("No sections detected, treating entire document as one section")
        body_text = "\n\n".join(paragraphs[body_start_idx:])
        sections.append({
            "title": "Full Content",
            "content": clean_text(body_text),
        })

    return sections, full_text


def save_book_files(
    sections: list[dict[str, Any]],
    full_text: str,
    output_dir: Path,
    book_title: str = "Here's the Deal",
    author: str = "Sara Sharp",
    isbn: str = "unknown",
) -> dict[str, Any]:
    """Save extracted book content to JSON files."""

    output_dir.mkdir(parents=True, exist_ok=True)

    slug = generate_slug(book_title)
    extraction_date = datetime.now(timezone.utc).isoformat()
    total_words = len(full_text.split())

    # Save full text file
    full_text_data = {
        "slug": slug,
        "title": book_title,
        "author": author,
        "content": full_text,
        "word_count": total_words,
        "page_count": 0,  # Not available from docx
        "extracted_at": extraction_date,
        "extractor_version": EXTRACTOR_VERSION,
    }

    full_text_path = output_dir / f"book_{slug}_full.json"
    with open(full_text_path, "w", encoding="utf-8") as f:
        json.dump(full_text_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved full text: {full_text_path}")

    # Save metadata
    metadata = {
        "title": book_title,
        "author": author,
        "isbn": isbn,
        "slug": slug,
        "chapter_count": len(sections),
        "total_word_count": total_words,
        "extraction_date": extraction_date,
        "extractor_version": EXTRACTOR_VERSION,
    }

    meta_path = output_dir / f"book_{slug}_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved metadata: {meta_path}")

    # Save individual chapter/section files
    chapter_paths = []
    for i, section in enumerate(sections, 1):
        chapter_data = {
            "chapter_number": i,
            "title": section["title"],  # This is what normalizer expects
            "chapter_title": section["title"],  # Also include for compatibility
            "content": section["content"],
            "word_count": len(section["content"].split()),
            "book_title": book_title,
            "author": author,
            "isbn": isbn,
            "extracted_at": extraction_date,
            "extractor_version": EXTRACTOR_VERSION,
        }

        chapter_path = output_dir / f"book_{slug}_ch{i:02d}.json"
        with open(chapter_path, "w", encoding="utf-8") as f:
            json.dump(chapter_data, f, indent=2, ensure_ascii=False)

        chapter_paths.append(chapter_path)
        logger.info(f"Saved chapter {i}: {section['title'][:50]}... ({chapter_data['word_count']} words)")

    return {
        "slug": slug,
        "full_text_path": str(full_text_path),
        "metadata_path": str(meta_path),
        "chapter_count": len(sections),
        "total_words": total_words,
        "chapter_paths": [str(p) for p in chapter_paths],
    }


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract text from Word documents with section detection.",
    )

    parser.add_argument(
        "--docx",
        type=Path,
        required=True,
        help="Path to the Word document (.docx) to extract",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/book/extracted"),
        help="Output directory for extracted content",
    )

    parser.add_argument(
        "--title",
        type=str,
        default="Here's the Deal",
        help="Book title",
    )

    parser.add_argument(
        "--author",
        type=str,
        default="Sara Sharp",
        help="Book author",
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Validate input
    docx_path = args.docx.resolve()
    if not docx_path.exists():
        logger.error(f"File not found: {docx_path}")
        return 1

    if not docx_path.suffix.lower() == ".docx":
        logger.warning(f"File may not be a Word document: {docx_path}")

    # Extract content
    logger.info(f"Extracting: {docx_path}")
    sections, full_text = extract_docx(docx_path)

    if not sections:
        logger.error("No sections detected in document")
        return 1

    logger.info(f"Detected {len(sections)} sections")

    # Save files
    output_dir = args.output_dir.resolve()
    result = save_book_files(
        sections=sections,
        full_text=full_text,
        output_dir=output_dir,
        book_title=args.title,
        author=args.author,
    )

    # Print summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Book:          {args.title}")
    print(f"Author:        {args.author}")
    print(f"Total words:   {result['total_words']:,}")
    print(f"Sections:      {result['chapter_count']}")
    print(f"Output:        {output_dir}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
