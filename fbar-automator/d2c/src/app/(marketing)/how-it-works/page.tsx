import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: 'How to File an FBAR — 7 Steps, Under 10 Minutes',
  description: 'Step-by-step guide to filing your FBAR through FBAR Direct. Enter information, review, sign Form 114a, pay, and receive your BSA tracking ID.',
  alternates: { canonical: '/how-it-works' },
  openGraph: { title: 'How to File an FBAR — 7 Steps, Under 10 Minutes', url: '/how-it-works' },
};

export default function HowItWorksPage() {
  const steps = [
    { num: 1, title: "Check If You Need to File", desc: "Answer two simple questions about your foreign accounts and their aggregate value. We'll tell you if you need to file.", icon: "?" },
    { num: 2, title: "Enter Personal Information", desc: "Your name, SSN/ITIN, date of birth, and US address. This information goes on your FBAR.", icon: "user" },
    { num: 3, title: "Add Foreign Accounts", desc: "Enter details for each foreign account: institution name, account number, country, and maximum value during the year.", icon: "bank" },
    { num: 4, title: "Review Everything", desc: "See all your information in one place. Edit anything that needs changing. We'll flag potential issues.", icon: "eye" },
    { num: 5, title: "Sign Form 114a", desc: "Digitally sign the authorization form (Form 114a) that allows us to e-file your FBAR on your behalf.", icon: "pen" },
    { num: 6, title: "Pay & Submit", desc: "Secure payment via Stripe ($59 Basic / $79 Premium). We don't charge until you're ready to file. No hidden fees.", icon: "card" },
    { num: 7, title: "We Submit to FinCEN", desc: "We generate your FinCEN XML, submit through the official BSA E-Filing System, and send you your BSA tracking ID.", icon: "send" },
  ];

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How to File an FBAR with FBAR Direct",
        "totalTime": "PT10M",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "59",
        },
        "step": steps.map((s) => ({
          "@type": "HowToStep",
          "name": s.title,
          "text": s.desc,
          "position": s.num,
        })),
      }} />
      <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">How FBAR Direct Works</h1>
          <p className="text-xl text-gray-600">
            7 simple steps. Most people finish in under 10 minutes.
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((step) => (
            <div key={step.num} className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-navy-900 text-white rounded-full flex items-center justify-center font-bold">
                {step.num}
              </div>
              <div className="flex-1 pb-8 border-b border-gray-200 last:border-0">
                <h3 className="text-lg font-semibold text-navy-900 mb-1">{step.title}</h3>
                <p className="text-gray-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/threshold"
            className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
          >
            Start Filing Now
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
