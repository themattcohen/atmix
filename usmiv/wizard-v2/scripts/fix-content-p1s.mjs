/**
 * fix-content-p1s.mjs
 *
 * Applies four P1 content fixes to the live WP wizard config:
 *
 *   Bug 1: beautyBundle result card subtitle reads Myers' Cocktail shortDesc.
 *          Root cause: bundles had no shortDesc; ResultScreen fell back to primary.shortDesc.
 *          Fix: add shortDesc to all bundles in KV (component fix deployed separately).
 *
 *   Bug 2: weightLossConsult Learn More routes to /treatments/semaglutide/.
 *          Root cause: bundle had no pageUrl; ResultScreen used treatment.pageUrl (semaglutide).
 *          Fix: add pageUrl = /weight-loss-services/ to weightLossConsult in KV.
 *
 *   Bug 3: nadPlusLabs and beautyBundle headline price shows primary treatment price.
 *          Root cause: bundles had no price field; ResultScreen used treatment.price.
 *          Fix: add correct bundle total prices (beautyBundle=$220, nadPlusLabs=$475) in KV.
 *          weightLossConsult already has priceLabel "from $199/month" (consultation, no fixed total).
 *          jetLagMyers = myers only, price=$220, no addOn, correct as-is but added explicitly.
 *
 *   Bug 4: nadDose 500mg sublabel lacks addiction context.
 *          Fix: update sublabel to mention addiction recovery.
 *
 * Steps:
 *   1. Snapshot current config -> claudedocs/kv-snapshot-pre-content-fix.json
 *   2. Mutate in-memory config for all four fixes
 *   3. POST to WP REST endpoint
 *   4. Re-fetch and assert each change landed
 *   5. Snapshot post-fix config -> claudedocs/kv-snapshot-post-content-fix.json
 *   6. Print summary
 *
 * Auth: WP_USER + WP_APP_PASSWORD from env or Doppler prd_usmiv.
 *
 * Usage:
 *   doppler run --project atmix --config prd_usmiv -- node scripts/fix-content-p1s.mjs
 *   node scripts/fix-content-p1s.mjs   (if WP_USER/WP_APP_PASSWORD already in env)
 *   node scripts/fix-content-p1s.mjs --dry-run
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} returned ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Apply all four P1 fixes to an in-memory config object.
 * Returns a mutations summary for the post-run report.
 */
