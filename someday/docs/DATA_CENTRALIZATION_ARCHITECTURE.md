# Data Centralization Architecture
## Sara Sharp Knowledge Base - Unified Data Pipeline

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Architecture Design - Ready for Implementation

---

## 1. Executive Summary

This document defines the architecture for centralizing all content from 7 data sources into a unified, RAG-ready knowledge base. The design prioritizes:

- **Consistency**: Standardized schemas and naming conventions across all sources
- **Incremental Updates**: Track extraction state to avoid redundant work
- **Quality Gates**: Validation at ingestion and transformation stages
- **RAG Optimization**: Pre-chunked, normalized output ready for vector databases

---

## 2. Directory Structure

```
/Users/matt/Documents/someday/
├── data/                                    # Centralized data root
│   ├── raw/                                 # Original extracted content
│   │   ├── youtube/                         # YouTube transcripts
│   │   │   ├── captions/                    # VTT/SRT files
│   │   │   └── metadata/                    # Video metadata JSON
│   │   ├── blog/                            # SK&S blog articles
│   │   │   └── articles/                    # Individual article JSON
│   │   ├── podcast/                         # Podcast content
│   │   │   ├── audio/                       # Downloaded MP3 files
│   │   │   ├── transcripts/                 # Whisper transcriptions
│   │   │   └── metadata/                    # Episode metadata
│   │   ├── book/                            # Book PDF content
│   │   │   ├── pdf/                         # Source PDF files
│   │   │   └── extracted/                   # Extracted chapters
│   │   ├── linkedin/                        # LinkedIn exports
│   │   │   ├── exports/                     # Raw export files
│   │   │   └── processed/                   # Parsed posts
│   │   ├── deal_academy/                    # Teachable content
│   │   │   ├── courses/                     # Course structure
│   │   │   └── lessons/                     # Lesson content
│   │   └── media/                           # Media mentions
│   │       └── articles/                    # Scraped articles
│   │
│   ├── normalized/                          # Cleaned & standardized
│   │   └── documents/                       # Unified document format
│   │       ├── youtube_*.json
│   │       ├── blog_*.json
│   │       ├── podcast_*.json
│   │       ├── book_*.json
│   │       ├── linkedin_*.json
│   │       ├── course_*.json
│   │       └── media_*.json
│   │
│   ├── rag/                                 # RAG-ready output
│   │   ├── chunks/                          # Individual chunk files
│   │   │   └── chunk_*.json
│   │   ├── embeddings/                      # Pre-computed embeddings
│   │   │   └── embeddings_*.parquet
│   │   └── indexes/                         # Vector index snapshots
│   │       └── index_*.faiss
│   │
│   └── state/                               # Extraction state tracking
│       ├── extraction_state.json            # Master state file
│       ├── youtube_state.json               # Per-source state
│       ├── blog_state.json
│       ├── podcast_state.json
│       ├── book_state.json
│       ├── linkedin_state.json
│       ├── deal_academy_state.json
│       └── media_state.json
│
├── config/                                  # Configuration files
│   ├── sources.yaml                         # Source definitions
│   ├── schemas.yaml                         # Data schemas
│   └── quality_rules.yaml                   # Validation rules
│
├── scripts/                                 # Processing scripts
│   ├── extract/                             # Source-specific extractors
│   │   ├── youtube_extractor.py
│   │   ├── blog_extractor.py
│   │   ├── podcast_extractor.py
│   │   ├── book_extractor.py
│   │   ├── linkedin_extractor.py
│   │   ├── deal_academy_extractor.py
│   │   └── media_extractor.py
│   ├── transform/                           # Normalization scripts
│   │   ├── normalizer.py
│   │   └── chunker.py
│   ├── validate/                            # Quality validation
│   │   └── validator.py
│   └── orchestrate/                         # Pipeline orchestration
│       └── pipeline.py
│
├── docs/                                    # Documentation (existing)
│   ├── sara_content_extractor.py            # Current extractor (to be refactored)
│   ├── transcribe_audio.py                  # Audio transcription (to be integrated)
│   ├── sara_knowledge_base.json             # Current output (to be migrated)
│   ├── README.md                            # Current readme
│   └── linkedin-gtm-agent-prd.md            # PRD document
│
└── reports/                                 # Pipeline reports
    ├── extraction_report_*.json
    └── quality_report_*.json
```

---

## 3. Unified Data Schema

