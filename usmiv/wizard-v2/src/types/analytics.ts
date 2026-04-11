// All 12 GTM events (typed union for useAnalytics hook)
export type WizardEvent =
  | { event: 'wizard_opened'; source: 'button' | 'exit_intent' }
  | { event: 'wizard_abandoned'; step_id: string; step_number: number }
  | { event: 'wizard_step_completed'; step_id: string; step_number: number; answer: string }
  | { event: 'wizard_recommendation'; treatment_id: string; treatment_name: string; price: number; is_bundle: boolean }
  | { event: 'wizard_book_clicked'; treatment_id: string; treatment_name: string; booking_method?: 'inline_availability' }
  | { event: 'wizard_learn_more'; treatment_id: string; treatment_name: string }
  | { event: 'wizard_restarted' }
  | { event: 'wizard_addon_toggled'; addon_id: string; addon_name: string; added: boolean }
  | { event: 'wizard_item_added'; treatment_id: string; treatment_name: string; session_size: number }
  | { event: 'wizard_booking_started'; treatment_id: string }
  | { event: 'wizard_date_selected'; date: string }
  | { event: 'wizard_time_selected'; date: string; time: string; treatment_id: string };
