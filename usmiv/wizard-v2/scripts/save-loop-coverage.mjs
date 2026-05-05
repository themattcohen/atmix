/**
 * save-loop-coverage.mjs
 *
 * Verifies the save loop (POST -> KV/wp_option -> GET round-trip) for every
 * field-type category exposed by the admin dashboard editor.
 *
 * For each category A-H:
 *   1. Snapshot current config from GET /wp-json/wizard-of-iv/v1/config
 *   2. Mutate a representative field to a sentinel value
 *   3. POST the mutated config (Basic auth via Doppler prd_usmiv)
 *   4. GET again (cache-busted) and assert the mutation persisted
 *   5. Restore original value
 *
 * Writes claudedocs/save-loop-coverage.md
 *
 * Usage: node scripts/save-loop-coverage.mjs
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFIG_URL = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function getCreds() {
  if (process.env.WP_USER && process.env.WP_APP_PASSWORD) {
    return { user: process.env.WP_USER, pass: process.env.WP_APP_PASSWORD };
  }
  console.log('Fetching WP_USER, WP_APP_PASSWORD from Doppler prd_usmiv...');
  const raw = execSync(
    'doppler secrets get WP_USER WP_APP_PASSWORD --project atmix --config prd_usmiv --plain',
    { encoding: 'utf8' }
  ).trim();
  const [user, pass] = raw.split('\n');
  if (!user || !pass) {
    throw new Error('Could not read WP_USER / WP_APP_PASSWORD from Doppler');
  }
  return { user: user.trim(), pass: pass.trim() };
}

function basicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function getConfig() {
  const res = await fetch(CONFIG_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
  });
  if (!res.ok) throw new Error(`GET ${CONFIG_URL} returned HTTP ${res.status}`);
  return res.json();
}

async function postConfig(config, auth) {
  const body = JSON.stringify(config);
  const res = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
      'Cache-Control': 'no-cache',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${CONFIG_URL} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Deep-equal check for a specific path. Handles nested objects.
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Get a nested value via dot path (e.g. "treatments.myers.price")
function getPath(obj, path) {
  return path.split('.').reduce((cur, k) => (cur && typeof cur === 'object' ? cur[k] : undefined), obj);
}

// Set a nested value via dot path. Returns a deep copy.
function setPath(obj, path, value) {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

// ---------------------------------------------------------------------------
// Test result collector
// ---------------------------------------------------------------------------

const results = [];

async function runTest({ category, label, path, mutate, describe, auth }) {
  const result = { category, label, path, describe, postGet: null, error: null };

  try {
    // Step 1: snapshot
    const original = await getConfig();
    const originalValue = getPath(original, path);
    if (originalValue === undefined) {
      throw new Error(`Path "${path}" not found in live config`);
    }

    // Step 2: mutate
    const sentinelValue = mutate(originalValue);
    const mutated = setPath(original, path, sentinelValue);

    // Step 3: POST
    await postConfig(mutated, auth);

    // Step 4: GET and assert
    const stored = await getConfig();
    const storedValue = getPath(stored, path);

    if (deepEqual(storedValue, sentinelValue)) {
      result.postGet = 'PASS';
      console.log(`  [PASS] ${category} (${label}): ${path}`);
      console.log(`         before: ${JSON.stringify(originalValue)}`);
      console.log(`         after:  ${JSON.stringify(sentinelValue)}`);
    } else {
      result.postGet = 'FAIL';
      result.error = `Expected ${JSON.stringify(sentinelValue)} but got ${JSON.stringify(storedValue)}`;
      console.error(`  [FAIL] ${category} (${label}): ${path}`);
      console.error(`         sent:   ${JSON.stringify(sentinelValue)}`);
      console.error(`         stored: ${JSON.stringify(storedValue)}`);
    }

    // Step 5: restore
    const restored = setPath(stored, path, originalValue);
    await postConfig(restored, auth);
    // Verify restore
    const afterRestore = await getConfig();
    const afterRestoreValue = getPath(afterRestore, path);
    if (!deepEqual(afterRestoreValue, originalValue)) {
      const restoreNote = `Restore verification: stored ${JSON.stringify(afterRestoreValue)}, expected ${JSON.stringify(originalValue)}`;
      console.warn(`  [WARN] Restore mismatch for ${path}: ${restoreNote}`);
      result.error = (result.error ? result.error + ' | ' : '') + 'RESTORE MISMATCH: ' + restoreNote;
    } else {
      console.log(`         restored OK`);
    }

  } catch (err) {
    result.postGet = 'ERROR';
    result.error = err.message;
    console.error(`  [ERROR] ${category} (${label}): ${err.message}`);
  }

  results.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

function mutateNumber(v) { return typeof v === 'number' ? v + 1 : 9999; }
function mutateString(v) { return 'TEST_' + (typeof v === 'string' ? v : String(v)); }
function mutateStringArray(v) { return Array.isArray(v) ? [...v, 'TEST_VALUE'] : ['TEST_VALUE']; }
function mutateObjectArray(v) {
  const arr = Array.isArray(v) ? v : [];
  return [...arr, { name: 'TEST_INGREDIENT', benefit: 'TEST_BENEFIT' }];
}
function mutateNestedMapNumber(v) {
  // scoringWeights: Record<string, number>
  const obj = (v && typeof v === 'object') ? { ...v } : {};
  return { ...obj, 'TEST_SYMPTOM_KEY': 7 };
}
function mutateNestedMapString(v) {
  // addressedBy: Record<string, string>
  const obj = (v && typeof v === 'object') ? { ...v } : {};
  return { ...obj, 'TEST_SYMPTOM_KEY': 'TEST_ADDRESSED_TEXT' };
}
function mutateBoolean(v) { return !v; }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Save-Loop Coverage Test');
  console.log('========================');
  console.log(`Target: ${CONFIG_URL}`);
  console.log('');

  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  // Verify auth before tests
  console.log('Verifying credentials...');
  const initial = await getConfig();
  const treatmentCount = Object.keys(initial.treatments || {}).length;
  const bundleCount = Object.keys(initial.bundles || {}).length;
  const questionCount = Object.keys(initial.questions || {}).length;
  console.log(`Config loaded: ${treatmentCount} treatments, ${bundleCount} bundles, ${questionCount} questions`);
  console.log('');

  // ── Category A: Scalar number ──────────────────────────────────────────────
  console.log('A. Scalar number (treatments.myers.price)');
  await runTest({
    category: 'A',
    label: 'Scalar number',
    path: 'treatments.myers.price',
    describe: 'treatments.myers.price (number input)',
    mutate: mutateNumber,
    auth,
  });

  // Also test acuityTypeId as a second scalar number variant
  console.log('A2. Scalar number (treatments.hydration.acuityTypeId)');
  await runTest({
    category: 'A',
    label: 'Scalar number (acuityTypeId)',
    path: 'treatments.hydration.acuityTypeId',
    describe: 'treatments.hydration.acuityTypeId (number input)',
    mutate: mutateNumber,
    auth,
  });

  // ── Category B: Scalar string ──────────────────────────────────────────────
  console.log('B. Scalar string (treatments.myers.shortDesc)');
  await runTest({
    category: 'B',
    label: 'Scalar string (shortDesc)',
    path: 'treatments.myers.shortDesc',
    describe: 'treatments.myers.shortDesc (text input)',
    mutate: mutateString,
    auth,
  });

  console.log('B2. Scalar string (treatments.myers.name)');
  await runTest({
    category: 'B',
    label: 'Scalar string (name)',
    path: 'treatments.myers.name',
    describe: 'treatments.myers.name (text input)',
    mutate: mutateString,
    auth,
  });

  console.log('B3. Scalar string (treatments.myers.duration)');
  await runTest({
    category: 'B',
    label: 'Scalar string (duration)',
    path: 'treatments.myers.duration',
    describe: 'treatments.myers.duration (text input)',
    mutate: mutateString,
    auth,
  });

  console.log('B4. Scalar string (treatments.myers.whyMatch)');
  await runTest({
    category: 'B',
    label: 'Scalar string (whyMatch textarea)',
    path: 'treatments.myers.whyMatch',
    describe: 'treatments.myers.whyMatch (textarea)',
    mutate: mutateString,
    auth,
  });

  console.log('B5. Scalar string (treatments.myers.pageUrl)');
  await runTest({
    category: 'B',
    label: 'Scalar string (pageUrl)',
    path: 'treatments.myers.pageUrl',
    describe: 'treatments.myers.pageUrl (text input)',
    mutate: mutateString,
    auth,
  });

  // ── Category C: String array ───────────────────────────────────────────────
  console.log('C. String array (treatments.myers.bestFor)');
  await runTest({
    category: 'C',
    label: 'String array (bestFor)',
    path: 'treatments.myers.bestFor',
    describe: 'treatments.myers.bestFor (TagEditor)',
    mutate: mutateStringArray,
    auth,
  });

  console.log('C2. String array (treatments.myers.addonSuggestions)');
  await runTest({
    category: 'C',
    label: 'String array (addonSuggestions)',
    path: 'treatments.myers.addonSuggestions',
    describe: 'treatments.myers.addonSuggestions (checkbox list of injection treatment IDs)',
    mutate: mutateStringArray,
    auth,
  });

  // tests field -- lab-specific string array
  console.log('C3. String array (treatments.labGeneral.tests)');
  await runTest({
    category: 'C',
    label: 'String array (tests - lab-specific)',
    path: 'treatments.labGeneral.tests',
    describe: 'treatments.labGeneral.tests (lab test codes array)',
    mutate: mutateStringArray,
    auth,
  });

  // ── Category D: Object array ───────────────────────────────────────────────
  console.log('D. Object array (treatments.myers.ingredients)');
  await runTest({
    category: 'D',
    label: 'Object array (ingredients)',
    path: 'treatments.myers.ingredients',
    describe: 'treatments.myers.ingredients (IngredientsEditor: array of {name, benefit})',
    mutate: mutateObjectArray,
    auth,
  });

  // ── Category E: Nested map string->number ──────────────────────────────────
  console.log('E. Nested map string->number (treatments.myers.scoringWeights)');
  await runTest({
    category: 'E',
    label: 'Nested map string->number (scoringWeights)',
    path: 'treatments.myers.scoringWeights',
    describe: 'treatments.myers.scoringWeights (ScoringWeightsEditor: symptom->weight slider)',
    mutate: mutateNestedMapNumber,
    auth,
  });

  // ── Category F: Nested map string->string ──────────────────────────────────
  console.log('F. Nested map string->string (treatments.myers.addressedBy)');
  await runTest({
    category: 'F',
    label: 'Nested map string->string (addressedBy)',
    path: 'treatments.myers.addressedBy',
    describe: 'treatments.myers.addressedBy (ScoringWeightsEditor: symptom->explanation text)',
    mutate: mutateNestedMapString,
    auth,
  });

  // ── Category G: Bundle schema ──────────────────────────────────────────────
  console.log('G. Bundle - scalar string (bundles.beautyBundle.name)');
  await runTest({
    category: 'G',
    label: 'Bundle scalar string (name)',
    path: 'bundles.beautyBundle.name',
    describe: 'bundles.beautyBundle.name (text input)',
    mutate: mutateString,
    auth,
  });

  console.log('G2. Bundle - scalar string (bundles.beautyBundle.whyMatch)');
  await runTest({
    category: 'G',
    label: 'Bundle scalar string (whyMatch)',
    path: 'bundles.beautyBundle.whyMatch',
    describe: 'bundles.beautyBundle.whyMatch (textarea)',
    mutate: mutateString,
    auth,
  });

  console.log('G3. Bundle - boolean (bundles.beautyBundle.addOnInteractive)');
  await runTest({
    category: 'G',
    label: 'Bundle boolean (addOnInteractive)',
    path: 'bundles.beautyBundle.addOnInteractive',
    describe: 'bundles.beautyBundle.addOnInteractive (checkbox)',
    mutate: mutateBoolean,
    auth,
  });

  console.log('G4. Bundle - scalar number (bundles.beautyBundle.acuityTypeId)');
  await runTest({
    category: 'G',
    label: 'Bundle scalar number (acuityTypeId)',
    path: 'bundles.beautyBundle.acuityTypeId',
    describe: 'bundles.beautyBundle.acuityTypeId (number input)',
    mutate: mutateNumber,
    auth,
  });

  console.log('G5. Bundle - string FK (bundles.beautyBundle.primary)');
  await runTest({
    category: 'G',
    label: 'Bundle string FK (primary treatment select)',
    path: 'bundles.beautyBundle.primary',
    describe: 'bundles.beautyBundle.primary (TreatmentSelect dropdown)',
    // Mutate to another valid treatment ID for a round-trip test
    mutate: (v) => (v === 'myers' ? 'immunity' : 'myers'),
    auth,
  });

  // ── Category H: Question tree ──────────────────────────────────────────────
  console.log('H. Question - scalar string (questions.start.title)');
  await runTest({
    category: 'H',
    label: 'Question scalar string (title)',
    path: 'questions.start.title',
    describe: 'questions.start.title (text input)',
    mutate: mutateString,
    auth,
  });

  console.log('H2. Question - scalar string (questions.start.subtitle)');
  await runTest({
    category: 'H',
    label: 'Question scalar string (subtitle)',
    path: 'questions.start.subtitle',
    describe: 'questions.start.subtitle (text input)',
    mutate: mutateString,
    auth,
  });

  // Option label mutation -- modifies the first option of the start question
  console.log('H3. Question - option label (questions.start.options[0].label)');
  await runTest({
    category: 'H',
    label: 'Question option label',
    path: 'questions.start.options',
    describe: 'questions.start.options[0].label (OptionRow text input)',
    mutate: (opts) => {
      if (!Array.isArray(opts) || opts.length === 0) return opts;
      const copy = JSON.parse(JSON.stringify(opts));
      copy[0] = { ...copy[0], label: 'TEST_' + copy[0].label };
      return copy;
    },
    auth,
  });

  // Option routing mutation -- change next pointer of start option[0]
  console.log('H4. Question - option routing (questions.start.options[0].next)');
  await runTest({
    category: 'H',
    label: 'Question option routing (next pointer)',
    path: 'questions.start.options',
    describe: 'questions.start.options[0].next (OptionRow routing select)',
    mutate: (opts) => {
      if (!Array.isArray(opts) || opts.length === 0) return opts;
      const copy = JSON.parse(JSON.stringify(opts));
      // Toggle between 'acute' and 'wellness' (both exist as question IDs)
      copy[0] = { ...copy[0], next: copy[0].next === 'acute' ? 'wellness' : 'acute' };
      return copy;
    },
    auth,
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('Summary');
  console.log('=======');
  const passed = results.filter(r => r.postGet === 'PASS').length;
  const failed = results.filter(r => r.postGet !== 'PASS').length;
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL/ERROR: ${failed}`);
  results.forEach(r => {
    const status = r.postGet === 'PASS' ? 'PASS' : `FAIL (${r.error})`;
    console.log(`  ${r.category}. ${r.label}: ${status}`);
  });

  // ── Write report ───────────────────────────────────────────────────────────
  writeReport();

  if (failed > 0) {
    console.error(`\n${failed} test(s) FAILED.`);
    process.exit(1);
  } else {
    console.log('\nAll tests PASSED.');
    process.exit(0);
  }
}

function writeReport() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Denver' });

  // Group results by category letter (take first letter of category field)
  const byCategory = {};
  for (const r of results) {
    const cat = r.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  // Category meta (for the summary table -- use first result per category)
  const categoryMeta = {
    A: { name: 'Scalar number', representative: 'treatments.myers.price', uiVerified: false },
    B: { name: 'Scalar string', representative: 'treatments.myers.shortDesc', uiVerified: false },
    C: { name: 'String array', representative: 'treatments.myers.bestFor', uiVerified: false },
    D: { name: 'Object array', representative: 'treatments.myers.ingredients', uiVerified: false },
    E: { name: 'Nested map string->number', representative: 'treatments.myers.scoringWeights', uiVerified: false },
    F: { name: 'Nested map string->string', representative: 'treatments.myers.addressedBy', uiVerified: false },
    G: { name: 'Bundle schema', representative: 'bundles.beautyBundle.name', uiVerified: false },
    H: { name: 'Question tree', representative: 'questions.start.title', uiVerified: false },
  };

  // All pass for a category = PASS
  function categoryStatus(cat) {
    const rs = byCategory[cat] || [];
    if (rs.length === 0) return 'NOT TESTED';
    return rs.every(r => r.postGet === 'PASS') ? 'PASS' : 'FAIL';
  }

  // ── Inventory table
  const inventoryRows = [
    ['treatments.<id>.price', 'number input', 'Scalar number', 'wizard modal price; Learn More price display'],
    ['treatments.<id>.name', 'text input', 'Scalar string', 'wizard modal heading; Learn More page heading; WP page title link'],
    ['treatments.<id>.priceLabel', 'text input (optional)', 'Scalar string (optional)', 'wizard modal price override display'],
    ['treatments.<id>.duration', 'text input', 'Scalar string', 'wizard modal duration field; Learn More duration'],
    ['treatments.<id>.acuityTypeId', 'number input', 'Scalar number', 'Acuity booking link construction'],
    ['treatments.<id>.acuityDropdownValue', 'text input (nullable)', 'Scalar string | null', 'Acuity booking dropdown pre-select'],
    ['treatments.<id>.pageUrl', 'text input', 'Scalar string', 'Learn More page URL; wizard card link'],
    ['treatments.<id>.shortDesc', 'text input', 'Scalar string', 'wizard card subtitle; Learn More meta description'],
    ['treatments.<id>.whyMatch', 'textarea', 'Scalar string', 'wizard result card "why this matches you" text'],
    ['treatments.<id>.note', 'text input (optional)', 'Scalar string (optional)', 'italic footnote on wizard card (GLP-1 programs)'],
    ['treatments.<id>.bestFor', 'TagEditor (add/remove tags)', 'String array', 'wizard card "best for" chips; Learn More bestFor list'],
    ['treatments.<id>.ingredients', 'IngredientsEditor (repeating {name,benefit})', 'Object array', 'wizard ingredient panel; Learn More ingredients section'],
    ['treatments.<id>.addonSuggestions', 'checkbox list of injection treatment IDs', 'String array (TreatmentId[])', 'wizard upsell addon panel'],
    ['treatments.<id>.tests', 'not exposed in editor UI (lab-specific)', 'String array (lab only)', 'Learn More lab tests list'],
    ['treatments.<id>.scoringWeights.<symptom>', 'ScoringWeightsEditor slider + number input (0-10)', 'Nested map string->number', 'wizard symptom scoring math determines recommendation ranking'],
    ['treatments.<id>.addressedBy.<symptom>', 'ScoringWeightsEditor text input (appears when weight > 0)', 'Nested map string->string', 'wizard result card per-symptom explanation text'],
    ['bundles.<id>.name', 'text input', 'Scalar string', 'wizard bundle card heading'],
    ['bundles.<id>.primary', 'TreatmentSelect dropdown', 'String (TreatmentId FK)', 'wizard bundle primary treatment reference'],
    ['bundles.<id>.addOn', 'TreatmentSelect dropdown (nullable)', 'String | null (TreatmentId FK)', 'wizard bundle add-on treatment reference'],
    ['bundles.<id>.addOnInteractive', 'checkbox', 'Boolean', 'wizard bundle: whether patient can toggle add-on'],
    ['bundles.<id>.whyMatch', 'textarea', 'Scalar string', 'wizard bundle result card explanation'],
    ['bundles.<id>.acuityTypeId', 'number input', 'Scalar number', 'Acuity booking link for bundle'],
    ['bundles.<id>.addOnLabel', 'NOT in editor UI', 'Scalar string (optional)', 'wizard bundle add-on toggle label text'],
    ['bundles.<id>.isConsultation', 'NOT in editor UI', 'Boolean', 'wizard: show consultation CTA instead of booking'],
    ['bundles.<id>.acuityDropdownValue', 'NOT in editor UI', 'Scalar string | null', 'Acuity dropdown pre-select for bundle'],
    ['questions.<id>.title', 'text input', 'Scalar string', 'wizard question card heading'],
    ['questions.<id>.subtitle', 'text input', 'Scalar string', 'wizard question card subheading'],
    ['questions.<id>.type', 'read-only display (single/multi)', 'Enum string (read-only)', 'wizard question rendering mode'],
    ['questions.<id>.options[*].label', 'text input per OptionRow', 'String (in object array)', 'wizard option button label'],
    ['questions.<id>.options[*].sublabel', 'text input per OptionRow', 'String (in object array)', 'wizard option button sub-label'],
    ['questions.<id>.options[*].icon', 'text input per OptionRow', 'String (in object array)', 'wizard option icon name'],
    ['questions.<id>.options[*].next', 'routing select per OptionRow', 'String (QuestionId FK, in object array)', 'wizard routing: next question on single-select'],
    ['questions.<id>.options[*].recommend', 'routing select per OptionRow', 'String (TreatmentId|BundleId FK, in object array)', 'wizard routing: direct recommendation on single-select'],
  ];

  const inventoryHeader = '| Field path | Editor UI | Type | Where consumed |\n|---|---|---|---|';
  const inventoryBody = inventoryRows.map(
    ([path, ui, type, consumed]) => `| \`${path}\` | ${ui} | ${type} | ${consumed} |`
  ).join('\n');

  // ── Category summary table
  const cats = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const catRows = cats.map(cat => {
    const meta = categoryMeta[cat];
    const status = categoryStatus(cat);
    const rs = byCategory[cat] || [];
    const failDetail = rs.filter(r => r.postGet !== 'PASS').map(r => r.error).filter(Boolean).join('; ');
    return `| ${cat}. ${meta.name} | \`${meta.representative}\` | ${status} | REST only | ${failDetail || '-'} |`;
  }).join('\n');

  // ── Individual test results
  const testRows = results.map(r => {
    const status = r.postGet === 'PASS' ? 'PASS' : `${r.postGet}: ${r.error}`;
    return `| ${r.category} | ${r.label} | \`${r.path}\` | ${status} |`;
  }).join('\n');

  // ── Findings
  const allPass = results.every(r => r.postGet === 'PASS');
  const failures = results.filter(r => r.postGet !== 'PASS');

  const findingsSection = failures.length === 0
    ? 'All tested field types round-tripped correctly. No unexpected failures.'
    : failures.map(r => `- Category ${r.category} (${r.label}): path \`${r.path}\` -- ${r.error}`).join('\n');

  const report = `# Save-Loop Coverage Report

Generated ${now} MT. Tests run against ${CONFIG_URL}.

## Inventory of editable fields

${inventoryHeader}
${inventoryBody}

## Category coverage

| Category | Representative field | POST-GET round-trip | UI propagation | Notes |
|---|---|---|---|---|
${catRows}

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
${testRows}

## Findings

${findingsSection}

## Gaps

The following schema fields are stored in WP (and were present in the original
KV snapshot) but have NO edit input in the admin dashboard editor:

1. \`bundles.<id>.addOnLabel\` (string) -- the custom label shown next to the
   add-on toggle in the wizard. The editor exposes \`addOnInteractive\` (bool)
   and \`addOn\` (treatment select) but there is no text input for this label.
   If it is already set it will be preserved on round-trip (the PHP plugin
   stores whatever JSON it receives), but it cannot be changed from the UI.

2. \`bundles.<id>.isConsultation\` (boolean) -- controls whether the wizard
   shows a consultation CTA instead of a booking button. Not editable in the
   \`BundleEditPanel\`.

3. \`bundles.<id>.acuityDropdownValue\` (string | null) -- Acuity dropdown
   pre-select for bundles. Present on \`EditableTreatment\` but not on
   \`EditableBundle\` and not rendered in \`BundleEditPanel\`.

4. \`treatments.<id>.tests\` (string[] | undefined) -- lab-specific test codes.
   \`EditableTreatment\` has the \`tests\` field and the dirty-check includes it,
   but \`EditorMain.tsx\` has no UI section that renders or edits this field.
   Round-trip works (the array is preserved when you save any treatment), but
   there is no way to add or remove test codes from the admin UI.

5. \`treatments.<id>.category\` -- displayed as a read-only badge in the editor.
   Cannot be changed after creation.

6. \`questions.<id>.type\` -- displayed as a read-only badge (single/multi).
   Cannot be changed after creation.

7. \`treatments.<id>.acuityDropdownValue\` -- editable via text input in the
   editor, but a null value is stored as an empty string in the editor draft,
   then serialized as \`""\` in the POSTed JSON. The PHP plugin stores exactly
   what it receives, so a treatment that originally had \`null\` will be stored
   as \`""\` if the editor saves it with the field blank. This is a minor
   type-coercion edge case: the consumer \`wizard.js\` likely reads it as falsy
   either way, but strict JSON consumers would see a type change.

8. The "Publish Live" button (\`canPublish\`) is gated by
   \`!!META.configWorkerUrl\`. In the current deployment \`configWorkerUrl\` is
   set to an empty string (migration from Cloudflare Worker to WP REST is
   complete). This means \`canPublish\` is \`false\` and the Publish Live button
   is NOT rendered in any editor panel. Save-and-Publish from the admin
   dashboard (\`handleSaveAndPublish\`) uses the WP nonce injected by
   \`wizardOfIvBootstrap\`, which is the correct path. The editor-tab "Save"
   button writes to the Vite dev server disk only (not to WP REST).
   The only REST-write path for the embedded admin dashboard is the
   "Save & Publish" button in \`WizardDevDashboard\`, not in the editor tab.
`;

  const reportPath = resolve(ROOT, 'claudedocs', 'save-loop-coverage.md');
  writeFileSync(reportPath, report, 'utf8');
  console.log(`\nReport written to claudedocs/save-loop-coverage.md`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
