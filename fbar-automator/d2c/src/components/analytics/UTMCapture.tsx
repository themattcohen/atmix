"use client";

import { useEffect } from "react";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const COOKIE_NAME = "fbar_utm";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Captures UTM parameters from the URL and stores them in a cookie for
 * attribution at signup time. Reads directly from window.location.search
 * to avoid Next.js useSearchParams() hydration edge-cases with static pages.
 *
 * - First-touch attribution: does NOT overwrite an existing cookie.
 * - Sets cookie if ANY utm param is present (not just utm_source).
 * - Adds Secure flag on HTTPS origins.
 */
export function UTMCapture() {
  useEffect(() => {
    // First-touch: don't overwrite an existing UTM cookie
    if (document.cookie.includes(COOKIE_NAME + "=")) return;

    // Read directly from window.location to avoid SSG/Suspense edge-cases
    const params = new URLSearchParams(window.location.search);

    const utmData: Record<string, string> = {};
    UTM_PARAMS.forEach((param) => {
      const value = params.get(param);
      if (value) utmData[param] = value;
    });

    // Only set cookie if at least one UTM param is present
    if (Object.keys(utmData).length === 0) return;

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(utmData))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }, []);

  return null;
}
