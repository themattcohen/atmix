"""
build-recipe-db.py

Parses all Ninja Creami recipe README.md files from the ice-creamery repo
and produces a unified recipes.json for the creami-app frontend.

Also copies recipe images (excluding logos) into public/images/{slug}/.

Usage:
    python scripts/build-recipe-db.py

Requires: PyYAML
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import yaml

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent                                   # creami-app/
REPO_DIR = APP_DIR.parent / "creami"                          # creami/ (clone of ice-creamery)
RECIPES_DIR = REPO_DIR / "recipes"
OUTPUT_JSON = APP_DIR / "src" / "data" / "recipes.json"
IMAGES_DIR = APP_DIR / "public" / "images"

# Ingredient step names we recognise (order matters for display)
KNOWN_STEPS = [
    "Prep",
    "Wet",
    "Dry",
    "Fill to MAX",
    "Mix-ins",
    "Mix-in",
    "Optional / Choices",
    "Optional/Choices",
    "Optional",
    "Toppings",
    "Topping",
]

# Files to skip as logos when copying images (filename-based heuristic)
LOGO_PATTERNS = re.compile(
    r"^logo[-_.]|.*-logo\.|.*-ice-cream-logo\.|.*bliss\.",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Helpers: text cleanup
# ---------------------------------------------------------------------------

def strip_markdown_links(text: str) -> str:
    """
    Convert  [text](/url){target="_blank"}<sup>...</sup>  to just  text.
    Also handles [text](url) without the extra attributes.
    """
    # Pattern: [text](url){...}<sup>...</sup>
    text = re.sub(
        r'\[([^\]]*?)(?:\\([\[\]]))?([^\]]*?)\]\([^)]*\)(?:\{[^}]*\})?(?:<sup>[^<]*</sup>)?',
        lambda m: m.group(1) + (m.group(2) or '') + m.group(3),
        text,
    )
    # Simpler fallback for remaining markdown links
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    return text


def strip_inline_markup(text: str) -> str:
    """Remove residual markdown emphasis and HTML tags from a text string."""
    text = strip_markdown_links(text)
    # Remove <sup>...</sup>, <br />, <br/>, <br>, <img .../>
    text = re.sub(r'<(?:sup|br|img)[^>]*/?>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</sup>', '', text, flags=re.IGNORECASE)
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', text)
    return text.strip()


def slugify(name: str) -> str:
    """Generate a URL-safe slug from a recipe folder name."""
    s = name.lower()
    # Replace common unicode
    s = s.replace("\u2022", "").replace("\u2019", "")   # bullet, right-single-quote
    s = s.replace("'", "").replace("'", "")
    # Remove parenthesised content like (Deluxe)
    s = re.sub(r'\([^)]*\)', '', s)
    # Replace + and & with and
    s = s.replace('+', '-').replace('&', '-and-')
    # Replace spaces and special chars with hyphens
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    # Collapse multiple hyphens
    s = re.sub(r'-{2,}', '-', s)
    return s


# ---------------------------------------------------------------------------
# Helpers: frontmatter
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Split YAML frontmatter from the markdown body."""
    if not text.startswith('---'):
        return {}, text

    parts = text.split('---', 2)
    if len(parts) < 3:
        return {}, text

    fm_text = parts[1]
    body = parts[2]

    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        fm = {}

    return fm, body


# ---------------------------------------------------------------------------
# Helpers: ingredient parsing
# ---------------------------------------------------------------------------

_AMOUNT_RE = re.compile(
    r'^_'                     # opening underscore
    r'([^_]+)'               # capture everything inside the underscores
    r'_\s*'                  # closing underscore + optional space
)

_AMT_UNIT_RE = re.compile(
    r'^'
    r'([~\u2248]?\s*[\d.,/]+(?:\s*[-\u2013]\s*[\d.,/]+)?)'  # amount (possibly with ≈ prefix, range)
    r'\s*'
    r'([a-zA-Z%]+)?'         # optional unit
    r'$'
)


