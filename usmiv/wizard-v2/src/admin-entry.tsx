/**
 * admin-entry.tsx -- Entry point for the WordPress admin dashboard bundle.
 *
 * This file is the Vite entry for dist/admin-dashboard.js and
 * dist/admin-dashboard.css. It is NOT imported by src/index.ts (the
 * customer-facing wizard bundle) -- the two builds are completely separate.
 *
 * Mount point: <div id="wizard-admin-root"> injected by admin-page.php.
 * Bootstrap: window.wizardOfIvBootstrap is injected by admin-page.php before
 * this script runs, providing the initial config, WP REST nonce, and endpoint URL.
 *
 * Legacy fallback: if wizardOfIvBootstrap is absent (e.g. loaded outside WP
 * admin), the dashboard falls back to fetching from the same-origin configUrl().
 */

// The global.d.ts type declarations are picked up by TypeScript automatically.
// No runtime import needed -- .d.ts files are type-only.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { WizardDevDashboard } from './components/dev/WizardDevDashboard';

function mountAdminDashboard(): void {
  const rootEl = document.getElementById('wizard-admin-root');
  if (!rootEl) {
    console.error('[wizard-of-iv] #wizard-admin-root not found -- admin dashboard cannot mount.');
    return;
  }

  const root = createRoot(rootEl);
  root.render(
    React.createElement(WizardDevDashboard)
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAdminDashboard);
} else {
  mountAdminDashboard();
}
