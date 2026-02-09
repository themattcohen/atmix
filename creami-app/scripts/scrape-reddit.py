"""
scrape-reddit.py

Scrapes r/ninjacreami "Recipe-Post" flair posts from Reddit's public JSON API
and outputs them in the unified recipe format.

Merges Reddit recipes into the existing recipes.json alongside other sources.

Usage:
    python scripts/scrape-reddit.py

No API keys required - uses Reddit's public .json endpoints.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
RECIPES_JSON = APP_DIR / "src" / "data" / "recipes.json"
REDDIT_CACHE = SCRIPT_DIR / "reddit-cache.json"

# ---------------------------------------------------------------------------
# Reddit config
# ---------------------------------------------------------------------------
SUBREDDIT = "ninjacreami"
USER_AGENT = "Mozilla/5.0 ninjacreami-recipe-scraper/1.0"
RATE_LIMIT_DELAY = 2.0  # seconds between requests
MAX_PAGES = 10  # 100 posts per page = 1000 max


# ---------------------------------------------------------------------------
# Step 1: Fetch all Recipe-Post flair posts
# ---------------------------------------------------------------------------

def fetch_recipe_posts() -> list[dict[str, Any]]:
    """Paginate through r/ninjacreami Recipe-Post flair posts."""
    cache: list[dict[str, Any]] = []
    if REDDIT_CACHE.exists():
        cache = json.loads(REDDIT_CACHE.read_text(encoding="utf-8"))
        print(f"Loaded {len(cache)} cached Reddit posts")
        # Only re-fetch if cache is old or empty
        if len(cache) > 200:
            return cache

    all_posts: list[dict[str, Any]] = []
    after: str | None = None

    for page in range(MAX_PAGES):
        url = (
            f"https://www.reddit.com/r/{SUBREDDIT}/search.json"
            f"?q=flair%3ARecipe-Post&restrict_sr=1&sort=new&t=all&limit=100"
        )
        if after:
            url += f"&after={after}"

        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            resp = urllib.request.urlopen(req, timeout=20)
            data = json.loads(resp.read())
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            break

        children = data["data"]["children"]
        if not children:
            break

        for c in children:
            d = c["data"]
            all_posts.append({
                "id": d["id"],
                "title": d.get("title", ""),
                "selftext": d.get("selftext", ""),
                "score": d.get("score", 0),
                "num_comments": d.get("num_comments", 0),
                "created_utc": d.get("created_utc", 0),
                "permalink": d.get("permalink", ""),
                "url": d.get("url", ""),
                "flair": d.get("link_flair_text", ""),
                "author": d.get("author", ""),
            })

        after = data["data"].get("after")
        print(f"  Page {page + 1}: got {len(children)} posts (total: {len(all_posts)})")

        if not after:
            break
        time.sleep(RATE_LIMIT_DELAY)

    # Also search without flair for posts that have recipe content but different flair
    print("\nSearching for additional recipe posts by keyword...")
    time.sleep(RATE_LIMIT_DELAY)
    existing_ids = {p["id"] for p in all_posts}

    for query in ["recipe ingredients", "protein ice cream recipe"]:
        url = (
            f"https://www.reddit.com/r/{SUBREDDIT}/search.json"
            f"?q={urllib.request.quote(query)}&restrict_sr=1&sort=top&t=all&limit=100"
        )
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            resp = urllib.request.urlopen(req, timeout=20)
            data = json.loads(resp.read())
            for c in data["data"]["children"]:
                d = c["data"]
                if d["id"] not in existing_ids:
                    selftext = d.get("selftext", "")
                    # Only add if it looks like a recipe
                    if has_recipe_content(selftext):
                        all_posts.append({
                            "id": d["id"],
                            "title": d.get("title", ""),
                            "selftext": selftext,
                            "score": d.get("score", 0),
                            "num_comments": d.get("num_comments", 0),
                            "created_utc": d.get("created_utc", 0),
                            "permalink": d.get("permalink", ""),
                            "url": d.get("url", ""),
                            "flair": d.get("link_flair_text", ""),
                            "author": d.get("author", ""),
                        })
                        existing_ids.add(d["id"])
        except Exception as e:
            print(f"  Keyword search error: {e}")
        time.sleep(RATE_LIMIT_DELAY)

    print(f"\nTotal Reddit posts collected: {len(all_posts)}")

    # Save cache
    REDDIT_CACHE.write_text(
        json.dumps(all_posts, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return all_posts


def has_recipe_content(text: str) -> bool:
    """Check if text looks like it contains a recipe."""
    if len(text) < 80:
        return False
    lower = text.lower()
    ingredient_signals = sum([
        "ingredient" in lower,
        "- " in text and any(u in lower for u in ["g ", "ml ", "cup", "tsp", "tbsp", "scoop"]),
        "* " in text and any(u in lower for u in ["g ", "ml ", "cup", "tsp", "tbsp", "scoop"]),
        "xanthan" in lower,
        "protein powder" in lower,
        "fairlife" in lower,
        "almond milk" in lower,
    ])
    return ingredient_signals >= 2


# ---------------------------------------------------------------------------
# Step 2: Parse recipe from Reddit post
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


def clean_title(title: str) -> str:
    """Clean Reddit post title to recipe name."""
    # Remove common Reddit title patterns
    title = re.sub(r"\[.*?\]", "", title)  # Remove [tags] like [Deluxe], [Protein]
    title = re.sub(r"\(.*?\)", "", title)  # Remove (parenthetical notes)
    title = re.sub(r"\s*[🍦🍨🧁🍫🎂☕️😋🔥💪🥄🍪🍓🫐🥭🍌🍑🥥🍒]+\s*", " ", title)  # Remove emoji
    title = re.sub(r"\s*—\s*.*$", "", title)  # Remove "— description" suffixes
    title = re.sub(r"\s*-\s*$", "", title)  # Trailing dash
    title = re.sub(r"&amp;", "&", title)
    title = re.sub(r"\s{2,}", " ", title).strip()
    return title


def extract_tags_from_post(title: str, text: str) -> list[str]:
    """Extract recipe tags from title and text content."""
    tags: list[str] = []
    combined = (title + " " + text).lower()

    # Check for protein content
    if any(kw in combined for kw in ["protein", "hi-protein", "high protein"]):
        tags.append("Hi-Protein")

    # Type tags from title brackets
    bracket_content = re.findall(r"\[([^\]]+)\]", title, re.IGNORECASE)
    for bc in bracket_content:
        bc_lower = bc.lower().strip()
        if "deluxe" in bc_lower:
            tags.append("Deluxe")
        if "protein" in bc_lower and "Hi-Protein" not in tags:
            tags.append("Hi-Protein")
        if "vegan" in bc_lower:
            tags.append("Vegan")
        if "standard" in bc_lower:
            tags.append("Standard")

    # Flavor/category tags
    if any(kw in combined for kw in ["chocolate", "cocoa", "cacao"]):
        tags.append("Chocolate")
    if any(kw in combined for kw in ["strawberry", "berry", "blueberry", "raspberry",
                                      "mango", "banana", "peach", "cherry", "apple",
                                      "lemon", "lime", "pineapple", "fruit"]):
        tags.append("Fruit")
    if any(kw in combined for kw in ["coffee", "espresso", "mocha", "matcha", "latte"]):
        tags.append("Coffee/Tea")
    if any(kw in combined for kw in ["oreo", "cookie", "cake", "pie", "biscoff",
                                      "cheesecake", "brownie", "fudge"]):
        tags.append("Dessert-Inspired")
    if any(kw in combined for kw in ["sorbet"]):
        tags.append("Sorbet")
    if any(kw in combined for kw in ["gelato"]):
        tags.append("Gelato")
    if any(kw in combined for kw in ["frozen yogurt", "froyo"]):
        tags.append("Frozen Yogurt")

    return list(dict.fromkeys(tags))  # Deduplicate preserving order


def parse_nutrition_from_text(text: str) -> dict[str, float]:
    """Extract total nutrition info from Reddit post text."""
    result = {"kcal": 0, "fat": 0, "carbs": 0, "sugar": 0, "protein": 0, "salt": 0}

    # Pattern: "476 cals 52g protein, 42g carbs 22g fat"
    cal_match = re.search(r"(\d+)\s*(?:cals?|calories|kcal)\b", text, re.IGNORECASE)
    if cal_match:
        result["kcal"] = float(cal_match.group(1))

    # Pattern: "52g protein" or "protein: 52g"
    prot_match = re.search(r"(\d+\.?\d*)g?\s*(?:of\s+)?protein", text, re.IGNORECASE)
    if not prot_match:
        prot_match = re.search(r"protein[:\s]+(\d+\.?\d*)g?", text, re.IGNORECASE)
    if prot_match:
        result["protein"] = float(prot_match.group(1))

    # Pattern: "42g carbs"
    carb_match = re.search(r"(\d+\.?\d*)g?\s*(?:of\s+)?carbs?", text, re.IGNORECASE)
    if not carb_match:
        carb_match = re.search(r"carbs?[:\s]+(\d+\.?\d*)g?", text, re.IGNORECASE)
    if carb_match:
        result["carbs"] = float(carb_match.group(1))

    # Pattern: "22g fat"
    fat_match = re.search(r"(\d+\.?\d*)g?\s*(?:of\s+)?fat\b", text, re.IGNORECASE)
    if not fat_match:
        fat_match = re.search(r"fat[:\s]+(\d+\.?\d*)g?", text, re.IGNORECASE)
    if fat_match:
        result["fat"] = float(fat_match.group(1))

    # Macro pattern: "C: 37g F: 4g P: 21g"
    macro = re.search(r"C[:\s]+(\d+)g?\s*,?\s*F[:\s]+(\d+)g?\s*,?\s*P[:\s]+(\d+)g?", text)
    if macro:
        result["carbs"] = float(macro.group(1))
        result["fat"] = float(macro.group(2))
        result["protein"] = float(macro.group(3))

    return result


def parse_ingredients_from_text(text: str) -> list[dict[str, Any]]:
    """Extract ingredient lists from Reddit post text."""
    ingredients: list[dict[str, Any]] = []
    base_items: list[dict[str, str]] = []
    mixin_items: list[dict[str, str]] = []
    topping_items: list[dict[str, str]] = []

    current_section = "base"
    lines = text.split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        lower = line.lower()

        # Detect section headers
        if re.match(r"^(?:\*\*)?(?:mix[- ]?ins?|mix-in\s*ingredients?)[:\s]*(?:\*\*)?$", lower):
            current_section = "mixin"
            continue
        if re.match(r"^(?:\*\*)?(?:toppings?|topping\s*ingredients?)[:\s]*(?:\*\*)?$", lower):
            current_section = "topping"
            continue
        if re.match(r"^(?:\*\*)?(?:ingredients?\s*(?:for\s+(?:creami|base|ice cream))?)[:\s]*(?:\*\*)?$", lower):
            current_section = "base"
            continue
        if re.match(r"^(?:\*\*)?(?:ingredients?\s*for\s+(?:chocolate\s+)?(?:drizzle|sauce|swirl|mix[- ]?in))[:\s]*(?:\*\*)?$", lower):
            current_section = "mixin"
            continue

        # Detect end of ingredients
        if re.match(r"^(?:\*\*)?(?:directions?|instructions?|steps?|method|process|how to)[:\s]*(?:\*\*)?$", lower):
            break
        if re.match(r"^\d+\.\s+", line) and not re.match(r"^\d+g?\s", line):
            # Numbered instruction step (not an ingredient like "14g cocoa")
            if base_items or mixin_items:
                break

        # Parse ingredient line (starts with -, *, or •)
        ingredient_match = re.match(r"^[\-\*\u2022]\s+(.+)$", line)
        if not ingredient_match:
            # Also try lines that start with amounts directly (no bullet)
            if re.match(r"^[\d~]+(?:\.?\d*)?\s*(?:g|ml|oz|cups?|tbsp|tsp|scoop)", line, re.IGNORECASE):
                ingredient_match = re.match(r"^(.+)$", line)

        if ingredient_match:
            parsed = parse_single_ingredient(ingredient_match.group(1).strip())
            if parsed:
                if current_section == "mixin":
                    mixin_items.append(parsed)
                elif current_section == "topping":
                    topping_items.append(parsed)
                else:
                    base_items.append(parsed)

    if base_items:
        ingredients.append({"step": "Base", "items": base_items})
    if mixin_items:
        ingredients.append({"step": "Mix-ins", "items": mixin_items})
    if topping_items:
        ingredients.append({"step": "Toppings", "items": topping_items})

    return ingredients


def parse_single_ingredient(text: str) -> dict[str, str] | None:
    """Parse a single ingredient line from Reddit.

    Reddit formats are varied:
        360ml Fairlife fat-free milk (80 kcal per cup)
        15g mascarpone (60 kcal)
        1/4 Tsp Xanthan Gum
        2 Scoops Protein Powder (I used ON Gold Standard)
        Dark Cherries 140g
        Unsweetened Almond Milk 280-300mL
    """
    if not text:
        return None

    # Remove markdown bold/italic
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = text.strip()

    amount = ""
    unit = ""
    name = text
    comment = ""

    # Extract trailing parenthetical comments (but not measurement equivalents)
    paren_match = re.search(r"\(([^)]+)\)\s*$", text)
    if paren_match:
        inner = paren_match.group(1)
        # Keep measurement equivalents in the name, move descriptions to comment
        is_measurement = bool(re.match(
            r"^[\d.½¼¾⅓⅔/~]+\s*(?:tsp|tbsp|cup|scoop|oz|drops?)",
            inner, re.IGNORECASE,
        ))
        is_calorie_note = bool(re.match(r"^\d+\s*(?:kcal|cal)", inner, re.IGNORECASE))
        if not is_measurement:
            comment = inner
            text = text[:paren_match.start()].strip()

    # Pattern 1: Amount+unit first: "360ml Fairlife milk" or "15g mascarpone"
    m = re.match(
        r"^([\d.,/~½¼¾⅓⅔]+(?:\s*[-–]\s*[\d.,/]+)?)\s*(g|ml|mL|oz|cups?|tbsp?|tsp|scoops?|drops?|pinch(?:es)?|packets?|slices?|pieces?|servings?|Tbs?p|Tsp)\.?\s+(.+)$",
        text, re.IGNORECASE,
    )
    if m:
        amount = m.group(1).strip()
        unit = m.group(2).strip().lower()
        name = m.group(3).strip()
        return {"amount": amount, "unit": unit, "name": name, "comment": comment}

    # Pattern 2: Name first, then amount: "Dark Cherries 140g"
    m2 = re.match(
        r"^(.+?)\s+([\d.,/~]+(?:\s*[-–]\s*[\d.,/]+)?)\s*(g|ml|mL|oz)\s*$",
        text, re.IGNORECASE,
    )
    if m2:
        name = m2.group(1).strip()
        amount = m2.group(2).strip()
        unit = m2.group(3).strip().lower()
        return {"amount": amount, "unit": unit, "name": name, "comment": comment}

    # Pattern 3: Count + name: "2 Scoops Protein Powder" or "1 banana"
    m3 = re.match(
        r"^([\d.,/½¼¾]+)\s+(scoops?|cups?|tbsp|tsp|servings?|packets?|slices?|pieces?|drops?|pinch(?:es)?|Tbs?p|Tsp)\s+(.+)$",
        text, re.IGNORECASE,
    )
    if m3:
        amount = m3.group(1).strip()
        unit = m3.group(2).strip().lower()
        name = m3.group(3).strip()
        return {"amount": amount, "unit": unit, "name": name, "comment": comment}

    # Pattern 4: Fraction/number + name (no explicit unit): "1 banana", "½ avocado"
    m4 = re.match(
        r"^([\d.,/½¼¾⅓⅔]+(?:\s*[-–]\s*[\d.,/]+)?)\s+(.+)$",
        text,
    )
    if m4:
        potential_amount = m4.group(1).strip()
        potential_name = m4.group(2).strip()
        # Only use this if the name doesn't start with a unit-like word
        if potential_name and not re.match(r"^\d", potential_name):
            amount = potential_amount
            name = potential_name
            return {"amount": amount, "unit": "", "name": name, "comment": comment}

    # Pattern 5: "A pinch of salt"
    m5 = re.match(r"^[Aa]\s+(pinch|handful|splash|drizzle)\s+(?:of\s+)?(.+)$", text)
    if m5:
        amount = "1"
        unit = m5.group(1).lower()
        name = m5.group(2).strip()
        return {"amount": amount, "unit": unit, "name": name, "comment": comment}

    # Fallback: just the name
    name = text
    return {"amount": "", "unit": "", "name": name, "comment": comment}


def parse_directions_from_text(text: str) -> list[str]:
    """Extract directions from Reddit post text."""
    directions: list[str] = []
    in_directions = False

    for line in text.split("\n"):
        line = line.strip()
        lower = line.lower()

        # Detect start of directions
        if re.match(r"^(?:\*\*)?(?:directions?|instructions?|steps?|method|process|how to make)[:\s]*(?:\*\*)?$", lower):
            in_directions = True
            continue

        if not in_directions:
            # Also start on numbered steps if we haven't found ingredients section yet
            if re.match(r"^\d+\.\s+", line) and not re.match(r"^\d+g?\s", line):
                in_directions = True

        if not in_directions:
            continue

        # Stop at hashtags, other sections, or "edit:" lines
        if line.startswith("#") or lower.startswith("edit:") or lower.startswith("note:"):
            if directions:  # Only stop if we already have some directions
                break

        if not line:
            continue

        # Numbered step
        m = re.match(r"^\d+\.\s+(.+)$", line)
        if m:
            step_text = m.group(1).strip()
            # Clean markdown
            step_text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", step_text)
            directions.append(step_text)
        elif directions and line and not line.startswith("-") and not line.startswith("*"):
            # Continuation of previous direction
            if not re.match(r"^(?:tip|note|edit):", line, re.IGNORECASE):
                directions[-1] += " " + line

    return directions


def extract_description(title: str, text: str) -> str:
    """Extract a description from the Reddit post."""
    # Use the first paragraph of the selftext (before ingredients/recipe section)
    lines = text.split("\n")
    desc_lines: list[str] = []

    for line in lines:
        line = line.strip()
        if not line:
            if desc_lines:
                break
            continue

        lower = line.lower()
        # Stop at recipe sections
        if any(kw in lower for kw in ["ingredient", "recipe:", "base:", "direction", "instruction"]):
            break
        if line.startswith("-") or line.startswith("*") or line.startswith("•"):
            break
        if re.match(r"^\d+\.\s", line):
            break
        if re.match(r"^\d+\s*(?:cal|kcal)", line, re.IGNORECASE):
            break

        # Clean markdown
        clean = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", line)
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", clean)  # Remove links
        clean = clean.strip()
        if clean and len(clean) > 10:
            desc_lines.append(clean)

    desc = " ".join(desc_lines).strip()
    if len(desc) > 300:
        desc = desc[:297] + "..."
    if not desc:
        desc = f"Ninja Creami recipe shared on Reddit r/ninjacreami."
    return desc


def parse_recipe(post: dict[str, Any]) -> dict[str, Any] | None:
    """Parse a Reddit post into a recipe dict."""
    title = post["title"]
    text = post["selftext"]
    post_id = post["id"]

    if not text or len(text) < 80:
        return None

    # Must have at least some ingredient-like content
    if not has_recipe_content(text):
        return None

    clean_name = clean_title(title)
    if not clean_name or len(clean_name) < 3:
        clean_name = title.strip()

    slug = "reddit-" + slugify(clean_name)
    if not slug or slug == "reddit-":
        slug = f"reddit-{post_id}"

    nutrition_total = parse_nutrition_from_text(text)
    ingredients = parse_ingredients_from_text(text)
    directions = parse_directions_from_text(text)

    if not ingredients:
        return None

    description = extract_description(title, text)
    tags = extract_tags_from_post(title, text)

    # Check for scoopability indicators
    all_ingredient_names = " ".join(
        item.get("name", "").lower()
        for step in ingredients
        for item in step.get("items", [])
    )
    has_xanthan = "xanthan" in all_ingredient_names
    has_guar = "guar" in all_ingredient_names
    is_scoopable = has_xanthan or has_guar

    # Check for vegan indicators
    is_vegan = "Vegan" in tags or any(
        kw in all_ingredient_names
        for kw in ["oat milk", "almond milk", "coconut milk", "soy milk", "plant"]
    ) and not any(
        kw in all_ingredient_names
        for kw in ["whole milk", "heavy cream", "cream cheese", "whey", "fairlife",
                    "egg", "butter", "yogurt"]
    )

    # Estimate per-100g nutrition (Reddit pints ~473g)
    pint_weight = 473
    per_100g: dict[str, float] = {}
    if nutrition_total["kcal"] > 0:
        scale = 100 / pint_weight
        per_100g = {
            "kcal": round(nutrition_total["kcal"] * scale, 1),
            "fat": round(nutrition_total["fat"] * scale, 1),
            "carbs": round(nutrition_total["carbs"] * scale, 1),
            "sugar": round(nutrition_total.get("sugar", 0) * scale, 1),
            "protein": round(nutrition_total["protein"] * scale, 1),
            "salt": 0,
        }
    else:
        per_100g = {"kcal": 0, "fat": 0, "carbs": 0, "sugar": 0, "protein": 0, "salt": 0}

    permalink = post.get("permalink", "")
    canonical_url = f"https://www.reddit.com{permalink}" if permalink else None

    return {
        "id": slug,
        "name": clean_name,
        "slug": slug,
        "source": "reddit",
        "description": description,
        "tags": tags,
        "nutrition": per_100g,
        "nutritionTotal": {
            "weight": pint_weight if nutrition_total["kcal"] > 0 else 0,
            "kcal": nutrition_total["kcal"],
            "fat": nutrition_total["fat"],
            "carbs": nutrition_total["carbs"],
            "sugar": nutrition_total.get("sugar", 0),
            "protein": nutrition_total["protein"],
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
        "canonicalUrl": canonical_url,
    }


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def normalize_for_dedup(name: str) -> str:
    """Normalize a recipe name for deduplication."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9]", "", s)
    return s


