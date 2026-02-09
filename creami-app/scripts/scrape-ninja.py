"""
scrape-ninja.py

Scrapes Ninja Creami recipes from SharkNinja's official recipe database
(sharkninja.com) using the Demandware pagination API and Schema.org JSON-LD
structured data.

NinjaTestKitchen.com redirects to sharkninja.com, so both sources are covered
by scraping the single `recipes_creami` category (485 recipes). The 93
"Ninja Swirl by CREAMi" recipes are a subset of this category.

Merges scraped recipes into the existing recipes.json alongside other sources.

Usage:
    python scripts/scrape-ninja.py

Requires: recipe-scrapers, requests, beautifulsoup4
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from html import unescape
from pathlib import Path
from typing import Any

try:
    from recipe_scrapers import scrape_html
except ImportError:
    print("ERROR: recipe-scrapers not installed. Run: pip install recipe-scrapers")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
RECIPES_JSON = APP_DIR / "src" / "data" / "recipes.json"
NINJA_URL_CACHE = SCRIPT_DIR / "ninja-url-cache.json"
NINJA_RECIPE_CACHE = SCRIPT_DIR / "ninja-recipe-cache.json"

# ---------------------------------------------------------------------------
# HTTP config
# ---------------------------------------------------------------------------
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
RATE_LIMIT_DELAY = 0.5  # seconds between requests
REQUEST_TIMEOUT = 20

# ---------------------------------------------------------------------------
# SharkNinja Demandware API
# ---------------------------------------------------------------------------
DEMANDWARE_BASE = (
    "https://www.sharkninja.com/on/demandware.store/"
    "Sites-US-SharkNinja-Site/en_US/Search-UpdateRecipeGrid"
)
CREAMI_CGID = "recipes_creami"
SWIRL_CGID = "recipes_ninja_swirl"
PAGE_SIZE = 100

# Source IDs for our schema
SOURCE_NINJA = "ninja"
SLUG_PREFIX = "ninja-"

# Typical Creami pint weight in grams (used for nutrition estimation)
PINT_WEIGHT_G = 473


# ---------------------------------------------------------------------------
# Step 1: URL Discovery
# ---------------------------------------------------------------------------

def fetch_page(url: str, params: dict | None = None) -> str | None:
    """Fetch a web page and return the response text."""
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        full_url = f"{url}?{query}"
    else:
        full_url = url

    req = urllib.request.Request(full_url, headers={"User-Agent": USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT)
        return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    Error fetching {full_url[:100]}: {e}")
        return None


def discover_recipe_urls(cgid: str = CREAMI_CGID) -> list[str]:
    """Discover all recipe URLs from a SharkNinja recipe category via the
    Demandware pagination API.

    Returns a sorted list of full URLs like:
        https://www.sharkninja.com/cookies-cream-ice-cream/REC3603.html
    """
    all_paths: set[str] = set()

    for start in range(0, 2000, PAGE_SIZE):
        params = {
            "cgid": cgid,
            "prefn1": "productType",
            "prefv1": "recipe",
            "prefn2": "showInWebShop",
            "prefv2": "true",
            "start": str(start),
            "sz": str(PAGE_SIZE),
        }

        html = fetch_page(DEMANDWARE_BASE, params)
        if not html:
            print(f"  Failed to fetch page at start={start}, stopping.")
            break

        # Extract recipe paths: href="/recipe-slug/RECXXXX.html"
        links = set(re.findall(r'href="(/[^"]+/REC\d+\.html)"', html))
        new_links = links - all_paths
        all_paths.update(links)

        print(f"  Page start={start}: {len(links)} links, {len(new_links)} new, total={len(all_paths)}")

        if not new_links:
            break

        time.sleep(RATE_LIMIT_DELAY)

    # Convert to full URLs
    urls = sorted(
        f"https://www.sharkninja.com{unescape(path)}" for path in all_paths
    )
    return urls


def discover_swirl_urls() -> set[str]:
    """Discover Ninja Swirl by CREAMi recipe URLs (subset of creami).

    Used to tag recipes that belong to the Ninja Swirl sub-brand.
    """
    swirl_paths: set[str] = set()

    for start in range(0, 500, PAGE_SIZE):
        params = {
            "cgid": SWIRL_CGID,
            "prefn1": "productType",
            "prefv1": "recipe",
            "prefn2": "showInWebShop",
            "prefv2": "true",
            "start": str(start),
            "sz": str(PAGE_SIZE),
        }

        html = fetch_page(DEMANDWARE_BASE, params)
        if not html:
            break

        links = set(re.findall(r'href="(/[^"]+/REC\d+\.html)"', html))
        new_links = links - swirl_paths
        swirl_paths.update(links)

        if not new_links:
            break

        time.sleep(RATE_LIMIT_DELAY)

    return {
        f"https://www.sharkninja.com{unescape(path)}" for path in swirl_paths
    }


def load_url_cache() -> dict[str, Any] | None:
    """Load cached URL discovery results."""
    if NINJA_URL_CACHE.exists():
        try:
            data = json.loads(NINJA_URL_CACHE.read_text(encoding="utf-8"))
            print(f"Loaded URL cache: {len(data.get('creami_urls', []))} creami, "
                  f"{len(data.get('swirl_urls', []))} swirl")
            return data
        except (json.JSONDecodeError, KeyError):
            pass
    return None


def save_url_cache(creami_urls: list[str], swirl_urls: set[str]) -> None:
    """Save URL discovery results to cache."""
    data = {
        "creami_urls": creami_urls,
        "swirl_urls": sorted(swirl_urls),
    }
    NINJA_URL_CACHE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Saved URL cache: {len(creami_urls)} creami, {len(swirl_urls)} swirl")


# ---------------------------------------------------------------------------
# Step 2: Recipe Scraping
# ---------------------------------------------------------------------------

def strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    return soup.get_text(separator=" ").strip()


def extract_jsonld_recipe(html: str) -> dict[str, Any] | None:
    """Extract the Recipe JSON-LD from a page's HTML."""
    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue

        if isinstance(data, dict) and data.get("@type") == "Recipe":
            return data
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("@type") == "Recipe":
                    return item
    return None


