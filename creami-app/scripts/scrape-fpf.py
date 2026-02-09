"""
scrape-fpf.py

Scrapes FitnessProductFinder (@fitnessproductfinder) YouTube Shorts
for Ninja Creami recipes and outputs them in the unified recipe format.

Merges FPF recipes into the existing recipes.json alongside jhermann recipes.

Usage:
    python scripts/scrape-fpf.py

Requires: yt-dlp
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
RECIPES_JSON = APP_DIR / "src" / "data" / "recipes.json"
FPF_CACHE = SCRIPT_DIR / "fpf-cache.json"

# ---------------------------------------------------------------------------
# YouTube channel
# ---------------------------------------------------------------------------
CHANNEL_SHORTS = "https://www.youtube.com/@fitnessproductfinder/shorts"

# Patterns that indicate a recipe short (vs lifestyle/review content)
RECIPE_TITLE_PATTERNS = [
    r"protein ice cream",
    r"protein frozen yogurt",
    r"protein froyo",
    r"protein gelato",
    r"protein sorbet",
    r"blizzard",
    r"mcflurry",
    r"sundae",
]
RECIPE_TITLE_RE = re.compile("|".join(RECIPE_TITLE_PATTERNS), re.IGNORECASE)

# Titles to exclude (non-recipe content)
EXCLUDE_PATTERNS = [
    r"quick start guide",
    r"essentials",
    r"clean your",
    r"just bought",
    r"best way to prep",
    r"start with these",
    r"24 hours",
    r"week of creami",
    r"recipes in my bio",
    r"recipe book linked",
    r"all \d+ of my recipes",
]
EXCLUDE_RE = re.compile("|".join(EXCLUDE_PATTERNS), re.IGNORECASE)

# ---------------------------------------------------------------------------
# Step 1: List all shorts
# ---------------------------------------------------------------------------

def list_shorts() -> list[dict[str, str]]:
    """Get all shorts from FPF channel with titles."""
    print("Fetching FPF shorts list...")
    result = subprocess.run(
        [
            "yt-dlp", "--flat-playlist",
            "--print", "%(id)s||%(title)s",
            CHANNEL_SHORTS,
        ],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        print(f"Warning: yt-dlp returned {result.returncode}", file=sys.stderr)

    shorts = []
    for line in result.stdout.strip().split("\n"):
        if "||" not in line:
            continue
        vid_id, title = line.split("||", 1)
        shorts.append({"id": vid_id.strip(), "title": title.strip()})

    print(f"Found {len(shorts)} total shorts")
    return shorts


def filter_recipe_shorts(shorts: list[dict[str, str]]) -> list[dict[str, str]]:
    """Filter to only recipe-related shorts, deduplicating by title."""
    seen_titles: set[str] = set()
    recipes = []

    for s in shorts:
        title = s["title"].strip()
        # Skip non-recipe content
        if EXCLUDE_RE.search(title):
            continue
        # Must match recipe pattern
        if not RECIPE_TITLE_RE.search(title):
            continue
        # Deduplicate by normalized title (FPF posts each recipe twice)
        norm_title = re.sub(r"\s+", " ", title.lower().strip())
        if norm_title in seen_titles:
            continue
        seen_titles.add(norm_title)
        recipes.append(s)

    print(f"Filtered to {len(recipes)} unique recipe shorts")
    return recipes


# ---------------------------------------------------------------------------
# Step 2: Fetch full descriptions
# ---------------------------------------------------------------------------

def fetch_descriptions(shorts: list[dict[str, str]]) -> list[dict[str, str]]:
    """Fetch full descriptions for each short. Uses cache to avoid re-fetching."""
    cache: dict[str, str] = {}
    if FPF_CACHE.exists():
        cache = json.loads(FPF_CACHE.read_text(encoding="utf-8"))
        print(f"Loaded {len(cache)} cached descriptions")

    to_fetch = [s for s in shorts if s["id"] not in cache]
    if to_fetch:
        print(f"Fetching {len(to_fetch)} new descriptions...")
        # Batch fetch in groups of 10
        for i in range(0, len(to_fetch), 10):
            batch = to_fetch[i:i+10]
            urls = [f"https://www.youtube.com/shorts/{s['id']}" for s in batch]
            result = subprocess.run(
                ["yt-dlp", "--print", "%(id)s\\n%(description)s\\n---ENDVID---"] + urls,
                capture_output=True, text=True, timeout=120,
            )
            # Parse output
            for block in result.stdout.split("---ENDVID---"):
                block = block.strip()
                if not block:
                    continue
                lines = block.split("\\n", 1)
                if len(lines) >= 2:
                    vid_id = lines[0].strip()
                    desc = lines[1].strip()
                    cache[vid_id] = desc
                elif len(lines) == 1:
                    # Try parsing differently - yt-dlp may use actual newlines
                    pass

            print(f"  Fetched {min(i+10, len(to_fetch))}/{len(to_fetch)}")

        # Save cache
        FPF_CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

    # Attach descriptions to shorts
    for s in shorts:
        s["description"] = cache.get(s["id"], "")

    return shorts


# ---------------------------------------------------------------------------
# Step 3: Parse recipe from description
# ---------------------------------------------------------------------------

def slugify(name: str) -> str:
    """Generate a URL-safe slug."""
    s = name.lower()
    s = re.sub(r"[''']", "", s)
    s = re.sub(r'\([^)]*\)', '', s)
    s = s.replace('+', '-').replace('&', '-and-')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    s = re.sub(r'-{2,}', '-', s)
    return s


def parse_nutrition_from_desc(desc: str) -> dict[str, float]:
    """Extract calories, carbs, fat, protein from description."""
    result = {"kcal": 0, "fat": 0, "carbs": 0, "sugar": 0, "protein": 0, "salt": 0}

    # Pattern: "219 calories 22g protein"
    cal_match = re.search(r'(\d+)\s*(?:calories|cal)\b', desc, re.IGNORECASE)
    if cal_match:
        result["kcal"] = float(cal_match.group(1))

    prot_match = re.search(r'(\d+)g?\s*(?:protein|P)\b', desc)
    if prot_match:
        result["protein"] = float(prot_match.group(1))

    # Pattern: "265 cal 37g C, 4g F, 21g P"
    macro_match = re.search(r'(\d+)g?\s*C[,\s]+(\d+)g?\s*F[,\s]+(\d+)g?\s*P', desc)
    if macro_match:
        result["carbs"] = float(macro_match.group(1))
        result["fat"] = float(macro_match.group(2))
        result["protein"] = float(macro_match.group(3))

    return result


def parse_ingredients_from_desc(desc: str) -> list[dict[str, Any]]:
    """Extract ingredient lists from description."""
    ingredients: list[dict[str, Any]] = []
    base_items: list[dict[str, str]] = []
    mixin_items: list[dict[str, str]] = []

    in_mixins = False
    lines = desc.split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Detect mix-in section
        if re.match(r'^mix[- ]?ins?(?:/toppings?)?:', line, re.IGNORECASE):
            in_mixins = True
            continue
        if re.match(r'^toppings?:', line, re.IGNORECASE):
            in_mixins = True
            continue

        # Detect instructions start
        if re.match(r'^instructions?:', line, re.IGNORECASE):
            break
        if re.match(r'^\d+\.\s', line):
            break

        # Parse ingredient lines starting with -
        if line.startswith("- "):
            item_text = line[2:].strip()
            parsed = parse_single_ingredient(item_text)
            if parsed:
                if in_mixins:
                    mixin_items.append(parsed)
                else:
                    base_items.append(parsed)

    if base_items:
        ingredients.append({"step": "Base", "items": base_items})
    if mixin_items:
        ingredients.append({"step": "Mix-ins", "items": mixin_items})

    return ingredients


def parse_single_ingredient(text: str) -> dict[str, str] | None:
    """Parse a single ingredient like '350g Fat Free High Protein Milk'."""
    if not text:
        return None

    # Remove parenthetical alternatives like "(can sub for ...)"
    comment = ""
    paren_match = re.search(r'\(([^)]+)\)', text)
    if paren_match:
        comment = paren_match.group(1)
        text = text[:paren_match.start()].strip()

    # Try to extract amount and unit
    # Pattern: "350g", "45g", "10g (2 tbsp)", "1g (½ tsp)", "A pinch of"
    amount = ""
    unit = ""
    name = text

    # Numeric amount with unit
    m = re.match(r'^([\d.~½¼¾⅓⅔]+(?:\s*[-–]\s*[\d.]+)?)\s*([a-zA-Z]+)?\s+(.+)$', text)
    if m:
        amount = m.group(1).strip()
        unit = (m.group(2) or "").strip()
        name = m.group(3).strip()
    else:
        # "A pinch of salt"
        m2 = re.match(r'^(A\s+pinch\s+of)\s+(.+)$', text, re.IGNORECASE)
        if m2:
            amount = "1"
            unit = "pinch"
            name = m2.group(2).strip()
        else:
            # "The juice of 2 limes"
            m3 = re.match(r'^(?:The\s+)?(.+?)(?:\s+of\s+)?(\d+\s+.+)$', text, re.IGNORECASE)
            if not m3:
                name = text

    return {
        "amount": amount,
        "unit": unit,
        "name": name,
        "comment": comment,
    }


def parse_directions_from_desc(desc: str) -> list[str]:
    """Extract numbered directions from description."""
    directions = []
    in_instructions = False

    for line in desc.split("\n"):
        line = line.strip()
        if re.match(r'^instructions?:', line, re.IGNORECASE):
            in_instructions = True
            continue

        if not in_instructions:
            continue

        # Stop at hashtags or subscribe text
        if line.startswith("#") or line.startswith("Subscribe"):
            break
        if not line:
            continue

        # Numbered step
        m = re.match(r'^\d+\.\s+(.+)$', line)
        if m:
            directions.append(m.group(1).strip())
        elif directions and line and not line.startswith("-"):
            # Continuation of previous direction
            directions[-1] += " " + line

    return directions


def parse_recipe(short: dict[str, str]) -> dict[str, Any] | None:
    """Parse a single FPF short into a recipe dict."""
    title = short["title"].strip()
    desc = short["description"]
    vid_id = short["id"]

    if not desc:
        return None

    # Check if description has actual recipe content (ingredients)
    if "- " not in desc:
        return None

    # Clean title - remove trailing emoji/whitespace
    clean_title = re.sub(r'\s*[🍦🍨🧁🍫🎂]+\s*$', '', title).strip()

    slug = "fpf-" + slugify(clean_title)
    nutrition = parse_nutrition_from_desc(desc)
    ingredients = parse_ingredients_from_desc(desc)
    directions = parse_directions_from_desc(desc)

    if not ingredients:
        return None

    # Extract description text (first meaningful line)
    desc_text = ""
    for line in desc.split("\n"):
        line = line.strip()
        if line and not line.startswith("-") and not line.startswith("#") and \
           not re.match(r'^\d+\.', line) and "recipe book" not in line.lower() and \
           "subscribe" not in line.lower() and "bio" not in line.lower() and \
           "FULL RECIPE" not in line:
            # Skip calorie lines
            if re.match(r'^\d+\s*cal', line, re.IGNORECASE):
                continue
            if re.match(r'^mix[- ]?ins?', line, re.IGNORECASE):
                continue
            if re.match(r'^instructions?:', line, re.IGNORECASE):
                continue
            if re.match(r'^toppings?:', line, re.IGNORECASE):
                continue
            desc_text = line
            break

    if not desc_text:
        desc_text = f"High-protein Ninja Creami recipe by FitnessProductFinder."

    # Determine tags
    tags = ["Hi-Protein"]  # FPF recipes are always protein-focused
    title_lower = title.lower()
    if nutrition["kcal"] > 0 and nutrition["kcal"] < 300:
        tags.append("Low-Sugar")
    if any(word in title_lower for word in ["oreo", "cookie", "biscoff", "cake", "pie", "fudge"]):
        tags.append("Dessert-Inspired")
    if any(word in title_lower for word in ["matcha", "coffee", "mocha", "espresso"]):
        tags.append("Coffee/Tea")
    if any(word in title_lower for word in ["fruit", "berry", "strawberry", "banana", "mango", "peach", "lemon", "lime", "cherry", "apple", "pineapple"]):
        tags.append("Fruit")
    if any(word in title_lower for word in ["chocolate", "cocoa", "choco"]):
        tags.append("Chocolate")

    # FPF recipes typically use xanthan gum → scoopable
    has_xanthan = any("xanthan" in item.get("name", "").lower()
                       for step in ingredients for item in step.get("items", []))

    # Nutrition is for the full pint, estimate per 100g
    # FPF pints are roughly 450-500g total
    pint_weight = 473  # ~1 US pint in grams
    per_100g = {}
    if nutrition["kcal"] > 0:
        scale = 100 / pint_weight
        per_100g = {
            "kcal": round(nutrition["kcal"] * scale, 1),
            "fat": round(nutrition["fat"] * scale, 1),
            "carbs": round(nutrition["carbs"] * scale, 1),
            "sugar": round(nutrition.get("sugar", 0) * scale, 1),
            "protein": round(nutrition["protein"] * scale, 1),
            "salt": 0,
        }
    else:
        per_100g = {"kcal": 0, "fat": 0, "carbs": 0, "sugar": 0, "protein": 0, "salt": 0}

    return {
        "id": slug,
        "name": clean_title,
        "slug": slug,
        "source": "fpf",
        "description": desc_text,
        "tags": tags,
        "nutrition": per_100g,
        "nutritionTotal": {
            "weight": pint_weight,
            "kcal": nutrition["kcal"],
            "fat": nutrition["fat"],
            "carbs": nutrition["carbs"],
            "sugar": nutrition.get("sugar", 0),
            "protein": nutrition["protein"],
            "salt": 0,
        },
        "fpdf": None,
        "proteinRatio": None,
        "ingredients": ingredients,
        "directions": directions,
        "images": [],
        "rating": None,
        "isScoopable": has_xanthan,
        "isLight": per_100g["kcal"] > 0 and per_100g["kcal"] <= 75,
        "isVegan": False,
        "isDraft": False,
        "canonicalUrl": f"https://youtube.com/shorts/{vid_id}",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Step 1: List all shorts
    all_shorts = list_shorts()
    recipe_shorts = filter_recipe_shorts(all_shorts)

    # Step 2: Fetch descriptions (with caching)
    recipe_shorts = fetch_descriptions(recipe_shorts)

    # Step 3: Parse recipes
    fpf_recipes = []
    skipped = []
    for s in recipe_shorts:
        recipe = parse_recipe(s)
        if recipe:
            fpf_recipes.append(recipe)
        else:
            skipped.append(s["title"])

    print(f"\nParsed {len(fpf_recipes)} FPF recipes")
    if skipped:
        print(f"Skipped {len(skipped)} (no parseable recipe data):")
        for t in skipped:
            print(f"  - {t}")

    # Step 4: Merge with existing jhermann recipes
    if not RECIPES_JSON.exists():
        print(f"ERROR: {RECIPES_JSON} not found. Run build-recipe-db.py first.")
        sys.exit(1)

    existing = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))
    # Remove old FPF recipes (in case of re-run)
    jhermann_recipes = [r for r in existing if r.get("source") != "fpf"]

    merged = jhermann_recipes + fpf_recipes
    # Sort by name
    merged.sort(key=lambda r: r["name"].lower())

    RECIPES_JSON.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"\nMerged: {len(jhermann_recipes)} jhermann + {len(fpf_recipes)} fpf = {len(merged)} total")
    print(f"Output: {RECIPES_JSON}")

    # Validation
    sources = {}
    for r in merged:
        src = r.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    print("\nSources:")
    for src, count in sorted(sources.items()):
        print(f"  {src}: {count}")


if __name__ == "__main__":
    main()
