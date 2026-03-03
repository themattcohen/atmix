import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';

export function SiteFooter() {
  return (
    <footer className="bg-alpine-blue text-white">
      <div className="container-content section-padding">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* Column 1: Brand */}
          <div>
            <p className="font-heading font-bold text-xl mb-2">{siteConfig.name}</p>
            <p className="text-white/80 text-sm mb-4">{siteConfig.tagline}</p>
            <p className="text-sm mb-1">
              <a href={`tel:${siteConfig.phoneTel}`} className="hover:text-alpine-teal transition-colors">
                {siteConfig.phone}
              </a>
            </p>
            <p className="text-sm">
              <a href={`mailto:${siteConfig.email}`} className="hover:text-alpine-teal transition-colors">
                {siteConfig.email}
              </a>
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <p className="font-heading font-bold text-lg mb-4">Quick Links</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/services" className="text-white/80 hover:text-alpine-teal transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-white/80 hover:text-alpine-teal transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-white/80 hover:text-alpine-teal transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-white/80 hover:text-alpine-teal transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/80 hover:text-alpine-teal transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href={siteConfig.taxdomeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-alpine-teal transition-colors"
                >
                  Client Portal
                </a>
              </li>
              <li>
                <Link href="/schedule" className="text-white/80 hover:text-alpine-teal transition-colors">
                  Schedule
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hours & Service Areas */}
          <div>
            <p className="font-heading font-bold text-lg mb-4">Hours &amp; Service Areas</p>
            <p className="text-sm text-white/80 mb-4">{siteConfig.hours.display}</p>
            <p className="font-heading font-bold text-sm mb-2">Serving Clients Nationwide</p>
            <ul className="text-sm text-white/80 space-y-1">
              {siteConfig.serviceAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/20">
        <div className="container-content px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/60">
          <p>&copy; {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
