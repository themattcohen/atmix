#!/usr/bin/env python3
"""
RAG Embedding Generator
=======================
Generates vector embeddings for document chunks using sentence-transformers.

Uses all-MiniLM-L6-v2 model for efficiency:
- 384 dimensions
- Fast inference
- Good semantic similarity

Usage:
    python embeddings.py --input-dir data/rag/chunks --output-dir data/rag/embeddings
    python embeddings.py --model all-mpnet-base-v2  # Higher quality, slower

Author: RAG Pipeline
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Error: sentence-transformers not installed.")
    print("Install with: pip install sentence-transformers")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# =============================================================================
# DATA STRUCTURES
# =============================================================================


@dataclass
class ChunkData:
    """Represents a single chunk with its metadata."""

    chunk_id: str
    document_id: str
    content: str
    source_type: str = ""
    title: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any], parent_doc_id: str = "") -> ChunkData:
        """Create ChunkData from dictionary."""
        # Determine source_type from document_id or parent
        doc_id = data.get("document_id", parent_doc_id)
        source_type = ""
        if doc_id.startswith("youtube_"):
            source_type = "youtube"
        elif doc_id.startswith("blog_"):
            source_type = "blog"
        elif "podcast" in doc_id.lower():
            source_type = "podcast"
        else:
            # Try to get from metadata
            source_type = data.get("source_type", data.get("source", "unknown"))

        return cls(
            chunk_id=data.get("chunk_id", ""),
            document_id=doc_id,
            content=data.get("content", ""),
            source_type=source_type,
            title=data.get("title", ""),
            metadata={
                "index": data.get("index", 0),
                "total_chunks": data.get("total_chunks", 1),
                "word_count": data.get("word_count", 0),
                "start_char": data.get("start_char", 0),
                "end_char": data.get("end_char", 0),
                "url": data.get("metadata", {}).get("url", data.get("url", "")),
            }
        )


@dataclass
class EmbeddingResult:
    """Result of embedding a chunk."""

    chunk_id: str
    document_id: str
    embedding: np.ndarray
    source_type: str
    title: str
    content: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "source_type": self.source_type,
            "title": self.title,
            "content": self.content,
            "metadata": self.metadata,
        }


# =============================================================================
# EMBEDDING ENGINE
# =============================================================================


class EmbeddingGenerator:
    """Generates embeddings using sentence-transformers."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        device: str | None = None,
        batch_size: int = 32,
    ):
        """
        Initialize the embedding generator.

        Args:
            model_name: Name of the sentence-transformers model.
            device: Device to run on (None for auto-detect).
            batch_size: Batch size for encoding.
        """
        self.model_name = model_name
        self.batch_size = batch_size

        logger.info(f"Loading model: {model_name}")
        self.model = SentenceTransformer(model_name, device=device)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self.embedding_dim}")

    def encode(self, texts: list[str], show_progress: bool = True) -> np.ndarray:
        """
        Encode texts to embeddings.

        Args:
            texts: List of texts to encode.
            show_progress: Whether to show progress bar.

        Returns:
            numpy array of embeddings with shape (len(texts), embedding_dim).
        """
        if not texts:
            return np.array([])

        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2 normalize for cosine similarity
        )

        return embeddings

    def embed_chunks(
        self,
        chunks: list[ChunkData],
        show_progress: bool = True,
    ) -> list[EmbeddingResult]:
        """
        Generate embeddings for a list of chunks.

        Args:
            chunks: List of ChunkData objects.
            show_progress: Whether to show progress bar.

        Returns:
            List of EmbeddingResult objects.
        """
        if not chunks:
            return []

        # Extract content for embedding
        texts = [chunk.content for chunk in chunks]

        # Generate embeddings
        embeddings = self.encode(texts, show_progress=show_progress)

        # Create results
        results = []
        for chunk, embedding in zip(chunks, embeddings):
            results.append(
                EmbeddingResult(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    embedding=embedding,
                    source_type=chunk.source_type,
                    title=chunk.title,
                    content=chunk.content,
                    metadata=chunk.metadata,
                )
            )

        return results


# =============================================================================
# FILE I/O
# =============================================================================


