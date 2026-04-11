export interface WizardMeta {
  readonly acuityBaseUrl: string;
  readonly acuityAvailabilityUrl: string;
  readonly phoneNumber: string;
  readonly reviewCount: string;
  readonly promoText?: string;
}

export const META: WizardMeta = {
  acuityBaseUrl: 'https://usmobilemedics.as.me/usmobileiv',
  // Cloudflare Worker proxy for Acuity availability API
  acuityAvailabilityUrl: 'https://usmiv-acuity-proxy.shiny-field-7198.workers.dev',
  phoneNumber: '303-406-4500',
  reviewCount: '546',
};
