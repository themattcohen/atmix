# Math and Sliders Audit

Generated: 2026-05-04 MT. All tests performed against https://usmobileiv.com/find-my-treatment/ in an isolated browser context.

---

## 1. Algorithm Description

### Entry point

The multi-symptom scoring path is reached via the "I'm not sure -- help me decide" option on the start screen. This routes to the `symptoms` question (type: `multi`). All other paths in the question tree are `single`-select and route directly to a specific treatment or bundle ID via `option.recommend`, bypassing the scoring engine entirely. The scoring engine (`scoreSymptoms`) is called **only** from `WizardRouter.tsx:handleMultiContinue`.

File: `src/engine/scoring.ts`

### Algorithm (plain English)

1. If the selected symptom labels array is empty, return an empty result set immediately. The submit button is disabled (HTML `disabled` attribute) when no symptoms are selected, so this branch cannot be reached via the UI.

2. For every treatment in the `TREATMENTS` map (populated from the live WP REST config via `setRuntimeConfig`), and for each selected symptom label: look up `treatment.scoringWeights[symptomLabel]`. If the weight is nonzero, add it to that treatment's running score and append the symptom label to its `matchingSymptoms` list. Also capture `treatment.addressedBy[symptomLabel]` text if present.

3. Build a flat array of candidates from all treatments with nonzero scores. Sort descending by total score.

4. Deduplicate by category: walk the sorted list and keep only the first (highest-scoring) treatment per category. This means within the `iv` category, only the top-scoring IV treatment survives; lower-ranked IV treatments are dropped.

5. Split into three buckets:
   - `IV_NAD_CATEGORIES`: `['iv', 'nad']`
   - `WEIGHT_LOSS_CATEGORIES`: `['weightLoss']`
   - `LAB_INJECTION_CATEGORIES`: `['lab', 'injection']`

6. Assemble final ranked list: top 3 IV/NAD results (constant `MAX_IV_NAD_RESULTS = 3`) + all weight loss results + all lab/injection results.

7. Return `{ results, primaryTreatmentId: results[0] }`.

Source citations:
- `src/engine/scoring.ts:5-74` -- full scoring function
- `src/constants/rules.ts:18-29` -- bucket definitions and `MAX_IV_NAD_RESULTS`
- `src/components/WizardRouter.tsx:116-131` -- caller (`handleMultiContinue`)
- `src/data/index.ts:36-45` -- `setRuntimeConfig`, called once at startup from the wizard entry bundle

### Config loading

At wizard startup the bundle fetches `${window.location.origin}/wp-json/wizard-of-iv/v1/config` (same-origin, no CORS). On success the response replaces the compiled-in `TREATMENTS`, `BUNDLES`, and `QUESTIONS` maps via `setRuntimeConfig`. If the fetch fails or times out (4 second `AbortSignal.timeout`), the compiled defaults are used. The compiled defaults in the TypeScript source files and the live WP config were verified to be byte-for-byte identical as of 2026-05-04.

---

## 2. Test Configurations and Expected vs Actual Rankings

### Scoring weights used (from live config, 2026-05-04)

| Treatment | Tired | Headaches | Sick | Skin | Sore | Brain fog | Dehydrated | Stressed | Weight | Not sure |
|---|---|---|---|---|---|---|---|---|---|---|
| myers (iv) | 3 | 2 | 2 | 2 | 2 | 1 | 3 | 3 | -- | -- |
| myersGold (iv) | 4 | 2 | 2 | 2 | 2 | -- | 2 | 4 | -- | -- |
| myersPlatinum (iv) | 5 | 3 | 3 | 3 | 3 | 2 | 2 | 5 | -- | -- |
| migraine (iv) | -- | 5 | -- | -- | -- | -- | -- | -- | -- | -- |
| immunity (iv) | -- | -- | 5 | -- | -- | -- | -- | -- | -- | -- |
| performance (iv) | -- | -- | -- | -- | 5 | -- | -- | -- | -- | -- |
| hydration (iv) | -- | 2 | -- | -- | -- | -- | 5 | -- | -- | -- |
| nad250 (nad) | 3 | -- | -- | -- | 1 | 5 | -- | 3 | -- | -- |
| nad500 (nad) | -- | -- | -- | -- | 2 | 4 | -- | -- | -- | -- |
| nad100 (nad) | 2 | -- | -- | -- | -- | 3 | -- | -- | -- | -- |
| semaglutide (wt) | -- | -- | -- | -- | -- | -- | -- | -- | 5 | -- |
| triImmuneShot (inj) | -- | -- | 3 | -- | -- | -- | -- | -- | -- | -- |
| b12Shot (inj) | 2 | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| labVitamin (lab) | 1 | -- | -- | -- | -- | -- | -- | -- | -- | 4 |
| labInDepth (lab) | -- | -- | -- | -- | -- | -- | -- | -- | -- | 3 |
| labGeneral (lab) | -- | -- | -- | -- | -- | -- | -- | -- | -- | 2 |

