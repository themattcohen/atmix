# SaraBot - RAG Chatbot for Sara Sharp

A production-ready Retrieval-Augmented Generation (RAG) chatbot serving Sara Sharp's M&A knowledge base. Users can ask questions about buying/selling businesses and receive synthesized answers with source citations.

**Live URL**: https://someday-production.up.railway.app

## Architecture Overview

```
User (Frontend) → FastAPI Server → RAG Retriever → Claude API → Response with Sources
```

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export ANTHROPIC_API_KEY=your_key_here

# Run the server
cd scripts/rag
python server.py

# Open http://localhost:8000 in browser
```

### Deployment (Railway)

The app auto-deploys to Railway on push to `main`. Configuration in `railway.toml`.

Required environment variable in Railway:
- `ANTHROPIC_API_KEY` - Claude API key

## Components

### Backend API (`scripts/rag/server.py`)

FastAPI server with these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Simple health check (always 200) |
| `/api/health` | GET | Detailed health with index status |
| `/api/search` | POST | Semantic search with optional filters |
| `/api/ask` | POST | Main chat: question → RAG → Claude → answer |
| `/api/stats` | GET | Knowledge base statistics |
| `/` | GET | Serves frontend |

**Chat Request (`/api/ask`)**:
```json
{
  "question": "How do I value an accounting practice?",
  "history": [
    {"role": "user", "content": "previous question"},
    {"role": "assistant", "content": "previous answer"}
  ],
  "model": "sonnet"  // haiku, sonnet, or opus
}
```

**Chat Response**:
```json
{
  "answer": "Sara's synthesized response...",
  "sources": [
    {
      "title": "Valuation Methods for Service Businesses",
      "source_type": "youtube",
      "url": "https://...",
      "relevance_score": 0.89,
      "excerpt": "First 200 chars..."
    }
  ],
  "query_time_ms": 1234.5,
  "model": "claude-sonnet-4-20250514",
  "chunks_used": 8
}
```

### Frontend (`frontend/chat.html`)

Single-page chat interface features:
- Chat bubble UI with typing indicator
- Multi-turn conversation support
- Collapsible source citations with relevance scores
- Model selector (Haiku/Sonnet/Opus)
- Dark/light theme toggle
- Suggested starter questions

### RAG Pipeline

#### 1. Chunking (`scripts/transform/chunker.py`)
- Splits documents into ~800 word chunks with 150 word overlap
- Sentence-boundary aware splitting
- Generates deterministic chunk IDs

#### 2. Embeddings (`scripts/rag/embeddings.py`)
- Model: `all-MiniLM-L6-v2` (384 dimensions)
- Output: `data/rag/embeddings/embeddings.npy`

#### 3. Vector Store (`scripts/rag/vector_store.py`)
- FAISS flat index for exact similarity search
- Output: `data/rag/indexes/faiss.index`

#### 4. Retrieval (`scripts/rag/retrieval.py`)
- `RAGRetriever` class handles search
- Supports filtering by source type
- Returns top-k results with metadata

## Data Structure

```
data/rag/
├── chunks/              # 620 text chunks from 154 documents
│   ├── blog_*.json
│   ├── book_*.json
│   ├── newsletter_*.json
│   └── youtube_*.json
├── embeddings/
│   ├── embeddings.npy   # 642 × 384 matrix
│   └── metadata.json
└── indexes/
    ├── faiss.index
    └── store_metadata.json
```

### Knowledge Base Stats

| Source Type | Documents | Chunks |
|-------------|-----------|--------|
| YouTube | 40 | 145 |
| Blog | 20 | ~80 |
| Newsletter | 91 | ~360 |
| Book | 3 | ~57 |
| **Total** | **154** | **642** |

## Claude Models

| Model | ID | Use Case |
|-------|-----|----------|
| Haiku | `claude-3-5-haiku-20241022` | Fast, simple questions |
| Sonnet | `claude-sonnet-4-20250514` | Balanced (default) |
| Opus | `claude-opus-4-5-20251101` | Complex, nuanced questions |

## Sara Sharp Persona

The system prompt defines Sara as:
- **Expertise**: LOI negotiation, SBA loans, due diligence, valuation, deal structuring
- **Style**: Casual, uses contractions, dry humor, real-world analogies
- **Boundaries**: Educational info, not legal advice
- **Sources**: Paraphrases content, acknowledges knowledge gaps

## Deployment

### Dockerfile

```dockerfile
FROM python:3.11-slim
# Pre-downloads embedding model during build
# Sets offline mode for runtime
# Exposes PORT from environment
```

### railway.toml

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `PORT` | No | Server port (Railway sets this) |

## CLI Tools

### Query CLI (`scripts/rag/query_cli.py`)

```bash
# Basic search
python query_cli.py "What is SBA financing?"

# Filter by source
python query_cli.py "deal structure" --source youtube

# JSON output
python query_cli.py "valuation" --top-k 10 --json
```

## Development

### Rebuilding the Index

```bash
# 1. Process new content into chunks
python scripts/transform/chunker.py

# 2. Generate embeddings
python scripts/rag/embeddings.py

# 3. Build FAISS index
python scripts/rag/vector_store.py build \
  --embeddings data/rag/embeddings \
  --output data/rag/indexes
```

### Adding New Content

1. Extract content to `data/normalized/` in standard JSON format
2. Run chunker to split into chunks
3. Run embedding generator
4. Rebuild vector store
5. Commit new index files and deploy

## File Reference

| File | Purpose |
|------|---------|
| `scripts/rag/server.py` | FastAPI server |
| `scripts/rag/retrieval.py` | RAG search engine |
| `scripts/rag/embeddings.py` | Vector generation |
| `scripts/rag/vector_store.py` | FAISS index builder |
| `scripts/transform/chunker.py` | Document chunking |
| `frontend/chat.html` | Chat interface |
| `Dockerfile` | Container build |
| `railway.toml` | Railway config |
| `requirements.txt` | Dependencies |
