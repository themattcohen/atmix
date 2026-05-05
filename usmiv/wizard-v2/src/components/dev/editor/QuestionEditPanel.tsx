/**
 * editor/QuestionEditPanel.tsx -- Right column when a question is selected.
 *
 * Mirrors the structure of BundleEditPanel but for EditableQuestion.
 * Sections: Question Info, Options (with routing toggle), Code Output.
 */

import React, { useCallback } from 'react';
import type { EditableQuestion, EditableOption } from './types';
import type { EditableTreatment } from './types';
import type { EditableBundle } from './types';
import type { ValidationFailure } from '../WizardDevDashboard';

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuestionEditPanelProps {
  question: EditableQuestion;
  isDirty: boolean;
  allQuestions: Record<string, EditableQuestion>;
  allTreatments: Record<string, EditableTreatment>;
  allBundles: Record<string, EditableBundle>;
  onUpdate: (q: EditableQuestion) => void;
  onReset: () => void;
  /** Jump editor selection to a different question (path traversal). */
  onSelectQuestion?: (id: string) => void;
  /** Jump editor selection to a treatment and switch to treatments mode (path traversal). */
  onSelectTreatment?: (id: string) => void;
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
  onSelectQuestion?: (id: string) => void;
  onSelectTreatment?: (id: string) => void;
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
  onSelectQuestion,
  onSelectTreatment,
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
              <div className="wde-routing-destination">
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
                {opt.next && onSelectQuestion && (
                  <button
                    type="button"
                    className="wdd-route-chip"
                    onClick={() => onSelectQuestion(opt.next!)}
                    title={`Jump to question: ${opt.next}`}
                  >
                    {opt.next}
                  </button>
                )}
              </div>
            ) : (
              <div className="wde-routing-destination">
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
                {opt.recommend && onSelectTreatment && (
                  <button
                    type="button"
                    className="wdd-route-chip wdd-route-chip--treatment"
                    onClick={() => onSelectTreatment(opt.recommend!)}
                    title={`Jump to treatment/bundle: ${opt.recommend}`}
                  >
                    {opt.recommend}
                  </button>
                )}
              </div>
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
  onSelectQuestion,
  onSelectTreatment,
  validationFailure,
  clearValidationFailure,
}: QuestionEditPanelProps): React.ReactElement {
  function isInvalid(fieldName: string): boolean {
    return validationFailure?.id === question.id && validationFailure?.field === fieldName;
  }

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

  return (
    <div className="wde-main">
      {/* Sticky header */}
      <div className="wde-form-header">
        <span className="wde-form-id">{question.id}</span>
        <span className="wde-form-title">{question.title}</span>
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
              className={`wde-input wde-field-input${isInvalid('title') ? ' wde-input--invalid' : ''}`}
              type="text"
              value={question.title}
              onChange={(e) => { clearValidationFailure?.(); onUpdate({ ...question, title: e.target.value }); }}
            />
            {isInvalid('title') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
          </FieldRow>

          <FieldRow label="subtitle">
            <input
              className={`wde-input wde-field-input${isInvalid('subtitle') ? ' wde-input--invalid' : ''}`}
              type="text"
              value={question.subtitle}
              onChange={(e) => { clearValidationFailure?.(); onUpdate({ ...question, subtitle: e.target.value }); }}
            />
            {isInvalid('subtitle') && (
              <div className="wde-field-error-text">{validationFailure!.reason}</div>
            )}
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
              onSelectQuestion={onSelectQuestion}
              onSelectTreatment={onSelectTreatment}
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

      </div>
    </div>
  );
}
