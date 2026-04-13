export interface WizardMeta {
  readonly acuityBaseUrl: string;
  readonly acuityAvailabilityUrl: string;
  readonly configWorkerUrl: string;
  readonly phoneNumber: string;
  readonly reviewCount: string;
  readonly promoText?: string;
  readonly acuityFieldId: number;
}

export const META: WizardMeta = {
  acuityBaseUrl: 'https://usmobilemedics.as.me/usmobileiv',
  // Cloudflare Worker proxy for Acuity availability API
  acuityAvailabilityUrl: 'https://usmiv-acuity-proxy.shiny-field-7198.workers.dev',
  // Cloudflare Worker for remote config. Empty string = use compiled data only.
  configWorkerUrl: 'https://wizard-config.shiny-field-7198.workers.dev',
  phoneNumber: '303-406-4500',
  reviewCount: '546',
  acuityFieldId: 13062568,
};
