/**
 * post-config-2.0.13.mjs
 *
 * Restores Vitamin C and NAD+ mg/g amounts that were incorrectly stripped in
 * commit 9996b41.
 *
 * Changes applied:
 *   1. longevity.addressedBy['Brain fog / can't focus']: restore 'NAD+ 50mg'
 *   2. myersPlatinum.ingredients[2].name: 'Vitamin C (high dose)' -> 'Vitamin C (25g)'
 *   3. myersPlatinum.whyMatch: restore '50mg of NAD+'
 *   4. myersPlatinum.addressedBy['Brain fog / can't focus']: restore 'NAD+ 50mg'
 *
 * Usage:
 *   doppler run --project atmix --config prd_usmiv -- node scripts/post-config-2.0.13.mjs
 */

import { execSync } from 'node:child_process';

const CONFIG_URL = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';

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

  console.log('GET current config...');
  const getRes = await fetch(CONFIG_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
  });
  if (!getRes.ok) throw new Error(`GET returned HTTP ${getRes.status}`);
  const config = await getRes.json();

  // --- Fix 1: longevity.addressedBy 'Brain fog / can't focus' ---
  const longevityAddressedBy = config.treatments?.longevity?.addressedBy;
  if (!longevityAddressedBy) throw new Error('longevity.addressedBy not found');
  const old1 = longevityAddressedBy["Brain fog / can't focus"];
  longevityAddressedBy["Brain fog / can't focus"] = "NAD+ 50mg + full vitamin stack for mental clarity";
  console.log(`longevity.addressedBy['Brain fog']:  "${old1}" -> "${longevityAddressedBy["Brain fog / can't focus"]}"`);

  // --- Fix 2: myersPlatinum.ingredients[2].name ---
  const mpIngredients = config.treatments?.myersPlatinum?.ingredients;
  if (!mpIngredients) throw new Error('myersPlatinum.ingredients not found');
  const vitCEntry = mpIngredients.find(
    (i) => i.name === 'Vitamin C (high dose)' || i.name === 'Vitamin C (25g)'
  );
  if (!vitCEntry) throw new Error('myersPlatinum Vitamin C ingredient not found. Current entries: ' + mpIngredients.map(i=>i.name).join(', '));
  const old2 = vitCEntry.name;
  vitCEntry.name = 'Vitamin C (25g)';
  console.log(`myersPlatinum.ingredients[VC].name: "${old2}" -> "${vitCEntry.name}"`);

  // --- Fix 3: myersPlatinum.whyMatch ---
  const mp = config.treatments?.myersPlatinum;
  if (!mp) throw new Error('myersPlatinum not found');
  const old3 = mp.whyMatch;
  // Replace stripped 'NAD+' with '50mg of NAD+' in the whyMatch string
  mp.whyMatch = mp.whyMatch.replace(
    'plus NAD+ for cellular energy repair',
    'plus 50mg of NAD+ for cellular energy repair'
  );
  console.log(`myersPlatinum.whyMatch: "${old3.slice(0, 80)}..." -> "${mp.whyMatch.slice(0, 80)}..."`);

  // --- Fix 4: myersPlatinum.addressedBy 'Brain fog / can't focus' ---
  const mpAddressedBy = config.treatments?.myersPlatinum?.addressedBy;
  if (!mpAddressedBy) throw new Error('myersPlatinum.addressedBy not found');
  const old4 = mpAddressedBy["Brain fog / can't focus"];
  mpAddressedBy["Brain fog / can't focus"] = "NAD+ 50mg combined with triple B-Complex for peak cognitive support";
  console.log(`myersPlatinum.addressedBy['Brain fog']: "${old4}" -> "${mpAddressedBy["Brain fog / can't focus"]}"`);

  // --- POST ---
  console.log('\nPOSTing updated config...');
  const postRes = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(config),
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => '');
    throw new Error(`POST returned HTTP ${postRes.status}: ${text.slice(0, 400)}`);
  }
  console.log(`POST OK (HTTP ${postRes.status})`);

  // --- Verify ---
  console.log('\nVerifying via GET...');
  const verifyRes = await fetch(CONFIG_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
  });
  if (!verifyRes.ok) throw new Error(`Verify GET returned HTTP ${verifyRes.status}`);
  const verified = await verifyRes.json();

  const checks = [
    {
      label: "longevity.addressedBy['Brain fog']",
      actual: verified.treatments?.longevity?.addressedBy?.["Brain fog / can't focus"],
      expected: "NAD+ 50mg + full vitamin stack for mental clarity",
    },
    {
      label: "myersPlatinum.ingredients VC name",
      actual: verified.treatments?.myersPlatinum?.ingredients?.find(i => i.name?.includes('Vitamin C'))?.name,
      expected: "Vitamin C (25g)",
    },
    {
      label: "myersPlatinum.whyMatch contains '50mg of NAD+'",
      actual: verified.treatments?.myersPlatinum?.whyMatch?.includes('50mg of NAD+') ? 'yes' : 'no',
      expected: "yes",
    },
    {
      label: "myersPlatinum.addressedBy['Brain fog']",
      actual: verified.treatments?.myersPlatinum?.addressedBy?.["Brain fog / can't focus"],
      expected: "NAD+ 50mg combined with triple B-Complex for peak cognitive support",
    },
  ];

  let allPassed = true;
  console.log('\n=== Verification ===');
  for (const { label, actual, expected } of checks) {
    const pass = actual === expected;
    console.log(`  [${pass ? 'OK' : 'FAIL'}] ${label}`);
    if (!pass) {
      console.log(`         expected: ${expected}`);
      console.log(`         actual:   ${actual}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('\nSome checks failed.');
    process.exit(1);
  }
  console.log('\nAll checks passed. Config v2.0.13 live.');
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
