# Wizard of IV -- Management & Visibility Analysis

> How it is today vs. how it could be. What's hard, what's fragile, and what would make it manageable.

---

## The Core Problem

The wizard works well for users. The problem is for the person managing it. Right now:

- **You can't see what's going on.** The config is a 1,675-line JSON file. To understand "what happens if someone picks Wellness > Energy > A few weeks?" you have to manually trace through nested objects, jumping between `questions.wellness`, `questions.energy`, `questions.nadDose`, `bundles.nadPlusLabs`, and a hardcoded swap in the JS. There's no bird's-eye view.

- **You can't safely change things.** If you add a new treatment, you need to touch up to 6 different sections of the config (treatments, questions, whyMatch, bundles, addonSuggestions, symptom scores). If you remove one, you need to grep for every reference and hope you didn't miss any. There's no validation -- the system silently falls back to Myers' Cocktail if something is broken.

- **You can't tell if something is missing.** There's no way to see "this treatment exists but no user path ever reaches it" or "this question option points to a treatment that was deleted." You'd only discover these by manually clicking through every path in the live wizard.

---

## Part 1: What's Actually Fragile Today

### 1.1 Treatment references are scattered across 6 sections

When you add or modify a treatment, here's everywhere it might need to exist:

| Section | Purpose | Example |
|---------|---------|---------|
| `treatments.{id}` | The treatment definition (name, price, ingredients, bestFor) | Required |
| `questions.{q}.options[].recommend` | Which question options lead to this treatment | At least 1 needed |
| `questions.symptoms.options[].scores` | Symptom scoring weights for multi-select path | Optional |
| `questions.symptoms.options[].addressedBy` | "Why this matches" text per symptom | Optional |
| `whyMatch.{id}` | Clinical explanation shown on result screen | Should exist |
| `bundles.{id}` | If it's part of a combined offering | Only if bundled |
| `symptomRules.addonSuggestions` | Which injection add-ons to suggest alongside it | Optional |

**The problem:** There's no checklist, no schema, no validation. A treatment can exist in `treatments` but never appear in any question. A question can `recommend` an ID that doesn't exist in `treatments`. The system won't tell you.

### 1.2 Actual gaps found in the current config

| Issue | Details |
|-------|---------|
| **myersGold has no symptom scoring** | It appears in `myersUpgrade` as a direct recommendation, but the multi-select symptom path can never recommend it. If someone picks symptoms that should match a higher-tier Myers', they only see the standard Myers'. |
| **myersPlatinum has no symptom scoring** | Same issue. Only reachable via the Myers' Upgrade question, invisible to symptom matching. |
| **revival has no addon suggestions** | Despite being the most expensive IV ($395), no injection add-ons are suggested alongside it. |
| **nad100/nad500 have no addon suggestions** | Only nad250 (via the bundle) gets upsell treatment. The other NAD tiers show nothing. |
| **No addon suggestions for any lab panel** | A user who books a $175 lab panel never sees "while we're there, add a B12 shot." |
| **No addon suggestions for weight loss programs** | Semaglutide/Tirzepatide result screens show no complementary offerings. |
| **maxTotalResults config value is ignored** | Config says `maxTotalResults: 3` but the JS hardcodes `.slice(0, 3)`. Changing the config number does nothing. |

### 1.3 Hidden logic in the JavaScript

These behaviors are NOT visible in the config. You'd only know about them by reading the JS:

| Behavior | Location | Risk |
|----------|----------|------|
| **NAD+ 250 is always auto-bundled with Vitamin Lab Panel** | `wizard.js:707-709` | Can't offer standalone NAD+ 250. Changing this requires a code deploy, not a config change. |
| **Category strings drive scoring buckets** | `wizard.js:561-567` | Adding a new category (e.g., "cosmetic") requires JS changes. Typo in a category value silently breaks filtering. |
| **Max 3 injections per session** | `wizard.js:1358-1365` | Business rule buried in code, not in config. |
| **Only 1 primary (non-injection) per session** | `wizard.js:1343-1355` | Same -- invisible business rule. |
| **Unknown treatment IDs silently default to Myers'** | `wizard.js:689-699` | If you mistype a treatment ID in config, the wizard just shows Myers' with no error. |
| **Unknown question IDs cause silent navigation failure** | `wizard.js:494-498` | If a `next` field points to a nonexistent question, nothing happens. No error, no fallback. |

### 1.4 Treatment reference counts (how coupled is each one?)

High-touch treatments require changes in many places if modified:

