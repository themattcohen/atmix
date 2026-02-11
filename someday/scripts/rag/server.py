#!/usr/bin/env python3
"""
RAG API Server
==============
Production-ready FastAPI server for Sara Sharp's RAG Knowledge Base.

Endpoints:
    GET  /api/health  - Health check with detailed index status
    POST /api/search  - Search the knowledge base with filters
    GET  /api/stats   - Index statistics and source breakdown
    GET  /            - Serve frontend (static files)

Usage:
    python scripts/rag/server.py
    python scripts/rag/server.py --port 8080
    python scripts/rag/server.py --reload

API Examples:
    curl http://localhost:8000/api/health
    curl http://localhost:8000/api/stats
    curl -X POST http://localhost:8000/api/search \
         -H "Content-Type: application/json" \
         -d '{"query": "SBA loans", "top_k": 5, "source": "all"}'

Author: RAG Pipeline
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request

# Load environment variables
load_dotenv()

# Anthropic client (lazy init)
_anthropic_client = None

def get_anthropic_client():
    """Get or create Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in environment")
        from anthropic import Anthropic
        _anthropic_client = Anthropic(api_key=api_key)
    return _anthropic_client
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from retrieval import RAGRetriever

# =============================================================================
# CONFIGURATION
# =============================================================================

API_VERSION = "1.0.0"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = int(os.environ.get("PORT", 8000))  # Railway sets PORT dynamically
MAX_TOP_K = 100
MAX_QUERY_LENGTH = 1000
MAX_ASK_LENGTH = 2000

# Sara's system prompt for Claude
SARA_SYSTEM_PROMPT = """You are Sara Sharp, a small business M&A attorney and advisor who helps buyers and sellers navigate buying and selling small businesses.

**Your expertise:**
- Letter of Intent (LOI) negotiation and the S.T.R.U.C.T.U.R.E.D. framework
- SBA loan requirements and financing
- Due diligence processes
- Business valuation methods
- Deal structuring and earnouts
- Working with brokers and intermediaries
- Common deal killers and how to avoid them

**How you communicate:**

You're casual and approachable, like a sharp friend who happens to know M&A cold. Skip the formality. Use contractions, real-world analogies, and occasional dry humor. Your expertise shows in the *substance* of your answers, not fancy language. Think "seasoned advisor grabbing coffee with a client" not "attorney drafting a memo."

**Working with retrieved context:**

- Base answers on the provided context. If context directly answers the question, use it.
- When context is related but doesn't fully answer, say what you *can* answer and be clear about the gap: "The docs cover X, but for Y you'd want to dig deeper into..."
- If retrieved chunks conflict, acknowledge it: "There's some nuance here..." and explain the different perspectives.
- Paraphrase rather than quote walls of text. Keep it conversational.
- Don't say "Source 1" or "According to Source 3" - weave info naturally or say "one of the resources covers this..." if you need to reference something.
- If context doesn't help at all, say so honestly rather than improvising.

**Response length:**

Match depth to complexity:
- Quick clarifications: A sentence or two is fine
- Process or concept explanations: 2-4 paragraphs
- Complex scenarios or multi-part questions: Use headers to organize, go longer if needed

**Important boundaries:**

You provide general educational information, not legal advice. You can explain how things typically work, flag risks, and help people ask better questions, but you're not their attorney. For specific situations, always recommend they consult a licensed M&A attorney or CPA. Never draft binding contract language.

**Staying in your lane:**

If someone asks about areas outside small business M&A (residential real estate, divorce, employment law disputes, etc.), acknowledge it's not your wheelhouse and suggest they find a specialist in that area. Don't guess.

**Remember:**

You're helping real people make some of the biggest financial decisions of their lives. Be helpful, accurate, and human. When you're not sure, say so."""

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Track startup time for uptime calculation
_startup_time: float = time.time()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================


