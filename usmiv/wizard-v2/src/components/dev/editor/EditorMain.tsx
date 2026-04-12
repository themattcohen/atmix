/**
 * editor/EditorMain.tsx -- Right column of the Treatment Config Editor.
 *
 * The full edit form for the selected treatment: basic info, descriptions,
 * best-for tags, ingredients, addon suggestions, scoring weights, and
 * code output.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { TreatmentId } from '../../../types/treatment';
import type { ValidationResult } from '../../../engine/validateConfig';
import type { EditableTreatment } from './types';
import { issuesForTreatment } from './types';
import type { SaveStatus } from './EditorTab';
import { generateTreatmentTs, generateCategoryFileTs, categoryFileName } from './codeGen';
import { SYMPTOM_LABELS, TREATMENTS } from '../../../data';
import { mapIssuesToFields } from '../../../utils/issueMapper';
import { categoryLabel, catBadgeSmClass } from '../../../utils/dashboardHelpers';
import type { ResolvedPath } from '../../../utils/pathResolver';
import { pathsForTreatment } from '../../../utils/pathResolver';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditorMainProps {
  draft: EditableTreatment;
  isDirty: boolean;
  dirtyIds: Set<TreatmentId>;
  validationResult: ValidationResult | null;
  allDrafts: Record<string, EditableTreatment>;
  saveStatus: SaveStatus;
  allPaths: ResolvedPath[];
  onUpdate: (field: keyof EditableTreatment, value: unknown) => void;
  onReset: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onPublish?: () => void;
  canPublish?: boolean;
  publishStatus?: SaveStatus;
}

// ── TagEditor (bestFor) ───────────────────────────────────────────────────────

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagEditor({ tags, onChange }: TagEditorProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');

  const handleRemove = useCallback(
    (idx: number) => {
      const next = tags.filter((_, i) => i !== idx);
      onChange(next);
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed && !tags.includes(trimmed)) {
          onChange([...tags, trimmed]);
          setInputValue('');
        }
      }
    },
    [inputValue, tags, onChange],
  );

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
    }
  }, [inputValue, tags, onChange]);

  return (
    <div>
      {tags.length > 0 && (
        <div className="wde-tag-list">
          {tags.map((tag, i) => (
            <span key={i} className="wde-tag-chip">
              <span className="wde-tag-chip__text">{tag}</span>
              <button
                className="wde-tag-chip__remove"
                onClick={() => handleRemove(i)}
                title="Remove tag"
                type="button"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="wde-tag-add-row">
        <input
          className="wde-input wde-tag-add-input"
          type="text"
          placeholder="Add tag..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="wde-tag-add-btn"
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── IngredientsEditor ─────────────────────────────────────────────────────────

interface IngredientsEditorProps {
  ingredients: EditableTreatment['ingredients'];
  onChange: (ingredients: EditableTreatment['ingredients']) => void;
}

function IngredientsEditor({ ingredients, onChange }: IngredientsEditorProps): React.ReactElement {
  const handleNameChange = useCallback(
    (idx: number, value: string) => {
      const next = ingredients.map((ing, i) => i === idx ? { ...ing, name: value } : ing);
      onChange(next);
    },
    [ingredients, onChange],
  );

  const handleBenefitChange = useCallback(
    (idx: number, value: string) => {
      const next = ingredients.map((ing, i) => i === idx ? { ...ing, benefit: value } : ing);
      onChange(next);
    },
    [ingredients, onChange],
  );

  const handleMoveUp = useCallback(
    (idx: number) => {
      if (idx === 0) return;
      const next = [...ingredients];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      onChange(next);
    },
    [ingredients, onChange],
  );

  const handleMoveDown = useCallback(
    (idx: number) => {
      if (idx === ingredients.length - 1) return;
      const next = [...ingredients];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      onChange(next);
    },
    [ingredients, onChange],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      onChange(ingredients.filter((_, i) => i !== idx));
    },
    [ingredients, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([...ingredients, { name: '', benefit: '' }]);
  }, [ingredients, onChange]);

  return (
    <div>
      <div className="wde-ingredient-rows">
        {ingredients.map((ing, idx) => (
          <div key={idx} className="wde-ingredient-row">
            <span className="wde-ingredient-handle" title="Use arrows to reorder">&#8942;&#8942;</span>
            <input
              className="wde-input wde-ingredient-name"
              type="text"
              placeholder="Ingredient name"
              value={ing.name}
              onChange={(e) => handleNameChange(idx, e.target.value)}
            />
            <input
              className="wde-input wde-ingredient-benefit"
              type="text"
              placeholder="Benefit description"
              value={ing.benefit}
              onChange={(e) => handleBenefitChange(idx, e.target.value)}
            />
            <button
              className="wde-ingredient-btn"
              type="button"
              title="Move up"
              disabled={idx === 0}
              onClick={() => handleMoveUp(idx)}
            >
              &uarr;
            </button>
            <button
              className="wde-ingredient-btn"
              type="button"
              title="Move down"
              disabled={idx === ingredients.length - 1}
              onClick={() => handleMoveDown(idx)}
            >
              &darr;
            </button>
            <button
              className="wde-ingredient-btn wde-ingredient-btn--remove"
              type="button"
              title="Remove ingredient"
              onClick={() => handleRemove(idx)}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button
        className="wde-ingredient-add-btn"
        type="button"
        onClick={handleAdd}
      >
        + Add ingredient
      </button>
    </div>
  );
}

// ── ScoringWeightsEditor ──────────────────────────────────────────────────────

interface ScoringWeightsEditorProps {
  scoringWeights: Record<string, number>;
  addressedBy: Record<string, string>;
  onWeightsChange: (weights: Record<string, number>) => void;
  onAddressedByChange: (addressedBy: Record<string, string>) => void;
}

function ScoringWeightsEditor({
  scoringWeights,
  addressedBy,
  onWeightsChange,
  onAddressedByChange,
}: ScoringWeightsEditorProps): React.ReactElement {
  const handleWeightChange = useCallback(
    (symptom: string, rawValue: number) => {
      const value = Math.max(0, Math.min(10, rawValue));
      const nextWeights = { ...scoringWeights };
      if (value === 0) {
        delete nextWeights[symptom];
        // Also clear the addressedBy entry so it does not appear in code output
        const nextAddressedBy = { ...addressedBy };
        delete nextAddressedBy[symptom];
        onAddressedByChange(nextAddressedBy);
      } else {
        nextWeights[symptom] = value;
      }
      onWeightsChange(nextWeights);
    },
    [scoringWeights, addressedBy, onWeightsChange, onAddressedByChange],
  );

  const handleAddressedByChange = useCallback(
    (symptom: string, value: string) => {
      const next = { ...addressedBy };
      if (value.trim() === '') {
        delete next[symptom];
      } else {
        next[symptom] = value;
      }
      onAddressedByChange(next);
    },
    [addressedBy, onAddressedByChange],
  );

  return (
    <div className="wde-weight-rows">
      {SYMPTOM_LABELS.map((symptom) => {
        const weight = scoringWeights[symptom] ?? 0;
        const pct = (weight / 10) * 100;
        const addressedText = addressedBy[symptom] ?? '';

        return (
          <div key={symptom} className="wde-weight-row">
            <div className="wde-weight-main">
              <span className="wde-weight-label">{symptom}</span>
              <input
                className="wde-weight-slider"
                type="range"
                min={0}
                max={10}
                step={1}
                value={weight}
                style={{ '--pct': pct } as React.CSSProperties}
                onChange={(e) => handleWeightChange(symptom, Number(e.target.value))}
              />
              <input
                className="wde-input wde-weight-number"
                type="number"
                min={0}
                max={10}
                value={weight}
                onChange={(e) => handleWeightChange(symptom, Number(e.target.value))}
              />
            </div>
            {weight > 0 && (
              <div className="wde-addressed-wrap">
                <span className="wde-addressed-label">Addressed by text</span>
                <input
                  className="wde-input wde-addressed-input"
                  type="text"
                  placeholder={`How this addresses "${symptom}"...`}
                  value={addressedText}
                  onChange={(e) => handleAddressedByChange(symptom, e.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AddonSuggestionsEditor ────────────────────────────────────────────────────

interface AddonSuggestionsEditorProps {
  addonSuggestions: TreatmentId[];
  injectionDrafts: EditableTreatment[];
  onChange: (ids: TreatmentId[]) => void;
}

function AddonSuggestionsEditor({
  addonSuggestions,
  injectionDrafts,
  onChange,
}: AddonSuggestionsEditorProps): React.ReactElement {
  const handleToggle = useCallback(
    (id: TreatmentId, checked: boolean) => {
      if (checked) {
        onChange([...addonSuggestions, id]);
      } else {
        onChange(addonSuggestions.filter((a) => a !== id));
      }
    },
    [addonSuggestions, onChange],
  );

  if (injectionDrafts.length === 0) {
    return <p style={{ fontSize: 12, color: '#94a3b8' }}>No injection treatments found.</p>;
  }

  return (
    <div className="wde-addon-list">
      {injectionDrafts.map((inj) => {
        const checked = addonSuggestions.includes(inj.id);
        return (
          <label key={inj.id} className="wde-addon-item">
            <input
              className="wde-addon-checkbox"
              type="checkbox"
              checked={checked}
              onChange={(e) => handleToggle(inj.id, e.target.checked)}
            />
            <span className="wde-addon-label">{inj.name}</span>
            <span className="wde-addon-price">
              {inj.priceLabel && inj.priceLabel.trim() ? inj.priceLabel : `$${inj.price}`}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ── PathsInEditor ─────────────────────────────────────────────────────────────

interface PathsInEditorProps {
  paths: ResolvedPath[];
  treatmentName: string;
}

function PathsInEditor({ paths, treatmentName }: PathsInEditorProps): React.ReactElement {

  return (
    <div>
      {paths.length === 0 ? (
        <div style={{
          padding: '8px 12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 4,
          fontSize: 12,
          color: '#92400e',
        }}>
          No wizard paths reach this treatment. Add it as a recommend option in a question, or add scoring weights.
        </div>
      ) : (
        paths.map((p, i) => {
          const labels = p.steps.filter((_, idx) => idx % 2 === 1);
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              padding: '6px 10px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              {labels.map((label, j) => (
                <React.Fragment key={j}>
                  <span style={{
                    display: 'inline-flex',
                    padding: '2px 7px',
                    background: '#f1f5f9',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 10, margin: '0 1px' }}>&gt;</span>
                </React.Fragment>
              ))}
              <span style={{
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 4,
                fontSize: 12,
                background: '#e0f2f1',
                color: '#00695c',
                whiteSpace: 'nowrap',
              }}>
                {treatmentName}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── CodeSection ───────────────────────────────────────────────────────────────

interface CodeSectionProps {
  draft: EditableTreatment;
  allDraftsInCategory: EditableTreatment[];
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}

function CodeSection({
  draft,
  allDraftsInCategory,
  copiedKey,
  onCopy,
}: CodeSectionProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const treatmentCode = generateTreatmentTs(draft);
  const categoryCode = generateCategoryFileTs(allDraftsInCategory, draft.category);
  const fileName = categoryFileName(draft.category);

  const treatmentKey = `treatment-${draft.id}`;
  const categoryKey = `category-${draft.category}`;

  return (
    <div className="wde-code-section">
      <button
        className="wde-code-toggle"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`wde-code-toggle-arrow${open ? ' wde-code-toggle-arrow--open' : ''}`}>&#9654;</span>
        Code Output
      </button>

      {open && (
        <div className="wde-code-body">
          <div className="wde-code-actions">
            <button
              className={`wde-copy-btn${copiedKey === treatmentKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => onCopy(treatmentKey, treatmentCode)}
            >
              {copiedKey === treatmentKey ? 'Copied!' : 'Copy treatment code'}
            </button>
            <button
              className={`wde-copy-btn${copiedKey === categoryKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => onCopy(categoryKey, categoryCode)}
            >
              {copiedKey === categoryKey ? 'Copied!' : `Copy full ${fileName}.ts file`}
            </button>
          </div>
          <pre className="wde-code-pre">{treatmentCode}</pre>
        </div>
      )}
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  errorMsg?: string;
  warningMsg?: string;
  children: React.ReactNode;
}

function FieldRow({ label, errorMsg, warningMsg, children }: FieldRowProps): React.ReactElement {
  return (
    <div className="wde-field-row">
      <span className="wde-field-label">{label}</span>
      <div className="wde-field-right">
        {children}
        {errorMsg && <span className="wde-field-error">{errorMsg}</span>}
        {!errorMsg && warningMsg && <span className="wde-field-warning">{warningMsg}</span>}
      </div>
    </div>
  );
}

// ── EditorMain ────────────────────────────────────────────────────────────────

export function EditorMain({
  draft,
  isDirty,
  dirtyIds,
  validationResult,
  allDrafts,
  saveStatus,
  allPaths,
  onUpdate,
  onReset,
  onSave,
  onSaveAll,
  onPublish,
  canPublish,
  publishStatus,
}: EditorMainProps): React.ReactElement {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const issuesSummaryRef = useRef<HTMLDivElement>(null);

  const issues = issuesForTreatment(validationResult, draft.id);

  const mappedIssues = useMemo(
    () => mapIssuesToFields(validationResult, draft.id),
    [validationResult, draft.id],
  );
  const hasErrors = issues.errors.length > 0;
  const hasWarnings = issues.warnings.length > 0;

  // Helper to find first error/warning for a given field
  function fieldError(fieldName: string): string | undefined {
    return issues.errors.find((i) => i.field === fieldName || i.field.startsWith(fieldName))?.message;
  }
  function fieldWarning(fieldName: string): string | undefined {
    return issues.warnings.find((i) => i.field === fieldName || i.field.startsWith(fieldName))?.message;
  }

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);

  // Detect if this is a newly-created treatment (not in compiled TREATMENTS catalog)
  const isNewTreatment = !(draft.id in TREATMENTS);

  // All injection-category drafts for addon suggestions
  const injectionDrafts = Object.values(allDrafts).filter(
    (d) => d.category === 'injection',
  );

  // All drafts in the same category for full-file copy
  const allDraftsInCategory = Object.values(allDrafts).filter(
    (d) => d.category === draft.category,
  );

  // Pre-compute paths to this treatment once
  const pathsToDraftMemo = useMemo(
    () => pathsForTreatment(draft.id, allPaths),
    [draft.id, allPaths],
  );

  // Status badge
  let statusBadgeCls = 'wde-status-badge wde-status-badge--valid';
  let statusLabel = 'Valid';
  if (hasErrors) {
    statusBadgeCls = 'wde-status-badge wde-status-badge--error';
    statusLabel = `${issues.errors.length} error${issues.errors.length !== 1 ? 's' : ''}`;
  } else if (hasWarnings) {
    statusBadgeCls = 'wde-status-badge wde-status-badge--warning';
    statusLabel = `${issues.warnings.length} warning${issues.warnings.length !== 1 ? 's' : ''}`;
  }

  const headerCopyKey = `header-ts-${draft.id}`;
  const isSaving = saveStatus.state === 'saving';

  // Count dirty categories for "Save All" label
  const dirtyCategoryCount = new Set(
    [...dirtyIds].map((id) => (allDrafts[id] as EditableTreatment | undefined)?.category).filter(Boolean),
  ).size;

  return (
    <div className="wde-main">
      {/* Save status banner */}
      {saveStatus.state === 'saved' && (
        <div className="wde-save-banner wde-save-banner--ok">
          Saved to {saveStatus.path}. Vite will hot-reload the module.{' '}
          <button
            className="wde-save-banner-reload"
            type="button"
            onClick={() => {
              const hasOtherDirty = dirtyIds.size > 1 || (dirtyIds.size === 1 && !dirtyIds.has(draft.id));
              if (hasOtherDirty && !window.confirm('You have unsaved changes in other treatments. Reload anyway?')) return;
              window.location.reload();
            }}
          >
            Reload now
          </button>
        </div>
      )}
      {saveStatus.state === 'error' && (
        <div className="wde-save-banner wde-save-banner--error">
          Save failed: {saveStatus.message}
        </div>
      )}
      {publishStatus?.state === 'saved' && (
        <div className="wde-save-banner wde-save-banner--ok">
          {(publishStatus as { state: 'saved'; path: string }).path}
        </div>
      )}
      {publishStatus?.state === 'error' && (
        <div className="wde-save-banner wde-save-banner--error">
          Publish failed: {(publishStatus as { state: 'error'; message: string }).message}
        </div>
      )}

      {/* Sticky header */}
      <div className="wde-form-header">
        <span className="wde-form-id">{draft.id}</span>
        <span className="wde-form-title">{draft.name}</span>
        {(hasErrors || hasWarnings) ? (
          <button
            type="button"
            className={`${statusBadgeCls} wde-status-badge--clickable`}
            title="Click to scroll to issues"
            onClick={() => issuesSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {statusLabel}
          </button>
        ) : (
          <span className={statusBadgeCls}>{statusLabel}</span>
        )}
        <button
          className={`wde-save-btn${!isDirty || isSaving ? ' wde-save-btn--disabled' : ''}`}
          type="button"
          disabled={!isDirty || isSaving}
          onClick={onSave}
          title={isDirty ? 'Write this category to disk' : 'No changes to save'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        {dirtyCategoryCount > 1 && (
          <button
            className={`wde-save-all-btn${isSaving ? ' wde-save-btn--disabled' : ''}`}
            type="button"
            disabled={isSaving}
            onClick={onSaveAll}
            title={`Save all ${dirtyCategoryCount} modified categories`}
          >
            {isSaving ? 'Saving...' : `Save All (${dirtyCategoryCount})`}
          </button>
        )}
        <button
          className={`wde-copy-btn wde-copy-btn--sm${copiedKey === headerCopyKey ? ' wde-copy-btn--ok' : ''}`}
          type="button"
          onClick={() => handleCopy(headerCopyKey, generateTreatmentTs(draft))}
          title="Copy TypeScript for this treatment"
        >
          {copiedKey === headerCopyKey ? 'Copied!' : 'Copy TS'}
        </button>
        {canPublish && onPublish && (
          <button type="button" className="wde-publish-btn" onClick={onPublish}
            disabled={publishStatus?.state === 'saving'}>
            {publishStatus?.state === 'saving' ? 'Publishing...' : 'Publish Live'}
          </button>
        )}
        <button
          className={`wde-reset-btn${!isDirty ? ' wde-reset-btn--hidden' : ''}`}
          type="button"
          disabled={!isDirty}
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      <div className="wde-form-body">
        {/* New treatment banner */}
        {isNewTreatment && (
          <div className="wde-new-treatment-banner">
            <strong>New treatment created.</strong> Fill in the required fields below to complete setup, then click Save.
          </div>
        )}

        {/* 0. Issues summary (shown when there are errors or warnings) */}
        {mappedIssues.length > 0 && (
          <div className="wde-issues-summary" ref={issuesSummaryRef}>
            {mappedIssues.map((issue, idx) => (
              <div
                key={idx}
                className={`wde-issue-item wde-issue-item--${issue.severity}`}
              >
                <div className="wde-issue-badge">
                  {issue.severity === 'error' ? 'Error' : 'Warning'}
                </div>
                <div className="wde-issue-content">
                  <div className="wde-issue-field">
                    <span className="wde-issue-field-name">{issue.field}</span>
                    <span className="wde-issue-section">{issue.editorSection}</span>
                  </div>
                  <div className="wde-issue-message">{issue.message}</div>
                  <div className="wde-issue-why">{issue.why}</div>
                  <div className="wde-issue-fix">
                    <strong>Fix:</strong> {issue.fix}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 1. Basic Info */}
        <div className="wde-section">
          <div className="wde-section-head">Basic Info</div>

          <FieldRow label="name" errorMsg={fieldError('name')}>
            <input
              className="wde-input wde-field-input"
              type="text"
              value={draft.name}
              onChange={(e) => onUpdate('name', e.target.value)}
            />
          </FieldRow>

          <FieldRow label="price" errorMsg={fieldError('price')}>
            <input
              className="wde-input wde-field-input"
              type="text"
              value={draft.price}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!isNaN(n)) onUpdate('price', n);
              }}
            />
          </FieldRow>

          <FieldRow label="priceLabel">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="e.g. from $199/month (optional)"
              value={draft.priceLabel ?? ''}
              onChange={(e) => onUpdate('priceLabel', e.target.value || undefined)}
            />
          </FieldRow>

          <FieldRow label="duration">
            <input
              className="wde-input wde-field-input"
              type="text"
              value={draft.duration}
              onChange={(e) => onUpdate('duration', e.target.value)}
            />
          </FieldRow>

          <FieldRow label="category">
            <span className={catBadgeSmClass(draft.category)} style={{ display: 'inline-block', padding: '4px 10px', fontSize: 11 }}>
              {categoryLabel(draft.category)}
            </span>
          </FieldRow>

          <FieldRow label="acuityTypeId" errorMsg={fieldError('acuityTypeId')}>
            <input
              className={`wde-input wde-field-input${fieldError('acuityTypeId') ? ' wde-input--error' : ''}`}
              type="number"
              value={draft.acuityTypeId}
              onChange={(e) => onUpdate('acuityTypeId', Number(e.target.value))}
            />
          </FieldRow>

          <FieldRow label="acuityDropdownValue">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="null"
              value={draft.acuityDropdownValue ?? ''}
              onChange={(e) => onUpdate('acuityDropdownValue', e.target.value || null)}
            />
          </FieldRow>

          <FieldRow label="pageUrl">
            <input
              className="wde-input wde-field-input"
              type="text"
              value={draft.pageUrl}
              onChange={(e) => onUpdate('pageUrl', e.target.value)}
            />
          </FieldRow>
        </div>

        {/* 2. Descriptions */}
        <div className="wde-section">
          <div className="wde-section-head">Descriptions</div>

          <FieldRow label="shortDesc">
            <input
              className="wde-input wde-field-input"
              type="text"
              value={draft.shortDesc}
              onChange={(e) => onUpdate('shortDesc', e.target.value)}
            />
          </FieldRow>

          <FieldRow
            label="whyMatch"
            warningMsg={fieldWarning('whyMatch')}
          >
            <textarea
              className="wde-input wde-field-textarea"
              rows={4}
              value={draft.whyMatch}
              onChange={(e) => onUpdate('whyMatch', e.target.value)}
            />
            <span className="wde-field-note">{draft.whyMatch.length} characters</span>
          </FieldRow>

          <FieldRow label="note">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="Optional italic footnote (GLP-1 programs)"
              value={draft.note ?? ''}
              onChange={(e) => onUpdate('note', e.target.value || undefined)}
            />
          </FieldRow>
        </div>

        {/* 3. Best For */}
        <div className="wde-section">
          <div className="wde-section-head">Best For</div>
          <TagEditor
            tags={draft.bestFor}
            onChange={(tags) => onUpdate('bestFor', tags)}
          />
        </div>

        {/* 4. Ingredients */}
        <div className="wde-section">
          <div className="wde-section-head">Ingredients</div>
          <IngredientsEditor
            ingredients={draft.ingredients}
            onChange={(ings) => onUpdate('ingredients', ings)}
          />
        </div>

        {/* 5. Addon Suggestions */}
        <div className="wde-section">
          <div className="wde-section-head">Addon Suggestions</div>
          <AddonSuggestionsEditor
            addonSuggestions={draft.addonSuggestions}
            injectionDrafts={injectionDrafts}
            onChange={(ids) => onUpdate('addonSuggestions', ids)}
          />
          {fieldWarning('addonSuggestions') && (
            <p className="wde-field-warning" style={{ marginTop: 8, marginBottom: 0 }}>
              {fieldWarning('addonSuggestions')}
            </p>
          )}
        </div>

        {/* 6. Scoring Weights */}
        <div className="wde-section">
          <div className="wde-section-head">Scoring Weights</div>
          <ScoringWeightsEditor
            scoringWeights={draft.scoringWeights}
            addressedBy={draft.addressedBy}
            onWeightsChange={(w) => onUpdate('scoringWeights', w)}
            onAddressedByChange={(a) => onUpdate('addressedBy', a)}
          />
        </div>

        {/* 7. Paths to this Treatment */}
        {(() => {
          const pathsToDraft = pathsToDraftMemo;
          return (
            <div className="wde-section">
              <div className="wde-section-head">
                PATHS TO THIS TREATMENT
                <span style={{ fontWeight: 400, fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                  ({pathsToDraft.length} path{pathsToDraft.length !== 1 ? 's' : ''})
                </span>
              </div>
              <PathsInEditor paths={pathsToDraft} treatmentName={draft.name} />
            </div>
          );
        })()}

        {/* 8. Code Output */}
        <CodeSection
          draft={draft}
          allDraftsInCategory={allDraftsInCategory}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}
