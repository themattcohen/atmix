import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { WhoNeedsToFile } from "@/components/landing/WhoNeedsToFile";
import { WhatYouNeed } from "@/components/landing/WhatYouNeed";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { JsonLd } from "@/components/JsonLd";
import { FAQ_ITEMS } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: 'File Your FBAR Online — We Submit Directly to FinCEN',
  description: 'We file your FBAR directly to FinCEN for you. FinCEN-registered BSA E-Filing institution. AI-powered bank statement extraction. From $59.',
  alternates: { canonical: '/' },
  openGraph: { title: 'File Your FBAR Online — We Submit Directly to FinCEN', description: 'We file your FBAR directly to FinCEN for you. FinCEN-registered. From $59.', url: '/' },
};

export default function LandingPage() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "FBAR Direct",
        "url": "https://fbardirect.com",
        "description": "FinCEN-registered BSA E-Filing institution for FBAR (FinCEN Form 114) electronic filing.",
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "FBAR Direct",
        "url": "https://fbardirect.com",
        "applicationCategory": "FinanceApplication",
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "59",
          "highPrice": "79",
          "priceCurrency": "USD",
        },
        "featureList": [
          "AI bank statement extraction",
          "Direct FinCEN e-filing",
          "Automatic currency conversion",
          "Form 114a digital signature",
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer,
          },
        })),
      }} />
      <Hero />
      <TrustBar />
      <WhoNeedsToFile />
      <WhatYouNeed />
      <HowItWorks />
      <Pricing />
      <FAQ />
    </>
  );
}
