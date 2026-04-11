# Wizard of IV -- Complete Workflow & Decision Tree

> **Source files:**
> - Config: `public/wizard-of-iv/wizard-config.json`
> - Logic: `public/wizard-of-iv/wizard.js`
> - Styles: `public/wizard-of-iv/wizard.css`

---

## How to read this document

- **[Q]** = a question screen the user sees
- **-->** = "leads to"
- **[RESULT]** = a treatment recommendation screen (terminal node)
- **[BUNDLE]** = a recommendation that combines a primary treatment + optional add-on
- Indentation shows depth in the tree
- Every possible click path is documented below

---

## Entry Point

User clicks a "Find My Treatment" button (any element with `data-treatment-wizard` attribute). Modal opens.

---

## The Decision Tree

### [Q] START: "What brings you in today?"

Six top-level paths:

| # | Option | Goes to |
|---|--------|---------|
| 1 | "I need relief right now" | --> [Q] Acute |
| 2 | "I want to improve my wellness" | --> [Q] Wellness |
| 3 | "I want to lose weight" | --> [Q] Weight Loss |
| 4 | "I need blood work done" | --> [Q] Labs |
| 5 | "I just want a quick injection" | --> [Q] Quick Shot |
| 6 | "I'm not sure -- help me decide" | --> [Q] Symptoms (multi-select) |

---

## PATH 1: "I need relief right now"

### [Q] ACUTE: "What's going on?"

| Option | Result |
|--------|--------|
| "Hangover / drank too much" | --> **[RESULT] Hangover IV** ($250) |
| "Migraine or severe headache" | --> **[RESULT] Migraine IV** ($250) |
| "Getting sick / cold or flu" | --> **[RESULT] Immunity IV** ($220) |
| "Dehydrated or exhausted" | --> [Q] Dehydrated or Tired |
| "Altitude sickness" | --> **[RESULT] Altitude Sickness IV** ($250) |
| "Jet lag / just traveled" | --> **[BUNDLE] Myers' Cocktail** ($220) -- with jet-lag-specific whyMatch text |
| "Recovering from illness or burnout" | --> **[RESULT] Revival IV** ($395) |

#### [Q] DEHYDRATED OR TIRED: "What best describes how you feel?"

| Option | Result |
|--------|--------|
| "Dehydrated -- not drinking enough, heat, vomiting" | --> **[RESULT] Hydration IV** ($120) |
| "Exhausted / run-down / depleted" | --> [Q] Myers' Upgrade |

