import Link from "next/link";
import { DeadlineBanner } from "@/components/landing/DeadlineBanner";
import { MarketingHeader } from "@/components/nav/MarketingHeader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col font-body text-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg focus:text-gov-blue focus:font-semibold"
      >
        Skip to main content
      </a>

      <DeadlineBanner />
      <MarketingHeader />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="w-full bg-gov-blue-dark text-white py-10 px-4">
        <div className="max-w-doc mx-auto text-left">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand Column */}
            <div>
              <h3 className="font-heading font-bold text-lg text-white mb-2">FBAR Direct</h3>
              <p className="text-sm text-gray-300 mb-3">We file your FBAR directly to FinCEN. From $59.</p>
              <p className="text-xs text-gray-400">FinCEN-Registered BSA E-Filing Institution</p>
              <p className="text-xs text-gray-400">Built by a Licensed CPA</p>
              <p className="text-xs text-gray-500 mt-3">1201 N. Market Street, Suite 111<br />Wilmington, DE 19801</p>
            </div>
            {/* Links Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">Site Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/#who-must-file" className="text-gray-300 hover:text-white hover:underline">Who Must File</a></li>
                <li><a href="/#how-to-file" className="text-gray-300 hover:text-white hover:underline">How to File</a></li>
                <li><a href="/#pricing" className="text-gray-300 hover:text-white hover:underline">Pricing</a></li>
                <li><a href="/#faq" className="text-gray-300 hover:text-white hover:underline">FAQ</a></li>
                <li><Link href="/login" className="text-gray-300 hover:text-white hover:underline">Log In</Link></li>
                <li><Link href="/privacy" className="text-gray-300 hover:text-white hover:underline">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-300 hover:text-white hover:underline">Terms of Service</Link></li>
              </ul>
            </div>
            {/* Resources Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">External Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.fincen.gov" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline">FinCEN.gov</a></li>
                <li><a href="https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline">IRS FBAR Reference Guide</a></li>
                <li><a href="https://bsaefiling.fincen.treas.gov/main.html" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline">BSA E-Filing System</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed max-w-[800px]">
              FBAR Direct is not a government agency. FBAR Direct is a registered BSA E-Filing institution authorized to submit FinCEN Form 114 on behalf of filers. Filing through FBAR Direct does not constitute legal or tax advice.
            </p>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} FBAR Direct. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
