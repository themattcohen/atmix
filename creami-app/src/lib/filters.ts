import type { Recipe } from "./types";

/* ------------------------------------------------------------------ */
/*  Filter parameter types                                             */
/* ------------------------------------------------------------------ */

export interface NutritionRange {
  min?: number;
  max?: number;
}

export interface NutritionFilters {
  kcal?: NutritionRange;
  fat?: NutritionRange;
  carbs?: NutritionRange;
  sugar?: NutritionRange;
  protein?: NutritionRange;
  salt?: NutritionRange;
}

export interface FPDFRange {
  min?: number;
  max?: number;
}

export interface QuickFilters {
  isVegan?: boolean;
  isLight?: boolean;
  isScoopable?: boolean;
  lowSugar?: boolean;
}

export interface FilterParams {
  tags?: string[];
  nutrition?: NutritionFilters;
  fpdf?: FPDFRange;
  source?: "jhermann" | "fpf";
  quick?: QuickFilters;
}

/* ------------------------------------------------------------------ */
/*  Individual filter functions (pure)                                 */
/* ------------------------------------------------------------------ */

/**
 * Filter recipes that include ALL of the specified tags.
 */
export function filterByTags(recipes: Recipe[], tags: string[]): Recipe[] {
  if (tags.length === 0) return recipes;

  return recipes.filter((recipe) =>
    tags.every((tag) => recipe.tags.includes(tag)),
  );
}

/**
 * Check whether a value falls within an optional min/max range.
 */
function inRange(value: number, range: NutritionRange | undefined): boolean {
  if (!range) return true;
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

/**
 * Filter recipes by per-serving nutrition ranges.
 */
export function filterByNutrition(
  recipes: Recipe[],
  filters: NutritionFilters,
): Recipe[] {
  return recipes.filter((recipe) => {
    const n = recipe.nutrition;
    return (
      inRange(n.kcal, filters.kcal) &&
      inRange(n.fat, filters.fat) &&
      inRange(n.carbs, filters.carbs) &&
      inRange(n.sugar, filters.sugar) &&
      inRange(n.protein, filters.protein) &&
      inRange(n.salt, filters.salt)
    );
  });
}

/**
 * Filter recipes by FPDF (fat/protein/dry-fruit) ratio range.
 * Recipes without an FPDF value are excluded when a filter is active.
 */
export function filterByFPDF(
  recipes: Recipe[],
  range: FPDFRange,
): Recipe[] {
  return recipes.filter((recipe) => {
    if (recipe.fpdf === null) return false;
    return inRange(recipe.fpdf, range);
  });
}

/**
 * Filter recipes by data source.
 */
export function filterBySource(
  recipes: Recipe[],
  source: "jhermann" | "fpf",
): Recipe[] {
  return recipes.filter((recipe) => recipe.source === source);
}

/**
 * Apply quick boolean filters.
 * "lowSugar" is defined as sugar per serving <= 10 g.
 */
export function filterByQuick(
  recipes: Recipe[],
  quick: QuickFilters,
): Recipe[] {
  const LOW_SUGAR_THRESHOLD = 10;

  return recipes.filter((recipe) => {
    if (quick.isVegan && !recipe.isVegan) return false;
    if (quick.isLight && !recipe.isLight) return false;
    if (quick.isScoopable && !recipe.isScoopable) return false;
    if (quick.lowSugar && recipe.nutrition.sugar > LOW_SUGAR_THRESHOLD) {
      return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Composite filter                                                   */
/* ------------------------------------------------------------------ */

/**
 * Apply all active filters in sequence.
 * Each filter is only applied when the corresponding param is provided.
 */
export function applyFilters(
  recipes: Recipe[],
  params: FilterParams,
): Recipe[] {
  let result = recipes;

  if (params.tags && params.tags.length > 0) {
    result = filterByTags(result, params.tags);
  }

  if (params.nutrition) {
    result = filterByNutrition(result, params.nutrition);
  }

  if (params.fpdf) {
    result = filterByFPDF(result, params.fpdf);
  }

  if (params.source) {
    result = filterBySource(result, params.source);
  }

  if (params.quick) {
    result = filterByQuick(result, params.quick);
  }

  return result;
}
