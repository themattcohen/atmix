import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhoNeedsToFile } from "@/components/landing/WhoNeedsToFile";
import { PricingComparison } from "@/components/landing/PricingComparison";
import { FAQ } from "@/components/landing/FAQ";
import { CTAFooter } from "@/components/landing/CTAFooter";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <HowItWorks />
      <WhoNeedsToFile />
      <PricingComparison />
      <FAQ />
      <CTAFooter />
    </>
  );
}
