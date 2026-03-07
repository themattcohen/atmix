import { Link } from 'react-router-dom';
import { type Restaurant } from '../lib/types';

interface RestaurantCardProps {
  restaurant: Restaurant;
}

const PLACEHOLDER_COLORS = [
  'from-red-200 to-orange-200',
  'from-blue-200 to-indigo-200',
  'from-green-200 to-teal-200',
  'from-amber-200 to-yellow-200',
  'from-purple-200 to-pink-200',
  'from-cyan-200 to-blue-200',
  'from-rose-200 to-red-200',
];

function getPlaceholderGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const hasImage = !!restaurant.image;
  const cuisineText = restaurant.cuisines.join(', ') || 'Various';
  const neighborhoodText = restaurant.neighborhoods.join(', ');
  const hasCourses = restaurant.courses.length > 0;

  return (
    <Link
      to={`/restaurant/${restaurant.slug}`}
      className="group block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-red-300 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="aspect-[16/9] overflow-hidden bg-slate-100">
        {hasImage ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getPlaceholderGradient(restaurant.name)} flex items-center justify-center`}
          >
            <span className="text-4xl opacity-40 font-bold text-slate-600">
              {restaurant.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 mb-1 line-clamp-1 group-hover:text-red-700 transition-colors">
          {restaurant.name}
        </h3>

        {/* Cuisine */}
        <p className="text-sm text-red-700 font-medium mb-1">{cuisineText}</p>

        {/* Neighborhood */}
        {neighborhoodText && (
          <p className="text-xs text-slate-500 mb-2">{neighborhoodText}</p>
        )}

        {/* Address */}
        {restaurant.address && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-1">{restaurant.address}</p>
        )}

        {/* Bottom row: tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {restaurant.price_point && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
              ${restaurant.price_point}
            </span>
          )}
          {hasCourses && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              {restaurant.courses.length} courses
            </span>
          )}
          {restaurant.features.map((f) => (
            <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
              {f}
            </span>
          ))}
          {restaurant.dietary.map((d) => (
            <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
              {d}
            </span>
          ))}
          {restaurant.amenities.slice(0, 2).map((a) => (
            <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {a}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