| Treatment | Total references | Direct recommend? | In symptom scores? | In addon suggestions? | In a bundle? |
|-----------|-----------------|-------------------|--------------------|-----------------------|-------------|
| myers | 16 | Yes | Yes (6 symptoms) | Yes (as primary) | Yes (beautyBundle, jetLagMyers) |
| nad250 | 9 | No (only via bundle) | Yes (4 symptoms) | N/A | Yes (nadPlusLabs primary) |
| b12Shot | 8 | Yes | Yes (1 symptom) | Yes (suggested for 4 treatments) | No |
| labVitamin | 6 | Yes | Yes (2 symptoms) | N/A | Yes (nadPlusLabs addon) |
| semaglutide | 6 | Yes | Yes (1 symptom) | No | Yes (weightLossConsult) |
| immunity | 5 | Yes | Yes (1 symptom) | No (but HAS suggestions) | No |
| hangover | 2 | Yes | No | No (but HAS suggestions) | No |
| myersGold | 2 | Yes | No | No | No |
| myersPlatinum | 2 | Yes | No | No | No |

**Key insight:** Renaming `nad250` would require touching 9+ locations across config AND the hardcoded JS swap. Renaming `hangover` would require touching 2 locations. The coupling is uneven.

---

## Part 2: What "Good" Looks Like

### 2.1 Visibility: See what's going on at a glance

**Current state:** You have to read 1,675 lines of JSON and mentally trace connections.

**What would help:**

#### A. Auto-generated flow diagram

A script that reads `wizard-config.json` and outputs a Mermaid/Graphviz flowchart. Run it anytime the config changes to see the current state. This already exists in the workflow map doc as a hand-authored Mermaid chart, but it goes stale the moment someone edits the config.

```
Approach: Node.js script that:
1. Reads wizard-config.json
2. Walks the question graph (start → every next/recommend)
3. Outputs Mermaid syntax
4. Can be run as: node tools/wizard-flow.js > flow.md

Effort: ~100 lines of JS. Could be a pre-commit hook or CI step.
```

#### B. Treatment coverage matrix

An auto-generated table showing every treatment and where it appears. "Does this treatment have a whyMatch? Is it reachable from any question? Does it have symptom scores? Add-on suggestions?"

```
Approach: Same script reads config, cross-references all sections,
outputs a coverage table highlighting gaps.

Example output:
  Treatment       | Reachable | Symptoms | whyMatch | Addons
  myersPlatinum   |    ✓      |    ✗     |    ✓     |   ✗    ← gap
  nad100          |    ✓      |    ✓     |    ✓     |   ✗    ← gap
```

#### C. Path enumeration

A script that walks every possible path through the wizard and lists them:

```
Start > "I need relief" > Acute > "Hangover" → Hangover IV ($250) [2 steps]
Start > "I need relief" > Acute > "Dehydrated" > DehydratedOrTired > "Exhausted" > MyersUpgrade > "Standard" → Myers' ($220) [4 steps]
...
```

This lets you scan every user journey in one list. You'd immediately see if a path is broken, too long, or leads somewhere unexpected.

### 2.2 Integrity: Catch problems before they go live

**Current state:** Break something in the config, deploy it, and the wizard silently shows Myers' Cocktail as a fallback. You might not notice for weeks.

**What would help:**

#### A. JSON Schema validation

Define a schema for `wizard-config.json` that enforces:

- Every `recommend` value must be a key in `treatments` or `bundles`
- Every `next` value must be a key in `questions`
- Every bundle's `primary` and `addOn` must be keys in `treatments`
- Every treatment must have: name, price, category, acuityTypeId, bestFor, shortDesc
- Every `addonSuggestions` value must reference treatments with `category: "injection"`
- Every symptom `scores` key must be a valid treatment ID
- Every `addressedBy` key must also exist in that symptom's `scores`

```
Approach: JSON Schema (draft-07) or a simple Node.js validation script.
Run as: node tools/validate-wizard.js
Exit code 1 on failure → can be a CI gate or pre-commit hook.

Effort: ~150-200 lines for the validator.
```

#### B. Reachability check

After schema validation, walk the question graph from `start` and flag:

- **Unreachable treatments:** Defined in `treatments` but no question path ever recommends them
- **Dead-end questions:** Questions that exist but no other question's `next` field points to them (and they're not `start`)
- **Orphaned whyMatch entries:** Keys in `whyMatch` that don't correspond to any treatment or bundle

#### C. Completeness warnings (non-blocking)

Not errors, but things worth knowing:

- "Treatment X has no whyMatch text -- result screen will show empty explanation"
- "Treatment X is reachable but has no symptom scoring -- invisible to 'help me decide' path"
- "Treatment X has no addon suggestions -- no upsell opportunity on result screen"
- "Bundle X's addon has `addOnInteractive: false` -- user can't opt in/out"

### 2.3 Change management: Add/remove a service without missing things

**Current state:** Adding a treatment means editing 3-6 different sections of the same JSON file and hoping you remember them all.

**What would help:**

#### A. A treatment checklist generator