def deduplicate_recipes(
    new_recipes: list[dict[str, Any]],
    existing_recipes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Remove recipes that are too similar to existing ones."""
    existing_names = {normalize_for_dedup(r["name"]) for r in existing_recipes}
    existing_slugs = {r["slug"] for r in existing_recipes}

    deduped: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()
    seen_names: set[str] = set()

    for recipe in new_recipes:
        slug = recipe["slug"]
        norm_name = normalize_for_dedup(recipe["name"])

        # Skip if slug already exists
        if slug in existing_slugs or slug in seen_slugs:
            continue

        # Skip if name is too similar to existing
        if norm_name in existing_names or norm_name in seen_names:
            continue

        # Skip very short names (likely parsing errors)
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
    print("Reddit r/ninjacreami Recipe Scraper")
    print("=" * 60)

    # Step 1: Fetch posts
    print("\n[1/4] Fetching Reddit posts...")
    posts = fetch_recipe_posts()

    # Step 2: Parse recipes
    print("\n[2/4] Parsing recipes...")
    reddit_recipes: list[dict[str, Any]] = []
    skipped: list[str] = []
    parse_errors: list[str] = []

    for post in posts:
        try:
            recipe = parse_recipe(post)
            if recipe:
                reddit_recipes.append(recipe)
            else:
                skipped.append(post["title"][:60])
        except Exception as e:
            parse_errors.append(f"{post['title'][:40]}: {e}")

    print(f"  Parsed {len(reddit_recipes)} recipes from {len(posts)} posts")
    if skipped:
        print(f"  Skipped {len(skipped)} posts (no parseable recipe)")
    if parse_errors:
        print(f"  Parse errors: {len(parse_errors)}")
        for err in parse_errors[:5]:
            print(f"    - {err}")

    # Step 3: Deduplicate and merge
    print("\n[3/4] Merging with existing recipes...")
    if not RECIPES_JSON.exists():
        print(f"ERROR: {RECIPES_JSON} not found.")
        sys.exit(1)

    existing = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))
    # Remove old Reddit recipes (in case of re-run)
    non_reddit = [r for r in existing if r.get("source") != "reddit"]

    deduped = deduplicate_recipes(reddit_recipes, non_reddit)
    print(f"  After dedup: {len(deduped)} new recipes (removed {len(reddit_recipes) - len(deduped)} duplicates)")

    merged = non_reddit + deduped
    merged.sort(key=lambda r: r["name"].lower())

    # Step 4: Write output
    print("\n[4/4] Writing output...")
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

    # Quality stats for Reddit recipes
    has_nutrition = sum(1 for r in deduped if r["nutrition"]["kcal"] > 0)
    has_ingredients = sum(1 for r in deduped if r["ingredients"])
    has_directions = sum(1 for r in deduped if r["directions"])
    has_tags = sum(1 for r in deduped if len(r["tags"]) > 0)
    scoopable = sum(1 for r in deduped if r["isScoopable"])

    print(f"\nReddit Recipe Quality ({len(deduped)} recipes):")
    print(f"  With nutrition:    {has_nutrition}")
    print(f"  With ingredients:  {has_ingredients}")
    print(f"  With directions:   {has_directions}")
    print(f"  With tags:         {has_tags}")
    print(f"  Scoopable:         {scoopable}")

    print(f"\nOutput: {RECIPES_JSON}")


if __name__ == "__main__":
    main()
