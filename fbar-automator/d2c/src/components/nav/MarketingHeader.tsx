"use client";

import Link from "next/link";
import { MobileMenu } from "./MobileMenu";

export function MarketingHeader() {
  return (
    <header className="w-full bg-white border-b border-border-gray relative">
      <nav
        aria-label="Main navigation"
        className="max-w-doc mx-auto px-4 h-auto md:h-24 flex items-center justify-between py-4 md:py-0"
      >
        {/* Logo Area */}
        <div className="flex flex-col items-start">
          <Link href="/" className="font-heading font-bold text-2xl text-gov-blue leading-tight mb-1">
            FBAR Direct
          </Link>
          <span className="text-xs text-text-secondary">
            FinCEN-Registered BSA E-Filing Institution
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <a href="/#who-must-file" className="text-gov-blue text-sm font-semibold hover:underline">Who Must File</a>
          <a href="/#how-to-file" className="text-gov-blue text-sm font-semibold hover:underline">How to File</a>
          <a href="/#pricing" className="text-gov-blue text-sm font-semibold hover:underline">Pricing</a>
          <a href="/#faq" className="text-gov-blue text-sm font-semibold hover:underline">FAQ</a>
          <Link href="/contact" className="text-gov-blue text-sm font-semibold hover:underline">Contact</Link>
          <Link href="/login" className="text-gov-blue text-sm font-semibold hover:underline ml-4">Log In</Link>
          <Link href="/signup" className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-2 transition-colors ml-4">Begin Filing</Link>
        </div>

        {/* Mobile Menu (client component with all interactive state) */}
        <MobileMenu />
      </nav>
    </header>
  );
}
