/**
 * editor/BundleEditPanel.tsx -- Right column when a bundle is selected.
 *
 * Mirrors the structure of EditorMain but for EditableBundle. Simpler form:
 * id (read-only), name, primary treatment, add-on treatment, addOnInteractive,
 * and whyMatch. Includes Copy TS button.
 */

import React, { useState, useCallback, useRef } from 'react';
import type { EditableBundle } from './types';
import type { EditableTreatment } from './types';
import { generateBundleTs, generateBundlesFileTs } from './codeGen';
import type { SaveStatus } from './EditorTab';

// ── Props ─────────────────────────────────────────────────────────────────────

interface BundleEditPanelProps {
  bundle: EditableBundle;
  isDirty: boolean;
  allBundles: EditableBundle[];
  allTreatments: Record<string, EditableTreatment>;
  onUpdate: (field: keyof EditableBundle, value: unknown) => void;
  onReset: () => void;
  onSave: () => void;
  saveStatus?: SaveStatus;
  onPublish?: () => void;
  canPublish?: boolean;
  publishStatus?: SaveStatus;
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
  allBundles,
  allTreatments,
  onUpdate,
  onReset,
  onSave,
  saveStatus,
  onPublish,
  canPublish,
  publishStatus,
}: BundleEditPanelProps): React.ReactElement {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);

  const bundleKey = `bundle-${bundle.id}`;
  const fileKey = `bundles-file`;

  const isSaving = saveStatus?.state === 'saving';

  return (
    <div className="wde-main">
      {/* Save status banner */}
      {saveStatus?.state === 'saved' && (
        <div className="wde-save-banner wde-save-banner--ok">
          Saved to {saveStatus.path}. Vite will hot-reload the module.
        </div>
      )}
      {saveStatus?.state === 'error' && (
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
        <span className="wde-form-id">{bundle.id}</span>
        <span className="wde-form-title">{bundle.name}</span>
        <button
          className={`wde-save-btn${!isDirty || isSaving ? ' wde-save-btn--disabled' : ''}`}
          type="button"
          disabled={!isDirty || isSaving}
          onClick={onSave}
          title={isDirty ? 'Write bundles.ts to disk' : 'No changes to save'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          className={`wde-copy-btn wde-copy-btn--sm${copiedKey === bundleKey ? ' wde-copy-btn--ok' : ''}`}
          type="button"
          onClick={() => handleCopy(bundleKey, generateBundleTs(bundle))}
          title="Copy TypeScript for this bundle"
        >
          {copiedKey === bundleKey ? 'Copied!' : 'Copy TS'}
        </button>
        <button
          className={`wde-copy-btn wde-copy-btn--sm${copiedKey === fileKey ? ' wde-copy-btn--ok' : ''}`}
          type="button"
          onClick={() => handleCopy(fileKey, generateBundlesFileTs(allBundles))}
          title="Copy full bundles.ts file"
        >
          {copiedKey === fileKey ? 'Copied!' : 'Copy bundles.ts'}
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
              className="wde-input wde-field-input"
              type="text"
              value={bundle.name}
              onChange={(e) => onUpdate('name', e.target.value)}
            />
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
              className={`wde-input wde-field-input${bundle.acuityTypeId === 0 ? ' wde-input--error' : ''}`}
              type="number"
              value={bundle.acuityTypeId}
              onChange={(e) => onUpdate('acuityTypeId', Number(e.target.value))}
            />
            {bundle.acuityTypeId === 0 && (
              <span className="wde-field-error">Required for booking</span>
            )}
          </FieldRow>
        </div>

        {/* whyMatch */}
        <div className="wde-section">
          <div className="wde-section-head">Clinical Explanation</div>

          <FieldRow label="whyMatch">
            <textarea
              className="wde-input wde-field-textarea"
              rows={4}
              value={bundle.whyMatch}
              onChange={(e) => onUpdate('whyMatch', e.target.value)}
            />
            <span className="wde-field-note">{bundle.whyMatch.length} characters</span>
          </FieldRow>
        </div>

        {/* Code output */}
        <div className="wde-section">
          <div className="wde-section-head">Code Output</div>
          <div className="wde-code-actions" style={{ marginBottom: 8 }}>
            <button
              className={`wde-copy-btn${copiedKey === bundleKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => handleCopy(bundleKey, generateBundleTs(bundle))}
            >
              {copiedKey === bundleKey ? 'Copied!' : 'Copy bundle code'}
            </button>
            <button
              className={`wde-copy-btn${copiedKey === fileKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => handleCopy(fileKey, generateBundlesFileTs(allBundles))}
            >
              {copiedKey === fileKey ? 'Copied!' : 'Copy full bundles.ts file'}
            </button>
          </div>
          <pre className="wde-code-pre">{generateBundleTs(bundle)}</pre>
        </div>
      </div>
    </div>
  );
}