### 3.1 Base Document Schema

All normalized documents conform to this schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UnifiedDocument",
  "type": "object",
  "required": ["id", "source", "source_type", "content", "metadata", "extraction"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier",
      "pattern": "^[a-z]+_[a-f0-9]{12}$"
    },
    "source": {
      "type": "string",
      "enum": ["youtube", "blog", "podcast", "book", "linkedin", "deal_academy", "media"],
      "description": "Content source system"
    },
    "source_type": {
      "type": "string",
      "enum": [
        "video_transcript",
        "blog_article",
        "podcast_episode",
        "book_chapter",
        "book_section",
        "linkedin_post",
        "linkedin_article",
        "course_lesson",
        "course_module",
        "media_article",
        "media_interview"
      ],
      "description": "Specific content type within source"
    },
    "title": {
      "type": "string",
      "maxLength": 500,
      "description": "Content title or headline"
    },
    "content": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "Primary text content"
        },
        "summary": {
          "type": "string",
          "maxLength": 1000,
          "description": "AI-generated or extracted summary"
        },
        "key_topics": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Extracted topic tags"
        }
      },
      "required": ["text"]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "format": "uri"
        },
        "author": {
          "type": "string"
        },
        "published_date": {
          "type": "string",
          "format": "date"
        },
        "duration_seconds": {
          "type": "integer",
          "minimum": 0
        },
        "word_count": {
          "type": "integer",
          "minimum": 0
        },
        "language": {
          "type": "string",
          "default": "en"
        },
        "source_specific": {
          "type": "object",
          "description": "Additional source-specific metadata"
        }
      }
    },
    "extraction": {
      "type": "object",
      "properties": {
        "extracted_at": {
          "type": "string",
          "format": "date-time"
        },
        "extractor_version": {
          "type": "string"
        },
        "raw_file_path": {
          "type": "string"
        },
        "quality_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": ["extracted_at", "extractor_version"]
    },
    "rag": {
      "type": "object",
      "properties": {
        "chunk_count": {
          "type": "integer"
        },
        "chunk_ids": {
          "type": "array",
          "items": {"type": "string"}
        },
        "embedding_model": {
          "type": "string"
        },
        "last_embedded_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    }
  }
}
```

### 3.2 RAG Chunk Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RAGChunk",
  "type": "object",
  "required": ["chunk_id", "document_id", "content", "position"],
  "properties": {
    "chunk_id": {
      "type": "string",
      "pattern": "^chunk_[a-f0-9]{12}_\\d{4}$",
      "description": "Unique chunk identifier"
    },
    "document_id": {
      "type": "string",
      "description": "Parent document reference"
    },
    "source": {
      "type": "string",
      "description": "Inherited from parent document"
    },
    "source_type": {
      "type": "string",
      "description": "Inherited from parent document"
    },
    "title": {
      "type": "string",
      "description": "Parent document title for context"
    },
    "content": {
      "type": "string",
      "maxLength": 8000,
      "description": "Chunk text content"
    },
    "position": {
      "type": "object",
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 0
        },
        "start_char": {
          "type": "integer"
        },
        "end_char": {
          "type": "integer"
        },
        "total_chunks": {
          "type": "integer"
        }
      },
      "required": ["index", "total_chunks"]
    },
    "context": {
      "type": "object",
      "properties": {
        "preceding_text": {
          "type": "string",
          "maxLength": 200,
          "description": "Last 200 chars of previous chunk"
        },
        "following_text": {
          "type": "string",
          "maxLength": 200,
          "description": "First 200 chars of next chunk"
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "word_count": {"type": "integer"},
        "url": {"type": "string"},
        "published_date": {"type": "string"}
      }
    },
    "embedding": {
      "type": "object",
      "properties": {
        "model": {"type": "string"},
        "dimensions": {"type": "integer"},
        "vector": {
          "type": "array",
          "items": {"type": "number"}
        }
      }
    }
  }
}
```

---

## 4. Naming Conventions

### 4.1 File Naming

| Category | Pattern | Example |
|----------|---------|---------|
| Raw YouTube | `yt_{video_id}.{ext}` | `yt_dQw4w9WgXcQ.vtt` |
| Raw Blog | `blog_{url_slug}_{date}.json` | `blog_how-to-retain-employees_2026-01-07.json` |
| Raw Podcast | `pod_{episode_id}_{date}.{ext}` | `pod_ep042_2025-12-15.mp3` |
| Raw Book | `book_{isbn_or_slug}_ch{nn}.json` | `book_dealmakers-guide_ch03.json` |
| Raw LinkedIn | `li_{post_id}_{date}.json` | `li_7234567890_2025-11-20.json` |
| Raw Course | `course_{course_id}_lesson_{nn}.json` | `course_ma101_lesson_05.json` |
| Raw Media | `media_{outlet}_{date}_{slug}.json` | `media_usnews_2025-10-15_sara-sharp.json` |
| Normalized | `{source}_{hash12}.json` | `youtube_a1b2c3d4e5f6.json` |
| Chunks | `chunk_{doc_hash}_{nnnn}.json` | `chunk_a1b2c3d4e5f6_0001.json` |
| Embeddings | `emb_{model}_{date}.parquet` | `emb_ada002_2026-01-26.parquet` |
| State | `{source}_state.json` | `youtube_state.json` |

### 4.2 ID Generation

```python
def generate_document_id(source: str, unique_content: str) -> str:
    """
    Generate deterministic document ID.

    Format: {source}_{md5_hash[:12]}
    Example: youtube_a1b2c3d4e5f6
    """
    import hashlib
    hash_input = f"{source}:{unique_content}".encode('utf-8')
    hash_value = hashlib.md5(hash_input).hexdigest()[:12]
    return f"{source}_{hash_value}"

def generate_chunk_id(document_id: str, chunk_index: int) -> str:
    """
    Generate chunk ID from parent document.

    Format: chunk_{doc_hash}_{nnnn}
    Example: chunk_a1b2c3d4e5f6_0001
    """
    doc_hash = document_id.split('_')[1]
    return f"chunk_{doc_hash}_{chunk_index:04d}"
```

### 4.3 Field Naming

| Standard Field | Description | Type |
|----------------|-------------|------|
| `id` | Unique identifier | string |
| `source` | Source system | enum |
| `source_type` | Content subtype | enum |
| `title` | Human-readable title | string |
| `content.text` | Primary text body | string |
| `content.summary` | Brief summary | string |
| `metadata.url` | Source URL | uri |
| `metadata.published_date` | Publication date | date |
| `metadata.word_count` | Word count | integer |
| `extraction.extracted_at` | Extraction timestamp | datetime |
| `extraction.quality_score` | Quality metric 0-1 | number |

---

## 5. State Tracking Mechanism

### 5.1 Master Extraction State

`data/state/extraction_state.json`:

```json
{
  "version": "1.0.0",
  "last_updated": "2026-01-26T18:30:00Z",
  "sources": {
    "youtube": {
      "status": "active",
      "last_extraction": "2026-01-26T18:00:00Z",
      "total_items": 0,
      "pending_items": 100,
      "failed_items": 0,
      "state_file": "youtube_state.json"
    },
    "blog": {
      "status": "active",
      "last_extraction": "2026-01-26T18:24:00Z",
      "total_items": 20,
      "pending_items": 0,
      "failed_items": 0,
      "state_file": "blog_state.json"
    },
    "podcast": {
      "status": "pending",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 20,
      "failed_items": 0,
      "state_file": "podcast_state.json"
    },
    "book": {
      "status": "pending",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 0,
      "failed_items": 0,
      "state_file": "book_state.json"
    },
    "linkedin": {
      "status": "blocked",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 0,
      "failed_items": 0,
      "blocked_reason": "Requires manual export",
      "state_file": "linkedin_state.json"
    },
    "deal_academy": {
      "status": "blocked",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 0,
      "failed_items": 0,
      "blocked_reason": "Requires credentials",
      "state_file": "deal_academy_state.json"
    },
    "media": {
      "status": "pending",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 0,
      "failed_items": 0,
      "state_file": "media_state.json"
    }
  },
  "pipeline": {
    "last_normalization": null,
    "last_chunking": null,
    "last_embedding": null,
    "documents_normalized": 20,
    "chunks_created": 25,
    "embeddings_computed": 0
  }
}
```

### 5.2 Per-Source State Schema

`data/state/youtube_state.json`:

```json
{
  "source": "youtube",
  "channel_id": "@dealmakerseta",
  "channel_url": "https://www.youtube.com/@dealmakerseta",
  "last_scan": "2026-01-26T18:00:00Z",
  "extraction_config": {
    "include_auto_captions": true,
    "include_manual_captions": true,
    "preferred_language": "en",
    "min_duration_seconds": 60
  },
  "items": {
    "dQw4w9WgXcQ": {
      "video_id": "dQw4w9WgXcQ",
      "title": "How to Buy an Accounting Firm",
      "upload_date": "2025-10-15",
      "duration_seconds": 1234,
      "status": "extracted",
      "extracted_at": "2026-01-26T18:05:00Z",
      "raw_file": "data/raw/youtube/captions/yt_dQw4w9WgXcQ.vtt",
      "normalized_file": "data/normalized/documents/youtube_a1b2c3d4e5f6.json",
      "word_count": 2500,
      "quality_score": 0.85,
      "errors": []
    },
    "xYz123AbcDe": {
      "video_id": "xYz123AbcDe",
      "title": "Understanding LOIs",
      "upload_date": "2025-11-20",
      "duration_seconds": 890,
      "status": "pending",
      "extracted_at": null,
      "errors": []
    },
    "failedVideo1": {
      "video_id": "failedVideo1",
      "title": "Private Video",
      "status": "failed",
      "extracted_at": "2026-01-26T18:10:00Z",
      "errors": [
        {
          "timestamp": "2026-01-26T18:10:00Z",
          "error_type": "CaptionsNotAvailable",
          "message": "No captions available for this video",
          "retry_count": 2
        }
      ]
    }
  },
  "statistics": {
    "total_discovered": 105,
    "extracted": 45,
    "pending": 58,
    "failed": 2,
    "total_words": 112500,
    "avg_quality_score": 0.82
  }
}
```

### 5.3 State Transitions

```
Source Item Lifecycle:

    discovered -> pending -> extracting -> extracted -> normalized -> chunked -> embedded
                    |            |              |
                    v            v              v
                 skipped      failed       needs_update
```

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `discovered` | Found in source scan | Evaluate for extraction |
| `pending` | Queued for extraction | Begin extraction |
| `extracting` | Currently being processed | Wait for completion |
| `extracted` | Raw content available | Run normalization |
| `normalized` | Unified schema applied | Run chunking |
| `chunked` | RAG chunks created | Compute embeddings |
| `embedded` | Vectors computed | Ready for RAG |
| `failed` | Extraction error | Review and retry |
| `skipped` | Intentionally excluded | No action needed |
| `needs_update` | Source content changed | Re-extract |

---

## 6. Data Validation & Quality Gates

### 6.1 Validation Pipeline

```
Raw Data -> [Extraction Validation] -> Normalized -> [Schema Validation] ->
         -> [Quality Scoring] -> [Deduplication] -> Chunks -> [Chunk Validation]
```

### 6.2 Quality Rules Configuration

`config/quality_rules.yaml`:

```yaml
extraction_validation:
  # Minimum content requirements
  min_word_count: 50
  max_word_count: 50000
  min_title_length: 5
  max_title_length: 500

  # Required fields per source
  required_fields:
    youtube:
      - video_id
      - title
      - content
      - upload_date
    blog:
      - url
      - title
      - content
    podcast:
      - episode_id
      - title
      - content
    book:
      - chapter_number
      - title
      - content
    linkedin:
      - post_id
      - content
      - date
    deal_academy:
      - course_id
      - lesson_id
      - content
    media:
      - url
      - title
      - content

schema_validation:
  # JSON Schema compliance
  strict_mode: true
  allow_additional_properties: false

  # Type coercion rules
  coerce_dates: true
  coerce_numbers: true
  normalize_whitespace: true

quality_scoring:
  # Score components (must sum to 1.0)
  weights:
    content_length: 0.20
    completeness: 0.25
    language_quality: 0.20
    metadata_richness: 0.15
    uniqueness: 0.20

  # Thresholds
  minimum_score: 0.5
  target_score: 0.75

  # Content quality checks
  content_checks:
    - name: no_boilerplate
      pattern: "^(Cookie Policy|Privacy Policy|Terms of Use)"
      action: flag
    - name: minimum_sentences
      min_count: 3
      action: warn
    - name: no_truncation
      pattern: "\\.\\.\\.$|\\[continued\\]$"
      action: flag

deduplication:
  # Similarity thresholds
  exact_match_fields:
    - url
    - video_id
    - post_id

  fuzzy_match:
    enabled: true
    threshold: 0.95
    algorithm: minhash

  # Cross-source deduplication
  cross_source_check: true
  prefer_sources:
    - youtube  # Prefer video over blog if same content
    - blog
    - podcast

chunk_validation:
  # Chunk size constraints
  min_chunk_words: 100
  max_chunk_words: 1200
  target_chunk_words: 800
  overlap_words: 150

  # Chunk quality
  min_sentences_per_chunk: 2
  avoid_mid_sentence_breaks: true
  preserve_paragraphs: true
```

### 6.3 Quality Scoring Algorithm

```python
def calculate_quality_score(document: dict, config: dict) -> float:
    """
    Calculate document quality score 0.0-1.0.

    Components:
    - content_length: Score based on word count
    - completeness: Presence of optional fields
    - language_quality: Text coherence metrics
    - metadata_richness: Amount of metadata
    - uniqueness: Inverse of detected duplication
    """
    scores = {}
    weights = config['quality_scoring']['weights']

    # Content length score
    word_count = document['metadata'].get('word_count', 0)
    if word_count < 100:
        scores['content_length'] = 0.3
    elif word_count < 500:
        scores['content_length'] = 0.6
    elif word_count < 2000:
        scores['content_length'] = 0.9
    else:
        scores['content_length'] = 1.0

    # Completeness score
    optional_fields = ['summary', 'key_topics', 'author', 'published_date']
    present = sum(1 for f in optional_fields if document.get('metadata', {}).get(f))
    scores['completeness'] = present / len(optional_fields)

    # Language quality score (simplified)
    text = document['content']['text']
    sentence_count = text.count('.') + text.count('!') + text.count('?')
    avg_sentence_length = word_count / max(sentence_count, 1)
    if 10 <= avg_sentence_length <= 25:
        scores['language_quality'] = 1.0
    elif 5 <= avg_sentence_length <= 40:
        scores['language_quality'] = 0.7
    else:
        scores['language_quality'] = 0.4

    # Metadata richness
    metadata_fields = len([v for v in document.get('metadata', {}).values() if v])
    scores['metadata_richness'] = min(metadata_fields / 8, 1.0)

    # Uniqueness (placeholder - actual implementation uses hash comparison)
    scores['uniqueness'] = document.get('_uniqueness_score', 1.0)

    # Weighted sum
    total = sum(scores[k] * weights[k] for k in weights)
    return round(total, 3)
```

### 6.4 Quality Report Output

```json
{
  "report_id": "qr_2026-01-26_001",
  "generated_at": "2026-01-26T19:00:00Z",
  "summary": {
    "total_documents": 125,
    "passed": 118,
    "warnings": 5,
    "failed": 2,
    "average_quality_score": 0.82
  },
  "by_source": {
    "youtube": {
      "count": 45,
      "avg_score": 0.78,
      "common_issues": ["low_word_count", "missing_description"]
    },
    "blog": {
      "count": 20,
      "avg_score": 0.91,
      "common_issues": []
    }
  },
  "issues": [
    {
      "document_id": "youtube_abc123",
      "severity": "warning",
      "issue": "low_word_count",
      "details": "Word count 45 below minimum 50",
      "recommendation": "Review source - may be intro/outro only"
    },
    {
      "document_id": "blog_xyz789",
      "severity": "error",
      "issue": "duplicate_content",
      "details": "95% similar to blog_def456",
      "recommendation": "Mark as duplicate, prefer earlier publication"
    }
  ],
  "recommendations": [
    "Consider re-transcribing 3 YouTube videos with quality_score < 0.6",
    "Review 2 potential duplicates for manual deduplication decision"
  ]
}
```

---

## 7. RAG Integration Points

### 7.1 Vector Database Schemas

#### Pinecone Index Configuration

```json
{
  "index_name": "sara-knowledge",
  "dimension": 1536,
  "metric": "cosine",
  "pods": 1,
  "replicas": 1,
  "pod_type": "p1.x1",
  "metadata_config": {
    "indexed": ["source", "source_type", "published_date"]
  }
}
```

#### Supabase pgvector Table

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main chunks table
CREATE TABLE sara_chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    word_count INTEGER,
    url TEXT,
    published_date DATE,
    position_index INTEGER,
    position_total INTEGER,
    quality_score NUMERIC(4,3),
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for filtering
CREATE INDEX idx_chunks_source ON sara_chunks(source);
CREATE INDEX idx_chunks_source_type ON sara_chunks(source_type);
CREATE INDEX idx_chunks_published ON sara_chunks(published_date);
CREATE INDEX idx_chunks_document ON sara_chunks(document_id);

-- Vector similarity search index
CREATE INDEX idx_chunks_embedding ON sara_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Full text search
ALTER TABLE sara_chunks ADD COLUMN content_tsv TSVECTOR;
UPDATE sara_chunks SET content_tsv = to_tsvector('english', content);
CREATE INDEX idx_chunks_fts ON sara_chunks USING gin(content_tsv);
```

### 7.2 Embedding Pipeline

```python
EMBEDDING_CONFIG = {
    "model": "text-embedding-3-small",  # OpenAI
    "dimensions": 1536,
    "batch_size": 100,
    "max_tokens_per_chunk": 8000,
    "retry_attempts": 3,
    "rate_limit_rpm": 3000
}

async def embed_chunks(chunks: list[dict], config: dict) -> list[dict]:
    """
    Compute embeddings for chunks in batches.

    Returns chunks with embedding field populated.
    """
    from openai import AsyncOpenAI
    import asyncio

    client = AsyncOpenAI()
    results = []

    for batch_start in range(0, len(chunks), config['batch_size']):
        batch = chunks[batch_start:batch_start + config['batch_size']]
        texts = [c['content'] for c in batch]

        response = await client.embeddings.create(
            model=config['model'],
            input=texts,
            dimensions=config['dimensions']
        )

        for chunk, embedding_data in zip(batch, response.data):
            chunk['embedding'] = {
                'model': config['model'],
                'dimensions': config['dimensions'],
                'vector': embedding_data.embedding
            }
            results.append(chunk)

        # Rate limiting
        await asyncio.sleep(60 / config['rate_limit_rpm'] * len(batch))

    return results
```

### 7.3 Query Interface

```python
def search_knowledge_base(
    query: str,
    filters: dict = None,
    top_k: int = 10,
    include_context: bool = True
) -> list[dict]:
    """
    Search the knowledge base with optional filters.

    Args:
        query: Natural language search query
        filters: Optional filters (source, source_type, date_range)
        top_k: Number of results to return
        include_context: Include surrounding chunk context

    Returns:
        List of matching chunks with scores
    """
    # Generate query embedding
    query_embedding = embed_text(query)

    # Build filter clause
    filter_clause = build_filters(filters)

    # Vector similarity search
    results = vector_search(
        embedding=query_embedding,
        filters=filter_clause,
        limit=top_k
    )

    # Optionally fetch context
    if include_context:
        results = enrich_with_context(results)

    return results
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Objective**: Establish directory structure and migrate existing data

| Task | Priority | Effort |
|------|----------|--------|
| Create directory structure | High | 1 hour |
| Define configuration files | High | 2 hours |
| Migrate existing `sara_knowledge_base.json` | High | 2 hours |
| Implement state tracking | High | 4 hours |
| Setup validation framework | Medium | 3 hours |

### Phase 2: Extractors (Week 2)

**Objective**: Refactor extractors to use new architecture

| Task | Priority | Effort |
|------|----------|--------|
| Refactor YouTube extractor | High | 4 hours |
| Refactor Blog extractor | High | 2 hours |
| Implement Podcast extractor | Medium | 4 hours |
| Integrate Whisper transcription | Medium | 3 hours |
| Implement Book extractor | Low | 2 hours |

### Phase 3: Normalization (Week 3)

**Objective**: Build normalization and chunking pipeline

| Task | Priority | Effort |
|------|----------|--------|
| Implement normalizer | High | 4 hours |
| Implement chunker | High | 4 hours |
| Build quality scoring | Medium | 3 hours |
| Implement deduplication | Medium | 3 hours |
| Create quality reports | Low | 2 hours |

### Phase 4: RAG Integration (Week 4)

**Objective**: Connect to vector database and enable search

| Task | Priority | Effort |
|------|----------|--------|
| Setup Supabase/Pinecone | High | 2 hours |
| Implement embedding pipeline | High | 4 hours |
| Build search interface | High | 4 hours |
| Create sync mechanism | Medium | 3 hours |
| Performance optimization | Low | 3 hours |

---

## 9. Appendix

### A. Source-Specific Metadata

#### YouTube

```json
{
  "source_specific": {
    "video_id": "dQw4w9WgXcQ",
    "channel_id": "@dealmakerseta",
    "duration_seconds": 1234,
    "view_count": 15000,
    "like_count": 500,
    "caption_type": "auto",
    "caption_language": "en",
    "playlist_id": null,
    "playlist_position": null
  }
}
```

#### Blog

```json
{
  "source_specific": {
    "slug": "how-to-retain-employees",
    "category": "M&A",
    "tags": ["accounting", "employees", "retention"],
    "author_bio": "Sara Sharp is a lawyer who advises...",
    "related_articles": ["blog_abc123", "blog_def456"]
  }
}
```

#### Podcast

```json
{
  "source_specific": {
    "episode_number": 42,
    "season_number": 2,
    "podcast_name": "Dealmakers Podcast",
    "feed_url": "https://...",
    "audio_url": "https://...",
    "transcription_method": "whisper-api",
    "transcription_model": "whisper-1"
  }
}
```

### B. Error Codes

| Code | Category | Description |
|------|----------|-------------|
| E001 | Extraction | Source unavailable |
| E002 | Extraction | Authentication failed |
| E003 | Extraction | Rate limited |
| E004 | Extraction | Content not found |
| E005 | Extraction | Timeout |
| E010 | Validation | Schema violation |
| E011 | Validation | Missing required field |
| E012 | Validation | Content too short |
| E013 | Validation | Content too long |
| E014 | Validation | Invalid format |
| E020 | Quality | Below minimum score |
| E021 | Quality | Duplicate detected |
| E022 | Quality | Language mismatch |
| E030 | Embedding | API error |
| E031 | Embedding | Token limit exceeded |
| E040 | Storage | Write failed |
| E041 | Storage | Read failed |

### C. Migration Script (Existing Data)

```python
"""
Migrate existing sara_knowledge_base.json to new architecture.
"""
import json
from pathlib import Path
from datetime import datetime

def migrate_existing_data():
    # Load existing data
    with open('docs/sara_knowledge_base.json') as f:
        old_data = json.load(f)

    # Create directories
    dirs = [
        'data/raw/blog/articles',
        'data/normalized/documents',
        'data/state'
    ]
    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)

    # Migrate each item
    migrated = []
    for item in old_data['content']:
        new_doc = {
            'id': f"blog_{item['id']}",
            'source': item['source'],
            'source_type': item['source_type'],
            'title': item['title'],
            'content': {
                'text': item['content'],
                'summary': None,
                'key_topics': []
            },
            'metadata': {
                'url': item['url'],
                'author': 'Sara Sharp',
                'published_date': None,
                'word_count': item['word_count'],
                'language': 'en',
                'source_specific': {}
            },
            'extraction': {
                'extracted_at': item['extracted_at'],
                'extractor_version': '1.0.0-legacy',
                'raw_file_path': None,
                'quality_score': None
            },
            'rag': {
                'chunk_count': 0,
                'chunk_ids': [],
                'embedding_model': None,
                'last_embedded_at': None
            }
        }

        # Save normalized document
        output_path = f"data/normalized/documents/{new_doc['id']}.json"
        with open(output_path, 'w') as f:
            json.dump(new_doc, f, indent=2)

        migrated.append(new_doc['id'])

    # Create initial state
    state = {
        'source': 'blog',
        'last_scan': datetime.now().isoformat(),
        'items': {doc_id: {'status': 'normalized'} for doc_id in migrated},
        'statistics': {
            'total_discovered': len(migrated),
            'extracted': len(migrated),
            'normalized': len(migrated)
        }
    }

    with open('data/state/blog_state.json', 'w') as f:
        json.dump(state, f, indent=2)

    print(f"Migrated {len(migrated)} documents")

if __name__ == '__main__':
    migrate_existing_data()
```

---

## 10. Summary

This architecture provides:

1. **Clear Organization**: Hierarchical directory structure separating raw, normalized, and RAG-ready data
2. **Unified Schema**: Consistent document format across all 7 sources
3. **Robust State Tracking**: Per-source and global state files for incremental processing
4. **Quality Assurance**: Multi-stage validation with configurable rules
5. **RAG Optimization**: Pre-chunked content with context preservation
6. **Scalability**: Designed to handle growth to 10x current content volume

**Next Steps**:
1. Review and approve architecture
2. Create directory structure
3. Migrate existing data
4. Begin Phase 1 implementation
