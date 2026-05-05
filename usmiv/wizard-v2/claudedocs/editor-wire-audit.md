# Editor Wire Audit

Generated 2026-05-05. Purpose: catch any input that doesn't reach the POST payload.

---

## Treatment Editor (EditorMain.tsx)

Every input in EditorMain delegates to `onUpdate(field, value)` which calls `handleUpdate` in
EditorTab.tsx:229, which calls `setDrafts(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], [field]: value } }))`.
`setDrafts` triggers the debounced `onDraftsChange` effect (EditorTab.tsx:148-158), which
delivers the snapshot to `WizardDevDashboard.handleDraftsChange` -> `setCurrentDrafts`.
`handleSaveAndPublish` at WizardDevDashboard.tsx:655 uses `currentDrafts` via
`mergePreservingUnedited`. The shared upstream path is verified correct.

| Input | Field path | onChange wired? | In EditableTreatment? | Survives editableToTreatment? | In runtime Treatment? | Has consumer? | Status |
|---|---|---|---|---|---|---|---|
| name text | drafts[id].name | yes (EditorMain.tsx:826) | yes | yes | yes | wizard renderer, result card | OK |
| price text | drafts[id].price | yes (EditorMain.tsx:836); guards NaN with isNaN check | yes | yes | yes | result card price display | OK |
| priceLabel text | drafts[id].priceLabel | yes (EditorMain.tsx:848); maps empty string to undefined | yes | yes (guarded: omitted when '' or undefined) | yes (optional) | result card price override | OK |
| duration text | drafts[id].duration | yes (EditorMain.tsx:857) | yes | yes | yes | result card | OK |
| category | read-only display (span, no input) | n/a | yes | yes | yes | routing, code gen | OK (intentionally locked) |
| acuityTypeId number | drafts[id].acuityTypeId | yes (EditorMain.tsx:873); calls Number() | yes | yes | yes | Acuity booking URL | P1 -- see below |
| acuityDropdownValue text | drafts[id].acuityDropdownValue | yes (EditorMain.tsx:882); maps '' to null | yes | yes | yes | Acuity URL builder | OK |
| pageUrl text | drafts[id].pageUrl | yes (EditorMain.tsx:891) | yes | yes | yes | Learn More link | OK |
| shortDesc text | drafts[id].shortDesc | yes (EditorMain.tsx:905) | yes | yes | yes | result card subtitle | OK |
| whyMatch textarea | drafts[id].whyMatch | yes (EditorMain.tsx:917) | yes | yes | yes | result card explanation | OK |
| note text | drafts[id].note | yes (EditorMain.tsx:928); maps '' to undefined | yes | yes (guarded: omitted when '' or undefined) | yes (optional) | result card footnote | OK |
| TagEditor (bestFor) | drafts[id].bestFor | yes -- all add/remove paths call onChange -> onUpdate('bestFor') (EditorMain.tsx:938) | yes | yes | yes | result card tags | OK |
| IngredientsEditor name | drafts[id].ingredients[i].name | yes (EditorMain.tsx:189) | yes | yes | yes | result card ingredients | OK |
| IngredientsEditor benefit | drafts[id].ingredients[i].benefit | yes (EditorMain.tsx:196) | yes | yes | yes | result card ingredients | OK |
| IngredientsEditor move-up/down | drafts[id].ingredients (reorder) | yes (EditorMain.tsx:151,160) | yes | yes | yes | result card ingredient order | OK |
| IngredientsEditor remove | drafts[id].ingredients (filter) | yes (EditorMain.tsx:169) | yes | yes | yes | same | OK |
| IngredientsEditor add | drafts[id].ingredients (append {name:'',benefit:''}) | yes (EditorMain.tsx:175) | yes | yes | yes | same | OK |
| AddonSuggestionsEditor checkbox | drafts[id].addonSuggestions | yes (EditorMain.tsx:407); reads e.target.checked correctly | yes | yes | yes | add-on upsell | OK |
| TestsEditor text (lab only) | drafts[id].tests | yes (EditorMain.tsx:344); guarded by `draft.category === 'lab'` conditional | yes | yes (guarded: omitted when empty) | yes (optional) | lab test display | OK |
| TestsEditor remove | drafts[id].tests (filter) | yes (EditorMain.tsx:350) | yes | yes | yes | same | OK |
| TestsEditor add | drafts[id].tests (append '') | yes (EditorMain.tsx:357) | yes | yes | yes | same | OK |
| ScoringWeights range slider | drafts[id].scoringWeights | yes (EditorMain.tsx:303); calls Number() | yes | yes | yes | symptom scoring engine | P1 -- see below |
| ScoringWeights number input | drafts[id].scoringWeights | yes (EditorMain.tsx:311); calls Number() | yes | yes | yes | same | P1 -- see below |
| addressedBy text (conditional on weight>0) | drafts[id].addressedBy | yes (EditorMain.tsx:322) | yes | yes | yes | result card "Why this matches" | OK |

