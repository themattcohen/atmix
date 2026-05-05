/**
 * editor/AddBundleDialog.tsx -- Modal dialog for creating a new bundle draft.
 *
 * Collects bundle ID, name, primary treatment, optional add-on treatment,
 * and acuityTypeId. All other fields (price, priceLabel, shortDesc, pageUrl,
 * addOnLabel, acuityDropdownValue) start blank and are filled via BundleEditPanel.
 */

import React, { useState, useCallback } from 'react';
import type { Treatment } from '../../../types/treatment';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddBundleDialogProps {
  existingIds: string[];
  treatments: Readonly<Record<string, Treatment>>;
  onConfirm: (
    id: string,
    name: string,
    primary: string,
    addOn: string | null,
    acuityTypeId: number,
  ) => void;
  onCancel: () => void;
}

// ── Validation ────────────────────────────────────────────────────────────────

// camelCase: starts with lowercase letter, may contain uppercase letters and digits
const BUNDLE_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

function validateBundleId(id: string, existingIds: string[]): string | null {
  if (!id) return 'ID is required';
  if (id.length > 50) return 'ID must be 50 characters or fewer';
  if (!BUNDLE_ID_PATTERN.test(id)) return 'Use camelCase format (e.g. myersBoost)';
  if (existingIds.includes(id)) return 'A bundle with this ID already exists';
  return null;
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  return null;
}

function validateAcuityTypeId(raw: string): string | null {
  if (!raw.trim()) return 'Acuity Type ID is required';
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return 'Must be a positive integer';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const NONE_VALUE = '__none__';

export function AddBundleDialog({
  existingIds,
  treatments,
  onConfirm,
  onCancel,
}: AddBundleDialogProps): React.ReactElement {
  const treatmentKeys = Object.keys(treatments);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState(treatmentKeys[0] ?? '');
  const [addOn, setAddOn] = useState(NONE_VALUE);
  const [acuityTypeIdRaw, setAcuityTypeIdRaw] = useState('');

  // Touch tracking
  const [idTouched, setIdTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [acuityTouched, setAcuityTouched] = useState(false);

  const idError = validateBundleId(id, existingIds);
  const nameError = validateName(name);
  const acuityError = validateAcuityTypeId(acuityTypeIdRaw);
  const primaryMissing = !primary;

  const isValid =
    idError === null &&
    nameError === null &&
    acuityError === null &&
    !primaryMissing;

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    const addOnValue = addOn === NONE_VALUE ? null : addOn;
    onConfirm(
      id.trim(),
      name.trim(),
      primary,
      addOnValue,
      Number(acuityTypeIdRaw.trim()),
    );
  }, [isValid, id, name, primary, addOn, acuityTypeIdRaw, onConfirm]);

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

  return (
    <div
      className="wde-dialog-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wde-bundle-dialog-title"
    >
      <div className="wde-dialog">
        <div className="wde-dialog-title" id="wde-bundle-dialog-title">
          New Bundle
        </div>

        {/* Bundle ID */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-bid">
            Bundle ID
          </label>
          <input
            id="wde-add-bid"
            className="wde-dialog-input"
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onBlur={() => setIdTouched(true)}
            placeholder="e.g. myersBoost"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {idTouched && idError && (
            <div className="wde-dialog-error">{idError}</div>
          )}
        </div>

        {/* Name */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-bname">
            Name
          </label>
          <input
            id="wde-add-bname"
            className="wde-dialog-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Myers + Energy Boost"
            autoComplete="off"
          />
          {nameTouched && nameError && (
            <div className="wde-dialog-error">{nameError}</div>
          )}
        </div>

        {/* Primary treatment */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-bprimary">
            Primary treatment
          </label>
          {treatmentKeys.length > 0 ? (
            <select
              id="wde-add-bprimary"
              className="wde-dialog-select"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
            >
              {treatmentKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 12, color: '#64748b' }}>No treatments available.</div>
          )}
        </div>

        {/* Add-on treatment (optional) */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-baddon">
            Add-on treatment <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <select
            id="wde-add-baddon"
            className="wde-dialog-select"
            value={addOn}
            onChange={(e) => setAddOn(e.target.value)}
          >
            <option value={NONE_VALUE}>(none)</option>
            {treatmentKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        {/* Acuity Type ID */}
        <div className="wde-dialog-field">
          <label className="wde-dialog-label" htmlFor="wde-add-bacuity">
            Acuity Type ID
          </label>
          <input
            id="wde-add-bacuity"
            className="wde-dialog-input"
            type="text"
            inputMode="numeric"
            value={acuityTypeIdRaw}
            onChange={(e) => setAcuityTypeIdRaw(e.target.value)}
            onBlur={() => setAcuityTouched(true)}
            placeholder="e.g. 43274230"
            autoComplete="off"
          />
          {acuityTouched && acuityError && (
            <div className="wde-dialog-error">{acuityError}</div>
          )}
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Price, description, page URL, and other fields are set after creation via the bundle editor.
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