Note: within `iv` category, dedup keeps only the highest scorer. `myersPlatinum` has the broadest coverage and highest weights, so it wins the `iv` slot in any multi-symptom selection that includes any of its 8 covered symptoms.

---

### Config A: Tired + Stressed + Sick + Dehydrated (myers-class IV should dominate)

**Rationale:** These 4 symptoms cover multiple `myersPlatinum` weights. `myersPlatinum` scores higher than any other IV treatment. NAD+ appears in a separate nad bucket.

**Expected ranking (analytical):**

| Rank | Treatment | Category | Score | Symptoms matched |
|---|---|---|---|---|
| 1 | myersPlatinum | iv | 15 (5+5+3+2) | Tired, Stressed, Sick, Dehydrated |
| 2 | nad250 | nad | 6 (3+3) | Tired, Stressed |
| 3 | triImmuneShot | injection | 3 | Sick |
| 4 | labVitamin | lab | 1 | Tired |

**Actual ranking (browser):**

| Rank | Treatment | Score (hidden) | Match |
|---|---|---|---|
| 1 | Myers' Platinum | -- | Tired, Getting sick, Dehydrated, Stressed |
| 2 | NAD+ IV (250mg) | -- | Tired, Stressed |
| 3 | Tri-Immune Injection | -- | Getting sick |
| 4 | Vitamin Level Panel | -- | Tired |

**Result: PASS. Exact match.**

Screenshot: `screenshot-math-04-configA-selected.png`, `screenshot-math-05-configA-results.png`

---

### Config B: Brain fog + Tired (NAD250 should rank #1)

**Rationale:** `nad250` has brain fog weight 5; `myersPlatinum` has brain fog 2. With only these two symptoms, nad250 scores 8 (5+3) vs myersPlatinum 7 (2+5). NAD beats IV.

**Expected ranking (analytical):**

| Rank | Treatment | Category | Score | Symptoms matched |
|---|---|---|---|---|
| 1 | nad250 | nad | 8 (5+3) | Brain fog, Tired |
| 2 | myersPlatinum | iv | 7 (2+5) | Brain fog, Tired |
| 3 | b12Shot | injection | 2 | Tired |
| 4 | labVitamin | lab | 1 | Tired |

**Actual ranking (browser):**

| Rank | Treatment | Score (hidden) | Match |
|---|---|---|---|
| 1 | NAD+ IV (250mg) | -- | Tired, Brain fog |
| 2 | Myers' Platinum | -- | Tired, Brain fog |
| 3 | B12 Injection | -- | Tired |
| 4 | Vitamin Level Panel | -- | Tired |

**Result: PASS. Exact match.**

Screenshot: `screenshot-math-06-configB-selected.png`, `screenshot-math-07-configB-results.png`

---

### Config C: "Not sure what I'm missing" only (lab should win, no IV/NAD)

**Rationale:** Only lab treatments have a weight for this symptom. `labVitamin`(4) > `labInDepth`(3) > `labGeneral`(2). No IV/NAD treatment scores. No weight loss treatment scores.

**Expected ranking (analytical):**

| Rank | Treatment | Category | Score |
|---|---|---|---|
| 1 | labVitamin | lab | 4 |

(labInDepth and labGeneral also score but are deduped within lab category -- only highest-per-category survives.)

**Actual ranking (browser):**

