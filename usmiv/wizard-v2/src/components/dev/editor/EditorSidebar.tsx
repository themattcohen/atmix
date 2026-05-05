/**
 * editor/EditorSidebar.tsx -- Left column of the Treatment Config Editor.
 *
 * Renders a search input, a Treatments/Bundles mode toggle, optional category
 * filter pills (treatments mode only), and a scrollable list.
 */

import React, { useCallback } from 'react';
import type { TreatmentCategory, TreatmentId } from '../../../types/treatment';
import type { BundleId } from '../../../types/bundle';
import type { EditableTreatment } from './types';
import type { EditableBundle } from './types';
import type { EditableQuestion } from './types';
import { CATEGORY_ORDER, catBadgeSmClass } from '../../../utils/dashboardHelpers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EditorMode = 'treatments' | 'bundles' | 'questions';

interface EditorSidebarProps {
  // Mode
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;

  // Treatments mode
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
  onAddBundle: () => void;
  onAddQuestion: () => void;

  // Bundles mode
  bundles: Record<string, EditableBundle>;
  selectedBundleId: string | null;
  onSelectBundle: (id: string) => void;
  dirtyBundleIds: Set<BundleId>;

  // Questions mode
  questions: Record<string, EditableQuestion>;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
  dirtyQuestionIds: Set<string>;
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
  mode,
  onModeChange,
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
  onAddBundle,
  onAddQuestion,
  bundles,
  selectedBundleId,
  onSelectBundle,
  dirtyBundleIds,
  questions,
  selectedQuestionId,
  onSelectQuestion,
  dirtyQuestionIds,
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

  // Filter and sort treatments
  const filteredTreatments = Object.values(drafts)
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

  // Filter bundles (search only -- no category)
  const filteredBundles = Object.values(bundles).filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q);
  });

  // Filter questions (search only -- no category)
  const filteredQuestions = Object.values(questions).filter((q) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    return q.id.toLowerCase().includes(s) || q.title.toLowerCase().includes(s);
  });

  return (
    <aside className="wde-sidebar">
      {/* Search */}
      <div className="wde-search-wrap">
        <input
          className="wde-search-input"
          type="search"
          placeholder={
            mode === 'bundles'
              ? 'Search bundles...'
              : mode === 'questions'
              ? 'Search questions...'
              : 'Search treatments...'
          }
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {/* Mode toggle */}
      <div className="wde-mode-toggle">
        <button
          className={`wde-mode-pill${mode === 'treatments' ? ' wde-mode-pill--active' : ''}`}
          type="button"
          onClick={() => onModeChange('treatments')}
        >
          Treatments
        </button>
        <button
          className={`wde-mode-pill${mode === 'bundles' ? ' wde-mode-pill--active' : ''}`}
          type="button"
          onClick={() => onModeChange('bundles')}
        >
          Bundles
        </button>
        <button
          className={`wde-mode-pill${mode === 'questions' ? ' wde-mode-pill--active' : ''}`}
          type="button"
          onClick={() => onModeChange('questions')}
        >
          Questions
        </button>
      </div>

      {/* Mode-conditional New button */}
      {mode === 'treatments' && (
        <div className="wde-add-btn-row">
          <button
            className="wde-add-btn"
            type="button"
            onClick={onAddTreatment}
          >
            + New Treatment
          </button>
        </div>
      )}
      {mode === 'bundles' && (
        <div className="wde-add-btn-row">
          <button
            className="wde-add-btn"
            type="button"
            onClick={onAddBundle}
          >
            + New Bundle
          </button>
        </div>
      )}
      {mode === 'questions' && (
        <div className="wde-add-btn-row">
          <button
            className="wde-add-btn"
            type="button"
            onClick={onAddQuestion}
          >
            + New Question
          </button>
        </div>
      )}

      {/* Category filter pills -- treatments mode only */}
      {mode === 'treatments' && (
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
      )}

      {/* List */}
      {mode === 'treatments' ? (
        <ul className="wde-list">
          {filteredTreatments.map((d) => {
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
          {filteredTreatments.length === 0 && (
            <li style={{ padding: '20px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
              No treatments match
            </li>
          )}
        </ul>
      ) : mode === 'bundles' ? (
        <ul className="wde-list">
          {filteredBundles.map((b) => {
            const isBundleDirtyFlag = dirtyBundleIds.has(b.id as BundleId);
            const isSelected = selectedBundleId === b.id;

            let cls = 'wde-list-item';
            if (isSelected) cls += ' wde-list-item--selected';

            return (
              <li
                key={b.id}
                className={cls}
                onClick={() => onSelectBundle(b.id)}
              >
                <span className="wde-cat-badge-sm wde-cat-badge-sm--bundle">bnd</span>
                <span className="wde-list-item-info">
                  <span className="wde-list-item-name">{b.name}</span>
                  <span className="wde-list-item-price" style={{ fontFamily: 'var(--wde-font-mono)', fontSize: 10 }}>
                    {b.primary}
                  </span>
                </span>
                {isBundleDirtyFlag && <span className="wde-dot wde-dot--dirty" title="Unsaved changes" />}
              </li>
            );
          })}
          {filteredBundles.length === 0 && (
            <li style={{ padding: '20px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
              No bundles match
            </li>
          )}
        </ul>
      ) : (
        <ul className="wde-list">
          {filteredQuestions.map((q) => {
            const isQuestionDirty = dirtyQuestionIds.has(q.id);
            const isSelected = selectedQuestionId === q.id;

            let cls = 'wde-list-item';
            if (isSelected) cls += ' wde-list-item--selected';

            return (
              <li
                key={q.id}
                className={cls}
                onClick={() => onSelectQuestion(q.id)}
              >
                <span className="wde-cat-badge-sm wde-cat-badge-sm--question">
                  {q.type === 'multi' ? 'mlt' : 'sngl'}
                </span>
                <span className="wde-list-item-info">
                  <span className="wde-list-item-name">{q.title}</span>
                  <span className="wde-list-item-price" style={{ fontFamily: 'var(--wde-font-mono)', fontSize: 10 }}>
                    {q.id}
                  </span>
                </span>
                {isQuestionDirty && <span className="wde-dot wde-dot--dirty" title="Unsaved changes" />}
              </li>
            );
          })}
          {filteredQuestions.length === 0 && (
            <li style={{ padding: '20px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
              No questions match
            </li>
          )}
        </ul>
      )}

    </aside>
  );
}
