import { type Recipe } from '../lib/types';

interface HeroSectionProps {
  recipes: Recipe[];
  onQuickFilter?: (filterKey: string | null) => void;
  activeFilter?: string | null;
}

export default function HeroSection({ recipes, onQuickFilter, activeFilter }: HeroSectionProps) {
  const totalRecipes = recipes.length;
  const allTags = new Set(recipes.flatMap((r) => r.tags));
  const scoopable = recipes.filter((r) => r.isScoopable).length;
  const vegan = recipes.filter((r) => r.isVegan).length;

  const stats = [
    { label: 'Recipes', value: totalRecipes, icon: '🍨', filterKey: null as string | null },
    { label: 'Tags', value: allTags.size, icon: '🏷️', filterKey: 'tags' as string | null },
    { label: 'Scoopable', value: scoopable, icon: '🥄', filterKey: 'scoopable' },
    { label: 'Vegan', value: vegan, icon: '🌿', filterKey: 'vegan' },
  ];

  return (
    <section className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Ninja Creami Recipes
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tested recipes with real nutritional data, scoopability scores, and
            scientific formulation. Find your next frozen creation.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {stats.map((stat) => {
            const isActive = activeFilter === stat.filterKey ||
              (stat.filterKey === null && !activeFilter);
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => onQuickFilter?.(stat.filterKey)}
                className={`rounded-xl border p-4 text-center shadow-sm transition-all cursor-pointer ${
                  isActive && stat.filterKey !== null
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <span className="text-2xl mb-1 block">{stat.icon}</span>
                <span className={`text-2xl font-bold block ${
                  isActive && stat.filterKey !== null ? 'text-white' : 'text-slate-900'
                }`}>
                  {stat.value}
                </span>
                <span className={`text-xs uppercase tracking-wide ${
                  isActive && stat.filterKey !== null ? 'text-indigo-100' : 'text-slate-500'
                }`}>
                  {stat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
