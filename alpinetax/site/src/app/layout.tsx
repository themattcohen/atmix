import type { Metadata } from 'next';
import { DM_Sans, Inter } from 'next/font/google';
import { siteConfig } from '@/lib/site-config';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { GoogleTagManager } from '@/components/analytics/GoogleTagManager';
import { CookieConsent } from '@/components/analytics/CookieConsent';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Alpine Tax & Consulting | Denver Tax Preparation',
    template: '%s | Alpine Tax & Consulting',
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: 'Alpine Tax & Consulting | Denver Tax Preparation',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alpine Tax & Consulting | Denver Tax Preparation',
    description: siteConfig.description,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: '0fE-88qyIt0ZHzCGGZEDYSbgi4eaH2_Ink9BW6Y2zlI',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { gtmId } = siteConfig.analytics;

  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable}`}>
      <body className="flex flex-col min-h-screen">
        {gtmId && <GoogleTagManager gtmId={gtmId} />}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <CookieConsent />
      </body>
    </html>
  );
}