class SearchRequest(BaseModel):
    """Search request body."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=MAX_QUERY_LENGTH,
        description="Search query text",
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=MAX_TOP_K,
        description="Number of results to return",
    )
    source: Literal["all", "youtube", "blog"] = Field(
        default="all",
        description="Filter by source type",
    )


class ChunkPosition(BaseModel):
    """Position information for a chunk within its document."""

    index: int
    total_chunks: int


class SearchResultItem(BaseModel):
    """A single search result with full metadata."""

    chunk_id: str
    document_id: str
    score: float
    title: str
    content: str
    source_type: str
    url: str
    position: Optional[ChunkPosition] = None


class SearchResponse(BaseModel):
    """Search response body."""

    results: list[SearchResultItem]
    query: str
    query_time_ms: float
    total_results: int


class HealthResponse(BaseModel):
    """Health check response with detailed status."""

    status: Literal["healthy", "unhealthy"]
    version: str
    uptime_seconds: int
    index_loaded: bool
    total_chunks: Optional[int] = None
    model: Optional[str] = None
    dimension: Optional[int] = None


class StatsResponse(BaseModel):
    """Statistics response with source breakdown."""

    total_chunks: int
    total_documents: int
    dimension: int
    model: str
    sources: dict[str, int]


class ErrorResponse(BaseModel):
    """Error response format."""

    error: str
    message: str
    details: Optional[str] = None


class ConversationMessage(BaseModel):
    """A message in the conversation history."""
    role: Literal["user", "assistant"]
    content: str


# Available Claude models
CLAUDE_MODELS = {
    "haiku": "claude-3-5-haiku-20241022",
    "sonnet": "claude-sonnet-4-20250514",
    "opus": "claude-opus-4-5-20251101",
}


class AskRequest(BaseModel):
    """Ask Sara request body."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=MAX_ASK_LENGTH,
        description="Question to ask Sara",
    )
    history: list[ConversationMessage] = Field(
        default=[],
        description="Previous conversation messages for multi-turn context",
    )
    model: Literal["haiku", "sonnet", "opus"] = Field(
        default="sonnet",
        description="Claude model to use: haiku (fast), sonnet (balanced), opus (smartest)",
    )


class SourceCitation(BaseModel):
    """A source citation for an answer."""

    title: str
    source_type: str
    url: str
    relevance_score: float
    excerpt: str


class AskResponse(BaseModel):
    """Ask Sara response body."""

    answer: str
    sources: list[SourceCitation]
    query_time_ms: float
    model: str
    chunks_used: int


# =============================================================================
# APPLICATION
# =============================================================================