def parse_jsonld_ingredient(raw: str) -> dict[str, str]:
    """Parse a single ingredient from SharkNinja JSON-LD.

    Raw format: '<strong class="mr-3">1 tablespoon</strong> cream cheese, softened'

    Returns: {"amount": "1", "unit": "tablespoon", "name": "cream cheese", "comment": "softened"}
    """
    # Strip HTML to get clean text with proper spacing
    # The <strong> tag contains the amount+unit
    amount = ""
    unit = ""
    name = raw
    comment = ""

    # Extract amount+unit from the <strong> tag
    strong_match = re.search(r"<strong[^>]*>(.*?)</strong>", raw)
    if strong_match:
        amount_unit = strip_html(strong_match.group(1)).strip()
        rest = strip_html(raw[strong_match.end():]).strip()
    else:
        # No strong tag - try plain text parsing
        cleaned = strip_html(raw).strip()
        amount_unit = ""
        rest = cleaned

    if amount_unit:
        # Parse amount and unit from the extracted amount_unit string
        # Examples: "1 tablespoon", "1/3 cup", "3", "1 1/2 cups"
        unit_pattern = (
            r"(tablespoons?|tbsp|teaspoons?|tsp|cups?|ounces?|oz|"
            r"pounds?|lbs?|grams?|g|ml|mL|pinch(?:es)?|scoops?|"
            r"packets?|slices?|pieces?|drops?|cans?|containers?|"
            r"dashes?|sprigs?|stalks?|cloves?|bunche?s?|heads?|"
            r"sticks?|bars?|bags?|boxes?|bottles?|jars?|quarts?|"
            r"pints?|gallons?|liters?|handfuls?)"
        )
        m = re.match(
            r"^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-–+]\s*[\d\s.,/½¼¾]+)?)\s+"
            + unit_pattern + r"\s*$",
            amount_unit,
            re.IGNORECASE,
        )
        if m:
            amount = m.group(1).strip()
            unit = m.group(2).strip().lower()
        else:
            # Might be just a number with no unit (e.g., "3" for "3 cookies")
            num_match = re.match(
                r"^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-–+]\s*[\d\s.,/½¼¾]+)?)\s*$",
                amount_unit,
            )
            if num_match:
                amount = num_match.group(1).strip()
            else:
                # Try splitting on last number boundary
                parts = re.match(
                    r"^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-–+]\s*[\d\s.,/½¼¾]+)?)\s+(.+)$",
                    amount_unit,
                )
                if parts:
                    amount = parts.group(1).strip()
                    unit = parts.group(2).strip().lower()
                else:
                    # Give up, treat entire thing as amount
                    amount = amount_unit
    else:
        # No strong tag. Try parsing the plain text.
        m = re.match(
            r"^([\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-–]\s*[\d.,/]+)?(?:\s+[\d/½¼¾]+)?)"
            r"\s+"
            r"(ounces?|oz|cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|"
            r"grams?|g|ml|mL|scoops?|servings?|packets?|slices?|pieces?|"
            r"pinch(?:es)?|drops?|cans?|containers?)\s*\.?"
            r"\s+(.+)$",
            rest,
            re.IGNORECASE,
        )
        if m:
            amount = m.group(1).strip()
            unit = m.group(2).strip().lower()
            rest = m.group(3).strip()
        else:
            m2 = re.match(
                r"^([\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-–]\s*[\d.,/]+)?)\s+(.+)$",
                rest,
            )
            if m2:
                amount = m2.group(1).strip()
                rest = m2.group(2).strip()

    # The remaining text is the ingredient name, possibly with a comment
    if rest:
        # Extract trailing comment after comma: "cream cheese, softened"
        comma_match = re.match(r"^(.+?),\s+(.*?)$", rest)
        if comma_match:
            candidate_name = comma_match.group(1).strip()
            candidate_comment = comma_match.group(2).strip()
            # Only treat as comment if it looks like a modifier, not part of the name
            # e.g., "cream cheese, softened" -> comment="softened"
            # but "chocolate chips, mini" -> comment="mini"
            # and NOT "salt and pepper, to taste" splitting wrong
            if len(candidate_comment.split()) <= 6:
                name = candidate_name
                comment = candidate_comment
            else:
                name = rest
        else:
            name = rest

    # Clean up parenthetical comments at the end of name
    paren_match = re.search(r"\(([^)]+)\)\s*$", name)
    if paren_match:
        inner = paren_match.group(1)
        # Check if it's a quantity note vs an actual comment
        is_quantity = bool(re.match(
            r"^[\d.½¼¾⅓⅔/]+\s*(?:tsp|tbsp|cup|scoop|drop)",
            inner, re.IGNORECASE,
        ))
        if not is_quantity:
            if comment:
                comment = f"{comment}; {inner}"
            else:
                comment = inner
            name = name[:paren_match.start()].strip()

    # Clean name: remove "for mix-in" suffix
    name = re.sub(r",?\s*for\s+mix[- ]?ins?\s*$", "", name, flags=re.IGNORECASE).strip()

    return {
        "amount": amount,
        "unit": unit,
        "name": name,
        "comment": comment,
    }