---

## Bundle Editor (BundleEditPanel.tsx)

All inputs call `onUpdate(field, value)` -> `handleBundleUpdate` at EditorTab.tsx:249 ->
`setBundleDrafts` -> triggers the debounced snapshot. Path to POST is correct.

| Input | Field path | onChange wired? | In EditableBundle? | Passes through mergePreservingUnedited? | In runtime Bundle? | Has consumer? | Status |
|---|---|---|---|---|---|---|---|
| name text | bundle.name | yes (BundleEditPanel.tsx:208) | yes | yes (shallow merge) | yes | result card | OK |
| primary TreatmentSelect | bundle.primary | yes (BundleEditPanel.tsx:217); maps null to '' | yes | yes | yes | bundle result card | OK |
| addOn TreatmentSelect | bundle.addOn | yes (BundleEditPanel.tsx:227); passes null through | yes | yes | yes (optional) | bundle add-on display | OK |
| addOnInteractive checkbox | bundle.addOnInteractive | yes (BundleEditPanel.tsx:236); reads e.target.checked | yes | yes | yes | add-on toggle | OK |
| acuityTypeId number | bundle.acuityTypeId | yes (BundleEditPanel.tsx:247); calls Number() | yes | yes | yes | Acuity booking | P1 -- see below |
| acuityDropdownValue text | bundle.acuityDropdownValue | yes (BundleEditPanel.tsx:260); maps '' to null | yes | yes | yes (optional) | Acuity URL | OK |
| addOnLabel text | bundle.addOnLabel | yes (BundleEditPanel.tsx:268); maps '' to undefined | yes | yes | yes (optional) | result card add-on label | OK |
| price number | bundle.price | yes (BundleEditPanel.tsx:285); maps '' to undefined | yes | yes | yes (optional) | result card price override | OK |
| priceLabel text | bundle.priceLabel | yes (BundleEditPanel.tsx:298); maps '' to undefined | yes | yes | yes (optional) | result card price display | OK |
| shortDesc textarea | bundle.shortDesc | yes (BundleEditPanel.tsx:315); maps '' to undefined | yes | yes | yes (optional) | result card subtitle | OK |
| pageUrl text | bundle.pageUrl | yes (BundleEditPanel.tsx:324); maps '' to undefined | yes | yes | yes (optional) | Learn More URL | OK |
| whyMatch textarea | bundle.whyMatch | yes (BundleEditPanel.tsx:341) | yes | yes | yes | result card explanation | OK |

---

## Question Editor (QuestionEditPanel.tsx)

All option mutations call `onUpdate({ ...question, options: ... })` -> `handleQuestionUpdate` at
EditorTab.tsx:270 -> `setQuestionDrafts` -> snapshot. Path is correct.

| Input | Field path | onChange wired? | In EditableQuestion? | Passes through toQuestionMap? | In runtime Question? | Has consumer? | Status |
|---|---|---|---|---|---|---|---|
| title text | question.title | yes (QuestionEditPanel.tsx:425) | yes | yes | yes | question card heading | OK |
| subtitle text | question.subtitle | yes (QuestionEditPanel.tsx:435) | yes | yes (omitted when empty by editableToQuestion) | yes (optional) | question card subheading | OK |
| type | read-only badge (no input) | n/a | yes | yes | yes | routing logic | OK (intentionally locked) |
| id | read-only span | n/a | yes | yes | yes | routing | OK (intentionally locked) |
| OptionRow label text | question.options[i].label | yes (QuestionEditPanel.tsx:114) | yes | yes | yes | option button text | OK |
| OptionRow sublabel text | question.options[i].sublabel | yes (QuestionEditPanel.tsx:120) | yes | yes (omitted when '') | yes (optional) | option button sublabel | OK |
| OptionRow icon text | question.options[i].icon | yes (QuestionEditPanel.tsx:126) | yes | yes (omitted when '') | yes (optional) | option icon | OK |
| Routing toggle (next vs recommend) | question.options[i].next / recommend | yes (QuestionEditPanel.tsx:84); sets one to '' and other to previous value | yes | yes | yes | wizard flow routing | OK |
| next question select | question.options[i].next | yes (QuestionEditPanel.tsx:155) | yes | yes | yes | wizard navigation | OK |
| recommend treatment/bundle select | question.options[i].recommend | yes (QuestionEditPanel.tsx:167) | yes | yes | yes | wizard recommendation | OK |
| option move-up | question.options reorder | yes (QuestionEditPanel.tsx:267) | yes | yes | yes | option display order | OK |
| option move-down | question.options reorder | yes (QuestionEditPanel.tsx:278) | yes | yes | yes | same | OK |
| option delete | question.options filter | yes (QuestionEditPanel.tsx:289) | yes | yes | yes | same | OK |
| Add option | question.options append | yes (QuestionEditPanel.tsx:294) | yes | yes | yes | same | OK |