def parse_ingredient_line(line: str) -> dict[str, str] | None:
    """
    Parse a single ingredient line like:
      - _300ml_ Soy milk 1.6% (sugar-free) [Berief] . alternative: ...
    Returns {"amount", "unit", "name", "comment"} or None if unparseable.
    """
    line = line.strip()
    # Remove list marker
    line = re.sub(r'^[-*]\s*', '', line)
    line = line.strip()

    if not line:
        return None

    # Strip markdown links first so we get clean text
    line = strip_markdown_links(line)

    amount = ""
    unit = ""
    rest = line

    # Try to extract _amount+unit_
    m = _AMOUNT_RE.match(line)
    if m:
        raw_amount = m.group(1).strip()
        rest = line[m.end():].strip()

        # Split raw_amount into numeric part and unit
        am = _AMT_UNIT_RE.match(raw_amount)
        if am:
            amount = am.group(1).strip().replace('\u2248', '~')
            unit = (am.group(2) or "").strip()
        else:
            # Could be something like "3 drops" inside underscores
            parts = raw_amount.split(None, 1)
            if len(parts) == 2 and any(c.isdigit() for c in parts[0]):
                amount = parts[0].replace('\u2248', '~')
                unit = parts[1]
            else:
                amount = raw_amount.replace('\u2248', '~')
    else:
        # No underscore-delimited amount: treat entire line as name
        pass

    # Split rest into name and comment at bullet
    if '\u2022' in rest:
        name_part, comment_part = rest.split('\u2022', 1)
    elif ' . ' in rest:
        # fallback: dot separator in some rare cases
        name_part, comment_part = rest.split(' . ', 1)
    else:
        name_part = rest
        comment_part = ""

    name_part = name_part.strip()
    comment_part = comment_part.strip()

    # Clean up name: remove trailing/leading brackets we don't need
    # Remove escaped brackets from markdown: \[...\]
    name_part = name_part.replace('\\[', '[').replace('\\]', ']')
    # Remove <sup> leftovers
    name_part = re.sub(r'<sup>[^<]*</sup>', '', name_part).strip()
    # Remove {target=...} leftovers
    name_part = re.sub(r'\{[^}]*\}', '', name_part).strip()

    # Clean comment similarly
    comment_part = comment_part.replace('\\[', '[').replace('\\]', ']')
    comment_part = re.sub(r'<sup>[^<]*</sup>', '', comment_part).strip()
    comment_part = re.sub(r'\{[^}]*\}', '', comment_part).strip()
    # Remove markdown emphasis markers: *text* or **text** -> text
    comment_part = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', comment_part)
    comment_part = re.sub(r'^\*+|\*+$', '', comment_part).strip()

    # Same cleanup for name
    name_part = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', name_part)
    name_part = name_part.strip()

    if not name_part and not amount:
        return None

    return {
        "amount": amount,
        "unit": unit,
        "name": name_part,
        "comment": comment_part,
    }


# ---------------------------------------------------------------------------
# Helpers: nutrition parsing
# ---------------------------------------------------------------------------

