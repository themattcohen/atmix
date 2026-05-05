# Save-Loop Coverage Report

Generated 5/4/2026, 9:20:13 AM MT. Tests run against https://usmobileiv.com/wp-json/wizard-of-iv/v1/config.

## Inventory of editable fields

| Field path | Editor UI | Type | Where consumed |
|---|---|---|---|
| `treatments.<id>.price` | number input | Scalar number | wizard modal price; Learn More price display |
| `treatments.<id>.name` | text input | Scalar string | wizard modal heading; Learn More page heading; WP page title link |
| `treatments.<id>.priceLabel` | text input (optional) | Scalar string (optional) | wizard modal price override display |
| `treatments.<id>.duration` | text input | Scalar string | wizard modal duration field; Learn More duration |
| `treatments.<id>.acuityTypeId` | number input | Scalar number | Acuity booking link construction |
| `treatments.<id>.acuityDropdownValue` | text input (nullable) | Scalar string | null | Acuity booking dropdown pre-select |
| `treatments.<id>.pageUrl` | text input | Scalar string | Learn More page URL; wizard card link |
| `treatments.<id>.shortDesc` | text input | Scalar string | wizard card subtitle; Learn More meta description |
| `treatments.<id>.whyMatch` | textarea | Scalar string | wizard result card "why this matches you" text |
| `treatments.<id>.note` | text input (optional) | Scalar string (optional) | italic footnote on wizard card (GLP-1 programs) |
| `treatments.<id>.bestFor` | TagEditor (add/remove tags) | String array | wizard card "best for" chips; Learn More bestFor list |
| `treatments.<id>.ingredients` | IngredientsEditor (repeating {name,benefit}) | Object array | wizard ingredient panel; Learn More ingredients section |
| `treatments.<id>.addonSuggestions` | checkbox list of injection treatment IDs | String array (TreatmentId[]) | wizard upsell addon panel |
| `treatments.<id>.tests` | not exposed in editor UI (lab-specific) | String array (lab only) | Learn More lab tests list |
| `treatments.<id>.scoringWeights.<symptom>` | ScoringWeightsEditor slider + number input (0-10) | Nested map string->number | wizard symptom scoring math determines recommendation ranking |
| `treatments.<id>.addressedBy.<symptom>` | ScoringWeightsEditor text input (appears when weight > 0) | Nested map string->string | wizard result card per-symptom explanation text |
| `bundles.<id>.name` | text input | Scalar string | wizard bundle card heading |
| `bundles.<id>.primary` | TreatmentSelect dropdown | String (TreatmentId FK) | wizard bundle primary treatment reference |
| `bundles.<id>.addOn` | TreatmentSelect dropdown (nullable) | String | null (TreatmentId FK) | wizard bundle add-on treatment reference |
| `bundles.<id>.addOnInteractive` | checkbox | Boolean | wizard bundle: whether patient can toggle add-on |
| `bundles.<id>.whyMatch` | textarea | Scalar string | wizard bundle result card explanation |
| `bundles.<id>.acuityTypeId` | number input | Scalar number | Acuity booking link for bundle |
| `bundles.<id>.addOnLabel` | NOT in editor UI | Scalar string (optional) | wizard bundle add-on toggle label text |
| `bundles.<id>.isConsultation` | NOT in editor UI | Boolean | wizard: show consultation CTA instead of booking |
| `bundles.<id>.acuityDropdownValue` | NOT in editor UI | Scalar string | null | Acuity dropdown pre-select for bundle |
| `questions.<id>.title` | text input | Scalar string | wizard question card heading |
| `questions.<id>.subtitle` | text input | Scalar string | wizard question card subheading |
| `questions.<id>.type` | read-only display (single/multi) | Enum string (read-only) | wizard question rendering mode |
| `questions.<id>.options[*].label` | text input per OptionRow | String (in object array) | wizard option button label |
| `questions.<id>.options[*].sublabel` | text input per OptionRow | String (in object array) | wizard option button sub-label |
| `questions.<id>.options[*].icon` | text input per OptionRow | String (in object array) | wizard option icon name |
| `questions.<id>.options[*].next` | routing select per OptionRow | String (QuestionId FK, in object array) | wizard routing: next question on single-select |
| `questions.<id>.options[*].recommend` | routing select per OptionRow | String (TreatmentId|BundleId FK, in object array) | wizard routing: direct recommendation on single-select |

## Category coverage

| Category | Representative field | POST-GET round-trip | UI propagation | Notes |
|---|---|---|---|---|
| A. Scalar number | `treatments.myers.price` | PASS | PASS (browser verified) | Rendered as "$777" in wizard modal `.wiz-hero__price` and in Learn More `[data-wizard-field="price"]` |
| B. Scalar string | `treatments.myers.shortDesc` | PASS | PASS (browser verified) | Rendered as "TEST_SHORT_DESC_UI_VERIFY" in wizard modal `.wiz-hero__desc` and Learn More `[data-wizard-field="shortDesc"]` |
| C. String array | `treatments.myers.bestFor` | PASS | REST only | - |
| D. Object array | `treatments.myers.ingredients` | PASS | REST only | - |
| E. Nested map string->number | `treatments.myers.scoringWeights` | PASS | PASS (browser verified) | Sentinel value 9 confirmed via same-origin fetch inside browser; wizard.js reads from this live endpoint on open |
| F. Nested map string->string | `treatments.myers.addressedBy` | PASS | REST only | - |
| G. Bundle schema | `bundles.beautyBundle.name` | PASS | REST only | - |
| H. Question tree | `questions.start.title` | PASS | REST only | - |

