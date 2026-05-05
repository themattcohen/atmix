/**
 * package-wp-plugin.mjs
 *
 * Assembles the WordPress plugin into dist/wizard-of-iv-plugin/ and then
 * compresses it to dist/wizard-of-iv-plugin.zip.
 *
 * Requires the Vite build to have run first (Step 4):
 *   dist/wizard.js, dist/wizard.css
 *   dist/admin-dashboard.js, dist/admin-dashboard.css
 *
 * ZIP strategy: shells out to PowerShell Compress-Archive (available on
 * Windows). On Linux/macOS the script falls back to the `zip` CLI.
 *
 * Usage: node scripts/package-wp-plugin.mjs
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DIST        = resolve(ROOT, 'dist');
const PLUGIN_DIR  = resolve(DIST, 'wizard-of-iv-plugin');
const ASSETS_DIR  = resolve(PLUGIN_DIR, 'assets');
const ZIP_PATH    = resolve(DIST, 'wizard-of-iv-plugin.zip');

const REQUIRED_DIST_ASSETS = [
  'wizard.js',
  'wizard.css',
  'admin-dashboard.js',
  'admin-dashboard.css',
];

const STATIC_ASSETS = [
  'treatment-sync.js',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abort(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function copy(src, dest) {
  copyFileSync(src, dest);
  console.log(`  copied  ${src.replace(ROOT, '.')}  ->  ${dest.replace(ROOT, '.')}`);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function verifyDistAssets() {
  let ok = true;
  for (const f of REQUIRED_DIST_ASSETS) {
    const p = resolve(DIST, f);
    if (!existsSync(p)) {
      console.error(`  MISSING: dist/${f}`);
      ok = false;
    } else {
      console.log(`  found:   dist/${f}`);
    }
  }
  if (!ok) {
    abort(
      'One or more built assets are missing from dist/. ' +
      'Run the Vite build (Step 4) before packaging.'
    );
  }
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

function zipPlugin() {
  // Remove stale zip
  if (existsSync(ZIP_PATH)) {
    rmSync(ZIP_PATH);
  }

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // PowerShell Compress-Archive
    const ps = `Compress-Archive -Path "${PLUGIN_DIR}" -DestinationPath "${ZIP_PATH}" -Force`;
    console.log('Zipping via PowerShell Compress-Archive...');
    execSync(`powershell.exe -NonInteractive -Command "${ps}"`, { stdio: 'inherit' });
  } else {
    // POSIX zip CLI
    console.log('Zipping via zip CLI...');
    execSync(`zip -r "${ZIP_PATH}" "wizard-of-iv-plugin"`, {
      cwd: DIST,
      stdio: 'inherit',
    });
  }

  if (!existsSync(ZIP_PATH)) {
    abort('ZIP was not created. Check the zip tool output above.');
  }
  console.log(`ZIP created: dist/wizard-of-iv-plugin.zip`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('Verifying built assets...');
  verifyDistAssets();

  // Clean and recreate plugin dir
  if (existsSync(PLUGIN_DIR)) {
    console.log('Cleaning existing dist/wizard-of-iv-plugin/...');
    rmSync(PLUGIN_DIR, { recursive: true, force: true });
  }
  ensureDir(PLUGIN_DIR);
  ensureDir(ASSETS_DIR);

  console.log('\nCopying PHP files...');
  copy(resolve(ROOT, 'wordpress', 'wizard-of-iv.php'), resolve(PLUGIN_DIR, 'wizard-of-iv.php'));
  copy(resolve(ROOT, 'wordpress', 'admin-page.php'),   resolve(PLUGIN_DIR, 'admin-page.php'));

  console.log('\nCopying built assets to assets/...');
  for (const f of REQUIRED_DIST_ASSETS) {
    copy(resolve(DIST, f), resolve(ASSETS_DIR, f));
  }

  console.log('\nCopying static assets to assets/...');
  for (const f of STATIC_ASSETS) {
    const src = resolve(ROOT, 'wordpress', f);
    if (!existsSync(src)) {
      abort(`Static asset not found: wordpress/${f}`);
    }
    copy(src, resolve(ASSETS_DIR, f));
  }

  // treatments-detail.json lives in wordpress/assets/ but copies to plugin assets/ flat
  const detailSrc  = resolve(ROOT, 'wordpress', 'assets', 'treatments-detail.json');
  const detailDest = resolve(ASSETS_DIR, 'treatments-detail.json');
  if (!existsSync(detailSrc)) {
    abort('Static asset not found: wordpress/assets/treatments-detail.json');
  }
  copy(detailSrc, detailDest);

  console.log('\nPackaging ZIP...');
  zipPlugin();

  console.log('\nDone. Plugin package ready at dist/wizard-of-iv-plugin.zip');
}

main();