app = FastAPI(
    title="Sara Sharp Knowledge Base API",
    description="""
    Semantic search API for Sara Sharp's M&A content library.

    ## Features

    - **Semantic Search**: Natural language queries using sentence embeddings
    - **Source Filtering**: Filter results by YouTube or blog content
    - **Fast Retrieval**: Sub-100ms query times using FAISS indexing

    ## Endpoints

    - `GET /api/health` - System health and readiness check
    - `POST /api/search` - Execute semantic search query
    - `GET /api/stats` - Knowledge base statistics
    """,
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global retriever instance
retriever: Optional[RAGRetriever] = None


# =============================================================================
# STARTUP / SHUTDOWN
# =============================================================================


@app.on_event("startup")
async def startup_event():
    """Load the RAG retriever on startup."""
    global retriever
    try:
        logger.info("Loading RAG retriever...")
        retriever = RAGRetriever()
        stats = retriever.get_stats()
        logger.info(
            f"RAG retriever loaded: {stats['total_chunks']} chunks, "
            f"model={stats['model']}"
        )
    except Exception as e:
        logger.error(f"Failed to load RAG retriever: {e}")
        retriever = None


# =============================================================================
# API ENDPOINTS
# =============================================================================


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """
    Health check endpoint.

    Returns the current system status including:
    - Index loading status
    - Total indexed chunks
    - Embedding model information
    - System uptime
    """
    uptime = int(time.time() - _startup_time)

    if retriever is None:
        return HealthResponse(
            status="unhealthy",
            version=API_VERSION,
            uptime_seconds=uptime,
            index_loaded=False,
        )

    stats = retriever.get_stats()
    return HealthResponse(
        status="healthy",
        version=API_VERSION,
        uptime_seconds=uptime,
        index_loaded=True,
        total_chunks=stats["total_chunks"],
        model=stats["model"],
        dimension=stats["dimension"],
    )


@app.get("/health", tags=["System"])
async def simple_health():
    """Simple health check for Railway."""
    return {"status": "ok"}


@app.post("/api/search", response_model=SearchResponse, tags=["Search"])
async def search(request: SearchRequest):
    """
    Search the knowledge base using semantic similarity.

    The search uses sentence embeddings to find the most relevant content
    chunks based on meaning, not just keyword matching.

    **Request Body:**
    - `query`: Natural language search query (required)
    - `top_k`: Number of results to return (1-100, default: 5)
    - `source`: Filter by source type ("all", "youtube", "blog")

    **Response:**
    - `results`: List of matching content chunks with scores
    - `query_time_ms`: Search execution time in milliseconds
    - `total_results`: Number of results returned
    """
    if retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge base not loaded. Please try again later.",
        )

    # Build filters
    filters = None
    if request.source != "all":
        filters = {"source_type": request.source}

    # Execute search with timing
    start_time = time.perf_counter()
    try:
        results = retriever.search(
            query=request.query,
            top_k=request.top_k,
            filters=filters,
        )
    except Exception as e:
        logger.error(f"Search error for query '{request.query}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}",
        )
    query_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Convert results with full metadata
    result_items = []
    for r in results:
        position = None
        if r.position:
            position = ChunkPosition(
                index=r.position.get("index", 0),
                total_chunks=r.position.get("total_chunks", 1),
            )

        result_items.append(
            SearchResultItem(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                score=round(r.score, 4),
                title=r.title or "",
                content=r.content,
                source_type=r.source_type,
                url=r.url or "",
                position=position,
            )
        )

    logger.info(
        f"Search: '{request.query[:50]}...' -> {len(result_items)} results in {query_time_ms}ms"
    )

    return SearchResponse(
        results=result_items,
        query=request.query,
        query_time_ms=query_time_ms,
        total_results=len(result_items),
    )


@app.get("/api/stats", response_model=StatsResponse, tags=["System"])
async def get_stats():
    """
    Get knowledge base statistics.

    Returns detailed information about the indexed content including:
    - Total number of indexed chunks
    - Number of unique documents
    - Embedding model and dimension
    - Breakdown by source type (YouTube, blog, etc.)
    """
    if retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge base not loaded.",
        )

    stats = retriever.get_stats()

    # Calculate unique document count
    document_ids = set()
    for meta in retriever.metadata:
        doc_id = meta.get("document_id", "")
        if doc_id:
            document_ids.add(doc_id)

    return StatsResponse(
        total_chunks=stats["total_chunks"],
        total_documents=len(document_ids),
        dimension=stats["dimension"],
        model=stats["model"],
        sources=stats["source_breakdown"],
    )


