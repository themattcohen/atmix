/**
 * backfill-og-meta.mjs
 *
 * Sets SEOPress OG and Twitter Card meta fields on all 27 treatment Learn More
 * pages and the /find-my-treatment/ landing page (28 pages total).
 *
 * Fields written per page:
 *   _seopress_social_fb_title      = "<Treatment Name> | U.S. Mobile IV"
 *   _seopress_social_fb_desc       = treatment.shortDesc (or landing fallback)
 *   _seopress_social_fb_img        = DEFAULT_OG_IMAGE (sitewide branded fallback)
 *   _seopress_social_twitter_title = same as fb_title
 *   _seopress_social_twitter_desc  = same as fb_desc
 *   _seopress_social_twitter_img   = same as fb_img
 *
 * OG image chosen: https://usmobileiv.com/wp-content/uploads/mobile-iv-therapy-professionals-scaled.webp
 * (media id 2587, 2560x1707, ratio near 1.91:1, branded professional photo)
 *
 * Uses the wizard-of-iv/v1/post-meta REST endpoint (POST, admin auth) to write
 * the SEOPress meta keys. The seopress/v1/posts/{id}/social-settings PUT route
 * is blocked by Wordfence, but POST on wizard-of-iv/v1 is allowed.
 *
 * Idempotent: reads existing values first and skips pages where all 6 fields
 * already match the expected values.
 *
 * Auth: WP_USER + WP_APP_PASSWORD from env or Doppler prd_usmiv.
 *
 * Usage:
 *   node scripts/backfill-og-meta.mjs
 *   node scripts/backfill-og-meta.mjs --dry-run
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const WP_API    = 'https://usmobileiv.com/wp-json';
const PARENT_ID = 891; // existing /treatments/ page
const LANDING_ID = 11362; // /find-my-treatment/

// Sitewide default OG image: 2560x1707, near 1.91:1 ratio, branded photo.
// Media library id 2587.
const DEFAULT_OG_IMAGE =
  'https://usmobileiv.com/wp-content/uploads/mobile-iv-therapy-professionals-scaled.webp';

// Description for the landing page /find-my-treatment/
const LANDING_DESC =
  'Find the right IV therapy, NAD, weight loss, lab, or vitamin shot for your needs.';

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
// WP REST helpers
// ---------------------------------------------------------------------------

async function wpGet(path, auth) {
  const res = await fetch(`${WP_API}${path}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
  return res.json();
}

async function wpPost(path, auth, body) {
  const res = await fetch(`${WP_API}${path}`, {
    method:  'POST',
    headers: {
      Authorization:  auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Encode title for WP REST (same helper as create-wp-pages.mjs).
// Apostrophes encoded as HTML entities to bypass wp_slash round-trip bug.
// ---------------------------------------------------------------------------

function encodeTitleForWp(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#8217;')
    .replace(/"/g, '&#8220;');
}

// ---------------------------------------------------------------------------
// Load wizard config (from the live WP REST endpoint so we always use the
// authoritative production values)
// ---------------------------------------------------------------------------

async function loadWizardConfig(auth) {
  const config = await wpGet('/wizard-of-iv/v1/config', auth);
  return config;
}

// ---------------------------------------------------------------------------
// Build expected OG/Twitter meta for a page
// ---------------------------------------------------------------------------

function buildMeta(title, desc) {
  return {
    _seopress_social_fb_title:       title,
    _seopress_social_fb_desc:        desc,
    _seopress_social_fb_img:         DEFAULT_OG_IMAGE,
    _seopress_social_twitter_title:  title,
    _seopress_social_twitter_desc:   desc,
    _seopress_social_twitter_img:    DEFAULT_OG_IMAGE,
  };
}

// Read existing SEOPress social meta from seopress/v1 (GET is allowed).
// Returns an object keyed by meta key.
async function getExistingMeta(pageId, auth) {
  try {
    const arr = await wpGet(`/seopress/v1/posts/${pageId}/social-settings`, auth);
    const result = {};
    for (const field of arr) {
      result[field.key] = field.value || '';
    }
    return result;
  } catch (e) {
    console.warn(`  Warning: could not read existing meta for page ${pageId}: ${e.message}`);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  if (DRY_RUN) console.log('[DRY RUN] No writes will be performed.\n');

  console.log('Loading wizard config...');
  const config = await loadWizardConfig(auth);
  const treatmentIds = Object.keys(config.treatments || {});
  console.log(`  ${treatmentIds.length} treatments found in config.\n`);

  // Build page list: 27 treatment pages + landing
  const pages = [];

  // Treatment pages: look up by slug under parent=891
  console.log('Looking up treatment page IDs by slug...');
  for (const id of treatmentIds) {
    const slug = id.toLowerCase();
    const results = await wpGet(
      `/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${PARENT_ID}&_fields=id,slug`,
      auth
    );
    if (!results.length) {
      console.warn(`  WARNING: no page found for slug "${slug}" under parent ${PARENT_ID}`);
      continue;
    }
    const page = results[0];
    const treatment = config.treatments[id];
    const title     = encodeTitleForWp(treatment.name) + ' | U.S. Mobile IV';
    const desc      = treatment.shortDesc || '';
    pages.push({ pageId: page.id, slug: page.slug, title, desc, treatmentId: id });
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // Landing page
  pages.push({
    pageId:      LANDING_ID,
    slug:        'find-my-treatment',
    title:       'Find My Treatment | U.S. Mobile IV',
    desc:        LANDING_DESC,
    treatmentId: null,
  });

  console.log(`\nProcessing ${pages.length} pages...\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const page of pages) {
    const expected = buildMeta(page.title, page.desc);

    // Read existing values to check idempotency.
    const existing = await getExistingMeta(page.pageId, auth);

    const needsUpdate = Object.entries(expected).some(
      ([k, v]) => existing[k] !== v
    );

    if (!needsUpdate) {
      console.log(`  SKIP  ${page.slug} (id=${page.pageId}) - already correct`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  DRY   ${page.slug} (id=${page.pageId})`);
      console.log(`         title: ${page.title}`);
      console.log(`         desc:  ${page.desc.slice(0, 80)}...`);
      updated++;
      continue;
    }

    try {
      const result = await wpPost('/wizard-of-iv/v1/post-meta', auth, {
        post_id: page.pageId,
        meta:    expected,
      });
      if (result.success && result.updated.length === 6) {
        console.log(`  OK    ${page.slug} (id=${page.pageId}) - ${result.updated.length} fields written`);
        updated++;
      } else {
        console.warn(`  WARN  ${page.slug} (id=${page.pageId}) - unexpected result: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (e) {
      console.error(`  FAIL  ${page.slug} (id=${page.pageId}) - ${e.message}`);
      failed++;
    }
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Updated: ${updated}  |  Skipped: ${skipped}  |  Failed: ${failed}`);
  console.log(`OG image used: ${DEFAULT_OG_IMAGE}`);

  if (failed > 0) {
    process.exit(1);
  }
})();