def parse_nutrition_value(text: str | None) -> float:
    """Extract a numeric value from a nutrition string like '235 kcal'."""
    if not text:
        return 0
    m = re.search(r"([\d.]+)", str(text))
    return float(m.group(1)) if m else 0


def scrape_single_recipe(url: str) -> dict[str, Any] | None:
    """Scrape a single recipe page from sharkninja.com.

    Tries JSON-LD first for structured data, falls back to recipe-scrapers.
    Returns raw scraped data (not yet mapped to our schema).
    """
    html = fetch_page(url)
    if not html:
        return None

    # ----- JSON-LD extraction (preferred) -----
    jsonld = extract_jsonld_recipe(html)

    title = ""
    description = ""
    raw_ingredients: list[str] = []
    instructions: list[str] = []
    image = ""
    yields = ""
    nutrients: dict[str, Any] = {}

    if jsonld:
        title = strip_html(jsonld.get("name", ""))
        description = strip_html(jsonld.get("description", ""))
        raw_ingredients = jsonld.get("recipeIngredient", [])
        image_field = jsonld.get("image", "")
        if isinstance(image_field, list) and image_field:
            image = image_field[0]
        elif isinstance(image_field, str):
            image = image_field

        # Instructions
        raw_instr = jsonld.get("recipeInstructions", [])
        for inst in raw_instr:
            if isinstance(inst, dict):
                text = strip_html(inst.get("text", ""))
            else:
                text = strip_html(str(inst))
            if text:
                instructions.append(text)

        yields = str(jsonld.get("recipeYield", ""))
        nutrients = jsonld.get("nutrition", {})
        if isinstance(nutrients, dict) and nutrients.get("@type") == "NutritionInformation":
            pass  # Keep it
        else:
            nutrients = {}

    # ----- Fallback: recipe-scrapers -----
    if not title:
        try:
            scraper = scrape_html(html, org_url=url, wild_mode=True)
            title = scraper.title() or ""
            if not description:
                description = scraper.description() or ""
            if not raw_ingredients:
                raw_ingredients = scraper.ingredients() or []
            if not instructions:
                instructions = scraper.instructions_list() or []
            if not image:
                image = scraper.image() or ""
            if not yields:
                yields = scraper.yields() or ""
            if not nutrients:
                nutrients = scraper.nutrients() or {}
        except Exception as e:
            print(f"    Scraper fallback error: {e}")

    if not title:
        return None

    return {
        "url": url,
        "title": title,
        "description": description,
        "raw_ingredients": raw_ingredients,
        "instructions": instructions,
        "image": image,
        "yields": yields,
        "nutrients": nutrients,
    }


