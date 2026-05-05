import React from 'react';
import { createRoot } from 'react-dom/client';
import { WizardModal } from './components/WizardModal';
import { configUrl } from './data/meta';
import { TREATMENTS, BUNDLES, QUESTIONS, setRuntimeConfig } from './data';
import { fetchRemoteConfig, mergeWithDefaults } from './config/remoteConfig';
import './styles/index.css';

// Public API mirroring v1's window.TreatmentWizard
interface TreatmentWizardAPI {
  open: (source?: string) => void;
  close: () => void;
}

async function mount(): Promise<void> {
  // Load remote config before rendering (falls back to compiled data silently)
  const remoteConfigUrl = configUrl();
  if (remoteConfigUrl) {
    const remote = await fetchRemoteConfig(remoteConfigUrl);
    if (remote) {
      const merged = mergeWithDefaults(remote, { treatments: TREATMENTS, bundles: BUNDLES, questions: QUESTIONS });
      setRuntimeConfig(merged);
    }
  }

  // Create a single React root hosted in a dedicated div
  const host = document.createElement('div');
  host.id = 'tw-v2-root';
  document.body.appendChild(host);

  let externalOpen: ((source?: string) => void) | null = null;
  let externalClose: (() => void) | null = null;

  const root = createRoot(host);
  root.render(
    React.createElement(WizardModal, {
      onReady: (open, close) => {
        externalOpen = open;
        externalClose = close;
      },
    })
  );

  // Bind all [data-treatment-wizard] triggers
  function bindTriggers(): void {
    document.querySelectorAll('[data-treatment-wizard]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        externalOpen?.('button');
      });
    });
  }

  // Exit intent (single-fire, top 10px, not-open guard)
  let exitFired = false;
  document.addEventListener('mouseleave', (e: MouseEvent) => {
    if (!exitFired && e.clientY <= 10) {
      exitFired = true;
      externalOpen?.('exit_intent');
    }
  });

  // Public window API (backward-compatible with v1)
  (window as Window & { TreatmentWizard?: TreatmentWizardAPI }).TreatmentWizard = {
    open: (source) => externalOpen?.(source ?? 'button'),
    close: () => externalClose?.(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTriggers);
  } else {
    bindTriggers();
  }
}

mount();

// Dashboard: loads when ?wizard-dev=true or Ctrl+Shift+W
(async () => {
  const { mountDevDashboard } = await import('./components/dev/WizardDevDashboard');
  const params = new URLSearchParams(window.location.search);
  if (params.get('wizard-dev') === 'true') {
    mountDevDashboard();
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'W') {
      e.preventDefault();
      mountDevDashboard();
    }
  });
})();
