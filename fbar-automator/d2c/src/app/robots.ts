import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/personal', '/accounts', '/review', '/sign', '/payment', '/confirmation'],
    },
    sitemap: 'https://fbardirect.com/sitemap.xml',
  };
}
