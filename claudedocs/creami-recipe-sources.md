# Ninja Creami Recipe Sources - Research Report

**Date**: 2026-02-09
**Objective**: Find and scrape additional Ninja Creami recipe sources beyond the existing 239 recipes from jhermann/ice-creamery (118) and FitnessProductFinder (121).

---

## Executive Summary

Successfully expanded the recipe database from **239 recipes** to **576 recipes** (+337, a 141% increase) by scraping 5 new sources. The three highest-value sources were Reddit r/ninjacreami (213 recipes), The Tasty Travelers blog (103 recipes), and George Eats blog (13 recipes). Six non-Creami recipes were removed during cleanup.

### Final Recipe Count by Source

| Source | Recipes | Has Nutrition | Has Directions | Scoopable |
|--------|---------|--------------|----------------|-----------|
| jhermann/ice-creamery | 118 | 116 | 117 | 89 |
| FitnessProductFinder | 121 | 121 | 120 | 118 |
| **r/ninjacreami (Reddit)** | **213** | 55 | 135 | 72 |
| **The Tasty Travelers** | **103** | 103 | 103 | 30 |
| **George Eats** | **13** | 0 | 13 | 0 |
| **Secretly Healthy Home** | **5** | 4 | 5 | 0 |
| **Earth and Oven** | **3** | 2 | 3 | 1 |
| **TOTAL** | **576** | 401 | 496 | 310 |

---

## Sources Discovered

### Tier 1 - Scraped Successfully

#### 1. Reddit r/ninjacreami
- **URL**: https://www.reddit.com/r/ninjacreami/
- **Subscribers**: 150,175
- **Recipes scraped**: 213
- **Data quality**: Variable - some posts have full nutrition data, all have ingredients
- **Method**: Reddit public JSON API (`.json` endpoint), no authentication needed
- **Scraper**: `scripts/scrape-reddit.py`
- **Key findings**:
  - 250+ posts with "Recipe-Post" flair, 327 total recipe-containing posts found
  - 55 have calorie/macro data, 135 have numbered directions
  - Very diverse recipe types: protein-focused, traditional, vegan, boozy, fruit sorbets
  - Community includes both casual home cooks and dedicated fitness enthusiasts
  - Many posts reference gram-based measurements (European/metric influence)
  - Excellent dedup potential against other sources (unique community-created recipes)

#### 2. The Tasty Travelers (thetastytravelers.com)
- **URL**: https://thetastytravelers.com/category/ninja-creami/
- **Recipes scraped**: 103
- **Data quality**: Excellent - full Schema.org Recipe markup with nutrition
- **Method**: `recipe-scrapers` Python library in wild mode
- **Scraper**: `scripts/scrape-blogs.py`
- **Key findings**:
  - One of the largest dedicated Ninja Creami recipe blogs
  - All recipes have structured nutrition data, ingredients, and directions
  - Good variety: protein ice cream, frozen yogurt, gelato, sorbet, lite ice cream
  - Many low-calorie options (43 classified as "light")
  - Also sells recipe books (not scraped - paid content)

#### 3. George Eats (georgeats.com)
- **URL**: https://georgeats.com/recipes/ninja-creami-recipes/
- **Recipes scraped**: 18
- **Data quality**: Good ingredients and directions, no nutrition data
- **Method**: `recipe-scrapers` Python library in wild mode
- **Scraper**: `scripts/scrape-blogs.py`
- **Key findings**:
  - Australian food blogger with Ninja Creami focus
  - Unique flavors: sweet potato, pumpkin, kombucha mango, lemon curd, sticky date
  - Multiple vegan options (coconut-based)
  - No nutrition data in Schema.org markup

#### 4. Secretly Healthy Home (secretlyhealthyhome.com)
- **URL**: https://secretlyhealthyhome.com/the-best-ninja-creami-recipes/
- **Recipes scraped**: 5
- **Data quality**: Good - nutrition and directions
- **Method**: `recipe-scrapers` Python library in wild mode
- **Scraper**: `scripts/scrape-blogs.py`
- **Key findings**:
  - Focus on protein ice cream without pudding mix
  - Uses collagen as secret ingredient for creaminess
  - Small but high-quality collection

#### 5. Earth and Oven (earthandoven.com)
- **URL**: https://earthandoven.com/2024/12/10/ninja-creami-recipes/
- **Recipes scraped**: 4
- **Data quality**: Good - nutrition and directions
- **Method**: `recipe-scrapers` Python library in wild mode
- **Scraper**: `scripts/scrape-blogs.py`
- **Key findings**:
  - Emphasis on sugar-free and naturally sweetened recipes
  - Small but growing collection
  - Dairy-free options available

