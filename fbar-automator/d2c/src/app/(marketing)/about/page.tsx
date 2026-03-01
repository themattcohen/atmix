import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: 'About FBAR Direct — FinCEN-Registered E-Filing Institution',
  description: 'FBAR Direct is a FinCEN-registered BSA E-Filing institution founded by a licensed CPA. We file your FBAR (FinCEN Form 114) directly to FinCEN from $59.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About FBAR Direct', url: '/about' },
};

export default function AboutPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-navy-900 mb-8">FBAR Filing, Not Just FBAR Preparation</h1>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-navy-900">Why We Built FBAR Direct</h2>
            <p className="text-gray-700 leading-relaxed">
              Filing an FBAR should be straightforward. But most people are stuck choosing between
              two bad options: preparation tools that make you navigate the government portal yourself,
              or CPA firms that charge hundreds of dollars for the exact same filing.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We built FBAR Direct to be the better alternative: CPA-quality filing at a fraction of
              the cost. A guided service that takes 10 minutes and files directly to FinCEN through
              the official BSA E-Filing System — no portal navigation required, no expensive
              professional fees.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900">Our Credentials</h2>
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="font-semibold text-navy-900">FinCEN-Registered BSA E-Filing Institution</p>
                  <p className="text-sm text-gray-600">Authorized to submit FBARs electronically through FinCEN&apos;s BSA E-Filing system. Transmitter Control Code: <strong>PBSA8180</strong>.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="font-semibold text-navy-900">AES-256-GCM Encryption</p>
                  <p className="text-sm text-gray-600">All sensitive data (SSN, account numbers) encrypted at rest and in transit.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-navy-900">Built by a Licensed CPA</p>
                  <p className="text-sm text-gray-600">Founded by a Certified Public Accountant with direct FBAR filing experience. Professional tax compliance expertise built into every step of the process.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900">How to Verify Any FBAR Filing Service</h2>
            <p className="text-gray-700 leading-relaxed">
              Before using any FBAR filing service, verify these credentials:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Ask for their FinCEN BSA E-Filing registration credentials</li>
              <li>Verify they submit through FinCEN&apos;s official BSA E-Filing system</li>
              <li>Confirm you&apos;ll receive a BSA tracking ID after filing</li>
              <li>Check for transparent pricing with no hidden fees</li>
              <li>Look for E&amp;O (Errors and Omissions) insurance coverage</li>
              <li>Read reviews on BBB and Trustpilot</li>
            </ol>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> Some FBAR filing services are not legitimate. If a service
                cannot provide FinCEN registration credentials or a BSA tracking ID after filing,
                your FBAR may not have been filed with FinCEN.
              </p>
            </div>
          </section>

          <div className="mt-12 text-center">
            <Link
              href="/threshold"
              className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-lg text-lg font-semibold hover:bg-gold-600 transition-colors shadow-lg"
            >
              Get Started — File Your FBAR
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
