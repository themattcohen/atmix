import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Greenwood Village Tax Preparation & Consulting',
  description:
    'Tax preparation for high-income professionals and businesses in Greenwood Village and the Denver Tech Center. Starting at $600.',
};

export default function GreenwoodVillagePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/greenwood-village',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Greenwood Village',
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
              { label: 'Greenwood Village' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Greenwood Village Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting works with professionals and business owners
            throughout Greenwood Village and the Denver Tech Center — from
            Orchard Road corporate campuses to Greenwood Plaza executive suites,
            from Fiddler&apos;s Green office towers to the residential streets
            east of I-25. High-income situations require a higher level of
            planning, and that&apos;s exactly what we provide.
          </p>
        </div>
      </section>

      {/* Why Greenwood Village Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Greenwood Village Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              The Denver Tech Center concentrates some of Colorado&apos;s
              highest-earning professionals in a few square miles. Tech
              executives, financial services directors, management consultants,
              and senior engineers at DTC-headquartered firms face a category of
              tax complexity that most preparers rarely encounter: stock option
              exercises with AMT exposure, RSU vesting events across multiple
              calendar years, nonqualified deferred compensation distributions,
              and equity compensation packages that blend ISO, NSO, and ESPP
              components. We untangle these situations carefully so you
              don&apos;t pay more than you owe — and so you&apos;re not
              surprised by a large bill in April.
            </p>
            <p className="text-text-secondary mb-4">
              Greenwood Village residents also frequently encounter the
              qualified business income deduction threshold limitations, the
              net investment income tax, and the additional Medicare tax on
              high earners — rules that phase in and interact in ways that make
              year-round planning essential rather than optional. We work with
              clients throughout the year to model Roth conversion windows,
              charitable giving strategies, and timing decisions around bonuses
              and equity events to reduce your overall tax burden legally and
              methodically.
            </p>
            <p className="text-text-secondary">
              Many DTC firms operate across multiple states, and their employees
              sometimes work remotely from other states or receive income from
              out-of-state sources. Multi-state tax returns, reciprocity
              agreements, and allocation of income between jurisdictions is an
              area where errors are costly and common. We handle multi-state
              filings with the same precision we bring to every return, ensuring
              you&apos;re compliant in every state where you have a filing
              obligation.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Greenwood Village
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
              DTC professionals are busy by definition. Our virtual workflow is
              built for clients who can&apos;t afford to block out a weekday
              afternoon for a drive across town: upload your documents through
              our secure TaxDome portal, review everything on a scheduled video
              call, and sign electronically — all without leaving your office or
              home.
            </p>
            <p className="text-text-secondary">
              Complex tax situations often benefit from multiple touchpoints
              throughout the year, not just a single filing appointment.
              Virtual check-ins on a quarterly basis, year-round secure
              messaging, and scheduled video consultations mean we structure
              our relationship around what works for you.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 15-minute consultation to discuss your tax
              situation. Whether you have equity compensation to sort out, a
              multi-state filing requirement, or simply want a preparer who
              understands the complexity that comes with a DTC-level career,
              we&apos;ll find the right approach for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
