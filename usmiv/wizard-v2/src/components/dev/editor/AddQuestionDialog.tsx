/**
 * editor/AddQuestionDialog.tsx -- Modal dialog for creating a new question draft.
 *
 * Collects question ID, title, subtitle, type, and a starter option.
 * Validates inputs inline before allowing confirmation.
 */

import React, { useState, useCallback } from 'react';
import type { Question } from '../../../types/question';
import type { Treatment } from '../../../types/treatment';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StarterOption {
  label: string;
  next?: string;
  recommend?: string;
}

interface AddQuestionDialogProps {
  existingIds: string[];
  questions: Readonly<Record<string, Question>>;
  treatments: Readonly<Record<string, Treatment>>;
  onConfirm: (
    id: string,
    title: string,
    subtitle: string | undefined,
    type: 'single' | 'multi',
    starterOption: StarterOption,
  ) => void;
  onCancel: () => void;
}

// ── Validation ────────────────────────────────────────────────────────────────

const ID_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;

function validateQuestionId(id: string, existingIds: string[]): string | null {
  if (!id) return 'ID is required';
  if (id.length > 50) return 'ID must be 50 characters or fewer';
  if (!/^[a-z0-9-]+$/.test(id)) return 'Use lowercase letters, numbers, and hyphens only';
  if (!ID_PATTERN.test(id)) return 'ID must start and end with a letter or number';
  if (existingIds.includes(id)) return 'A question with this ID already exists';
  return null;
}

function validateTitle(title: string): string | null {
  if (!title.trim()) return 'Title is required';
  return null;
}

