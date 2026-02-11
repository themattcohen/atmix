# Setup Guide

## Prerequisites

- Python 3.9+
- macOS (tested on Darwin 22.6.0)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/themattcohen/someday.git
cd someday
```

### 2. Create virtual environment (recommended)

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

If no requirements.txt exists, install manually:

```bash
pip install \
  sentence-transformers \
  faiss-cpu \
  fastapi \
  uvicorn \
  pydantic \
  numpy \
  yt-dlp \
  openai-whisper
```

### 4. Verify installation

```bash
# Check RAG components
python3 -c "from scripts.rag.retrieval import RAGRetriever; print('RAG OK')"

# Run tests
python3 -m pytest tests/test_rag.py -v
```

## Running the System

### Web Interface

```bash
# Start server (runs on port 8000)
python3 scripts/rag/server.py

# Open browser
open http://127.0.0.1:8000
```

### Command Line

```bash
# Single query
python3 scripts/rag/query_cli.py "How do I value an accounting practice?"

# With filters
python3 scripts/rag/query_cli.py "SBA loans" --source youtube --top-k 5

# Interactive mode
python3 scripts/rag/query_cli.py --interactive
```

### API

```bash
# Health check
curl http://127.0.0.1:8000/api/health

# Search
curl -X POST http://127.0.0.1:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "due diligence", "top_k": 5}'
```

## Environment Variables (Optional)

Create a `.env` file in the project root:

```bash
# For future Claude API integration
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Change default port
PORT=8000
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'scripts'"

Run from the project root directory:
```bash
cd /Users/matt/Documents/someday
python3 scripts/rag/server.py
```

### "TypeError: unsupported operand type(s) for |"

You're running Python < 3.10. The code has been fixed for Python 3.9 compatibility, but if you see this error, ensure you have the latest code:
```bash
git pull origin main
```

### Server won't start

Check if port 8000 is in use:
```bash
lsof -i :8000
```

Kill the process or use a different port:
```bash
PORT=8001 python3 scripts/rag/server.py
```

### FAISS index not found

Rebuild the index:
```bash
python3 scripts/rag/embeddings.py
python3 scripts/rag/vector_store.py build
```

## Data Locations

| Data Type | Location |
|-----------|----------|
| Raw YouTube transcripts | `data/raw/youtube/transcripts/` |
| Raw blog content | `data/raw/blog/` |
| Normalized documents | `data/normalized/documents/` |
| RAG chunks | `data/rag/chunks/` |
| Embeddings | `data/rag/embeddings/` |
| FAISS index | `data/rag/indexes/` |
