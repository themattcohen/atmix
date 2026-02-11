#!/usr/bin/env python3
"""
RAG Document Chunker
====================
Splits normalized documents into RAG-optimized chunks with sentence boundary
respect, overlap handling, and comprehensive position metadata.

Features:
- Sentence-boundary-aware splitting
- Configurable chunk size and overlap
- Context preservation (preceding/following text)
- Deterministic chunk ID generation
- Edge case handling (short documents, no sentence boundaries)

Usage:
    python chunker.py --input-dir data/normalized/documents --output-dir data/rag/chunks
    python chunker.py --chunk-size 600 --overlap 100

Author: Automated RAG Pipeline
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================


@dataclass
class ChunkConfig:
    """Configuration for document chunking."""

    chunk_size: int = 800  # Target words per chunk
    overlap: int = 150  # Words of overlap between chunks
    context_chars: int = 200  # Characters of context from adjacent chunks
    min_chunk_size: int = 50  # Minimum words for a valid chunk
    sentence_boundary_search_window: int = 100  # Words to search for boundary

    def __post_init__(self) -> None:
        """Validate configuration values."""
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if self.overlap < 0:
            raise ValueError("overlap cannot be negative")
        if self.overlap >= self.chunk_size:
            raise ValueError("overlap must be less than chunk_size")
        if self.context_chars < 0:
            raise ValueError("context_chars cannot be negative")
        if self.min_chunk_size <= 0:
            raise ValueError("min_chunk_size must be positive")


@dataclass
class ChunkMetadata:
    """Metadata for a single chunk."""

    chunk_id: str
    document_id: str
    index: int
    start_char: int
    end_char: int
    total_chunks: int
    word_count: int
    preceding_text: str = ""
    following_text: str = ""


@dataclass
class Chunk:
    """A single document chunk with content and metadata."""

    content: str
    metadata: ChunkMetadata

    def to_dict(self) -> dict[str, Any]:
        """Convert chunk to dictionary for JSON serialization."""
        return {
            "chunk_id": self.metadata.chunk_id,
            "document_id": self.metadata.document_id,
            "content": self.content,
            "index": self.metadata.index,
            "start_char": self.metadata.start_char,
            "end_char": self.metadata.end_char,
            "total_chunks": self.metadata.total_chunks,
            "word_count": self.metadata.word_count,
            "context": {
                "preceding_text": self.metadata.preceding_text,
                "following_text": self.metadata.following_text,
            },
        }


@dataclass
class Document:
    """Normalized document structure."""

    id: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Document:
        """Create Document from dictionary.

        Handles multiple content formats:
        - content: str (direct content)
        - content: {text: str, ...} (nested content object)
        - text: str (alternative key)
        """
        doc_id = data.get("id", data.get("document_id", ""))

        # Extract content from various possible structures
        raw_content = data.get("content", data.get("text", ""))

        # Handle nested content object with 'text' field
        if isinstance(raw_content, dict):
            content = raw_content.get("text", raw_content.get("content", ""))
        else:
            content = raw_content

        # Ensure content is a string
        if not isinstance(content, str):
            content = str(content) if content else ""

        return cls(
            id=doc_id,
            content=content,
            metadata=data.get("metadata", {}),
        )


# =============================================================================
# SENTENCE BOUNDARY DETECTION
# =============================================================================

# Pattern for sentence endings: period, question mark, exclamation mark
# followed by space or end of string, handling common abbreviations
SENTENCE_END_PATTERN = re.compile(
    r"""
    (?<=[.!?])              # Lookbehind for sentence-ending punctuation
    (?:\s+|$)               # Followed by whitespace or end of string
    (?![a-z])               # Not followed by lowercase (handles abbreviations)
    """,
    re.VERBOSE,
)

# Common abbreviations that should not be treated as sentence endings
ABBREVIATIONS = frozenset(
    {
        "mr.",
        "mrs.",
        "ms.",
        "dr.",
        "prof.",
        "sr.",
        "jr.",
        "vs.",
        "etc.",
        "inc.",
        "ltd.",
        "corp.",
        "co.",
        "st.",
        "ave.",
        "blvd.",
        "e.g.",
        "i.e.",
        "a.m.",
        "p.m.",
        "u.s.",
        "u.k.",
        "no.",
        "vol.",
        "pp.",
        "fig.",
        "jan.",
        "feb.",
        "mar.",
        "apr.",
        "jun.",
        "jul.",
        "aug.",
        "sep.",
        "sept.",
        "oct.",
        "nov.",
        "dec.",
    }
)


def find_sentence_boundary(text: str, target_pos: int) -> int:
    """
    Find the nearest sentence boundary to target_pos.

    Searches for sentence-ending punctuation near the target position,
    preferring boundaries that don't break mid-sentence. Returns the
    position after the sentence boundary (including trailing space).

    Args:
        text: The text to search within.
        target_pos: The target character position to find a boundary near.

    Returns:
        Character position of the nearest sentence boundary, or target_pos
        if no boundary is found within the search window.
    """
    if not text or target_pos <= 0:
        return target_pos

    # Clamp target_pos to valid range
    target_pos = min(target_pos, len(text))

    # Define search window around target position
    # Search more aggressively forward than backward to avoid cutting sentences
    search_start = max(0, target_pos - 100)
    search_end = min(len(text), target_pos + 200)
    search_text = text[search_start:search_end]

    # Find all sentence boundaries in the search window
    boundaries: list[int] = []
    for match in SENTENCE_END_PATTERN.finditer(search_text):
        boundary_pos = search_start + match.end()

        # Check if this might be an abbreviation (look at preceding word)
        if boundary_pos > 1:
            # Look back to find the word before the punctuation
            word_start = max(0, boundary_pos - 15)
            preceding = text[word_start : boundary_pos - 1].lower()
            last_word = preceding.split()[-1] if preceding.split() else ""

            # Add period back to check against abbreviations
            if last_word and f"{last_word}." in ABBREVIATIONS:
                continue  # Skip this boundary, it's likely an abbreviation

        boundaries.append(boundary_pos)

    if not boundaries:
        # No sentence boundary found, return target position
        return target_pos

    # Find the boundary closest to target_pos, preferring slightly later positions
    best_boundary = target_pos
    min_distance = float("inf")

    for boundary in boundaries:
        # Calculate distance, with slight preference for forward boundaries
        distance = abs(boundary - target_pos)
        if boundary > target_pos:
            distance *= 0.8  # Prefer forward boundaries

        if distance < min_distance:
            min_distance = distance
            best_boundary = boundary

    return best_boundary


def count_words(text: str) -> int:
    """Count words in text, handling multiple whitespace."""
    if not text:
        return 0
    return len(text.split())


def words_to_chars(text: str, word_count: int) -> int:
    """
    Convert word count to approximate character position.

    Args:
        text: The source text.
        word_count: Number of words from the start.

    Returns:
        Character position after the specified number of words.
    """
    if not text or word_count <= 0:
        return 0

    words = text.split()
    if word_count >= len(words):
        return len(text)

    # Find the position after the nth word
    pos = 0
    current_word = 0

    for i, char in enumerate(text):
        if char.isspace():
            if i > 0 and not text[i - 1].isspace():
                current_word += 1
                if current_word >= word_count:
                    # Move past trailing whitespace
                    while i < len(text) and text[i].isspace():
                        i += 1
                    return i
        pos = i

    return len(text)


# =============================================================================
# CHUNK ID GENERATION
# =============================================================================


def generate_chunk_id(document_id: str, index: int) -> str:
    """
    Generate a deterministic chunk ID.

    Format: chunk_{doc_hash}_{index:04d}

    Args:
        document_id: The source document's identifier.
        index: Zero-based chunk index within the document.

    Returns:
        A unique, deterministic chunk ID string.
    """
    # Create a short hash of the document ID for the chunk identifier
    doc_hash = hashlib.sha256(document_id.encode("utf-8")).hexdigest()[:8]
    return f"chunk_{doc_hash}_{index:04d}"


# =============================================================================
# CHUNKING LOGIC
# =============================================================================


def create_chunks(document: Document, config: ChunkConfig) -> list[Chunk]:
    """
    Split a document into RAG-optimized chunks.

    Creates overlapping chunks that respect sentence boundaries when possible.
    Each chunk includes position metadata and context from adjacent chunks.

    Args:
        document: The document to chunk.
        config: Chunking configuration parameters.

    Returns:
        List of Chunk objects with content and metadata.
    """
    content = document.content
    if not content or not content.strip():
        logger.warning(f"Document {document.id} has no content, skipping")
        return []

    # Normalize whitespace
    content = " ".join(content.split())
    total_words = count_words(content)

    # Handle short documents - return as single chunk
    if total_words <= config.chunk_size + config.overlap:
        chunk = Chunk(
            content=content,
            metadata=ChunkMetadata(
                chunk_id=generate_chunk_id(document.id, 0),
                document_id=document.id,
                index=0,
                start_char=0,
                end_char=len(content),
                total_chunks=1,
                word_count=total_words,
                preceding_text="",
                following_text="",
            ),
        )
        return [chunk]

    chunks: list[Chunk] = []
    current_char = 0
    chunk_index = 0

    while current_char < len(content):
        # Calculate target end position based on word count
        target_end_words = config.chunk_size
        target_end_char = words_to_chars(content[current_char:], target_end_words)
        target_end_char += current_char

        # Find sentence boundary near target end
        if target_end_char < len(content):
            boundary = find_sentence_boundary(content, target_end_char)
            # Ensure we don't create tiny chunks at the end
            remaining = len(content) - boundary
            if remaining > 0 and remaining < config.min_chunk_size * 5:
                # Include the rest if it's small enough
                boundary = len(content)
            end_char = boundary
        else:
            end_char = len(content)

        # Extract chunk content
        chunk_content = content[current_char:end_char].strip()
        chunk_word_count = count_words(chunk_content)

        # Skip if chunk is too small (unless it's the last remaining content)
        if chunk_word_count < config.min_chunk_size and current_char > 0:
            # Merge with previous chunk instead of creating tiny chunk
            if chunks:
                prev_chunk = chunks[-1]
                merged_content = f"{prev_chunk.content} {chunk_content}".strip()
                merged_word_count = count_words(merged_content)

                # Update previous chunk with merged content
                chunks[-1] = Chunk(
                    content=merged_content,
                    metadata=ChunkMetadata(
                        chunk_id=prev_chunk.metadata.chunk_id,
                        document_id=prev_chunk.metadata.document_id,
                        index=prev_chunk.metadata.index,
                        start_char=prev_chunk.metadata.start_char,
                        end_char=end_char,
                        total_chunks=prev_chunk.metadata.total_chunks,  # Will update later
                        word_count=merged_word_count,
                        preceding_text=prev_chunk.metadata.preceding_text,
                        following_text="",  # Will update later
                    ),
                )
            break

        # Create chunk
        chunk = Chunk(
            content=chunk_content,
            metadata=ChunkMetadata(
                chunk_id=generate_chunk_id(document.id, chunk_index),
                document_id=document.id,
                index=chunk_index,
                start_char=current_char,
                end_char=end_char,
                total_chunks=0,  # Will update after all chunks created
                word_count=chunk_word_count,
                preceding_text="",  # Will populate after
                following_text="",  # Will populate after
            ),
        )
        chunks.append(chunk)
        chunk_index += 1

        # Calculate next start position with overlap
        overlap_chars = words_to_chars(content[current_char:], config.overlap)
        next_start = end_char - overlap_chars

        # Ensure we make progress
        if next_start <= current_char:
            next_start = end_char

        # Find sentence boundary for overlap start
        if next_start < len(content):
            # Try to start at a sentence boundary
            overlap_boundary = find_sentence_boundary(content, next_start)
            if overlap_boundary > next_start and overlap_boundary < end_char:
                next_start = overlap_boundary

        current_char = next_start

        # Safety check to prevent infinite loops
        if current_char >= len(content):
            break

    # Update total_chunks count for all chunks
    total_chunks = len(chunks)
    for i, chunk in enumerate(chunks):
        chunks[i] = Chunk(
            content=chunk.content,
            metadata=ChunkMetadata(
                chunk_id=chunk.metadata.chunk_id,
                document_id=chunk.metadata.document_id,
                index=chunk.metadata.index,
                start_char=chunk.metadata.start_char,
                end_char=chunk.metadata.end_char,
                total_chunks=total_chunks,
                word_count=chunk.metadata.word_count,
                preceding_text=chunk.metadata.preceding_text,
                following_text=chunk.metadata.following_text,
            ),
        )

    # Add context from adjacent chunks
    chunks = _add_context(chunks, content, config.context_chars)

    return chunks


def _add_context(chunks: list[Chunk], full_content: str, context_chars: int) -> list[Chunk]:
    """
    Add preceding and following context to each chunk.

    Args:
        chunks: List of chunks to add context to.
        full_content: The full document content.
        context_chars: Number of characters of context to include.

    Returns:
        Chunks with context populated.
    """
    if not chunks:
        return chunks

    result: list[Chunk] = []

    for i, chunk in enumerate(chunks):
        # Get preceding context from previous chunk
        preceding = ""
        if i > 0:
            prev_content = chunks[i - 1].content
            if len(prev_content) > context_chars:
                preceding = prev_content[-context_chars:]
            else:
                preceding = prev_content

        # Get following context from next chunk
        following = ""
        if i < len(chunks) - 1:
            next_content = chunks[i + 1].content
            if len(next_content) > context_chars:
                following = next_content[:context_chars]
            else:
                following = next_content

        result.append(
            Chunk(
                content=chunk.content,
                metadata=ChunkMetadata(
                    chunk_id=chunk.metadata.chunk_id,
                    document_id=chunk.metadata.document_id,
                    index=chunk.metadata.index,
                    start_char=chunk.metadata.start_char,
                    end_char=chunk.metadata.end_char,
                    total_chunks=chunk.metadata.total_chunks,
                    word_count=chunk.metadata.word_count,
                    preceding_text=preceding,
                    following_text=following,
                ),
            )
        )

    return result


# =============================================================================
# FILE I/O
# =============================================================================


def load_documents(input_dir: Path) -> list[Document]:
    """
    Load normalized documents from directory.

    Supports JSON files with document content.

    Args:
        input_dir: Directory containing normalized document files.

    Returns:
        List of Document objects.
    """
    documents: list[Document] = []

    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return documents

    json_files = list(input_dir.glob("*.json"))
    if not json_files:
        logger.warning(f"No JSON files found in {input_dir}")
        return documents

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Handle both single document and list of documents
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        doc = Document.from_dict(item)
                        if doc.id and doc.content:
                            documents.append(doc)
            elif isinstance(data, dict):
                # Check if it's a single document or a container with documents
                if "documents" in data:
                    for item in data["documents"]:
                        doc = Document.from_dict(item)
                        if doc.id and doc.content:
                            documents.append(doc)
                elif "content" in data or "text" in data:
                    doc = Document.from_dict(data)
                    if doc.id and doc.content:
                        documents.append(doc)
                    elif doc.content:
                        # Generate ID from filename if missing
                        doc.id = file_path.stem
                        documents.append(doc)

            logger.info(f"Loaded {file_path.name}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {file_path}: {e}")
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")

    logger.info(f"Loaded {len(documents)} documents from {input_dir}")
    return documents


def save_chunks(chunks: list[Chunk], output_dir: Path, document_id: str) -> Path:
    """
    Save chunks to JSON file.

    Args:
        chunks: List of chunks to save.
        output_dir: Directory to write output files.
        document_id: Document identifier for filename.

    Returns:
        Path to the created file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create safe filename from document ID
    safe_id = re.sub(r"[^\w\-]", "_", document_id)[:100]
    output_file = output_dir / f"{safe_id}_chunks.json"

    chunk_data = {
        "document_id": document_id,
        "total_chunks": len(chunks),
        "chunks": [chunk.to_dict() for chunk in chunks],
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(chunk_data, f, indent=2, ensure_ascii=False)

    return output_file


# =============================================================================
# MAIN PROCESSING
# =============================================================================


def process_documents(
    input_dir: Path,
    output_dir: Path,
    config: ChunkConfig,
) -> dict[str, Any]:
    """
    Process all documents in input directory.

    Args:
        input_dir: Directory containing normalized documents.
        output_dir: Directory for chunk output files.
        config: Chunking configuration.

    Returns:
        Summary statistics dictionary.
    """
    documents = load_documents(input_dir)

    if not documents:
        logger.warning("No documents to process")
        return {"documents_processed": 0, "total_chunks": 0}

    stats = {
        "documents_processed": 0,
        "total_chunks": 0,
        "chunks_per_document": {},
        "errors": [],
    }

    for doc in documents:
        try:
            chunks = create_chunks(doc, config)

            if chunks:
                output_file = save_chunks(chunks, output_dir, doc.id)
                stats["documents_processed"] += 1
                stats["total_chunks"] += len(chunks)
                stats["chunks_per_document"][doc.id] = len(chunks)
                logger.info(
                    f"Created {len(chunks)} chunks for {doc.id} -> {output_file.name}"
                )
            else:
                logger.warning(f"No chunks created for {doc.id}")

        except Exception as e:
            error_msg = f"Error processing {doc.id}: {e}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)

    # Save processing summary
    summary_file = output_dir / "_chunking_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "config": {
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
                    "context_chars": config.context_chars,
                },
                "stats": stats,
            },
            f,
            indent=2,
        )

    logger.info(
        f"Processing complete: {stats['documents_processed']} documents, "
        f"{stats['total_chunks']} total chunks"
    )

    return stats


