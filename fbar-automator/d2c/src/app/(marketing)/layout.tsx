"use client";

import Link from "next/link";
import { useState } from "react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-navy-900">
            FBAR Direct
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/how-it-works"
              className="text-sm text-gray-600 hover:text-navy-900"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-600 hover:text-navy-900"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-600 hover:text-navy-900"
            >
              About
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-navy-900"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-gold-500 text-navy-900 rounded-md text-sm font-semibold hover:bg-gold-600 transition-colors"
            >
              Start Filing
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 text-gray-600 hover:text-navy-900"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
              <span className="text-xl font-bold text-navy-900">FBAR Direct</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-600 hover:text-navy-900"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 px-4 py-8 space-y-4">
              <Link
                href="/how-it-works"
                className="block py-3 text-lg text-gray-600 hover:text-navy-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className="block py-3 text-lg text-gray-600 hover:text-navy-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/about"
                className="block py-3 text-lg text-gray-600 hover:text-navy-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/login"
                className="block py-3 text-lg text-gray-600 hover:text-navy-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="block px-4 py-3 mt-4 bg-gold-500 text-navy-900 rounded-md text-lg font-semibold hover:bg-gold-600 transition-colors text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Start Filing
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-navy-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">FBAR Direct</h3>
              <p className="text-gray-300 text-sm">
                The trustworthy, affordable way to file your FBAR.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-gray-400">
                Resources
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/how-it-works" className="text-gray-300 hover:text-white">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-gray-300 hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-gray-300 hover:text-white">
                    About Us
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-gray-400">
                Legal
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="text-gray-300 hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-300 hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800">
            <p className="text-xs text-gray-400 text-center">
              FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S.
              government agency. FBAR Direct is a FinCEN-registered BSA E-Filing
              institution.
            </p>
            <p className="text-xs text-gray-500 text-center mt-2">
              &copy; {new Date().getFullYear()} FBAR Direct. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
