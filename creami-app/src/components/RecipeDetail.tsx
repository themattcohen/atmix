import { Link } from 'react-router-dom';
import { type Recipe } from '../lib/types';
import TagChip from './TagChip';
import { NutritionBar } from './NutritionBadge';

interface RecipeDetailProps {
  recipe: Recipe;
}

export default function RecipeDetail({ recipe }: RecipeDetailProps) {
  return (
    <article className="max-w-4xl mx-auto">
      {/* Back nav */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to recipes
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{recipe.name}</h1>
        {recipe.rating && <div className="text-xl mb-3">{recipe.rating}</div>}
        <p className="text-lg text-slate-600 leading-relaxed">{recipe.description}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {recipe.tags.map((tag) => (
            <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
              <TagChip tag={tag} size="md" />
            </Link>
          ))}
        </div>
      </div>

      {/* Images */}
      {recipe.images.length > 0 && (
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {recipe.images.map((img, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-slate-200">
              <img
                src={`/creami/images/${recipe.slug}/${img}`}
                alt={`${recipe.name} - photo ${i + 1}`}
                loading="lazy"
                className="w-full h-48 object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Nutrition */}
      <section className="mb-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Nutrition per 100g</h2>
        <NutritionBar
          nutrition={recipe.nutrition}
          fpdf={recipe.fpdf}
          proteinRatio={recipe.proteinRatio}
        />
        {recipe.nutritionTotal && recipe.nutritionTotal.weight > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Full batch:</strong> {recipe.nutritionTotal.weight}g total —{' '}
              {Math.round(recipe.nutritionTotal.kcal)} kcal,{' '}
              {recipe.nutritionTotal.protein.toFixed(1)}g protein,{' '}
              {recipe.nutritionTotal.fat.toFixed(1)}g fat,{' '}
              {recipe.nutritionTotal.carbs.toFixed(1)}g carbs
            </p>
          </div>
        )}
      </section>

      {/* Ingredients */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Ingredients</h2>
        <div className="space-y-6">
          {recipe.ingredients.map((group) => (
            <div key={group.step}>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                {group.step}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono text-sm text-slate-500 w-20 shrink-0 text-right">
                      {item.amount}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                    <div className="flex-1">
                      <span className="text-slate-900">{item.name}</span>
                      {item.comment && (
                        <span className="text-slate-500 text-sm ml-2">— {item.comment}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Directions */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Directions</h2>
        <ol className="space-y-3">
          {recipe.directions.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-slate-700 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Source */}
      {recipe.canonicalUrl && (
        <section className="mb-8 text-sm text-slate-500">
          <a
            href={recipe.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            View original recipe
          </a>
        </section>
      )}
    </article>
  );
}
