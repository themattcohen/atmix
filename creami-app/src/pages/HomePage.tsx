import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import recipesData from '../data/recipes.json';
import { type Recipe } from '../lib/types';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import FilterPanel, { type FilterState, EMPTY_FILTERS } from '../components/FilterPanel';
import RecipeGrid from '../components/RecipeGrid';

const allRecipes: Recipe[] = recipesData as Recipe[];

const fuse = new Fuse(allRecipes, {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'tags', weight: 1.5 },
    { name: 'ingredients.items.name', weight: 0.8 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

function applyQuickFilter(recipe: Recipe, key: string): boolean {
  switch (key) {
    case 'scoopable': return recipe.isScoopable;
    case 'vegan': return recipe.isVegan;
    case 'light': return recipe.isLight;
    case 'lowsugar': return recipe.tags.includes('Low-Sugar');
    case 'hiprotein': return recipe.tags.includes('Hi-Protein');
    case 'favorite': return recipe.tags.includes('Favorite');
    default: return true;
  }
}

function applyFilters(recipes: Recipe[], filters: FilterState): Recipe[] {
  return recipes.filter((r) => {
    if (filters.tags.length > 0 && !filters.tags.every((t) => r.tags.includes(t))) return false;
    if (filters.quickFilters.length > 0 && !filters.quickFilters.every((f) => applyQuickFilter(r, f))) return false;
    if (filters.maxKcal !== null && r.nutrition && r.nutrition.kcal > filters.maxKcal) return false;
    if (filters.minProtein !== null && r.nutrition && r.nutrition.protein < filters.minProtein) return false;
    if (filters.maxSugar !== null && r.nutrition && r.nutrition.sugar > filters.maxSugar) return false;
    if (filters.source !== null && r.source !== filters.source) return false;
    return true;
  });
}

type SortKey = 'name' | 'kcal' | 'protein' | 'fpdf';

function sortRecipes(recipes: Recipe[], key: SortKey, asc: boolean): Recipe[] {
  return [...recipes].sort((a, b) => {
    let av: number, bv: number;
    switch (key) {
      case 'name': return asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case 'kcal': av = a.nutrition?.kcal ?? 0; bv = b.nutrition?.kcal ?? 0; break;
      case 'protein': av = a.nutrition?.protein ?? 0; bv = b.nutrition?.protein ?? 0; break;
      case 'fpdf': av = a.fpdf ?? 0; bv = b.fpdf ?? 0; break;
      default: return 0;
    }
    return asc ? av - bv : bv - av;
  });
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const [filters, setFilters] = useState<FilterState>(() => {
    const tagParam = searchParams.get('tag');
    const qfParams = searchParams.getAll('qf');
    const sourceParam = searchParams.get('source');
    return {
      ...EMPTY_FILTERS,
      ...(tagParam ? { tags: [tagParam] } : {}),
      ...(qfParams.length > 0 ? { quickFilters: qfParams } : {}),
      ...(sourceParam ? { source: sourceParam } : {}),
    };
  });

  // Auto-open filter panel if URL has active filters
  useEffect(() => {
    const hasUrlFilters = searchParams.has('tag') || searchParams.has('qf') || searchParams.has('source');
    if (hasUrlFilters) setShowFilters(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    filters.tags.forEach((t) => params.append('tag', t));
    filters.quickFilters.forEach((f) => params.append('qf', f));
    if (filters.source) params.set('source', filters.source);
    setSearchParams(params, { replace: true });
  }, [query, filters, setSearchParams]);

  const filteredRecipes = useMemo(() => {
    let results: Recipe[];
    if (query.trim()) {
      results = fuse.search(query).map((r) => r.item);
    } else {
      results = allRecipes;
    }
    results = applyFilters(results, filters);
    if (!query.trim()) {
      results = sortRecipes(results, sortKey, sortAsc);
    }
    return results;
  }, [query, filters, sortKey, sortAsc]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const handleHeroFilter = useCallback((filterKey: string | null) => {
    if (filterKey === null) {
      // "Recipes" clicked - clear all filters
      setFilters(EMPTY_FILTERS);
      setQuery('');
      setShowFilters(false);
    } else if (filterKey === 'tags') {
      // "Tags" clicked - open filter panel
      setShowFilters(true);
    } else {
      // Quick filter (scoopable, vegan) - toggle it
      const isActive = filters.quickFilters.includes(filterKey);
      if (isActive) {
        setFilters({ ...EMPTY_FILTERS });
        setShowFilters(false);
      } else {
        setFilters({ ...EMPTY_FILTERS, quickFilters: [filterKey] });
        setShowFilters(true);
      }
    }
  }, [filters.quickFilters]);

  const activeHeroFilter = filters.quickFilters.length === 1 && filters.tags.length === 0
    ? filters.quickFilters[0]
    : null;

  const activeFilterCount = filters.tags.length + filters.quickFilters.length +
    (filters.source ? 1 : 0) +
    (filters.maxKcal !== null ? 1 : 0) +
    (filters.minProtein !== null ? 1 : 0) +
    (filters.maxSugar !== null ? 1 : 0);

  return (
    <div>
      <HeroSection
        recipes={allRecipes}
        onQuickFilter={handleHeroFilter}
        activeFilter={activeHeroFilter}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <SearchBar
                value={query}
                onChange={handleSearch}
                resultCount={filteredRecipes.length}
                totalCount={allRecipes.length}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  showFilters
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-white text-indigo-600 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
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
                className="px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="kcal-asc">Calories (low)</option>
                <option value="kcal-desc">Calories (high)</option>
                <option value="protein-desc">Protein (high)</option>
                <option value="protein-asc">Protein (low)</option>
                <option value="fpdf-desc">FPDF (high)</option>
                <option value="fpdf-asc">FPDF (low)</option>
              </select>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mb-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <FilterPanel
              recipes={allRecipes}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        <RecipeGrid recipes={filteredRecipes} />
      </div>
    </div>
  );
}
