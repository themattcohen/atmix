export type PricingTier = "basic" | "premium";

export const PRICING: Record<PricingTier, {
  id: PricingTier;
  name: string;
  amountCents: number;
  amountDollars: number;
  description: string;
  stripeProductName: string;
  features: string[];
}> = {
  basic: {
    id: "basic",
    name: "Basic Filing",
    amountCents: 5900,
    amountDollars: 59,
    description: "Manual account entry",
    stripeProductName: "FBAR Filing — FinCEN Form 114 (Basic)",
    features: [
      "Guided step-by-step process",
      "Automated data verification",
      "FinCEN XML generation",
      "Direct electronic submission to FinCEN",
      "BSA tracking ID confirmation",
      "Email confirmation with receipt",
      "Form 114a digital signature",
      "AES-256 encrypted data handling",
      "Resubmission at no extra charge if rejected",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium Filing",
    amountCents: 7900,
    amountDollars: 79,
    description: "AI statement extraction + manual entry",
    stripeProductName: "FBAR Filing — FinCEN Form 114 (Premium)",
    features: [
      "Everything in Basic, plus:",
      "Upload bank statements (PDF, images, CSV, Excel)",
      "AI extracts account details automatically",
      "Review and edit extracted data before filing",
    ],
  },
};
