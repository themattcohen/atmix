import type { Metadata } from "next";
import { Inter, Merriweather, Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import "./globals.css";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { UTMCapture } from "@/components/analytics/UTMCapture";
import { CookieConsent } from "@/components/analytics/CookieConsent";

const ChatWidget = dynamic(
  () => import("@/components/chat/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
  display: "swap",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fbardirect.com'),
  title: {
    default: 'FBAR Direct — File Your FBAR Online',
    template: '%s | FBAR Direct',
  },
  description: 'File your FBAR (FinCEN Form 114) electronically. FinCEN-registered BSA E-Filing institution. AES-256 encryption. Starting at $59 per filing.',
  keywords: ['FBAR', 'FinCEN Form 114', 'file FBAR online', 'FBAR filing service', 'foreign bank account report', 'BSA E-Filing'],
  openGraph: {
    type: 'website',
    siteName: 'FBAR Direct',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large' as const,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <body className={`${inter.variable} ${merriweather.variable} ${sourceSans.variable} ${inter.className}`}>
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ''} gadsId={process.env.NEXT_PUBLIC_GADS_ID || ''} nonce={nonce} />
        <Suspense fallback={null}>
          <UTMCapture />
        </Suspense>
        {children}
        <ChatWidget />
        <CookieConsent />
      </body>
    </html>
  );
}