```
$ node tools/wizard-add-treatment.js --id "newTreatment"

Adding "newTreatment" — here's what you need to fill in:

✗ treatments.newTreatment — REQUIRED (name, price, category, acuityTypeId, etc.)
✗ whyMatch.newTreatment — RECOMMENDED (clinical explanation for result screen)
✗ Question path — REQUIRED (add to at least one question's options)
  Possible locations:
    - questions.acute (if it's an acute relief IV)
    - questions.wellness (if it's a wellness goal)
    - questions.quickShot (if it's a $35 injection)
    - questions.labs (if it's a lab panel)
✗ Symptom scoring — OPTIONAL (add scores to questions.symptoms for multi-select)
✗ Addon suggestions — OPTIONAL (if other treatments should suggest this as an add-on)
✗ Bundle — ONLY IF this should auto-pair with another treatment

Run `node tools/validate-wizard.js` when done to verify.
```

For removals:

```
$ node tools/wizard-remove-treatment.js --id "myersPlatinum"

Removing "myersPlatinum" — found 2 references:

  wizard-config.json:
    - questions.myersUpgrade.options[2].recommend: "myersPlatinum"
    - whyMatch.myersPlatinum

  wizard.js:
    - No hardcoded references found ✓

You need to:
  1. Remove treatments.myersPlatinum
  2. Remove or redirect questions.myersUpgrade.options[2]
  3. Remove whyMatch.myersPlatinum
```

#### B. Move business rules from JS to config

The biggest pain point for change management is behavior that lives in JS instead of config. Moving these to config means non-developers can change them:

| Rule | Currently | Could be in config |
|------|-----------|-------------------|
| NAD+ 250 auto-bundles with lab panel | Hardcoded JS swap | `treatments.nad250.autoBundle: "nadPlusLabs"` |
| Max 3 injections per session | Hardcoded in JS | `sessionRules.maxInjections: 3` |
| Max 1 primary per session | Hardcoded in JS | `sessionRules.maxPrimary: 1` |
| Top 3 IV/NAD results in scoring | Hardcoded `.slice(0, 3)` | Actually use existing `maxTotalResults: 3` from config |
| Category groupings for scoring | Hardcoded category checks | `categoryGroups: { results: ["iv","nad"], programs: ["weightLoss"], addons: ["injection","lab"] }` |
| Valid category values | Implicit | `validCategories: ["iv","nad","weightLoss","injection","lab"]` |

#### C. Single source of truth for treatment metadata

Right now, a treatment's information is split across:
- `treatments.{id}` -- name, price, ingredients, bestFor
- `whyMatch.{id}` -- clinical explanation
- Various `questions` -- where it appears in the flow
- `bundles` -- if it's bundled
- `addonSuggestions` -- if it's suggested alongside other treatments

A restructured config could co-locate more of this:

```json
{
  "treatments": {
    "hangover": {
      "name": "Hangover IV",
      "price": 250,
      "category": "iv",
      "whyMatch": "Alcohol depletes B vitamins...",
      "suggestedAddons": ["b12Shot"],
      "ingredients": [...],
      "bestFor": [...]
    }
  }
}
```

This moves `whyMatch` and `suggestedAddons` into the treatment definition itself, so when you add a treatment you fill in everything in one place. The downside is the config structure changes, requiring a JS update -- but it's a one-time migration.

---

## Part 3: Recommended Approach (Practical, Not a Rewrite)

### Priority 1: Validation script (catch problems before deploy)

**What:** A single `tools/validate-wizard-config.js` script that reads the config and reports errors and warnings.

**Why first:** This is the highest-value, lowest-effort change. It catches broken references, missing whyMatch, unreachable treatments, and orphaned questions. You run it before deploying and know immediately if something is wrong.

**Catches:**
- Typos in treatment IDs
- Removed treatments still referenced in questions
- New treatments with no path to reach them
- Missing whyMatch entries
- Symptom scores referencing non-existent treatments
- Bundle primary/addOn pointing to deleted treatments

### Priority 2: Auto-generated flow visualization

**What:** A script that reads the config and outputs a Mermaid flowchart (like the one in the workflow map doc, but always in sync with the actual config).

**Why second:** The hand-authored Mermaid chart is useful but goes stale. An auto-generated one means you always see the real state. You can run it after any config change and immediately see the impact.

**Concrete approach:**

```js
// tools/generate-wizard-flow.js  (~50 lines)
const config = require('../public/wizard-of-iv/wizard-config.json');
let lines = ['flowchart TD'];

for (const [qid, q] of Object.entries(config.questions)) {
  const label = q.title.replace(/"/g, "'");
  lines.push(`  ${qid}["${label}"]`);

  q.options.forEach((opt) => {
    const optLabel = opt.label.replace(/"/g, "'").substring(0, 40);
    if (opt.next) {
      lines.push(`  ${qid} -->|"${optLabel}"| ${opt.next}`);
    }
    if (opt.recommend) {
      const tName = (config.treatments[opt.recommend]?.name
        || config.bundles[opt.recommend]?.name
        || opt.recommend);
      lines.push(`  ${qid} -->|"${optLabel}"| ${opt.recommend}(("${tName}"))`);
    }
  });
}
console.log(lines.join('\n'));
// Run: node tools/generate-wizard-flow.js > FLOW.md
```

