import Link from "next/link";
import { DeadlineBanner } from "@/components/landing/DeadlineBanner";
import { MarketingHeader } from "@/components/nav/MarketingHeader";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsButton";

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

      <BreadcrumbJsonLd />
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
              <p className="text-xs text-gray-400">Transmitter Control Code: PBSA8180</p>
              <p className="text-xs text-gray-400">Built by a Licensed CPA</p>
              <p className="text-xs text-gray-500 mt-3">1201 N. Market Street, Suite 111<br />Wilmington, DE 19801</p>
            </div>
            {/* Links Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">Site Links</h4>
              <ul className="space-y-1 text-sm">
                <li><a href="/#who-must-file" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Who Must File</a></li>
                <li><a href="/#how-to-file" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">How to File</a></li>
                <li><a href="/#pricing" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Pricing</a></li>
                <li><a href="/#faq" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">FAQ</a></li>
                <li><Link href="/contact" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Contact</Link></li>
                <li><Link href="/blog" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Blog</Link></li>
                <li><Link href="/login" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Log In</Link></li>
                <li><Link href="/privacy" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">Terms of Service</Link></li>
                <li><CookieSettingsButton /></li>
              </ul>
            </div>
            {/* Contact + Resources Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">Contact &amp; Resources</h4>
              <p className="text-sm text-gray-300 mb-2">
                Questions?{" "}
                <a href="mailto:support@fbardirect.com" className="text-white hover:underline font-medium min-h-[44px] inline-flex items-center">
                  support@fbardirect.com
                </a>
              </p>
              <p className="text-sm text-gray-300 mb-4">
                <a href="tel:+18888635518" className="text-white hover:underline font-medium min-h-[44px] inline-flex items-center">
                  (888) 863-5518
                </a>
              </p>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">External Resources</h4>
              <ul className="space-y-1 text-sm">
                <li><a href="https://www.fincen.gov" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">FinCEN.gov</a></li>
                <li><a href="https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">IRS FBAR Reference Guide</a></li>
                <li><a href="https://bsaefiling.fincen.treas.gov/main.html" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center">BSA E-Filing System</a></li>
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
