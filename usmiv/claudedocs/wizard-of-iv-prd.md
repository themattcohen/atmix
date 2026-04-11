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

---

## 5. Feature Requirements

### Feature 1: Config Validation System

#### Description

A standalone Node.js script (`tools/validate-wizard-config.js`) that reads `wizard-config.json`, performs structural and referential integrity checks, and exits with code 0 (pass) or 1 (errors found). Reports **errors** (blocking) and **warnings** (non-blocking). This is the highest-priority deliverable because the current silent fallback to Myers' Cocktail (`wizard.js:688-699`) means a single typo in any treatment ID silently recommends the wrong treatment with no indication of failure.

#### User Stories

1. As a content editor, I want the system to immediately tell me if I misspell a treatment ID in any `recommend`, `next`, `scores`, `addressedBy`, `addonSuggestions`, or bundle field, so that users never silently receive a Myers' Cocktail fallback.
2. As a developer, I want a CI gate that blocks merges when the config has referential integrity errors.
3. As a product manager, I want to see which treatments are unreachable and which lack symptom scoring, so I can identify coverage gaps.
4. As a content editor, I want clear error messages that name the exact field path (e.g., `questions.acute.options[5].recommend: "jetLagMyers"`) so I can locate problems instantly.

#### Detailed Requirements

**Structural validation (errors)**

1. Every `treatments.{id}` SHALL have required fields: `name` (string), `price` (number), `category` (string), `acuityTypeId` (number), `shortDesc` (string), `bestFor` (non-empty array), `ingredients` (non-empty array).
2. `treatments.{id}.category` SHALL be one of: `"iv"`, `"nad"`, `"weightLoss"`, `"injection"`, `"lab"`.
3. Every `questions.{qId}` SHALL have: `id` (matching key), `title` (string), `type` (`"single"` or `"multi"`), `options` (non-empty array).

**Referential integrity (errors)**

4. Every `questions.{qId}.options[].recommend` value SHALL exist in `treatments` or `bundles`.
5. Every `questions.{qId}.options[].next` value SHALL exist in `questions`.
6. Every `bundles.{bId}.primary` SHALL exist in `treatments`.
7. Every `bundles.{bId}.addOn` (when present) SHALL exist in `treatments`.
8. Every key in `whyMatch.{id}` SHALL exist in `treatments`.
9. Every key in `questions.symptoms.options[].scores` SHALL exist in `treatments`.
10. Every key in `questions.symptoms.options[].addressedBy` SHALL exist in `treatments`.
11. Every ID in `symptomRules.addonSuggestions` (keys and array values) SHALL exist in `treatments`.

**Cross-reference consistency (errors)**

