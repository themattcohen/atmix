/**
 * editor/EditorTab.tsx -- Root component for the Treatment Config Editor tab.
 *
 * Manages all editor state: drafts, selection, search/filter, validation.
 * Renders the two-column layout: EditorSidebar (left) + EditorMain or BundleEditPanel (right).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { TreatmentId, Treatment, TreatmentCategory } from '../../../types/treatment';
import type { BundleId } from '../../../types/bundle';
import type { ValidationResult } from '../../../engine/validateConfig';
import { validateConfig } from '../../../engine/validateConfig';
import { QUESTIONS, BUNDLES } from '../../../data';
import type { ResolvedPath } from '../../../utils/pathResolver';
import {
  cloneAllToEditable,
  toTreatmentMap,
  computeErrorIds,
  isDirty,
  cloneAllBundlesToEditable,
  computeDirtyBundleIds,
  isBundleDirty,
} from './types';
import type { EditableTreatment, EditableBundle } from './types';
import { generateCategoryFileTs, generateBundlesFileTs } from './codeGen';
import { EditorSidebar } from './EditorSidebar';
import type { EditorMode } from './EditorSidebar';
import { EditorMain } from './EditorMain';
import { BundleEditPanel } from './BundleEditPanel';
import { AddTreatmentDialog } from './AddTreatmentDialog';

// ── Save result ───────────────────────────────────────────────────────────────

export type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; path: string }
  | { state: 'error'; message: string };

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditorTabProps {
  treatments: Readonly<Record<TreatmentId, Treatment>>;
  allPaths: ResolvedPath[];
  /** When set, the editor will select this treatment on mount or when it changes. */
  initialSelectedId?: string | null;
  /** Called whenever validation re-runs (on each draft change). */
  onValidationChange?: (result: ValidationResult) => void;
}

// ── EditorTab ─────────────────────────────────────────────────────────────────