@app.post("/api/ask", response_model=AskResponse, tags=["Chat"])
async def ask_sara(request: AskRequest):
    """
    Ask Sara a question and get a synthesized answer.

    Uses RAG to retrieve relevant content chunks, then sends them to Claude
    along with the question to generate a coherent, sourced answer.

    **Request Body:**
    - `question`: Natural language question (required, max 2000 chars)

    **Response:**
    - `answer`: Sara's synthesized answer
    - `sources`: List of source citations used
    - `query_time_ms`: Total processing time
    - `model`: Claude model used
    - `chunks_used`: Number of context chunks used
    """
    if retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge base not loaded. Please try again later.",
        )

    start_time = time.perf_counter()

    # Step 1: Retrieve relevant chunks
    try:
        results = retriever.search(
            query=request.question,
            top_k=8,  # Get top 8 chunks for good coverage
        )
    except Exception as e:
        logger.error(f"RAG search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    if not results:
        # No relevant content found
        return AskResponse(
            answer="I don't have specific information about that in my knowledge base. Could you try rephrasing your question, or ask about a different topic related to buying or selling small businesses?",
            sources=[],
            query_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            model="none",
            chunks_used=0,
        )

    # Step 2: Build context from chunks (with source metadata)
    context_parts = []
    sources = []
    for r in results:
        # Format: [SourceType - "Title"]: content
        source_type = r.source_type.capitalize() if r.source_type else "Document"
        title = r.title or "Untitled"
        context_parts.append(f'[{source_type} - "{title}"]: {r.content}')
        sources.append(SourceCitation(
            title=title,
            source_type=r.source_type,
            url=r.url or "",
            relevance_score=round(r.score, 3),
            excerpt=r.content[:200] + "..." if len(r.content) > 200 else r.content,
        ))

    context = "\n\n".join(context_parts)

    # Step 3: Call Claude API
    try:
        client = get_anthropic_client()

        # Build messages with conversation history
        messages = []

        # Add previous conversation history (limit to last 10 turns to manage context)
        for msg in request.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

        # Add current question with RAG context
        user_message = f"""QUESTION: {request.question}

CONTEXT:
{context}"""
        messages.append({"role": "user", "content": user_message})

        # Use selected model
        model_id = CLAUDE_MODELS.get(request.model, CLAUDE_MODELS["sonnet"])

        response = client.messages.create(
            model=model_id,
            max_tokens=1024,
            system=SARA_SYSTEM_PROMPT,
            messages=messages,
        )

        answer = response.content[0].text
        model_used = response.model

    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )

    query_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(
        f"Ask: '{request.question[:50]}...' -> {len(answer)} chars, "
        f"{len(results)} chunks, {query_time_ms}ms"
    )

    return AskResponse(
        answer=answer,
        sources=sources,
        query_time_ms=query_time_ms,
        model=model_used,
        chunks_used=len(results),
    )


# =============================================================================
# STATIC FILES (Frontend)
# =============================================================================


def setup_static_files():
    """Mount static files if frontend directory exists."""
    frontend_dir = Path(__file__).parent.parent.parent / "frontend"
    if frontend_dir.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
        logger.info(f"Serving frontend from: {frontend_dir}")
    else:
        logger.warning(f"Frontend directory not found: {frontend_dir}")


# Only mount static files if not in test mode
setup_static_files()


# =============================================================================
# ERROR HANDLERS
# =============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# =============================================================================
# REQUEST LOGGING MIDDLEWARE
# =============================================================================


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with timing."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = (time.perf_counter() - start_time) * 1000

    # Log API requests (skip static files)
    if request.url.path.startswith("/api"):
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({process_time:.1f}ms)"
        )

    return response


# =============================================================================
# MAIN
# =============================================================================


def main():
    """Run the server with CLI argument parsing."""
    import uvicorn

    parser = argparse.ArgumentParser(
        description="Sara Sharp Knowledge Base API Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python server.py                    # Start on 0.0.0.0:8000
    python server.py --port 8080        # Custom port
    python server.py --host 127.0.0.1   # Localhost only
    python server.py --reload           # Auto-reload for development

API Documentation:
    http://localhost:8000/docs          # Swagger UI
    http://localhost:8000/redoc         # ReDoc
        """,
    )

    parser.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help=f"Host to bind to (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to bind to (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )

    args = parser.parse_args()

    # Display startup banner
    print()
    print("=" * 60)
    print("  SARA SHARP KNOWLEDGE BASE API")
    print("=" * 60)
    print(f"  Version:  {API_VERSION}")
    print(f"  Host:     {args.host}")
    print(f"  Port:     {args.port}")
    print(f"  Workers:  {args.workers}")
    print(f"  Reload:   {args.reload}")
    print("=" * 60)
    print()
    print("  Endpoints:")
    print(f"    GET  http://{args.host}:{args.port}/api/health")
    print(f"    POST http://{args.host}:{args.port}/api/search")
    print(f"    GET  http://{args.host}:{args.port}/api/stats")
    print()
    print("  Documentation:")
    print(f"    http://localhost:{args.port}/docs")
    print()
    print("=" * 60)
    print()

    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        log_level="info",
    )


if __name__ == "__main__":
    main()