12. Every `addressedBy` key SHALL also exist in that same option's `scores` object.
13. Every treatment (except Myers' fallback) SHALL be reachable from at least one path: referenced by any `recommend`, or as a `bundles.{bId}.primary`, or in any `scores`.

**Graph integrity (errors)**

14. Orphan questions: any question never referenced by any `options[].next` and not `"start"` SHALL be flagged.

**Warnings (non-blocking)**

15. Treatment with no symptom scoring (unreachable from "help me decide").
16. Treatment with no addon suggestions (no upsell opportunity).
17. Bundle with `addOn` but `addOnInteractive: false` (user can't toggle).
18. Bundle or treatment missing `whyMatch` text.

**Output and integration**

19. Errors prefixed `ERROR:`, warnings prefixed `WARN:`, to stderr.
20. Summary line to stdout: `Wizard config validation: {N} error(s), {M} warning(s)`.
21. Exit code 0 if zero errors, 1 if any errors.
22. Optional `--json` flag for programmatic output.
23. Husky pre-commit hook blocks commits on error.
24. GitHub Actions CI step fails PRs on error.

#### Acceptance Criteria

- AC1: Current production config exits with code 0 and zero errors.
- AC2: Changing `"hangover"` to `"hanover"` in a recommend field produces an error naming the exact field path.
- AC3: Removing a treatment referenced by a bundle produces errors for both the bundle ref and orphaned whyMatch.
- AC4: Unreferenced question (not `start`) produces orphan error.
- AC5: `addressedBy` key without matching `scores` key produces error.
- AC6: Pre-commit hook blocks commit with broken reference.
- AC7: CI step fails PR with broken reference.
- AC8: `--json` outputs valid JSON with `level`, `path`, `message` per finding.
- AC9: Completes in under 500ms on current config.

#### Technical Approach

Single-file Node.js, no dependencies. `fs.readFileSync` + `JSON.parse`. Discrete validation functions push to shared `errors[]` and `warnings[]`. Dot-notation field paths for every finding. Reachability via set union of all recommend/bundle-primary/scores references. Orphan detection via set of all `next` targets. Husky `.husky/pre-commit` hook. GitHub Actions workflow triggered on changes to `public/wizard-of-iv/`.

---

### Feature 2: Auto-Generated Flow Visualization

#### Description

A Node.js script (`tools/generate-wizard-flow.js`) that reads `wizard-config.json` and outputs a Mermaid flowchart (`docs/wizard-flow.md`) showing the complete decision tree. Makes it possible to see every user path without reading JSON. Optionally outputs a treatment coverage matrix. Runs after any config change.

#### User Stories

1. As a product manager, I want a visual flowchart of the entire decision tree so I can review user experience without reading JSON.
2. As a content editor, I want to see which questions are shared (reachable from multiple paths) so I understand the impact of changes.
3. As a developer, I want the diagram to auto-update from config so it never drifts.
4. As a QA tester, I want a treatment coverage matrix to verify completeness.

#### Detailed Requirements

1. Read config, generate valid Mermaid `graph TD` flowchart.
2. Question nodes as rounded rectangles with `title`, blue styling.
3. Treatment results as stadium-shaped nodes with `name` + `price`, green styling.
4. Bundle results as hexagon nodes with primary + addon info, orange styling.
5. Edge labels from option `label` text, truncated to 40 chars.
6. Shared questions (in-degree > 1) highlighted purple. Currently: `myersUpgrade`, `nadDose`.
7. `symptoms` question rendered as parallelogram with "Multi-Select Symptom Scoring" label, teal styling.
8. `classDef` block for all 5 node classes. Legend subgraph.
9. `--matrix` flag outputs treatment coverage table to `docs/wizard-coverage-matrix.md` (columns: Treatment ID, Name, Category, Price, Direct Recommend paths, Bundle roles, whyMatch yes/no, Symptom score count, Addon suggestion parents).
10. Unreachable treatments marked `**UNREACHABLE**` in matrix.
11. Output to `docs/wizard-flow.md` (fenced mermaid) and `docs/wizard-flow.mmd` (raw).
12. `--validate-first` flag runs validation before generating; exits 1 on errors.

#### Acceptance Criteria

- AC1: Produces valid Mermaid that renders on GitHub.
- AC2: Flowchart has exactly 16 question nodes and all reachable treatments.
- AC3: `start` node has 6 outgoing edges matching its 6 options.
- AC4: `myersUpgrade` and `nadDose` rendered in purple.
- AC5: `--matrix` produces 27-row table with all columns.
- AC6: Adding a new treatment and re-running updates both diagram and matrix.

#### Technical Approach

DFS from `questions.start`. Track in-degree for shared detection. Node IDs: question keys direct, treatments prefixed `t_`, bundles `b_`. Symptom question as special node with single outgoing edge. `fs.writeFileSync` to `docs/`. Optional CI step auto-commits updated diagram on merge to main.

---

### Feature 3: Treatment Change Management Tooling

#### Description

Scripts and documentation that make adding, removing, or modifying treatments safe and complete. Includes a checklist generator (`tools/wizard-add-treatment.js`), a reference finder for removals (`tools/wizard-remove-treatment.js`), and a step-by-step guide.

#### User Stories

1. As a treatment manager, I want a checklist of exactly which config sections I need to fill in when adding a new service, so I don't miss anything.
2. As a developer, when removing a treatment, I want to see every reference to it across config AND JS so I can clean up completely.
3. As a new team member, I want a documented process for treatment changes so I don't have to reverse-engineer the config structure.

#### Detailed Requirements

**Add treatment helper**

1. `node tools/wizard-add-treatment.js --id <treatmentId> --category <category>` SHALL output a checklist of required and optional config sections to complete.
2. Required items: `treatments.{id}` definition (with all required fields listed), `whyMatch.{id}` entry, at least one `questions.{q}.options[].recommend` reference.
3. Optional items: symptom scoring entries (with available symptom labels listed), `addonSuggestions` entry, bundle definition.
4. The checklist SHALL suggest appropriate question locations based on category (e.g., `category: "injection"` suggests `questions.quickShot`; `category: "lab"` suggests `questions.labs`).
5. SHALL output a JSON template/skeleton for the treatment definition with all required fields as placeholders.

**Remove treatment helper**

6. `node tools/wizard-remove-treatment.js --id <treatmentId>` SHALL scan `wizard-config.json` for every reference to the ID across all 6 sections and report exact JSON paths.
7. SHALL also scan `wizard.js` for hardcoded references to the treatment ID and report line numbers.
8. SHALL output a numbered removal checklist: what to delete, what to redirect, what to verify.
9. SHALL warn if the treatment is a bundle primary (removing it breaks the bundle).
10. SHALL warn if the treatment appears in `addonSuggestions` values (other treatments' upsells reference it).

**Documentation**

11. A `docs/how-to-manage-treatments.md` guide with: step-by-step instructions for adding a treatment (with example), step-by-step for removing, step-by-step for modifying price/name/ingredients, and a reference of all 6 config sections.
12. Guide SHALL reference the validation script (Feature 1) as the final verification step.

#### Acceptance Criteria

- AC1: Running add helper for `--id antiInflammatory --category iv` outputs checklist mentioning `treatments`, `whyMatch`, `questions.acute` or `questions.wellness`, symptom scoring, and addon suggestions.
- AC2: Running remove helper for `--id myersPlatinum` finds exactly 2 references: `questions.myersUpgrade.options[2].recommend` and `whyMatch.myersPlatinum`.
- AC3: Running remove helper for `--id myers` finds 16+ references and warns about bundle dependencies.
- AC4: Running remove helper for `--id nad250` finds config references AND the hardcoded JS swap at line 707.
- AC5: Documentation covers add, remove, and modify workflows with examples.

#### Technical Approach

Both scripts: Node.js, no dependencies, read config + optionally scan JS via regex. Add helper: map category to suggested question locations, output JSON skeleton with placeholder values. Remove helper: recursive scan of parsed JSON for string matches, plus `fs.readFileSync` + regex on `wizard.js`. Documentation: markdown file with code examples.

---

### Feature 4: Config-Driven Business Rules

#### Description

Migrate 6 business rules currently hardcoded in `wizard.js` into `wizard-config.json` so they can be changed without a code deploy. This is the only feature that modifies the wizard JavaScript.

#### User Stories

1. As a treatment manager, I want to change whether NAD+ 250 is auto-bundled with the lab panel by editing config, not requesting a code deploy.
2. As a business owner, I want to adjust session limits (max injections, max primary treatments) via config.
3. As a developer, I want all business rules in one place (config) so the JS is purely a rendering/routing engine.

#### Detailed Requirements

**Rule 1: NAD+ 250 auto-bundle** (currently `wizard.js:707-709`)

1. Add optional `autoBundle` field to treatment definitions: `treatments.nad250.autoBundle: "nadPlusLabs"`.
2. JS SHALL read `treatments[treatmentId].autoBundle` and swap if present. Remove hardcoded `if (treatmentId === 'nad250')`.
3. Setting `autoBundle` to `null` or removing the field SHALL allow standalone NAD+ 250 recommendations.

**Rule 2: Category scoring buckets** (currently `wizard.js:561-567`)

4. Add `scoringRules.categoryGroups` to config: `{ results: ["iv","nad"], programs: ["weightLoss"], addons: ["injection","lab"] }`.
5. JS SHALL read these arrays for filtering instead of hardcoded category checks.
6. Adding a new category (e.g., `"cosmetic"`) to a group SHALL work without JS changes.

**Rule 3: Max injections per session** (currently `wizard.js:1358-1365`)

7. Add `sessionRules.maxInjections: 3` to config.
8. JS SHALL read this value instead of hardcoded `3`.

**Rule 4: Max primary treatments per session** (currently `wizard.js:1343-1355`)

9. Add `sessionRules.maxPrimary: 1` to config.
10. JS SHALL read this value instead of hardcoded `1`.

**Rule 5: Max scored results** (currently `wizard.js:571`)

11. JS SHALL read existing `symptomRules.maxTotalResults` (currently `3`, currently ignored) instead of hardcoding `.slice(0, 3)`.

**Rule 6: Valid category values** (currently implicit)

12. Add `meta.validCategories: ["iv","nad","weightLoss","injection","lab"]` to config.
13. Validation script (Feature 1) SHALL read this list instead of hardcoding category checks.

**Fallback behavior**

14. Replace silent Myers' fallback (`wizard.js:689-699`) with `console.error` + a visible error state in the modal (e.g., "Something went wrong -- please call us at {phoneNumber}"). The fallback SHALL still work but SHALL be loud, not silent.

#### Acceptance Criteria

- AC1: Removing `autoBundle` from `treatments.nad250` allows standalone NAD+ 250 recommendations without JS changes.
- AC2: Adding `"cosmetic"` to `scoringRules.categoryGroups.results` causes cosmetic-category treatments to appear in scored results without JS changes.
- AC3: Changing `sessionRules.maxInjections` to `5` allows 5 injections without JS changes.
- AC4: Changing `symptomRules.maxTotalResults` to `5` shows 5 IV/NAD results without JS changes.
- AC5: All 6 rules function identically to current behavior with the default config values.
- AC6: Invalid treatment ID triggers `console.error` and displays user-facing error message instead of silently showing Myers'.

#### Technical Approach

Config changes: add new top-level `sessionRules` and `scoringRules` objects, add `autoBundle` field to `treatments.nad250`, add `validCategories` to `meta`. JS changes: replace 6 hardcoded values with config reads (`state.config.sessionRules.maxInjections`, etc.). Add defensive defaults in JS so missing config values fall back to current behavior (backward compatible). All JS changes isolated to specific functions -- no architectural refactor.

---

### Feature 5: Treatment Coverage Dashboard

#### Description

A generated report showing every treatment's coverage status across all config sections. Think of it as a health check for the treatment catalog -- a single table that answers "is this treatment fully wired up?" for all 27 treatments at once. Can be a standalone script or a `--dashboard` mode on the validation script.

#### User Stories

1. As a treatment manager, I want a single table showing which treatments have gaps (no symptom scoring, no addon suggestions, no whyMatch) so I can prioritize filling them.
2. As a business owner, I want to see total reference counts per treatment so I understand which treatments are deeply integrated vs. minimally wired.
3. As a QA tester, I want to verify that a newly added treatment appears in all required sections.

#### Detailed Requirements

1. Script SHALL output a markdown table with one row per treatment (27 rows), columns: `ID`, `Name`, `Category`, `Price`, `Reachable` (yes/no -- from any question path), `whyMatch` (yes/no), `Symptom Scores` (count of symptom options that score it), `Addon For` (list of treatments that suggest it as addon), `Has Addons` (yes/no -- has its own addon suggestions), `Bundle` (bundle ID if part of one, or `--`), `Total Refs` (count across all sections).
2. Rows with `Reachable: no` SHALL be highlighted with `**UNREACHABLE**`.
3. Rows with `whyMatch: no` SHALL be highlighted with `**MISSING**`.
4. Rows with `Symptom Scores: 0` SHALL be highlighted with a note `(not in "help me decide")`.
5. Rows with `Has Addons: no` and category not `lab` or `weightLoss` SHALL be highlighted with `(no upsell)`.
6. Table SHALL be sorted by category, then by price descending.
7. SHALL include a summary section: total treatments, count reachable, count with whyMatch, count with symptom scoring, count with addon suggestions, count in bundles.
8. Output to `docs/wizard-coverage-dashboard.md` or stdout.

#### Acceptance Criteria

- AC1: Running against current config shows 27 rows with accurate data for each treatment.
- AC2: `myersGold` and `myersPlatinum` show `Symptom Scores: 0` with highlight.
- AC3: `revival` shows `Has Addons: no` with highlight.
- AC4: All 4 lab panels show `Has Addons: no`.
- AC5: Summary shows current gap counts matching known issues (7 treatments with no addons, 8 with no symptom scoring).
- AC6: After filling gaps (adding missing addon suggestions and symptom scores), re-running shows improved counts.

#### Technical Approach

Node.js script, no dependencies. Parse config. For each treatment ID, scan all 6 sections counting references. Build table rows. Sort and format as markdown. Summary = aggregation of column values. Can share scanning logic with Feature 1 (validation) and Feature 2 (coverage matrix).

---

### Feature 6: Automated Path Enumeration & Testing

#### Description

A script (`tools/enumerate-wizard-paths.js`) that performs BFS/DFS traversal of the question graph from `start`, enumerates every possible click-path, and verifies each terminates at a valid treatment. Serves as both documentation (human-readable path listing) and a regression test (CI check that catches unintended flow changes).

#### User Stories

1. As a QA tester, I want a list of every possible user journey through the wizard so I can verify coverage without manually clicking every path.
2. As a developer, I want a regression test that alerts me if a config change accidentally breaks or redirects an existing path.
3. As a product manager, I want to see how many steps each path takes so I can identify flows that are too long.

#### Detailed Requirements

**Path enumeration**

1. Starting from `questions.start`, DFS through every `options[].next` and `options[].recommend` recursively.
2. For each complete path (start to terminal `recommend`), output a human-readable trace: `Start > "I need relief" > Acute > "Hangover" → Hangover IV ($250) [2 steps]`.
3. Track and output total unique paths, grouped by starting option.
4. Report the deepest path (most steps) and shallowest path (fewest steps).

**Integrity checks**

5. Flag dead ends: any option with neither `next` nor `recommend`.
6. Flag broken links: `next` pointing to nonexistent question.
7. Flag broken recommendations: `recommend` pointing to nonexistent treatment/bundle.
8. Flag circular paths: detect cycles in `next` chains (A → B → C → A).
9. Resolve bundles: when `recommend` points to a bundle, resolve to the primary treatment and note it.
10. Handle the NAD+ 250 auto-bundle: if `autoBundle` (Feature 4) is implemented, resolve through it. Otherwise, note the hardcoded swap.

**Multi-select symptom path**

11. For the `symptoms` question (type: `multi`), enumerate representative combinations: each single symptom alone (10 paths), all symptoms selected (1 path), and the empty selection (should be blocked by UI).
12. For each combination, run the scoring algorithm and verify it produces at least 1 result with a valid treatment ID.
13. Verify no combination produces an empty result array.

**Snapshot testing**

14. Output the full path listing to `docs/wizard-paths.md`.
15. On subsequent runs, optionally diff against the previous snapshot and report added/removed/changed paths.
16. In CI, fail if paths changed unexpectedly (requires explicit snapshot update to accept changes).

#### Acceptance Criteria

- AC1: Running against current config enumerates all unique start-to-result paths (estimated 40-60 paths).
- AC2: Every path terminates at a valid treatment or bundle.
- AC3: No dead ends, broken links, or circular paths detected in current config.
- AC4: Removing an option's `recommend` field triggers a dead-end detection.
- AC5: All 10 single-symptom scoring runs produce at least 1 result.
- AC6: All-symptoms-selected run produces results without errors.
- AC7: Adding a new question option and re-running shows the new path in the diff.

#### Technical Approach

Node.js, no dependencies. Recursive DFS with path accumulator (array of `{questionId, optionLabel}` tuples). Cycle detection via visited-set per path (not global -- shared nodes like `myersUpgrade` are visited multiple times from different parents, which is valid). For symptom scoring: re-implement the scoring algorithm from `wizard.js:505-573` in the script (or `require()` the wizard module if it exports the function). Snapshot: write to `docs/wizard-paths.md`, read previous version for diff.

---

## 6. Phased Delivery Roadmap

### Phase 1: Foundation (read-only tooling + quick config wins)

**Ships:** Features 1, 2, 5 + immediate config gap fixes

No changes to wizard.js. All scripts are read-only analysis tools.

| Deliverable | Description |
|-------------|-------------|
| `tools/validate-wizard-config.js` | Config validation with errors + warnings |
| `tools/generate-wizard-flow.js` | Mermaid flowchart + coverage matrix |
| Coverage dashboard output | Treatment health-check table |
| `.husky/pre-commit` hook | Blocks commits with broken config |
| `.github/workflows/wizard-validate.yml` | CI gate on PRs |
| Config fix: addon suggestions | Add missing addon suggestions for revival, nad100, nad500, all labs, both GLP-1 programs |
| Config fix: symptom scoring | Add scoring weights for myersGold and myersPlatinum |

**Dependencies:** None. Can start immediately.
**Estimated complexity:** ~400 lines of JS across 2-3 scripts.

### Phase 2: Workflow (change management + testing)

**Ships:** Features 3, 6

Builds on Phase 1 (uses the validator). Still no changes to wizard.js.

| Deliverable | Description |
|-------------|-------------|
| `tools/wizard-add-treatment.js` | Checklist generator for new treatments |
| `tools/wizard-remove-treatment.js` | Reference finder for treatment removal |
| `tools/enumerate-wizard-paths.js` | Path enumeration + regression testing |
| `docs/how-to-manage-treatments.md` | Step-by-step treatment management guide |
| `docs/wizard-paths.md` | Snapshot of all wizard paths |
| CI path regression check | Fails on unexpected path changes |

**Dependencies:** Phase 1 (validation script exists for final-step verification).
**Estimated complexity:** ~500 lines of JS across 3 scripts + documentation.

### Phase 3: Architecture (JS refactor + config restructuring)

**Ships:** Feature 4 + optional config restructuring

This is the only phase that modifies `wizard.js`. Higher risk, requires comprehensive testing.

| Deliverable | Description |
|-------------|-------------|
| Config additions | `sessionRules`, `scoringRules`, `autoBundle`, `validCategories` |
| JS refactor | Replace 6 hardcoded values with config reads |
| Error handling | Replace silent Myers' fallback with visible error state |
| Optional: co-locate whyMatch | Move `whyMatch` text into treatment definitions |
| Optional: co-locate addonSuggestions | Move addon suggestions into treatment definitions |

**Dependencies:** Phase 2 (path enumeration provides before/after regression testing).
**Estimated complexity:** ~100 lines of config additions, ~50 lines of JS changes. Config restructuring (if done) is a larger migration.

---

## 7. Technical Architecture

```
project/
├── public/wizard-of-iv/
│   ├── wizard-config.json        ← the config (source of truth)
│   ├── wizard.js                 ← rendering engine (modified in Phase 3 only)
│   └── wizard.css
├── tools/
│   ├── validate-wizard-config.js ← Feature 1: validation
│   ├── generate-wizard-flow.js   ← Feature 2: visualization
│   ├── wizard-add-treatment.js   ← Feature 3: add helper
│   ├── wizard-remove-treatment.js← Feature 3: remove helper
│   └── enumerate-wizard-paths.js ← Feature 6: path testing
├── docs/
│   ├── wizard-flow.md            ← auto-generated Mermaid flowchart
│   ├── wizard-flow.mmd           ← raw Mermaid (for SVG/PNG export)
│   ├── wizard-coverage-matrix.md ← auto-generated coverage table
│   ├── wizard-coverage-dashboard.md ← treatment health check
│   ├── wizard-paths.md           ← path enumeration snapshot
│   └── how-to-manage-treatments.md ← treatment change guide
├── .husky/
│   └── pre-commit                ← runs validate-wizard-config.js
└── .github/workflows/
    └── wizard-validate.yml       ← CI: validate + path check
```

**Runtime:** Node.js, zero external dependencies. All scripts parse JSON and output text.

**CI integration:** GitHub Actions workflow triggers on PRs touching `public/wizard-of-iv/**`. Runs validation and path enumeration. Fails on errors or unexpected path changes.

**Pre-commit:** Husky hook runs validation on staged config changes. Fast (< 500ms).

---

## 8. Out of Scope

This PRD explicitly does **not** cover:

- Rewriting the wizard in React, Vue, or any framework
- Building a visual drag-and-drop flow editor GUI
- Changing the customer-facing wizard UX, design, or copy
- Acuity Scheduling integration changes
- Adding, removing, or repricing specific treatments (that's the Treatment Manager's job -- this PRD builds the tools they'll use)
- Analytics / GTM / GA4 event changes
- Mobile app or native implementations
- A/B testing infrastructure
- Multi-language or internationalization support

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 3 JS changes break the live wizard | Medium | High | Path enumeration (Phase 2) runs before and after as regression test. Deploy to staging first. Single-commit atomic deploys. |
| Config restructuring (moving whyMatch) requires config + JS changes atomically | Medium | High | Deploy as single commit. Maintain backward compatibility in JS (read from both old and new locations during transition). |
| Validation script false positives slow development | Low | Medium | Clear separation of errors (blocking) vs. warnings (non-blocking). Easy `--warnings-off` flag. |
| Team doesn't adopt new tooling | Medium | Medium | Integrate into existing workflow (git hooks, CI) rather than requiring separate tool invocation. Hooks run automatically. |
| Scripts become stale as config evolves | Low | Medium | Scripts read config dynamically -- no hardcoded treatment lists. New treatments/questions are automatically included. |
| Mermaid diagram too complex to read at 27+ treatments | Low | Low | Color coding + shared-node highlighting. Truncated labels. Collapsible sections if rendered as HTML. |

---

## 10. Appendices

### A. Current Treatment Catalog

| ID | Name | Price | Category |
|----|------|-------|----------|
| hydration | Hydration IV | $120 | iv |
| myers | Myers' Cocktail | $220 | iv |
| immunity | Immunity IV | $220 | iv |
| pregnancy | Pregnancy / Prenatal IV | $220 | iv |
| altitude | Altitude Sickness IV | $250 | iv |
| hangover | Hangover IV | $250 | iv |
| migraine | Migraine IV | $250 | iv |
| longevity | Longevity IV | $250 | iv |
| myersGold | Myers' Gold | $275 | iv |
| performance | Performance IV | $295 | iv |
| myersPlatinum | Myers' Platinum | $375 | iv |
| revival | Revival IV | $395 | iv |
| nad100 | NAD+ IV (100mg) | $100 | nad |
| nad250 | NAD+ IV (250mg) | $250 | nad |
| nad500 | NAD+ IV (500mg) | $400 | nad |
| semaglutide | Semaglutide (GLP-1) | from $199/mo | weightLoss |
| tirzepatide | Tirzepatide (GLP-1+GIP) | from $399/mo | weightLoss |
| b12Shot | B12 Injection | $35 | injection |
| biotinShot | Biotin Injection | $35 | injection |
| glutathioneShot | Glutathione Injection | $35 | injection |
| triImmuneShot | Tri-Immune Injection | $35 | injection |
| vitaminDShot | Vitamin D Injection | $35 | injection |
| lipoShots | Lipo-Mino Injections | $35 | injection |
| labGeneral | General Wellness Panel | $175 | lab |
| labInDepth | In-Depth Wellness Panel | $199 | lab |
| labVitamin | Vitamin Level Panel | $225 | lab |
| labComplete | Complete Wellness Panel | $449 | lab |

### B. Current Question Graph

| ID | Title | # Options | Routes to |
|----|-------|-----------|-----------|
| start | What brings you in today? | 6 | acute, wellness, weightLoss, labs, quickShot, symptoms |
| acute | What's going on? | 7 | hangover, migraine, immunity, dehydratedOrTired, altitude, jetLagMyers, revival |
| dehydratedOrTired | What best describes how you feel? | 2 | hydration, myersUpgrade |
| wellness | What's your wellness goal? | 9 | energy, beautyBundle, athleticGoal, antiAging, myersUpgrade, immunity, migraine, nadDose, pregnancy |
| energy | How long have you been feeling this way? | 3 | myersUpgrade, nadDose |
| athleticGoal | What's your focus? | 2 | performance, nadDose |
| antiAging | What's your approach to anti-aging? | 2 | longevity, nadDose |
| myersUpgrade | Which Myers' level fits you? | 4 | myers, myersGold, myersPlatinum, nadDose |
| nadDose | Which NAD+ dose is right for you? | 3 | nad100, nadPlusLabs, nad500 |
| weightLoss | Where are you in your weight loss journey? | 3 | glp1Choice, weightLossBoost, glp1Compare |
| glp1Choice | Which GLP-1 program fits your goals? | 3 | semaglutide, tirzepatide, glp1Compare |
| glp1Compare | Semaglutide vs. Tirzepatide | 3 | semaglutide, tirzepatide, weightLossConsult |
| weightLossBoost | What kind of support do you need? | 2 | lipoShots, myersUpgrade |
| labs | What kind of blood work do you need? | 4 | labGeneral, labInDepth, labVitamin, labComplete |
| quickShot | Which injection do you need? | 6 | b12Shot, glutathioneShot, triImmuneShot, vitaminDShot, biotinShot, lipoShots |
| symptoms | What resonates with you? (multi-select) | 10 | Weighted scoring → ranked results |

### C. Bundle Definitions

| ID | Name | Primary | Add-On | Interactive? |
|----|------|---------|--------|-------------|
| beautyBundle | Beauty Glow Package | myers ($220) | biotinShot (+$35) | Yes |
| nadPlusLabs | NAD+ IV + Vitamin Level Panel | nad250 ($250) | labVitamin (+$225) | Yes |
| jetLagMyers | Myers' Cocktail | myers ($220) | -- | N/A |
| weightLossConsult | Weight Loss Consultation | semaglutide | -- (shows phone #) | N/A |

### D. Config Section Reference

| Section | JSON Path | Contains | Treatment touch? |
|---------|-----------|----------|-----------------|
| Treatment definitions | `treatments.{id}` | name, price, category, acuityTypeId, ingredients, bestFor, shortDesc | Required per treatment |
| Question routing | `questions.{qId}.options[].recommend` / `.next` | Which treatments/questions each option leads to | At least 1 recommend needed |
| Symptom scoring | `questions.symptoms.options[].scores.{treatmentId}` | Weighted scores for multi-select matching | Optional (but invisible without) |
| Addressed-by text | `questions.symptoms.options[].addressedBy.{treatmentId}` | Why-match explanations per symptom | Optional |
| Clinical explanations | `whyMatch.{treatmentId}` | Long-form "why we matched you" text | Should exist |
| Bundles | `bundles.{bundleId}` | primary, addOn, addOnInteractive, whyMatch | Only if bundled |
| Addon suggestions | `questions.symptoms.symptomRules.addonSuggestions.{treatmentId}` | Array of injection IDs to suggest alongside | Optional (but no upsell without) |
