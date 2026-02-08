import { type Recipe } from '../lib/types';
import RecipeCard from './RecipeCard';

interface RecipeGridProps {
  recipes: Recipe[];
  loading?: boolean;
}

export default function RecipeGrid({ recipes, loading }: RecipeGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-slate-200" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-5 bg-slate-200 rounded-full w-16" />
                <div className="h-5 bg-slate-200 rounded-full w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="text-5xl mb-4 block">🔍</span>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No recipes found</h3>
        <p className="text-slate-500">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
