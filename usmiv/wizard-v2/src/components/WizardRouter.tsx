import React, { useEffect, useRef, useState } from 'react';
import type { WizardState, WizardAction } from '../types/state';
import type { SingleOption } from '../types/question';
import { QUESTIONS, TREATMENTS, BUNDLES, META } from '../data';
import { scoreSymptoms } from '../engine/scoring';
import { resolveRecommendation } from '../engine/resolve';
import type { ResolvedRecommendation } from '../types/bundle';
import { useAnalytics } from '../hooks/useAnalytics';
import { QuestionStep } from './QuestionStep';
import { MultiSelectStep } from './MultiSelectStep';
import { BookingDateStep } from './BookingDateStep';
import { BookingTimeStep } from './BookingTimeStep';
import { ResultScreen } from './ResultScreen';
import { MultiResultScreen } from './MultiResultScreen';

// ---------------------------------------------------------------------------
// ResultErrorFallback
// Renders an inline error message without dispatching during render.
// ---------------------------------------------------------------------------

interface ResultErrorFallbackProps {
  dispatch: React.Dispatch<WizardAction>;
  message: string;
}

function ResultErrorFallback({ dispatch, message }: ResultErrorFallbackProps): React.ReactElement {
  return (
    <div className="tw-error-screen" aria-live="assertive" role="alert">
      <h2 className="tw-error-title">Something went wrong</h2>
      <p className="tw-error-message">{message}</p>
      <div className="tw-error-actions">
        <button
          type="button"
          className="tw-btn-continue"
          onClick={() => dispatch({ type: 'RESET' })}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WizardRouter
// ---------------------------------------------------------------------------

interface WizardRouterProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function WizardRouter({ state, dispatch }: WizardRouterProps): React.ReactElement {
  const analytics = useAnalytics();
  const prevViewRef = useRef<string>(state.currentView);
  const [contentKey, setContentKey] = useState(0);

  // Fire step transition on view/question change
  useEffect(() => {
    if (prevViewRef.current !== state.currentView) {
      prevViewRef.current = state.currentView;
      setContentKey((k) => k + 1);
    }
  }, [state.currentView]);

  // Also update content key on question change (same view, different question)
  const prevQuestionRef = useRef<string>(state.currentQuestionId);
  useEffect(() => {
    if (prevQuestionRef.current !== state.currentQuestionId) {
      prevQuestionRef.current = state.currentQuestionId;
      setContentKey((k) => k + 1);
    }
  }, [state.currentQuestionId]);

  // Error screen -- shown regardless of currentView when error is set
  if (state.error) {
    return (
      <div className="tw-content-area">
        <div className="tw-error-screen" aria-live="assertive" role="alert">
          <h2 className="tw-error-title">Something went wrong</h2>
          <p className="tw-error-message">{state.error}</p>
          <div className="tw-error-actions">
            <button
              type="button"
              className="tw-btn-continue"
              onClick={() => {
                analytics.fireRestarted();
                dispatch({ type: 'RESET' });
              }}
            >
              Start Over
            </button>
            <a
              href={`tel:${META.phoneNumber}`}
              className="tw-btn-back"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Handlers for question steps
  const handleSingleSelect = (index: number, option: SingleOption) => {
    analytics.fireStepCompleted(state.currentQuestionId, state.stepNumber, option.label);
    dispatch({
      type: 'SELECT_SINGLE',
      optionIndex: index,
      nextQuestionId: option.next,
      recommendId: option.recommend,
    });
  };

  const handleMultiContinue = () => {
    const question = QUESTIONS[state.currentQuestionId];
    if (question.type !== 'multi') return;

    const selectedLabels = state.selectedMulti.map((i) => question.options[i].label);
    analytics.fireStepCompleted(state.currentQuestionId, state.stepNumber, selectedLabels.join(', '));

    const scoringResult = scoreSymptoms(selectedLabels, TREATMENTS);

    if (scoringResult.results.length === 0) {
      dispatch({ type: 'SET_ERROR', message: 'We could not find a matching treatment for your symptoms. Please try again or contact us.' });
      return;
    }

    dispatch({ type: 'SUBMIT_MULTI', results: scoringResult.results });
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  // Render the appropriate screen
  const renderContent = () => {
    const { currentView, currentQuestionId } = state;

    if (currentView === 'question') {
      const question = QUESTIONS[currentQuestionId];

      if (question.type === 'multi') {
        return (
          <MultiSelectStep
            question={question}
            selectedIndices={state.selectedMulti as number[]}
            history={state.history}
            stepNumber={state.stepNumber}
            onToggle={(index) => dispatch({ type: 'TOGGLE_MULTI', optionIndex: index })}
            onContinue={handleMultiContinue}
            onBack={handleBack}
          />
        );
      }

      // single question
      return (
        <QuestionStep
          question={question}
          selectedIndex={state.selectedOption}
          history={state.history}
          stepNumber={state.stepNumber}
          onSelect={handleSingleSelect}
          onBack={handleBack}
        />
      );
    }

    if (currentView === 'result') {
      if (!state.currentResult) {
        return <ResultErrorFallback dispatch={dispatch} message="No recommendation found. Please start over." />;
      }
      let resolved: ResolvedRecommendation;
      try {
        resolved = resolveRecommendation(state.currentResult, TREATMENTS, BUNDLES);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error resolving treatment.';
        return <ResultErrorFallback dispatch={dispatch} message={msg} />;
      }
      return (
        <ResultScreen
          recommendation={resolved}
          bundleAddonAdded={state.bundleAddonAdded}
          sessionPlan={state.sessionPlan}
          meta={META}
          dispatch={dispatch}
        />
      );
    }

    if (currentView === 'multi-results') {
      return (
        <MultiResultScreen
          results={state.multiResults}
          sessionPlan={state.sessionPlan}
          treatments={TREATMENTS}
          meta={META}
          symptomCount={state.selectedMulti.length}
          dispatch={dispatch}
        />
      );
    }

    if (currentView === 'booking-date') {
      return <BookingDateStep state={state} dispatch={dispatch} />;
    }

    if (currentView === 'booking-time') {
      return <BookingTimeStep state={state} dispatch={dispatch} />;
    }

    return null;
  };

  return (
    <div
      className="tw-content-area"
      aria-live="polite"
      aria-atomic="false"
      key={contentKey}
    >
      {renderContent()}
    </div>
  );
}
