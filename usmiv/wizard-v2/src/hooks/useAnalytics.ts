import { useMemo } from 'react';
import type { WizardEvent } from '../types/analytics';

function pushEvent(event: WizardEvent): void {
  const win = window as Window & { dataLayer?: object[] };
  if (!win.dataLayer) {
    win.dataLayer = [];
  }
  (win.dataLayer as object[]).push(event);
}

// Returns a stable set of typed fire functions.
// Call at the top of WizardRouter or WizardModal -- pass down as needed.
export function useAnalytics() {
  return useMemo(() => ({
    fireOpened: (source: 'button' | 'exit_intent') =>
      pushEvent({ event: 'wizard_opened', source }),

    fireAbandoned: (step_id: string, step_number: number) =>
      pushEvent({ event: 'wizard_abandoned', step_id, step_number }),

    fireStepCompleted: (step_id: string, step_number: number, answer: string) =>
      pushEvent({ event: 'wizard_step_completed', step_id, step_number, answer }),

    fireRecommendation: (treatment_id: string, treatment_name: string, price: number, is_bundle: boolean) =>
      pushEvent({ event: 'wizard_recommendation', treatment_id, treatment_name, price, is_bundle }),

    fireBookClicked: (treatment_id: string, treatment_name: string, method?: 'inline_availability') =>
      pushEvent({ event: 'wizard_book_clicked', treatment_id, treatment_name, ...(method ? { booking_method: method } : {}) }),

    fireLearnMore: (treatment_id: string, treatment_name: string) =>
      pushEvent({ event: 'wizard_learn_more', treatment_id, treatment_name }),

    fireRestarted: () =>
      pushEvent({ event: 'wizard_restarted' }),

    fireAddonToggled: (addon_id: string, addon_name: string, added: boolean) =>
      pushEvent({ event: 'wizard_addon_toggled', addon_id, addon_name, added }),

    fireItemAdded: (treatment_id: string, treatment_name: string, session_size: number) =>
      pushEvent({ event: 'wizard_item_added', treatment_id, treatment_name, session_size }),

    fireBookingStarted: (treatment_id: string) =>
      pushEvent({ event: 'wizard_booking_started', treatment_id }),

    fireDateSelected: (date: string) =>
      pushEvent({ event: 'wizard_date_selected', date }),

    fireTimeSelected: (date: string, time: string, treatment_id: string) =>
      pushEvent({ event: 'wizard_time_selected', date, time, treatment_id }),
  }), []);
}
