import { type Restaurant } from '../lib/types';
import RestaurantCard from './RestaurantCard';

interface RestaurantGridProps {
  restaurants: Restaurant[];
}

export default function RestaurantGrid({ restaurants }: RestaurantGridProps) {
  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-lg">No restaurants match your filters.</p>
        <p className="text-slate-400 text-sm mt-2">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {restaurants.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </div>
  );
}
