import { describe, it, expect } from 'vitest';
import { wizardReducer, INITIAL_STATE } from '../../src/hooks/useWizard';
import type { WizardState } from '../../src/types/state';
import type { SessionItem } from '../../src/types/session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInjection(id: string, name: string): SessionItem {
  return { treatmentId: id as SessionItem['treatmentId'], name, price: 35, isInjection: true };
}

function makePrimary(id: string, name: string, price: number = 220): SessionItem {
  return { treatmentId: id as SessionItem['treatmentId'], name, price, isInjection: false };
}

describe('wizardReducer initial state', () => {
  it('initial state has correct shape', () => {
    expect(INITIAL_STATE.isOpen).toBe(false);
    expect(INITIAL_STATE.currentView).toBe('question');
    expect(INITIAL_STATE.currentQuestionId).toBe('start');
    expect(INITIAL_STATE.history).toHaveLength(0);
    expect(INITIAL_STATE.stepNumber).toBe(0);
    expect(INITIAL_STATE.selectedOption).toBeNull();
    expect(INITIAL_STATE.selectedMulti).toHaveLength(0);
    expect(INITIAL_STATE.multiResults).toHaveLength(0);
    expect(INITIAL_STATE.sessionPlan).toHaveLength(0);
    expect(INITIAL_STATE.currentResult).toBeNull();
    expect(INITIAL_STATE.bundleAddonAdded).toBe(false);
    expect(INITIAL_STATE.error).toBeNull();
  });
});

describe('OPEN action', () => {
  it('opens wizard and sets source', () => {
    const state = wizardReducer(INITIAL_STATE, { type: 'OPEN', source: 'button' });
    expect(state.isOpen).toBe(true);
    expect(state.source).toBe('button');
    expect(state.currentView).toBe('question');
    expect(state.currentQuestionId).toBe('start');
  });

  it('opens with exit_intent source', () => {
    const state = wizardReducer(INITIAL_STATE, { type: 'OPEN', source: 'exit_intent' });
    expect(state.source).toBe('exit_intent');
  });
});

describe('SELECT_SINGLE with next', () => {
  it('navigates to next question, pushes current to history, increments stepNumber', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'acute',
    });

    expect(state.currentQuestionId).toBe('acute');
    expect(state.history).toContain('start');
    expect(state.history).toHaveLength(1);
    expect(state.stepNumber).toBe(1);
    expect(state.selectedOption).toBeNull(); // cleared on navigation
  });

  it('chained navigation builds history stack correctly', () => {
    let state: WizardState = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'acute',
    });
    state = wizardReducer(state, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'energy',
    });

    expect(state.currentQuestionId).toBe('energy');
    expect(state.history).toEqual(['start', 'acute']);
    expect(state.stepNumber).toBe(2);
  });
});

describe('SELECT_SINGLE with recommend', () => {
  it('sets currentView to "result" and currentResult to the recommendId', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      recommendId: 'hangover',
    });

    expect(state.currentView).toBe('result');
    expect(state.currentResult).toBe('hangover');
    expect(state.bundleAddonAdded).toBe(false);
    expect(state.stepNumber).toBe(1);
  });

  it('nad250 is automatically upgraded to nadPlusLabs bundle', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      recommendId: 'nad250',
    });

    expect(state.currentView).toBe('result');
    expect(state.currentResult).toBe('nadPlusLabs'); // auto-bundle applied
  });

  it('other recommends are NOT auto-bundled', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      recommendId: 'nad100',
    });
    expect(state.currentResult).toBe('nad100');
  });
});

