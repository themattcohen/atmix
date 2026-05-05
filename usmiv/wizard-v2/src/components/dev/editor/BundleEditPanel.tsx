/**
 * editor/BundleEditPanel.tsx -- Right column when a bundle is selected.
 *
 * Mirrors the structure of EditorMain but for EditableBundle. Simpler form:
 * id (read-only), name, primary treatment, add-on treatment, addOnInteractive,
 * and whyMatch. Includes Copy TS button.
 */

import React from 'react';
import type { EditableBundle } from './types';
import type { EditableTreatment } from './types';
import type { ValidationFailure } from '../WizardDevDashboard';

// ── Props ─────────────────────────────────────────────────────────────────────

interface BundleEditPanelProps {
  bundle: EditableBundle;
  isDirty: boolean;
  allTreatments: Record<string, EditableTreatment>;
  onUpdate: (field: keyof EditableBundle, value: unknown) => void;
  onReset: () => void;
  validationFailure?: ValidationFailure | null;
  clearValidationFailure?: () => void;
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

function FieldRow({ label, children }: FieldRowProps): React.ReactElement {
  return (
    <div className="wde-field-row">
      <span className="wde-field-label">{label}</span>
      <div className="wde-field-right">{children}</div>
    </div>
  );
}

// ── TreatmentSelect ───────────────────────────────────────────────────────────

interface TreatmentSelectProps {
  value: string | null;
  treatments: Record<string, EditableTreatment>;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (id: string | null) => void;
}

function TreatmentSelect({
  value,
  treatments,
  allowEmpty = false,
  emptyLabel = '-- none --',
  onChange,
}: TreatmentSelectProps): React.ReactElement {
  const sorted = Object.values(treatments).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <select
      className="wde-bundle-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {sorted.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} — {t.priceLabel && t.priceLabel.trim() ? t.priceLabel : `$${t.price}`}
        </option>
      ))}
    </select>
  );
}

// ── BundleEditPanel ───────────────────────────────────────────────────────────

