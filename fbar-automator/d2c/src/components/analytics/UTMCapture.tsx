"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const COOKIE_NAME = "fbar_utm";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function UTMCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmSource = searchParams.get("utm_source");
    if (!utmSource) return; // Only capture if UTM params present

    const utmData: Record<string, string> = {};
    UTM_PARAMS.forEach((param) => {
      const value = searchParams.get(param);
      if (value) utmData[param] = value;
    });

    if (Object.keys(utmData).length > 0) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(utmData))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  }, [searchParams]);

  return null;
}