---

### Tier 2 - Evaluated But Not Scraped

#### 6. SharkNinja Official (sharkninja.com/discover/recipes/creami-recipes)
- **Estimated recipes**: 485
- **Data quality**: Likely excellent (official recipes)
- **Scrapeability**: LOW - JavaScript SPA (Next.js), requires browser rendering
- **Why not scraped**: The recipe listing page is dynamically rendered. Individual recipe pages do have Schema.org markup, but discovering all 485 URLs requires a headless browser to paginate through the SPA. The category_url returns only 16 recipes on initial load.
- **Future recommendation**: Use Playwright to paginate and collect all recipe URLs, then scrape each with recipe-scrapers. High effort but high reward.

#### 7. Ninja Test Kitchen (ninjatestkitchen.com)
- **Estimated recipes**: 93+ in "Ninja Swirl by Creami" collection
- **Data quality**: Good (official recipes with Schema.org)
- **Scrapeability**: LOW - Same JS SPA architecture as sharkninja.com
- **Why not scraped**: Same issue as sharkninja.com - dynamic rendering required for pagination. Individual recipe pages work fine with recipe-scrapers.
- **Future recommendation**: Same as above. Many recipes likely overlap with sharkninja.com.

#### 8. The Big Man's World (thebigmansworld.com/ninja-creami-recipes/)
- **Estimated recipes**: 1 base recipe with 52 flavor variations
- **Data quality**: Good (single recipe has full Schema.org data)
- **Scrapeability**: Not applicable - single page with variations described in text
- **Why not scraped**: All 52 flavors are variations of the same base recipe (cream cheese + sugar + cream + milk), not individual recipe pages. The flavor instructions are embedded in prose text, not structured data.

#### 9. Basics with Bails (basicswithbails.com)
- **Estimated recipes**: 33
- **Data quality**: Unknown (roundup page links to recipes on the same site)
- **Scrapeability**: MEDIUM - WordPress with Schema.org
- **Why not scraped**: Time constraints. Would work with the blog scraper approach.
- **Future recommendation**: Add to the BLOG_SOURCES list in scrape-blogs.py.