| Rank | Treatment |
|---|---|
| 1 | Vitamin Level Panel |

**Result: PASS. Exactly one result, correct treatment.**

Note on dedup: the engine dedups by category, which means only `labVitamin`(4) appears from the lab category even though `labInDepth`(3) and `labGeneral`(2) also scored. This is correct behavior.

Screenshot: `screenshot-math-08-configC-results.png`

---

### Edge case: Zero symptoms selected

**Expected:** Submit button disabled, scoring engine never called, no result.

**Actual:** Submit button has HTML `disabled` attribute confirmed via `submitBtn.disabled === true`. Click is a no-op. Engine not called.

**Result: PASS. Properly gated.**

---

## 3. Save-to-Propagate Test Results

### Test setup

- Field mutated: `treatments.myers.scoringWeights["Frequent headaches"]`
- Original value: `2`
- Sentinel value: `99`
- Pre-mutation iv winner for "Frequent headaches" alone: Migraine IV (score 5)
- Post-mutation iv winner expected: Myers' Cocktail (score 99)

### Execution

| Step | Action | Result |
|---|---|---|
| 1 | Save original config snapshot | `wiz_original.json` (46171 bytes) |
| 2 | Build mutated config, POST to `/wp-json/wizard-of-iv/v1/config` | `{"success":true,"updated_at":"2026-05-04T20:07:20+00:00"}` |
| 3 | Immediate GET to verify round-trip | `myers.Frequent headaches = 99` confirmed |
| 4 | Hard-reload wizard page (ignoreCache=true) | Config fetch returns sentinel immediately on load |
| 5 | Run wizard: select "Frequent headaches" only | #1 result: Myers' Cocktail |
| 6 | POST original config to restore | `{"success":true,"updated_at":"2026-05-04T20:09:29+00:00"}` |
| 7 | Verify restoration via GET | `myers.Frequent headaches = 2` confirmed |
| 8 | Hard-reload + same symptom selection | #1 result: Migraine IV (restored) |

**Save propagation latency:** The wizard re-fetches the config on every page load (no in-session cache). A hard reload is sufficient to pick up a new config. There is no session-level caching of the config object -- `setRuntimeConfig` is called synchronously before React renders. The `Cache-Control: no-cache` header on the WP REST endpoint ensures CDN (Cloudflare) does not serve stale config.

**Result: PASS on all 8 steps.**

Screenshot: `screenshot-math-09-sentinel-myers-wins.png`, `screenshot-math-10-post-restore-migraine-wins.png`

---

## 4. Findings, Ranked by Severity

### P1 -- Ship-blocker UX

**P1-1: Score values never shown to the user**

The multi-result screen (`MultiResultScreen.tsx`) shows only the ranked list. No treatment score, relative percentile, or "why this order" explanation is displayed. When two treatments have similar scores (e.g., nad250=8 vs myersPlatinum=7 in Config B), the user sees rankings 1 and 2 with no indication that the margin is narrow. A patient who feels equally drawn to IV and NAD therapy has no signal to guide the choice. There is also no mechanism to break ties (e.g., price-as-tiebreaker or user preference).

This is a P1 because it directly limits the quality of the clinical recommendation UX, not just polish.

**P1-2: myersPlatinum dominates nearly every multi-symptom configuration**

`myersPlatinum` has scoring weights across 8 of the 10 possible symptoms and all its weights are the highest in the `iv` category. For any multi-symptom selection that includes symptoms from `myersPlatinum`'s coverage (Tired, Headaches, Sick, Skin, Sore, Brain fog, Dehydrated, Stressed), `myersPlatinum` will always be the iv-category result. `myers` and `myersGold` are effectively unreachable from the multi-symptom path -- they can only be recommended via the single-select Myers upgrade question.

Clinical implication: a patient selecting 2+ general wellness symptoms will always be shown a $375 treatment as their top IV option, rather than $220 or $275. The scoring does not express clinical appropriateness (e.g., severity) -- only weight magnitude. This may be intentional (upsell strategy), but if so it should be documented as a design decision, not left implicit in the data.

**P1-3: WP Rocket lazy-load prevents wizard from opening on fresh page load without a real user gesture**

