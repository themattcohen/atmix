/**
 * editor/EditorTab.tsx -- Root component for the Treatment Config Editor tab.
 *
 * Manages all editor state: drafts, selection, search/filter, validation.
 * Renders the two-column layout: EditorSidebar (left) + EditorMain or BundleEditPanel (right).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TreatmentId, Treatment, TreatmentCategory } from '../../../types/treatment';
import type { BundleId } from '../../../types/bundle';
import type { ValidationResult } from '../../../engine/validateConfig';
import { validateConfig } from '../../../engine/validateConfig';
import { QUESTIONS, BUNDLES, TREATMENTS } from '../../../data';
import type { ResolvedPath } from '../../../utils/pathResolver';
import {
  cloneAllToEditable,
  toTreatmentMap,
  computeErrorIds,
  isDirty,
  cloneAllBundlesToEditable,
  computeDirtyBundleIds,
  isBundleDirty,
  cloneAllQuestionsToEditable,
  computeDirtyQuestionIds,
  isQuestionDirty,
} from './types';
import type { EditableTreatment, EditableBundle, EditableQuestion } from './types';

// ── Snapshot type exposed to parent ──────────────────────────────────────────
export interface EditorDraftsSnapshot {
  treatments: Record<string, EditableTreatment>;
  bundles: Record<string, EditableBundle>;
  questions: Record<string, EditableQuestion>;
}
import { EditorSidebar } from './EditorSidebar';
import type { EditorMode } from './EditorSidebar';
import { EditorMain } from './EditorMain';
import { BundleEditPanel } from './BundleEditPanel';
import { QuestionEditPanel } from './QuestionEditPanel';
import type { ValidationFailure } from '../WizardDevDashboard';
import { AddTreatmentDialog } from './AddTreatmentDialog';
import { AddQuestionDialog } from './AddQuestionDialog';
import type { StarterOption } from './AddQuestionDialog';
import { AddBundleDialog } from './AddBundleDialog';

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
  /** When set, the editor will select this bundle on mount or when it changes. */
  initialSelectedBundleId?: string | null;
  /** When set, the editor will select this question on mount or when it changes. */
  initialSelectedQuestionId?: string | null;
  /** Called whenever validation re-runs (on each draft change). */
  onValidationChange?: (result: ValidationResult) => void;
  /**
   * Called whenever any draft map changes (treatments, bundles, or questions).
   * The parent uses this snapshot to build the Save & Publish payload.
   * Debounced to 100ms to avoid flooding the parent on rapid keystrokes.
   */
  onDraftsChange?: (snapshot: EditorDraftsSnapshot) => void;
  /** Server-side validation failure from the last Save & Publish attempt. */
  validationFailure?: ValidationFailure | null;
  /** Clears the validation failure (call when user starts editing the field). */
  clearValidationFailure?: () => void;
}

// ── EditorTab ─────────────────────────────────────────────────────────────────

