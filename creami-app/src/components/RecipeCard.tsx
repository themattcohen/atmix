import { Link } from 'react-router-dom';
import { type Recipe } from '../lib/types';
import TagChip from './TagChip';

interface RecipeCardProps {
  recipe: Recipe;
}

const PLACEHOLDER_COLORS = [
  'from-pink-200 to-purple-200',
  'from-blue-200 to-indigo-200',
  'from-green-200 to-teal-200',
  'from-orange-200 to-red-200',
  'from-yellow-200 to-amber-200',
  'from-cyan-200 to-blue-200',
  'from-violet-200 to-fuchsia-200',
];

function getPlaceholderGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const hasImage = recipe.images.length > 0;
  const imageSrc = hasImage
    ? `/creami/images/${recipe.slug}/${recipe.images[0]}`
    : null;

  const displayTags = recipe.tags
    .filter((t) => !['Erythritol', 'Polysaccharide Gum', 'Emulsifier', 'Xylitol', 'Stevia', 'Sucralose', 'Tylo Powder (CMC)', 'Allulose'].includes(t))
    .slice(0, 4);

  return (
    <Link
      to={`/recipe/${recipe.slug}`}
      className="group block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={recipe.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getPlaceholderGradient(recipe.name)} flex items-center justify-center`}
          >
            <span className="text-5xl opacity-60">🍦</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {recipe.name}
        </h3>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          {recipe.nutrition && (
            <span className="font-mono">{Math.round(recipe.nutrition.kcal)} kcal</span>
          )}
          {recipe.fpdf !== null && (
            <span className="font-mono">FPDF {recipe.fpdf.toFixed(0)}</span>
          )}
          {recipe.nutrition?.protein > 0 && (
            <span className="font-mono">{recipe.nutrition.protein.toFixed(1)}g protein</span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {displayTags.map((tag) => (
            <TagChip key={tag} tag={tag} size="sm" />
          ))}
        </div>

        {/* Rating */}
        {recipe.rating && (
          <div className="mt-2 text-sm">{recipe.rating}</div>
        )}
      </div>
    </Link>
  );
}
