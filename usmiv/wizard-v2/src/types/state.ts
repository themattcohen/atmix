import type { QuestionId, RecommendId } from './question';
import type { TreatmentId } from './treatment';
import type { ScoringCandidate } from './scoring';
import type { SessionItem } from './session';

export type WizardView =
  | 'question'
  | 'result'
  | 'multi-results'
  | 'booking-date'
  | 'booking-time';

export interface BookingState {
  readonly treatmentId: TreatmentId | null;
  readonly acuityTypeId: number | null;
  readonly acuityDropdownValue: string | null;
  readonly selectedDate: string | null;     // YYYY-MM-DD
  readonly selectedTime: string | null;     // ISO timestamp from Acuity
  readonly loadedMonth: string | null;      // YYYY-MM
}

export interface WizardState {
  readonly isOpen: boolean;
  readonly currentView: WizardView;
  readonly currentQuestionId: QuestionId;
  readonly history: readonly QuestionId[];  // LIFO navigation stack
  readonly stepNumber: number;
  readonly selectedOption: number | null;
  readonly selectedMulti: readonly number[];
  readonly multiResults: readonly ScoringCandidate[];
  readonly sessionPlan: readonly SessionItem[];
  readonly source: 'button' | 'exit_intent';
  readonly currentResult: RecommendId | null;  // set when view === 'result'
  readonly bundleAddonAdded: boolean;           // tracks interactive bundle add-on toggle (v1 bug fix: now affects booking)
  readonly booking: BookingState;
  readonly error: string | null;               // visible error state (replaces silent Myers' fallback)
}

// All possible state transitions
export type WizardAction =
  | { type: 'OPEN'; source: 'button' | 'exit_intent' }
  | { type: 'CLOSE' }
  | { type: 'RESET' }
  | { type: 'SELECT_SINGLE'; optionIndex: number; nextQuestionId?: QuestionId; recommendId?: RecommendId }
  | { type: 'TOGGLE_MULTI'; optionIndex: number }
  | { type: 'SUBMIT_MULTI'; results: readonly ScoringCandidate[] }
  | { type: 'GO_BACK' }
  | { type: 'SHOW_RESULT'; recommendId: RecommendId }
  | { type: 'TOGGLE_BUNDLE_ADDON' }
  | { type: 'ADD_TO_SESSION'; item: SessionItem }
  | { type: 'REMOVE_FROM_SESSION'; treatmentId: string }
  | { type: 'START_BOOKING'; treatmentId: TreatmentId; acuityTypeId: number; acuityDropdownValue: string | null }
  | { type: 'SELECT_DATE'; date: string }
  | { type: 'SELECT_TIME'; time: string }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CLEAR_ERROR' };
