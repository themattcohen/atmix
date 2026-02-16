"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function DeadlineBanner() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem("fbar-deadline-dismissed");
    if (dismissed === "true") {
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("fbar-deadline-dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="w-full bg-alert-bg border-b border-alert-border py-3 px-4 sticky top-0 z-50">
      <div className="max-w-doc mx-auto flex justify-between items-start md:items-center">
        <div className="flex items-start md:items-center">
          <AlertTriangle className="h-5 w-5 text-alert-border mr-3 flex-shrink-0 mt-0.5 md:mt-0" aria-hidden="true" />
          <p className="text-text-primary text-sm font-semibold">
            FBAR Filing Deadline: April 15, 2026 — Automatic extension to
            October 15, 2026
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-text-secondary hover:text-text-primary p-1 ml-4"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
