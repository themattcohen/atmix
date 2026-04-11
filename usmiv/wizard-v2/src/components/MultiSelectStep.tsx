import React, { useEffect, useState } from 'react';
import type { MultiQuestion, QuestionId } from '../types/question';
import { OptionCard } from './OptionCard';
import { ProgressBar } from './ProgressBar';

interface MultiSelectStepProps {
  question: MultiQuestion;
  selectedIndices: readonly number[];
  history: readonly QuestionId[];
  stepNumber: number;
  onToggle: (index: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function MultiSelectStep({
  question,
  selectedIndices,
  history,
  stepNumber,
  onToggle,
  onContinue,
  onBack,
}: MultiSelectStepProps): React.ReactElement {
  const titleId = `tw-question-title-${question.id}`;
  const hasSelections = selectedIndices.length > 0;
  const canGoBack = history.length > 0;
  const [animClass, setAnimClass] = useState<'tw-step-entering' | ''>('tw-step-entering');

  // Clear entering class after animation completes
  useEffect(() => {
    setAnimClass('tw-step-entering');
    const timer = setTimeout(() => setAnimClass(''), 300);
    return () => clearTimeout(timer);
  }, [question.id]);

  const handleContinueClick = () => {
    if (!hasSelections) return;
    onContinue();
  };

  const handleContinueKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !hasSelections) {
      e.preventDefault();
    }
  };

  return (
    <div className={`tw-question ${animClass}`}>
      <ProgressBar stepNumber={stepNumber} isResult={false} />

      <div className="tw-question-header">
        <h2 id={titleId} className="tw-title">{question.title}</h2>
        {question.subtitle && (
          <p className="tw-subtitle">{question.subtitle}</p>
        )}
      </div>

      <ul
        className="tw-options tw-options--multi"
        role="group"
        aria-labelledby={titleId}
      >
        {question.options.map((option, index) => {
          const isSelected = selectedIndices.includes(index);
          return (
            <li key={index}>
              <OptionCard
                label={option.label}
                sublabel={option.sublabel}
                icon={option.icon}
                selected={isSelected}
                variant="multi"
                onClick={() => onToggle(index)}
              />
            </li>
          );
        })}
      </ul>

      <nav className="tw-nav" aria-label="Wizard navigation">
        {canGoBack ? (
          <button
            type="button"
            className="tw-btn-back"
            onClick={onBack}
            aria-label="Go back to previous question"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="10,3 5,8 10,13" />
            </svg>
            Back
          </button>
        ) : (
          <span className="tw-nav-spacer" aria-hidden="true" />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          {hasSelections && (
            <span style={{ fontSize: 'var(--tw-font-size-sm)', color: 'var(--tw-color-muted)' }}>
              {selectedIndices.length} selected
            </span>
          )}
          <button
            type="button"
            className="tw-btn-continue"
            onClick={handleContinueClick}
            onKeyDown={handleContinueKeyDown}
            aria-disabled={!hasSelections}
            disabled={!hasSelections}
          >
            Find My Treatment
          </button>
        </div>
      </nav>
    </div>
  );
}
