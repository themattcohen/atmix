"""
scrape-blogs.py

Scrapes Ninja Creami recipes from food blogs using the recipe-scrapers
Python library. Targets blogs that use Schema.org Recipe structured data.

Currently scrapes:
  - The Tasty Travelers (thetastytravelers.com)
  - Earth and Oven (earthandoven.com)
  - The Big Man's World (thebigmansworld.com)
  - Secretly Healthy Home (secretlyhealthyhome.com)
  - Basics with Bails (basicswithbails.com)
  - Pretty Delicious Life (prettydeliciouslife.com)
  - George Eats (georgeats.com)
  - Lara Clevenger (laraclevenger.com)
  - Krolls Korner (krollskorner.com)

Merges blog recipes into the existing recipes.json alongside other sources.

Usage:
    python scripts/scrape-blogs.py

Requires: recipe-scrapers, requests
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

try:
    from recipe_scrapers import scrape_html
except ImportError:
    print("ERROR: recipe-scrapers not installed. Run: pip install recipe-scrapers")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
RECIPES_JSON = APP_DIR / "src" / "data" / "recipes.json"
BLOG_CACHE = SCRIPT_DIR / "blog-cache.json"

# ---------------------------------------------------------------------------
# Blog sources configuration
# ---------------------------------------------------------------------------

BLOG_SOURCES: list[dict[str, Any]] = [
    {
        "name": "The Tasty Travelers",
        "source_id": "tastytravelers",
        "category_urls": [
            "https://thetastytravelers.com/category/ninja-creami/",
            "https://thetastytravelers.com/category/ninja-creami/page/2/",
            "https://thetastytravelers.com/category/ninja-creami/page/3/",
            "https://thetastytravelers.com/category/ninja-creami/page/4/",
            "https://thetastytravelers.com/category/ninja-creami/page/5/",
            "https://thetastytravelers.com/category/ninja-creami/ninja-creami-community-recipe/",
        ],
        "link_pattern": r'href="(https://thetastytravelers\.com/(?!category|tag|page|wp-)[a-z0-9-]+/)"',
        "exclude_patterns": [
            r"/ninja-creami-recipes/$",
            r"/ninja-creami-guides/$",
            r"/the-best-ninja-creami-",
            r"/ninja-creami-low-calorie-recipes/$",
            r"/ninja-creami-sorbet-recipes/$",
            r"/frozen-treat-recipes-cookbook",
            r"/ninja-creami-cookbook/$",
        ],
    },
    {
        "name": "Earth and Oven",
        "source_id": "earthandoven",
        "category_urls": [
            "https://earthandoven.com/2024/12/10/ninja-creami-recipes/",
            "https://earthandoven.com/2025/12/25/healthy-ninja-creami-recipes/",
            "https://earthandoven.com/2025/12/25/dairy-free-ninja-creami-recipes/",
            "https://earthandoven.com/2025/11/27/ninja-creami-protein-ice-cream/",
        ],
        "link_pattern": r'href="(https://earthandoven\.com/\d{4}/\d{2}/\d{2}/[a-z0-9-]+/)"',
        "exclude_patterns": [
            r"ninja-creami-recipes/$",
            r"healthy-ninja-creami-recipes/$",
            r"dairy-free-ninja-creami-recipes/$",
            r"allulose-vs-stevia",
            r"cottage-cheese-",
            r"salad-recipes",
            r"zucchini-casserole",
            r"banana-cottage",
            r"dubai-chocolate",
            r"strawberry-yogurt-bites",
            r"matcha-muffin",
            r"pumpkin-pie-recipe",
        ],
    },
    {
        "name": "Secretly Healthy Home",
        "source_id": "secretlyhealthy",
        "direct_urls": [
            "https://secretlyhealthyhome.com/best-ninja-creami-protein-ice-cream/",
            "https://secretlyhealthyhome.com/best-chocolate-ninja-creami-protein-ice-cream/",
            "https://secretlyhealthyhome.com/creamsicle-ice-cream-ninja-creami-recipe/",
            "https://secretlyhealthyhome.com/easy-coffee-ice-cream-recipe/",
            "https://secretlyhealthyhome.com/easy-mint-chocolate-chip-ice-cream-recipe/",
        ],
        "link_pattern": None,
        "exclude_patterns": [],
    },
    {
        "name": "George Eats",
        "source_id": "georgeats",
        "category_urls": [
            "https://georgeats.com/recipes/ninja-creami-recipes/",
            "https://georgeats.com/recipes/healthy-ninja-creami-recipes/",
        ],
        "link_pattern": r'href="(https://georgeats\.com/recipes/[a-z0-9-]+/)"',
        "exclude_patterns": [
            r"ninja-creami-recipes/$",
            r"healthy-ninja-creami-recipes/$",
        ],
    },
    {
        "name": "Basics with Bails",
        "source_id": "bails",
        "category_urls": [
            "https://basicswithbails.com/tag/ninja-creami/",
            "https://basicswithbails.com/tag/ninja-creami/page/2/",
            "https://basicswithbails.com/tag/ninja-creami/page/3/",
        ],
        "link_pattern": r'href="(https://basicswithbails\.com/(?:popular|course|diet)/[a-z0-9-]+/[a-z0-9-]+/)"',
        "exclude_patterns": [],
    },
    {
        "name": "Lara Clevenger",
        "source_id": "clevenger",
        "category_urls": [
            "https://laraclevenger.com/ninja-creami-recipes/",
            "https://laraclevenger.com/category/cooking-method/ninja-creami/",
        ],
        "link_pattern": r'href="(https://laraclevenger\.com/[a-z0-9][a-z0-9-]+/)"',
        "exclude_patterns": [
            r"/ninja-creami-recipes/$",
            r"/ninja-creami/$",
            r"/category/",
            r"/web-stories/",
            r"/bonus-signup/",
            r"/about-",
            r"/contact/$",
            r"/services/$",
            r"/recipe-index/$",
            r"/disclosure-policy/$",
            r"/\d+-\w+-recipes-",
            r"/\d+-\w+-dishes-",
            r"/\d+-\w+-that-",
            r"/\d+-\w+-so-",
            r"/feed/$",
            r"/wp-json/$",
        ],
    },
    {
        "name": "Krolls Korner",
        "source_id": "krolls",
        "category_urls": [
            "https://krollskorner.com/?s=ninja+creami",
            "https://krollskorner.com/page/2/?s=ninja+creami",
        ],
        "link_pattern": r'href="(https://krollskorner\.com/recipes/[a-z0-9/-]+/)"',
        "exclude_patterns": [
            r"/poll/",
            r"/techniques/",
            r"/chocolate-mug-cake/",
            r"/browse-by-series/",
            r"/creami-series/",
        ],
    },
]

# HTTP config
USER_AGENT = "Mozilla/5.0 (compatible; recipe-collector/1.0)"
RATE_LIMIT_DELAY = 1.5


# ---------------------------------------------------------------------------
# Step 1: Discover recipe URLs
# ---------------------------------------------------------------------------

def fetch_page(url: str) -> str | None:
    """Fetch a web page and return HTML."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return None


