/**
 * editor/EditorTab.tsx -- Root component for the Treatment Config Editor tab.
 *
 * Manages all editor state: drafts, selection, search/filter, validation.
 * Renders the two-column layout: EditorSidebar (left) + EditorMain (right).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { TreatmentId, Treatment, TreatmentCategory } from '../../../types/treatment';
import type { ValidationResult } from '../../../engine/validateConfig';
import { validateConfig } from '../../../engine/validateConfig';
import { QUESTIONS, BUNDLES } from '../../../data';
import {
  cloneAllToEditable,
  toTreatmentMap,
  computeDirtyIds,
  computeErrorIds,
  isDirty,
} from './types';
import type { EditableTreatment } from './types';
import { EditorSidebar } from './EditorSidebar';
import { EditorMain } from './EditorMain';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditorTabProps {
  treatments: Readonly<Record<TreatmentId, Treatment>>;
}

// ── EditorTab ─────────────────────────────────────────────────────────────────

export function EditorTab({ treatments }: EditorTabProps): React.ReactElement {
  // Initialize mutable drafts and pristine originals once on mount.
  const [drafts, setDrafts] = useState<Record<string, EditableTreatment>>(
    () => cloneAllToEditable(treatments),
  );
  const originals = useMemo(
    () => cloneAllToEditable(treatments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TreatmentCategory | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Re-run validation whenever drafts change.
  useEffect(() => {
    const treatmentMap = toTreatmentMap(drafts as Record<TreatmentId, EditableTreatment>);
    const result = validateConfig(treatmentMap, QUESTIONS, BUNDLES);
    setValidationResult(result);
  }, [drafts]);

  // Derived dirty/error sets for sidebar indicators.
  const dirtyIds = useMemo(
    () => computeDirtyIds(drafts as Record<TreatmentId, EditableTreatment>, treatments),
    [drafts, treatments],
  );
  const errorIds = useMemo(
    () => computeErrorIds(validationResult),
    [validationResult],
  );

  // Update a single field on the selected draft.
  const handleUpdate = useCallback(
    (field: keyof EditableTreatment, value: unknown) => {
      if (!selectedId) return;
      setDrafts((prev) => ({
        ...prev,
        [selectedId]: { ...prev[selectedId], [field]: value },
      }));
    },
    [selectedId],
  );

  // Reset the selected draft to the original.
  const handleReset = useCallback(() => {
    if (!selectedId) return;
    setDrafts((prev) => ({
      ...prev,
      [selectedId]: { ...originals[selectedId as TreatmentId] },
    }));
  }, [selectedId, originals]);

  const selectedDraft = selectedId ? drafts[selectedId] : null;
  const selectedIsDirty = selectedId
    ? isDirty(drafts[selectedId] as EditableTreatment, treatments[selectedId as TreatmentId])
    : false;

  return (
    <div className="wde-editor wde-layout">
      <EditorSidebar
        drafts={drafts}
        selectedId={selectedId}
        onSelect={setSelectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        dirtyIds={dirtyIds}
        errorIds={errorIds}
      />

      {selectedDraft ? (
        <EditorMain
          draft={selectedDraft}
          isDirty={selectedIsDirty}
          validationResult={validationResult}
          allDrafts={drafts}
          onUpdate={handleUpdate}
          onReset={handleReset}
        />
      ) : (
        <div className="wde-main">
          <div className="wde-empty-state">
            <div>Select a treatment</div>
            <div className="wde-empty-state-hint">
              Choose a treatment from the sidebar to begin editing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
