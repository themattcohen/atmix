#!/usr/bin/env python3
"""
RAG Pipeline Test Suite
=======================
Tests for embedding generation, vector store, and retrieval functionality.

Usage:
    pytest tests/test_rag.py -v
    pytest tests/test_rag.py -v -k "test_embedding"
    pytest tests/test_rag.py -v --tb=short

Author: RAG Pipeline
"""

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest

# Add scripts directory to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts" / "rag"))


# =============================================================================
# FIXTURES
# =============================================================================


@pytest.fixture
def sample_chunks_dir(tmp_path: Path) -> Path:
    """Create sample chunk files for testing."""
    chunks_dir = tmp_path / "chunks"
    chunks_dir.mkdir()

    # Create a sample YouTube chunk file
    youtube_data = {
        "document_id": "youtube_test123",
        "total_chunks": 2,
        "chunks": [
            {
                "chunk_id": "chunk_test_0000",
                "document_id": "youtube_test123",
                "content": "In this video we discuss how to value an accounting practice. The most common method is using a multiple of gross revenue, typically between 0.8x and 1.2x depending on various factors.",
                "index": 0,
                "total_chunks": 2,
                "word_count": 35,
                "start_char": 0,
                "end_char": 200,
            },
            {
                "chunk_id": "chunk_test_0001",
                "document_id": "youtube_test123",
                "content": "When selling your accounting practice, consider the transition period. Most buyers want the seller to stay on for 6-12 months to ensure client retention.",
                "index": 1,
                "total_chunks": 2,
                "word_count": 30,
                "start_char": 200,
                "end_char": 400,
            },
        ],
    }

    with open(chunks_dir / "youtube_test123_chunks.json", "w") as f:
        json.dump(youtube_data, f)

    # Create a sample blog chunk file
    blog_data = {
        "document_id": "blog_test456",
        "total_chunks": 1,
        "chunks": [
            {
                "chunk_id": "chunk_blog_0000",
                "document_id": "blog_test456",
                "content": "SBA loans are a popular financing option for acquiring accounting practices. They offer favorable terms with down payments as low as 10-15% of the purchase price.",
                "index": 0,
                "total_chunks": 1,
                "word_count": 32,
                "metadata": {
                    "url": "https://example.com/blog/sba-loans",
                },
            },
        ],
    }

    with open(chunks_dir / "blog_test456_chunks.json", "w") as f:
        json.dump(blog_data, f)

    return chunks_dir


@pytest.fixture
def sample_embeddings_dir(tmp_path: Path, sample_chunks_dir: Path) -> Path:
    """Create sample embeddings for testing."""
    from embeddings import generate_embeddings

    embeddings_dir = tmp_path / "embeddings"
    embeddings_dir.mkdir()

    # Generate embeddings from sample chunks
    generate_embeddings(
        input_dir=sample_chunks_dir,
        output_dir=embeddings_dir,
        model_name="all-MiniLM-L6-v2",
    )

    return embeddings_dir


@pytest.fixture
def sample_index_dir(tmp_path: Path, sample_embeddings_dir: Path) -> Path:
    """Create sample FAISS index for testing."""
    from vector_store import build_from_embeddings

    index_dir = tmp_path / "indexes"
    index_dir.mkdir()

    build_from_embeddings(
        embeddings_dir=sample_embeddings_dir,
        output_dir=index_dir,
        index_type="flat",
    )

    return index_dir


# =============================================================================
# EMBEDDING TESTS
# =============================================================================


