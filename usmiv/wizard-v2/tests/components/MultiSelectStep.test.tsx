import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelectStep } from '../../src/components/MultiSelectStep';
import type { MultiQuestion, QuestionId } from '../../src/types/question';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testQuestion: MultiQuestion = {
  id: 'symptoms',
  type: 'multi',
  title: 'What resonates with you?',
  subtitle: 'Select all that apply.',
  options: [
    { label: 'Tired all the time' },
    { label: 'Frequent headaches' },
    { label: 'Getting sick often' },
  ],
};

const defaultProps = {
  question: testQuestion,
  selectedIndices: [] as readonly number[],
  history: [] as readonly QuestionId[],
  stepNumber: 1,
  onToggle: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MultiSelectStep', () => {
  it('renders all symptom options', () => {
    render(<MultiSelectStep {...defaultProps} />);
    expect(screen.getByText('Tired all the time')).toBeInTheDocument();
    expect(screen.getByText('Frequent headaches')).toBeInTheDocument();
    expect(screen.getByText('Getting sick often')).toBeInTheDocument();
  });

  it('calls onToggle with correct index when an option is clicked', () => {
    const onToggle = vi.fn();
    render(<MultiSelectStep {...defaultProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByText('Frequent headaches'));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('continue button is disabled when no options are selected', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[]} />);
    const continueBtn = screen.getByRole('button', { name: /find my treatment/i });
    expect(continueBtn).toBeDisabled();
  });

  it('continue button is enabled when at least one option is selected', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[0]} />);
    const continueBtn = screen.getByRole('button', { name: /find my treatment/i });
    expect(continueBtn).not.toBeDisabled();
  });

  it('calls onContinue when continue button is clicked with selections', () => {
    const onContinue = vi.fn();
    render(
      <MultiSelectStep {...defaultProps} selectedIndices={[0, 2]} onContinue={onContinue} />
    );
    fireEvent.click(screen.getByRole('button', { name: /find my treatment/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('does not call onContinue when continue button is clicked with no selections', () => {
    const onContinue = vi.fn();
    render(<MultiSelectStep {...defaultProps} selectedIndices={[]} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /find my treatment/i }));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('shows selected count when items are selected', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[0, 1, 2]} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('does not show selected count when nothing is selected', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[]} />);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('shows selected count of 1 when exactly one item is selected', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[1]} />);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('renders individual options with role="checkbox"', () => {
    render(<MultiSelectStep {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('marks selected options as aria-checked=true', () => {
    render(<MultiSelectStep {...defaultProps} selectedIndices={[0, 2]} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');
    expect(checkboxes[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('renders back button when history is non-empty', () => {
    render(
      <MultiSelectStep
        {...defaultProps}
        history={['start' as QuestionId]}
      />
    );
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('does not render back button when history is empty', () => {
    render(<MultiSelectStep {...defaultProps} history={[]} />);
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('calls onToggle via Enter keydown on a checkbox option', () => {
    const onToggle = vi.fn();
    render(<MultiSelectStep {...defaultProps} onToggle={onToggle} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.keyDown(checkboxes[2], { key: 'Enter' });

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(2);
  });
});
