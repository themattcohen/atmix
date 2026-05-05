export interface WizardMeta {
  readonly acuityBaseUrl: string;
  readonly acuityAvailabilityUrl: string;
  /**
   * @deprecated Step 4 migration: configWorkerUrl replaced by configUrl.
   * Kept for one cycle so reviewers can see the migration.
   * The Cloudflare Worker URL was: 'https://wizard-config.shiny-field-7198.workers.dev'
   */
  readonly configWorkerUrl: string;
  readonly phoneNumber: string;
  readonly reviewCount: string;
  readonly promoText?: string;
  readonly acuityFieldId: number;
}

/**
 * Returns the WP REST config endpoint URL.
 * When running on usmobileiv.com (or any WP host), window.location.origin
 * makes this same-origin with no CORS requirement.
 * Falls back to empty string in non-browser contexts (SSR/tests).
 */
export function configUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/wp-json/wizard-of-iv/v1/config`;
}

/**
 * Returns the origin-relative base URL for the Acuity availability proxy.
 * On usmobileiv.com this resolves to the WP REST endpoint registered in
 * wizard-of-iv.php under the wizard-of-iv/v1 namespace, making it same-origin
 * with no CORS requirement.
 *
 * Route prefix: /wp-json/wizard-of-iv/v1/api/acuity
 * (Hooks mount under /acuity/* and the bundle appends /api/acuity/* for parity
 * with the former Cloudflare Worker path shape used by useAcuityDates/Times.)
 */
export function acuityProxyBase(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/wp-json/wizard-of-iv/v1`;
}

export const META: WizardMeta = {
  acuityBaseUrl: 'https://usmobilemedics.as.me/usmobileiv',
  // Origin-relative WP REST proxy. Replaces the former Cloudflare Worker URL:
  // 'https://usmiv-acuity-proxy.shiny-field-7198.workers.dev'
  // Same-origin on usmobileiv.com; no CORS handling required.
  acuityAvailabilityUrl: typeof window !== 'undefined' ? window.location.origin + '/wp-json/wizard-of-iv/v1' : '',
  // @deprecated - replaced by configUrl(). Kept for migration reference only.
  configWorkerUrl: '',
  phoneNumber: '303-406-4500',
  reviewCount: '546',
  acuityFieldId: 13062568,
};
