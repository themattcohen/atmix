/**
 * build-all.mjs -- Runs both Vite builds in sequence.
 *
 * 1. Wizard IIFE bundle  → dist/wizard.js + dist/wizard.css
 * 2. Admin dashboard     → dist/admin-dashboard.js + dist/admin-dashboard.css
 *
 * Called by `npm run build` after `tsc --noEmit` passes.
 * Uses BUILD_MODE env var to switch vite.config.ts between the two build configs.
 */

import { execSync } from 'child_process';

function run(cmd, env = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

run('vite build');
run('vite build', { BUILD_MODE: 'admin' });

console.log('\nBoth bundles built successfully.');
