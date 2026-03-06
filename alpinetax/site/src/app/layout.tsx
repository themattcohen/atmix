import type { Metadata } from 'next';
import { DM_Sans, Inter } from 'next/font/google';
import Script from 'next/script';
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
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ga4Id, fbPixelId } = siteConfig.analytics;

  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable}`}>
      <body className="flex flex-col min-h-screen">
        {ga4Id && <GoogleTagManager ga4Id={ga4Id} />}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <CookieConsent />
        {fbPixelId && (
          <Script
            id="fb-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixelId}');fbq('track','PageView');`,
            }}
          />
        )}
      </body>
    </html>
  );
}