export function EditorTab({
  treatments,
  allPaths,
  initialSelectedId,
  onValidationChange,
}: EditorTabProps): React.ReactElement {
  // Initialize mutable drafts and pristine originals once on mount.
  const [drafts, setDrafts] = useState<Record<string, EditableTreatment>>(
    () => cloneAllToEditable(treatments),
  );
  // originals is state (not memo) so we can add new treatment originals
  // when handleAddTreatment creates a new draft. Without this, isDirty()
  // receives undefined as the original and crashes.
  const [originals, setOriginals] = useState<Record<string, EditableTreatment>>(
    () => cloneAllToEditable(treatments),
  );

  // Bundle state
  const [bundleDrafts, setBundleDrafts] = useState<Record<string, EditableBundle>>(
    () => cloneAllBundlesToEditable(BUNDLES),
  );
  const bundleOriginals = useMemo(
    () => cloneAllBundlesToEditable(BUNDLES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [editorMode, setEditorMode] = useState<EditorMode>('treatments');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

  // When initialSelectedId changes (e.g. "Fix in Editor" clicked from another tab),
  // update the selection -- but only if the new value is non-null.
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setEditorMode('treatments');
    }
  }, [initialSelectedId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TreatmentCategory | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const [bundleSaveStatus, setBundleSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Re-run validation whenever drafts change, and bubble result to dashboard.
  useEffect(() => {
    const treatmentMap = toTreatmentMap(drafts as Record<TreatmentId, EditableTreatment>);
    const result = validateConfig(treatmentMap, QUESTIONS, BUNDLES);
    setValidationResult(result);
    onValidationChange?.(result);
  }, [drafts, onValidationChange]);

  // Derived dirty/error sets for sidebar indicators.
  // Use originals state (not the treatments prop) so new treatments added via
  // handleAddTreatment have a defined original to compare against.
  const dirtyIds = useMemo(() => {
    const dirty = new Set<TreatmentId>();
    for (const id of Object.keys(drafts) as TreatmentId[]) {
      const original = originals[id as string];
      // New treatment (no original) is always dirty
      if (!original) {
        dirty.add(id);
        continue;
      }
      // Compare against editable original using same canonicalize logic
      const draftJson = JSON.stringify({
        name: drafts[id].name,
        price: drafts[id].price,
        priceLabel: drafts[id].priceLabel ?? null,
        duration: drafts[id].duration,
        acuityTypeId: drafts[id].acuityTypeId,
        acuityDropdownValue: drafts[id].acuityDropdownValue,
        pageUrl: drafts[id].pageUrl,
        shortDesc: drafts[id].shortDesc,
        ingredients: drafts[id].ingredients,
        bestFor: drafts[id].bestFor,
        whyMatch: drafts[id].whyMatch,
        scoringWeights: drafts[id].scoringWeights,
        addressedBy: drafts[id].addressedBy,
        addonSuggestions: drafts[id].addonSuggestions,
        note: drafts[id].note ?? null,
        tests: drafts[id].tests ?? null,
      });
      const origJson = JSON.stringify({
        name: original.name,
        price: original.price,
        priceLabel: original.priceLabel ?? null,
        duration: original.duration,
        acuityTypeId: original.acuityTypeId,
        acuityDropdownValue: original.acuityDropdownValue,
        pageUrl: original.pageUrl,
        shortDesc: original.shortDesc,
        ingredients: original.ingredients,
        bestFor: original.bestFor,
        whyMatch: original.whyMatch,
        scoringWeights: original.scoringWeights,
        addressedBy: original.addressedBy,
        addonSuggestions: original.addonSuggestions,
        note: original.note ?? null,
        tests: original.tests ?? null,
      });
      if (draftJson !== origJson) dirty.add(id);
    }
    return dirty;
  }, [drafts, originals]);
  const errorIds = useMemo(
    () => computeErrorIds(validationResult),
    [validationResult],
  );
  const dirtyBundleIds = useMemo(
    () => computeDirtyBundleIds(bundleDrafts as Record<BundleId, EditableBundle>, BUNDLES),
    [bundleDrafts],
  );

  // Update a single field on the selected treatment draft.
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

  // Reset the selected treatment draft to the original.
  const handleReset = useCallback(() => {
    if (!selectedId) return;
    setDrafts((prev) => ({
      ...prev,
      [selectedId]: { ...originals[selectedId as TreatmentId] },
    }));
  }, [selectedId, originals]);

  // Update a single field on the selected bundle draft.
  const handleBundleUpdate = useCallback(
    (field: keyof EditableBundle, value: unknown) => {
      if (!selectedBundleId) return;
      setBundleDrafts((prev) => ({
        ...prev,
        [selectedBundleId]: { ...prev[selectedBundleId], [field]: value },
      }));
    },
    [selectedBundleId],
  );

  // Reset the selected bundle draft to the original.
  const handleBundleReset = useCallback(() => {
    if (!selectedBundleId) return;
    setBundleDrafts((prev) => ({
      ...prev,
      [selectedBundleId]: { ...bundleOriginals[selectedBundleId as BundleId] },
    }));
  }, [selectedBundleId, bundleOriginals]);

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
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          return { ok: false, message: 'Save requires the local dev server (npm run dev). Use "Copy TS" on the live site.' };
        }
        const json = await resp.json() as { ok?: boolean; path?: string; error?: string };
        if (resp.ok && json.ok) {
          return { ok: true, path: json.path ?? category };
        }
        return { ok: false, message: json.error ?? `HTTP ${resp.status}` };
      } catch (err: unknown) {
        return { ok: false, message: 'Save requires the local dev server (npm run dev). Use "Copy TS" on the live site.' };
      }
    },
    [drafts],
  );

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

  // Save bundles.ts to disk via the Vite dev middleware.
  const saveBundlesToDisk = useCallback(
    async (): Promise<{ ok: true; path: string } | { ok: false; message: string }> => {
      const content = generateBundlesFileTs(Object.values(bundleDrafts));

      try {
        const resp = await fetch('/api/wizard-editor/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'bundles', content }),
        });
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          return { ok: false, message: 'Save requires the local dev server (npm run dev). Use "Copy bundles.ts" on the live site.' };
        }
        const json = await resp.json() as { ok?: boolean; path?: string; error?: string };
        if (resp.ok && json.ok) {
          return { ok: true, path: json.path ?? 'bundles.ts' };
        }
        return { ok: false, message: json.error ?? `HTTP ${resp.status}` };
      } catch {
        return { ok: false, message: 'Save requires the local dev server (npm run dev). Use "Copy bundles.ts" on the live site.' };
      }
    },
    [bundleDrafts],
  );

  const handleBundleSave = useCallback(async () => {
    setBundleSaveStatus({ state: 'saving' });
    const result = await saveBundlesToDisk();
    if (result.ok) {
      setBundleSaveStatus({ state: 'saved', path: result.path });
      setTimeout(() => setBundleSaveStatus({ state: 'idle' }), 3000);
    } else {
      setBundleSaveStatus({ state: 'error', message: result.message });
    }
  }, [saveBundlesToDisk]);

  // Add Treatment dialog handler.
  const handleAddTreatment = useCallback(
    (id: string, name: string, category: TreatmentCategory) => {
      const newDraft: EditableTreatment = {
        id: id as TreatmentId,
        name,
        price: 0,
        priceLabel: undefined,
        duration: '',
        category,
        acuityTypeId: 0,
        acuityDropdownValue: null,
        pageUrl: '',
        shortDesc: '',
        ingredients: [],
        bestFor: [],
        whyMatch: '',
        scoringWeights: {},
        addressedBy: {},
        addonSuggestions: [],
        note: undefined,
        tests: category === 'lab' ? [] : undefined,
      };
      setDrafts((prev) => ({ ...prev, [id]: newDraft }));
      // Fix 2: add to originals so isDirty() has something to compare against
      setOriginals((prev) => ({ ...prev, [id]: { ...newDraft } }));
      setSelectedId(id);
      setShowAddDialog(false);
    },
    [],
  );

  const selectedDraft = selectedId ? drafts[selectedId] : null;
  const selectedIsDirty = selectedId
    // New treatments (not in compiled catalog) are always considered dirty
    ? (treatments[selectedId as TreatmentId]
        ? isDirty(drafts[selectedId] as EditableTreatment, treatments[selectedId as TreatmentId])
        : true)
    : false;

  const selectedBundleDraft = selectedBundleId ? bundleDrafts[selectedBundleId] : null;
  const selectedBundleIsDirty = selectedBundleId && selectedBundleDraft
    ? isBundleDirty(selectedBundleDraft, BUNDLES[selectedBundleId as BundleId])
    : false;

  return (
    <div className="wde-editor wde-layout">
      <EditorSidebar
        mode={editorMode}
        onModeChange={setEditorMode}
        drafts={drafts}
        selectedId={selectedId}
        onSelect={setSelectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        dirtyIds={dirtyIds}
        errorIds={errorIds}
        onAddTreatment={() => setShowAddDialog(true)}
        bundles={bundleDrafts}
        selectedBundleId={selectedBundleId}
        onSelectBundle={setSelectedBundleId}
        dirtyBundleIds={dirtyBundleIds}
      />

      {showAddDialog && (
        <AddTreatmentDialog
          existingIds={new Set(Object.keys(drafts))}
          onConfirm={handleAddTreatment}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {editorMode === 'treatments' ? (
        selectedDraft ? (
          <EditorMain
            draft={selectedDraft}
            isDirty={selectedIsDirty}
            dirtyIds={dirtyIds}
            validationResult={validationResult}
            allDrafts={drafts}
            saveStatus={saveStatus}
            allPaths={allPaths}
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
        )
      ) : (
        selectedBundleDraft ? (
          <BundleEditPanel
            bundle={selectedBundleDraft}
            isDirty={selectedBundleIsDirty}
            allBundles={Object.values(bundleDrafts)}
            allTreatments={drafts}
            onUpdate={handleBundleUpdate}
            onReset={handleBundleReset}
            onSave={handleBundleSave}
            saveStatus={bundleSaveStatus}
          />
        ) : (
          <div className="wde-main">
            <div className="wde-empty-state">
              <div>Select a bundle</div>
              <div className="wde-empty-state-hint">
                Choose a bundle from the sidebar to begin editing.
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
