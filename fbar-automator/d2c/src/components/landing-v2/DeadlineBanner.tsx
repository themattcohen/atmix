"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "fbar-deadline-dismissed";

export function DeadlineBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== "true") {
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  if (dismissed) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-[#fef3cd] border-l-4 border-[#b58b00]">
      <div className="flex items-center justify-center py-2.5 px-4">
        <p className="text-sm text-[#1b1b1b] font-medium">
          FBAR Filing Deadline: April 15, 2026 — Automatic extension to October
          15, 2026
        </p>
        <button
          onClick={handleDismiss}
          className="ml-4 text-gray-600 hover:text-gray-900 flex-shrink-0"
          aria-label="Dismiss deadline banner"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