function applyFixes(config) {
  const mutations = [];

  // ---- Bug 1 + Bug 3: Add shortDesc and price to all bundles ----
  // beautyBundle: shortDesc (Bug 1) + price=$220 (Bug 3, primary only -- biotin addOn is optional)
  {
    const b = config.bundles.beautyBundle;
    const before = { shortDesc: b.shortDesc, price: b.price };
    b.shortDesc = 'A targeted skin, hair, and nails IV with biotin, glutathione, and vitamin C for collagen and antioxidant support.';
    b.price = 220;
    mutations.push({
      bug: 'Bug 1+3',
      path: 'bundles.beautyBundle',
      field: 'shortDesc + price',
      before: JSON.stringify(before),
      after: JSON.stringify({ shortDesc: b.shortDesc, price: b.price }),
    });
  }

  // nadPlusLabs: shortDesc (Bug 1) + price=$475 (Bug 3: nad250=$250 + labVitamin=$225)
  {
    const b = config.bundles.nadPlusLabs;
    const before = { shortDesc: b.shortDesc, price: b.price };
    b.shortDesc = 'NAD+ IV therapy paired with a vitamin level blood panel to identify deficiencies and guide your next session.';
    b.price = 475;
    mutations.push({
      bug: 'Bug 1+3',
      path: 'bundles.nadPlusLabs',
      field: 'shortDesc + price',
      before: JSON.stringify(before),
      after: JSON.stringify({ shortDesc: b.shortDesc, price: b.price }),
    });
  }

  // weightLossConsult: shortDesc (Bug 1) + pageUrl (Bug 2) + priceLabel (consultation, not fixed total)
  {
    const b = config.bundles.weightLossConsult;
    const before = { shortDesc: b.shortDesc, pageUrl: b.pageUrl, priceLabel: b.priceLabel };
    b.shortDesc = 'A no-commitment consultation to find the right GLP-1 program for your goals, with RN support from day one.';
    b.pageUrl = '/weight-loss-services/';
    b.priceLabel = 'from $199/month';
    mutations.push({
      bug: 'Bug 1+2',
      path: 'bundles.weightLossConsult',
      field: 'shortDesc + pageUrl + priceLabel',
      before: JSON.stringify(before),
      after: JSON.stringify({ shortDesc: b.shortDesc, pageUrl: b.pageUrl, priceLabel: b.priceLabel }),
    });
  }

  // jetLagMyers: shortDesc (Bug 1, no bundle-specific desc needed -- it IS a Myers', name matches)
  // But we should still add one so the fallback logic is explicit.
  // No price fix needed: jetLagMyers has no addOn, price = myers = $220.
  {
    const b = config.bundles.jetLagMyers;
    const before = { shortDesc: b.shortDesc, price: b.price };
    b.shortDesc = "Myers' Cocktail formulated for jet lag recovery: rehydration, B vitamins, and magnesium to reset your circadian rhythm.";
    b.price = 220;
    mutations.push({
      bug: 'Bug 1',
      path: 'bundles.jetLagMyers',
      field: 'shortDesc + price',
      before: JSON.stringify(before),
      after: JSON.stringify({ shortDesc: b.shortDesc, price: b.price }),
    });
  }

  // ---- Bug 4: NAD 500mg sublabel ----
  {
    const nadDose = config.questions.nadDose;
    const opt500 = nadDose?.options?.find((o) => o.recommend === 'nad500');
    if (!opt500) throw new Error('Could not find nadDose option with recommend=nad500');
    const before = opt500.sublabel;
    opt500.sublabel = 'Addiction recovery, withdrawal support, deep cellular repair. 90-120 min, $400';
    mutations.push({
      bug: 'Bug 4',
      path: 'questions.nadDose.options[recommend=nad500].sublabel',
      field: 'sublabel',
      before,
      after: opt500.sublabel,
    });
  }

  return mutations;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assertFixes(config) {
  const errors = [];

  // Bug 1
  for (const [id, expectedDesc] of [
    ['beautyBundle', 'A targeted skin, hair, and nails IV'],
    ['nadPlusLabs', 'NAD+ IV therapy paired with a vitamin level blood panel'],
    ['weightLossConsult', 'A no-commitment consultation'],
    ['jetLagMyers', "Myers' Cocktail formulated for jet lag"],
  ]) {
    const actual = config.bundles[id]?.shortDesc ?? '';
    if (!actual.startsWith(expectedDesc)) {
      errors.push(`bundles.${id}.shortDesc mismatch: got "${actual.slice(0, 80)}"`);
    }
  }

  // Bug 2
  const consultPageUrl = config.bundles.weightLossConsult?.pageUrl;
  if (consultPageUrl !== '/weight-loss-services/') {
    errors.push(`bundles.weightLossConsult.pageUrl: expected "/weight-loss-services/", got "${consultPageUrl}"`);
  }

  // Bug 3
  const priceChecks = [
    ['beautyBundle', 220],
    ['nadPlusLabs', 475],
  ];
  for (const [id, expectedPrice] of priceChecks) {
    const actual = config.bundles[id]?.price;
    if (actual !== expectedPrice) {
      errors.push(`bundles.${id}.price: expected ${expectedPrice}, got ${actual}`);
    }
  }
  const consultPriceLabel = config.bundles.weightLossConsult?.priceLabel;
  if (consultPriceLabel !== 'from $199/month') {
    errors.push(`bundles.weightLossConsult.priceLabel: expected "from $199/month", got "${consultPriceLabel}"`);
  }

  // Bug 4
  const nadDose = config.questions.nadDose;
  const opt500 = nadDose?.options?.find((o) => o.recommend === 'nad500');
  if (!opt500?.sublabel?.includes('Addiction recovery')) {
    errors.push(`nadDose 500mg sublabel missing "Addiction recovery": got "${opt500?.sublabel}"`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  if (DRY_RUN) console.log('[DRY RUN] Config will not be POSTed.\n');

  // Step 1: Fetch and snapshot current config
  console.log('Fetching current wizard config...');
  const config = await wpGet('/wizard-of-iv/v1/config', auth);
  console.log(
    `  ${Object.keys(config.treatments || {}).length} treatments, ` +
    `${Object.keys(config.bundles || {}).length} bundles, ` +
    `${Object.keys(config.questions || {}).length} questions`
  );

  const prePath = resolve(ROOT, 'claudedocs/kv-snapshot-pre-content-fix.json');
  writeFileSync(prePath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`  Pre-fix snapshot: claudedocs/kv-snapshot-pre-content-fix.json`);

  // Step 2: Apply mutations
  console.log('\nApplying fixes...');
  const mutations = applyFixes(config);
  for (const m of mutations) {
    console.log(`  [${m.bug}] ${m.path}.${m.field}`);
    console.log(`    before: ${m.before}`);
    console.log(`    after:  ${m.after}`);
  }

  if (DRY_RUN) {
    console.log('\nDry-run complete. No changes posted.');
    return;
  }

  // Step 3: POST
  console.log('\nPOSTing updated config...');
  const saveResult = await wpPost('/wizard-of-iv/v1/config', auth, config);
  if (!saveResult.success) {
    throw new Error('Config save returned success=false: ' + JSON.stringify(saveResult));
  }
  console.log('  Saved. updated_at:', saveResult.updated_at);

  // Step 4: Re-fetch and assert
  console.log('\nRe-fetching to verify changes...');
  const verified = await wpGet('/wizard-of-iv/v1/config', auth);
  const errors = assertFixes(verified);

  if (errors.length > 0) {
    console.error('\nASSERTION FAILURES:');
    errors.forEach((e) => console.error('  FAIL:', e));
    process.exit(1);
  }
  console.log('  All assertions passed.');

  // Step 5: Post-fix snapshot
  const postPath = resolve(ROOT, 'claudedocs/kv-snapshot-post-content-fix.json');
  writeFileSync(postPath, JSON.stringify(verified, null, 2), 'utf8');
  console.log('  Post-fix snapshot: claudedocs/kv-snapshot-post-content-fix.json');

  // Step 6: Summary
  console.log('\n=== SUMMARY ===');
  console.log(`  ${mutations.length} mutations applied and verified.`);
  console.log('  Bug 1: shortDesc added to all 4 bundles (beautyBundle, nadPlusLabs, weightLossConsult, jetLagMyers)');
  console.log('  Bug 2: weightLossConsult.pageUrl = /weight-loss-services/ (was: undefined, falling back to /treatments/semaglutide/)');
  console.log('  Bug 3: beautyBundle.price=220, nadPlusLabs.price=475 (was: undefined, falling back to primary prices of $220/$250)');
  console.log('         weightLossConsult.priceLabel="from $199/month" (consultation -- no single fixed total)');
  console.log('  Bug 4: nadDose 500mg sublabel now includes "Addiction recovery, withdrawal support, deep cellular repair"');
  console.log('  Code changes deployed separately: src/types/bundle.ts + src/components/ResultScreen.tsx + src/data/bundles.ts');
})();