function validateOptionLabel(label: string): string | null {
  if (!label.trim()) return 'Option label is required';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddQuestionDialog({
  existingIds,
  questions,
  treatments,
  onConfirm,
  onCancel,
}: AddQuestionDialogProps): React.ReactElement {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [type, setType] = useState<'single' | 'multi'>('single');

  // Starter option fields
  const [optionLabel, setOptionLabel] = useState('');
  const [routingMode, setRoutingMode] = useState<'next' | 'recommend'>('next');
  const [routingTarget, setRoutingTarget] = useState('');

  // Touch tracking (show errors only after user has interacted with a field)
  const [idTouched, setIdTouched] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [optionLabelTouched, setOptionLabelTouched] = useState(false);

  const idError = validateQuestionId(id, existingIds);
  const titleError = validateTitle(title);
  const optionLabelError = validateOptionLabel(optionLabel);

  // Routing target is required when a target list has entries
  const questionKeys = Object.keys(questions);
  const treatmentKeys = Object.keys(treatments);
  const targetOptions = routingMode === 'next' ? questionKeys : treatmentKeys;
  const routingTargetMissing = routingTarget === '' && targetOptions.length > 0;

  const isValid =
    idError === null &&
    titleError === null &&
    optionLabelError === null &&
    !routingTargetMissing;

  // Auto-select first target when routing mode changes
  const handleRoutingModeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const mode = e.target.value as 'next' | 'recommend';
      setRoutingMode(mode);
      const opts = mode === 'next' ? questionKeys : treatmentKeys;
      setRoutingTarget(opts[0] ?? '');
    },
    [questionKeys, treatmentKeys],
  );

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    const starterOption: StarterOption = { label: optionLabel.trim() };
    if (routingMode === 'next' && routingTarget) {
      starterOption.next = routingTarget;
    } else if (routingMode === 'recommend' && routingTarget) {
      starterOption.recommend = routingTarget;
    }
    onConfirm(
      id.trim(),
      title.trim(),
      subtitle.trim() || undefined,
      type,
      starterOption,
    );
  }, [isValid, id, title, subtitle, type, optionLabel, routingMode, routingTarget, onConfirm]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && isValid) handleConfirm();
    },
    [isValid, handleConfirm, onCancel],
  );

  // Initialize routing target on first render
  const defaultTarget = routingMode === 'next' ? (questionKeys[0] ?? '') : (treatmentKeys[0] ?? '');
  const effectiveTarget = routingTarget || defaultTarget;

  return (
    <div
      className="wde-dialog-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wde-dialog-title"
    >
      <div className="wde-dialog">
        <div className="wde-dialog-title" id="wde-dialog-title">
          New Question
        </div>

        {/* Question ID */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-qid">
            Question ID
          </label>
          <input
            id="wde-add-qid"
            className="wde-dialog-input"
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onBlur={() => setIdTouched(true)}
            placeholder="e.g. skin-concern"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {idTouched && idError && (
            <div className="wde-dialog-error">{idError}</div>
          )}
        </div>

        {/* Title */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-qtitle">
            Title
          </label>
          <input
            id="wde-add-qtitle"
            className="wde-dialog-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTitleTouched(true)}
            placeholder="e.g. What is your main concern?"
            autoComplete="off"
          />
          {titleTouched && titleError && (
            <div className="wde-dialog-error">{titleError}</div>
          )}
        </div>

        {/* Subtitle (optional) */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-qsubtitle">
            Subtitle <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="wde-add-qsubtitle"
            className="wde-dialog-input"
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. Choose the option that best fits"
            autoComplete="off"
          />
        </div>

        {/* Type */}
        <div className="wde-dialog-field">
          <div className="wde-dialog-label">Type</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name="wde-qtype"
                value="single"
                checked={type === 'single'}
                onChange={() => setType('single')}
              />
              Single (one answer)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name="wde-qtype"
                value="multi"
                checked={type === 'multi'}
                onChange={() => setType('multi')}
              />
              Multi (symptom picker)
            </label>
          </div>
        </div>

        {/* Starter option */}
        <div className="wde-dialog-field" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
          <div className="wde-dialog-label" style={{ marginBottom: 8 }}>
            Starter Option
            <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7, marginLeft: 6 }}>
              (every question needs at least one option)
            </span>
          </div>

          {/* Option label */}
          <div className="wde-dialog-field">
            <label className="wde-dialog-label" htmlFor="wde-add-opt-label">
              Option label
            </label>
            <input
              id="wde-add-opt-label"
              className="wde-dialog-input"
              type="text"
              value={optionLabel}
              onChange={(e) => setOptionLabel(e.target.value)}
              onBlur={() => setOptionLabelTouched(true)}
              placeholder="e.g. Yes"
              autoComplete="off"
            />
            {optionLabelTouched && optionLabelError && (
              <div className="wde-dialog-error">{optionLabelError}</div>
            )}
          </div>

          {/* Routing mode (single-type questions only) */}
          {type === 'single' && (
            <>
              <div className="wde-dialog-label" style={{ marginTop: 10 }}>Routing</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="wde-routing-mode"
                    value="next"
                    checked={routingMode === 'next'}
                    onChange={handleRoutingModeChange}
                  />
                  Goes to question
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="wde-routing-mode"
                    value="recommend"
                    checked={routingMode === 'recommend'}
                    onChange={handleRoutingModeChange}
                  />
                  Recommends treatment
                </label>
              </div>

              {targetOptions.length > 0 ? (
                <div className="wde-dialog-field">
                  <label className="wde-dialog-label" htmlFor="wde-add-opt-target">
                    {routingMode === 'next' ? 'Destination question' : 'Recommended treatment'}
                  </label>
                  <select
                    id="wde-add-opt-target"
                    className="wde-dialog-select"
                    value={effectiveTarget}
                    onChange={(e) => setRoutingTarget(e.target.value)}
                  >
                    {targetOptions.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  No {routingMode === 'next' ? 'questions' : 'treatments'} available to route to.
                </div>
              )}
            </>
          )}

          {type === 'multi' && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
              Multi-type options are symptom checkboxes with no routing target.
            </div>
          )}
        </div>

        {/* Orphan warning */}
        <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 4, padding: '8px 10px', marginTop: 4 }}>
          This question will have no inbound path after creation. Add it as a destination from another question option to make it reachable.
        </div>

        {/* Actions */}
        <div className="wde-dialog-actions">
          <button
            type="button"
            className="wde-dialog-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wde-dialog-confirm"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
