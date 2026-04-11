# PRD: Wizard of IV -- Config Management & Visibility Tooling

**Product:** Wizard of IV Treatment Recommendation Engine
**Author:** Generated from codebase analysis
**Status:** Draft
**Last updated:** 2026-04-11

---

## 1. Problem Statement

The Wizard of IV is a customer-facing decision-tree that recommends treatments from a catalog of 27 treatments, 4 bundles, and 16 branching questions. It works well for end users. The problem is for the team managing it.

**Today, the person managing the wizard cannot:**

1. **See what's happening.** The entire wizard is defined in a 1,674-line JSON config file. Understanding "if a user clicks X then Y then Z, what do they see?" requires manually tracing `next` and `recommend` references across deeply nested objects. There is no visual overview, no dashboard, no way to see the full picture.

2. **Make changes safely.** A single treatment can be referenced in up to 6 different sections of the config (treatment definition, question options, symptom scores, whyMatch text, bundles, addon suggestions). Adding or removing a service means editing multiple scattered locations. There is no validation -- a typo in a treatment ID causes the wizard to silently fall back to Myers' Cocktail with no error.

3. **Know if something is missing.** There is no way to detect that a treatment exists in the catalog but is unreachable from any user path, that a question points to a deleted treatment, or that a new service was added but never wired into the symptom scoring algorithm. These gaps are only discoverable by manually clicking through every path in the live wizard.

**Business impact:**
- Missed upsell revenue: 7 treatments currently have zero addon suggestions on their result screens (including the $395 Revival IV)
- Invisible treatments: Myers' Gold ($275) and Myers' Platinum ($375) cannot be recommended by the "help me decide" symptom path -- they have no scoring weights
- Silent failures: broken config references default to Myers' Cocktail with no alert to the team
- Slow iteration: fear of breaking things slows down treatment catalog changes

---

## 2. Goals & Success Metrics

### Goals

| # | Goal | Description |
|---|------|-------------|
| G1 | **Full visibility into every user path** | Any team member can see the complete decision tree, every path from start to result, and which treatments appear where -- without reading JSON |
| G2 | **Safe, validated config changes** | Broken references, missing data, and unreachable treatments are caught before deployment, not discovered by customers |
| G3 | **Manageable service catalog** | Adding, removing, or modifying a treatment is a documented, repeatable process with guardrails that prevent incomplete changes |
| G4 | **Config-driven business rules** | Business rules currently hardcoded in JavaScript (auto-bundling, session limits, category groupings) become editable config values |

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to understand a specific user path | 10-15 min (read JSON) | < 30 sec (view flowchart) |
| Treatments with zero addon suggestions | 7 of 27 (26%) | 0 |
| Treatments unreachable from symptom scoring | 8 of 27 (30%) | Intentional only (documented) |
| Config errors caught before deploy | 0% (no validation) | 100% (CI gate) |
| Business rules requiring JS deploy to change | 6 | 0 |
| Time to safely add a new treatment | ~30 min (manual, error-prone) | ~10 min (guided, validated) |

---

## 3. Users & Personas

| Persona | Role | Needs |
|---------|------|-------|
| **Treatment Manager** | Non-technical team member who decides which services to offer, at what price, and how they should be recommended | See the full flow visually. Know that changes are complete. Confidence that nothing is broken. |
| **Developer** | Implements config changes and deploys | Clear error messages when config is invalid. Automated checks in CI. No silent failures. |
| **Business Owner** | Decides on bundling strategy, upsell approach, pricing | Understand which treatments are being recommended where. See coverage gaps. Know that every service has a path to it. |

---

## 4. Current System Architecture

### Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `public/wizard-of-iv/wizard-config.json` | 1,674 | All treatment definitions, question tree, bundles, scoring weights, whyMatch text, addon suggestions |
| `public/wizard-of-iv/wizard.js` | 2,121 | Rendering engine, state machine, scoring algorithm, booking integration, analytics |
| `public/wizard-of-iv/wizard.css` | ~400 | Responsive styling |

### Config Structure (6 sections)

```
wizard-config.json
├── meta              — Acuity URLs, phone number, review count
├── treatments        — 27 treatment definitions (name, price, category, ingredients, bestFor)
├── questions         — 16 question nodes with options (next/recommend routing)
│   └── symptoms      — Special multi-select question with weighted scoring
│       └── symptomRules — maxPerCategory, maxTotalResults, addonSuggestions
├── bundles           — 4 combined offerings (primary + optional addon)
└── whyMatch          — 27 clinical explanation texts (separate from treatment defs)
```

### Hidden Business Rules in JavaScript

These rules are NOT in the config. They require a code deploy to change:

| Rule | JS Location | What it does |
|------|-------------|--------------|
| NAD+ 250 auto-bundle | `wizard.js:707-709` | Every NAD+ 250mg recommendation is silently swapped to the `nadPlusLabs` bundle (NAD+ 250 + Vitamin Lab Panel toggle) |
| Category scoring buckets | `wizard.js:561-567` | Hardcoded: `iv`/`nad` = results, `weightLoss` = programs, `lab`/`injection` = addons |
| Max 3 injections | `wizard.js:1358-1365` | Session plan limited to 3 injection add-ons |
| Max 1 primary | `wizard.js:1343-1355` | Only 1 non-injection treatment per session |
| Max 3 IV/NAD results | `wizard.js:571` | Symptom scoring shows top 3 IV/NAD results (ignores config's `maxTotalResults`) |
| Unknown ID fallback | `wizard.js:689-699` | Invalid treatment IDs silently default to Myers' Cocktail |

### Known Gaps in Current Config

| Gap | Impact |
|-----|--------|
| Myers' Gold and Platinum have no symptom scores | Invisible to "help me decide" path -- can never be algorithmically recommended |
| Revival IV ($395) has no addon suggestions | Highest-priced IV has zero upsell on result screen |
| NAD+ 100mg and 500mg have no addon suggestions | Only NAD+ 250mg (via bundle) gets upsells |
| All 4 lab panels have no addon suggestions | "While we're drawing blood, add a B12 shot" never appears |
| Both GLP-1 programs have no addon suggestions | No complementary injection suggestions for weight loss patients |
| `maxTotalResults: 3` config value is ignored | JS hardcodes `.slice(0, 3)` separately |
