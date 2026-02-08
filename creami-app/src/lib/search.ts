import Fuse, { type IFuseOptions } from "fuse.js";
import type { Recipe } from "./types";

const fuseOptions: IFuseOptions<Recipe> = {
  keys: [
    { name: "name", weight: 2 },
    { name: "description", weight: 1 },
    { name: "tags", weight: 1 },
    { name: "ingredients.items.name", weight: 0.8 },
  ],
  threshold: 0.3,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

let fuseInstance: Fuse<Recipe> | null = null;

function getFuseInstance(recipes: Recipe[]): Fuse<Recipe> {
  if (!fuseInstance) {
    fuseInstance = new Fuse(recipes, fuseOptions);
  }
  return fuseInstance;
}

/**
 * Reset the Fuse index when the recipe data changes.
 */
export function resetSearchIndex(): void {
  fuseInstance = null;
}

/**
 * Search recipes using fuzzy matching.
 * Returns all recipes if query is empty.
 */
export function searchRecipes(
  recipes: Recipe[],
  query: string,
): Recipe[] {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return recipes;
  }

  const fuse = getFuseInstance(recipes);
  const results = fuse.search(trimmed);

  return results.map((result) => result.item);
}
