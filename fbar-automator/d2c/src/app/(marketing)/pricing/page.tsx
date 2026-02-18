import type { Metadata } from "next";
import Link from "next/link";
import { PRICING } from "@/lib/pricing";

export const metadata: Metadata = {
  title: 'FBAR Filing Pricing — $59 Basic or $79 Premium',
  description: 'File FinCEN Form 114 starting at $59. AI-assisted bank statement extraction at $79. No hidden fees. 100% money-back guarantee.',
  alternates: { canonical: '/pricing' },
  openGraph: { title: 'FBAR Filing Pricing — $59 Basic or $79 Premium', url: '/pricing' },
};

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600">Choose the plan that fits your needs. No hidden fees.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-16">
          {/* Basic Tier */}
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500 uppercase tracking-wider text-sm font-medium mb-2">{PRICING.basic.name}</p>
            <div className="mb-2">
              <span className="text-5xl font-bold text-navy-900">${PRICING.basic.amountDollars}</span>
              <span className="text-gray-500 ml-2">per filing</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">{PRICING.basic.description}</p>
            <ul className="text-left space-y-3 mb-8">
              {PRICING.basic.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/threshold"
              className="inline-block w-full py-3 bg-navy-900 text-white rounded-md font-bold text-lg hover:bg-navy-800 transition-colors"
            >
              Start Filing
            </Link>
          </div>

          {/* Premium Tier */}
          <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-gold-500 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gold-500 text-navy-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Recommended
            </div>
            <p className="text-gray-500 uppercase tracking-wider text-sm font-medium mb-2">{PRICING.premium.name}</p>
            <div className="mb-2">
              <span className="text-5xl font-bold text-navy-900">${PRICING.premium.amountDollars}</span>
              <span className="text-gray-500 ml-2">per filing</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">{PRICING.premium.description}</p>
            <ul className="text-left space-y-3 mb-8">
              {PRICING.premium.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/threshold"
              className="inline-block w-full py-3 bg-gold-500 text-navy-900 rounded-md font-bold text-lg hover:bg-gold-600 transition-colors"
            >
              Start Filing
            </Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-lg p-6 text-center">
          <p className="text-navy-900 font-medium">
            100% money-back guarantee if we are unable to file your FBAR.
          </p>
          <p className="text-sm text-gray-500 mt-1">No credit card required to start</p>
        </div>
      </div>
    </div>
  );
}
