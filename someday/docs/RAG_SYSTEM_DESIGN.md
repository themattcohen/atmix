# RAG System Architecture Design
## Sara Sharp Knowledge Base - Retrieval-Augmented Generation System

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Architecture Design - Ready for Implementation
**Author:** System Architect

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Embedding Strategy](#3-embedding-strategy)
4. [Vector Store Design](#4-vector-store-design)
5. [Retrieval API Design](#5-retrieval-api-design)
6. [Quality and Testing Strategy](#6-quality-and-testing-strategy)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Appendices](#8-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the architecture for a local-first RAG (Retrieval-Augmented Generation) system to enable semantic search and context-aware retrieval from Sara Sharp's knowledge base, comprising 60+ YouTube transcripts, 20+ blog articles, and future content from podcasts, books, LinkedIn, and courses.

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Local-First** | Core functionality operates without external API dependencies |
| **Scalable** | Designed to handle 10x growth (500+ documents, 5000+ chunks) |
| **Low Latency** | Sub-100ms retrieval for interactive applications |
| **Quality-Focused** | Retrieval quality metrics embedded in design |
| **Minimal Dependencies** | Python-native with lightweight, well-maintained libraries |

### 1.3 Current Data Profile

| Source | Documents | Chunks (est.) | Status |
|--------|-----------|---------------|--------|
| YouTube Transcripts | 65 | ~500 | Extracted |
| Blog Articles | 20 | 22 | Chunked |
| Podcasts | 50+ | ~400 | Pending |
| Book Chapters | 10-20 | ~150 | Pending |
| LinkedIn Posts | 100+ | ~200 | Pending |
| Deal Academy Lessons | 50+ | ~400 | Pending |
| Media Features | 20+ | ~50 | Pending |
| **Total (Current)** | **85** | **~520** | - |
| **Total (Projected)** | **315+** | **~1,700** | - |

---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
+------------------------------------------------------------------+
|                        RAG SYSTEM OVERVIEW                        |
+------------------------------------------------------------------+

                    +-------------------+
                    |   Content Sources |
                    +-------------------+
                    | YouTube | Blog    |
                    | Podcast | Book    |
                    | LinkedIn| Course  |
                    +---------+---------+
                              |
                              v
+------------------------------------------------------------------+
|                      INGESTION PIPELINE                           |
+------------------------------------------------------------------+
|  +-------------+    +-------------+    +-------------+            |
|  |  Extractor  | -> | Normalizer  | -> |   Chunker   |            |
|  |  (per-src)  |    | (unified)   |    | (semantic)  |            |
|  +-------------+    +-------------+    +-------------+            |
|        |                  |                  |                    |
|        v                  v                  v                    |
|  data/raw/          data/normalized/   data/rag/chunks/           |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      EMBEDDING PIPELINE                           |
+------------------------------------------------------------------+
|  +-------------+    +-------------+    +-------------+            |
|  |   Chunk     | -> |  Embedding  | -> |  Vector     |            |
|  |   Loader    |    |   Model     |    |  Writer     |            |
|  +-------------+    +-------------+    +-------------+            |
|                           |                  |                    |
|                           |                  v                    |
|              sentence-transformers      data/rag/embeddings/      |
|                (all-MiniLM-L6-v2)       data/rag/indexes/         |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      RETRIEVAL LAYER                              |
+------------------------------------------------------------------+
|  +-------------+    +-------------+    +-------------+            |
|  |   Query     | -> |   Vector    | -> |   Result    |            |
|  |   Encoder   |    |   Search    |    |   Ranker    |            |
|  +-------------+    +-------------+    +-------------+            |
|        ^                                      |                   |
|        |              FAISS Index             v                   |
|  +-------------+                        +-------------+           |
|  |   Query     |                        |  Response   |           |
|  |   API       | <--------------------- |  Formatter  |           |
|  +-------------+                        +-------------+           |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      CLIENT APPLICATIONS                          |
+------------------------------------------------------------------+
|        Chatbot        |        CLI        |        Web UI         |
+------------------------------------------------------------------+
```

### 2.2 Data Flow Diagram

```
                         DATA FLOW: Document to Retrieval
                         ================================

  [1. EXTRACTION]
       |
       v
  +------------------+     +------------------+
  | Raw Document     |     | Metadata         |
  | (transcript,     | --> | (title, url,     |
  |  article, etc.)  |     |  date, author)   |
  +------------------+     +------------------+
       |                          |
       v                          v
  +------------------------------------------+
  | [2. NORMALIZATION]                       |
  | - Unified schema application             |
  | - Field standardization                  |
  | - Quality scoring                        |
  +------------------------------------------+
       |
       v
  +------------------+
  | Normalized Doc   |   data/normalized/documents/
  | (JSON)           |   blog_0642e27a6564.json
  +------------------+
       |
       v
  +------------------------------------------+
  | [3. CHUNKING]                            |
  | - Sentence-boundary splitting            |
  | - 800-word target, 150-word overlap      |
  | - Context preservation                   |
  +------------------------------------------+
       |
       v
  +------------------+
  | Chunks           |   data/rag/chunks/
  | (JSON)           |   chunk_0642e27a6564_0000.json
  +------------------+
       |
       v
  +------------------------------------------+
  | [4. EMBEDDING]                           |
  | - Batch text encoding                    |
  | - 384-dimension vectors                  |
  | - Metadata association                   |
  +------------------------------------------+
       |
       +----------+----------+
       |                     |
       v                     v
  +------------------+  +------------------+
  | Embeddings       |  | Vector Index     |
  | (Parquet)        |  | (FAISS)          |
  | emb_20260126.pq  |  | index_flat.faiss |
  +------------------+  +------------------+
       |                     |
       +----------+----------+
                  |
                  v
  +------------------------------------------+
  | [5. RETRIEVAL]                           |
  | Query -> Encode -> Search -> Rank        |
  +------------------------------------------+
       |
       v
  +------------------+
  | Retrieved Chunks |
  | + Metadata       |
  | + Scores         |
  +------------------+
```

### 2.3 Technology Selection

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Embedding Model** | `sentence-transformers/all-MiniLM-L6-v2` | Best balance of quality/speed, 384-dim, local execution, 22M parameters |
| **Vector Store** | FAISS (Flat + IVF) | Facebook's proven library, local-first, no server, fast exact/approximate search |
| **Persistence** | Apache Parquet | Columnar format, efficient for embeddings, pandas integration |
| **API Framework** | FastAPI | Modern async Python, automatic OpenAPI docs, lightweight |
| **Configuration** | Pydantic + YAML | Type-safe config, validation, easy editing |
| **Testing** | pytest + hypothesis | Property-based testing for retrieval quality |

### 2.4 Directory Structure

```
data/rag/
├── chunks/                      # Individual chunk JSON files
│   ├── chunk_*.json
│   └── chunks_summary.json      # Chunk statistics
│
├── embeddings/                  # Computed embeddings
│   ├── embeddings_v1_20260126.parquet  # Versioned embeddings
│   ├── embeddings_latest.parquet       # Symlink to latest
│   └── embedding_config.json           # Model/dimension metadata
│
├── indexes/                     # FAISS indexes
│   ├── index_flat.faiss         # Exact search (small datasets)
│   ├── index_ivf.faiss          # Approximate search (large datasets)
│   ├── index_metadata.json      # Index configuration
│   └── chunk_id_mapping.json    # FAISS ID -> chunk_id mapping
│
└── cache/                       # Query cache
    └── query_cache.db           # SQLite query cache
```

---

## 3. Embedding Strategy

### 3.1 Model Selection Analysis

| Model | Dimensions | Size | Speed | Quality (MTEB) | Local | Decision |
|-------|------------|------|-------|----------------|-------|----------|
| `all-MiniLM-L6-v2` | 384 | 22MB | Fast | 0.63 | Yes | **Selected** |
| `all-mpnet-base-v2` | 768 | 420MB | Medium | 0.65 | Yes | Alternative |
| `text-embedding-3-small` | 1536 | API | Fast | 0.68 | No | Future option |
| `bge-small-en-v1.5` | 384 | 33MB | Fast | 0.64 | Yes | Alternative |

**Selection: `all-MiniLM-L6-v2`**

Rationale:
- **Local-first**: No API dependency, runs entirely on CPU
- **Efficient**: 384 dimensions provide excellent quality/storage trade-off
- **Fast**: ~14ms per sentence on CPU, enabling real-time queries
- **Proven**: Widely used, well-documented, stable library
- **Sufficient Quality**: 0.63 MTEB score adequate for domain-specific retrieval

### 3.2 Chunk Size Optimization

Based on content analysis:

| Content Type | Avg Words/Doc | Optimal Chunk | Overlap | Rationale |
|--------------|---------------|---------------|---------|-----------|
| YouTube Transcript | 2,500 | 800 words | 150 | Conversational, topic shifts |
| Blog Article | 800 | 800 words | 150 | Self-contained, can be single chunk |
| Podcast Episode | 4,000 | 800 words | 150 | Long-form, needs context |
| Book Chapter | 3,000 | 600 words | 120 | Dense content, tighter chunks |
| LinkedIn Post | 200 | Full post | 0 | Already concise |
| Course Lesson | 1,200 | 800 words | 150 | Structured content |

**Default Configuration:**
```yaml
chunking:
  default_size: 800       # Target words per chunk
  default_overlap: 150    # Words of overlap
  min_chunk_size: 50      # Minimum viable chunk
  max_chunk_size: 1200    # Maximum before split
  sentence_boundary: true # Respect sentence ends
  context_chars: 200      # Context from neighbors
```

### 3.3 Embedding Configuration

```python
# config/embedding_config.py

EMBEDDING_CONFIG = {
    "model_name": "sentence-transformers/all-MiniLM-L6-v2",
    "dimensions": 384,
    "max_seq_length": 256,  # Token limit
    "batch_size": 64,       # Embedding batch size
    "normalize": True,      # L2 normalize vectors
    "device": "cpu",        # CPU for portability
    "cache_folder": "data/rag/model_cache"
}
```

### 3.4 Embedding Storage Format

**Parquet Schema:**

```python
import pyarrow as pa

EMBEDDING_SCHEMA = pa.schema([
    ("chunk_id", pa.string()),           # Primary key
    ("document_id", pa.string()),        # Parent document
    ("source", pa.string()),             # youtube/blog/podcast/etc.
    ("source_type", pa.string()),        # video_transcript/blog_article/etc.
    ("title", pa.string()),              # Document title
    ("content", pa.string()),            # Chunk text (for debugging)
    ("word_count", pa.int32()),          # Chunk word count
    ("url", pa.string()),                # Source URL
    ("published_date", pa.string()),     # ISO8601 date
    ("position_index", pa.int32()),      # Chunk position
    ("position_total", pa.int32()),      # Total chunks in doc
    ("embedding", pa.list_(pa.float32(), 384)),  # Vector
    ("embedded_at", pa.timestamp("us")), # Embedding timestamp
    ("model_version", pa.string())       # Model identifier
])
```

### 3.5 Embedding Pipeline

```
                    EMBEDDING PIPELINE FLOW
                    =======================

  +------------------+
  |  Chunk Files     |
  |  (JSON)          |
  +------------------+
          |
          v
  +------------------+
  |  Chunk Loader    |
  |  - Validate      |
  |  - Deduplicate   |
  |  - Batch         |
  +------------------+
          |
          v (batches of 64)
  +------------------+
  |  Text Processor  |
  |  - Truncation    |
  |  - Normalization |
  +------------------+
          |
          v
  +------------------+
  |  Embedding Model |
  |  (MiniLM-L6-v2)  |
  +------------------+
          |
          v
  +------------------+
  |  Vector Writer   |
  |  - Parquet file  |
  |  - FAISS index   |
  +------------------+
          |
          v
  +------------------+
  |  Verification    |
  |  - Dimension     |
  |  - Coverage      |
  |  - Quality       |
  +------------------+
```

---

## 4. Vector Store Design

### 4.1 FAISS Index Selection

| Dataset Size | Index Type | Memory | Search Time | Build Time | Use Case |
|--------------|------------|--------|-------------|------------|----------|
| < 5,000 | `IndexFlatIP` | 7.5MB | 1-5ms | Instant | **Current** |
| 5,000-50,000 | `IndexIVFFlat` | 8MB | 1-3ms | 10s | Future |
| 50,000-500,000 | `IndexIVFPQ` | 2MB | 1-2ms | 60s | Scale |

**Current Selection: `IndexFlatIP` (Inner Product / Cosine Similarity)**

Rationale:
- Exact search (no approximation error)
- Fastest for < 5,000 vectors
- No training required
- Simple to maintain and debug

### 4.2 Index Architecture

```
                    FAISS INDEX ARCHITECTURE
                    ========================

  +--------------------------------------------------+
  |                  PRIMARY INDEX                    |
  |                  (IndexFlatIP)                    |
  +--------------------------------------------------+
  |  Vectors: ~1,700 (projected)                     |
  |  Dimensions: 384                                  |
  |  Memory: ~2.6 MB                                  |
  |  Search: Exact cosine similarity                  |
  +--------------------------------------------------+
               |                    |
               v                    v
  +---------------------+  +---------------------+
  |  ID Mapping         |  |  Metadata Store     |
  |  (chunk_id_map.json)|  |  (embeddings.pq)    |
  +---------------------+  +---------------------+
  |  FAISS_ID -> chunk_id|  |  chunk_id -> {      |
  |  0 -> chunk_xxx_0000 |  |    source,          |
  |  1 -> chunk_xxx_0001 |  |    title,           |
  |  ...                 |  |    url, ...         |
  |                      |  |  }                  |
  +---------------------+  +---------------------+
```

### 4.3 Index Configuration

```python
# config/faiss_config.py

FAISS_CONFIG = {
    # Primary index settings
    "index_type": "flat",           # flat | ivf | ivfpq
    "metric": "inner_product",      # Cosine sim with normalized vectors
    "dimensions": 384,

    # IVF settings (for future scaling)
    "ivf_nlist": 100,               # Number of clusters
    "ivf_nprobe": 10,               # Clusters to search

    # Persistence
    "index_file": "data/rag/indexes/index_flat.faiss",
    "mapping_file": "data/rag/indexes/chunk_id_mapping.json",
    "metadata_file": "data/rag/embeddings/embeddings_latest.parquet",

    # Search defaults
    "default_top_k": 10,
    "max_top_k": 100,
    "score_threshold": 0.3         # Minimum similarity for results
}
```

### 4.4 Persistence Strategy

```
                    PERSISTENCE STRATEGY
                    ====================

  WRITE PATH (Indexing)
  ---------------------

  1. Load chunks from data/rag/chunks/
  2. Generate embeddings in batches
  3. Write embeddings to Parquet (append-friendly)
  4. Build/update FAISS index
  5. Save index to disk
  6. Update ID mapping JSON


  READ PATH (Querying)
  --------------------

  1. Load FAISS index into memory (once at startup)
  2. Load ID mapping into memory
  3. Load Parquet metadata (lazy/on-demand)
  4. Query flow:
     a. Encode query -> vector
     b. FAISS search -> FAISS IDs + scores
     c. Map FAISS IDs -> chunk_ids
     d. Fetch metadata from Parquet
     e. Return results


  UPDATE PATH (Incremental)
  -------------------------

  1. Identify new/changed chunks
  2. Generate embeddings for new chunks
  3. Append to Parquet file
  4. Rebuild FAISS index (small dataset: full rebuild)
  5. Update ID mapping
```

### 4.5 Memory Management

| Component | Memory (Current) | Memory (10x Scale) | Strategy |
|-----------|------------------|-------------------|----------|
| FAISS Index | 2.6 MB | 26 MB | In-memory, acceptable |
| ID Mapping | 0.1 MB | 1 MB | In-memory JSON |
| Metadata | 5 MB | 50 MB | Lazy load from Parquet |
| Embedding Model | 90 MB | 90 MB | Shared singleton |
| **Total** | **~100 MB** | **~170 MB** | Fits in edge devices |

---

## 5. Retrieval API Design

### 5.1 API Architecture

```
                    API ARCHITECTURE
                    ================

  +------------------------------------------------------------------+
  |                        FastAPI Application                        |
  +------------------------------------------------------------------+
  |                                                                   |
  |  +-------------------+  +-------------------+  +--------------+   |
  |  |  /search          |  |  /health          |  |  /stats      |   |
  |  |  POST             |  |  GET              |  |  GET         |   |
  |  +-------------------+  +-------------------+  +--------------+   |
  |           |                                                       |
  |           v                                                       |
  |  +-----------------------------------------------------------+   |
  |  |                    Request Validation                      |   |
  |  |                    (Pydantic Models)                       |   |
  |  +-----------------------------------------------------------+   |
  |           |                                                       |
  |           v                                                       |
  |  +-----------------------------------------------------------+   |
  |  |                    Retrieval Service                       |   |
  |  |  - Query encoding                                          |   |
  |  |  - Vector search                                           |   |
  |  |  - Result ranking                                          |   |
  |  |  - Metadata enrichment                                     |   |
  |  +-----------------------------------------------------------+   |
  |           |                                                       |
  |           v                                                       |
  |  +-------------------+  +-------------------+                     |
  |  |  FAISS Index      |  |  Parquet Store    |                     |
  |  |  (Vectors)        |  |  (Metadata)       |                     |
  |  +-------------------+  +-------------------+                     |
  |                                                                   |
  +------------------------------------------------------------------+
```

### 5.2 Endpoint Specifications

#### 5.2.1 Search Endpoint

**`POST /api/v1/search`**

Request:
```json
{
  "query": "How do I structure an earnout in an acquisition?",
  "top_k": 5,
  "filters": {
    "sources": ["youtube", "blog"],
    "source_types": ["video_transcript", "blog_article"],
    "date_from": "2024-01-01",
    "date_to": "2026-12-31"
  },
  "options": {
    "include_context": true,
    "include_scores": true,
    "score_threshold": 0.4,
    "deduplicate_docs": false
  }
}
```

Response:
```json
{
  "query": "How do I structure an earnout in an acquisition?",
  "total_results": 5,
  "search_time_ms": 45,
  "results": [
    {
      "chunk_id": "chunk_abc123_0003",
      "document_id": "youtube_abc123def456",
      "score": 0.847,
      "rank": 1,
      "content": "When structuring an earnout, you want to make sure...",
      "metadata": {
        "source": "youtube",
        "source_type": "video_transcript",
        "title": "Earnout Structures Explained",
        "url": "https://www.youtube.com/watch?v=abc123",
        "published_date": "2025-06-15",
        "author": "Sara Sharp"
      },
      "position": {
        "index": 3,
        "total_chunks": 8
      },
      "context": {
        "preceding_text": "...and that's why valuation matters. ",
        "following_text": " The key metrics to consider..."
      }
    }
  ],
  "debug": {
    "model_used": "all-MiniLM-L6-v2",
    "index_type": "flat",
    "total_indexed": 1700
  }
}
```

#### 5.2.2 Health Endpoint

**`GET /api/v1/health`**

Response:
```json
{
  "status": "healthy",
  "components": {
    "faiss_index": {
      "status": "loaded",
      "vector_count": 1700,
      "dimensions": 384
    },
    "embedding_model": {
      "status": "loaded",
      "model": "all-MiniLM-L6-v2"
    },
    "metadata_store": {
      "status": "available",
      "chunk_count": 1700
    }
  },
  "uptime_seconds": 3600,
  "version": "1.0.0"
}
```

#### 5.2.3 Statistics Endpoint

**`GET /api/v1/stats`**

Response:
```json
{
  "index_stats": {
    "total_documents": 315,
    "total_chunks": 1700,
    "index_size_bytes": 2621440,
    "last_updated": "2026-01-26T18:30:00Z"
  },
  "source_distribution": {
    "youtube": {"documents": 65, "chunks": 520},
    "blog": {"documents": 20, "chunks": 22},
    "podcast": {"documents": 50, "chunks": 400},
    "book": {"documents": 20, "chunks": 150},
    "linkedin": {"documents": 100, "chunks": 200},
    "deal_academy": {"documents": 50, "chunks": 358},
    "media": {"documents": 10, "chunks": 50}
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "dimensions": 384,
    "normalized": true
  }
}
```

### 5.3 Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Natural language search query |
| `top_k` | int | 10 | Number of results to return (1-100) |
| `filters.sources` | string[] | all | Filter by source: youtube, blog, podcast, book, linkedin, deal_academy, media |
| `filters.source_types` | string[] | all | Filter by content type |
| `filters.date_from` | date | null | Minimum publication date |
| `filters.date_to` | date | null | Maximum publication date |
| `options.include_context` | bool | true | Include preceding/following text |
| `options.include_scores` | bool | true | Include similarity scores |
| `options.score_threshold` | float | 0.3 | Minimum similarity threshold |
| `options.deduplicate_docs` | bool | false | Return only best chunk per document |

### 5.4 Error Responses

```json
// 400 Bad Request
{
  "error": "validation_error",
  "message": "Query cannot be empty",
  "details": {"field": "query", "constraint": "min_length=1"}
}

// 500 Internal Server Error
{
  "error": "index_error",
  "message": "FAISS index not loaded",
  "details": {"component": "faiss_index", "status": "unavailable"}
}
```

### 5.5 Pydantic Models

```python
# models/api_models.py

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class SearchFilters(BaseModel):
    sources: Optional[List[str]] = None
    source_types: Optional[List[str]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None

class SearchOptions(BaseModel):
    include_context: bool = True
    include_scores: bool = True
    score_threshold: float = Field(0.3, ge=0.0, le=1.0)
    deduplicate_docs: bool = False

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(10, ge=1, le=100)
    filters: Optional[SearchFilters] = None
    options: Optional[SearchOptions] = None

class ChunkMetadata(BaseModel):
    source: str
    source_type: str
    title: str
    url: Optional[str]
    published_date: Optional[str]
    author: Optional[str]

class ChunkPosition(BaseModel):
    index: int
    total_chunks: int

class ChunkContext(BaseModel):
    preceding_text: Optional[str]
    following_text: Optional[str]

class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    score: float
    rank: int
    content: str
    metadata: ChunkMetadata
    position: ChunkPosition
    context: Optional[ChunkContext]

class SearchResponse(BaseModel):
    query: str
    total_results: int
    search_time_ms: float
    results: List[SearchResult]
```

---

## 6. Quality and Testing Strategy

### 6.1 Retrieval Quality Metrics

| Metric | Description | Target | Measurement |
|--------|-------------|--------|-------------|
| **MRR@10** | Mean Reciprocal Rank at 10 | > 0.6 | Test queries with known answers |
| **Recall@10** | Relevant docs in top 10 | > 0.8 | Ground truth comparison |
| **Precision@5** | Relevant docs in top 5 | > 0.7 | Manual evaluation |
| **Latency P50** | Median query latency | < 50ms | Performance testing |
| **Latency P99** | 99th percentile latency | < 200ms | Performance testing |
| **Coverage** | Chunks with embeddings | 100% | Automated check |

### 6.2 Test Query Set

```yaml
# tests/fixtures/test_queries.yaml

ground_truth_queries:
  - query: "How do I structure an earnout?"
    expected_sources: ["youtube", "blog"]
    expected_topics: ["earnout", "acquisition", "deal structure"]
    relevant_chunks:
      - "chunk_earnout_video_0002"
      - "chunk_earnout_blog_0001"

  - query: "What are the key terms in a letter of intent?"
    expected_sources: ["youtube", "blog", "deal_academy"]
    expected_topics: ["LOI", "letter of intent", "term sheet"]
    relevant_chunks:
      - "chunk_loi_basics_0001"
      - "chunk_loi_terms_0003"

  - query: "How do I retain employees after an acquisition?"
    expected_sources: ["blog", "youtube"]
    expected_topics: ["retention", "employees", "acquisition"]
    relevant_chunks:
      - "chunk_employee_retention_0000"

  - query: "What kills deals before closing?"
    expected_sources: ["youtube"]
    expected_topics: ["deal killer", "closing", "failed deals"]
    relevant_chunks:
      - "chunk_deal_killers_0002"
      - "chunk_deal_killers_0003"

  - query: "How to value an accounting practice?"
    expected_sources: ["youtube", "deal_academy"]
    expected_topics: ["valuation", "accounting", "practice"]
    relevant_chunks:
      - "chunk_valuation_basics_0001"

edge_case_queries:
  - query: ""  # Empty query
    expected_error: "validation_error"

  - query: "a" * 1001  # Exceeds max length
    expected_error: "validation_error"

  - query: "quantum physics dark matter"  # Out of domain
    expected_results: 0  # Or low-scoring results

  - query: "Sara Sharp"  # Named entity
    expected_sources: ["any"]
    min_results: 5
```

### 6.3 Test Categories

```
                    TEST PYRAMID
                    ============

                        /\
                       /  \
                      / E2E \        Integration tests
                     /  Tests\       with real index
                    /----------\
                   /            \
                  / Integration  \   API endpoint tests
                 /     Tests      \  with mock index
                /------------------\
               /                    \
              /     Unit Tests       \  Individual components
             /                        \
            ----------------------------
```

#### 6.3.1 Unit Tests

```python
# tests/unit/test_chunker.py

import pytest
from scripts.transform.chunker import create_chunks, ChunkConfig

class TestChunker:
    def test_single_chunk_short_doc(self):
        """Short documents should become single chunk."""
        doc = Document(id="test", content="Short content here.")
        chunks = create_chunks(doc, ChunkConfig(chunk_size=100))
        assert len(chunks) == 1

    def test_sentence_boundary_respected(self):
        """Chunks should not split mid-sentence."""
        doc = Document(id="test", content="First sentence. Second sentence.")
        chunks = create_chunks(doc, ChunkConfig(chunk_size=3))  # 3 words
        assert chunks[0].content.endswith(".")

    def test_overlap_preserved(self):
        """Consecutive chunks should have overlap."""
        doc = Document(id="test", content=" ".join(["word"] * 100))
        chunks = create_chunks(doc, ChunkConfig(chunk_size=20, overlap=5))
        # Check overlap exists between consecutive chunks
        for i in range(len(chunks) - 1):
            overlap = set(chunks[i].content.split()[-5:]) & \
                      set(chunks[i+1].content.split()[:5])
            assert len(overlap) > 0
```

#### 6.3.2 Integration Tests

```python
# tests/integration/test_retrieval.py

import pytest
from src.retrieval import RetrievalService

@pytest.fixture
def retrieval_service():
    """Load service with test index."""
    return RetrievalService(
        index_path="tests/fixtures/test_index.faiss",
        embeddings_path="tests/fixtures/test_embeddings.parquet"
    )

class TestRetrieval:
    def test_basic_search(self, retrieval_service):
        """Basic search returns results."""
        results = retrieval_service.search("earnout structure", top_k=5)
        assert len(results) > 0
        assert all(r.score >= 0 for r in results)

    def test_source_filter(self, retrieval_service):
        """Source filter restricts results."""
        results = retrieval_service.search(
            "acquisition",
            top_k=10,
            filters={"sources": ["youtube"]}
        )
        assert all(r.metadata.source == "youtube" for r in results)

    def test_score_threshold(self, retrieval_service):
        """Score threshold filters low-quality results."""
        results = retrieval_service.search(
            "deal structure",
            top_k=10,
            score_threshold=0.5
        )
        assert all(r.score >= 0.5 for r in results)
```

#### 6.3.3 E2E Tests

```python
# tests/e2e/test_api.py

import pytest
from fastapi.testclient import TestClient
from src.api import app

@pytest.fixture
def client():
    return TestClient(app)

class TestAPI:
    def test_search_endpoint(self, client):
        """Search endpoint returns valid response."""
        response = client.post("/api/v1/search", json={
            "query": "How do I structure an earnout?",
            "top_k": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) <= 5

    def test_health_endpoint(self, client):
        """Health endpoint indicates system status."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
```

### 6.4 Performance Benchmarks

```python
# tests/benchmarks/test_performance.py

import pytest
import time
from src.retrieval import RetrievalService

class TestPerformance:
    @pytest.fixture
    def service(self):
        return RetrievalService()

    def test_search_latency_p50(self, service, benchmark_queries):
        """Median search latency under 50ms."""
        latencies = []
        for query in benchmark_queries:
            start = time.perf_counter()
            service.search(query, top_k=10)
            latencies.append((time.perf_counter() - start) * 1000)

        p50 = sorted(latencies)[len(latencies) // 2]
        assert p50 < 50, f"P50 latency {p50}ms exceeds 50ms target"

    def test_search_latency_p99(self, service, benchmark_queries):
        """99th percentile latency under 200ms."""
        latencies = []
        for query in benchmark_queries * 10:  # 10x queries
            start = time.perf_counter()
            service.search(query, top_k=10)
            latencies.append((time.perf_counter() - start) * 1000)

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 200, f"P99 latency {p99}ms exceeds 200ms target"

    def test_concurrent_queries(self, service):
        """Handle 10 concurrent queries."""
        import concurrent.futures

        def search_query(q):
            return service.search(q, top_k=5)

        queries = ["earnout", "LOI", "valuation", "retention", "deal"] * 2
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(search_query, queries))

        assert all(r is not None for r in results)
```

### 6.5 Quality Evaluation Pipeline

```
                QUALITY EVALUATION PIPELINE
                ===========================

  +----------------+     +----------------+     +----------------+
  |  Ground Truth  | --> |  Search        | --> |  Metrics       |
  |  Queries       |     |  Execution     |     |  Calculation   |
  +----------------+     +----------------+     +----------------+
         |                      |                      |
         v                      v                      v
  +----------------+     +----------------+     +----------------+
  |  Expected      |     |  Actual        |     |  MRR, Recall,  |
  |  Results       |     |  Results       |     |  Precision     |
  +----------------+     +----------------+     +----------------+
                                |                      |
                                v                      v
                         +----------------+     +----------------+
                         |  Manual        |     |  Report        |
                         |  Review        |     |  Generation    |
                         +----------------+     +----------------+
```

### 6.6 Continuous Quality Monitoring

```yaml
# config/quality_monitoring.yaml

quality_monitoring:
  # Scheduled evaluation
  schedule: "daily"

  # Alert thresholds
  alerts:
    mrr_drop: 0.1          # Alert if MRR drops 10%
    latency_spike: 2.0     # Alert if latency doubles
    coverage_gap: 0.05     # Alert if coverage drops 5%

  # Test query refresh
  query_refresh:
    add_new_queries: "weekly"
    review_ground_truth: "monthly"

  # Metrics storage
  metrics_retention_days: 90
```

---

## 7. Implementation Roadmap

### 7.1 Phase Overview

```
                    IMPLEMENTATION PHASES
                    =====================

  Phase 1: Core Infrastructure (Week 1)
  ├── Embedding pipeline setup
  ├── FAISS index creation
  ├── Basic search functionality
  └── Persistence layer

  Phase 2: API Development (Week 2)
  ├── FastAPI application
  ├── Search endpoint
  ├── Health/stats endpoints
  └── Error handling

  Phase 3: Quality & Testing (Week 3)
  ├── Test query set development
  ├── Quality metrics implementation
  ├── Performance benchmarks
  └── CI/CD integration

  Phase 4: Integration & Polish (Week 4)
  ├── Client SDK/examples
  ├── Documentation
  ├── Monitoring setup
  └── Production hardening
```

### 7.2 Detailed Task Breakdown

#### Phase 1: Core Infrastructure

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Install sentence-transformers | P0 | 1h | None |
| Create embedding pipeline script | P0 | 4h | Chunks exist |
| Implement FAISS index builder | P0 | 3h | Embeddings |
| Create Parquet writer | P0 | 2h | Embeddings |
| Build ID mapping system | P0 | 2h | Index |
| Implement basic search function | P0 | 3h | Index + mapping |
| Add persistence/loading | P0 | 2h | All above |
| Create config system | P1 | 2h | None |

#### Phase 2: API Development

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| FastAPI app skeleton | P0 | 1h | None |
| Search endpoint | P0 | 3h | Search function |
| Pydantic models | P0 | 2h | API design |
| Filter implementation | P0 | 3h | Search endpoint |
| Health endpoint | P1 | 1h | App skeleton |
| Stats endpoint | P1 | 2h | Index metadata |
| Error handling | P0 | 2h | All endpoints |
| OpenAPI documentation | P1 | 1h | All endpoints |

#### Phase 3: Quality & Testing

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Test query set creation | P0 | 4h | Domain knowledge |
| Unit test suite | P0 | 4h | Core functions |
| Integration tests | P0 | 3h | API + index |
| MRR/Recall metrics | P1 | 3h | Test queries |
| Performance benchmarks | P1 | 2h | Working system |
| pytest configuration | P0 | 1h | Tests written |
| CI pipeline setup | P1 | 2h | All tests |

#### Phase 4: Integration & Polish

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Python client SDK | P2 | 3h | API stable |
| Example notebooks | P2 | 2h | SDK |
| User documentation | P1 | 3h | All features |
| Logging enhancement | P1 | 2h | All components |
| Performance tuning | P1 | 3h | Benchmarks |
| Deployment guide | P1 | 2h | Documentation |

### 7.3 File Structure After Implementation

```
/Users/matt/Documents/someday/
├── data/
│   ├── raw/                    # Existing
│   ├── normalized/             # Existing
│   └── rag/
│       ├── chunks/             # Existing
│       ├── embeddings/         # NEW
│       │   ├── embeddings_v1_20260126.parquet
│       │   └── embedding_config.json
│       ├── indexes/            # NEW
│       │   ├── index_flat.faiss
│       │   └── chunk_id_mapping.json
│       └── cache/              # NEW
│           └── query_cache.db
│
├── src/                        # NEW - Source code
│   ├── __init__.py
│   ├── embedding/
│   │   ├── __init__.py
│   │   ├── embedder.py         # Embedding generation
│   │   └── config.py           # Embedding config
│   ├── indexing/
│   │   ├── __init__.py
│   │   ├── faiss_index.py      # FAISS operations
│   │   └── persistence.py      # Load/save
│   ├── retrieval/
│   │   ├── __init__.py
│   │   ├── service.py          # Main retrieval logic
│   │   └── filters.py          # Filter implementation
│   └── api/
│       ├── __init__.py
│       ├── main.py             # FastAPI app
│       ├── routes.py           # API endpoints
│       └── models.py           # Pydantic models
│
├── scripts/                    # Existing + additions
│   ├── extract/                # Existing
│   ├── transform/              # Existing
│   ├── validate/               # Existing
│   ├── orchestrate/            # Existing
│   └── rag/                    # NEW
│       ├── build_embeddings.py
│       ├── build_index.py
│       └── run_api.py
│
├── tests/                      # NEW
│   ├── unit/
│   │   ├── test_embedder.py
│   │   ├── test_indexing.py
│   │   └── test_retrieval.py
│   ├── integration/
│   │   └── test_api.py
│   ├── benchmarks/
│   │   └── test_performance.py
│   └── fixtures/
│       ├── test_queries.yaml
│       └── test_index.faiss
│
├── config/                     # Existing + additions
│   ├── sources.yaml            # Existing
│   ├── schemas.yaml            # Existing
│   ├── quality_rules.yaml      # Existing
│   └── rag_config.yaml         # NEW
│
├── docs/                       # Existing + additions
│   ├── RAG_SYSTEM_DESIGN.md    # This document
│   └── API_REFERENCE.md        # NEW
│
└── requirements.txt            # Updated with new deps
```

---

## 8. Appendices

### 8.1 Dependency List

```
# requirements.txt additions for RAG system

# Embedding
sentence-transformers>=2.2.0
torch>=2.0.0

# Vector store
faiss-cpu>=1.7.4

# Data storage
pyarrow>=14.0.0
pandas>=2.0.0

# API
fastapi>=0.100.0
uvicorn>=0.22.0
pydantic>=2.0.0

# Testing
pytest>=7.0.0
pytest-cov>=4.0.0
pytest-asyncio>=0.21.0
httpx>=0.24.0

# Utilities
python-dotenv>=1.0.0
pyyaml>=6.0
```

### 8.2 Configuration Reference

```yaml
# config/rag_config.yaml

embedding:
  model_name: "sentence-transformers/all-MiniLM-L6-v2"
  dimensions: 384
  batch_size: 64
  max_seq_length: 256
  normalize: true
  device: "cpu"
  cache_folder: "data/rag/model_cache"

faiss:
  index_type: "flat"
  metric: "inner_product"
  index_file: "data/rag/indexes/index_flat.faiss"
  mapping_file: "data/rag/indexes/chunk_id_mapping.json"

retrieval:
  default_top_k: 10
  max_top_k: 100
  score_threshold: 0.3
  include_context: true

api:
  host: "0.0.0.0"
  port: 8000
  workers: 1
  log_level: "info"

storage:
  embeddings_dir: "data/rag/embeddings"
  indexes_dir: "data/rag/indexes"
  cache_dir: "data/rag/cache"
```

### 8.3 API Client Example

```python
# Example: Python client usage

import requests

class SaraKnowledgeClient:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url

    def search(self, query, top_k=10, sources=None, score_threshold=0.3):
        """Search the knowledge base."""
        payload = {
            "query": query,
            "top_k": top_k,
            "filters": {"sources": sources} if sources else None,
            "options": {"score_threshold": score_threshold}
        }
        response = requests.post(
            f"{self.base_url}/api/v1/search",
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def health(self):
        """Check system health."""
        response = requests.get(f"{self.base_url}/api/v1/health")
        return response.json()

# Usage
client = SaraKnowledgeClient()
results = client.search(
    "How do I structure an earnout?",
    top_k=5,
    sources=["youtube", "blog"]
)

for r in results["results"]:
    print(f"[{r['score']:.2f}] {r['metadata']['title']}")
    print(f"    {r['content'][:200]}...")
```

### 8.4 Glossary

| Term | Definition |
|------|------------|
| **RAG** | Retrieval-Augmented Generation - combining retrieval with LLM generation |
| **Embedding** | Dense vector representation of text for semantic similarity |
| **FAISS** | Facebook AI Similarity Search - efficient vector similarity library |
| **Chunk** | Segment of document optimized for retrieval (typically 500-1000 words) |
| **MRR** | Mean Reciprocal Rank - measures ranking quality |
| **Cosine Similarity** | Similarity metric for normalized vectors (angle-based) |
| **IVF** | Inverted File Index - approximate nearest neighbor method |
| **Parquet** | Columnar file format efficient for analytical workloads |

### 8.5 References

1. Sentence-Transformers Documentation: https://www.sbert.net/
2. FAISS Documentation: https://github.com/facebookresearch/faiss/wiki
3. FastAPI Documentation: https://fastapi.tiangolo.com/
4. Chunking Best Practices: https://www.pinecone.io/learn/chunking-strategies/
5. Embedding Model Benchmarks (MTEB): https://huggingface.co/spaces/mteb/leaderboard

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | System Architect | Initial design document |

---

**Document Status:** DESIGN COMPLETE - Ready for Implementation Review

**Next Steps:**
1. Stakeholder review and approval
2. Dependency installation and environment setup
3. Phase 1 implementation kickoff
4. Weekly progress reviews against roadmap
