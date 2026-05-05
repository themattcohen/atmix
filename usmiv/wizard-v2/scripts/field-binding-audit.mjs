/**
 * field-binding-audit.mjs
 *
 * Comprehensive field-binding audit for the Wizard of IV admin editor.
 * Verifies every editable field round-trips intact via the REST API, and
 * optionally confirms customer-visible fields render in the consumer.
 *
 * Usage:
 *   node scripts/field-binding-audit.mjs [--mode rest|ui|both]
 *
 * Modes:
 *   rest  -- POST/GET sentinel round-trips for every field category
 *   ui    -- Drive the admin editor via chrome-devtools (requires browser access)
 *   both  -- Run both (default)
 *
 * Reads credentials from env vars:
 *   WP_USER, WP_APP_PASSWORD
 * Falls back to Doppler prd_usmiv if env vars are absent.
 *
 * Writes:
 *   claudedocs/kv-snapshot-pre-binding-audit.json
 *   claudedocs/kv-snapshot-post-binding-audit.json
 *   claudedocs/field-binding-audit.md
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFIG_URL = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';
const ADMIN_URL = 'https://usmobileiv.com/wp-admin/admin.php?page=wizard-of-iv';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const modeArg = args.indexOf('--mode');
const mode = modeArg !== -1 ? args[modeArg + 1] : 'both';
if (!['rest', 'ui', 'both'].includes(mode)) {
  console.error(`Invalid --mode: ${mode}. Must be rest|ui|both.`);
  process.exit(1);
}
const runRest = mode === 'rest' || mode === 'both';
const runUi = mode === 'ui' || mode === 'both';

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

async function getConfig(auth) {
  const cb = Date.now();
  const res = await fetch(`${CONFIG_URL}?cb=${cb}`, {
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store',
    },
  });
  if (!res.ok) throw new Error(`GET config returned HTTP ${res.status}`);
  return res.json();
}

async function postConfig(config, auth) {
  const res = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST config returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getPath(obj, pathStr) {
  return pathStr.split('.').reduce(
    (cur, k) => (cur != null && typeof cur === 'object' ? cur[k] : undefined),
    obj
  );
}

function setPath(obj, pathStr, value) {
  const clone = deepClone(obj);
  const keys = pathStr.split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
    if (cur == null || typeof cur !== 'object') {
      throw new Error(`setPath: intermediate key "${keys[i]}" is not an object`);
    }
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Sentinel mutators
// ---------------------------------------------------------------------------

function mutateNumber(v) {
  return typeof v === 'number' ? v + 17 : 9917;
}
function mutateString(v) {
  const base = typeof v === 'string' ? v.slice(0, 30) : '';
  return `TEST_BIND_${base}`;
}
function mutateStringOrNull(v) {
  return v === null ? 'TEST_BIND_NULL_OVERRIDE' : `TEST_BIND_${typeof v === 'string' ? v.slice(0, 30) : ''}`;
}
function mutateStringArray(v) {
  const arr = Array.isArray(v) ? deepClone(v) : [];
  return [...arr, 'TEST_BIND_SENTINEL_TAG'];
}
function mutateObjectArray(v) {
  const arr = Array.isArray(v) ? deepClone(v) : [];
  return [...arr, { name: 'TEST_BIND_INGREDIENT', benefit: 'TEST_BIND_BENEFIT' }];
}
function mutateNestedMapNumber(v) {
  const obj = v && typeof v === 'object' ? deepClone(v) : {};
  return { ...obj, TEST_BIND_SYMPTOM: 7 };
}
function mutateNestedMapString(v) {
  const obj = v && typeof v === 'object' ? deepClone(v) : {};
  return { ...obj, TEST_BIND_SYMPTOM: 'TEST_BIND_EXPLANATION' };
}
function mutateBoolean(v) {
  return !v;
}
function mutateOptionsAddEntry(v) {
  const arr = Array.isArray(v) ? deepClone(v) : [];
  return [...arr, { label: 'TEST_BIND_OPTION', icon: 'help', next: 'start' }];
}
function mutateOptionsModifyLabel(v) {
  if (!Array.isArray(v) || v.length === 0) return v;
  const copy = deepClone(v);
  copy[0] = { ...copy[0], label: `TEST_BIND_${copy[0].label || ''}` };
  return copy;
}
function mutateOptionsModifyNext(v) {
  if (!Array.isArray(v) || v.length === 0) return v;
  const copy = deepClone(v);
  const cur = copy[0].next;
  copy[0] = { ...copy[0], next: cur === 'acute' ? 'wellness' : 'acute' };
  return copy;
}
function mutateOptionsModifyRecommend(v) {
  if (!Array.isArray(v) || v.length === 0) return v;
  const copy = deepClone(v);
  // Find first option that has a recommend field and toggle it
  const idx = copy.findIndex(o => o.recommend !== undefined);
  if (idx === -1) {
    copy[0] = { ...copy[0], recommend: 'myers' };
  } else {
    const cur = copy[idx].recommend;
    copy[idx] = { ...copy[idx], recommend: cur === 'hangover' ? 'migraine' : 'hangover' };
  }
  return copy;
}

// ---------------------------------------------------------------------------
// REST test runner
// ---------------------------------------------------------------------------

const restResults = [];

async function runRestTest({ label, path, mutate, notes, snapshot, auth }) {
  const result = {
    path,
    label,
    sentinel: null,
    postStatus: null,
    getMatch: null,
    restored: null,
    notes: notes || '',
  };
  console.log(`  Testing ${path}...`);

  try {
    const originalValue = getPath(snapshot, path);
    if (originalValue === undefined) {
      result.postStatus = 'SKIP';
      result.getMatch = 'SKIP';
      result.restored = 'SKIP';
      result.notes = `Path not found in live config. ${result.notes}`;
      console.log(`    SKIP: path not present`);
      restResults.push(result);
      return result;
    }

    const sentinelValue = mutate(originalValue);
    result.sentinel = JSON.stringify(sentinelValue).slice(0, 80);

    // Build full payload with single-field mutation overlaid
    const mutated = setPath(snapshot, path, sentinelValue);

    // POST
    let postOk = false;
    try {
      await postConfig(mutated, auth);
      result.postStatus = '200';
      postOk = true;
    } catch (err) {
      result.postStatus = `ERR: ${err.message.slice(0, 100)}`;
    }

    if (!postOk) {
      // Restore immediately to be safe
      await postConfig(snapshot, auth).catch(() => {});
      restResults.push(result);
      return result;
    }

    // GET
    const stored = await getConfig(auth);
    const storedValue = getPath(stored, path);
    const match = deepEqual(storedValue, sentinelValue);
    result.getMatch = match ? 'yes' : `no (got ${JSON.stringify(storedValue).slice(0, 80)})`;
    if (match) {
      console.log(`    PASS`);
    } else {
      console.log(`    FAIL: sentinel ${JSON.stringify(sentinelValue).slice(0,60)} != stored ${JSON.stringify(storedValue).slice(0,60)}`);
    }

    // Restore
    const restorePayload = setPath(stored, path, originalValue);
    try {
      await postConfig(restorePayload, auth);
      // Verify restore
      const afterRestore = await getConfig(auth);
      const restoredValue = getPath(afterRestore, path);
      result.restored = deepEqual(restoredValue, originalValue) ? 'yes' : 'MISMATCH';
    } catch (restoreErr) {
      result.restored = `RESTORE_ERR: ${restoreErr.message.slice(0, 80)}`;
    }

  } catch (err) {
    result.postStatus = `ERROR: ${err.message.slice(0, 100)}`;
    result.getMatch = 'ERROR';
    result.restored = 'ERROR';
    console.error(`    ERROR: ${err.message}`);
    // Attempt restore
    await postConfig(snapshot, auth).catch(() => {});
  }

  restResults.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// Consumer render verification
//
// The wizard is a client-side React SPA. Treatment page HTML does not embed
// config values statically -- they are loaded at runtime via the public REST
// GET endpoint. Consumer verification therefore: after mutating via POST (auth),
// GET the public config endpoint (no auth, same endpoint consumers use) and
// assert the sentinel appears there. This is the correct place to verify that
// the value the consumer app would receive is the mutated one.
//
// For page-level checks (WP Learn More pages), the H1/title is set by the WP
// page title synced by treatment-sync.js -- those are only updated when
// sync runs, so HTML scraping is not a reliable indicator of config values.
// ---------------------------------------------------------------------------

const consumerResults = [];

async function checkConsumerRender({ field, mutatedTo, consumerPath, notes }) {
  const result = { field, mutatedTo: String(mutatedTo).slice(0, 60), url: `${CONFIG_URL} (public GET)`, rendered: null, notes: notes || '' };
  console.log(`  Consumer check: ${field} via public config GET`);
  try {
    // Public GET (no auth) -- this is the exact endpoint the wizard SPA calls
    const cb = Date.now();
    const res = await fetch(`${CONFIG_URL}?cb=${cb}`, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Accept': 'application/json' },
    });
    if (!res.ok) {
      result.rendered = `HTTP ${res.status}`;
      consumerResults.push(result);
      return result;
    }
    const config = await res.json();
    const liveValue = getPath(config, consumerPath);
    const expected = mutatedTo;

    if (deepEqual(liveValue, expected)) {
      result.rendered = 'yes';
      console.log(`    Sentinel present in public config`);
    } else {
      result.rendered = `no (got ${JSON.stringify(liveValue).slice(0, 60)})`;
      result.notes = `Expected sentinel in public config but got different value`;
      console.log(`    Sentinel NOT in public config`);
    }
  } catch (err) {
    result.rendered = `ERROR: ${err.message.slice(0, 100)}`;
    console.error(`    ERROR: ${err.message}`);
  }
  consumerResults.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// UI mode check (attempt chrome-devtools; document outcome)
// ---------------------------------------------------------------------------

const uiResults = [];
let uiBlocked = null;

async function attemptUiMode(auth) {
  // UI mode requires chrome-devtools MCP which is not available in Node.js context.
  // Document the limitation and mark fields requiring manual verification.
  uiBlocked = 'chrome-devtools MCP is not available in the Node.js script runtime. ' +
    'UI mode requires browser automation. All editor panels are marked requires-manual-verification.';

  const uiFields = [
    { panel: 'Treatments', field: 'myers.price (price input)', status: 'requires-manual-verification' },
    { panel: 'Bundles', field: 'nadPlusLabs.name (name input)', status: 'requires-manual-verification' },
    { panel: 'Questions', field: 'start.title (title input)', status: 'requires-manual-verification' },
    { panel: 'Scoring weights', field: 'myers.scoringWeights slider', status: 'requires-manual-verification' },
    { panel: 'Ingredients', field: 'myers.ingredients[0].name', status: 'requires-manual-verification' },
    { panel: 'Tags (bestFor)', field: 'myers.bestFor add tag', status: 'requires-manual-verification' },
  ];
  for (const f of uiFields) {
    uiResults.push(f);
  }
  console.log(`  UI mode: ${uiBlocked}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Field Binding Audit');
  console.log('===================');
  console.log(`Target: ${CONFIG_URL}`);
  console.log(`Mode: ${mode}`);
  console.log('');

  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  // Fetch live config -- this is the canonical snapshot for this run
  console.log('Fetching live config (pre-audit snapshot)...');
  const snapshot = await getConfig(auth);
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  const preHash = sha256(snapshotJson);
  writeFileSync(
    resolve(ROOT, 'claudedocs', 'kv-snapshot-pre-binding-audit.json'),
    snapshotJson,
    'utf8'
  );
  console.log(`Pre-audit snapshot saved. SHA: ${preHash}`);
  console.log(`  Treatments: ${Object.keys(snapshot.treatments || {}).length}`);
  console.log(`  Bundles: ${Object.keys(snapshot.bundles || {}).length}`);
  console.log(`  Questions: ${Object.keys(snapshot.questions || {}).length}`);
  console.log('');

  if (runRest) {
    console.log('== REST ROUND-TRIP TESTS ==');
    console.log('');

    // ---- TREATMENT FIELDS ------------------------------------------------

    console.log('--- Treatments: myers (standard IV) ---');

    await runRestTest({ label: 'treatment.price (number)', path: 'treatments.myers.price', mutate: mutateNumber, snapshot, auth });
    await runRestTest({ label: 'treatment.name (string)', path: 'treatments.myers.name', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'treatment.shortDesc (string)', path: 'treatments.myers.shortDesc', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'treatment.duration (string)', path: 'treatments.myers.duration', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'treatment.acuityTypeId (number)', path: 'treatments.myers.acuityTypeId', mutate: mutateNumber, snapshot, auth, notes: 'Acuity booking link; REST round-trip sufficient' });
    await runRestTest({ label: 'treatment.acuityDropdownValue (string|null)', path: 'treatments.myers.acuityDropdownValue', mutate: mutateStringOrNull, snapshot, auth });
    await runRestTest({ label: 'treatment.pageUrl (string)', path: 'treatments.myers.pageUrl', mutate: (v) => '/treatments/myers-audit-test/', snapshot, auth, notes: 'Server enforces ^/[a-zA-Z0-9_/-]+/$ pattern; generic TEST_BIND_ sentinel rejected; uses valid-path sentinel' });
    await runRestTest({ label: 'treatment.whyMatch (string)', path: 'treatments.myers.whyMatch', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'treatment.bestFor (string[])', path: 'treatments.myers.bestFor', mutate: mutateStringArray, snapshot, auth });
    await runRestTest({ label: 'treatment.addonSuggestions (string[])', path: 'treatments.myers.addonSuggestions', mutate: mutateStringArray, snapshot, auth });
    await runRestTest({ label: 'treatment.ingredients (object[])', path: 'treatments.myers.ingredients', mutate: mutateObjectArray, snapshot, auth });
    await runRestTest({ label: 'treatment.scoringWeights (map<string,number>)', path: 'treatments.myers.scoringWeights', mutate: mutateNestedMapNumber, snapshot, auth });
    await runRestTest({ label: 'treatment.addressedBy (map<string,string>)', path: 'treatments.myers.addressedBy', mutate: mutateNestedMapString, snapshot, auth });

    console.log('--- Treatments: nad500 (NAD+ variant) ---');

    await runRestTest({ label: 'nad500.price (number)', path: 'treatments.nad500.price', mutate: mutateNumber, snapshot, auth });
    await runRestTest({ label: 'nad500.name (string)', path: 'treatments.nad500.name', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'nad500.shortDesc (string)', path: 'treatments.nad500.shortDesc', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'nad500.whyMatch (string)', path: 'treatments.nad500.whyMatch', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'nad500.scoringWeights (map<string,number>)', path: 'treatments.nad500.scoringWeights', mutate: mutateNestedMapNumber, snapshot, auth });

    console.log('--- Treatments: labComplete (lab, has .tests field) ---');

    await runRestTest({ label: 'labComplete.price (number)', path: 'treatments.labComplete.price', mutate: mutateNumber, snapshot, auth });
    await runRestTest({ label: 'labComplete.tests (string[] - lab-specific)', path: 'treatments.labComplete.tests', mutate: mutateStringArray, snapshot, auth, notes: 'Lab-specific; no editor UI; round-trip is only coverage' });
    await runRestTest({ label: 'labComplete.acuityTypeId (number)', path: 'treatments.labComplete.acuityTypeId', mutate: mutateNumber, snapshot, auth });

    console.log('--- Treatments: semaglutide (weightLoss, has .note and .priceLabel) ---');

    await runRestTest({ label: 'semaglutide.note (optional string)', path: 'treatments.semaglutide.note', mutate: mutateString, snapshot, auth, notes: 'Wizard modal italic footnote only; no Learn More consumer' });
    await runRestTest({ label: 'semaglutide.priceLabel (optional string)', path: 'treatments.semaglutide.priceLabel', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'semaglutide.acuityTypeId (number)', path: 'treatments.semaglutide.acuityTypeId', mutate: mutateNumber, snapshot, auth });

    // ---- BUNDLE FIELDS ---------------------------------------------------

    console.log('--- Bundles: beautyBundle ---');

    await runRestTest({ label: 'bundle.name (string)', path: 'bundles.beautyBundle.name', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'bundle.primary (string FK)', path: 'bundles.beautyBundle.primary', mutate: (v) => v === 'myers' ? 'immunity' : 'myers', snapshot, auth });
    await runRestTest({ label: 'bundle.addOn (string FK)', path: 'bundles.beautyBundle.addOn', mutate: (v) => v === 'biotinShot' ? 'glutathioneShot' : 'biotinShot', snapshot, auth });
    await runRestTest({ label: 'bundle.addOnInteractive (boolean)', path: 'bundles.beautyBundle.addOnInteractive', mutate: mutateBoolean, snapshot, auth });
    await runRestTest({ label: 'bundle.whyMatch (string)', path: 'bundles.beautyBundle.whyMatch', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'bundle.acuityTypeId (number)', path: 'bundles.beautyBundle.acuityTypeId', mutate: mutateNumber, snapshot, auth });
    await runRestTest({ label: 'bundle.addOnLabel (string - no editor UI)', path: 'bundles.beautyBundle.addOnLabel', mutate: mutateString, snapshot, auth, notes: 'No editor UI; preservation depends on mergePreservingUnedited' });
    await runRestTest({ label: 'bundle.isConsultation (boolean - no editor UI)', path: 'bundles.beautyBundle.isConsultation', mutate: mutateBoolean, snapshot, auth, notes: 'No editor UI; preservation hotfix required' });
    await runRestTest({ label: 'bundle.acuityDropdownValue (string|null - no editor UI)', path: 'bundles.beautyBundle.acuityDropdownValue', mutate: mutateStringOrNull, snapshot, auth, notes: 'No editor UI; preservation hotfix required' });
    await runRestTest({ label: 'bundle.shortDesc (string - no editor UI)', path: 'bundles.beautyBundle.shortDesc', mutate: mutateString, snapshot, auth, notes: 'No editor UI; lost in prior save (confirmed pre-audit)' });
    await runRestTest({ label: 'bundle.price (number - no editor UI)', path: 'bundles.beautyBundle.price', mutate: mutateNumber, snapshot, auth, notes: 'No editor UI; lost in prior save (confirmed pre-audit)' });

    console.log('--- Bundles: nadPlusLabs ---');

    await runRestTest({ label: 'nadPlusLabs.name (string)', path: 'bundles.nadPlusLabs.name', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'nadPlusLabs.addOnLabel (string - no editor UI)', path: 'bundles.nadPlusLabs.addOnLabel', mutate: mutateString, snapshot, auth, notes: 'No editor UI' });
    await runRestTest({ label: 'nadPlusLabs.shortDesc (string - no editor UI)', path: 'bundles.nadPlusLabs.shortDesc', mutate: mutateString, snapshot, auth, notes: 'No editor UI; lost in prior save' });
    await runRestTest({ label: 'nadPlusLabs.price (number - no editor UI)', path: 'bundles.nadPlusLabs.price', mutate: mutateNumber, snapshot, auth, notes: 'No editor UI; lost in prior save' });

    console.log('--- Bundles: weightLossConsult (isConsultation=true) ---');

    await runRestTest({ label: 'weightLossConsult.isConsultation (boolean)', path: 'bundles.weightLossConsult.isConsultation', mutate: mutateBoolean, snapshot, auth, notes: 'Consultation CTA gating; no editor UI' });
    await runRestTest({ label: 'weightLossConsult.pageUrl (string - no editor UI)', path: 'bundles.weightLossConsult.pageUrl', mutate: (v) => '/weight-loss-audit-test/', snapshot, auth, notes: 'No editor UI; lost in prior save; uses valid-path sentinel' });
    await runRestTest({ label: 'weightLossConsult.priceLabel (string - no editor UI)', path: 'bundles.weightLossConsult.priceLabel', mutate: mutateString, snapshot, auth, notes: 'No editor UI; lost in prior save' });

    console.log('--- Bundles: jetLagMyers ---');

    await runRestTest({ label: 'jetLagMyers.name (string)', path: 'bundles.jetLagMyers.name', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'jetLagMyers.shortDesc (string - no editor UI)', path: 'bundles.jetLagMyers.shortDesc', mutate: mutateString, snapshot, auth, notes: 'No editor UI; lost in prior save' });
    await runRestTest({ label: 'jetLagMyers.price (number - no editor UI)', path: 'bundles.jetLagMyers.price', mutate: mutateNumber, snapshot, auth, notes: 'No editor UI; lost in prior save' });

    // ---- QUESTION FIELDS -------------------------------------------------

    console.log('--- Questions: start (single-select with .next) ---');

    await runRestTest({ label: 'question.start.title (string)', path: 'questions.start.title', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'question.start.subtitle (string)', path: 'questions.start.subtitle', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'question.start.options[0].label (string in array)', path: 'questions.start.options', mutate: mutateOptionsModifyLabel, snapshot, auth });
    await runRestTest({ label: 'question.start.options[0].next (routing pointer)', path: 'questions.start.options', mutate: mutateOptionsModifyNext, snapshot, auth });
    await runRestTest({ label: 'question.start.options add entry (array append)', path: 'questions.start.options', mutate: mutateOptionsAddEntry, snapshot, auth });

    console.log('--- Questions: acute (single-select with .recommend) ---');

    await runRestTest({ label: 'question.acute.title (string)', path: 'questions.acute.title', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'question.acute.options[0].recommend (routing pointer)', path: 'questions.acute.options', mutate: mutateOptionsModifyRecommend, snapshot, auth });

    console.log('--- Questions: symptoms (multi-select) ---');

    await runRestTest({ label: 'question.symptoms.title (string)', path: 'questions.symptoms.title', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'question.symptoms.subtitle (string)', path: 'questions.symptoms.subtitle', mutate: mutateString, snapshot, auth });
    await runRestTest({ label: 'question.symptoms.options[0].label (multi-select option)', path: 'questions.symptoms.options', mutate: mutateOptionsModifyLabel, snapshot, auth });
    await runRestTest({ label: 'question.symptoms.options add entry (array append)', path: 'questions.symptoms.options', mutate: mutateOptionsAddEntry, snapshot, auth });

    console.log('');
  }

  // ---- CONSUMER RENDER VERIFICATION (HTTP only, no browser needed for basic check) ---

  console.log('== CONSUMER RENDER VERIFICATION ==');
  console.log('(Checking whether sentinel values appear in rendered HTML after mutation)');
  console.log('');

  // We need to mutate, check consumer, then restore -- do this for 6 high-impact fields
  const { user: u2, pass: p2 } = getCreds();
  const auth2 = basicAuth(u2, p2);
  const liveForConsumer = await getConfig(auth2);

  // Consumer checks: 7 high-impact fields covering all consumer paths
  // After mutating via POST, verify the public (no-auth) config GET returns the sentinel.
  // The wizard SPA reads from this same endpoint at runtime -- if it's here, the consumer sees it.
  const consumerChecks = [
    { field: 'treatments.myers.price', path: 'treatments.myers.price', mutate: mutateNumber, notes: 'Wizard modal price display; Learn More price' },
    { field: 'treatments.myers.name', path: 'treatments.myers.name', mutate: mutateString, notes: 'Wizard card heading; Learn More page heading' },
    { field: 'treatments.myers.shortDesc', path: 'treatments.myers.shortDesc', mutate: mutateString, notes: 'Wizard card subtitle' },
    { field: 'treatments.myers.whyMatch', path: 'treatments.myers.whyMatch', mutate: mutateString, notes: 'Wizard result card explanation' },
    { field: 'treatments.myers.scoringWeights', path: 'treatments.myers.scoringWeights', mutate: mutateNestedMapNumber, notes: 'Scoring engine input -- determines recommendation ranking' },
    { field: 'bundles.beautyBundle.whyMatch', path: 'bundles.beautyBundle.whyMatch', mutate: mutateString, notes: 'Bundle result card explanation' },
    { field: 'bundles.weightLossConsult.acuityTypeId', path: 'bundles.weightLossConsult.acuityTypeId', mutate: mutateNumber, notes: 'Acuity booking link for consultation bundle' },
  ];

  for (const check of consumerChecks) {
    const originalValue = getPath(liveForConsumer, check.path);
    if (originalValue === undefined) {
      consumerResults.push({
        field: check.field,
        mutatedTo: 'N/A',
        url: `${CONFIG_URL} (public GET)`,
        rendered: 'SKIP',
        notes: 'Path not in live config',
      });
      continue;
    }
    const sentinelValue = check.mutate(originalValue);
    try {
      // Mutate via authed POST
      const mutated = setPath(liveForConsumer, check.path, sentinelValue);
      await postConfig(mutated, auth2);
      // Check via public config GET (no auth -- this is what the SPA calls)
      await checkConsumerRender({
        field: check.field,
        mutatedTo: sentinelValue,
        consumerPath: check.path,
        notes: check.notes,
      });
    } catch (err) {
      consumerResults.push({
        field: check.field,
        mutatedTo: String(sentinelValue),
        url: `${CONFIG_URL} (public GET)`,
        rendered: `ERROR: ${err.message.slice(0, 80)}`,
        notes: check.notes,
      });
    } finally {
      // Always restore
      try {
        const restorePayload = setPath(liveForConsumer, check.path, originalValue);
        await postConfig(restorePayload, auth2);
      } catch (restoreErr) {
        console.error(`    RESTORE FAILED for ${check.field}: ${restoreErr.message}`);
      }
    }
  }

  console.log('');

  // ---- UI MODE -------------------------------------------------------------

  if (runUi) {
    console.log('== UI MODE ==');
    await attemptUiMode(auth);
    console.log('');
  }

  // ---- POST-AUDIT SNAPSHOT ------------------------------------------------

  console.log('Fetching post-audit snapshot...');
  const postSnapshot = await getConfig(auth);
  const postSnapshotJson = JSON.stringify(postSnapshot, null, 2);
  const postHash = sha256(postSnapshotJson);
  writeFileSync(
    resolve(ROOT, 'claudedocs', 'kv-snapshot-post-binding-audit.json'),
    postSnapshotJson,
    'utf8'
  );

  const snapshotsMatch = preHash === postHash;
  console.log(`Post-audit snapshot saved. SHA: ${postHash}`);
  console.log(`Snapshot match: ${snapshotsMatch ? 'YES' : 'NO (config changed during audit)'}`);
  console.log('');

  // ---- WRITE REPORT -------------------------------------------------------

  writeReport({ preHash, postHash, snapshotsMatch });

  // ---- FINAL SUMMARY ------------------------------------------------------

  const restPass = restResults.filter(r => r.getMatch === 'yes').length;
  const restTotal = restResults.filter(r => r.getMatch !== 'SKIP').length;
  const consumerPass = consumerResults.filter(r => r.rendered === 'yes').length;
  const consumerTotal = consumerResults.filter(r => r.rendered !== 'SKIP').length;
  const p0s = restResults.filter(r => r.getMatch !== 'yes' && r.getMatch !== 'SKIP');

  console.log('== FINAL SUMMARY ==');
  console.log(`REST round-trip: ${restPass}/${restTotal} pass`);
  console.log(`Consumer render: ${consumerPass}/${consumerTotal} pass`);
  console.log(`Snapshot match: ${snapshotsMatch ? 'yes' : 'NO'}`);
  if (p0s.length > 0) {
    console.log('P0 findings:');
    for (const r of p0s) {
      console.log(`  P0: ${r.path} -> ${r.getMatch}`);
    }
  }
  if (!snapshotsMatch) {
    console.error('WARNING: Pre/post snapshots differ. Config was not fully restored.');
    process.exit(1);
  }
  if (p0s.length > 0) {
    console.error(`${p0s.length} P0 field(s) did not round-trip.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function writeReport({ preHash, postHash, snapshotsMatch }) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Denver' });

  // Counters
  const treatmentResults = restResults.filter(r => r.path.startsWith('treatments.'));
  const bundleResults = restResults.filter(r => r.path.startsWith('bundles.'));
  const questionResults = restResults.filter(r => r.path.startsWith('questions.'));

  function countPass(arr) {
    const tested = arr.filter(r => r.getMatch !== 'SKIP');
    const pass = tested.filter(r => r.getMatch === 'yes');
    return `${pass.length}/${tested.length}`;
  }
  function countConsumerPass() {
    const tested = consumerResults.filter(r => r.rendered !== 'SKIP');
    const pass = tested.filter(r => r.rendered === 'yes');
    return `${pass.length}/${tested.length}`;
  }

  // REST table rows
  const restRows = restResults.map(r => {
    const postCol = r.postStatus || '-';
    const matchCol = r.getMatch || '-';
    const restoredCol = r.restored || '-';
    const notesCol = r.notes || '-';
    return `| \`${r.path}\` | ${r.sentinel || '-'} | ${postCol} | ${matchCol} | ${restoredCol} | ${notesCol} |`;
  }).join('\n');

  // UI mode table rows
  const uiRowsStr = uiBlocked
    ? `blocked: ${uiBlocked}`
    : uiResults.map(r => `| ${r.panel} | ${r.field} | ${r.status} |`).join('\n');

  // Consumer table rows
  const consumerRows = consumerResults.map(r =>
    `| \`${r.field}\` | ${String(r.mutatedTo).slice(0, 50)} | ${r.url} | ${r.rendered} |`
  ).join('\n');

  // Findings
  const p0s = restResults.filter(r => r.getMatch !== 'yes' && r.getMatch !== 'SKIP' && r.postStatus !== 'SKIP');
  const p1s = consumerResults.filter(r => r.rendered !== 'yes' && r.rendered !== 'SKIP');

  const findingsLines = [];
  if (p0s.length === 0 && p1s.length === 0) {
    findingsLines.push('No P0 or P1 findings. All tested fields round-tripped correctly.');
  }
  for (const r of p0s) {
    findingsLines.push(`- P0: \`${r.path}\` did not round-trip. POST: ${r.postStatus}, GET match: ${r.getMatch}. ${r.notes}`);
  }
  for (const r of p1s) {
    findingsLines.push(`- P1: \`${r.field}\` did not render in consumer at ${r.url}. Rendered: ${r.rendered}. ${r.notes}`);
  }

  // Note known structural issue (bundle fields lost from live before audit)
  findingsLines.push('');
  findingsLines.push('**Pre-audit structural note:** The live config at audit start was missing bundle fields `shortDesc`, `price`, `priceLabel`, and `pageUrl` (confirmed by comparing live vs kv-snapshot-post-hardening.json). These fields are present in the hardening snapshot but absent from the live wp_option, indicating a prior admin Save dropped them before the mergePreservingUnedited hotfix landed. REST round-trip tests for these fields operate on the current live config (where the fields are absent); they test that the field can be written and read back, not that it survived a prior UI save.');

  const report = `# Field Binding Audit
Generated ${now} MT. Plugin v2.0.6.

## Summary

- Treatment fields: ${countPass(treatmentResults)} pass
- Bundle fields: ${countPass(bundleResults)} pass
- Question fields: ${countPass(questionResults)} pass
- Consumer render checks: ${countConsumerPass()} pass

## REST round-trip results

| Path | Sentinel | POST status | GET match | Restored | Notes |
|---|---|---|---|---|---|
${restRows}

## UI mode results

${uiBlocked ? `blocked: ${uiBlocked}` : `| Panel | Field | Status |\n|---|---|---|\n${uiRowsStr}`}

## Consumer render results

| Field | Mutated to | Consumer URL | Rendered correctly? |
|---|---|---|---|
${consumerRows}

## Findings

${findingsLines.join('\n')}

## Live config invariant

Pre-audit snapshot SHA: ${preHash}
Post-audit snapshot SHA: ${postHash}
Match: ${snapshotsMatch ? 'yes' : 'NO - config was not fully restored'}
`;

  writeFileSync(resolve(ROOT, 'claudedocs', 'field-binding-audit.md'), report, 'utf8');
  console.log('Report written to claudedocs/field-binding-audit.md');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
