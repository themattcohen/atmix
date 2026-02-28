type GtmEvent = { event: string; [key: string]: unknown };

export function pushDataLayer(payload: GtmEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
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
  const gadsId = process.env.NEXT_PUBLIC_GADS_ID;
  if (!gadsId) return;
  window.gtag("event", "conversion", {
    send_to: `${gadsId}/${label}`,
    ...(value !== undefined && { value, currency: "USD" }),
    ...(transactionId && { transaction_id: transactionId }),
  });
}
