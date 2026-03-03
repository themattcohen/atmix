"""Pipeline state machine and step orchestration for blog-engine."""

import json
import re
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent.parent

STEPS = [
    {"index": 0, "name": "keyword", "label": "Keyword Research", "icon": "🔍"},
    {"index": 1, "name": "nlp", "label": "Surfer NLP Targets", "icon": "🎯"},
    {"index": 2, "name": "research", "label": "Research Brief", "icon": "📚"},
    {"index": 3, "name": "write", "label": "Write Article", "icon": "✍️"},
    {"index": 4, "name": "score", "label": "Surfer Score", "icon": "📊"},
    {"index": 5, "name": "image", "label": "Hero Image", "icon": "🖼️"},
    {"index": 6, "name": "done", "label": "Complete", "icon": "✅"},
]


def slugify(keyword: str) -> str:
    """Convert keyword to URL slug."""
    slug = keyword.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def get_output_dir(slug: str) -> Path:
    """Return output/<slug>/ path, creating if needed."""
    out = ENGINE_ROOT / "output" / slug
    out.mkdir(parents=True, exist_ok=True)
    return out


def load_config(config_name: str) -> dict:
    """Load a niche config JSON file."""
    path = ENGINE_ROOT / "configs" / config_name
    if not path.suffix:
        path = path.with_suffix(".json")
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def list_configs() -> list[dict]:
    """List available configs with filename and display name.

    Returns list of ``{"filename": "tax-general.json", "name": "Tax General"}``.
    """
    configs_dir = ENGINE_ROOT / "configs"
    if not configs_dir.exists():
        return []
    results = []
    for f in sorted(configs_dir.glob("*.json")):
        if f.name.startswith("_") or f.name.startswith("."):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            name = data.get("name", f.stem)
        except (json.JSONDecodeError, OSError):
            name = f.stem
        results.append({"filename": f.name, "name": name})
    return results


def get_step_info(step_index: int) -> dict:
    """Return step dict from STEPS by index."""
    if 0 <= step_index < len(STEPS):
        return STEPS[step_index]
    return {"index": step_index, "name": "unknown", "label": "Unknown", "icon": "❓"}


def can_advance(run: dict, steps: list[dict]) -> bool:
    """Check if current step is approved and can move to next."""
    current = run.get("current_step", 0)
    if current >= len(STEPS) - 1:
        return False
    for s in steps:
        if s["step_index"] == current:
            return s.get("status") == "approved"
    return False


def advance_step(run_id: str) -> int:
    """Advance current_step by 1 in DB. Returns new step index."""
    from lib import db

    run = db.get_run(run_id)
    if run is None:
        raise ValueError(f"Run not found: {run_id}")
    new_step = run["current_step"] + 1
    db.update_run(run_id, current_step=new_step)
    if new_step == len(STEPS) - 1:
        db.update_run(run_id, status="completed")
    return new_step
