/**
 * editor/EditorSidebar.tsx -- Left column of the Treatment Config Editor.
 *
 * Renders a search input, category filter pills, and a scrollable list of
 * all treatments. Each item shows a category badge, name, price, and dirty/
 * error status dots.
 */

import React, { useCallback } from 'react';
import type { TreatmentCategory, TreatmentId } from '../../../types/treatment';
import type { EditableTreatment } from './types';
import { CATEGORY_ORDER, catBadgeSmClass } from '../../../utils/dashboardHelpers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditorSidebarProps {
  drafts: Record<string, EditableTreatment>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: TreatmentCategory | null;
  onCategoryChange: (cat: TreatmentCategory | null) => void;
  dirtyIds: Set<TreatmentId>;
  errorIds: Set<TreatmentId>;
  onAddTreatment: () => void;
}

// ── Category config ───────────────────────────────────────────────────────────

interface CategoryConfig {
  id: TreatmentCategory;
  label: string;
  activeCls: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'iv',         label: 'IV',          activeCls: 'wde-cat-pill--active-iv' },
  { id: 'nad',        label: 'NAD',         activeCls: 'wde-cat-pill--active-nad' },
  { id: 'weightLoss', label: 'Weight Loss', activeCls: 'wde-cat-pill--active-weightloss' },
  { id: 'injection',  label: 'Injection',   activeCls: 'wde-cat-pill--active-injection' },
  { id: 'lab',        label: 'Lab',         activeCls: 'wde-cat-pill--active-lab' },
];

function formatDraftPrice(d: EditableTreatment): string {
  if (d.priceLabel && d.priceLabel.trim()) return d.priceLabel;
  return `$${d.price}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditorSidebar({
  drafts,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  dirtyIds,
  errorIds,
  onAddTreatment,
}: EditorSidebarProps): React.ReactElement {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value),
    [onSearchChange],
  );

  const handlePillClick = useCallback(
    (cat: TreatmentCategory) => {
      onCategoryChange(categoryFilter === cat ? null : cat);
    },
    [categoryFilter, onCategoryChange],
  );

  // Filter and sort the draft list
  const filtered = Object.values(drafts)
    .filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return b.price - a.price;
    });

  return (
    <aside className="wde-sidebar">
      {/* Search */}
      <div className="wde-search-wrap">
        <input
          className="wde-search-input"
          type="search"
          placeholder="Search treatments..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {/* Category filter pills */}
      <div className="wde-category-pills">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`wde-cat-pill${categoryFilter === c.id ? ` ${c.activeCls}` : ''}`}
            onClick={() => handlePillClick(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Treatment list */}
      <ul className="wde-list">
        {filtered.map((d) => {
          const isDirty = dirtyIds.has(d.id);
          const hasError = errorIds.has(d.id);
          const isSelected = selectedId === d.id;

          let cls = 'wde-list-item';
          if (isSelected) cls += ' wde-list-item--selected';

          return (
            <li
              key={d.id}
              className={cls}
              onClick={() => onSelect(d.id)}
            >
              <span className={catBadgeSmClass(d.category)}>
                {d.category === 'weightLoss' ? 'wt' : d.category}
              </span>
              <span className="wde-list-item-info">
                <span className="wde-list-item-name">{d.name}</span>
                <span className="wde-list-item-price">{formatDraftPrice(d)}</span>
              </span>
              {hasError && <span className="wde-dot wde-dot--error" title="Has validation errors" />}
              {isDirty && <span className="wde-dot wde-dot--dirty" title="Unsaved changes" />}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li style={{ padding: '20px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
            No treatments match
          </li>
        )}
      </ul>

      {/* Add Treatment footer button */}
      <div className="wde-sidebar-footer">
        <button
          className="wde-add-treatment-btn"
          type="button"
          onClick={onAddTreatment}
        >
          + New Treatment
        </button>
      </div>
    </aside>
  );
}
