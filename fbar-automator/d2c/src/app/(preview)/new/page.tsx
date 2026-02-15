import { DeadlineBanner } from "@/components/landing-v2/DeadlineBanner";
import { Hero } from "@/components/landing-v2/Hero";
import { TrustBar } from "@/components/landing-v2/TrustBar";
import { WhoNeedsToFile } from "@/components/landing-v2/WhoNeedsToFile";
import { WhatYouNeed } from "@/components/landing-v2/WhatYouNeed";
import { HowItWorks } from "@/components/landing-v2/HowItWorks";
import { PricingComparison } from "@/components/landing-v2/PricingComparison";
import { FAQ } from "@/components/landing-v2/FAQ";
import { PreviewLayout } from "@/components/landing-v2/PreviewLayout";

export default function NewLandingPage() {
  return (
    <PreviewLayout>
      <DeadlineBanner />
      <Hero />
      <TrustBar />
      <WhoNeedsToFile />
      <WhatYouNeed />
      <HowItWorks />
      <PricingComparison />
      <FAQ />
    </PreviewLayout>
  );
}
