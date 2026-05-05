/**
 * audit-learn-more.mjs
 *
 * Validates catalog completeness against the live WP REST config endpoint.
 *
 * Checks:
 *   - Catalog count = 27
 *   - No duplicate ids
 *   - Every pageUrl matches ^/treatments/[^/]+/$
 *   - Every catalog id exists in the WP config with non-empty name, price,
 *     shortDesc, pageUrl
 *
 * Writes claudedocs/learn-more-coverage.md.
 * Exits 1 on any failure.
 *
 * Auth: reads WP_USER / WP_APP_PASSWORD from environment, or pulls from
 * Doppler prd_usmiv if not set. (GET /config is public; creds are only
 * fetched to confirm they are available for other scripts.)
 *
 * Usage: node scripts/audit-learn-more.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Doppler / env helpers
// ---------------------------------------------------------------------------

function getEnvOrDoppler(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    const result = {};
    keys.forEach((k) => { result[k] = process.env[k]; });
    return result;
  }
  console.log(`Fetching ${missing.join(', ')} from Doppler prd_usmiv...`);
  const raw = execSync(
    `doppler secrets get ${missing.join(' ')} --project atmix --config prd_usmiv --plain`,
    { encoding: 'utf8' }
  ).trim();
  // doppler --plain outputs values one per line in the order requested
  const values = raw.split('\n');
  const result = {};
  keys.forEach((k) => {
    result[k] = process.env[k] || values[missing.indexOf(k)] || '';
  });
  return result;
}

// ---------------------------------------------------------------------------
// Catalog parsing
// ---------------------------------------------------------------------------

const CATALOG_FILES = [
  'src/data/catalog/iv.ts',
  'src/data/catalog/injections.ts',
  'src/data/catalog/labs.ts',
  'src/data/catalog/nad.ts',
  'src/data/catalog/weightLoss.ts',
];

const EXPECTED_COUNT = 27;
const PAGE_URL_RE = /^\/treatments\/[^/]+\/$/;

function parseCatalogFile(filePath) {
  const src = readFileSync(resolve(ROOT, filePath), 'utf8');
  const treatments = [];

  // Match each exported const block: export const <id> = { ... }
  // Use a regex that captures id, name, price, pageUrl from the object literal.
  // The format is consistent across all 5 files (see iv.ts for reference).
  const objectRe = /export\s+const\s+(\w+)\s*=\s*\{([^]*?)\}\s+as\s+const/g;
  let match;
  while ((match = objectRe.exec(src)) !== null) {
    const varName = match[1];
    const body = match[2];

    const idMatch      = body.match(/\bid\s*:\s*'([^']+)'/);
    const nameMatch    = body.match(/\bname\s*:\s*'([^']+)'/);
    const priceMatch   = body.match(/\bprice\s*:\s*(\d+)/);
    const pageUrlMatch = body.match(/\bpageUrl\s*:\s*'([^']+)'/);

    if (!idMatch) continue; // skip array exports like IV_TREATMENTS

    treatments.push({
      varName,
      id:      idMatch[1],
      name:    nameMatch    ? nameMatch[1]         : '',
      price:   priceMatch   ? Number(priceMatch[1]) : null,
      pageUrl: pageUrlMatch ? pageUrlMatch[1]       : '',
      sourceFile: filePath,
    });
  }

  return treatments;
}

function loadAllTreatments() {
  const all = [];
  for (const f of CATALOG_FILES) {
    const items = parseCatalogFile(f);
    all.push(...items);
  }
  return all;
}

// ---------------------------------------------------------------------------
// WP REST fetch
// ---------------------------------------------------------------------------

async function fetchWpConfig() {
  const url = 'https://usmobileiv.com/wp-json/wizard-of-iv/v1/config';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} returned HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------------

function buildReport(rows, errors) {
  const lines = [
    '# Learn More Coverage Audit',
    '',
    `Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} MT`,
    '',
    `Total catalog entries: ${rows.length}`,
    '',
    '## Coverage Table',
    '',
    '| ID | Name | Catalog pageUrl | WP name | WP price | WP shortDesc | WP pageUrl | Status |',
    '|----|------|-----------------|---------|----------|--------------|------------|--------|',
  ];

  for (const r of rows) {
    const status = r.errors.length === 0 ? 'OK' : 'FAIL: ' + r.errors.join('; ');
    lines.push(
      `| ${r.id} | ${r.catalogName} | ${r.catalogPageUrl} | ${r.wpName || '-'} | ${r.wpPrice || '-'} | ${r.wpShortDesc ? r.wpShortDesc.substring(0, 30) + '...' : '-'} | ${r.wpPageUrl || '-'} | ${status} |`
    );
  }

  if (errors.length > 0) {
    lines.push('', '## Errors', '');
    for (const e of errors) {
      lines.push(`- ${e}`);
    }
  } else {
    lines.push('', '## Result', '', 'All 27 treatments verified. No issues found.');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const allErrors = [];

  // Load catalog
  const treatments = loadAllTreatments();

  // Check count
  if (treatments.length !== EXPECTED_COUNT) {
    allErrors.push(`Catalog count is ${treatments.length}, expected ${EXPECTED_COUNT}`);
  } else {
    console.log(`Catalog: ${treatments.length} treatments found (expected ${EXPECTED_COUNT}). OK`);
  }

  // Check for duplicate ids
  const seenIds = new Map();
  for (const t of treatments) {
    if (seenIds.has(t.id)) {
      allErrors.push(`Duplicate id "${t.id}" in ${t.sourceFile} and ${seenIds.get(t.id)}`);
    } else {
      seenIds.set(t.id, t.sourceFile);
    }
  }
  if (allErrors.filter((e) => e.includes('Duplicate')).length === 0) {
    console.log('No duplicate ids. OK');
  }

  // Check pageUrls match expected pattern
  const pageUrlErrors = [];
  for (const t of treatments) {
    if (!PAGE_URL_RE.test(t.pageUrl)) {
      pageUrlErrors.push(`${t.id}: pageUrl "${t.pageUrl}" does not match ^/treatments/[^/]+/$`);
    }
  }
  allErrors.push(...pageUrlErrors);
  if (pageUrlErrors.length === 0) {
    console.log('All pageUrls match /treatments/<id>/. OK');
  }

  // Fetch WP config
  console.log('Fetching WP REST config...');
  let wpConfig;
  try {
    wpConfig = await fetchWpConfig();
    console.log('WP config fetched. OK');
  } catch (err) {
    allErrors.push(`Failed to fetch WP config: ${err.message}`);
    wpConfig = { treatments: {} };
  }

  const wpTreatments = (wpConfig && wpConfig.treatments) ? wpConfig.treatments : {};

  // Build per-treatment rows
  const rows = [];
  for (const t of treatments) {
    const wp = wpTreatments[t.id] || null;
    const rowErrors = [];

    if (!wp) {
      rowErrors.push('missing from WP config');
    } else {
      if (!wp.name)      rowErrors.push('name is empty in WP');
      if (!wp.price)     rowErrors.push('price is empty in WP');
      if (!wp.shortDesc) rowErrors.push('shortDesc is empty in WP');
      if (!wp.pageUrl)   rowErrors.push('pageUrl is empty in WP');
    }

    rows.push({
      id:             t.id,
      catalogName:    t.name,
      catalogPageUrl: t.pageUrl,
      wpName:         wp ? wp.name       : null,
      wpPrice:        wp ? wp.price      : null,
      wpShortDesc:    wp ? wp.shortDesc  : null,
      wpPageUrl:      wp ? wp.pageUrl    : null,
      errors:         rowErrors,
    });

    allErrors.push(...rowErrors.map((e) => `${t.id}: ${e}`));
  }

  // Write report
  const reportPath = resolve(ROOT, 'claudedocs', 'learn-more-coverage.md');
  const reportContent = buildReport(rows, allErrors);
  writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`Report written to claudedocs/learn-more-coverage.md`);

  if (allErrors.length > 0) {
    console.error(`\nAudit FAILED with ${allErrors.length} error(s):`);
    allErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('\nAudit PASSED. 27/27 treatments verified.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
