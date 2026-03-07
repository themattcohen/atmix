import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import restaurantsData from '../data/restaurants.json';
import { type Restaurant } from '../lib/types';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import FilterPanel, { type FilterState, EMPTY_FILTERS } from '../components/FilterPanel';
import RestaurantGrid from '../components/RestaurantGrid';

const allRestaurants: Restaurant[] = restaurantsData as Restaurant[];

const fuse = new Fuse(allRestaurants, {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'cuisines', weight: 2 },
    { name: 'neighborhoods', weight: 1.5 },
    { name: 'cuisine_primary', weight: 2 },
    { name: 'features', weight: 1 },
    { name: 'dietary', weight: 1 },
    { name: 'address', weight: 0.5 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

function applyFilters(restaurants: Restaurant[], filters: FilterState): Restaurant[] {
  return restaurants.filter((r) => {
    if (filters.cuisines.length > 0 && !filters.cuisines.some((c) => r.cuisines.includes(c))) return false;
    if (filters.neighborhoods.length > 0 && !filters.neighborhoods.some((n) => r.neighborhoods.includes(n))) return false;
    if (filters.features.length > 0 && !filters.features.every((f) => r.features.includes(f))) return false;
    if (filters.dietary.length > 0 && !filters.dietary.every((d) => r.dietary.includes(d))) return false;
    if (filters.pricePoints.length > 0 && !filters.pricePoints.includes(r.price_point)) return false;
    if (filters.hasMenu && r.courses.length === 0) return false;
    return true;
  });
}

type SortKey = 'name' | 'cuisine' | 'neighborhood' | 'price';

function sortRestaurants(restaurants: Restaurant[], key: SortKey, asc: boolean): Restaurant[] {
  return [...restaurants].sort((a, b) => {
    let av: string, bv: string;
    switch (key) {
      case 'name':
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
        break;
      case 'cuisine':
        av = (a.cuisines[0] || 'zzz').toLowerCase();
        bv = (b.cuisines[0] || 'zzz').toLowerCase();
        break;
      case 'neighborhood':
        av = (a.neighborhoods[0] || 'zzz').toLowerCase();
        bv = (b.neighborhoods[0] || 'zzz').toLowerCase();
        break;
      case 'price': {
        const ap = Number(a.price_point) || 999;
        const bp = Number(b.price_point) || 999;
        return asc ? ap - bp : bp - ap;
      }
      default:
        return 0;
    }
    return asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const [filters, setFilters] = useState<FilterState>(() => {
    const cuisineParam = searchParams.getAll('cuisine');
    const neighborhoodParam = searchParams.getAll('neighborhood');
    return {
      ...EMPTY_FILTERS,
      ...(cuisineParam.length > 0 ? { cuisines: cuisineParam } : {}),
      ...(neighborhoodParam.length > 0 ? { neighborhoods: neighborhoodParam } : {}),
    };
  });

  useEffect(() => {
    const hasUrlFilters = searchParams.has('cuisine') || searchParams.has('neighborhood');
    if (hasUrlFilters) setShowFilters(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    filters.cuisines.forEach((c) => params.append('cuisine', c));
    filters.neighborhoods.forEach((n) => params.append('neighborhood', n));
    setSearchParams(params, { replace: true });
  }, [query, filters, setSearchParams]);

  const filteredRestaurants = useMemo(() => {
    let results: Restaurant[];
    if (query.trim()) {
      results = fuse.search(query).map((r) => r.item);
    } else {
      results = allRestaurants;
    }
    results = applyFilters(results, filters);
    if (!query.trim()) {
      results = sortRestaurants(results, sortKey, sortAsc);
    }
    return results;
  }, [query, filters, sortKey, sortAsc]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const activeFilterCount =
    filters.cuisines.length +
    filters.neighborhoods.length +
    filters.features.length +
    filters.dietary.length +
    filters.pricePoints.length +
    (filters.hasMenu ? 1 : 0);

  return (
    <div>
      <HeroSection restaurants={allRestaurants} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <SearchBar
                value={query}
                onChange={handleSearch}
                resultCount={filteredRestaurants.length}
                totalCount={allRestaurants.length}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  showFilters
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-red-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-white text-red-700 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <select
                value={`${sortKey}-${sortAsc ? 'asc' : 'desc'}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split('-');
                  setSortKey(key as SortKey);
                  setSortAsc(dir === 'asc');
                }}
                className="px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="cuisine-asc">Cuisine A-Z</option>
                <option value="cuisine-desc">Cuisine Z-A</option>
                <option value="neighborhood-asc">Neighborhood A-Z</option>
                <option value="neighborhood-desc">Neighborhood Z-A</option>
                <option value="price-asc">Price (low to high)</option>
                <option value="price-desc">Price (high to low)</option>
              </select>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mb-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <FilterPanel
              restaurants={allRestaurants}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        <RestaurantGrid restaurants={filteredRestaurants} />
      </div>
    </div>
  );
}
