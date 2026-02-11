#!/usr/bin/env python3
"""
RAG Vector Store
================
FAISS-based vector store for efficient similarity search.

Features:
- Local FAISS index (no server required)
- Multiple index types (Flat, IVF)
- Metadata filtering support
- Persistence to disk

Usage:
    python vector_store.py build --embeddings data/rag/embeddings --output data/rag/indexes
    python vector_store.py search --index data/rag/indexes --query "accounting practice valuation"

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
    import faiss
except ImportError:
    print("Error: faiss-cpu not installed.")
    print("Install with: pip install faiss-cpu")
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
class SearchResult:
    """A single search result."""

    chunk_id: str
    document_id: str
    content: str
    score: float
    source_type: str = ""
    title: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "content": self.content,
            "score": float(self.score),
            "source_type": self.source_type,
            "title": self.title,
            "metadata": self.metadata,
        }


# =============================================================================
# VECTOR STORE
# =============================================================================


class VectorStore:
    """FAISS-based vector store for similarity search."""

    def __init__(self, dimension: int | None = None):
        """
        Initialize the vector store.

        Args:
            dimension: Embedding dimension. If None, will be set on first add.
        """
        self.dimension = dimension
        self.index: faiss.Index | None = None
        self.metadata: list[dict[str, Any]] = []
        self.id_to_idx: dict[str, int] = {}

    def build_index(
        self,
        embeddings: np.ndarray,
        metadata: list[dict[str, Any]],
        index_type: str = "flat",
        nlist: int = 100,
    ) -> None:
        """
        Build FAISS index from embeddings.

        Args:
            embeddings: Numpy array of embeddings (n_samples, dimension).
            metadata: List of metadata dicts for each embedding.
            index_type: "flat" for exact search, "ivf" for approximate.
            nlist: Number of clusters for IVF index.
        """
        if len(embeddings) == 0:
            raise ValueError("Cannot build index with empty embeddings")

        n_samples, dimension = embeddings.shape
        self.dimension = dimension

        # Ensure embeddings are float32 and contiguous
        embeddings = np.ascontiguousarray(embeddings.astype(np.float32))

        if index_type == "flat":
            # Exact search using inner product (embeddings are normalized)
            self.index = faiss.IndexFlatIP(dimension)
        elif index_type == "ivf":
            # Approximate search with IVF
            nlist = min(nlist, n_samples // 10)  # Ensure enough training data
            nlist = max(nlist, 1)
            quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, nlist, faiss.METRIC_INNER_PRODUCT)
            # Train the index
            self.index.train(embeddings)
        else:
            raise ValueError(f"Unknown index type: {index_type}")

        # Add embeddings to index
        self.index.add(embeddings)

        # Store metadata
        self.metadata = metadata
        self.id_to_idx = {m["chunk_id"]: i for i, m in enumerate(metadata)}

        logger.info(
            f"Built {index_type} index with {n_samples} vectors, dimension {dimension}"
        )

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """
        Search for similar vectors.

        Args:
            query_embedding: Query vector (1, dimension) or (dimension,).
            top_k: Number of results to return.
            filters: Optional filters (e.g., {"source_type": "youtube"}).

        Returns:
            List of SearchResult objects.
        """
        if self.index is None:
            raise ValueError("Index not built. Call build_index first.")

        # Ensure query is 2D
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        # Ensure float32 and contiguous
        query_embedding = np.ascontiguousarray(query_embedding.astype(np.float32))

        # Search more than needed if filtering
        search_k = top_k * 5 if filters else top_k

        # Perform search
        scores, indices = self.index.search(query_embedding, min(search_k, len(self.metadata)))

        # Build results
        results: list[SearchResult] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue

            meta = self.metadata[idx]

            # Apply filters
            if filters:
                match = True
                for key, value in filters.items():
                    meta_value = meta.get(key)
                    if isinstance(value, list):
                        if meta_value not in value:
                            match = False
                            break
                    elif meta_value != value:
                        match = False
                        break
                if not match:
                    continue

            results.append(
                SearchResult(
                    chunk_id=meta.get("chunk_id", ""),
                    document_id=meta.get("document_id", ""),
                    content=meta.get("content", ""),
                    score=float(score),
                    source_type=meta.get("source_type", ""),
                    title=meta.get("title", ""),
                    metadata=meta.get("metadata", {}),
                )
            )

            if len(results) >= top_k:
                break

        return results

    def save(self, output_dir: Path) -> dict[str, Path]:
        """
        Save index and metadata to disk.

        Args:
            output_dir: Directory to save files.

        Returns:
            Dictionary of saved file paths.
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save FAISS index
        index_path = output_dir / "faiss.index"
        faiss.write_index(self.index, str(index_path))
        logger.info(f"Saved FAISS index to {index_path}")

        # Save metadata
        metadata_path = output_dir / "store_metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "dimension": self.dimension,
                    "total_vectors": len(self.metadata),
                    "metadata": self.metadata,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        logger.info(f"Saved metadata to {metadata_path}")

        return {"index": index_path, "metadata": metadata_path}

    @classmethod
    def load(cls, input_dir: Path) -> VectorStore:
        """
        Load index and metadata from disk.

        Args:
            input_dir: Directory containing saved files.

        Returns:
            Loaded VectorStore instance.
        """
        index_path = input_dir / "faiss.index"
        metadata_path = input_dir / "store_metadata.json"

        if not index_path.exists():
            raise FileNotFoundError(f"Index file not found: {index_path}")
        if not metadata_path.exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata_path}")

        # Load index
        index = faiss.read_index(str(index_path))
        logger.info(f"Loaded FAISS index from {index_path}")

        # Load metadata
        with open(metadata_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Create instance
        store = cls(dimension=data.get("dimension"))
        store.index = index
        store.metadata = data.get("metadata", [])
        store.id_to_idx = {m["chunk_id"]: i for i, m in enumerate(store.metadata)}

        logger.info(f"Loaded {len(store.metadata)} vectors from {metadata_path}")
        return store


# =============================================================================
# BUILD FUNCTIONS
# =============================================================================


def build_from_embeddings(
    embeddings_dir: Path,
    output_dir: Path,
    index_type: str = "flat",
) -> dict[str, Any]:
    """
    Build vector store from embeddings directory.

    Args:
        embeddings_dir: Directory containing embeddings.npy and metadata.json.
        output_dir: Directory to save the index.
        index_type: Type of FAISS index.

    Returns:
        Build statistics.
    """
    embeddings_path = embeddings_dir / "embeddings.npy"
    metadata_path = embeddings_dir / "metadata.json"

    if not embeddings_path.exists():
        raise FileNotFoundError(f"Embeddings not found: {embeddings_path}")
    if not metadata_path.exists():
        raise FileNotFoundError(f"Metadata not found: {metadata_path}")

    # Load embeddings
    embeddings = np.load(embeddings_path)
    logger.info(f"Loaded embeddings: {embeddings.shape}")

    # Load metadata
    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    logger.info(f"Loaded metadata: {len(metadata)} entries")

    # Validate
    if len(embeddings) != len(metadata):
        raise ValueError(
            f"Mismatch: {len(embeddings)} embeddings vs {len(metadata)} metadata entries"
        )

    # Build store
    store = VectorStore()
    store.build_index(embeddings, metadata, index_type=index_type)

    # Save
    paths = store.save(output_dir)

    return {
        "status": "success",
        "total_vectors": len(embeddings),
        "dimension": embeddings.shape[1],
        "index_type": index_type,
        "output_files": {k: str(v) for k, v in paths.items()},
    }


# =============================================================================
# CLI
# =============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="FAISS vector store for RAG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Build command
    build_parser = subparsers.add_parser("build", help="Build index from embeddings")
    build_parser.add_argument(
        "--embeddings",
        type=Path,
        default=Path("data/rag/embeddings"),
        help="Directory containing embeddings (default: data/rag/embeddings)",
    )
    build_parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/rag/indexes"),
        help="Output directory for index (default: data/rag/indexes)",
    )
    build_parser.add_argument(
        "--type",
        choices=["flat", "ivf"],
        default="flat",
        help="Index type (default: flat)",
    )

    # Search command
    search_parser = subparsers.add_parser("search", help="Search the index")
    search_parser.add_argument(
        "--index",
        type=Path,
        default=Path("data/rag/indexes"),
        help="Directory containing the index (default: data/rag/indexes)",
    )
    search_parser.add_argument(
        "--query",
        type=str,
        required=True,
        help="Search query text",
    )
    search_parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of results (default: 5)",
    )
    search_parser.add_argument(
        "--source-type",
        type=str,
        help="Filter by source type (e.g., youtube, blog)",
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

    if args.command == "build":
        stats = build_from_embeddings(
            embeddings_dir=args.embeddings,
            output_dir=args.output,
            index_type=args.type,
        )
        print(f"\nIndex build successful!")
        print(f"  Total vectors: {stats['total_vectors']}")
        print(f"  Dimension: {stats['dimension']}")
        print(f"  Index type: {stats['index_type']}")
        return 0

    elif args.command == "search":
        # For search, we need the embedding model to encode the query
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            print("Error: sentence-transformers not installed for search")
            return 1

        # Load store
        store = VectorStore.load(args.index)

        # Load embeddings config for model name
        config_path = args.index.parent / "embeddings" / "config.json"
        model_name = "all-MiniLM-L6-v2"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                model_name = config.get("model_name", model_name)

        # Encode query
        model = SentenceTransformer(model_name)
        query_embedding = model.encode([args.query], normalize_embeddings=True)[0]

        # Build filters
        filters = {}
        if args.source_type:
            filters["source_type"] = args.source_type

        # Search
        results = store.search(query_embedding, top_k=args.top_k, filters=filters or None)

        # Display results
        print(f"\nSearch results for: '{args.query}'")
        print("=" * 60)
        for i, result in enumerate(results, 1):
            print(f"\n{i}. [Score: {result.score:.4f}] {result.source_type}")
            print(f"   Chunk: {result.chunk_id}")
            if result.title:
                print(f"   Title: {result.title}")
            print(f"   Content: {result.content[:200]}...")

        return 0

    else:
        print("No command specified. Use 'build' or 'search'.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