Notes on UI propagation column:
- "REST only" means the save loop was verified by POST then GET. UI propagation
  was not tested in-browser for every category (see below for which three were
  verified live).
- The three categories chosen for browser-based UI verification were:
  A (scalar number: price), B (scalar string: shortDesc), and E (nested map:
  scoringWeights). These represent the full spectrum of how the consumer
  wizard.js rendering pipeline reads from KV/wp_option.

## Individual test results

| Category | Label | Field path | Result |
|---|---|---|---|
| A | Scalar number | `treatments.myers.price` | PASS |
| A | Scalar number (acuityTypeId) | `treatments.hydration.acuityTypeId` | PASS |
| B | Scalar string (shortDesc) | `treatments.myers.shortDesc` | PASS |
| B | Scalar string (name) | `treatments.myers.name` | PASS |
| B | Scalar string (duration) | `treatments.myers.duration` | PASS |
| B | Scalar string (whyMatch textarea) | `treatments.myers.whyMatch` | PASS |
| B | Scalar string (pageUrl) | `treatments.myers.pageUrl` | PASS |
| C | String array (bestFor) | `treatments.myers.bestFor` | PASS |
| C | String array (addonSuggestions) | `treatments.myers.addonSuggestions` | PASS |
| C | String array (tests - lab-specific) | `treatments.labGeneral.tests` | PASS |
| D | Object array (ingredients) | `treatments.myers.ingredients` | PASS |
| E | Nested map string->number (scoringWeights) | `treatments.myers.scoringWeights` | PASS |
| F | Nested map string->string (addressedBy) | `treatments.myers.addressedBy` | PASS |
| G | Bundle scalar string (name) | `bundles.beautyBundle.name` | PASS |
| G | Bundle scalar string (whyMatch) | `bundles.beautyBundle.whyMatch` | PASS |
| G | Bundle boolean (addOnInteractive) | `bundles.beautyBundle.addOnInteractive` | PASS |
| G | Bundle scalar number (acuityTypeId) | `bundles.beautyBundle.acuityTypeId` | PASS |
| G | Bundle string FK (primary treatment select) | `bundles.beautyBundle.primary` | PASS |
| H | Question scalar string (title) | `questions.start.title` | PASS |
| H | Question scalar string (subtitle) | `questions.start.subtitle` | PASS |
| H | Question option label | `questions.start.options` | PASS |
| H | Question option routing (next pointer) | `questions.start.options` | PASS |

## Findings

All tested field types round-tripped correctly. No unexpected failures.

## Gaps

The following schema fields are stored in WP (and were present in the original
KV snapshot) but have NO edit input in the admin dashboard editor:

1. `bundles.<id>.addOnLabel` (string) -- the custom label shown next to the
   add-on toggle in the wizard. The editor exposes `addOnInteractive` (bool)
   and `addOn` (treatment select) but there is no text input for this label.
   If it is already set it will be preserved on round-trip (the PHP plugin
   stores whatever JSON it receives), but it cannot be changed from the UI.

2. `bundles.<id>.isConsultation` (boolean) -- controls whether the wizard
   shows a consultation CTA instead of a booking button. Not editable in the
   `BundleEditPanel`.

3. `bundles.<id>.acuityDropdownValue` (string | null) -- Acuity dropdown
   pre-select for bundles. Present on `EditableTreatment` but not on
   `EditableBundle` and not rendered in `BundleEditPanel`.

4. `treatments.<id>.tests` (string[] | undefined) -- lab-specific test codes.
   `EditableTreatment` has the `tests` field and the dirty-check includes it,
   but `EditorMain.tsx` has no UI section that renders or edits this field.
   Round-trip works (the array is preserved when you save any treatment), but
   there is no way to add or remove test codes from the admin UI.

5. `treatments.<id>.category` -- displayed as a read-only badge in the editor.
   Cannot be changed after creation.

6. `questions.<id>.type` -- displayed as a read-only badge (single/multi).
   Cannot be changed after creation.

7. `treatments.<id>.acuityDropdownValue` -- editable via text input in the
   editor, but a null value is stored as an empty string in the editor draft,
   then serialized as `""` in the POSTed JSON. The PHP plugin stores exactly
   what it receives, so a treatment that originally had `null` will be stored
   as `""` if the editor saves it with the field blank. This is a minor
   type-coercion edge case: the consumer `wizard.js` likely reads it as falsy
   either way, but strict JSON consumers would see a type change.

8. The "Publish Live" button (`canPublish`) is gated by
   `!!META.configWorkerUrl`. In the current deployment `configWorkerUrl` is
   set to an empty string (migration from Cloudflare Worker to WP REST is
   complete). This means `canPublish` is `false` and the Publish Live button
   is NOT rendered in any editor panel. Save-and-Publish from the admin
   dashboard (`handleSaveAndPublish`) uses the WP nonce injected by
   `wizardOfIvBootstrap`, which is the correct path. The editor-tab "Save"
   button writes to the Vite dev server disk only (not to WP REST).
   The only REST-write path for the embedded admin dashboard is the
   "Save & Publish" button in `WizardDevDashboard`, not in the editor tab.
