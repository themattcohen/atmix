# Data Centralization Master Plan
## Sara Sharp Knowledge Base - Complete Implementation Reference

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Ready for Implementation
**Document Type:** Consolidated Technical Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Analysis Summary](#2-project-analysis-summary)
3. [Architecture Design](#3-architecture-design)
4. [Requirements Specification](#4-requirements-specification)
5. [Implementation Plan](#5-implementation-plan)
6. [Data Dictionary](#6-data-dictionary)
7. [Operational Runbook](#7-operational-runbook)
8. [Appendices](#8-appendices)

---

## 1. Executive Summary

### 1.1 Project Overview

This document provides a complete, self-contained reference for centralizing Sara Sharp's multi-source content into a unified, RAG-ready knowledge base. The project consolidates content from 7 data sources into a standardized format suitable for vector database ingestion and AI-powered retrieval.

### 1.2 Current State Summary

| Metric | Value |
|--------|-------|
| Existing Files | 5 project files |
| Data Sources Identified | 7 sources |
| Sources Currently Extracted | 1 (blog: 20 articles, 10,667 words) |
| Sources Pending | 6 (YouTube, Podcast, Book, LinkedIn, Deal Academy, Media) |
| Estimated Total Content | 250,000+ words across all sources |

### 1.3 Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Source Coverage | 100% of accessible sources | Extraction completion tracking |
| Content Quality | >90% clean records | Automated validation scores |
| Schema Compliance | 100% conformance | JSON Schema validation |
| RAG Readiness | All content chunked | Vector DB integration test |

### 1.4 Key Deliverables

1. **Centralized data directory** with raw/normalized/RAG-ready layers
2. **Unified JSON schema** across all 7 sources
3. **State tracking system** for incremental updates
4. **Quality validation pipeline** with configurable rules
5. **RAG-optimized chunks** ready for embedding

---

## 2. Project Analysis Summary

### 2.1 Existing File Inventory

| File | Path | Purpose | Status |
|------|------|---------|--------|
| `sara_content_extractor.py` | `/Users/matt/Documents/someday/docs/` | Main extraction script | Functional, needs refactoring |
| `transcribe_audio.py` | `/Users/matt/Documents/someday/docs/` | Whisper transcription helper | Functional |
| `sara_knowledge_base.json` | `/Users/matt/Documents/someday/docs/` | Current extracted data | 20 blog articles, 10,667 words |
| `README.md` | `/Users/matt/Documents/someday/docs/` | Project documentation | Complete |
| `linkedin-gtm-agent-prd.md` | `/Users/matt/Documents/someday/docs/` | Separate project PRD | Reference only |

### 2.2 Data Source Analysis

#### Source 1: YouTube Channel (@dealmakerseta)

| Attribute | Value |
|-----------|-------|
| URL | `https://www.youtube.com/@dealmakerseta` |
| Expected Volume | 100+ videos |
| Content Type | Video transcripts (auto-generated captions) |
| Extraction Method | yt-dlp with caption download |
| Current Status | **Not Extracted** - Script ready, needs execution |
| Credentials Required | None |
| Estimated Word Count | 200,000+ words |

**Extraction Command:**
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --youtube
```

#### Source 2: SK&S Law Blog

| Attribute | Value |
|-----------|-------|
| URL | `https://www.skandslegal.com/sks-blog` |
| Expected Volume | 40+ articles |
| Content Type | Blog articles |
| Extraction Method | Web scraping with BeautifulSoup |
| Current Status | **Partially Extracted** - 20 articles captured |
| Credentials Required | None |
| Actual Word Count | 10,667 words (current extraction) |

**Extraction Command:**
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --blog
```

#### Source 3: Podcast Episodes

| Attribute | Value |
|-----------|-------|
| Source | RSS feeds (Dealmakers/Acquisitive podcasts) |
| Expected Volume | 50+ episodes |
| Content Type | Audio transcriptions |
| Extraction Method | feedparser + Whisper transcription |
| Current Status | **Not Extracted** - RSS metadata only |
| Credentials Required | None (OPENAI_API_KEY for Whisper API) |
| Estimated Word Count | 30,000+ words |

**Extraction Commands:**
```bash
# Metadata extraction
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --podcast

# Audio transcription (per episode)
python /Users/matt/Documents/someday/docs/transcribe_audio.py --api /path/to/episode.mp3
```

#### Source 4: Book (PDF)

| Attribute | Value |
|-----------|-------|
| Source | User-provided PDF file |
| Expected Volume | 1-3 books |
| Content Type | Book chapters and sections |
| Extraction Method | PyMuPDF text extraction |
| Current Status | **Blocked** - Awaiting PDF file |
| Credentials Required | None (file access) |
| Estimated Word Count | 50,000+ words per book |

**Extraction Command:**
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --book /path/to/book.pdf
```

#### Source 5: LinkedIn Posts

| Attribute | Value |
|-----------|-------|
| Profile | `https://www.linkedin.com/in/sara-sharp-9a2a98b` |
| Expected Volume | 100+ posts |
| Content Type | Posts and articles |
| Extraction Method | Manual export import (CSV/JSON) |
| Current Status | **Blocked** - Requires manual data export |
| Credentials Required | LinkedIn data export |
| Estimated Word Count | 15,000+ words |

**Export Process:**
1. Go to LinkedIn Settings > Data Privacy > Get a copy of your data
2. Request "Posts" data
3. Download ZIP file and extract

**Extraction Command:**
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --linkedin /path/to/linkedin_posts.csv
```

#### Source 6: Deal Academy (Teachable)

| Attribute | Value |
|-----------|-------|
| URL | `https://www.dealacademy.org` |
| Expected Volume | Multiple courses, 50+ lessons |
| Content Type | Course content, video transcripts |
| Extraction Method | Authenticated web scraping |
| Current Status | **Blocked** - Requires login credentials |
| Credentials Required | Teachable email/password |
| Estimated Word Count | 40,000+ words |

**Extraction Command:**
```bash
export TEACHABLE_EMAIL=your@email.com
export TEACHABLE_PASSWORD=yourpassword
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --deal-academy
```

#### Source 7: Media Features

| Attribute | Value |
|-----------|-------|
| Sources | US News, Business Insider, Yahoo Finance, GoBankingRates |
| Expected Volume | 20+ articles |
| Content Type | News articles featuring Sara Sharp |
| Extraction Method | Web scraping with manual URL discovery |
| Current Status | **Not Implemented** - Requires URL collection |
| Credentials Required | None |
| Estimated Word Count | 10,000+ words |

### 2.3 Extraction Status Matrix

| Source | Discovery | Extraction | Normalization | Chunking | Embedding |
|--------|-----------|------------|---------------|----------|-----------|
| YouTube | Ready | Pending | Pending | Pending | Pending |
| Blog | Complete | **Partial (20/40+)** | Pending | Pending | Pending |
| Podcast | Ready | Pending | Pending | Pending | Pending |
| Book | Blocked | Blocked | Pending | Pending | Pending |
| LinkedIn | Blocked | Blocked | Pending | Pending | Pending |
| Deal Academy | Blocked | Blocked | Pending | Pending | Pending |
| Media | Pending | Pending | Pending | Pending | Pending |

### 2.4 Current Data Analysis

**Extracted Content from `sara_knowledge_base.json`:**

```json
{
  "total_items": 20,
  "total_words": 10667,
  "sources": [
    {"type": "blog", "count": 20, "total_words": 10667}
  ]
}
```

**Content Topics Identified:**
- M&A and business acquisitions
- Privacy law compliance (CCPA, GDPR, Colorado Privacy Act)
- Corporate Transparency Act / BOI reporting
- Data protection agreements
- SaaS Master Services Agreements
- Accounting firm acquisitions
- Letters of Intent best practices
- Non-compete agreements
- Employee retention in acquisitions

**Authors in Content:**
- Sara Sharp (primary - M&A topics)
- Thomas Codevilla (privacy/data protection topics)

---

## 3. Architecture Design

### 3.1 Target Directory Structure

```
/Users/matt/Documents/someday/
├── data/                                    # Centralized data root
│   ├── raw/                                 # Original extracted content
│   │   ├── youtube/                         # YouTube transcripts
│   │   │   ├── captions/                    # VTT/SRT files
│   │   │   │   └── yt_{video_id}.vtt
│   │   │   └── metadata/                    # Video metadata JSON
│   │   │       └── yt_{video_id}_meta.json
│   │   ├── blog/                            # SK&S blog articles
│   │   │   └── articles/                    # Individual article JSON
│   │   │       └── blog_{url_slug}_{date}.json
│   │   ├── podcast/                         # Podcast content
│   │   │   ├── audio/                       # Downloaded MP3 files
│   │   │   │   └── pod_{episode_id}.mp3
│   │   │   ├── transcripts/                 # Whisper transcriptions
│   │   │   │   └── pod_{episode_id}_transcript.json
│   │   │   └── metadata/                    # Episode metadata
│   │   │       └── pod_{episode_id}_meta.json
│   │   ├── book/                            # Book PDF content
│   │   │   ├── pdf/                         # Source PDF files
│   │   │   │   └── {book_name}.pdf
│   │   │   └── extracted/                   # Extracted chapters
│   │   │       └── book_{slug}_ch{nn}.json
│   │   ├── linkedin/                        # LinkedIn exports
│   │   │   ├── exports/                     # Raw export files
│   │   │   │   └── linkedin_export_{date}.csv
│   │   │   └── processed/                   # Parsed posts
│   │   │       └── li_{post_id}.json
│   │   ├── deal_academy/                    # Teachable content
│   │   │   ├── courses/                     # Course structure
│   │   │   │   └── course_{id}_structure.json
│   │   │   └── lessons/                     # Lesson content
│   │   │       └── course_{id}_lesson_{nn}.json
│   │   └── media/                           # Media mentions
│   │       └── articles/                    # Scraped articles
│   │           └── media_{outlet}_{date}.json
│   │
│   ├── normalized/                          # Cleaned & standardized
│   │   └── documents/                       # Unified document format
│   │       ├── youtube_{hash12}.json
│   │       ├── blog_{hash12}.json
│   │       ├── podcast_{hash12}.json
│   │       ├── book_{hash12}.json
│   │       ├── linkedin_{hash12}.json
│   │       ├── course_{hash12}.json
│   │       └── media_{hash12}.json
│   │
│   ├── rag/                                 # RAG-ready output
│   │   ├── chunks/                          # Individual chunk files
│   │   │   └── chunk_{doc_hash}_{nnnn}.json
│   │   ├── embeddings/                      # Pre-computed embeddings
│   │   │   └── embeddings_{model}_{date}.parquet
│   │   └── indexes/                         # Vector index snapshots
│   │       └── index_{date}.faiss
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
├── docs/                                    # Documentation (existing location)
│   ├── sara_content_extractor.py            # Current extractor
│   ├── transcribe_audio.py                  # Audio transcription
│   ├── sara_knowledge_base.json             # Current output
│   ├── README.md                            # Project readme
│   ├── DATA_CENTRALIZATION_ARCHITECTURE.md  # Architecture doc
│   ├── REQUIREMENTS_SPECIFICATION.md        # Requirements doc
│   └── DATA_CENTRALIZATION_MASTER_PLAN.md   # This document
│
└── reports/                                 # Pipeline reports
    ├── extraction_report_{date}.json
    └── quality_report_{date}.json
```

### 3.2 Unified Document Schema

All normalized documents conform to this JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UnifiedDocument",
  "type": "object",
  "required": ["id", "source", "source_type", "title", "content", "metadata", "extraction"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique document identifier",
      "pattern": "^[a-z]+_[a-f0-9]{12}$",
      "examples": ["youtube_a1b2c3d4e5f6", "blog_9307005bd7ac"]
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
        "url": {"type": "string", "format": "uri"},
        "author": {"type": "string"},
        "published_date": {"type": "string", "format": "date"},
        "duration_seconds": {"type": "integer", "minimum": 0},
        "word_count": {"type": "integer", "minimum": 0},
        "language": {"type": "string", "default": "en"},
        "source_specific": {"type": "object"}
      }
    },
    "extraction": {
      "type": "object",
      "properties": {
        "extracted_at": {"type": "string", "format": "date-time"},
        "extractor_version": {"type": "string"},
        "raw_file_path": {"type": "string"},
        "quality_score": {"type": "number", "minimum": 0, "maximum": 1}
      },
      "required": ["extracted_at", "extractor_version"]
    },
    "rag": {
      "type": "object",
      "properties": {
        "chunk_count": {"type": "integer"},
        "chunk_ids": {"type": "array", "items": {"type": "string"}},
        "embedding_model": {"type": "string"},
        "last_embedded_at": {"type": "string", "format": "date-time"}
      }
    }
  }
}
```

### 3.3 RAG Chunk Schema

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
      "examples": ["chunk_a1b2c3d4e5f6_0001"]
    },
    "document_id": {"type": "string"},
    "source": {"type": "string"},
    "source_type": {"type": "string"},
    "title": {"type": "string"},
    "content": {"type": "string", "maxLength": 8000},
    "position": {
      "type": "object",
      "properties": {
        "index": {"type": "integer", "minimum": 0},
        "start_char": {"type": "integer"},
        "end_char": {"type": "integer"},
        "total_chunks": {"type": "integer"}
      },
      "required": ["index", "total_chunks"]
    },
    "context": {
      "type": "object",
      "properties": {
        "preceding_text": {"type": "string", "maxLength": 200},
        "following_text": {"type": "string", "maxLength": 200}
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "word_count": {"type": "integer"},
        "url": {"type": "string"},
        "published_date": {"type": "string"}
      }
    }
  }
}
```

### 3.4 Naming Conventions

#### File Naming Patterns

| Category | Pattern | Example |
|----------|---------|---------|
| Raw YouTube | `yt_{video_id}.{ext}` | `yt_dQw4w9WgXcQ.vtt` |
| Raw Blog | `blog_{url_slug}_{date}.json` | `blog_how-to-retain-employees_2026-01-07.json` |
| Raw Podcast | `pod_{episode_id}_{date}.{ext}` | `pod_ep042_2025-12-15.mp3` |
| Raw Book | `book_{slug}_ch{nn}.json` | `book_dealmakers-guide_ch03.json` |
| Raw LinkedIn | `li_{post_id}_{date}.json` | `li_7234567890_2025-11-20.json` |
| Raw Course | `course_{id}_lesson_{nn}.json` | `course_ma101_lesson_05.json` |
| Raw Media | `media_{outlet}_{date}_{slug}.json` | `media_usnews_2025-10-15_sara-sharp.json` |
| Normalized | `{source}_{hash12}.json` | `youtube_a1b2c3d4e5f6.json` |
| Chunks | `chunk_{doc_hash}_{nnnn}.json` | `chunk_a1b2c3d4e5f6_0001.json` |
| State | `{source}_state.json` | `youtube_state.json` |

#### ID Generation Algorithm

```python
import hashlib

def generate_document_id(source: str, unique_content: str) -> str:
    """
    Generate deterministic document ID.
    Format: {source}_{md5_hash[:12]}
    Example: youtube_a1b2c3d4e5f6
    """
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

### 3.5 State Tracking Schema

**Master Extraction State** (`data/state/extraction_state.json`):

```json
{
  "version": "1.0.0",
  "last_updated": "2026-01-26T18:30:00Z",
  "sources": {
    "youtube": {
      "status": "pending",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 100,
      "failed_items": 0,
      "state_file": "youtube_state.json"
    },
    "blog": {
      "status": "active",
      "last_extraction": "2026-01-26T18:24:00Z",
      "total_items": 20,
      "pending_items": 20,
      "failed_items": 0,
      "state_file": "blog_state.json"
    },
    "podcast": {
      "status": "pending",
      "last_extraction": null,
      "total_items": 0,
      "pending_items": 50,
      "failed_items": 0,
      "state_file": "podcast_state.json"
    },
    "book": {
      "status": "blocked",
      "blocked_reason": "Awaiting PDF file",
      "state_file": "book_state.json"
    },
    "linkedin": {
      "status": "blocked",
      "blocked_reason": "Requires manual export",
      "state_file": "linkedin_state.json"
    },
    "deal_academy": {
      "status": "blocked",
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

---

## 4. Requirements Specification

### 4.1 Functional Requirements by Source

#### FR-YT: YouTube Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-YT-001 | Extract video metadata | P0 | All videos have title, URL, date, duration |
| FR-YT-002 | Download auto-generated captions | P0 | >80% of videos have transcripts |
| FR-YT-003 | Parse and clean caption text | P0 | No VTT artifacts in output |
| FR-YT-004 | Handle videos without captions | P1 | Whisper fallback for uncaptioned |
| FR-YT-005 | Incremental extraction | P1 | Re-runs only process new content |
| FR-YT-006 | Rate limiting and retry logic | P0 | Graceful handling of API limits |

#### FR-BL: Blog Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-BL-001 | Scrape all article URLs | P0 | All article links captured |
| FR-BL-002 | Extract title, author, date | P0 | Complete metadata for all articles |
| FR-BL-003 | Extract full article body | P0 | Complete text without nav/footer |
| FR-BL-004 | Handle pagination | P0 | All pages crawled |
| FR-BL-005 | Identify Sara vs. other authors | P0 | Author attribution accurate |

#### FR-PC: Podcast Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-PC-001 | Parse RSS feeds | P0 | All episodes discovered |
| FR-PC-002 | Extract episode metadata | P0 | Title, date, duration captured |
| FR-PC-003 | Download audio files | P1 | Audio accessible for transcription |
| FR-PC-004 | Transcribe via Whisper | P1 | Full transcripts for episodes |

#### FR-BK: Book Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-BK-001 | Extract text from PDF | P0 | Full text extraction |
| FR-BK-002 | Detect chapter structure | P0 | Chapter boundaries identified |
| FR-BK-003 | Track page numbers | P0 | Page attribution preserved |
| FR-BK-004 | Generate hierarchical chunks | P0 | Chapter/section chunking |

#### FR-LI: LinkedIn Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-LI-001 | Import data export | P0 | All exported posts ingested |
| FR-LI-002 | Parse post content | P0 | Clean text extraction |
| FR-LI-003 | Extract date and engagement | P0 | Complete metadata |
| FR-LI-004 | Handle articles vs. posts | P0 | Content types distinguished |

#### FR-DA: Deal Academy Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-DA-001 | Authenticate with Teachable | P0 | Secure login |
| FR-DA-002 | Extract course catalog | P0 | All courses identified |
| FR-DA-003 | Extract lesson content | P0 | All lessons captured |
| FR-DA-004 | Preserve course hierarchy | P0 | Module/lesson structure |

#### FR-MF: Media Features Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-MF-001 | Manual URL input support | P0 | User-provided URLs accepted |
| FR-MF-002 | Extract article content | P1 | Full context captured |
| FR-MF-003 | Identify publication/outlet | P0 | Source attribution |

### 4.2 Data Quality Requirements

#### DQ-CL: Cleaning Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DQ-CL-001 | Remove HTML tags and entities | P0 |
| DQ-CL-002 | Normalize whitespace | P0 |
| DQ-CL-003 | Remove VTT/SRT artifacts | P0 |
| DQ-CL-004 | Remove boilerplate text | P0 |
| DQ-CL-005 | Fix encoding issues | P0 |
| DQ-CL-006 | Remove duplicate sentences | P1 |

#### DQ-NM: Normalization Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DQ-NM-001 | Standardize dates to ISO8601 | P0 |
| DQ-NM-002 | Normalize author names | P0 |
| DQ-NM-003 | Standardize URL formats | P1 |
| DQ-NM-004 | Convert durations to seconds | P0 |
| DQ-NM-005 | Normalize empty values to null | P0 |

#### DQ-VL: Validation Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DQ-VL-001 | Required fields present | P0 |
| DQ-VL-002 | URLs well-formed | P0 |
| DQ-VL-003 | Dates parseable | P0 |
| DQ-VL-004 | Content length minimums | P0 |
| DQ-VL-005 | ID uniqueness | P0 |

### 4.3 RAG Chunking Requirements

| ID | Requirement | Priority | Specification |
|----|-------------|----------|---------------|
| CR-RC-001 | Configurable chunk size | P0 | Default 800 words, range 500-1200 |
| CR-RC-002 | Configurable overlap | P0 | Default 150 words |
| CR-RC-003 | Preserve metadata on chunks | P0 | Source tracing possible |
| CR-RC-004 | Chunk IDs reference parent | P0 | `{parent_id}_{chunk_index}` |
| CR-RC-005 | Respect sentence boundaries | P1 | No mid-sentence splits |
| CR-RC-006 | Add position context | P1 | "chunk 3 of 5" metadata |

---

## 5. Implementation Plan

### 5.1 Phase Overview

| Phase | Name | Duration | Dependencies | Key Deliverables |
|-------|------|----------|--------------|------------------|
| 1 | Foundation | 4 hours | None | Directory structure, state tracking |
| 2 | Blog Migration | 2 hours | Phase 1 | Existing data migrated |
| 3 | YouTube Extraction | 4 hours | Phase 1 | 100+ transcripts |
| 4 | Normalization Pipeline | 4 hours | Phases 2-3 | Unified schema compliance |
| 5 | Chunking Pipeline | 3 hours | Phase 4 | RAG-ready chunks |
| 6 | Podcast Extraction | 6 hours | Phase 1 | Audio transcriptions |
| 7 | Blocked Sources | Variable | User action | LinkedIn, Book, Deal Academy |
| 8 | Embedding & Integration | 4 hours | Phase 5 | Vector DB ready |

### 5.2 Phase 1: Foundation (4 hours)

**Objective:** Establish directory structure and state tracking

**Tasks:**

| Task | Command/Action | Validation |
|------|----------------|------------|
| 1.1 Create directory structure | `mkdir -p /Users/matt/Documents/someday/data/{raw/{youtube/{captions,metadata},blog/articles,podcast/{audio,transcripts,metadata},book/{pdf,extracted},linkedin/{exports,processed},deal_academy/{courses,lessons},media/articles},normalized/documents,rag/{chunks,embeddings,indexes},state}` | `ls -R /Users/matt/Documents/someday/data/` |
| 1.2 Create config directory | `mkdir -p /Users/matt/Documents/someday/config` | Directory exists |
| 1.3 Create scripts directory | `mkdir -p /Users/matt/Documents/someday/scripts/{extract,transform,validate,orchestrate}` | Directory exists |
| 1.4 Create reports directory | `mkdir -p /Users/matt/Documents/someday/reports` | Directory exists |
| 1.5 Initialize extraction_state.json | Create master state file | Valid JSON |
| 1.6 Initialize per-source state files | Create 7 state files | All files exist |

**Validation Gate:**
```bash
# Verify structure
find /Users/matt/Documents/someday/data -type d | wc -l
# Expected: 20+ directories
```

### 5.3 Phase 2: Blog Migration (2 hours)

**Objective:** Migrate existing blog data to new architecture

**Tasks:**

| Task | Description | Input | Output |
|------|-------------|-------|--------|
| 2.1 Read existing data | Load sara_knowledge_base.json | 20 articles | In-memory dict |
| 2.2 Transform to unified schema | Apply schema mapping | Raw articles | Normalized documents |
| 2.3 Generate document IDs | Apply ID generation | Title + URL | Deterministic IDs |
| 2.4 Write normalized files | Save individual JSON files | 20 documents | 20 files in normalized/ |
| 2.5 Update state files | Track migration status | Completion state | blog_state.json |

**Migration Script Logic:**
```python
# Pseudocode for migration
for item in existing_data['content']:
    new_doc = {
        'id': generate_document_id('blog', item['url']),
        'source': 'blog',
        'source_type': 'blog_article',
        'title': item['title'],
        'content': {
            'text': item['content'],
            'summary': None,
            'key_topics': []
        },
        'metadata': {
            'url': item['url'],
            'author': detect_author(item['content']),
            'word_count': item['word_count'],
            'language': 'en'
        },
        'extraction': {
            'extracted_at': item['extracted_at'],
            'extractor_version': '1.0.0-legacy',
            'quality_score': calculate_quality_score(item)
        }
    }
    save_to_normalized(new_doc)
```

### 5.4 Phase 3: YouTube Extraction (4 hours)

**Objective:** Extract transcripts from all YouTube videos

**Prerequisites:**
- yt-dlp installed: `pip install yt-dlp`
- Network access to YouTube

**Execution:**
```bash
cd /Users/matt/Documents/someday/docs
python sara_content_extractor.py --youtube --output-dir /Users/matt/Documents/someday/data/raw/youtube
```

**Expected Results:**
- 100+ video transcripts
- VTT files in `data/raw/youtube/captions/`
- Metadata JSON in `data/raw/youtube/metadata/`

**Error Handling:**
| Error | Cause | Resolution |
|-------|-------|------------|
| SSL errors | Certificate issues | Script includes `--no-check-certificate` |
| 403 errors | Rate limiting | Wait and retry, or use VPN |
| No subtitles | Video without captions | Mark for Whisper transcription |
| Timeout | Network issues | Increase timeout, retry |

### 5.5 Phase 4: Normalization Pipeline (4 hours)

**Objective:** Transform all raw data to unified schema

**Tasks:**

| Task | Description | Validation |
|------|-------------|------------|
| 4.1 Create normalizer.py | Schema transformation logic | Unit tests pass |
| 4.2 Process YouTube raw files | Transform captions to documents | Schema validation |
| 4.3 Process blog raw files | Already normalized in Phase 2 | Verify compliance |
| 4.4 Calculate quality scores | Apply quality algorithm | Scores 0-1 range |
| 4.5 Generate validation report | Document issues | Report generated |

**Quality Scoring Algorithm:**
```python
def calculate_quality_score(document: dict) -> float:
    scores = {}

    # Content length (20%)
    word_count = document['metadata'].get('word_count', 0)
    if word_count < 100: scores['length'] = 0.3
    elif word_count < 500: scores['length'] = 0.6
    elif word_count < 2000: scores['length'] = 0.9
    else: scores['length'] = 1.0

    # Completeness (25%)
    optional_fields = ['summary', 'author', 'published_date']
    present = sum(1 for f in optional_fields if document.get('metadata', {}).get(f))
    scores['completeness'] = present / len(optional_fields)

    # Metadata richness (15%)
    metadata_fields = len([v for v in document.get('metadata', {}).values() if v])
    scores['metadata'] = min(metadata_fields / 8, 1.0)

    # Weighted sum
    weights = {'length': 0.20, 'completeness': 0.25, 'metadata': 0.15}
    # Add language quality and uniqueness for full scoring
    return round(sum(scores.get(k, 0.5) * weights.get(k, 0.2) for k in weights), 3)
```

### 5.6 Phase 5: Chunking Pipeline (3 hours)

**Objective:** Create RAG-ready chunks from normalized documents

**Configuration:**
```yaml
chunking_config:
  target_size_words: 800
  min_size_words: 100
  max_size_words: 1200
  overlap_words: 150
  respect_sentence_boundaries: true
  respect_paragraph_boundaries: true
```

**Chunking Algorithm:**
```python
def create_chunks(document: dict, config: dict) -> list[dict]:
    content = document['content']['text']
    words = content.split()

    if len(words) <= config['max_size_words']:
        # Document small enough as single chunk
        return [{
            'chunk_id': generate_chunk_id(document['id'], 0),
            'document_id': document['id'],
            'source': document['source'],
            'source_type': document['source_type'],
            'title': document['title'],
            'content': content,
            'position': {'index': 0, 'total_chunks': 1},
            'metadata': {
                'word_count': len(words),
                'url': document['metadata'].get('url')
            }
        }]

    chunks = []
    start = 0
    chunk_idx = 0

    while start < len(words):
        end = min(start + config['target_size_words'], len(words))

        # Find sentence boundary
        if end < len(words):
            chunk_text = ' '.join(words[start:end])
            last_period = chunk_text.rfind('.')
            if last_period > len(chunk_text) * 0.7:
                end = start + len(chunk_text[:last_period+1].split())

        chunk_content = ' '.join(words[start:end])

        chunks.append({
            'chunk_id': generate_chunk_id(document['id'], chunk_idx),
            'document_id': document['id'],
            'source': document['source'],
            'source_type': document['source_type'],
            'title': document['title'],
            'content': chunk_content,
            'position': {
                'index': chunk_idx,
                'start_char': len(' '.join(words[:start])),
                'end_char': len(' '.join(words[:end])),
                'total_chunks': -1  # Updated after all chunks created
            },
            'metadata': {
                'word_count': len(chunk_content.split()),
                'url': document['metadata'].get('url')
            }
        })

        start = end - config['overlap_words']
        chunk_idx += 1

    # Update total_chunks
    for chunk in chunks:
        chunk['position']['total_chunks'] = len(chunks)

    return chunks
```

### 5.7 Phase 6: Podcast Extraction (6 hours)

**Objective:** Extract and transcribe podcast episodes

**Prerequisites:**
- OpenAI API key for Whisper: `export OPENAI_API_KEY=sk-...`
- Or local Whisper: `pip install openai-whisper`

**Step 1: Extract Metadata**
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --podcast
```

**Step 2: Download Audio (per episode)**
```bash
python /Users/matt/Documents/someday/docs/transcribe_audio.py --download "https://podcast-url/episode.mp3"
```

**Step 3: Transcribe Audio**
```bash
# Using API (faster, ~$0.006/minute)
python /Users/matt/Documents/someday/docs/transcribe_audio.py --api /path/to/episode.mp3

# Using local Whisper (free, slower)
python /Users/matt/Documents/someday/docs/transcribe_audio.py --local /path/to/episode.mp3 --model base
```

**Batch Processing:**
```bash
python /Users/matt/Documents/someday/docs/transcribe_audio.py --batch /Users/matt/Documents/someday/data/raw/podcast/audio --api
```

### 5.8 Phase 7: Blocked Sources (Variable)

**User Actions Required:**

| Source | Action Required | Instructions |
|--------|-----------------|--------------|
| LinkedIn | Export data | 1. LinkedIn Settings > Data Privacy > Get copy of data<br>2. Select "Posts"<br>3. Download ZIP<br>4. Extract CSV file |
| Book | Provide PDF | Place PDF in `/Users/matt/Documents/someday/data/raw/book/pdf/` |
| Deal Academy | Provide credentials | Set `TEACHABLE_EMAIL` and `TEACHABLE_PASSWORD` environment variables |

**After User Action:**
```bash
# LinkedIn
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --linkedin /path/to/linkedin_export.csv

# Book
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --book /Users/matt/Documents/someday/data/raw/book/pdf/book.pdf

# Deal Academy
export TEACHABLE_EMAIL=your@email.com
export TEACHABLE_PASSWORD=yourpassword
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --deal-academy
```

### 5.9 Phase 8: Embedding & Integration (4 hours)

**Objective:** Compute embeddings and load into vector database

**Embedding Configuration:**
```python
EMBEDDING_CONFIG = {
    "model": "text-embedding-3-small",  # OpenAI
    "dimensions": 1536,
    "batch_size": 100,
    "max_tokens_per_chunk": 8000,
    "rate_limit_rpm": 3000
}
```

**Embedding Pipeline:**
```python
from openai import OpenAI
import json
from pathlib import Path

client = OpenAI()

def embed_chunks(chunk_files: list[Path]) -> list[dict]:
    embedded = []

    for chunk_file in chunk_files:
        with open(chunk_file) as f:
            chunk = json.load(f)

        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk['content']
        )

        chunk['embedding'] = {
            'model': 'text-embedding-3-small',
            'dimensions': 1536,
            'vector': response.data[0].embedding
        }

        embedded.append(chunk)

    return embedded
```

**Vector Database Loading (Supabase/pgvector):**
```sql
-- Create table
CREATE TABLE sara_chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    word_count INTEGER,
    url TEXT,
    position_index INTEGER,
    position_total INTEGER,
    quality_score NUMERIC(4,3),
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chunks_source ON sara_chunks(source);
CREATE INDEX idx_chunks_document ON sara_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON sara_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 6. Data Dictionary

### 6.1 Universal Field Definitions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique document identifier | `"youtube_a1b2c3d4e5f6"` |
| `source` | enum | Yes | Source system | `"youtube"`, `"blog"`, `"podcast"` |
| `source_type` | enum | Yes | Specific content type | `"video_transcript"`, `"blog_article"` |
| `title` | string | Yes | Content title | `"How to Buy an Accounting Firm"` |
| `content.text` | string | Yes | Primary text content | Full transcript or article text |
| `content.summary` | string | No | Brief summary | 100-200 word summary |
| `content.key_topics` | array | No | Topic tags | `["M&A", "accounting", "LOI"]` |
| `metadata.url` | string | No | Source URL | `"https://youtube.com/watch?v=..."` |
| `metadata.author` | string | No | Content author | `"Sara Sharp"` |
| `metadata.published_date` | date | No | Publication date | `"2025-10-15"` |
| `metadata.duration_seconds` | integer | No | Duration for audio/video | `1234` |
| `metadata.word_count` | integer | Yes | Word count | `2500` |
| `metadata.language` | string | No | Content language | `"en"` |
| `extraction.extracted_at` | datetime | Yes | Extraction timestamp | `"2026-01-26T18:24:33Z"` |
| `extraction.extractor_version` | string | Yes | Extractor version | `"1.0.0"` |
| `extraction.raw_file_path` | string | No | Path to raw file | `"data/raw/youtube/yt_abc123.vtt"` |
| `extraction.quality_score` | number | No | Quality score 0-1 | `0.85` |

### 6.2 Source-Specific Field Definitions

#### YouTube Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.video_id` | string | YouTube video ID |
| `metadata.source_specific.channel_id` | string | Channel identifier |
| `metadata.source_specific.view_count` | integer | Views at extraction |
| `metadata.source_specific.like_count` | integer | Likes at extraction |
| `metadata.source_specific.caption_type` | string | "auto" or "manual" |

#### Blog Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.slug` | string | URL slug |
| `metadata.source_specific.category` | string | Article category |
| `metadata.source_specific.tags` | array | Article tags |
| `metadata.source_specific.is_primary_author` | boolean | True if Sara Sharp |

#### Podcast Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.episode_number` | integer | Episode number |
| `metadata.source_specific.season_number` | integer | Season number |
| `metadata.source_specific.show_name` | string | Podcast name |
| `metadata.source_specific.audio_url` | string | Audio file URL |
| `metadata.source_specific.transcription_method` | string | "whisper-api" or "whisper-local" |

#### Book Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.chapter_number` | integer | Chapter number |
| `metadata.source_specific.page_start` | integer | Starting page |
| `metadata.source_specific.page_end` | integer | Ending page |
| `metadata.source_specific.isbn` | string | Book ISBN |

#### LinkedIn Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.post_id` | string | LinkedIn post ID |
| `metadata.source_specific.likes_count` | integer | Post likes |
| `metadata.source_specific.comments_count` | integer | Post comments |
| `metadata.source_specific.hashtags` | array | Post hashtags |

#### Deal Academy Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.course_id` | string | Course identifier |
| `metadata.source_specific.course_name` | string | Course name |
| `metadata.source_specific.module_name` | string | Module name |
| `metadata.source_specific.lesson_order` | integer | Lesson sequence |
| `metadata.source_specific.lesson_type` | string | "video", "text", "quiz" |

#### Media Source-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.source_specific.outlet_name` | string | Publication name |
| `metadata.source_specific.article_author` | string | Article author |
| `metadata.source_specific.is_primary_subject` | boolean | Article focuses on Sara |
| `metadata.source_specific.sara_quotes` | array | Direct quotes from Sara |

### 6.3 Chunk Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunk_id` | string | Yes | Unique chunk identifier |
| `document_id` | string | Yes | Parent document ID |
| `source` | string | Yes | Inherited from parent |
| `source_type` | string | Yes | Inherited from parent |
| `title` | string | Yes | Parent document title |
| `content` | string | Yes | Chunk text content |
| `position.index` | integer | Yes | Chunk position (0-based) |
| `position.start_char` | integer | No | Start character position |
| `position.end_char` | integer | No | End character position |
| `position.total_chunks` | integer | Yes | Total chunks for document |
| `context.preceding_text` | string | No | Last 200 chars of previous chunk |
| `context.following_text` | string | No | First 200 chars of next chunk |
| `metadata.word_count` | integer | Yes | Chunk word count |
| `metadata.url` | string | No | Source URL |

### 6.4 State Tracking Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | "pending", "active", "blocked", "complete" |
| `last_extraction` | datetime | Last extraction timestamp |
| `total_items` | integer | Total items extracted |
| `pending_items` | integer | Items awaiting extraction |
| `failed_items` | integer | Items that failed extraction |
| `blocked_reason` | string | Reason if status is blocked |

---

## 7. Operational Runbook

### 7.1 Initial Setup Procedure

**Step 1: Verify Prerequisites**
```bash
# Check Python version
python3 --version  # Requires 3.10+

# Check required packages
pip list | grep -E "yt-dlp|beautifulsoup4|feedparser|requests|pymupdf"

# Install if missing
pip install yt-dlp feedparser beautifulsoup4 requests pymupdf
```

**Step 2: Create Directory Structure**
```bash
cd /Users/matt/Documents/someday

# Create all directories
mkdir -p data/{raw/{youtube/{captions,metadata},blog/articles,podcast/{audio,transcripts,metadata},book/{pdf,extracted},linkedin/{exports,processed},deal_academy/{courses,lessons},media/articles},normalized/documents,rag/{chunks,embeddings,indexes},state}
mkdir -p config scripts/{extract,transform,validate,orchestrate} reports

# Verify structure
find data -type d | head -20
```

**Step 3: Initialize State Files**
```bash
# Create master state file
cat > data/state/extraction_state.json << 'EOF'
{
  "version": "1.0.0",
  "last_updated": null,
  "sources": {
    "youtube": {"status": "pending", "total_items": 0, "pending_items": 100},
    "blog": {"status": "active", "total_items": 20, "pending_items": 20},
    "podcast": {"status": "pending", "total_items": 0, "pending_items": 50},
    "book": {"status": "blocked", "blocked_reason": "Awaiting PDF"},
    "linkedin": {"status": "blocked", "blocked_reason": "Requires export"},
    "deal_academy": {"status": "blocked", "blocked_reason": "Requires credentials"},
    "media": {"status": "pending", "total_items": 0, "pending_items": 0}
  }
}
EOF
```

### 7.2 Extraction Procedures

#### 7.2.1 Blog Extraction

**Command:**
```bash
cd /Users/matt/Documents/someday/docs
python sara_content_extractor.py --blog --output-dir ../data/raw/blog
```

**Expected Output:**
- 40+ articles extracted
- JSON files in `data/raw/blog/articles/`
- Console shows "Extracted X blog articles"

**Troubleshooting:**

| Issue | Symptom | Resolution |
|-------|---------|------------|
| Connection timeout | "Error fetching blog" | Increase timeout in script, retry |
| Empty articles | Word count < 100 | Site structure changed, update selectors |
| Encoding errors | Unicode characters garbled | Verify UTF-8 handling |

#### 7.2.2 YouTube Extraction

**Command:**
```bash
cd /Users/matt/Documents/someday/docs
python sara_content_extractor.py --youtube --output-dir ../data/raw/youtube
```

**Expected Output:**
- 100+ video transcripts
- VTT files in `data/raw/youtube/captions/`
- Console progress: `[1/100] Processing: Video Title...`

**Troubleshooting:**

| Issue | Symptom | Resolution |
|-------|---------|------------|
| SSL errors | Certificate verification failed | Flag `--no-check-certificate` already included |
| 403 Forbidden | Rate limiting | Wait 1 hour, use VPN, reduce batch size |
| No subtitles | "No subtitles available" | Mark for Whisper transcription |
| Timeout | Process hangs | Increase subprocess timeout |

**Rate Limiting Strategy:**
```python
# Add delay between videos
import time
time.sleep(2)  # 2 second delay between requests
```

#### 7.2.3 Podcast Extraction

**Step 1: Metadata Extraction**
```bash
python sara_content_extractor.py --podcast
```

**Step 2: Audio Transcription**
```bash
# Set API key
export OPENAI_API_KEY=sk-your-key-here

# Transcribe single file
python transcribe_audio.py --api /path/to/episode.mp3 --output ../data/raw/podcast/transcripts

# Batch transcription
python transcribe_audio.py --batch ../data/raw/podcast/audio --api --output ../data/raw/podcast/transcripts
```

**Cost Estimation:**
- Whisper API: ~$0.006/minute
- 50 episodes x 30 minutes avg = 1500 minutes = ~$9 total

#### 7.2.4 Book Extraction

**Prerequisites:**
- PDF file placed in `data/raw/book/pdf/`

**Command:**
```bash
python sara_content_extractor.py --book ../data/raw/book/pdf/book_name.pdf --output-dir ../data/raw/book/extracted
```

**Expected Output:**
- Chapter-level JSON files
- Full book JSON
- Console shows page count and word count

#### 7.2.5 LinkedIn Extraction

**Prerequisites:**
- Export file from LinkedIn

**Export Process:**
1. Go to `linkedin.com/settings/data-privacy`
2. Click "Get a copy of your data"
3. Select "Posts"
4. Download ZIP when ready (may take 24-72 hours)
5. Extract CSV file

**Command:**
```bash
python sara_content_extractor.py --linkedin ../data/raw/linkedin/exports/linkedin_posts.csv --output-dir ../data/raw/linkedin/processed
```

#### 7.2.6 Deal Academy Extraction

**Prerequisites:**
- Valid Teachable credentials

**Command:**
```bash
export TEACHABLE_EMAIL=your@email.com
export TEACHABLE_PASSWORD=yourpassword
python sara_content_extractor.py --deal-academy --output-dir ../data/raw/deal_academy
```

### 7.3 Normalization Procedure

**Step 1: Process All Raw Files**
```bash
cd /Users/matt/Documents/someday/scripts/transform
python normalizer.py --input-dir ../../data/raw --output-dir ../../data/normalized/documents
```

**Step 2: Validate Output**
```bash
python ../validate/validator.py --input-dir ../../data/normalized/documents --report-dir ../../reports
```

**Step 3: Review Validation Report**
```bash
cat ../../reports/quality_report_$(date +%Y-%m-%d).json
```

### 7.4 Chunking Procedure

**Command:**
```bash
cd /Users/matt/Documents/someday/scripts/transform
python chunker.py --input-dir ../../data/normalized/documents --output-dir ../../data/rag/chunks --chunk-size 800 --overlap 150
```

**Verification:**
```bash
# Count chunks created
ls ../../data/rag/chunks/*.json | wc -l

# Sample chunk validation
head -50 ../../data/rag/chunks/chunk_*_0001.json
```

### 7.5 Rollback Procedures

#### Rollback Extraction

**Scenario:** Extraction produced corrupt data

**Procedure:**
```bash
# 1. Identify corrupt files
find data/raw -name "*.json" -exec python -m json.tool {} \; 2>&1 | grep -l "error"

# 2. Remove corrupt files
rm data/raw/{source}/{corrupt_files}

# 3. Reset state tracking
# Edit data/state/{source}_state.json to mark items as "pending"

# 4. Re-run extraction for affected items only
```

#### Rollback Normalization

**Scenario:** Schema transformation failed

**Procedure:**
```bash
# 1. Remove normalized files
rm data/normalized/documents/*.json

# 2. Reset pipeline state
# Edit data/state/extraction_state.json: set "last_normalization": null

# 3. Fix transformation script

# 4. Re-run normalization
```

#### Rollback Chunking

**Scenario:** Chunk size misconfigured

**Procedure:**
```bash
# 1. Remove all chunks
rm data/rag/chunks/*.json

# 2. Reset chunking state
# Edit data/state/extraction_state.json: set "chunks_created": 0

# 3. Re-run chunking with correct parameters
```

### 7.6 Monitoring and Health Checks

**Daily Health Check Script:**
```bash
#!/bin/bash
# health_check.sh

echo "=== Data Centralization Health Check ==="
echo "Date: $(date)"
echo ""

# Check file counts
echo "File Counts:"
echo "  Raw YouTube: $(ls data/raw/youtube/captions/*.vtt 2>/dev/null | wc -l)"
echo "  Raw Blog: $(ls data/raw/blog/articles/*.json 2>/dev/null | wc -l)"
echo "  Normalized: $(ls data/normalized/documents/*.json 2>/dev/null | wc -l)"
echo "  Chunks: $(ls data/rag/chunks/*.json 2>/dev/null | wc -l)"
echo ""

# Check state file
echo "Extraction State:"
cat data/state/extraction_state.json | python -c "import sys,json; d=json.load(sys.stdin); print(f'  Blog: {d[\"sources\"][\"blog\"][\"status\"]} ({d[\"sources\"][\"blog\"][\"total_items\"]} items)')"
```

### 7.7 Error Codes and Resolution

| Code | Category | Description | Resolution |
|------|----------|-------------|------------|
| E001 | Extraction | Source unavailable | Check network, retry |
| E002 | Extraction | Authentication failed | Verify credentials |
| E003 | Extraction | Rate limited | Wait and retry with backoff |
| E004 | Extraction | Content not found | Verify URL, skip item |
| E005 | Extraction | Timeout | Increase timeout, retry |
| E010 | Validation | Schema violation | Fix data or schema |
| E011 | Validation | Missing required field | Add field or mark invalid |
| E012 | Validation | Content too short | Review source, may be valid |
| E013 | Validation | Content too long | Verify no duplication |
| E020 | Quality | Below minimum score | Review and improve or exclude |
| E021 | Quality | Duplicate detected | Keep best, remove duplicate |
| E030 | Embedding | API error | Retry with backoff |
| E031 | Embedding | Token limit exceeded | Reduce chunk size |
| E040 | Storage | Write failed | Check permissions, disk space |

---

## 8. Appendices

### 8.1 Quick Reference Commands

| Task | Command |
|------|---------|
| Extract all sources | `python sara_content_extractor.py --all` |
| Extract YouTube only | `python sara_content_extractor.py --youtube` |
| Extract blog only | `python sara_content_extractor.py --blog` |
| Transcribe audio (API) | `python transcribe_audio.py --api /path/to/audio.mp3` |
| Transcribe audio (local) | `python transcribe_audio.py --local /path/to/audio.mp3 --model base` |
| Batch transcribe | `python transcribe_audio.py --batch /path/to/audio/dir --api` |
| Check extraction state | `cat data/state/extraction_state.json | python -m json.tool` |
| Validate JSON | `python -m json.tool < file.json` |
| Count normalized docs | `ls data/normalized/documents/*.json | wc -l` |

### 8.2 Configuration Templates

**sources.yaml:**
```yaml
youtube:
  channel_url: "https://www.youtube.com/@dealmakerseta"
  channel_id: "@dealmakerseta"
  include_auto_captions: true
  preferred_language: "en"

blog:
  base_url: "https://www.skandslegal.com/sks-blog"
  user_agent: "KnowledgeBaseBot/1.0"
  timeout_seconds: 30

podcast:
  feeds:
    - name: "Dealmakers Podcast"
      url: ""  # Add when discovered

deal_academy:
  base_url: "https://www.dealacademy.org"
  platform: "teachable"
```

**quality_rules.yaml:**
```yaml
extraction_validation:
  min_word_count: 50
  max_word_count: 50000
  min_title_length: 5

quality_scoring:
  weights:
    content_length: 0.20
    completeness: 0.25
    language_quality: 0.20
    metadata_richness: 0.15
    uniqueness: 0.20
  minimum_score: 0.5
  target_score: 0.75

chunking:
  target_size_words: 800
  min_size_words: 100
  max_size_words: 1200
  overlap_words: 150
```

### 8.3 Glossary

| Term | Definition |
|------|------------|
| RAG | Retrieval-Augmented Generation - AI technique combining retrieval with generation |
| Chunk | Segment of content optimized for vector embedding (typically 500-1200 words) |
| VTT | WebVTT - Web Video Text Tracks format for subtitles |
| Normalized | Data transformed to conform to a unified schema |
| Embedding | Dense vector representation of text for similarity search |
| pgvector | PostgreSQL extension for vector similarity search |
| Whisper | OpenAI's speech-to-text model |
| Teachable | E-learning platform hosting Deal Academy |

### 8.4 Contact and Support

**Project Location:** `/Users/matt/Documents/someday`

**Key Files:**
- Main extractor: `/Users/matt/Documents/someday/docs/sara_content_extractor.py`
- Audio transcriber: `/Users/matt/Documents/someday/docs/transcribe_audio.py`
- Current data: `/Users/matt/Documents/someday/docs/sara_knowledge_base.json`
- This document: `/Users/matt/Documents/someday/docs/DATA_CENTRALIZATION_MASTER_PLAN.md`

### 8.5 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Claude | Initial comprehensive documentation |

---

## Document Summary

This master plan provides:

1. **Complete project analysis** of 5 existing files and 7 data sources
2. **Architecture design** with directory structure, schemas, and naming conventions
3. **Requirements specification** with 50+ functional requirements across all sources
4. **8-phase implementation plan** with detailed tasks, commands, and validation gates
5. **Data dictionary** with 60+ field definitions across all document types
6. **Operational runbook** with step-by-step procedures, troubleshooting, and rollback processes

**Next Steps:**
1. Execute Phase 1 (Foundation) to create directory structure
2. Execute Phase 2 (Blog Migration) to migrate existing data
3. Execute Phase 3 (YouTube Extraction) to extract video transcripts
4. Continue through phases as prerequisites are met

**Estimated Total Effort:** 27+ hours across all phases

**Blocked Items Requiring User Action:**
- LinkedIn: Manual data export required
- Book: PDF file required
- Deal Academy: Login credentials required
