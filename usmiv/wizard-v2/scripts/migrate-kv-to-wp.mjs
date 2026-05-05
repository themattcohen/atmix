/**
 * migrate-kv-to-wp.mjs
 *
 * One-shot migration: reads claudedocs/kv-snapshot-pre.json, rewrites
 * all treatment pageUrl values from /wizard-of-iv/treatments/?slug=<id>
 * to /treatments/<id>/, then POSTs to the WP REST config endpoint.
 *
 * After the POST it re-fetches the endpoint and asserts the stored value
 * matches what was sent (modulo whitespace).
 *
 * Writes claudedocs/wp-config-snapshot-post-migration.json.
 *
 * Auth: reads WP_USER / WP_APP_PASSWORD from env, or pulls from Doppler
 * prd_usmiv.
 *
 * Usage: node scripts/migrate-kv-to-wp.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
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
// URL migration
// ---------------------------------------------------------------------------

// Accepts the parsed config object and rewrites pageUrl for every treatment.
// Input pattern: /wizard-of-iv/treatments/?slug=<id>  (query-string form)
//                /wizard-of-iv/treatments/<id>/        (clean-URL form, already migrated)
// Output:        /treatments/<id>/
function rewritePageUrls(config) {
  if (!config || typeof config.treatments !== 'object') {
    throw new Error('Config missing top-level "treatments" object');
  }

  for (const [id, treatment] of Object.entries(config.treatments)) {
    const original = treatment.pageUrl || '';

    // Already in new form
    if (original.startsWith('/treatments/')) {
      continue;
    }

    // ?slug= form: /wizard-of-iv/treatments/?slug=<id>
    const slugMatch = original.match(/[?&]slug=([^&]+)/);
    if (slugMatch) {
      treatment.pageUrl = `/treatments/${slugMatch[1]}/`;
      continue;
    }

    // /wizard-of-iv/treatments/<id>/ form
    const pathMatch = original.match(/\/wizard-of-iv\/treatments\/([^/?]+)\/?/);
    if (pathMatch) {
      treatment.pageUrl = `/treatments/${pathMatch[1]}/`;
      continue;
    }

    // Fallback: use the treatment id from the key
    console.warn(`Warning: could not parse pageUrl "${original}" for id "${id}" — using id as slug`);
    treatment.pageUrl = `/treatments/${id}/`;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Normalised JSON comparison (ignores whitespace differences)
// ---------------------------------------------------------------------------

function normalise(obj) {
  return JSON.stringify(JSON.parse(typeof obj === 'string' ? obj : JSON.stringify(obj)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const snapshotPath = resolve(ROOT, 'claudedocs', 'kv-snapshot-pre.json');
  const outputPath   = resolve(ROOT, 'claudedocs', 'wp-config-snapshot-post-migration.json');

  // Read snapshot
  console.log(`Reading ${snapshotPath}...`);
  const snapshotRaw = readFileSync(snapshotPath, 'utf8');
  const snapshot    = JSON.parse(snapshotRaw);
  console.log(`Snapshot parsed. Treatment count: ${Object.keys(snapshot.treatments || {}).length}`);

  // Rewrite URLs
  const mutated     = rewritePageUrls(JSON.parse(snapshotRaw)); // parse fresh copy
  const mutatedJson = JSON.stringify(mutated, null, 2);

  // Count rewrites
  let rewritten = 0;
  for (const id of Object.keys(mutated.treatments || {})) {
    const orig = (snapshot.treatments[id] || {}).pageUrl || '';
    const next = mutated.treatments[id].pageUrl || '';
    if (orig !== next) rewritten++;
  }
  console.log(`pageUrl rewrites: ${rewritten}`);

  // Credentials
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  // POST to WP
  console.log(`POSTing to ${CONFIG_URL}...`);
  const postRes = await fetch(CONFIG_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': auth,
    },
    body: mutatedJson,
  });

  if (!postRes.ok) {
    const text = await postRes.text();
    throw new Error(`POST failed: HTTP ${postRes.status}\n${text}`);
  }

  const postBody = await postRes.json();
  console.log('POST response:', JSON.stringify(postBody));

  // Verify by re-fetching
  console.log('Re-fetching to verify...');
  const getRes = await fetch(CONFIG_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!getRes.ok) {
    throw new Error(`GET verification failed: HTTP ${getRes.status}`);
  }
  const stored = await getRes.json();

  const sentNorm   = normalise(mutated);
  const storedNorm = normalise(stored);

  if (sentNorm !== storedNorm) {
    writeFileSync(outputPath, JSON.stringify(stored, null, 2), 'utf8');
    throw new Error(
      'Verification FAILED: stored config does not match what was sent.\n' +
      `Sent length: ${sentNorm.length}, Stored length: ${storedNorm.length}`
    );
  }

  // Write snapshot
  writeFileSync(outputPath, JSON.stringify(stored, null, 2), 'utf8');
  console.log(`Post-migration snapshot written to claudedocs/wp-config-snapshot-post-migration.json`);
  console.log('Migration COMPLETE. Verification passed.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
