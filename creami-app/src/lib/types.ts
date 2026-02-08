export interface IngredientItem {
  amount: string;
  unit: string;
  name: string;
  comment: string;
}

export interface IngredientStep {
  step: string;
  items: IngredientItem[];
}

export interface Nutrition {
  kcal: number;
  fat: number;
  carbs: number;
  sugar: number;
  protein: number;
  salt: number;
}

export interface NutritionTotal extends Nutrition {
  weight: number;
}

export interface Recipe {
  id: string;
  name: string;
  slug: string;
  source: "jhermann" | "fpf";
  description: string;
  tags: string[];
  nutrition: Nutrition;
  nutritionTotal: NutritionTotal;
  fpdf: number | null;
  proteinRatio: number | null;
  ingredients: IngredientStep[];
  directions: string[];
  images: string[];
  rating: string | null;
  isScoopable: boolean;
  isLight: boolean;
  isVegan: boolean;
  isDraft: boolean;
  canonicalUrl: string | null;
}
