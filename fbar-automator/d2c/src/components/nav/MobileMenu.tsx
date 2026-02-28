"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

export function MobileMenu() {
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
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", handleKeyDown);
    const firstFocusable = mobileMenuRef.current?.querySelector<HTMLElement>(
      "a, button, input, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, closeMobileMenu]);

  return (
    <>
      {/* Hamburger button - visible only on mobile */}
      <button
        ref={hamburgerButtonRef}
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden text-gov-blue p-2"
        aria-label="Open menu"
        aria-expanded={mobileMenuOpen}
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[60] bg-white md:hidden"
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
              <a href="/#who-must-file" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>Who Must File</a>
              <a href="/#how-to-file" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>How to File</a>
              <a href="/#pricing" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>Pricing</a>
              <a href="/#faq" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>FAQ</a>
              <Link href="/contact" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>Contact</Link>
              <Link href="/login" className="block py-2 text-gov-blue text-sm font-semibold border-b border-gray-100" onClick={closeMobileMenu}>Log In</Link>
              <Link href="/signup" className="block bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-3 text-center w-full mt-2" onClick={closeMobileMenu}>Begin Filing</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
