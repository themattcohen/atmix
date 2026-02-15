"use client";

import Link from "next/link";
import { useState } from "react";
import { Merriweather } from "next/font/google";

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
});

export function PreviewLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={`min-h-screen flex flex-col ${merriweather.variable}`}>
      <header className="bg-white border-b border-gray-300">
        <nav className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/new" className="flex flex-col">
            <span className="font-serif text-xl font-bold text-[#0b2d5b]">FBAR Direct</span>
            <span className="text-xs text-gray-500 -mt-0.5">FinCEN-Registered BSA E-Filing Institution</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#who-must-file" className="text-[15px] text-[#1a4480] no-underline hover:underline">Who Must File</a>
            <a href="#how-to-file" className="text-[15px] text-[#1a4480] no-underline hover:underline">How to File</a>
            <a href="#pricing" className="text-[15px] text-[#1a4480] no-underline hover:underline">Pricing</a>
            <a href="#faq" className="text-[15px] text-[#1a4480] no-underline hover:underline">FAQ</a>
            <Link href="/login" className="text-[15px] text-[#1a4480] no-underline hover:underline">Log In</Link>
            <Link href="/signup" className="bg-[#1a4480] text-white px-5 py-2.5 text-sm font-semibold rounded-sm hover:bg-[#0b2d5b] transition-colors">Begin Filing</Link>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-[#1a4480]" aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </nav>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-300">
              <span className="font-serif text-xl font-bold text-[#0b2d5b]">FBAR Direct</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-[#1a4480]" aria-label="Close menu">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 px-4 py-8 space-y-1">
              <a href="#who-must-file" className="block py-3 text-[17px] text-[#1a4480]" onClick={() => setMobileMenuOpen(false)}>Who Must File</a>
              <a href="#how-to-file" className="block py-3 text-[17px] text-[#1a4480]" onClick={() => setMobileMenuOpen(false)}>How to File</a>
              <a href="#pricing" className="block py-3 text-[17px] text-[#1a4480]" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="block py-3 text-[17px] text-[#1a4480]" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <Link href="/login" className="block py-3 text-[17px] text-[#1a4480]" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
              <Link href="/signup" className="block mt-4 bg-[#1a4480] text-white px-5 py-3 text-base font-semibold rounded-sm text-center" onClick={() => setMobileMenuOpen(false)}>Begin Filing</Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0b2d5b] text-white">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-serif text-lg font-bold">FBAR Direct</h3>
              <p className="text-sm text-gray-300 mt-1">FinCEN-Registered BSA E-Filing Institution</p>
              <p className="text-sm text-gray-400 mt-2">Secure electronic filing for FinCEN Form 114.</p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Filing</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#who-must-file" className="text-gray-300 hover:text-white">Who Must File</a></li>
                <li><a href="#how-to-file" className="text-gray-300 hover:text-white">How to File</a></li>
                <li><a href="#pricing" className="text-gray-300 hover:text-white">Pricing</a></li>
                <li><a href="#faq" className="text-gray-300 hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Official Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.fincen.gov" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">FinCEN.gov</a></li>
                <li><a href="https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">IRS FBAR Information</a></li>
                <li><a href="https://bsaefiling.fincen.gov" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">BSA E-Filing System</a></li>
                <li><Link href="/privacy" className="text-gray-300 hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-300 hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 mt-8">
            <p className="text-xs text-gray-400 text-center max-w-3xl mx-auto">
              FBAR Direct is not affiliated with the Internal Revenue Service, the Financial Crimes Enforcement Network (FinCEN), or any United States government agency. FBAR Direct is a FinCEN-registered BSA E-Filing institution. This service does not provide tax, legal, or financial advice.
            </p>
            <p className="text-xs text-gray-500 text-center mt-3">&copy; {new Date().getFullYear()} FBAR Direct. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
