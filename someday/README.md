# Sara Sharp Knowledge Base

RAG-powered knowledge base for Sara Sharp's content on M&A, accounting practices, and business acquisitions.

## Current Status

**Working:**
- 511 content chunks indexed (63 YouTube videos + 20 blog posts)
- Semantic search via sentence-transformers embeddings
- REST API server (FastAPI)
- Web frontend for searching

**Not Yet Implemented:**
- Claude API integration for Q&A (returns raw chunks, not synthesized answers)
- Additional data sources (podcast, book, LinkedIn, etc.)

## Quick Start

### Option 1: Web Interface (Recommended)

```bash
# Start the API server
cd /Users/matt/Documents/someday
python3 scripts/rag/server.py

# Open in browser
open http://127.0.0.1:8000
# Or open frontend/index.html directly
```

### Option 2: Command Line

```bash
# Query the knowledge base
python3 scripts/rag/query_cli.py "How do I value an accounting practice?"

# Filter by source
python3 scripts/rag/query_cli.py "SBA loans" --source youtube --top-k 5

# Interactive mode
python3 scripts/rag/query_cli.py --interactive

# JSON output for API integration
python3 scripts/rag/query_cli.py "due diligence checklist" --json
```

### Option 3: API

```bash
# Health check
curl http://127.0.0.1:8000/api/health

# Search
curl -X POST http://127.0.0.1:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "valuation methods", "top_k": 5, "source": "all"}'

# Stats
curl http://127.0.0.1:8000/api/stats
```

## Project Structure

```
someday/
├── data/
│   ├── raw/                    # Extracted content by source
│   │   ├── youtube/transcripts/  # 63 video transcripts
│   │   └── blog/                 # 20 blog articles
│   ├── normalized/documents/   # Unified schema (83 docs)
│   └── rag/
│       ├── chunks/             # 489 RAG chunks
│       ├── embeddings/         # Vector embeddings (511 x 384)
│       └── indexes/            # FAISS search index
├── scripts/
│   ├── extract/                # Source extractors
│   │   ├── youtube_extractor.py
│   │   ├── blog_extractor.py
│   │   ├── whisper_batch.py    # Local Whisper transcription
│   │   └── ...
│   ├── transform/
│   │   ├── normalizer.py       # Unified schema transformer
│   │   └── chunker.py          # RAG chunking
│   ├── rag/
│   │   ├── embeddings.py       # sentence-transformers
│   │   ├── vector_store.py     # FAISS index
│   │   ├── retrieval.py        # Search API
│   │   └── query_cli.py        # CLI interface
│   └── analyze/
│       └── content_analytics.py
├── tests/
│   └── test_rag.py             # 18 tests (all passing)
├── docs/
│   ├── RAG_SYSTEM_DESIGN.md    # Architecture documentation
│   ├── DATA_CENTRALIZATION_MASTER_PLAN.md
│   └── ...
├── reports/
│   ├── content_quality_report.md
│   ├── topic_coverage.md
│   └── data_inventory.md
└── config/
    ├── sources.yaml
    └── schemas.yaml
```

## Content Statistics

| Metric | Value |
|--------|-------|
| Total Documents | 83 |
| Total Words | 247,695 |
| YouTube Videos | 63 (21+ hours) |
| Blog Articles | 20 |
| RAG Chunks | 489 |
| Embedding Dimensions | 384 |

## Adding New Data

```bash
# 1. Extract from source
python3 scripts/extract/{source}_extractor.py

# 2. Normalize to unified schema
python3 scripts/transform/normalizer.py --source {source}

# 3. Create chunks
python3 scripts/transform/chunker.py

# 4. Regenerate embeddings and index
python3 scripts/rag/embeddings.py
python3 scripts/rag/vector_store.py build
```

## Tech Stack

- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **Vector Store**: FAISS (local, no server)
- **Transcription**: OpenAI Whisper (local)
- **YouTube**: yt-dlp
- **All local** - no API keys required for core functionality