*(Myers' Upgrade is a shared question -- see below)*

---

## PATH 2: "I want to improve my wellness"

### [Q] WELLNESS: "What's your wellness goal?"

| Option | Result |
|--------|--------|
| "More energy / less brain fog" | --> [Q] Energy |
| "Better skin, hair, and nails" | --> **[BUNDLE] Beauty Glow Package** (Myers' $220 + optional Biotin shot +$35) |
| "Athletic performance / recovery" | --> [Q] Athletic Goal |
| "Anti-aging / longevity" | --> [Q] Anti-Aging |
| "General tune-up" | --> [Q] Myers' Upgrade |
| "Immune system support" | --> **[RESULT] Immunity IV** ($220) |
| "Recurring migraines / prevention" | --> **[RESULT] Migraine IV** ($250) |
| "Addiction / withdrawal support" | --> [Q] NAD+ Dose |
| "Prenatal support" | --> **[RESULT] Pregnancy / Prenatal IV** ($220) |

#### [Q] ENERGY: "How long have you been feeling this way?"

| Option | Result |
|--------|--------|
| "Just this week" | --> [Q] Myers' Upgrade |
| "A few weeks or months" | --> [Q] NAD+ Dose |
| "A long time / months or years" | --> [Q] NAD+ Dose |

#### [Q] ATHLETIC GOAL: "What's your focus?"

| Option | Result |
|--------|--------|
| "Post-workout / competition recovery" | --> **[RESULT] Performance IV** ($295) |
| "Cellular energy and deep recovery" | --> [Q] NAD+ Dose |

#### [Q] ANTI-AGING: "What's your approach to anti-aging?"

| Option | Result |
|--------|--------|
| "Longevity IV -- full vitamin stack + NAD+" | --> **[RESULT] Longevity IV** ($250) |
| "NAD+ IV -- focused cellular repair" | --> [Q] NAD+ Dose |

---

## PATH 3: "I want to lose weight"

### [Q] WEIGHT LOSS: "Where are you in your weight loss journey?"

| Option | Result |
|--------|--------|
| "Just starting -- I want medical support" | --> [Q] GLP-1 Choice |
| "Already on a program, need a boost" | --> [Q] Weight Loss Boost |
| "I want to explore my options" | --> [Q] GLP-1 Compare |

#### [Q] GLP-1 CHOICE: "Which GLP-1 program fits your goals?"

| Option | Result |
|--------|--------|
| "Semaglutide (Ozempic/Wegovy) -- from $199/mo" | --> **[RESULT] Semaglutide** ($199/mo) |
| "Tirzepatide (Mounjaro/Zepbound) -- from $399/mo" | --> **[RESULT] Tirzepatide** ($399/mo) |
| "Help me choose" | --> [Q] GLP-1 Compare |

#### [Q] GLP-1 COMPARE: "Semaglutide vs. Tirzepatide"

| Option | Result |
|--------|--------|
| "Semaglutide -- the proven choice" | --> **[RESULT] Semaglutide** ($199/mo) |
| "Tirzepatide -- maximum results" | --> **[RESULT] Tirzepatide** ($399/mo) |
| "I'd like to talk to someone first" | --> **[BUNDLE] Weight Loss Consultation** (shows Semaglutide info + phone number) |

#### [Q] WEIGHT LOSS BOOST: "What kind of support do you need?"

| Option | Result |
|--------|--------|
| "Lipo-Mino injections" | --> **[RESULT] Lipo-Mino Injections** ($35/shot) |
| "Full IV for energy during weight loss" | --> [Q] Myers' Upgrade |

---

## PATH 4: "I need blood work done"

### [Q] LABS: "What kind of blood work do you need?"

| Option | Result |
|--------|--------|
| "Basic health check" | --> **[RESULT] General Wellness Panel** ($175) |
| "Deeper health assessment" | --> **[RESULT] In-Depth Wellness Panel** ($199) |
| "Check my vitamin levels" | --> **[RESULT] Vitamin Level Panel** ($225) |
| "Full comprehensive panel" | --> **[RESULT] Complete Wellness Panel** ($449) |

*(All 4 are direct/terminal -- no further branching)*

---

## PATH 5: "I just want a quick injection"

### [Q] QUICK SHOT: "Which injection do you need?"

| Option | Result |
|--------|--------|
| "B12 -- Energy and metabolism" | --> **[RESULT] B12 Injection** ($35) |
| "Glutathione -- Detox and glow" | --> **[RESULT] Glutathione Injection** ($35) |
| "Tri-Immune -- Triple immune defense" | --> **[RESULT] Tri-Immune Injection** ($35) |
| "Vitamin D -- Bone, mood, immune" | --> **[RESULT] Vitamin D Injection** ($35) |
| "Biotin -- Hair, skin, nails" | --> **[RESULT] Biotin Injection** ($35) |
| "Lipo-Mino -- Fat metabolism" | --> **[RESULT] Lipo-Mino Injections** ($35) |

*(All 6 are direct/terminal -- no further branching)*

---

## PATH 6: "I'm not sure -- help me decide" (Multi-Select Symptoms)

### [Q] SYMPTOMS: "What resonates with you?" (select all that apply)

This is the only **multi-select** question. User picks one or more symptoms, then the system **scores** all treatments and returns a ranked list.

#### Available symptoms and what they score:

| Symptom | Treatments scored (weight) |
|---------|---------------------------|
| Tired all the time | Myers' (3), NAD+ 250 (3), NAD+ 100 (2), Revival (2), B12 Shot (2), Vitamin Lab (1) |
| Frequent headaches | Migraine (5), Myers' (2), Hydration (2) |
| Getting sick often | Immunity (5), Tri-Immune (3), Myers' (2), Vitamin D (2) |
| Skin looks dull or aging | Glutathione (4), Biotin (3), Longevity (3), Myers' (2) |
| Sore muscles / slow recovery | Performance (5), Myers' (2), NAD+ 500 (2), NAD+ 250 (1) |
| Struggling with weight | Semaglutide (5), Tirzepatide (4), Lipo-Mino (3) |
| Brain fog / can't focus | NAD+ 250 (5), NAD+ 500 (4), NAD+ 100 (3), Longevity (3), Myers' (1) |
| Dehydrated / dry all the time | Hydration (5), Myers' (3), Altitude (2) |
| Stressed and burnt out | Revival (3), Myers' (3), NAD+ 250 (3) |
| Not sure what I'm missing | Vitamin Lab (4), In-Depth Lab (3), General Lab (2) |

#### How scoring works:

1. For each selected symptom, add that symptom's score to each treatment it maps to
2. Sort all treatments by total accumulated score (highest first)
3. **Deduplicate by category** -- keep only the top scorer per category (iv, nad, weightLoss, lab, injection)
4. Return: up to **3 IV/NAD results** + all weight loss programs + all labs/injections that scored
5. Display each result with its "addressed by" explanation text

#### Scoring example:

If user selects **"Tired all the time"** + **"Brain fog / can't focus"**:

| Treatment | Tired score | Brain fog score | **Total** | Category |
|-----------|------------|-----------------|-----------|----------|
| NAD+ 250 | 3 | 5 | **8** | nad |
| Myers' | 3 | 1 | **4** | iv |
| NAD+ 500 | 0 | 4 | **4** | nad |
| NAD+ 100 | 2 | 3 | **5** | nad |
| Longevity | 0 | 3 | **3** | iv |
| Revival | 2 | 0 | **2** | iv |
| B12 Shot | 2 | 0 | **2** | injection |
| Vitamin Lab | 1 | 0 | **1** | lab |

After dedup (best per category): NAD+ 250 (8, nad), Myers' (4, iv), B12 Shot (2, injection), Vitamin Lab (1, lab)
Final display: **NAD+ 250, Myers', B12 Shot, Vitamin Lab**

---

## Shared Questions (Reachable from Multiple Paths)

### [Q] MYERS' UPGRADE: "Which Myers' level fits you?"

**Reachable from:** Acute > Exhausted, Wellness > General tune-up, Wellness > Energy > Just this week, Weight Loss > Boost > IV for energy

| Option | Result |
|--------|--------|
| "Standard Myers' -- $220" | --> **[RESULT] Myers' Cocktail** ($220) |
| "Myers' Gold -- $275" | --> **[RESULT] Myers' Gold** ($275) |
| "Myers' Platinum -- $375" | --> **[RESULT] Myers' Platinum** ($375) |
| "I'd rather try NAD+ therapy" | --> [Q] NAD+ Dose |

### [Q] NAD+ DOSE: "Which NAD+ dose is right for you?"

**Reachable from:** Wellness > Energy > weeks/months, Wellness > Energy > long time, Wellness > Addiction support, Wellness > Athletic > Cellular energy, Wellness > Anti-aging > NAD+, Myers' Upgrade > NAD+ option

| Option | Result |
|--------|--------|
| "100mg -- Entry level" | --> **[RESULT] NAD+ IV 100mg** ($100) |
| "250mg -- Most popular" | --> **[BUNDLE] NAD+ 250mg + Vitamin Level Panel** ($250 + optional $225 lab) |
| "500mg -- Deep restoration" | --> **[RESULT] NAD+ IV 500mg** ($400) |

**Special rule in code:** Any recommendation of `nad250` is automatically upgraded to the `nadPlusLabs` bundle (see `showResult()` line 707-709 in wizard.js).

---

## Bundles (Combined Offerings)

Bundles display a primary treatment with an optional interactive add-on toggle.

| Bundle ID | Display Name | Primary Treatment | Add-On | Add-On Interactive? |
|-----------|-------------|-------------------|--------|-------------------|
| `beautyBundle` | Beauty Glow Package | Myers' ($220) | Biotin Shot (+$35) | Yes (toggle) |
| `nadPlusLabs` | NAD+ IV + Vitamin Level Panel | NAD+ 250mg ($250) | Vitamin Level Panel (+$225) | Yes (toggle) |
| `weightLossConsult` | Weight Loss Consultation | Semaglutide ($199/mo) | None (shows phone #) | No (consultation) |
| `jetLagMyers` | Myers' Cocktail | Myers' ($220) | None | No |

When `addOnInteractive: true`, the result screen shows a toggle the user can click to add/remove the add-on before booking.

---

## Add-On Suggestions (Symptom Path Only)

When results come from the multi-select symptom scoring path, each primary treatment can show suggested add-on injections:

| Primary Treatment | Suggested Add-Ons |
|-------------------|-------------------|
| Immunity IV | Tri-Immune Shot, Vitamin D Shot |
| Myers' Cocktail | B12 Shot, Glutathione Shot |
| Performance IV | Lipo-Mino Shot, B12 Shot |
| Longevity IV | Glutathione Shot |
| Hydration IV | B12 Shot |
| Migraine IV | Vitamin D Shot |
| Hangover IV | B12 Shot |

---

## Complete Treatment Catalog

### IV Treatments

| ID | Name | Price | Duration |
|----|------|-------|----------|
| `hydration` | Hydration IV | $120 | 30-45 min |
| `myers` | Myers' Cocktail | $220 | 30-45 min |
| `immunity` | Immunity IV | $220 | 30-45 min |
| `pregnancy` | Pregnancy / Prenatal IV | $220 | 30-45 min |
| `altitude` | Altitude Sickness IV | $250 | 30-45 min |
| `hangover` | Hangover IV | $250 | 30-45 min |
| `migraine` | Migraine IV | $250 | 30-45 min |
| `longevity` | Longevity IV | $250 | 30-45 min |
| `myersGold` | Myers' Gold | $275 | 30-45 min |
| `performance` | Performance IV | $295 | 30-45 min |
| `myersPlatinum` | Myers' Platinum | $375 | 30-45 min |
| `revival` | Revival IV | $395 | 30-45 min |

### NAD+ Therapy

| ID | Name | Price | Duration |
|----|------|-------|----------|
| `nad100` | NAD+ IV (100mg) | $100 | 60-90 min |
| `nad250` | NAD+ IV (250mg) | $250 | 60-90 min |
| `nad500` | NAD+ IV (500mg) | $400 | 60-90 min |

### Weight Loss Programs

| ID | Name | Price | Duration |
|----|------|-------|----------|
| `semaglutide` | Semaglutide (GLP-1) | from $199/mo | Ongoing |
| `tirzepatide` | Tirzepatide (GLP-1+GIP) | from $399/mo | Ongoing |

### Quick Injections ($35 each, 5 min)

| ID | Name |
|----|------|
| `b12Shot` | B12 Injection |
| `biotinShot` | Biotin Injection |
| `glutathioneShot` | Glutathione Injection |
| `triImmuneShot` | Tri-Immune Injection |
| `vitaminDShot` | Vitamin D Injection |
| `lipoShots` | Lipo-Mino Injections |

### Lab Panels

| ID | Name | Price |
|----|------|-------|
| `labGeneral` | General Wellness Panel | $175 |
| `labInDepth` | In-Depth Wellness Panel | $199 |
| `labVitamin` | Vitamin Level Panel | $225 |
| `labComplete` | Complete Wellness Panel | $449 |

---

## Visual Flow Summary

```
START
 |
 +--> Acute Relief
 |     +--> Hangover --> [Hangover IV $250]
 |     +--> Migraine --> [Migraine IV $250]
 |     +--> Sick --> [Immunity IV $220]
 |     +--> Dehydrated/Tired
 |     |     +--> Dehydrated --> [Hydration IV $120]
 |     |     +--> Exhausted --> Myers' Upgrade (shared)
 |     +--> Altitude --> [Altitude IV $250]
 |     +--> Jet lag --> [Myers' $220] (bundle: jetLagMyers)
 |     +--> Burnout --> [Revival IV $395]
 |
 +--> Wellness
 |     +--> Energy
 |     |     +--> This week --> Myers' Upgrade (shared)
 |     |     +--> Weeks/months --> NAD+ Dose (shared)
 |     |     +--> Long time --> NAD+ Dose (shared)
 |     +--> Beauty --> [Beauty Bundle: Myers' $220 + Biotin +$35]
 |     +--> Athletic
 |     |     +--> Recovery --> [Performance IV $295]
 |     |     +--> Cellular --> NAD+ Dose (shared)
 |     +--> Anti-aging
 |     |     +--> Longevity IV --> [Longevity IV $250]
 |     |     +--> NAD+ --> NAD+ Dose (shared)
 |     +--> Tune-up --> Myers' Upgrade (shared)
 |     +--> Immunity --> [Immunity IV $220]
 |     +--> Migraines --> [Migraine IV $250]
 |     +--> Addiction --> NAD+ Dose (shared)
 |     +--> Prenatal --> [Pregnancy IV $220]
 |
 +--> Weight Loss
 |     +--> Starting --> GLP-1 Choice
 |     |     +--> Semaglutide --> [Semaglutide $199/mo]
 |     |     +--> Tirzepatide --> [Tirzepatide $399/mo]
 |     |     +--> Help me choose --> GLP-1 Compare
 |     |           +--> Semaglutide --> [Semaglutide $199/mo]
 |     |           +--> Tirzepatide --> [Tirzepatide $399/mo]
 |     |           +--> Talk to someone --> [Consult bundle]
 |     +--> Already on program --> Weight Loss Boost
 |     |     +--> Lipo-Mino --> [Lipo-Mino $35/shot]
 |     |     +--> IV energy --> Myers' Upgrade (shared)
 |     +--> Explore options --> GLP-1 Compare (same as above)
 |
 +--> Labs
 |     +--> Basic --> [General Panel $175]
 |     +--> Deeper --> [In-Depth Panel $199]
 |     +--> Vitamins --> [Vitamin Panel $225]
 |     +--> Full --> [Complete Panel $449]
 |
 +--> Quick Injection
 |     +--> B12 --> [$35]
 |     +--> Glutathione --> [$35]
 |     +--> Tri-Immune --> [$35]
 |     +--> Vitamin D --> [$35]
 |     +--> Biotin --> [$35]
 |     +--> Lipo-Mino --> [$35]
 |
 +--> Not Sure (Multi-Select Symptoms)
       +--> Select 1+ symptoms --> Weighted scoring algorithm
             +--> Returns ranked results across all categories
             +--> Top 3 IV/NAD + weight loss + labs/injections


SHARED NODES:

Myers' Upgrade (reachable from 4 paths)
 +--> Standard Myers' --> [Myers' $220]
 +--> Myers' Gold --> [Myers' Gold $275]
 +--> Myers' Platinum --> [Myers' Platinum $375]
 +--> Try NAD+ --> NAD+ Dose

NAD+ Dose (reachable from 6 paths)
 +--> 100mg --> [NAD+ 100mg $100]
 +--> 250mg --> [NAD+ 250mg $250 + optional Vitamin Lab $225]
 +--> 500mg --> [NAD+ 500mg $400]
```

---

## Key Code Behaviors

1. **NAD+ 250 auto-bundle:** In `wizard.js:707-709`, any direct recommendation of `nad250` is silently upgraded to the `nadPlusLabs` bundle, which shows NAD+ 250mg as primary with an interactive toggle to add the Vitamin Level Panel.

2. **Bundle add-on toggle:** When `addOnInteractive: true`, the result screen renders a checkbox/toggle for the add-on. User can opt in or out before booking.

3. **Back navigation:** Full history stack. Users can navigate backwards through every question they've answered. Multi-select selections are preserved when going back.

4. **Progress bar:** Calculated as `stepNumber / EXPECTED_MAX_STEPS * 100`, capped at 90% during questions, jumps to 100% on result.

5. **Booking integration:** "Book This Treatment" opens Acuity Scheduling with the treatment's `acuityTypeId` and `acuityDropdownValue` pre-selected.

6. **Analytics events:** Every step fires GTM/GA4 events: `wizard_opened`, `wizard_step_completed`, `wizard_recommendation`, `wizard_book_clicked`, `wizard_learn_more`, `wizard_abandoned`, `wizard_restarted`, `wizard_addon_toggled`.