describe('GO_BACK', () => {
  it('GO_BACK from question pops history and returns to previous question', () => {
    // Navigate start → acute
    const atAcute = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'acute',
    });
    expect(atAcute.currentQuestionId).toBe('acute');

    const backAtStart = wizardReducer(atAcute, { type: 'GO_BACK' });
    expect(backAtStart.currentQuestionId).toBe('start');
    expect(backAtStart.history).toHaveLength(0);
    expect(backAtStart.stepNumber).toBe(0);
  });

  it('GO_BACK from result returns to the last question in history', () => {
    // Navigate start → acute, then select hangover
    // SELECT_SINGLE with nextQuestionId pushes currentQuestionId to history.
    // SELECT_SINGLE with recommendId does NOT push to history (terminal action).
    // So at result view: history=['start'], currentQuestionId='acute'.
    // GO_BACK pops 'start' from history and returns to 'start'.
    let state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'acute',
    });
    // history=['start'], currentQuestionId='acute'
    state = wizardReducer(state, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      recommendId: 'hangover',
    });
    // history=['start'], currentView='result'
    expect(state.currentView).toBe('result');
    expect(state.history).toEqual(['start']);

    const back = wizardReducer(state, { type: 'GO_BACK' });
    expect(back.currentView).toBe('question');
    // Pops 'start' from history (only entry), currentQuestionId becomes 'start'
    expect(back.currentQuestionId).toBe('start');
    expect(back.currentResult).toBeNull();
  });

  it('GO_BACK with empty history is a no-op', () => {
    const state = wizardReducer(INITIAL_STATE, { type: 'GO_BACK' });
    expect(state.currentQuestionId).toBe('start');
    expect(state.history).toHaveLength(0);
  });

  it('GO_BACK from multi-results returns to symptoms question', () => {
    const atMultiResults: WizardState = {
      ...INITIAL_STATE,
      currentView: 'multi-results',
      multiResults: [],
      stepNumber: 2,
    };
    const back = wizardReducer(atMultiResults, { type: 'GO_BACK' });
    expect(back.currentView).toBe('question');
    expect(back.currentQuestionId).toBe('symptoms');
    expect(back.multiResults).toHaveLength(0);
    expect(back.sessionPlan).toHaveLength(0);
  });

  it('GO_BACK from booking-time returns to booking-date and clears selectedDate', () => {
    const atBookingTime: WizardState = {
      ...INITIAL_STATE,
      currentView: 'booking-time',
      booking: {
        ...INITIAL_STATE.booking,
        selectedDate: '2026-04-15',
      },
      stepNumber: 3,
    };
    const back = wizardReducer(atBookingTime, { type: 'GO_BACK' });
    expect(back.currentView).toBe('booking-date');
    expect(back.booking.selectedDate).toBeNull();
  });

  it('GO_BACK from booking-date returns to result (when no multi results)', () => {
    const atBookingDate: WizardState = {
      ...INITIAL_STATE,
      currentView: 'booking-date',
      multiResults: [],
      stepNumber: 3,
    };
    const back = wizardReducer(atBookingDate, { type: 'GO_BACK' });
    expect(back.currentView).toBe('result');
  });
});

describe('TOGGLE_MULTI', () => {
  it('adds an option index to selectedMulti', () => {
    const state = wizardReducer(INITIAL_STATE, { type: 'TOGGLE_MULTI', optionIndex: 2 });
    expect(state.selectedMulti).toContain(2);
  });

  it('removes an option index if already selected (toggle off)', () => {
    let state = wizardReducer(INITIAL_STATE, { type: 'TOGGLE_MULTI', optionIndex: 2 });
    state = wizardReducer(state, { type: 'TOGGLE_MULTI', optionIndex: 2 });
    expect(state.selectedMulti).not.toContain(2);
  });

  it('multiple toggles accumulate independently', () => {
    let state = wizardReducer(INITIAL_STATE, { type: 'TOGGLE_MULTI', optionIndex: 0 });
    state = wizardReducer(state, { type: 'TOGGLE_MULTI', optionIndex: 3 });
    state = wizardReducer(state, { type: 'TOGGLE_MULTI', optionIndex: 7 });
    expect(state.selectedMulti).toContain(0);
    expect(state.selectedMulti).toContain(3);
    expect(state.selectedMulti).toContain(7);
    expect(state.selectedMulti).toHaveLength(3);
  });
});

describe('SUBMIT_MULTI', () => {
  it('sets multiResults and changes view to multi-results', () => {
    const fakeResults = [
      {
        treatmentId: 'nad250' as const,
        score: 8,
        category: 'nad' as const,
        matchingSymptoms: ['Tired all the time'],
        addressedByTexts: ['test'],
      },
    ];
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SUBMIT_MULTI',
      results: fakeResults,
    });

    expect(state.currentView).toBe('multi-results');
    expect(state.multiResults).toHaveLength(1);
    expect(state.multiResults[0].treatmentId).toBe('nad250');
    expect(state.stepNumber).toBe(1);
  });
});