export function BundleEditPanel({
  bundle,
  isDirty,
  allTreatments,
  onUpdate,
  onReset,
  validationFailure,
  clearValidationFailure,
}: BundleEditPanelProps): React.ReactElement {
  function isInvalid(fieldName: string): boolean {
    return validationFailure?.id === bundle.id && validationFailure?.field === fieldName;
  }

  return (
    <div className="wde-main">
      {/* Sticky header */}
      <div className="wde-form-header">
        <span className="wde-form-id">{bundle.id}</span>
        <span className="wde-form-title">{bundle.name}</span>
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
        {/* Bundle fields */}
        <div className="wde-section">
          <div className="wde-section-head">Bundle Info</div>

          <FieldRow label="id">
            <span
              style={{
                fontFamily: 'var(--wde-font-mono)',
                fontSize: 13,
                color: 'var(--wde-content-muted)',
                padding: '6px 0',
                display: 'block',
              }}
            >
              {bundle.id}
            </span>
          </FieldRow>

          <FieldRow label="name">
            <input
              className={`wde-input wde-field-input${isInvalid('name') ? ' wde-input--invalid' : ''}`}
              type="text"
              value={bundle.name}
              onChange={(e) => { clearValidationFailure?.(); onUpdate('name', e.target.value); }}
            />
            {isInvalid('name') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
          </FieldRow>

          <FieldRow label="primary">
            <TreatmentSelect
              value={bundle.primary}
              treatments={allTreatments}
              allowEmpty={false}
              onChange={(id) => onUpdate('primary', id ?? '')}
            />
          </FieldRow>

          <FieldRow label="addOn">
            <TreatmentSelect
              value={bundle.addOn}
              treatments={allTreatments}
              allowEmpty={true}
              emptyLabel="-- none --"
              onChange={(id) => onUpdate('addOn', id)}
            />
          </FieldRow>

          <FieldRow label="addOnInteractive">
            <label className="wde-bundle-checkbox-row">
              <input
                type="checkbox"
                checked={bundle.addOnInteractive}
                onChange={(e) => onUpdate('addOnInteractive', e.target.checked)}
              />
              <span>Allow patients to toggle this add-on on/off</span>
            </label>
          </FieldRow>

          <FieldRow label="acuityTypeId">
            <input
              className={`wde-input wde-field-input${bundle.acuityTypeId === 0 ? ' wde-input--error' : ''}${isInvalid('acuityTypeId') ? ' wde-input--invalid' : ''}`}
              type="number"
              value={bundle.acuityTypeId ?? ''}
              onChange={(e) => {
                clearValidationFailure?.();
                const val = e.target.value;
                if (val === '') {
                  onUpdate('acuityTypeId', undefined);
                  return;
                }
                const n = Number(val);
                if (Number.isFinite(n) && n >= 0) {
                  onUpdate('acuityTypeId', n);
                }
              }}
            />
            {bundle.acuityTypeId === 0 && (
              <span className="wde-field-error">Required for booking</span>
            )}
            {isInvalid('acuityTypeId') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
          </FieldRow>

          <FieldRow label="acuityDropdownValue">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="null (leave blank for null)"
              value={bundle.acuityDropdownValue ?? ''}
              onChange={(e) => onUpdate('acuityDropdownValue', e.target.value || null)}
            />
          </FieldRow>

          <FieldRow label="addOnLabel">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="e.g. + Vitamin B12 Push (optional)"
              value={bundle.addOnLabel ?? ''}
              onChange={(e) => onUpdate('addOnLabel', e.target.value || undefined)}
            />
          </FieldRow>
        </div>

        {/* Pricing */}
        <div className="wde-section">
          <div className="wde-section-head">Pricing</div>

          <FieldRow label="price">
            <input
              className="wde-input wde-field-input"
              type="number"
              placeholder="Bundle price in dollars (optional)"
              value={bundle.price ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                onUpdate('price', raw === '' ? undefined : Number(raw));
              }}
            />
            <span className="wde-field-note">Overrides primary treatment price on result card. Leave blank to inherit.</span>
          </FieldRow>

          <FieldRow label="priceLabel">
            <input
              className="wde-input wde-field-input"
              type="text"
              placeholder="e.g. from $199/month (optional)"
              value={bundle.priceLabel ?? ''}
              onChange={(e) => onUpdate('priceLabel', e.target.value || undefined)}
            />
            <span className="wde-field-note">Overrides price when set.</span>
          </FieldRow>
        </div>

        {/* Display */}
        <div className="wde-section">
          <div className="wde-section-head">Display</div>

          <FieldRow label="shortDesc">
            <textarea
              className={`wde-input wde-field-textarea${isInvalid('shortDesc') ? ' wde-input--invalid' : ''}`}
              rows={2}
              placeholder="Bundle subtitle shown under headline on result card (optional)"
              value={bundle.shortDesc ?? ''}
              onChange={(e) => { clearValidationFailure?.(); onUpdate('shortDesc', e.target.value || undefined); }}
            />
            {isInvalid('shortDesc') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
            <span className="wde-field-note">{(bundle.shortDesc ?? '').length}/500 characters</span>
          </FieldRow>

          <FieldRow label="pageUrl">
            <input
              className={`wde-input wde-field-input${isInvalid('pageUrl') ? ' wde-input--invalid' : ''}`}
              type="text"
              placeholder="/treatments/myers-cocktail/ (optional)"
              value={bundle.pageUrl ?? ''}
              onChange={(e) => { clearValidationFailure?.(); onUpdate('pageUrl', e.target.value || undefined); }}
            />
            {isInvalid('pageUrl') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
            <span className="wde-field-note">Overrides primary treatment Learn More URL. Must start with /.</span>
            <div className="wdd-help-text">
              Link target for the wizard's Learn More button. Editing this does not rename the WP page; only updates where the button navigates.
            </div>
          </FieldRow>
        </div>

        {/* whyMatch */}
        <div className="wde-section">
          <div className="wde-section-head">Clinical Explanation</div>

          <FieldRow label="whyMatch">
            <textarea
              className={`wde-input wde-field-textarea${isInvalid('whyMatch') ? ' wde-input--invalid' : ''}`}
              rows={4}
              value={bundle.whyMatch}
              onChange={(e) => { clearValidationFailure?.(); onUpdate('whyMatch', e.target.value); }}
            />
            {isInvalid('whyMatch') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
            <span className="wde-field-note">{bundle.whyMatch.length} characters</span>
          </FieldRow>
        </div>

      </div>
    </div>
  );
}