---

## Custom Widgets

### ScoringWeightsEditor (EditorMain.tsx:247)

Internal flow: range slider and number input both call `handleWeightChange(symptom, Number(e.target.value))`.
When weight reaches 0, the entry is deleted from `scoringWeights` AND the matching
`addressedBy` key is also removed via `onAddressedByChange`. Both maps are then delivered
up via `onUpdate`. No local state is retained between calls; there is no debounce inside
this widget (debounce only at the snapshot level in EditorTab).

The `addressedBy` input is conditionally rendered only when `weight > 0` (EditorMain.tsx:314).
If the user sets weight to 0 while an addressedBy value is typed but not yet saved, the
conditional unmounts the field and the widget's `handleWeightChange` explicitly deletes
the addressedBy key. This is handled.

No local useState that persists edited values is used inside this widget. All state is
driven by props, which come from the parent `drafts`. Flow is clean.

### IngredientsEditor (EditorMain.tsx:130)

Six operations (name change, benefit change, move-up, move-down, remove, add) all call
the `onChange` prop which maps to `onUpdate('ingredients', ...)`. No internal buffering.
The text inputs use controlled value from `ing.name` / `ing.benefit` which come from the
draft. Flow is clean.

### TagEditor (bestFor) (EditorMain.tsx:49)

Uses a single local `useState` (`inputValue`) only for the in-progress text field -- this
is the correct pattern for a combo-style input. Committed tags immediately call `onChange(next)`
which maps to `onUpdate('bestFor', tags)`. The local `inputValue` is never written to drafts
directly, only committed tags are. No data loss on discard.

### TestsEditor (EditorMain.tsx:340)

Three operations (change, remove, add) all call `onChange`. The parent wraps the call as
`onUpdate('tests', tests.length > 0 ? tests : undefined)`. The conditional correctly maps
an empty array to undefined so `editableToTreatment` does not emit an empty `tests: []`
field. Flow is clean.

### AddonSuggestionsEditor (EditorMain.tsx:402)

Single checkbox toggle calls `onChange` which maps to `onUpdate('addonSuggestions', ids)`.
Reads `e.target.checked` correctly. The `injectionDrafts` list comes from `allDrafts` (the
live drafts map, not compiled catalog), so newly added injection-category treatments appear
without a page reload. Flow is clean.

---

## Add Treatment Dialog (AddTreatmentDialog.tsx)

The dialog collects `id`, `name`, and `category` in local state and calls
`onConfirm(id, name, category)` on submit. `handleAddTreatment` in EditorTab.tsx:521
constructs a full `EditableTreatment` with safe defaults for all required fields and adds it
to both `drafts` and `originals`. The new draft immediately participates in the
`onDraftsChange` snapshot.

No editor field in the dialog bypasses `onConfirm`. The dialog's local state is
ephemeral (collect-then-confirm pattern), not an ongoing edit surface that could
miss a flush. Flow is clean.

---

## Findings (Severity-Ranked)

### P1: NaN propagation on empty number inputs

Three number inputs call `Number(e.target.value)` unconditionally:

- `acuityTypeId` in EditorMain.tsx:873: `onUpdate('acuityTypeId', Number(e.target.value))`
- `acuityTypeId` in BundleEditPanel.tsx:247: `onUpdate('acuityTypeId', Number(e.target.value))`
- ScoringWeights range slider at EditorMain.tsx:303 and number input at EditorMain.tsx:311: `handleWeightChange(symptom, Number(e.target.value))`