Confirmed during testing: on a hard reload without prior simulated mouse/keyboard events, `wizard.js` is deferred by WP Rocket and `window.TreatmentWizard` is undefined. `window.TreatmentWizard.open('test')` in the embed script's `onReady` callback will throw a TypeError if called before WP Rocket fires the script. The UX implication: programmatic open calls (e.g., from a CTA in a Bricks element that fires on page load) will silently fail unless the user has already triggered a gesture. The wizard's own "Find My Treatment" button works because the user click both triggers WP Rocket and fires the button handler. Exit-intent triggers or timed auto-opens would fail.

Mitigation needed: either delay the `TreatmentWizard.open` call until `wizard.js` fires its own ready event, or move `wizard.js` out of WP Rocket's deferral list.

### P2 -- Polish

**P2-1: No score visibility on result cards means "why am I seeing this?" is unanswerable**

Users see `#1 Myers' Platinum` but have no way to understand why it ranked above `NAD+ IV (250mg)` by only 1 point (Config B: 7 vs 8). An "X of Y symptoms addressed" count or a percentage match would improve trust.

**P2-2: Dedup silently suppresses lower-ranked treatments within same category**

When `myersPlatinum` scores highest in the `iv` category, `myers`, `myersGold`, `migraine`, `performance`, etc. are silently dropped -- even if they are more clinically appropriate. There is no fallback presentation of "you might also consider..." within the same category. The `MAX_IV_NAD_RESULTS = 3` constant is for the iv+nad combined bucket, not for within-category results.

**P2-3: "Not sure what I'm missing" produces only a lab result with no IV/NAD**

A patient selecting only this option sees one result (Vitamin Level Panel). No messaging explains that this selection is intended for diagnostics before choosing a treatment. The absence of any IV recommendation may feel incomplete to a patient expecting a treatment suggestion.

**P2-4: `addressedBy` text on result cards shows only the FIRST addressedBy text per treatment**

From the browser output of Config A (Myers' Platinum): `"Triple-dose B12 and B-Complex plus NAD+ deliver maximum cellular energy restoration"` -- this is the `addressedBy` text for "Tired all the time" only, even though 4 symptoms were matched. The rendering shows one addressedBy line, not one per matched symptom. Cross-checking `MultiResultScreen.tsx` is outside read-scope, but this discrepancy between matched symptom count (4) and displayed addressedBy text (1 line) is visible in the browser output.

**P2-5: `labComplete` has no `scoringWeights` entries**

`labComplete` (the $449 comprehensive panel, 45+ biomarkers) has empty `scoringWeights: {}`. It can never appear in any multi-symptom recommendation, even for patients selecting "Not sure what I'm missing." It is only accessible via the direct path `start > labs > Complete Wellness Panel`. This may be intentional, but it means the highest-value lab product is invisible to the symptom-based recommendation path.

### P0 -- Broken math

None found. The algorithm is correctly implemented. All 3 test configurations produced results matching the analytical prediction computed independently from the raw scoring weights. The dedup and bucket assembly logic match `scoring.ts` exactly.

---

## 5. Screenshots

| File | Content |
|---|---|
| `screenshot-math-01-page-load.png` | Initial page state before wizard open |
| `screenshot-math-02-wizard-open.png` | Wizard open at start question |
| `screenshot-math-03-symptom-screen.png` | Multi-symptom selection screen |
| `screenshot-math-04-configA-selected.png` | Config A: 4 symptoms selected |
| `screenshot-math-05-configA-results.png` | Config A: results (myersPlatinum #1) |
| `screenshot-math-06-configB-selected.png` | Config B: 2 symptoms selected |
| `screenshot-math-07-configB-results.png` | Config B: results (NAD+ 250mg #1) |
| `screenshot-math-08-configC-results.png` | Config C: "Not sure" result (labVitamin only) |
| `screenshot-math-09-sentinel-myers-wins.png` | Sentinel test: myers wins with weight=99 |
| `screenshot-math-10-post-restore-migraine-wins.png` | Post-restore: Migraine IV back at #1 |

All screenshots saved to `usmiv/wizard-v2/claudedocs/`.
