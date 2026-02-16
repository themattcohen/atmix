import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { WhoNeedsToFile } from "@/components/landing/WhoNeedsToFile";
import { WhatYouNeed } from "@/components/landing/WhatYouNeed";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";

export default function LandingPage() {
  return (
    <>
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
