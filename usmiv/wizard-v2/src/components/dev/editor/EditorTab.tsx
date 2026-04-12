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
import { generateCategoryFileTs } from './codeGen';
import { EditorSidebar } from './EditorSidebar';
import { EditorMain } from './EditorMain';

// ── Save result ───────────────────────────────────────────────────────────────

export type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; path: string }
  | { state: 'error'; message: string };

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });

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

  // Save a single category to disk via the Vite dev middleware.
  const saveCategoryToDisk = useCallback(
    async (category: TreatmentCategory): Promise<{ ok: true; path: string } | { ok: false; message: string }> => {
      const categoryDrafts = Object.values(drafts).filter(
        (d) => d.category === category,
      ) as EditableTreatment[];
      const content = generateCategoryFileTs(categoryDrafts, category);

      try {
        const resp = await fetch('/api/wizard-editor/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, content }),
        });
        const json = await resp.json() as { ok?: boolean; path?: string; error?: string };
        if (resp.ok && json.ok) {
          return { ok: true, path: json.path ?? category };
        }
        return { ok: false, message: json.error ?? `HTTP ${resp.status}` };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
      }
    },
    [drafts],
  );

  // Mark all treatments in a category as clean (update originals tracking) by
  // replacing the relevant draft entries with fresh clones -- originals are
  // computed once at mount from the original treatments prop and are read-only,
  // so we track "saved originals" as a separate piece of state. Instead of that
  // complexity, after a successful save we reload the page so Vite HMR picks up
  // the new file. The banner and reload button handle this UX.

  // Save the current category (triggered from EditorMain header).
  const handleSave = useCallback(async () => {
    if (!selectedId) return;
    const category = (drafts[selectedId] as EditableTreatment).category;
    setSaveStatus({ state: 'saving' });
    const result = await saveCategoryToDisk(category);
    if (result.ok) {
      setSaveStatus({ state: 'saved', path: result.path });
      setTimeout(() => setSaveStatus({ state: 'idle' }), 3000);
    } else {
      setSaveStatus({ state: 'error', message: result.message });
    }
  }, [selectedId, drafts, saveCategoryToDisk]);

  // Save all dirty categories at once.
  const handleSaveAll = useCallback(async () => {
    const dirtyCategories = new Set(
      [...dirtyIds].map((id) => (drafts[id] as EditableTreatment).category),
    );
    if (dirtyCategories.size === 0) return;

    setSaveStatus({ state: 'saving' });
    const savedPaths: string[] = [];
    const errors: string[] = [];

    for (const category of dirtyCategories) {
      const result = await saveCategoryToDisk(category);
      if (result.ok) {
        savedPaths.push(result.path);
      } else {
        errors.push(`${category}: ${result.message}`);
      }
    }

    if (errors.length === 0) {
      setSaveStatus({ state: 'saved', path: savedPaths.join(', ') });
      setTimeout(() => setSaveStatus({ state: 'idle' }), 3000);
    } else {
      setSaveStatus({ state: 'error', message: errors.join(' | ') });
    }
  }, [dirtyIds, drafts, saveCategoryToDisk]);

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
          dirtyIds={dirtyIds}
          validationResult={validationResult}
          allDrafts={drafts}
          saveStatus={saveStatus}
          onUpdate={handleUpdate}
          onReset={handleReset}
          onSave={handleSave}
          onSaveAll={handleSaveAll}
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
