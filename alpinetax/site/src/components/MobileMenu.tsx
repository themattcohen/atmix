'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <nav
        className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl flex flex-col"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <span className="font-heading font-bold text-alpine-blue text-lg">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Services Section */}
          <div className="mb-6">
            <p className="font-heading font-bold text-alpine-blue text-sm uppercase tracking-wide mb-2">
              Services
            </p>
            <ul className="space-y-2 ml-2">
              {siteConfig.services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    onClick={onClose}
                    className="block text-text-secondary hover:text-alpine-teal transition-colors py-1"
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Other Links */}
          <ul className="space-y-3">
            <li>
              <Link
                href="/pricing"
                onClick={onClose}
                className="block font-semibold text-text-primary hover:text-alpine-teal transition-colors"
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                onClick={onClose}
                className="block font-semibold text-text-primary hover:text-alpine-teal transition-colors"
              >
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={onClose}
                className="block font-semibold text-text-primary hover:text-alpine-teal transition-colors"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={onClose}
                className="block font-semibold text-text-primary hover:text-alpine-teal transition-colors"
              >
                Contact
              </Link>
            </li>
            <li>
              <a
                href={siteConfig.taxdomeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="block font-semibold text-text-primary hover:text-alpine-teal transition-colors"
              >
                Client Portal
              </a>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/schedule"
            onClick={onClose}
            className="btn-primary w-full text-center"
          >
            Schedule a Consultation
          </Link>
        </div>
      </nav>
    </div>
  );
}