For `acuityTypeId`: when the user clears the input field, `e.target.value` is `''`,
`Number('')` is `0`. This produces `0` not `NaN`, so it does not propagate NaN, but it does
silently reset acuityTypeId to `0`. The editor UI displays a validation error when
`acuityTypeId === 0`, so the user will see feedback, but the draft is written with `0`
rather than the previous value mid-edit. Risk: if the user clears the field intending to
retype, the draft is immediately set to `0`. Not a broken wire, but a lossy edit experience.

For scoring weights: `Number(e.target.value)` on an empty string again produces `0` (not
NaN) because the range slider cannot produce empty strings. The number input can be
cleared, producing `0`, which then triggers the deletion path (weight === 0 removes the
entry and its addressedBy). This is correct semantically (weight 0 = excluded), but the
user has no way to temporarily "blank" the weight input. Low harm because the slider
enforces 0-10.

Verdict: no NaN reaches the draft because `Number('')` is `0` not `NaN`. The risk is
silent reset-to-zero, not NaN propagation. This is a P1 UX edge case, not a broken wire.

### P1: Stale-draft window at initial mount

`currentDrafts` in WizardDevDashboard.tsx:596 initializes to `null`. If the user clicks
"Save & Publish" before the 100 ms debounce in EditorTab.tsx:150 fires for the first
time, `handleSaveAndPublish` at WizardDevDashboard.tsx:655 falls through to the
`runtime` fallback (the compiled module-level data, not the editor drafts). This window
is 100 ms wide from mount. In practice the button is not clickable in under 100 ms of
page load, but it is a theoretical race. If the user has a very fast keyboard shortcut
or browser automation, they could get a save that ignores all editor work.

### P2: `handleRoutingModeChange` clears the current value on toggle

At QuestionEditPanel.tsx:84, switching from "Recommends treatment" to "Goes to question"
sets `next: opt.next || ''`. If `opt.next` was previously populated, it is preserved.
But switching to recommend mode sets `recommend: opt.recommend || ''`, also preserving the
previous value. This is correct. However, the toggle back to "next" also clears `recommend`
to `''` and vice versa. This means switching between modes round-trips without data loss
only if the user does not change the selection; a select-mode-switch-then-select-different
path is fine. No data loss bug, but UI is slightly unintuitive.

### P2: `addOn: null` handling in BundleEditPanel primary TreatmentSelect

At BundleEditPanel.tsx:217, when `primary` is changed, the handler maps `null` to `''`:
`onChange={(id) => onUpdate('primary', id ?? '')}`. The `primary` field is defined as `string`
in `EditableBundle` (not `string | null`), so this is correct. But if the underlying
TreatmentSelect returns `null` for an empty selection (and `allowEmpty={false}` is set),
the `?? ''` guard is a belt-and-suspenders safety. No issue.

### P2: Tests editor onChange wraps empty array to undefined (EditorMain.tsx:971)

`onChange={(tests) => onUpdate('tests', tests.length > 0 ? tests : undefined)}` -- this
means if all tests are removed, `tests` becomes `undefined`. `editableToTreatment` at
types.ts:189 only emits `tests` when `d.tests !== undefined && d.tests.length > 0`.
So removing all lab tests silently omits the field from the payload. The server receives
no `tests` key. This is intentional per the type definition (`tests?: readonly string[]`)
but could surprise an operator who removes all tests expecting `tests: []` in the output.
Low severity because no consumer checks for `tests: []` specifically.

---

## Summary Table

| Panel | Inputs Audited | P0 (broken wire) | P1 (edge case) | P2 (cosmetic) |
|---|---|---|---|---|
| EditorMain (treatment) | 22 | 0 | 1 (NaN/zero on number clear) | 0 |
| BundleEditPanel | 12 | 0 | 1 (NaN/zero on acuityTypeId clear) | 1 (primary null guard) |
| QuestionEditPanel | 14 | 0 | 0 | 1 (routing toggle preserves stale value) |
| Custom widgets | 5 | 0 | 0 | 1 (tests empty array -> undefined) |
| AddTreatmentDialog | 3 | 0 | 0 | 0 |
| WizardDevDashboard save path | 1 | 0 | 1 (100ms stale-draft window) | 0 |
| **Total** | **57** | **0** | **3** | **3** |
