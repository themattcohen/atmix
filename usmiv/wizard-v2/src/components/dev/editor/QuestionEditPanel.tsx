/**
 * editor/QuestionEditPanel.tsx -- Right column when a question is selected.
 *
 * Mirrors the structure of BundleEditPanel but for EditableQuestion.
 * Sections: Question Info, Options (with routing toggle), Code Output.
 */

import React, { useState, useCallback, useRef } from 'react';
import type { EditableQuestion, EditableOption } from './types';
import type { EditableTreatment } from './types';
import type { EditableBundle } from './types';
import { generateQuestionTs, generateQuestionsFileTs } from './codeGen';
import type { SaveStatus } from './EditorTab';

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuestionEditPanelProps {
  question: EditableQuestion;
  isDirty: boolean;
  allQuestions: Record<string, EditableQuestion>;
  allTreatments: Record<string, EditableTreatment>;
  allBundles: Record<string, EditableBundle>;
  onUpdate: (q: EditableQuestion) => void;
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

// ── OptionRow ─────────────────────────────────────────────────────────────────

interface OptionRowProps {
  opt: EditableOption;
  index: number;
  total: number;
  isMulti: boolean;
  allQuestions: Record<string, EditableQuestion>;
  allTreatments: Record<string, EditableTreatment>;
  allBundles: Record<string, EditableBundle>;
  currentQuestionId: string;
  onChange: (index: number, updated: EditableOption) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
}

function OptionRow({
  opt,
  index,
  total,
  isMulti,
  allQuestions,
  allTreatments,
  allBundles,
  currentQuestionId,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: OptionRowProps): React.ReactElement {
  // Routing toggle: if opt.recommend is set, mode = 'recommend'; else mode = 'next'
  const routingMode: 'next' | 'recommend' = opt.recommend ? 'recommend' : 'next';

  const handleRoutingModeChange = useCallback(
    (mode: 'next' | 'recommend') => {
      if (mode === 'next') {
        onChange(index, { ...opt, recommend: '', next: opt.next || '' });
      } else {
        onChange(index, { ...opt, next: '', recommend: opt.recommend || '' });
      }
    },
    [opt, index, onChange],
  );

  const questionOptions = Object.values(allQuestions)
    .filter((q) => q.id !== currentQuestionId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const treatmentOptions = Object.values(allTreatments).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const bundleOptions = Object.values(allBundles).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="wde-option-row">
      <div className="wde-option-fields">
        {/* label */}
        <input
          className="wde-input wde-field-input"
          type="text"
          placeholder="Label"
          value={opt.label}
          onChange={(e) => onChange(index, { ...opt, label: e.target.value })}
        />
        {/* sublabel */}
        <input
          className="wde-input wde-field-input"
          type="text"
          placeholder="Sublabel (optional)"
          value={opt.sublabel}
          onChange={(e) => onChange(index, { ...opt, sublabel: e.target.value })}
        />
        {/* icon */}
        <input
          className="wde-input wde-field-input"
          type="text"
          placeholder="Icon (e.g. bolt, heart, zap)"
          value={opt.icon}
          onChange={(e) => onChange(index, { ...opt, icon: e.target.value })}
        />
        {/* Routing -- single questions only */}
        {!isMulti && (
          <div className="wde-option-routing">
            <div className="wde-routing-toggle">
              <button
                type="button"
                className={`wde-routing-pill${routingMode === 'next' ? ' wde-routing-pill--active' : ''}`}
                onClick={() => handleRoutingModeChange('next')}
              >
                Goes to question
              </button>
              <button
                type="button"
                className={`wde-routing-pill${routingMode === 'recommend' ? ' wde-routing-pill--active' : ''}`}
                onClick={() => handleRoutingModeChange('recommend')}
              >
                Recommends treatment
              </button>
            </div>
            {routingMode === 'next' ? (
              <select
                className="wde-bundle-select wde-routing-select"
                value={opt.next}
                onChange={(e) => onChange(index, { ...opt, next: e.target.value, recommend: '' })}
              >
                <option value="">-- select question --</option>
                {questionOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.id} — {q.title}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="wde-bundle-select wde-routing-select"
                value={opt.recommend}
                onChange={(e) => onChange(index, { ...opt, recommend: e.target.value, next: '' })}
              >
                <option value="">-- select treatment/bundle --</option>
                <optgroup label="Treatments">
                  {treatmentOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Bundles">
                  {bundleOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>
        )}
      </div>
      {/* Up / Down / Delete */}
      <div className="wde-option-actions">
        <button
          type="button"
          className="wde-ingredient-btn"
          disabled={index === 0}
          onClick={() => onMoveUp(index)}
          title="Move up"
        >
          &#8593;
        </button>
        <button
          type="button"
          className="wde-ingredient-btn"
          disabled={index === total - 1}
          onClick={() => onMoveDown(index)}
          title="Move down"
        >
          &#8595;
        </button>
        <button
          type="button"
          className="wde-ingredient-btn wde-ingredient-btn--remove"
          onClick={() => onDelete(index)}
          title="Delete option"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ── QuestionEditPanel ─────────────────────────────────────────────────────────

export function QuestionEditPanel({
  question,
  isDirty,
  allQuestions,
  allTreatments,
  allBundles,
  onUpdate,
  onReset,
  onSave,
  saveStatus,
  onPublish,
  canPublish,
  publishStatus,
}: QuestionEditPanelProps): React.ReactElement {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);

  const singleKey = `question-${question.id}`;
  const fileKey = `questions-file`;

  const isSaving = saveStatus?.state === 'saving';

  // ── Option mutation helpers ───────────────────────────────────────────────

  const handleOptionChange = useCallback(
    (index: number, updated: EditableOption) => {
      const opts = [...question.options];
      opts[index] = updated;
      onUpdate({ ...question, options: opts });
    },
    [question, onUpdate],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const opts = [...question.options];
      [opts[index - 1], opts[index]] = [opts[index], opts[index - 1]];
      onUpdate({ ...question, options: opts });
    },
    [question, onUpdate],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === question.options.length - 1) return;
      const opts = [...question.options];
      [opts[index], opts[index + 1]] = [opts[index + 1], opts[index]];
      onUpdate({ ...question, options: opts });
    },
    [question, onUpdate],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const opts = question.options.filter((_, i) => i !== index);
      onUpdate({ ...question, options: opts });
    },
    [question, onUpdate],
  );

  const handleAddOption = useCallback(() => {
    const newOpt: EditableOption = {
      label: '',
      sublabel: '',
      icon: '',
      next: '',
      recommend: '',
    };
    onUpdate({ ...question, options: [...question.options, newOpt] });
  }, [question, onUpdate]);

  // The "Copy full questions.ts" button needs a sorted list matching QUESTIONS_ARRAY order.
  // We preserve the insertion order from allQuestions which matches the original array.
  const allQuestionsArray = Object.values(allQuestions);

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
        <span className="wde-form-id">{question.id}</span>
        <span className="wde-form-title">{question.title}</span>
        <button
          className={`wde-save-btn${!isDirty || isSaving ? ' wde-save-btn--disabled' : ''}`}
          type="button"
          disabled={!isDirty || isSaving}
          onClick={onSave}
          title={isDirty ? 'Write questions.ts to disk' : 'No changes to save'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          className={`wde-copy-btn wde-copy-btn--sm${copiedKey === singleKey ? ' wde-copy-btn--ok' : ''}`}
          type="button"
          onClick={() => handleCopy(singleKey, generateQuestionTs(question))}
          title="Copy TypeScript for this question"
        >
          {copiedKey === singleKey ? 'Copied!' : 'Copy TS'}
        </button>
        <button
          className={`wde-copy-btn wde-copy-btn--sm${copiedKey === fileKey ? ' wde-copy-btn--ok' : ''}`}
          type="button"
          onClick={() => handleCopy(fileKey, generateQuestionsFileTs(allQuestionsArray))}
          title="Copy full questions.ts file"
        >
          {copiedKey === fileKey ? 'Copied!' : 'Copy questions.ts'}
        </button>
        {canPublish && onPublish && (
          <button
            type="button"
            className="wde-publish-btn"
            onClick={onPublish}
            disabled={publishStatus?.state === 'saving'}
          >
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
        {/* Question Info */}
        <div className="wde-section">
          <div className="wde-section-head">Question Info</div>

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
              {question.id}
            </span>
          </FieldRow>

          <FieldRow label="type">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 9px',
                borderRadius: '9999px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.03em',
                background: question.type === 'multi' ? 'rgba(124,58,237,0.1)' : 'rgba(59,130,246,0.1)',
                color: question.type === 'multi' ? '#7c3aed' : '#1d4ed8',
                border: `1px solid ${question.type === 'multi' ? 'rgba(124,58,237,0.3)' : 'rgba(59,130,246,0.3)'}`,
              }}
            >
              {question.type}
            </span>
          </FieldRow>

          <FieldRow label="title">
            <input
              className="wde-input wde-field-input"
              type="text"
              value={question.title}
              onChange={(e) => onUpdate({ ...question, title: e.target.value })}
            />
          </FieldRow>

          <FieldRow label="subtitle">
            <input
              className="wde-input wde-field-input"
              type="text"
              value={question.subtitle}
              onChange={(e) => onUpdate({ ...question, subtitle: e.target.value })}
            />
          </FieldRow>
        </div>

        {/* Options */}
        <div className="wde-section">
          <div className="wde-section-head">Options ({question.options.length})</div>

          {question.options.map((opt, i) => (
            <OptionRow
              key={i}
              opt={opt}
              index={i}
              total={question.options.length}
              isMulti={question.type === 'multi'}
              allQuestions={allQuestions}
              allTreatments={allTreatments}
              allBundles={allBundles}
              currentQuestionId={question.id}
              onChange={handleOptionChange}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDelete={handleDelete}
            />
          ))}

          <button
            type="button"
            className="wde-option-add"
            onClick={handleAddOption}
          >
            + Add option
          </button>
        </div>

        {/* Code Output */}
        <div className="wde-section">
          <div className="wde-section-head">Code Output</div>
          <div className="wde-code-actions" style={{ marginBottom: 8 }}>
            <button
              className={`wde-copy-btn${copiedKey === singleKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => handleCopy(singleKey, generateQuestionTs(question))}
            >
              {copiedKey === singleKey ? 'Copied!' : 'Copy question code'}
            </button>
            <button
              className={`wde-copy-btn${copiedKey === fileKey ? ' wde-copy-btn--ok' : ''}`}
              type="button"
              onClick={() => handleCopy(fileKey, generateQuestionsFileTs(allQuestionsArray))}
            >
              {copiedKey === fileKey ? 'Copied!' : 'Copy full questions.ts file'}
            </button>
          </div>
          <pre className="wde-code-pre">{generateQuestionTs(question)}</pre>
        </div>
      </div>
    </div>
  );
}
