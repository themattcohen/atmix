import { useParams } from 'react-router-dom';
import recipesData from '../data/recipes.json';
import { type Recipe } from '../lib/types';
import RecipeDetail from '../components/RecipeDetail';
import { Link } from 'react-router-dom';

const allRecipes: Recipe[] = recipesData as Recipe[];

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const recipe = allRecipes.find((r) => r.slug === slug);

  if (!recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-6xl mb-4 block">🍨</span>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Recipe Not Found</h1>
        <p className="text-slate-500 mb-6">
          We couldn't find a recipe matching "{slug}".
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Browse all recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <RecipeDetail recipe={recipe} />
    </div>
  );
}
