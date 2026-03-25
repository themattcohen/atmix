export const siteConfig = {
  name: 'Alpine Tax & Consulting',
  legalName: 'Alpine Tax & Consulting LLC',
  tagline: 'Tax Preparation & Consulting',
  description: 'Personal tax preparation, small business tax services, and strategic tax planning for individuals and businesses. Transparent pricing, year-round support.',
  url: 'https://alpinetax.co',
  phone: '(719) 402-1571',
  phoneTel: '+17194021571',
  email: 'contact@alpinetax.co',
  owner: 'Vinnie Boettcher',
  ownerTitle: 'Founder & Tax Consultant',
  experience: 'Nearly a decade',

  address: {
    street: '2000 S Colorado Blvd BLDG 1-2000 #1113',
    city: 'Denver',
    state: 'CO',
    stateFullName: 'Colorado',
    zip: '80222',
    country: 'US',
  },

  serviceAreas: [
    'Denver',
    'Aurora',
    'Lakewood',
    'Centennial',
    'Littleton',
    'Highlands Ranch',
    'Englewood',
    'Greenwood Village',
    'Parker',
    'Castle Rock',
    'Thornton',
  ],

  services: [
    {
      title: 'Individual Tax Returns',
      slug: 'individual-tax',
      description: 'Comprehensive personal tax preparation for all situations — W-2, freelance, investments, and multi-state.',
      startingPrice: 600,
    },
    {
      title: 'Small Business Tax Returns',
      slug: 'small-business-tax',
      description: 'Schedule C, LLC, and sole proprietor returns with proactive deduction strategies.',
      startingPrice: 850,
    },
    {
      title: 'S-Corp & Partnership Returns',
      slug: 'scorp-partnership',
      description: 'Form 1120-S and 1065 preparation including reasonable compensation analysis.',
      startingPrice: 2000,
    },
    {
      title: 'Tax Planning',
      slug: 'tax-planning',
      description: 'Proactive tax strategy sessions to minimize your future tax burden.',
      startingPrice: 500,
    },
    {
      title: 'IRS Representation',
      slug: 'irs-representation',
      description: 'Professional representation for audits, notices, and collections.',
      startingPrice: 500,
    },
  ],

  social: {
    google: 'https://g.page/r/alpine-tax-consulting',
  },

  calcomUsername: 'alpinetax/initialconsultation',

  clientEventTypes: [
    { title: 'Tax Planning', slug: 'tax-planning-meeting', duration: 60, location: 'Zoom' },
    { title: 'Tax Return Review', slug: 'tax-review-meeting', duration: 30, location: 'Zoom' },
    { title: '15-Minute Phone Call', slug: 'phonecall', duration: 15, location: 'Phone' },
  ],

  taxdomeUrl: 'https://alpinetax.taxdome.com/login',

  analytics: {
    gtmId: process.env.NEXT_PUBLIC_GTM_ID || '',
    // GA4 (G-L2N53TJPJE) + FB Pixel (282429905966327) now managed in GTM, not in code
  },
} as const;

export type ServiceInfo = (typeof siteConfig.services)[number];