class TestEmbeddingGenerator:
    """Tests for embedding generation."""

    def test_load_chunks(self, sample_chunks_dir: Path):
        """Test loading chunks from directory."""
        from embeddings import load_chunks

        chunks = load_chunks(sample_chunks_dir)

        assert len(chunks) == 3  # 2 youtube + 1 blog
        assert all(c.chunk_id for c in chunks)
        assert all(c.content for c in chunks)

    def test_chunk_source_detection(self, sample_chunks_dir: Path):
        """Test source type detection from document ID."""
        from embeddings import load_chunks

        chunks = load_chunks(sample_chunks_dir)

        youtube_chunks = [c for c in chunks if c.source_type == "youtube"]
        blog_chunks = [c for c in chunks if c.source_type == "blog"]

        assert len(youtube_chunks) == 2
        assert len(blog_chunks) == 1

    def test_embedding_generator_init(self):
        """Test EmbeddingGenerator initialization."""
        from embeddings import EmbeddingGenerator

        gen = EmbeddingGenerator(model_name="all-MiniLM-L6-v2")

        assert gen.embedding_dim == 384
        assert gen.model is not None

    def test_encoding(self):
        """Test text encoding to embeddings."""
        from embeddings import EmbeddingGenerator

        gen = EmbeddingGenerator()
        texts = ["Hello world", "Accounting practice valuation"]

        embeddings = gen.encode(texts, show_progress=False)

        assert embeddings.shape == (2, 384)
        # Check normalized (should have unit length)
        norms = np.linalg.norm(embeddings, axis=1)
        np.testing.assert_array_almost_equal(norms, [1.0, 1.0], decimal=5)

    def test_generate_embeddings_full(self, sample_chunks_dir: Path, tmp_path: Path):
        """Test full embedding generation pipeline."""
        from embeddings import generate_embeddings

        output_dir = tmp_path / "embeddings"

        stats = generate_embeddings(
            input_dir=sample_chunks_dir,
            output_dir=output_dir,
        )

        assert stats["status"] == "success"
        assert stats["total_embeddings"] == 3
        assert stats["embedding_dim"] == 384

        # Check files exist
        assert (output_dir / "embeddings.npy").exists()
        assert (output_dir / "metadata.json").exists()
        assert (output_dir / "config.json").exists()

        # Verify embeddings shape
        embeddings = np.load(output_dir / "embeddings.npy")
        assert embeddings.shape == (3, 384)


# =============================================================================
# VECTOR STORE TESTS
# =============================================================================


class TestVectorStore:
    """Tests for FAISS vector store."""

    def test_build_flat_index(self, sample_embeddings_dir: Path, tmp_path: Path):
        """Test building a flat FAISS index."""
        from vector_store import build_from_embeddings

        output_dir = tmp_path / "indexes"

        stats = build_from_embeddings(
            embeddings_dir=sample_embeddings_dir,
            output_dir=output_dir,
            index_type="flat",
        )

        assert stats["status"] == "success"
        assert stats["total_vectors"] == 3
        assert (output_dir / "faiss.index").exists()
        assert (output_dir / "store_metadata.json").exists()

    def test_load_store(self, sample_index_dir: Path):
        """Test loading a saved vector store."""
        from vector_store import VectorStore

        store = VectorStore.load(sample_index_dir)

        assert store.index is not None
        assert len(store.metadata) == 3

    def test_search_basic(self, sample_index_dir: Path):
        """Test basic similarity search."""
        from vector_store import VectorStore
        from sentence_transformers import SentenceTransformer

        store = VectorStore.load(sample_index_dir)
        model = SentenceTransformer("all-MiniLM-L6-v2")

        query = "How do I value an accounting firm?"
        query_embedding = model.encode([query], normalize_embeddings=True)[0]

        results = store.search(query_embedding, top_k=2)

        assert len(results) == 2
        assert all(r.score > 0 for r in results)
        # Should be sorted by score descending
        assert results[0].score >= results[1].score

    def test_search_with_filter(self, sample_index_dir: Path):
        """Test search with source type filter."""
        from vector_store import VectorStore
        from sentence_transformers import SentenceTransformer

        store = VectorStore.load(sample_index_dir)
        model = SentenceTransformer("all-MiniLM-L6-v2")

        query = "accounting practice"
        query_embedding = model.encode([query], normalize_embeddings=True)[0]

        # Filter to youtube only
        results = store.search(
            query_embedding,
            top_k=5,
            filters={"source_type": "youtube"},
        )

        assert all(r.source_type == "youtube" for r in results)
        assert len(results) <= 2  # Only 2 youtube chunks


# =============================================================================
# RETRIEVAL TESTS
# =============================================================================


