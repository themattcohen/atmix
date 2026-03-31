type GtmEvent = { event: string; [key: string]: unknown };

export function pushDataLayer(payload: GtmEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/**
 * Set hashed user data for Google Ads Enhanced Conversions.
 * Uses SHA-256 via SubtleCrypto (browser-native, no dependencies).
 */
export async function setGtagUserData(email: string): Promise<void> {
  if (typeof window === "undefined" || !window.gtag) return;
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(normalized));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  window.gtag("set", "user_data", {
    sha256_email_address: hashHex,
  });
}

/**
 * Fire a Google Ads conversion event via gtag().
 * Requires NEXT_PUBLIC_GADS_ID to be set (e.g. "AW-17983090187").
 */
export function trackGadsConversion(
  label: string,
  value?: number,
  transactionId?: string,
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  if (process.env.NODE_ENV !== "production") return;
  const gadsId = process.env.NEXT_PUBLIC_GADS_ID;
  if (!gadsId) return;
  window.gtag("event", "conversion", {
    send_to: `${gadsId}/${label}`,
    ...(value !== undefined && { value, currency: "USD" }),
    ...(transactionId && { transaction_id: transactionId }),
  });
}
