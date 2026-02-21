# Creami Recipe Website -- System Architecture

**Target URL:** `atmix.org/creami`
**Stack:** React 18 + Vite 5 + TailwindCSS 3, static deploy (Vercel)
**Data:** JSON flat files, client-side search/filter, no backend

---

## 1. Unified Recipe JSON Schema

### TypeScript Type Definitions

File: `C:\Users\1matt\OneDrive\Documents\atmix\src\creami\types.ts`

```typescript
/** A single ingredient in a recipe */
export interface Ingredient {
  name: string;           // "Bananas (peeled)"
  brand?: string;         // "REWE Bio" -- extracted from square brackets in source
  amount: number;         // 225
  unit: string;           // "g" | "ml" | "drops" | "tsp" | "tbsp" | "cups" | "scoops"
  step: RecipeStep;       // which phase of preparation
  nutrition: {            // per 100g of THIS ingredient
    kcal: number;
    fat: number;
    carbs: number;
    sugar: number;
    protein: number;
    salt: number;
  } | null;               // null for FPF recipes or ingredients without data
  fpdf: number | null;    // freezing point depression factor for this ingredient
  msnf: number | null;    // milk solids non-fat percentage
  comment: string;        // "2 mid-size or 3 small ripe pieces"
}

/** Preparation step grouping (maps to # column in CSV) */
export type RecipeStep =
  | "prep"     // 0: dissolving/hydrating
  | "wet"      // 1: liquids to tub
  | "dry"      // 2: powders/stabilizers
  | "fill"     // 3: top off to MAX line
  | "mixin"    // 4: mix-ins after spinning
  | "topping"  // 5: optional toppings
  | "unknown"; // FPF recipes without step info

/** Nutritional values for a specific serving size */
export interface NutritionBlock {
  weight: number;     // grams
  label: string;      // "per 100g" | "per half tub" | "total"
  kcal: number;
  fat: number;
  carbs: number;
  sugar: number;
  protein: number;
  salt: number;
}

/** The data source for this recipe */
export type RecipeSource = "jhermann" | "fpf";

/** Complete recipe record -- the canonical shape in recipes.json */
export interface Recipe {
  // Identity
  slug: string;               // URL-safe unique ID: "banana-ice-cream-deluxe"
  name: string;               // "Banana Ice Cream (Deluxe)"
  description: string;        // Plain text summary, first paragraph of README

  // Classification
  tags: string[];             // ["Dairy", "Fruit", "Hi-Protein", "Scoopable", ...]
  categories: Category[];     // derived high-level categories (see below)

  // Nutrition (the 3 standard views)
  nutrition: {
    per100g: NutritionBlock;
    perServing: NutritionBlock;   // half-tub for jhermann, total for FPF
    total: NutritionBlock;
  };

  // Scoopability
  fpdfPac: number | null;         // 30.41 -- the FPDF / PAC score
  proteinEnergyRatio: number | null;  // 20.99 -- percentage

  // Ingredients
  ingredients: Ingredient[];

  // Directions
  directions: string[];           // ordered step strings, plain text

  // Images
  images: {
    hero: string | null;          // primary display image URL
    gallery: string[];            // additional image URLs
  };

  // Source attribution
  source: RecipeSource;
  sourceUrl: string;              // original URL (GitHub page or YouTube short)
  author: string;                 // "Juergen Hermann" or "Fitness Product Finder"

  // Metadata
  createdDate: string | null;     // ISO date string
  updatedDate: string | null;     // ISO date from changelog entries
  changelog: string[];            // ["Nov 15, 2024: Add 1cl brandy", ...]

  // Search optimization (denormalized for Fuse.js)
  ingredientNames: string;        // "bananas, cottage cheese, glycerin, brandy, ..."
}

/** High-level categories derived from tags */
export type Category =
  | "dairy"         // has Dairy tag
  | "vegan"         // has Vegan tag
  | "fruit"         // has Fruit tag
  | "chocolate"     // name contains chocolate/cocoa/cacao
  | "sorbet"        // has Sorbet tag
  | "light"         // has Light tag
  | "hi-protein"    // has Hi-Protein tag
  | "low-sugar"     // has Low-Sugar tag
  | "alcohol"       // has Alcohol tag
  | "seasonal";     // has Seasonal tag

/** Tag metadata for the filter panel */
export interface TagMeta {
  name: string;       // "Hi-Protein"
  count: number;      // 44
  group: TagGroup;    // "dietary" | "ingredient" | "texture" | "other"
}

export type TagGroup =
  | "dietary"       // Vegan, Dairy, Dairy-Free, Keto, Low-Sugar, Low-Fat, Low-Cal, Light, Hi-Protein
  | "sweetener"     // Erythritol, Xylitol, Stevia, Sucralose, Allulose, Monk-Fruit
  | "texture"       // Scoopable, Polysaccharide Gum, Tylo Powder (CMC), Emulsifier, Gum-Free
  | "type"          // Fruit, Sorbet, Alcohol, Cooked Base, Drinkable, Coconut
  | "status"        // Draft, Favorite, Experimental, Promising, Weird Science, Simple, Seasonal, Multi-Flavor
  | "other";
```

### Example Recipe JSON (single record)

