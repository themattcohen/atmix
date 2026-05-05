/**
 * drop-isConsultation.mjs
 *
 * One-time cleanup: removes the `isConsultation` key from every bundle in
 * the live wp_option('wizard_of_iv_config').
 *
 * Steps:
 *   1. GET current config via WP REST endpoint.
 *   2. Walk bundles.* and delete the isConsultation key from each.
 *   3. POST cleaned config back.
 *   4. Re-fetch and verify no bundle has the field.
 *
 * Auth: WP_USER + WP_APP_PASSWORD from Doppler prd_usmiv.
 *
 * Usage: node scripts/drop-isConsultation.mjs [--dry-run]
 */

import { execSync } from 'node:child_process';

const WP_CONFIG_URL = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';
const DRY_RUN = process.argv.includes('--dry-run');

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

async function main() {
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  // 1. GET current config
  console.log('Fetching current config...');
  const getResp = await fetch(WP_CONFIG_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!getResp.ok) {
    throw new Error(`GET failed: HTTP ${getResp.status} ${await getResp.text()}`);
  }
  const config = await getResp.json();

  if (!config || !config.bundles) {
    throw new Error('Config missing or has no bundles key');
  }

  // 2. Walk bundles and remove isConsultation
  const bundles = config.bundles;
  let cleanedCount = 0;
  let foundCount = 0;

  for (const [bundleId, bundle] of Object.entries(bundles)) {
    if (Object.prototype.hasOwnProperty.call(bundle, 'isConsultation')) {
      foundCount++;
      if (!DRY_RUN) {
        delete bundle.isConsultation;
        cleanedCount++;
      }
      console.log(`  ${DRY_RUN ? '[dry-run] would remove' : 'removed'} isConsultation from bundle: ${bundleId}`);
    }
  }

  if (foundCount === 0) {
    console.log('No bundles have isConsultation -- nothing to do.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\nDry run: ${foundCount} bundle(s) would be cleaned. Re-run without --dry-run to apply.`);
    return;
  }

  // 3. POST cleaned config back
  console.log(`\nPosting cleaned config (${cleanedCount} bundle(s) cleaned)...`);
  const postResp = await fetch(WP_CONFIG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
    },
    body: JSON.stringify(config),
  });

  if (!postResp.ok) {
    const body = await postResp.text();
    throw new Error(`POST failed: HTTP ${postResp.status} ${body}`);
  }

  // 4. Verify via re-fetch
  console.log('Verifying...');
  const verifyResp = await fetch(WP_CONFIG_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!verifyResp.ok) {
    throw new Error(`Verification GET failed: HTTP ${verifyResp.status}`);
  }
  const verified = await verifyResp.json();

  let remaining = 0;
  for (const [bundleId, bundle] of Object.entries(verified.bundles || {})) {
    if (Object.prototype.hasOwnProperty.call(bundle, 'isConsultation')) {
      console.error(`  FAIL: bundle ${bundleId} still has isConsultation = ${bundle.isConsultation}`);
      remaining++;
    }
  }

  if (remaining === 0) {
    console.log(`\nDone. ${cleanedCount} bundle(s) cleaned. No remaining isConsultation fields.`);
  } else {
    throw new Error(`Verification failed: ${remaining} bundle(s) still have isConsultation.`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
