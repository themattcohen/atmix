"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { PRICING } from "@/lib/pricing";
import type { PricingTier } from "@/lib/pricing";

interface FilingData {
  id: string;
  calendarYear: number;
  accountCount: number;
  status: string;
  tier: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filing, setFiling] = useState<FilingData | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const tier = (filing?.tier?.toLowerCase() || "basic") as PricingTier;
  const pricing = PRICING[tier];

  useEffect(() => {
    async function loadFiling() {
      try {
        const res = await fetch("/api/filing");
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const signedFiling = data.data.find((f: FilingData) => f.status === "SIGNED");
          if (signedFiling) setFiling(signedFiling);
        }
      } catch {
        setError("Failed to load filing details");
      }
    }
    loadFiling();
  }, []);

  const handlePayment = async () => {
    if (!filing || redirecting) return;
    setLoading(true);
    setRedirecting(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ filingYearId: filing.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment initiation failed");
        setRedirecting(false);
        return;
      }

      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'begin_checkout',
          ecommerce: {
            currency: 'USD',
            value: pricing.amountDollars,
            items: [{
              item_name: pricing.stripeProductName,
              price: pricing.amountDollars,
            }],
          },
        });
      }

      window.location.href = data.url;
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setRedirecting(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError("");
    setRedirecting(false);
    handlePayment();
  };

  if (!filing && !error) {
    return (
      <WizardLayout currentStep={6} onPrevious="/sign">
        <div className="flex justify-center py-12" aria-label="Loading payment page">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      </WizardLayout>
    );
  }

  if (!filing) {
    return (
      <WizardLayout currentStep={6} onPrevious="/sign">
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-6">
            Please complete the signing step first.
          </div>
          <Link
            href="/sign"
            className="inline-block py-3 px-6 bg-navy-900 text-white rounded-md hover:bg-navy-800 font-bold"
          >
            Go to Signing
          </Link>
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout currentStep={6} onPrevious="/sign">
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Payment</h1>
      <p className="text-gray-600 mb-6">Complete your payment to submit your FBAR filing to FinCEN.</p>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          <p className="font-medium">Payment Error</p>
          <p className="mb-3">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 font-medium text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Filing Summary</h2>
        <div className="space-y-2 text-gray-700">
          <p><span className="font-medium">Calendar Year:</span> {filing.calendarYear}</p>
          <p><span className="font-medium">Accounts:</span> {filing.accountCount || "\u2014"}</p>
          <p><span className="font-medium">Service:</span> {pricing.name}</p>
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold text-navy-900">${pricing.amountDollars}.00</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">One-time fee. No recurring charges.</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-600 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Secure payment via Stripe &mdash; AES-256 encryption</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>After payment, we submit your FBAR directly to FinCEN</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>You&apos;ll receive your BSA tracking ID via email</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>100% money-back guarantee if we are unable to file</span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || !filing || redirecting}
        className="w-full py-3 px-6 bg-gold-500 text-navy-900 rounded-md hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
        aria-busy={loading || redirecting}
      >
        {redirecting ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Redirecting to secure payment...
          </span>
        ) : (
          `Pay $${pricing.amountDollars} — File Your FBAR`
        )}
      </button>
    </div>
    </WizardLayout>
  );
}