def discover_recipe_urls(source: dict[str, Any]) -> list[str]:
    """Discover individual recipe URLs from a blog source."""
    urls: set[str] = set()

    # Direct URLs
    if "direct_urls" in source:
        urls.update(source["direct_urls"])

    # Category page crawling
    if "category_urls" in source:
        for cat_url in source["category_urls"]:
            html = fetch_page(cat_url)
            if not html:
                continue

            pattern = source.get("link_pattern")
            if pattern:
                matches = re.findall(pattern, html)
                for match in matches:
                    urls.add(match)

            time.sleep(RATE_LIMIT_DELAY)

    # Apply exclusion patterns
    exclude_patterns = source.get("exclude_patterns", [])
    filtered: list[str] = []
    for url in urls:
        excluded = False
        for pat in exclude_patterns:
            if re.search(pat, url):
                excluded = True
                break
        if not excluded:
            filtered.append(url)

    return sorted(set(filtered))


# ---------------------------------------------------------------------------
# Step 2: Scrape individual recipes
# ---------------------------------------------------------------------------

def slugify(name: str) -> str:
    """Generate a URL-safe slug."""
    s = name.lower()
    s = re.sub(r"[''']", "", s)
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.replace("+", "-").replace("&", "-and-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s


def parse_nutrition_value(text: str | None) -> float:
    """Extract a numeric value from a nutrition string like '235 kcal'."""
    if not text:
        return 0
    m = re.search(r"([\d.]+)", str(text))
    return float(m.group(1)) if m else 0


def scrape_recipe(url: str, source_id: str) -> dict[str, Any] | None:
    """Scrape a single recipe page using recipe-scrapers."""
    html = fetch_page(url)
    if not html:
        return None

    try:
        scraper = scrape_html(html, org_url=url, wild_mode=True)
    except Exception as e:
        print(f"    Scraper error for {url}: {e}")
        return None

    title = scraper.title()
    if not title:
        return None

    # Get ingredients
    try:
        raw_ingredients = scraper.ingredients()
    except Exception:
        raw_ingredients = []

    if not raw_ingredients:
        return None

    # Parse ingredients into our format
    base_items: list[dict[str, str]] = []
    for ing in raw_ingredients:
        parsed = parse_blog_ingredient(ing)
        if parsed:
            base_items.append(parsed)

    if not base_items:
        return None

    ingredients = [{"step": "Ingredients", "items": base_items}]

    # Get instructions
    try:
        raw_instructions = scraper.instructions_list()
    except Exception:
        raw_instructions = []

    directions = [inst.strip() for inst in raw_instructions if inst.strip()]

    # Get nutrition
    try:
        nutrients = scraper.nutrients()
    except Exception:
        nutrients = {}

    kcal = parse_nutrition_value(nutrients.get("calories"))
    fat = parse_nutrition_value(nutrients.get("fatContent"))
    carbs = parse_nutrition_value(nutrients.get("carbohydrateContent"))
    protein = parse_nutrition_value(nutrients.get("proteinContent"))
    sugar = parse_nutrition_value(nutrients.get("sugarContent"))
    sodium = parse_nutrition_value(nutrients.get("sodiumContent"))

    # Get yields for serving info
    try:
        yields = scraper.yields()
    except Exception:
        yields = ""

    # Determine if nutrition is per-serving or total
    # Most blogs provide per-serving nutrition, and yield ~2-4 servings per pint
    servings = 1
    serving_match = re.search(r"(\d+)\s*serving", str(yields), re.IGNORECASE)
    if serving_match:
        servings = int(serving_match.group(1))

    # Calculate total nutrition for the batch
    total_kcal = kcal * servings
    total_fat = fat * servings
    total_carbs = carbs * servings
    total_protein = protein * servings
    total_sugar = sugar * servings

    # Estimate per-100g (pint = ~473g)
    pint_weight = 473
    per_100g: dict[str, float] = {}
    if total_kcal > 0:
        scale = 100 / pint_weight
        per_100g = {
            "kcal": round(total_kcal * scale, 1),
            "fat": round(total_fat * scale, 1),
            "carbs": round(total_carbs * scale, 1),
            "sugar": round(total_sugar * scale, 1),
            "protein": round(total_protein * scale, 1),
            "salt": 0,
        }
    else:
        per_100g = {"kcal": 0, "fat": 0, "carbs": 0, "sugar": 0, "protein": 0, "salt": 0}

    # Generate slug
    slug = f"{source_id}-" + slugify(title)

    # Extract tags
    tags = extract_blog_tags(title, raw_ingredients)

    # Check scoopability
    all_ings = " ".join(raw_ingredients).lower()
    is_scoopable = "xanthan" in all_ings or "guar" in all_ings

    # Check vegan
    is_vegan = not any(kw in all_ings for kw in [
        "milk", "cream", "yogurt", "cheese", "egg", "whey", "butter", "honey",
    ]) or all(kw in all_ings for kw in ["oat", "almond", "coconut", "soy"])

    # Get description
    try:
        description = scraper.description() or ""
    except Exception:
        description = ""
    if not description:
        description = f"Ninja Creami recipe from {source_id}."
    if len(description) > 300:
        description = description[:297] + "..."

    return {
        "id": slug,
        "name": title,
        "slug": slug,
        "source": source_id,
        "description": description,
        "tags": tags,
        "nutrition": per_100g,
        "nutritionTotal": {
            "weight": pint_weight if total_kcal > 0 else 0,
            "kcal": round(total_kcal, 1),
            "fat": round(total_fat, 1),
            "carbs": round(total_carbs, 1),
            "sugar": round(total_sugar, 1),
            "protein": round(total_protein, 1),
            "salt": 0,
        },
        "fpdf": None,
        "proteinRatio": None,
        "ingredients": ingredients,
        "directions": directions,
        "images": [],
        "rating": None,
        "isScoopable": is_scoopable,
        "isLight": per_100g["kcal"] > 0 and per_100g["kcal"] <= 75,
        "isVegan": is_vegan,
        "isDraft": False,
        "canonicalUrl": url,
    }


def parse_blog_ingredient(text: str) -> dict[str, str] | None:
    """Parse a blog ingredient string like '1 cup whole milk'."""
    if not text or not text.strip():
        return None

    text = text.strip()
    amount = ""
    unit = ""
    name = text
    comment = ""

    # Extract parenthetical comments
    paren = re.search(r"\(([^)]+)\)\s*$", text)
    if paren:
        comment = paren.group(1)
        text = text[:paren.start()].strip()

    # Try to parse: amount unit name
    m = re.match(
        r"^([\d.,/½¼¾⅓⅔]+(?:\s*[-–]\s*[\d.,/]+)?(?:\s+[\d/½¼¾]+)?)"
        r"\s+"
        r"(ounces?|oz|cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lb|grams?|g|ml|mL|"
        r"scoops?|servings?|packets?|slices?|pieces?|pinch(?:es)?|drops?|cans?|containers?|"
        r"[Ff]luid\s+[Oo]unces?)\s*\.?"
        r"\s+(.+)$",
        text,
        re.IGNORECASE,
    )
    if m:
        amount = m.group(1).strip()
        unit = m.group(2).strip().lower()
        name = m.group(3).strip()
    else:
        # Try: amount name (no unit)
        m2 = re.match(r"^([\d.,/½¼¾⅓⅔]+(?:\s*[-–]\s*[\d.,/]+)?)\s+(.+)$", text)
        if m2:
            amount = m2.group(1).strip()
            name = m2.group(2).strip()
        else:
            name = text

    # Clean up name - remove trailing commas, "for mix-in" etc.
    name = re.sub(r",\s*for\s+mix[- ]?ins?$", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r",\s*$", "", name).strip()

    return {
        "amount": amount,
        "unit": unit,
        "name": name,
        "comment": comment,
    }


def extract_blog_tags(title: str, ingredients: list[str]) -> list[str]:
    """Extract tags from blog recipe title and ingredients."""
    tags: list[str] = []
    combined = (title + " " + " ".join(ingredients)).lower()

    if "protein" in combined:
        tags.append("Hi-Protein")
    if any(kw in combined for kw in ["chocolate", "cocoa", "cacao"]):
        tags.append("Chocolate")
    if any(kw in combined for kw in ["strawberry", "berry", "blueberry", "raspberry",
                                      "mango", "banana", "peach", "cherry", "lemon",
                                      "lime", "pineapple", "fruit", "apple"]):
        tags.append("Fruit")
    if any(kw in combined for kw in ["coffee", "espresso", "mocha", "matcha", "latte"]):
        tags.append("Coffee/Tea")
    if any(kw in combined for kw in ["oreo", "cookie", "cake", "pie", "biscoff",
                                      "cheesecake", "brownie", "fudge", "s'more"]):
        tags.append("Dessert-Inspired")
    if "sorbet" in title.lower():
        tags.append("Sorbet")
    if "gelato" in title.lower():
        tags.append("Gelato")
    if "frozen yogurt" in title.lower() or "froyo" in title.lower():
        tags.append("Frozen Yogurt")
    if "low cal" in combined or "low-cal" in combined or "lite" in combined:
        tags.append("Low-Cal")

    return list(dict.fromkeys(tags))


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def normalize_for_dedup(name: str) -> str:
    """Normalize a recipe name for deduplication."""
    s = name.lower()
    # Remove common prefixes/suffixes
    s = re.sub(r"ninja creami\s+", "", s)
    s = re.sub(r"\s+ninja creami", "", s)
    s = re.sub(r"\s+recipe$", "", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return s


def deduplicate_recipes(
    new_recipes: list[dict[str, Any]],
    existing_recipes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Remove recipes that are too similar to existing ones."""
    existing_names = {normalize_for_dedup(r["name"]) for r in existing_recipes}
    existing_slugs = {r["slug"] for r in existing_recipes}
    existing_urls = {r.get("canonicalUrl") for r in existing_recipes if r.get("canonicalUrl")}

    deduped: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()
    seen_names: set[str] = set()

    for recipe in new_recipes:
        slug = recipe["slug"]
        norm_name = normalize_for_dedup(recipe["name"])
        url = recipe.get("canonicalUrl")

        if slug in existing_slugs or slug in seen_slugs:
            continue
        if norm_name in existing_names or norm_name in seen_names:
            continue
        if url and url in existing_urls:
            continue
        if len(recipe["name"]) < 4:
            continue

        seen_slugs.add(slug)
        seen_names.add(norm_name)
        deduped.append(recipe)

    return deduped


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Blog Recipe Scraper (Schema.org / recipe-scrapers)")
    print("=" * 60)

    all_blog_recipes: list[dict[str, Any]] = []

    for source in BLOG_SOURCES:
        name = source["name"]
        source_id = source["source_id"]
        print(f"\n{'─' * 40}")
        print(f"Scraping: {name} ({source_id})")
        print(f"{'─' * 40}")

        # Discover URLs
        print("  Discovering recipe URLs...")
        urls = discover_recipe_urls(source)
        print(f"  Found {len(urls)} recipe URLs")

        # Scrape each recipe
        recipes: list[dict[str, Any]] = []
        errors: list[str] = []

        for i, url in enumerate(urls):
            print(f"  [{i+1}/{len(urls)}] {url.split('/')[-2] if url.endswith('/') else url.split('/')[-1]}")
            try:
                recipe = scrape_recipe(url, source_id)
                if recipe:
                    recipes.append(recipe)
                else:
                    errors.append(f"No recipe data: {url}")
            except Exception as e:
                errors.append(f"{url}: {e}")
            time.sleep(RATE_LIMIT_DELAY)

        print(f"  Scraped {len(recipes)} recipes from {name}")
        if errors:
            print(f"  Errors ({len(errors)}):")
            for err in errors[:5]:
                print(f"    - {err}")

        all_blog_recipes.extend(recipes)

    print(f"\n{'=' * 60}")
    print(f"Total blog recipes scraped: {len(all_blog_recipes)}")

    # Merge with existing
    print("\nMerging with existing recipes...")
    if not RECIPES_JSON.exists():
        print(f"ERROR: {RECIPES_JSON} not found.")
        sys.exit(1)

    existing = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))

    # Remove old blog recipes (in case of re-run) - keep jhermann, fpf, and reddit
    blog_source_ids = {s["source_id"] for s in BLOG_SOURCES}
    non_blog = [r for r in existing if r.get("source") not in blog_source_ids]

    deduped = deduplicate_recipes(all_blog_recipes, non_blog)
    print(f"After dedup: {len(deduped)} new recipes (removed {len(all_blog_recipes) - len(deduped)} duplicates)")

    merged = non_blog + deduped
    merged.sort(key=lambda r: r["name"].lower())

    RECIPES_JSON.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Validation
    sources: dict[str, int] = {}
    for r in merged:
        src = r.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    print(f"\nMerged: {len(merged)} total recipes")
    print("Sources:")
    for src, count in sorted(sources.items()):
        print(f"  {src}: {count}")

    # Quality stats
    blog_recipes = [r for r in merged if r.get("source") in blog_source_ids]
    has_nutrition = sum(1 for r in blog_recipes if r["nutrition"]["kcal"] > 0)
    has_directions = sum(1 for r in blog_recipes if r["directions"])

    print(f"\nBlog Recipe Quality ({len(blog_recipes)} recipes):")
    print(f"  With nutrition: {has_nutrition}")
    print(f"  With directions: {has_directions}")

    print(f"\nOutput: {RECIPES_JSON}")


if __name__ == "__main__":
    main()