def load_chunks(input_dir: Path) -> list[ChunkData]:
    """
    Load all chunks from the chunks directory.

    Args:
        input_dir: Directory containing chunk JSON files.

    Returns:
        List of ChunkData objects.
    """
    chunks: list[ChunkData] = []

    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return chunks

    # Process both individual chunk files and chunk collection files
    json_files = list(input_dir.glob("*.json"))

    for file_path in json_files:
        # Skip summary files
        if file_path.name.startswith("_") or "summary" in file_path.name.lower():
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Handle collection format (youtube_xxx_chunks.json, blog_xxx_chunks.json)
            if "chunks" in data and isinstance(data["chunks"], list):
                doc_id = data.get("document_id", file_path.stem)
                for chunk_data in data["chunks"]:
                    chunk = ChunkData.from_dict(chunk_data, doc_id)
                    if chunk.content and chunk.chunk_id:
                        chunks.append(chunk)

            # Handle individual chunk format (chunk_xxx_0000.json)
            elif "chunk_id" in data:
                chunk = ChunkData.from_dict(data)
                if chunk.content and chunk.chunk_id:
                    chunks.append(chunk)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {file_path}: {e}")
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")

    logger.info(f"Loaded {len(chunks)} chunks from {input_dir}")
    return chunks


def save_embeddings(
    results: list[EmbeddingResult],
    output_dir: Path,
    model_name: str,
) -> dict[str, Path]:
    """
    Save embeddings and metadata to output directory.

    Creates:
    - embeddings.npy: Numpy array of all embeddings
    - metadata.json: Chunk metadata for each embedding
    - config.json: Configuration info (model, dimensions, etc.)

    Args:
        results: List of EmbeddingResult objects.
        output_dir: Directory to save files.
        model_name: Name of the model used.

    Returns:
        Dictionary of saved file paths.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Stack embeddings into single array
    embeddings = np.vstack([r.embedding for r in results])

    # Save embeddings
    embeddings_path = output_dir / "embeddings.npy"
    np.save(embeddings_path, embeddings)
    logger.info(f"Saved embeddings to {embeddings_path} - shape: {embeddings.shape}")

    # Save metadata
    metadata = [r.to_dict() for r in results]
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved metadata to {metadata_path}")

    # Save config
    config = {
        "model_name": model_name,
        "embedding_dim": embeddings.shape[1] if len(embeddings.shape) > 1 else 0,
        "total_embeddings": len(results),
        "source_types": list(set(r.source_type for r in results)),
        "document_count": len(set(r.document_id for r in results)),
    }
    config_path = output_dir / "config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    logger.info(f"Saved config to {config_path}")

    return {
        "embeddings": embeddings_path,
        "metadata": metadata_path,
        "config": config_path,
    }


# =============================================================================
# MAIN
# =============================================================================


def generate_embeddings(
    input_dir: Path,
    output_dir: Path,
    model_name: str = "all-MiniLM-L6-v2",
    batch_size: int = 32,
) -> dict[str, Any]:
    """
    Main function to generate embeddings for all chunks.

    Args:
        input_dir: Directory containing chunk JSON files.
        output_dir: Directory to save embeddings.
        model_name: Sentence-transformers model name.
        batch_size: Batch size for encoding.

    Returns:
        Summary statistics.
    """
    # Load chunks
    chunks = load_chunks(input_dir)
    if not chunks:
        logger.warning("No chunks to process")
        return {"status": "no_chunks", "total": 0}

    # Initialize generator
    generator = EmbeddingGenerator(model_name=model_name, batch_size=batch_size)

    # Generate embeddings
    logger.info(f"Generating embeddings for {len(chunks)} chunks...")
    results = generator.embed_chunks(chunks)

    # Save results
    paths = save_embeddings(results, output_dir, model_name)

    # Calculate statistics
    stats = {
        "status": "success",
        "total_chunks": len(chunks),
        "total_embeddings": len(results),
        "embedding_dim": generator.embedding_dim,
        "model": model_name,
        "source_breakdown": {},
        "output_files": {k: str(v) for k, v in paths.items()},
    }

    # Count by source type
    for result in results:
        source = result.source_type or "unknown"
        stats["source_breakdown"][source] = stats["source_breakdown"].get(source, 0) + 1

    logger.info(f"Embedding generation complete: {stats}")
    return stats


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate embeddings for RAG document chunks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/rag/chunks"),
        help="Directory containing chunk JSON files (default: data/rag/chunks)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/rag/embeddings"),
        help="Directory for embedding output (default: data/rag/embeddings)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="all-MiniLM-L6-v2",
        help="Sentence-transformers model name (default: all-MiniLM-L6-v2)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for encoding (default: 32)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    stats = generate_embeddings(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        model_name=args.model,
        batch_size=args.batch_size,
    )

    if stats.get("status") == "success":
        print(f"\nEmbedding generation successful!")
        print(f"  Total chunks: {stats['total_chunks']}")
        print(f"  Embedding dim: {stats['embedding_dim']}")
        print(f"  Source breakdown: {stats['source_breakdown']}")
        return 0
    else:
        print(f"\nEmbedding generation failed: {stats}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
