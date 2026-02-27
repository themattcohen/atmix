type GtmEvent = { event: string; [key: string]: unknown };

export function pushDataLayer(payload: GtmEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}
