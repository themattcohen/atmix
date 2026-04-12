/**
 * editor/AddTreatmentDialog.tsx -- Modal dialog for creating a new treatment draft.
 *
 * Collects treatment ID, display name, and category. Validates inputs inline
 * before allowing confirmation.
 */

import React, { useState, useCallback } from 'react';
import type { TreatmentCategory } from '../../../types/treatment';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddTreatmentDialogProps {
  existingIds: Set<string>;
  onConfirm: (id: string, name: string, category: TreatmentCategory) => void;
  onCancel: () => void;
}

// ── Category options ──────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: TreatmentCategory; label: string }[] = [
  { value: 'iv',         label: 'IV' },
  { value: 'nad',        label: 'NAD' },
  { value: 'weightLoss', label: 'Weight Loss' },
  { value: 'injection',  label: 'Injection' },
  { value: 'lab',        label: 'Lab' },
];

// ── ID validation ─────────────────────────────────────────────────────────────

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function validateId(id: string, existingIds: Set<string>): string | null {
  if (!id) return 'ID is required';
  if (!ID_PATTERN.test(id)) return 'Use lowercase letters, numbers, and hyphens only';
  if (existingIds.has(id)) return 'A treatment with this ID already exists';
  return null;
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddTreatmentDialog({
  existingIds,
  onConfirm,
  onCancel,
}: AddTreatmentDialogProps): React.ReactElement {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TreatmentCategory>('iv');

  // Show errors only after user has touched the field.
  const [idTouched, setIdTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const idError = validateId(id, existingIds);
  const nameError = validateName(name);
  const isValid = idError === null && nameError === null;

  const handleIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setId(e.target.value);
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value as TreatmentCategory);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    onConfirm(id.trim(), name.trim(), category);
  }, [isValid, id, name, category, onConfirm]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && isValid) handleConfirm();
  }, [isValid, handleConfirm, onCancel]);

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
          New Treatment
        </div>

        {/* Treatment ID */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-id">
            Treatment ID
          </label>
          <input
            id="wde-add-id"
            className="wde-dialog-input"
            type="text"
            value={id}
            onChange={handleIdChange}
            onBlur={() => setIdTouched(true)}
            placeholder="e.g. energy-boost"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {idTouched && idError && (
            <div className="wde-dialog-error">{idError}</div>
          )}
        </div>

        {/* Treatment Name */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-name">
            Treatment Name
          </label>
          <input
            id="wde-add-name"
            className="wde-dialog-input"
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Energy Boost IV"
            autoComplete="off"
          />
          {nameTouched && nameError && (
            <div className="wde-dialog-error">{nameError}</div>
          )}
        </div>

        {/* Category */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-category">
            Category
          </label>
          <select
            id="wde-add-category"
            className="wde-dialog-select"
            value={category}
            onChange={handleCategoryChange}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
