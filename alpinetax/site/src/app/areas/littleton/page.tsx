import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Littleton Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Littleton, CO residents. Virtual appointments available. Starting at $600.',
};

export default function LittletonPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/littleton',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Littleton',
            containedInPlace: { '@type': 'State', name: 'Colorado' },
          },
          serviceType: [
            'Tax Preparation',
            'Tax Planning',
            'Small Business Tax',
          ],
          priceRange: '$$',
        }}
      />

      {/* Hero */}
      <section className="section-padding bg-white">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Service Areas', href: '/areas' },
              { label: 'Littleton' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Littleton Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Littleton&apos;s historic Main Street, tight-knit neighborhoods, and
            multigenerational families make it one of the most distinctive
            communities in the Denver metro area. We serve Littleton residents
            with the same personal, detail-oriented approach the city itself is
            known for.
          </p>
        </div>
      </section>

      {/* Why Littleton */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Littleton Residents Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Littleton has a character all its own. The shops and restaurants
              along Main Street represent a thriving small business community —
              boutique owners, independent restaurateurs, professional service
              firms, and craftspeople who built their businesses from the ground
              up. We work with many of these owners on everything from Schedule C
              filings and quarterly estimated taxes to payroll and sales tax
              coordination.
            </p>
            <p className="text-text-secondary mb-4">
              Littleton also has a significant retiree and pre-retiree
              population. Residents drawing on PERA pensions, Social Security
              benefits, and traditional IRA distributions need careful
              optimization of Colorado&apos;s retirement income subtraction.
              We help retirees structure their withdrawals to minimize both
              federal and state tax, taking advantage of Colorado&apos;s
              generous exclusion for taxpayers 55 and older.
            </p>
            <p className="text-text-secondary">
              For families who have been in Littleton for decades, we often
              handle returns across generations — parents, adult children, and
              sometimes grandparents. That continuity gives us deep context on
              family financial histories, property basis, inherited assets, and
              gifting strategies that a new preparer would have to piece together
              from scratch.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Littleton
            </h2>
            <ul className="space-y-3">
              {siteConfig.services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="text-alpine-teal hover:underline font-semibold"
                  >
                    {service.title}
                  </Link>
                  <span className="text-text-secondary">
                    {' '}
                    — {service.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="section-padding bg-white">
        <div className="container-content max-w-3xl">
          <h2 className="font-heading text-3xl text-alpine-blue mb-4">
            How to Get Started
          </h2>
          <p className="text-text-secondary mb-4">
            We make it easy for Littleton clients to work with us virtually.
            Upload documents through our secure portal, schedule a video call
            to ask questions as you go, and handle everything online at your
            convenience.
          </p>
          <p className="text-text-secondary">
            Either way, start with a free 30-minute consultation. Tell us about
            your situation, and we&apos;ll tell you exactly what to expect — the
            service, the timeline, and the price, upfront.
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
