#!/usr/bin/env python3
"""
RAG Retrieval API
=================
High-level retrieval interface for querying the knowledge base.

Features:
- Simple search() function
- Source type filtering
- Score thresholding
- Metadata enrichment

Usage:
    from retrieval import RAGRetriever

    retriever = RAGRetriever()
    results = retriever.search("How to value an accounting practice?", top_k=5)

Author: RAG Pipeline
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    import faiss
except ImportError:
    faiss = None

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
class RetrievalResult:
    """A single retrieval result with full context."""

    chunk_id: str
    document_id: str
    content: str
    score: float
    source_type: str = ""
    title: str = ""
    url: str = ""
    position: dict[str, int] = field(default_factory=dict)
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
            "url": self.url,
            "position": self.position,
            "metadata": self.metadata,
        }

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"RetrievalResult(score={self.score:.4f}, "
            f"source={self.source_type}, "
            f"chunk={self.chunk_id[:20]}...)"
        )


# =============================================================================
# RETRIEVER
# =============================================================================


class RAGRetriever:
    """High-level retrieval interface."""

    def __init__(
        self,
        index_dir: Path | str | None = None,
        embeddings_dir: Path | str | None = None,
        model_name: str | None = None,
    ):
        """
        Initialize the retriever.

        Args:
            index_dir: Directory containing FAISS index.
            embeddings_dir: Directory containing embeddings (for config).
            model_name: Override model name.
        """
        if SentenceTransformer is None:
            raise ImportError("sentence-transformers required. Install with: pip install sentence-transformers")
        if faiss is None:
            raise ImportError("faiss-cpu required. Install with: pip install faiss-cpu")

        # Set default paths
        base_dir = Path(__file__).parent.parent.parent / "data" / "rag"
        self.index_dir = Path(index_dir) if index_dir else base_dir / "indexes"
        self.embeddings_dir = Path(embeddings_dir) if embeddings_dir else base_dir / "embeddings"

        # Load config
        self.model_name = model_name or self._load_model_name()

        # Initialize components
        self._load_index()
        self._load_model()

        logger.info(f"RAGRetriever initialized with {len(self.metadata)} chunks")

    def _load_model_name(self) -> str:
        """Load model name from config."""
        config_path = self.embeddings_dir / "config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                return config.get("model_name", "all-MiniLM-L6-v2")
        return "all-MiniLM-L6-v2"

    def _load_index(self) -> None:
        """Load FAISS index and metadata."""
        index_path = self.index_dir / "faiss.index"
        metadata_path = self.index_dir / "store_metadata.json"

        if not index_path.exists():
            raise FileNotFoundError(f"Index not found: {index_path}")
        if not metadata_path.exists():
            raise FileNotFoundError(f"Metadata not found: {metadata_path}")

        # Load FAISS index
        self.index = faiss.read_index(str(index_path))
        logger.info(f"Loaded FAISS index from {index_path}")

        # Load metadata
        with open(metadata_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.dimension = data.get("dimension")
        self.metadata = data.get("metadata", [])
        logger.info(f"Loaded {len(self.metadata)} metadata entries")

    def _load_model(self) -> None:
        """Load embedding model."""
        logger.info(f"Loading model: {self.model_name}")
        self.model = SentenceTransformer(self.model_name)

    def encode_query(self, query: str) -> np.ndarray:
        """
        Encode a query string to embedding.

        Args:
            query: Query text.

        Returns:
            Normalized embedding vector.
        """
        embedding = self.model.encode(
            [query],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )[0]
        return embedding

    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> list[RetrievalResult]:
        """
        Search for relevant chunks.

        Args:
            query: Search query text.
            top_k: Maximum number of results.
            filters: Optional filters (e.g., {"source_type": "youtube"}).
            min_score: Minimum similarity score (0-1).

        Returns:
            List of RetrievalResult objects sorted by score.
        """
        # Encode query
        query_embedding = self.encode_query(query)

        # Ensure proper shape for FAISS
        query_embedding = np.ascontiguousarray(
            query_embedding.reshape(1, -1).astype(np.float32)
        )

        # Search more than needed if filtering
        search_k = min(top_k * 5 if filters else top_k, len(self.metadata))

        # Perform FAISS search
        scores, indices = self.index.search(query_embedding, search_k)

        # Build results
        results: list[RetrievalResult] = []

        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue

            # Check minimum score
            if score < min_score:
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

            # Extract position info
            inner_meta = meta.get("metadata", {})
            position = {
                "index": inner_meta.get("index", 0),
                "total_chunks": inner_meta.get("total_chunks", 1),
                "start_char": inner_meta.get("start_char", 0),
                "end_char": inner_meta.get("end_char", 0),
            }

            results.append(
                RetrievalResult(
                    chunk_id=meta.get("chunk_id", ""),
                    document_id=meta.get("document_id", ""),
                    content=meta.get("content", ""),
                    score=float(score),
                    source_type=meta.get("source_type", ""),
                    title=meta.get("title", ""),
                    url=inner_meta.get("url", ""),
                    position=position,
                    metadata=inner_meta,
                )
            )

            if len(results) >= top_k:
                break

        return results

    def search_by_source(
        self,
        query: str,
        source_type: str,
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """
        Search within a specific source type.

        Args:
            query: Search query.
            source_type: Source type filter (e.g., "youtube", "blog").
            top_k: Maximum results.

        Returns:
            Filtered search results.
        """
        return self.search(query, top_k=top_k, filters={"source_type": source_type})

    def get_stats(self) -> dict[str, Any]:
        """Get retriever statistics."""
        source_counts: dict[str, int] = {}
        for meta in self.metadata:
            source = meta.get("source_type", "unknown")
            source_counts[source] = source_counts.get(source, 0) + 1

        return {
            "total_chunks": len(self.metadata),
            "dimension": self.dimension,
            "model": self.model_name,
            "source_breakdown": source_counts,
        }


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================


_default_retriever: RAGRetriever | None = None


def get_retriever(
    index_dir: Path | str | None = None,
    embeddings_dir: Path | str | None = None,
) -> RAGRetriever:
    """
    Get or create the default retriever instance.

    Args:
        index_dir: Optional override for index directory.
        embeddings_dir: Optional override for embeddings directory.

    Returns:
        RAGRetriever instance.
    """
    global _default_retriever
    if _default_retriever is None or index_dir or embeddings_dir:
        _default_retriever = RAGRetriever(
            index_dir=index_dir,
            embeddings_dir=embeddings_dir,
        )
    return _default_retriever


def search(
    query: str,
    top_k: int = 5,
    filters: dict[str, Any] | None = None,
    min_score: float = 0.0,
) -> list[RetrievalResult]:
    """
    Convenience function for one-line search.

    Args:
        query: Search query text.
        top_k: Maximum number of results.
        filters: Optional filters.
        min_score: Minimum similarity score.

    Returns:
        List of RetrievalResult objects.
    """
    retriever = get_retriever()
    return retriever.search(query, top_k=top_k, filters=filters, min_score=min_score)


# =============================================================================
# CLI
# =============================================================================


def main() -> int:
    """CLI for testing retrieval."""
    import argparse

    parser = argparse.ArgumentParser(description="Test RAG retrieval")
    parser.add_argument("query", type=str, help="Search query")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results")
    parser.add_argument("--source-type", type=str, help="Filter by source type")
    parser.add_argument("--min-score", type=float, default=0.0, help="Minimum score")
    parser.add_argument("--index-dir", type=Path, help="Index directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Create retriever
    retriever = RAGRetriever(index_dir=args.index_dir)

    # Build filters
    filters = {}
    if args.source_type:
        filters["source_type"] = args.source_type

    # Search
    results = retriever.search(
        args.query,
        top_k=args.top_k,
        filters=filters or None,
        min_score=args.min_score,
    )

    # Display
    print(f"\nSearch: '{args.query}'")
    print(f"Results: {len(results)}")
    print("=" * 70)

    for i, result in enumerate(results, 1):
        print(f"\n[{i}] Score: {result.score:.4f} | Source: {result.source_type}")
        print(f"    Chunk: {result.chunk_id}")
        print(f"    Document: {result.document_id}")
        if result.title:
            print(f"    Title: {result.title}")
        if result.url:
            print(f"    URL: {result.url}")
        print(f"    Content:\n    {result.content[:300]}...")

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