#### 10. Lara Clevenger (laraclevenger.com/ninja-creami-recipes/)
- **Estimated recipes**: 40+
- **Data quality**: Likely good (registered dietitian's blog)
- **Scrapeability**: MEDIUM - WordPress
- **Future recommendation**: Add to BLOG_SOURCES list.

#### 11. Pretty Delicious Life (prettydeliciouslife.com)
- **Estimated recipes**: Unknown
- **Data quality**: Unknown
- **Scrapeability**: MEDIUM
- **Future recommendation**: Evaluate and potentially add to BLOG_SOURCES.

---

### Tier 3 - Identified but Not Feasible

#### 12. TikTok Creators
- **Estimated recipes**: Hundreds across many creators
- **Scrapeability**: VERY LOW - No public API for captions/descriptions, heavy anti-bot measures
- **Why not feasible**: TikTok has aggressive bot detection and no public API for text content. Recipe data is often in spoken audio or on-screen text, not in captions.

#### 13. Facebook Groups (Ninja Creami Recipes & Tips, etc.)
- **Estimated recipes**: Thousands
- **Scrapeability**: VERY LOW - Requires authentication, closed groups
- **Why not feasible**: Facebook groups are behind authentication walls and their data is not publicly accessible via API.

#### 14. Instagram Ninja Creami Creators
- **Estimated recipes**: Hundreds
- **Scrapeability**: VERY LOW - No public API, rate limited
- **Why not feasible**: Instagram does not provide a public API for post content. Recipes are often in image captions or stories which are hard to scrape.

#### 15. Allrecipes.com / Food.com / Yummly.com
- **Estimated recipes**: 10-50 combined
- **Scrapeability**: MEDIUM (recipe-scrapers supports these sites)
- **Why not scraped**: Very small number of Ninja Creami specific recipes. Most are generic ice cream recipes that happen to mention the Creami.
- **Future recommendation**: Not worth the effort for so few recipes.

---

## Scrapers Built

### 1. `scripts/scrape-reddit.py`
Reddit r/ninjacreami recipe scraper.

**Features**:
- Paginates through Reddit's public JSON API (no auth required)
- Searches by "Recipe-Post" flair and keyword fallback
- Parses unstructured Reddit post text into structured recipe data
- Extracts: ingredients (with amounts/units), directions, nutrition, tags
- Caches fetched posts to `scripts/reddit-cache.json`
- Deduplicates against existing recipes by normalized name and slug
- Rate limited to 2 seconds between requests

**Usage**: `python scripts/scrape-reddit.py`

**Limitations**:
- Reddit API returns max 250 posts per search query even with pagination
- Nutrition data only available for ~26% of posts (community doesn't always include macros)
- Ingredient parsing is regex-based and handles most common formats but may miss unusual ones
- Some recipes are written in conversational/humorous style that's harder to parse

### 2. `scripts/scrape-blogs.py`
Multi-blog recipe scraper using the `recipe-scrapers` Python library.

**Features**:
- Configurable source list - easy to add new blogs
- Crawls category/listing pages to discover individual recipe URLs
- Uses `recipe-scrapers` with `wild_mode=True` for Schema.org extraction
- Handles nutrition data conversion (per-serving to per-100g)
- Caches nothing (each recipe is fetched fresh - could be improved)
- Deduplicates by name, slug, and canonical URL

**Currently configured sources**:
- The Tasty Travelers (thetastytravelers.com) - 103 recipes
- Earth and Oven (earthandoven.com) - 4 recipes
- Secretly Healthy Home (secretlyhealthyhome.com) - 5 recipes
- George Eats (georgeats.com) - 18 recipes

**Usage**: `python scripts/scrape-blogs.py`

**Adding new blogs**: Add a new entry to the `BLOG_SOURCES` list with:
- `name`: Display name
- `source_id`: Short identifier for the source field
- `category_urls`: List of listing/category page URLs to crawl for links
- `link_pattern`: Regex to extract individual recipe URLs from category pages
- `exclude_patterns`: Regex patterns for URLs to skip (non-recipe pages)
- `direct_urls`: Optional list of known recipe URLs (instead of crawling)

---

## App Code Changes

### `src/lib/types.ts` (line 30)
Updated the `source` union type to include new sources:
```typescript
source: "jhermann" | "fpf" | "reddit" | "tastytravelers" | "earthandoven" | "secretlyhealthy" | "georgeats";
```

### `src/components/FilterPanel.tsx` (line 71)
Updated `SOURCE_LABELS` to include display names for new sources:
```typescript
const SOURCE_LABELS: Record<string, string> = {
    jhermann: 'jhermann/ice-creamery',
    fpf: 'FitnessProductFinder (YouTube)',
    reddit: 'r/ninjacreami (Reddit)',
    tastytravelers: 'The Tasty Travelers',
    earthandoven: 'Earth and Oven',
    secretlyhealthy: 'Secretly Healthy Home',
    georgeats: 'George Eats',
};
```

---

## Recommendations for Future Scraping

### High Priority
1. **SharkNinja Official** (485 recipes) - Use Playwright to paginate the SPA, extract URLs, then scrape with recipe-scrapers. Highest potential yield of new unique recipes.
2. **Re-run Reddit scraper periodically** - New recipes are posted daily. Could run weekly or monthly to pick up new posts.
3. **Basics with Bails** (33 recipes) - Easy add to the blog scraper.

### Medium Priority
4. **Lara Clevenger** (40+ recipes) - Dietitian's blog, likely high-quality nutrition data.
5. **Krolls Korner** - Several Ninja Creami recipes with good Schema.org data.
6. **ninjatestkitchen.eu** (European Ninja recipes) - Different recipes from the US site.

### Low Priority / Future Consideration
7. **Reddit search improvements** - Use PRAW (official Python Reddit API wrapper) for better pagination and access to all posts (current JSON endpoint caps at ~250).
8. **Add image support** - Many blog recipes have images in Schema.org data that could be downloaded.
9. **Nutrition estimation** - For Reddit recipes without nutrition data, could potentially estimate using ingredient databases (USDA FoodData Central API).

---

## Technical Notes

### Dependencies Added
- `recipe-scrapers` (pip) - Python library for extracting recipe data from Schema.org markup on 600+ supported websites. Used in wild mode for unsupported sites.

### Caching
- Reddit posts cached to `scripts/reddit-cache.json` (avoid re-fetching)
- FPF descriptions cached to `scripts/fpf-cache.json` (existing)
- Blog recipes not cached (re-fetched each run)

### Rate Limiting
- Reddit: 2 second delay between requests (their limit is ~10 unauthenticated/minute)
- Blogs: 1.5 second delay between requests
- Both scrapers are conservative to avoid being blocked

### Data Quality Notes
- Reddit recipes have the most variable quality - from meticulously documented to casual "eyeballed" recipes
- Blog recipes have the best structured data thanks to Schema.org/WordPress recipe plugins
- Nutrition data from blogs is typically per-serving; we multiply by servings and estimate per-100g assuming a 473g pint
- Some deduplication may be needed if the same recipe appears on both Reddit and a blog