def load_recipe_cache() -> dict[str, dict[str, Any]]:
    """Load cached scraped recipe data, keyed by URL."""
    if NINJA_RECIPE_CACHE.exists():
        try:
            data = json.loads(NINJA_RECIPE_CACHE.read_text(encoding="utf-8"))
            print(f"Loaded recipe cache: {len(data)} entries")
            return data
        except (json.JSONDecodeError, KeyError):
            pass
    return {}


def save_recipe_cache(cache: dict[str, dict[str, Any]]) -> None:
    """Save scraped recipe data to cache."""
    NINJA_RECIPE_CACHE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Step 3: Schema Mapping
# ---------------------------------------------------------------------------

def slugify(name: str) -> str:
    """Generate a URL-safe slug."""
    s = name.lower()
    s = re.sub(r"['''\u2018\u2019\u201c\u201d]", "", s)
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.replace("+", "-").replace("&", "-and-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s


FRUIT_WORDS = {
    "strawberry", "berry", "blueberry", "raspberry", "blackberry",
    "mango", "banana", "peach", "cherry", "lemon", "lime", "pineapple",
    "fruit", "apple", "orange", "coconut", "watermelon", "grape",
    "cranberry", "pomegranate", "acai", "passion fruit", "guava",
    "papaya", "kiwi", "melon", "cantaloupe", "honeydew", "fig",
    "plum", "pear", "apricot", "nectarine", "tangerine", "grapefruit",
    "dragonfruit", "lychee",
}

DESSERT_WORDS = {
    "cake", "cookie", "cookies", "pie", "brownie", "brownies",
    "cheesecake", "fudge", "s'more", "smores", "cupcake", "tiramisu",
    "churro", "biscoff", "oreo", "waffle", "donut", "doughnut",
    "cannoli", "creme brulee", "pudding", "trifle", "cobbler",
    "crisp", "crumble", "snickerdoodle", "macaron", "eclair",
    "praline", "truffle", "tart", "pastry", "baklava",
}

COFFEE_TEA_WORDS = {
    "coffee", "espresso", "mocha", "matcha", "latte", "cappuccino",
    "cold brew", "chai", "tea",
}

CHOCOLATE_WORDS = {"chocolate", "cocoa", "cacao", "choco"}

DAIRY_KEYWORDS = {
    "milk", "cream", "yogurt", "cheese", "egg", "whey", "butter",
    "honey", "casein", "ghee", "custard", "pudding mix",
}

NON_DAIRY_QUALIFIERS = {
    "oat milk", "almond milk", "coconut milk", "soy milk",
    "cashew milk", "oat cream", "coconut cream", "vegan",
    "dairy-free", "dairy free", "non-dairy", "plant-based",
}


def extract_tags(title: str, ingredients_text: str) -> list[str]:
    """Extract tags based on title and ingredient keywords."""
    tags: list[str] = []
    combined = (title + " " + ingredients_text).lower()

    # Protein check
    if "protein" in combined:
        tags.append("Hi-Protein")

    # Chocolate
    if any(kw in combined for kw in CHOCOLATE_WORDS):
        tags.append("Chocolate")

    # Fruit
    if any(kw in combined for kw in FRUIT_WORDS):
        tags.append("Fruit")

    # Coffee/Tea
    if any(kw in combined for kw in COFFEE_TEA_WORDS):
        tags.append("Coffee/Tea")

    # Dessert-Inspired
    if any(kw in combined for kw in DESSERT_WORDS):
        tags.append("Dessert-Inspired")

    # Sorbet
    if "sorbet" in title.lower():
        tags.append("Sorbet")

    # Gelato
    if "gelato" in title.lower():
        tags.append("Gelato")

    # Frozen Yogurt
    if "frozen yogurt" in title.lower() or "froyo" in title.lower():
        tags.append("Frozen Yogurt")

    # Low-Cal
    if "lite " in title.lower() or "light " in title.lower() or "low cal" in combined:
        tags.append("Low-Cal")

    return list(dict.fromkeys(tags))  # preserve order, remove dupes


def check_vegan(ingredients_text: str) -> bool:
    """Check if a recipe appears to be vegan based on ingredients."""
    lower = ingredients_text.lower()

    # If it explicitly mentions non-dairy qualifiers, more likely vegan
    has_non_dairy = any(q in lower for q in NON_DAIRY_QUALIFIERS)

    # Check for dairy keywords
    has_dairy = False
    for kw in DAIRY_KEYWORDS:
        if kw in lower:
            # Check if it's qualified by a non-dairy prefix
            # e.g. "oat milk" should not trigger "milk"
            idx = lower.find(kw)
            prefix = lower[max(0, idx - 15):idx]
            if any(nq.split()[0] in prefix for nq in NON_DAIRY_QUALIFIERS
                   if " " in nq):
                continue
            has_dairy = True
            break

    return not has_dairy


def map_to_recipe_schema(
    raw: dict[str, Any],
    is_swirl: bool = False,
) -> dict[str, Any] | None:
    """Map raw scraped data to our unified recipe schema."""
    title = raw["title"]
    url = raw["url"]

    if not title or len(title) < 3:
        return None

    slug = SLUG_PREFIX + slugify(title)

    # Parse ingredients
    base_items: list[dict[str, str]] = []
    mixin_items: list[dict[str, str]] = []
    in_mixins = False

    for raw_ing in raw["raw_ingredients"]:
        parsed = parse_jsonld_ingredient(raw_ing)
        if not parsed or not parsed["name"]:
            continue

        # Detect mix-in items by name pattern
        name_lower = parsed["name"].lower()
        comment_lower = parsed["comment"].lower()
        if ("mix-in" in name_lower or "mix-in" in comment_lower
                or "for mix-in" in comment_lower
                or "mix in" in name_lower):
            in_mixins = True
        if "topping" in name_lower or "topping" in comment_lower:
            in_mixins = True

        if in_mixins:
            mixin_items.append(parsed)
        else:
            base_items.append(parsed)

    # Build ingredient groups
    ingredients: list[dict[str, Any]] = []
    if base_items:
        ingredients.append({"step": "Base", "items": base_items})
    if mixin_items:
        ingredients.append({"step": "Mix-ins", "items": mixin_items})

    if not ingredients:
        return None

    # Instructions
    directions = [inst.strip() for inst in raw["instructions"] if inst.strip()]

    # Nutrition - SharkNinja recipes mostly don't have nutrition data
    nutrients = raw.get("nutrients", {})
    kcal = parse_nutrition_value(nutrients.get("calories"))
    fat = parse_nutrition_value(nutrients.get("fatContent"))
    carbs = parse_nutrition_value(nutrients.get("carbohydrateContent"))
    protein = parse_nutrition_value(nutrients.get("proteinContent"))
    sugar = parse_nutrition_value(nutrients.get("sugarContent"))
    sodium = parse_nutrition_value(nutrients.get("sodiumContent"))

    # Yields for serving calculation
    servings = 1
    yields_str = raw.get("yields", "")
    serving_match = re.search(r"(\d+)\s*serving", str(yields_str), re.IGNORECASE)
    if serving_match:
        servings = int(serving_match.group(1))

    total_kcal = kcal * servings
    total_fat = fat * servings
    total_carbs = carbs * servings
    total_protein = protein * servings
    total_sugar = sugar * servings

    # Per-100g nutrition
    per_100g: dict[str, float]
    if total_kcal > 0:
        scale = 100 / PINT_WEIGHT_G
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

    # Description
    description = raw.get("description", "")
    if description:
        # Clean up CREAMi prep tips and marketing text
        # Take only the first meaningful sentence
        desc_clean = re.sub(r"CREAMi PREP TIP:.*?(?=\.|$)", "", description, flags=re.DOTALL).strip()
        desc_clean = re.sub(r"\s+", " ", desc_clean).strip()
        if len(desc_clean) > 300:
            desc_clean = desc_clean[:297] + "..."
        if len(desc_clean) < 10:
            desc_clean = f"Official Ninja Creami recipe from SharkNinja."
        description = desc_clean
    else:
        description = f"Official Ninja Creami recipe from SharkNinja."

    # Build ingredient text for tagging
    all_ing_text = " ".join(
        item["name"] for step in ingredients for item in step["items"]
    )

    tags = extract_tags(title, all_ing_text)
    if is_swirl:
        if "Ninja Swirl" not in tags:
            tags.append("Ninja Swirl")

    is_vegan = check_vegan(all_ing_text)
    is_light = per_100g["kcal"] > 0 and per_100g["kcal"] <= 75

    # Protein ratio tag
    if per_100g["protein"] > 5:
        if "Hi-Protein" not in tags:
            tags.append("Hi-Protein")

    # Low-Sugar tag
    if per_100g["sugar"] > 0 and per_100g["sugar"] < 5:
        if "Low-Sugar" not in tags:
            tags.append("Low-Sugar")

    # Dairy-Free / Vegan tags
    if is_vegan:
        if "Dairy-Free" not in tags:
            tags.append("Dairy-Free")

    # Images
    images: list[str] = []
    img = raw.get("image", "")
    if img:
        images.append(img)

    return {
        "id": slug,
        "name": title,
        "slug": slug,
        "source": SOURCE_NINJA,
        "description": description,
        "tags": tags,
        "nutrition": per_100g,
        "nutritionTotal": {
            "weight": PINT_WEIGHT_G if total_kcal > 0 else 0,
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
        "images": images,
        "rating": None,
        "isScoopable": False,
        "isLight": is_light,
        "isVegan": is_vegan,
        "isDraft": False,
        "canonicalUrl": url,
    }


# ---------------------------------------------------------------------------
# Step 4: Deduplication & Merge
# ---------------------------------------------------------------------------

def normalize_for_dedup(name: str) -> str:
    """Normalize a recipe name for deduplication."""
    s = name.lower()
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
    existing_urls = {
        r.get("canonicalUrl") for r in existing_recipes if r.get("canonicalUrl")
    }

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
    print("SharkNinja Creami Recipe Scraper")
    print("=" * 60)

    # ---- Step 1: URL Discovery ----
    print("\n--- Step 1: URL Discovery ---")

    url_cache = load_url_cache()
    if url_cache:
        creami_urls = url_cache["creami_urls"]
        swirl_urls = set(url_cache.get("swirl_urls", []))
        print(f"Using cached URLs: {len(creami_urls)} creami, {len(swirl_urls)} swirl")
    else:
        print("Discovering Creami recipe URLs...")
        creami_urls = discover_recipe_urls(CREAMI_CGID)
        print(f"Found {len(creami_urls)} Creami recipe URLs")

        print("\nDiscovering Ninja Swirl recipe URLs...")
        swirl_urls = discover_swirl_urls()
        print(f"Found {len(swirl_urls)} Ninja Swirl recipe URLs")

        save_url_cache(creami_urls, swirl_urls)

    # ---- Step 2: Scrape individual recipes ----
    print(f"\n--- Step 2: Scraping {len(creami_urls)} recipes ---")

    recipe_cache = load_recipe_cache()
    to_scrape = [url for url in creami_urls if url not in recipe_cache]
    already_cached = len(creami_urls) - len(to_scrape)

    if already_cached > 0:
        print(f"Already cached: {already_cached}, to scrape: {len(to_scrape)}")

    errors: list[str] = []
    save_interval = 25  # Save cache every N recipes

    for i, url in enumerate(to_scrape):
        short_name = url.split("/")[-2] if "/REC" in url else url.split("/")[-1]
        print(f"  [{already_cached + i + 1}/{len(creami_urls)}] {short_name}")

        try:
            raw = scrape_single_recipe(url)
            if raw:
                recipe_cache[url] = raw
            else:
                errors.append(f"No data: {url}")
                recipe_cache[url] = {"url": url, "title": "", "error": "no data"}
        except Exception as e:
            errors.append(f"{url}: {e}")
            recipe_cache[url] = {"url": url, "title": "", "error": str(e)}

        # Periodic cache save
        if (i + 1) % save_interval == 0:
            save_recipe_cache(recipe_cache)
            print(f"    (cache saved: {len(recipe_cache)} entries)")

        time.sleep(RATE_LIMIT_DELAY)

    # Final cache save
    if to_scrape:
        save_recipe_cache(recipe_cache)
        print(f"Cache saved: {len(recipe_cache)} entries")

    # ---- Step 3: Map to schema ----
    print(f"\n--- Step 3: Mapping to schema ---")

    ninja_recipes: list[dict[str, Any]] = []
    skipped: list[str] = []

    for url in creami_urls:
        raw = recipe_cache.get(url)
        if not raw or not raw.get("title"):
            skipped.append(url)
            continue

        is_swirl = url in swirl_urls
        recipe = map_to_recipe_schema(raw, is_swirl=is_swirl)
        if recipe:
            ninja_recipes.append(recipe)
        else:
            skipped.append(url)

    print(f"Mapped {len(ninja_recipes)} recipes to schema")
    if skipped:
        print(f"Skipped {len(skipped)} (no parseable data)")

    # ---- Step 4: Merge ----
    print(f"\n--- Step 4: Merging with existing recipes ---")

    if not RECIPES_JSON.exists():
        print(f"ERROR: {RECIPES_JSON} not found.")
        sys.exit(1)

    existing = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))

    # Remove old ninja recipes (in case of re-run)
    non_ninja = [r for r in existing if r.get("source") not in (SOURCE_NINJA,)]
    print(f"Existing non-ninja recipes: {len(non_ninja)}")

    # Deduplicate against existing recipes from other sources
    deduped = deduplicate_recipes(ninja_recipes, non_ninja)
    removed = len(ninja_recipes) - len(deduped)
    print(f"After dedup: {len(deduped)} new recipes (removed {removed} duplicates)")

    merged = non_ninja + deduped
    merged.sort(key=lambda r: r["name"].lower())

    RECIPES_JSON.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # ---- Stats ----
    print(f"\n{'=' * 60}")
    print("RESULTS")
    print(f"{'=' * 60}")

    sources: dict[str, int] = {}
    for r in merged:
        src = r.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    print(f"\nTotal recipes: {len(merged)}")
    print("By source:")
    for src, count in sorted(sources.items()):
        print(f"  {src}: {count}")

    # Quality stats for ninja recipes
    ninja_in_merged = [r for r in merged if r.get("source") == SOURCE_NINJA]
    has_nutrition = sum(1 for r in ninja_in_merged if r["nutrition"]["kcal"] > 0)
    has_directions = sum(1 for r in ninja_in_merged if r["directions"])
    has_ingredients = sum(1 for r in ninja_in_merged if r["ingredients"])
    has_images = sum(1 for r in ninja_in_merged if r["images"])
    is_swirl_count = sum(1 for r in ninja_in_merged if "Ninja Swirl" in r.get("tags", []))

    print(f"\nNinja Recipe Quality ({len(ninja_in_merged)} recipes):")
    print(f"  With ingredients: {has_ingredients}")
    print(f"  With directions:  {has_directions}")
    print(f"  With nutrition:   {has_nutrition}")
    print(f"  With images:      {has_images}")
    print(f"  Ninja Swirl:      {is_swirl_count}")

    # Tag distribution
    tag_counts: dict[str, int] = {}
    for r in ninja_in_merged:
        for tag in r.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    if tag_counts:
        print(f"\nTag distribution:")
        for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
            print(f"  {tag}: {count}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for err in errors[:10]:
            print(f"  - {err}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")

    print(f"\nOutput: {RECIPES_JSON}")


if __name__ == "__main__":
    main()