class TestRetrieval:
    """Tests for high-level retrieval API."""

    def test_retriever_init(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test RAGRetriever initialization."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        assert retriever.index is not None
        assert len(retriever.metadata) == 3

    def test_search_relevance(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test that search returns relevant results."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        # Query about valuation
        results = retriever.search("accounting practice valuation", top_k=3)

        assert len(results) > 0
        # Top result should mention valuation or value
        top_content = results[0].content.lower()
        assert "value" in top_content or "valuation" in top_content or "multiple" in top_content

    def test_search_sba_loans(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test searching for SBA loan content."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        results = retriever.search("SBA financing options", top_k=3)

        assert len(results) > 0
        # Should find the blog chunk about SBA loans
        found_sba = any("sba" in r.content.lower() for r in results)
        assert found_sba, "Should find SBA loan content"

    def test_search_by_source(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test source type filtering via search_by_source."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        blog_results = retriever.search_by_source("financing", source_type="blog", top_k=5)
        youtube_results = retriever.search_by_source("financing", source_type="youtube", top_k=5)

        assert all(r.source_type == "blog" for r in blog_results)
        assert all(r.source_type == "youtube" for r in youtube_results)

    def test_min_score_filter(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test minimum score filtering."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        # Get all results first
        all_results = retriever.search("accounting", top_k=10, min_score=0.0)

        # Now filter with high min_score
        filtered_results = retriever.search("accounting", top_k=10, min_score=0.5)

        # All filtered results should have score >= 0.5
        assert all(r.score >= 0.5 for r in filtered_results)
        assert len(filtered_results) <= len(all_results)

    def test_get_stats(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test retriever statistics."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        stats = retriever.get_stats()

        assert stats["total_chunks"] == 3
        assert stats["dimension"] == 384
        assert "youtube" in stats["source_breakdown"]
        assert "blog" in stats["source_breakdown"]


# =============================================================================
# END-TO-END TESTS
# =============================================================================


class TestEndToEnd:
    """End-to-end pipeline tests."""

    def test_full_pipeline(self, sample_chunks_dir: Path, tmp_path: Path):
        """Test complete pipeline from chunks to retrieval."""
        from embeddings import generate_embeddings
        from vector_store import build_from_embeddings
        from retrieval import RAGRetriever

        embeddings_dir = tmp_path / "embeddings"
        index_dir = tmp_path / "indexes"

        # Step 1: Generate embeddings
        embed_stats = generate_embeddings(
            input_dir=sample_chunks_dir,
            output_dir=embeddings_dir,
        )
        assert embed_stats["status"] == "success"

        # Step 2: Build vector store
        index_stats = build_from_embeddings(
            embeddings_dir=embeddings_dir,
            output_dir=index_dir,
        )
        assert index_stats["status"] == "success"

        # Step 3: Query
        retriever = RAGRetriever(
            index_dir=index_dir,
            embeddings_dir=embeddings_dir,
        )

        results = retriever.search("accounting practice acquisition", top_k=3)

        assert len(results) > 0
        assert results[0].score > 0
        assert results[0].content

    def test_query_variations(self, sample_index_dir: Path, sample_embeddings_dir: Path):
        """Test various query phrasings return relevant results."""
        from retrieval import RAGRetriever

        retriever = RAGRetriever(
            index_dir=sample_index_dir,
            embeddings_dir=sample_embeddings_dir,
        )

        queries = [
            "How much is an accounting practice worth?",
            "What's the valuation multiple for accounting firms?",
            "Selling my accounting business",
            "SBA loan for buying an accounting practice",
            "Client retention during practice sale",
        ]

        for query in queries:
            results = retriever.search(query, top_k=3)
            assert len(results) > 0, f"No results for query: {query}"
            assert results[0].score > 0.1, f"Low score for query: {query}"


# =============================================================================
# INTEGRATION WITH REAL DATA (if available)
# =============================================================================


class TestRealData:
    """Tests using real production data."""

    @pytest.fixture
    def real_data_available(self) -> bool:
        """Check if real data is available."""
        project_root = Path(__file__).parent.parent
        index_dir = project_root / "data" / "rag" / "indexes"
        return (index_dir / "faiss.index").exists()

    def test_real_retrieval(self, real_data_available: bool):
        """Test retrieval with production data if available."""
        if not real_data_available:
            pytest.skip("Real index not built yet")

        from retrieval import RAGRetriever

        project_root = Path(__file__).parent.parent
        index_dir = project_root / "data" / "rag" / "indexes"
        embeddings_dir = project_root / "data" / "rag" / "embeddings"

        retriever = RAGRetriever(
            index_dir=index_dir,
            embeddings_dir=embeddings_dir,
        )

        # Test real query
        results = retriever.search(
            "What is the best way to sell an accounting practice?",
            top_k=5,
        )

        assert len(results) > 0
        print(f"\nReal data test - Top result score: {results[0].score:.4f}")
        print(f"Content preview: {results[0].content[:200]}...")


# =============================================================================
# MAIN
# =============================================================================


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
