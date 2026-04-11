import React, { useEffect, useRef, useState } from 'react';
import type { SingleQuestion, SingleOption, QuestionId } from '../types/question';
import { OptionCard } from './OptionCard';
import { ProgressBar } from './ProgressBar';

interface QuestionStepProps {
  question: SingleQuestion;
  selectedIndex: number | null;
  history: readonly QuestionId[];
  stepNumber: number;
  onSelect: (index: number, option: SingleOption) => void;
  onBack: () => void;
}

export function QuestionStep({
  question,
  selectedIndex,
  history,
  stepNumber,
  onSelect,
  onBack,
}: QuestionStepProps): React.ReactElement {
  const titleId = `tw-question-title-${question.id}`;
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [animClass, setAnimClass] = useState<'tw-step-entering' | ''>('tw-step-entering');

  // Focus first option on step enter
  useEffect(() => {
    const timer = setTimeout(() => {
      firstOptionRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [question.id]);

  // Clear entering class after animation completes
  useEffect(() => {
    setAnimClass('tw-step-entering');
    const timer = setTimeout(() => setAnimClass(''), 300);
    return () => clearTimeout(timer);
  }, [question.id]);

  const canGoBack = history.length > 0;

  return (
    <div className={`tw-question ${animClass}`} ref={containerRef}>
      <ProgressBar stepNumber={stepNumber} isResult={false} />

      <div className="tw-question-header">
        <h2 id={titleId} className="tw-title">{question.title}</h2>
        {question.subtitle && (
          <p className="tw-subtitle">{question.subtitle}</p>
        )}
      </div>

      <ul
        className="tw-options"
        role="radiogroup"
        aria-labelledby={titleId}
      >
        {question.options.map((option, index) => (
          <li key={index}>
            <OptionCard
              label={option.label}
              sublabel={option.sublabel}
              icon={option.icon}
              selected={selectedIndex === index}
              variant="single"
              onClick={() => onSelect(index, option)}
            />
          </li>
        ))}
      </ul>

      {canGoBack && (
        <nav className="tw-nav" aria-label="Wizard navigation">
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
        </nav>
      )}
    </div>
  );
}
