"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { DeadlineBanner } from "@/components/landing/DeadlineBanner";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    hamburgerButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const firstFocusable = mobileMenuRef.current?.querySelector<HTMLElement>(
      "a, button, input, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  return (
    <div className="min-h-screen flex flex-col font-body text-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg focus:text-gov-blue focus:font-semibold"
      >
        Skip to main content
      </a>

      <DeadlineBanner />

      <header className="w-full bg-white border-b border-border-gray relative z-40">
        <nav
          aria-label="Main navigation"
          className="max-w-doc mx-auto px-4 h-auto md:h-24 flex items-center justify-between py-4 md:py-0"
        >
          {/* Logo Area */}
          <div className="flex flex-col items-start">
            <Link
              href="/"
              className="font-heading font-bold text-2xl text-gov-blue leading-tight mb-1"
            >
              FBAR Direct
            </Link>
            <span className="text-xs text-text-secondary">
              FinCEN-Registered BSA E-Filing Institution
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <a
              href="/#who-must-file"
              className="text-gov-blue text-sm font-semibold hover:underline"
            >
              Who Must File
            </a>
            <a
              href="/#how-to-file"
              className="text-gov-blue text-sm font-semibold hover:underline"
            >
              How to File
            </a>
            <a
              href="/#pricing"
              className="text-gov-blue text-sm font-semibold hover:underline"
            >
              Pricing
            </a>
            <a
              href="/#faq"
              className="text-gov-blue text-sm font-semibold hover:underline"
            >
              FAQ
            </a>
            <Link
              href="/login"
              className="text-gov-blue text-sm font-semibold hover:underline ml-4"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-2 transition-colors ml-4"
            >
              Begin Filing
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            ref={hamburgerButtonRef}
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-gov-blue p-2"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 bg-white md:hidden"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 h-16 border-b border-border-gray">
              <span className="font-heading font-bold text-xl text-gov-blue">
                FBAR Direct
              </span>
              <button
                onClick={closeMobileMenu}
                className="p-2 text-gov-blue"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 px-4 py-8 space-y-4">
              <a
                href="/#who-must-file"
                className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100"
                onClick={closeMobileMenu}
              >
                Who Must File
              </a>
              <a
                href="/#how-to-file"
                className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100"
                onClick={closeMobileMenu}
              >
                How to File
              </a>
              <a
                href="/#pricing"
                className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100"
                onClick={closeMobileMenu}
              >
                Pricing
              </a>
              <a
                href="/#faq"
                className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100"
                onClick={closeMobileMenu}
              >
                FAQ
              </a>
              <Link
                href="/login"
                className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100"
                onClick={closeMobileMenu}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="block bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-3 text-center w-full mt-2"
                onClick={closeMobileMenu}
              >
                Begin Filing
              </Link>
            </div>
          </div>
        </div>
      )}

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="w-full bg-gov-blue-dark text-white py-10 px-4">
        <div className="max-w-doc mx-auto text-left">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand Column */}
            <div>
              <h3 className="font-heading font-bold text-lg text-white mb-2">
                FBAR Direct
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Secure, simplified electronic filing for FinCEN Form 114.
              </p>
              <p className="text-xs text-gray-400">
                FinCEN-Registered BSA E-Filing Institution
              </p>
            </div>

            {/* Links Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">
                Site Links
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/#who-must-file"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Who Must File
                  </a>
                </li>
                <li>
                  <a
                    href="/#how-to-file"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    How to File
                  </a>
                </li>
                <li>
                  <a
                    href="/#pricing"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="/#faq"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Log In
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h4 className="font-bold mb-3 text-gray-200 text-sm uppercase tracking-wider">
                External Resources
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://www.fincen.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    FinCEN.gov
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    IRS FBAR Reference Guide
                  </a>
                </li>
                <li>
                  <a
                    href="https://bsaefiling.fincen.treas.gov/main.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    BSA E-Filing System
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed max-w-[800px]">
              FBAR Direct is not a government agency. FBAR Direct is a registered
              BSA E-Filing institution authorized to submit FinCEN Form 114 on
              behalf of filers. Filing through FBAR Direct does not constitute
              legal or tax advice.
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
