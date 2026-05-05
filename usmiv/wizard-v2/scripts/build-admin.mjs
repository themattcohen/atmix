/**
 * build-admin.mjs -- Builds only the admin dashboard bundle.
 *
 * Output: dist/admin-dashboard.js + dist/admin-dashboard.css
 *
 * Called by `npm run build:admin` after `tsc --noEmit` passes.
 */

import { execSync } from 'child_process';

execSync('vite build', {
  stdio: 'inherit',
  env: { ...process.env, BUILD_MODE: 'admin' },
});
