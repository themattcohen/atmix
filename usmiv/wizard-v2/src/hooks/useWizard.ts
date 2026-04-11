import { useReducer } from 'react';
import type { WizardState, WizardAction } from '../types/state';
import type { SessionItem } from '../types/session';
import { addToSessionPure, removeFromSessionPure } from '../engine/session';
import { RULES } from '../constants/rules';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_STATE: WizardState = {
  isOpen: false,
  currentView: 'question',
  currentQuestionId: 'start',
  history: [],
  stepNumber: 0,
  selectedOption: null,
  selectedMulti: [],
  multiResults: [],
  sessionPlan: [],
  source: 'button',
  currentResult: null,
  bundleAddonAdded: false,
  booking: {
    treatmentId: null,
    acuityTypeId: null,
    acuityDropdownValue: null,
    selectedDate: null,
    selectedTime: null,
    loadedMonth: null,
  },
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer (pure function -- no side effects, exported for tests)
// ---------------------------------------------------------------------------

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {

    case 'OPEN':
      return {
        ...INITIAL_STATE,
        isOpen: true,
        source: action.source,
      };

    case 'CLOSE':
      return { ...INITIAL_STATE };

    case 'RESET':
      return { ...INITIAL_STATE };

    case 'SELECT_SINGLE': {
      const base = {
        ...state,
        selectedOption: action.optionIndex,
        stepNumber: state.stepNumber + 1,
      };
      if (action.nextQuestionId) {
        return {
          ...base,
          history: [...state.history, state.currentQuestionId],
          currentQuestionId: action.nextQuestionId,
          selectedOption: null,
          selectedMulti: [],
        };
      }
      if (action.recommendId) {
        // Apply nad250 → nadPlusLabs business rule.
        // RULES.NAD_250_AUTO_BUNDLE is the only place this swap is applied.
        const resolvedId =
          action.recommendId === 'nad250'
            ? RULES.NAD_250_AUTO_BUNDLE
            : action.recommendId;
        return {
          ...base,
          currentView: 'result',
          currentResult: resolvedId,
          bundleAddonAdded: false,
        };
      }
      return base;
    }

    case 'TOGGLE_MULTI': {
      const alreadySelected = state.selectedMulti.includes(action.optionIndex);
      return {
        ...state,
        selectedMulti: alreadySelected
          ? state.selectedMulti.filter((i) => i !== action.optionIndex)
          : [...state.selectedMulti, action.optionIndex],
      };
    }

    case 'SUBMIT_MULTI':
      return {
        ...state,
        multiResults: action.results,
        currentView: 'multi-results',
        stepNumber: state.stepNumber + 1,
      };

    case 'GO_BACK': {
      // booking-time → booking-date
      if (state.currentView === 'booking-time') {
        return {
          ...state,
          currentView: 'booking-date',
          booking: { ...state.booking, selectedDate: null },
          stepNumber: Math.max(0, state.stepNumber - 1),
        };
      }
      // booking-date → result or multi-results
      if (state.currentView === 'booking-date') {
        return {
          ...state,
          currentView: state.multiResults.length > 0 ? 'multi-results' : 'result',
          stepNumber: Math.max(0, state.stepNumber - 1),
        };
      }
      // multi-results → symptoms question
      if (state.currentView === 'multi-results') {
        return {
          ...state,
          currentView: 'question',
          currentQuestionId: 'symptoms',
          multiResults: [],
          sessionPlan: [],
          stepNumber: Math.max(0, state.stepNumber - 1),
        };
      }
      // result → previous question (pop history)
      if (state.currentView === 'result') {
        const prevHistory = [...state.history];
        const prevQuestion = prevHistory.pop() ?? 'start';
        return {
          ...state,
          currentView: 'question',
          currentQuestionId: prevQuestion,
          currentResult: null,
          history: prevHistory,
          selectedOption: null,
          stepNumber: Math.max(0, state.stepNumber - 1),
        };
      }
      // question → previous question (pop history); no-op if history empty
      if (state.history.length > 0) {
        const prevHistory = [...state.history];
        const prevQuestion = prevHistory.pop()!;
        return {
          ...state,
          currentQuestionId: prevQuestion,
          history: prevHistory,
          selectedOption: null,
          selectedMulti: [],
          stepNumber: Math.max(0, state.stepNumber - 1),
        };
      }
      return state;
    }

    case 'SHOW_RESULT':
      return {
        ...state,
        currentView: 'result',
        currentResult: action.recommendId,
        bundleAddonAdded: false,
      };

    case 'TOGGLE_BUNDLE_ADDON':
      return { ...state, bundleAddonAdded: !state.bundleAddonAdded };

    case 'ADD_TO_SESSION': {
      const updated = addToSessionPure(state.sessionPlan, action.item);
      return { ...state, sessionPlan: updated };
    }

    case 'REMOVE_FROM_SESSION':
      return {
        ...state,
        sessionPlan: removeFromSessionPure(state.sessionPlan, action.treatmentId),
      };

    case 'START_BOOKING':
      return {
        ...state,
        currentView: 'booking-date',
        stepNumber: state.stepNumber + 1,
        booking: {
          ...state.booking,
          treatmentId: action.treatmentId,
          acuityTypeId: action.acuityTypeId,
          acuityDropdownValue: action.acuityDropdownValue,
        },
      };

    case 'SELECT_DATE':
      return {
        ...state,
        currentView: 'booking-time',
        booking: { ...state.booking, selectedDate: action.date },
      };

    case 'SELECT_TIME':
      return {
        ...state,
        booking: { ...state.booking, selectedTime: action.time },
      };

    case 'SET_ERROR':
      return { ...state, error: action.message, currentView: 'question' };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWizard(): {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  goBack: () => void;
  toggleBundleAddon: () => void;
  addToSession: (item: SessionItem) => void;
  removeFromSession: (treatmentId: string) => void;
  reset: () => void;
} {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);

  return {
    state,
    dispatch,
    goBack: () => dispatch({ type: 'GO_BACK' }),
    toggleBundleAddon: () => dispatch({ type: 'TOGGLE_BUNDLE_ADDON' }),
    addToSession: (item: SessionItem) => dispatch({ type: 'ADD_TO_SESSION', item }),
    removeFromSession: (treatmentId: string) =>
      dispatch({ type: 'REMOVE_FROM_SESSION', treatmentId }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}
