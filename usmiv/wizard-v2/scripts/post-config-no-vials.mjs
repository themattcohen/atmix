/**
 * post-config-no-vials.mjs
 *
 * Owner decision 2026-06-14: "vials shouldn't be offered in the wizard. only add on shots."
 * The live WP config priced 3 injections as $150/vial (lipoShots, b12Shot, glutathioneShot);
 * the other 3 were already $35/shot. This normalizes ALL injection treatments to the $35
 * add-on shot (price 35, priceLabel '$35/shot'), matching the static catalog. No vial offering.
 *
 * POSTing the config also fires update_option_wizard_of_iv_config -> rocket_clean_domain
 * (CDN page-cache purge).
 *
 * Usage:
 *   doppler run --project atmix --config prd_usmiv -- node scripts/post-config-no-vials.mjs
 */
import { execSync } from 'node:child_process';

const CONFIG_URL = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';
const SHOT_PRICE = 35;
const SHOT_LABEL = '$35/shot';

function getCreds() {
  if (process.env.WP_USER && process.env.WP_APP_PASSWORD) {
    return { user: process.env.WP_USER, pass: process.env.WP_APP_PASSWORD };
  }
  const raw = execSync(
    'doppler secrets get WP_USER WP_APP_PASSWORD --project atmix --config prd_usmiv --plain',
    { encoding: 'utf8' }
  ).trim();
  const [user, pass] = raw.split('\n');
  if (!user || !pass) throw new Error('Could not read WP_USER / WP_APP_PASSWORD from Doppler');
  return { user: user.trim(), pass: pass.trim() };
}

const basicAuth = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

async function main() {
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  console.log('GET current config...');
  const getRes = await fetch(CONFIG_URL, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' } });
  if (!getRes.ok) throw new Error(`GET returned HTTP ${getRes.status}`);
  const config = await getRes.json();

  const treatments = config.treatments || {};
  const changed = [];
  for (const [id, t] of Object.entries(treatments)) {
    if (t && t.category === 'injection') {
      const before = `price=${t.price} priceLabel=${JSON.stringify(t.priceLabel)}`;
      if (t.price !== SHOT_PRICE || t.priceLabel !== SHOT_LABEL) {
        t.price = SHOT_PRICE;
        t.priceLabel = SHOT_LABEL;
        changed.push(`  ${id}: ${before} -> price=${SHOT_PRICE} priceLabel="${SHOT_LABEL}"`);
      }
    }
  }
  if (!changed.length) {
    console.log('No injection priced as a vial — nothing to change. Exiting.');
    return;
  }
  console.log('Changes:'); changed.forEach((c) => console.log(c));

  console.log('\nPOSTing updated config...');
  const postRes = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, 'Cache-Control': 'no-cache' },
    body: JSON.stringify(config),
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => '');
    throw new Error(`POST returned HTTP ${postRes.status}: ${text.slice(0, 400)}`);
  }
  console.log(`POST OK (HTTP ${postRes.status})`);

  console.log('\nVerifying via GET...');
  const vRes = await fetch(CONFIG_URL, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' } });
  const verified = await vRes.json();
  let ok = true;
  for (const [id, t] of Object.entries(verified.treatments || {})) {
    if (t && t.category === 'injection') {
      const pass = t.price === SHOT_PRICE && t.priceLabel === SHOT_LABEL;
      console.log(`  [${pass ? 'OK' : 'FAIL'}] ${id}: price=${t.price} priceLabel=${JSON.stringify(t.priceLabel)}`);
      if (!pass) ok = false;
    }
  }
  if (!ok) { console.error('\nVerification FAILED.'); process.exit(1); }
  console.log('\nAll injections are $35/shot. No vials offered.');
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
