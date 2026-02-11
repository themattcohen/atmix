#!/usr/bin/env python3
"""
RAG Query CLI
=============
Command-line interface for querying Sara Sharp's knowledge base.

Usage:
    python query_cli.py "What is the best way to sell an accounting practice?"
    python query_cli.py "SBA financing" --source youtube
    python query_cli.py "deal structure" --top-k 10 --json

Author: RAG Pipeline
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from retrieval import RAGRetriever, RetrievalResult


def format_results_text(results: list[RetrievalResult], query: str) -> str:
    """Format results as readable text."""
    lines = [
        "",
        "=" * 70,
        f"QUERY: {query}",
        f"RESULTS: {len(results)} matches",
        "=" * 70,
    ]

    for i, result in enumerate(results, 1):
        lines.append("")
        lines.append(f"[{i}] SCORE: {result.score:.4f}")
        lines.append(f"    Source: {result.source_type.upper()}")
        lines.append(f"    Document: {result.document_id}")

        if result.title:
            lines.append(f"    Title: {result.title}")

        if result.url:
            lines.append(f"    URL: {result.url}")

        # Position info
        pos = result.position
        if pos:
            lines.append(
                f"    Position: chunk {pos.get('index', 0) + 1} of {pos.get('total_chunks', 1)}"
            )

        lines.append("")
        lines.append("    CONTENT:")
        lines.append("    " + "-" * 60)

        # Wrap content for readability
        content = result.content
        if len(content) > 500:
            content = content[:500] + "..."

        for line in content.split("\n"):
            wrapped = _wrap_text(line, width=66)
            for w in wrapped:
                lines.append(f"    {w}")

        lines.append("    " + "-" * 60)

    lines.append("")
    lines.append("=" * 70)

    return "\n".join(lines)


def _wrap_text(text: str, width: int = 70) -> list[str]:
    """Simple text wrapping."""
    if not text:
        return [""]

    words = text.split()
    lines = []
    current_line = []
    current_length = 0

    for word in words:
        if current_length + len(word) + 1 <= width:
            current_line.append(word)
            current_length += len(word) + 1
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
            current_length = len(word)

    if current_line:
        lines.append(" ".join(current_line))

    return lines if lines else [""]


def format_results_json(results: list[RetrievalResult], query: str) -> str:
    """Format results as JSON."""
    output = {
        "query": query,
        "total_results": len(results),
        "results": [r.to_dict() for r in results],
    }
    return json.dumps(output, indent=2, ensure_ascii=False)


def format_results_compact(results: list[RetrievalResult], query: str) -> str:
    """Format results in compact mode."""
    lines = [f"\nQuery: {query}\n"]

    for i, result in enumerate(results, 1):
        score_bar = "#" * int(result.score * 20)
        lines.append(f"{i}. [{score_bar:<20}] {result.score:.3f}")
        lines.append(f"   {result.source_type}: {result.content[:80]}...")
        lines.append("")

    return "\n".join(lines)


def run_interactive_mode(retriever: RAGRetriever) -> None:
    """Run interactive query mode."""
    print("\n" + "=" * 70)
    print("SARA SHARP KNOWLEDGE BASE - Interactive Query Mode")
    print("=" * 70)
    print("Type your question and press Enter. Type 'quit' to exit.")
    print("Commands: :youtube, :blog, :top N, :help")
    print("=" * 70 + "\n")

    source_filter: str | None = None
    top_k = 5

    while True:
        try:
            query = input("Query> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting...")
            break

        if not query:
            continue

        if query.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        if query.lower() == ":help":
            print("\nCommands:")
            print("  :youtube  - Filter to YouTube content only")
            print("  :blog     - Filter to blog content only")
            print("  :all      - Remove source filter")
            print("  :top N    - Set number of results (e.g., :top 10)")
            print("  :stats    - Show knowledge base statistics")
            print("  quit      - Exit")
            continue

        if query.lower() == ":youtube":
            source_filter = "youtube"
            print("Filter set: YouTube only")
            continue

        if query.lower() == ":blog":
            source_filter = "blog"
            print("Filter set: Blog only")
            continue

        if query.lower() == ":all":
            source_filter = None
            print("Filter removed: Searching all sources")
            continue

        if query.lower().startswith(":top"):
            try:
                n = int(query.split()[1])
                top_k = max(1, min(n, 20))
                print(f"Top-K set to: {top_k}")
            except (IndexError, ValueError):
                print("Usage: :top N (e.g., :top 10)")
            continue

        if query.lower() == ":stats":
            stats = retriever.get_stats()
            print(f"\nKnowledge Base Stats:")
            print(f"  Total chunks: {stats['total_chunks']}")
            print(f"  Embedding model: {stats['model']}")
            print(f"  Sources: {stats['source_breakdown']}")
            continue

        # Build filters
        filters = {"source_type": source_filter} if source_filter else None

        # Execute search
        results = retriever.search(query, top_k=top_k, filters=filters)

        # Display results
        if results:
            print(format_results_text(results, query))
        else:
            print("\nNo results found. Try a different query.\n")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Query Sara Sharp's Knowledge Base",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python query_cli.py "How to sell an accounting practice?"
  python query_cli.py "SBA loan requirements" --source youtube
  python query_cli.py "deal structure" --top-k 10 --json
  python query_cli.py --interactive
        """,
    )

    parser.add_argument(
        "query",
        type=str,
        nargs="?",
        help="Search query (omit for interactive mode)",
    )
    parser.add_argument(
        "--source",
        type=str,
        choices=["youtube", "blog"],
        help="Filter by source type",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of results (default: 5)",
    )
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.0,
        help="Minimum similarity score (0-1)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Compact output format",
    )
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="Interactive query mode",
    )
    parser.add_argument(
        "--index-dir",
        type=Path,
        help="Override index directory",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    # Configure logging
    import logging
    log_level = logging.DEBUG if args.verbose else logging.WARNING
    logging.basicConfig(level=log_level)

    # Initialize retriever
    try:
        retriever = RAGRetriever(index_dir=args.index_dir)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("\nMake sure the RAG pipeline has been built:")
        print("  1. python scripts/rag/embeddings.py")
        print("  2. python scripts/rag/vector_store.py build")
        return 1
    except ImportError as e:
        print(f"Error: {e}")
        return 1

    # Interactive mode
    if args.interactive or not args.query:
        run_interactive_mode(retriever)
        return 0

    # Build filters
    filters: dict[str, Any] | None = None
    if args.source:
        filters = {"source_type": args.source}

    # Execute search
    results = retriever.search(
        args.query,
        top_k=args.top_k,
        filters=filters,
        min_score=args.min_score,
    )

    # Format output
    if args.json:
        print(format_results_json(results, args.query))
    elif args.compact:
        print(format_results_compact(results, args.query))
    else:
        print(format_results_text(results, args.query))

    return 0


if __name__ == "__main__":
    sys.exit(main())
