"use client";

import { useState } from "react";
import { PriorYearInfo } from "@/types";

interface ImportBannerProps {
  priorYears: PriorYearInfo[];
  onImport: (sourceCalendarYear: number) => Promise<void>;
}

export function ImportBanner({ priorYears, onImport }: ImportBannerProps) {
  const [importing, setImporting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || priorYears.length === 0) return null;

  const mostRecent = priorYears[0]; // Hardcode to most recent year for MVP

  async function handleImport() {
    setImporting(true);
    try {
      await onImport(mostRecent.calendarYear);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div data-testid="import-banner" className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-blue-800">
            You filed {mostRecent.calendarYear} with{" "}
            {mostRecent.count} account{mostRecent.count !== 1 ? "s" : ""}.
            Import them as a starting point?
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-3 pl-8">
        <button
          onClick={handleImport}
          disabled={importing}
          className="text-sm font-medium bg-blue-700 text-white px-4 py-1.5 rounded-md hover:bg-blue-800 disabled:opacity-50"
        >
          {importing ? "Importing..." : `Import from ${mostRecent.calendarYear}`}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 underline hover:no-underline"
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}