describe('ADD_TO_SESSION / REMOVE_FROM_SESSION', () => {
  it('ADD_TO_SESSION adds item to sessionPlan', () => {
    const item = makePrimary('myers', "Myers' Cocktail");
    const state = wizardReducer(INITIAL_STATE, { type: 'ADD_TO_SESSION', item });
    expect(state.sessionPlan).toHaveLength(1);
    expect(state.sessionPlan[0].treatmentId).toBe('myers');
  });

  it('REMOVE_FROM_SESSION removes item by treatmentId', () => {
    const item = makePrimary('myers', "Myers' Cocktail");
    let state = wizardReducer(INITIAL_STATE, { type: 'ADD_TO_SESSION', item });
    state = wizardReducer(state, { type: 'REMOVE_FROM_SESSION', treatmentId: 'myers' });
    expect(state.sessionPlan).toHaveLength(0);
  });
});

describe('TOGGLE_BUNDLE_ADDON', () => {
  it('toggles bundleAddonAdded from false to true', () => {
    const state = wizardReducer(INITIAL_STATE, { type: 'TOGGLE_BUNDLE_ADDON' });
    expect(state.bundleAddonAdded).toBe(true);
  });

  it('toggles bundleAddonAdded back to false on second call', () => {
    let state = wizardReducer(INITIAL_STATE, { type: 'TOGGLE_BUNDLE_ADDON' });
    state = wizardReducer(state, { type: 'TOGGLE_BUNDLE_ADDON' });
    expect(state.bundleAddonAdded).toBe(false);
  });
});

describe('RESET', () => {
  it('RESET returns to initial state regardless of current state', () => {
    // Build up some state
    let state = wizardReducer(INITIAL_STATE, { type: 'OPEN', source: 'button' });
    state = wizardReducer(state, {
      type: 'SELECT_SINGLE',
      optionIndex: 0,
      nextQuestionId: 'acute',
    });
    state = wizardReducer(state, { type: 'TOGGLE_MULTI', optionIndex: 2 });

    const reset = wizardReducer(state, { type: 'RESET' });

    // Should match initial state
    expect(reset.currentView).toBe('question');
    expect(reset.currentQuestionId).toBe('start');
    expect(reset.history).toHaveLength(0);
    expect(reset.stepNumber).toBe(0);
    expect(reset.selectedMulti).toHaveLength(0);
    expect(reset.sessionPlan).toHaveLength(0);
    expect(reset.currentResult).toBeNull();
    expect(reset.error).toBeNull();
  });
});

describe('SHOW_RESULT', () => {
  it('sets currentView to result and currentResult', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SHOW_RESULT',
      recommendId: 'beautyBundle',
    });
    expect(state.currentView).toBe('result');
    expect(state.currentResult).toBe('beautyBundle');
    expect(state.bundleAddonAdded).toBe(false);
  });
});

describe('SET_ERROR / CLEAR_ERROR', () => {
  it('SET_ERROR sets error message and view to question', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SET_ERROR',
      message: 'Something went wrong',
    });
    expect(state.error).toBe('Something went wrong');
    expect(state.currentView).toBe('question');
  });

  it('CLEAR_ERROR clears the error', () => {
    let state = wizardReducer(INITIAL_STATE, {
      type: 'SET_ERROR',
      message: 'Error',
    });
    state = wizardReducer(state, { type: 'CLEAR_ERROR' });
    expect(state.error).toBeNull();
  });
});

describe('START_BOOKING', () => {
  it('sets booking fields and changes view to booking-date', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'START_BOOKING',
      treatmentId: 'myers',
      acuityTypeId: 43274230,
      acuityDropdownValue: 'General Wellness',
    });
    expect(state.currentView).toBe('booking-date');
    expect(state.booking.treatmentId).toBe('myers');
    expect(state.booking.acuityTypeId).toBe(43274230);
    expect(state.booking.acuityDropdownValue).toBe('General Wellness');
    expect(state.stepNumber).toBe(1);
  });
});

describe('SELECT_DATE / SELECT_TIME', () => {
  it('SELECT_DATE changes view to booking-time and sets selectedDate', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_DATE',
      date: '2026-05-01',
    });
    expect(state.currentView).toBe('booking-time');
    expect(state.booking.selectedDate).toBe('2026-05-01');
  });

  it('SELECT_TIME sets selectedTime', () => {
    const state = wizardReducer(INITIAL_STATE, {
      type: 'SELECT_TIME',
      time: '2026-05-01T10:00:00-06:00',
    });
    expect(state.booking.selectedTime).toBe('2026-05-01T10:00:00-06:00');
  });
});