# =============================================================================
# CLI
# =============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Split normalized documents into RAG-optimized chunks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python chunker.py
  python chunker.py --input-dir data/normalized/documents --output-dir data/rag/chunks
  python chunker.py --chunk-size 600 --overlap 100
  python chunker.py --chunk-size 1000 --overlap 200 --context-chars 300
        """,
    )

    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/normalized/documents"),
        help="Directory containing normalized documents (default: data/normalized/documents)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/rag/chunks"),
        help="Directory for chunk output files (default: data/rag/chunks)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=800,
        help="Target words per chunk (default: 800)",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=150,
        help="Words of overlap between chunks (default: 150)",
    )
    parser.add_argument(
        "--context-chars",
        type=int,
        default=200,
        help="Characters of context from adjacent chunks (default: 200)",
    )
    parser.add_argument(
        "--min-chunk-size",
        type=int,
        default=50,
        help="Minimum words for a valid chunk (default: 50)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        config = ChunkConfig(
            chunk_size=args.chunk_size,
            overlap=args.overlap,
            context_chars=args.context_chars,
            min_chunk_size=args.min_chunk_size,
        )
    except ValueError as e:
        logger.error(f"Invalid configuration: {e}")
        return 1

    logger.info(f"Chunking configuration: {config}")
    logger.info(f"Input directory: {args.input_dir}")
    logger.info(f"Output directory: {args.output_dir}")

    stats = process_documents(args.input_dir, args.output_dir, config)

    if stats.get("errors"):
        logger.warning(f"Completed with {len(stats['errors'])} errors")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