```json
{
  "slug": "banana-ice-cream-deluxe",
  "name": "Banana Ice Cream (Deluxe)",
  "description": "FroYo spin, mix-in with crushed cantuccini, and topped with almonds. Very dense and non-melty, no ice crystals whatsoever.",
  "tags": ["Dairy", "Emulsifier", "Erythritol", "Favorite", "Fruit", "Hi-Protein", "Low-Fat", "Polysaccharide Gum", "Scoopable", "Stevia", "Sucralose", "Tylo Powder (CMC)", "Vegan", "Xylitol"],
  "categories": ["dairy", "fruit", "hi-protein", "vegan"],
  "nutrition": {
    "per100g":    { "weight": 100, "label": "per 100g",    "kcal": 88.3,  "fat": 1.5,  "carbs": 15.5, "sugar": 5.6,  "protein": 4.6,  "salt": 0.2 },
    "perServing": { "weight": 340, "label": "per half tub", "kcal": 300.3, "fat": 5.3,  "carbs": 52.8, "sugar": 19.0, "protein": 15.8, "salt": 0.7 },
    "total":      { "weight": 685, "label": "total",        "kcal": 605.0, "fat": 10.6, "carbs": 106.4,"sugar": 38.3, "protein": 31.8, "salt": 1.4 }
  },
  "fpdfPac": 30.41,
  "proteinEnergyRatio": 20.99,
  "ingredients": [
    {
      "name": "Bananas (peeled)",
      "brand": null,
      "amount": 225,
      "unit": "g",
      "step": "prep",
      "nutrition": { "kcal": 108, "fat": 0.6, "carbs": 21.5, "sugar": 16.0, "protein": 1.22, "salt": 0.03 },
      "fpdf": 0.16,
      "msnf": null,
      "comment": "2 mid-size or 3 small ripe pieces, eat any surplus"
    }
  ],
  "directions": [
    "Blend the bananas, cottage cheese and the other 'prep' ingredients in an empty tub to a soft puree.",
    "Add wet ingredients to the banana puree.",
    "Weigh and mix dry ingredients, easiest by adding to a jar with a secure lid and shaking vigorously.",
    "Pour into the tub and QUICKLY use an immersion blender on full speed to homogenize everything.",
    "Let blender run until thickeners are properly hydrated, up to 1-2 min. Or blend again after waiting that time.",
    "Add remaining ingredients and stir with a spoon.",
    "For better results, let the base age in the fridge (covered, lid on), for a few hours or overnight.",
    "Freeze for 24h with lid on, then spin as usual. Flatten any humps before that.",
    "Process with RE-SPIN mode when not creamy enough after the first spin."
  ],
  "images": {
    "hero": "https://raw.githubusercontent.com/jhermann/ice-creamery/refs/heads/main/recipes/Banana%20Ice%20Cream%20(Deluxe)/banana_2024-12-05.jpg",
    "gallery": [
      "https://raw.githubusercontent.com/jhermann/ice-creamery/refs/heads/main/recipes/Banana%20Ice%20Cream%20(Deluxe)/banana_almond_2024-10-30_1.jpg"
    ]
  },
  "source": "jhermann",
  "sourceUrl": "https://jhermann.github.io/ice-creamery/B/Banana%20Ice%20Cream%20(Deluxe)/",
  "author": "Juergen Hermann",
  "createdDate": null,
  "updatedDate": "2025-12-13",
  "changelog": [
    "Nov 15, 2024: Add 1cl brandy",
    "Jan 1, 2025: Add lemon juice",
    "Jun 8, 2025: Use soy milk (less sugar)",
    "Jul 2, 2025: Less ICS",
    "Dec 13, 2025: New blends"
  ],
  "ingredientNames": "bananas, cottage cheese, glycerin, brandy, vodka, lemon juice, soy milk, sweex, erythritol, xylitol, whey, casein, protein, salty stability, inulin, gms, cmc, guar, xanthan, salt, flavor drops, vanilla, sucralose"
}
```

### Data Files

| File | Path | Purpose | Approximate Size |
|------|------|---------|-----------------|
| `recipes.json` | `public/creami/data/recipes.json` | All recipe records | ~300-400 KB |
| `tags.json` | `public/creami/data/tags.json` | Tag taxonomy with counts and groups | ~2 KB |

`tags.json` shape:
```json
{
  "tags": [
    { "name": "Dairy", "count": 49, "group": "dietary" },
    { "name": "Vegan", "count": 43, "group": "dietary" },
    { "name": "Fruit", "count": 46, "group": "type" },
    { "name": "Scoopable", "count": 89, "group": "texture" }
  ],
  "groups": ["dietary", "sweetener", "texture", "type", "status"],
  "totalRecipes": 121,
  "sources": { "jhermann": 121, "fpf": 0 },
  "generatedAt": "2026-02-08T12:00:00Z"
}
```

---

## 2. Data Pipeline Architecture

### Pipeline Overview

```
  SOURCE FILES                    TRANSFORM               OUTPUT
  ===========                    =========               ======

  creami/recipes/*/
    README.md (YAML+MD)  ──┐
    Ice-Cream-Recipes.csv ─┤
                            ├──> build-recipe-db.py ──> public/creami/data/recipes.json
  creami/data/fpf/          │                       ──> public/creami/data/tags.json
    videos.json ───────────┘

```

### Script: `C:\Users\1matt\OneDrive\Documents\atmix\creami\scripts\build-recipe-db.py`

This is the critical build-time script. It performs:

1. **Discover jhermann recipes**: Walk `creami/recipes/*/` directories
2. **Parse YAML frontmatter**: Extract tags, canonical_url, excluded_tags from README.md
3. **Parse CSV nutritional data**: Extract the 3 nutrition blocks (per 100g, per serving, total)
4. **Parse CSV ingredients**: Extract structured ingredient list with step assignments
5. **Parse description**: Extract plain-text description from README.md (text between frontmatter and # INGREDIENTS)
6. **Parse directions**: Extract from README.md (text between # DIRECTIONS and # NUTRITIONAL)
7. **Parse FPDF/PAC**: Extract from CSV row containing "FPDF"
8. **Parse changelog**: Extract date-prefixed entries from end of CSV
9. **Resolve images**: Build GitHub raw URLs for JPG/PNG/WEBP files in recipe directory
10. **Discover FPF recipes**: Read `creami/data/fpf/videos.json`, filter `has_recipe: true`
11. **Transform FPF**: Map to unified schema with source="fpf"
12. **Generate slugs**: URL-safe slugification of recipe names
13. **Derive categories**: Map tags to high-level categories
14. **Build ingredientNames**: Denormalized search field
15. **Validate**: Schema compliance checks, report warnings for missing data
16. **Write output**: `recipes.json` and `tags.json`

### Parsing Strategy for jhermann CSV

The CSV uses semicolons as delimiters and has this structure:

```
Row 1:  Title
Row 2:  (empty)
Row 3:  ;Amount;Unit;;kcal;Fat;Carbs;Sugar;Protein;Salt;;;;;
Row 4:  Nutritional values per 100g/ml;100;g;;88.3;1.5;15.5;5.6;4.6;0.2;;;;;
Row 5:  Nutritional values per 1/2 Deluxe Tub;340;g;;300.3;...
Row 6:  Nutritional values total;685;g;;605.0;...
Row 7:  (empty)
Row 8:  FPDF / PAC (target 20..30);30.41;...
Row 9:  "Protein / Energy Ratio (ok=12%; hi=20%)";20.99%;...
Row 10: MSNF line
Row 11: Net carbs line
Row 12+: (empty rows, description text, rating text, direction text)
...
Row N:  Ingredients;Amount;Unit;#;kcal;Fat;Carbs;Sugar;Protein;Salt;FPDF;MSNF;Comment;0Carb[%];Counts?
Row N+1..M: Ingredient data rows
Row M+1+: Changelog entries (date;description)
```

The existing `ice-cream-recipe.py` already has a `parse_recipe_csv()` function that handles this parsing. The `build-recipe-db.py` script should reuse that module by importing it.

### Step-Number-to-Step Mapping

```python
STEP_MAP = {
    "0": "prep",
    "1": "wet",
    "2": "dry",
    "3": "fill",
    "4": "mixin",
    "5": "topping",
}
```

### Slug Generation

```python
import re

def slugify(name: str) -> str:
    """banana-ice-cream-deluxe from 'Banana Ice Cream (Deluxe)'"""
    s = name.lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)      # strip special chars
    s = re.sub(r'[\s_]+', '-', s)             # whitespace to hyphens
    s = re.sub(r'-+', '-', s)                 # collapse multiple hyphens
    return s.strip('-')
```

### Tag-to-Group Mapping

```python
TAG_GROUPS = {
    "dietary": {"Dairy", "Dairy-Free", "Vegan", "Keto", "Low-Sugar", "Low-Fat",
                "Low-Cal", "Light", "Hi-Protein"},
    "sweetener": {"Erythritol", "Xylitol", "Stevia", "Sucralose", "Allulose",
                  "Monk-Fruit", "Vanilla"},
    "texture": {"Scoopable", "Polysaccharide Gum", "Tylo Powder (CMC)",
                "Emulsifier", "Gum-Free"},
    "type": {"Fruit", "Sorbet", "Alcohol", "Cooked Base", "Drinkable",
             "Coconut", "Multi-Flavor"},
    "status": {"Draft", "Favorite", "Experimental", "Promising",
               "Weird Science", "Simple", "Seasonal"},
}
```

### Category Derivation

```python
def derive_categories(name: str, tags: list[str]) -> list[str]:
    categories = []
    tag_set = set(tags)
    if "Dairy" in tag_set:                    categories.append("dairy")
    if "Vegan" in tag_set:                    categories.append("vegan")
    if "Fruit" in tag_set:                    categories.append("fruit")
    if "Sorbet" in tag_set:                   categories.append("sorbet")
    if "Light" in tag_set:                    categories.append("light")
    if "Hi-Protein" in tag_set:               categories.append("hi-protein")
    if "Low-Sugar" in tag_set:                categories.append("low-sugar")
    if "Alcohol" in tag_set:                  categories.append("alcohol")
    if "Seasonal" in tag_set:                 categories.append("seasonal")
    name_lower = name.lower()
    if any(w in name_lower for w in ("chocolate", "cocoa", "cacao", "choco")):
        categories.append("chocolate")
    return categories
```

### Image Resolution for jhermann Recipes

```python
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/jhermann/ice-creamery/refs/heads/main/recipes"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def resolve_images(recipe_dir: Path, recipe_name: str) -> dict:
    """Build image URLs from files in recipe directory."""
    image_files = sorted(
        f for f in recipe_dir.iterdir()
        if f.suffix.lower() in IMAGE_EXTENSIONS
        and not f.name.startswith("logo-")  # skip logos unless as hero
    )
    encoded_name = urllib.parse.quote(recipe_name)
    urls = [
        f"{GITHUB_RAW_BASE}/{encoded_name}/{urllib.parse.quote(f.name)}"
        for f in image_files
    ]
    # Pick hero: prefer files with "money-shot", then first non-logo image
    hero = urls[0] if urls else None
    for f in image_files:
        if "money" in f.stem.lower():
            hero = f"{GITHUB_RAW_BASE}/{encoded_name}/{urllib.parse.quote(f.name)}"
            break
    # Check for logo image as fallback hero
    logo_files = [f for f in recipe_dir.iterdir() if f.name.startswith("logo-")]
    if not hero and logo_files:
        hero = f"{GITHUB_RAW_BASE}/{encoded_name}/{urllib.parse.quote(logo_files[0].name)}"

    return {"hero": hero, "gallery": urls}
```

### Build Command Integration

Add to `package.json` scripts:

```json
{
  "scripts": {
    "build:data": "python creami/scripts/build-recipe-db.py",
    "prebuild": "npm run build:data",
    "dev:data": "python creami/scripts/build-recipe-db.py --watch"
  }
}
```

The `prebuild` hook ensures data is always fresh before `vite build`.

---

## 3. Component Hierarchy

### Component Tree

```
<App>                                    // existing atmix root
  <Routes>
    {/* existing routes */}
    <Route path="/creami/*" element={
      <Suspense fallback={<CreamiSkeleton />}>
        <CreamiApp />                    // lazy-loaded sub-application
      </Suspense>
    } />
  </Routes>
</App>

<CreamiApp>                              // src/creami/CreamiApp.tsx
  <RecipeProvider>                       // context: recipes[], tags[], loading state
    <CreamiLayout>                       // shell with header/footer
      <CreamiHeader />                   // branding, back-to-atmix link
      <main>
        <Routes>
          <Route index element={<RecipeListPage />} />
          <Route path=":slug" element={<RecipeDetailPage />} />
        </Routes>
      </main>
      <CreamiFooter />                   // attribution, source links
    </CreamiLayout>
  </RecipeProvider>
</CreamiApp>

<RecipeListPage>                         // src/creami/pages/RecipeListPage.tsx
  <PageTitle />                          // "Ninja Creami Recipes" + recipe count
  <SearchBar />                          // text input with debounced search
  <div className="flex">
    <FilterSidebar />                    // desktop: left sidebar; mobile: slide-over
      <FilterSection title="Categories">
        <CategoryChips />               // quick-select: Dairy, Vegan, Fruit, etc.
      </FilterSection>
      <FilterSection title="Dietary">
        <TagCheckboxGroup group="dietary" />
      </FilterSection>
      <FilterSection title="Nutrition">
        <RangeSlider label="Calories" field="kcal" min={0} max={200} />
        <RangeSlider label="Protein" field="protein" min={0} max={30} />
        <RangeSlider label="Fat" field="fat" min={0} max={20} />
      </FilterSection>
      <FilterSection title="Scoopability">
        <RangeSlider label="PAC Score" field="fpdfPac" min={0} max={50} />
      </FilterSection>
      <FilterSection title="Source">
        <SourceToggle />
      </FilterSection>
      <ActiveFilters />                  // shows active filter pills with remove buttons
      <ClearAllButton />
    <div className="flex-1">
      <SortControls />                   // sort by: name, calories, protein, PAC
      <RecipeGrid>                       // responsive CSS grid
        <RecipeCard                      // repeated for each visible recipe
          recipe={recipe}
          onClick={navigate}
        />
      </RecipeGrid>
      <Pagination                        // simple page numbers, 24 per page
        page={currentPage}
        total={filteredCount}
        perPage={24}
      />
      <EmptyState />                     // shown when no results match
    </div>
  </div>
</RecipeListPage>

<RecipeDetailPage>                       // src/creami/pages/RecipeDetailPage.tsx
  <BackLink />                           // "< All Recipes" breadcrumb
  <RecipeHero>                           // hero image + title overlay
    <h1>{recipe.name}</h1>
    <TagList tags={recipe.tags} />
    <SourceBadge source={recipe.source} />
  </RecipeHero>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2">
      <RecipeDescription text={recipe.description} />
      <IngredientList>                   // grouped by step
        <IngredientGroup step="prep" />
        <IngredientGroup step="wet" />
        <IngredientGroup step="dry" />
        <IngredientGroup step="fill" />
        <IngredientGroup step="mixin" />
      </IngredientList>
      <DirectionsList steps={recipe.directions} />
      <ChangelogSection entries={recipe.changelog} />
    </div>
    <aside className="lg:col-span-1">
      <NutritionPanel>                   // sticky sidebar on desktop
        <NutritionSummary per100g={...} />
        <MacroChart />                   // visual bar chart of macros
        <PacScoreBadge score={recipe.fpdfPac} />
        <ProteinRatioBadge ratio={recipe.proteinEnergyRatio} />
        <ServingToggle />                // switch between per100g / perServing / total
      </NutritionPanel>
      <ImageGallery images={recipe.images.gallery} />
    </aside>
  </div>
</RecipeDetailPage>
```

### Component Props Interfaces

File: `C:\Users\1matt\OneDrive\Documents\atmix\src\creami\types.ts` (continued)

```typescript
// --- Component Props ---

export interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  resultCount: number;
}

export interface FilterSidebarProps {
  tags: TagMeta[];
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
}

export interface ActiveFilters {
  tags: string[];                // selected tag names
  categories: Category[];        // selected category chips
  kcalRange: [number, number];   // [min, max] per 100g
  proteinRange: [number, number];
  fatRange: [number, number];
  pacRange: [number, number];
  sources: RecipeSource[];       // ["jhermann"] or ["fpf"] or both
  sort: SortField;
  sortDir: "asc" | "desc";
}

export type SortField = "name" | "kcal" | "protein" | "fat" | "fpdfPac" | "relevance";

export interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export interface RecipeGridProps {
  recipes: Recipe[];
  loading: boolean;
}

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  unit?: string;              // "kcal", "g", etc.
  step?: number;
}

export interface NutritionPanelProps {
  nutrition: Recipe["nutrition"];
  fpdfPac: number | null;
  proteinEnergyRatio: number | null;
}

export interface IngredientListProps {
  ingredients: Ingredient[];
}

export interface DirectionsListProps {
  steps: string[];
}
```

---

## 4. Search and Filter Architecture

### Strategy: Fuse.js for fuzzy text search + imperative filtering

**Why Fuse.js over alternatives:**

| Library | Bundle Size | Index Build | Fuzzy | Rationale |
|---------|-------------|-------------|-------|-----------|
| **Fuse.js** | 5KB gzip | Runtime, instant at 200 records | Yes | Best fit: lightweight, no build step, good fuzzy |
| Lunr.js | 8KB gzip | Requires pre-built index | Limited | Overkill: designed for thousands of documents |
| FlexSearch | 6KB gzip | Runtime | Limited | Better for exact prefix search, weaker fuzzy |
| Custom | 0KB | N/A | Manual | Not worth building for this scale |

### Search Configuration

File: `C:\Users\1matt\OneDrive\Documents\atmix\src\creami\lib\search.ts`

```typescript
import Fuse from 'fuse.js';
import type { Recipe, ActiveFilters } from '../types';

const FUSE_OPTIONS: Fuse.IFuseOptions<Recipe> = {
  keys: [
    { name: 'name',            weight: 2.0 },
    { name: 'tags',            weight: 1.5 },
    { name: 'description',     weight: 1.0 },
    { name: 'ingredientNames', weight: 0.8 },
  ],
  threshold: 0.35,          // 0 = exact, 1 = match anything
  distance: 100,            // how far to search from expected position
  minMatchCharLength: 2,    // ignore single-char matches
  shouldSort: true,         // sort by relevance score
  includeScore: true,       // return match score for UI feedback
};

let fuseIndex: Fuse<Recipe> | null = null;

export function initializeSearch(recipes: Recipe[]): void {
  fuseIndex = new Fuse(recipes, FUSE_OPTIONS);
}

export function searchRecipes(query: string): Recipe[] {
  if (!fuseIndex || !query.trim()) return [];
  return fuseIndex.search(query).map(result => result.item);
}
```

### Filter Pipeline

The filtering and search operate as a pipeline:

```
All Recipes (200)
    |
    v
[1. Category Filter]  -- intersection: recipe.categories includes ANY selected
    |
    v
[2. Tag Filter]       -- intersection: recipe.tags includes ALL selected tags
    |
    v
[3. Nutrition Filter] -- range check: per100g.kcal within [min, max], etc.
    |
    v
[4. PAC Filter]       -- range check: fpdfPac within [min, max]
    |
    v
[5. Source Filter]    -- recipe.source in selected sources
    |
    v
Filtered Set (N)
    |
    v
[6. Fuse.js Search]  -- if query present, fuzzy search on filtered set
    |
    v
[7. Sort]            -- by selected field, or "relevance" if search active
    |
    v
[8. Paginate]        -- slice for current page (24 per page)
    |
    v
Displayed Recipes (24)
```

```typescript
// src/creami/lib/filter.ts

export function applyFilters(recipes: Recipe[], filters: ActiveFilters): Recipe[] {
  let result = recipes;

  // 1. Category filter (OR logic -- match ANY selected category)
  if (filters.categories.length > 0) {
    result = result.filter(r =>
      filters.categories.some(cat => r.categories.includes(cat))
    );
  }

  // 2. Tag filter (AND logic -- must have ALL selected tags)
  if (filters.tags.length > 0) {
    result = result.filter(r =>
      filters.tags.every(tag => r.tags.includes(tag))
    );
  }

  // 3. Nutrition range filters (per 100g)
  result = result.filter(r => {
    const n = r.nutrition.per100g;
    return (
      n.kcal >= filters.kcalRange[0] && n.kcal <= filters.kcalRange[1] &&
      n.protein >= filters.proteinRange[0] && n.protein <= filters.proteinRange[1] &&
      n.fat >= filters.fatRange[0] && n.fat <= filters.fatRange[1]
    );
  });

  // 4. PAC score filter
  if (filters.pacRange[0] > 0 || filters.pacRange[1] < 50) {
    result = result.filter(r =>
      r.fpdfPac !== null &&
      r.fpdfPac >= filters.pacRange[0] &&
      r.fpdfPac <= filters.pacRange[1]
    );
  }

  // 5. Source filter
  if (filters.sources.length > 0 && filters.sources.length < 2) {
    result = result.filter(r => filters.sources.includes(r.source));
  }

  return result;
}

export function sortRecipes(
  recipes: Recipe[],
  field: SortField,
  dir: "asc" | "desc"
): Recipe[] {
  if (field === "relevance") return recipes; // already sorted by Fuse.js

  const sorted = [...recipes].sort((a, b) => {
    let aVal: number | string, bVal: number | string;
    switch (field) {
      case "name":     aVal = a.name; bVal = b.name; break;
      case "kcal":     aVal = a.nutrition.per100g.kcal; bVal = b.nutrition.per100g.kcal; break;
      case "protein":  aVal = a.nutrition.per100g.protein; bVal = b.nutrition.per100g.protein; break;
      case "fat":      aVal = a.nutrition.per100g.fat; bVal = b.nutrition.per100g.fat; break;
      case "fpdfPac":  aVal = a.fpdfPac ?? 0; bVal = b.fpdfPac ?? 0; break;
      default:         return 0;
    }
    if (typeof aVal === "string") return dir === "asc"
      ? aVal.localeCompare(bVal as string)
      : (bVal as string).localeCompare(aVal);
    return dir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  return sorted;
}
```

### URL State Synchronization

All filter and search state should be reflected in the URL query string so that:
- Users can bookmark filtered views
- Browser back/forward works correctly
- Links can be shared with filters applied

```
/creami?q=banana&tags=Vegan,Fruit&kcal=0-100&sort=protein-desc&page=2
```

```typescript
// src/creami/hooks/useFilterState.ts

import { useSearchParams } from 'react-router-dom';

export function useFilterState(): [ActiveFilters, (f: Partial<ActiveFilters>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ActiveFilters = {
    tags: searchParams.get('tags')?.split(',').filter(Boolean) ?? [],
    categories: (searchParams.get('cat')?.split(',') ?? []) as Category[],
    kcalRange: parseRange(searchParams.get('kcal'), 0, 300),
    proteinRange: parseRange(searchParams.get('protein'), 0, 30),
    fatRange: parseRange(searchParams.get('fat'), 0, 25),
    pacRange: parseRange(searchParams.get('pac'), 0, 50),
    sources: (searchParams.get('src')?.split(',') ?? []) as RecipeSource[],
    sort: (searchParams.get('sort')?.split('-')[0] ?? 'name') as SortField,
    sortDir: (searchParams.get('sort')?.split('-')[1] ?? 'asc') as 'asc' | 'desc',
  };

  const setFilters = (update: Partial<ActiveFilters>) => {
    // serialize to URL params...
  };

  return [filters, setFilters];
}
```

---

## 5. File and Directory Structure

```
C:\Users\1matt\OneDrive\Documents\atmix\
|
|-- src/
|   |-- creami/                          # Creami sub-application
|   |   |-- CreamiApp.tsx                # Root component with nested routes
|   |   |-- types.ts                     # All TypeScript interfaces
|   |   |
|   |   |-- components/                  # Shared UI components
|   |   |   |-- CreamiLayout.tsx         # Header + main + footer shell
|   |   |   |-- CreamiHeader.tsx         # Top navigation bar
|   |   |   |-- CreamiFooter.tsx         # Attribution footer
|   |   |   |-- CreamiSkeleton.tsx       # Loading skeleton for Suspense
|   |   |   |-- SearchBar.tsx            # Debounced text input
|   |   |   |-- FilterSidebar.tsx        # Desktop sidebar / mobile slide-over
|   |   |   |-- FilterSection.tsx        # Collapsible filter group
|   |   |   |-- CategoryChips.tsx        # Horizontal chip selector
|   |   |   |-- TagCheckboxGroup.tsx     # Multi-select checkboxes by group
|   |   |   |-- RangeSlider.tsx          # Dual-thumb range slider
|   |   |   |-- SourceToggle.tsx         # jhermann / FPF toggle
|   |   |   |-- ActiveFilters.tsx        # Active filter pill display
|   |   |   |-- RecipeGrid.tsx           # Responsive CSS grid container
|   |   |   |-- RecipeCard.tsx           # Individual recipe thumbnail card
|   |   |   |-- Pagination.tsx           # Page navigation
|   |   |   |-- SortControls.tsx         # Sort field + direction selector
|   |   |   |-- EmptyState.tsx           # "No recipes found" illustration
|   |   |   |-- RecipeHero.tsx           # Detail page hero image
|   |   |   |-- TagList.tsx              # Horizontal tag display (clickable)
|   |   |   |-- SourceBadge.tsx          # Source indicator badge
|   |   |   |-- NutritionPanel.tsx       # Macro display panel
|   |   |   |-- NutritionSummary.tsx     # Single nutrition block display
|   |   |   |-- MacroChart.tsx           # Visual bar chart of macros
|   |   |   |-- PacScoreBadge.tsx        # FPDF/PAC visual indicator
|   |   |   |-- ProteinRatioBadge.tsx    # Protein ratio indicator
|   |   |   |-- ServingToggle.tsx        # per100g / perServing / total toggle
|   |   |   |-- IngredientList.tsx       # Grouped ingredient display
|   |   |   |-- IngredientGroup.tsx      # Single step group
|   |   |   |-- DirectionsList.tsx       # Numbered directions
|   |   |   |-- ChangelogSection.tsx     # Recipe version history
|   |   |   |-- ImageGallery.tsx         # Lightbox-style image gallery
|   |   |   |-- BackLink.tsx             # Breadcrumb back navigation
|   |   |
|   |   |-- pages/                       # Route-level page components
|   |   |   |-- RecipeListPage.tsx       # Browse/search page
|   |   |   |-- RecipeDetailPage.tsx     # Single recipe view
|   |   |
|   |   |-- hooks/                       # Custom React hooks
|   |   |   |-- useRecipes.ts            # Data fetching + caching
|   |   |   |-- useFilterState.ts        # URL-synced filter state
|   |   |   |-- useSearch.ts             # Fuse.js search wrapper
|   |   |   |-- useDebounce.ts           # Debounce utility hook
|   |   |
|   |   |-- lib/                         # Non-React utilities
|   |   |   |-- search.ts               # Fuse.js initialization + search
|   |   |   |-- filter.ts               # Filter pipeline + sort
|   |   |   |-- constants.ts            # Default filter values, category defs
|   |   |   |-- format.ts               # Number formatting, unit display
|   |   |
|   |   |-- context/                     # React context providers
|   |   |   |-- RecipeContext.tsx         # Global recipe data + tag metadata
|   |
|   |-- App.tsx                          # Existing root (add creami route)
|   |-- main.tsx                         # Existing entry point
|   |-- index.css                        # Existing global styles
|
|-- public/
|   |-- creami/
|   |   |-- data/
|   |   |   |-- recipes.json             # Generated: all recipe data
|   |   |   |-- tags.json                # Generated: tag taxonomy
|   |   |-- images/
|   |   |   |-- og-creami.jpg            # Open Graph social image
|   |   |   |-- creami-logo.svg          # Branding logo
|   |   |   |-- empty-state.svg          # No-results illustration
|
|-- creami/                              # Data source repository (submodule or copy)
|   |-- recipes/                         # 121 recipe directories
|   |   |-- Banana Ice Cream (Deluxe)/
|   |   |   |-- README.md
|   |   |   |-- Ice-Cream-Recipes.csv
|   |   |   |-- *.jpg, *.png
|   |   |-- ...
|   |-- data/
|   |   |-- fpf/
|   |   |   |-- videos.json              # Scraped YouTube data
|   |   |   |-- README.md
|   |-- scripts/
|   |   |-- build-recipe-db.py           # NEW: main data pipeline script
|   |   |-- ice-cream-recipe.py          # Existing: CSV parser (reused)
|   |   |-- scrape-fpf.py               # Existing: YouTube scraper
|   |   |-- icc-tool.py                  # Existing: ICC export tool
|
|-- vite.config.ts                       # Updated: add /creami SPA route
|-- tailwind.config.js                   # Updated: add creami color palette
|-- package.json                         # Updated: add fuse.js, build:data script
```

---

## 6. Build Pipeline

### Full Build Flow

```
                    DEVELOPMENT                              PRODUCTION
                    ===========                              ==========

 [1] Edit recipe CSVs/MDs                     [1] git push / CI trigger
          |                                            |
          v                                            v
 [2] python build-recipe-db.py                [2] npm run build:data
     --> public/creami/data/recipes.json           (same script)
     --> public/creami/data/tags.json                  |
          |                                            v
          v                                    [3] npm run build
 [3] vite dev (hot reload)                         tsc && vite build
     Serves /creami/* from React app                   |
     Serves /creami/data/*.json from public/           v
                                               [4] dist/ directory
                                                   dist/creami/data/recipes.json
                                                   dist/creami/data/tags.json
                                                   dist/index.html
                                                   dist/creami/index.html (SPA)
                                                   dist/assets/*.js, *.css
                                                        |
                                                        v
                                               [5] Deploy to Vercel
                                                   (or any static host)
```

### Vite Configuration Changes

File: `C:\Users\1matt\OneDrive\Documents\atmix\vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function spaRoutes(routes: string[]) {
  return {
    name: 'spa-routes',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const indexPath = resolve(distDir, 'index.html');
      routes.forEach(route => {
        const routeDir = resolve(distDir, route);
        if (!existsSync(routeDir)) {
          mkdirSync(routeDir, { recursive: true });
        }
        copyFileSync(indexPath, resolve(routeDir, 'index.html'));
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    spaRoutes([
      'working-together',
      'walkies',
      'projects',
      'creami',           // NEW: SPA fallback for /creami
    ])
  ],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'creami-vendor': ['fuse.js'],     // separate chunk for search lib
        },
      },
    },
  },
});
```

### Package.json Script Updates

```json
{
  "scripts": {
    "dev": "vite",
    "build": "npm run build:data && tsc && vite build",
    "build:data": "python creami/scripts/build-recipe-db.py",
    "preview": "vite preview"
  },
  "dependencies": {
    "fuse.js": "^7.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3"
  }
}
```

Note: TinaCMS dependencies should remain if still used for the main atmix site, but are not needed for the creami sub-app.

### Lazy Loading the Creami App

File: `C:\Users\1matt\OneDrive\Documents\atmix\src\App.tsx` (modification)

```typescript
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy-load the creami sub-application (separate chunk)
const CreamiApp = lazy(() => import('./creami/CreamiApp'));

function App() {
  return (
    <Routes>
      {/* existing routes */}
      <Route path="/creami/*" element={
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <CreamiApp />
        </Suspense>
      } />
    </Routes>
  );
}
```

---

## 7. Performance Strategy

### Bundle Splitting

| Chunk | Contents | Est. Size (gzip) |
|-------|----------|------------------|
| `main` | Existing atmix app | ~40 KB |
| `creami` | CreamiApp + all components | ~25-35 KB |
| `creami-vendor` | fuse.js | ~5 KB |
| **Total first load for /creami** | | **~70-80 KB JS** |

### Data Loading Strategy

```typescript
// src/creami/hooks/useRecipes.ts

import { useState, useEffect, useRef } from 'react';
import type { Recipe, TagMeta } from '../types';

interface RecipeData {
  recipes: Recipe[];
  tags: TagMeta[];
  loading: boolean;
  error: string | null;
}

export function useRecipes(): RecipeData {
  const [data, setData] = useState<RecipeData>({
    recipes: [],
    tags: [],
    loading: true,
    error: null,
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Fetch both files in parallel
    Promise.all([
      fetch('/creami/data/recipes.json').then(r => r.json()),
      fetch('/creami/data/tags.json').then(r => r.json()),
    ])
    .then(([recipes, tagData]) => {
      setData({
        recipes,
        tags: tagData.tags,
        loading: false,
        error: null,
      });
    })
    .catch(err => {
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    });
  }, []);

  return data;
}
```

### Image Loading

All recipe images are external (GitHub raw URLs or YouTube thumbnails), so they do not affect bundle size. Strategy:

1. **RecipeCard thumbnails**: Use `loading="lazy"` native attribute
2. **RecipeDetailPage hero**: Eager load (above the fold)
3. **ImageGallery**: Lazy load all gallery images
4. **Placeholder**: Show a colored placeholder div with recipe initials while image loads
5. **Error handling**: Show a generic ice cream icon on image load failure

```typescript
// src/creami/components/RecipeCard.tsx (image strategy)

function RecipeImage({ src, alt }: { src: string | null; alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-purple-100
                      flex items-center justify-center text-4xl">
        {alt.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
      className="w-full h-48 object-cover"
    />
  );
}
```

### Search Performance

- **Index initialization**: Fuse.js creates its index on first search, not on data load. For 200 recipes this takes <10ms.
- **Search execution**: Each search takes <5ms for 200 records with the configured options.
- **Debounce**: SearchBar debounces input by 200ms to avoid excessive re-renders during typing.

### CSS Performance

- Tailwind purges unused classes at build time
- No custom CSS file needed for the creami app (Tailwind utility classes only)
- Extend the existing `tailwind.config.js` with creami-specific colors

### Tailwind Config Extension

```javascript
// Addition to tailwind.config.js theme.extend.colors

creami: {
  cream:    '#fdf6e3',    // warm background
  vanilla:  '#fff8dc',    // card background
  berry:    '#8b2252',    // primary accent
  mint:     '#3eb489',    // secondary accent (for vegan/healthy)
  choco:    '#3c1518',    // dark accent
  caramel:  '#d4a574',    // warm accent
  frost:    '#e8f4f8',    // cool accent (for light/sorbet)
},
```

---

## 8. Routing Architecture

### URL Structure

```
/creami                          -- Recipe list (browse/search)
/creami?q=banana                 -- Search results
/creami?tags=Vegan,Fruit         -- Filtered by tags
/creami?cat=dairy                -- Filtered by category
/creami?kcal=0-100&protein=10-30 -- Nutritional filter
/creami?sort=protein-desc&page=2 -- Sorted and paginated
/creami/banana-ice-cream-deluxe  -- Recipe detail page
```

### SPA Route Handling

Since the site is statically deployed, all `/creami/*` URLs must resolve to the same `index.html`. The Vite `spaRoutes` plugin handles this by copying `index.html` to `dist/creami/index.html`. React Router then handles client-side routing.

For recipe detail pages (`/creami/:slug`), the Vercel `vercel.json` or equivalent rewrite rule is needed:

```json
{
  "rewrites": [
    { "source": "/creami/(.*)", "destination": "/creami/index.html" }
  ]
}
```

---

## 9. State Management

No external state library needed. The state architecture uses:

1. **RecipeContext** (React Context): Holds the full recipe dataset and tag metadata after initial fetch. Provided once at CreamiApp level. Never changes after load.

2. **URL State** (React Router `useSearchParams`): All filter/search/pagination state lives in the URL. This is the source of truth for the list page.

3. **Local Component State**: Ephemeral UI state (sidebar open/closed, image gallery index, etc.)

```
RecipeContext (loaded once)
    |
    +-- RecipeListPage
    |     |-- useSearchParams() for filters
    |     |-- useMemo() for filtered/searched results
    |     |-- useState() for UI toggles
    |
    +-- RecipeDetailPage
          |-- useParams() for slug
          |-- useMemo() to find recipe by slug
```

---

## 10. Implementation Priority and Agent Parallelization

### Workstreams (can execute in parallel)

**Agent 1: Data Pipeline** (Python)
- Write `creami/scripts/build-recipe-db.py`
- Parse all 121 recipe CSVs + README.md files
- Generate `public/creami/data/recipes.json`
- Generate `public/creami/data/tags.json`
- Add validation and error reporting
- Dependencies: none (works with existing source data)

**Agent 2: Core Infrastructure** (TypeScript/React)
- Create `src/creami/types.ts` with all interfaces
- Create `src/creami/CreamiApp.tsx` with routing
- Create `src/creami/context/RecipeContext.tsx`
- Create `src/creami/hooks/useRecipes.ts`, `useFilterState.ts`, `useSearch.ts`, `useDebounce.ts`
- Create `src/creami/lib/search.ts`, `filter.ts`, `constants.ts`, `format.ts`
- Update `src/App.tsx` to add lazy-loaded creami route
- Update `vite.config.ts` for SPA route
- Install fuse.js dependency
- Dependencies: none (types are self-contained)

**Agent 3: List Page UI** (React Components)
- Create `src/creami/pages/RecipeListPage.tsx`
- Create: SearchBar, FilterSidebar, FilterSection, CategoryChips, TagCheckboxGroup, RangeSlider, SourceToggle, ActiveFilters, RecipeGrid, RecipeCard, Pagination, SortControls, EmptyState
- Dependencies: types from Agent 2 (can start with copy of types.ts)

**Agent 4: Detail Page UI** (React Components)
- Create `src/creami/pages/RecipeDetailPage.tsx`
- Create: RecipeHero, TagList, SourceBadge, NutritionPanel, NutritionSummary, MacroChart, PacScoreBadge, ProteinRatioBadge, ServingToggle, IngredientList, IngredientGroup, DirectionsList, ChangelogSection, ImageGallery, BackLink
- Dependencies: types from Agent 2 (can start with copy of types.ts)

**Agent 5: Layout and Styling** (React + Tailwind)
- Create `src/creami/components/CreamiLayout.tsx`, `CreamiHeader.tsx`, `CreamiFooter.tsx`, `CreamiSkeleton.tsx`
- Update `tailwind.config.js` with creami color palette
- Design assets: og-creami.jpg, creami-logo.svg, empty-state.svg
- Dependencies: none

### Integration Order

1. Agents 1-5 work in parallel
2. Agent 2 output is the integration point
3. Agents 3 + 4 merge their components into the routing from Agent 2
4. Agent 1 output (JSON files) is verified against Agent 2 types
5. Agent 5 layout wraps everything

### Verification Checklist

- [ ] `build-recipe-db.py` produces valid JSON matching TypeScript types
- [ ] All 121 jhermann recipes parse without errors
- [ ] FPF recipes (when available) transform correctly
- [ ] Fuse.js search returns relevant results for "banana", "vegan chocolate", "low calorie"
- [ ] Tag filtering correctly narrows results (AND logic)
- [ ] Category chips correctly broaden results (OR logic)
- [ ] Nutrition range sliders filter per-100g values
- [ ] URL state round-trips: apply filters, copy URL, paste in new tab, same results
- [ ] Recipe detail page renders all sections for a complex recipe (Banana Ice Cream)
- [ ] Recipe detail page handles missing data gracefully (FPF recipe without nutrition)
- [ ] Mobile responsive: filter sidebar becomes slide-over, grid becomes single column
- [ ] Images lazy-load and handle errors
- [ ] Page loads in <2s on 3G simulated throttle
- [ ] Total JS bundle for /creami route is <100KB gzipped
