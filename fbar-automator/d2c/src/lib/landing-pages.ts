export interface LandingVariant {
  slug: string;
  adGroup: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  priceHighlight: string;
  features: string[];
  metaTitle: string;
  metaDescription: string;
}

export const LANDING_VARIANTS: LandingVariant[] = [
  {
    slug: 'file-fbar-online',
    adGroup: 'FBAR Filing',
    headline: 'File Your FBAR in 10 Minutes',
    subheadline: 'FinCEN-registered. AES-256 encrypted. Direct submission to FinCEN.',
    ctaText: 'Start Filing Now',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: ['Guided step-by-step process', 'Auto currency conversion', 'BSA tracking ID confirmation', '100% money-back guarantee'],
    metaTitle: 'File Your FBAR Online — 10 Minutes, From $59',
    metaDescription: 'File FinCEN Form 114 electronically. FinCEN-registered BSA E-Filing institution. AES-256 encryption. Start now.',
  },
  {
    slug: 'fbar-software',
    adGroup: 'FBAR Software',
    headline: 'The FBAR Filing Software That Does the Work',
    subheadline: 'AI reads your bank statements. We handle the FinCEN submission.',
    ctaText: 'Try AI-Assisted Filing',
    ctaUrl: '/threshold',
    priceHighlight: '$79 with AI',
    features: ['AI extracts account details from statements', 'Supports PDF, images, CSV, Excel', 'Review and edit before filing', 'Direct FinCEN e-filing'],
    metaTitle: 'FBAR Filing Software — AI-Powered, From $59',
    metaDescription: 'Automated FBAR filing with AI bank statement extraction. Upload statements, review, submit. FinCEN-registered.',
  },
  {
    slug: 'fbar-expat',
    adGroup: 'Expat FBAR',
    headline: 'US Expat? File Your FBAR From Anywhere',
    subheadline: 'Built for Americans abroad. Auto currency conversion. No appointment needed.',
    ctaText: 'File Your FBAR',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: ['Auto foreign currency conversion', 'Treasury exchange rates built in', 'Works from any country', 'No CPA appointment required'],
    metaTitle: 'FBAR for US Expats — File Online From Anywhere',
    metaDescription: 'File your FBAR from anywhere in the world. Automatic currency conversion. FinCEN-registered. From $59.',
  },
  {
    slug: 'fincen-114',
    adGroup: 'FinCEN 114',
    headline: 'File FinCEN Form 114 Online',
    subheadline: 'Skip the BSA E-Filing portal. We handle the submission for you.',
    ctaText: 'Start FinCEN 114 Filing',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: ['Direct FinCEN submission via BSA E-Filing', 'Save progress and resume anytime', 'BSA tracking ID confirmation', 'Resubmission at no extra charge if rejected'],
    metaTitle: 'File FinCEN Form 114 Online — Skip the BSA Portal',
    metaDescription: 'Submit FinCEN Form 114 through our guided platform. Save progress, auto-convert currencies, get your BSA tracking ID.',
  },
  {
    slug: 'fbar-filing',
    adGroup: 'FBAR Filing',
    headline: 'FBAR Filing Made Simple — From $59',
    subheadline: 'We handle FinCEN Form 114 submission. You review and sign.',
    ctaText: 'Start Your FBAR Filing',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: [
      'We file directly with FinCEN for you',
      'Auto currency conversion (170+ currencies)',
      'BSA tracking ID confirmation',
      'Done in ~10 minutes',
    ],
    metaTitle: 'FBAR Filing Service — From $59 | FBAR Direct',
    metaDescription:
      'Professional FBAR filing service. We submit FinCEN Form 114 for you. FinCEN-registered. AES-256 encrypted. From $59.',
  },
  {
    slug: 'fbar-deadline',
    adGroup: 'Deadline',
    headline: 'FBAR Due April 15 -- File in 10 Minutes',
    subheadline: 'The deadline is days away. FinCEN-registered filing from $59.',
    ctaText: 'File Before the Deadline',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: [
      'FBAR deadline is April 15, 2026',
      'Automatic extension to October 15 if needed',
      'Direct FinCEN submission + BSA tracking ID',
      'Done in about 10 minutes',
    ],
    metaTitle: 'FBAR Deadline April 15 -- File Now From $59',
    metaDescription: 'FBAR deadline is April 15, 2026. File FinCEN Form 114 online in minutes. FinCEN-registered. From $59.',
  },
  {
    slug: 'fbar-late',
    adGroup: 'Late/Penalty',
    headline: 'Late FBAR? File Now -- Avoid Penalties',
    subheadline: 'Non-willful penalties can reach $16,536 per report. Get compliant today.',
    ctaText: 'File Your Late FBAR',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: [
      'File delinquent FBARs for any prior year',
      'We submit directly to FinCEN for you',
      'BSA tracking ID as proof of filing',
      'FinCEN-registered BSA E-Filing institution',
    ],
    metaTitle: 'Late FBAR Filing -- Avoid Penalties, File From $59',
    metaDescription: 'Missed the FBAR deadline? File your delinquent FBAR now. Non-willful penalties can reach $16,536. FinCEN-registered. From $59.',
  },
  {
    slug: 'default',
    adGroup: 'General',
    headline: 'File Your FBAR Online — From $59',
    subheadline: 'FinCEN-registered. AI-assisted. Done in minutes.',
    ctaText: 'Start Filing Now',
    ctaUrl: '/threshold',
    priceHighlight: 'From $59',
    features: [
      'Guided step-by-step process',
      'AI bank statement extraction (Premium)',
      'Auto foreign currency conversion',
      'Direct FinCEN submission + BSA tracking ID',
    ],
    metaTitle: 'File Your FBAR Online — From $59 | FBAR Direct',
    metaDescription: 'File FinCEN Form 114 online. FinCEN-registered. AI-powered statement extraction. AES-256 encryption. From $59.',
  },
];
