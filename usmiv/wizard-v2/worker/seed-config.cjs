/**
 * seed-config.cjs
 *
 * Seeds the KV namespace with the initial wizard config.
 * Run AFTER deploying the Worker and building the wizard app.
 *
 * Usage:
 *   node seed-config.cjs <path-to-config-json> [--preview]
 *
 * Example:
 *   node seed-config.cjs ../dist/config-export.json
 *   node seed-config.cjs initial-config.json --preview
 *
 * This script shells out to wrangler kv:key put, so wrangler must be installed
 * and you must be logged in (wrangler login).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const configPath = args.find((a) => !a.startsWith('--'));
const preview = args.includes('--preview');

if (!configPath) {
  console.error('Usage: node seed-config.cjs <path-to-config.json> [--preview]');
  process.exit(1);
}

const resolved = path.resolve(configPath);
if (!fs.existsSync(resolved)) {
  console.error('File not found:', resolved);
  process.exit(1);
}

const raw = fs.readFileSync(resolved, 'utf8');

// Validate JSON is parseable
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}

// Validate required keys
const required = ['treatments', 'bundles', 'questions'];
for (const key of required) {
  if (!(key in parsed)) {
    console.error('Missing required key in config:', key);
    process.exit(1);
  }
}

const previewFlag = preview ? ' --preview' : '';
const cmd = `wrangler kv:key put --binding=WIZARD_CONFIG${previewFlag} "wizard-config" "${resolved}" --path`;

console.log('Running:', cmd);
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Seed complete.');
} catch (e) {
  console.error('wrangler command failed.');
  process.exit(1);
}
