"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardLayout } from "@/components/wizard/WizardLayout";

export default function PaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filing, setFiling] = useState<{ id: string; calendarYear: number; accountCount: number } | null>(null);

  useEffect(() => {
    async function loadFiling() {
      try {
        const res = await fetch("/api/filing");
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          // Get the most recent SIGNED filing
          const signedFiling = data.data.find((f: any) => f.status === "SIGNED");
          if (signedFiling) setFiling(signedFiling);
        }
      } catch {
        setError("Failed to load filing details");
      }
    }
    loadFiling();
  }, []);

  const handlePayment = async () => {
    if (!filing) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filingYearId: filing.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment initiation failed");
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!filing && !error) {
    return (
      <WizardLayout currentStep={6} onPrevious="/sign">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      </WizardLayout>
    );
  }

  if (!filing) {
    return (
      <WizardLayout currentStep={6} onPrevious="/sign">
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-6">
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
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Payment</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Filing Summary</h2>
        <div className="space-y-2 text-gray-700">
          <p><span className="font-medium">Calendar Year:</span> {filing.calendarYear}</p>
          <p><span className="font-medium">Accounts:</span> {filing.accountCount || "—"}</p>
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold text-navy-900">$59.00</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-600 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Secure payment via Stripe — 256-bit encryption</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>After payment, we submit your FBAR directly to FinCEN</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>You&apos;ll receive your BSA tracking ID via email</span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || !filing}
        className="w-full py-3 px-6 bg-gold-500 text-navy-900 rounded-md hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
      >
        {loading ? "Redirecting to payment..." : "Pay $59 — File Your FBAR"}
      </button>
    </div>
    </WizardLayout>
  );
}
