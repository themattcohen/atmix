import React, { useReducer } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardRouter } from '../../src/components/WizardRouter';
import { wizardReducer, INITIAL_STATE } from '../../src/hooks/useWizard';
import type { WizardState, WizardAction } from '../../src/types/state';

// ---------------------------------------------------------------------------
// Helper: renders WizardRouter with a real useReducer so state updates work.
// ---------------------------------------------------------------------------

function WizardRouterHarness({ initialState }: { initialState?: Partial<WizardState> }) {
  const [state, dispatch] = useReducer(wizardReducer, {
    ...INITIAL_STATE,
    isOpen: true,
    ...initialState,
  });
  return <WizardRouter state={state} dispatch={dispatch} />;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WizardRouter', () => {
  it('renders the start question on initial open', () => {
    render(<WizardRouterHarness />);
    expect(screen.getByText('What brings you in today?')).toBeInTheDocument();
  });

  it('renders all start question options', () => {
    render(<WizardRouterHarness />);
    expect(screen.getByText('I need relief right now')).toBeInTheDocument();
    expect(screen.getByText('I want to improve my wellness')).toBeInTheDocument();
    expect(screen.getByText('I want to lose weight')).toBeInTheDocument();
  });

  it('navigates to the acute question when "I need relief right now" is selected', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText('I need relief right now'));

    expect(screen.getByText("What's going on?")).toBeInTheDocument();
  });

  it('navigates to wellness question when "I want to improve my wellness" is selected', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText('I want to improve my wellness'));

    expect(screen.getByText("What's your wellness goal?")).toBeInTheDocument();
  });

  it('shows result view (placeholder) when a direct recommend option is selected', () => {
    render(<WizardRouterHarness />);

    // Navigate: start -> acute
    fireEvent.click(screen.getByText('I need relief right now'));
    // Acute: "Hangover / drank too much" has recommend: 'hangover'
    fireEvent.click(screen.getByText('Hangover / drank too much'));

    // WizardRouter renders a placeholder for ResultScreen (Task 9 replacement)
    expect(screen.getByText(/YOUR RECOMMENDED TREATMENT/i)).toBeInTheDocument();
  });

  it('back button from acute question returns to start question', () => {
    render(<WizardRouterHarness />);

    // Navigate to acute
    fireEvent.click(screen.getByText('I need relief right now'));
    expect(screen.getByText("What's going on?")).toBeInTheDocument();

    // Click back
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));

    // Should be back at start
    expect(screen.getByText('What brings you in today?')).toBeInTheDocument();
  });

  it('renders error screen with "Start Over" button when state has an error', () => {
    render(
      <WizardRouterHarness
        initialState={{ error: 'Something went wrong in the test.' }}
      />
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong in the test.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument();
  });

  it('error screen "Start Over" button resets to start question', () => {
    render(
      <WizardRouterHarness
        initialState={{ error: 'Test error' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start over/i }));

    // After reset, error is cleared and start question shows
    expect(screen.getByText('What brings you in today?')).toBeInTheDocument();
  });

  it('error screen includes "Contact Us" link', () => {
    render(
      <WizardRouterHarness
        initialState={{ error: 'Cannot find treatment.' }}
      />
    );

    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });

  it('navigates through multi-level path: start -> wellness -> energy', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText('I want to improve my wellness'));
    expect(screen.getByText("What's your wellness goal?")).toBeInTheDocument();

    fireEvent.click(screen.getByText('More energy / less brain fog'));
    expect(screen.getByText('How long have you been feeling this way?')).toBeInTheDocument();
  });

  it('back button is not shown on the first question (empty history)', () => {
    render(<WizardRouterHarness />);
    // Start question has empty history -- no back button
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('multi-select symptoms question renders when navigated to', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText("I'm not sure -- help me decide"));

    // The multi-select symptoms question title
    expect(screen.getByText('What resonates with you?')).toBeInTheDocument();
    // The continue button should be disabled initially
    expect(
      screen.getByRole('button', { name: /find my treatment/i })
    ).toBeDisabled();
  });

  it('multi-select: selecting a symptom enables the continue button', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText("I'm not sure -- help me decide"));
    fireEvent.click(screen.getByText('Tired all the time'));

    expect(
      screen.getByRole('button', { name: /find my treatment/i })
    ).not.toBeDisabled();
  });

  it('multi-select: submitting symptoms navigates to multi-results view', () => {
    render(<WizardRouterHarness />);

    fireEvent.click(screen.getByText("I'm not sure -- help me decide"));
    fireEvent.click(screen.getByText('Tired all the time'));
    fireEvent.click(screen.getByRole('button', { name: /find my treatment/i }));

    expect(screen.getByText(/Your Personalized Recommendations/i)).toBeInTheDocument();
  });
});