## Tests

```bash
# Run all RAG tests
python3 -m pytest tests/test_rag.py -v

# Expected: 18 passed
```

## Documentation

- [RAG System Design](docs/RAG_SYSTEM_DESIGN.md) - Architecture and API specs
- [Data Centralization Plan](docs/DATA_CENTRALIZATION_MASTER_PLAN.md) - Full project plan
- [Requirements](docs/REQUIREMENTS_SPECIFICATION.md) - Detailed requirements
- [Open Items](docs/OPEN_ITEMS_USER_ACTION_REQUIRED.md) - Pending data sources

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check, returns chunk count |
| `/api/stats` | GET | Statistics (chunks, documents, sources) |
| `/api/search` | POST | Semantic search with filters |

### Search Request

```json
{
  "query": "How do I value an accounting practice?",
  "top_k": 10,
  "source": "all"  // "all", "youtube", or "blog"
}
```

### Search Response

```json
{
  "query": "How do I value an accounting practice?",
  "total_results": 10,
  "query_time_ms": 45.2,
  "results": [
    {
      "content": "When valuing an accounting practice...",
      "title": "Buying an Accounting Practice",
      "source_type": "youtube",
      "score": 0.823
    }
  ]
}
```

---

## What's Missing (Action Required)

### 1. Claude API Key (for Q&A feature)
Currently the system only returns raw search results. To enable conversational Q&A:

```bash
# Add to .env file (create if doesn't exist)
ANTHROPIC_API_KEY=sk-ant-...
```

**What this enables:**
- Ask: "How do I value an accounting practice?"
- Get: A synthesized answer citing Sara's content, not just raw excerpts

### 2. Additional Data Sources

| Source | What I Need | How to Get It |
|--------|-------------|---------------|
| **Podcast** | RSS feed URL | From podcast host (Spotify, Apple, etc.) |
| **Book** | PDF file | Copy of Sara's book |
| **LinkedIn** | Data export | LinkedIn Settings → Get a copy of your data |
| **Deal Academy** | Course content | Teachable login credentials or export |
| **Newsletter** | Email archive | GHL export or forwarded emails |

### 3. Production Deployment (Optional)
If you want to host this publicly:
- Domain name
- Hosting service (Vercel, Railway, etc.)
- Decision on authentication (public vs private)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (frontend/index.html)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                    FastAPI Server                            │
│                 (scripts/rag/server.py)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /api/search │  │ /api/health │  │ /api/stats          │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                    RAG Pipeline                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Embeddings  │  │ FAISS Index │  │ Chunk Store         │  │
│  │ (384-dim)   │  │ (511 vecs)  │  │ (JSON metadata)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                    [FUTURE] Claude API                       │
│              Question + Context → Answer                     │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
someday/
├── frontend/
│   ├── index.html          # Main web UI (search interface)
│   ├── test.html           # Simple test page
│   ├── app.js              # JavaScript (unused, inline in index.html)
│   └── styles.css          # Styles (unused, inline in index.html)
├── scripts/
│   ├── rag/
│   │   ├── server.py       # FastAPI server (main entry point)
│   │   ├── retrieval.py    # RAG retriever class
│   │   ├── embeddings.py   # Embedding generation
│   │   ├── vector_store.py # FAISS index management
│   │   └── query_cli.py    # Command-line interface
│   ├── extract/            # Data extractors
│   └── transform/          # Normalization and chunking
├── data/
│   ├── raw/                # Original extracted content
│   ├── normalized/         # Unified schema documents
│   └── rag/
│       ├── chunks/         # Chunked content (JSON)
│       ├── embeddings/     # Vector embeddings (.npy)
│       └── indexes/        # FAISS index files
├── tests/
│   └── test_rag.py         # 18 passing tests
├── docs/                   # Design documentation
├── reports/                # Analytics reports
└── config/                 # Configuration files
```
