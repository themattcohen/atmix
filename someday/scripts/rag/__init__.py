"""
RAG Pipeline Module
===================
Vector-based retrieval for Sara Sharp's knowledge base.

Components:
- embeddings: Generate vector embeddings for document chunks
- vector_store: FAISS-based similarity search
- retrieval: High-level retrieval API
- query_cli: Command-line query interface
"""

from pathlib import Path

__version__ = "1.0.0"

# Module paths
MODULE_DIR = Path(__file__).parent
PROJECT_ROOT = MODULE_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "rag"
CHUNKS_DIR = DATA_DIR / "chunks"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
INDEXES_DIR = DATA_DIR / "indexes"