def parse_nutrition_value(text: str) -> float | None:
    """Extract a float from text like '80.2' or '0.0'."""
    m = re.search(r'([\d.]+)', text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


def parse_nutrition_line(line: str, prefix: str) -> dict[str, float] | None:
    """
    Parse a line like:
      100g; 80.2 kcal; fat 2.7g; carbs 13.1g; sugar 2.6g; protein 3.6g; salt 0.2g
    """
    # Find the part after the bold label
    idx = line.find(prefix)
    if idx < 0:
        return None
    rest = line[idx + len(prefix):]
    # Also try after ':**'
    colon_idx = rest.find(':**')
    if colon_idx >= 0:
        rest = rest[colon_idx + 3:]

    parts = re.split(r';\s*', rest.strip())
    result: dict[str, float] = {}

    for part in parts:
        part = part.strip().rstrip('.')
        if not part:
            continue

        # weight: "680g" or "100g"
        wm = re.match(r'^([\d.]+)\s*g$', part)
        if wm:
            result['weight'] = float(wm.group(1))
            continue

        # kcal: "80.2 kcal"
        km = re.match(r'^([\d.]+)\s*kcal', part)
        if km:
            result['kcal'] = float(km.group(1))
            continue

        # named: "fat 2.7g"
        nm = re.match(r'^(fat|carbs|sugar|protein|salt)\s+([\d.]+)\s*g?', part)
        if nm:
            result[nm.group(1)] = float(nm.group(2))

    return result if result else None


# ---------------------------------------------------------------------------
# Main recipe parser
# ---------------------------------------------------------------------------

def parse_recipe(folder: Path) -> tuple[dict[str, Any], set[str]] | None:
    """Parse a single recipe folder. Returns (recipe_dict, logo_filenames) or None."""
    readme = folder / "README.md"
    if not readme.exists():
        return None

    raw = readme.read_text(encoding="utf-8", errors="replace")
    fm, body = parse_frontmatter(raw)

    # Skip recipes with no frontmatter at all (like Toppings/)
    tags = fm.get("tags", []) or []
    if not tags and not fm.get("canonical_url"):
        # Likely not a real recipe
        return None

    folder_name = folder.name
    slug = slugify(folder_name)

    lines = body.split('\n')

    # ---- Recipe name (first # heading) ----
    recipe_name = folder_name
    for ln in lines:
        stripped = ln.strip()
        if stripped.startswith('# ') and not stripped.startswith('# INGREDIENTS') and not stripped.startswith('# DIRECTIONS') and not stripped.startswith('# NUTRITIONAL'):
            recipe_name = stripped[2:].strip()
            break

    # ---- Description ----
    # Collect all plain-text paragraphs between the first heading and the
    # INGREDIENTS section (or Rating: line). Skip blockquotes, images,
    # and jinja includes. Allow blank lines between paragraphs.
    description_lines: list[str] = []
    past_heading = False
    heading_idx = -1

    for i, ln in enumerate(lines):
        stripped = ln.strip()
        if not past_heading:
            if stripped.startswith('# ') and not stripped.startswith('# INGREDIENTS') \
               and not stripped.startswith('# DIRECTIONS') and not stripped.startswith('# NUTRITIONAL'):
                past_heading = True
                heading_idx = i
            continue

        # Stop at next major heading
        if stripped.startswith('# '):
            break

        # Stop at Rating line (not inside blockquote)
        if stripped.lower().startswith('rating:'):
            break

        # Skip <img> tags, blockquotes, jinja includes, <br> tags
        if stripped.startswith('<img') or stripped.startswith('<br'):
            continue
        if stripped.startswith('>'):
            # If we already have text, a blockquote means description is done
            if description_lines:
                break
            continue
        if stripped.startswith('{%'):
            continue
        if stripped.startswith('\u2139'):
            # Info symbol line (Brand names note)
            break

        # Blank line: allow it (paragraph separator)
        if not stripped:
            continue

        # This is a description line
        cleaned = strip_inline_markup(stripped)
        if cleaned:
            description_lines.append(cleaned)

    description = ' '.join(description_lines).strip()

    # ---- Rating ----
    rating: str | None = None
    for ln in lines:
        stripped = ln.strip()
        # Handle "> Rating:" inside blockquotes
        check = stripped.lstrip('> ').strip()
        if check.lower().startswith('rating:'):
            rating = check[len('Rating:'):].strip()
            # Sometimes there's additional text after emoji rating
            break

    # ---- Images ----
    images: list[str] = []
    logo_filenames = find_logo_filenames(body)
    for m in re.finditer(r'<img[^>]+>', body):
        tag = m.group(0)
        src_m = re.search(r'src="([^"]+)"', tag)
        if not src_m:
            continue
        src = src_m.group(1)
        # Skip external URLs
        if src.startswith('http'):
            continue
        # Skip logos (identified by alt="Logo" or filename patterns)
        alt_m = re.search(r'alt="([^"]*)"', tag)
        alt_text = alt_m.group(1) if alt_m else ''
        if alt_text.lower() == 'logo':
            continue
        filename = src.split('/')[-1]
        if LOGO_PATTERNS.match(filename):
            continue
        if filename not in images:
            images.append(filename)

    # ---- Ingredients ----
    ingredients: list[dict[str, Any]] = []
    in_ingredients = False
    current_step: str | None = None
    current_items: list[dict[str, str]] = []

    for ln in lines:
        stripped = ln.strip()

        if stripped == '# INGREDIENTS':
            in_ingredients = True
            continue

        if in_ingredients and stripped.startswith('# '):
            # End of ingredients section
            if current_step and current_items:
                ingredients.append({"step": current_step, "items": current_items})
            break

        if not in_ingredients:
            continue

        # Check for step header like **Wet** or **Fill to MAX**
        step_match = re.match(r'^\*\*([^*]+)\*\*\s*$', stripped)
        if step_match:
            # Save previous step
            if current_step and current_items:
                ingredients.append({"step": current_step, "items": current_items})
            current_step = step_match.group(1).strip()
            current_items = []
            continue

        # Check for ingredient line (starts with - after spaces)
        if re.match(r'^\s*[-*]\s', stripped):
            # If no step header yet, default to "Ingredients"
            if current_step is None:
                current_step = "Ingredients"
            parsed = parse_ingredient_line(stripped)
            if parsed:
                current_items.append(parsed)
            continue

    # Flush last step
    if current_step and current_items:
        # Only add if not already added (the break might have added it)
        if not ingredients or ingredients[-1]["step"] != current_step:
            ingredients.append({"step": current_step, "items": current_items})

    # ---- Directions ----
    directions: list[str] = []
    in_directions = False
    for ln in lines:
        stripped = ln.strip()

        if stripped == '# DIRECTIONS':
            in_directions = True
            continue

        if in_directions and stripped.startswith('# '):
            break

        if not in_directions:
            continue

        # Numbered list items: " 1. ..." or "1. ..."
        dm = re.match(r'^\s*\d+\.\s+(.+)$', stripped)
        if dm:
            direction_text = strip_inline_markup(dm.group(1))
            directions.append(direction_text)

    # ---- Nutritional info ----
    nutrition: dict[str, float] = {}
    nutrition_total: dict[str, float] = {}
    fpdf: float | None = None
    protein_ratio: float | None = None

    in_nutrition = False
    for ln in lines:
        stripped = ln.strip()

        if stripped.startswith('# NUTRITIONAL'):
            in_nutrition = True
            continue

        if in_nutrition and stripped.startswith('# '):
            break

        if not in_nutrition:
            continue

        lower = stripped.lower()

        # Per 100g line
        if 'per 100g' in lower:
            parsed = parse_per_100g(stripped)
            if parsed:
                nutrition = parsed

        # Total line
        if 'values total' in lower or 'nutritional values total' in lower:
            parsed = parse_total(stripped)
            if parsed:
                nutrition_total = parsed

        # FPDF / PAC line
        if 'fpdf' in lower:
            clean_line = strip_markdown_links(stripped).strip()
            # The value is after ':**' and before any trailing text
            fpdf_match = re.search(r':\*\*\s*([\d.]+)', clean_line)
            if not fpdf_match:
                fpdf_match = re.search(r'(\d+\.\d+)', clean_line.split(':**')[-1] if ':**' in clean_line else clean_line)
            if fpdf_match:
                try:
                    fpdf = float(fpdf_match.group(1))
                except ValueError:
                    pass

        # Protein / Energy Ratio
        if 'protein / energy ratio' in lower or 'protein/energy ratio' in lower:
            clean_line = strip_markdown_links(stripped).strip()
            # Value after ':**' like: ":**  17.80% . LOW-FAT"
            ratio_match = re.search(r':\*\*\s*([\d.]+)%', clean_line)
            if not ratio_match:
                ratio_match = re.search(r'([\d.]+)%', clean_line)
            if ratio_match:
                try:
                    protein_ratio = float(ratio_match.group(1))
                except ValueError:
                    pass

    # ---- Boolean flags from tags ----
    tag_set = {t.lower() for t in tags}
    is_scoopable = 'scoopable' in tag_set
    is_light = 'light' in tag_set or 'low-cal' in tag_set
    is_vegan = 'vegan' in tag_set
    is_draft = 'draft' in tag_set

    # ---- Canonical URL ----
    canonical_url = fm.get("canonical_url")

    return {
        "id": slug,
        "name": recipe_name,
        "slug": slug,
        "source": "jhermann",
        "description": description,
        "tags": tags,
        "nutrition": {
            "kcal": nutrition.get("kcal", 0),
            "fat": nutrition.get("fat", 0),
            "carbs": nutrition.get("carbs", 0),
            "sugar": nutrition.get("sugar", 0),
            "protein": nutrition.get("protein", 0),
            "salt": nutrition.get("salt", 0),
        },
        "nutritionTotal": {
            "weight": nutrition_total.get("weight", 0),
            "kcal": nutrition_total.get("kcal", 0),
            "fat": nutrition_total.get("fat", 0),
            "carbs": nutrition_total.get("carbs", 0),
            "sugar": nutrition_total.get("sugar", 0),
            "protein": nutrition_total.get("protein", 0),
            "salt": nutrition_total.get("salt", 0),
        },
        "fpdf": fpdf,
        "proteinRatio": protein_ratio,
        "ingredients": ingredients,
        "directions": directions,
        "images": images,
        "rating": rating,
        "isScoopable": is_scoopable,
        "isLight": is_light,
        "isVegan": is_vegan,
        "isDraft": is_draft,
        "canonicalUrl": canonical_url,
    }, logo_filenames


def parse_per_100g(line: str) -> dict[str, float] | None:
    """Parse the per-100g nutrition line."""
    cleaned = strip_markdown_links(line)
    # Format is: **label:** data  -- colon is INSIDE the bold markers
    m = re.search(r':\*\*\s*(.+)$', cleaned)
    if not m:
        # Fallback: try after any colon followed by digit
        m = re.search(r':\s*(\d.+)$', cleaned)
    if not m:
        return None
    data = m.group(1).strip()
    return _parse_nutrition_data(data)


def parse_total(line: str) -> dict[str, float] | None:
    """Parse the total nutrition line."""
    cleaned = strip_markdown_links(line)
    m = re.search(r':\*\*\s*(.+)$', cleaned)
    if not m:
        m = re.search(r':\s*(\d.+)$', cleaned)
    if not m:
        return None
    data = m.group(1).strip()
    return _parse_nutrition_data(data)


def _parse_nutrition_data(data: str) -> dict[str, float]:
    """Parse semicolon-separated nutrition data string."""
    parts = re.split(r';\s*', data)
    result: dict[str, float] = {}

    for part in parts:
        part = part.strip().rstrip('.')
        if not part:
            continue

        # weight: "680g" or "100g" or "720g"
        wm = re.match(r'^([\d.]+)\s*g$', part)
        if wm:
            result['weight'] = float(wm.group(1))
            continue

        # kcal: "80.2 kcal"
        km = re.match(r'^([\d.]+)\s*kcal', part)
        if km:
            result['kcal'] = float(km.group(1))
            continue

        # named: "fat 2.7g"
        nm = re.match(r'^(fat|carbs|sugar|protein|salt)\s+([\d.]+)\s*g?', part)
        if nm:
            result[nm.group(1)] = float(nm.group(2))

    return result


# ---------------------------------------------------------------------------
# Image copying
# ---------------------------------------------------------------------------

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def find_logo_filenames(body: str) -> set[str]:
    """Extract filenames of images tagged as logos in the markdown body."""
    logos: set[str] = set()
    for m in re.finditer(r'<img[^>]+>', body):
        tag = m.group(0)
        alt_m = re.search(r'alt="([^"]*)"', tag)
        src_m = re.search(r'src="([^"]+)"', tag)
        if not src_m:
            continue
        alt_text = alt_m.group(1) if alt_m else ''
        if alt_text.lower() == 'logo':
            src = src_m.group(1)
            if not src.startswith('http'):
                logos.add(src.split('/')[-1])
    return logos


def copy_images(folder: Path, slug: str, logo_filenames: set[str]) -> int:
    """
    Copy non-logo image files from the recipe folder to
    creami-app/public/images/{slug}/.
    Returns the count of files copied.
    """
    dest_dir = IMAGES_DIR / slug
    count = 0

    for f in folder.iterdir():
        if not f.is_file():
            continue
        if f.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        # Skip logos: by filename pattern OR by README alt-tag detection
        if LOGO_PATTERNS.match(f.name):
            continue
        if f.name in logo_filenames:
            continue

        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f.name
        shutil.copy2(f, dest)
        count += 1

    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not RECIPES_DIR.exists():
        print(f"ERROR: Recipes directory not found: {RECIPES_DIR}", file=sys.stderr)
        print("Make sure the ice-creamery repo is cloned at:", REPO_DIR, file=sys.stderr)
        sys.exit(1)

    # Clean previous image output
    if IMAGES_DIR.exists():
        shutil.rmtree(IMAGES_DIR)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    recipes: list[dict[str, Any]] = []
    skipped: list[str] = []
    total_images = 0

    # Get sorted list of recipe folders
    folders = sorted(
        [d for d in RECIPES_DIR.iterdir() if d.is_dir()],
        key=lambda d: d.name.lower(),
    )

    print(f"Found {len(folders)} recipe directories in {RECIPES_DIR}")
    print()

    for folder in folders:
        readme = folder / "README.md"
        if not readme.exists():
            skipped.append(f"  {folder.name}: no README.md")
            continue

        result = parse_recipe(folder)
        if result is None:
            skipped.append(f"  {folder.name}: skipped (no valid recipe data)")
            continue

        recipe, logo_files = result

        # Copy images (excluding logos)
        img_count = copy_images(folder, recipe["slug"], logo_files)
        total_images += img_count

        recipes.append(recipe)

    # Ensure output directory exists
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)

    print(f"Parsed {len(recipes)} recipes successfully.")
    if skipped:
        print(f"Skipped {len(skipped)} folders:")
        for s in skipped:
            print(s)
    print()
    print(f"Copied {total_images} images to {IMAGES_DIR}")
    print(f"Output written to: {OUTPUT_JSON}")
    print()

    # Quick validation
    has_nutrition = sum(1 for r in recipes if r["nutrition"]["kcal"] > 0)
    has_ingredients = sum(1 for r in recipes if r["ingredients"])
    has_directions = sum(1 for r in recipes if r["directions"])
    has_rating = sum(1 for r in recipes if r["rating"])
    has_images = sum(1 for r in recipes if r["images"])
    drafts = sum(1 for r in recipes if r["isDraft"])
    scoopable = sum(1 for r in recipes if r["isScoopable"])
    vegan = sum(1 for r in recipes if r["isVegan"])

    print("=== Validation Summary ===")
    print(f"  Total recipes:       {len(recipes)}")
    print(f"  With nutrition:      {has_nutrition}")
    print(f"  With ingredients:    {has_ingredients}")
    print(f"  With directions:     {has_directions}")
    print(f"  With rating:         {has_rating}")
    print(f"  With images:         {has_images}")
    print(f"  Drafts:              {drafts}")
    print(f"  Scoopable:           {scoopable}")
    print(f"  Vegan:               {vegan}")


if __name__ == "__main__":
    main()
