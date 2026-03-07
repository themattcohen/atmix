import { type Restaurant } from '../lib/types';

export interface FilterState {
  cuisines: string[];
  neighborhoods: string[];
  features: string[];
  dietary: string[];
  pricePoints: string[];
  hasMenu: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  cuisines: [],
  neighborhoods: [],
  features: [],
  dietary: [],
  pricePoints: [],
  hasMenu: false,
};

interface FilterPanelProps {
  restaurants: Restaurant[];
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

function getCountMap(restaurants: Restaurant[], field: 'cuisines' | 'neighborhoods' | 'amenities' | 'features' | 'dietary'): Map<string, number> {
  const counts = new Map<string, number>();
  restaurants.forEach((r) => {
    const values = r[field];
    values.forEach((v) => {
      counts.set(v, (counts.get(v) || 0) + 1);
    });
  });
  return counts;
}

function FilterGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: [string, number][];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map(([item, count]) => (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
              selected.includes(item)
                ? 'bg-red-700 text-white border-red-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
            }`}
          >
            {item}
            <span className="opacity-60">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FilterPanel({ restaurants, filters, onFilterChange }: FilterPanelProps) {
  const cuisineCounts = [...getCountMap(restaurants, 'cuisines').entries()].sort((a, b) => b[1] - a[1]);
  const neighborhoodCounts = [...getCountMap(restaurants, 'neighborhoods').entries()].sort((a, b) => b[1] - a[1]);
  const featureCounts = [...getCountMap(restaurants, 'features').entries()].sort((a, b) => b[1] - a[1]);
  const dietaryCounts = [...getCountMap(restaurants, 'dietary').entries()].sort((a, b) => b[1] - a[1]);

  const toggle = (field: 'cuisines' | 'neighborhoods' | 'features' | 'dietary', item: string) => {
    const current = filters[field];
    const next = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    onFilterChange({ ...filters, [field]: next });
  };

  const pricePointCounts = new Map<string, number>();
  restaurants.forEach((r) => {
    if (r.price_point) {
      pricePointCounts.set(r.price_point, (pricePointCounts.get(r.price_point) || 0) + 1);
    }
  });
  const pricePoints = [...pricePointCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));

  const togglePrice = (pp: string) => {
    const next = filters.pricePoints.includes(pp)
      ? filters.pricePoints.filter((p) => p !== pp)
      : [...filters.pricePoints, pp];
    onFilterChange({ ...filters, pricePoints: next });
  };

  const hasActiveFilters =
    filters.cuisines.length > 0 ||
    filters.neighborhoods.length > 0 ||
    filters.features.length > 0 ||
    filters.dietary.length > 0 ||
    filters.pricePoints.length > 0 ||
    filters.hasMenu;

  return (
    <div className="space-y-6">
      {/* Quick toggles */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Filters</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, hasMenu: !filters.hasMenu })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              filters.hasMenu
                ? 'bg-red-700 text-white border-red-700'
                : 'bg-white text-slate-700 border-slate-200 hover:border-red-300'
            }`}
          >
            Has Menu
          </button>
        </div>
      </div>

      {/* Price Point */}
      {pricePoints.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Price Point</h3>
          <div className="flex flex-wrap gap-2">
            {pricePoints.map(([pp, count]) => (
              <button
                key={pp}
                type="button"
                onClick={() => togglePrice(pp)}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                  filters.pricePoints.includes(pp)
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
                }`}
              >
                ${pp}
                <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <FilterGroup
        title="Cuisine"
        items={cuisineCounts}
        selected={filters.cuisines}
        onToggle={(item) => toggle('cuisines', item)}
      />

      <FilterGroup
        title="Neighborhood"
        items={neighborhoodCounts}
        selected={filters.neighborhoods}
        onToggle={(item) => toggle('neighborhoods', item)}
      />

      <FilterGroup
        title="Features"
        items={featureCounts}
        selected={filters.features}
        onToggle={(item) => toggle('features', item)}
      />

      <FilterGroup
        title="Dietary"
        items={dietaryCounts}
        selected={filters.dietary}
        onToggle={(item) => toggle('dietary', item)}
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onFilterChange(EMPTY_FILTERS)}
          className="text-sm text-red-700 hover:text-red-900 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
