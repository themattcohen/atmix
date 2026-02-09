import { type Recipe } from '../lib/types';

export interface FilterState {
  tags: string[];
  maxKcal: number | null;
  minProtein: number | null;
  maxSugar: number | null;
  quickFilters: string[];
  source: string | null;
}

export const EMPTY_FILTERS: FilterState = {
  tags: [],
  maxKcal: null,
  minProtein: null,
  maxSugar: null,
  quickFilters: [],
  source: null,
};

const QUICK_FILTERS = [
  { key: 'scoopable', label: 'Scoopable', icon: '🥄' },
  { key: 'vegan', label: 'Vegan', icon: '🌿' },
  { key: 'light', label: 'Light', icon: '💡' },
  { key: 'lowsugar', label: 'Low-Sugar', icon: '🍬' },
  { key: 'hiprotein', label: 'Hi-Protein', icon: '💪' },
  { key: 'favorite', label: 'Favorite', icon: '⭐' },
];

interface FilterPanelProps {
  recipes: Recipe[];
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterPanel({ recipes, filters, onFilterChange }: FilterPanelProps) {
  // Get unique sources with counts
  const sourceCounts = new Map<string, number>();
  recipes.forEach((r) => {
    sourceCounts.set(r.source, (sourceCounts.get(r.source) || 0) + 1);
  });
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Get all tags sorted by frequency
  const tagCounts = new Map<string, number>();
  recipes.forEach((r) => r.tags.forEach((t) => {
    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }));

  // Filter out technical tags, show interesting ones
  const hiddenTags = new Set(['Erythritol', 'Polysaccharide Gum', 'Emulsifier', 'Xylitol', 'Stevia', 'Sucralose', 'Tylo Powder (CMC)', 'Allulose']);
  const displayTags = [...tagCounts.entries()]
    .filter(([tag]) => !hiddenTags.has(tag))
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onFilterChange({ ...filters, tags: newTags });
  };

  const toggleQuickFilter = (key: string) => {
    const newFilters = filters.quickFilters.includes(key)
      ? filters.quickFilters.filter((f) => f !== key)
      : [...filters.quickFilters, key];
    onFilterChange({ ...filters, quickFilters: newFilters });
  };

  const SOURCE_LABELS: Record<string, string> = {
    jhermann: 'jhermann/ice-creamery',
    fpf: 'FitnessProductFinder (YouTube)',
  };

  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.quickFilters.length > 0 ||
    filters.maxKcal !== null ||
    filters.minProtein !== null ||
    filters.maxSugar !== null ||
    filters.source !== null;

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Filters</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              type="button"
              onClick={() => toggleQuickFilter(qf.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                filters.quickFilters.includes(qf.key)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <span>{qf.icon}</span>
              {qf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source Filter */}
      {sources.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Source</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, source: null })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                filters.source === null
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              All ({recipes.length})
            </button>
            {sources.map(([source, count]) => (
              <button
                key={source}
                type="button"
                onClick={() => onFilterChange({ ...filters, source: filters.source === source ? null : source })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  filters.source === source
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {SOURCE_LABELS[source] || source} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nutrition Filters */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Nutrition (per 100g)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Calories</label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={filters.maxKcal ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  maxKcal: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min Protein (g)</label>
            <input
              type="number"
              placeholder="e.g. 3"
              value={filters.minProtein ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  minProtein: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Sugar (g)</label>
            <input
              type="number"
              placeholder="e.g. 5"
              value={filters.maxSugar ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  maxSugar: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Tag Filters */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {displayTags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                filters.tags.includes(tag)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {tag}
              <span className="opacity-60">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onFilterChange(EMPTY_FILTERS)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
