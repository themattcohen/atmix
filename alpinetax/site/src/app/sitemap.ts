import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://alpinetax.co'
  const lastModified = new Date()

  return [
    // Home
    { url: baseUrl, lastModified, changeFrequency: 'monthly', priority: 1 },

    // Core pages
    { url: `${baseUrl}/services`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/schedule`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/reviews`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/client-portal`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },

    // Service pages
    { url: `${baseUrl}/services/individual-tax`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/services/small-business-tax`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/services/scorp-partnership`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/services/tax-planning`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/services/irs-representation`, lastModified, changeFrequency: 'monthly', priority: 0.9 },

    // Area pages
    { url: `${baseUrl}/areas/aurora`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/castle-rock`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/centennial`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/denver`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/englewood`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/greenwood-village`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/highlands-ranch`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/lakewood`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/littleton`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/parker`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/thornton`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/areas/virtual`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