export function EditorTab({
  treatments,
  allPaths,
  initialSelectedId,
  initialSelectedBundleId,
  initialSelectedQuestionId,
  onValidationChange,
  onDraftsChange,
  validationFailure,
  clearValidationFailure,
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

  // Question state
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, EditableQuestion>>(
    () => cloneAllQuestionsToEditable(QUESTIONS as Record<string, import('../../../types/question').Question>),
  );
  const questionOriginals = useMemo(
    () => cloneAllQuestionsToEditable(QUESTIONS as Record<string, import('../../../types/question').Question>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

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

  useEffect(() => {
    if (initialSelectedBundleId) {
      setSelectedBundleId(initialSelectedBundleId);
      setEditorMode('bundles');
    }
  }, [initialSelectedBundleId]);

  useEffect(() => {
    if (initialSelectedQuestionId) {
      setSelectedQuestionId(initialSelectedQuestionId);
      setEditorMode('questions');
    }
  }, [initialSelectedQuestionId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TreatmentCategory | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddQuestionDialog, setShowAddQuestionDialog] = useState(false);
  const [showAddBundleDialog, setShowAddBundleDialog] = useState(false);

  // Re-run validation whenever drafts change, and bubble result to dashboard.
  useEffect(() => {
    const treatmentMap = toTreatmentMap(drafts as Record<TreatmentId, EditableTreatment>);
    const result = validateConfig(treatmentMap, QUESTIONS, BUNDLES);
    setValidationResult(result);
    onValidationChange?.(result);
  }, [drafts, onValidationChange]);

  // Notify parent of current draft snapshot whenever any draft map changes.
  // Debounced 100ms so rapid keystrokes don't flood the parent with re-renders.
  const onDraftsChangeRef = useRef(onDraftsChange);
  useEffect(() => { onDraftsChangeRef.current = onDraftsChange; });

  // Mount-time snapshot: fires synchronously on first render so currentDrafts
  // in the parent is non-null before any Save & Publish can fire.
  useEffect(() => {
    if (!onDraftsChangeRef.current) return;
    onDraftsChangeRef.current({ treatments: drafts, bundles: bundleDrafts, questions: questionDrafts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally fires on mount only

  useEffect(() => {
    if (!onDraftsChangeRef.current) return;
    const timer = setTimeout(() => {
      onDraftsChangeRef.current?.({
        treatments: drafts,
        bundles: bundleDrafts,
        questions: questionDrafts,
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [drafts, bundleDrafts, questionDrafts]);

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

  const dirtyQuestionIds = useMemo(
    () => computeDirtyQuestionIds(questionDrafts, questionOriginals),
    [questionDrafts, questionOriginals],
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

  // Update the selected question draft.
  const handleQuestionUpdate = useCallback(
    (updated: EditableQuestion) => {
      if (!selectedQuestionId) return;
      setQuestionDrafts((prev) => ({
        ...prev,
        [selectedQuestionId]: updated,
      }));
    },
    [selectedQuestionId],
  );

  // Reset the selected question draft to the original.
  const handleQuestionReset = useCallback(() => {
    if (!selectedQuestionId) return;
    const orig = questionOriginals[selectedQuestionId];
    if (!orig) return;
    setQuestionDrafts((prev) => ({
      ...prev,
      [selectedQuestionId]: { ...orig, options: orig.options.map((o) => ({ ...o })) },
    }));
  }, [selectedQuestionId, questionOriginals]);

  // Delete the selected treatment from editor state.
  const handleDeleteTreatment = useCallback(() => {
    if (!selectedId) return;
    const draft = drafts[selectedId];
    if (!draft) return;

    // Count references for the warning message
    const questionRefs = Object.values(QUESTIONS).filter(q =>
      q.type === 'single' && q.options.some(o => 'recommend' in o && o.recommend === selectedId)
    ).length;
    const bundleRefs = Object.values(bundleDrafts).filter(b =>
      b.primary === selectedId || b.addOn === selectedId
    ).length;

    const refCount = questionRefs + bundleRefs;
    const msg = refCount > 0
      ? `Delete "${draft.name}"? Referenced by ${questionRefs} question(s) and ${bundleRefs} bundle(s). Those references will break.`
      : `Delete "${draft.name}"?`;

    if (!window.confirm(msg)) return;

    setDrafts(prev => { const n = { ...prev }; delete n[selectedId]; return n; });
    setOriginals(prev => { const n = { ...prev }; delete n[selectedId]; return n; });
    setSelectedId(null);
  }, [selectedId, drafts, bundleDrafts]);

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

  // Add Question dialog handler.
  const handleAddQuestion = useCallback(
    (
      id: string,
      title: string,
      subtitle: string | undefined,
      type: 'single' | 'multi',
      starterOption: StarterOption,
    ) => {
      const newQuestion: EditableQuestion = {
        id,
        title,
        subtitle: subtitle ?? '',
        type,
        options: [
          {
            label: starterOption.label,
            sublabel: '',
            icon: '',
            next: starterOption.next ?? '',
            recommend: starterOption.recommend ?? '',
          },
        ],
      };
      setQuestionDrafts((prev) => ({ ...prev, [id]: newQuestion }));
      setSelectedQuestionId(id);
      setEditorMode('questions');
      setShowAddQuestionDialog(false);
    },
    [],
  );

  // Add Bundle dialog handler.
  const handleAddBundle = useCallback(
    (id: string, name: string, primary: string, addOn: string | null, acuityTypeId: number) => {
      const newBundle: EditableBundle = {
        id: id as import('../../../types/bundle').BundleId,
        name,
        primary,
        addOn,
        addOnInteractive: false,
        whyMatch: '',
        acuityTypeId,
        addOnLabel: undefined,
        acuityDropdownValue: undefined,
        price: undefined,
        priceLabel: undefined,
        shortDesc: undefined,
        pageUrl: undefined,
      };
      setBundleDrafts((prev) => ({ ...prev, [id]: newBundle }));
      setSelectedBundleId(id);
      setEditorMode('bundles');
      setShowAddBundleDialog(false);
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

  const selectedQuestionDraft = selectedQuestionId ? questionDrafts[selectedQuestionId] : null;
  const selectedQuestionIsDirty = selectedQuestionId && selectedQuestionDraft
    ? isQuestionDirty(selectedQuestionDraft, questionOriginals[selectedQuestionId])
    : false;

  return (
    <div className="wde-editor wde-layout">
      <EditorSidebar
        mode={editorMode}
        onModeChange={(m) => { setEditorMode(m); setSearchQuery(''); }}
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
        onAddBundle={() => setShowAddBundleDialog(true)}
        onAddQuestion={() => setShowAddQuestionDialog(true)}
        bundles={bundleDrafts}
        selectedBundleId={selectedBundleId}
        onSelectBundle={setSelectedBundleId}
        dirtyBundleIds={dirtyBundleIds}
        questions={questionDrafts}
        selectedQuestionId={selectedQuestionId}
        onSelectQuestion={setSelectedQuestionId}
        dirtyQuestionIds={dirtyQuestionIds}
      />

      {showAddDialog && (
        <AddTreatmentDialog
          existingIds={new Set(Object.keys(drafts))}
          onConfirm={handleAddTreatment}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {showAddQuestionDialog && (
        <AddQuestionDialog
          existingIds={[...Object.keys(QUESTIONS), ...Object.keys(questionDrafts)]}
          questions={QUESTIONS}
          treatments={TREATMENTS}
          onConfirm={handleAddQuestion}
          onCancel={() => setShowAddQuestionDialog(false)}
        />
      )}

      {showAddBundleDialog && (
        <AddBundleDialog
          existingIds={[...Object.keys(BUNDLES), ...Object.keys(bundleDrafts)]}
          treatments={TREATMENTS}
          onConfirm={handleAddBundle}
          onCancel={() => setShowAddBundleDialog(false)}
        />
      )}

      {editorMode === 'treatments' ? (
        selectedDraft ? (
          <EditorMain
            draft={selectedDraft}
            isDirty={selectedIsDirty}
            validationResult={validationResult}
            allDrafts={drafts}
            allPaths={allPaths}
            onUpdate={handleUpdate}
            onReset={handleReset}
            onDelete={handleDeleteTreatment}
            onSelectQuestion={(id) => { setSelectedQuestionId(id); setEditorMode('questions'); }}
            validationFailure={validationFailure}
            clearValidationFailure={clearValidationFailure}
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
      ) : editorMode === 'bundles' ? (
        selectedBundleDraft ? (
          <BundleEditPanel
            bundle={selectedBundleDraft}
            isDirty={selectedBundleIsDirty}
            allTreatments={drafts}
            onUpdate={handleBundleUpdate}
            onReset={handleBundleReset}
            validationFailure={validationFailure}
            clearValidationFailure={clearValidationFailure}
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
      ) : (
        selectedQuestionDraft ? (
          <QuestionEditPanel
            question={selectedQuestionDraft}
            isDirty={selectedQuestionIsDirty}
            allQuestions={questionDrafts}
            allTreatments={drafts}
            allBundles={bundleDrafts}
            onUpdate={handleQuestionUpdate}
            onReset={handleQuestionReset}
            onSelectQuestion={(id) => { setSelectedQuestionId(id); setEditorMode('questions'); }}
            onSelectTreatment={(id) => { setSelectedId(id); setEditorMode('treatments'); }}
            validationFailure={validationFailure}
            clearValidationFailure={clearValidationFailure}
          />
        ) : (
          <div className="wde-main">
            <div className="wde-empty-state">
              <div>Select a question</div>
              <div className="wde-empty-state-hint">
                Choose a question from the sidebar to begin editing the decision tree.
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
