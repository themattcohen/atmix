"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const FBAR_DEADLINE = new Date("2026-04-15T00:00:00");

function getDaysRemaining(): number {
  const now = new Date();
  const diff = FBAR_DEADLINE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function DeadlineBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("fbar-deadline-dismissed");
    if (dismissed === "true") {
      setIsVisible(false);
      return;
    }
    setDaysLeft(getDaysRemaining());
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("fbar-deadline-dismissed", "true");
  };

  if (!isVisible || daysLeft === null) return null;

  const isUrgent = daysLeft <= 14;

  return (
    <div className={`w-full border-b py-3 px-4 sticky top-0 z-50 ${isUrgent ? "bg-red-50 border-red-300" : "bg-alert-bg border-alert-border"}`}>
      <div className="max-w-doc mx-auto flex justify-between items-start md:items-center">
        <div className="flex items-start md:items-center">
          <AlertTriangle className={`h-5 w-5 mr-3 flex-shrink-0 mt-0.5 md:mt-0 ${isUrgent ? "text-red-600" : "text-alert-border"}`} aria-hidden="true" />
          <p className={`text-sm font-semibold ${isUrgent ? "text-red-800" : "text-text-primary"}`}>
            FBAR Deadline: April 15, 2026 —{" "}
            {daysLeft === 0 ? (
              <span className="text-red-700 font-bold">Due today!</span>
            ) : (
              <span className={isUrgent ? "text-red-700 font-bold" : ""}>
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
              </span>
            )}
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
