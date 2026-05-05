# Wizard Path Coverage Report

Generated 2026-05-05 MT. Tests performed against `https://usmobileiv.com/find-my-treatment/?nocache=1` in isolated browser context (chrome-devtools MCP). Live config fetched from `/wp-json/wizard-of-iv/v1/config`.

---

## NAD Addiction/Withdrawal Path

**Question chain:**
`start` ("I want to improve my wellness") -> `wellness` ("Addiction / withdrawal support") -> `nadDose` ("500mg -- Deep restoration") -> result

**Path classification:** 3-step single-select. The `wellness` -> "Addiction / withdrawal support" option has `next: 'nadDose'`, not a direct `recommend`. The actual recommendation is selected at the `nadDose` step. All three doses are valid endpoints:
- nad100 (100mg, $100) -- entry level
- nadPlusLabs (bundle: nad250 + labVitamin, $250 primary) -- most popular
- nad500 (500mg, $400) -- deep restoration

**Tested dose:** 500mg (the dose most aligned with addiction recovery per the catalog's own `bestFor` copy).

**Observed recommendation:**
- Name: NAD+ IV (500mg)
- Price: $400
- Duration: 60-90 min
- Badge tier: "YOUR RECOMMENDED TREATMENT" (standard single result, no special badge)
- WHY THIS IS YOUR MATCH copy: "At 500mg, NAD+ therapy reaches deep cellular restoration. This dose is particularly beneficial for longevity protocols, supporting addiction recovery, and rebuilding mitochondrial function after chronic stress or illness."
- WHAT'S INSIDE: NAD+ (500mg) -- "Deep cellular repair, addiction recovery support, longevity"
- BEST FOR: Serious anti-aging, Addiction recovery, Chronic conditions, Longevity focus
- SUGGESTED ADD-ONS: Glutathione Injection ($35/shot)
- Learn More URL: `https://usmobileiv.com/treatments/nad500/`

**Learn More page check:** HTTP 200, title tag "NAD+ IV (500mg)", h1 "NAD+ IV (500mg)", `treatment-sync.js` present, Book This Treatment button present.

**Console errors:** None (only pre-existing Ahrefs Analytics duplicate-install warning).

**Screenshot:** `screenshot-nad-addiction-path.png`

**Anomalies:**

1. **P1 -- Copy-treatment mismatch for dose selection.** The `wellness` question's "Addiction / withdrawal support" sublabel reads "NAD+ therapy supports neurological recovery" and routes to `nadDose` which presents 3 dose options. The user is never told which dose is appropriate for addiction support. The 100mg sublabel says "First-timers, mild fatigue" and 250mg says "Chronic fatigue, brain fog, anti-aging" -- neither mentions addiction. Only 500mg (`bestFor` field) lists "Addiction recovery." A patient who selects "Addiction / withdrawal support" and then follows sublabel guidance may choose 100mg or 250mg, neither of which is clinically positioned for addiction. The recommended dose (500mg) has the right copy but the user must read `bestFor` on the result card to discover it. The question flow gives no guidance.

2. **P2 -- nad500 scoringWeights do not include "addiction" symptoms.** The `nad500.scoringWeights` cover only "Sore muscles / slow recovery" (2) and "Brain fog / can't focus" (4). If a user on the "not sure -- help me decide" (multi-symptom) path selects symptoms commonly associated with addiction/withdrawal (e.g., fatigue, brain fog), `nad250` outscores `nad500` in the nad category (nad250: brain fog=5, tired=3 vs nad500: brain fog=4, sore=2). The multi-symptom path will never recommend nad500 as top nad result. Only the deterministic `nadDose` path gets users to nad500 for addiction.

---

## NAD Prenatal Support Path

**Question chain:**
`start` ("I want to improve my wellness") -> `wellness` ("Prenatal support") -> result

**Path classification:** 2-step single-select. "Prenatal support" has `recommend: 'pregnancy'` -- it is NOT a NAD path. Routes directly to the `pregnancy` treatment.

**Observed recommendation:**
- Name: Pregnancy / Prenatal IV
- Price: $220
- Duration: 30-45 min
- Badge tier: "YOUR RECOMMENDED TREATMENT"
- WHY THIS IS YOUR MATCH copy: "This IV is specifically formulated for pregnant patients. Magnesium helps reduce cramping and nausea. B12 supports fetal neural tube development. All ingredients are nurse-administered and pregnancy-safe. We recommend letting your OB provider know."
- WHAT'S INSIDE: B12 (Fetal neural development), B-Complex (Energy and metabolism support), Vitamin C (Immune and collagen support), Magnesium (Reduces cramping and nausea), Glutathione (Antioxidant protection), Zinc (Immune support and healing)
- BEST FOR: Morning sickness, Prenatal fatigue, Dehydration during pregnancy
- SUGGESTED ADD-ONS: B12 Injection ($35/shot)
- Learn More URL: `https://usmobileiv.com/treatments/pregnancy/`

**Learn More page check:** HTTP 200, title tag "Pregnancy / Prenatal IV", h1 "Pregnancy / Prenatal IV", Book This Treatment present.

**Console errors:** One accessibility warning (see Finding ACC-1 below). No JS errors.

**Screenshot:** `screenshot-nad-prenatal-path.png`

**Anomalies:**

1. **P2 -- Section heading for NAD paths is misleading.** The `wellness` question groups "Addiction / withdrawal support" and "Prenatal support" under the same step. Both options are labeled as "wellness goals" but one leads to NAD therapy (addiction) and one leads to an IV drip (prenatal). There is no visual or copy distinction between these two very different clinical paths on the question screen.

2. **P2 -- No NAD context in prenatal recommendation.** The `wellness` -> "Prenatal support" routing is correct (pregnancy IV, not NAD), but the question step is reached from a question titled "What's your wellness goal?" with no maternal health framing. A user navigating from "I want to improve my wellness" would expect the result to be a general wellness IV -- the correct routing to a pregnancy-specific product is good, but there is no breadcrumb or explanatory copy on the result saying "We routed you to our prenatal-specific formulation."

3. **ACC-1 P2 -- aria-hidden on focused element.** Console warning: "Blocked aria-hidden on an element because its descendant retained focus. The focus must not be hidden from assistive technology users." Triggered when navigating between wizard steps. Element: `button.tw-close` inside `div.tw-overlay[aria-hidden]`. This is a screen-reader accessibility defect present on all wizard paths.

---

## Single-Select Hardcoded Recommendation Paths

### Inventory

All options with a `recommend:` key in `src/data/questions.ts` bypass `scoreSymptoms` and call `resolveRecommendation` directly. Cross-checked against live `/wp-json/wizard-of-iv/v1/config`.

| Question | Answer | Hardcoded result ID | Kind | Config data status |
|---|---|---|---|---|
| acute | Hangover / drank too much | hangover | treatment | OK |
| acute | Migraine or severe headache | migraine | treatment | OK |
| acute | Getting sick / cold or flu | immunity | treatment | OK |
| acute | Altitude sickness | altitude | treatment | OK |
| acute | Jet lag / just traveled | jetLagMyers | bundle | OK (primary=myers, no addOn) |
| acute | Recovering from illness or burnout | revival | treatment | OK |
| wellness | Better skin, hair, and nails | beautyBundle | bundle | OK (primary=myers, addOn=biotinShot) |
| wellness | Immune system support | immunity | treatment | OK |
| wellness | Recurring migraines / prevention | migraine | treatment | OK |
| wellness | Prenatal support | pregnancy | treatment | OK |
| dehydratedOrTired | Dehydrated | hydration | treatment | OK |
| athleticGoal | Post-workout / competition recovery | performance | treatment | OK |
| nadDose | 100mg -- Entry level | nad100 | treatment | OK |
| nadDose | 250mg -- Most popular | nadPlusLabs | bundle | OK (primary=nad250, addOn=labVitamin) |
| nadDose | 500mg -- Deep restoration | nad500 | treatment | OK |
| antiAging | Longevity IV | longevity | treatment | OK |
| myersUpgrade | Standard Myers' -- $220 | myers | treatment | OK |
| myersUpgrade | Myers' Gold -- $275 | myersGold | treatment | OK |
| myersUpgrade | Myers' Platinum -- $375 | myersPlatinum | treatment | OK |
| quickShot | B12 -- Energy and metabolism | b12Shot | treatment | OK |
| quickShot | Glutathione -- Detox and glow | glutathioneShot | treatment | OK |
| quickShot | Tri-Immune -- Triple immune defense | triImmuneShot | treatment | OK |
| quickShot | Vitamin D -- Bone, mood, immune | vitaminDShot | treatment | OK |
| quickShot | Biotin -- Hair, skin, nails | biotinShot | treatment | OK |
| quickShot | Lipo-Mino -- Fat metabolism | lipoShots | treatment | OK |
| weightLossBoost | Lipo-Mino injections | lipoShots | treatment | OK |
| glp1Choice | Semaglutide | semaglutide | treatment | OK |
| glp1Choice | Tirzepatide | tirzepatide | treatment | OK |
| glp1Compare | Semaglutide -- the proven choice | semaglutide | treatment | OK |
| glp1Compare | Tirzepatide -- maximum results | tirzepatide | treatment | OK |
| glp1Compare | I'd like to talk to someone first | weightLossConsult | bundle | OK (primary=semaglutide, no addOn) |
| labs | Basic health check | labGeneral | treatment | OK |
| labs | Deeper health assessment | labInDepth | treatment | OK |
| labs | Check my vitamin levels | labVitamin | treatment | OK |
| labs | Full comprehensive panel | labComplete | treatment | OK |

**Total hardcoded paths: 35.** No missing IDs. No empty `name`, `price`, `shortDesc`, or `pageUrl` fields on any treatment or bundle primary. All Learn More page URLs return HTTP 200 (verified via HEAD requests for all 27 treatment IDs + 4 bundle primaries).

### Paths walked end-to-end

**7 paths exercised in chrome-devtools, plus 2 NAD paths above = 9 total.**

| Path | Steps | Result observed | Learn More status | Notes |
|---|---|---|---|---|
| acute -> hangover | 2 | Hangover IV, $250, 30-45 min | /treatments/hangover/ 200 | Clean |
| wellness -> beauty bundle | 2 | Beauty Glow Package, $220, 30-45 min | /treatments/myers/ 200 | Copy issue: see finding P1-BUNDLE-1 |
| labs -> labComplete | 2 | Complete Wellness Panel, $449, 15 min draw | /treatments/labComplete/ 200 | Clean |
| quickShot -> b12Shot | 2 | B12 Injection, $35/shot, 5 min | /treatments/b12Shot/ 200 | Clean |
| weightLoss -> glp1Compare -> weightLossConsult | 3 | Weight Loss Consultation, from $199/month | /treatments/semaglutide/ 200 | See finding P1-BUNDLE-2 |
| wellness -> energy -> nadDose -> nadPlusLabs | 4 | NAD+ IV + Vitamin Level Panel, $250 | /treatments/nad250/ 200 | See finding P1-BUNDLE-3 |
| acute -> jetLagMyers | 2 | Myers' Cocktail, $220, 30-45 min | /treatments/myers/ 200 | Clean |
| acute -> altitude | 2 | Altitude Sickness IV, $250, 30-45 min | /treatments/altitude/ 200 | Clean |
| wellness -> antiAging -> longevity | 3 | Longevity IV, $250, 30-45 min | /treatments/longevity/ 200 | Clean |

---

## Findings

### P0 -- Blocking

None found in the paths covered by this audit.

---

### P1 -- Ship-blocker UX

**P1-BUNDLE-1: beautyBundle result card shows wrong short description.**

The `beautyBundle` result renders the primary treatment's `shortDesc` ("The gold standard vitamin IV for energy, immunity, and overall wellness") as the subtitle under the bundle name. This description is for the Myers' Cocktail, not the Beauty Glow Package. A patient who selected "Better skin, hair, and nails" reads copy about general wellness, not skin or beauty. The `whyMatch` field ("A Myers' Cocktail with Glutathione gives your skin an antioxidant glow, plus Biotin supports keratin production...") is correct and appears lower on the card, but the first text a user reads after the title and price is misaligned with their stated goal.

File: `src/components/ResultScreen.tsx` (or equivalent) -- the short description rendered under the title appears to use `primary.shortDesc` rather than `bundle.whyMatch` or a bundle-specific short description field.

**P1-BUNDLE-2: weightLossConsult bundle Learn More link goes to semaglutide treatment page.**

Path: start -> "I want to lose weight" -> "I want to explore my options" -> glp1Compare -> "I'd like to talk to someone first" -> weightLossConsult bundle.

The user explicitly said they want to talk to someone before choosing. The bundle `primary` is `semaglutide`, so the Learn More link navigates to `/treatments/semaglutide/` -- a fully committed Semaglutide product page. The user expected a consultation landing, not a product page for a specific medication they explicitly deferred selecting. The `weightLossConsult` bundle has `isConsultation: true` and `whyMatch` copy that says "We'll help you find the right fit" -- but the Learn More destination is still the semaglutide page.

**P1-BUNDLE-3: nadPlusLabs bundle shows nad250 price ($250) without indicating bundle cost.**

Path: ... -> nadDose -> "250mg -- Most popular" -> nadPlusLabs bundle.

The result card shows "$250 / 60-90 min" which is the `nad250.price`. The bundle also includes a Vitamin Level Panel add-on ($225 if accepted). The interactive add-on toggle shows "Add a Vitamin Level Panel to check what you're low on ($225)" but the headline price of $250 does not reflect that the full package is $475. A user booking based on the headline $250 will encounter a different price when the add-on is included. Compare to the `beautyBundle` which also shows only the primary price ($220 for myers) without factoring in the biotin add-on ($35). This pricing pattern is consistent across all bundle types but understates the true session cost.

---

### P2 -- Polish

**P2-COPY-1: nadDose question gives no guidance for addiction/withdrawal users.**

Users arriving at `nadDose` via the "Addiction / withdrawal support" path see three dose options with sublabels oriented toward fatigue, anti-aging, and longevity. The 500mg sublabel says "Longevity focus, serious repair" -- not "addiction recovery." The 250mg sublabel says "Chronic fatigue, brain fog, anti-aging." A user seeking addiction/withdrawal support has no guidance from the question copy on which dose is appropriate. The 500mg `bestFor` field lists "Addiction recovery" but this is only visible after selecting 500mg and seeing the result card.

**P2-COPY-2: "Prenatal support" mislabeled under wellness goals.**

On the `wellness` question, all options are framed as general wellness goals (energy, beauty, athletics, anti-aging, immune, migraine). "Prenatal support" does not fit the general wellness framing -- it is a medical/clinical status, not a wellness goal. A pregnant user scanning the list may not expect to find their option among energy and beauty goals. A sublabel ("Pregnancy-safe IV hydration and nutrients") would both aid discoverability and clarify the clinical nature of the routing.

**P2-ACC-1: aria-hidden on focused element (all paths).**

Console warning on wizard step transitions: `div.tw-overlay[aria-hidden]` contains the focused `button.tw-close`. This violates WCAG 4.1.2 and the `aria-hidden` spec. The `inert` attribute on the overlay, or ensuring focus moves to the modal content before `aria-hidden` is applied to the overlay, would fix this.

**P2-BADGE-1: No badge tier differentiation on single-result recommendation screen.**

All single-select paths show "YOUR RECOMMENDED TREATMENT" regardless of confidence or clinical urgency. There is no differentiation between a high-confidence match (e.g., hangover -> Hangover IV, completely deterministic) and a match that is one of three options the user was just shown (e.g., nadDose -> nad500). The multi-result path shows ranked numbered results, but the single-result path has no equivalent signal. This was noted in the math audit (P2) and is confirmed here as a pattern across all 9 tested paths.

**P2-STATIC-REVIEWS: "546 5-Star Reviews" is hardcoded.**

Present on all single-result recommendation cards across all tested paths. Will become stale. Not a functional defect but will drift from actual review count over time.

---

## Screenshots

| File | Content |
|---|---|
| `screenshot-nad-addiction-path.png` | NAD addiction/withdrawal path result: NAD+ IV (500mg) recommendation screen |
| `screenshot-nad-prenatal-path.png` | Prenatal support path result: Pregnancy / Prenatal IV recommendation screen |
