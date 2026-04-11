import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionStep } from '../../src/components/QuestionStep';
import type { SingleQuestion, SingleOption, QuestionId } from '../../src/types/question';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testQuestion: SingleQuestion = {
  id: 'start' as QuestionId,
  type: 'single',
  title: 'What brings you in?',
  options: [
    { label: 'Option A', next: 'acute' as QuestionId },
    { label: 'Option B', next: 'wellness' as QuestionId },
    { label: 'Option C', recommend: 'hangover' as any },
  ],
};

const defaultProps = {
  question: testQuestion,
  selectedIndex: null,
  history: [] as readonly QuestionId[],
  stepNumber: 0,
  onSelect: vi.fn(),
  onBack: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuestionStep', () => {
  it('renders the question title', () => {
    render(<QuestionStep {...defaultProps} />);
    expect(screen.getByText('What brings you in?')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<QuestionStep {...defaultProps} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('calls onSelect with correct index and option when an option is clicked', () => {
    const onSelect = vi.fn();
    render(<QuestionStep {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Option B'));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(1, testQuestion.options[1]);
  });

  it('renders back button when history is non-empty (canGoBack=true)', () => {
    render(
      <QuestionStep
        {...defaultProps}
        history={['start' as QuestionId]}
      />
    );
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('does not render back button when history is empty (canGoBack=false)', () => {
    render(<QuestionStep {...defaultProps} history={[]} />);
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <QuestionStep
        {...defaultProps}
        history={['start' as QuestionId]}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onSelect when Enter is pressed on an option', () => {
    const onSelect = vi.fn();
    render(<QuestionStep {...defaultProps} onSelect={onSelect} />);

    const optionA = screen.getByText('Option A').closest('button')!;
    fireEvent.keyDown(optionA, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(0, testQuestion.options[0]);
  });

  it('calls onSelect when Space is pressed on an option', () => {
    const onSelect = vi.fn();
    render(<QuestionStep {...defaultProps} onSelect={onSelect} />);

    const optionC = screen.getByText('Option C').closest('button')!;
    fireEvent.keyDown(optionC, { key: ' ' });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(2, testQuestion.options[2]);
  });

  it('renders options container with role="radiogroup"', () => {
    render(<QuestionStep {...defaultProps} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('renders individual options with role="radio"', () => {
    render(<QuestionStep {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('marks the selected option as aria-checked=true', () => {
    render(<QuestionStep {...defaultProps} selectedIndex={1} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('renders subtitle when provided', () => {
    const questionWithSubtitle: SingleQuestion = {
      ...testQuestion,
      subtitle: 'A helpful subtitle',
    };
    render(<QuestionStep {...defaultProps} question={questionWithSubtitle} />);
    expect(screen.getByText('A helpful subtitle')).toBeInTheDocument();
  });
});