GitHub renders Mermaid natively in `.md` files -- zero additional tooling needed. The [mermaid.live](https://mermaid.live) editor works for interactive exploration.

**Could also generate:** The treatment coverage matrix, path enumeration, and a "what changed" diff between two config versions.

**Alternative visualization options:**
- **Graphviz/DOT** -- more layout control for large graphs, renders via [graphvizonline.net](https://graphvizonline.net/)
- **D3.js collapsible tree** -- interactive HTML page where you expand/collapse branches (see [d3-hierarchy](https://d3js.org/d3-hierarchy/tree)). Best for exploration but requires more setup.

### Priority 3: Move hardcoded rules to config

**What:** Move the NAD+ 250 auto-bundle, max injection count, category groupings, and max results into the config.

**Why third:** This makes the system fully config-driven. Anyone who can edit JSON can change business rules without a code deploy. But it requires careful JS changes and testing, so it's higher effort.

### Priority 4 (optional): Config restructuring

**What:** Co-locate whyMatch, addonSuggestions, and symptom scoring into treatment definitions.

**Why optional:** This is the most disruptive change. It makes the config easier to manage long-term but requires rewriting both the config structure and the JS that reads it. Only worth doing if the wizard is actively growing (adding many new treatments regularly).

The biggest single-step improvement here: move `whyMatch` text into each treatment object directly (instead of a separate top-level `whyMatch` section). This eliminates one reference surface entirely and means when you add a treatment, you fill in its clinical explanation in the same place you define its name, price, and ingredients.

---

## Part 4: Quick Wins You Can Do Right Now

Without building any tooling, you can immediately:

1. **Add addon suggestions to the treatments that are missing them:**
   - `revival` → suggest `[b12Shot, glutathioneShot]`
   - `nad100` → suggest `[b12Shot]`
   - `nad500` → suggest `[glutathioneShot]`
   - `labGeneral` / `labInDepth` / `labVitamin` / `labComplete` → suggest `[b12Shot, vitaminDShot]`
   - `semaglutide` / `tirzepatide` → suggest `[lipoShots, b12Shot]`

2. **Add symptom scoring for Myers' Gold and Platinum** so the multi-select path can recommend them (currently they're invisible to that path).

3. **Keep the Mermaid flowchart in the workflow-map doc in sync** when you change the config. (Or build the auto-generator to replace it.)

---

## Part 5: Useful Tools & References

| Tool | What it does | Link |
|------|-------------|------|
| **Ajv** | JSON Schema validator for Node.js -- validate config structure | [ajv.js.org](https://ajv.js.org/) |
| **ajv-cli** | Command-line wrapper for Ajv -- run schema checks from terminal/CI | [ajv.js.org/packages/ajv-cli](https://ajv.js.org/packages/ajv-cli.html) |
| **Husky** | Git hooks manager -- run validators on pre-commit | [typicode.github.io/husky](https://typicode.github.io/husky/) |
| **check-jsonschema** | Pre-commit hook for JSON schema validation (Python) | [github.com/python-jsonschema/check-jsonschema](https://github.com/python-jsonschema/check-jsonschema) |
| **Mermaid Live** | Interactive Mermaid diagram editor | [mermaid.live](https://mermaid.live/) |
| **XState @xstate/test** | State machine model-based testing -- auto-generates test paths | [stately.ai/docs/xstate-test](https://stately.ai/docs/xstate-test) |

---

## Summary Table

| Concern | Current state | Ideal state | Effort |
|---------|--------------|-------------|--------|
| **See what's going on** | Read 1,675 lines of JSON | Auto-generated flowchart + coverage matrix | Medium (~50-line script) |
| **Catch broken refs** | Silent fallback to Myers' | Validation script with errors/warnings | Low (~150-line script) |
| **Add a treatment** | Remember 6 sections manually | Checklist generator + validator | Low-Medium |
| **Remove a treatment** | Grep and hope | Reference finder + validator | Low-Medium |
| **Change business rules** | Edit JS, redeploy | Edit config JSON | Medium (one-time JS refactor) |
| **See addon/upsell coverage** | Manual inspection | Coverage matrix highlights gaps | Low (part of validator) |
| **Confirm every path works** | Click through wizard manually | Path enumeration script | Low-Medium |
| **Prevent broken deploys** | Hope and manual QA | Pre-commit hook + CI gate | Low (Husky + validator) |
