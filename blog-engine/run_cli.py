#!/opt/blog-engine/.venv/bin/python3
"""CLI pipeline runner for blog-engine — bypasses Streamlit UI.

Usage:
    python3 run_cli.py <run_id> <step> [options]

Steps:
    nlp-input [path/to/surfer-targets.json]  Step 0: Load NLP targets from file
    research                                  Step 1: Generate research brief (API)
    write                                     Step 2: Write article (API)
    review "feedback text"                    Step 3: Rewrite article with feedback
    image [--count N]                         Hero images: Generate options (API)
    image-select N                            Hero images: Select option by number
    status                                    Show current run state
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
ENGINE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_ROOT))

from dotenv import load_dotenv
load_dotenv(ENGINE_ROOT / ".env")

from lib import db, pipeline
from lib import writer, scorer, imagen
from lib.costs import format_cost

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("cli")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_run(run_id: str) -> dict:
    """Load and validate run from DB."""
    db.init_db()
    run = db.get_run(run_id)
    if not run:
        log.error("Run not found: %s", run_id)
        sys.exit(1)
    log.info(
        "Run: keyword='%s' slug='%s' config='%s' current_step=%d",
        run["keyword"], run["slug"], run["config_name"], run["current_step"],
    )
    return run


def save_step(run_id: str, step_index: int, data: dict, status: str = "approved"):
    """Update step output_json and status in DB."""
    db.update_step(run_id, step_index, output_json=json.dumps(data), status=status)
    log.info("Step %d → %s", step_index, status)


def advance(run_id: str):
    """Advance run to next pipeline step."""
    new = pipeline.advance_step(run_id)
    log.info("Advanced to step %d (%s)", new, pipeline.get_step_info(new)["name"])


def read_frontmatter(slug: str) -> tuple[str, str]:
    """Extract title and description from article.mdx frontmatter."""
    article_path = pipeline.get_output_dir(slug) / "article.mdx"
    if not article_path.exists():
        return ("", "")
    content = article_path.read_text(encoding="utf-8")
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        return ("", "")
    title, desc = "", ""
    for line in fm_match.group(1).splitlines():
        if line.startswith("title:"):
            title = line.split(":", 1)[1].strip().strip("\"'")
        elif line.startswith("description:"):
            desc = line.split(":", 1)[1].strip().strip("\"'")
    return (title, desc)


# ---------------------------------------------------------------------------
# Step 0: NLP Input (manual file)
# ---------------------------------------------------------------------------

def step_nlp_input(run_id: str, run: dict, targets_path: str | None):
    """Step 0: Load Surfer NLP targets from a manually placed JSON file."""
    log.info("=== Step 0: NLP Input ===")

    output_dir = pipeline.get_output_dir(run["slug"])
    output_dir.mkdir(parents=True, exist_ok=True)

    if targets_path:
        src = Path(targets_path)
    else:
        # Default: look for the file in the output dir already
        src = output_dir / "surfer-targets.json"

    if not src.exists():
        log.error("surfer-targets.json not found at: %s", src)
        log.error("Export the file from Surfer Content Editor and pass the path as an argument.")
        sys.exit(1)

    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log.error("Invalid JSON in %s: %s", src, exc)
        sys.exit(1)

    if "terms" not in data:
        log.error("JSON missing 'terms' key — expected Surfer NLP export format")
        sys.exit(1)

    # Copy to output dir if it came from elsewhere
    dest = output_dir / "surfer-targets.json"
    if src.resolve() != dest.resolve():
        dest.write_text(json.dumps(data, indent=2), encoding="utf-8")
        log.info("Copied %s → %s", src, dest)
    else:
        log.info("Using existing: %s", dest)

    term_count = len(data.get("terms", []))
    log.info("Loaded %d NLP terms", term_count)

    step_data = {
        "targets_file": str(dest),
        "term_count": term_count,
        "source": str(src),
    }
    save_step(run_id, 0, step_data)
    advance(run_id)


# ---------------------------------------------------------------------------
# Step 1: Research Brief (API)
# ---------------------------------------------------------------------------

def step_research(run_id: str, run: dict):
    """Step 1: Generate a research brief via Claude."""
    log.info("=== Step 1: Research Brief ===")

    config = pipeline.load_config(run["config_name"])
    secondary_kws = json.loads(run.get("secondary_keywords", "[]"))

    log.info("Keyword: '%s'", run["keyword"])
    if secondary_kws:
        log.info("Secondary: %s", secondary_kws)

    brief, call_info = writer.generate_research_brief(run["keyword"], config, secondary_kws)
    log.info("Cost: %s", format_cost(call_info))

    output_dir = pipeline.get_output_dir(run["slug"])
    brief_path = output_dir / "research-brief.md"
    brief_path.write_text(brief, encoding="utf-8")
    log.info("Saved: %s (%d words)", brief_path, len(brief.split()))

    step_data = {"brief": brief, "brief_file": str(brief_path)}
    save_step(run_id, 1, step_data)
    advance(run_id)


# ---------------------------------------------------------------------------
# Step 2: Write Article (API)
# ---------------------------------------------------------------------------

def step_write(run_id: str, run: dict):
    """Step 2: Write a full SEO article via Claude."""
    log.info("=== Step 2: Write Article ===")

    config = pipeline.load_config(run["config_name"])
    output_dir = pipeline.get_output_dir(run["slug"])
    secondary_kws = json.loads(run.get("secondary_keywords", "[]"))

    # Load inputs from previous steps
    brief_path = output_dir / "research-brief.md"
    if not brief_path.exists():
        log.error("research-brief.md not found — run research step first")
        sys.exit(1)
    brief = brief_path.read_text(encoding="utf-8")

    targets_path = output_dir / "surfer-targets.json"
    nlp_targets = {}
    if targets_path.exists():
        nlp_targets = json.loads(targets_path.read_text(encoding="utf-8"))
    else:
        log.warning("surfer-targets.json not found — writing without NLP targets")

    log.info("Writing article for '%s'...", run["keyword"])
    article, call_info = writer.write_article(
        run["keyword"], config, brief, nlp_targets, "",
        secondary_keywords=secondary_kws,
    )
    log.info("Cost: %s", format_cost(call_info))

    article_path = output_dir / "article.mdx"
    article_path.write_text(article, encoding="utf-8")
    log.info("Saved: %s (%d words)", article_path, len(article.split()))

    # Local validation (optional — needs Node.js)
    validation = scorer.run_local_validation(run["slug"])
    if validation.get("error"):
        log.warning("Validation: %s", validation["error"])
    elif validation.get("passed"):
        log.info("Validation: PASSED (%d checks)", len(validation.get("checks", {})))
    else:
        log.warning("Validation: FAILED — %s", validation.get("failed", []))

    step_data = {
        "article": article,
        "article_file": str(article_path),
        "validation": validation,
    }
    save_step(run_id, 2, step_data)
    advance(run_id)


# ---------------------------------------------------------------------------
# Step 3: Review & Iterate (API)
# ---------------------------------------------------------------------------

def step_review(run_id: str, run: dict, feedback: str):
    """Step 3: Rewrite article incorporating feedback via Claude."""
    log.info("=== Step 3: Review & Iterate ===")

    config = pipeline.load_config(run["config_name"])
    output_dir = pipeline.get_output_dir(run["slug"])

    article_path = output_dir / "article.mdx"
    if not article_path.exists():
        log.error("article.mdx not found — run write step first")
        sys.exit(1)
    article = article_path.read_text(encoding="utf-8")

    targets_path = output_dir / "surfer-targets.json"
    nlp_targets = {}
    if targets_path.exists():
        nlp_targets = json.loads(targets_path.read_text(encoding="utf-8"))

    log.info("Feedback: %s", feedback[:120] + ("..." if len(feedback) > 120 else ""))
    log.info("Rewriting article...")

    revised, call_info = writer.rewrite_with_feedback(article, feedback, nlp_targets, config, keyword=run["keyword"])
    log.info("Cost: %s", format_cost(call_info))

    article_path.write_text(revised, encoding="utf-8")
    word_count = len(revised.split())
    log.info("Revised article saved: %d words", word_count)

    # Update step 3 output — do not auto-advance (user may iterate)
    existing_step = db.get_step(run_id, 3)
    iterations = 1
    if existing_step and existing_step.get("output_json"):
        prev = json.loads(existing_step["output_json"])
        iterations = prev.get("iterations", 0) + 1

    step_data = {
        "article_file": str(article_path),
        "word_count": word_count,
        "iterations": iterations,
        "last_feedback": feedback,
    }
    save_step(run_id, 3, step_data, status="review")
    log.info("Iteration %d saved (status=review). Run again with new feedback or mark approved manually.", iterations)


# ---------------------------------------------------------------------------
# Hero Images (API) — optional, within review step
# ---------------------------------------------------------------------------

async def step_image(run_id: str, run: dict, count: int = 3):
    """Generate hero image options via Imagen."""
    log.info("=== Hero Images (count=%d) ===", count)

    config = pipeline.load_config(run["config_name"])
    hero_config = config.get("heroImage", {})
    output_dir = pipeline.get_output_dir(run["slug"])

    title, desc = read_frontmatter(run["slug"])
    log.info("Title: %s", title or run["keyword"])
    log.info("Description: %s", desc or run["keyword"])

    paths, call_info = await imagen.generate_hero_images(
        title or run["keyword"],
        desc or run["keyword"],
        hero_config,
        str(output_dir),
        count=count,
    )
    log.info("Cost: %s", format_cost(call_info))

    log.info("Generated %d image(s):", len(paths))
    for i, p in enumerate(paths, 1):
        log.info("  Option %d: %s", i, p)

    step_data = {"image_options": paths, "selected": None}
    save_step(run_id, 3, step_data, status="review")
    log.info("Images saved — use 'image-select N' to pick one")


def step_image_select(run_id: str, run: dict, selection: int):
    """Finalize hero image selection."""
    log.info("=== Select Image #%d ===", selection)

    output_dir = pipeline.get_output_dir(run["slug"])

    step = db.get_step(run_id, 3)
    step_data = {}
    if step and step.get("output_json"):
        step_data = json.loads(step["output_json"])

    options = step_data.get("image_options", [])
    if not options:
        log.error("No image options found — run 'image' step first")
        sys.exit(1)
    if selection < 1 or selection > len(options):
        log.error("Selection %d out of range (1-%d)", selection, len(options))
        sys.exit(1)

    selected_path = options[selection - 1]
    final_path = imagen.select_hero_image(selected_path, str(output_dir))
    log.info("Selected: %s → %s", selected_path, final_path)

    step_data["selected_final"] = final_path
    save_step(run_id, 3, step_data)
    advance(run_id)


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

def show_status(run_id: str):
    """Print current state of all steps."""
    db.init_db()
    run = db.get_run(run_id)
    if not run:
        log.error("Run not found: %s", run_id)
        sys.exit(1)

    print(f"\nRun: {run_id}")
    print(f"  Keyword:  {run['keyword']}")
    print(f"  Slug:     {run['slug']}")
    print(f"  Config:   {run['config_name']}")
    print(f"  Status:   {run['status']}")
    print(f"  Step:     {run['current_step']}")
    print()

    step_names = {0: "nlp-input", 1: "research", 2: "write", 3: "review"}
    steps = db.get_steps(run_id)
    for s in steps:
        marker = "→" if s["step_index"] == run["current_step"] else " "
        name = step_names.get(s["step_index"], s["step_name"])
        print(f"  {marker} [{s['step_index']}] {name:12s}  {s['status']:10s}", end="")
        if s.get("error"):
            print(f"  ERROR: {s['error'][:60]}", end="")
        print()

    # Show output files
    output_dir = pipeline.get_output_dir(run["slug"])
    if output_dir.exists():
        files = sorted(output_dir.iterdir())
        if files:
            print(f"\n  Output ({output_dir}):")
            for f in files:
                if f.is_file():
                    size = f.stat().st_size
                    print(f"    {f.name:40s}  {size:>8,d} bytes")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Blog Engine CLI Pipeline Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("run_id", help="Pipeline run ID (hex)")
    parser.add_argument(
        "step",
        choices=["nlp-input", "research", "write", "review", "image", "image-select", "status"],
        help="Pipeline step to execute",
    )
    parser.add_argument(
        "extra",
        nargs="?",
        help=(
            "nlp-input: path to surfer-targets.json  |  "
            "review: feedback text  |  "
            "image-select: option number (int)"
        ),
    )
    parser.add_argument("--count", type=int, default=3, help="Number of images to generate (default: 3)")

    args = parser.parse_args()

    if args.step == "status":
        show_status(args.run_id)
        return

    run = load_run(args.run_id)

    if args.step == "nlp-input":
        step_nlp_input(args.run_id, run, args.extra)
    elif args.step == "research":
        step_research(args.run_id, run)
    elif args.step == "write":
        step_write(args.run_id, run)
    elif args.step == "review":
        if not args.extra:
            parser.error("review requires feedback text: run_cli.py <id> review \"feedback here\"")
        step_review(args.run_id, run, args.extra)
    elif args.step == "image":
        asyncio.run(step_image(args.run_id, run, count=args.count))
    elif args.step == "image-select":
        if args.extra is None:
            parser.error("image-select requires a selection number: run_cli.py <id> image-select N")
        try:
            selection = int(args.extra)
        except ValueError:
            parser.error(f"image-select requires an integer, got: {args.extra!r}")
        step_image_select(args.run_id, run, selection)


if __name__ == "__main__":
    main()
