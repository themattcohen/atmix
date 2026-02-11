# Quickstart Guide

## Prerequisites

```bash
# Required packages (already installed if you ran the pipeline)
pip3 install --user sentence-transformers faiss-cpu numpy
```

## Using the Knowledge Base

### Command Line

```bash
cd /Users/matt/Documents/someday

# Basic query
python3 scripts/rag/query_cli.py "What are the key steps in due diligence?"

# Filter to YouTube only
python3 scripts/rag/query_cli.py "SBA 7a loans" --source youtube

# Get more results
python3 scripts/rag/query_cli.py "valuation multiples" --top-k 10

# Interactive mode (keeps index loaded)
python3 scripts/rag/query_cli.py --interactive

# JSON output for integration
python3 scripts/rag/query_cli.py "non-compete clauses" --json
```

### Python API

```python
from scripts.rag.retrieval import RAGRetriever

# Initialize (loads index automatically)
retriever = RAGRetriever()

# Search
results = retriever.search("How do I value an accounting practice?", top_k=5)

for r in results:
    print(f"Score: {r.score:.3f}")
    print(f"Source: {r.source_type}")
    print(f"Title: {r.title}")
    print(f"Content: {r.content[:200]}...")
    print("---")

# Filter by source
youtube_results = retriever.search("SBA loans", top_k=5, source_type="youtube")
blog_results = retriever.search("due diligence", top_k=5, source_type="blog")

# Get stats
stats = retriever.get_stats()
print(f"Total chunks: {stats['total_chunks']}")
print(f"Sources: {stats['sources']}")
```

## Rebuilding the Index

If you add new content:

```bash
# 1. Re-chunk new documents
python3 scripts/transform/chunker.py

# 2. Regenerate embeddings
python3 scripts/rag/embeddings.py

# 3. Rebuild FAISS index
python3 scripts/rag/vector_store.py build
```

## Running Tests

```bash
python3 -m pytest tests/test_rag.py -v
# Expected: 18 passed
```

## Troubleshooting

### "No module named 'sentence_transformers'"
```bash
pip3 install --user sentence-transformers
```

### "No module named 'faiss'"
```bash
pip3 install --user faiss-cpu
```

### Index not found
```bash
python3 scripts/rag/vector_store.py build
```

## File Locations

| What | Where |
|------|-------|
| Query CLI | `scripts/rag/query_cli.py` |
| Python API | `scripts/rag/retrieval.py` |
| FAISS Index | `data/rag/indexes/faiss.index` |
| Embeddings | `data/rag/embeddings/embeddings.npy` |
| Chunks | `data/rag/chunks/` |
| Raw Transcripts | `data/raw/youtube/transcripts/` |
