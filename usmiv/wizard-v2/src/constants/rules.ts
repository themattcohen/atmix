// Business rules extracted from wizard.js hardcoded logic.
// These are intentionally compile-time constants, not runtime config.
// CLINICAL NOTE: MAX_INJECTIONS and MAX_PRIMARY are medical constraints
// related to concurrent treatment safety, not UI preferences. Do not
// make these user-editable without clinical review.

export const RULES = {
  // NAD+ 250mg always displays as the nadPlusLabs bundle (NAD+ + Vitamin Level Panel).
  // This ensures the lab add-on upsell always appears with NAD+ 250. Source: wizard.js:707-709.
  NAD_250_AUTO_BUNDLE: 'nadPlusLabs' as const,

  // Maximum injections allowed in a single session.
  // Tied to the "Buy 3 injections, get 4th free" promotion.
  MAX_INJECTIONS: 3,

  // Maximum non-injection primaries (IV, NAD+, lab, program) per session.
  MAX_PRIMARY: 1,

  // Scoring bucket: these categories compete together for the top-3 IV/NAD slots.
  IV_NAD_CATEGORIES: ['iv', 'nad'] as const,

  // Scoring bucket: weight loss programs always shown, not limited.
  WEIGHT_LOSS_CATEGORIES: ['weightLoss'] as const,

  // Scoring bucket: labs and injections grouped together (shown after IV/NAD results).
  LAB_INJECTION_CATEGORIES: ['lab', 'injection'] as const,

  // Maximum IV/NAD results shown on the multi-result screen.
  MAX_IV_NAD_RESULTS: 3,

  // Progress bar denominator. Approximate -- tree depth varies 2-6 steps.
  EXPECTED_MAX_STEPS: 6,

  // "Buy 3 injections, get 4th free" promo text (shown in addon suggestions section).
  INJECTION_PROMO_TEXT: 'Buy 3 injections, get 4th free',

  // Ingredient section label for lab panels vs. all other treatments.
  LABEL_LABS: "What's tested",
  LABEL_TREATMENT: "What's inside",

  // Acuity inline booking: max months forward user can navigate.
  MAX_BOOKING_MONTHS_FORWARD: 3,
} as const;
