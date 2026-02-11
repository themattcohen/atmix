# Sara Sharp Knowledge Base Extraction System
## Requirements Specification Document

**Document Version:** 1.0
**Date:** 2026-01-26
**Author:** Requirements Analysis
**Subject:** Sara Sharp (Attorney/M&A Expert)
**Project:** Knowledge Base Extraction and Centralization System

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Functional Requirements](#3-functional-requirements)
4. [Data Quality Requirements](#4-data-quality-requirements)
5. [Naming Convention Requirements](#5-naming-convention-requirements)
6. [Centralization Requirements](#6-centralization-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Priority Matrix](#9-priority-matrix)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

This document specifies requirements for a comprehensive data extraction and centralization system to build a RAG-ready knowledge base from Sara Sharp's multi-source content portfolio.

### 1.2 Scope

The system shall extract, clean, normalize, and centralize content from seven primary data sources into a unified structure suitable for vector database ingestion and RAG (Retrieval-Augmented Generation) applications.

### 1.3 Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| Sara Sharp | Content Owner | Brand representation, accuracy |
| Development Team | Implementers | Technical feasibility, maintainability |
| End Users | Knowledge Consumers | Query accuracy, relevance |
| RAG System | Downstream Consumer | Data format compatibility |

### 1.4 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Source Coverage | 100% of defined sources | Source extraction completion |
| Content Completeness | >95% of available content | Manual sampling audit |
| Data Quality Score | >90% clean records | Automated validation |
| Field Standardization | 100% compliant | Schema validation |
| RAG Compatibility | Pass all vector DB tests | Integration testing |

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**File:** `/Users/matt/Documents/someday/docs/sara_content_extractor.py`

| Component | Status | Coverage |
|-----------|--------|----------|
| YouTube Extraction | Implemented | Partial (100+ videos targeted) |
| Blog Scraping | Implemented | 20 articles extracted |
| Book PDF Extraction | Implemented | Awaiting PDF file |
| Podcast Extraction | Partial | RSS metadata only, needs transcription |
| LinkedIn Extraction | Stub | Requires manual export |
| Deal Academy | Stub | Requires authentication |
| Media Mentions | Not Implemented | Manual identification needed |

### 2.2 Current Output Structure

```
sara_knowledge_base/
├── sara_knowledge_base.json    # 74KB, 20 items
├── sara_knowledge_base.md      # Summary (not generated)
└── sara_rag_chunks.json        # Chunked output (not generated)
```

### 2.3 Identified Gaps

1. **YouTube**: No transcripts extracted (0 of 100+ videos)
2. **Podcast**: Audio transcription pipeline incomplete
3. **Deal Academy**: No authentication implementation
4. **LinkedIn**: No export processed
5. **Media**: No extraction logic
6. **Naming**: Inconsistent field names across sources
7. **Quality**: No validation or cleaning pipeline
8. **Deduplication**: No cross-source deduplication

---

## 3. Functional Requirements

### 3.1 YouTube Channel Extraction (FR-YT)

**Source:** `https://www.youtube.com/@dealmakerseta`
**Expected Volume:** 100+ videos

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-YT-001 | Extract video metadata (title, URL, upload date, duration, view count) | P0 | All published videos captured with complete metadata |
| FR-YT-002 | Download auto-generated captions (VTT/SRT) | P0 | Captions retrieved for >80% of videos |
| FR-YT-003 | Parse and clean caption text (remove timestamps, artifacts) | P0 | No VTT formatting artifacts in output |
| FR-YT-004 | Handle videos without captions via Whisper fallback | P1 | Audio transcription for uncaptioned videos |
| FR-YT-005 | Extract video descriptions | P2 | Description text captured for all videos |
| FR-YT-006 | Capture channel-level metadata | P2 | Channel name, subscriber count, total videos |
| FR-YT-007 | Incremental extraction (skip already processed) | P1 | Re-runs only process new content |
| FR-YT-008 | Rate limiting and retry logic | P0 | Graceful handling of YouTube API limits |

**Data Fields Required:**
```yaml
youtube_content:
  id: string              # Unique identifier (hash)
  source: "youtube"       # Fixed value
  content_type: "video_transcript"
  video_id: string        # YouTube video ID
  title: string           # Video title
  description: string     # Video description
  url: string             # Full YouTube URL
  channel_name: string    # Channel name
  published_date: ISO8601 # Upload date
  duration_seconds: int   # Video length
  view_count: int         # Views at extraction
  transcript: string      # Full cleaned transcript
  word_count: int         # Transcript word count
  has_manual_captions: bool
  extracted_at: ISO8601
```

---

### 3.2 Blog Article Extraction (FR-BL)

**Source:** `https://www.skandslegal.com/sks-blog`
**Expected Volume:** 40+ articles

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-BL-001 | Scrape all blog article URLs from index | P0 | All article links captured |
| FR-BL-002 | Extract article title, author, date | P0 | Complete metadata for all articles |
| FR-BL-003 | Extract full article body text | P0 | Complete text without navigation/footer |
| FR-BL-004 | Handle pagination on blog index | P0 | All pages crawled |
| FR-BL-005 | Extract article categories/tags | P1 | Categories captured where available |
| FR-BL-006 | Identify Sara Sharp vs. other authors | P0 | Author attribution accurate |
| FR-BL-007 | Handle embedded media references | P2 | Links to embedded content captured |
| FR-BL-008 | Respect robots.txt and rate limits | P0 | Polite scraping behavior |

**Data Fields Required:**
```yaml
blog_content:
  id: string              # Unique identifier (hash)
  source: "blog"          # Fixed value
  content_type: "blog_article"
  title: string           # Article title
  author: string          # Author name
  url: string             # Article URL
  published_date: ISO8601 # Publication date
  categories: string[]    # Topic categories
  content: string         # Full article text
  word_count: int
  reading_time_minutes: int
  is_primary_author: bool # True if Sara Sharp
  extracted_at: ISO8601
```

---

### 3.3 Podcast Extraction (FR-PC)

**Sources:** RSS feeds (Dealmakers/Acquisitive podcasts)
**Expected Volume:** 50+ episodes

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-PC-001 | Discover and parse podcast RSS feeds | P0 | All active feeds identified |
| FR-PC-002 | Extract episode metadata (title, date, duration) | P0 | Complete metadata captured |
| FR-PC-003 | Extract episode descriptions/show notes | P0 | Full descriptions captured |
| FR-PC-004 | Download audio files for transcription | P1 | Audio accessible for processing |
| FR-PC-005 | Transcribe audio via Whisper API | P1 | Full transcripts for all episodes |
| FR-PC-006 | Handle multiple podcast shows | P0 | Distinct sources tracked |
| FR-PC-007 | Extract guest information where available | P2 | Guest names captured |
| FR-PC-008 | Track episode numbers/seasons | P1 | Episodic metadata preserved |

**Data Fields Required:**
```yaml
podcast_content:
  id: string              # Unique identifier (hash)
  source: "podcast"       # Fixed value
  content_type: "podcast_episode"
  show_name: string       # Podcast show name
  episode_number: int     # Episode number
  season_number: int      # Season if applicable
  title: string           # Episode title
  description: string     # Show notes/description
  url: string             # Episode URL
  audio_url: string       # Direct audio file URL
  published_date: ISO8601
  duration_seconds: int
  guest_names: string[]   # Featured guests
  transcript: string      # Full transcription
  word_count: int
  transcription_method: string  # "whisper-api" | "whisper-local" | "manual"
  extracted_at: ISO8601
```

---

### 3.4 Book/PDF Extraction (FR-BK)

**Source:** PDF files (user-provided)
**Expected Volume:** 1-3 books

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-BK-001 | Extract text from all PDF pages | P0 | Full text extraction |
| FR-BK-002 | Detect and preserve chapter structure | P0 | Chapter boundaries identified |
| FR-BK-003 | Handle multi-column layouts | P1 | Correct reading order maintained |
| FR-BK-004 | Extract table of contents | P1 | TOC structure captured |
| FR-BK-005 | Preserve footnotes and citations | P2 | References maintained |
| FR-BK-006 | Handle embedded images (OCR if needed) | P2 | Text from images extracted |
| FR-BK-007 | Track page numbers for references | P0 | Page attribution preserved |
| FR-BK-008 | Generate chapter-level and section-level chunks | P0 | Hierarchical chunking |

**Data Fields Required:**
```yaml
book_content:
  id: string              # Unique identifier (hash)
  source: "book"          # Fixed value
  content_type: "book_chapter" | "book_section" | "book_full"
  book_title: string      # Book title
  author: string          # Author name
  isbn: string            # ISBN if available
  chapter_number: int
  chapter_title: string
  section_title: string
  content: string         # Chapter/section text
  word_count: int
  page_start: int
  page_end: int
  total_pages: int        # Book total (on book_full only)
  publication_year: int
  extracted_at: ISO8601
```

---

### 3.5 LinkedIn Extraction (FR-LI)

**Source:** LinkedIn profile/posts (Sara Sharp)
**Expected Volume:** 100+ posts

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-LI-001 | Import LinkedIn data export (CSV/JSON) | P0 | All exported posts ingested |
| FR-LI-002 | Parse post content and formatting | P0 | Clean text extraction |
| FR-LI-003 | Extract post date and engagement metrics | P0 | Complete metadata |
| FR-LI-004 | Handle articles vs. short posts | P0 | Content types distinguished |
| FR-LI-005 | Extract comments by Sara on own posts | P2 | Author comments captured |
| FR-LI-006 | Handle media attachments (images, videos) | P2 | Media references captured |
| FR-LI-007 | Support PhantomBuster export format | P1 | Alternative import path |
| FR-LI-008 | Deduplicate posts across export sources | P1 | No duplicate content |

**Data Fields Required:**
```yaml
linkedin_content:
  id: string              # Unique identifier (hash)
  source: "linkedin"      # Fixed value
  content_type: "linkedin_post" | "linkedin_article"
  post_id: string         # LinkedIn post ID
  title: string           # Article title (if article)
  content: string         # Post/article text
  url: string             # Post permalink
  published_date: ISO8601
  likes_count: int
  comments_count: int
  shares_count: int
  hashtags: string[]
  mentions: string[]
  has_media: bool
  word_count: int
  extracted_at: ISO8601
```

---

### 3.6 Deal Academy Extraction (FR-DA)

**Source:** `https://www.dealacademy.org` (Teachable platform)
**Expected Volume:** Multiple courses, 50+ lessons

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-DA-001 | Authenticate with Teachable platform | P0 | Secure login implemented |
| FR-DA-002 | Extract course catalog and structure | P0 | All courses identified |
| FR-DA-003 | Extract lesson titles and descriptions | P0 | Complete lesson metadata |
| FR-DA-004 | Extract lesson video transcripts | P0 | Video content transcribed |
| FR-DA-005 | Extract downloadable resources | P1 | PDF/document content captured |
| FR-DA-006 | Extract quiz/assessment content | P2 | Educational materials captured |
| FR-DA-007 | Preserve course hierarchy (modules/sections) | P0 | Structure maintained |
| FR-DA-008 | Handle Teachable's dynamic content loading | P0 | All content accessible |

**Data Fields Required:**
```yaml
course_content:
  id: string              # Unique identifier (hash)
  source: "deal_academy"  # Fixed value
  content_type: "course_lesson" | "course_resource" | "course_quiz"
  course_name: string
  course_id: string
  module_name: string
  module_order: int
  lesson_name: string
  lesson_order: int
  lesson_type: string     # "video" | "text" | "quiz" | "download"
  description: string
  transcript: string      # Video transcript
  content: string         # Text content
  resource_url: string    # Download URL if applicable
  duration_seconds: int   # Video duration
  word_count: int
  url: string             # Lesson URL
  extracted_at: ISO8601
```

---

### 3.7 Media Features Extraction (FR-MF)

**Sources:** News articles, interviews, podcasts featuring Sara
**Expected Volume:** 20+ mentions

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-MF-001 | Search for media mentions via configurable queries | P1 | Automated discovery |
| FR-MF-002 | Extract article content where Sara is quoted | P1 | Full context captured |
| FR-MF-003 | Identify publication/outlet name | P0 | Source attribution |
| FR-MF-004 | Extract publication date | P0 | Temporal context |
| FR-MF-005 | Extract article author | P1 | Author attribution |
| FR-MF-006 | Handle paywall content gracefully | P2 | Partial extraction or skip |
| FR-MF-007 | Manual URL input support | P0 | User-provided sources accepted |
| FR-MF-008 | Distinguish quotes vs. authored content | P1 | Content type identified |

**Data Fields Required:**
```yaml
media_content:
  id: string              # Unique identifier (hash)
  source: "media"         # Fixed value
  content_type: "media_feature" | "media_interview" | "media_quote"
  outlet_name: string     # Publication name
  article_title: string
  article_author: string
  url: string
  published_date: ISO8601
  content: string         # Full article or relevant excerpt
  sara_quotes: string[]   # Direct quotes from Sara
  word_count: int
  is_primary_subject: bool  # True if article is about Sara
  extracted_at: ISO8601
```

---

## 4. Data Quality Requirements

### 4.1 Cleaning Requirements (DQ-CL)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| DQ-CL-001 | Remove HTML tags and entities | P0 | No HTML in content fields |
| DQ-CL-002 | Normalize whitespace (collapse multiple spaces/newlines) | P0 | Single spaces between words |
| DQ-CL-003 | Remove VTT/SRT caption artifacts | P0 | No timestamps or position markers |
| DQ-CL-004 | Remove navigation/boilerplate text | P0 | Only substantive content |
| DQ-CL-005 | Fix encoding issues (UTF-8 normalization) | P0 | Consistent character encoding |
| DQ-CL-006 | Remove duplicate sentences within content | P1 | No verbatim repetition |
| DQ-CL-007 | Standardize quotation marks and apostrophes | P1 | Consistent punctuation |
| DQ-CL-008 | Remove tracking parameters from URLs | P1 | Clean canonical URLs |

### 4.2 Normalization Requirements (DQ-NM)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| DQ-NM-001 | Standardize date formats to ISO8601 | P0 | All dates in YYYY-MM-DDTHH:MM:SSZ |
| DQ-NM-002 | Normalize author names (consistent casing) | P0 | "Sara Sharp" consistently formatted |
| DQ-NM-003 | Standardize URL formats (lowercase, no trailing slash) | P1 | Consistent URL structure |
| DQ-NM-004 | Convert duration formats to seconds | P0 | Integer seconds for all durations |
| DQ-NM-005 | Standardize boolean values | P0 | true/false (not 1/0, yes/no) |
| DQ-NM-006 | Normalize empty values to null | P0 | No empty strings, undefined, or "N/A" |
| DQ-NM-007 | Standardize array fields (sorted, unique) | P1 | Consistent array handling |
| DQ-NM-008 | Normalize numeric fields (no string numbers) | P0 | Integers and floats typed correctly |

### 4.3 Validation Requirements (DQ-VL)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| DQ-VL-001 | Validate required fields are present | P0 | No records missing required fields |
| DQ-VL-002 | Validate URLs are well-formed | P0 | All URLs pass format validation |
| DQ-VL-003 | Validate dates are parseable | P0 | All dates valid ISO8601 |
| DQ-VL-004 | Validate content length minimums | P0 | word_count > 50 for substantive content |
| DQ-VL-005 | Validate enum fields against allowed values | P0 | source, content_type match schema |
| DQ-VL-006 | Validate ID uniqueness across dataset | P0 | No duplicate IDs |
| DQ-VL-007 | Validate cross-field consistency | P1 | word_count matches actual count |
| DQ-VL-008 | Generate validation report with error details | P1 | Actionable error messages |

### 4.4 Deduplication Requirements (DQ-DD)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| DQ-DD-001 | Detect exact duplicate content across sources | P0 | No verbatim duplicates |
| DQ-DD-002 | Detect near-duplicate content (>90% similarity) | P1 | Semantic duplicates flagged |
| DQ-DD-003 | Merge duplicate records preserving best metadata | P1 | Richest metadata retained |
| DQ-DD-004 | Cross-reference content appearing on multiple platforms | P2 | YouTube video also on podcast flagged |
| DQ-DD-005 | Generate deduplication report | P1 | Audit trail for merges |

---

## 5. Naming Convention Requirements

### 5.1 Field Naming Standards (NC-FN)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NC-FN-001 | Use snake_case for all field names | P0 | No camelCase or kebab-case |
| NC-FN-002 | Use consistent terminology across sources | P0 | Same concept = same name |
| NC-FN-003 | Prefix boolean fields with "is_" or "has_" | P1 | Clear boolean identification |
| NC-FN-004 | Suffix count fields with "_count" | P1 | Clear numeric identification |
| NC-FN-005 | Suffix date fields with "_date" or "_at" | P1 | Clear temporal identification |
| NC-FN-006 | Use singular nouns for scalar fields | P1 | Grammatically correct |
| NC-FN-007 | Use plural nouns for array fields | P1 | Clear array identification |
| NC-FN-008 | Document all field names in data dictionary | P0 | Complete field documentation |

### 5.2 Standard Field Mapping

**Current (Inconsistent) -> Standardized:**

| Current Field | Standardized Field | Notes |
|---------------|-------------------|-------|
| `source_type` | `content_type` | More descriptive |
| `upload_date` | `published_date` | Consistent temporal naming |
| `word_count` | `word_count` | Keep as-is |
| `content` | `content` | Keep as-is |
| `extracted_at` | `extracted_at` | Keep as-is |
| `duration` | `duration_seconds` | Explicit units |
| `engagement` | `engagement_count` | Or split to likes_count, etc. |
| `summary` | `description` | Consistent naming |
| `published` | `published_date` | Consistent naming |
| `needs_transcription` | `has_transcript` (inverted) | Positive boolean |
| `audio_url` | `audio_url` | Keep as-is |
| `video_id` | `video_id` | Keep as-is |
| `chunk_index` | `chunk_index` | Keep as-is |

### 5.3 Source Type Enumeration

| source | content_type | Description |
|--------|--------------|-------------|
| `youtube` | `video_transcript` | YouTube video with transcript |
| `blog` | `blog_article` | SK&S Law blog article |
| `podcast` | `podcast_episode` | Podcast episode |
| `book` | `book_chapter` | Book chapter |
| `book` | `book_section` | Book subsection |
| `book` | `book_full` | Complete book text |
| `linkedin` | `linkedin_post` | Short-form LinkedIn post |
| `linkedin` | `linkedin_article` | Long-form LinkedIn article |
| `deal_academy` | `course_lesson` | Course video/text lesson |
| `deal_academy` | `course_resource` | Downloadable resource |
| `media` | `media_feature` | News article featuring Sara |
| `media` | `media_interview` | Interview with Sara |

---

## 6. Centralization Requirements

### 6.1 Unified Schema (CR-US)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| CR-US-001 | Define universal base schema for all content | P0 | Common fields documented |
| CR-US-002 | Define source-specific extension schemas | P0 | All sources have schemas |
| CR-US-003 | All records share common metadata fields | P0 | Consistent base structure |
| CR-US-004 | Schema version tracking | P1 | Schema changes tracked |
| CR-US-005 | JSON Schema validation files generated | P1 | Automated validation possible |

**Universal Base Schema:**
```yaml
base_schema:
  id: string              # Required: Unique content identifier
  source: string          # Required: enum of source types
  content_type: string    # Required: specific content type
  title: string           # Required: content title/name
  url: string             # Optional: source URL
  content: string         # Required: full text content
  description: string     # Optional: summary/description
  author: string          # Optional: content author
  published_date: ISO8601 # Required: original publication date
  word_count: int         # Required: content word count
  extracted_at: ISO8601   # Required: extraction timestamp
  metadata: object        # Optional: source-specific fields
```

### 6.2 Output Format Requirements (CR-OF)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| CR-OF-001 | Primary output: single unified JSON file | P0 | All content in one file |
| CR-OF-002 | RAG chunks output: pre-chunked JSON file | P0 | Vector-ready chunks |
| CR-OF-003 | Markdown summary output | P1 | Human-readable overview |
| CR-OF-004 | Per-source JSON files for debugging | P2 | Source isolation |
| CR-OF-005 | CSV export option for spreadsheet analysis | P2 | Flat file export |
| CR-OF-006 | JSONL format option for streaming | P2 | Line-delimited JSON |

### 6.3 RAG Chunking Requirements (CR-RC)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| CR-RC-001 | Configurable chunk size (default 1000 words) | P0 | Adjustable parameter |
| CR-RC-002 | Configurable overlap (default 200 words) | P0 | Adjustable parameter |
| CR-RC-003 | Preserve metadata on all chunks | P0 | Source tracing possible |
| CR-RC-004 | Chunk IDs reference parent content | P0 | `{parent_id}-{chunk_index}` |
| CR-RC-005 | Respect sentence boundaries | P1 | No mid-sentence splits |
| CR-RC-006 | Respect paragraph boundaries where possible | P2 | Semantic chunking |
| CR-RC-007 | Add chunk position context | P1 | "chunk 3 of 5" metadata |

**Chunk Schema:**
```yaml
chunk_schema:
  id: string              # "{parent_id}-{chunk_index}"
  parent_id: string       # Reference to source content
  chunk_index: int        # Position in sequence
  total_chunks: int       # Total chunks for this content
  source: string          # Inherited from parent
  content_type: string    # Inherited from parent
  title: string           # Inherited from parent
  url: string             # Inherited from parent
  content: string         # Chunk text
  word_count: int         # Chunk word count
```

### 6.4 File Organization (CR-FO)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| CR-FO-001 | Configurable output directory | P0 | CLI parameter |
| CR-FO-002 | Timestamped output files for versioning | P1 | Multiple runs preserved |
| CR-FO-003 | Latest symlink to most recent output | P2 | Easy access to current data |
| CR-FO-004 | Separate raw and processed data directories | P1 | Clear data pipeline stages |

**Target Directory Structure:**
```
sara_knowledge_base/
├── raw/                          # Raw extracted data
│   ├── youtube/
│   ├── blog/
│   ├── podcast/
│   ├── book/
│   ├── linkedin/
│   ├── deal_academy/
│   └── media/
├── processed/                    # Cleaned/normalized data
│   └── {timestamp}/
│       ├── sara_knowledge_base.json
│       ├── sara_rag_chunks.json
│       ├── sara_knowledge_base.md
│       └── validation_report.json
├── latest -> processed/{latest}  # Symlink
└── schema/
    ├── base_schema.json
    └── validation_rules.json
```

---

## 7. Non-Functional Requirements

### 7.1 Performance Requirements (NFR-PF)

| ID | Requirement | Priority | Target | Acceptance Criteria |
|----|-------------|----------|--------|---------------------|
| NFR-PF-001 | YouTube extraction completion | P1 | < 2 hours for 100 videos | Timed execution |
| NFR-PF-002 | Blog extraction completion | P1 | < 10 minutes for 50 articles | Timed execution |
| NFR-PF-003 | Chunking throughput | P1 | > 10,000 chunks/minute | Benchmark test |
| NFR-PF-004 | Memory usage | P1 | < 2GB RAM peak | Resource monitoring |
| NFR-PF-005 | Incremental update performance | P1 | < 10 minutes for new content | Re-run timing |
| NFR-PF-006 | Parallel extraction support | P2 | Up to 5 concurrent sources | Multi-source test |

### 7.2 Reliability Requirements (NFR-RL)

| ID | Requirement | Priority | Target | Acceptance Criteria |
|----|-------------|----------|--------|---------------------|
| NFR-RL-001 | Graceful failure handling | P0 | No data loss on errors | Error recovery test |
| NFR-RL-002 | Checkpoint/resume capability | P1 | Resume from last checkpoint | Interrupted run test |
| NFR-RL-003 | Retry logic for network failures | P0 | 3 retries with backoff | Network error test |
| NFR-RL-004 | Extraction success rate | P0 | > 95% of available content | Coverage audit |
| NFR-RL-005 | Data integrity verification | P0 | Checksums on output files | Integrity validation |
| NFR-RL-006 | Idempotent re-runs | P0 | Same input = same output | Determinism test |

### 7.3 Maintainability Requirements (NFR-MT)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-MT-001 | Modular extractor architecture | P0 | Each source in separate module |
| NFR-MT-002 | Configuration file for source parameters | P1 | No hardcoded URLs/credentials |
| NFR-MT-003 | Comprehensive logging | P0 | DEBUG/INFO/WARN/ERROR levels |
| NFR-MT-004 | Progress reporting during extraction | P1 | Real-time status updates |
| NFR-MT-005 | Unit tests for core functions | P1 | > 80% code coverage |
| NFR-MT-006 | Documentation for each extractor | P0 | README per source |

### 7.4 Security Requirements (NFR-SC)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-SC-001 | Credentials stored in environment variables | P0 | No hardcoded secrets |
| NFR-SC-002 | Support for secrets manager integration | P2 | AWS/GCP secrets compatible |
| NFR-SC-003 | HTTPS for all network requests | P0 | No HTTP connections |
| NFR-SC-004 | Rate limiting to avoid service bans | P0 | Configurable delays |
| NFR-SC-005 | Robots.txt compliance for scraping | P0 | Respect crawl directives |
| NFR-SC-006 | Audit logging for authentication events | P1 | Login attempts logged |

### 7.5 Usability Requirements (NFR-US)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-US-001 | CLI interface with --help documentation | P0 | All options documented |
| NFR-US-002 | Single command full extraction | P0 | `--all` flag works |
| NFR-US-003 | Individual source extraction | P0 | `--youtube`, `--blog`, etc. |
| NFR-US-004 | Dry-run mode | P1 | Preview without writing |
| NFR-US-005 | Verbose mode for debugging | P1 | Detailed output option |
| NFR-US-006 | Quiet mode for automation | P2 | Minimal output option |

---

## 8. Acceptance Criteria

### 8.1 Source-Level Acceptance

| Source | Criteria | Measurement |
|--------|----------|-------------|
| YouTube | 100+ transcripts extracted | Count check |
| YouTube | >80% videos have transcripts | Coverage ratio |
| YouTube | All transcripts >50 words | Minimum length |
| Blog | 40+ articles extracted | Count check |
| Blog | Author attribution accurate | Manual sampling |
| Podcast | All episodes discovered | RSS feed validation |
| Podcast | Transcripts for >50% episodes | Coverage ratio |
| Book | Full text extraction verified | Manual review |
| Book | Chapter structure preserved | Structure validation |
| LinkedIn | All exported posts ingested | Count match |
| Deal Academy | All accessible courses extracted | Course inventory |
| Media | Configurable search queries work | Query execution |

### 8.2 Data Quality Acceptance

| Category | Criteria | Target |
|----------|----------|--------|
| Cleaning | No HTML artifacts | 100% |
| Cleaning | No timestamp artifacts | 100% |
| Normalization | ISO8601 dates | 100% |
| Normalization | Consistent field names | 100% |
| Validation | Required fields present | 100% |
| Validation | URLs well-formed | 100% |
| Deduplication | No exact duplicates | 100% |
| Deduplication | Near-duplicates flagged | >90% |

### 8.3 Integration Acceptance

| Test | Criteria | Measurement |
|------|----------|-------------|
| JSON Valid | Output parses without errors | JSON validator |
| Schema Compliant | All records match schema | JSON Schema validation |
| Chunk Quality | Chunks average 800-1200 words | Size distribution |
| Vector DB Load | Chunks load to Pinecone/pgvector | Integration test |
| RAG Query | Sample queries return relevant results | Query testing |

---

## 9. Priority Matrix

### 9.1 Priority Definitions

| Priority | Definition | Timeline |
|----------|------------|----------|
| **P0** | Critical - System non-functional without | Phase 1 (Weeks 1-2) |
| **P1** | High - Core functionality, strong business need | Phase 2 (Weeks 3-4) |
| **P2** | Medium - Enhanced functionality, nice-to-have | Phase 3 (Weeks 5-6) |

### 9.2 P0 Requirements Summary (Must Have)

**Functional:**
- FR-YT-001, 002, 003, 008 (YouTube core extraction)
- FR-BL-001, 002, 003, 004, 006, 008 (Blog core extraction)
- FR-PC-001, 002, 003, 006 (Podcast metadata)
- FR-BK-001, 002, 007, 008 (Book core extraction)
- FR-LI-001, 002, 003, 004 (LinkedIn import)
- FR-DA-001, 002, 003, 007, 008 (Deal Academy core)
- FR-MF-003, 004, 007 (Media basic)

**Data Quality:**
- DQ-CL-001 through 005 (Core cleaning)
- DQ-NM-001 through 006, 008 (Core normalization)
- DQ-VL-001 through 006 (Core validation)
- DQ-DD-001 (Exact deduplication)

**Naming:**
- NC-FN-001, 002, 008 (Core naming standards)

**Centralization:**
- CR-US-001 through 003 (Unified schema)
- CR-OF-001, 002 (Primary outputs)
- CR-RC-001 through 004 (Chunking basics)
- CR-FO-001 (Output directory)

**Non-Functional:**
- NFR-RL-001, 003, 004, 006 (Core reliability)
- NFR-MT-001, 003, 006 (Core maintainability)
- NFR-SC-001, 003, 004, 005 (Core security)
- NFR-US-001, 002, 003 (Core usability)

### 9.3 P1 Requirements Summary (Should Have)

**Functional:**
- FR-YT-004, 007 (Whisper fallback, incremental)
- FR-BL-005 (Categories)
- FR-PC-004, 005, 008 (Audio transcription)
- FR-BK-003, 004 (Multi-column, TOC)
- FR-LI-007, 008 (PhantomBuster, dedupe)
- FR-MF-001, 002, 005, 008 (Media discovery)

**Data Quality:**
- DQ-CL-006, 007, 008 (Advanced cleaning)
- DQ-NM-007 (Array normalization)
- DQ-VL-007, 008 (Advanced validation)
- DQ-DD-002, 003, 005 (Near-duplicate handling)

**Naming:**
- NC-FN-003 through 007 (Naming conventions)

**Centralization:**
- CR-US-004, 005 (Schema versioning)
- CR-OF-003 (Markdown summary)
- CR-RC-005, 007 (Sentence boundaries, position)
- CR-FO-002, 004 (Timestamping, organization)

**Non-Functional:**
- NFR-PF-001 through 005 (Performance)
- NFR-RL-002, 005 (Checkpoint, integrity)
- NFR-MT-004, 005 (Progress, tests)
- NFR-SC-006 (Audit logging)
- NFR-US-004, 005 (Dry-run, verbose)

### 9.4 P2 Requirements Summary (Nice to Have)

**Functional:**
- FR-YT-005, 006 (Descriptions, channel metadata)
- FR-BL-007 (Embedded media)
- FR-PC-007 (Guest info)
- FR-BK-005, 006 (Footnotes, OCR)
- FR-LI-005, 006 (Comments, media)
- FR-DA-006 (Quiz content)
- FR-MF-006 (Paywall handling)

**Data Quality:**
- DQ-DD-004 (Cross-source reference)

**Centralization:**
- CR-OF-004, 005, 006 (Per-source, CSV, JSONL)
- CR-RC-006 (Paragraph boundaries)
- CR-FO-003 (Symlinks)

**Non-Functional:**
- NFR-PF-006 (Parallel extraction)
- NFR-SC-002 (Secrets manager)
- NFR-US-006 (Quiet mode)

---

## 10. Appendices

### 10.1 Glossary

| Term | Definition |
|------|------------|
| RAG | Retrieval-Augmented Generation - AI technique combining retrieval and generation |
| Chunk | Segment of content optimized for vector embedding |
| VTT | WebVTT - Web Video Text Tracks format for subtitles |
| SRT | SubRip subtitle format |
| ISO8601 | International date/time format standard |
| Whisper | OpenAI's speech-to-text model |
| Teachable | E-learning platform hosting Deal Academy |
| PhantomBuster | Automation tool for social media data extraction |

### 10.2 Data Source URLs

| Source | URL | Access Type |
|--------|-----|-------------|
| YouTube | `https://www.youtube.com/@dealmakerseta` | Public |
| Blog | `https://www.skandslegal.com/sks-blog` | Public |
| Deal Academy | `https://www.dealacademy.org` | Authenticated |
| LinkedIn | `https://www.linkedin.com/in/sara-sharp-9a2a98b` | Export/API |

### 10.3 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Python 3.10+ | Primary language |
| YouTube | yt-dlp | Video/caption extraction |
| Web Scraping | BeautifulSoup4, requests | Blog and media |
| PDF | PyMuPDF (fitz) | Book extraction |
| RSS | feedparser | Podcast feeds |
| Transcription | OpenAI Whisper API / whisper-local | Audio to text |
| Output | JSON, Markdown | Data formats |

### 10.4 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| YouTube rate limiting | High | Medium | Exponential backoff, caching |
| Teachable auth changes | Medium | High | Session monitoring, alerts |
| Content structure changes | Medium | Medium | CSS selector abstraction |
| Large audio files | Medium | Low | Chunked transcription |
| API costs (Whisper) | Medium | Low | Local Whisper fallback |
| Data privacy concerns | Low | High | Secure storage, access control |

### 10.5 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Requirements Analysis | Initial specification |

---

**Document Status:** DRAFT - Pending Stakeholder Review

**Next Steps:**
1. Stakeholder review and approval
2. Technical feasibility assessment
3. Sprint planning for P0 requirements
4. Implementation kickoff
