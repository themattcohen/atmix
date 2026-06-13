export const MANGOMINT_COMPANY_ID = 992490;
const BASE = `https://booking.mangomint.com/${MANGOMINT_COMPANY_ID}`;

// Direct service IDs verified live against Mangomint account 992490
const SERVICE_ID: Record<string, number> = {
  hydration: 12,
  myers: 13,
  immunity: 14,
  pregnancy: 15,
  altitude: 16,
  hangover: 17,
  migraine: 18,
  longevity: 19,
  performance: 20,
  revival: 21,
  myersGold: 26,
  myersPlatinum: 27,
  labGeneral: 22,
  labInDepth: 23,
  labVitamin: 24,
  labComplete: 25,
  semaglutide: 29, // Weight Loss Initial Consult ($99)
  tirzepatide: 29, // Weight Loss Initial Consult ($99)
  beautyBundle: 13, // bundles -> their base IV (Myers)
  jetLagMyers: 13,  // bundles -> their base IV (Myers)
};

// Category-level fallback (injections + NAD are Mangomint IV add-on boosters, not standalone services)
const CATEGORY_ID: Record<string, number> = {
  injection: 4,
  nad: 4,
};

export function mangomintBookingUrl(item: { id: string; category?: string }): string {
  if (item.id in SERVICE_ID) return `${BASE}?serviceId=${SERVICE_ID[item.id]}`;
  if (item.id === 'nadPlusLabs') return `${BASE}?serviceCategoryId=4`;
  if (item.category && item.category in CATEGORY_ID) return `${BASE}?serviceCategoryId=${CATEGORY_ID[item.category]}`;
  return BASE; // generic fallback -> opens the service picker overlay
}

// Programmatically open the Mangomint overlay (for button onClick handlers).
// Creates a temporary <a> so the embed script's event delegation fires the overlay
// instead of navigating away.
export function openMangomintBooking(item: { id: string; category?: string }): void {
  const a = document.createElement('a');
  a.href = mangomintBookingUrl(item);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}
