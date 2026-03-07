import { type Restaurant } from '../lib/types';

interface HeroSectionProps {
  restaurants: Restaurant[];
}

export default function HeroSection({ restaurants }: HeroSectionProps) {
  const withMenus = restaurants.filter((r) => r.courses.length > 0).length;
  const cuisineCount = new Set(restaurants.flatMap((r) => r.cuisines)).size;
  const neighborhoodCount = new Set(restaurants.flatMap((r) => r.neighborhoods)).size;

  return (
    <div className="bg-gradient-to-br from-red-800 to-red-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Denver Restaurant Week 2026
        </h1>
        <p className="text-red-200 text-lg mb-8 max-w-2xl">
          March 6-15 | Explore menus, filter by cuisine, neighborhood, and more.
        </p>

        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{restaurants.length}</div>
            <div className="text-xs text-red-300 uppercase tracking-wide">Restaurants</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{withMenus}</div>
            <div className="text-xs text-red-300 uppercase tracking-wide">With Menus</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{cuisineCount}</div>
            <div className="text-xs text-red-300 uppercase tracking-wide">Cuisines</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{neighborhoodCount}</div>
            <div className="text-xs text-red-300 uppercase tracking-wide">Neighborhoods</div>
          </div>
        </div>
      </div>
    </div>
  );
}
