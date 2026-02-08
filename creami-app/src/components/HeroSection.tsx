import { type Recipe } from '../lib/types';

interface HeroSectionProps {
  recipes: Recipe[];
}

export default function HeroSection({ recipes }: HeroSectionProps) {
  const totalRecipes = recipes.length;
  const allTags = new Set(recipes.flatMap((r) => r.tags));
  const scoopable = recipes.filter((r) => r.isScoopable).length;
  const vegan = recipes.filter((r) => r.isVegan).length;

  const stats = [
    { label: 'Recipes', value: totalRecipes, icon: '🍨' },
    { label: 'Tags', value: allTags.size, icon: '🏷️' },
    { label: 'Scoopable', value: scoopable, icon: '🥄' },
    { label: 'Vegan', value: vegan, icon: '🌿' },
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
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm"
            >
              <span className="text-2xl mb-1 block">{stat.icon}</span>
              <span className="text-2xl font-bold text-slate-900 block">
                {stat.value}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
