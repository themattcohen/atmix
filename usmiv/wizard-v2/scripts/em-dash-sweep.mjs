/**
 * em-dash-sweep.mjs
 *
 * Removes all em-dashes from the wizard config stored in the WP option.
 * Targets:
 *   - U+2014 (em-dash: —)
 *   - U+2013 (en-dash used as sentence break: —)
 *   - &mdash; HTML entity
 *   - &#8212; numeric entity
 *
 * Does NOT touch:
 *   - U+002D hyphen-minus in compound words ("anti-aging", "B-Complex", etc.)
 *   - Numeric ranges ("30-45 min", "1-2 hours", "6-12 hours")
 *
 * Replacement strategy (conservative):
 *   - Sentence-break em-dash: period (capitalize next clause if needed).
 *   - Apposition/clarification em-dash: parentheses around the appended phrase,
 *     or a comma, depending on which reads more naturally.
 *   - Ingredient benefit separator (short label after em-dash): colon.
 *
 * Steps:
 *   1. GET config from /wp-json/wizard-of-iv/v1/config.
 *   2. Walk every string leaf. Apply replacements.
 *   3. Dump diff to claudedocs/em-dash-replacements.md.
 *   4. POST cleaned config back.
 *   5. Re-fetch and assert zero em-dashes remain.
 *   6. Save post-sweep snapshot.
 *
 * Idempotent: re-running produces zero diff.
 *
 * Auth: WP_USER + WP_APP_PASSWORD from env or Doppler prd_usmiv.
 *
 * Usage:
 *   node scripts/em-dash-sweep.mjs
 *   node scripts/em-dash-sweep.mjs --dry-run
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const WP_API = 'https://usmobileiv.com/wp-json';
const DRY_RUN = process.argv.includes('--dry-run');

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
  if (!user || !pass) throw new Error('Could not read WP_USER / WP_APP_PASSWORD from Doppler');
  return { user: user.trim(), pass: pass.trim() };
}

function basicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function wpGet(path, auth) {
  const res = await fetch(`${WP_API}${path}`, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
  return res.json();
}

async function wpPost(path, auth, body) {
  const res = await fetch(`${WP_API}${path}`, {
    method:  'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Em-dash detection
// ---------------------------------------------------------------------------

// Matches any em-dash form (but NOT hyphen-minus U+002D).
const EM_DASH_RE = /—|–|&mdash;|&#8212;/g;

function hasEmDash(str) {
  return EM_DASH_RE.test(str);
}

// ---------------------------------------------------------------------------
// Per-string replacement rules.
//
// Each rule targets one known em-dash pattern (exact substring match).
// Using exact match rather than regex to ensure only known em-dashes are
// touched and no accidental substitutions occur in surrounding text.
//
// Convention for the replacement column:
//   Sentence break: the em-dash and surrounding spaces become ". " and the
//   next word is capitalized.
//   Apposition: em-dash and surrounding spaces become " (" and the clause
//   is followed by ")".
//   Label separator: " — " between short noun and description becomes ": ".
// ---------------------------------------------------------------------------

// Each entry: [exactOldSubstring, exactNewSubstring]
// Ordered from most specific to least. All replacements are applied in order
// within a string using simple replaceAll (no regex) so compound words with
// hyphens are never touched.

const STRING_REPLACEMENTS = [
  // hydration.whyMatch
  // "within 20-30 minutes — significantly faster"
  // Sentence break: replace with period.
  [
    'within 20-30 minutes — significantly faster',
    'within 20-30 minutes, significantly faster',
  ],

  // myers.whyMatch
  // "the gold standard vitamin IV — a proven blend"
  // Apposition: parentheses.
  [
    'the gold standard vitamin IV — a proven blend',
    'the gold standard vitamin IV (a proven blend',
  ],
  // Note: the parenthetical opened above continues to end of sentence.
  // The sentence ends at "...and wellness." so we also need to close the paren.
  // We handle this by replacing the full substring that includes the close.
  [
    '(a proven blend of B vitamins, Vitamin C, Magnesium, and Glutathione for overall energy and wellness.',
    '(a proven blend of B vitamins, Vitamin C, Magnesium, and Glutathione for overall energy and wellness).',
  ],

  // altitude.whyMatch
  // "Colorado's elevation hits hard — most visitors"
  // Sentence break: period + capitalize.
  [
    "Colorado's elevation hits hard — most visitors",
    "Colorado's elevation hits hard. Most visitors",
  ],

  // migraine.whyMatch
  // "pain signaling pathways — this is the same approach"
  // Sentence break: period + capitalize.
  [
    'pain signaling pathways — this is the same',
    'pain signaling pathways. This is the same',
  ],

  // longevity.whyMatch
  // "NAD+ activates sirtuins — the proteins responsible"
  // Apposition (defines what sirtuins are): parentheses.
  [
    'NAD+ activates sirtuins — the proteins responsible for DNA repair and cellular longevity.',
    'NAD+ activates sirtuins (the proteins responsible for DNA repair and cellular longevity).',
  ],

  // performance.whyMatch
  // "recover faster and train harder — most effective within 2 hours post-workout."
  // Sentence break: comma reads better than period here.
  [
    'recover faster and train harder — most effective within 2 hours post-workout.',
    'recover faster and train harder, most effective within 2 hours post-workout.',
  ],

  // myersPlatinum.whyMatch
  // "most potent general wellness IV — the closest thing to a full reset."
  // Apposition: parentheses.
  [
    'most potent general wellness IV — the closest thing to a full reset.',
    'most potent general wellness IV (the closest thing to a full reset).',
  ],

  // myersPlatinum.addressedBy."Stressed and burnt out"
  // "Triple vitamin concentrations plus NAD+ — our strongest burnout reset"
  // Apposition: parentheses.
  [
    'Triple vitamin concentrations plus NAD+ — our strongest burnout reset',
    'Triple vitamin concentrations plus NAD+ (our strongest burnout reset)',
  ],

  // revival.ingredients[6].benefit
  // "Toradol, Zofran, Benadryl, Pepcid, or Reglan — discussed with your nurse"
  // Label separator: colon.
  [
    'Toradol, Zofran, Benadryl, Pepcid, or Reglan — discussed with your nurse',
    'Toradol, Zofran, Benadryl, Pepcid, or Reglan: discussed with your nurse',
  ],

  // revival.whyMatch
  // "Toradol, Zofran, Benadryl, Pepcid, or Reglan — your nurse reviews"
  // Sentence break: comma.
  [
    'Toradol, Zofran, Benadryl, Pepcid, or Reglan — your nurse reviews all options with you before starting.',
    'Toradol, Zofran, Benadryl, Pepcid, or Reglan, and your nurse reviews all options with you before starting.',
  ],

  // nad100.whyMatch
  // "a gentle introduction — expect improved energy"
  // Sentence break: colon reads well here (introducing what to expect).
  [
    'a gentle introduction — expect improved energy',
    'a gentle introduction: expect improved energy',
  ],

  // nad250.addressedBy."Stressed and burnt out"
  // "Burnout depletes NAD+ — this replenishes it at the cellular level"
  // Sentence break: period + capitalize.
  [
    'Burnout depletes NAD+ — this replenishes it at the cellular level',
    'Burnout depletes NAD+. This replenishes it at the cellular level',
  ],

  // tirzepatide.whyMatch
  // "for even stronger appetite suppression — clinical trials show up to 20%"
  // Sentence break: comma.
  [
    'for even stronger appetite suppression — clinical trials show up to 20% body weight reduction.',
    'for even stronger appetite suppression. Clinical trials show up to 20% body weight reduction.',
  ],

  // lipoShots.whyMatch
  // "contain MIC (Methionine, Inositol, Choline) — three compounds"
  // Apposition: parentheses.
  [
    '(Methionine, Inositol, Choline) — three compounds that help your liver process and mobilize stored fat.',
    '(Methionine, Inositol, Choline), three compounds that help your liver process and mobilize stored fat.',
  ],

  // b12Shot.whyMatch
  // "bypass digestion entirely — 100% bioavailable"
  // Apposition (explaining the consequence): colon.
  [
    'bypass digestion entirely — 100% bioavailable',
    'bypass digestion entirely: 100% bioavailable',
  ],

  // biotinShot.whyMatch
  // "key nutrient for keratin production — the structural protein"
  // Apposition: parentheses.
  [
    'key nutrient for keratin production — the structural protein in hair, skin, and nails.',
    'key nutrient for keratin production (the structural protein in hair, skin, and nails).',
  ],

  // glutathioneShot.whyMatch
  // "Oral glutathione is poorly absorbed — injection delivers it directly"
  // Sentence break: period + capitalize.
  [
    'Oral glutathione is poorly absorbed — injection delivers it directly',
    'Oral glutathione is poorly absorbed. Injection delivers it directly',
  ],

  // vitaminDShot.whyMatch
  // "loads your stores immediately — no waiting weeks for oral supplements to build up."
  // Sentence break: comma.
  [
    'loads your stores immediately — no waiting weeks for oral supplements to build up.',
    'loads your stores immediately, with no waiting weeks for oral supplements to build up.',
  ],

  // labGeneral.ingredients[0].benefit
  // "Red/white cells, hemoglobin, platelets — screens for anemia and infection"
  // Label separator: colon.
  [
    'Red/white cells, hemoglobin, platelets — screens for anemia and infection',
    'Red/white cells, hemoglobin, platelets: screens for anemia and infection',
  ],

  // labGeneral.ingredients[1].benefit
  // "Kidney, liver, blood sugar, electrolytes — 14 core markers"
  // Label separator: colon.
  [
    'Kidney, liver, blood sugar, electrolytes — 14 core markers',
    'Kidney, liver, blood sugar, electrolytes: 14 core markers',
  ],

  // labGeneral.ingredients[2].benefit
  // "Total cholesterol, LDL, HDL, triglycerides — cardiovascular risk"
  // Label separator: colon.
  [
    'Total cholesterol, LDL, HDL, triglycerides — cardiovascular risk',
    'Total cholesterol, LDL, HDL, triglycerides: cardiovascular risk',
  ],

  // labInDepth.ingredients[3].benefit
  // "Thyroid function — fatigue, metabolism, mood"
  // Label separator: colon.
  [
    'Thyroid function — fatigue, metabolism, mood',
    'Thyroid function: fatigue, metabolism, mood',
  ],

  // labInDepth.ingredients[4].benefit
  // "3-month blood sugar average — diabetes risk screening"
  // Label separator: colon.
  [
    '3-month blood sugar average — diabetes risk screening',
    '3-month blood sugar average: diabetes risk screening',
  ],

  // labInDepth.whyMatch
  // "TSH screens for thyroid issues — a common cause of unexplained fatigue"
  // Apposition: parentheses.
  [
    'TSH screens for thyroid issues — a common cause of unexplained fatigue and weight changes.',
    'TSH screens for thyroid issues (a common cause of unexplained fatigue and weight changes).',
  ],

  // labVitamin.ingredients[1].benefit
  // "Energy, nerve health, mood — common deficiency"
  // Label separator: colon.
  [
    'Energy, nerve health, mood — common deficiency',
    'Energy, nerve health, mood: common deficiency',
  ],

  // labVitamin.ingredients[5].benefit
  // "Energy transport — key for fatigue investigation"
  // Label separator: colon.
  [
    'Energy transport — key for fatigue investigation',
    'Energy transport: key for fatigue investigation',
  ],

  // labVitamin.whyMatch
  // "what your body is low on — so you can target your IV and injection choices."
  // Sentence break: comma.
  [
    'what your body is low on — so you can target your IV and injection choices.',
    'what your body is low on, so you can target your IV and injection choices.',
  ],
];

// ---------------------------------------------------------------------------
// Deep tree walker: apply replacements to every string leaf.
// Returns [modified_value, changes: [{path, before, after}]]
// ---------------------------------------------------------------------------

function applyReplacements(obj, path, changes) {
  if (typeof obj === 'string') {
    let current = obj;
    for (const [oldSub, newSub] of STRING_REPLACEMENTS) {
      if (current.includes(oldSub)) {
        current = current.replaceAll(oldSub, newSub);
      }
    }
    if (current !== obj) {
      changes.push({ path, before: obj, after: current });
    }
    return current;
  }
  if (Array.isArray(obj)) {
    return obj.map((v, i) => applyReplacements(v, `${path}[${i}]`, changes));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const k of Object.keys(obj)) {
      result[k] = applyReplacements(obj[k], `${path}.${k}`, changes);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Verify no em-dashes remain after sweep
// ---------------------------------------------------------------------------

function findRemainingEmDashes(obj, path, found) {
  if (typeof obj === 'string') {
    const matches = [...obj.matchAll(/—|–|&mdash;|&#8212;/g)];
    if (matches.length) {
      found.push({ path, value: obj, count: matches.length });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => findRemainingEmDashes(v, `${path}[${i}]`, found));
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) findRemainingEmDashes(obj[k], `${path}.${k}`, found);
  }
}

// ---------------------------------------------------------------------------
// Write the diff report to claudedocs/em-dash-replacements.md
// ---------------------------------------------------------------------------

function writeDiffReport(changes) {
  const lines = [
    '# Em-Dash Sweep: Replacements Made',
    '',
    `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} MT (displayed as UTC offset -6/-7)`,
    `Total replacements: ${changes.length}`,
    '',
    '---',
    '',
  ];

  for (const { path, before, after } of changes) {
    lines.push(`## \`${path}\``);
    lines.push('');
    lines.push('**Before:**');
    lines.push('');
    lines.push('> ' + before.replace(/\n/g, '\n> '));
    lines.push('');
    lines.push('**After:**');
    lines.push('');
    lines.push('> ' + after.replace(/\n/g, '\n> '));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const outPath = resolve(ROOT, 'claudedocs/em-dash-replacements.md');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Diff written to: claudedocs/em-dash-replacements.md`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  if (DRY_RUN) console.log('[DRY RUN] Config will not be POSTed.\n');

  // Step 1: fetch current config
  console.log('Fetching current wizard config...');
  const config = await wpGet('/wizard-of-iv/v1/config', auth);
  console.log(`  ${Object.keys(config.treatments || {}).length} treatments, ` +
    `${Object.keys(config.bundles || {}).length} bundles, ` +
    `${Object.keys(config.questions || {}).length} questions`);

  // Step 2: apply replacements
  const changes = [];
  const cleaned = applyReplacements(config, 'root', changes);

  console.log(`\n${changes.length} strings modified.`);

  if (changes.length === 0) {
    console.log('No em-dashes found. Config is already clean. Exiting.');
    return;
  }

  // Step 3: write diff report
  writeDiffReport(changes);

  if (DRY_RUN) {
    console.log('\nDry-run complete. Changes previewed above. Run without --dry-run to apply.');
    return;
  }

  // Step 4: POST cleaned config
  console.log('\nPOSTing cleaned config...');
  const saveResult = await wpPost('/wizard-of-iv/v1/config', auth, cleaned);
  if (!saveResult.success) {
    throw new Error('Config save returned success=false: ' + JSON.stringify(saveResult));
  }
  console.log('  Config saved. updated_at:', saveResult.updated_at);

  // Step 5: re-fetch and verify
  console.log('\nRe-fetching config to verify zero em-dashes remain...');
  const verified = await wpGet('/wizard-of-iv/v1/config', auth);
  const remaining = [];
  findRemainingEmDashes(verified, 'root', remaining);

  if (remaining.length > 0) {
    console.error('FAIL: em-dashes still found after sweep:');
    remaining.forEach(({ path, value, count }) =>
      console.error(`  [${count}x] ${path}: ${value.slice(0, 100)}`)
    );
    process.exit(1);
  }

  console.log('  Zero em-dashes remaining. Verification passed.');

  // Step 6: save post-sweep snapshot
  const postPath = resolve(ROOT, 'claudedocs/kv-snapshot-post-em-dash-sweep.json');
  writeFileSync(postPath, JSON.stringify(verified, null, 2), 'utf8');
  console.log('  Post-sweep snapshot written to: claudedocs/kv-snapshot-post-em-dash-sweep.json');

  console.log(`\nDone. ${changes.length} em-dash instances replaced.`);
})();
