import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed — FBAR Direct",
  description: "You have been unsubscribed from FBAR Direct filing reminders.",
  robots: { index: false, follow: false },
};

export default function UnsubscribedPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-navy-900 mb-8">Unsubscribed</h1>

        <div className="prose prose-gray max-w-none space-y-6">
          <p className="text-gray-700 leading-relaxed">
            You&apos;ve been unsubscribed from FBAR filing reminders. You&apos;ll still
            receive essential emails about any active filings (payment receipts, filing
            confirmations, and rejection notices).
          </p>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-lg text-lg font-semibold hover:bg-gold-600 transition-colors shadow-lg"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
