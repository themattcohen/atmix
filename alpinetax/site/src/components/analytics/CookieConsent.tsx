'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'alpine_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'granted');
    setVisible(false);
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-alpine-blue border-t border-white/20 shadow-lg p-4"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-white/90 flex-1">
          We use cookies to analyze site traffic and improve your experience.{' '}
          <a href="/privacy" className="text-alpine-teal underline hover:no-underline">
            Privacy Policy
          </a>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-white/80 border border-white/40 rounded-md hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm text-white bg-alpine-terra rounded-md hover:bg-[#D35E42] font-semibold transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
