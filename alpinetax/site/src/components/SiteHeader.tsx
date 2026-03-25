'use client';

import { useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';
import { MobileMenu } from '@/components/MobileMenu';

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="container-content flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/images/logo-v2.svg"
            alt={siteConfig.name}
            className="h-14 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          {/* Services Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors">
              Services
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-64">
                {siteConfig.services.map((service) => (
                  <Link
                    key={service.slug}
                    href={`/services/${service.slug}`}
                    className="block px-4 py-2 text-sm text-text-secondary hover:bg-alpine-cream hover:text-alpine-teal transition-colors"
                  >
                    {service.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/pricing" className="text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors">
            Pricing
          </Link>
          <Link href="/faq" className="text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors">
            FAQ
          </Link>
          <Link href="/about" className="text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors">
            Contact
          </Link>
          <a
            href={siteConfig.taxdomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-text-primary hover:text-alpine-teal transition-colors"
          >
            Client Portal
          </a>
          <Link href="/schedule" className="btn-primary text-sm !py-2 !px-4">
            Schedule
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="lg:hidden p-2 text-text-primary hover:text-alpine-teal"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
