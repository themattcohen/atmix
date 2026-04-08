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
      'Auto currency conversion for foreign accounts',
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
    subheadline: 'The deadline is days away. Skip the government portal. We prepare, review, and submit your FBAR to FinCEN for you.',
    ctaText: 'Start My FBAR Now',
    ctaUrl: '/threshold',
    priceHighlight: '$59 -- Less Than a CPA Consultation',
    features: [
      'April 15, 2026 deadline -- penalties start at $16,536 per account',
      'Average filing time: 10 minutes (vs 45+ min on the government portal)',
      'We submit directly to FinCEN -- you get a BSA tracking ID as proof',
      "If we can't file it, you pay nothing",
    ],
    metaTitle: 'FBAR Due April 15 -- File Online in 10 Minutes | $59',
    metaDescription: 'FBAR deadline is April 15, 2026. File in 10 minutes for $59. We submit directly to FinCEN and provide your BSA tracking ID. Faster than the free portal.',
  },
  {
    slug: 'fbar-late',
    adGroup: 'Late/Penalty',
    headline: 'Behind on Your FBAR? Get Compliant Today',
    subheadline: "Whether you haven't filed yet this year or missed previous years, we handle it. FinCEN-registered filing from $59. Most people finish in 10 minutes.",
    ctaText: 'Get Compliant Now -- $59',
    ctaUrl: '/threshold',
    priceHighlight: '$59 Per Report -- Any Year',
    features: [
      "Current year or prior years -- file any FBAR you've missed",
      'We submit directly to FinCEN -- BSA tracking ID as proof of compliance',
      'Non-willful penalties reach $16,536 per account -- filing now limits your exposure',
      'No appointment needed -- finish online in about 10 minutes',
    ],
    metaTitle: 'Late FBAR? File Now for $59 | Get Compliant Today',
    metaDescription: 'FBAR penalties reach $16,536 per account. File current or prior-year FBARs online for $59. We submit to FinCEN and provide proof of compliance. 10 minutes.',
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
