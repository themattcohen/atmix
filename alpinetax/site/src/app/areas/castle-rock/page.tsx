import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Castle Rock Tax Preparation & Consulting',
  description:
    'Tax preparation for Castle Rock, CO residents and businesses along the I-25 corridor. Starting at $600.',
};

export default function CastleRockPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/castle-rock',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Castle Rock',
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
              { label: 'Castle Rock' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Castle Rock Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting serves residents and businesses throughout
            Castle Rock — from the historic downtown to The Meadows, from the
            retail corridor near the outlet mall to the quieter neighborhoods
            surrounding Philip S. Miller Park. Castle Rock is growing rapidly,
            and the tax situations that come with a community in growth mode
            require a preparer who pays attention to the details.
          </p>
        </div>
      </section>

      {/* Why Castle Rock Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Castle Rock Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Castle Rock has experienced some of the most sustained residential
              and commercial growth of any community along the Front Range I-25
              corridor. That growth means an unusually high concentration of new
              business formations — contractors, landscapers, retailers,
              restaurateurs, and service businesses opening their doors for the
              first time and navigating business entity selection, first-year
              startup deductions, and the Douglas County licensing and sales tax
              landscape for the very first time. We work with new Castle Rock
              business owners from the entity formation stage through their
              first several tax filings, building habits and recordkeeping
              systems that make each subsequent year easier.
            </p>
            <p className="text-text-secondary mb-4">
              The construction and real estate industries are deeply embedded in
              Castle Rock&apos;s economy, and both carry distinctive tax
              complexity. Contractors deal with percentage-of-completion
              accounting questions, subcontractor 1099 obligations, equipment
              depreciation under Section 179, and the cash flow timing issues
              that make quarterly estimates particularly important. Real estate
              investors acquiring rental properties in Castle Rock&apos;s newer
              developments need depreciation schedules set up correctly from
              day one — errors here compound over years and become expensive to
              unwind. We handle both industries with the specificity they
              require.
            </p>
            <p className="text-text-secondary">
              Castle Rock&apos;s position at the Douglas County and Elbert
              County boundary also creates occasional jurisdictional questions
              for residents and businesses whose property or operations straddle
              county lines. Property tax assessment, business personal property
              tax, and local tax obligations can differ meaningfully between
              counties, and we make sure Castle Rock clients understand exactly
              which rules apply to their situation.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Castle Rock
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

      {/* Virtual Service */}
      <section className="section-padding bg-white">
        <div className="container-content max-w-3xl space-y-12">
          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Flexible Virtual Service
            </h2>
            <p className="text-text-secondary mb-4">
              Castle Rock clients no longer need to drive north to find a
              qualified tax preparer who understands their situation. Our
              virtual workflow handles everything remotely: upload your
              documents through our secure TaxDome portal, meet via video call,
              and sign electronically — all with flexible scheduling that works
              around the demands of running a business or managing a busy
              household.
            </p>
            <p className="text-text-secondary">
              New business owners in Castle Rock often benefit from an initial
              video consultation to set up their accounting structure properly,
              followed by a streamlined virtual process for quarterly check-ins
              and annual filings. We work however makes sense for your stage of
              business.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 30-minute consultation to discuss your tax
              situation. Whether you&apos;re launching a new business in Castle
              Rock&apos;s growing market, managing construction or real estate
              income, or simply want a preparer who understands the Douglas
              County landscape, we&apos;ll find the right approach for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
